import { getMeleeContactSlotIds, getSlotMeta } from './slotUtils';
import { getOpposingSide, getSideSlots, isHealthyLineHolder, isSlotCombatReady } from './stateUtils';
import type { ArmyRuntimeState, BattleRuntimeState, SlotActionId, SlotRuntimeState, UnitTemplate } from './types';

type PlannedIntent = {
  action: SlotActionId;
  targetSlotId: SlotRuntimeState['targetSlotId'];
  warning?: string;
};

const DOCTRINE_WARNING = {
  counter_archers: 'Archers have no enemy archers to counter; doctrine fell back to auto targeting.',
  support_center: 'Archers could not support the center and switched to auto targeting.',
  finish_broken: 'Archers have no broken target to finish and switched to auto targeting.',
} as const;

const pickBestTarget = (
  _slot: SlotRuntimeState,
  candidates: SlotRuntimeState[],
  scoreTarget: (candidate: SlotRuntimeState) => number,
): SlotRuntimeState | null => {
  let bestCandidate: SlotRuntimeState | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreTarget(candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
};

const getReplacementReserve = (slot: SlotRuntimeState, slots: SlotRuntimeState[]): SlotRuntimeState | null => {
  const reserveSlotId = `${slot.sector}_reserve` as SlotRuntimeState['slotId'];
  return (
    slots.find(
      (candidate) => candidate.side === slot.side && candidate.slotId === reserveSlotId && isHealthyLineHolder(candidate),
    ) ?? null
  );
};

const scoreMeleeTarget = (slot: SlotRuntimeState, target: SlotRuntimeState): number => {
  const slotMeta = getSlotMeta(slot.slotId);
  const targetMeta = getSlotMeta(target.slotId);
  let score = 0;

  if (slotMeta.sector === targetMeta.sector) {
    score += 36;
  }
  if (slotMeta.rank === targetMeta.rank) {
    score += 20;
  }
  if (target.flankExposed) {
    score += 18;
  }
  if (target.status === 'broken') {
    score += 22;
  }
  if (target.status === 'routing') {
    score += 30;
  }
  if (target.rank === 'reserve' && slot.rank !== 'reserve') {
    score -= 20;
  }
  if (slot.archetype === 'cavalry') {
    score += target.archetype === 'archer' ? 14 : 0;
    score += target.status === 'shaken' ? 10 : 0;
  }
  if (slot.archetype === 'infantry' && target.archetype === 'cavalry') {
    score += 8;
  }

  return score;
};

const canParticipateInMelee = (slot: SlotRuntimeState): boolean => slot.rank === 'front';

const findDefaultMeleeTarget = (slot: SlotRuntimeState, slots: SlotRuntimeState[]): SlotRuntimeState | null => {
  if (!canParticipateInMelee(slot)) {
    return null;
  }

  const enemySlots = getSideSlots(slots, getOpposingSide(slot.side)).filter(
    (candidate) => isSlotCombatReady(candidate) && candidate.rank === 'front',
  );
  const contactTargets = enemySlots.filter((candidate) => getMeleeContactSlotIds(slot.slotId).includes(candidate.slotId));

  if (contactTargets.length === 0) {
    return null;
  }

  return pickBestTarget(slot, contactTargets, (candidate) => scoreMeleeTarget(slot, candidate));
};

const rankScore = (target: SlotRuntimeState): number => {
  if (target.rank === 'front') {
    return 24;
  }
  if (target.rank === 'main') {
    return 12;
  }
  return -8;
};

const findAutoRangedTarget = (slot: SlotRuntimeState, slots: SlotRuntimeState[]): SlotRuntimeState | null => {
  const enemySlots = getSideSlots(slots, getOpposingSide(slot.side)).filter(isSlotCombatReady);
  return pickBestTarget(slot, enemySlots, (target) => {
    let score = rankScore(target);
    if (target.sector === slot.sector) {
      score += 20;
    }
    if (target.status === 'shaken') {
      score += 10;
    }
    if (target.status === 'broken') {
      score += 16;
    }
    if (target.archetype === 'archer') {
      score += 8;
    }
    score += (1 - target.currentHp / target.maxHp) * 14;
    return score;
  });
};

const findRangedTarget = (slot: SlotRuntimeState, slots: SlotRuntimeState[]): PlannedIntent => {
  const enemySlots = getSideSlots(slots, getOpposingSide(slot.side)).filter(isSlotCombatReady);

  if (enemySlots.length === 0) {
    return {
      action: 'hold',
      targetSlotId: null,
    };
  }

  if (slot.rangedDoctrine === 'counter_archers') {
    const archers = enemySlots.filter((candidate) => candidate.archetype === 'archer');
    if (archers.length > 0) {
      const target = pickBestTarget(slot, archers, (candidate) => {
        let score = 50 + rankScore(candidate);
        score += candidate.sector === slot.sector ? 10 : 0;
        score += (1 - candidate.currentHp / candidate.maxHp) * 16;
        return score;
      });
      return {
        action: 'focus_fire',
        targetSlotId: target?.slotId ?? null,
      };
    }
  }

  if (slot.rangedDoctrine === 'support_center') {
    const centerTargets = enemySlots.filter((candidate) => candidate.sector === 'center');
    if (centerTargets.length > 0) {
      const target = pickBestTarget(slot, centerTargets, (candidate) => rankScore(candidate) + 24);
      return {
        action: 'volley',
        targetSlotId: target?.slotId ?? null,
      };
    }
  }

  if (slot.rangedDoctrine === 'finish_broken') {
    const brokenTargets = enemySlots.filter((candidate) => candidate.status === 'broken' || candidate.status === 'routing');
    if (brokenTargets.length > 0) {
      const target = pickBestTarget(slot, brokenTargets, (candidate) => 60 + rankScore(candidate));
      return {
        action: 'focus_fire',
        targetSlotId: target?.slotId ?? null,
      };
    }
  }

  const fallbackTarget = findAutoRangedTarget(slot, slots);
  const warning =
    slot.rangedDoctrine === 'auto'
      ? undefined
      : DOCTRINE_WARNING[slot.rangedDoctrine as keyof typeof DOCTRINE_WARNING];

  return {
    action: fallbackTarget ? 'volley' : 'hold',
    targetSlotId: fallbackTarget?.slotId ?? null,
    warning,
  };
};

const enemyLikelyCharge = (
  slot: SlotRuntimeState,
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
): boolean => {
  const opposingArmy = slot.side === 'player' ? battle.enemyArmy : battle.playerArmy;
  const opposingSlot = findDefaultMeleeTarget(slot, slots);
  if (!opposingSlot) {
    return false;
  }

  return (
    opposingSlot.archetype === 'cavalry' &&
    opposingSlot.currentStamina >= 45 &&
    (opposingArmy.plan === 'pressure' || opposingSlot.stance === 'aggressive')
  );
};

export const chooseSlotIntent = (
  slot: SlotRuntimeState,
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
): PlannedIntent => {
  const template = templatesById[slot.templateId];
  if (!template || !isSlotCombatReady(slot)) {
    return { action: 'hold', targetSlotId: null };
  }

  const owningArmy: ArmyRuntimeState = slot.side === 'player' ? battle.playerArmy : battle.enemyArmy;
  const hpRatio = slot.currentHp / Math.max(1, slot.maxHp);
  const moraleRatio = slot.currentMorale / Math.max(1, template.morale + template.fortMorale);

  if (owningArmy.retreatIssued) {
    return {
      action: slot.rank === 'reserve' ? 're_form' : 'withdraw',
      targetSlotId: null,
    };
  }

  if (slot.status === 'broken' || slot.status === 'routing' || hpRatio <= 0.15 || moraleRatio <= 0.18) {
    return {
      action: getReplacementReserve(slot, slots) ? 'withdraw' : 're_form',
      targetSlotId: null,
    };
  }

  if (slot.archetype === 'archer') {
    if (slot.currentAmmo <= 0) {
      return {
        action: 'hold',
        targetSlotId: null,
      };
    }
    return findRangedTarget(slot, slots);
  }

  if (!canParticipateInMelee(slot)) {
    return {
      action: 'hold',
      targetSlotId: null,
    };
  }

  const target = findDefaultMeleeTarget(slot, slots);
  if (!target) {
    return {
      action: slot.chargeCooldown > 0 ? 're_form' : 'hold',
      targetSlotId: null,
    };
  }

  if (slot.archetype === 'cavalry') {
    if (slot.chargeCooldown > 0 || slot.currentStamina < 42) {
      return {
        action: 're_form',
        targetSlotId: null,
      };
    }

    const shouldCharge =
      slot.stance === 'aggressive' ||
      owningArmy.plan === 'pressure' ||
      target.flankExposed ||
      target.status === 'shaken' ||
      target.status === 'broken';

    return {
      action: shouldCharge ? 'charge' : 'advance',
      targetSlotId: target.slotId,
    };
  }

  const shouldBrace =
    slot.stance === 'defensive' ||
    owningArmy.plan === 'hold_line' ||
    enemyLikelyCharge(slot, battle, slots);

  return {
    action: shouldBrace ? 'brace' : slot.stance === 'aggressive' || owningArmy.plan === 'pressure' ? 'advance' : 'hold',
    targetSlotId: target.slotId,
  };
};
