export const DEFAULT_MAX_BUILDING_LEVEL = 10;
export const LEGACY_RESOURCE_BUILDING_MAX_LEVEL = 30;
export const RESOURCE_BUILDING_MAX_LEVEL = 10;
export const WAREHOUSE_MAX_LEVEL = 25;
export const TOWNHALL_MAX_LEVEL = 20;
export const RESIDENTIAL_QUARTER_MAX_LEVEL = 20;
export const UNIVERSITY_MAX_LEVEL = 3;
export const BARRACKS_MAX_LEVEL = 25;
export const STABLE_MAX_LEVEL = 20;
export const WORKSHOP_MAX_LEVEL = 20;
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
    baseCost: { wood: 80, stone: 50, iron: 20 },
    costGrowth: 1.2,
    baseDurationSec: 110,
    productionPerHourAtLevel1: 45,
  },
  quarry: {
    id: 'quarry',
    name: 'Kamenolom',
    category: 'Produkce',
    maxLevel: RESOURCE_BUILDING_MAX_LEVEL,
    workerPerLevel: 5,
    baseCost: { wood: 70, stone: 80, iron: 20 },
    costGrowth: 1.2,
    baseDurationSec: 120,
    productionPerHourAtLevel1: 34,
  },
  'iron-mine': {
    id: 'iron-mine',
    name: 'Zelezny dul',
    category: 'Produkce',
    maxLevel: RESOURCE_BUILDING_MAX_LEVEL,
    workerPerLevel: 5,
    baseCost: { wood: 70, stone: 60, iron: 30 },
    costGrowth: 1.2,
    baseDurationSec: 130,
    productionPerHourAtLevel1: 28,
  },
  'gold-mine': {
    id: 'gold-mine',
    name: 'Zlaty dul',
    category: 'Produkce',
    maxLevel: GOLD_MINE_MAX_LEVEL,
    workerPerLevel: 4,
    baseCost: { wood: 180, stone: 220, iron: 240 },
    costGrowth: 1.36,
    baseDurationSec: 260,
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
    baseCost: { wood: 90, stone: 90, iron: 40 },
    costGrowth: 1.24,
    baseDurationSec: 140,
  },
  hideout: {
    id: 'hideout',
    name: 'Skrys',
    category: 'Podpora',
    maxLevel: HIDEOUT_MAX_LEVEL,
    workerPerLevel: 1,
    baseCost: { wood: 220, stone: 260, iron: 140 },
    costGrowth: 1.5,
    baseDurationSec: 220,
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
    baseCost: { wood: 260, stone: 260, iron: 320 },
    costGrowth: 1.38,
    baseDurationSec: 300,
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
    baseCost: { wood: 420, stone: 440, iron: 580 },
    costGrowth: 1.65,
    baseDurationSec: 360,
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
    baseCost: { wood: 240, stone: 180, iron: 160 },
    costGrowth: 1.32,
    baseDurationSec: 230,
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
    baseCost: { wood: 120, stone: 90, iron: 80 },
    costGrowth: 1.28,
    baseDurationSec: 150,
  },
  stable: {
    id: 'stable',
    name: 'Staje',
    category: 'Vojenske',
    maxLevel: STABLE_MAX_LEVEL,
    workerPerLevel: 3,
    baseCost: { wood: 130, stone: 100, iron: 100 },
    costGrowth: 1.28,
    baseDurationSec: 170,
  },
  workshop: {
    id: 'workshop',
    name: 'Dilna',
    category: 'Vojenske',
    maxLevel: WORKSHOP_MAX_LEVEL,
    workerPerLevel: 3,
    baseCost: { wood: 130, stone: 120, iron: 90 },
    costGrowth: 1.28,
    baseDurationSec: 170,
  },
  fortification: {
    id: 'fortification',
    name: 'Opevneni',
    category: 'Obrana',
    maxLevel: FORTIFICATION_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 110, stone: 150, iron: 60 },
    costGrowth: 1.28,
    baseDurationSec: 180,
  },
  gate: {
    id: 'gate',
    name: 'Brana',
    category: 'Obrana',
    maxLevel: GATE_MAX_LEVEL,
    workerPerLevel: 1,
    baseCost: { wood: 120, stone: 100, iron: 100 },
    costGrowth: 1.28,
    baseDurationSec: 160,
  },
  townhall: {
    id: 'townhall',
    name: 'Radnice',
    category: 'Administrativa',
    maxLevel: TOWNHALL_MAX_LEVEL,
    workerPerLevel: 4,
    baseCost: { wood: 140, stone: 140, iron: 110 },
    costGrowth: 1.28,
    baseDurationSec: 190,
  },
  university: {
    id: 'university',
    name: 'Univerzita',
    category: 'Administrativa',
    maxLevel: UNIVERSITY_MAX_LEVEL,
    workerPerLevel: 2,
    baseCost: { wood: 160, stone: 140, iron: 150 },
    costGrowth: 1.28,
    baseDurationSec: 210,
  },
  'residential-quarter': {
    id: 'residential-quarter',
    name: 'Obytna ctvrt',
    category: 'Podpora',
    maxLevel: RESIDENTIAL_QUARTER_MAX_LEVEL,
    workerPerLevel: 0,
    baseCost: { wood: 110, stone: 120, iron: 60 },
    costGrowth: 1.26,
    baseDurationSec: 150,
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
const WAREHOUSE_BASE_CAP = 1200;
const WAREHOUSE_MAX_CAP = 250000;
const WAREHOUSE_CAP_CURVE_EXPONENT = 1.6;
const BUILDING_TIME_MULTIPLIER = 1.3;
const RECRUIT_TIME_MULTIPLIER = 1.3;
const ARMY_TRAVEL_TIME_MULTIPLIER = 1.25;
const MIN_ARMY_TRAVEL_DURATION_SEC = 45;
const RESOURCE_BASE_PRODUCTION_BOOST = 1.1;
const RESOURCE_BUILDING_IDS = Object.freeze(['woodcutter', 'quarry', 'iron-mine']);

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
  const townhallSpeedMultiplier = Math.pow(0.95, Math.max(0, Math.floor(Number(townhallLevel ?? 0))));
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
  const buildingSpeedMultiplier = Math.pow(0.96, buildingLevel);
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
  const maxLevel = getMaxBuildingLevel('warehouse');
  if (maxLevel <= 0) {
    return WAREHOUSE_BASE_CAP;
  }

  const level = clampBuildingLevel('warehouse', warehouseLevel);
  if (level === 0) {
    return WAREHOUSE_BASE_CAP;
  }

  const ratio = level / maxLevel;
  return Math.round(
    WAREHOUSE_BASE_CAP + (WAREHOUSE_MAX_CAP - WAREHOUSE_BASE_CAP) * Math.pow(ratio, WAREHOUSE_CAP_CURVE_EXPONENT),
  );
};

export const calculatePopulationCap = (residentialLevel) => {
  const level = Math.max(0, Math.floor(Number(residentialLevel ?? 0)));
  return 220 + level * 80 + level * level * 5;
};

export const calculateGoldMineProductionPerDay = (levelRaw) => {
  const level = clampBuildingLevel('gold-mine', Math.max(0, Math.floor(Number(levelRaw ?? 0))));
  return Math.max(0, 10 * level * level);
};

export const calculateGoldMineProductionPerHour = (levelRaw) =>
  normalizeHourlyProductionValue(calculateGoldMineProductionPerDay(levelRaw) / 24);

const MINT_GOLD_STORAGE_BY_LEVEL = [0, 2000, 5000, 10000];
const MINT_COIN_STORAGE_BY_LEVEL = [0, 10000, 25000, 50000];
const MINT_THROUGHPUT_PER_DAY_BY_LEVEL = [0, 125, 250, 500];

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

export const calculateMintThroughputPerHour = (mintLevelRaw) => calculateMintThroughputPerDay(mintLevelRaw) / 24;

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
