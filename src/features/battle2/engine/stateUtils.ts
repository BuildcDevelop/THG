import { BATTLE_SLOT_ORDER } from './constants';
import type { BattleSide, BattleSlotId, SlotRuntimeState } from './types';

export const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getOpposingSide = (side: BattleSide): BattleSide => (side === 'player' ? 'enemy' : 'player');

const SLOT_ORDER_INDEX = Object.fromEntries(BATTLE_SLOT_ORDER.map((slotId, index) => [slotId, index])) as Record<
  BattleSlotId,
  number
>;

export const sortSlots = <T extends { slotId: BattleSlotId }>(slots: T[]): T[] =>
  [...slots].sort((left, right) => SLOT_ORDER_INDEX[left.slotId] - SLOT_ORDER_INDEX[right.slotId]);

export const copySlot = (slot: SlotRuntimeState): SlotRuntimeState => ({
  ...slot,
});

export const isSlotAlive = (slot: SlotRuntimeState): boolean =>
  slot.status !== 'destroyed' && slot.status !== 'withdrawn' && slot.currentHp > 0 && slot.currentModels > 0;

export const isSlotCombatReady = (slot: SlotRuntimeState): boolean =>
  isSlotAlive(slot) && slot.status !== 'routing' && slot.currentMorale > 0;

export const isHealthyLineHolder = (slot: SlotRuntimeState): boolean =>
  isSlotCombatReady(slot) && (slot.rank === 'front' || slot.rank === 'main') && slot.currentHp / slot.maxHp >= 0.35;

export const getSideSlots = (slots: SlotRuntimeState[], side: BattleSide): SlotRuntimeState[] =>
  sortSlots(slots.filter((slot) => slot.side === side));
