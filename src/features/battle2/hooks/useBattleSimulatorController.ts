import { useEffect, useRef, useState } from 'react';
import { BATTLE_UNIT_TEMPLATES, BATTLE_UNIT_TEMPLATES_BY_ID } from '../data/unitTemplates';
import { ENEMY_TEMPLATE_DEFINITIONS } from '../data/enemyTemplates';
import { createArmyDefinition } from '../engine/armyUtils';
import { countDeploymentDifferences, countFrontlineArchers, createAutoDeploymentSlots } from '../engine/autoDeployment';
import { canTargetEnemySlot, getAggressivePointerAction } from '../engine/commandRules';
import { createBattleSetup } from '../engine/enemyGenerator';
import { createBattleRuntime, stepBattle } from '../engine/simCore';
import type { BattleSetupOutput } from '../engine/contracts';
import type {
  ArmyDefinition,
  ArmyPlanId,
  ArmySlotLoadout,
  BattleSlotId,
  BattleRuntimeState,
  BattleScenarioSeed,
  GeneralPerkId,
  GeneralLoadout,
  RangedDoctrineId,
  SlotRuntimeState,
  SlotActionId,
  SlotStance,
  UnitTemplate,
} from '../engine/types';

const PLAYBACK_DELAY_MS = 850;

type GeneralPerkDraft = GeneralPerkId | null;
export type DeploymentMode = 'manual' | 'auto';

export interface ManualOrderOverride {
  action: SlotActionId | null;
  targetSlotId: BattleSlotId | null;
}

export interface PlayerDraftState {
  generalName: string;
  perkSlots: GeneralPerkDraft[];
  plan: ArmyPlanId;
  slots: ArmySlotLoadout[];
}

export interface BattleSnapshotState {
  seed: BattleScenarioSeed;
  setup: BattleSetupOutput;
}

export interface AutoDeploymentState {
  changedSlotCount: number;
  frontlineArchers: number;
  unitCount: number;
}

const DEFAULT_GENERAL_PERKS: GeneralPerkDraft[] = ['wedge', 'pavise', 'ranger'];

const DEFAULT_SLOT_PRESET: Array<Pick<ArmySlotLoadout, 'slotId' | 'templateId' | 'stance' | 'rangedDoctrine'>> = [
  { slotId: 'left_front', templateId: 'DRU_PES', stance: 'defensive', rangedDoctrine: 'auto' },
  { slotId: 'center_front', templateId: 'HRA_PES', stance: 'defensive', rangedDoctrine: 'auto' },
  { slotId: 'right_front', templateId: 'DRU_PES', stance: 'defensive', rangedDoctrine: 'auto' },
  { slotId: 'left_main', templateId: 'DRU_LUK', stance: 'balanced', rangedDoctrine: 'counter_archers' },
  { slotId: 'center_main', templateId: 'DRU_PES', stance: 'balanced', rangedDoctrine: 'support_center' },
  { slotId: 'right_main', templateId: 'DRU_LUK', stance: 'balanced', rangedDoctrine: 'counter_archers' },
  { slotId: 'left_reserve', templateId: 'DRU_JEZ', stance: 'aggressive', rangedDoctrine: 'auto' },
  { slotId: 'center_reserve', templateId: 'DRU_PES', stance: 'balanced', rangedDoctrine: 'auto' },
  { slotId: 'right_reserve', templateId: 'DRU_JEZ', stance: 'aggressive', rangedDoctrine: 'auto' },
];

const DEFAULT_DRAFT: PlayerDraftState = {
  generalName: 'Lord Marshal',
  perkSlots: DEFAULT_GENERAL_PERKS,
  plan: 'standard',
  slots: DEFAULT_SLOT_PRESET.map((slot) => ({ ...slot })),
};

const getRandomToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const timestamp = Date.now().toString(36);
  const randomBits = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${randomBits}`;
};

const pickRandomItem = <T,>(items: readonly T[]): T => {
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0];
};

const createRandomBattleSeed = (): BattleScenarioSeed => ({
  enemyTemplateId: pickRandomItem(ENEMY_TEMPLATE_DEFINITIONS).id,
  seed: `battle-${getRandomToken()}`,
});

const cloneSlots = (slots: ArmySlotLoadout[]): ArmySlotLoadout[] => slots.map((slot) => ({ ...slot }));

const countPerkDrafts = (perkSlots: GeneralPerkDraft[]): GeneralLoadout['perkPoints'] =>
  perkSlots.reduce<GeneralLoadout['perkPoints']>((accumulator, perk) => {
    if (!perk) {
      return accumulator;
    }
    accumulator[perk] = (accumulator[perk] ?? 0) + 1;
    return accumulator;
  }, {});

const buildPlayerArmy = (draft: PlayerDraftState): ArmyDefinition =>
  createArmyDefinition(
    'player',
    {
      name: draft.generalName.trim() || 'Lord Marshal',
      perkPoints: countPerkDrafts(draft.perkSlots),
    },
    draft.plan,
    draft.slots,
  );

const createInitialDraft = (): PlayerDraftState => ({
  generalName: DEFAULT_DRAFT.generalName,
  perkSlots: [...DEFAULT_DRAFT.perkSlots],
  plan: DEFAULT_DRAFT.plan,
  slots: cloneSlots(DEFAULT_DRAFT.slots),
});

const replaceDraftSlots = (draft: PlayerDraftState, slots: ArmySlotLoadout[]): PlayerDraftState => ({
  ...draft,
  slots: cloneSlots(slots),
});

const createAutoDeploymentDraft = (draft: PlayerDraftState): PlayerDraftState =>
  replaceDraftSlots(draft, createAutoDeploymentSlots(draft.slots, BATTLE_UNIT_TEMPLATES_BY_ID));

const createPlayerDraftFromArmy = (army: ArmyDefinition): PlayerDraftState => ({
  generalName: army.general.name,
  perkSlots: DEFAULT_GENERAL_PERKS.slice(0, 3),
  plan: army.plan,
  slots: cloneSlots(army.slots),
});

const createDraftArmyTemplate = (template: UnitTemplate | undefined): string => template?.name ?? 'Unknown';

const isRuntimeSlotActive = (slot: SlotRuntimeState): boolean => slot.status !== 'destroyed' && slot.status !== 'withdrawn' && slot.currentHp > 0;

const resolveSupportPointerAction = (slot: SlotRuntimeState): SlotActionId => {
  if (slot.archetype === 'archer') {
    return 'volley';
  }

  if (slot.rank !== 'front') {
    return 'hold';
  }

  if (slot.archetype === 'cavalry') {
    return 'advance';
  }

  return 'brace';
};

const findRuntimeSlot = (
  runtime: BattleRuntimeState,
  side: 'player' | 'enemy',
  slotId: BattleSlotId,
): SlotRuntimeState | null => runtime.slots.find((slot) => slot.side === side && slot.slotId === slotId) ?? null;

const resolveSupportTargetSlotId = (
  runtime: BattleRuntimeState,
  sourceSlot: SlotRuntimeState,
  supportSlot: SlotRuntimeState,
): BattleSlotId | null => {
  const activeEnemies = runtime.slots.filter((slot) => slot.side === 'enemy' && isRuntimeSlotActive(slot));

  if (supportSlot.targetSlotId) {
    const matchingTarget = activeEnemies.find((slot) => slot.slotId === supportSlot.targetSlotId);
    if (matchingTarget) {
      return matchingTarget.slotId;
    }
  }

  const supportSectorTarget = activeEnemies.find((slot) => slot.sector === supportSlot.sector);
  if (supportSectorTarget) {
    return supportSectorTarget.slotId;
  }

  const sourceSectorTarget = activeEnemies.find((slot) => slot.sector === sourceSlot.sector);
  if (sourceSectorTarget) {
    return sourceSectorTarget.slotId;
  }

  return activeEnemies[0]?.slotId ?? null;
};

export interface BattleSimulatorController {
  draft: PlayerDraftState;
  deploymentMode: DeploymentMode;
  autoDeployment: AutoDeploymentState;
  battleSeed: BattleScenarioSeed;
  runtime: BattleRuntimeState | null;
  frozenSetup: BattleSetupOutput | null;
  isPlaying: boolean;
  manualOrders: Partial<Record<BattleSlotId, ManualOrderOverride>>;
  playbackDelayMs: number;
  currentSetup: ReturnType<typeof createBattleSetup>;
  enemyTemplateLabel: string;
  enemyTemplateDescription: string;
  actions: {
    setGeneralName: (value: string) => void;
    setGeneralPerkSlot: (index: number, value: GeneralPerkDraft) => void;
    setPlan: (value: ArmyPlanId) => void;
    setDeploymentMode: (value: DeploymentMode) => void;
    setSlotTemplate: (slotId: ArmySlotLoadout['slotId'], value: string | null) => void;
    setSlotStance: (slotId: ArmySlotLoadout['slotId'], value: SlotStance) => void;
    setSlotDoctrine: (slotId: ArmySlotLoadout['slotId'], value: RangedDoctrineId) => void;
    applyAutoDeployment: () => void;
    setManualOrder: (slotId: BattleSlotId, update: Partial<ManualOrderOverride>) => void;
    issuePointerCommand: (sourceSlotId: BattleSlotId, targetSlotId: BattleSlotId, targetSide: 'player' | 'enemy') => void;
    clearManualOrder: (slotId: BattleSlotId) => void;
    clearAllManualOrders: () => void;
    startBattle: () => void;
    pauseBattle: () => void;
    resumeBattle: () => void;
    stepTurn: () => void;
    resetBattle: () => void;
    newBattle: () => void;
  };
}

export const useBattleSimulatorController = (): BattleSimulatorController => {
  const [draft, setDraft] = useState<PlayerDraftState>(() => createInitialDraft());
  const [deploymentMode, setDeploymentModeState] = useState<DeploymentMode>('manual');
  const [battleSeed, setBattleSeed] = useState<BattleScenarioSeed>(() => createRandomBattleSeed());
  const [frozenSetup, setFrozenSetup] = useState<BattleSetupOutput | null>(null);
  const [runtime, setRuntime] = useState<BattleRuntimeState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualOrders, setManualOrders] = useState<Partial<Record<BattleSlotId, ManualOrderOverride>>>({});
  const playbackTimerRef = useRef<number | null>(null);
  const autoDeploymentDraft = createAutoDeploymentDraft(draft);
  const autoDeployment: AutoDeploymentState = {
    changedSlotCount: countDeploymentDifferences(draft.slots, autoDeploymentDraft.slots),
    frontlineArchers: countFrontlineArchers(autoDeploymentDraft.slots, BATTLE_UNIT_TEMPLATES_BY_ID),
    unitCount: draft.slots.reduce((count, slot) => (slot.templateId ? count + 1 : count), 0),
  };

  const playerArmy = buildPlayerArmy(draft);
  const currentSetup = createBattleSetup(playerArmy, battleSeed, BATTLE_UNIT_TEMPLATES);
  const enemyTemplate = ENEMY_TEMPLATE_DEFINITIONS.find((template) => template.id === battleSeed.enemyTemplateId) ?? ENEMY_TEMPLATE_DEFINITIONS[0];

  useEffect(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!isPlaying || !runtime || runtime.finished) {
      return;
    }

    playbackTimerRef.current = window.setTimeout(() => {
      playbackTimerRef.current = null;
      advanceBattleTurn();
    }, PLAYBACK_DELAY_MS);

    return () => {
      if (playbackTimerRef.current !== null) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, manualOrders, runtime]);

  useEffect(() => {
    if (runtime?.finished) {
      setIsPlaying(false);
    }
  }, [runtime?.finished]);

  const setSlot = (slotId: ArmySlotLoadout['slotId'], updater: (slot: ArmySlotLoadout) => ArmySlotLoadout) => {
    setDraft((current) => ({
      ...current,
      slots: current.slots.map((slot) => (slot.slotId === slotId ? updater(slot) : slot)),
    }));
  };

  const setGeneralName = (value: string) => {
    setDraft((current) => ({ ...current, generalName: value }));
  };

  const setGeneralPerkSlot = (index: number, value: GeneralPerkDraft) => {
    setDraft((current) => {
      const nextPerkSlots = [...current.perkSlots];
      nextPerkSlots[index] = value;
      return { ...current, perkSlots: nextPerkSlots };
    });
  };

  const setPlan = (value: ArmyPlanId) => {
    setDraft((current) => ({ ...current, plan: value }));
  };

  const setDeploymentMode = (value: DeploymentMode) => {
    setDeploymentModeState(value);
  };

  const setSlotTemplate = (slotId: ArmySlotLoadout['slotId'], value: string | null) => {
    setSlot(slotId, (slot) => ({ ...slot, templateId: value }));
  };

  const setSlotStance = (slotId: ArmySlotLoadout['slotId'], value: SlotStance) => {
    setSlot(slotId, (slot) => ({ ...slot, stance: value }));
  };

  const setSlotDoctrine = (slotId: ArmySlotLoadout['slotId'], value: RangedDoctrineId) => {
    setSlot(slotId, (slot) => ({ ...slot, rangedDoctrine: value }));
  };

  const setManualOrder = (slotId: BattleSlotId, update: Partial<ManualOrderOverride>) => {
    setManualOrders((current) => ({
      ...current,
      [slotId]: {
        action: current[slotId]?.action ?? null,
        targetSlotId: current[slotId]?.targetSlotId ?? null,
        ...update,
      },
    }));
  };

  const issuePointerCommand = (sourceSlotId: BattleSlotId, targetSlotId: BattleSlotId, targetSide: 'player' | 'enemy') => {
    if (!runtime || runtime.finished) {
      return;
    }

    const sourceSlot = findRuntimeSlot(runtime, 'player', sourceSlotId);
    if (!sourceSlot || !isRuntimeSlotActive(sourceSlot)) {
      return;
    }

    if (targetSide === 'enemy') {
      const enemyTarget = findRuntimeSlot(runtime, 'enemy', targetSlotId);
      if (!enemyTarget || !isRuntimeSlotActive(enemyTarget)) {
        return;
      }

      const aggressiveAction = getAggressivePointerAction(sourceSlot);
      if (!aggressiveAction || !canTargetEnemySlot(sourceSlot, enemyTarget.slotId, aggressiveAction)) {
        return;
      }

      setManualOrder(sourceSlotId, {
        action: aggressiveAction,
        targetSlotId: enemyTarget.slotId,
      });
      return;
    }

    const supportSlot = findRuntimeSlot(runtime, 'player', targetSlotId);
    if (!supportSlot || !isRuntimeSlotActive(supportSlot)) {
      return;
    }

    setManualOrder(sourceSlotId, {
      action: resolveSupportPointerAction(sourceSlot),
      targetSlotId: resolveSupportTargetSlotId(runtime, sourceSlot, supportSlot),
    });
  };

  const clearManualOrder = (slotId: BattleSlotId) => {
    setManualOrders((current) => {
      const { [slotId]: _removed, ...next } = current;
      return next;
    });
  };

  const clearAllManualOrders = () => {
    setManualOrders({});
  };

  const advanceBattleTurn = () => {
    setRuntime((current) => {
      if (!current || current.finished) {
        return current;
      }

      return stepBattle(current, BATTLE_UNIT_TEMPLATES, { playerManualOrders: manualOrders }).nextState;
    });
    setManualOrders({});
  };

  const clearPlaybackTimer = () => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const applyAutoDeployment = () => {
    setDraft((current) => createAutoDeploymentDraft(current));
    setDeploymentModeState('manual');
  };

  const startBattle = () => {
    clearPlaybackTimer();
    clearAllManualOrders();
    const battleDraft = deploymentMode === 'auto' ? autoDeploymentDraft : draft;
    if (deploymentMode === 'auto') {
      setDraft(battleDraft);
    }
    const setup = createBattleSetup(buildPlayerArmy(battleDraft), battleSeed, BATTLE_UNIT_TEMPLATES);
    setFrozenSetup(setup);
    setRuntime(createBattleRuntime(setup, BATTLE_UNIT_TEMPLATES));
    setIsPlaying(true);
  };

  const pauseBattle = () => {
    clearPlaybackTimer();
    setIsPlaying(false);
  };

  const resumeBattle = () => {
    if (!runtime || runtime.finished) {
      return;
    }

    setIsPlaying(true);
  };

  const stepTurn = () => {
    clearPlaybackTimer();
    setIsPlaying(false);
    advanceBattleTurn();
  };

  const resetBattle = () => {
    clearPlaybackTimer();
    clearAllManualOrders();
    if (frozenSetup) {
      setRuntime(createBattleRuntime(frozenSetup, BATTLE_UNIT_TEMPLATES));
    } else {
      setRuntime(null);
    }
    setIsPlaying(false);
  };

  const newBattle = () => {
    clearPlaybackTimer();
    clearAllManualOrders();
    const nextSeed = createRandomBattleSeed();
    setBattleSeed(nextSeed);
    setFrozenSetup(null);
    setRuntime(null);
    setIsPlaying(false);
  };

  return {
    draft,
    deploymentMode,
    autoDeployment,
    battleSeed,
    runtime,
    frozenSetup,
    isPlaying,
    manualOrders,
    playbackDelayMs: PLAYBACK_DELAY_MS,
    currentSetup,
    enemyTemplateLabel: enemyTemplate.label,
    enemyTemplateDescription: enemyTemplate.description,
    actions: {
      setGeneralName,
      setGeneralPerkSlot,
      setPlan,
      setDeploymentMode,
      setSlotTemplate,
      setSlotStance,
      setSlotDoctrine,
      applyAutoDeployment,
      setManualOrder,
      issuePointerCommand,
      clearManualOrder,
      clearAllManualOrders,
      startBattle,
      pauseBattle,
      resumeBattle,
      stepTurn,
      resetBattle,
      newBattle,
    },
  };
};

export const createDraftFromArmy = createPlayerDraftFromArmy;
export const getBattleTemplates = () => BATTLE_UNIT_TEMPLATES;
export const getBattleTemplateById = (templateId: string): UnitTemplate | undefined => BATTLE_UNIT_TEMPLATES_BY_ID[templateId];
export const getBattleTemplateName = createDraftArmyTemplate;
