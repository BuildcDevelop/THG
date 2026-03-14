export const DEFAULT_MAX_BUILDING_LEVEL = 10;
export const LEGACY_RESOURCE_BUILDING_MAX_LEVEL = 30;
export const RESOURCE_BUILDING_MAX_LEVEL = 10;
export const WAREHOUSE_MAX_LEVEL = 10;
export const TOWNHALL_MAX_LEVEL = 10;
export const RESIDENTIAL_QUARTER_MAX_LEVEL = 10;
export const UNIVERSITY_MAX_LEVEL = 3;
export const BARRACKS_MAX_LEVEL = 10;
export const STABLE_MAX_LEVEL = 10;
export const WORKSHOP_MAX_LEVEL = 5;
export const FORTIFICATION_MAX_LEVEL = 10;
export const GATE_MAX_LEVEL = 1;
export const GOLD_MINE_MAX_LEVEL = 10;
export const MINT_MAX_LEVEL = 3;
export const VAULT_MAX_LEVEL = 2;
export const HIDEOUT_MAX_LEVEL = 3;
export const MARKET_MAX_LEVEL = 4;
export const MAX_BUILDING_LEVEL = WAREHOUSE_MAX_LEVEL;
export const MAX_PLAYER_VILLAGES = 6;

export const BUILDING_DEFS = {
  woodcutter: {
    id: 'woodcutter',
    name: 'Drevorubec',
    category: 'Produkce',
    maxLevel: RESOURCE_BUILDING_MAX_LEVEL,
    workerPerLevel: 5,
    baseCost: { wood: 88, stone: 55, iron: 22 },
    costGrowth: 1.2,
    baseDurationSec: 165,
    productionPerHourAtLevel1: 45,
  },
  quarry: {
    id: 'quarry',
    name: 'Kamenolom',
    category: 'Produkce',
    maxLevel: RESOURCE_BUILDING_MAX_LEVEL,
    workerPerLevel: 5,
    baseCost: { wood: 77, stone: 88, iron: 22 },
    costGrowth: 1.2,
    baseDurationSec: 180,
    productionPerHourAtLevel1: 34,
  },
  'iron-mine': {
    id: 'iron-mine',
    name: 'Zelezny dul',
    category: 'Produkce',
    maxLevel: RESOURCE_BUILDING_MAX_LEVEL,
    workerPerLevel: 5,
    baseCost: { wood: 77, stone: 66, iron: 33 },
    costGrowth: 1.2,
    baseDurationSec: 195,
    productionPerHourAtLevel1: 28,
  },
  'gold-mine': {
    id: 'gold-mine',
    name: 'Zlaty dul',
    category: 'Produkce',
    maxLevel: GOLD_MINE_MAX_LEVEL,
    workerPerLevel: 4,
    baseCost: { wood: 198, stone: 242, iron: 264 },
    costGrowth: 1.36,
    baseDurationSec: 390,
    requiredBuildings: {
      townhall: 5,
    },
  },
  warehouse: {
    id: 'warehouse',
    name: 'Sklad surovin',
    category: 'Podpora',
    maxLevel: WAREHOUSE_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 99, stone: 99, iron: 44 },
    costGrowth: 1.24,
    baseDurationSec: 210,
  },
  hideout: {
    id: 'hideout',
    name: 'Skrys',
    category: 'Podpora',
    maxLevel: HIDEOUT_MAX_LEVEL,
    workerPerLevel: 1,
    baseCost: { wood: 242, stone: 286, iron: 154 },
    costGrowth: 1.5,
    baseDurationSec: 330,
    requiredBuildings: {
      warehouse: 5,
    },
  },
  mint: {
    id: 'mint',
    name: 'Mincovna',
    category: 'Administrativa',
    maxLevel: MINT_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 286, stone: 286, iron: 352 },
    costGrowth: 1.38,
    baseDurationSec: 450,
    requiredBuildings: {
      townhall: 5,
      'gold-mine': 1,
    },
  },
  vault: {
    id: 'vault',
    name: 'Trezor',
    category: 'Podpora',
    maxLevel: VAULT_MAX_LEVEL,
    workerPerLevel: 1,
    baseCost: { wood: 462, stone: 484, iron: 638 },
    costGrowth: 1.65,
    baseDurationSec: 540,
    requiredBuildings: {
      mint: 1,
    },
  },
  market: {
    id: 'market',
    name: 'Mestsky trh',
    category: 'Ekonomika',
    maxLevel: MARKET_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 264, stone: 198, iron: 176 },
    costGrowth: 1.32,
    baseDurationSec: 345,
    requiredBuildings: {
      townhall: 3,
    },
  },
  barracks: {
    id: 'barracks',
    name: 'Kasarna',
    category: 'Vojenske',
    maxLevel: BARRACKS_MAX_LEVEL,
    workerPerLevel: 3,
    baseCost: { wood: 132, stone: 99, iron: 88 },
    costGrowth: 1.28,
    baseDurationSec: 225,
  },
  stable: {
    id: 'stable',
    name: 'Staje',
    category: 'Vojenske',
    maxLevel: STABLE_MAX_LEVEL,
    workerPerLevel: 3,
    baseCost: { wood: 143, stone: 110, iron: 110 },
    costGrowth: 1.28,
    baseDurationSec: 255,
  },
  workshop: {
    id: 'workshop',
    name: 'Dilna',
    category: 'Vojenske',
    maxLevel: WORKSHOP_MAX_LEVEL,
    workerPerLevel: 3,
    baseCost: { wood: 143, stone: 132, iron: 99 },
    costGrowth: 1.28,
    baseDurationSec: 255,
  },
  fortification: {
    id: 'fortification',
    name: 'Opevneni',
    category: 'Obrana',
    maxLevel: FORTIFICATION_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 121, stone: 165, iron: 66 },
    costGrowth: 1.28,
    baseDurationSec: 270,
  },
  gate: {
    id: 'gate',
    name: 'Brana',
    category: 'Obrana',
    maxLevel: GATE_MAX_LEVEL,
    workerPerLevel: 1,
    baseCost: { wood: 132, stone: 110, iron: 110 },
    costGrowth: 1.28,
    baseDurationSec: 240,
  },
  townhall: {
    id: 'townhall',
    name: 'Radnice',
    category: 'Administrativa',
    maxLevel: TOWNHALL_MAX_LEVEL,
    workerPerLevel: 4,
    baseCost: { wood: 154, stone: 154, iron: 121 },
    costGrowth: 1.28,
    baseDurationSec: 285,
  },
  university: {
    id: 'university',
    name: 'Univerzita',
    category: 'Administrativa',
    maxLevel: UNIVERSITY_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 176, stone: 154, iron: 165 },
    costGrowth: 1.28,
    baseDurationSec: 315,
  },
  'residential-quarter': {
    id: 'residential-quarter',
    name: 'Obytna ctvrt',
    category: 'Podpora',
    maxLevel: RESIDENTIAL_QUARTER_MAX_LEVEL,
    workerPerLevel: 0,
    baseCost: { wood: 121, stone: 132, iron: 66 },
    costGrowth: 1.26,
    baseDurationSec: 225,
  },
};

