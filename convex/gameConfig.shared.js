export const DEFAULT_MAX_BUILDING_LEVEL = 10;
export const RESOURCE_BUILDING_MAX_LEVEL = 30;
export const WAREHOUSE_MAX_LEVEL = 25;
export const TOWNHALL_MAX_LEVEL = 20;
export const RESIDENTIAL_QUARTER_MAX_LEVEL = 20;
export const UNIVERSITY_MAX_LEVEL = 3;
export const BARRACKS_MAX_LEVEL = 25;
export const STABLE_MAX_LEVEL = 20;
export const WORKSHOP_MAX_LEVEL = 20;
export const FORTIFICATION_MAX_LEVEL = 10;
export const GATE_MAX_LEVEL = 1;
export const MAX_BUILDING_LEVEL = RESOURCE_BUILDING_MAX_LEVEL;
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
  'warehouse',
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
    baseRecruitDurationSec: 42,
    speedTilesPerHour: 28,
    populationCost: 1,
  },
  knight: {
    id: 'knight',
    name: 'Rytir',
    role: 'Dobytel osad',
    cost: { wood: 10000, stone: 10000, iron: 10000 },
    requiredBuilding: 'townhall',
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
    baseRecruitDurationSec: 32,
    speedTilesPerHour: 14,
    populationCost: 1,
  },
};

export const UNIT_ORDER = ['militia', 'archer', 'cavalry', 'knight', 'ram', 'caravan'];

const roundNumber = (value) => Math.max(0, Math.round(value));
const RESOURCE_PRODUCTION_CURVE_FACTOR = 0.045;
const WAREHOUSE_BASE_CAP = 1200;
const WAREHOUSE_MAX_CAP = 300000;
const WAREHOUSE_CAP_CURVE_EXPONENT = 1.6;

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

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

export const calculateResourceNodeProductionPerHour = (buildingId, level) => {
  const base = BUILDING_DEFS[buildingId]?.productionPerHourAtLevel1 ?? 0;
  if (base <= 0) {
    return 0;
  }

  const safeLevel = clampBuildingLevel(buildingId, level);
  return base * calculateResourceCurve(safeLevel);
};

export const calculateUpgradeCost = (buildingId, currentLevel) => {
  const def = BUILDING_DEFS[buildingId];
  if (!def || currentLevel >= getMaxBuildingLevel(buildingId)) {
    return null;
  }

  const factor = Math.pow(def.costGrowth, currentLevel);
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

  const levelFactor = Math.pow(1.14, currentLevel);
  const townHallReduction = Math.min(0.15, Math.max(0, Number(townhallLevel ?? 0)) * 0.15);
  const duration = def.baseDurationSec * levelFactor * (1 - townHallReduction);

  return Math.max(25, Math.round(duration));
};

export const calculateRecruitDurationSec = (unitId, amount, requiredBuildingLevel) => {
  const def = UNIT_DEFS[unitId];
  if (!def) {
    return 0;
  }

  const safeAmount = Math.max(1, Math.floor(amount));
  const buildingLevel = Math.max(0, Math.floor(requiredBuildingLevel));
  const base = Math.max(8, Number(def.baseRecruitDurationSec ?? 30));
  const levelReduction = Math.min(
    0.55,
    Math.max(0, buildingLevel * 0.012 + Math.log2(buildingLevel + 1) * 0.04),
  );
  const duration = base * safeAmount * (1 - levelReduction);

  return Math.max(8, Math.round(duration));
};

export const calculateArmyTravelDurationSec = (unitAmounts, distanceTiles) => {
  const safeDistance = Math.max(0, Number(distanceTiles));
  if (safeDistance <= 0) {
    return 0;
  }

  let hasUnits = false;
  let hasKnight = false;
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(unitAmounts[unitId] ?? 0)));
    if (amount <= 0) {
      continue;
    }
    hasUnits = true;
    if (unitId === 'knight') {
      hasKnight = true;
    }
    break;
  }

  if (!hasUnits) {
    return 0;
  }

  return hasKnight ? 3 : 5;
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
    const populationCost = Math.max(1, Math.floor(Number(UNIT_DEFS[unitId]?.populationCost ?? 1)));
    units += amount * populationCost;
  }

  return workers + units;
};

export const calculateProductionPerHour = (buildingLevels, populationUsed, populationCap) => {
  const penalty = populationUsed > populationCap ? 0.5 : 1;
  const wood = calculateResourceNodeProductionPerHour('woodcutter', buildingLevels.woodcutter ?? 0) * penalty;
  const stone = calculateResourceNodeProductionPerHour('quarry', buildingLevels.quarry ?? 0) * penalty;
  const iron = calculateResourceNodeProductionPerHour('iron-mine', buildingLevels['iron-mine'] ?? 0) * penalty;

  return {
    wood,
    stone,
    iron,
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
