import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleSide, BattleSlotId, CombatEvent, SlotRuntimeState, TurnResolution } from '../engine/types';

export type BattleTurnPlaybackPhaseId = 'idle' | 'lock' | 'ranged' | 'impact' | 'casualties';
export type BattleTurnPlaybackCueRole = 'source' | 'target' | 'source-target' | 'casualty';

type SlotCueMap = Partial<Record<`${BattleSide}:${BattleSlotId}`, BattleTurnPlaybackCueRole>>;

interface BattleTurnPlaybackPhase {
  id: BattleTurnPlaybackPhaseId;
  label: string;
  description: string;
  durationMs: number;
  cueMap: SlotCueMap;
  spotlightEvent: CombatEvent | null;
}

interface UseBattleTurnPlaybackTimelineOptions {
  resolution: TurnResolution | null;
  previousSlots: SlotRuntimeState[] | null;
  isPlaybackActive: boolean;
  canAdvance: boolean;
  onAdvanceTurn: () => void;
}

export interface BattleTurnPlaybackTimeline {
  activeTurn: number | null;
  phaseId: BattleTurnPlaybackPhaseId;
  phaseLabel: string;
  phaseDescription: string;
  phaseIndex: number;
  phaseCount: number;
  totalDurationMs: number;
  isAnimating: boolean;
  turnComplete: boolean;
  spotlightEvent: CombatEvent | null;
  cueMap: SlotCueMap;
  phases: Array<Pick<BattleTurnPlaybackPhase, 'id' | 'label'>>;
}

const TARGETED_EVENT_TYPES = new Set<CombatEvent['type']>(['charge', 'engage', 'volley', 'focus_fire', 'brace']);
const RANGED_EVENT_TYPES = new Set<CombatEvent['type']>(['volley', 'focus_fire']);
const IMPACT_EVENT_TYPES = new Set<CombatEvent['type']>(['charge', 'engage', 'brace']);

const SLOT_STATUS_SEVERITY: Record<SlotRuntimeState['status'], number> = {
  ready: 0,
  engaged: 1,
  shaken: 2,
  broken: 3,
  routing: 4,
  withdrawn: 5,
  destroyed: 6,
};

const buildSlotCueKey = (side: BattleSide, slotId: BattleSlotId): `${BattleSide}:${BattleSlotId}` => `${side}:${slotId}`;

const buildUnitCueKey = (slot: SlotRuntimeState): `${BattleSide}:${BattleSlotId}` => `${slot.side}:${slot.originSlotId}`;

const addCue = (cueMap: SlotCueMap, key: `${BattleSide}:${BattleSlotId}` | null, role: BattleTurnPlaybackCueRole): void => {
  if (!key) {
    return;
  }

  const currentRole = cueMap[key];
  if (!currentRole || currentRole === role) {
    cueMap[key] = role;
    return;
  }

  if (
    (currentRole === 'source' && role === 'target') ||
    (currentRole === 'target' && role === 'source') ||
    currentRole === 'source-target'
  ) {
    cueMap[key] = 'source-target';
    return;
  }

  cueMap[key] = role;
};

const buildEventCueMap = (events: CombatEvent[]): SlotCueMap => {
  const cueMap: SlotCueMap = {};

  for (const event of events) {
    if (event.slotId) {
      addCue(cueMap, buildSlotCueKey(event.side, event.slotId), 'source');
    }

    if (event.targetSlotId) {
      addCue(cueMap, buildSlotCueKey(event.side === 'player' ? 'enemy' : 'player', event.targetSlotId), 'target');
    }
  }

  return cueMap;
};

const buildCasualtyCueMap = (resolution: TurnResolution, previousSlots: SlotRuntimeState[] | null): SlotCueMap => {
  if (!previousSlots) {
    return {};
  }

  const previousSlotsByUnit = new Map(previousSlots.map((slot) => [buildUnitCueKey(slot), slot] as const));
  const cueMap: SlotCueMap = {};

  for (const slot of resolution.slots) {
    const previousSlot = previousSlotsByUnit.get(buildUnitCueKey(slot));
    if (!previousSlot) {
      continue;
    }

    const lostHp = slot.currentHp < previousSlot.currentHp;
    const lostMorale = slot.currentMorale + 6 < previousSlot.currentMorale;
    const statusWorsened = SLOT_STATUS_SEVERITY[slot.status] > SLOT_STATUS_SEVERITY[previousSlot.status];

    if (!lostHp && !lostMorale && !statusWorsened) {
      continue;
    }

    addCue(cueMap, buildSlotCueKey(slot.side, slot.slotId), 'casualty');
  }

  return cueMap;
};

const buildPhaseDescription = (label: string, eventCount: number, fallback: string): string =>
  eventCount > 0 ? `${label} · ${eventCount} udalosti v okne.` : fallback;