export const BUILDING_ORDER = [
  'woodcutter',
  'quarry',
  'iron-mine',
  'gold-mine',
  'warehouse',
  'hideout',
  'mint',
  'vault',
  'market',
  'barracks',
  'stable',
  'workshop',
  'fortification',
  'gate',
  'townhall',
  'university',
  'residential-quarter',
];

export const UNIT_DEFS = {
  militia: {
    id: 'militia',
    name: 'Ozbrojenci',
    role: 'Zakladni pechota',
    cost: { wood: 18, stone: 10, iron: 8 },
    requiredBuilding: 'barracks',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 26,
    speedTilesPerHour: 18,
    populationCost: 1,
  },
  archer: {
    id: 'archer',
    name: 'Lucistnici',
    role: 'Obrana hradeb',
    cost: { wood: 16, stone: 8, iron: 14 },
    requiredBuilding: 'workshop',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 34,
    speedTilesPerHour: 16,
    populationCost: 1,
  },
  cavalry: {
    id: 'cavalry',
    name: 'Jezdci',
    role: 'Rychly utok',
    cost: { wood: 22, stone: 14, iron: 20 },
    requiredBuilding: 'stable',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 42,
    speedTilesPerHour: 28,
    populationCost: 1,
  },
  scout: {
    id: 'scout',
    name: 'Zved',
    role: 'Spion osad',
    cost: { wood: 14, stone: 9, iron: 11 },
    requiredBuilding: 'stable',
    requiredBuildingLevel: 3,
    baseRecruitDurationSec: 30,
    speedTilesPerHour: 36,
    populationCost: 1,
  },
  knight: {
    id: 'knight',
    name: 'Rytir',
    role: 'Dobytel osad',
    cost: { wood: 10000, stone: 10000, iron: 10000 },
    requiredBuilding: 'townhall',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 60,
    speedTilesPerHour: 42,
    populationCost: 10,
  },
  ram: {
    id: 'ram',
    name: 'Beranidla',
    role: 'Prolomeni brany',
    cost: { wood: 30, stone: 22, iron: 18 },
    requiredBuilding: 'workshop',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 55,
    speedTilesPerHour: 10,
    populationCost: 1,
  },
  caravan: {
    id: 'caravan',
    name: 'Karavany',
    role: 'Prevoz koristi',
    cost: { wood: 20, stone: 12, iron: 10 },
    requiredBuilding: 'workshop',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 32,
    speedTilesPerHour: 14,
    populationCost: 1,
  },
  mercenary: {
    id: 'mercenary',
    name: 'Zoldak',
    role: 'Docasna elitni obrana',
    cost: { wood: 0, stone: 0, iron: 0 },
    requiredBuilding: 'townhall',
    requiredBuildingLevel: 1,
    baseRecruitDurationSec: 1,
    speedTilesPerHour: 0,
    populationCost: 0,
    isRecruitable: false,
  },
};

