import { BATTLE_SLOT_ORDER } from './constants';
import { getMeleeContactSlotIds } from './slotUtils';
import type { BattleSlotId, SlotActionId, SlotRuntimeState } from './types';

type SlotCommandContext = Pick<SlotRuntimeState, 'archetype' | 'rank' | 'slotId' | 'status'>;

export const ACTIONS_REQUIRING_ENEMY_TARGET: SlotActionId[] = ['advance', 'volley', 'focus_fire', 'charge'];

export const doesActionUseEnemyTarget = (action: SlotActionId | null | undefined): action is SlotActionId =>
  Boolean(action && ACTIONS_REQUIRING_ENEMY_TARGET.includes(action));

export const getAggressivePointerAction = (slot: Pick<SlotRuntimeState, 'archetype' | 'rank'>): SlotActionId | null => {
  if (slot.archetype === 'archer') {
    return 'focus_fire';
  }

  if (slot.rank !== 'front') {
    return null;
  }

  return slot.archetype === 'cavalry' ? 'charge' : 'advance';
};

export const getAllowedManualActions = (slot: SlotCommandContext | null): SlotActionId[] => {
  if (!slot) {
    return [];
  }

  if (slot.status === 'broken' || slot.status === 'routing') {
    return ['withdraw', 'hold'];
  }

  if (slot.archetype === 'archer') {
    return ['hold', 'volley', 'focus_fire', 'withdraw'];
  }

  if (slot.rank !== 'front') {
    return ['hold', 'withdraw', 're_form'];
  }

  if (slot.archetype === 'cavalry') {
    return ['hold', 'advance', 'brace', 'charge', 'withdraw'];
  }

  return ['hold', 'advance', 'brace', 'withdraw'];
};

export const getValidEnemyTargetSlotIds = (
  slot: Pick<SlotRuntimeState, 'archetype' | 'rank' | 'slotId'>,
  action?: SlotActionId | null,
): BattleSlotId[] => {
  const resolvedAction = action ?? getAggressivePointerAction(slot);
  if (!resolvedAction || !doesActionUseEnemyTarget(resolvedAction)) {
    return [];
  }

  if (slot.archetype === 'archer') {
    return [...BATTLE_SLOT_ORDER];
  }

  if (slot.rank !== 'front') {
    return [];
  }

  return getMeleeContactSlotIds(slot.slotId);
};

export const canTargetEnemySlot = (
  slot: Pick<SlotRuntimeState, 'archetype' | 'rank' | 'slotId'>,
  targetSlotId: BattleSlotId,
  action?: SlotActionId | null,
): boolean => getValidEnemyTargetSlotIds(slot, action).includes(targetSlotId);