const buildTimelinePhases = (resolution: TurnResolution | null, previousSlots: SlotRuntimeState[] | null): BattleTurnPlaybackPhase[] => {
  if (!resolution) {
    return [
      {
        id: 'idle',
        label: 'Pohotovost',
        description: 'Bitva ceka na prvni vyhodnocene kolo.',
        durationMs: 0,
        cueMap: {},
        spotlightEvent: null,
      },
    ];
  }

  const targetedEvents = resolution.events.filter((event) => TARGETED_EVENT_TYPES.has(event.type) || event.targetSlotId !== null);
  const rangedEvents = resolution.events.filter((event) => RANGED_EVENT_TYPES.has(event.type));
  const impactEvents = resolution.events.filter((event) => IMPACT_EVENT_TYPES.has(event.type));
  const casualtyCueMap = buildCasualtyCueMap(resolution, previousSlots);

  return [
    {
      id: 'lock',
      label: 'Target lock',
      description: buildPhaseDescription('Formace zamiruji', targetedEvents.length, 'Formace znovu hledaji linie a cile.'),
      durationMs: 700,
      cueMap: buildEventCueMap(targetedEvents),
      spotlightEvent: targetedEvents[0] ?? resolution.events[0] ?? null,
    },
    {
      id: 'ranged',
      label: 'Ranged',
      description: buildPhaseDescription('Strelecke salvy', rangedEvents.length, 'Strelci drzi nerv a cekaji na okno.'),
      durationMs: 850,
      cueMap: buildEventCueMap(rangedEvents),
      spotlightEvent: rangedEvents[0] ?? null,
    },
    {
      id: 'impact',
      label: 'Charge / melee',
      description: buildPhaseDescription('Narazy a kontakt', impactEvents.length, 'Fronta se stahuje do tesneho kontaktu.'),
      durationMs: 1050,
      cueMap: buildEventCueMap(impactEvents),
      spotlightEvent: impactEvents[0] ?? resolution.events[0] ?? null,
    },
    {
      id: 'casualties',
      label: 'Casualties',
      description:
        Object.keys(casualtyCueMap).length > 0
          ? `Ztraty a moralni tlak · ${Object.keys(casualtyCueMap).length} zasazenych slotu.`
          : 'Linie se stabilizuji bez zretelneho rozpadu.',
      durationMs: 900,
      cueMap: casualtyCueMap,
      spotlightEvent:
        resolution.events.find((event) => event.type === 'line_break' || event.type === 'rout') ??
        resolution.events[resolution.events.length - 1] ??
        null,
    },
  ];
};

export const useBattleTurnPlaybackTimeline = ({
  resolution,
  previousSlots,
  isPlaybackActive,
  canAdvance,
  onAdvanceTurn,
}: UseBattleTurnPlaybackTimelineOptions): BattleTurnPlaybackTimeline => {
  const onAdvanceTurnRef = useRef(onAdvanceTurn);
  const playbackTimerRef = useRef<number | null>(null);
  const completedTurnRef = useRef<number | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [trackedTurn, setTrackedTurn] = useState<number | null>(resolution?.turn ?? null);
  const [turnComplete, setTurnComplete] = useState(!resolution);

  const phases = useMemo(() => buildTimelinePhases(resolution, previousSlots), [previousSlots, resolution]);
  const currentPhase = phases[phaseIndex] ?? phases[0];
  const totalDurationMs = phases.reduce((sum, phase) => sum + phase.durationMs, 0);

  useEffect(() => {
    onAdvanceTurnRef.current = onAdvanceTurn;
  }, [onAdvanceTurn]);

  useEffect(
    () => () => {
      if (playbackTimerRef.current !== null) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!resolution) {
      setTrackedTurn(null);
      setPhaseIndex(0);
      setTurnComplete(true);
      completedTurnRef.current = null;
      return;
    }

    if (trackedTurn !== resolution.turn) {
      setTrackedTurn(resolution.turn);
      setPhaseIndex(0);
      setTurnComplete(false);
    }
  }, [resolution, trackedTurn]);

  useEffect(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!resolution || !isPlaybackActive || trackedTurn !== resolution.turn || turnComplete) {
      return;
    }

    const phaseDurationMs = phases[phaseIndex]?.durationMs ?? 0;
    if (phaseDurationMs <= 0) {
      if (phaseIndex >= phases.length - 1) {
        setTurnComplete(true);
      } else {
        setPhaseIndex((currentPhaseIndex) => Math.min(currentPhaseIndex + 1, phases.length - 1));
      }
      return;
    }

    playbackTimerRef.current = window.setTimeout(() => {
      playbackTimerRef.current = null;
      if (phaseIndex >= phases.length - 1) {
        setTurnComplete(true);
        return;
      }

      setPhaseIndex((currentPhaseIndex) => Math.min(currentPhaseIndex + 1, phases.length - 1));
    }, phaseDurationMs);

    return () => {
      if (playbackTimerRef.current !== null) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaybackActive, phaseIndex, phases, resolution, trackedTurn, turnComplete]);

  useEffect(() => {
    if (!resolution || !turnComplete) {
      return;
    }

    if (completedTurnRef.current === resolution.turn) {
      return;
    }

    completedTurnRef.current = resolution.turn;

    if (isPlaybackActive && canAdvance) {
      onAdvanceTurnRef.current();
    }
  }, [canAdvance, isPlaybackActive, resolution, turnComplete]);

  return {
    activeTurn: resolution?.turn ?? null,
    phaseId: currentPhase?.id ?? 'idle',
    phaseLabel: currentPhase?.label ?? 'Pohotovost',
    phaseDescription: currentPhase?.description ?? 'Bitva ceka na dalsi vyhodnoceni.',
    phaseIndex,
    phaseCount: phases.length,
    totalDurationMs,
    isAnimating: Boolean(resolution) && !turnComplete,
    turnComplete,
    spotlightEvent: currentPhase?.spotlightEvent ?? null,
    cueMap: currentPhase?.cueMap ?? {},
    phases: phases.map(({ id, label }) => ({ id, label })),
  };
};