export const UNIT_ORDER = ['militia', 'archer', 'cavalry', 'scout', 'knight', 'ram', 'caravan', 'mercenary'];

const roundNumber = (value) => Math.max(0, Math.round(value));
const RESOURCE_PRODUCTION_CURVE_FACTOR = 0.045;
const RESOURCE_BUILDING_IDS = Object.freeze(['woodcutter', 'quarry', 'iron-mine']);
const LEVEL_UPPER_BOUNDS_BY_BUILDING = Object.freeze({
  warehouse: Object.freeze([1, 2, 4, 7, 10, 13, 17, 21, 24, 25]),
  townhall: Object.freeze([1, 2, 3, 4, 5, 7, 8, 10, 11, 20]),
  barracks: Object.freeze([1, 2, 4, 6, 8, 9, 11, 13, 15, 25]),
  stable: Object.freeze([1, 2, 3, 5, 6, 8, 9, 11, 13, 20]),
  workshop: Object.freeze([1, 3, 5, 6, 20]),
  'residential-quarter': Object.freeze([2, 6, 9, 13, 17, 20]),
});
const WAREHOUSE_CAP_BY_LEVEL = Object.freeze([0, 3000, 8000, 18000, 35000, 60000, 95000, 140000, 195000, 245000, 300000]);
const POPULATION_CAP_BY_LEVEL = Object.freeze([0, 500, 900, 1450, 2150, 3050, 4200, 5600, 7200, 8900, 10000]);
const GOLD_MINE_PRODUCTION_PER_HOUR_BY_LEVEL = Object.freeze([0, 1, 2, 4, 7, 11, 15, 21, 27, 34, 42]);
const TOWNHALL_BUILD_TIME_REDUCTION_PCT_BY_LEVEL = Object.freeze([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
const BARRACKS_RECRUITMENT_REDUCTION_PCT_BY_LEVEL = Object.freeze([0, 5, 10, 16, 22, 28, 33, 38, 42, 46, 50]);
const STABLE_RECRUITMENT_REDUCTION_PCT_BY_LEVEL = Object.freeze([0, 4, 8, 13, 18, 23, 28, 33, 37, 41, 45]);
const WORKSHOP_RECRUITMENT_REDUCTION_PCT_BY_LEVEL = Object.freeze([0, 6, 12, 18, 24, 30]);
const UNIVERSITY_RESEARCH_BONUS_PCT_BY_LEVEL = Object.freeze([0, 5, 10, 15]);
const BUILDING_TIME_MULTIPLIER = 1.3;
const RECRUIT_TIME_MULTIPLIER = 1.3;
const ARMY_TRAVEL_TIME_MULTIPLIER = 1.25;
const MIN_ARMY_TRAVEL_DURATION_SEC = 45;
const RESOURCE_BASE_PRODUCTION_BOOST = 1.1;

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const isResourceBuildingId = (buildingId) => RESOURCE_BUILDING_IDS.includes(String(buildingId ?? ''));

export const getMaxBuildingLevel = (buildingId) =>
  BUILDING_DEFS[buildingId]?.maxLevel ?? DEFAULT_MAX_BUILDING_LEVEL;

export const getGlobalMaxBuildingLevel = () => {
  let maxLevel = 0;
  for (const buildingId of BUILDING_ORDER) {
    maxLevel = Math.max(maxLevel, getMaxBuildingLevel(buildingId));
  }
  return maxLevel;
};

const clampBuildingLevel = (buildingId, level) => clampNumber(level, 0, getMaxBuildingLevel(buildingId));
const mapLevelByUpperBounds = (levelRaw, upperBounds = []) => {
  const level = Math.max(0, Math.floor(Number(levelRaw ?? 0)));
  if (level <= 0 || !Array.isArray(upperBounds) || upperBounds.length <= 0) {
    return 0;
  }
  for (let index = 0; index < upperBounds.length; index += 1) {
    if (level <= Number(upperBounds[index] ?? 0)) {
      return index + 1;
    }
  }
  return upperBounds.length;
};
const getReductionPercentByLevel = (table, levelRaw) => {
  const level = Math.max(0, Math.floor(Number(levelRaw ?? 0)));
  if (!Array.isArray(table) || table.length <= 0) {
    return 0;
  }
  const clampedLevel = clampNumber(level, 0, table.length - 1);
  return Math.max(0, Number(table[clampedLevel] ?? 0));
};

const calculateResourceCurve = (level) => {
  if (level <= 0) {
    return 0;
  }

  return level * (1 + RESOURCE_PRODUCTION_CURVE_FACTOR * (level - 1));
};

const calculateLegacyResourceNodeProductionPerHour = (buildingId, levelRaw) => {
  const base = BUILDING_DEFS[buildingId]?.productionPerHourAtLevel1 ?? 0;
  if (base <= 0) {
    return 0;
  }

  const level = clampNumber(Number(levelRaw ?? 0), 0, LEGACY_RESOURCE_BUILDING_MAX_LEVEL);
  if (level <= 0) {
    return 0;
  }

  return roundNumber(base * calculateResourceCurve(level));
};

const calculateCompressedResourceNodeProductionPerHour = (buildingId, levelRaw) => {
  const base = BUILDING_DEFS[buildingId]?.productionPerHourAtLevel1 ?? 0;
  if (base <= 0) {
    return 0;
  }

  const safeLevel = clampBuildingLevel(buildingId, levelRaw);
  if (safeLevel <= 0) {
    return 0;
  }
  if (safeLevel <= 1) {
    return roundNumber(base);
  }

  const maxLevel = getMaxBuildingLevel(buildingId);
  if (maxLevel <= 1) {
    return roundNumber(base);
  }

  const maxProduction = calculateLegacyResourceNodeProductionPerHour(buildingId, LEGACY_RESOURCE_BUILDING_MAX_LEVEL);
  const progress = (safeLevel - 1) / (maxLevel - 1);
  const ratio = maxProduction / base;
  return roundNumber(base * Math.pow(ratio, progress));
};

const calculateCompressedResourceUpgradeStep = (buildingId, currentLevelRaw) => {
  const maxLevel = getMaxBuildingLevel(buildingId);
  const currentLevel = clampNumber(Math.floor(Number(currentLevelRaw ?? 0)), 0, Math.max(0, maxLevel - 1));
  if (maxLevel <= 1) {
    return currentLevel;
  }
  return currentLevel * ((LEGACY_RESOURCE_BUILDING_MAX_LEVEL - 1) / (maxLevel - 1));
};

const normalizeHourlyProductionValue = (valueRaw) => {
  const value = Math.max(0, Number(valueRaw ?? 0));
  if (value <= 0) {
    return 0;
  }
  return Math.ceil(value - 0.000001);
};

export const convertLegacyResourceBuildingLevelToCurrent = (buildingId, legacyLevelRaw) => {
  if (!isResourceBuildingId(buildingId)) {
    return clampBuildingLevel(buildingId, legacyLevelRaw);
  }

  const legacyLevel = clampNumber(
    Math.floor(Number(legacyLevelRaw ?? 0)),
    0,
    LEGACY_RESOURCE_BUILDING_MAX_LEVEL,
  );
  if (legacyLevel <= 0) {
    return 0;
  }

  const legacyProduction = calculateLegacyResourceNodeProductionPerHour(buildingId, legacyLevel);
  const maxLevel = getMaxBuildingLevel(buildingId);
  let bestLevel = 1;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let candidateLevel = 1; candidateLevel <= maxLevel; candidateLevel += 1) {
    const candidateProduction = calculateCompressedResourceNodeProductionPerHour(buildingId, candidateLevel);
    const diff = Math.abs(candidateProduction - legacyProduction);
    if (diff < bestDiff || (diff === bestDiff && candidateLevel < bestLevel)) {
      bestDiff = diff;
      bestLevel = candidateLevel;
    }
  }

  return bestLevel;
};
export const convertLegacyBuildingLevelToCurrent = (buildingId, legacyLevelRaw) => {
  const normalizedBuildingId = String(buildingId ?? '');
  if (isResourceBuildingId(normalizedBuildingId)) {
    return convertLegacyResourceBuildingLevelToCurrent(normalizedBuildingId, legacyLevelRaw);
  }

  const levelUpperBounds = LEVEL_UPPER_BOUNDS_BY_BUILDING[normalizedBuildingId];
  if (Array.isArray(levelUpperBounds) && levelUpperBounds.length > 0) {
    return mapLevelByUpperBounds(legacyLevelRaw, levelUpperBounds);
  }

  return clampBuildingLevel(normalizedBuildingId, legacyLevelRaw);
};
export const calculateTownhallBuildTimeReductionPct = (levelRaw) =>
  getReductionPercentByLevel(TOWNHALL_BUILD_TIME_REDUCTION_PCT_BY_LEVEL, levelRaw);
export const calculateUniversityResearchBonusPct = (levelRaw) =>
  getReductionPercentByLevel(UNIVERSITY_RESEARCH_BONUS_PCT_BY_LEVEL, levelRaw);
export const calculateRecruitmentTimeReductionPct = (buildingId, levelRaw) => {
  const normalizedBuildingId = String(buildingId ?? '');
  if (normalizedBuildingId === 'barracks') {
    return getReductionPercentByLevel(BARRACKS_RECRUITMENT_REDUCTION_PCT_BY_LEVEL, levelRaw);
  }
  if (normalizedBuildingId === 'stable') {
    return getReductionPercentByLevel(STABLE_RECRUITMENT_REDUCTION_PCT_BY_LEVEL, levelRaw);
  }
  if (normalizedBuildingId === 'workshop') {
    return getReductionPercentByLevel(WORKSHOP_RECRUITMENT_REDUCTION_PCT_BY_LEVEL, levelRaw);
  }
  return 0;
};

export const calculateResourceNodeProductionPerHour = (buildingId, level) => {
  if (isResourceBuildingId(buildingId)) {
    return calculateCompressedResourceNodeProductionPerHour(buildingId, level);
  }

  return calculateLegacyResourceNodeProductionPerHour(buildingId, clampBuildingLevel(buildingId, level));
};

export const calculateUpgradeCost = (buildingId, currentLevel) => {
  const def = BUILDING_DEFS[buildingId];
  if (!def || currentLevel >= getMaxBuildingLevel(buildingId)) {
    return null;
  }

  const effectiveCurrentLevel = isResourceBuildingId(buildingId)
    ? calculateCompressedResourceUpgradeStep(buildingId, currentLevel)
    : Math.max(0, Math.floor(Number(currentLevel ?? 0)));
  const factor = Math.pow(def.costGrowth, effectiveCurrentLevel);
  return {
    wood: roundNumber(def.baseCost.wood * factor),
    stone: roundNumber(def.baseCost.stone * factor),
    iron: roundNumber(def.baseCost.iron * factor),
  };
};

export const calculateUpgradeDurationSec = (buildingId, currentLevel, townhallLevel) => {
  const def = BUILDING_DEFS[buildingId];
  if (!def) {
    return 0;
  }

  const effectiveCurrentLevel = isResourceBuildingId(buildingId)
    ? calculateCompressedResourceUpgradeStep(buildingId, currentLevel)
    : Math.max(0, Math.floor(Number(currentLevel ?? 0)));
  const levelFactor = Math.pow(1.14, effectiveCurrentLevel);
  const townhallReductionPct = calculateTownhallBuildTimeReductionPct(townhallLevel);
  const townhallSpeedMultiplier = Math.max(0.25, 1 - townhallReductionPct / 100);
  const duration = def.baseDurationSec * levelFactor * BUILDING_TIME_MULTIPLIER * townhallSpeedMultiplier;

  return Math.max(35, Math.round(duration));
};

export const calculateRecruitDurationSec = (unitId, amount, requiredBuildingLevel) => {
  const def = UNIT_DEFS[unitId];
  if (!def) {
    return 0;
  }

  const safeAmount = Math.max(1, Math.floor(amount));
  const buildingLevel = Math.max(0, Math.floor(requiredBuildingLevel));
  const base = Math.max(8, Number(def.baseRecruitDurationSec ?? 30));
  const reductionPct = calculateRecruitmentTimeReductionPct(def.requiredBuilding, buildingLevel);
  const buildingSpeedMultiplier = Math.max(0.25, 1 - reductionPct / 100);
  const duration = base * safeAmount * buildingSpeedMultiplier * RECRUIT_TIME_MULTIPLIER;

  return Math.max(12, Math.round(duration));
};

export const calculateArmyTravelDurationSec = (unitAmounts, distanceTiles) => {
  const safeDistance = Math.max(0, Number(distanceTiles));
  if (safeDistance <= 0) {
    return 0;
  }

  let hasUnits = false;
  let slowestSpeedTilesPerHour = Number.POSITIVE_INFINITY;
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(unitAmounts[unitId] ?? 0)));
    if (amount <= 0) {
      continue;
    }
    const unitSpeed = Number(UNIT_DEFS[unitId]?.speedTilesPerHour ?? 0);
    if (Number.isFinite(unitSpeed) && unitSpeed > 0) {
      slowestSpeedTilesPerHour = Math.min(slowestSpeedTilesPerHour, unitSpeed);
    }
    hasUnits = true;
  }

  if (!hasUnits || !Number.isFinite(slowestSpeedTilesPerHour) || slowestSpeedTilesPerHour <= 0) {
    return 0;
  }

  const durationSec = (safeDistance / slowestSpeedTilesPerHour) * 3600 * ARMY_TRAVEL_TIME_MULTIPLIER;
  return Math.max(MIN_ARMY_TRAVEL_DURATION_SEC, Math.round(durationSec));
};

