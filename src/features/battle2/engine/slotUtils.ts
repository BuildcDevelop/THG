import { BATTLE_RANK_ORDER, BATTLE_SECTOR_ORDER, BATTLE_SLOT_ORDER } from './constants';
import type { BattleRank, BattleSector, BattleSlotId } from './types';

const SLOT_META = Object.fromEntries(
  BATTLE_SLOT_ORDER.map((slotId) => {
    const [sector, rank] = slotId.split('_') as [BattleSector, BattleRank];
    return [
      slotId,
      {
        slotId,
        sector,
        rank,
      },
    ];
  }),
) as Record<BattleSlotId, { slotId: BattleSlotId; sector: BattleSector; rank: BattleRank }>;

export const getSlotMeta = (slotId: BattleSlotId) => SLOT_META[slotId];

export const buildSlotId = (sector: BattleSector, rank: BattleRank): BattleSlotId =>
  `${sector}_${rank}` as BattleSlotId;

export const getAdjacentSectors = (sector: BattleSector): BattleSector[] => {
  if (sector === 'center') {
    return ['left', 'right'];
  }
  return sector === 'left' ? ['center'] : ['center'];
};

export const getSectorSlots = (sector: BattleSector): BattleSlotId[] =>
  BATTLE_RANK_ORDER.map((rank) => buildSlotId(sector, rank));

export const getRankSlots = (rank: BattleRank): BattleSlotId[] =>
  BATTLE_SECTOR_ORDER.map((sector) => buildSlotId(sector, rank));

export const getOpposedSlotIds = (slotId: BattleSlotId): BattleSlotId[] => {
  const meta = getSlotMeta(slotId);
  const sameRank = buildSlotId(meta.sector, meta.rank);
  const adjacentSameRank = getAdjacentSectors(meta.sector).map((sector) => buildSlotId(sector, meta.rank));
  const sectorFallback = getSectorSlots(meta.sector).filter((candidate) => candidate !== sameRank);
  return [sameRank, ...adjacentSameRank, ...sectorFallback];
};

export const getMeleeContactSlotIds = (slotId: BattleSlotId): BattleSlotId[] => {
  const { sector } = getSlotMeta(slotId);
  return [buildSlotId(sector, 'front'), ...getAdjacentSectors(sector).map((adjacentSector) => buildSlotId(adjacentSector, 'front'))];
};

export const isFrontOrMainSlot = (slotId: BattleSlotId): boolean => {
  const rank = getSlotMeta(slotId).rank;
  return rank === 'front' || rank === 'main';
};