export const calculateResourceCap = (warehouseLevel) => {
  const level = clampBuildingLevel('warehouse', warehouseLevel);
  return Number(WAREHOUSE_CAP_BY_LEVEL[level] ?? 0);
};

export const calculatePopulationCap = (residentialLevel) => {
  const level = clampBuildingLevel('residential-quarter', residentialLevel);
  return Number(POPULATION_CAP_BY_LEVEL[level] ?? 0);
};

export const calculateGoldMineProductionPerDay = (levelRaw) => {
  const level = clampBuildingLevel('gold-mine', Math.max(0, Math.floor(Number(levelRaw ?? 0))));
  return Math.max(0, Number(GOLD_MINE_PRODUCTION_PER_HOUR_BY_LEVEL[level] ?? 0) * 24);
};

export const calculateGoldMineProductionPerHour = (levelRaw) =>
  Math.max(
    0,
    Number(GOLD_MINE_PRODUCTION_PER_HOUR_BY_LEVEL[clampBuildingLevel('gold-mine', Math.max(0, Number(levelRaw ?? 0)))] ?? 0),
  );

const MINT_GOLD_STORAGE_BY_LEVEL = [0, 2000, 5000, 10000];
const MINT_COIN_STORAGE_BY_LEVEL = [0, 10000, 25000, 50000];
const MINT_THROUGHPUT_PER_DAY_BY_LEVEL = [0, 144, 264, 504];

export const calculateMintGoldStorageCap = (mintLevelRaw) => {
  const level = clampBuildingLevel('mint', Math.max(0, Math.floor(Number(mintLevelRaw ?? 0))));
  return Number(MINT_GOLD_STORAGE_BY_LEVEL[level] ?? 0);
};

export const calculateMintCoinStorageCap = (mintLevelRaw) => {
  const level = clampBuildingLevel('mint', Math.max(0, Math.floor(Number(mintLevelRaw ?? 0))));
  return Number(MINT_COIN_STORAGE_BY_LEVEL[level] ?? 0);
};

export const calculateMintThroughputPerDay = (mintLevelRaw) => {
  const level = clampBuildingLevel('mint', Math.max(0, Math.floor(Number(mintLevelRaw ?? 0))));
  return Number(MINT_THROUGHPUT_PER_DAY_BY_LEVEL[level] ?? 0);
};

export const calculateMintThroughputPerHour = (mintLevelRaw) =>
  normalizeHourlyProductionValue(calculateMintThroughputPerDay(mintLevelRaw) / 24);

export const calculateHideoutProtectedAmount = (hideoutLevelRaw) => {
  const level = clampBuildingLevel('hideout', Math.max(0, Math.floor(Number(hideoutLevelRaw ?? 0))));
  if (level <= 0) {
    return 0;
  }
  if (level === 1) {
    return 3000;
  }
  if (level === 2) {
    return 10000;
  }
  return 20000;
};

export const calculateVaultProtection = (vaultLevelRaw) => {
  const level = clampBuildingLevel('vault', Math.max(0, Math.floor(Number(vaultLevelRaw ?? 0))));
  if (level <= 0) {
    return { gold: 0, coins: 0 };
  }
  if (level === 1) {
    return { gold: 500, coins: 1000 };
  }
  return { gold: 1000, coins: 2000 };
};

export const calculatePopulationUsed = (buildingLevels, unitCounts) => {
  let workers = 0;
  for (const buildingId of BUILDING_ORDER) {
    const def = BUILDING_DEFS[buildingId];
    const level = buildingLevels[buildingId] ?? 0;
    workers += (def.workerPerLevel ?? 0) * level;
  }

  let units = 0;
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(unitCounts[unitId] ?? 0)));
    const populationCost = Math.max(0, Math.floor(Number(UNIT_DEFS[unitId]?.populationCost ?? 1)));
    units += amount * populationCost;
  }

  return workers + units;
};

export const calculateProductionPerHour = (buildingLevels, populationUsed, populationCap) => {
  const penalty = populationUsed > populationCap ? 0.5 : 1;
  const wood =
    calculateResourceNodeProductionPerHour('woodcutter', buildingLevels.woodcutter ?? 0) *
    RESOURCE_BASE_PRODUCTION_BOOST *
    penalty;
  const stone =
    calculateResourceNodeProductionPerHour('quarry', buildingLevels.quarry ?? 0) *
    RESOURCE_BASE_PRODUCTION_BOOST *
    penalty;
  const iron =
    calculateResourceNodeProductionPerHour('iron-mine', buildingLevels['iron-mine'] ?? 0) *
    RESOURCE_BASE_PRODUCTION_BOOST *
    penalty;
  const gold = calculateGoldMineProductionPerHour(buildingLevels['gold-mine'] ?? 0) * penalty;

  return {
    wood: normalizeHourlyProductionValue(wood),
    stone: normalizeHourlyProductionValue(stone),
    iron: normalizeHourlyProductionValue(iron),
    gold: normalizeHourlyProductionValue(gold),
    penalty,
  };
};

export const canAfford = (resources, cost) =>
  resources.wood >= cost.wood && resources.stone >= cost.stone && resources.iron >= cost.iron;

export const formatCost = (cost) => `${cost.wood} drevo, ${cost.stone} kamen, ${cost.iron} zelezo`;

export const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};
