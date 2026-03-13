import { db } from './db.js';
import { createHash, randomBytes } from 'node:crypto';
import {
  BUILDING_DEFS,
  BUILDING_ORDER,
  getGlobalMaxBuildingLevel,
  getMaxBuildingLevel,
  UNIT_DEFS,
  UNIT_ORDER,
  calculatePopulationCap,
  calculateProductionPerHour,
  calculateResourceNodeProductionPerHour,
  calculateResourceCap,
  calculateMintCoinStorageCap,
  calculateMintGoldStorageCap,
  calculateMintThroughputPerHour,
  calculateHideoutProtectedAmount,
  calculateVaultProtection,
  calculateTownhallBuildTimeReductionPct,
  calculateRecruitmentTimeReductionPct,
  calculateUniversityResearchBonusPct,
  calculateUpgradeCost,
  calculateUpgradeDurationSec,
  calculateRecruitDurationSec,
  calculateArmyTravelDurationSec,
  canAfford,
} from './gameConfig.js';
import {
  calculateAttackModifier,
  calculateDefenseBonus,
  calculateLootModifier,
  isAttackAllowed,
  MIN_ATTACKABLE_PRESTIGE_RATIO,
  MIN_LOOT_MODIFIER,
  resolveCombatBalance,
} from './combatBalance.js';

const runtimeEnv = String(process.env.TLD_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? '')
  .trim()
  .toLowerCase();
const isProductionRuntime = runtimeEnv === 'production';

const WORLD_REGIONS = Object.freeze({
  dominion1: {
    id: 1,
    originX: 200,
    originY: 430,
    size: 50,
  },
  dominionFire: {
    id: 2,
    originX: 300,
    originY: 560,
    size: 50,
  },
});
const WORLD_STATUS_ONLINE = 'online';
const DOMINION_FIRE_WORLD_ID = 'dominion-1-fire';
const DOMINION_FIRE_PLAYER_PROTECTION_DAYS = 5;
const DOMINION_FIRE_NEARBY_ABANDONED_COUNT = 5;
const DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN = 1;
const DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX = 3;
const DEFAULT_NEARBY_SPAWN_MIN_DISTANCE = 1;
const DEFAULT_NEARBY_SPAWN_MAX_DISTANCE = 3;
// NOTE: Every world must map to its own unique `region` ID.
// Account identity is global, but gameplay state (villages/kingdom/invites/events) is region-scoped.
const WORLD_CATALOG = Object.freeze([
  {
    id: 'dominion-1',
    name: 'Dominion I: První úsvit',
    subtitle: 'První veřejný svět',
    status: WORLD_STATUS_ONLINE,
    region: WORLD_REGIONS.dominion1.id,
    regionSize: WORLD_REGIONS.dominion1.size,
    seasonLabel: 'Sezóna 0 - Zakladatelská',
    timelineLabel: 'Spuštěno',
    description:
      'Temná hranice se otevřela. Postav první linii, ovládni region a zanech stopu v kronikách.',
    spawn: {
      playerTemplateType: 'default-player',
      abandonedTemplateType: 'default-abandoned',
      nearbyAbandonedCount: 0,
      playerProtectionDays: 0,
      playerSpawnMinDistanceMin: DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN,
      playerSpawnMinDistanceMax: DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX,
      nearbySpawnMinDistance: DEFAULT_NEARBY_SPAWN_MIN_DISTANCE,
      nearbySpawnMaxDistance: DEFAULT_NEARBY_SPAWN_MAX_DISTANCE,
    },
  },
  {
    id: DOMINION_FIRE_WORLD_ID,
    name: 'Dominion I: Síla ohně',
    subtitle: 'Nový resetovaný svět',
    status: WORLD_STATUS_ONLINE,
    region: WORLD_REGIONS.dominionFire.id,
    regionSize: WORLD_REGIONS.dominionFire.size,
    seasonLabel: 'Sezóna 1 - Síla ohně',
    timelineLabel: 'Spuštěno',
    description:
      'Nový svět bez historických osad. Každý nový velitel započne se stejnými podmínkami.',
    spawn: {
      playerTemplateType: 'fire-world',
      abandonedTemplateType: 'default-abandoned',
      nearbyAbandonedCount: DOMINION_FIRE_NEARBY_ABANDONED_COUNT,
      playerProtectionDays: DOMINION_FIRE_PLAYER_PROTECTION_DAYS,
      playerSpawnMinDistanceMin: DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN,
      playerSpawnMinDistanceMax: DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX,
      nearbySpawnMinDistance: DEFAULT_NEARBY_SPAWN_MIN_DISTANCE,
      nearbySpawnMaxDistance: DEFAULT_NEARBY_SPAWN_MAX_DISTANCE,
    },
  },
]);
const DEFAULT_WORLD_ID = WORLD_CATALOG[0]?.id ?? 'dominion-1';
const WORLD_REGION_BY_ID = new Map(Object.values(WORLD_REGIONS).map((region) => [Number(region.id), region]));
const KNIGHT_UNIT_ID = 'knight';
const SCOUT_UNIT_ID = 'scout';
const MERCENARY_UNIT_ID = 'mercenary';
const ARMY_OVERVIEW_UNITS_ORDER = UNIT_ORDER.filter((unitId) => unitId !== MERCENARY_UNIT_ID);
const PLANNER_ALLOWED_ATTACK_UNIT_IDS = Object.freeze(
  UNIT_ORDER.filter((unitId) => unitId !== MERCENARY_UNIT_ID),
);
const PLANNER_ALLOWED_ATTACK_UNIT_ID_SET = new Set(PLANNER_ALLOWED_ATTACK_UNIT_IDS);
const PLANNER_BANNER_TEXT = 'Planovac je zatim mozne vyuzit jen pro jeden cil z vice len.';
const PLANNER_TIMEZONE = 'Europe/Prague';
const PLANNER_MAX_LEGS = 10;
const PLANNER_MIN_IMPACT_GAP_MINUTES = 1;
const PLANNER_LEAD_TIME_SEC = 5 * 60;
const PLANNER_EDITABLE_PLAN_STATUSES = new Set(['scheduled', 'needs_reconfirmation']);
const PLANNER_CANCELABLE_PLAN_STATUSES = new Set(['scheduled', 'needs_reconfirmation']);
const PLANNER_NEEDS_RECONFIRMATION_STATUS = 'needs_reconfirmation';
const PLANNER_DEFAULT_EVENTS_LIMIT = 50;
const PLANNER_MAX_EVENTS_LIMIT = 200;
const KNIGHT_RECALL_REFUND = { wood: 1000, stone: 1000, iron: 1000 };
const COMMAND_CANCEL_MAX_PROGRESS = 1 / 3;
const NIGHT_MODE_START_HOUR = 0;
const NIGHT_MODE_END_HOUR = 8;
const MERCENARY_CONTRACT_COST_COINS = 1500;
const MERCENARY_CONTRACT_UNIT_AMOUNT = 1000;
const MERCENARY_CONTRACT_COOLDOWN_HOURS = 72;
const MERCENARY_DELIVERY_DELAY_MINUTES = 30;
const MERCENARY_DURATION_HOURS = 72;
const ACADEMIC_COST_COINS = 250;
const ACADEMIC_POPULATION_COST = 1;
const GARRISON_RESERVED_POPULATION = 300;
const GARRISON_UNLOCK_TOWNHALL_LEVEL = 5;
const GARRISON_UNIT_CAPS = Object.freeze({
  militia: 180,
  archer: 120,
});
const GARRISON_UNIT_IDS = Object.freeze(['militia', 'archer']);
const MAX_ACADEMICS_PER_RESEARCH = 3;
const MARKET_MAX_DISTANCE_TILES = 50;
const LOGISTICS_MINUTES_BASE = 10;
const LOGISTICS_MINUTES_PER_TILE = 2;
const MARKET_CAPACITY_BY_LEVEL = [0, 5000, 30000, 150000, 300000];
const MARKET_GUILD_MIN_MARKET_LEVEL = 4;
const MARKET_GUILD_REQUIRED_RESEARCH_ID = 'guild-influence';
const MARKET_GUILD_CYCLE_INTERVAL_SEC = 5 * 60 * 60;
const MARKET_GUILD_ACTIVE_START_HOUR = 8;
const MARKET_GUILD_ACTIVE_END_HOUR = 20;
const MARKET_GUILD_MIN_TARGET_COUNT = 1;
const MARKET_GUILD_MAX_TARGETS_PER_CYCLE = 32;
const MARKET_GUILD_MAX_DISPATCHES_PER_TICK = 120;
const MARKET_GUILD_PER_SOURCE_MAX_DISPATCHES_PER_TICK = 1;
const MARKET_GUILD_RATE_LIMIT_BACKOFF_SEC = 5 * 60;
const MARKET_GUILD_AUDIT_LOG_LIMIT = 25;
const MARKET_GUILD_AUDIT_RETENTION_DAYS = 14;
const MARKET_GUILD_AUDIT_MAX_ROWS_PER_SOURCE = 300;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PLAYER_NOTIFICATION_RETENTION_DAYS = 30;
const PLAYER_NOTIFICATION_MAX_PAGE_SIZE = 100;
const RELEASE_0107_NOTIFICATION = Object.freeze({
  versionLabel: '0.1.07',
  sourceType: 'developer_release',
  sourceIdBase: 107000,
  publishedAt: '2026-02-26T00:00:00.000Z',
  title: 'The Last Dominion 0.1.07',
  summary:
    'Herni zaznamy a prikazy jsou aktivni. Zvedy lze vysilat i ve smisenych utocich a reporty zobrazuji slozeni utocici armady i jeji silu.',
});
// Add future global boosts as world-specific entries, never as cross-world shared state.
const DOMINION_FIRE_RESOURCE_BOOST = Object.freeze({
  worldId: DOMINION_FIRE_WORLD_ID,
  bonusPercent: 50,
  durationDays: 7,
  // Starts immediately with this patch release and auto-expires after `durationDays`.
  startsAtIso: '2026-02-23T00:00:00.000Z',
  reason:
    'Boost ze strany vývojáře jako omluva za podmínky během migrace hry na novou databázi.',
});

const ABANDONED_BOT_USERNAME_PREFIX = '__abandoned_ai__';
const PLAYER_VILLAGE_NAME_PREFIX = 'Leno';
const ABANDONED_VILLAGE_NAME_PREFIX = 'Opustene leno';
const normalizePriorityUsernameComparable = (value) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('cs-CZ');
// Keep in sync with seed passwords in server/db.js so logins are stable across snapshot migrations.
const PRIORITY_ACCOUNT_PASSWORDS = new Map(
  [
    ['Hayato', 'Hayato@Dominion26'],
    ['-SaThAn?!', 'SaThAn?!_Abyss26'],
    ['*333*', 'Star333!Forge26'],
    ['Pegak', 'Pegak!Bastion26'],
    ['Torreya', 'Torreya!Raven26'],
    ['TSN', 'TSN!Legion26'],
    ['Sentryn', 'Sentryn!Citadel26'],
    ['Chakitis', '5555s6s6s5'],
    ['Insanity', '98854657da5'],
    ['Nicol', '22244444433a'],
    ['Wild', '7777dd95'],
  ].map(([username, password]) => [normalizePriorityUsernameComparable(username), String(password)]),
);
const STARTING_RESOURCES = {
  wood: 1000,
  stone: 1000,
  iron: 1000,
  gold: 0,
  coins: 0,
};
const STARTING_PLAYER_BUILDING_LEVELS = {
  townhall: 1,
  warehouse: 1,
  'residential-quarter': 1,
  university: 0,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  'gold-mine': 0,
  hideout: 0,
  mint: 0,
  vault: 0,
  market: 0,
  barracks: 0,
  stable: 0,
  workshop: 0,
  fortification: 0,
  gate: 0,
};
const STARTING_ABANDONED_BUILDING_LEVELS = {
  townhall: 3,
  warehouse: 3,
  'residential-quarter': 3,
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  'gold-mine': 0,
  market: 3,
  hideout: 1,
  barracks: 1,
};
const FIRE_WORLD_STARTING_BUILDING_LEVELS = {
  townhall: 1,
  warehouse: 1,
  'residential-quarter': 1,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  'gold-mine': 0,
  hideout: 0,
  mint: 0,
  vault: 0,
  market: 0,
  barracks: 0,
};
const STARTING_PLAYER_UNITS = {
  militia: 5,
};
const STARTING_ABANDONED_UNITS = {
  militia: 100,
};
const FIRE_WORLD_STARTING_UNITS = {
  militia: 5,
};
const ACTIVE_BOT_USERNAME = 'Bot';
const ACTIVE_BOT_MAX_VILLAGES_PER_CYCLE = 3;
const BOT_NIGHT_BUILD_PRIORITY = Object.freeze([
  'woodcutter',
  'quarry',
  'iron-mine',
  'warehouse',
  'residential-quarter',
  'townhall',
  'barracks',
  'hideout',
]);
const BOT_NIGHT_MILITIA_RECRUIT_BATCH = 20;
const BOT_NIGHT_RESOURCE_RESERVE = Object.freeze({
  wood: 300,
  stone: 300,
  iron: 300,
});
let lastBotNightCycleHourKey = null;
const RESEARCH_DEFS = Object.freeze([
  {
    id: 'linen-ropes',
    name: 'Lněné motouzy',
    description: 'Způsob výroby tětiv a kompozitních ramen luku.',
    coinCost: 1000,
    unlocks: 'Odemkne Lučištníky (Kasárna L3).',
    requiredResearchIds: [],
  },
  {
    id: 'stirrups-spurs',
    name: 'Třmeny a ostruhy',
    description: 'Moderní jezdecké vybavení pro lehkou jízdu.',
    coinCost: 1500,
    unlocks: 'Odemkne lehkou jízdu.',
    requiredResearchIds: [],
  },
  {
    id: 'tactics',
    name: 'Taktika',
    description: 'Koordinované průlomy opevněných bran.',
    coinCost: 2000,
    unlocks: 'Odemkne beranidla.',
    requiredResearchIds: [],
  },
  {
    id: 'city-defense',
    name: 'Městská obrana',
    description: 'Výcvik posádky hradeb a obranných rot.',
    coinCost: 3000,
    unlocks: 'Odemkne hradby a bránu.',
    requiredResearchIds: [],
  },
  {
    id: 'guild-influence',
    name: 'Vliv cechů',
    description: 'Jednání s cechy a standardizace obchodních smluv.',
    coinCost: 4000,
    unlocks: 'Odemkne cech obchodníků.',
    requiredResearchIds: [],
  },
  {
    id: 'verven-bank',
    name: 'Vervenská zlatá banka',
    description: 'Dluhové úpisy, které umožňují nájem žoldáků.',
    coinCost: 5000,
    unlocks: 'Odemkne žoldáky.',
    requiredResearchIds: [],
  },
]);
const RESEARCH_DEF_BY_ID = new Map(RESEARCH_DEFS.map((definition) => [definition.id, definition]));
const UNIT_RESEARCH_REQUIREMENTS = Object.freeze({
  archer: 'linen-ropes',
  cavalry: 'stirrups-spurs',
  ram: 'tactics',
});
const BUILDING_RESEARCH_REQUIREMENTS = Object.freeze({
  fortification: 'city-defense',
  gate: 'city-defense',
});

class GameRuleError extends Error {
  constructor(message, statusCode = 400, errorCode = null, details = null) {
    super(message);
    this.name = 'GameRuleError';
    this.statusCode = statusCode;
    this.errorCode = errorCode == null ? null : String(errorCode);
    this.details = details && typeof details === 'object' ? details : null;
  }
}

const nowIso = () => new Date().toISOString();
const STATE_READ_MODEL_BUCKET_MS = 15 * 1000;
const WORLD_MAP_READ_MODEL_BUCKET_MS = 30 * 1000;
const WORLD_MAP_CACHE_LIMIT = 48;
const worldMapReadModelCache = new Map();

const selectPlayerByUsernameStmt = db.prepare(
  `SELECT
      id,
      username,
      password,
      created_at AS createdAt
   FROM players
   WHERE username = ? COLLATE NOCASE
     AND is_bot = 0
   LIMIT 1`,
);
const selectNonBotPlayerByUsernameStmt = db.prepare(
  `SELECT
      id,
      username
   FROM players
   WHERE username = ? COLLATE NOCASE
     AND is_bot = 0
   LIMIT 1`,
);
const selectPlayerByIdStmt = db.prepare(
  'SELECT id, username, is_bot AS isBot FROM players WHERE id = ? LIMIT 1',
);
const selectVillageByPlayerStmt = db.prepare(
  `SELECT
      id,
      name,
      coord_x AS coordX,
      coord_y AS coordY,
      region,
      kingdom,
      prestige,
      loyalty,
      created_at AS createdAt,
      peace_until AS peaceUntil
   FROM villages
   WHERE player_id = ?
   ORDER BY id ASC
   LIMIT 1`,
);
const selectVillageByPlayerAndRegionStmt = db.prepare(
  `SELECT
      id,
      name,
      coord_x AS coordX,
      coord_y AS coordY,
      region,
      kingdom,
      prestige,
      loyalty,
      created_at AS createdAt,
      peace_until AS peaceUntil
   FROM villages
   WHERE player_id = ? AND region = ?
   ORDER BY id ASC
   LIMIT 1`,
);
const selectVillagesByPlayerStmt = db.prepare(
  `SELECT
      id,
      name,
      coord_x AS coordX,
      coord_y AS coordY,
      region,
      kingdom,
      prestige,
      loyalty,
      created_at AS createdAt,
      peace_until AS peaceUntil
   FROM villages
   WHERE player_id = ?
   ORDER BY id ASC`,
);
const selectVillagesByPlayerAndRegionStmt = db.prepare(
  `SELECT
      id,
      name,
      coord_x AS coordX,
      coord_y AS coordY,
      region,
      kingdom,
      prestige,
      loyalty,
      created_at AS createdAt,
      peace_until AS peaceUntil
   FROM villages
   WHERE player_id = ? AND region = ?
   ORDER BY id ASC`,
);
const selectNamedBotVillagesByRegionStmt = db.prepare(
  `SELECT
      v.id,
      v.player_id AS playerId,
      v.name,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.region,
      v.kingdom
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 1
     AND p.username = ? COLLATE NOCASE
     AND v.region = ?
   ORDER BY v.id ASC`,
);
const selectVillageCoordsStmt = db.prepare(
  `SELECT
      coord_x AS coordX,
      coord_y AS coordY
   FROM villages`,
);
const selectVillageCoordsByRegionStmt = db.prepare(
  `SELECT
      coord_x AS coordX,
      coord_y AS coordY
   FROM villages
   WHERE region = ?`,
);
const selectAbandonedBotUsernamesStmt = db.prepare(
  `SELECT username
   FROM players
   WHERE username GLOB ?`,
);
const insertAbandonedBotPlayerStmt = db.prepare(
  'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, 1, ?)',
);
const insertPlayerAccountStmt = db.prepare(
  'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, 0, ?)',
);
const insertVillageForPlayerStmt = db.prepare(
  `INSERT INTO villages (
      player_id,
      name,
      kingdom,
      coord_x,
      coord_y,
      region,
      peace_until,
      prestige,
      loyalty,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const upsertVillageResourcesStmt = db.prepare(
  `INSERT INTO resources (village_id, wood, stone, iron, gold, coins, last_sync_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(village_id) DO UPDATE SET
     wood = excluded.wood,
     stone = excluded.stone,
     iron = excluded.iron,
     gold = excluded.gold,
     coins = excluded.coins,
     last_sync_at = excluded.last_sync_at`,
);
const upsertVillageBuildingLevelStmt = db.prepare(
  `INSERT INTO buildings (village_id, building_id, level)
   VALUES (?, ?, ?)
   ON CONFLICT(village_id, building_id) DO UPDATE SET
     level = excluded.level`,
);
const upsertVillageUnitAmountStmt = db.prepare(
  `INSERT INTO units (village_id, unit_id, amount)
   VALUES (?, ?, ?)
   ON CONFLICT(village_id, unit_id) DO UPDATE SET
     amount = excluded.amount`,
);
const deleteInProgressUpgradesByVillageStmt = db.prepare(
  "DELETE FROM building_upgrades WHERE village_id = ? AND status = 'in_progress'",
);
const deleteInProgressRecruitmentsByVillageStmt = db.prepare(
  "DELETE FROM unit_recruitments WHERE village_id = ? AND status = 'in_progress'",
);
const deleteArmyMovementUnitsByPlayerAndRegionStmt = db.prepare(
  `DELETE FROM army_movement_units
   WHERE movement_id IN (
     SELECT m.id
     FROM army_movements m
     INNER JOIN villages hv ON hv.id = m.home_village_id
     WHERE m.player_id = ?
       AND hv.region = ?
    )`,
);
const deleteArmyMovementsByPlayerAndRegionStmt = db.prepare(
  `DELETE FROM army_movements
   WHERE player_id = ?
     AND home_village_id IN (
       SELECT id
       FROM villages
       WHERE region = ?
     )`,
);
const updateVillageToAbandonedOwnerStmt = db.prepare(
  "UPDATE villages SET player_id = ?, name = ?, kingdom = 'Neutral', peace_until = NULL WHERE id = ?",
);
const selectResourcesByVillageStmt = db.prepare(
  'SELECT wood, stone, iron, gold, coins, last_sync_at AS lastSyncAt FROM resources WHERE village_id = ? LIMIT 1',
);
const selectBuildingsByVillageStmt = db.prepare(
  `SELECT building_id AS buildingId, level
   FROM buildings
   WHERE village_id = ?`,
);
const selectUnitsByVillageStmt = db.prepare(
  `SELECT unit_id AS unitId, amount
   FROM units
   WHERE village_id = ?`,
);
const selectVillageGarrisonByVillageStmt = db.prepare(
  `SELECT
      village_id AS villageId,
      militia_amount AS militiaAmount,
      archer_amount AS archerAmount,
      militia_progress AS militiaProgress,
      archer_progress AS archerProgress,
      last_sync_at AS lastSyncAt
   FROM village_garrisons
   WHERE village_id = ?
   LIMIT 1`,
);
const upsertVillageGarrisonStateStmt = db.prepare(
  `INSERT INTO village_garrisons (
      village_id,
      militia_amount,
      archer_amount,
      militia_progress,
      archer_progress,
      last_sync_at
   ) VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(village_id) DO UPDATE SET
     militia_amount = excluded.militia_amount,
     archer_amount = excluded.archer_amount,
     militia_progress = excluded.militia_progress,
     archer_progress = excluded.archer_progress,
     last_sync_at = excluded.last_sync_at`,
);
const updateVillageGarrisonAmountsStmt = db.prepare(
  `UPDATE village_garrisons
   SET militia_amount = ?, archer_amount = ?, last_sync_at = ?
   WHERE village_id = ?`,
);
const selectAwayUnitTotalsByHomeVillageStmt = db.prepare(
  `SELECT
      mu.unit_id AS unitId,
      COALESCE(SUM(mu.amount), 0) AS amount
   FROM army_movements m
   INNER JOIN army_movement_units mu ON mu.movement_id = m.id
   WHERE m.home_village_id = ?
     AND m.status IN ('in_progress', 'stationed')
   GROUP BY mu.unit_id`,
);
const selectActiveUpgradesByVillageStmt = db.prepare(
  `SELECT
      id,
      building_id AS buildingId,
      from_level AS fromLevel,
      to_level AS toLevel,
      wood_cost AS woodCost,
      stone_cost AS stoneCost,
      iron_cost AS ironCost,
      started_at AS startedAt,
      finish_at AS finishAt
   FROM building_upgrades
   WHERE village_id = ? AND status = 'in_progress'
   ORDER BY finish_at ASC, id ASC`,
);
const selectActiveUpgradesByVillageAndBuildingStmt = db.prepare(
  `SELECT
      id,
      building_id AS buildingId,
      from_level AS fromLevel,
      to_level AS toLevel,
      wood_cost AS woodCost,
      stone_cost AS stoneCost,
      iron_cost AS ironCost,
      started_at AS startedAt,
      finish_at AS finishAt
   FROM building_upgrades
   WHERE village_id = ? AND building_id = ? AND status = 'in_progress'
   ORDER BY finish_at ASC, id ASC`,
);
const selectActiveUpgradeByIdForVillageStmt = db.prepare(
  `SELECT
      id,
      building_id AS buildingId,
      from_level AS fromLevel,
      to_level AS toLevel,
      wood_cost AS woodCost,
      stone_cost AS stoneCost,
      iron_cost AS ironCost,
      started_at AS startedAt,
      finish_at AS finishAt
   FROM building_upgrades
   WHERE id = ? AND village_id = ? AND status = 'in_progress'
   LIMIT 1`,
);
const selectActiveRecruitmentsByVillageStmt = db.prepare(
  `SELECT
      id,
      unit_id AS unitId,
      amount,
      wood_cost AS woodCost,
      stone_cost AS stoneCost,
      iron_cost AS ironCost,
      started_at AS startedAt,
      finish_at AS finishAt
   FROM unit_recruitments
   WHERE village_id = ? AND status = 'in_progress'
   ORDER BY finish_at ASC, id ASC`,
);
const selectActiveRecruitmentByIdForVillageStmt = db.prepare(
  `SELECT
      id,
      unit_id AS unitId,
      amount,
      wood_cost AS woodCost,
      stone_cost AS stoneCost,
      iron_cost AS ironCost,
      started_at AS startedAt,
      finish_at AS finishAt
   FROM unit_recruitments
   WHERE id = ? AND village_id = ? AND status = 'in_progress'
   LIMIT 1`,
);
const selectAllVillagesForWorldStmt = db.prepare(
  `SELECT
      v.id,
      v.player_id AS playerId,
      v.name,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.region,
      v.kingdom,
      v.prestige,
      v.loyalty,
      v.peace_until AS peaceUntil,
      CASE
        WHEN p.is_bot = 1 AND p.username GLOB '__abandoned_ai__*' THEN 'Opuštěná osada'
        ELSE p.username
      END AS owner,
      p.username AS ownerUsername,
      p.is_bot AS isBot
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.region = ?
   ORDER BY v.id ASC`,
);
const selectAdminPlayersStmt = db.prepare(
  `SELECT
      p.username,
      p.created_at AS createdAt,
      v.name AS villageName,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.kingdom,
      COALESCE(stats.villageCount, 0) AS villageCount,
      COALESCE(stats.totalPrestige, 0) AS totalPrestige
   FROM players p
   LEFT JOIN villages v ON v.id = (
     SELECT vv.id
     FROM villages vv
     WHERE vv.player_id = p.id
     ORDER BY vv.id ASC
     LIMIT 1
   )
   LEFT JOIN (
     SELECT
       player_id,
       COUNT(*) AS villageCount,
       SUM(prestige) AS totalPrestige
     FROM villages
     GROUP BY player_id
   ) stats ON stats.player_id = p.id
   WHERE p.is_bot = 0
     AND p.username NOT GLOB '__abandoned_ai__*'
   ORDER BY p.username COLLATE NOCASE ASC`,
);
const selectLeaderboardStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      COALESCE(stats.villageCount, 0) AS villageCount,
      COALESCE(stats.totalPrestige, 0) AS prestige,
      COALESCE(stats.primaryKingdom, 'Neutral') AS kingdom
   FROM players p
   LEFT JOIN (
     SELECT
       player_id,
       COUNT(*) AS villageCount,
       SUM(prestige) AS totalPrestige,
       MIN(kingdom) AS primaryKingdom
     FROM villages
     GROUP BY player_id
     ) stats ON stats.player_id = p.id
   WHERE p.is_bot = 0
     AND p.username NOT GLOB '__abandoned_ai__*'
   ORDER BY prestige DESC, villageCount DESC, p.username COLLATE NOCASE ASC`,
);
const selectLeaderboardByRegionStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      COUNT(v.id) AS villageCount,
      COALESCE(SUM(v.prestige), 0) AS prestige,
      COALESCE(MIN(v.kingdom), 'Neutral') AS kingdom
   FROM players p
   INNER JOIN villages v ON v.player_id = p.id
   WHERE p.is_bot = 0
     AND p.username NOT GLOB '__abandoned_ai__*'
     AND v.region = ?
   GROUP BY p.id, p.username
   ORDER BY prestige DESC, villageCount DESC, p.username COLLATE NOCASE ASC`,
);
const selectGameStateStmt = db.prepare('SELECT last_tick_at AS lastTickAt FROM game_state WHERE id = 1');
const updateGameStateTickStmt = db.prepare('UPDATE game_state SET last_tick_at = ? WHERE id = 1');
const selectDatabaseChangeCounterStmt = db.prepare('SELECT total_changes() AS totalChanges');
const updateResourcesStmt = db.prepare(
  'UPDATE resources SET wood = ?, stone = ?, iron = ?, gold = ?, coins = ?, last_sync_at = ? WHERE village_id = ?',
);
const updateVillagePrestigeStmt = db.prepare('UPDATE villages SET prestige = ? WHERE id = ?');
const selectDueUpgradesStmt = db.prepare(
  `SELECT id, village_id AS villageId, building_id AS buildingId, to_level AS toLevel
   FROM building_upgrades
   WHERE status = 'in_progress' AND finish_at <= ?
   ORDER BY finish_at ASC`,
);
const updateBuildingLevelStmt = db.prepare(
  'UPDATE buildings SET level = ? WHERE village_id = ? AND building_id = ?',
);
const completeUpgradeStmt = db.prepare(
  "UPDATE building_upgrades SET status = 'completed', completed_at = ? WHERE id = ?",
);
const updateActiveUpgradeTimingByIdStmt = db.prepare(
  "UPDATE building_upgrades SET started_at = ?, finish_at = ? WHERE id = ? AND village_id = ? AND status = 'in_progress'",
);
const deleteActiveUpgradeByIdStmt = db.prepare(
  "DELETE FROM building_upgrades WHERE id = ? AND village_id = ? AND status = 'in_progress'",
);
const insertUpgradeStmt = db.prepare(
  `INSERT INTO building_upgrades (
      village_id,
      building_id,
      from_level,
      to_level,
      wood_cost,
      stone_cost,
      iron_cost,
      started_at,
      finish_at,
      status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')`,
);
const updateResourcesAfterSpendStmt = db.prepare(
  'UPDATE resources SET wood = ?, stone = ?, iron = ?, gold = ?, coins = ?, last_sync_at = ? WHERE village_id = ?',
);
const updateUnitAmountStmt = db.prepare(
  `INSERT INTO units (amount, village_id, unit_id)
   VALUES (?, ?, ?)
   ON CONFLICT(village_id, unit_id) DO UPDATE SET
     amount = excluded.amount`,
);
const selectUnitAmountByVillageAndUnitStmt = db.prepare(
  'SELECT amount FROM units WHERE village_id = ? AND unit_id = ? LIMIT 1',
);
const insertVillageGarrisonIfMissingStmt = db.prepare(
  `INSERT INTO village_garrisons (village_id, militia_amount, archer_amount, militia_progress, archer_progress, last_sync_at)
   VALUES (?, ?, ?, 0, 0, ?)
   ON CONFLICT(village_id) DO NOTHING`,
);
const selectDueRecruitmentsStmt = db.prepare(
  `SELECT id, village_id AS villageId, unit_id AS unitId, amount
   FROM unit_recruitments
   WHERE status = 'in_progress' AND finish_at <= ?
   ORDER BY finish_at ASC, id ASC`,
);
const completeRecruitmentStmt = db.prepare(
  "UPDATE unit_recruitments SET status = 'completed', completed_at = ? WHERE id = ?",
);
const deleteActiveRecruitmentByIdStmt = db.prepare(
  "DELETE FROM unit_recruitments WHERE id = ? AND village_id = ? AND status = 'in_progress'",
);
const insertRecruitmentStmt = db.prepare(
  `INSERT INTO unit_recruitments (
      village_id,
      unit_id,
      amount,
      wood_cost,
      stone_cost,
      iron_cost,
      started_at,
      finish_at,
      status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')`,
);
const selectVillageByIdStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      name,
      kingdom,
      coord_x AS coordX,
      coord_y AS coordY,
      region,
      created_at AS createdAt,
      peace_until AS peaceUntil
   FROM villages
   WHERE id = ?
   LIMIT 1`,
);
const selectVillageWithOwnerByCoordsAndRegionStmt = db.prepare(
  `SELECT
      v.id,
      v.player_id AS playerId,
      v.name,
      v.kingdom,
      v.prestige,
      v.loyalty,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.region,
      v.created_at AS createdAt,
      v.peace_until AS peaceUntil,
      p.username AS ownerUsername,
      p.is_bot AS ownerIsBot
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.coord_x = ? AND v.coord_y = ? AND v.region = ?
   LIMIT 1`,
);
const selectVillageWithOwnerByIdStmt = db.prepare(
  `SELECT
      v.id,
      v.player_id AS playerId,
      v.name,
      v.kingdom,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.region,
      v.created_at AS createdAt,
      v.peace_until AS peaceUntil,
      p.username AS ownerUsername,
      p.is_bot AS ownerIsBot
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.id = ?
   LIMIT 1`,
);
const insertArmyMovementStmt = db.prepare(
  `INSERT INTO army_movements (
      player_id,
      command_type,
      origin_village_id,
      target_village_id,
      home_village_id,
      loot_priority,
      carry_wood,
      carry_stone,
      carry_iron,
      started_at,
      arrive_at,
      status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertArmyMovementWithPlannerRefsStmt = db.prepare(
  `INSERT INTO army_movements (
      player_id,
      plan_id,
      plan_leg_id,
      command_type,
      origin_village_id,
      target_village_id,
      home_village_id,
      loot_priority,
      carry_wood,
      carry_stone,
      carry_iron,
      started_at,
      arrive_at,
      status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertArmyMovementUnitStmt = db.prepare(
  'INSERT INTO army_movement_units (movement_id, unit_id, amount) VALUES (?, ?, ?)',
);
const updateArmyMovementUnitAmountStmt = db.prepare(
  'UPDATE army_movement_units SET amount = ? WHERE movement_id = ? AND unit_id = ?',
);
const selectMovementUnitsStmt = db.prepare(
  `SELECT
      unit_id AS unitId,
      amount
   FROM army_movement_units
   WHERE movement_id = ?
   ORDER BY unit_id ASC`,
);
const selectDueArmyMovementsStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      command_type AS commandType,
      origin_village_id AS originVillageId,
      target_village_id AS targetVillageId,
      home_village_id AS homeVillageId,
      loot_priority AS lootPriority,
      carry_wood AS carryWood,
      carry_stone AS carryStone,
      carry_iron AS carryIron,
      started_at AS startedAt,
      arrive_at AS arriveAt,
      status
   FROM army_movements
   WHERE status = 'in_progress' AND arrive_at <= ?
   ORDER BY arrive_at ASC, id ASC`,
);
const updateArmyMovementStatusStmt = db.prepare(
  'UPDATE army_movements SET status = ?, completed_at = ? WHERE id = ?',
);
const selectActiveArmyMovementsByPlayerStmt = db.prepare(
  `SELECT
      m.id,
      m.command_type AS commandType,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      m.loot_priority AS lootPriority,
      m.carry_wood AS carryWood,
      m.carry_stone AS carryStone,
      m.carry_iron AS carryIron,
      m.started_at AS startedAt,
      m.arrive_at AS arriveAt,
      ov.name AS originName,
      ov.coord_x AS originCoordX,
      ov.coord_y AS originCoordY,
      tv.name AS targetName,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY,
      hv.name AS homeName,
      hv.coord_x AS homeCoordX,
      hv.coord_y AS homeCoordY
   FROM army_movements m
   INNER JOIN villages ov ON ov.id = m.origin_village_id
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.player_id = ? AND m.status = 'in_progress'
   ORDER BY m.arrive_at ASC, m.id ASC`,
);
const selectIncomingArmyMovementsByVillageOwnerStmt = db.prepare(
  `SELECT
      m.id,
      m.command_type AS commandType,
      m.player_id AS commanderPlayerId,
      commander.username AS commanderUsername,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      m.loot_priority AS lootPriority,
      m.carry_wood AS carryWood,
      m.carry_stone AS carryStone,
      m.carry_iron AS carryIron,
      m.started_at AS startedAt,
      m.arrive_at AS arriveAt,
      ov.name AS originName,
      ov.coord_x AS originCoordX,
      ov.coord_y AS originCoordY,
      tv.name AS targetName,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY,
      hv.name AS homeName,
      hv.coord_x AS homeCoordX,
      hv.coord_y AS homeCoordY
   FROM army_movements m
   INNER JOIN players commander ON commander.id = m.player_id
   INNER JOIN villages ov ON ov.id = m.origin_village_id
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.status = 'in_progress'
     AND m.command_type IN ('attack', 'support', 'move')
     AND tv.player_id = ?
     AND tv.region = ?
     AND m.player_id != ?
   ORDER BY m.arrive_at ASC, m.id ASC`,
);
const selectRecentAttackTargetsByPlayerRegionStmt = db.prepare(
  `SELECT
      m.target_village_id AS targetVillageId,
      MAX(m.started_at) AS lastIssuedAt,
      tv.name AS targetName,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY
   FROM army_movements m
   INNER JOIN villages tv ON tv.id = m.target_village_id
   WHERE m.player_id = ?
     AND m.command_type = 'attack'
     AND tv.region = ?
     AND julianday(m.started_at) >= julianday('now', '-7 days')
   GROUP BY m.target_village_id, tv.name, tv.coord_x, tv.coord_y
   ORDER BY lastIssuedAt DESC, m.target_village_id DESC
   LIMIT 24`,
);
const selectStationedSupportUnitTotalsByOwnerRegionStmt = db.prepare(
  `SELECT
      m.target_village_id AS targetVillageId,
      mu.unit_id AS unitId,
      COALESCE(SUM(mu.amount), 0) AS supportAmount
   FROM army_movements m
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN army_movement_units mu ON mu.movement_id = m.id
   WHERE m.status = 'stationed'
     AND m.command_type = 'support'
     AND tv.player_id = ?
     AND tv.region = ?
   GROUP BY m.target_village_id, mu.unit_id`,
);
const selectRecentPlannerTargetsByPlayerRegionStmt = db.prepare(
  `SELECT
      m.target_village_id AS targetVillageId,
      MAX(m.started_at) AS lastUsedAt,
      tv.name AS targetVillageName,
      tv.kingdom AS targetKingdom,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY,
      tv.player_id AS targetPlayerId,
      tp.username AS targetPlayerUsername
   FROM army_movements m
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN players tp ON tp.id = tv.player_id
   WHERE m.player_id = ?
     AND m.command_type = 'attack'
     AND tv.region = ?
     AND tp.is_bot = 0
     AND tp.username NOT GLOB '__abandoned_ai__*'
   GROUP BY
      m.target_village_id,
      tv.name,
      tv.kingdom,
      tv.coord_x,
      tv.coord_y,
      tv.player_id,
      tp.username
   ORDER BY lastUsedAt DESC, m.target_village_id DESC
   LIMIT 24`,
);
const selectActivePlannerPlanByPlayerAndWorldStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      world_id AS worldId,
      status,
      revision,
      target_player_id AS targetPlayerId,
      target_village_id AS targetVillageId,
      target_player_username_snapshot AS targetPlayerUsernameSnapshot,
      target_village_name_snapshot AS targetVillageNameSnapshot,
      target_kingdom_snapshot AS targetKingdomSnapshot,
      target_snapshot_hash AS targetSnapshotHash,
      confirmed_at AS confirmedAt,
      first_send_at_utc AS firstSendAtUtc,
      last_send_at_utc AS lastSendAtUtc,
      dispatch_started_at_utc AS dispatchStartedAtUtc,
      completed_at AS completedAt,
      failed_at AS failedAt,
      canceled_at AS canceledAt,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM planner_plans
   WHERE player_id = ?
     AND world_id = ?
     AND status IN ('scheduled', 'needs_reconfirmation', 'dispatching')
   ORDER BY updated_at DESC, created_at DESC
   LIMIT 1`,
);
const selectLatestCompletedPlannerPlanByPlayerAndWorldStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      world_id AS worldId,
      status,
      revision,
      target_player_id AS targetPlayerId,
      target_village_id AS targetVillageId,
      target_player_username_snapshot AS targetPlayerUsernameSnapshot,
      target_village_name_snapshot AS targetVillageNameSnapshot,
      target_kingdom_snapshot AS targetKingdomSnapshot,
      target_snapshot_hash AS targetSnapshotHash,
      confirmed_at AS confirmedAt,
      first_send_at_utc AS firstSendAtUtc,
      last_send_at_utc AS lastSendAtUtc,
      dispatch_started_at_utc AS dispatchStartedAtUtc,
      completed_at AS completedAt,
      failed_at AS failedAt,
      canceled_at AS canceledAt,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM planner_plans
   WHERE player_id = ?
     AND world_id = ?
     AND status = 'completed'
   ORDER BY completed_at DESC, updated_at DESC
   LIMIT 1`,
);
const selectPlannerPlanByIdForPlayerAndWorldStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      world_id AS worldId,
      status,
      revision,
      target_player_id AS targetPlayerId,
      target_village_id AS targetVillageId,
      target_player_username_snapshot AS targetPlayerUsernameSnapshot,
      target_village_name_snapshot AS targetVillageNameSnapshot,
      target_kingdom_snapshot AS targetKingdomSnapshot,
      target_snapshot_hash AS targetSnapshotHash,
      confirmed_at AS confirmedAt,
      first_send_at_utc AS firstSendAtUtc,
      last_send_at_utc AS lastSendAtUtc,
      dispatch_started_at_utc AS dispatchStartedAtUtc,
      completed_at AS completedAt,
      failed_at AS failedAt,
      canceled_at AS canceledAt,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM planner_plans
   WHERE id = ?
     AND player_id = ?
     AND world_id = ?
   LIMIT 1`,
);
const selectPlannerPlansByStatusStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      world_id AS worldId,
      status,
      revision,
      target_player_id AS targetPlayerId,
      target_village_id AS targetVillageId,
      target_player_username_snapshot AS targetPlayerUsernameSnapshot,
      target_village_name_snapshot AS targetVillageNameSnapshot,
      target_kingdom_snapshot AS targetKingdomSnapshot,
      first_send_at_utc AS firstSendAtUtc,
      last_send_at_utc AS lastSendAtUtc,
      dispatch_started_at_utc AS dispatchStartedAtUtc,
      updated_at AS updatedAt
   FROM planner_plans
   WHERE status = ?
   ORDER BY COALESCE(first_send_at_utc, updated_at) ASC, updated_at ASC, id ASC`,
);
const selectPlannerLegsByPlanIdStmt = db.prepare(
  `SELECT
      id,
      plan_id AS planId,
      leg_order AS legOrder,
      status,
      origin_village_id AS originVillageId,
      origin_village_name_snapshot AS originVillageNameSnapshot,
      impact_at_utc AS impactAtUtc,
      send_at_utc AS sendAtUtc,
      travel_duration_sec AS travelDurationSec,
      sent_at_utc AS sentAtUtc,
      fail_code AS failCode,
      fail_message AS failMessage,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM planner_plan_legs
   WHERE plan_id = ?
   ORDER BY leg_order ASC, id ASC`,
);
const selectPlannerLegUnitsByPlanIdStmt = db.prepare(
  `SELECT
      u.id,
      u.plan_leg_id AS planLegId,
      u.unit_id AS unitId,
      u.planned_amount AS plannedAmount
   FROM planner_plan_leg_units u
   INNER JOIN planner_plan_legs l ON l.id = u.plan_leg_id
   WHERE l.plan_id = ?
   ORDER BY l.leg_order ASC, u.unit_id ASC`,
);
const selectPlannerEventsByPlanIdStmt = db.prepare(
  `SELECT
      id,
      plan_id AS planId,
      plan_leg_id AS planLegId,
      event_type AS eventType,
      severity,
      message,
      payload_json AS payloadJson,
      created_at AS createdAt
   FROM planner_plan_events
   WHERE plan_id = ?
   ORDER BY created_at DESC, id DESC
   LIMIT ?
   OFFSET ?`,
);
const countPlannerEventsByPlanIdStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM planner_plan_events
   WHERE plan_id = ?`,
);
const insertPlannerPlanStmt = db.prepare(
  `INSERT INTO planner_plans (
      id,
      player_id,
      world_id,
      status,
      revision,
      target_player_id,
      target_village_id,
      target_player_username_snapshot,
      target_village_name_snapshot,
      target_kingdom_snapshot,
      target_snapshot_hash,
      confirmed_at,
      first_send_at_utc,
      last_send_at_utc,
      created_at,
      updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const updatePlannerPlanForPatchStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = ?,
     revision = revision + 1,
     target_player_id = ?,
     target_village_id = ?,
     target_player_username_snapshot = ?,
     target_village_name_snapshot = ?,
     target_kingdom_snapshot = ?,
     target_snapshot_hash = ?,
     first_send_at_utc = ?,
     last_send_at_utc = ?,
     updated_at = ?
   WHERE id = ?
     AND player_id = ?
     AND world_id = ?
     AND revision = ?`,
);
const updatePlannerPlanForReconfirmStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'scheduled',
     revision = revision + 1,
     confirmed_at = ?,
     updated_at = ?
   WHERE id = ?
     AND player_id = ?
     AND world_id = ?
     AND revision = ?`,
);
const updatePlannerPlanForCancelStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'canceled',
     revision = revision + 1,
     canceled_at = ?,
     updated_at = ?
   WHERE id = ?
     AND player_id = ?
     AND world_id = ?
     AND revision = ?`,
);
const updatePlannerPlanToNeedsReconfirmationStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'needs_reconfirmation',
     revision = revision + 1,
     updated_at = ?
   WHERE id = ?
     AND status = 'scheduled'`,
);
const updatePlannerPlanToDispatchingStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'dispatching',
     revision = revision + 1,
     dispatch_started_at_utc = COALESCE(dispatch_started_at_utc, ?),
     updated_at = ?
   WHERE id = ?
     AND status = 'scheduled'`,
);
const updatePlannerPlanToCompletedStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'completed',
     revision = revision + 1,
     completed_at = ?,
     updated_at = ?
   WHERE id = ?
     AND status = 'dispatching'`,
);
const updatePlannerPlanToFailedStmt = db.prepare(
  `UPDATE planner_plans
   SET
     status = 'failed',
     revision = revision + 1,
     failed_at = ?,
     updated_at = ?
   WHERE id = ?
     AND status IN ('scheduled', 'dispatching')`,
);
const updatePlannerLegStatusesByPlanIdStmt = db.prepare(
  `UPDATE planner_plan_legs
   SET
     status = ?,
     updated_at = ?
   WHERE plan_id = ?`,
);
const updatePlannerLegToSentStmt = db.prepare(
  `UPDATE planner_plan_legs
   SET
     status = 'sent',
     sent_at_utc = ?,
     fail_code = NULL,
     fail_message = NULL,
     updated_at = ?
   WHERE id = ?
     AND status = 'scheduled'`,
);
const updatePlannerLegToFailedStmt = db.prepare(
  `UPDATE planner_plan_legs
   SET
     status = 'failed',
     fail_code = ?,
     fail_message = ?,
     updated_at = ?
   WHERE id = ?`,
);
const updatePlannerScheduledLegsToCanceledByPlanStmt = db.prepare(
  `UPDATE planner_plan_legs
   SET
     status = 'canceled',
     updated_at = ?
   WHERE plan_id = ?
     AND status = 'scheduled'`,
);
const insertPlannerPlanLegStmt = db.prepare(
  `INSERT INTO planner_plan_legs (
      id,
      plan_id,
      leg_order,
      status,
      origin_village_id,
      origin_village_name_snapshot,
      impact_at_utc,
      send_at_utc,
      travel_duration_sec,
      created_at,
      updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertPlannerPlanLegUnitStmt = db.prepare(
  `INSERT INTO planner_plan_leg_units (
      id,
      plan_leg_id,
      unit_id,
      planned_amount
   ) VALUES (?, ?, ?, ?)`,
);
const insertPlannerPlanEventStmt = db.prepare(
  `INSERT INTO planner_plan_events (
      id,
      plan_id,
      plan_leg_id,
      event_type,
      severity,
      message,
      payload_json,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const deletePlannerPlanLegUnitsByPlanIdStmt = db.prepare(
  `DELETE FROM planner_plan_leg_units
   WHERE plan_leg_id IN (
     SELECT id
     FROM planner_plan_legs
     WHERE plan_id = ?
   )`,
);
const deletePlannerPlanLegsByPlanIdStmt = db.prepare(
  `DELETE FROM planner_plan_legs
   WHERE plan_id = ?`,
);
const selectStationedSupportMovementsByPlayerStmt = db.prepare(
  `SELECT
      m.id,
      m.command_type AS commandType,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      m.loot_priority AS lootPriority,
      m.carry_wood AS carryWood,
      m.carry_stone AS carryStone,
      m.carry_iron AS carryIron,
      m.started_at AS startedAt,
      m.arrive_at AS arriveAt,
      ov.name AS originName,
      ov.coord_x AS originCoordX,
      ov.coord_y AS originCoordY,
      tv.name AS targetName,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY,
      hv.name AS homeName,
      hv.coord_x AS homeCoordX,
      hv.coord_y AS homeCoordY
   FROM army_movements m
   INNER JOIN villages ov ON ov.id = m.origin_village_id
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.player_id = ? AND m.status = 'stationed' AND m.command_type = 'support'
   ORDER BY m.arrive_at ASC, m.id ASC`,
);
const selectStationedSupportByIdForPlayerStmt = db.prepare(
  `SELECT
      m.id,
      m.player_id AS playerId,
      m.command_type AS commandType,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      m.started_at AS startedAt,
      m.arrive_at AS arriveAt,
      tv.coord_x AS targetCoordX,
      tv.coord_y AS targetCoordY,
      hv.coord_x AS homeCoordX,
      hv.coord_y AS homeCoordY
   FROM army_movements m
   INNER JOIN villages tv ON tv.id = m.target_village_id
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.id = ? AND m.player_id = ? AND m.status = 'stationed' AND m.command_type = 'support'
   LIMIT 1`,
);
const selectStationedSupportsByTargetVillageStmt = db.prepare(
  `SELECT
      m.id,
      m.player_id AS playerId,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      ov.name AS originName,
      tv.name AS targetName
   FROM army_movements m
   INNER JOIN villages ov ON ov.id = m.origin_village_id
   INNER JOIN villages tv ON tv.id = m.target_village_id
   WHERE m.status = 'stationed' AND m.command_type = 'support' AND m.target_village_id = ?
   ORDER BY m.id ASC`,
);
const selectVillageForConquestStmt = db.prepare(
  `SELECT
      v.id,
      v.name,
      v.region,
      v.player_id AS ownerId,
      p.username AS ownerUsername
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.id = ?
   LIMIT 1`,
);
const selectPrimaryKingdomByPlayerAndRegionStmt = db.prepare(
  `SELECT COALESCE((
      SELECT vv.kingdom
      FROM villages vv
      WHERE vv.player_id = ? AND vv.region = ?
      ORDER BY vv.id ASC
      LIMIT 1
    ), 'Neutral') AS kingdom`,
);
const selectVillageCountByPlayerStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM villages
   WHERE player_id = ?`,
);
const selectVillageCountByPlayerAndRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM villages
   WHERE player_id = ? AND region = ?`,
);
const selectVillagePrestigeByPlayerAndRegionStmt = db.prepare(
  `SELECT COALESCE(SUM(prestige), 0) AS total
   FROM villages
   WHERE player_id = ? AND region = ?`,
);
const upsertCombatRetaliationFlagStmt = db.prepare(
  `INSERT INTO combat_retaliation_flags (
      aggressor_player_id,
      defender_player_id,
      region,
      first_attacked_at,
      last_attacked_at
   ) VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(aggressor_player_id, defender_player_id, region) DO UPDATE SET
     last_attacked_at = excluded.last_attacked_at`,
);
const selectCombatRetaliationFlagByPlayersStmt = db.prepare(
  `SELECT
      aggressor_player_id AS aggressorPlayerId,
      defender_player_id AS defenderPlayerId,
      region,
      first_attacked_at AS firstAttackedAt,
      last_attacked_at AS lastAttackedAt
   FROM combat_retaliation_flags
   WHERE aggressor_player_id = ?
     AND defender_player_id = ?
     AND region = ?
   LIMIT 1`,
);
const selectCombatRetaliationFlagsByDefenderStmt = db.prepare(
  `SELECT
      aggressor_player_id AS aggressorPlayerId,
      defender_player_id AS defenderPlayerId,
      region,
      first_attacked_at AS firstAttackedAt,
      last_attacked_at AS lastAttackedAt
   FROM combat_retaliation_flags
   WHERE defender_player_id = ?
     AND region = ?`,
);
const selectMaxUniversityLevelByPlayerAndRegionStmt = db.prepare(
  `SELECT COALESCE(MAX(b.level), 0) AS maxLevel
   FROM villages v
   INNER JOIN buildings b ON b.village_id = v.id
   WHERE v.player_id = ?
     AND v.region = ?
     AND b.building_id = 'university'`,
);
const selectTotalUniversityAcademicCapacityByPlayerAndRegionStmt = db.prepare(
  `SELECT COALESCE(SUM(MIN(3, COALESCE(b.level, 0))), 0) AS totalCapacity
   FROM villages v
   LEFT JOIN buildings b ON b.village_id = v.id AND b.building_id = 'university'
   WHERE v.player_id = ?
     AND v.region = ?`,
);
const selectTotalPlayerUnitAmountStmt = db.prepare(
  `SELECT COALESCE(SUM(u.amount), 0) AS total
   FROM units u
   INNER JOIN villages v ON v.id = u.village_id
   WHERE v.player_id = ? AND u.unit_id = ?`,
);
const selectTotalPlayerUnitAmountByRegionStmt = db.prepare(
  `SELECT COALESCE(SUM(u.amount), 0) AS total
   FROM units u
   INNER JOIN villages v ON v.id = u.village_id
   WHERE v.player_id = ? AND u.unit_id = ? AND v.region = ?`,
);
const selectTotalPlayerQueuedRecruitmentAmountStmt = db.prepare(
  `SELECT COALESCE(SUM(r.amount), 0) AS total
   FROM unit_recruitments r
   INNER JOIN villages v ON v.id = r.village_id
   WHERE v.player_id = ? AND r.unit_id = ? AND r.status = 'in_progress'`,
);
const selectTotalPlayerQueuedRecruitmentAmountByRegionStmt = db.prepare(
  `SELECT COALESCE(SUM(r.amount), 0) AS total
   FROM unit_recruitments r
   INNER JOIN villages v ON v.id = r.village_id
   WHERE v.player_id = ? AND r.unit_id = ? AND r.status = 'in_progress' AND v.region = ?`,
);
const selectTotalPlayerMovementUnitAmountStmt = db.prepare(
  `SELECT COALESCE(SUM(mu.amount), 0) AS total
   FROM army_movement_units mu
   INNER JOIN army_movements m ON m.id = mu.movement_id
   WHERE m.player_id = ? AND mu.unit_id = ? AND m.status IN ('in_progress', 'stationed')`,
);
const selectTotalPlayerMovementUnitAmountByRegionStmt = db.prepare(
  `SELECT COALESCE(SUM(mu.amount), 0) AS total
   FROM army_movement_units mu
   INNER JOIN army_movements m ON m.id = mu.movement_id
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.player_id = ?
     AND mu.unit_id = ?
     AND m.status IN ('in_progress', 'stationed')
     AND hv.region = ?`,
);
const selectInProgressMovementByIdForPlayerStmt = db.prepare(
  `SELECT
      m.id,
      m.player_id AS playerId,
      m.command_type AS commandType,
      m.origin_village_id AS originVillageId,
      m.target_village_id AS targetVillageId,
      m.home_village_id AS homeVillageId,
      m.started_at AS startedAt,
      m.arrive_at AS arriveAt,
      m.status
   FROM army_movements m
   INNER JOIN villages hv ON hv.id = m.home_village_id
   WHERE m.id = ?
     AND m.player_id = ?
     AND hv.region = ?
     AND m.status = 'in_progress'
   LIMIT 1`,
);
const insertLogisticsRouteStmt = db.prepare(
  `INSERT INTO logistics_routes (
      owner_player_id,
      source_village_id,
      target_village_id,
      region,
      mode,
      wood,
      stone,
      iron,
      status,
      started_at,
      arrive_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)`,
);
const selectDueLogisticsRoutesStmt = db.prepare(
  `SELECT
      id,
      owner_player_id AS ownerPlayerId,
      source_village_id AS sourceVillageId,
      target_village_id AS targetVillageId,
      region,
      mode,
      wood,
      stone,
      iron,
      started_at AS startedAt,
      arrive_at AS arriveAt
   FROM logistics_routes
   WHERE status = 'in_progress' AND arrive_at <= ?
   ORDER BY arrive_at ASC, id ASC`,
);
const selectInProgressLogisticsRouteByIdForPlayerStmt = db.prepare(
  `SELECT
      lr.id,
      lr.owner_player_id AS ownerPlayerId,
      lr.source_village_id AS sourceVillageId,
      lr.target_village_id AS targetVillageId,
      lr.region,
      lr.mode,
      lr.wood,
      lr.stone,
      lr.iron,
      lr.status,
      lr.started_at AS startedAt,
      lr.arrive_at AS arriveAt
   FROM logistics_routes lr
   WHERE lr.id = ?
     AND lr.owner_player_id = ?
     AND lr.region = ?
     AND lr.status = 'in_progress'
   LIMIT 1`,
);
const completeLogisticsRouteStmt = db.prepare(
  "UPDATE logistics_routes SET status = 'completed', completed_at = ? WHERE id = ?",
);
const cancelLogisticsRouteStmt = db.prepare(
  "UPDATE logistics_routes SET status = 'canceled', completed_at = ? WHERE id = ? AND status = 'in_progress'",
);
const selectRecentLogisticsByVillageStmt = db.prepare(
  `SELECT
      lr.id,
      lr.owner_player_id AS ownerPlayerId,
      lr.source_village_id AS sourceVillageId,
      lr.target_village_id AS targetVillageId,
      lr.region,
      lr.mode,
      lr.wood,
      lr.stone,
      lr.iron,
      lr.status,
      lr.started_at AS startedAt,
      lr.arrive_at AS arriveAt,
      lr.completed_at AS completedAt,
      sv.name AS sourceVillageName,
      tv.name AS targetVillageName
   FROM logistics_routes lr
   INNER JOIN villages sv ON sv.id = lr.source_village_id
   INNER JOIN villages tv ON tv.id = lr.target_village_id
   WHERE (lr.source_village_id = ? OR lr.target_village_id = ?)
     AND lr.region = ?
   ORDER BY lr.id DESC
   LIMIT 40`,
);
const countInProgressLogisticsBySourceVillageStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM logistics_routes
   WHERE source_village_id = ?
     AND status = 'in_progress'`,
);
const selectMarketGuildSettingBySourceVillageStmt = db.prepare(
  `SELECT
      source_village_id AS sourceVillageId,
      owner_player_id AS ownerPlayerId,
      region,
      enabled,
      cycle_interval_sec AS cycleIntervalSec,
      cursor_index AS cursorIndex,
      next_dispatch_at AS nextDispatchAt,
      last_dispatch_at AS lastDispatchAt,
      updated_at AS updatedAt
   FROM market_guild_settings
   WHERE source_village_id = ?
   LIMIT 1`,
);
const upsertMarketGuildSettingStmt = db.prepare(
  `INSERT INTO market_guild_settings (
      source_village_id,
      owner_player_id,
      region,
      enabled,
      cycle_interval_sec,
      cursor_index,
      next_dispatch_at,
      last_dispatch_at,
      updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(source_village_id)
   DO UPDATE SET
      owner_player_id = excluded.owner_player_id,
      region = excluded.region,
      enabled = excluded.enabled,
      cycle_interval_sec = excluded.cycle_interval_sec,
      cursor_index = excluded.cursor_index,
      next_dispatch_at = excluded.next_dispatch_at,
      last_dispatch_at = excluded.last_dispatch_at,
      updated_at = excluded.updated_at`,
);
const updateMarketGuildSettingDispatchStateStmt = db.prepare(
  `UPDATE market_guild_settings
   SET cursor_index = ?,
       next_dispatch_at = ?,
       last_dispatch_at = ?,
       updated_at = ?
   WHERE source_village_id = ?`,
);
const selectDueMarketGuildSettingsStmt = db.prepare(
  `SELECT
      source_village_id AS sourceVillageId,
      owner_player_id AS ownerPlayerId,
      region,
      enabled,
      cycle_interval_sec AS cycleIntervalSec,
      cursor_index AS cursorIndex,
      next_dispatch_at AS nextDispatchAt,
      last_dispatch_at AS lastDispatchAt
   FROM market_guild_settings
   WHERE enabled = 1
     AND next_dispatch_at IS NOT NULL
     AND next_dispatch_at <= ?
   ORDER BY source_village_id ASC`,
);
const selectMarketGuildTargetsBySourceVillageStmt = db.prepare(
  `SELECT
      id,
      source_village_id AS sourceVillageId,
      target_village_id AS targetVillageId,
      sort_index AS sortIndex,
      is_paused AS isPaused,
      created_at AS createdAt
   FROM market_guild_targets
   WHERE source_village_id = ?
   ORDER BY sort_index ASC, id ASC`,
);
const deleteMarketGuildTargetsBySourceVillageStmt = db.prepare(
  'DELETE FROM market_guild_targets WHERE source_village_id = ?',
);
const insertMarketGuildTargetStmt = db.prepare(
  `INSERT INTO market_guild_targets (
      source_village_id,
      target_village_id,
      sort_index,
      is_paused,
      created_at
   ) VALUES (?, ?, ?, ?, ?)`,
);
const insertMarketGuildAuditLogStmt = db.prepare(
  `INSERT INTO market_guild_audit_logs (
      owner_player_id,
      source_village_id,
      target_village_id,
      region,
      severity,
      reason_code,
      message,
      details_json,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const selectRecentMarketGuildAuditLogsBySourceVillageStmt = db.prepare(
  `SELECT
      id,
      owner_player_id AS ownerPlayerId,
      source_village_id AS sourceVillageId,
      target_village_id AS targetVillageId,
      region,
      severity,
      reason_code AS reasonCode,
      message,
      details_json AS detailsJson,
      created_at AS createdAt
   FROM market_guild_audit_logs
   WHERE source_village_id = ?
   ORDER BY id DESC
   LIMIT ?`,
);
const deleteOldMarketGuildAuditLogsStmt = db.prepare(
  `DELETE FROM market_guild_audit_logs
   WHERE created_at < ?`,
);
const trimMarketGuildAuditLogsBySourceVillageStmt = db.prepare(
  `DELETE FROM market_guild_audit_logs
   WHERE source_village_id = ?
     AND id NOT IN (
       SELECT id
       FROM market_guild_audit_logs
       WHERE source_village_id = ?
       ORDER BY id DESC
       LIMIT ?
     )`,
);
const insertAcademicStmt = db.prepare(
  `INSERT INTO academics (
      player_id,
      village_id,
      region,
      status,
      assigned_research_id,
      created_at
   ) VALUES (?, ?, ?, 'idle', NULL, ?)`,
);
const countActiveAcademicsByVillageStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM academics
   WHERE village_id = ?
     AND status != 'removed'`,
);
const countActiveAcademicsByPlayerRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM academics
   WHERE player_id = ?
     AND region = ?
     AND status != 'removed'`,
);
const countIdleAcademicsByPlayerRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM academics
   WHERE player_id = ?
     AND region = ?
     AND status = 'idle'`,
);
const countAssignedAcademicsForResearchByPlayerRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM academics
   WHERE player_id = ?
     AND region = ?
     AND status = 'assigned'
     AND assigned_research_id = ?`,
);
const updateAcademicAssignmentByPlayerRegionStmt = db.prepare(
  `UPDATE academics
   SET status = ?,
       assigned_research_id = ?
   WHERE id IN (
     SELECT id
     FROM academics
     WHERE player_id = ?
       AND region = ?
       AND status = 'idle'
     ORDER BY id ASC
     LIMIT ?
   )`,
);
const releaseAcademicAssignmentByResearchForPlayerRegionStmt = db.prepare(
  `UPDATE academics
   SET status = 'idle',
       assigned_research_id = NULL
   WHERE id IN (
     SELECT id
     FROM academics
     WHERE player_id = ?
       AND region = ?
       AND status = 'assigned'
       AND assigned_research_id = ?
     ORDER BY id DESC
     LIMIT ?
   )`,
);
const releaseAllAcademicAssignmentsByResearchForPlayerRegionStmt = db.prepare(
  `UPDATE academics
   SET status = 'idle',
       assigned_research_id = NULL
   WHERE player_id = ?
     AND region = ?
     AND status = 'assigned'
     AND assigned_research_id = ?`,
);
const selectAssignedResearchAcademicsByVillageForPlayerRegionStmt = db.prepare(
  `SELECT
      a.village_id AS villageId,
      v.name AS villageName,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      COALESCE(ub.level, 0) AS universityLevel,
      COUNT(*) AS assignedAcademics
   FROM academics a
   INNER JOIN villages v ON v.id = a.village_id
   LEFT JOIN buildings ub ON ub.village_id = v.id AND ub.building_id = 'university'
   WHERE a.player_id = ?
     AND a.region = ?
     AND a.status = 'assigned'
     AND a.assigned_research_id = ?
   GROUP BY a.village_id, v.name, v.coord_x, v.coord_y, ub.level
   ORDER BY assignedAcademics DESC, a.village_id ASC`,
);
const clearResearchAssignmentsByPlayerRegionStmt = db.prepare(
  `UPDATE academics
   SET status = 'idle',
       assigned_research_id = NULL
   WHERE player_id = ?
     AND region = ?
     AND status = 'assigned'`,
);
const clearResearchAssignmentsByVillageStmt = db.prepare(
  `UPDATE academics
   SET status = 'idle',
       assigned_research_id = NULL
   WHERE village_id = ?
     AND status = 'assigned'`,
);
const removeAcademicsByVillageStmt = db.prepare(
  `UPDATE academics
   SET status = 'removed',
       assigned_research_id = NULL,
       removed_at = ?
   WHERE village_id = ?
     AND status != 'removed'`,
);
const selectResearchProgressByPlayerRegionStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      region,
      research_id AS researchId,
      status,
      progress,
      assigned_academics AS assignedAcademics,
      started_at AS startedAt,
      completed_at AS completedAt,
      updated_at AS updatedAt
   FROM research_progress
   WHERE player_id = ?
     AND region = ?
   ORDER BY id ASC`,
);
const selectResearchProgressByPlayerRegionAndResearchStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      region,
      research_id AS researchId,
      status,
      progress,
      assigned_academics AS assignedAcademics,
      started_at AS startedAt,
      completed_at AS completedAt,
      updated_at AS updatedAt
   FROM research_progress
   WHERE player_id = ?
     AND region = ?
     AND research_id = ?
   LIMIT 1`,
);
const upsertResearchProgressStmt = db.prepare(
  `INSERT INTO research_progress (
      player_id,
      region,
      research_id,
      status,
      progress,
      assigned_academics,
      started_at,
      completed_at,
      updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(player_id, region, research_id) DO UPDATE SET
     status = excluded.status,
     progress = excluded.progress,
     assigned_academics = excluded.assigned_academics,
     started_at = excluded.started_at,
     completed_at = excluded.completed_at,
     updated_at = excluded.updated_at`,
);
const selectActiveResearchByPlayerRegionStmt = db.prepare(
  `SELECT
      research_id AS researchId,
      progress,
      assigned_academics AS assignedAcademics,
      started_at AS startedAt
   FROM research_progress
   WHERE player_id = ?
     AND region = ?
     AND status = 'researching'
   ORDER BY updated_at DESC, id DESC
   LIMIT 1`,
);
const selectResearchingProjectsByPlayerRegionStmt = db.prepare(
  `SELECT
      research_id AS researchId,
      progress,
      assigned_academics AS assignedAcademics,
      started_at AS startedAt
   FROM research_progress
   WHERE player_id = ?
     AND region = ?
     AND status = 'researching'
   ORDER BY updated_at DESC, id DESC`,
);
const selectResearchingPlayerRegionPairsStmt = db.prepare(
  `SELECT DISTINCT
      player_id AS playerId,
      region
   FROM research_progress
   WHERE status = 'researching'
   ORDER BY player_id ASC, region ASC`,
);
const selectLatestMercenaryContractByPlayerRegionStmt = db.prepare(
  `SELECT
      id,
      status,
      ordered_at AS orderedAt,
      arrive_at AS arriveAt,
      expires_at AS expiresAt,
      delivered_at AS deliveredAt,
      finished_at AS finishedAt,
      village_id AS villageId
   FROM mercenary_contracts
   WHERE player_id = ?
     AND region = ?
   ORDER BY id DESC
   LIMIT 1`,
);
const insertMercenaryContractStmt = db.prepare(
  `INSERT INTO mercenary_contracts (
      player_id,
      village_id,
      region,
      status,
      ordered_at,
      arrive_at,
      expires_at,
      delivered_at,
      finished_at,
      unit_amount
   ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
);
const selectDueMercenaryArrivalsStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      village_id AS villageId,
      region,
      unit_amount AS unitAmount,
      arrive_at AS arriveAt,
      expires_at AS expiresAt
   FROM mercenary_contracts
   WHERE status = 'en_route'
     AND arrive_at <= ?
   ORDER BY arrive_at ASC, id ASC`,
);
const markMercenaryDeliveredStmt = db.prepare(
  `UPDATE mercenary_contracts
   SET status = 'active',
       delivered_at = ?,
       finished_at = NULL
   WHERE id = ?`,
);
const selectDueMercenaryExpirationsStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      village_id AS villageId,
      region,
      unit_amount AS unitAmount,
      expires_at AS expiresAt
   FROM mercenary_contracts
   WHERE status = 'active'
     AND expires_at <= ?
   ORDER BY expires_at ASC, id ASC`,
);
const markMercenaryExpiredStmt = db.prepare(
  `UPDATE mercenary_contracts
   SET status = 'expired',
       finished_at = ?
   WHERE id = ?`,
);
const selectMercenaryContractsByVillageStmt = db.prepare(
  `SELECT
      id,
      status,
      ordered_at AS orderedAt,
      arrive_at AS arriveAt,
      expires_at AS expiresAt,
      delivered_at AS deliveredAt,
      finished_at AS finishedAt,
      unit_amount AS unitAmount
   FROM mercenary_contracts
   WHERE village_id = ?
   ORDER BY id DESC`,
);
const selectDistinctVillageKingdomsByPlayerStmt = db.prepare(
  `SELECT DISTINCT kingdom
   FROM villages
   WHERE player_id = ? AND region = ?`,
);
const updateVillageOwnerForConquestStmt = db.prepare(
  'UPDATE villages SET player_id = ?, kingdom = ?, loyalty = 100 WHERE id = ?',
);
const updateVillageNameByOwnerAndRegionStmt = db.prepare(
  'UPDATE villages SET name = ? WHERE id = ? AND player_id = ? AND region = ?',
);
const updateVillagesKingdomByPlayerStmt = db.prepare(
  'UPDATE villages SET kingdom = ?, loyalty = 100 WHERE player_id = ? AND region = ?',
);
const insertBattleReportStmt = db.prepare(
  `INSERT INTO battle_reports (
      player_id,
      origin_village_id,
      target_village_id,
      battle_at,
      created_at,
      title,
      summary,
      payload_json
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const selectBattleReportCountByPlayerStmt = db.prepare(
  'SELECT COUNT(*) AS total FROM battle_reports WHERE player_id = ?',
);
const selectBattleReportCountByPlayerAndRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM battle_reports br
   LEFT JOIN villages ov ON ov.id = br.origin_village_id
   LEFT JOIN villages tv ON tv.id = br.target_village_id
   WHERE br.player_id = ?
     AND (ov.region = ? OR tv.region = ?)`,
);
const selectBattleReportsByPlayerStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      origin_village_id AS originVillageId,
      target_village_id AS targetVillageId,
      battle_at AS battleAt,
      created_at AS createdAt,
      title,
      summary,
      payload_json AS payloadJson
   FROM battle_reports
   WHERE player_id = ?
   ORDER BY created_at DESC, id DESC
   LIMIT ? OFFSET ?`,
);
const selectBattleReportsByPlayerAndRegionStmt = db.prepare(
  `SELECT
      br.id,
      br.player_id AS playerId,
      br.origin_village_id AS originVillageId,
      br.target_village_id AS targetVillageId,
      br.battle_at AS battleAt,
      br.created_at AS createdAt,
      br.title,
      br.summary,
      br.payload_json AS payloadJson
   FROM battle_reports br
   LEFT JOIN villages ov ON ov.id = br.origin_village_id
   LEFT JOIN villages tv ON tv.id = br.target_village_id
   WHERE br.player_id = ?
     AND (ov.region = ? OR tv.region = ?)
   ORDER BY br.created_at DESC, br.id DESC
   LIMIT ? OFFSET ?`,
);
const selectBattleReportByIdAndPlayerAndRegionStmt = db.prepare(
  `SELECT
      br.id,
      br.player_id AS playerId,
      br.origin_village_id AS originVillageId,
      br.target_village_id AS targetVillageId,
      br.battle_at AS battleAt,
      br.created_at AS createdAt,
      br.title,
      br.summary,
      br.payload_json AS payloadJson
   FROM battle_reports br
   LEFT JOIN villages ov ON ov.id = br.origin_village_id
   LEFT JOIN villages tv ON tv.id = br.target_village_id
   WHERE br.id = ?
     AND br.player_id = ?
     AND (ov.region = ? OR tv.region = ?)
   LIMIT 1`,
);
const selectBattleReportsForLeaderboardStmt = db.prepare(
  `SELECT
      player_id AS playerId,
      payload_json AS payloadJson
   FROM battle_reports
   ORDER BY id ASC`,
);
const selectBattleReportsForLeaderboardByRegionStmt = db.prepare(
  `SELECT
      br.player_id AS playerId,
      br.payload_json AS payloadJson
   FROM battle_reports br
   LEFT JOIN villages ov ON ov.id = br.origin_village_id
   LEFT JOIN villages tv ON tv.id = br.target_village_id
   WHERE ov.region = ? OR tv.region = ?
   ORDER BY br.id ASC`,
);
const insertPlayerNotificationStmt = db.prepare(
  `INSERT INTO player_notifications (
      player_id,
      region,
      category,
      event_type,
      severity,
      title,
      summary,
      payload_json,
      source_type,
      source_id,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const selectPlayerNotificationCountStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
     AND archived_at IS NULL`,
);
const selectPlayerNotificationCountIncludingArchivedStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const selectPlayerNotificationUnreadCountStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
     AND read_at IS NULL`,
);
const selectPlayerNotificationAttentionCountStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
     AND read_at IS NULL
     AND severity IN ('warning', 'critical')`,
);
const selectPlayerNotificationsStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      region,
      category,
      event_type AS eventType,
      severity,
      title,
      summary,
      payload_json AS payloadJson,
      source_type AS sourceType,
      source_id AS sourceId,
      created_at AS createdAt,
      read_at AS readAt,
      archived_at AS archivedAt
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
     AND archived_at IS NULL
   ORDER BY created_at DESC, id DESC
   LIMIT ? OFFSET ?`,
);
const selectPlayerNotificationsIncludingArchivedStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      region,
      category,
      event_type AS eventType,
      severity,
      title,
      summary,
      payload_json AS payloadJson,
      source_type AS sourceType,
      source_id AS sourceId,
      created_at AS createdAt,
      read_at AS readAt,
      archived_at AS archivedAt
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
   ORDER BY created_at DESC, id DESC
   LIMIT ? OFFSET ?`,
);
const selectUnreadPlayerNotificationsFeedStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      region,
      category,
      event_type AS eventType,
      severity,
      title,
      summary,
      payload_json AS payloadJson,
      source_type AS sourceType,
      source_id AS sourceId,
      created_at AS createdAt,
      read_at AS readAt,
      archived_at AS archivedAt
   FROM player_notifications
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL
     AND read_at IS NULL
   ORDER BY created_at DESC, id DESC
   LIMIT ?`,
);
const markPlayerNotificationReadStmt = db.prepare(
  `UPDATE player_notifications
   SET read_at = COALESCE(read_at, ?)
   WHERE id = ?
     AND player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const markAllPlayerNotificationsReadStmt = db.prepare(
  `UPDATE player_notifications
   SET read_at = COALESCE(read_at, ?)
   WHERE player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const archivePlayerNotificationStmt = db.prepare(
  `UPDATE player_notifications
   SET archived_at = COALESCE(archived_at, ?),
       read_at = COALESCE(read_at, ?)
   WHERE id = ?
     AND player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const unarchivePlayerNotificationStmt = db.prepare(
  `UPDATE player_notifications
   SET archived_at = NULL
   WHERE id = ?
     AND player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const deletePlayerNotificationStmt = db.prepare(
  `UPDATE player_notifications
   SET deleted_at = ?
   WHERE id = ?
     AND player_id = ?
     AND region = ?
     AND deleted_at IS NULL`,
);
const pruneOldPlayerNotificationsStmt = db.prepare(
  `DELETE FROM player_notifications
   WHERE archived_at IS NULL
     AND created_at <= ?`,
);
const selectPlayerCountByRegionStmt = db.prepare(
  `SELECT COUNT(DISTINCT v.player_id) AS total
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.region = ?
     AND p.is_bot = 0
     AND p.username NOT GLOB '__abandoned_ai__*'`,
);
const selectKingdomLeaderByKingdomStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 0
      AND p.username NOT GLOB '__abandoned_ai__*'
      AND v.kingdom = ?
      AND v.region = ?
   GROUP BY p.id, p.username
   ORDER BY p.id ASC
   LIMIT 1`,
);
const selectKingdomMembersByKingdomStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      COUNT(v.id) AS villageCount,
      COALESCE(SUM(v.prestige), 0) AS prestige
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 0
      AND p.username NOT GLOB '__abandoned_ai__*'
      AND v.kingdom = ?
      AND v.region = ?
   GROUP BY p.id, p.username
   ORDER BY prestige DESC, villageCount DESC, p.username COLLATE NOCASE ASC`,
);
const selectKingdomOverviewRowsStmt = db.prepare(
  `SELECT
      v.kingdom,
      COUNT(v.id) AS villages,
      COUNT(DISTINCT p.id) AS members,
      COALESCE(SUM(v.prestige), 0) AS prestige
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 0
      AND p.username NOT GLOB '__abandoned_ai__*'
      AND v.region = ?
   GROUP BY v.kingdom
   ORDER BY prestige DESC, villages DESC, v.kingdom COLLATE NOCASE ASC`,
);
const selectDistinctPlayerKingdomNamesStmt = db.prepare(
  `SELECT DISTINCT v.kingdom
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 0
      AND p.username NOT GLOB '__abandoned_ai__*'
      AND v.region = ?`,
);
const insertKingdomInviteStmt = db.prepare(
  `INSERT INTO kingdom_invites (
      region,
      kingdom,
      inviter_player_id,
      target_player_id,
      status,
      created_at
   ) VALUES (?, ?, ?, ?, 'pending', ?)`,
);
const selectPendingKingdomInviteByTargetStmt = db.prepare(
  `SELECT
      id,
      region,
      kingdom,
      inviter_player_id AS inviterPlayerId,
      target_player_id AS targetPlayerId,
      created_at AS createdAt
   FROM kingdom_invites
   WHERE target_player_id = ? AND region = ? AND status = 'pending'
   ORDER BY created_at DESC, id DESC
   LIMIT 1`,
);
const selectPendingKingdomInviteTargetIdsStmt = db.prepare(
  `SELECT
      target_player_id AS targetPlayerId
   FROM kingdom_invites
   WHERE status = 'pending' AND region = ?`,
);
const selectPendingKingdomInviteByIdForTargetStmt = db.prepare(
  `SELECT
      ki.id,
      ki.region,
      ki.kingdom,
      ki.inviter_player_id AS inviterPlayerId,
      ki.target_player_id AS targetPlayerId,
      ki.created_at AS createdAt,
      p.username AS inviterUsername
   FROM kingdom_invites ki
   INNER JOIN players p ON p.id = ki.inviter_player_id
   WHERE ki.id = ?
      AND ki.target_player_id = ?
      AND ki.region = ?
      AND ki.status = 'pending'
   LIMIT 1`,
);
const selectIncomingKingdomInvitesByTargetStmt = db.prepare(
  `SELECT
      ki.id,
      ki.region,
      ki.kingdom,
      ki.created_at AS createdAt,
      p.username AS inviterUsername
   FROM kingdom_invites ki
   INNER JOIN players p ON p.id = ki.inviter_player_id
   WHERE ki.target_player_id = ?
      AND ki.region = ?
      AND ki.status = 'pending'
   ORDER BY ki.created_at DESC, ki.id DESC`,
);
const updateKingdomInviteStatusByIdStmt = db.prepare(
  'UPDATE kingdom_invites SET status = ?, responded_at = ? WHERE id = ? AND region = ?',
);
const rejectOtherPendingKingdomInvitesForTargetStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE target_player_id = ?
      AND region = ?
      AND status = 'pending'
      AND id != ?`,
);
const rejectAllPendingKingdomInvitesForTargetStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE target_player_id = ?
      AND region = ?
      AND status = 'pending'`,
);
const cancelPendingKingdomInvitesByInviterStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE inviter_player_id = ?
      AND region = ?
      AND status = 'pending'`,
);
const insertKingdomEventStmt = db.prepare(
  `INSERT INTO kingdom_events (
      region,
      kingdom,
      event_type,
      actor_player_id,
      target_player_id,
      payload_json,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const selectKingdomEventsByKingdomStmt = db.prepare(
  `SELECT
      ke.id,
      ke.region,
      ke.kingdom,
      ke.event_type AS eventType,
      ke.actor_player_id AS actorPlayerId,
      ke.target_player_id AS targetPlayerId,
      ke.payload_json AS payloadJson,
      ke.created_at AS createdAt,
      actor.username AS actorUsername,
      target.username AS targetUsername
   FROM kingdom_events ke
   LEFT JOIN players actor ON actor.id = ke.actor_player_id
   LEFT JOIN players target ON target.id = ke.target_player_id
   WHERE ke.region = ? AND ke.kingdom = ?
   ORDER BY ke.created_at DESC, ke.id DESC
   LIMIT ?`,
);
const selectLatestKingdomLeadershipTransferStmt = db.prepare(
  `SELECT
      ke.payload_json AS payloadJson
   FROM kingdom_events ke
   WHERE ke.region = ?
     AND ke.kingdom = ?
     AND ke.event_type = 'leadership_transferred'
   ORDER BY ke.created_at DESC, ke.id DESC
   LIMIT 1`,
);
const selectKingdomEventsByPlayerStmt = db.prepare(
  `SELECT
      ke.id,
      ke.region,
      ke.kingdom,
      ke.event_type AS eventType,
      ke.actor_player_id AS actorPlayerId,
      ke.target_player_id AS targetPlayerId,
      ke.payload_json AS payloadJson,
      ke.created_at AS createdAt,
      actor.username AS actorUsername,
      target.username AS targetUsername
   FROM kingdom_events ke
   LEFT JOIN players actor ON actor.id = ke.actor_player_id
   LEFT JOIN players target ON target.id = ke.target_player_id
   WHERE ke.region = ?
      AND (ke.actor_player_id = ? OR ke.target_player_id = ?)
   ORDER BY ke.created_at DESC, ke.id DESC
   LIMIT ?`,
);

const RESOURCE_STORAGE_PRECISION = 1000;
const roundResource = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * RESOURCE_STORAGE_PRECISION) / RESOURCE_STORAGE_PRECISION;
};

const normalizeKingdomValue = (value) => String(value ?? '').trim();

const isNeutralKingdom = (kingdom) => {
  const normalized = normalizeKingdomValue(kingdom)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return normalized === '' || normalized === 'neutral' || normalized === 'kralovska osada';
};

const normalizeKingdomComparable = (value) =>
  normalizeKingdomValue(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const normalizeUsername = (value) => String(value ?? '').trim();
const normalizeUsernameComparable = (value) => normalizeUsername(value).toLocaleLowerCase('cs-CZ');
const normalizeVillageName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const stripVillageCoordinateSuffix = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s*\(?\d{1,4}\|\d{1,4}\)?\s*$/u, '')
    .trim();

const validateVillageName = (villageNameRaw) => {
  const villageName = normalizeVillageName(stripVillageCoordinateSuffix(villageNameRaw));
  if (!villageName) {
    throw new GameRuleError("Pole 'name' je povinne.", 400);
  }
  if (villageName.length > 14) {
    throw new GameRuleError('Nazev lena muze mit maximalne 14 znaku (bez souradnic).', 400);
  }
  if (!/^[\p{L}\p{N}\s_.!?-]+$/u.test(villageName)) {
    throw new GameRuleError('Nazev lena obsahuje nepovolene znaky.', 400);
  }
  return villageName;
};

const resolveWorldById = (worldIdRaw) => {
  const worldId = String(worldIdRaw ?? '').trim();
  if (!worldId) {
    return WORLD_CATALOG.find((world) => world.id === DEFAULT_WORLD_ID) ?? WORLD_CATALOG[0] ?? null;
  }
  const selectedWorld = WORLD_CATALOG.find((world) => world.id === worldId) ?? null;
  if (!selectedWorld) {
    throw new GameRuleError(`Svet '${worldId}' nebyl nalezen.`, 404);
  }
  return selectedWorld;
};

const resolveWorldByRegion = (regionRaw) => {
  const region = Number(regionRaw);
  if (!Number.isFinite(region)) {
    return null;
  }
  return WORLD_CATALOG.find((world) => Number(world.region) === region) ?? null;
};

const resolveRegionDefinition = (regionRaw) => {
  const region = Number(regionRaw);
  const definition = WORLD_REGION_BY_ID.get(region);
  if (!definition) {
    throw new GameRuleError(`Region '${region}' neni nakonfigurovan.`, 500);
  }
  return definition;
};

const resolveWorldRegionDefinition = (world) => resolveRegionDefinition(world?.region);

const buildInactiveDeveloperResourceBoost = (world = null) => ({
  isActive: false,
  source: 'developer-apology',
  worldId: world?.id ? String(world.id) : null,
  reason: null,
  label: null,
  bonusPercent: 0,
  multiplier: 1,
  startsAt: null,
  endsAt: null,
  remainingSec: 0,
});

const resolveDeveloperResourceBoostForWorld = (world, referenceMs = Date.now()) => {
  if (!world || String(world.id) !== String(DOMINION_FIRE_RESOURCE_BOOST.worldId)) {
    return buildInactiveDeveloperResourceBoost(world);
  }

  const startsAtMs = Date.parse(String(DOMINION_FIRE_RESOURCE_BOOST.startsAtIso));
  const durationDays = Math.max(0, Number(DOMINION_FIRE_RESOURCE_BOOST.durationDays ?? 0));
  const bonusPercent = Math.max(0, Number(DOMINION_FIRE_RESOURCE_BOOST.bonusPercent ?? 0));
  if (!Number.isFinite(startsAtMs) || durationDays <= 0 || bonusPercent <= 0) {
    return buildInactiveDeveloperResourceBoost(world);
  }

  const endsAtMs = startsAtMs + durationDays * DAY_IN_MS;
  const nowMs = Number(referenceMs);
  const isActive = Number.isFinite(nowMs) && nowMs >= startsAtMs && nowMs < endsAtMs;
  const multiplier = isActive ? 1 + bonusPercent / 100 : 1;
  const remainingSec = isActive ? Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000)) : 0;
  const startsAt = new Date(startsAtMs).toISOString();
  const endsAt = new Date(endsAtMs).toISOString();

  return {
    isActive,
    source: 'developer-apology',
    worldId: String(world.id),
    reason: String(DOMINION_FIRE_RESOURCE_BOOST.reason),
    label: `game boost: +${Math.round(bonusPercent)}%`,
    bonusPercent: Math.round(bonusPercent),
    multiplier,
    startsAt,
    endsAt,
    remainingSec,
  };
};

const applyProductionMultiplier = (production, multiplierRaw = 1) => {
  const multiplier = Number(multiplierRaw);
  if (!Number.isFinite(multiplier) || multiplier <= 0 || Math.abs(multiplier - 1) < 0.000001) {
    return production;
  }

  return {
    ...production,
    wood: Number(production.wood) * multiplier,
    stone: Number(production.stone) * multiplier,
    iron: Number(production.iron) * multiplier,
    gold: Number(production.gold ?? 0) * multiplier,
  };
};

const isNightModeAtTime = (timeIso) => {
  const timestamp = Date.parse(String(timeIso ?? ''));
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  return hour >= NIGHT_MODE_START_HOUR && hour < NIGHT_MODE_END_HOUR;
};

const getResearchDefinition = (researchId) => RESEARCH_DEF_BY_ID.get(String(researchId ?? '')) ?? null;

const getResearchProgressPointsRequired = (researchDef) =>
  Math.max(1, Math.floor(Number(researchDef?.coinCost ?? 0)) * 6);

const ensureResearchRowsForPlayerRegion = (playerId, region, updatedAtIso = nowIso()) => {
  for (const definition of RESEARCH_DEFS) {
    const existing = selectResearchProgressByPlayerRegionAndResearchStmt.get(
      Number(playerId),
      Number(region),
      String(definition.id),
    );
    if (existing) {
      continue;
    }
    upsertResearchProgressStmt.run(
      Number(playerId),
      Number(region),
      String(definition.id),
      'locked',
      0,
      0,
      null,
      null,
      String(updatedAtIso),
    );
  }
};

const buildCompletedResearchSet = (researchRows) =>
  new Set(
    (Array.isArray(researchRows) ? researchRows : [])
      .filter((row) => String(row?.status ?? '') === 'completed')
      .map((row) => String(row?.researchId ?? ''))
      .filter((researchId) => researchId.length > 0),
  );

const isResearchCompleted = (researchRows, researchId) =>
  buildCompletedResearchSet(researchRows).has(String(researchId ?? ''));

const getVillageUniversityCapacity = (buildingLevels) =>
  Math.max(0, Math.min(3, Math.floor(Number(buildingLevels?.university ?? 0))));

const getMercenaryCooldownRemainingSec = (contractRow, referenceIso = nowIso()) => {
  if (!contractRow?.orderedAt) {
    return 0;
  }
  const orderedAtMs = Date.parse(String(contractRow.orderedAt));
  const referenceMs = Date.parse(String(referenceIso));
  if (!Number.isFinite(orderedAtMs) || !Number.isFinite(referenceMs)) {
    return 0;
  }
  const cooldownMs = MERCENARY_CONTRACT_COOLDOWN_HOURS * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((orderedAtMs + cooldownMs - referenceMs) / 1000));
};

const resolveResearchStatusForDefinition = (definition, progressRow, completedIds) => {
  const rowStatus = String(progressRow?.status ?? '');
  if (rowStatus === 'completed') {
    return 'completed';
  }
  if (rowStatus === 'researching') {
    return 'researching';
  }
  const prerequisitesMet = definition.requiredResearchIds.every((researchId) => completedIds.has(String(researchId)));
  return prerequisitesMet ? 'available' : 'locked';
};

const ensureResolvedResearchProgressForPlayerRegion = (playerId, region, updatedAtIso = nowIso()) =>
  resolveResearchProgressForPlayerRegion(playerId, region, updatedAtIso, { persist: true });

const buildResearchViewModel = (researchRows, options = {}) => {
  const playerId = Number(options?.playerId ?? 0);
  const region = Number(options?.region ?? 0);
  const snapshotIso = String(options?.snapshotIso ?? nowIso());
  const hasRuntimeContext = Number.isFinite(playerId) && playerId > 0 && Number.isFinite(region) && region > 0;
  const maxUniversityLevel = hasRuntimeContext
    ? Math.max(
        0,
        Math.floor(Number(selectMaxUniversityLevelByPlayerAndRegionStmt.get(Number(playerId), Number(region))?.maxLevel ?? 0)),
      )
    : 0;
  const rowsById = new Map((Array.isArray(researchRows) ? researchRows : []).map((row) => [String(row.researchId), row]));
  const completedIds = buildCompletedResearchSet(researchRows);

  return RESEARCH_DEFS.map((definition) => {
    const row = rowsById.get(String(definition.id)) ?? null;
    const status = resolveResearchStatusForDefinition(definition, row, completedIds);
    const progressPoints = Math.max(0, Number(row?.progress ?? 0));
    const requiredPoints = getResearchProgressPointsRequired(definition);
    const percent = requiredPoints <= 0 ? 100 : Math.max(0, Math.min(100, (progressPoints / requiredPoints) * 100));
    const assignedAcademics =
      status === 'researching' && hasRuntimeContext
        ? Math.max(
            0,
            Math.floor(
              Number(
                countAssignedAcademicsForResearchByPlayerRegionStmt.get(
                  Number(playerId),
                  Number(region),
                  String(definition.id),
                )?.total ?? 0,
              ),
            ),
          )
        : status === 'researching'
          ? Math.max(0, Math.floor(Number(row?.assignedAcademics ?? 0)))
          : 0;
    const speedMultiplier =
      status === 'researching' ? calculateResearchSpeedMultiplier(assignedAcademics, maxUniversityLevel) : 0;
    const progressPerHour = speedMultiplier > 0 ? Number((120 * speedMultiplier).toFixed(2)) : 0;
    const remainingPoints = Math.max(0, requiredPoints - progressPoints);
    const remainingSec =
      status === 'researching' && progressPerHour > 0
        ? Math.max(0, Math.ceil((remainingPoints / progressPerHour) * 3600))
        : null;
    const estimatedCompletionAt =
      remainingSec == null
        ? null
        : new Date(Date.parse(snapshotIso) + Math.max(0, remainingSec) * 1000).toISOString();
    const assignedVillageBreakdown =
      status === 'researching' && hasRuntimeContext
        ? selectAssignedResearchAcademicsByVillageForPlayerRegionStmt
            .all(Number(playerId), Number(region), String(definition.id))
            .map((entry) => ({
              villageId: Number(entry.villageId),
              villageName: String(entry.villageName ?? ''),
              coordX: Number(entry.coordX),
              coordY: Number(entry.coordY),
              universityLevel: Math.max(0, Math.floor(Number(entry.universityLevel ?? 0))),
              assignedAcademics: Math.max(0, Math.floor(Number(entry.assignedAcademics ?? 0))),
            }))
        : [];
    return {
      id: String(definition.id),
      name: String(definition.name),
      description: String(definition.description),
      coinCost: Math.max(0, Number(definition.coinCost ?? 0)),
      unlocks: String(definition.unlocks ?? ''),
      requiredResearchIds: [...definition.requiredResearchIds],
      status,
      progressPoints: Number(progressPoints.toFixed(2)),
      requiredPoints,
      progressPercent: Number(percent.toFixed(2)),
      assignedAcademics,
      progressPerHour,
      remainingSec,
      estimatedCompletionAt,
      assignedVillageBreakdown,
      startedAt: row?.startedAt ? String(row.startedAt) : null,
      completedAt: row?.completedAt ? String(row.completedAt) : null,
    };
  });
};

const calculateResearchSpeedMultiplier = (assignedAcademicsRaw, universityLevelRaw) => {
  const assignedAcademics = Math.max(0, Math.floor(Number(assignedAcademicsRaw ?? 0)));
  if (assignedAcademics <= 0) {
    return 0;
  }
  const baseMultiplier =
    assignedAcademics >= 3
      ? 3.3
      : assignedAcademics === 2
        ? 2.1
        : 1;
  const universityLevel = Math.max(0, Math.floor(Number(universityLevelRaw ?? 0)));
  return baseMultiplier * (1 + universityLevel * 0.05);
};

const randomIntInclusive = (minRaw, maxRaw) => {
  const min = Math.floor(Number(minRaw));
  const max = Math.floor(Number(maxRaw));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const normalizeSpawnDistanceRange = (
  minRaw,
  maxRaw,
  fallbackMin = DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN,
  fallbackMax = DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX,
) => {
  const parsedMin = Math.max(0, Math.floor(Number(minRaw)));
  const parsedMax = Math.max(0, Math.floor(Number(maxRaw)));
  const safeFallbackMin = Math.max(0, Math.floor(Number(fallbackMin)));
  const safeFallbackMax = Math.max(safeFallbackMin, Math.floor(Number(fallbackMax)));

  let minDistance = Number.isFinite(parsedMin) ? parsedMin : safeFallbackMin;
  let maxDistance = Number.isFinite(parsedMax) ? parsedMax : safeFallbackMax;
  if (maxDistance < minDistance) {
    [minDistance, maxDistance] = [maxDistance, minDistance];
  }
  return {
    minDistance: Math.max(0, minDistance),
    maxDistance: Math.max(0, maxDistance),
  };
};

const resolveWorldSpawnConfig = (world) => ({
  playerTemplateType: String(world?.spawn?.playerTemplateType ?? 'default-player'),
  abandonedTemplateType: String(world?.spawn?.abandonedTemplateType ?? 'default-abandoned'),
  nearbyAbandonedCount: Math.max(0, Math.floor(Number(world?.spawn?.nearbyAbandonedCount ?? 0))),
  playerProtectionDays: Math.max(0, Number(world?.spawn?.playerProtectionDays ?? 0)),
  ...(() => {
    const playerRange = normalizeSpawnDistanceRange(
      world?.spawn?.playerSpawnMinDistanceMin,
      world?.spawn?.playerSpawnMinDistanceMax,
      DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN,
      DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX,
    );
    const nearbyRange = normalizeSpawnDistanceRange(
      world?.spawn?.nearbySpawnMinDistance,
      world?.spawn?.nearbySpawnMaxDistance,
      DEFAULT_NEARBY_SPAWN_MIN_DISTANCE,
      DEFAULT_NEARBY_SPAWN_MAX_DISTANCE,
    );
    return {
      playerSpawnMinDistanceMin: playerRange.minDistance,
      playerSpawnMinDistanceMax: playerRange.maxDistance,
      nearbySpawnMinDistance: nearbyRange.minDistance,
      nearbySpawnMaxDistance: nearbyRange.maxDistance,
    };
  })(),
});

const listWorldCatalog = () =>
  WORLD_CATALOG.map((world) => ({
    id: String(world.id),
    name: String(world.name),
    subtitle: String(world.subtitle),
    status: String(world.status),
    region: Number(world.region),
    regionSize: Number(world.regionSize),
    seasonLabel: String(world.seasonLabel),
    timelineLabel: String(world.timelineLabel),
    description: String(world.description),
    isDefault: String(world.id) === DEFAULT_WORLD_ID,
  }));

const validateRegistrationUsername = (usernameRaw) => {
  const username = normalizeUsername(usernameRaw);
  if (username.length < 3) {
    throw new GameRuleError('Herni nick musi mit alespon 3 znaky.', 400);
  }
  if (username.length > 20) {
    throw new GameRuleError('Herni nick muze mit maximalne 20 znaku.', 400);
  }
  if (!/^[\p{L}\p{N}_.*!?-]+$/u.test(username)) {
    throw new GameRuleError('Herni nick obsahuje nepovolene znaky.', 400);
  }
  if (normalizeUsernameComparable(username).startsWith(ABANDONED_BOT_USERNAME_PREFIX)) {
    throw new GameRuleError('Tento herni nick neni povolen.', 400);
  }
  return username;
};

const validateRegistrationPassword = (passwordRaw) => {
  const password = String(passwordRaw ?? '').trim();
  if (password.length < 3) {
    throw new GameRuleError('Heslo musi mit alespon 3 znaky.', 400);
  }
  if (password.length > 128) {
    throw new GameRuleError('Heslo muze mit maximalne 128 znaku.', 400);
  }
  return password;
};

const parseJsonSafe = (value, fallback = {}) => {
  if (value == null || value === '') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const isSqliteUniqueConstraintError = (error) => {
  const message = error instanceof Error ? String(error.message ?? '') : String(error ?? '');
  return message.includes('UNIQUE constraint failed');
};

const normalizeNotificationSeverity = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'success' || normalized === 'warning' || normalized === 'critical') {
    return normalized;
  }
  return 'info';
};

const toNotificationItem = (row) => ({
  id: Number(row.id),
  playerId: Number(row.playerId),
  region: Number(row.region),
  category: String(row.category),
  eventType: String(row.eventType),
  severity: normalizeNotificationSeverity(row.severity),
  title: String(row.title),
  summary: String(row.summary),
  payload: parseJsonSafe(row.payloadJson, {}),
  sourceType: row.sourceType == null ? null : String(row.sourceType),
  sourceId: row.sourceId == null ? null : Number(row.sourceId),
  createdAt: String(row.createdAt),
  readAt: row.readAt == null ? null : String(row.readAt),
  archivedAt: row.archivedAt == null ? null : String(row.archivedAt),
});

const createPlayerNotification = ({
  playerId,
  region,
  category,
  eventType,
  severity = 'info',
  title,
  summary,
  payload = null,
  sourceType = null,
  sourceId = null,
  createdAt = null,
}) => {
  const numericPlayerId = Number(playerId);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    return null;
  }
  const numericRegion = Number(region);
  if (!Number.isFinite(numericRegion) || numericRegion <= 0) {
    return null;
  }

  try {
    const result = insertPlayerNotificationStmt.run(
      numericPlayerId,
      numericRegion,
      String(category ?? 'system'),
      String(eventType ?? 'unknown'),
      normalizeNotificationSeverity(severity),
      String(title ?? '').trim() || 'Událost',
      String(summary ?? '').trim() || 'Byla zaznamenána herní událost.',
      payload == null ? null : JSON.stringify(payload),
      sourceType == null ? null : String(sourceType),
      sourceId == null ? null : Number(sourceId),
      createdAt == null ? nowIso() : String(createdAt),
    );
    return Number(result.lastInsertRowid);
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
};

const ensureRelease0107Notification = (playerId, region) => {
  const numericPlayerId = Number(playerId);
  const numericRegion = Number(region);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    return;
  }
  if (!Number.isFinite(numericRegion) || numericRegion <= 0) {
    return;
  }

  createPlayerNotification({
    playerId: numericPlayerId,
    region: numericRegion,
    category: 'system',
    eventType: 'developer_update',
    severity: 'info',
    title: RELEASE_0107_NOTIFICATION.title,
    summary: RELEASE_0107_NOTIFICATION.summary,
    payload: {
      source: 'developer',
      version: RELEASE_0107_NOTIFICATION.versionLabel,
      kind: 'release-notes',
    },
    sourceType: RELEASE_0107_NOTIFICATION.sourceType,
    sourceId: RELEASE_0107_NOTIFICATION.sourceIdBase + numericRegion,
    createdAt: RELEASE_0107_NOTIFICATION.publishedAt,
  });
};

const pruneOldPlayerNotifications = (nowMs = Date.now()) => {
  const cutoffMs = nowMs - PLAYER_NOTIFICATION_RETENTION_DAYS * DAY_IN_MS;
  const cutoffIso = new Date(cutoffMs).toISOString();
  return Number(pruneOldPlayerNotificationsStmt.run(cutoffIso).changes ?? 0);
};

const createKingdomEvent = ({
  region,
  kingdom = null,
  eventType,
  actorPlayerId = null,
  targetPlayerId = null,
  payload = null,
}) =>
  // Region is mandatory to prevent cross-world kingdom audit mixing.
  insertKingdomEventStmt.run(
    Number(region),
    kingdom == null ? null : String(kingdom),
    String(eventType),
    actorPlayerId == null ? null : Number(actorPlayerId),
    targetPlayerId == null ? null : Number(targetPlayerId),
    payload == null ? null : JSON.stringify(payload),
    nowIso(),
  );

const buildKingdomAuditLog = (playerId, region, kingdomName) => {
  const rows =
    kingdomName && !isNeutralKingdom(kingdomName)
      ? selectKingdomEventsByKingdomStmt.all(Number(region), String(kingdomName), 30)
      : selectKingdomEventsByPlayerStmt.all(Number(region), Number(playerId), Number(playerId), 30);

  return rows.map((row) => {
    const payload = parseJsonSafe(row.payloadJson, {});
    const actorUsername = row.actorUsername ? String(row.actorUsername) : 'Neznámý hráč';
    const targetUsername = row.targetUsername ? String(row.targetUsername) : 'Neznámý hráč';
    const eventKingdom = row.kingdom ? String(row.kingdom) : null;
    let message = 'Neznámá královská událost.';

    if (row.eventType === 'kingdom_created') {
      message = `${actorUsername} založil království ${eventKingdom ?? 'bez názvu'}.`;
    } else if (row.eventType === 'invite_sent') {
      message = `${actorUsername} poslal pozvánku hráči ${targetUsername}.`;
    } else if (row.eventType === 'invite_accepted') {
      message = `${actorUsername} přijal pozvánku do království ${eventKingdom ?? 'bez názvu'}.`;
    } else if (row.eventType === 'invite_rejected') {
      message = `${actorUsername} odmítl pozvánku do království ${eventKingdom ?? 'bez názvu'}.`;
    } else if (row.eventType === 'member_left') {
      message = `${actorUsername} opustil království ${eventKingdom ?? 'bez názvu'}.`;
    } else if (row.eventType === 'member_kicked') {
      message = `${actorUsername} vyhodil hráče ${targetUsername} z království.`;
    } else if (row.eventType === 'leadership_transferred') {
      message = `${actorUsername} předal titul Krále hráči ${targetUsername}.`;
    } else if (typeof payload.message === 'string' && payload.message.trim()) {
      message = payload.message.trim();
    }

    return {
      id: Number(row.id),
      kingdom: eventKingdom,
      eventType: String(row.eventType),
      createdAt: String(row.createdAt),
      actorUsername,
      targetUsername: row.targetUsername == null ? null : targetUsername,
      message,
    };
  });
};

const resolvePrimaryKingdomByPlayerId = (playerId, region) => {
  const row = selectPrimaryKingdomByPlayerAndRegionStmt.get(Number(playerId), Number(region));
  return normalizeKingdomValue(row?.kingdom || 'Neutral') || 'Neutral';
};

const resolveKingdomLeader = (kingdomName, region) => {
  if (isNeutralKingdom(kingdomName)) {
    return null;
  }
  const transferRow = selectLatestKingdomLeadershipTransferStmt.get(Number(region), String(kingdomName));
  if (transferRow?.payloadJson) {
    const transferPayload = parseJsonSafe(transferRow.payloadJson, {});
    const transferredLeaderPlayerId = Number(transferPayload?.newLeaderPlayerId ?? 0);
    if (Number.isFinite(transferredLeaderPlayerId) && transferredLeaderPlayerId > 0) {
      const transferredLeaderKingdom = resolvePrimaryKingdomByPlayerId(transferredLeaderPlayerId, Number(region));
      if (normalizeKingdomComparable(transferredLeaderKingdom) === normalizeKingdomComparable(kingdomName)) {
        const transferredLeader = selectPlayerByIdStmt.get(transferredLeaderPlayerId);
        if (transferredLeader?.username) {
          return {
            playerId: transferredLeaderPlayerId,
            username: String(transferredLeader.username),
          };
        }
      }
    }
  }
  const row = selectKingdomLeaderByKingdomStmt.get(String(kingdomName), Number(region));
  if (!row) {
    return null;
  }
  return {
    playerId: Number(row.playerId),
    username: String(row.username),
  };
};

const listKingdomMembers = (kingdomName, region, leaderPlayerId = null) => {
  if (isNeutralKingdom(kingdomName)) {
    return [];
  }
  return selectKingdomMembersByKingdomStmt.all(String(kingdomName), Number(region)).map((member) => ({
    playerId: Number(member.playerId),
    username: String(member.username),
    villages: Number(member.villageCount),
    prestige: Number(member.prestige),
    isLeader: leaderPlayerId != null && Number(member.playerId) === Number(leaderPlayerId),
  }));
};

const listAvailableKingdoms = (region) =>
  selectKingdomOverviewRowsStmt
    .all(Number(region))
    .map((row) => ({
      kingdom: String(row.kingdom),
      villages: Number(row.villages),
      members: Number(row.members),
      prestige: Number(row.prestige),
    }))
    .filter((row) => !isNeutralKingdom(row.kingdom));

const listIncomingKingdomInvites = (playerId, region) =>
  selectIncomingKingdomInvitesByTargetStmt.all(Number(playerId), Number(region)).map((invite) => ({
    id: Number(invite.id),
    kingdom: String(invite.kingdom),
    inviterUsername: String(invite.inviterUsername),
    createdAt: String(invite.createdAt),
  }));

const listKingdomInviteCandidates = (viewerUsername, region) => {
  const pendingInviteTargetIds = new Set(
    selectPendingKingdomInviteTargetIdsStmt
      .all(Number(region))
      .map((row) => Number(row.targetPlayerId))
      .filter((playerId) => Number.isFinite(playerId) && playerId > 0),
  );

  return selectLeaderboardByRegionStmt
    .all(Number(region))
    .filter((row) => {
      if (String(row.username) === String(viewerUsername)) {
        return false;
      }
      if (!isNeutralKingdom(row.kingdom)) {
        return false;
      }

      const playerKingdomRows = selectDistinctVillageKingdomsByPlayerStmt.all(Number(row.playerId), Number(region));
      const hasNonNeutralVillageKingdom = playerKingdomRows.some((kingdomRow) =>
        !isNeutralKingdom(kingdomRow.kingdom),
      );
      if (hasNonNeutralVillageKingdom) {
        return false;
      }

      return !pendingInviteTargetIds.has(Number(row.playerId));
    })
    .map((row) => ({
      playerId: Number(row.playerId),
      username: String(row.username),
      villages: Number(row.villageCount),
      prestige: Number(row.prestige),
    }));
};

const buildKingdomHubState = (player, village) => {
  const playerId = Number(player.id);
  const region = Number(village.region);
  const kingdomNameRaw = normalizeKingdomValue(village.kingdom);
  const isMember = !isNeutralKingdom(kingdomNameRaw);
  const kingdomName = isMember ? kingdomNameRaw : null;
  const leader = kingdomName ? resolveKingdomLeader(kingdomName, region) : null;
  const canManageInvites = leader != null && Number(leader.playerId) === playerId;
  const members = kingdomName ? listKingdomMembers(kingdomName, region, leader?.playerId ?? null) : [];
  const inviteCandidates = canManageInvites ? listKingdomInviteCandidates(player.username, region) : [];
  const incomingInvites = listIncomingKingdomInvites(playerId, region);
  const auditLog = buildKingdomAuditLog(playerId, region, kingdomName);

  return {
    isMember,
    kingdom: kingdomName,
    leaderUsername: leader?.username ?? null,
    canManageInvites,
    members,
    inviteCandidates,
    incomingInvites,
    availableKingdoms: listAvailableKingdoms(region),
    auditLog,
  };
};

const sanitizeBuildingLevel = (buildingId, level) =>
  Math.max(
    0,
    Math.min(
      getMaxBuildingLevel(buildingId),
      Number.isFinite(Number(level)) ? Math.floor(Number(level)) : 0,
    ),
  );

const sanitizeUnitAmount = (value) => Math.max(0, Math.floor(Number(value ?? 0)));

const toCoordinateKey = (coordX, coordY) => `${coordX}|${coordY}`;
const SPAWN_DIRECTIONS = new Set(['center', 'north', 'east', 'south', 'west']);

const normalizeSpawnDirection = (valueRaw) => {
  const normalized = String(valueRaw ?? '')
    .trim()
    .toLowerCase();
  return SPAWN_DIRECTIONS.has(normalized) ? normalized : 'center';
};

const buildSpawnContext = (world) => {
  const region = resolveWorldRegionDefinition(world);
  const occupiedCoords = selectVillageCoordsByRegionStmt
    .all(Number(region.id))
    .map((row) => ({
      coordX: Number(row.coordX),
      coordY: Number(row.coordY),
    }))
    .filter((coord) => Number.isFinite(coord.coordX) && Number.isFinite(coord.coordY));

  return {
    world,
    region,
    occupiedCoords,
    occupiedKeys: new Set(occupiedCoords.map((coord) => toCoordinateKey(coord.coordX, coord.coordY))),
  };
};

const calculateNearestChebyshevDistance = (coordX, coordY, occupiedCoords) => {
  if (!Array.isArray(occupiedCoords) || occupiedCoords.length <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const occupied of occupiedCoords) {
    const distance = Math.max(Math.abs(coordX - occupied.coordX), Math.abs(coordY - occupied.coordY));
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }
  return nearestDistance;
};

const calculateSpawnScore = (
  coordX,
  coordY,
  occupiedCoords,
  region,
  preferredDirectionRaw = 'center',
  scoreDistanceCoords = null,
) => {
  const centerX = Number(region.originX) + (Number(region.size) - 1) / 2;
  const centerY = Number(region.originY) + (Number(region.size) - 1) / 2;
  const chebyshevFromCenter = Math.max(Math.abs(coordX - centerX), Math.abs(coordY - centerY));
  const manhattanFromCenter = Math.abs(coordX - centerX) + Math.abs(coordY - centerY);
  const preferredDirection = normalizeSpawnDirection(preferredDirectionRaw);
  const scoreDistanceSource = Array.isArray(scoreDistanceCoords) ? scoreDistanceCoords : occupiedCoords;

  let directionalBias = 0;
  if (preferredDirection === 'north') {
    directionalBias = centerY - coordY;
  } else if (preferredDirection === 'south') {
    directionalBias = coordY - centerY;
  } else if (preferredDirection === 'west') {
    directionalBias = centerX - coordX;
  } else if (preferredDirection === 'east') {
    directionalBias = coordX - centerX;
  }

  let nearestDistance = Number(region.size);
  if (scoreDistanceSource.length > 0) {
    nearestDistance = Number.POSITIVE_INFINITY;
    for (const occupied of scoreDistanceSource) {
      const distance = Math.max(Math.abs(coordX - occupied.coordX), Math.abs(coordY - occupied.coordY));
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (!Number.isFinite(nearestDistance)) {
      nearestDistance = Number(region.size);
    }
  }

  // Nejprve plníme střed mapy směrem ven do prstenců. V rámci stejného prstence
  // použijeme preferovanou světovou stranu a drobný rozptyl podle nejbližší obsazené buňky.
  return -chebyshevFromCenter * 1_000_000 + directionalBias * 10_000 + nearestDistance * 100 - manhattanFromCenter;
};

const claimBestSpawnCell = (spawnContext, preferredDirectionRaw = 'center', options = null) => {
  const region = spawnContext.region;
  let best = null;
  const preferredDirection = normalizeSpawnDirection(preferredDirectionRaw);
  const minDistance = Math.max(0, Math.floor(Number(options?.minDistance ?? 0)));
  const minDistanceCoords = Array.isArray(options?.minDistanceCoords)
    ? options.minDistanceCoords
    : spawnContext.occupiedCoords;
  const scoreDistanceCoords = Array.isArray(options?.scoreDistanceCoords)
    ? options.scoreDistanceCoords
    : spawnContext.occupiedCoords;
  for (let localY = 1; localY <= Number(region.size); localY += 1) {
    for (let localX = 1; localX <= Number(region.size); localX += 1) {
      const coordX = Number(region.originX) + localX - 1;
      const coordY = Number(region.originY) + localY - 1;
      const key = toCoordinateKey(coordX, coordY);
      if (spawnContext.occupiedKeys.has(key)) {
        continue;
      }
      if (minDistance > 0) {
        const nearestDistance = calculateNearestChebyshevDistance(coordX, coordY, minDistanceCoords);
        if (nearestDistance < minDistance) {
          continue;
        }
      }

      const score = calculateSpawnScore(
        coordX,
        coordY,
        spawnContext.occupiedCoords,
        region,
        preferredDirection,
        scoreDistanceCoords,
      );
      if (!best || score > best.score) {
        best = { localX, localY, coordX, coordY, key, score };
      }
    }
  }

  if (!best) {
    return null;
  }

  spawnContext.occupiedKeys.add(best.key);
  spawnContext.occupiedCoords.push({
    coordX: best.coordX,
    coordY: best.coordY,
  });
  return best;
};

const claimNearbySpawnCells = (spawnContext, originCoordXRaw, originCoordYRaw, countRaw, options = null) => {
  const region = spawnContext.region;
  const originCoordX = Number(originCoordXRaw);
  const originCoordY = Number(originCoordYRaw);
  const count = Math.max(0, Math.floor(Number(countRaw ?? 0)));
  const spawnRange = normalizeSpawnDistanceRange(
    options?.minDistance,
    options?.maxDistance,
    DEFAULT_NEARBY_SPAWN_MIN_DISTANCE,
    DEFAULT_NEARBY_SPAWN_MAX_DISTANCE,
  );
  const minDistance = spawnRange.minDistance;
  const maxDistance = spawnRange.maxDistance;
  if (!Number.isFinite(originCoordX) || !Number.isFinite(originCoordY) || count <= 0) {
    return [];
  }

  const candidates = [];
  for (let localY = 1; localY <= Number(region.size); localY += 1) {
    for (let localX = 1; localX <= Number(region.size); localX += 1) {
      const coordX = Number(region.originX) + localX - 1;
      const coordY = Number(region.originY) + localY - 1;
      const key = toCoordinateKey(coordX, coordY);
      if (spawnContext.occupiedKeys.has(key)) {
        continue;
      }
      const chebyshevDistance = Math.max(Math.abs(coordX - originCoordX), Math.abs(coordY - originCoordY));
      const manhattanDistance = Math.abs(coordX - originCoordX) + Math.abs(coordY - originCoordY);
      candidates.push({
        localX,
        localY,
        coordX,
        coordY,
        key,
        chebyshevDistance,
        manhattanDistance,
      });
    }
  }

  const remainingCandidates = [...candidates];
  const selected = [];
  while (selected.length < count && remainingCandidates.length > 0) {
    const preferredDistance = randomIntInclusive(minDistance, maxDistance);
    const preferredIndexes = [];
    for (let index = 0; index < remainingCandidates.length; index += 1) {
      if (remainingCandidates[index].chebyshevDistance === preferredDistance) {
        preferredIndexes.push(index);
      }
    }

    let chosenIndex = null;
    if (preferredIndexes.length > 0) {
      chosenIndex = preferredIndexes[randomIntInclusive(0, preferredIndexes.length - 1)];
    } else {
      const inRangeIndexes = [];
      for (let index = 0; index < remainingCandidates.length; index += 1) {
        const distance = remainingCandidates[index].chebyshevDistance;
        if (distance >= minDistance && distance <= maxDistance) {
          inRangeIndexes.push(index);
        }
      }
      if (inRangeIndexes.length > 0) {
        chosenIndex = inRangeIndexes[randomIntInclusive(0, inRangeIndexes.length - 1)];
      }
    }

    if (chosenIndex == null) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of remainingCandidates) {
        nearestDistance = Math.min(nearestDistance, Number(candidate.chebyshevDistance));
      }
      const nearestIndexes = [];
      for (let index = 0; index < remainingCandidates.length; index += 1) {
        if (remainingCandidates[index].chebyshevDistance === nearestDistance) {
          nearestIndexes.push(index);
        }
      }
      if (nearestIndexes.length > 0) {
        chosenIndex = nearestIndexes[randomIntInclusive(0, nearestIndexes.length - 1)];
      } else {
        chosenIndex = 0;
      }
    }

    const [candidate] = remainingCandidates.splice(chosenIndex, 1);
    if (!candidate) {
      continue;
    }
    spawnContext.occupiedKeys.add(candidate.key);
    spawnContext.occupiedCoords.push({
      coordX: candidate.coordX,
      coordY: candidate.coordY,
    });
    selected.push(candidate);
  }
  return selected;
};

const createAbandonedBotSerialAllocator = () => {
  const usedSerials = new Set(
    selectAbandonedBotUsernamesStmt
      .all(`${ABANDONED_BOT_USERNAME_PREFIX}*`)
      .map((row) => {
        const match = String(row.username ?? '').match(/(\d+)$/);
        return match ? Number(match[1]) : Number.NaN;
      })
      .filter((serial) => Number.isFinite(serial) && serial > 0),
  );
  let nextSerial = 1;
  return () => {
    while (usedSerials.has(nextSerial)) {
      nextSerial += 1;
    }
    const allocatedSerial = nextSerial;
    usedSerials.add(allocatedSerial);
    nextSerial += 1;
    return allocatedSerial;
  };
};

const toBuildingTemplateMap = (source) => {
  const template = {};
  for (const buildingId of BUILDING_ORDER) {
    template[buildingId] = sanitizeBuildingLevel(buildingId, source?.[buildingId] ?? 0);
  }
  return template;
};

const toUnitTemplateMap = (source) => {
  const template = {};
  for (const unitId of UNIT_ORDER) {
    template[unitId] = sanitizeUnitAmount(source?.[unitId] ?? 0);
  }
  return template;
};

const PLAYER_VILLAGE_TEMPLATE = {
  resources: STARTING_RESOURCES,
  buildings: toBuildingTemplateMap(STARTING_PLAYER_BUILDING_LEVELS),
  units: toUnitTemplateMap(STARTING_PLAYER_UNITS),
};

const ABANDONED_VILLAGE_TEMPLATE = {
  resources: STARTING_RESOURCES,
  buildings: toBuildingTemplateMap(STARTING_ABANDONED_BUILDING_LEVELS),
  units: toUnitTemplateMap(STARTING_ABANDONED_UNITS),
};

const FIRE_WORLD_VILLAGE_TEMPLATE = {
  resources: STARTING_RESOURCES,
  buildings: toBuildingTemplateMap(FIRE_WORLD_STARTING_BUILDING_LEVELS),
  units: toUnitTemplateMap(FIRE_WORLD_STARTING_UNITS),
};

const SPAWN_TEMPLATE_BY_TYPE = Object.freeze({
  'default-player': PLAYER_VILLAGE_TEMPLATE,
  'default-abandoned': ABANDONED_VILLAGE_TEMPLATE,
  'fire-world': FIRE_WORLD_VILLAGE_TEMPLATE,
});

const resolveTemplateByType = (templateType, fallbackTemplate) =>
  SPAWN_TEMPLATE_BY_TYPE[String(templateType ?? '')] ?? fallbackTemplate;

const applyVillageTemplate = (villageId, template) => {
  insertVillageGarrisonIfMissingStmt.run(
    Number(villageId),
    Number(GARRISON_UNIT_CAPS.militia ?? 0),
    Number(GARRISON_UNIT_CAPS.archer ?? 0),
    nowIso(),
  );

  const resourceTemplate = template?.resources ?? STARTING_RESOURCES;
  upsertVillageResourcesStmt.run(
    Number(villageId),
    roundResource(Number(resourceTemplate.wood ?? STARTING_RESOURCES.wood)),
    roundResource(Number(resourceTemplate.stone ?? STARTING_RESOURCES.stone)),
    roundResource(Number(resourceTemplate.iron ?? STARTING_RESOURCES.iron)),
    roundResource(Number(resourceTemplate.gold ?? STARTING_RESOURCES.gold)),
    roundResource(Number(resourceTemplate.coins ?? STARTING_RESOURCES.coins)),
    nowIso(),
  );

  const buildingTemplate = template?.buildings ?? {};
  for (const buildingId of BUILDING_ORDER) {
    upsertVillageBuildingLevelStmt.run(
      Number(villageId),
      buildingId,
      sanitizeBuildingLevel(buildingId, buildingTemplate[buildingId] ?? 0),
    );
  }

  const unitTemplate = template?.units ?? {};
  for (const unitId of UNIT_ORDER) {
    upsertVillageUnitAmountStmt.run(Number(villageId), unitId, sanitizeUnitAmount(unitTemplate[unitId] ?? 0));
  }

  updateVillagePrestigeFromCurrentState(Number(villageId));
};

const buildVillageProtectionUntil = (createdAtIso, protectionDaysRaw) => {
  const protectionDays = Math.max(0, Number(protectionDaysRaw ?? 0));
  if (protectionDays <= 0) {
    return null;
  }
  const createdAtMs = Date.parse(String(createdAtIso ?? nowIso()));
  const safeCreatedAtMs = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
  return new Date(safeCreatedAtMs + protectionDays * DAY_IN_MS).toISOString();
};

const createVillage = ({
  playerId,
  villageName,
  kingdom,
  template,
  world,
  spawnContext,
  createdAtIso,
  spawnCell = null,
  peaceUntil = null,
  playerSpawnMinDistance = 0,
  playerSpawnMinDistanceCoords = null,
  playerSpawnScoreCoords = null,
}) => {
  const resolvedWorld = world ? resolveWorldById(world.id) : resolveWorldById(DEFAULT_WORLD_ID);
  const activeSpawnContext = spawnContext ?? buildSpawnContext(resolvedWorld);
  const spawn = spawnCell
    ? spawnCell
    : claimBestSpawnCell(activeSpawnContext, 'center', {
        minDistance: playerSpawnMinDistance,
        minDistanceCoords: Array.isArray(playerSpawnMinDistanceCoords)
          ? playerSpawnMinDistanceCoords
          : activeSpawnContext.occupiedCoords,
        scoreDistanceCoords: Array.isArray(playerSpawnScoreCoords)
          ? playerSpawnScoreCoords
          : activeSpawnContext.occupiedCoords,
      });
  if (!spawn) {
    throw new GameRuleError('Ve svete neni volne misto pro nove leno.', 409);
  }

  const insertion = insertVillageForPlayerStmt.run(
    Number(playerId),
    String(villageName),
    String(kingdom ?? 'Neutral'),
    Number(spawn.coordX),
    Number(spawn.coordY),
    Number(resolvedWorld.region),
    peaceUntil == null ? null : String(peaceUntil),
    0,
    100,
    String(createdAtIso ?? nowIso()),
  );
  const villageId = Number(insertion.lastInsertRowid);
  applyVillageTemplate(villageId, template);
  return selectVillageByIdStmt.get(villageId);
};

const createFreshVillageForPlayer = ({
  playerId,
  username,
  world,
  templateType = 'default-player',
  protectionDays = 0,
  spawnContext = null,
  createdAtIso = nowIso(),
  spawnCell = null,
  playerSpawnMinDistance = null,
  playerSpawnMinDistanceCoords = null,
  playerSpawnScoreCoords = null,
}) => {
  const resolvedPlayerSpawnMinDistance =
    playerSpawnMinDistance == null
      ? randomIntInclusive(DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MIN, DEFAULT_PLAYER_SPAWN_MIN_DISTANCE_MAX)
      : Math.max(0, Math.floor(Number(playerSpawnMinDistance)));

  return createVillage({
    playerId,
    villageName: `${PLAYER_VILLAGE_NAME_PREFIX} ${String(username)}`,
    kingdom: 'Neutral',
    template: resolveTemplateByType(templateType, PLAYER_VILLAGE_TEMPLATE),
    world,
    spawnContext,
    createdAtIso,
    spawnCell,
    peaceUntil: buildVillageProtectionUntil(createdAtIso, protectionDays),
    playerSpawnMinDistance: resolvedPlayerSpawnMinDistance,
    playerSpawnMinDistanceCoords,
    playerSpawnScoreCoords,
  });
};

const convertVillageToAbandoned = ({ villageId, serialAllocator, createdAtIso = nowIso() }) => {
  const serial = Number(serialAllocator());
  const serialText = String(serial).padStart(2, '0');
  const botUsername = `${ABANDONED_BOT_USERNAME_PREFIX}${serialText}`;
  const botVillageName = `${ABANDONED_VILLAGE_NAME_PREFIX} ${serialText}`;
  const botInsertion = insertAbandonedBotPlayerStmt.run(botUsername, '', String(createdAtIso));
  const botPlayerId = Number(botInsertion.lastInsertRowid);

  updateVillageToAbandonedOwnerStmt.run(botPlayerId, botVillageName, Number(villageId));
  deleteInProgressUpgradesByVillageStmt.run(Number(villageId));
  deleteInProgressRecruitmentsByVillageStmt.run(Number(villageId));
  updateVillagePrestigeFromCurrentState(Number(villageId));

  return {
    villageId: Number(villageId),
    botPlayerId,
    botUsername,
    villageName: botVillageName,
  };
};

const createNearbyAbandonedVillagesAroundSpawn = ({
  world,
  spawnContext,
  centerCoordX,
  centerCoordY,
  count,
  templateType = 'default-abandoned',
  minDistance = DEFAULT_NEARBY_SPAWN_MIN_DISTANCE,
  maxDistance = DEFAULT_NEARBY_SPAWN_MAX_DISTANCE,
  createdAtIso = nowIso(),
}) => {
  const normalizedCount = Math.max(0, Math.floor(Number(count ?? 0)));
  if (normalizedCount <= 0) {
    return [];
  }

  const serialAllocator = createAbandonedBotSerialAllocator();
  const nearbyCells = claimNearbySpawnCells(
    spawnContext,
    Number(centerCoordX),
    Number(centerCoordY),
    normalizedCount,
    { minDistance, maxDistance },
  );
  const createdVillages = [];

  for (const spawnCell of nearbyCells) {
    const serial = Number(serialAllocator());
    const serialText = String(serial).padStart(2, '0');
    const botUsername = `${ABANDONED_BOT_USERNAME_PREFIX}${serialText}`;
    const botVillageName = `${ABANDONED_VILLAGE_NAME_PREFIX} ${serialText}`;
    const botInsertion = insertAbandonedBotPlayerStmt.run(botUsername, '', String(createdAtIso));
    const botPlayerId = Number(botInsertion.lastInsertRowid);
    const village = createVillage({
      playerId: botPlayerId,
      villageName: botVillageName,
      kingdom: 'Neutral',
      template: resolveTemplateByType(templateType, ABANDONED_VILLAGE_TEMPLATE),
      world,
      spawnContext,
      createdAtIso,
      spawnCell,
    });
    createdVillages.push(village);
  }

  return createdVillages;
};

const ensurePlayerHasVillageInWorldTransaction = db.transaction(
  (playerId, username, worldIdRaw, spawnDirectionRaw = 'center') => {
  const world = resolveWorldById(worldIdRaw);
  const villages = selectVillagesByPlayerAndRegionStmt.all(Number(playerId), Number(world.region));
  if (villages.length > 0) {
    return villages;
  }

  const spawnConfig = resolveWorldSpawnConfig(world);
  const spawnContext = buildSpawnContext(world);
  const playerSpawnMinDistance = randomIntInclusive(
    spawnConfig.playerSpawnMinDistanceMin,
    spawnConfig.playerSpawnMinDistanceMax,
  );
  const playerSpawnCell = claimBestSpawnCell(spawnContext, spawnDirectionRaw, {
    minDistance: playerSpawnMinDistance,
    minDistanceCoords: spawnContext.occupiedCoords,
    scoreDistanceCoords: spawnContext.occupiedCoords,
  });
  if (!playerSpawnCell) {
    throw new GameRuleError('Ve svete neni volne misto pro nove leno.', 409);
  }

  createFreshVillageForPlayer({
    playerId: Number(playerId),
    username: String(username),
    world,
    templateType: spawnConfig.playerTemplateType,
    protectionDays: spawnConfig.playerProtectionDays,
    spawnContext,
    spawnCell: playerSpawnCell,
    playerSpawnMinDistance,
    playerSpawnMinDistanceCoords: spawnContext.occupiedCoords,
    playerSpawnScoreCoords: spawnContext.occupiedCoords,
  });

  createNearbyAbandonedVillagesAroundSpawn({
    world,
    spawnContext,
    centerCoordX: Number(playerSpawnCell.coordX),
    centerCoordY: Number(playerSpawnCell.coordY),
    count: spawnConfig.nearbyAbandonedCount,
    templateType: spawnConfig.abandonedTemplateType,
    minDistance: spawnConfig.nearbySpawnMinDistance,
    maxDistance: spawnConfig.nearbySpawnMaxDistance,
  });

  return selectVillagesByPlayerAndRegionStmt.all(Number(playerId), Number(world.region));
  },
);

const createPlayerAccountTransaction = db.transaction((usernameRaw, passwordRaw) => {
  const username = validateRegistrationUsername(usernameRaw);
  const password = validateRegistrationPassword(passwordRaw);
  const existingPlayer = selectPlayerByUsernameStmt.get(username);
  if (existingPlayer) {
    throw new GameRuleError('Herni nick je uz zabrany.', 409);
  }

  const createdAt = nowIso();
  let insertion;
  try {
    insertion = insertPlayerAccountStmt.run(username, password, createdAt);
  } catch (error) {
    if (error instanceof Error && String(error.message).toLowerCase().includes('unique')) {
      throw new GameRuleError('Herni nick je uz zabrany.', 409);
    }
    throw error;
  }
  const playerId = Number(insertion.lastInsertRowid);
  return {
    username,
    // World-specific gameplay data starts only after player explicitly enters a world.
    village: null,
  };
});

const createAbandonedVillagesTransaction = db.transaction((countRaw = 1) => {
  const parsedCount = Number(countRaw ?? 1);
  const requestedCount = clampNumber(Number.isFinite(parsedCount) ? Math.floor(parsedCount) : 1, 1, 50);
  const serialAllocator = createAbandonedBotSerialAllocator();
  const world = resolveWorldById(DEFAULT_WORLD_ID);
  const spawnContext = buildSpawnContext(world);
  const createdAtIso = nowIso();
  const villages = [];

  for (let index = 0; index < requestedCount; index += 1) {
    const spawnCell = claimBestSpawnCell(spawnContext);
    if (!spawnCell) {
      break;
    }
    const serial = Number(serialAllocator());
    const serialText = String(serial).padStart(2, '0');
    const botUsername = `${ABANDONED_BOT_USERNAME_PREFIX}${serialText}`;
    const botVillageName = `${ABANDONED_VILLAGE_NAME_PREFIX} ${serialText}`;
    const botInsertion = insertAbandonedBotPlayerStmt.run(botUsername, '', createdAtIso);
    const botPlayerId = Number(botInsertion.lastInsertRowid);
    const village = createVillage({
      playerId: botPlayerId,
      villageName: botVillageName,
      kingdom: 'Neutral',
      template: ABANDONED_VILLAGE_TEMPLATE,
      world,
      spawnContext,
      createdAtIso,
      spawnCell,
    });
    villages.push({
      villageId: Number(village.id),
      villageName: String(village.name),
      coordX: Number(village.coordX),
      coordY: Number(village.coordY),
      owner: botUsername,
    });
  }

  return {
    requestedCount,
    createdCount: villages.length,
    villages,
  };
});

const restartVillageProgressTransaction = db.transaction((username, requestedVillageId = null, worldId = null) => {
  const normalizedUsername = normalizeUsername(username);
  const { player, world } = requireVillageForUser(normalizedUsername, requestedVillageId, worldId);
  const playerId = Number(player.id);
  const worldRegion = Number(world.region);
  const villages = selectVillagesByPlayerAndRegionStmt.all(playerId, worldRegion);
  const serialAllocator = createAbandonedBotSerialAllocator();
  const restartedAt = nowIso();
  const convertedVillages = [];

  deleteArmyMovementUnitsByPlayerAndRegionStmt.run(playerId, worldRegion);
  deleteArmyMovementsByPlayerAndRegionStmt.run(playerId, worldRegion);

  for (const village of villages) {
    convertedVillages.push(
      convertVillageToAbandoned({
        villageId: Number(village.id),
        serialAllocator,
        createdAtIso: restartedAt,
      }),
    );
  }

  cancelPendingKingdomInvitesByInviterStmt.run(restartedAt, playerId, worldRegion);
  rejectAllPendingKingdomInvitesForTargetStmt.run(restartedAt, playerId, worldRegion);

  const freshVillage = createFreshVillageForPlayer({
    playerId,
    username: normalizedUsername,
    world,
    createdAtIso: restartedAt,
  });

  return {
    username: normalizedUsername,
    restartedAt,
    abandonedVillagesConverted: convertedVillages.length,
    convertedVillages,
    newVillage: freshVillage
      ? {
          id: Number(freshVillage.id),
          name: String(freshVillage.name),
          coordX: Number(freshVillage.coordX),
          coordY: Number(freshVillage.coordY),
          region: Number(freshVillage.region),
          kingdom: String(freshVillage.kingdom ?? 'Neutral'),
        }
      : null,
  };
});

const toBuildingLevelMap = (rows) => {
  const levelMap = {};
  for (const buildingId of BUILDING_ORDER) {
    levelMap[buildingId] = 0;
  }
  for (const row of rows) {
    levelMap[row.buildingId] = Number(row.level);
  }
  return levelMap;
};

const toUnitCountMap = (rows) => {
  const countMap = {};
  for (const unitId of UNIT_ORDER) {
    countMap[unitId] = 0;
  }
  for (const row of rows) {
    countMap[row.unitId] = Number(row.amount);
  }
  return countMap;
};

const getUnitPopulationCost = (unitId) =>
  Math.max(0, Math.floor(Number(UNIT_DEFS[unitId]?.populationCost ?? 1)));

const calculateSelectionPopulationCost = (selection) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0)));
    if (amount <= 0) {
      return sum;
    }
    return sum + amount * getUnitPopulationCost(unitId);
  }, 0);

const calculateReservedPopulationForRecruitments = (recruitments) =>
  recruitments.reduce((sum, recruitment) => {
    const amount = Math.max(0, Math.floor(Number(recruitment.amount ?? 0)));
    if (amount <= 0) {
      return sum;
    }
    return sum + amount * getUnitPopulationCost(String(recruitment.unitId));
  }, 0);

const calculateAvailablePopulationForRecruitment = (populationCap, populationUsed, reservedPopulation = 0) =>
  Math.max(0, Number(populationCap) - Number(populationUsed) - Number(reservedPopulation));

const calculateMaxRecruitableByResources = (resources, cost) => {
  const safeWoodCost = Math.max(1, Number(cost.wood));
  const safeStoneCost = Math.max(1, Number(cost.stone));
  const safeIronCost = Math.max(1, Number(cost.iron));
  const maxByWood = Math.floor(Math.max(0, Number(resources.wood)) / safeWoodCost);
  const maxByStone = Math.floor(Math.max(0, Number(resources.stone)) / safeStoneCost);
  const maxByIron = Math.floor(Math.max(0, Number(resources.iron)) / safeIronCost);

  return Math.max(0, Math.min(maxByWood, maxByStone, maxByIron));
};

const getPlayerVillageCount = (playerId, region = null) =>
  Math.max(
    0,
    Math.floor(
      Number(
        region == null
          ? selectVillageCountByPlayerStmt.get(Number(playerId))?.total
          : selectVillageCountByPlayerAndRegionStmt.get(Number(playerId), Number(region))?.total ?? 0,
      ),
    ),
  );

const getPlayerPrestigeInRegion = (playerId, region) =>
  Math.max(
    0,
    Math.floor(Number(selectVillagePrestigeByPlayerAndRegionStmt.get(Number(playerId), Number(region))?.total ?? 0)),
  );

const getCombatRetaliationFlag = (aggressorPlayerId, defenderPlayerId, region) =>
  selectCombatRetaliationFlagByPlayersStmt.get(
    Number(aggressorPlayerId),
    Number(defenderPlayerId),
    Number(region),
  ) ?? null;

const hasCombatRetaliationFlag = (aggressorPlayerId, defenderPlayerId, region) =>
  getCombatRetaliationFlag(aggressorPlayerId, defenderPlayerId, region) != null;

const registerCombatRetaliationFlag = ({
  aggressorPlayerId,
  defenderPlayerId,
  region,
  attackedAtIso = nowIso(),
}) => {
  upsertCombatRetaliationFlagStmt.run(
    Number(aggressorPlayerId),
    Number(defenderPlayerId),
    Number(region),
    String(attackedAtIso),
    String(attackedAtIso),
  );
};

const evaluatePrestigeAttackLock = ({
  attackerPrestige,
  defenderPrestige,
  attackerPlayerId,
  defenderPlayerId,
  region,
}) => {
  const blockedByPrestige = !isAttackAllowed(attackerPrestige, defenderPrestige);
  if (!blockedByPrestige) {
    return {
      blockedByPrestige: false,
      retaliationUnlocked: false,
      canAttack: true,
      retaliationFlag: null,
      minimumDefenderPrestige: Math.max(
        1,
        Math.ceil(Math.max(0, Number(attackerPrestige ?? 0)) * MIN_ATTACKABLE_PRESTIGE_RATIO),
      ),
    };
  }

  const retaliationFlag = getCombatRetaliationFlag(defenderPlayerId, attackerPlayerId, region);
  const retaliationUnlocked = retaliationFlag != null;

  return {
    blockedByPrestige,
    retaliationUnlocked,
    canAttack: retaliationUnlocked,
    retaliationFlag,
    minimumDefenderPrestige: Math.max(
      1,
      Math.ceil(Math.max(0, Number(attackerPrestige ?? 0)) * MIN_ATTACKABLE_PRESTIGE_RATIO),
    ),
  };
};

const getPlayerKnightCapacity = (playerId, region = null) =>
  Math.max(0, getPlayerVillageCount(Number(playerId), region));

const getPlayerKnightTotalInWorld = (playerId, region = null) => {
  const owned = Math.max(
    0,
    Math.floor(
      Number(
        region == null
          ? selectTotalPlayerUnitAmountStmt.get(Number(playerId), KNIGHT_UNIT_ID)?.total
          : selectTotalPlayerUnitAmountByRegionStmt.get(Number(playerId), KNIGHT_UNIT_ID, Number(region))?.total ??
              0,
      ),
    ),
  );
  const queued = Math.max(
    0,
    Math.floor(
      Number(
        region == null
          ? selectTotalPlayerQueuedRecruitmentAmountStmt.get(Number(playerId), KNIGHT_UNIT_ID)?.total
          : selectTotalPlayerQueuedRecruitmentAmountByRegionStmt.get(
                Number(playerId),
                KNIGHT_UNIT_ID,
                Number(region),
              )?.total ?? 0,
      ),
    ),
  );
  const moving = Math.max(
    0,
    Math.floor(
      Number(
        region == null
          ? selectTotalPlayerMovementUnitAmountStmt.get(Number(playerId), KNIGHT_UNIT_ID)?.total
          : selectTotalPlayerMovementUnitAmountByRegionStmt.get(
                Number(playerId),
                KNIGHT_UNIT_ID,
                Number(region),
              )?.total ?? 0,
      ),
    ),
  );

  return owned + queued + moving;
};

const clampResourceToCap = (value, cap) => {
  if (value < 0) {
    return 0;
  }
  if (value > cap) {
    return cap;
  }
  return value;
};
const applyCappedResourceDeltaPreservingOverflow = (currentRaw, deltaRaw, capRaw) => {
  const current = Math.max(0, Number(currentRaw ?? 0));
  const delta = Number(deltaRaw ?? 0);
  const cap = Math.max(0, Number(capRaw ?? 0));

  if (current > cap) {
    if (delta > 0) {
      return current;
    }
    return Math.max(0, current + delta);
  }

  return clampResourceToCap(current + delta, cap);
};

const calculateVillagePrestige = (buildingLevels, unitCounts) => {
  let buildingScore = 0;
  for (const buildingId of BUILDING_ORDER) {
    const level = buildingLevels[buildingId] ?? 0;
    buildingScore += level * 120;
  }

  let unitScore = 0;
  unitScore += (unitCounts.militia ?? 0) * 2;
  unitScore += (unitCounts.archer ?? 0) * 3;
  unitScore += (unitCounts.cavalry ?? 0) * 4;
  unitScore += (unitCounts.scout ?? 0) * 2;
  unitScore += (unitCounts.knight ?? 0) * 140;
  unitScore += (unitCounts.ram ?? 0) * 5;
  unitScore += (unitCounts.caravan ?? 0) * 2;
  unitScore += (unitCounts.mercenary ?? 0) * 2;

  return Math.max(0, Math.round(buildingScore + unitScore));
};

const calculateRecruitmentSpeedReduction = (buildingId, level) =>
  Math.max(0, Number(calculateRecruitmentTimeReductionPct(buildingId, level) ?? 0) / 100);

const calculateBuildingEffect = (buildingId, level) => {
  if (buildingId === 'woodcutter') {
    const value = calculateResourceNodeProductionPerHour('woodcutter', level);
    return `+${Math.round(value)} dreva / h`;
  }
  if (buildingId === 'quarry') {
    const value = calculateResourceNodeProductionPerHour('quarry', level);
    return `+${Math.round(value)} kamene / h`;
  }
  if (buildingId === 'iron-mine') {
    const value = calculateResourceNodeProductionPerHour('iron-mine', level);
    return `+${Math.round(value)} zeleza / h`;
  }
  if (buildingId === 'gold-mine') {
    const valuePerHour = Math.max(0, Number(calculateProductionPerHour({ 'gold-mine': level }, 0, 1).gold ?? 0));
    return `+${Math.floor(valuePerHour).toLocaleString('cs-CZ')} zlata / h`;
  }
  if (buildingId === 'warehouse') {
    return `Kapacita skladu: ${calculateResourceCap(level).toLocaleString('cs-CZ')}`;
  }
  if (buildingId === 'hideout') {
    const protectedAmount = calculateHideoutProtectedAmount(level);
    return protectedAmount > 0
      ? `Skrys chrani ${protectedAmount.toLocaleString('cs-CZ')} dreva/kamene/zeleza`
      : 'Skrys zatim nechrani zadne suroviny';
  }
  if (buildingId === 'mint') {
    const goldCap = calculateMintGoldStorageCap(level);
    const coinCap = calculateMintCoinStorageCap(level);
    const throughput = Math.max(0, Math.floor(Number(calculateMintThroughputPerHour(level) ?? 0)));
    return level > 0
      ? `Razba: ${throughput.toLocaleString('cs-CZ')} minci/h, sklad zlata ${goldCap.toLocaleString('cs-CZ')}, sklad minci ${coinCap.toLocaleString('cs-CZ')}`
      : 'Mincovna neaktivni';
  }
  if (buildingId === 'vault') {
    const protection = calculateVaultProtection(level);
    return level > 0
      ? `Chraneno: ${protection.gold.toLocaleString('cs-CZ')} zlata a ${protection.coins.toLocaleString('cs-CZ')} minci`
      : 'Bez trezoru je zlato i mince rabovatelne';
  }
  if (buildingId === 'market') {
    const marketCapByLevel = [0, 5000, 30000, 150000, 300000];
    const capacity = Number(marketCapByLevel[Math.max(0, Math.floor(Number(level ?? 0)))] ?? 0);
    if (capacity <= 0) {
      return 'Obchod uzavren (L0)';
    }
    return level >= 4
      ? `Kapacita obchodu ${capacity.toLocaleString('cs-CZ')} (Cech obchodniku odemcen)`
      : `Kapacita obchodu ${capacity.toLocaleString('cs-CZ')}`;
  }
  if (buildingId === 'residential-quarter') {
    return `Kapacita populace: ${calculatePopulationCap(level).toLocaleString(
      'cs-CZ',
    )} (včetně systémové rezervace 300 obyvatel pro posádku)`;
  }
  if (buildingId === 'townhall') {
    const reductionPct = Math.round(calculateTownhallBuildTimeReductionPct(level));
    return reductionPct > 0
      ? `Vystavba budov: -${reductionPct} % casu`
      : 'Vystavba budov bez casoveho bonusu';
  }
  if (buildingId === 'university') {
    const researchBonusPct = Math.round(calculateUniversityResearchBonusPct(level));
    const academicSlots = getVillageUniversityCapacity({ university: level });
    const academicLabel = `Sloty akademiku: ${academicSlots.toLocaleString('cs-CZ')} / 3`;
    return researchBonusPct > 0
      ? `Vyzkum: +${researchBonusPct} % rychlost · ${academicLabel}`
      : `Vyzkum bez bonusu · ${academicLabel}`;
  }
  if (buildingId === 'barracks') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction('barracks', level) * 100);
    return reductionPct > 0
      ? `Nabor pesich jednotek: -${reductionPct} % casu`
      : 'Nabor pesich jednotek bez bonusu';
  }
  if (buildingId === 'stable') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction('stable', level) * 100);
    return reductionPct > 0 ? `Nabor jezdectva: -${reductionPct} % casu` : 'Nabor jezdectva bez bonusu';
  }
  if (buildingId === 'workshop') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction('workshop', level) * 100);
    return reductionPct > 0
      ? `Nabor dilenskych jednotek: -${reductionPct} % casu`
      : 'Nabor dilenskych jednotek bez bonusu';
  }
  if (buildingId === 'fortification') {
    const defenseBonusPct = Math.round(Math.min(45, Math.max(0, Number(level ?? 0)) * 3));
    return defenseBonusPct > 0
      ? `Obrana osady: +${defenseBonusPct} % (dalsi bonus s lucistniky na hradbach)`
      : 'Obrana osady bez bonusu';
  }
  if (buildingId === 'gate') {
    return Number(level ?? 0) > 0
      ? 'Brana aktivni: s opevnenim zastavi utok bez beranidel, beranidla spotrebovavaji urovne brany'
      : 'Bez brany muze utocnik vstoupit i bez beranidel, prezivsi beranidla davaji bonus utoku';
  }

  return `Uroven ${level}`;
};

const formatSignedInteger = (nextValueRaw, currentValueRaw) => {
  const nextValue = Math.max(0, Math.floor(Number(nextValueRaw ?? 0)));
  const currentValue = Math.max(0, Math.floor(Number(currentValueRaw ?? 0)));
  const delta = nextValue - currentValue;
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${Math.abs(delta).toLocaleString('cs-CZ')}`;
};

const buildUnlockPreviewItems = (buildingId, currentLevelRaw, nextLevelRaw) => {
  const currentLevel = Math.max(0, Math.floor(Number(currentLevelRaw ?? 0)));
  const nextLevel = Math.max(0, Math.floor(Number(nextLevelRaw ?? 0)));
  const unlocks = [];

  for (const candidateBuildingId of BUILDING_ORDER) {
    if (candidateBuildingId === buildingId) {
      continue;
    }
    const requirements = BUILDING_DEFS[candidateBuildingId]?.requiredBuildings;
    if (!requirements || typeof requirements !== 'object') {
      continue;
    }
    const requiredLevel = Math.max(1, Math.floor(Number(requirements[buildingId] ?? 0)));
    if (requiredLevel <= 0 || currentLevel >= requiredLevel || nextLevel < requiredLevel) {
      continue;
    }
    const candidateName = String(BUILDING_DEFS[candidateBuildingId]?.name ?? candidateBuildingId);
    unlocks.push(`Budova: ${candidateName} (splnena podminka ${requiredLevel}. urovne).`);
  }

  for (const unitId of UNIT_ORDER) {
    const unitDef = UNIT_DEFS[unitId];
    if (!unitDef || unitDef.isRecruitable === false) {
      continue;
    }
    if (String(unitDef.requiredBuilding ?? '') !== String(buildingId)) {
      continue;
    }
    const requiredLevel = Math.max(1, Math.floor(Number(unitDef.requiredBuildingLevel ?? 1)));
    if (currentLevel >= requiredLevel || nextLevel < requiredLevel) {
      continue;
    }
    unlocks.push(`Jednotka: ${String(unitDef.name)} (budova splni pozadovanou uroven).`);
  }

  if (buildingId === 'market' && currentLevel < 4 && nextLevel >= 4) {
    unlocks.push('Automaticka logistika Cechu obchodniku (po vyzkumu Vliv cechu).');
  }

  return unlocks;
};

const buildBuildingNextLevelPreview = ({
  buildingId,
  fromLevel,
  toLevel,
}) => {
  const currentLevel = Math.max(0, Math.floor(Number(fromLevel ?? 0)));
  const nextLevel = Math.max(0, Math.floor(Number(toLevel ?? 0)));
  const deltas = [];

  if (buildingId === 'woodcutter' || buildingId === 'quarry' || buildingId === 'iron-mine') {
    const currentProduction = calculateResourceNodeProductionPerHour(buildingId, currentLevel);
    const nextProduction = calculateResourceNodeProductionPerHour(buildingId, nextLevel);
    const label =
      buildingId === 'woodcutter'
        ? 'Drevo'
        : buildingId === 'quarry'
          ? 'Kamen'
          : 'Zelezo';
    deltas.push(
      `${label}/h: ${Math.round(currentProduction).toLocaleString('cs-CZ')} -> ${Math.round(nextProduction).toLocaleString('cs-CZ')} (${formatSignedInteger(nextProduction, currentProduction)}).`,
    );
  } else if (buildingId === 'gold-mine') {
    const currentGold = Math.max(0, Number(calculateProductionPerHour({ 'gold-mine': currentLevel }, 0, 1).gold ?? 0));
    const nextGold = Math.max(0, Number(calculateProductionPerHour({ 'gold-mine': nextLevel }, 0, 1).gold ?? 0));
    const delta = Math.floor(nextGold - currentGold);
    const sign = delta >= 0 ? '+' : '-';
    deltas.push(
      `Zlato/h: ${Math.floor(currentGold).toLocaleString('cs-CZ')} -> ${Math.floor(nextGold).toLocaleString('cs-CZ')} (${sign}${Math.abs(delta).toLocaleString('cs-CZ')}).`,
    );
  } else if (buildingId === 'warehouse') {
    const currentCap = calculateResourceCap(currentLevel);
    const nextCap = calculateResourceCap(nextLevel);
    deltas.push(
      `Kapacita skladu: ${currentCap.toLocaleString('cs-CZ')} -> ${nextCap.toLocaleString('cs-CZ')} (${formatSignedInteger(nextCap, currentCap)}).`,
    );
  } else if (buildingId === 'hideout') {
    const currentProtection = calculateHideoutProtectedAmount(currentLevel);
    const nextProtection = calculateHideoutProtectedAmount(nextLevel);
    deltas.push(
      `Skrys (na surovinu): ${currentProtection.toLocaleString('cs-CZ')} -> ${nextProtection.toLocaleString('cs-CZ')} (${formatSignedInteger(nextProtection, currentProtection)}).`,
    );
  } else if (buildingId === 'mint') {
    const currentThroughput = calculateMintThroughputPerHour(currentLevel);
    const nextThroughput = calculateMintThroughputPerHour(nextLevel);
    const currentGoldCap = calculateMintGoldStorageCap(currentLevel);
    const nextGoldCap = calculateMintGoldStorageCap(nextLevel);
    const currentCoinCap = calculateMintCoinStorageCap(currentLevel);
    const nextCoinCap = calculateMintCoinStorageCap(nextLevel);
    deltas.push(
      `Razba minci/h: ${currentThroughput.toFixed(2)} -> ${nextThroughput.toFixed(2)} (${(nextThroughput - currentThroughput).toFixed(2).startsWith('-') ? '' : '+'}${(nextThroughput - currentThroughput).toFixed(2)}).`,
    );
    deltas.push(
      `Sklad zlata: ${currentGoldCap.toLocaleString('cs-CZ')} -> ${nextGoldCap.toLocaleString('cs-CZ')} (${formatSignedInteger(nextGoldCap, currentGoldCap)}).`,
    );
    deltas.push(
      `Sklad minci: ${currentCoinCap.toLocaleString('cs-CZ')} -> ${nextCoinCap.toLocaleString('cs-CZ')} (${formatSignedInteger(nextCoinCap, currentCoinCap)}).`,
    );
  } else if (buildingId === 'vault') {
    const currentProtection = calculateVaultProtection(currentLevel);
    const nextProtection = calculateVaultProtection(nextLevel);
    deltas.push(
      `Chranene zlato: ${currentProtection.gold.toLocaleString('cs-CZ')} -> ${nextProtection.gold.toLocaleString('cs-CZ')} (${formatSignedInteger(nextProtection.gold, currentProtection.gold)}).`,
    );
    deltas.push(
      `Chranene mince: ${currentProtection.coins.toLocaleString('cs-CZ')} -> ${nextProtection.coins.toLocaleString('cs-CZ')} (${formatSignedInteger(nextProtection.coins, currentProtection.coins)}).`,
    );
  } else if (buildingId === 'market') {
    const currentCapacity = calculateMarketCapacity(currentLevel);
    const nextCapacity = calculateMarketCapacity(nextLevel);
    deltas.push(
      `Kapacita obchodu: ${currentCapacity.toLocaleString('cs-CZ')} -> ${nextCapacity.toLocaleString('cs-CZ')} (${formatSignedInteger(nextCapacity, currentCapacity)}).`,
    );
    deltas.push('Logistika: cesta = 10 min + 2 min za pole (max 50 poli).');
  } else if (buildingId === 'residential-quarter') {
    const currentPopulationCap = calculatePopulationCap(currentLevel);
    const nextPopulationCap = calculatePopulationCap(nextLevel);
    deltas.push(
      `Kapacita populace: ${currentPopulationCap.toLocaleString('cs-CZ')} -> ${nextPopulationCap.toLocaleString('cs-CZ')} (${formatSignedInteger(nextPopulationCap, currentPopulationCap)}).`,
    );
  } else if (buildingId === 'townhall') {
    const currentReductionPct = Math.round(calculateTownhallBuildTimeReductionPct(currentLevel));
    const nextReductionPct = Math.round(calculateTownhallBuildTimeReductionPct(nextLevel));
    const sampleCurrent = calculateUpgradeDurationSec('woodcutter', 1, currentLevel);
    const sampleNext = calculateUpgradeDurationSec('woodcutter', 1, nextLevel);
    deltas.push(
      `Rychlost vystavby: -${currentReductionPct} % -> -${nextReductionPct} % (zmena +${Math.max(0, nextReductionPct - currentReductionPct)} p.b.).`,
    );
    deltas.push(
      `Priklad (Drevorubec L1->2): ${formatRemaining(sampleCurrent)} -> ${formatRemaining(sampleNext)}.`,
    );
  } else if (buildingId === 'university') {
    const currentSpeedBonus = Math.round(calculateUniversityResearchBonusPct(currentLevel));
    const nextSpeedBonus = Math.round(calculateUniversityResearchBonusPct(nextLevel));
    deltas.push(`Rychlost vyzkumu akademiku: +${currentSpeedBonus}% -> +${nextSpeedBonus}%.`);
    const currentAcademicSlots = getVillageUniversityCapacity({ university: currentLevel });
    const nextAcademicSlots = getVillageUniversityCapacity({ university: nextLevel });
    deltas.push(
      `Sloty akademiku: ${currentAcademicSlots.toLocaleString('cs-CZ')} -> ${nextAcademicSlots.toLocaleString(
        'cs-CZ',
      )} (${formatSignedInteger(nextAcademicSlots, currentAcademicSlots)}).`,
    );
  } else if (buildingId === 'barracks') {
    const currentReduction = Math.round(calculateRecruitmentSpeedReduction('barracks', currentLevel) * 100);
    const nextReduction = Math.round(calculateRecruitmentSpeedReduction('barracks', nextLevel) * 100);
    const currentMilitiaRecruit = calculateRecruitDurationSec('militia', 1, currentLevel);
    const nextMilitiaRecruit = calculateRecruitDurationSec('militia', 1, nextLevel);
    deltas.push(
      `Nabor pechoty: -${currentReduction}% -> -${nextReduction}% (zmena +${Math.max(0, nextReduction - currentReduction)} p.b.).`,
    );
    deltas.push(
      `Ozbrojenec (1 ks): ${formatRemaining(currentMilitiaRecruit)} -> ${formatRemaining(nextMilitiaRecruit)}.`,
    );
  } else if (buildingId === 'stable') {
    const currentReduction = Math.round(calculateRecruitmentSpeedReduction('stable', currentLevel) * 100);
    const nextReduction = Math.round(calculateRecruitmentSpeedReduction('stable', nextLevel) * 100);
    const currentCavalryRecruit = calculateRecruitDurationSec('cavalry', 1, currentLevel);
    const nextCavalryRecruit = calculateRecruitDurationSec('cavalry', 1, nextLevel);
    deltas.push(
      `Nabor jezdectva: -${currentReduction}% -> -${nextReduction}% (zmena +${Math.max(0, nextReduction - currentReduction)} p.b.).`,
    );
    deltas.push(`Jezdec (1 ks): ${formatRemaining(currentCavalryRecruit)} -> ${formatRemaining(nextCavalryRecruit)}.`);
  } else if (buildingId === 'workshop') {
    const currentReduction = Math.round(calculateRecruitmentSpeedReduction('workshop', currentLevel) * 100);
    const nextReduction = Math.round(calculateRecruitmentSpeedReduction('workshop', nextLevel) * 100);
    const currentRamRecruit = calculateRecruitDurationSec('ram', 1, currentLevel);
    const nextRamRecruit = calculateRecruitDurationSec('ram', 1, nextLevel);
    deltas.push(
      `Nabor dilenskych jednotek: -${currentReduction}% -> -${nextReduction}% (zmena +${Math.max(0, nextReduction - currentReduction)} p.b.).`,
    );
    deltas.push(
      `Beranidlo (1 ks): ${formatRemaining(currentRamRecruit)} -> ${formatRemaining(nextRamRecruit)}.`,
    );
  } else if (buildingId === 'fortification') {
    const currentDefenseBonus = Math.round(Math.min(45, currentLevel * 3));
    const nextDefenseBonus = Math.round(Math.min(45, nextLevel * 3));
    deltas.push(
      `Obrana osady: +${currentDefenseBonus}% -> +${nextDefenseBonus}% (${formatSignedInteger(nextDefenseBonus, currentDefenseBonus)} p.b.).`,
    );
  } else if (buildingId === 'gate') {
    if (currentLevel <= 0 && nextLevel > 0) {
      deltas.push('Brana aktivovana: s opevnenim zastavi utok bez beranidel.');
      deltas.push('Kazde beranidlo snizi 1 uroven brany.');
    } else {
      deltas.push('Brana je uz aktivni, dalsi uroven neni dostupna.');
    }
  } else {
    const currentEffect = calculateBuildingEffect(buildingId, currentLevel);
    const nextEffect = calculateBuildingEffect(buildingId, nextLevel);
    deltas.push(`Efekt: ${currentEffect} -> ${nextEffect}`);
  }

  return {
    fromLevel: currentLevel,
    toLevel: nextLevel,
    deltas,
    unlocks: buildUnlockPreviewItems(buildingId, currentLevel, nextLevel),
  };
};

const buildProjectedBuildingLevels = (buildingLevels, activeUpgrades = []) => {
  const projected = {};
  for (const candidateBuildingId of BUILDING_ORDER) {
    projected[candidateBuildingId] = Math.max(0, Math.floor(Number(buildingLevels?.[candidateBuildingId] ?? 0)));
  }

  for (const upgrade of activeUpgrades) {
    const candidateBuildingId = String(upgrade?.buildingId ?? '').trim();
    if (!candidateBuildingId || !BUILDING_ORDER.includes(candidateBuildingId)) {
      continue;
    }
    const queuedTargetLevel = Math.max(0, Math.floor(Number(upgrade?.toLevel ?? 0)));
    projected[candidateBuildingId] = Math.max(
      projected[candidateBuildingId] ?? 0,
      Math.min(getMaxBuildingLevel(candidateBuildingId), queuedTargetLevel),
    );
  }

  return projected;
};

const resolveBuildingRequirementError = (buildingId, buildingLevels, options = {}) => {
  const requirements = BUILDING_DEFS[buildingId]?.requiredBuildings;
  if (!requirements || typeof requirements !== 'object') {
    return null;
  }
  const effectiveLevels = options?.effectiveBuildingLevels ?? buildingLevels;

  for (const [requiredBuildingId, requiredLevelRaw] of Object.entries(requirements)) {
    const requiredLevel = Math.max(1, Math.floor(Number(requiredLevelRaw ?? 0)));
    const currentLevel = Math.max(0, Math.floor(Number(effectiveLevels?.[requiredBuildingId] ?? 0)));
    if (currentLevel >= requiredLevel) {
      continue;
    }
    const requiredName = BUILDING_DEFS[requiredBuildingId]?.name ?? requiredBuildingId;
    return requiredLevel <= 1
      ? `Vybuduj ${requiredName}.`
      : `Vybuduj ${requiredName} na uroven ${requiredLevel}.`;
  }

  return null;
};

const formatRemaining = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${sec}s`;
  }
  return `${sec}s`;
};

const calculateTileDistance = (fromVillage, toVillage) =>
  Math.max(
    Math.abs(Number(toVillage.coordX) - Number(fromVillage.coordX)),
    Math.abs(Number(toVillage.coordY) - Number(fromVillage.coordY)),
  );

const calculateMarketCapacity = (marketLevelRaw) => {
  const level = Math.max(0, Math.floor(Number(marketLevelRaw ?? 0)));
  return Number(MARKET_CAPACITY_BY_LEVEL[level] ?? 0);
};

const calculateMarketMerchantCapacity = (marketLevelRaw) => {
  const level = Math.max(0, Math.floor(Number(marketLevelRaw ?? 0)));
  return level;
};

const calculateMarketMerchantStateByVillage = (sourceVillageId, marketLevelRaw) => {
  const total = calculateMarketMerchantCapacity(marketLevelRaw);
  const inUse = Math.max(
    0,
    Math.floor(Number(countInProgressLogisticsBySourceVillageStmt.get(Number(sourceVillageId))?.total ?? 0)),
  );
  const available = Math.max(0, total - inUse);
  return { total, inUse, available };
};

const isMarketGuildUnlocked = (marketLevelRaw, completedResearchIds = null) => {
  const marketLevel = Math.max(0, Math.floor(Number(marketLevelRaw ?? 0)));
  if (marketLevel < MARKET_GUILD_MIN_MARKET_LEVEL) {
    return false;
  }
  if (!(completedResearchIds instanceof Set)) {
    return false;
  }
  return completedResearchIds.has(MARKET_GUILD_REQUIRED_RESEARCH_ID);
};

const calculateLogisticsDurationSec = (distanceTilesRaw) => {
  const distanceTiles = Math.max(0, Math.floor(Number(distanceTilesRaw ?? 0)));
  return Math.max(60, Math.floor((LOGISTICS_MINUTES_BASE + distanceTiles * LOGISTICS_MINUTES_PER_TILE) * 60));
};

const isMarketGuildDispatchWindowAtTime = (timeIso) => {
  const timestamp = Date.parse(String(timeIso ?? ''));
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  return hour >= MARKET_GUILD_ACTIVE_START_HOUR && hour < MARKET_GUILD_ACTIVE_END_HOUR;
};

const alignMarketGuildDispatchToWindowIso = (timestampMsRaw) => {
  const timestampMs = Number(timestampMsRaw);
  if (!Number.isFinite(timestampMs)) {
    return nowIso();
  }
  const date = new Date(timestampMs);
  const hour = date.getUTCHours();
  if (hour >= MARKET_GUILD_ACTIVE_END_HOUR) {
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(MARKET_GUILD_ACTIVE_START_HOUR, 0, 0, 0);
    return date.toISOString();
  }
  if (hour < MARKET_GUILD_ACTIVE_START_HOUR) {
    date.setUTCHours(MARKET_GUILD_ACTIVE_START_HOUR, 0, 0, 0);
    return date.toISOString();
  }
  return date.toISOString();
};

const resolveNextMarketGuildDispatchAt = (referenceIso, cycleIntervalSecRaw = MARKET_GUILD_CYCLE_INTERVAL_SEC) => {
  const referenceMs = Date.parse(String(referenceIso ?? ''));
  const cycleIntervalSec = Math.max(300, Math.floor(Number(cycleIntervalSecRaw ?? MARKET_GUILD_CYCLE_INTERVAL_SEC)));
  if (!Number.isFinite(referenceMs)) {
    return alignMarketGuildDispatchToWindowIso(Date.now() + cycleIntervalSec * 1000);
  }
  return alignMarketGuildDispatchToWindowIso(referenceMs + cycleIntervalSec * 1000);
};

const parseArmyUnitSelection = (unitsPayload) => {
  if (!unitsPayload || typeof unitsPayload !== 'object') {
    return {};
  }

  const selection = {};
  for (const unitId of UNIT_ORDER) {
    const raw = Number(unitsPayload[unitId] ?? 0);
    if (!Number.isInteger(raw) || raw <= 0) {
      continue;
    }
    selection[unitId] = raw;
  }

  return selection;
};

const sumSelectedUnits = (selection) =>
  UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0), 0);

const sumSelectedCost = (selection) => {
  const total = { wood: 0, stone: 0, iron: 0 };
  for (const unitId of UNIT_ORDER) {
    const amount = Number(selection[unitId] ?? 0);
    if (amount <= 0) {
      continue;
    }

    const unitCost = UNIT_DEFS[unitId]?.cost;
    if (!unitCost) {
      continue;
    }
    total.wood += unitCost.wood * amount;
    total.stone += unitCost.stone * amount;
    total.iron += unitCost.iron * amount;
  }
  return total;
};

const LOOT_RESOURCE_ORDER = ['wood', 'stone', 'iron'];
const LOOT_BALANCED_PRIORITY = 'balanced';
const LOOT_PRIORITIES = [...LOOT_RESOURCE_ORDER, LOOT_BALANCED_PRIORITY];
const CARAVAN_UNIT_ID = 'caravan';
const COMBAT_ESCORT_UNIT_ORDER = UNIT_ORDER.filter((unitId) => unitId !== CARAVAN_UNIT_ID);
const UNIT_LOOT_CAPACITY = Object.freeze({
  militia: 20,
  archer: 16,
  cavalry: 80,
  scout: 0,
  knight: 45,
  ram: 0,
  caravan: 250,
  mercenary: 0,
});
const BATTLE_UNIT_STATS = Object.freeze({
  militia: { attack: 11, defense: 12, health: 18 },
  archer: { attack: 9, defense: 14, health: 12 },
  cavalry: { attack: 18, defense: 10, health: 21 },
  scout: { attack: 4, defense: 4, health: 9 },
  knight: { attack: 300, defense: 255, health: 240 },
  ram: { attack: 0, defense: 0, health: 42 },
  caravan: { attack: 0, defense: 0, health: 8 },
  mercenary: { attack: 11, defense: 12, health: 18 },
});
const RAM_ATTACK_SUPPORT_MULTIPLIER = 1.1;
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const toCompleteUnitSelection = (partialSelection) => {
  const complete = {};
  for (const unitId of UNIT_ORDER) {
    complete[unitId] = Math.max(0, Math.floor(Number(partialSelection?.[unitId] ?? 0)));
  }
  return complete;
};

const addUnitSelection = (targetSelection, sourceSelection) => {
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(sourceSelection?.[unitId] ?? 0)));
    if (amount <= 0) {
      continue;
    }
    targetSelection[unitId] = Math.max(0, Math.floor(Number(targetSelection[unitId] ?? 0))) + amount;
  }
  return targetSelection;
};

const buildStationedSupportBattleGroups = (targetVillageId) => {
  const supportRows = selectStationedSupportsByTargetVillageStmt.all(Number(targetVillageId));
  const groups = [];

  for (const supportRow of supportRows) {
    const unitsPartial = {};
    const movementUnits = selectMovementUnitsStmt.all(Number(supportRow.id));
    for (const unitRow of movementUnits) {
      unitsPartial[unitRow.unitId] = Number(unitRow.amount);
    }
    const units = toCompleteUnitSelection(unitsPartial);
    const total = sumSelectedUnits(units);
    if (total <= 0) {
      continue;
    }

    groups.push({
      id: Number(supportRow.id),
      playerId: Number(supportRow.playerId),
      originVillageId: Number(supportRow.originVillageId),
      targetVillageId: Number(supportRow.targetVillageId),
      homeVillageId: Number(supportRow.homeVillageId),
      originName: String(supportRow.originName ?? ''),
      targetName: String(supportRow.targetName ?? ''),
      units,
      total,
    });
  }

  return groups;
};

const calculateBuildingPopulationUsed = (buildingLevels) =>
  BUILDING_ORDER.reduce((sum, buildingId) => {
    const level = Math.max(0, Math.floor(Number(buildingLevels?.[buildingId] ?? 0)));
    const workerPerLevel = Math.max(0, Math.floor(Number(BUILDING_DEFS[buildingId]?.workerPerLevel ?? 0)));
    return sum + level * workerPerLevel;
  }, 0);

const calculateUnitPopulationUsed = (unitCounts) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Math.max(0, Math.floor(Number(unitCounts?.[unitId] ?? 0)));
    const populationCost = Math.max(0, Math.floor(Number(UNIT_DEFS[unitId]?.populationCost ?? 0)));
    return sum + amount * populationCost;
  }, 0);

const getVillageAwayUnitCounts = (villageId) =>
  toUnitCountMap(selectAwayUnitTotalsByHomeVillageStmt.all(Number(villageId)));

const calculateGarrisonRefillDurationSec = (unitId, buildingLevels) => {
  const requiredBuildingId = String(UNIT_DEFS[unitId]?.requiredBuilding ?? '');
  const requiredBuildingLevel = Math.max(
    0,
    Math.floor(Number(requiredBuildingId ? buildingLevels?.[requiredBuildingId] ?? 0 : 0)),
  );
  const durationSec = calculateRecruitDurationSec(unitId, 1, requiredBuildingLevel);
  return Math.max(1, Math.floor(Number(durationSec ?? 1)));
};

const synchronizeVillageGarrisonAt = (villageId, referenceIso = nowIso(), options = {}) => {
  const persist = options?.persist !== false;
  const numericVillageId = Number(villageId);
  if (!Number.isFinite(numericVillageId) || numericVillageId <= 0) {
    return {
      villageId: 0,
      isUnlocked: false,
      activeCap: 0,
      totalCap: GARRISON_RESERVED_POPULATION,
      reservedPopulation: GARRISON_RESERVED_POPULATION,
      totalUnits: 0,
      units: {
        militia: { amount: 0, cap: 0, missing: 0, refillSecPerUnit: 0, nextRefillSec: null },
        archer: { amount: 0, cap: 0, missing: 0, refillSecPerUnit: 0, nextRefillSec: null },
      },
      militiaAmount: 0,
      archerAmount: 0,
      militiaProgress: 0,
      archerProgress: 0,
      lastSyncAt: null,
    };
  }

  let row = selectVillageGarrisonByVillageStmt.get(numericVillageId) ?? null;
  if (!row && persist) {
    insertVillageGarrisonIfMissingStmt.run(
      numericVillageId,
      Number(GARRISON_UNIT_CAPS.militia ?? 0),
      Number(GARRISON_UNIT_CAPS.archer ?? 0),
      String(referenceIso),
    );
    row = selectVillageGarrisonByVillageStmt.get(numericVillageId) ?? null;
  }

  const buildingLevels =
    options?.buildingLevels ??
    toBuildingLevelMap(selectBuildingsByVillageStmt.all(numericVillageId));
  const townhallLevel = Math.max(0, Math.floor(Number(buildingLevels?.townhall ?? 0)));
  const isUnlocked = townhallLevel >= GARRISON_UNLOCK_TOWNHALL_LEVEL;
  const militiaCap = isUnlocked ? Number(GARRISON_UNIT_CAPS.militia ?? 0) : 0;
  const archerCap = isUnlocked ? Number(GARRISON_UNIT_CAPS.archer ?? 0) : 0;
  const activeCap = militiaCap + archerCap;

  if (!isUnlocked) {
    return {
      villageId: numericVillageId,
      isUnlocked: false,
      activeCap: 0,
      totalCap: GARRISON_RESERVED_POPULATION,
      reservedPopulation: GARRISON_RESERVED_POPULATION,
      totalUnits: 0,
      units: {
        militia: { amount: 0, cap: 0, missing: 0, refillSecPerUnit: 0, nextRefillSec: null },
        archer: { amount: 0, cap: 0, missing: 0, refillSecPerUnit: 0, nextRefillSec: null },
      },
      militiaAmount: 0,
      archerAmount: 0,
      militiaProgress: Math.max(0, Number(row?.militiaProgress ?? 0)),
      archerProgress: Math.max(0, Number(row?.archerProgress ?? 0)),
      lastSyncAt: row?.lastSyncAt ? String(row.lastSyncAt) : null,
    };
  }

  let militiaAmount = Math.max(
    0,
    Math.min(
      militiaCap,
      Math.floor(Number(row?.militiaAmount ?? militiaCap)),
    ),
  );
  let archerAmount = Math.max(
    0,
    Math.min(
      archerCap,
      Math.floor(Number(row?.archerAmount ?? archerCap)),
    ),
  );
  let militiaProgress = Math.max(0, Number(row?.militiaProgress ?? 0));
  let archerProgress = Math.max(0, Number(row?.archerProgress ?? 0));

  const referenceMs = Date.parse(String(referenceIso));
  const rowLastSyncMs = Date.parse(String(row?.lastSyncAt ?? ''));
  const effectiveLastSyncMs = Number.isFinite(rowLastSyncMs) ? rowLastSyncMs : referenceMs;
  const elapsedSec =
    Number.isFinite(referenceMs) && Number.isFinite(effectiveLastSyncMs)
      ? Math.max(0, (referenceMs - effectiveLastSyncMs) / 1000)
      : 0;

  const refillDurationByUnit = {
    militia: calculateGarrisonRefillDurationSec('militia', buildingLevels),
    archer: calculateGarrisonRefillDurationSec('archer', buildingLevels),
  };

  if (elapsedSec > 0) {
    const missingMilitia = Math.max(0, militiaCap - militiaAmount);
    if (missingMilitia > 0) {
      militiaProgress += elapsedSec / Math.max(1, Number(refillDurationByUnit.militia ?? 1));
      const recovered = Math.min(missingMilitia, Math.floor(militiaProgress));
      if (recovered > 0) {
        militiaAmount += recovered;
        militiaProgress -= recovered;
      }
    } else {
      militiaProgress = 0;
    }

    const missingArcher = Math.max(0, archerCap - archerAmount);
    if (missingArcher > 0) {
      archerProgress += elapsedSec / Math.max(1, Number(refillDurationByUnit.archer ?? 1));
      const recovered = Math.min(missingArcher, Math.floor(archerProgress));
      if (recovered > 0) {
        archerAmount += recovered;
        archerProgress -= recovered;
      }
    } else {
      archerProgress = 0;
    }
  }

  militiaAmount = Math.max(0, Math.min(militiaCap, militiaAmount));
  archerAmount = Math.max(0, Math.min(archerCap, archerAmount));
  if (militiaAmount >= militiaCap) {
    militiaProgress = 0;
  }
  if (archerAmount >= archerCap) {
    archerProgress = 0;
  }

  const nextLastSyncAt = Number.isFinite(referenceMs) ? String(referenceIso) : row?.lastSyncAt ? String(row.lastSyncAt) : null;
  if (persist) {
    upsertVillageGarrisonStateStmt.run(
      numericVillageId,
      militiaAmount,
      archerAmount,
      Number.isFinite(militiaProgress) ? militiaProgress : 0,
      Number.isFinite(archerProgress) ? archerProgress : 0,
      nextLastSyncAt,
    );
  }

  const militiaMissing = Math.max(0, militiaCap - militiaAmount);
  const archerMissing = Math.max(0, archerCap - archerAmount);
  const militiaNextRefillSec =
    militiaMissing > 0
      ? Math.max(1, Math.ceil((1 - Math.max(0, Math.min(0.999999, militiaProgress))) * refillDurationByUnit.militia))
      : null;
  const archerNextRefillSec =
    archerMissing > 0
      ? Math.max(1, Math.ceil((1 - Math.max(0, Math.min(0.999999, archerProgress))) * refillDurationByUnit.archer))
      : null;

  return {
    villageId: numericVillageId,
    isUnlocked: true,
    activeCap,
    totalCap: GARRISON_RESERVED_POPULATION,
    reservedPopulation: GARRISON_RESERVED_POPULATION,
    totalUnits: militiaAmount + archerAmount,
    units: {
      militia: {
        amount: militiaAmount,
        cap: militiaCap,
        missing: militiaMissing,
        refillSecPerUnit: Number(refillDurationByUnit.militia),
        nextRefillSec: militiaNextRefillSec,
      },
      archer: {
        amount: archerAmount,
        cap: archerCap,
        missing: archerMissing,
        refillSecPerUnit: Number(refillDurationByUnit.archer),
        nextRefillSec: archerNextRefillSec,
      },
    },
    militiaAmount,
    archerAmount,
    militiaProgress,
    archerProgress,
    lastSyncAt: nextLastSyncAt,
  };
};

const getVillagePopulationStatus = (villageId, options = {}) => {
  const numericVillageId = Number(villageId);
  const buildingLevels =
    options?.buildingLevels ??
    toBuildingLevelMap(selectBuildingsByVillageStmt.all(numericVillageId));
  const unitCounts =
    options?.unitCounts ??
    toUnitCountMap(selectUnitsByVillageStmt.all(numericVillageId));
  const awayUnitCounts = options?.awayUnitCounts ?? getVillageAwayUnitCounts(numericVillageId);
  const academicCount =
    options?.academicCount ??
    Math.max(
      0,
      Math.floor(Number(countActiveAcademicsByVillageStmt.get(numericVillageId)?.total ?? 0)),
    );
  const populationCap = calculatePopulationCap(buildingLevels['residential-quarter'] ?? 0);
  const buildingPopulationUsed = calculateBuildingPopulationUsed(buildingLevels);
  const homeUnitPopulationUsed = calculateUnitPopulationUsed(unitCounts);
  const awayUnitPopulationUsed = calculateUnitPopulationUsed(awayUnitCounts);
  const academicPopulationUsed = academicCount * ACADEMIC_POPULATION_COST;
  const garrisonPopulationReserved = GARRISON_RESERVED_POPULATION;
  const populationUsed =
    buildingPopulationUsed +
    homeUnitPopulationUsed +
    awayUnitPopulationUsed +
    academicPopulationUsed +
    garrisonPopulationReserved;
  const availablePopulation = Math.max(0, populationCap - populationUsed);
  const overflowPopulation = Math.max(0, populationUsed - populationCap);

  return {
    buildingLevels,
    unitCounts,
    awayUnitCounts,
    academicCount,
    academicPopulationUsed,
    garrisonPopulationReserved,
    buildingPopulationUsed,
    homeUnitPopulationUsed,
    awayUnitPopulationUsed,
    populationCap,
    populationUsed,
    availablePopulation,
    overflowPopulation,
  };
};

const getBattleUnitStats = (unitId) => BATTLE_UNIT_STATS[unitId] ?? { attack: 0, defense: 0, health: 10 };

const sumCombatPower = (selection, role) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Number(selection[unitId] ?? 0);
    if (amount <= 0) {
      return sum;
    }
    const unitStats = getBattleUnitStats(unitId);
    const rolePower = Number(unitStats?.[role] ?? 0);
    if (rolePower <= 0) {
      return sum;
    }
    const healthWeight = clampNumber(Math.sqrt(Math.max(1, Number(unitStats.health ?? 10))) / 4, 0.5, 1.75);
    return sum + amount * rolePower * healthWeight;
  }, 0);

const sumHealthPool = (selection) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Number(selection?.[unitId] ?? 0);
    if (amount <= 0) {
      return sum;
    }
    const health = Math.max(1, Number(getBattleUnitStats(unitId).health ?? 10));
    return sum + amount * health;
  }, 0);

const applyCasualties = (selection, casualtyRatio) => {
  const safeRatio = clampNumber(Number(casualtyRatio), 0, 1);
  const losses = {};
  const survivors = {};

  for (const unitId of UNIT_ORDER) {
    const startAmount = Math.max(0, Math.floor(Number(selection[unitId] ?? 0)));
    const unitStats = getBattleUnitStats(unitId);
    const durabilityFactor = clampNumber(Math.sqrt(Math.max(1, Number(unitStats.health ?? 10))) / 4.2, 0.55, 1.65);
    let unitRatio = safeRatio / durabilityFactor;
    if (unitId === 'ram' || unitId === 'caravan') {
      unitRatio *= 1.15;
    }
    if (unitId === KNIGHT_UNIT_ID) {
      unitRatio *= 0.82;
    }
    unitRatio = clampNumber(unitRatio, 0, 1);

    const lossAmount = Math.min(startAmount, Math.round(startAmount * unitRatio));
    const survivorAmount = Math.max(0, startAmount - lossAmount);
    losses[unitId] = lossAmount;
    survivors[unitId] = survivorAmount;
  }

  return { losses, survivors };
};

const buildLossesFromStartAndSurvivors = (startSelection, survivorsSelection) => {
  const losses = {};
  for (const unitId of UNIT_ORDER) {
    const startAmount = Math.max(0, Math.floor(Number(startSelection?.[unitId] ?? 0)));
    const survivorAmount = Math.max(0, Math.floor(Number(survivorsSelection?.[unitId] ?? 0)));
    losses[unitId] = Math.max(0, startAmount - survivorAmount);
  }
  return losses;
};

const distributeSurvivorsAcrossDefenderGroups = (groupSelectionsRaw, totalSurvivorsRaw) => {
  const groupSelections = (Array.isArray(groupSelectionsRaw) ? groupSelectionsRaw : []).map((selection) =>
    toCompleteUnitSelection(selection),
  );
  const totalSurvivors = toCompleteUnitSelection(totalSurvivorsRaw);
  const distributed = groupSelections.map(() => toCompleteUnitSelection({}));

  for (const unitId of UNIT_ORDER) {
    const starts = groupSelections.map((selection) =>
      Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0))),
    );
    const totalStart = starts.reduce((sum, amount) => sum + amount, 0);
    if (totalStart <= 0) {
      continue;
    }

    const requestedSurvivors = Math.max(0, Math.floor(Number(totalSurvivors?.[unitId] ?? 0)));
    const survivorTarget = Math.min(totalStart, requestedSurvivors);
    if (survivorTarget <= 0) {
      continue;
    }
    if (survivorTarget >= totalStart) {
      for (let index = 0; index < starts.length; index += 1) {
        distributed[index][unitId] = starts[index];
      }
      continue;
    }

    const baseAllocations = starts.map((startAmount) => {
      if (startAmount <= 0) {
        return 0;
      }
      const rawShare = (startAmount * survivorTarget) / totalStart;
      return Math.min(startAmount, Math.floor(rawShare));
    });
    let assigned = baseAllocations.reduce((sum, amount) => sum + amount, 0);
    let remaining = Math.max(0, survivorTarget - assigned);

    if (remaining > 0) {
      const remainders = starts
        .map((startAmount, index) => {
          if (startAmount <= 0) {
            return null;
          }
          const rawShare = (startAmount * survivorTarget) / totalStart;
          const baseAllocation = baseAllocations[index];
          return {
            index,
            fraction: rawShare - baseAllocation,
            startAmount,
          };
        })
        .filter((entry) => entry != null)
        .sort((left, right) => {
          if (right.fraction !== left.fraction) {
            return right.fraction - left.fraction;
          }
          if (right.startAmount !== left.startAmount) {
            return right.startAmount - left.startAmount;
          }
          return left.index - right.index;
        });

      for (const remainderEntry of remainders) {
        if (remaining <= 0) {
          break;
        }
        const index = Number(remainderEntry.index);
        if (baseAllocations[index] >= starts[index]) {
          continue;
        }
        baseAllocations[index] += 1;
        assigned += 1;
        remaining -= 1;
      }
    }

    if (assigned < survivorTarget) {
      for (let index = 0; index < starts.length && assigned < survivorTarget; index += 1) {
        while (baseAllocations[index] < starts[index] && assigned < survivorTarget) {
          baseAllocations[index] += 1;
          assigned += 1;
        }
      }
    }

    for (let index = 0; index < baseAllocations.length; index += 1) {
      distributed[index][unitId] = Math.max(0, Math.floor(Number(baseAllocations[index] ?? 0)));
    }
  }

  return distributed;
};

const applyCaravanBinarySurvivalRule = (startSelection, survivorsSelection) => {
  const normalizedStart = toCompleteUnitSelection(startSelection);
  const normalizedSurvivors = toCompleteUnitSelection(survivorsSelection);
  const survivingCombatUnits = COMBAT_ESCORT_UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Math.max(0, Math.floor(Number(normalizedSurvivors?.[unitId] ?? 0)));
    return sum + amount;
  }, 0);

  if (survivingCombatUnits <= 0) {
    normalizedSurvivors[CARAVAN_UNIT_ID] = 0;
    return normalizedSurvivors;
  }

  normalizedSurvivors[CARAVAN_UNIT_ID] = Math.max(0, Math.floor(Number(normalizedStart?.[CARAVAN_UNIT_ID] ?? 0)));
  return normalizedSurvivors;
};

const resolveArmyTacticalModifier = (selection, role) => {
  let totalCombatants = 0;
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0)));
    const stats = getBattleUnitStats(unitId);
    if (amount <= 0 || (Number(stats.attack) <= 0 && Number(stats.defense) <= 0)) {
      continue;
    }
    totalCombatants += amount;
  }

  if (totalCombatants <= 0) {
    return { multiplier: 1, notes: [] };
  }

  const share = (unitId) => Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0))) / totalCombatants;
  const cavalryShare = share('cavalry');
  const archerShare = share('archer');
  const scoutShare = share('scout');
  const militiaShare = share('militia');
  const hasKnight = Math.max(0, Math.floor(Number(selection?.[KNIGHT_UNIT_ID] ?? 0))) > 0;

  let multiplier = 1;
  const notes = [];

  if (role === 'attack') {
    const cavalryBonus = clampNumber(cavalryShare * 0.12, 0, 0.1);
    if (cavalryBonus > 0) {
      multiplier *= 1 + cavalryBonus;
      notes.push(`Jezdecky tlak: utok +${Math.round(cavalryBonus * 100)} %`);
    }
    const scoutBonus = clampNumber(scoutShare * 0.08, 0, 0.05);
    if (scoutBonus > 0) {
      multiplier *= 1 + scoutBonus;
      notes.push(`Prumysl zvedu: utok +${Math.round(scoutBonus * 100)} %`);
    }
    if (hasKnight) {
      multiplier *= 1.04;
      notes.push('Rytir vede armadu: utok +4 %');
    }
    if (militiaShare > 0.75) {
      multiplier *= 0.96;
      notes.push('Prebytek pechoty: utok -4 %');
    }
  } else {
    const archerBonus = clampNumber(archerShare * 0.1, 0, 0.08);
    if (archerBonus > 0) {
      multiplier *= 1 + archerBonus;
      notes.push(`Strelci drzi formaci: obrana +${Math.round(archerBonus * 100)} %`);
    }
    if (cavalryShare > 0.5 && archerShare < 0.1) {
      multiplier *= 0.95;
      notes.push('Mobilni obrana bez strelcu: obrana -5 %');
    }
    if (hasKnight) {
      multiplier *= 1.03;
      notes.push('Rytir drzi linii: obrana +3 %');
    }
  }

  return {
    multiplier: clampNumber(multiplier, 0.65, 1.6),
    notes,
  };
};

const getUnitAmountFromSelection = (selection, unitId) =>
  Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0)));

const isScoutOnlyAttackSelection = (selection) => {
  const totalUnits = sumSelectedUnits(selection);
  if (totalUnits <= 0) {
    return false;
  }
  const scoutCount = getUnitAmountFromSelection(selection, SCOUT_UNIT_ID);
  return scoutCount > 0 && scoutCount === totalUnits;
};

const toPositiveUnitIntelMap = (selection) => {
  const intel = {};
  for (const unitId of UNIT_ORDER) {
    const amount = getUnitAmountFromSelection(selection, unitId);
    if (amount <= 0) {
      continue;
    }
    intel[unitId] = amount;
  }
  return intel;
};

const toPositiveBuildingIntelMap = (buildingLevels) => {
  const intel = {};
  for (const buildingId of BUILDING_ORDER) {
    const level = Math.max(0, Math.floor(Number(buildingLevels?.[buildingId] ?? 0)));
    if (level <= 0) {
      continue;
    }
    intel[buildingId] = level;
  }
  return intel;
};

const buildApproximateIntelMap = (sourceMap, uncertaintyRatio, minimumVisible = 0) => {
  const approx = {};
  const normalizedUncertainty = clampNumber(Number(uncertaintyRatio), 0, 0.75);
  for (const [entryId, rawValue] of Object.entries(sourceMap ?? {})) {
    const value = Math.max(0, Math.floor(Number(rawValue ?? 0)));
    if (value <= 0) {
      continue;
    }

    const maxDeviation = Math.max(1, Math.round(value * normalizedUncertainty));
    const randomDeviation = Math.floor(Math.random() * (maxDeviation * 2 + 1)) - maxDeviation;
    const approxValue = Math.max(0, value + randomDeviation);
    if (approxValue <= 0 && value > 0 && minimumVisible > 0) {
      approx[entryId] = minimumVisible;
      continue;
    }
    approx[entryId] = approxValue;
  }
  return approx;
};

const resolveScoutCasualties = (attackerScoutCountRaw, defenderScoutCountRaw) => {
  const attackerScoutCount = Math.max(0, Math.floor(Number(attackerScoutCountRaw ?? 0)));
  const defenderScoutCount = Math.max(0, Math.floor(Number(defenderScoutCountRaw ?? 0)));
  if (attackerScoutCount <= 0) {
    return {
      losses: 0,
      survivors: 0,
      fullyDefended: true,
      defenderScoutsNeededForKill: 0,
    };
  }

  const defenderScoutsNeededForKill = Math.ceil(attackerScoutCount / 2);
  if (defenderScoutCount <= 0) {
    return {
      losses: 0,
      survivors: attackerScoutCount,
      fullyDefended: false,
      defenderScoutsNeededForKill,
    };
  }

  const fullyDefended = defenderScoutCount >= defenderScoutsNeededForKill;
  const losses = fullyDefended
    ? attackerScoutCount
    : Math.min(attackerScoutCount, defenderScoutCount * 2);
  const survivors = Math.max(0, attackerScoutCount - losses);

  return {
    losses,
    survivors,
    fullyDefended,
    defenderScoutsNeededForKill,
  };
};

const buildScoutIntelPayload = ({
  attackerScoutCount,
  scoutLosses,
  scoutSurvivors,
  defenderScoutCount,
  defenderUnitsSelection,
  defenderBuildingLevels,
}) => {
  const safeStart = Math.max(0, Math.floor(Number(attackerScoutCount ?? 0)));
  const safeLosses = Math.max(0, Math.floor(Number(scoutLosses ?? 0)));
  const safeSurvivors = Math.max(0, Math.floor(Number(scoutSurvivors ?? 0)));
  const hasLosses = safeLosses > 0;
  const hasSurvivors = safeSurvivors > 0;
  const quality = hasSurvivors ? (hasLosses ? 'approximate' : 'exact') : 'none';
  const lossRatio = safeStart > 0 ? safeLosses / safeStart : 1;

  const exactUnits = toPositiveUnitIntelMap(defenderUnitsSelection);
  const exactBuildings = toPositiveBuildingIntelMap(defenderBuildingLevels);
  const uncertainty = clampNumber(0.12 + lossRatio * 0.48, 0.18, 0.62);

  return {
    success: hasSurvivors,
    quality,
    approximate: quality === 'approximate',
    attackerScouts: {
      start: safeStart,
      losses: safeLosses,
      survivors: safeSurvivors,
    },
    defenderScouts: Math.max(0, Math.floor(Number(defenderScoutCount ?? 0))),
    uncertainty: quality === 'approximate' ? Number(uncertainty.toFixed(3)) : 0,
    intel: {
      units:
        quality === 'exact'
          ? exactUnits
          : quality === 'approximate'
            ? buildApproximateIntelMap(exactUnits, uncertainty, 1)
            : {},
      buildings:
        quality === 'exact'
          ? exactBuildings
          : quality === 'approximate'
            ? buildApproximateIntelMap(exactBuildings, uncertainty * 0.8, 1)
            : {},
    },
  };
};

const normalizeLootPriority = (rawValue) => {
  const normalized = String(rawValue ?? '')
    .trim()
    .toLowerCase();
  if (LOOT_PRIORITIES.includes(normalized)) {
    return normalized;
  }
  return LOOT_BALANCED_PRIORITY;
};

const getUnitLootCapacity = (unitId) => Math.max(0, Math.floor(Number(UNIT_LOOT_CAPACITY[unitId] ?? 0)));

const calculateLootCapacityFromSelection = (selection) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Math.max(0, Math.floor(Number(selection?.[unitId] ?? 0)));
    if (amount <= 0) {
      return sum;
    }
    return sum + amount * getUnitLootCapacity(unitId);
  }, 0);

const calculateBalancedLootDistribution = (resourcePocket, carryingCapacity) => {
  const loot = { wood: 0, stone: 0, iron: 0 };
  let remainingCapacity = Math.max(0, Math.floor(Number(carryingCapacity ?? 0)));
  if (remainingCapacity <= 0) {
    return { loot, total: 0 };
  }

  const remainingByResource = {};
  for (const resourceId of LOOT_RESOURCE_ORDER) {
    remainingByResource[resourceId] = Math.max(0, Math.floor(Number(resourcePocket[resourceId] ?? 0)));
  }

  while (remainingCapacity > 0) {
    const activeResources = LOOT_RESOURCE_ORDER.filter((resourceId) => remainingByResource[resourceId] > 0);
    if (activeResources.length === 0) {
      break;
    }

    const evenShare = Math.floor(remainingCapacity / activeResources.length);
    if (evenShare > 0) {
      let consumed = 0;
      for (const resourceId of activeResources) {
        if (remainingCapacity <= 0) {
          break;
        }
        const taken = Math.min(remainingByResource[resourceId], evenShare, remainingCapacity);
        if (taken <= 0) {
          continue;
        }
        loot[resourceId] += taken;
        remainingByResource[resourceId] -= taken;
        remainingCapacity -= taken;
        consumed += taken;
      }
      if (consumed > 0) {
        continue;
      }
    }

    let consumedOneByOne = 0;
    for (const resourceId of activeResources) {
      if (remainingCapacity <= 0) {
        break;
      }
      if (remainingByResource[resourceId] <= 0) {
        continue;
      }
      loot[resourceId] += 1;
      remainingByResource[resourceId] -= 1;
      remainingCapacity -= 1;
      consumedOneByOne += 1;
    }
    if (consumedOneByOne <= 0) {
      break;
    }
  }

  return {
    loot,
    total: loot.wood + loot.stone + loot.iron,
  };
};

const calculateLootDistribution = (resourcePocket, priority, carryingCapacity) => {
  if (priority === LOOT_BALANCED_PRIORITY) {
    return calculateBalancedLootDistribution(resourcePocket, carryingCapacity);
  }

  const loot = { wood: 0, stone: 0, iron: 0 };
  let remainingCapacity = Math.max(0, Math.floor(Number(carryingCapacity ?? 0)));
  if (remainingCapacity <= 0) {
    return { loot, total: 0 };
  }

  const normalizedPriority = LOOT_RESOURCE_ORDER.includes(priority) ? priority : LOOT_RESOURCE_ORDER[0];
  const order = [normalizedPriority, ...LOOT_RESOURCE_ORDER.filter((resourceId) => resourceId !== normalizedPriority)];
  for (const resourceId of order) {
    if (remainingCapacity <= 0) {
      break;
    }

    const available = Math.max(0, Math.floor(Number(resourcePocket[resourceId] ?? 0)));
    if (available <= 0) {
      continue;
    }
    const taken = Math.min(available, remainingCapacity);
    loot[resourceId] = taken;
    remainingCapacity -= taken;
  }

  return {
    loot,
    total: loot.wood + loot.stone + loot.iron,
  };
};

const resolveVillageResourceCaps = (buildingLevels) => {
  const warehouseCap = calculateResourceCap(buildingLevels.warehouse ?? 0);
  const mintLevel = Math.max(0, Math.floor(Number(buildingLevels.mint ?? 0)));
  const goldCap = mintLevel > 0 ? calculateMintGoldStorageCap(mintLevel) : 1000;
  const coinCap = mintLevel > 0 ? calculateMintCoinStorageCap(mintLevel) : 1000;
  return {
    wood: warehouseCap,
    stone: warehouseCap,
    iron: warehouseCap,
    gold: Math.max(0, Math.floor(Number(goldCap ?? 0))),
    coins: Math.max(0, Math.floor(Number(coinCap ?? 0))),
  };
};

const writeVillageResources = (villageId, pocket, syncAtIso = nowIso()) => {
  updateResourcesStmt.run(
    roundResource(Number(pocket.wood ?? 0)),
    roundResource(Number(pocket.stone ?? 0)),
    roundResource(Number(pocket.iron ?? 0)),
    roundResource(Number(pocket.gold ?? 0)),
    roundResource(Number(pocket.coins ?? 0)),
    String(syncAtIso),
    Number(villageId),
  );
};

const getReadModelRevision = () =>
  Math.max(0, Math.floor(Number(selectDatabaseChangeCounterStmt.get()?.totalChanges ?? 0)));

const getReadModelTimeBucket = (referenceIso, bucketMs) => {
  const referenceMs = Date.parse(String(referenceIso ?? nowIso()));
  if (!Number.isFinite(referenceMs)) {
    return 0;
  }
  return Math.max(0, Math.floor(referenceMs / Math.max(1, Number(bucketMs) || 1)));
};

const buildStateReadModelVersion = (referenceIso = nowIso()) =>
  `state:r${getReadModelRevision()}:t${getReadModelTimeBucket(referenceIso, STATE_READ_MODEL_BUCKET_MS)}`;

const buildWorldMapReadModelVersion = (referenceIso = nowIso()) =>
  `world:r${getReadModelRevision()}:t${getReadModelTimeBucket(referenceIso, WORLD_MAP_READ_MODEL_BUCKET_MS)}`;

const cacheWorldMapReadModel = (cacheKey, value) => {
  if (worldMapReadModelCache.has(cacheKey)) {
    worldMapReadModelCache.delete(cacheKey);
  }
  worldMapReadModelCache.set(cacheKey, value);
  while (worldMapReadModelCache.size > WORLD_MAP_CACHE_LIMIT) {
    const oldestKey = worldMapReadModelCache.keys().next().value;
    if (oldestKey == null) {
      break;
    }
    worldMapReadModelCache.delete(oldestKey);
  }
  return value;
};

const synchronizeVillageEconomyAt = (villageId, referenceIso = nowIso(), options = {}) => {
  const persist = options?.persist !== false;
  const numericVillageId = Number(villageId);
  if (!Number.isFinite(numericVillageId) || numericVillageId <= 0) {
    return null;
  }

  const resourceRow = selectResourcesByVillageStmt.get(numericVillageId);
  if (!resourceRow) {
    return null;
  }

  const referenceMs = Date.parse(String(referenceIso));
  if (!Number.isFinite(referenceMs)) {
    return resourceRow;
  }

  const lastSyncMs = resourceRow?.lastSyncAt ? Date.parse(String(resourceRow.lastSyncAt)) : Number.NaN;
  const effectiveLastSyncMs = Number.isFinite(lastSyncMs) ? lastSyncMs : referenceMs;
  const elapsedSec = Math.max(0, (referenceMs - effectiveLastSyncMs) / 1000);

  if (elapsedSec <= 0) {
    if (!Number.isFinite(lastSyncMs)) {
      const snapshot = {
        wood: Number(resourceRow.wood ?? 0),
        stone: Number(resourceRow.stone ?? 0),
        iron: Number(resourceRow.iron ?? 0),
        gold: Number(resourceRow.gold ?? 0),
        coins: Number(resourceRow.coins ?? 0),
        lastSyncAt: String(referenceIso),
      };
      if (!persist) {
        return snapshot;
      }
      writeVillageResources(
        numericVillageId,
        snapshot,
        referenceIso,
      );
      return selectResourcesByVillageStmt.get(numericVillageId);
    }
    return resourceRow;
  }

  const villageRow = selectVillageByIdStmt.get(numericVillageId);
  const villageRegion = Number(villageRow?.region ?? DEFAULT_WORLD_REGION_ID);
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(numericVillageId));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(numericVillageId));
  const awayUnitCounts = getVillageAwayUnitCounts(numericVillageId);
  const resourceCaps = resolveVillageResourceCaps(buildingLevels);
  const activeAcademicsInVillage = Math.max(
    0,
    Math.floor(Number(countActiveAcademicsByVillageStmt.get(numericVillageId)?.total ?? 0)),
  );
  const populationSnapshot = getVillagePopulationStatus(numericVillageId, {
    buildingLevels,
    unitCounts,
    awayUnitCounts,
    academicCount: activeAcademicsInVillage,
  });
  const baseProduction = calculateProductionPerHour(
    buildingLevels,
    populationSnapshot.populationUsed,
    populationSnapshot.populationCap,
  );
  const world = resolveWorldByRegion(villageRegion);
  const developerBoost = resolveDeveloperResourceBoostForWorld(world, referenceMs);
  const production = applyProductionMultiplier(baseProduction, developerBoost.multiplier);

  let nextWood = applyCappedResourceDeltaPreservingOverflow(
    Number(resourceRow.wood ?? 0),
    (production.wood * elapsedSec) / 3600,
    resourceCaps.wood,
  );
  let nextStone = applyCappedResourceDeltaPreservingOverflow(
    Number(resourceRow.stone ?? 0),
    (production.stone * elapsedSec) / 3600,
    resourceCaps.stone,
  );
  let nextIron = applyCappedResourceDeltaPreservingOverflow(
    Number(resourceRow.iron ?? 0),
    (production.iron * elapsedSec) / 3600,
    resourceCaps.iron,
  );
  let nextGold = applyCappedResourceDeltaPreservingOverflow(
    Number(resourceRow.gold ?? 0),
    (Number(production.gold ?? 0) * elapsedSec) / 3600,
    resourceCaps.gold,
  );
  let nextCoins = Math.max(0, Number(resourceRow.coins ?? 0));

  const mintLevel = Math.max(0, Math.floor(Number(buildingLevels.mint ?? 0)));
  if (mintLevel > 0 && resourceCaps.coins > 0) {
    const throughputPerHour = Math.max(0, Number(calculateMintThroughputPerHour(mintLevel) ?? 0));
    const mintLimitByTime = (throughputPerHour * elapsedSec) / 3600;
    const coinStorageRemaining = Math.max(0, resourceCaps.coins - nextCoins);
    const mintable = Math.max(0, Math.min(nextGold, mintLimitByTime, coinStorageRemaining));
    if (mintable > 0) {
      nextGold = applyCappedResourceDeltaPreservingOverflow(nextGold, -mintable, resourceCaps.gold);
      nextCoins = applyCappedResourceDeltaPreservingOverflow(nextCoins, mintable, resourceCaps.coins);
    }
  }

  const snapshot = {
    wood: nextWood,
    stone: nextStone,
    iron: nextIron,
    gold: nextGold,
    coins: nextCoins,
    lastSyncAt: String(referenceIso),
  };
  if (!persist) {
    return snapshot;
  }

  writeVillageResources(
    numericVillageId,
    snapshot,
    referenceIso,
  );
  return selectResourcesByVillageStmt.get(numericVillageId);
};

const applyResourceDeltaWithCap = (villageId, delta) => {
  const resourceRow = synchronizeVillageEconomyAt(Number(villageId));
  if (!resourceRow) {
    return { applied: { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 }, next: null };
  }

  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(villageId)));
  const caps = resolveVillageResourceCaps(buildingLevels);
  const current = {
    wood: Number(resourceRow.wood),
    stone: Number(resourceRow.stone),
    iron: Number(resourceRow.iron),
    gold: Number(resourceRow.gold ?? 0),
    coins: Number(resourceRow.coins ?? 0),
  };
  const requested = {
    wood: Number(delta.wood ?? 0),
    stone: Number(delta.stone ?? 0),
    iron: Number(delta.iron ?? 0),
    gold: Number(delta.gold ?? 0),
    coins: Number(delta.coins ?? 0),
  };
  const next = {
    wood: applyCappedResourceDeltaPreservingOverflow(current.wood, requested.wood, caps.wood),
    stone: applyCappedResourceDeltaPreservingOverflow(current.stone, requested.stone, caps.stone),
    iron: applyCappedResourceDeltaPreservingOverflow(current.iron, requested.iron, caps.iron),
    gold: applyCappedResourceDeltaPreservingOverflow(current.gold, requested.gold, caps.gold),
    coins: applyCappedResourceDeltaPreservingOverflow(current.coins, requested.coins, caps.coins),
  };
  const applied = {
    wood: Math.round(next.wood - current.wood),
    stone: Math.round(next.stone - current.stone),
    iron: Math.round(next.iron - current.iron),
    gold: Math.round(next.gold - current.gold),
    coins: Math.round(next.coins - current.coins),
  };

  writeVillageResources(Number(villageId), next);

  return {
    applied,
    next,
  };
};

const addResourcesWithoutCap = (villageId, delta) => {
  const resourceRow = synchronizeVillageEconomyAt(Number(villageId));
  if (!resourceRow) {
    return { added: { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 }, next: null };
  }

  const current = {
    wood: Number(resourceRow.wood),
    stone: Number(resourceRow.stone),
    iron: Number(resourceRow.iron),
    gold: Number(resourceRow.gold ?? 0),
    coins: Number(resourceRow.coins ?? 0),
  };
  const added = {
    wood: Math.max(0, Math.floor(Number(delta.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(delta.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(delta.iron ?? 0))),
    gold: Math.max(0, Math.floor(Number(delta.gold ?? 0))),
    coins: Math.max(0, Math.floor(Number(delta.coins ?? 0))),
  };
  const next = {
    wood: current.wood + added.wood,
    stone: current.stone + added.stone,
    iron: current.iron + added.iron,
    gold: current.gold + added.gold,
    coins: current.coins + added.coins,
  };

  writeVillageResources(Number(villageId), next);

  return {
    added,
    next,
  };
};

const toNonNegativeResourcePocket = (rawResources) => ({
  wood: Math.max(0, Math.floor(Number(rawResources?.wood ?? 0))),
  stone: Math.max(0, Math.floor(Number(rawResources?.stone ?? 0))),
  iron: Math.max(0, Math.floor(Number(rawResources?.iron ?? 0))),
  gold: Math.max(0, Math.floor(Number(rawResources?.gold ?? 0))),
  coins: Math.max(0, Math.floor(Number(rawResources?.coins ?? 0))),
});

const calculateLootProtectionPocket = (buildingLevels) => {
  const protectedPerResource = Math.max(0, Math.floor(calculateHideoutProtectedAmount(buildingLevels?.hideout ?? 0)));
  return {
    wood: protectedPerResource,
    stone: protectedPerResource,
    iron: protectedPerResource,
  };
};

const calculateLootableResourcePocket = (resourcePocket, protectedPocket) => ({
  wood: Math.max(0, Math.floor(Number(resourcePocket?.wood ?? 0)) - Math.floor(Number(protectedPocket?.wood ?? 0))),
  stone: Math.max(0, Math.floor(Number(resourcePocket?.stone ?? 0)) - Math.floor(Number(protectedPocket?.stone ?? 0))),
  iron: Math.max(0, Math.floor(Number(resourcePocket?.iron ?? 0)) - Math.floor(Number(protectedPocket?.iron ?? 0))),
});

const calculateCurrencyProtectionPocket = (buildingLevels) => {
  const protection = calculateVaultProtection(buildingLevels?.vault ?? 0);
  return {
    gold: Math.max(0, Math.floor(Number(protection.gold ?? 0))),
    coins: Math.max(0, Math.floor(Number(protection.coins ?? 0))),
  };
};

const subtractResources = (
  villageId,
  delta,
  minimumRemaining = { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 },
) => {
  const resourceRow = synchronizeVillageEconomyAt(Number(villageId));
  if (!resourceRow) {
    return { taken: { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 }, next: null };
  }

  const current = toNonNegativeResourcePocket(resourceRow);
  const requested = toNonNegativeResourcePocket(delta);
  const floorPocket = toNonNegativeResourcePocket(minimumRemaining);
  const taken = {
    wood: Math.min(Math.max(0, current.wood - floorPocket.wood), requested.wood),
    stone: Math.min(Math.max(0, current.stone - floorPocket.stone), requested.stone),
    iron: Math.min(Math.max(0, current.iron - floorPocket.iron), requested.iron),
    gold: Math.min(Math.max(0, current.gold - floorPocket.gold), requested.gold),
    coins: Math.min(Math.max(0, current.coins - floorPocket.coins), requested.coins),
  };
  const next = {
    wood: Math.max(0, current.wood - taken.wood),
    stone: Math.max(0, current.stone - taken.stone),
    iron: Math.max(0, current.iron - taken.iron),
    gold: Math.max(0, current.gold - taken.gold),
    coins: Math.max(0, current.coins - taken.coins),
  };

  writeVillageResources(Number(villageId), next);

  return { taken, next };
};

const updateVillagePrestigeFromCurrentState = (villageId) => {
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(villageId)));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(Number(villageId)));
  updateVillagePrestigeStmt.run(calculateVillagePrestige(buildingLevels, unitCounts), Number(villageId));
};

const createBattleReport = ({
  playerId,
  originVillageId,
  targetVillageId,
  battleAt,
  title,
  summary,
  payload,
}) => {
  if (!Number.isFinite(Number(playerId)) || Number(playerId) <= 0) {
    return null;
  }

  const createdAt = nowIso();
  const result = insertBattleReportStmt.run(
    Number(playerId),
    originVillageId == null ? null : Number(originVillageId),
    targetVillageId == null ? null : Number(targetVillageId),
    battleAt,
    createdAt,
    String(title),
    String(summary),
    JSON.stringify(payload ?? {}),
  );

  const reportId = Number(result.lastInsertRowid);
  const payloadRecord = payload && typeof payload === 'object' ? payload : {};
  const perspective = String(payloadRecord.perspective ?? '')
    .trim()
    .toLowerCase();
  const role = String(payloadRecord.role ?? '')
    .trim()
    .toLowerCase();
  const outcome = String(payloadRecord.outcome ?? '')
    .trim()
    .toLowerCase();
  let severity = 'info';
  if (perspective === 'attacker' && outcome === 'attacker_victory') {
    severity = 'success';
  } else if (perspective === 'attacker' && outcome === 'defender_victory') {
    severity = 'warning';
  } else if (perspective === 'defender' && outcome === 'attacker_victory') {
    severity = 'critical';
  } else if (perspective === 'defender' && outcome === 'defender_victory') {
    severity = 'success';
  }
  if (role === 'spy' && outcome === 'defender_victory' && perspective === 'attacker') {
    severity = 'warning';
  }
  if (payloadRecord?.conquest?.conquered === true) {
    severity = perspective === 'attacker' ? 'success' : 'critical';
  }

  const originVillage = originVillageId == null ? null : selectVillageByIdStmt.get(Number(originVillageId));
  const targetVillage = targetVillageId == null ? null : selectVillageByIdStmt.get(Number(targetVillageId));
  const fallbackVillage = selectVillageByPlayerStmt.get(Number(playerId));
  const resolvedRegion = Number(
    originVillage?.region ??
      targetVillage?.region ??
      fallbackVillage?.region ??
      WORLD_CATALOG[0]?.region ??
      1,
  );

  createPlayerNotification({
    playerId: Number(playerId),
    region: resolvedRegion,
    category: role === 'spy' ? 'spy' : role === 'support' ? 'support' : 'combat',
    eventType: role === 'spy' ? 'spy_report' : role === 'support' ? 'support_report' : 'battle_report',
    severity,
    title: String(title),
    summary: String(summary),
    payload: {
      reportId,
      battleAt,
      perspective,
      role: role || null,
      outcome: outcome || null,
      originVillageId: originVillageId == null ? null : Number(originVillageId),
      targetVillageId: targetVillageId == null ? null : Number(targetVillageId),
    },
    sourceType: 'battle_report',
    sourceId: reportId,
    createdAt,
  });

  return reportId;
};

const simulateAttackBattle = ({
  attackerUnitsRaw,
  defenderUnitsRaw,
  defenderBuildingLevels,
  attackerPrestige = 0,
  defenderPrestige = 0,
  retaliationOverrideApplied = false,
  battleTimeIso = nowIso(),
}) => {
  const attackerStartUnits = toCompleteUnitSelection(attackerUnitsRaw);
  const attackerUnits = toCompleteUnitSelection(attackerUnitsRaw);
  const defenderStartUnits = toCompleteUnitSelection(defenderUnitsRaw);
  const defenderUnits = toCompleteUnitSelection(defenderUnitsRaw);
  const gateLevelStart = Math.max(0, Math.floor(Number(defenderBuildingLevels.gate ?? 0)));
  const fortificationLevel = Math.max(0, Math.floor(Number(defenderBuildingLevels.fortification ?? 0)));
  let gateLevel = gateLevelStart;
  const hasFortification = fortificationLevel > 0;
  const defenderArchers = Number(defenderUnits.archer ?? 0);
  const defenderUnitsTotal = sumSelectedUnits(defenderUnits);
  const defenderHasUnits = defenderUnitsTotal > 0;
  let gateDamage = 0;
  let ramsConsumedOnGate = 0;

  const bonuses = [];
  const prestigeAttackModifier = calculateAttackModifier(attackerPrestige, defenderPrestige);
  const prestigeDefenseBonus = calculateDefenseBonus(attackerPrestige, defenderPrestige);
  const prestigeLootModifier = calculateLootModifier(attackerPrestige, defenderPrestige);
  const resolvedPrestigeBalance = resolveCombatBalance(attackerPrestige, defenderPrestige);
  const prestigeBalance = {
    ...resolvedPrestigeBalance,
    attackAllowed: Boolean(resolvedPrestigeBalance.attackAllowed || retaliationOverrideApplied),
    retaliationOverrideApplied: Boolean(retaliationOverrideApplied),
    attackModifier: Number(prestigeAttackModifier.toFixed(4)),
    defenseBonus: Number(prestigeDefenseBonus.toFixed(4)),
    defenseMultiplier: Number((1 + prestigeDefenseBonus).toFixed(4)),
    lootModifier: Number(prestigeLootModifier.toFixed(4)),
  };
  if (prestigeAttackModifier < 1) {
    bonuses.push(`Balanc prestize: utok x${prestigeAttackModifier.toFixed(2)}.`);
  }
  if (prestigeDefenseBonus > 0) {
    bonuses.push(`Balanc prestize: obrana +${Math.round(prestigeDefenseBonus * 100)} %.`);
  }
  if (prestigeLootModifier < 1) {
    bonuses.push(`Balanc prestize: korist x${prestigeLootModifier.toFixed(2)}.`);
  }
  if (retaliationOverrideApplied) {
    bonuses.push('Balanc prestize: odvetny utok byl povolen po predchozi agresi cile.');
  }
  const isNightDefenseWindow = isNightModeAtTime(battleTimeIso);

  if (gateLevel > 0) {
    const availableRams = Math.max(0, Math.floor(Number(attackerUnits.ram ?? 0)));
    if (availableRams > 0) {
      gateDamage = Math.min(gateLevel, availableRams);
      gateLevel -= gateDamage;
      ramsConsumedOnGate = gateDamage;
      attackerUnits.ram = Math.max(0, availableRams - ramsConsumedOnGate);
      bonuses.push(`Beranidla prorazila ${gateDamage} uroven brany.`);
      bonuses.push(`Beranidla spotrebovana pri prorazeni: ${ramsConsumedOnGate}.`);
    }
  }

  const gateStillStanding = gateLevel > 0;
  const hasAttackingRam = Number(attackerUnits.ram ?? 0) > 0;
  const blockedByGate = gateStillStanding && hasFortification && !hasAttackingRam;

  if (blockedByGate) {
    let retreatLossRatio = 0;
    if (defenderHasUnits && defenderArchers > 0) {
      const archerPressure = Math.log2(defenderArchers + 1) * 0.018;
      const fortificationPressure = 0.01 + fortificationLevel * 0.006;
      retreatLossRatio = clampNumber(archerPressure + fortificationPressure, 0.015, 0.24);
      bonuses.push('Brana s opevnenim zastavila utok bez beranidel.');
      bonuses.push('Lucistnici ostrelovali utocnika pri ustupu.');
    } else {
      bonuses.push('Brana s opevnenim zastavila utok bez beranidel.');
      bonuses.push('Bez obranne posadky nevznikly utocnikovi bojove ztraty.');
    }

    const attackerAfterLoss =
      retreatLossRatio > 0 ? applyCasualties(attackerUnits, retreatLossRatio) : { survivors: toCompleteUnitSelection(attackerUnits) };
    const attackerSurvivors = applyCaravanBinarySurvivalRule(attackerStartUnits, attackerAfterLoss.survivors);
    const attackerLosses = buildLossesFromStartAndSurvivors(attackerStartUnits, attackerSurvivors);
    const defenderSurvivors = toCompleteUnitSelection(defenderStartUnits);
    const defenderLosses = buildLossesFromStartAndSurvivors(defenderStartUnits, defenderSurvivors);
    const attackerStartTotal = sumSelectedUnits(attackerStartUnits);
    const defenderStartTotal = sumSelectedUnits(defenderStartUnits);
    const attackerSurvivorsTotal = sumSelectedUnits(attackerSurvivors);
    const defenderSurvivorsTotal = sumSelectedUnits(defenderSurvivors);
    const attackerLossesTotal = sumSelectedUnits(attackerLosses);
    const defenderLossesTotal = sumSelectedUnits(defenderLosses);

    const baseAttackPower = sumCombatPower(attackerUnits, 'attack');
    const baseDefensePower = sumCombatPower(defenderUnits, 'defense');
    const effectiveAttackPower = baseAttackPower * prestigeAttackModifier;
    const effectiveDefensePower = baseDefensePower * (1 + prestigeDefenseBonus);
    return {
      attackerWins: false,
      attackerRetreated: attackerSurvivorsTotal > 0,
      nightModeDefenseApplied: isNightDefenseWindow,
      blockedByGate: true,
      gateDamageLossRatio: Number(retreatLossRatio.toFixed(4)),
      baseAttackPower: Number(baseAttackPower.toFixed(2)),
      baseDefensePower: Number(baseDefensePower.toFixed(2)),
      finalAttackPower: Number(effectiveAttackPower.toFixed(2)),
      finalDefensePower: Number(effectiveDefensePower.toFixed(2)),
      attackMultiplier: Number(prestigeAttackModifier.toFixed(3)),
      defenseMultiplier: Number((1 + prestigeDefenseBonus).toFixed(3)),
      bonuses,
      prestigeBalance,
      attackerLossRatio: Number((attackerStartTotal > 0 ? attackerLossesTotal / attackerStartTotal : 0).toFixed(4)),
      defenderLossRatio: Number((defenderStartTotal > 0 ? defenderLossesTotal / defenderStartTotal : 0).toFixed(4)),
      gate: {
        startLevel: gateLevelStart,
        endLevel: gateLevel,
        damagedLevels: gateDamage,
        ramsConsumed: ramsConsumedOnGate,
        blockedByFortifiedGate: true,
        retreatLossRatio: Number(retreatLossRatio.toFixed(4)),
      },
      attacker: {
        start: attackerStartUnits,
        losses: attackerLosses,
        survivors: attackerSurvivors,
        survivorsTotal: attackerSurvivorsTotal,
      },
      defender: {
        start: defenderStartUnits,
        losses: defenderLosses,
        survivors: defenderSurvivors,
        survivorsTotal: defenderSurvivorsTotal,
      },
    };
  }

  if (!defenderHasUnits) {
    bonuses.push('Osada byla prazdna - utocnik neutrpel bojove ztraty.');
    const attackerSurvivors = applyCaravanBinarySurvivalRule(attackerStartUnits, attackerUnits);
    const attackerLosses = buildLossesFromStartAndSurvivors(attackerStartUnits, attackerSurvivors);
    const defenderSurvivors = toCompleteUnitSelection(defenderStartUnits);
    const defenderLosses = buildLossesFromStartAndSurvivors(defenderStartUnits, defenderSurvivors);
    const attackerStartTotal = sumSelectedUnits(attackerStartUnits);
    const attackerLossesTotal = sumSelectedUnits(attackerLosses);
    const defenderStartTotal = sumSelectedUnits(defenderStartUnits);
    const defenderLossesTotal = sumSelectedUnits(defenderLosses);
    const baseAttackPower = sumCombatPower(attackerUnits, 'attack');
    const baseDefensePower = sumCombatPower(defenderUnits, 'defense');
    const effectiveAttackPower = baseAttackPower * prestigeAttackModifier;
    const effectiveDefensePower = baseDefensePower * (1 + prestigeDefenseBonus);

    return {
      attackerWins: true,
      attackerRetreated: false,
      nightModeDefenseApplied: isNightDefenseWindow,
      blockedByGate: false,
      gateDamageLossRatio: 0,
      baseAttackPower: Number(baseAttackPower.toFixed(2)),
      baseDefensePower: Number(baseDefensePower.toFixed(2)),
      finalAttackPower: Number(effectiveAttackPower.toFixed(2)),
      finalDefensePower: Number(effectiveDefensePower.toFixed(2)),
      attackMultiplier: Number(prestigeAttackModifier.toFixed(3)),
      defenseMultiplier: Number((1 + prestigeDefenseBonus).toFixed(3)),
      bonuses,
      prestigeBalance,
      attackerLossRatio: Number((attackerStartTotal > 0 ? attackerLossesTotal / attackerStartTotal : 0).toFixed(4)),
      defenderLossRatio: Number((defenderStartTotal > 0 ? defenderLossesTotal / defenderStartTotal : 0).toFixed(4)),
      gate: {
        startLevel: gateLevelStart,
        endLevel: gateLevel,
        damagedLevels: gateDamage,
        ramsConsumed: ramsConsumedOnGate,
        blockedByFortifiedGate: false,
        retreatLossRatio: 0,
      },
      attacker: {
        start: attackerStartUnits,
        losses: attackerLosses,
        survivors: attackerSurvivors,
        survivorsTotal: sumSelectedUnits(attackerSurvivors),
      },
      defender: {
        start: defenderStartUnits,
        losses: defenderLosses,
        survivors: defenderSurvivors,
        survivorsTotal: sumSelectedUnits(defenderSurvivors),
      },
    };
  }

  let attackMultiplier = prestigeAttackModifier;
  let defenseMultiplier = 1 + prestigeDefenseBonus;
  const attackerTactical = resolveArmyTacticalModifier(attackerUnits, 'attack');
  const defenderTactical = resolveArmyTacticalModifier(defenderUnits, 'defense');
  attackMultiplier *= attackerTactical.multiplier;
  defenseMultiplier *= defenderTactical.multiplier;
  bonuses.push(...attackerTactical.notes);
  bonuses.push(...defenderTactical.notes);

  if (gateStillStanding) {
    defenseMultiplier *= 1.08;
    bonuses.push('Brana drzi vstup: obrana +8 %');
    if (hasAttackingRam) {
      attackMultiplier *= 1.04;
      bonuses.push('Beranidla tlaci na vstup: utok +4 %');
    }
  }

  if (hasFortification) {
    const fortificationDefenseBonus = Math.min(0.38, fortificationLevel * 0.028);
    defenseMultiplier *= 1 + fortificationDefenseBonus;
    bonuses.push(`Opevneni: obrana +${Math.round(fortificationDefenseBonus * 100)} %`);
    if (defenderArchers > 0) {
      const archerWallBonus = Math.min(0.18, fortificationLevel * 0.018);
      defenseMultiplier *= 1 + archerWallBonus;
      bonuses.push(`Lucistnici na hradbach: obrana +${Math.round(archerWallBonus * 100)} %`);
    }
  }

  if (isNightDefenseWindow) {
    defenseMultiplier *= 2;
    bonuses.push('Nocni rezim: obrance +100 % obrany');
  }

  let ramSupportApplied = false;
  if (!gateStillStanding && hasAttackingRam) {
    attackMultiplier *= RAM_ATTACK_SUPPORT_MULTIPLIER;
    ramSupportApplied = true;
    bonuses.push('Prezivsi beranidla koordinovala utok: utok +10 %');
  }

  const baseAttackPower = sumCombatPower(attackerUnits, 'attack');
  const baseDefensePower = sumCombatPower(defenderUnits, 'defense');
  const attackerHealthPool = Math.max(1, sumHealthPool(attackerUnits));
  const defenderHealthPool = Math.max(1, sumHealthPool(defenderUnits));

  const resolveLossRatios = (computedFinalAttackPower, computedFinalDefensePower, attackerWon) => {
    const totalPower = Math.max(1, computedFinalAttackPower + computedFinalDefensePower);
    const attackShare = clampNumber(computedFinalAttackPower / totalPower, 0, 1);
    const defenseShare = clampNumber(computedFinalDefensePower / totalPower, 0, 1);
    const attackerHealthPressure = clampNumber(Math.sqrt((defenderHealthPool + 1) / (attackerHealthPool + 1)), 0.65, 1.35);
    const defenderHealthPressure = clampNumber(Math.sqrt((attackerHealthPool + 1) / (defenderHealthPool + 1)), 0.65, 1.35);

    if (attackerWon) {
      return {
        attackerLossRatio: clampNumber(
          (0.035 + Math.pow(defenseShare, 1.25) * 0.36) * attackerHealthPressure,
          0.01,
          0.72,
        ),
        defenderLossRatio: clampNumber(
          (0.78 + Math.pow(attackShare, 0.6) * 0.34) * defenderHealthPressure,
          0.68,
          1,
        ),
      };
    }

    return {
      attackerLossRatio: clampNumber(
        (0.62 + Math.pow(defenseShare, 0.9) * 0.34) * attackerHealthPressure,
        0.58,
        1,
      ),
      defenderLossRatio: clampNumber(
        (0.08 + Math.pow(attackShare, 1.2) * 0.42) * defenderHealthPressure,
        0.04,
        0.76,
      ),
    };
  };

  let finalAttackPower = baseAttackPower * attackMultiplier;
  let finalDefensePower = baseDefensePower * defenseMultiplier;
  let attackerWins = finalAttackPower > finalDefensePower;
  let { attackerLossRatio, defenderLossRatio } = resolveLossRatios(finalAttackPower, finalDefensePower, attackerWins);

  let attackerAfterLoss = applyCasualties(attackerUnits, attackerLossRatio);
  let defenderAfterLoss = applyCasualties(defenderUnits, defenderLossRatio);

  if (ramSupportApplied && Number(attackerAfterLoss.survivors.ram ?? 0) <= 0) {
    attackMultiplier /= RAM_ATTACK_SUPPORT_MULTIPLIER;
    bonuses.push('Beranidla padla v boji, bonus utoku se neuplatnil.');
    finalAttackPower = baseAttackPower * attackMultiplier;
    finalDefensePower = baseDefensePower * defenseMultiplier;
    attackerWins = finalAttackPower > finalDefensePower;
    const ratios = resolveLossRatios(finalAttackPower, finalDefensePower, attackerWins);
    attackerLossRatio = ratios.attackerLossRatio;
    defenderLossRatio = ratios.defenderLossRatio;
    attackerAfterLoss = applyCasualties(attackerUnits, attackerLossRatio);
    defenderAfterLoss = applyCasualties(defenderUnits, defenderLossRatio);
  }

  let attackerSurvivors = toCompleteUnitSelection(attackerAfterLoss.survivors);
  let defenderSurvivors = toCompleteUnitSelection(defenderAfterLoss.survivors);
  if (attackerWins) {
    defenderSurvivors = toCompleteUnitSelection({});
    defenderLossRatio = 1;
  } else {
    attackerSurvivors = toCompleteUnitSelection({});
    attackerLossRatio = 1;
  }
  attackerSurvivors = applyCaravanBinarySurvivalRule(attackerStartUnits, attackerSurvivors);
  const attackerLosses = buildLossesFromStartAndSurvivors(attackerStartUnits, attackerSurvivors);
  const defenderLosses = buildLossesFromStartAndSurvivors(defenderStartUnits, defenderSurvivors);
  const attackerSurvivorsTotal = sumSelectedUnits(attackerSurvivors);
  const defenderSurvivorsTotal = sumSelectedUnits(defenderSurvivors);

  return {
    attackerWins,
    attackerRetreated: !attackerWins && attackerSurvivorsTotal > 0,
    nightModeDefenseApplied: isNightDefenseWindow,
    blockedByGate: false,
    gateDamageLossRatio: 0,
    baseAttackPower: Number(baseAttackPower.toFixed(2)),
    baseDefensePower: Number(baseDefensePower.toFixed(2)),
    finalAttackPower: Number(finalAttackPower.toFixed(2)),
    finalDefensePower: Number(finalDefensePower.toFixed(2)),
    attackMultiplier: Number(attackMultiplier.toFixed(3)),
    defenseMultiplier: Number(defenseMultiplier.toFixed(3)),
    bonuses,
    prestigeBalance,
    attackerLossRatio: Number(attackerLossRatio.toFixed(4)),
    defenderLossRatio: Number(defenderLossRatio.toFixed(4)),
    gate: {
      startLevel: gateLevelStart,
      endLevel: gateLevel,
      damagedLevels: gateDamage,
      ramsConsumed: ramsConsumedOnGate,
      blockedByFortifiedGate: false,
      retreatLossRatio: 0,
    },
    attacker: {
      start: attackerStartUnits,
      losses: attackerLosses,
      survivors: attackerSurvivors,
      survivorsTotal: attackerSurvivorsTotal,
    },
    defender: {
      start: defenderStartUnits,
      losses: defenderLosses,
      survivors: defenderSurvivors,
      survivorsTotal: defenderSurvivorsTotal,
    },
  };
};

const toMovementWithUnits = (movementRow) => {
  const units = selectMovementUnitsStmt.all(Number(movementRow.id)).map((unitRow) => ({
    unitId: unitRow.unitId,
    amount: Number(unitRow.amount),
  }));
  const distance = Math.max(
    Math.abs(Number(movementRow.targetCoordX) - Number(movementRow.originCoordX)),
    Math.abs(Number(movementRow.targetCoordY) - Number(movementRow.originCoordY)),
  );
  const remainingSec = Math.max(0, Math.ceil((Date.parse(movementRow.arriveAt) - Date.now()) / 1000));

  return {
    id: Number(movementRow.id),
    commandType: movementRow.commandType,
    commanderPlayerId:
      movementRow.commanderPlayerId == null ? null : Number(movementRow.commanderPlayerId),
    commanderUsername:
      movementRow.commanderUsername == null ? null : String(movementRow.commanderUsername),
    originVillageId: Number(movementRow.originVillageId),
    targetVillageId: Number(movementRow.targetVillageId),
    homeVillageId: Number(movementRow.homeVillageId),
    lootPriority: movementRow.lootPriority == null ? null : String(movementRow.lootPriority),
    carryWood: Math.max(0, Number(movementRow.carryWood ?? 0)),
    carryStone: Math.max(0, Number(movementRow.carryStone ?? 0)),
    carryIron: Math.max(0, Number(movementRow.carryIron ?? 0)),
    originName: movementRow.originName,
    originCoordX: Number(movementRow.originCoordX),
    originCoordY: Number(movementRow.originCoordY),
    targetName: movementRow.targetName,
    targetCoordX: Number(movementRow.targetCoordX),
    targetCoordY: Number(movementRow.targetCoordY),
    homeName: movementRow.homeName,
    homeCoordX: Number(movementRow.homeCoordX),
    homeCoordY: Number(movementRow.homeCoordY),
    startedAt: movementRow.startedAt,
    arriveAt: movementRow.arriveAt,
    distance,
    remainingSec,
    units,
  };
};

const parseIsoMs = (value) => {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveVillageProtectionUntilIso = (village, protectionDaysRaw = 0) => {
  const peaceUntilMs = parseIsoMs(village?.peaceUntil);
  if (peaceUntilMs != null) {
    return new Date(peaceUntilMs).toISOString();
  }

  const protectionDays = Math.max(0, Number(protectionDaysRaw ?? 0));
  if (protectionDays <= 0) {
    return null;
  }

  const createdAtMs = parseIsoMs(village?.createdAt);
  if (createdAtMs == null) {
    return null;
  }

  return new Date(createdAtMs + protectionDays * DAY_IN_MS).toISOString();
};

const getVillageProtectionRemainingSec = (village, protectionDaysRaw = 0, referenceMs = Date.now()) => {
  const protectionUntilIso = resolveVillageProtectionUntilIso(village, protectionDaysRaw);
  const protectionUntilMs = parseIsoMs(protectionUntilIso);
  if (protectionUntilMs == null) {
    return 0;
  }
  return Math.max(0, Math.ceil((protectionUntilMs - Number(referenceMs)) / 1000));
};

const isVillageUnderSpawnProtection = (village, protectionDaysRaw = 0, referenceMs = Date.now()) =>
  getVillageProtectionRemainingSec(village, protectionDaysRaw, referenceMs) > 0;

const buildVillageLogisticsEconomySnapshot = (villageRow, options = {}) => {
  const villageId = Number(villageRow?.id ?? 0);
  if (!Number.isFinite(villageId) || villageId <= 0) {
    return null;
  }
  const referenceIso = String(options?.referenceIso ?? nowIso());
  const resourcesRow = synchronizeVillageEconomyAt(villageId, referenceIso, {
    persist: options?.persist,
  });
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(villageId));
  const warehouseLevel = Math.max(0, Math.floor(Number(buildingLevels.warehouse ?? 0)));
  const marketLevel = Math.max(0, Math.floor(Number(buildingLevels.market ?? 0)));
  const cap = calculateResourceCap(warehouseLevel);
  const resources = toNonNegativeResourcePocket(resourcesRow);
  const totalResources = resources.wood + resources.stone + resources.iron;
  const capTotal = Math.max(1, cap * 3);
  const merchants = calculateMarketMerchantStateByVillage(villageId, marketLevel);
  return {
    villageId,
    name: String(villageRow?.name ?? `Leno ${villageId}`),
    coordX: Number(villageRow?.coordX ?? 0),
    coordY: Number(villageRow?.coordY ?? 0),
    marketLevel,
    cap: Math.max(0, Math.floor(cap)),
    resources: {
      wood: resources.wood,
      stone: resources.stone,
      iron: resources.iron,
    },
    totalResources,
    fillPct: Math.max(0, Math.min(1, totalResources / capTotal)),
    merchants,
  };
};

const parseMarketGuildAuditDetails = (detailsJson) => {
  if (detailsJson == null || String(detailsJson).trim() === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(String(detailsJson));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const pruneMarketGuildAuditLogs = (sourceVillageId, referenceIso = nowIso()) => {
  const retentionCutoffMs = Date.parse(String(referenceIso)) - MARKET_GUILD_AUDIT_RETENTION_DAYS * DAY_IN_MS;
  if (Number.isFinite(retentionCutoffMs)) {
    deleteOldMarketGuildAuditLogsStmt.run(new Date(retentionCutoffMs).toISOString());
  }
  trimMarketGuildAuditLogsBySourceVillageStmt.run(
    Number(sourceVillageId),
    Number(sourceVillageId),
    MARKET_GUILD_AUDIT_MAX_ROWS_PER_SOURCE,
  );
};

const appendMarketGuildAuditLog = ({
  ownerPlayerId,
  sourceVillageId,
  targetVillageId = null,
  region,
  severity = 'info',
  reasonCode,
  message,
  details = null,
  createdAt = nowIso(),
}) => {
  const normalizedReasonCode = String(reasonCode ?? '').trim().toLowerCase();
  if (!normalizedReasonCode) {
    return;
  }
  insertMarketGuildAuditLogStmt.run(
    Number(ownerPlayerId),
    Number(sourceVillageId),
    targetVillageId == null ? null : Number(targetVillageId),
    Number(region),
    String(severity ?? 'info').trim().toLowerCase() || 'info',
    normalizedReasonCode,
    String(message ?? '').trim() || 'Bez detailu',
    details == null ? null : JSON.stringify(details),
    String(createdAt),
  );
  pruneMarketGuildAuditLogs(sourceVillageId, createdAt);
};

const listMarketGuildAuditLogsBySourceVillage = (sourceVillageId) =>
  selectRecentMarketGuildAuditLogsBySourceVillageStmt
    .all(Number(sourceVillageId), MARKET_GUILD_AUDIT_LOG_LIMIT)
    .map((entry) => ({
      id: Number(entry.id),
      ownerPlayerId: Number(entry.ownerPlayerId),
      sourceVillageId: Number(entry.sourceVillageId),
      targetVillageId: entry.targetVillageId == null ? null : Number(entry.targetVillageId),
      region: Number(entry.region),
      severity: String(entry.severity ?? 'info'),
      reasonCode: String(entry.reasonCode ?? 'unknown'),
      message: String(entry.message ?? ''),
      details: parseMarketGuildAuditDetails(entry.detailsJson),
      createdAt: String(entry.createdAt ?? nowIso()),
    }));

const buildMarketGuildAutomationState = ({
  playerId,
  region,
  sourceVillageId,
  sourceMarketLevel,
  guildUnlocked,
  referenceIso = nowIso(),
  persist = true,
}) => {
  const setting = selectMarketGuildSettingBySourceVillageStmt.get(Number(sourceVillageId)) ?? null;
  const targetRows = selectMarketGuildTargetsBySourceVillageStmt.all(Number(sourceVillageId));
  const ownVillages = selectVillagesByPlayerAndRegionStmt
    .all(Number(playerId), Number(region))
    .filter((entry) => Number(entry.id) !== Number(sourceVillageId));
  const ownVillageSnapshots = ownVillages
    .map((village) => buildVillageLogisticsEconomySnapshot(village, { referenceIso, persist }))
    .filter((entry) => entry != null);
  const ownVillageSnapshotById = new Map(
    ownVillageSnapshots.map((entry) => [Number(entry.villageId), entry]),
  );
  const targets = targetRows.map((targetRow) => {
    const targetVillageId = Number(targetRow.targetVillageId);
    const isPaused = Number(targetRow.isPaused ?? 0) === 1;
    const targetVillage = selectVillageWithOwnerByIdStmt.get(targetVillageId);
    const isOwnedActive =
      targetVillage &&
      Number(targetVillage.playerId) === Number(playerId) &&
      Number(targetVillage.region) === Number(region);
    const economySnapshot =
      (isOwnedActive ? ownVillageSnapshotById.get(targetVillageId) : null) ??
      (isOwnedActive ? buildVillageLogisticsEconomySnapshot(targetVillage, { referenceIso, persist }) : null);
    let warning = null;
    if (!targetVillage) {
      warning = 'Leno uz neexistuje.';
    } else if (!isOwnedActive) {
      warning = 'Leno jiz nepatri tobe a auto-logistika ho preskakuje.';
    }
    return {
      id: Number(targetRow.id),
      targetVillageId,
      sortIndex: Math.max(0, Math.floor(Number(targetRow.sortIndex ?? 0))),
      isPaused,
      name: String(targetVillage?.name ?? economySnapshot?.name ?? `Leno ${targetVillageId}`),
      coordX: Number(targetVillage?.coordX ?? economySnapshot?.coordX ?? 0),
      coordY: Number(targetVillage?.coordY ?? economySnapshot?.coordY ?? 0),
      isActive: Boolean(isOwnedActive),
      warning,
      cap: Number(economySnapshot?.cap ?? 0),
      resources: economySnapshot?.resources ?? { wood: 0, stone: 0, iron: 0 },
      totalResources: Number(economySnapshot?.totalResources ?? 0),
      fillPct: Number(economySnapshot?.fillPct ?? 0),
    };
  });
  const sourceMerchants = calculateMarketMerchantStateByVillage(Number(sourceVillageId), sourceMarketLevel);
  const auditLog = listMarketGuildAuditLogsBySourceVillage(sourceVillageId);
  return {
    enabled: guildUnlocked ? Boolean(Number(setting?.enabled ?? 0)) : false,
    cycleIntervalSec: Math.max(
      300,
      Math.floor(Number(setting?.cycleIntervalSec ?? MARKET_GUILD_CYCLE_INTERVAL_SEC)),
    ),
    nextDispatchAt: setting?.nextDispatchAt ? String(setting.nextDispatchAt) : null,
    lastDispatchAt: setting?.lastDispatchAt ? String(setting.lastDispatchAt) : null,
    cursorIndex: Math.max(0, Math.floor(Number(setting?.cursorIndex ?? 0))),
    dispatchWindow: {
      startHourUtc: MARKET_GUILD_ACTIVE_START_HOUR,
      endHourUtc: MARKET_GUILD_ACTIVE_END_HOUR,
      isActiveNow: isMarketGuildDispatchWindowAtTime(referenceIso),
    },
    merchants: sourceMerchants,
    ownVillages: ownVillageSnapshots,
    targets,
    auditLog,
  };
};

const requireVillageForUser = (
  username,
  requestedVillageId = null,
  worldId = null,
  spawnDirectionRaw = 'center',
  options = {},
) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }

  const requestedVillageNumeric = Number(requestedVillageId);
  const requestedVillage =
    Number.isFinite(requestedVillageNumeric) && requestedVillageNumeric > 0
      ? selectVillageByIdStmt.get(requestedVillageNumeric)
      : null;
  const inferredWorldFromVillage =
    requestedVillage && Number(requestedVillage.playerId) === Number(player.id)
      ? resolveWorldByRegion(Number(requestedVillage.region))
      : null;
  const selectedWorld =
    worldId != null
      ? resolveWorldById(worldId)
      : inferredWorldFromVillage ?? resolveWorldById(DEFAULT_WORLD_ID);
  const villages = ensurePlayerHasVillageInWorldTransaction(
    Number(player.id),
    String(player.username),
    selectedWorld.id,
    spawnDirectionRaw,
  );
  if (villages.length === 0) {
    throw new GameRuleError(`Hrac '${username}' nema zalozenou osadu.`, 404);
  }

  let village = villages[0];
  if (requestedVillageId != null) {
    const requested = Number(requestedVillageId);
    if (Number.isFinite(requested)) {
      const found = villages.find((entry) => Number(entry.id) === requested);
      if (found) {
        village = found;
      }
    }
  }

  if (options?.syncEconomy !== false) {
    synchronizeVillageEconomyAt(Number(village.id));
  }
  return { player, village, villages, world: selectedWorld };
};

const normalizeSettlementKind = (isOwn, isBotSettlement, isAbandonedBot) => {
  if (isOwn) {
    return 'own';
  }

  if (isAbandonedBot) {
    return 'abandoned';
  }

  return isBotSettlement ? 'bot' : 'player';
};

const buildWorldSettlements = (viewerVillage, viewerUsername, viewerPlayerId, world, referenceIso = nowIso()) => {
  const region = resolveWorldRegionDefinition(world);
  const spawnConfig = resolveWorldSpawnConfig(world);
  const villageProtectionRuleDays = Math.max(0, Number(spawnConfig.playerProtectionDays ?? 0));
  const referenceMs = Date.parse(String(referenceIso));
  const villages = selectAllVillagesForWorldStmt.all(Number(world.region));
  const viewerKingdom = viewerVillage.kingdom;
  const numericViewerPlayerId = Number(viewerPlayerId);
  const playerPrestigeByPlayerId = new Map();

  for (const row of villages) {
    const playerId = Number(row.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      continue;
    }
    const nextTotal =
      Math.max(0, Number(playerPrestigeByPlayerId.get(playerId) ?? 0)) +
      Math.max(0, Math.floor(Number(row.prestige ?? 0)));
    playerPrestigeByPlayerId.set(playerId, nextTotal);
  }

  const viewerPrestige = Math.max(
    0,
    Math.floor(Number(playerPrestigeByPlayerId.get(numericViewerPlayerId) ?? 0)),
  );
  const retaliationRows =
    Number.isFinite(numericViewerPlayerId) && numericViewerPlayerId > 0
      ? selectCombatRetaliationFlagsByDefenderStmt.all(numericViewerPlayerId, Number(world.region))
      : [];
  const retaliationByAggressorId = new Map(
    retaliationRows
      .map((row) => ({
        aggressorPlayerId: Number(row.aggressorPlayerId),
        firstAttackedAt: row.firstAttackedAt ? String(row.firstAttackedAt) : null,
        lastAttackedAt: row.lastAttackedAt ? String(row.lastAttackedAt) : null,
      }))
      .filter((row) => Number.isFinite(row.aggressorPlayerId) && row.aggressorPlayerId > 0)
      .map((row) => [row.aggressorPlayerId, row]),
  );

  return villages.map((row) => {
    const coordX = Number(row.coordX);
    const coordY = Number(row.coordY);
    const playerId = Number(row.playerId);
    const ownerUsernameComparable = normalizeUsernameComparable(String(row.ownerUsername ?? ''));
    const isAbandonedBot =
      Number(row.isBot) === 1 &&
      ownerUsernameComparable.startsWith(normalizeUsernameComparable(ABANDONED_BOT_USERNAME_PREFIX));
    const isBotSettlement = Number(row.isBot) === 1 && !isAbandonedBot;
    const isOwn = Number.isFinite(playerId) && playerId > 0 && playerId === numericViewerPlayerId;
    const sameKingdom = !isAbandonedBot && !isBotSettlement && row.kingdom === viewerKingdom;
    const protectionUntil = isAbandonedBot
      ? null
      : resolveVillageProtectionUntilIso(row, villageProtectionRuleDays);
    const protectionRemainingSec = isAbandonedBot
      ? 0
      : getVillageProtectionRemainingSec(row, villageProtectionRuleDays, referenceMs);
    const ownerTotalPrestige = Math.max(
      0,
      Math.floor(Number(playerPrestigeByPlayerId.get(playerId) ?? row.prestige ?? 0)),
    );
    const prestigeCheckRelevant = !isAbandonedBot && !isOwn && !sameKingdom && Number.isFinite(playerId) && playerId > 0;
    const blockedByPrestige =
      prestigeCheckRelevant && viewerPrestige > 0
        ? !isAttackAllowed(viewerPrestige, ownerTotalPrestige)
        : false;
    const retaliationFlag = prestigeCheckRelevant ? retaliationByAggressorId.get(playerId) ?? null : null;
    const retaliationUnlocked = blockedByPrestige && retaliationFlag != null;
    const prestigeAttackBlockedForViewer = blockedByPrestige && !retaliationUnlocked;
    const minimumRequiredPrestige =
      viewerPrestige > 0 ? Math.max(1, Math.ceil(viewerPrestige * MIN_ATTACKABLE_PRESTIGE_RATIO)) : 0;
    let balanceHint = '';
    if (prestigeAttackBlockedForViewer) {
      balanceHint = ` Ochrana prestiže: tento hráč má ${ownerTotalPrestige.toLocaleString(
        'cs-CZ',
      )} prestiže, pro útok potřebuje alespoň ${minimumRequiredPrestige.toLocaleString('cs-CZ')}.`;
    } else if (retaliationUnlocked) {
      balanceHint =
        ' Ochrana prestiže je prolomena: tento hráč už na tebe zaútočil, útok můžeš vrátit.';
    }
    const baseNote = isOwn
      ? 'Tvoje hlavni vesnice. Mas plny pristup ke statistikam.'
      : isAbandonedBot
        ? 'Opustene leno s AI obranou. Podrobnosti o budovach a jednotkach jsou skryte.'
        : isBotSettlement
          ? 'Bot osada. Brani se jednotkami v osade, ale sama nevede utocne rozkazy.'
        : 'Cizi leno - podrobnosti o budovach a jednotkach jsou skryte.';

    return {
      id: `vlg-${row.id}`,
      villageId: Number(row.id),
      playerId: Number.isFinite(playerId) && playerId > 0 ? playerId : null,
      name: row.name,
      kind: normalizeSettlementKind(isOwn, isBotSettlement, isAbandonedBot),
      owner: row.owner,
      kingdom: row.kingdom,
      region: Number(row.region),
      localX: coordX - Number(region.originX) + 1,
      localY: coordY - Number(region.originY) + 1,
      globalX: coordX,
      globalY: coordY,
      prestige: Number(row.prestige),
      loyalty: isOwn ? Number(row.loyalty) : 0,
      note: `${baseNote}${balanceHint}`,
      visibility: isOwn ? 'full' : 'public',
      relation: isOwn ? 'self' : isAbandonedBot || isBotSettlement ? 'enemy' : sameKingdom ? 'ally' : 'enemy',
      protectionUntil,
      protectionRemainingSec,
      protectionRuleDays: villageProtectionRuleDays,
      viewerPrestige,
      ownerTotalPrestige,
      prestigeAttackMinimumForViewer: minimumRequiredPrestige,
      prestigeAttackBlockedForViewer,
      retaliationUnlockedForViewer: retaliationUnlocked,
      retaliationUnlockedAt: retaliationFlag?.lastAttackedAt ?? null,
    };
  });
};

const buildKingdomStats = (settlements) => {
  const bucket = new Map();

  for (const settlement of settlements) {
    const current = bucket.get(settlement.kingdom) ?? { kingdom: settlement.kingdom, villages: 0, prestige: 0 };
    current.villages += 1;
    current.prestige += settlement.prestige;
    bucket.set(settlement.kingdom, current);
  }

  return [...bucket.values()].sort((a, b) => b.prestige - a.prestige);
};

const buildWorldMapReadModel = ({
  player,
  village,
  world,
  referenceIso = nowIso(),
}) => {
  const worldRegion = resolveWorldRegionDefinition(world);
  const version = buildWorldMapReadModelVersion(referenceIso);
  const cacheKey = [
    version,
    String(world.id),
    Number(player?.id ?? 0),
    Number(village?.id ?? 0),
  ].join(':');
  const cached = worldMapReadModelCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const settlements = buildWorldSettlements(village, player?.username, Number(player?.id), world, referenceIso);
  return cacheWorldMapReadModel(cacheKey, {
    id: String(world.id),
    name: String(world.name),
    region: Number(worldRegion.id),
    originX: Number(worldRegion.originX),
    originY: Number(worldRegion.originY),
    size: Number(worldRegion.size),
    version,
    snapshotKey: version,
    settlements,
    kingdoms: buildKingdomStats(settlements),
  });
};

const toActiveUpgradeByBuildingMap = (rows) => {
  const byBuilding = new Map();
  for (const row of rows) {
    if (!byBuilding.has(row.buildingId)) {
      byBuilding.set(row.buildingId, row);
    }
  }
  return byBuilding;
};

const toHighestQueuedUpgradeLevelByBuildingMap = (rows) => {
  const highestByBuilding = new Map();
  for (const row of rows) {
    const buildingId = row.buildingId;
    const toLevel = Math.max(0, Math.floor(Number(row.toLevel ?? 0)));
    const currentHighest = highestByBuilding.get(buildingId);
    if (currentHighest == null || toLevel > currentHighest) {
      highestByBuilding.set(buildingId, toLevel);
    }
  }
  return highestByBuilding;
};

const buildArmyState = (playerId, currentVillageId, region) => {
  const numericPlayerId = Number(playerId);
  const numericCurrentVillageId = Number(currentVillageId);
  const numericRegion = Number(region);
  const activeMovements = selectActiveArmyMovementsByPlayerStmt
    .all(numericPlayerId)
    .map((row) => toMovementWithUnits(row))
    .map((movement) => ({
      ...movement,
      isIncoming: false,
      isRelatedToCurrentVillage:
        movement.originVillageId === numericCurrentVillageId ||
        movement.targetVillageId === numericCurrentVillageId ||
        movement.homeVillageId === numericCurrentVillageId,
    }));

  const stationedSupports = selectStationedSupportMovementsByPlayerStmt
    .all(numericPlayerId)
    .map((row) => toMovementWithUnits(row))
    .map((movement) => ({
      ...movement,
      isIncoming: false,
      isRelatedToCurrentVillage:
        movement.originVillageId === numericCurrentVillageId ||
        movement.targetVillageId === numericCurrentVillageId ||
        movement.homeVillageId === numericCurrentVillageId,
    }));

  const incomingMovements = selectIncomingArmyMovementsByVillageOwnerStmt
    .all(numericPlayerId, numericRegion, numericPlayerId)
    .map((row) => toMovementWithUnits(row))
    .map((movement) => ({
      ...movement,
      isIncoming: true,
      isRelatedToCurrentVillage: movement.targetVillageId === numericCurrentVillageId,
    }));
  const recentAttackTargets = selectRecentAttackTargetsByPlayerRegionStmt
    .all(numericPlayerId, numericRegion)
    .map((row) => ({
      targetVillageId: Number(row.targetVillageId),
      targetName: String(row.targetName ?? ''),
      targetCoordX: Number(row.targetCoordX),
      targetCoordY: Number(row.targetCoordY),
      lastIssuedAt: String(row.lastIssuedAt ?? nowIso()),
    }))
    .filter((item) => Number.isFinite(item.targetVillageId) && item.targetVillageId > 0);

  return {
    activeMovements,
    stationedSupports,
    incomingMovements,
    recentAttackTargets,
  };
};

const sumUnitMapValues = (value) => {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  return Object.values(value).reduce((sum, amount) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return sum;
    }
    return sum + Math.floor(numericAmount);
  }, 0);
};

const buildCombatScoresByPlayerId = (world) => {
  const reports = world
    ? selectBattleReportsForLeaderboardByRegionStmt.all(Number(world.region), Number(world.region))
    : selectBattleReportsForLeaderboardStmt.all();
  const scoresByPlayerId = new Map();

  for (const report of reports) {
    const playerId = Number(report.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      continue;
    }

    const payload = parseJsonSafe(report.payloadJson, null);
    if (!payload || typeof payload !== 'object') {
      continue;
    }

    const perspective = String(payload.perspective ?? '')
      .trim()
      .toLowerCase();
    const role = String(payload.role ?? '')
      .trim()
      .toLowerCase();
    const current = scoresByPlayerId.get(playerId) ?? {
      attackerScore: 0,
      defenderScore: 0,
      supporterScore: 0,
    };

    if (perspective === 'attacker') {
      current.attackerScore += sumUnitMapValues(payload?.battle?.defender?.losses);
    }

    if (perspective === 'defender' && role !== 'support') {
      current.defenderScore += sumUnitMapValues(payload?.battle?.attacker?.losses);
    }

    if (role === 'support') {
      current.supporterScore += sumUnitMapValues(payload?.support?.losses);
    }

    scoresByPlayerId.set(playerId, current);
  }

  return scoresByPlayerId;
};

const buildCombatRankByPlayerId = (rows, scoreKey) => {
  const sortedRows = [...rows].sort((left, right) => {
    const scoreDiff = Number(right[scoreKey] ?? 0) - Number(left[scoreKey] ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    if (Number(right.prestige ?? 0) !== Number(left.prestige ?? 0)) {
      return Number(right.prestige ?? 0) - Number(left.prestige ?? 0);
    }
    if (Number(right.villages ?? 0) !== Number(left.villages ?? 0)) {
      return Number(right.villages ?? 0) - Number(left.villages ?? 0);
    }
    return String(left.username ?? '').localeCompare(String(right.username ?? ''), 'cs', {
      sensitivity: 'base',
    });
  });

  const rankByPlayerId = new Map();
  sortedRows.forEach((row, index) => {
    rankByPlayerId.set(Number(row.playerId), index + 1);
  });
  return rankByPlayerId;
};

const parseBattleReportRow = (row) => {
  let payload = {};
  try {
    payload = JSON.parse(String(row?.payloadJson ?? '{}'));
  } catch {
    payload = {};
  }

  return {
    id: Number(row.id),
    playerId: Number(row.playerId),
    originVillageId: row.originVillageId == null ? null : Number(row.originVillageId),
    targetVillageId: row.targetVillageId == null ? null : Number(row.targetVillageId),
    battleAt: String(row.battleAt),
    createdAt: String(row.createdAt),
    title: String(row.title),
    summary: String(row.summary),
    payload,
  };
};

export const listPlayerLeaderboard = (worldId = null) => {
  const world = worldId == null ? null : resolveWorldById(worldId);
  const players = world ? selectLeaderboardByRegionStmt.all(Number(world.region)) : selectLeaderboardStmt.all();
  const combatScoresByPlayerId = buildCombatScoresByPlayerId(world);
  const rows = players.map((player, index) => {
    const playerId = Number(player.playerId);
    const combatScores = combatScoresByPlayerId.get(playerId) ?? {
      attackerScore: 0,
      defenderScore: 0,
      supporterScore: 0,
    };

    return {
      rank: index + 1,
      playerId,
      username: player.username,
      kingdom: player.kingdom,
      villages: Number(player.villageCount),
      prestige: Number(player.prestige),
      attackerScore: Number(combatScores.attackerScore ?? 0),
      defenderScore: Number(combatScores.defenderScore ?? 0),
      supporterScore: Number(combatScores.supporterScore ?? 0),
    };
  });

  const attackerRankByPlayerId = buildCombatRankByPlayerId(rows, 'attackerScore');
  const defenderRankByPlayerId = buildCombatRankByPlayerId(rows, 'defenderScore');
  const supporterRankByPlayerId = buildCombatRankByPlayerId(rows, 'supporterScore');

  return rows.map((row) => ({
    ...row,
    attackerRank: attackerRankByPlayerId.get(row.playerId) ?? null,
    defenderRank: defenderRankByPlayerId.get(row.playerId) ?? null,
    supporterRank: supporterRankByPlayerId.get(row.playerId) ?? null,
  }));
};

export const listBattleReports = (username, options = {}, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);

  const requestedPageSize = Number(options.pageSize ?? 20);
  const requestedPage = Number(options.page ?? 1);
  const pageSize = clampNumber(
    Number.isInteger(requestedPageSize) ? requestedPageSize : 20,
    5,
    50,
  );
  const total = Number(
    selectBattleReportCountByPlayerAndRegionStmt.get(
      Number(player.id),
      Number(world.region),
      Number(world.region),
    )?.total ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = clampNumber(Number.isInteger(requestedPage) ? requestedPage : 1, 1, totalPages);
  const offset = (page - 1) * pageSize;
  const rows = selectBattleReportsByPlayerAndRegionStmt.all(
    Number(player.id),
    Number(world.region),
    Number(world.region),
    pageSize,
    offset,
  );

  return {
    page,
    pageSize,
    total,
    totalPages,
    items: rows.map((row) => parseBattleReportRow(row)),
  };
};

export const getBattleReport = (username, reportIdRaw, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);
  const reportId = Number(reportIdRaw);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    throw new GameRuleError('Report nebyl nalezen.', 404);
  }

  const row = selectBattleReportByIdAndPlayerAndRegionStmt.get(
    reportId,
    Number(player.id),
    Number(world.region),
    Number(world.region),
  );
  if (!row) {
    throw new GameRuleError('Report nebyl nalezen.', 404);
  }

  return parseBattleReportRow(row);
};

export const getBattleReportSummary = (username, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);
  const total = Number(
    selectBattleReportCountByPlayerAndRegionStmt.get(
      Number(player.id),
      Number(world.region),
      Number(world.region),
    )?.total ?? 0,
  );

  return {
    total: Math.max(0, total),
    updatedAt: nowIso(),
  };
};

const normalizeBooleanFlag = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const buildPlayerNotificationSummaryByPlayerId = (playerId, region, unreadFeedLimit = 8) => {
  const numericPlayerId = Number(playerId);
  const numericRegion = Number(region);
  const feedLimit = clampNumber(Math.floor(Number(unreadFeedLimit) || 8), 1, 20);
  const unreadTotal = Number(
    selectPlayerNotificationUnreadCountStmt.get(numericPlayerId, numericRegion)?.total ?? 0,
  );
  const attentionTotal = Number(
    selectPlayerNotificationAttentionCountStmt.get(numericPlayerId, numericRegion)?.total ?? 0,
  );
  const unreadFeed = selectUnreadPlayerNotificationsFeedStmt
    .all(numericPlayerId, numericRegion, feedLimit)
    .map((row) => toNotificationItem(row));
  return {
    unreadTotal,
    attentionTotal,
    unreadFeed,
  };
};

export const listPlayerNotifications = (username, options = {}, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);
  ensureRelease0107Notification(Number(player.id), Number(world.region));
  const includeArchived = normalizeBooleanFlag(options.includeArchived);
  const requestedPageSize = Number(options.pageSize ?? 25);
  const requestedPage = Number(options.page ?? 1);
  const pageSize = clampNumber(
    Number.isInteger(requestedPageSize) ? requestedPageSize : 25,
    5,
    PLAYER_NOTIFICATION_MAX_PAGE_SIZE,
  );
  const total = Number(
    includeArchived
      ? selectPlayerNotificationCountIncludingArchivedStmt.get(Number(player.id), Number(world.region))?.total ?? 0
      : selectPlayerNotificationCountStmt.get(Number(player.id), Number(world.region))?.total ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = clampNumber(Number.isInteger(requestedPage) ? requestedPage : 1, 1, totalPages);
  const offset = (page - 1) * pageSize;
  const rows = includeArchived
    ? selectPlayerNotificationsIncludingArchivedStmt.all(
        Number(player.id),
        Number(world.region),
        pageSize,
        offset,
      )
    : selectPlayerNotificationsStmt.all(Number(player.id), Number(world.region), pageSize, offset);
  const summary = buildPlayerNotificationSummaryByPlayerId(Number(player.id), Number(world.region));

  return {
    page,
    pageSize,
    total,
    totalPages,
    includeArchived,
    unreadTotal: summary.unreadTotal,
    attentionTotal: summary.attentionTotal,
    unreadFeed: summary.unreadFeed,
    items: rows.map((row) => toNotificationItem(row)),
  };
};

export const getPlayerNotificationSummary = (username, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);
  ensureRelease0107Notification(Number(player.id), Number(world.region));
  const summary = buildPlayerNotificationSummaryByPlayerId(Number(player.id), Number(world.region));

  return {
    unreadTotal: Math.max(0, Number(summary.unreadTotal ?? 0)),
    attentionTotal: Math.max(0, Number(summary.attentionTotal ?? 0)),
    unreadFeed: Array.isArray(summary.unreadFeed) ? summary.unreadFeed : [],
    updatedAt: nowIso(),
  };
};

const mutatePlayerNotificationTransaction = db.transaction(
  (username, notificationIdRaw, action, worldId = null) => {
    const player = selectPlayerByUsernameStmt.get(username);
    if (!player) {
      throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
    }
    const world = resolveWorldById(worldId);
    const notificationId = requirePositiveInteger(notificationIdRaw, 'notificationId');
    const actedAt = nowIso();
    let changes = 0;

    if (action === 'read') {
      changes = Number(
        markPlayerNotificationReadStmt.run(
          actedAt,
          notificationId,
          Number(player.id),
          Number(world.region),
        ).changes ?? 0,
      );
    } else if (action === 'archive') {
      changes = Number(
        archivePlayerNotificationStmt.run(
          actedAt,
          actedAt,
          notificationId,
          Number(player.id),
          Number(world.region),
        ).changes ?? 0,
      );
    } else if (action === 'unarchive') {
      changes = Number(
        unarchivePlayerNotificationStmt.run(
          notificationId,
          Number(player.id),
          Number(world.region),
        ).changes ?? 0,
      );
    } else if (action === 'delete') {
      changes = Number(
        deletePlayerNotificationStmt.run(
          actedAt,
          notificationId,
          Number(player.id),
          Number(world.region),
        ).changes ?? 0,
      );
    } else {
      throw new GameRuleError('Neznamy typ akce notifikace.', 400);
    }

    if (changes <= 0) {
      throw new GameRuleError('Notifikace nebyla nalezena.', 404);
    }

    const summary = buildPlayerNotificationSummaryByPlayerId(Number(player.id), Number(world.region));
    return {
      notificationId,
      action,
      actedAt,
      summary,
    };
  },
);

const markAllPlayerNotificationsReadTransaction = db.transaction((username, worldId = null) => {
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  const world = resolveWorldById(worldId);
  const actedAt = nowIso();
  const changed = Number(
    markAllPlayerNotificationsReadStmt.run(actedAt, Number(player.id), Number(world.region)).changes ?? 0,
  );
  const summary = buildPlayerNotificationSummaryByPlayerId(Number(player.id), Number(world.region));
  return {
    changed,
    actedAt,
    summary,
  };
});

export const markPlayerNotificationRead = (username, notificationId, worldId = null) =>
  mutatePlayerNotificationTransaction(username, notificationId, 'read', worldId);

export const archivePlayerNotification = (username, notificationId, worldId = null) =>
  mutatePlayerNotificationTransaction(username, notificationId, 'archive', worldId);

export const unarchivePlayerNotification = (username, notificationId, worldId = null) =>
  mutatePlayerNotificationTransaction(username, notificationId, 'unarchive', worldId);

export const deletePlayerNotification = (username, notificationId, worldId = null) =>
  mutatePlayerNotificationTransaction(username, notificationId, 'delete', worldId);

export const markAllPlayerNotificationsRead = (username, worldId = null) =>
  markAllPlayerNotificationsReadTransaction(username, worldId);

const processDueMarketGuildDispatches = (tickTimeIso) => {
  const dueSettings = selectDueMarketGuildSettingsStmt.all(String(tickTimeIso));
  let dispatchedRoutes = 0;

  for (const setting of dueSettings) {
    const sourceVillageId = Number(setting.sourceVillageId);
    const ownerPlayerId = Number(setting.ownerPlayerId);
    const region = Number(setting.region);
    const cycleIntervalSec = Math.max(
      300,
      Math.floor(Number(setting.cycleIntervalSec ?? MARKET_GUILD_CYCLE_INTERVAL_SEC)),
    );
    const sourceVillage = selectVillageByIdStmt.get(sourceVillageId);
    const targetRows = selectMarketGuildTargetsBySourceVillageStmt.all(sourceVillageId);
    const targetCount = targetRows.length;
    const currentCursor = Math.max(0, Math.floor(Number(setting.cursorIndex ?? 0)));
    let nextCursor = targetCount > 0 ? currentCursor % targetCount : 0;
    let lastDispatchAt = setting.lastDispatchAt ? String(setting.lastDispatchAt) : null;

    const appendAudit = ({
      severity = 'info',
      reasonCode,
      message,
      targetVillageId = null,
      details = null,
    }) => {
      appendMarketGuildAuditLog({
        ownerPlayerId,
        sourceVillageId,
        targetVillageId,
        region,
        severity,
        reasonCode,
        message,
        details,
        createdAt: tickTimeIso,
      });
    };

    if (dispatchedRoutes >= MARKET_GUILD_MAX_DISPATCHES_PER_TICK) {
      const delayedDispatchAt = new Date(
        Date.parse(String(tickTimeIso)) + MARKET_GUILD_RATE_LIMIT_BACKOFF_SEC * 1000,
      ).toISOString();
      updateMarketGuildSettingDispatchStateStmt.run(
        nextCursor,
        delayedDispatchAt,
        lastDispatchAt,
        String(tickTimeIso),
        sourceVillageId,
      );
      appendAudit({
        severity: 'warning',
        reasonCode: 'rate_limited_global',
        message: 'Auto-logistika byla dočasně přibrzděna kvůli bezpečnostnímu limitu počtu tras.',
        details: {
          tickLimit: MARKET_GUILD_MAX_DISPATCHES_PER_TICK,
          dispatchedRoutes,
          delayedDispatchAt,
        },
      });
      continue;
    }

    if (
      !sourceVillage ||
      Number(sourceVillage.playerId) !== ownerPlayerId ||
      Number(sourceVillage.region) !== region ||
      targetCount < MARKET_GUILD_MIN_TARGET_COUNT
    ) {
      updateMarketGuildSettingDispatchStateStmt.run(
        0,
        resolveNextMarketGuildDispatchAt(tickTimeIso, cycleIntervalSec),
        lastDispatchAt,
        String(tickTimeIso),
        sourceVillageId,
      );
      appendAudit({
        severity: 'warning',
        reasonCode: 'invalid_source_or_targets',
        message: 'Cech přeskočil cyklus: zdrojové léno nebo cíle jsou neplatné.',
        details: {
          sourceExists: Boolean(sourceVillage),
          targetCount,
        },
      });
      continue;
    }

    if (!isMarketGuildDispatchWindowAtTime(tickTimeIso)) {
      const alignedDispatchAt = alignMarketGuildDispatchToWindowIso(Date.parse(String(tickTimeIso)));
      updateMarketGuildSettingDispatchStateStmt.run(
        nextCursor,
        alignedDispatchAt,
        lastDispatchAt,
        String(tickTimeIso),
        sourceVillageId,
      );
      appendAudit({
        reasonCode: 'outside_dispatch_window',
        message: 'Cech čeká mimo denní okno. Odesílání pokračuje až v aktivních hodinách.',
        details: {
          dispatchWindowStartUtc: MARKET_GUILD_ACTIVE_START_HOUR,
          dispatchWindowEndUtc: MARKET_GUILD_ACTIVE_END_HOUR,
          alignedDispatchAt,
        },
      });
      continue;
    }

    const sourceBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(sourceVillageId));
    const sourceMarketLevel = Math.max(0, Math.floor(Number(sourceBuildingLevels.market ?? 0)));
    const sourceMarketCapacity = calculateMarketCapacity(sourceMarketLevel);
    const sourceMerchantState = calculateMarketMerchantStateByVillage(sourceVillageId, sourceMarketLevel);
    const completedResearchIds = buildCompletedResearchSet(
      ensureResolvedResearchProgressForPlayerRegion(ownerPlayerId, region, tickTimeIso),
    );
    const guildUnlocked = isMarketGuildUnlocked(sourceMarketLevel, completedResearchIds);
    if (!guildUnlocked || sourceMerchantState.available <= 0 || sourceMarketCapacity <= 0) {
      updateMarketGuildSettingDispatchStateStmt.run(
        nextCursor,
        resolveNextMarketGuildDispatchAt(tickTimeIso, cycleIntervalSec),
        lastDispatchAt,
        String(tickTimeIso),
        sourceVillageId,
      );
      appendAudit({
        severity: guildUnlocked ? 'info' : 'warning',
        reasonCode: !guildUnlocked
          ? 'guild_locked'
          : sourceMerchantState.available <= 0
            ? 'no_merchants_available'
            : 'market_capacity_zero',
        message: !guildUnlocked
          ? 'Cech nelze spustit: chybí podmínky odemknutí.'
          : sourceMerchantState.available <= 0
            ? 'Cech čeká: všichni obchodníci jsou právě na cestě.'
            : 'Cech čeká: zdrojové léno má nulovou kapacitu trhu.',
        details: {
          sourceMarketLevel,
          sourceMarketCapacity,
          merchants: sourceMerchantState,
          guildUnlocked,
        },
      });
      continue;
    }

    const sourceEconomy = buildVillageLogisticsEconomySnapshot(sourceVillage);
    if (!sourceEconomy) {
      updateMarketGuildSettingDispatchStateStmt.run(
        nextCursor,
        resolveNextMarketGuildDispatchAt(tickTimeIso, cycleIntervalSec),
        lastDispatchAt,
        String(tickTimeIso),
        sourceVillageId,
      );
      appendAudit({
        severity: 'warning',
        reasonCode: 'source_snapshot_missing',
        message: 'Cech přeskočil cyklus: nepodařilo se načíst ekonomii zdrojového léna.',
      });
      continue;
    }

    let dispatched = false;
    let dispatchedForSource = 0;
    const skippedReasonCounts = new Map();
    const scannedTargets = Math.min(targetCount, MARKET_GUILD_MAX_TARGETS_PER_CYCLE);

    const addSkippedReason = (reasonCode) => {
      const key = String(reasonCode ?? 'unknown').trim().toLowerCase() || 'unknown';
      skippedReasonCounts.set(key, Number(skippedReasonCounts.get(key) ?? 0) + 1);
    };

    for (let offset = 0; offset < scannedTargets; offset += 1) {
      if (dispatchedRoutes >= MARKET_GUILD_MAX_DISPATCHES_PER_TICK) {
        addSkippedReason('rate_limited_global');
        break;
      }
      if (dispatchedForSource >= MARKET_GUILD_PER_SOURCE_MAX_DISPATCHES_PER_TICK) {
        addSkippedReason('rate_limited_source');
        break;
      }

      const listIndex = (currentCursor + offset) % targetCount;
      const targetRow = targetRows[listIndex] ?? null;
      if (!targetRow) {
        addSkippedReason('target_missing');
        continue;
      }
      const targetVillageId = Number(targetRow.targetVillageId ?? 0);
      const targetPaused = Number(targetRow.isPaused ?? 0) === 1;
      if (targetPaused) {
        addSkippedReason('target_paused');
        continue;
      }
      const targetVillage = selectVillageWithOwnerByIdStmt.get(targetVillageId);
      if (
        !targetVillage ||
        Number(targetVillage.playerId) !== ownerPlayerId ||
        Number(targetVillage.region) !== region
      ) {
        addSkippedReason('target_not_owned_or_missing');
        continue;
      }
      const distanceTiles = calculateTileDistance(sourceVillage, targetVillage);
      if (distanceTiles > MARKET_MAX_DISTANCE_TILES) {
        addSkippedReason('target_out_of_range');
        continue;
      }

      const targetEconomy = buildVillageLogisticsEconomySnapshot(targetVillage);
      if (!targetEconomy) {
        addSkippedReason('target_snapshot_missing');
        continue;
      }
      const shipmentDecision = resolveMarketGuildAutoShipment({
        sourceResources: sourceEconomy.resources,
        sourceCap: sourceEconomy.cap,
        targetResources: targetEconomy.resources,
        targetCap: targetEconomy.cap,
        routeCapacity: sourceMarketCapacity,
      });
      const shipment = shipmentDecision.shipment;
      if (shipment.total <= 0) {
        addSkippedReason(shipmentDecision.reasonCode);
        continue;
      }

      const sourcePocket = toNonNegativeResourcePocket(synchronizeVillageEconomyAt(sourceVillageId));
      if (
        shipment.wood > sourcePocket.wood ||
        shipment.stone > sourcePocket.stone ||
        shipment.iron > sourcePocket.iron
      ) {
        addSkippedReason('insufficient_source_resources');
        continue;
      }

      subtractResources(sourceVillageId, shipment, { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 });
      const durationSec = calculateLogisticsDurationSec(distanceTiles);
      const arriveAtIso = new Date(Date.parse(String(tickTimeIso)) + durationSec * 1000).toISOString();
      insertLogisticsRouteStmt.run(
        ownerPlayerId,
        sourceVillageId,
        Number(targetVillage.id),
        region,
        'guild-auto',
        shipment.wood,
        shipment.stone,
        shipment.iron,
        String(tickTimeIso),
        arriveAtIso,
      );
      dispatched = true;
      dispatchedForSource += 1;
      dispatchedRoutes += 1;
      lastDispatchAt = String(tickTimeIso);
      nextCursor = (listIndex + 1) % targetCount;
      appendAudit({
        reasonCode: 'dispatch_created',
        message: `Cech odeslal zásilku do ${String(targetVillage.name)} (${Number(targetVillage.coordX)}|${Number(
          targetVillage.coordY,
        )}).`,
        targetVillageId: Number(targetVillage.id),
        details: {
          shipment,
          distanceTiles,
          durationSec,
          sourceFillPct: Number((sourceEconomy.fillPct * 100).toFixed(1)),
          targetFillPct: Number((targetEconomy.fillPct * 100).toFixed(1)),
          decisionMetrics: shipmentDecision.metrics ?? null,
        },
      });
      break;
    }

    if (!dispatched && targetCount > 0) {
      nextCursor = (currentCursor + 1) % targetCount;
      let dominantReasonCode = 'no_dispatch';
      let dominantReasonCount = -1;
      for (const [reasonCode, count] of skippedReasonCounts.entries()) {
        if (count > dominantReasonCount) {
          dominantReasonCode = reasonCode;
          dominantReasonCount = count;
        }
      }
      appendAudit({
        reasonCode: dominantReasonCode,
        message: 'Cech v tomto cyklu nenašel vhodnou zásilku.',
        details: {
          scannedTargets,
          targetCount,
          dominantReasonCode,
          skippedReasons: Object.fromEntries(skippedReasonCounts.entries()),
          sourceFillPct: Number((sourceEconomy.fillPct * 100).toFixed(1)),
        },
      });
    }

    updateMarketGuildSettingDispatchStateStmt.run(
      nextCursor,
      resolveNextMarketGuildDispatchAt(tickTimeIso, cycleIntervalSec),
      lastDispatchAt,
      String(tickTimeIso),
      sourceVillageId,
    );
  }

  return dispatchedRoutes;
};

const resolveTickHourKeyUtc = (timeIso) => {
  const timestamp = Date.parse(String(timeIso ?? ''));
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString().slice(0, 13);
};

const isBotNightWindowAtTime = (timeIso) => {
  const timestamp = Date.parse(String(timeIso ?? ''));
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const hour = new Date(timestamp).getUTCHours();
  return hour >= NIGHT_MODE_START_HOUR && hour < NIGHT_MODE_END_HOUR;
};

const resolveBotAvailableResourcePocket = (resourcePocket) => ({
  wood: Math.max(0, Math.floor(Number(resourcePocket?.wood ?? 0)) - BOT_NIGHT_RESOURCE_RESERVE.wood),
  stone: Math.max(0, Math.floor(Number(resourcePocket?.stone ?? 0)) - BOT_NIGHT_RESOURCE_RESERVE.stone),
  iron: Math.max(0, Math.floor(Number(resourcePocket?.iron ?? 0)) - BOT_NIGHT_RESOURCE_RESERVE.iron),
  gold: Math.max(0, Math.floor(Number(resourcePocket?.gold ?? 0))),
  coins: Math.max(0, Math.floor(Number(resourcePocket?.coins ?? 0))),
});

const spendVillageResourcesForBotAction = (villageId, resourcePocket, cost, referenceIso = nowIso()) => {
  const safeCost = {
    wood: Math.max(0, Math.floor(Number(cost?.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(cost?.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(cost?.iron ?? 0))),
  };
  if (!canAfford(resourcePocket, safeCost)) {
    return null;
  }
  const nextPocket = {
    wood: Math.max(0, Math.floor(Number(resourcePocket.wood ?? 0)) - safeCost.wood),
    stone: Math.max(0, Math.floor(Number(resourcePocket.stone ?? 0)) - safeCost.stone),
    iron: Math.max(0, Math.floor(Number(resourcePocket.iron ?? 0)) - safeCost.iron),
    gold: Math.max(0, Math.floor(Number(resourcePocket.gold ?? 0))),
    coins: Math.max(0, Math.floor(Number(resourcePocket.coins ?? 0))),
  };
  updateResourcesAfterSpendStmt.run(
    nextPocket.wood,
    nextPocket.stone,
    nextPocket.iron,
    nextPocket.gold,
    nextPocket.coins,
    String(referenceIso),
    Number(villageId),
  );
  return nextPocket;
};

const processBotNightEconomyCycle = (tickTimeIso) => {
  const empty = {
    executed: false,
    processedVillages: 0,
    startedUpgrades: 0,
    startedRecruitments: 0,
    failedVillages: 0,
  };
  if (!isBotNightWindowAtTime(tickTimeIso)) {
    return empty;
  }

  const hourKey = resolveTickHourKeyUtc(tickTimeIso);
  if (!hourKey || hourKey === lastBotNightCycleHourKey) {
    return empty;
  }

  const stats = {
    executed: true,
    processedVillages: 0,
    startedUpgrades: 0,
    startedRecruitments: 0,
    failedVillages: 0,
  };

  for (const world of WORLD_CATALOG) {
    const botVillages = selectNamedBotVillagesByRegionStmt
      .all(ACTIVE_BOT_USERNAME, Number(world.region))
      .slice(0, ACTIVE_BOT_MAX_VILLAGES_PER_CYCLE);
    for (const village of botVillages) {
      const villageId = Number(village.id);
      if (!Number.isFinite(villageId) || villageId <= 0) {
        continue;
      }

      try {
        const resourcesRow = synchronizeVillageEconomyAt(villageId, tickTimeIso);
        if (!resourcesRow) {
          continue;
        }
        let resourcePocket = toNonNegativeResourcePocket(resourcesRow);
        const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(villageId));
        const activeUpgrades = selectActiveUpgradesByVillageStmt.all(villageId);
        const activeRecruitments = selectActiveRecruitmentsByVillageStmt.all(villageId);
        stats.processedVillages += 1;

        if (activeUpgrades.length <= 0) {
          const projectedLevels = buildProjectedBuildingLevels(buildingLevels, activeUpgrades);
          for (const buildingId of BOT_NIGHT_BUILD_PRIORITY) {
            const fromLevel = Math.max(0, Math.floor(Number(buildingLevels[buildingId] ?? 0)));
            const maxLevel = getMaxBuildingLevel(buildingId);
            if (fromLevel >= maxLevel) {
              continue;
            }
            const requirementError = resolveBuildingRequirementError(buildingId, buildingLevels, {
              effectiveBuildingLevels: projectedLevels,
            });
            if (requirementError) {
              continue;
            }
            const upgradeCost = calculateUpgradeCost(buildingId, fromLevel);
            if (!upgradeCost) {
              continue;
            }
            const availablePocket = resolveBotAvailableResourcePocket(resourcePocket);
            if (!canAfford(availablePocket, upgradeCost)) {
              continue;
            }
            const paidPocket = spendVillageResourcesForBotAction(villageId, resourcePocket, upgradeCost, tickTimeIso);
            if (!paidPocket) {
              continue;
            }
            resourcePocket = paidPocket;
            const townhallLevel = Math.max(0, Math.floor(Number(buildingLevels.townhall ?? 0)));
            const durationSec = calculateUpgradeDurationSec(buildingId, fromLevel, townhallLevel);
            const finishAtIso = new Date(Date.parse(String(tickTimeIso)) + durationSec * 1000).toISOString();
            insertUpgradeStmt.run(
              villageId,
              buildingId,
              fromLevel,
              Math.min(maxLevel, fromLevel + 1),
              upgradeCost.wood,
              upgradeCost.stone,
              upgradeCost.iron,
              String(tickTimeIso),
              finishAtIso,
            );
            stats.startedUpgrades += 1;
            break;
          }
        }

        const barracksLevel = Math.max(0, Math.floor(Number(buildingLevels.barracks ?? 0)));
        const hasMilitiaQueued = activeRecruitments.some(
          (entry) => String(entry.unitId ?? '').trim().toLowerCase() === 'militia',
        );
        if (barracksLevel > 0 && !hasMilitiaQueued) {
          const militiaDef = UNIT_DEFS.militia;
          const villagePopulation = getVillagePopulationStatus(villageId);
          const reservedPopulation = calculateReservedPopulationForRecruitments(activeRecruitments);
          const availablePopulationForRecruitment = calculateAvailablePopulationForRecruitment(
            villagePopulation.populationCap,
            villagePopulation.populationUsed,
            reservedPopulation,
          );
          const maxByPopulation = Math.max(
            0,
            Math.floor(availablePopulationForRecruitment / getUnitPopulationCost('militia')),
          );
          const availablePocket = resolveBotAvailableResourcePocket(resourcePocket);
          const maxByResources = calculateMaxRecruitableByResources(availablePocket, militiaDef.cost);
          const recruitAmount = Math.max(
            0,
            Math.min(BOT_NIGHT_MILITIA_RECRUIT_BATCH, maxByPopulation, maxByResources),
          );
          if (recruitAmount > 0) {
            const recruitmentCost = {
              wood: militiaDef.cost.wood * recruitAmount,
              stone: militiaDef.cost.stone * recruitAmount,
              iron: militiaDef.cost.iron * recruitAmount,
            };
            const paidPocket = spendVillageResourcesForBotAction(villageId, resourcePocket, recruitmentCost, tickTimeIso);
            if (paidPocket) {
              resourcePocket = paidPocket;
              const durationSec = calculateRecruitDurationSec('militia', recruitAmount, barracksLevel);
              const finishAtIso = new Date(Date.parse(String(tickTimeIso)) + durationSec * 1000).toISOString();
              insertRecruitmentStmt.run(
                villageId,
                'militia',
                recruitAmount,
                recruitmentCost.wood,
                recruitmentCost.stone,
                recruitmentCost.iron,
                String(tickTimeIso),
                finishAtIso,
              );
              stats.startedRecruitments += 1;
            }
          }
        }
      } catch (error) {
        stats.failedVillages += 1;
        console.warn(`[bot-night] Village ${villageId} cycle failed:`, error);
      }
    }
  }

  lastBotNightCycleHourKey = hourKey;
  return stats;
};

const tickTransaction = db.transaction((tickTimeIso, tickTimeMs) => {
  const state = selectGameStateStmt.get();
  const parsedLastTick = state?.lastTickAt ? Date.parse(state.lastTickAt) : Number.NaN;
  const lastTickMs = Number.isFinite(parsedLastTick) ? parsedLastTick : tickTimeMs;
  const elapsedSec = Math.max(0, (tickTimeMs - lastTickMs) / 1000);
  const villagesToRecalculatePrestige = new Set();

  const dueUpgrades = selectDueUpgradesStmt.all(tickTimeIso);
  for (const upgrade of dueUpgrades) {
    const maxLevel = getMaxBuildingLevel(upgrade.buildingId);
    const finalLevel = Math.min(maxLevel, Number(upgrade.toLevel));
    const villageId = Number(upgrade.villageId);
    updateBuildingLevelStmt.run(finalLevel, villageId, upgrade.buildingId);
    completeUpgradeStmt.run(tickTimeIso, Number(upgrade.id));
    villagesToRecalculatePrestige.add(villageId);
    const villageRow = selectVillageWithOwnerByIdStmt.get(villageId);
    if (villageRow && Number(villageRow.ownerIsBot ?? 0) !== 1) {
      const buildingName = String(BUILDING_DEFS[upgrade.buildingId]?.name ?? upgrade.buildingId);
      createPlayerNotification({
        playerId: Number(villageRow.playerId),
        region: Number(villageRow.region),
        category: 'economy',
        eventType: 'building_upgrade_completed',
        severity: 'info',
        title: `Dokoncena vystavba: ${buildingName}`,
        summary: `${buildingName} v osade ${String(villageRow.name)} dosahla urovne ${finalLevel}.`,
        payload: {
          upgradeId: Number(upgrade.id),
          villageId,
          villageName: String(villageRow.name),
          buildingId: String(upgrade.buildingId),
          toLevel: finalLevel,
          completedAt: tickTimeIso,
        },
        sourceType: 'building_upgrade',
        sourceId: Number(upgrade.id),
        createdAt: tickTimeIso,
      });
    }
  }

  const dueRecruitments = selectDueRecruitmentsStmt.all(tickTimeIso);
  for (const recruitment of dueRecruitments) {
    const villageId = Number(recruitment.villageId);
    const unitId = recruitment.unitId;
    const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(villageId, unitId);
    const currentAmount = Number(currentAmountRow?.amount ?? 0);
    const finalRecruitAmount = Math.max(0, Number(recruitment.amount));

    if (finalRecruitAmount > 0) {
      updateUnitAmountStmt.run(currentAmount + finalRecruitAmount, villageId, unitId);
      villagesToRecalculatePrestige.add(villageId);
    }

    completeRecruitmentStmt.run(tickTimeIso, Number(recruitment.id));
    const villageRow = selectVillageWithOwnerByIdStmt.get(villageId);
    if (villageRow && Number(villageRow.ownerIsBot ?? 0) !== 1) {
      const unitName = String(UNIT_DEFS[unitId]?.name ?? unitId);
      const isKnightCompletion = unitId === KNIGHT_UNIT_ID;
      createPlayerNotification({
        playerId: Number(villageRow.playerId),
        region: Number(villageRow.region),
        category: 'units',
        eventType: isKnightCompletion ? 'knight_completed' : 'recruitment_completed',
        severity: isKnightCompletion ? 'success' : 'info',
        title: isKnightCompletion
          ? `Rytir pripraven: ${String(villageRow.name)}`
          : `Dokoncen nabor: ${unitName}`,
        summary: isKnightCompletion
          ? `V osade ${String(villageRow.name)} byl dokonceny Rytir.`
          : `V osade ${String(villageRow.name)} byl dokoncen nabor ${finalRecruitAmount}x ${unitName}.`,
        payload: {
          recruitmentId: Number(recruitment.id),
          villageId,
          villageName: String(villageRow.name),
          unitId: String(unitId),
          unitName,
          amount: finalRecruitAmount,
          completedAt: tickTimeIso,
        },
        sourceType: 'unit_recruitment',
        sourceId: Number(recruitment.id),
        createdAt: tickTimeIso,
      });
    }
  }

  const plannerDispatch = processPlannerDispatches(tickTimeIso);
  const dueArmyMovements = selectDueArmyMovementsStmt.all(tickTimeIso);
  let stationedSupports = 0;
  let completedArmyMovements = 0;
  let spawnedReturnMovements = 0;
  let generatedBattleReports = 0;
  let completedLogisticsRoutes = 0;
  let autoGuildDispatches = 0;
  let botNightEconomy = {
    executed: false,
    processedVillages: 0,
    startedUpgrades: 0,
    startedRecruitments: 0,
    failedVillages: 0,
  };
  let deliveredMercenaryContracts = 0;
  let expiredMercenaryContracts = 0;
  let completedResearchProjects = 0;
  let prunedNotifications = 0;
  for (const movement of dueArmyMovements) {
    const movementId = Number(movement.id);
    const movementUnits = selectMovementUnitsStmt.all(movementId);
    const unitSelectionPartial = {};
    for (const unitRow of movementUnits) {
      unitSelectionPartial[unitRow.unitId] = Number(unitRow.amount);
    }
    const unitSelection = toCompleteUnitSelection(unitSelectionPartial);

    if (movement.commandType === 'support') {
      updateArmyMovementStatusStmt.run('stationed', null, movementId);
      stationedSupports += 1;
      continue;
    }

    if (movement.commandType === 'attack') {
      const targetVillage = selectVillageWithOwnerByIdStmt.get(Number(movement.targetVillageId));
      const homeVillage = selectVillageByIdStmt.get(Number(movement.homeVillageId));
      const attackerPlayer = selectPlayerByIdStmt.get(Number(movement.playerId));
      const attackerPrestige = targetVillage
        ? getPlayerPrestigeInRegion(Number(movement.playerId), Number(targetVillage.region))
        : 0;
      const defenderPrestige = targetVillage
        ? getPlayerPrestigeInRegion(Number(targetVillage.playerId), Number(targetVillage.region))
        : 0;
      const retaliationOverrideApplied =
        targetVillage &&
        !isAttackAllowed(attackerPrestige, defenderPrestige) &&
        hasCombatRetaliationFlag(
          Number(targetVillage.playerId),
          Number(movement.playerId),
          Number(targetVillage.region),
        );
      const totalSentUnits = sumSelectedUnits(unitSelection);
      if (!targetVillage || !homeVillage || totalSentUnits <= 0) {
        updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
        completedArmyMovements += 1;
        continue;
      }

      const defenderBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(targetVillage.id)));
      const defenderGarrisonBefore = synchronizeVillageGarrisonAt(Number(targetVillage.id), tickTimeIso, {
        persist: true,
        buildingLevels: defenderBuildingLevels,
      });
      const villageDefenderUnitsBefore = toUnitCountMap(selectUnitsByVillageStmt.all(Number(targetVillage.id)));
      const stationedSupportGroups = buildStationedSupportBattleGroups(Number(targetVillage.id));
      const defenderUnitsBefore = toCompleteUnitSelection(villageDefenderUnitsBefore);
      for (const unitId of GARRISON_UNIT_IDS) {
        const garrisonAmount = Math.max(
          0,
          Math.floor(
            Number(
              unitId === 'militia'
                ? defenderGarrisonBefore?.militiaAmount
                : defenderGarrisonBefore?.archerAmount,
            ),
          ),
        );
        if (garrisonAmount > 0) {
          defenderUnitsBefore[unitId] = Math.max(0, Number(defenderUnitsBefore[unitId] ?? 0)) + garrisonAmount;
        }
      }
      for (const supportGroup of stationedSupportGroups) {
        addUnitSelection(defenderUnitsBefore, supportGroup.units);
      }
      if (isScoutOnlyAttackSelection(unitSelection)) {
        const attackerName = String(attackerPlayer?.username ?? 'Neznamy utocnik');
        const defenderName = String(targetVillage.ownerUsername ?? 'Neznamy obrance');
        const defenderPlayer = selectPlayerByIdStmt.get(Number(targetVillage.playerId));
        const attackerScoutCount = getUnitAmountFromSelection(unitSelection, SCOUT_UNIT_ID);
        const defenderScoutCount = getUnitAmountFromSelection(defenderUnitsBefore, SCOUT_UNIT_ID);
        const scoutCasualties = resolveScoutCasualties(attackerScoutCount, defenderScoutCount);
        const scoutPayload = buildScoutIntelPayload({
          attackerScoutCount,
          scoutLosses: scoutCasualties.losses,
          scoutSurvivors: scoutCasualties.survivors,
          defenderScoutCount,
          defenderUnitsSelection: defenderUnitsBefore,
          defenderBuildingLevels,
        });

        let returnMovementPayload = null;
        if (scoutCasualties.survivors > 0) {
          const returnUnits = toCompleteUnitSelection({
            [SCOUT_UNIT_ID]: scoutCasualties.survivors,
          });
          const distanceTiles = calculateTileDistance(targetVillage, homeVillage);
          const durationSec = calculateArmyTravelDurationSec(returnUnits, distanceTiles);
          const startedAtIso = tickTimeIso;
          const arriveAtIso = new Date(Date.parse(startedAtIso) + durationSec * 1000).toISOString();
          const inserted = insertArmyMovementStmt.run(
            Number(movement.playerId),
            'return',
            Number(targetVillage.id),
            Number(homeVillage.id),
            Number(homeVillage.id),
            null,
            0,
            0,
            0,
            startedAtIso,
            arriveAtIso,
            'in_progress',
          );
          const returnMovementId = Number(inserted.lastInsertRowid);
          insertArmyMovementUnitStmt.run(returnMovementId, SCOUT_UNIT_ID, scoutCasualties.survivors);
          returnMovementPayload = {
            movementId: returnMovementId,
            startedAt: startedAtIso,
            arriveAt: arriveAtIso,
            durationSec,
            distanceTiles,
            fromVillageId: Number(targetVillage.id),
            fromVillageName: String(targetVillage.name ?? ''),
            toVillageId: Number(homeVillage.id),
            toVillageName: String(homeVillage.name ?? ''),
            units: returnUnits,
            lootTaken: { wood: 0, stone: 0, iron: 0 },
          };
          spawnedReturnMovements += 1;
        }

        const attackerSummary = scoutPayload.success
          ? scoutPayload.approximate
            ? `Prunik se zdaril, ale zvedove utrpeli ztraty ${scoutCasualties.losses}/${attackerScoutCount}. Hlaseni obsahuje pouze priblizna data.`
            : 'Spionaz uspesna. Zvedove prinesli presny prehled jednotek a budov v osade.'
          : 'Zved prisel o zivot a neprinesl zadnou zpravu.';
        const defenderSummary = scoutPayload.success
          ? scoutPayload.approximate
            ? `Nepratelsky zved pronikl osadou. Zpusobili jste mu ztraty ${scoutCasualties.losses}/${attackerScoutCount}, ale cast informaci odnesl.`
            : 'Nepratelsky zved pronikl bez ztrat a odnesl presne informace o osade.'
          : 'Pokus o spionaz byl odrazen. Obrana zachytila vsechny nepratelske zvedy.';

        if (attackerPlayer && Number(attackerPlayer.isBot ?? 0) !== 1) {
          const reportId = createBattleReport({
            playerId: Number(attackerPlayer.id),
            originVillageId: Number(movement.originVillageId),
            targetVillageId: Number(targetVillage.id),
            battleAt: tickTimeIso,
            title: `Spionaz: ${attackerName} -> ${targetVillage.name}`,
            summary: attackerSummary,
            payload: {
              perspective: 'attacker',
              role: 'spy',
              movementId,
              at: tickTimeIso,
              originVillageId: Number(movement.originVillageId),
              targetVillageId: Number(targetVillage.id),
              originVillageName: String(homeVillage.name ?? ''),
              targetVillageName: String(targetVillage.name ?? ''),
              attacker: attackerName,
              defender: defenderName,
              outcome: scoutPayload.success ? 'attacker_victory' : 'defender_victory',
              returnMovement: returnMovementPayload ?? undefined,
              spy: scoutPayload,
            },
          });
          if (reportId != null) {
            generatedBattleReports += 1;
          }
        }

        if (defenderPlayer && Number(defenderPlayer.isBot ?? 0) !== 1) {
          const reportId = createBattleReport({
            playerId: Number(defenderPlayer.id),
            originVillageId: Number(movement.originVillageId),
            targetVillageId: Number(targetVillage.id),
            battleAt: tickTimeIso,
            title: `Obrana proti spionazi: ${targetVillage.name}`,
            summary: defenderSummary,
            payload: {
              perspective: 'defender',
              role: 'spy',
              movementId,
              at: tickTimeIso,
              originVillageId: Number(movement.originVillageId),
              targetVillageId: Number(targetVillage.id),
              originVillageName: String(homeVillage.name ?? ''),
              targetVillageName: String(targetVillage.name ?? ''),
              attacker: attackerName,
              defender: defenderName,
              outcome: scoutPayload.success ? 'attacker_victory' : 'defender_victory',
              spy: scoutPayload,
            },
          });
          if (reportId != null) {
            generatedBattleReports += 1;
          }
        }

        updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
        completedArmyMovements += 1;
        continue;
      }

      const battle = simulateAttackBattle({
        attackerUnitsRaw: unitSelection,
        defenderUnitsRaw: defenderUnitsBefore,
        defenderBuildingLevels,
        attackerPrestige,
        defenderPrestige,
        retaliationOverrideApplied,
        battleTimeIso: tickTimeIso,
      });
      const gateStartLevel = Math.max(0, Math.floor(Number(battle?.gate?.startLevel ?? defenderBuildingLevels.gate ?? 0)));
      const gateEndLevel = Math.max(0, Math.floor(Number(battle?.gate?.endLevel ?? gateStartLevel)));
      if (gateEndLevel < gateStartLevel) {
        upsertVillageBuildingLevelStmt.run(Number(targetVillage.id), 'gate', gateEndLevel);
        villagesToRecalculatePrestige.add(Number(targetVillage.id));
      }

      const garrisonStartSelection = toCompleteUnitSelection({
        militia: Number(defenderGarrisonBefore?.militiaAmount ?? 0),
        archer: Number(defenderGarrisonBefore?.archerAmount ?? 0),
      });
      const defenderGroupStarts = [
        toCompleteUnitSelection(villageDefenderUnitsBefore),
        garrisonStartSelection,
        ...stationedSupportGroups.map((supportGroup) => toCompleteUnitSelection(supportGroup.units)),
      ];
      const defenderGroupSurvivors = distributeSurvivorsAcrossDefenderGroups(
        defenderGroupStarts,
        battle?.defender?.survivors,
      );
      const villageDefenderSurvivors = toCompleteUnitSelection(defenderGroupSurvivors[0]);
      const villageDefenseAfterLoss = {
        losses: buildLossesFromStartAndSurvivors(villageDefenderUnitsBefore, villageDefenderSurvivors),
        survivors: villageDefenderSurvivors,
      };
      for (const unitId of UNIT_ORDER) {
        updateUnitAmountStmt.run(
          Number(villageDefenseAfterLoss.survivors[unitId] ?? 0),
          Number(targetVillage.id),
          unitId,
        );
      }
      const garrisonSurvivors = toCompleteUnitSelection(defenderGroupSurvivors[1]);
      const garrisonAfterLoss = {
        losses: buildLossesFromStartAndSurvivors(garrisonStartSelection, garrisonSurvivors),
        survivors: garrisonSurvivors,
      };
      updateVillageGarrisonAmountsStmt.run(
        Number(garrisonAfterLoss.survivors.militia ?? 0),
        Number(garrisonAfterLoss.survivors.archer ?? 0),
        tickTimeIso,
        Number(targetVillage.id),
      );
      villagesToRecalculatePrestige.add(Number(targetVillage.id));

      const stationedSupportCasualties = [];
      for (const supportGroup of stationedSupportGroups) {
        const groupIndex = stationedSupportCasualties.length + 2;
        const supportSurvivors = toCompleteUnitSelection(defenderGroupSurvivors[groupIndex]);
        const supportAfterLoss = {
          losses: buildLossesFromStartAndSurvivors(supportGroup.units, supportSurvivors),
          survivors: supportSurvivors,
        };
        const supportStartTotal = sumSelectedUnits(supportGroup.units);
        const supportSurvivorsTotal = sumSelectedUnits(supportAfterLoss.survivors);
        for (const unitId of UNIT_ORDER) {
          updateArmyMovementUnitAmountStmt.run(
            Number(supportAfterLoss.survivors[unitId] ?? 0),
            Number(supportGroup.id),
            unitId,
          );
        }
        if (supportSurvivorsTotal <= 0) {
          updateArmyMovementStatusStmt.run('completed', tickTimeIso, Number(supportGroup.id));
        }
        stationedSupportCasualties.push({
          ...supportGroup,
          start: supportGroup.units,
          losses: supportAfterLoss.losses,
          survivors: supportAfterLoss.survivors,
          startTotal: supportStartTotal,
          survivorsTotal: supportSurvivorsTotal,
        });
      }

      const defenderVillageSurvivorsTotal = sumSelectedUnits(villageDefenseAfterLoss.survivors);
      const garrisonSurvivorsTotal = sumSelectedUnits(garrisonAfterLoss.survivors);
      const stationedSupportSurvivorsTotal = stationedSupportCasualties.reduce(
        (sum, support) => sum + Math.max(0, Number(support.survivorsTotal ?? 0)),
        0,
      );
      const attackerSentKnights = Math.max(0, Math.floor(Number(unitSelection[KNIGHT_UNIT_ID] ?? 0)));
      const attackerSurvivingKnights = Math.max(
        0,
        Math.floor(Number(battle.attacker.survivors[KNIGHT_UNIT_ID] ?? 0)),
      );
      const canCaptureWithKnight =
        battle.attackerWins &&
        attackerSentKnights > 0 &&
        attackerSurvivingKnights > 0 &&
        defenderVillageSurvivorsTotal <= 0 &&
        garrisonSurvivorsTotal <= 0 &&
        stationedSupportSurvivorsTotal <= 0 &&
        Number(targetVillage.playerId) !== Number(movement.playerId);
      let conquestPayload = null;
      if (canCaptureWithKnight) {
        const kingdomRow = selectPrimaryKingdomByPlayerAndRegionStmt.get(
          Number(movement.playerId),
          Number(targetVillage.region),
        );
        const conquerorKingdom = String(kingdomRow?.kingdom ?? 'Neutral');
        clearResearchAssignmentsByVillageStmt.run(Number(targetVillage.id));
        removeAcademicsByVillageStmt.run(tickTimeIso, Number(targetVillage.id));
        updateVillageOwnerForConquestStmt.run(Number(movement.playerId), conquerorKingdom, Number(targetVillage.id));
        villagesToRecalculatePrestige.add(Number(targetVillage.id));
        conquestPayload = {
          conquered: true,
          previousOwner: String(targetVillage.ownerUsername ?? ''),
          newOwner: String(attackerPlayer?.username ?? ''),
          targetVillageId: Number(targetVillage.id),
          targetVillageName: String(targetVillage.name ?? ''),
        };
      }
      const autoReturnedSupports = [];
      if (conquestPayload?.conquered) {
        for (const supportResult of stationedSupportCasualties) {
          if (Number(supportResult.survivorsTotal ?? 0) <= 0) {
            continue;
          }
          const supportHomeVillage = selectVillageByIdStmt.get(Number(supportResult.homeVillageId));
          if (!supportHomeVillage) {
            updateArmyMovementStatusStmt.run('completed', tickTimeIso, Number(supportResult.id));
            continue;
          }

          const returnUnits = toCompleteUnitSelection(supportResult.survivors);
          const returnTotal = sumSelectedUnits(returnUnits);
          if (returnTotal <= 0) {
            updateArmyMovementStatusStmt.run('completed', tickTimeIso, Number(supportResult.id));
            continue;
          }

          const distanceTiles = calculateTileDistance(targetVillage, supportHomeVillage);
          const durationSec = calculateArmyTravelDurationSec(returnUnits, distanceTiles);
          if (!Number.isFinite(durationSec) || durationSec <= 0) {
            updateArmyMovementStatusStmt.run('completed', tickTimeIso, Number(supportResult.id));
            continue;
          }

          const arriveAtIso = new Date(Date.parse(tickTimeIso) + durationSec * 1000).toISOString();
          const insertedSupportReturn = insertArmyMovementStmt.run(
            Number(supportResult.playerId),
            'return',
            Number(targetVillage.id),
            Number(supportHomeVillage.id),
            Number(supportHomeVillage.id),
            null,
            0,
            0,
            0,
            tickTimeIso,
            arriveAtIso,
            'in_progress',
          );
          const supportReturnMovementId = Number(insertedSupportReturn.lastInsertRowid);
          for (const unitId of UNIT_ORDER) {
            const amount = Number(returnUnits[unitId] ?? 0);
            if (amount <= 0) {
              continue;
            }
            insertArmyMovementUnitStmt.run(supportReturnMovementId, unitId, amount);
          }

          updateArmyMovementStatusStmt.run('completed', tickTimeIso, Number(supportResult.id));
          autoReturnedSupports.push({
            supportMovementId: Number(supportResult.id),
            returnMovementId: supportReturnMovementId,
            totalUnits: returnTotal,
            homeVillageId: Number(supportHomeVillage.id),
          });
          spawnedReturnMovements += 1;
        }
      }

      const lootPriority = normalizeLootPriority(movement.lootPriority);
      const returnUnits = toCompleteUnitSelection(battle.attacker.survivors);
      if (conquestPayload?.conquered && Number(returnUnits[KNIGHT_UNIT_ID] ?? 0) > 0) {
        returnUnits[KNIGHT_UNIT_ID] = Math.max(0, Number(returnUnits[KNIGHT_UNIT_ID] ?? 0) - 1);
        conquestPayload.knightConsumed = true;
      }
      const attackerSurvivorsAfterConquestTotal = sumSelectedUnits(returnUnits);
      let lootTaken = { wood: 0, stone: 0, iron: 0 };
      if (battle.attackerWins && attackerSurvivorsAfterConquestTotal > 0) {
        const carryingCapacity = calculateLootCapacityFromSelection(returnUnits);
        const prestigeLootModifier = calculateLootModifier(attackerPrestige, defenderPrestige);
        const effectiveCarryingCapacity = Math.max(0, Math.floor(carryingCapacity * prestigeLootModifier));
        if (effectiveCarryingCapacity > 0) {
          const defenderResources = synchronizeVillageEconomyAt(Number(targetVillage.id), tickTimeIso);
          if (defenderResources) {
            const protectedPocket = calculateLootProtectionPocket(defenderBuildingLevels);
            const lootableResourcePocket = calculateLootableResourcePocket(defenderResources, protectedPocket);
            const requestedLoot = calculateLootDistribution(lootableResourcePocket, lootPriority, effectiveCarryingCapacity);
            if (requestedLoot.total > 0) {
              const subtraction = subtractResources(Number(targetVillage.id), requestedLoot.loot, protectedPocket);
              lootTaken = {
                wood: Math.max(0, Math.floor(Number(subtraction.taken.wood ?? 0))),
                stone: Math.max(0, Math.floor(Number(subtraction.taken.stone ?? 0))),
                iron: Math.max(0, Math.floor(Number(subtraction.taken.iron ?? 0))),
              };
            }
          }
        }
      }

      let returnMovementPayload = null;
      const shouldSpawnReturnMovement = attackerSurvivorsAfterConquestTotal > 0;
      if (shouldSpawnReturnMovement) {
        const distanceTiles = calculateTileDistance(targetVillage, homeVillage);
        const durationSec = calculateArmyTravelDurationSec(returnUnits, distanceTiles);
        const startedAtIso = tickTimeIso;
        const arriveAtIso = new Date(Date.parse(startedAtIso) + durationSec * 1000).toISOString();
        const inserted = insertArmyMovementStmt.run(
          Number(movement.playerId),
          'return',
          Number(targetVillage.id),
          Number(homeVillage.id),
          Number(homeVillage.id),
          null,
          Number(lootTaken.wood ?? 0),
          Number(lootTaken.stone ?? 0),
          Number(lootTaken.iron ?? 0),
          startedAtIso,
          arriveAtIso,
          'in_progress',
        );
        const returnMovementId = Number(inserted.lastInsertRowid);
        for (const unitId of UNIT_ORDER) {
          const amount = Number(returnUnits[unitId] ?? 0);
          if (amount <= 0) {
            continue;
          }
          insertArmyMovementUnitStmt.run(returnMovementId, unitId, amount);
        }
        returnMovementPayload = {
          movementId: returnMovementId,
          startedAt: startedAtIso,
          arriveAt: arriveAtIso,
          durationSec,
          distanceTiles,
          fromVillageId: Number(targetVillage.id),
          fromVillageName: String(targetVillage.name ?? ''),
          toVillageId: Number(homeVillage.id),
          toVillageName: String(homeVillage.name ?? ''),
          units: returnUnits,
          lootTaken,
        };
        spawnedReturnMovements += 1;
      }

      const attackerName = String(attackerPlayer?.username ?? 'Neznamy utocnik');
      const defenderName = String(targetVillage.ownerUsername ?? 'Neznamy obrance');
      const defenderPlayer = selectPlayerByIdStmt.get(Number(targetVillage.playerId));
      const blockedByGate = battle.blockedByGate === true;
      const attackerLossesTotal = sumSelectedUnits(battle.attacker.losses);
      const defenderLossesTotal = sumSelectedUnits(battle.defender.losses);
      const defenderStartTotal = sumSelectedUnits(battle.defender.start);
      const outcomeLabelForAttacker = blockedByGate
        ? 'Brana odrazila utok'
        : battle.attackerWins
          ? 'Vitezstvi'
          : 'Prohra';
      const outcomeLabelForDefender = blockedByGate
        ? 'Brana odrazila utok'
        : battle.attackerWins
          ? 'Prohra'
          : 'Vitezstvi';
      const prestigeBalance = battle?.prestigeBalance ?? null;
      const hasPrestigeImpact =
        prestigeBalance != null &&
        (Number(prestigeBalance.attackModifier ?? 1) < 0.999 ||
          Number(prestigeBalance.defenseBonus ?? 0) > 0.0001 ||
          Number(prestigeBalance.lootModifier ?? 1) < 0.999);
      const prestigeSummarySuffix = hasPrestigeImpact
        ? ` Balanc prestize: utok x${Number(prestigeBalance?.attackModifier ?? 1).toFixed(2)}, obrana +${Math.round(
            Number(prestigeBalance?.defenseBonus ?? 0) * 100,
          )} %, korist x${Number(prestigeBalance?.lootModifier ?? 1).toFixed(2)}.`
        : '';
      let attackTitle = blockedByGate
        ? `Utok odrazen branou: ${attackerName} -> ${targetVillage.name}`
        : `Bitva: ${attackerName} -> ${targetVillage.name}`;
      let attackSummary = blockedByGate
        ? attackerLossesTotal > 0
          ? `Brana s opevnenim zastavila utok bez beranidel. Utocnik ztratil ${attackerLossesTotal}/${totalSentUnits} jednotek a ustoupil.`
          : 'Brana s opevnenim zastavila utok bez beranidel. Utocnik ustoupil bez ztrat.'
        : `${outcomeLabelForAttacker}. Ztraty utocnika ${attackerLossesTotal}/${totalSentUnits}, obrance ${defenderLossesTotal}/${defenderStartTotal}.`;
      if (conquestPayload?.conquered) {
        attackTitle = `Dobytí léna: ${targetVillage.name}`;
        attackSummary = `Dobytí léna úspěšné. ${targetVillage.name} přechází pod vládu ${attackerName}.`;
        if (conquestPayload.knightConsumed) {
          attackSummary += ' Rytir osadu obsadil a po dobyti zmizel.';
        }
      }
      if (prestigeSummarySuffix) {
        attackSummary += prestigeSummarySuffix;
      }
      if (attackerPlayer && Number(attackerPlayer.isBot ?? 0) !== 1) {
        let reportId = null;
        if (Number(battle.attacker.survivorsTotal) > 0) {
          const attackerPayload = {
            perspective: 'attacker',
            movementId,
            at: tickTimeIso,
            originVillageId: Number(movement.originVillageId),
            targetVillageId: Number(targetVillage.id),
            originVillageName: String(homeVillage.name ?? ''),
            targetVillageName: String(targetVillage.name ?? ''),
            attacker: attackerName,
            defender: defenderName,
            outcome: battle.attackerWins ? 'attacker_victory' : 'defender_victory',
            gateBlocked: blockedByGate,
            lootPriority,
            lootTaken,
            returnMovement: returnMovementPayload ?? undefined,
            battle,
            conquest: conquestPayload ?? undefined,
            autoReturnedSupports: autoReturnedSupports.length > 0 ? autoReturnedSupports : undefined,
          };
          reportId = createBattleReport({
            playerId: Number(attackerPlayer.id),
            originVillageId: Number(movement.originVillageId),
            targetVillageId: Number(targetVillage.id),
            battleAt: tickTimeIso,
            title: attackTitle,
            summary: attackSummary,
            payload: attackerPayload,
          });
        } else {
          reportId = createBattleReport({
            playerId: Number(attackerPlayer.id),
            originVillageId: Number(movement.originVillageId),
            targetVillageId: Number(targetVillage.id),
            battleAt: tickTimeIso,
            title: `Bitva: utok na ${targetVillage.name} selhal`,
            summary: blockedByGate
              ? 'Utok byl odrazen branou. Utocna armada byla znicena pri ustupu z hradeb.'
              : 'Armada v utoku byla znicena obrancem.',
            payload: {
              perspective: 'attacker',
              movementId,
              at: tickTimeIso,
              originVillageId: Number(movement.originVillageId),
              targetVillageId: Number(targetVillage.id),
              originVillageName: String(homeVillage.name ?? ''),
              targetVillageName: String(targetVillage.name ?? ''),
              attacker: attackerName,
              defender: defenderName,
              outcome: 'defender_victory',
              gateBlocked: blockedByGate,
              armyDestroyed: true,
              battle,
              sentArmy: {
                start: battle.attacker.start,
                totalUnits: totalSentUnits,
                baseAttackPower: battle.baseAttackPower,
                finalAttackPower: battle.finalAttackPower,
                attackMultiplier: battle.attackMultiplier,
              },
            },
          });
        }
        if (reportId != null) {
          generatedBattleReports += 1;
        }
      }

      if (defenderPlayer && Number(defenderPlayer.isBot ?? 0) !== 1) {
        const defenderOwnSurvivorsTotal =
          sumSelectedUnits(villageDefenseAfterLoss.survivors) + sumSelectedUnits(garrisonAfterLoss.survivors);
        let defenseTitle = blockedByGate
          ? `Obrana: brana odrazila utok na ${targetVillage.name}`
          : `Obrana: ${targetVillage.name} celi utoku`;
        let defenseSummary = blockedByGate
          ? attackerLossesTotal > 0
            ? `Brana s opevnenim odrazila utok bez beranidel. Utocnik prisel o ${attackerLossesTotal}/${totalSentUnits} jednotek.`
            : 'Brana s opevnenim odrazila utok bez beranidel. Obrana neutrpela ztraty.'
          : defenderOwnSurvivorsTotal <= 0
            ? `Obrana byla znicena. Vsechny obranne jednotky padly. Ztraty utocnika ${attackerLossesTotal}/${totalSentUnits}.`
            : `${outcomeLabelForDefender}. Ztraty obrance ${defenderLossesTotal}/${defenderStartTotal}, utocnik ${attackerLossesTotal}/${totalSentUnits}.`;
        if (conquestPayload?.conquered) {
          defenseTitle = `Dobytí léna: ${targetVillage.name}`;
          defenseSummary = `Leno ${targetVillage.name} bylo dobyto hracem ${attackerName}.`;
        }
        if (prestigeSummarySuffix) {
          defenseSummary += prestigeSummarySuffix;
        }
        const defenderPayload = {
          perspective: 'defender',
          movementId,
          at: tickTimeIso,
          originVillageId: Number(movement.originVillageId),
          targetVillageId: Number(targetVillage.id),
          originVillageName: String(homeVillage.name ?? ''),
          targetVillageName: String(targetVillage.name ?? ''),
          attacker: attackerName,
          defender: defenderName,
          outcome: battle.attackerWins ? 'attacker_victory' : 'defender_victory',
          gateBlocked: blockedByGate,
          lootPriority,
          lootTaken,
          returnMovement: returnMovementPayload ?? undefined,
          conquest: conquestPayload ?? undefined,
          autoReturnedSupports: autoReturnedSupports.length > 0 ? autoReturnedSupports : undefined,
          battle,
        };
        const reportId = createBattleReport({
          playerId: Number(defenderPlayer.id),
          originVillageId: Number(movement.originVillageId),
          targetVillageId: Number(targetVillage.id),
          battleAt: tickTimeIso,
          title: defenseTitle,
          summary: defenseSummary,
          payload: defenderPayload,
        });
        if (reportId != null) {
          generatedBattleReports += 1;
        }
      }

      for (const supportResult of stationedSupportCasualties) {
        const supportPlayer = selectPlayerByIdStmt.get(Number(supportResult.playerId));
        if (!supportPlayer || Number(supportPlayer.isBot ?? 0) === 1) {
          continue;
        }

        const supportForcesDestroyed = Number(supportResult.survivorsTotal) <= 0;
        const supportSummary = supportForcesDestroyed
          ? `Podpora v osade ${targetVillage.name} byla zcela znicena.`
          : `Podpora v osade ${targetVillage.name}: ztraty ${sumSelectedUnits(
              supportResult.losses,
            )}/${sumSelectedUnits(supportResult.start)}.`;
        const reportId = createBattleReport({
          playerId: Number(supportPlayer.id),
          originVillageId: Number(supportResult.originVillageId),
          targetVillageId: Number(targetVillage.id),
          battleAt: tickTimeIso,
          title: `Podpora: ${targetVillage.name} pod utokem`,
          summary: supportSummary,
          payload: {
            perspective: 'defender',
            role: 'support',
            movementId,
            supportMovementId: Number(supportResult.id),
            at: tickTimeIso,
            originVillageId: Number(supportResult.originVillageId),
            targetVillageId: Number(targetVillage.id),
            originVillageName: String(supportResult.originName ?? ''),
            targetVillageName: String(targetVillage.name ?? ''),
            attacker: attackerName,
            defender: defenderName,
            outcome: battle.attackerWins ? 'attacker_victory' : 'defender_victory',
            returnMovement: returnMovementPayload ?? undefined,
            conquest: conquestPayload ?? undefined,
            autoReturnedSupports: autoReturnedSupports.length > 0 ? autoReturnedSupports : undefined,
            support: {
              start: supportResult.start,
              losses: supportResult.losses,
              survivors: supportResult.survivors,
              survivorsTotal: supportResult.survivorsTotal,
            },
            battle: supportForcesDestroyed
              ? undefined
              : {
                  finalAttackPower: battle.finalAttackPower,
                  finalDefensePower: battle.finalDefensePower,
                  bonuses: battle.bonuses,
                },
          },
        });
        if (reportId != null) {
          generatedBattleReports += 1;
        }
      }

      updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
      completedArmyMovements += 1;
      continue;
    }

    if (movement.commandType === 'move') {
      const targetVillageId = Number(movement.targetVillageId);
      const targetVillage = selectVillageByIdStmt.get(targetVillageId);
      const homeVillage = selectVillageByIdStmt.get(Number(movement.homeVillageId));
      if (!targetVillage || !homeVillage) {
        updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
        completedArmyMovements += 1;
        continue;
      }

      const targetPopulation = getVillagePopulationStatus(targetVillageId);
      let remainingPopulationCapacity = Number(targetPopulation.availablePopulation);
      const overflowSelection = toCompleteUnitSelection({});
      let acceptedUnitsTotal = 0;

      for (const unitRow of movementUnits) {
        const unitId = unitRow.unitId;
        const amount = Math.max(0, Math.floor(Number(unitRow.amount)));
        if (amount <= 0) {
          continue;
        }
        const unitPopulationCost = getUnitPopulationCost(unitId);
        const acceptedAmount = Math.min(
          amount,
          Math.max(0, Math.floor(remainingPopulationCapacity / unitPopulationCost)),
        );
        const overflowAmount = Math.max(0, amount - acceptedAmount);

        if (acceptedAmount > 0) {
          const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(targetVillageId, unitId);
          const currentAmount = Number(currentAmountRow?.amount ?? 0);
          updateUnitAmountStmt.run(currentAmount + acceptedAmount, targetVillageId, unitId);
          acceptedUnitsTotal += acceptedAmount;
          remainingPopulationCapacity -= acceptedAmount * unitPopulationCost;
        }
        if (overflowAmount > 0) {
          overflowSelection[unitId] = overflowAmount;
        }
      }

      if (acceptedUnitsTotal > 0) {
        villagesToRecalculatePrestige.add(targetVillageId);
      }

      const overflowTotal = sumSelectedUnits(overflowSelection);
      if (overflowTotal > 0) {
        const distanceTiles = calculateTileDistance(targetVillage, homeVillage);
        const durationSec = calculateArmyTravelDurationSec(overflowSelection, distanceTiles);
        const arriveAtIso = new Date(Date.parse(tickTimeIso) + durationSec * 1000).toISOString();
        const inserted = insertArmyMovementStmt.run(
          Number(movement.playerId),
          'return',
          Number(targetVillage.id),
          Number(homeVillage.id),
          Number(homeVillage.id),
          null,
          0,
          0,
          0,
          tickTimeIso,
          arriveAtIso,
          'in_progress',
        );
        const returnMovementId = Number(inserted.lastInsertRowid);
        for (const unitId of UNIT_ORDER) {
          const amount = Number(overflowSelection[unitId] ?? 0);
          if (amount <= 0) {
            continue;
          }
          insertArmyMovementUnitStmt.run(returnMovementId, unitId, amount);
        }
        spawnedReturnMovements += 1;
      }

      updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
      completedArmyMovements += 1;
      continue;
    }

    if (movement.commandType === 'return') {
      const targetVillageId = Number(movement.targetVillageId);
      let acceptedUnitsTotal = 0;
      for (const unitRow of movementUnits) {
        const unitId = unitRow.unitId;
        const amount = Math.max(0, Math.floor(Number(unitRow.amount)));
        if (amount <= 0) {
          continue;
        }
        const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(targetVillageId, unitId);
        const currentAmount = Number(currentAmountRow?.amount ?? 0);
        updateUnitAmountStmt.run(currentAmount + amount, targetVillageId, unitId);
        acceptedUnitsTotal += amount;
      }
      if (acceptedUnitsTotal > 0) {
        villagesToRecalculatePrestige.add(targetVillageId);
      }
      const carry = {
        wood: Math.max(0, Math.floor(Number(movement.carryWood ?? 0))),
        stone: Math.max(0, Math.floor(Number(movement.carryStone ?? 0))),
        iron: Math.max(0, Math.floor(Number(movement.carryIron ?? 0))),
      };
      if (carry.wood > 0 || carry.stone > 0 || carry.iron > 0) {
        applyResourceDeltaWithCap(targetVillageId, carry);
      }

      updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
      completedArmyMovements += 1;
      continue;
    }

    updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
    completedArmyMovements += 1;
  }

  const dueLogisticsRoutes = selectDueLogisticsRoutesStmt.all(tickTimeIso);
  for (const route of dueLogisticsRoutes) {
    const delivered = applyResourceDeltaWithCap(Number(route.targetVillageId), {
      wood: Math.max(0, Math.floor(Number(route.wood ?? 0))),
      stone: Math.max(0, Math.floor(Number(route.stone ?? 0))),
      iron: Math.max(0, Math.floor(Number(route.iron ?? 0))),
    });
    completeLogisticsRouteStmt.run(tickTimeIso, Number(route.id));
    completedLogisticsRoutes += 1;

    const ownerPlayer = selectPlayerByIdStmt.get(Number(route.ownerPlayerId));
    if (ownerPlayer && Number(ownerPlayer.isBot ?? 0) !== 1) {
      createPlayerNotification({
        playerId: Number(ownerPlayer.id),
        region: Number(route.region),
        category: 'economy',
        eventType: 'logistics_delivered',
        severity: 'info',
        title: 'Logisticka zasilka dorazila',
        summary: `Zasilka #${Number(route.id)} dorucena (${Math.max(0, Number(delivered.applied.wood ?? 0))} dreva, ${Math.max(0, Number(delivered.applied.stone ?? 0))} kamene, ${Math.max(0, Number(delivered.applied.iron ?? 0))} zeleza).`,
        payload: {
          routeId: Number(route.id),
          targetVillageId: Number(route.targetVillageId),
          applied: delivered.applied,
        },
        sourceType: 'logistics_route',
        sourceId: Number(route.id),
        createdAt: tickTimeIso,
      });
    }
  }
  autoGuildDispatches = processDueMarketGuildDispatches(tickTimeIso);
  botNightEconomy = processBotNightEconomyCycle(tickTimeIso);

  const dueMercenaryArrivals = selectDueMercenaryArrivalsStmt.all(tickTimeIso);
  for (const contract of dueMercenaryArrivals) {
    const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(Number(contract.villageId), MERCENARY_UNIT_ID);
    const currentAmount = Math.max(0, Math.floor(Number(currentAmountRow?.amount ?? 0)));
    const unitAmount = Math.max(0, Math.floor(Number(contract.unitAmount ?? MERCENARY_CONTRACT_UNIT_AMOUNT)));
    if (unitAmount > 0) {
      updateUnitAmountStmt.run(currentAmount + unitAmount, Number(contract.villageId), MERCENARY_UNIT_ID);
      villagesToRecalculatePrestige.add(Number(contract.villageId));
    }
    markMercenaryDeliveredStmt.run(tickTimeIso, Number(contract.id));
    deliveredMercenaryContracts += 1;

    const ownerPlayer = selectPlayerByIdStmt.get(Number(contract.playerId));
    const villageRow = selectVillageByIdStmt.get(Number(contract.villageId));
    if (ownerPlayer && Number(ownerPlayer.isBot ?? 0) !== 1 && villageRow) {
      createPlayerNotification({
        playerId: Number(ownerPlayer.id),
        region: Number(contract.region),
        category: 'military',
        eventType: 'mercenary_arrived',
        severity: 'success',
        title: 'Zoldaci dorazili',
        summary: `${unitAmount.toLocaleString('cs-CZ')} zoldaku dorazilo do osady ${String(villageRow.name)}.`,
        payload: {
          contractId: Number(contract.id),
          villageId: Number(contract.villageId),
          unitAmount,
          expiresAt: String(contract.expiresAt),
        },
        sourceType: 'mercenary_contract',
        sourceId: Number(contract.id),
        createdAt: tickTimeIso,
      });
    }
  }

  const dueMercenaryExpirations = selectDueMercenaryExpirationsStmt.all(tickTimeIso);
  for (const contract of dueMercenaryExpirations) {
    const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(Number(contract.villageId), MERCENARY_UNIT_ID);
    const currentAmount = Math.max(0, Math.floor(Number(currentAmountRow?.amount ?? 0)));
    const removableAmount = Math.max(0, Math.floor(Number(contract.unitAmount ?? MERCENARY_CONTRACT_UNIT_AMOUNT)));
    const nextAmount = Math.max(0, currentAmount - removableAmount);
    if (nextAmount !== currentAmount) {
      updateUnitAmountStmt.run(nextAmount, Number(contract.villageId), MERCENARY_UNIT_ID);
      villagesToRecalculatePrestige.add(Number(contract.villageId));
    }
    markMercenaryExpiredStmt.run(tickTimeIso, Number(contract.id));
    expiredMercenaryContracts += 1;

    const ownerPlayer = selectPlayerByIdStmt.get(Number(contract.playerId));
    const villageRow = selectVillageByIdStmt.get(Number(contract.villageId));
    if (ownerPlayer && Number(ownerPlayer.isBot ?? 0) !== 1 && villageRow) {
      createPlayerNotification({
        playerId: Number(ownerPlayer.id),
        region: Number(contract.region),
        category: 'military',
        eventType: 'mercenary_expired',
        severity: 'warning',
        title: 'Zoldacky kontrakt vyprsel',
        summary: `Kontrakt v osade ${String(villageRow.name)} vyprsel. Zoldaci opustili mesto.`,
        payload: {
          contractId: Number(contract.id),
          villageId: Number(contract.villageId),
          removedAmount: Math.max(0, currentAmount - nextAmount),
        },
        sourceType: 'mercenary_contract',
        sourceId: Number(contract.id),
        createdAt: tickTimeIso,
      });
    }
  }

  const researchingPlayerRegionRows = selectResearchingPlayerRegionPairsStmt.all();
  for (const row of researchingPlayerRegionRows) {
    const playerId = Number(row.playerId);
    const region = Number(row.region);
    if (!Number.isFinite(playerId) || !Number.isFinite(region)) {
      continue;
    }

    ensureResolvedResearchProgressForPlayerRegion(playerId, region, tickTimeIso);
    const activeResearchRows = selectResearchingProjectsByPlayerRegionStmt.all(playerId, region);
    if (!Array.isArray(activeResearchRows) || activeResearchRows.length <= 0) {
      continue;
    }
    const maxUniversityLevel = Math.max(
      0,
      Math.floor(Number(selectMaxUniversityLevelByPlayerAndRegionStmt.get(playerId, region)?.maxLevel ?? 0)),
    );

    for (const activeResearch of activeResearchRows) {
      const researchId = String(activeResearch?.researchId ?? '').trim();
      if (!researchId) {
        continue;
      }
      const definition = getResearchDefinition(researchId);
      if (!definition) {
        continue;
      }
      const assignedAcademics = Math.max(
        0,
        Math.floor(
          Number(
            countAssignedAcademicsForResearchByPlayerRegionStmt.get(
              playerId,
              region,
              researchId,
            )?.total ?? 0,
          ),
        ),
      );
      if (assignedAcademics <= 0 || elapsedSec <= 0) {
        continue;
      }
      const speedMultiplier = calculateResearchSpeedMultiplier(assignedAcademics, maxUniversityLevel);
      if (speedMultiplier <= 0) {
        continue;
      }
      const progressGain = (elapsedSec / 3600) * 120 * speedMultiplier;
      const currentProgress = Math.max(0, Number(activeResearch.progress ?? 0));
      const requiredPoints = getResearchProgressPointsRequired(definition);
      const nextProgress = Math.min(requiredPoints, currentProgress + progressGain);
      const startedAt = activeResearch.startedAt ? String(activeResearch.startedAt) : tickTimeIso;

      if (nextProgress >= requiredPoints) {
        releaseAllAcademicAssignmentsByResearchForPlayerRegionStmt.run(playerId, region, researchId);
        upsertResearchProgressStmt.run(
          playerId,
          region,
          String(definition.id),
          'completed',
          requiredPoints,
          0,
          startedAt,
          tickTimeIso,
          tickTimeIso,
        );
        ensureResolvedResearchProgressForPlayerRegion(playerId, region, tickTimeIso);
        completedResearchProjects += 1;

        const playerRow = selectPlayerByIdStmt.get(playerId);
        if (playerRow && Number(playerRow.isBot ?? 0) !== 1) {
          createPlayerNotification({
            playerId,
            region,
            category: 'research',
            eventType: 'research_completed',
            severity: 'success',
            title: `Vyzkum dokoncen: ${String(definition.name)}`,
            summary: `${String(definition.name)} byl uspesne dokoncen.`,
            payload: {
              researchId: String(definition.id),
              completedAt: tickTimeIso,
            },
            sourceType: 'research_progress',
            sourceId: null,
            createdAt: tickTimeIso,
          });
        }
        continue;
      }

      upsertResearchProgressStmt.run(
        playerId,
        region,
        String(definition.id),
        'researching',
        nextProgress,
        assignedAcademics,
        startedAt,
        null,
        tickTimeIso,
      );
    }
  }

  for (const villageId of villagesToRecalculatePrestige) {
    updateVillagePrestigeFromCurrentState(Number(villageId));
  }

  updateGameStateTickStmt.run(tickTimeIso);
  prunedNotifications = pruneOldPlayerNotifications(tickTimeMs);

  return {
    elapsedSec,
    processedVillages: villagesToRecalculatePrestige.size,
    completedUpgrades: dueUpgrades.length,
    completedRecruitments: dueRecruitments.length,
    completedArmyMovements,
    stationedSupports,
    spawnedReturnMovements,
    generatedBattleReports,
    completedLogisticsRoutes,
    autoGuildDispatches,
    botNightEconomy,
    deliveredMercenaryContracts,
    expiredMercenaryContracts,
    completedResearchProjects,
    prunedNotifications,
    plannerDispatch,
    tickedAt: tickTimeIso,
  };
});

export const runGameTick = () => {
  const now = new Date();
  return tickTransaction(now.toISOString(), now.getTime());
};

export const authenticatePlayer = (username, password) => {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = String(password ?? '').trim();
  const player = selectPlayerByUsernameStmt.get(normalizedUsername);
  if (!player) {
    throw new GameRuleError('Neplatne prihlasovaci udaje.', 401);
  }

  const forcedPassword = PRIORITY_ACCOUNT_PASSWORDS.get(
    normalizeUsernameComparable(String(player.username ?? normalizedUsername)),
  );
  const expectedPassword = String(forcedPassword ?? player.password ?? '');
  if (expectedPassword !== normalizedPassword) {
    throw new GameRuleError('Neplatne prihlasovaci udaje.', 401);
  }

  const village = selectVillageByPlayerStmt.get(player.id) ?? null;

  return {
    username: player.username,
    village: {
      id: village ? Number(village.id) : null,
      name: village ? village.name : null,
      kingdom: village ? village.kingdom : null,
      coordX: village ? Number(village.coordX) : null,
      coordY: village ? Number(village.coordY) : null,
    },
  };
};

export const createPlayerAccount = (username, password) => createPlayerAccountTransaction(username, password);

export const listPlayerWorlds = (username) => {
  const normalizedUsername = normalizeUsername(username);
  const player = selectPlayerByUsernameStmt.get(normalizedUsername);
  if (!player) {
    throw new GameRuleError(`Hrac '${normalizedUsername}' neexistuje.`, 404);
  }

  const villages = selectVillagesByPlayerStmt.all(Number(player.id));
  const totalPrestige = villages.reduce((sum, village) => sum + Number(village.prestige ?? 0), 0);
  const primaryKingdom = String(villages[0]?.kingdom ?? 'Neutral');

  return {
    profile: {
      id: Number(player.id),
      username: String(player.username),
      kingdom: primaryKingdom,
      villageCount: villages.length,
      prestige: totalPrestige,
      joinedAt: String(player.createdAt ?? nowIso()),
    },
    worlds: listWorldCatalog().map((world) => ({
      ...world,
      player: {
        ...(() => {
          const villagesInWorld = selectVillagesByPlayerAndRegionStmt.all(Number(player.id), Number(world.region));
          const prestigeInWorld = villagesInWorld.reduce(
            (sum, village) => sum + Number(village.prestige ?? 0),
            0,
          );
          const leaderboardRows = listPlayerLeaderboard(world.id);
          const leaderboardEntry =
            leaderboardRows.find(
              (entry) =>
                normalizeUsernameComparable(String(entry.username)) ===
                normalizeUsernameComparable(String(player.username)),
            ) ?? null;
          const fallbackKingdom = String(villagesInWorld[0]?.kingdom ?? primaryKingdom);
          return {
            hasPresence: villagesInWorld.length > 0,
            villages: villagesInWorld.length,
            prestige: prestigeInWorld,
            rank: leaderboardEntry?.rank ?? null,
            kingdom: villagesInWorld.length > 0 ? String(leaderboardEntry?.kingdom ?? fallbackKingdom) : null,
          };
        })(),
      },
      stats: {
        playerAccounts: Number(
          selectPlayerCountByRegionStmt.get(Number(world.region))?.total ?? 0,
        ),
      },
    })),
    defaultWorldId: resolveWorldById(DEFAULT_WORLD_ID)?.id ?? DEFAULT_WORLD_ID,
  };
};

export const listAdminPlayers = () => {
  const players = selectAdminPlayersStmt.all();
  return players.map((player, index) => ({
    id: index + 1,
    username: player.username,
    kingdom: player.kingdom ?? 'Neutral',
    villageName: player.villageName ?? 'Bez lena',
    villageCount: Number(player.villageCount),
    prestige: Number(player.totalPrestige),
    coordX: player.coordX == null ? 0 : Number(player.coordX),
    coordY: player.coordY == null ? 0 : Number(player.coordY),
    createdAt: player.createdAt,
  }));
};

const buildVillageSortLabel = (village) => {
  const villageName = String(village?.name ?? '').trim();
  const coordX = Number(village?.coordX ?? 0);
  const coordY = Number(village?.coordY ?? 0);
  return `${villageName} (${coordX}|${coordY})`;
};

const toPlannerRecentTargets = (playerId, region) =>
  selectRecentPlannerTargetsByPlayerRegionStmt
    .all(Number(playerId), Number(region))
    .map((row) => ({
      targetPlayerId: Number(row.targetPlayerId),
      targetPlayerUsername: String(row.targetPlayerUsername ?? ''),
      targetVillageId: Number(row.targetVillageId),
      targetVillageName: String(row.targetVillageName ?? ''),
      targetKingdom: String(row.targetKingdom ?? 'Neutral'),
      coordX: Number(row.targetCoordX),
      coordY: Number(row.targetCoordY),
      lastUsedAt: String(row.lastUsedAt ?? nowIso()),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.targetPlayerId) &&
        row.targetPlayerId > 0 &&
        Number.isFinite(row.targetVillageId) &&
        row.targetVillageId > 0 &&
        row.targetPlayerUsername.length > 0,
    );

const createPlannerEntityId = (prefix) =>
  `${String(prefix ?? 'pln')}_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;

const throwPlannerError = (message, errorCode, statusCode = 400, details = null) => {
  throw new GameRuleError(
    String(message ?? 'Planner request selhal.'),
    statusCode,
    errorCode,
    details && typeof details === 'object' ? details : null,
  );
};

const resolvePlannerWorldOrThrow = (worldIdRaw) => {
  const normalizedWorldId = String(worldIdRaw ?? '').trim();
  if (!normalizedWorldId) {
    throwPlannerError("Pole 'worldId' je povinne.", 'PLANNER_WORLD_REQUIRED', 400);
  }

  try {
    return resolveWorldById(normalizedWorldId);
  } catch (error) {
    if (error instanceof GameRuleError && Number(error.statusCode) === 404) {
      throwPlannerError(`Svet '${normalizedWorldId}' nebyl nalezen.`, 'PLANNER_WORLD_NOT_FOUND', 404, {
        worldId: normalizedWorldId,
      });
    }
    throw error;
  }
};

const resolvePlannerContext = (username, worldIdRaw) => {
  const normalizedUsername = normalizeUsername(username);
  const world = resolvePlannerWorldOrThrow(worldIdRaw);
  const { player } = requireVillageForUser(normalizedUsername, null, String(world.id), 'center', {
    syncEconomy: false,
  });
  return {
    player,
    world,
  };
};

const parsePlannerExpectedRevision = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throwPlannerError('Chybi nebo je neplatne expectedRevision.', 'PLANNER_REVISION_CONFLICT', 400);
  }
  return parsed;
};

const toPlannerResolvedTargetSnapshotHash = (target) => {
  const stablePayload = {
    targetPlayerId: Number(target.targetPlayerId),
    targetPlayerUsername: String(target.targetPlayerUsername ?? ''),
    targetVillageId: Number(target.targetVillageId),
    targetVillageName: String(target.targetVillageName ?? ''),
    targetKingdom: String(target.targetKingdom ?? 'Neutral'),
    coordX: Number(target.coordX ?? 0),
    coordY: Number(target.coordY ?? 0),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(stablePayload)).digest('hex')}`;
};

const toPublicPlannerIssue = (issue) => ({
  code: String(issue.code ?? 'PLANNER_VALIDATION_ERROR'),
  severity: String(issue.severity ?? 'blocked') === 'warning' ? 'warning' : 'blocked',
  message: String(issue.message ?? 'Neplatny planner koncept.'),
  scope: String(issue.scope ?? 'plan'),
  ...(Number.isFinite(Number(issue.legOrder)) ? { legOrder: Number(issue.legOrder) } : {}),
  ...(Number.isFinite(Number(issue.legOriginVillageId))
    ? { legOriginVillageId: Number(issue.legOriginVillageId) }
    : {}),
});

const pushPlannerIssue = (issues, issue) => {
  issues.push({
    code: String(issue.code ?? 'PLANNER_VALIDATION_ERROR'),
    severity: String(issue.severity ?? 'blocked') === 'warning' ? 'warning' : 'blocked',
    message: String(issue.message ?? 'Neplatny planner koncept.'),
    scope: String(issue.scope ?? 'plan'),
    legOrder: issue.legOrder == null ? null : Number(issue.legOrder),
    legOriginVillageId: issue.legOriginVillageId == null ? null : Number(issue.legOriginVillageId),
    httpStatus: Number.isInteger(Number(issue.httpStatus)) ? Number(issue.httpStatus) : 400,
  });
};

const resolvePlannerValidationStatus = (issues) => {
  if (issues.some((issue) => String(issue.severity ?? 'blocked') === 'blocked')) {
    return 'blocked';
  }
  if (issues.some((issue) => String(issue.severity ?? 'blocked') === 'warning')) {
    return 'warning';
  }
  return 'ok';
};

const resolvePlannerTarget = ({
  actorPlayerId,
  world,
  targetPlayerUsernameRaw,
  targetVillageIdRaw,
}) => {
  const targetPlayerUsername = String(targetPlayerUsernameRaw ?? '').trim();
  if (!targetPlayerUsername) {
    throwPlannerError("Pole 'targetPlayerUsername' je povinne.", 'PLANNER_TARGET_REQUIRED', 400);
  }

  const targetPlayer = selectNonBotPlayerByUsernameStmt.get(targetPlayerUsername);
  if (!targetPlayer) {
    throwPlannerError(`Cilovy hrac '${targetPlayerUsername}' nebyl nalezen.`, 'PLANNER_TARGET_NOT_FOUND', 404, {
      targetPlayerUsername,
    });
  }

  if (Number(targetPlayer.id) === Number(actorPlayerId)) {
    throwPlannerError('Planovac neumoznuje cilit vlastniho hrace.', 'PLANNER_TARGET_NOT_VALID', 400, {
      targetPlayerUsername,
    });
  }

  const candidateVillages = selectVillagesByPlayerAndRegionStmt.all(
    Number(targetPlayer.id),
    Number(world.region),
  );
  if (candidateVillages.length !== 1) {
    throwPlannerError(
      `Cilovy hrac musi mit v tomto svete prave jedno leno (nalezena: ${candidateVillages.length}).`,
      'PLANNER_TARGET_NOT_SINGLE_VILLAGE',
      409,
      {
        targetPlayerId: Number(targetPlayer.id),
        targetPlayerUsername: String(targetPlayer.username ?? targetPlayerUsername),
        worldId: String(world.id),
        villagesInWorld: candidateVillages.length,
      },
    );
  }

  const targetVillage = candidateVillages[0];
  const requestedTargetVillageId =
    targetVillageIdRaw == null || String(targetVillageIdRaw).trim() === ''
      ? null
      : Number(targetVillageIdRaw);
  if (
    requestedTargetVillageId != null &&
    (!Number.isInteger(requestedTargetVillageId) ||
      requestedTargetVillageId <= 0 ||
      requestedTargetVillageId !== Number(targetVillage.id))
  ) {
    throwPlannerError('Cilove leno neodpovida zvolenemu hraci.', 'PLANNER_TARGET_NOT_FOUND', 404, {
      targetPlayerId: Number(targetPlayer.id),
      requestedTargetVillageId,
    });
  }

  const resolvedTarget = {
    targetPlayerId: Number(targetPlayer.id),
    targetPlayerUsername: String(targetPlayer.username ?? targetPlayerUsername),
    targetVillageId: Number(targetVillage.id),
    targetVillageName: String(targetVillage.name ?? `Leno #${Number(targetVillage.id)}`),
    targetKingdom: String(targetVillage.kingdom ?? 'Neutral'),
    coordX: Number(targetVillage.coordX ?? 0),
    coordY: Number(targetVillage.coordY ?? 0),
  };
  resolvedTarget.snapshotHash = toPlannerResolvedTargetSnapshotHash(resolvedTarget);
  return resolvedTarget;
};

const toPlannerPlanStatusSummary = (planRow) => ({
  id: String(planRow?.id ?? ''),
  status: String(planRow?.status ?? 'scheduled'),
  revision: Math.max(1, Math.floor(Number(planRow?.revision ?? 1))),
  confirmedAt: planRow?.confirmedAt ? String(planRow.confirmedAt) : null,
  updatedAt: planRow?.updatedAt ? String(planRow.updatedAt) : null,
  canceledAt: planRow?.canceledAt ? String(planRow.canceledAt) : null,
});

const buildPlannerPlanDetailFromRow = (planRow) => {
  if (!planRow) {
    return null;
  }

  const planId = String(planRow.id ?? '');
  if (!planId) {
    return null;
  }

  const legRows = selectPlannerLegsByPlanIdStmt.all(planId);
  const legUnitRows = selectPlannerLegUnitsByPlanIdStmt.all(planId);
  const unitsByLegId = new Map();
  for (const row of legUnitRows) {
    const legId = String(row.planLegId ?? '');
    if (!legId) {
      continue;
    }
    const units = unitsByLegId.get(legId) ?? [];
    units.push({
      unitId: String(row.unitId ?? ''),
      plannedAmount: Math.max(0, Math.floor(Number(row.plannedAmount ?? 0))),
    });
    unitsByLegId.set(legId, units);
  }

  return {
    plan: {
      id: planId,
      status: String(planRow.status ?? 'scheduled'),
      revision: Math.max(1, Math.floor(Number(planRow.revision ?? 1))),
      targetVillageId: Math.max(0, Math.floor(Number(planRow.targetVillageId ?? 0))),
      targetPlayerId: Math.max(0, Math.floor(Number(planRow.targetPlayerId ?? 0))),
      targetPlayerUsernameSnapshot: String(planRow.targetPlayerUsernameSnapshot ?? ''),
      targetVillageNameSnapshot: String(planRow.targetVillageNameSnapshot ?? ''),
      targetKingdomSnapshot: String(planRow.targetKingdomSnapshot ?? 'Neutral'),
      confirmedAt: planRow.confirmedAt ? String(planRow.confirmedAt) : null,
      createdAt: String(planRow.createdAt ?? nowIso()),
      updatedAt: String(planRow.updatedAt ?? nowIso()),
      failedAt: planRow.failedAt ? String(planRow.failedAt) : null,
      canceledAt: planRow.canceledAt ? String(planRow.canceledAt) : null,
    },
    legs: legRows.map((legRow) => ({
      id: String(legRow.id ?? ''),
      order: Math.max(1, Math.floor(Number(legRow.legOrder ?? 1))),
      status: String(legRow.status ?? 'scheduled'),
      originVillageId: Math.max(0, Math.floor(Number(legRow.originVillageId ?? 0))),
      originVillageNameSnapshot: String(legRow.originVillageNameSnapshot ?? ''),
      impactAtUtc: String(legRow.impactAtUtc ?? nowIso()),
      sendAtUtc: String(legRow.sendAtUtc ?? nowIso()),
      travelDurationSec: Math.max(1, Math.floor(Number(legRow.travelDurationSec ?? 1))),
      units: unitsByLegId.get(String(legRow.id ?? '')) ?? [],
      failCode: legRow.failCode == null ? null : String(legRow.failCode),
      failMessage: legRow.failMessage == null ? null : String(legRow.failMessage),
    })),
  };
};

const buildPlannerCompletedStubFromRow = (planRow) => {
  if (!planRow) {
    return null;
  }

  const planId = String(planRow.id ?? '');
  if (!planId) {
    return null;
  }

  const legsCount = selectPlannerLegsByPlanIdStmt.all(planId).length;
  return {
    planId,
    targetPlayerUsernameSnapshot: String(planRow.targetPlayerUsernameSnapshot ?? ''),
    targetVillageNameSnapshot: String(planRow.targetVillageNameSnapshot ?? ''),
    targetKingdomSnapshot: String(planRow.targetKingdomSnapshot ?? 'Neutral'),
    legsCount: Math.max(0, Math.floor(Number(legsCount))),
    firstSendAtUtc: planRow.firstSendAtUtc ? String(planRow.firstSendAtUtc) : null,
    lastSendAtUtc: planRow.lastSendAtUtc ? String(planRow.lastSendAtUtc) : null,
    completedAt: String(planRow.completedAt ?? planRow.updatedAt ?? nowIso()),
  };
};

const buildPlannerReadModelForPlayerWorld = (playerId, worldId) => {
  const activeRow = selectActivePlannerPlanByPlayerAndWorldStmt.get(Number(playerId), String(worldId));
  const lastCompletedRow = selectLatestCompletedPlannerPlanByPlayerAndWorldStmt.get(
    Number(playerId),
    String(worldId),
  );
  return {
    activePlan: buildPlannerPlanDetailFromRow(activeRow),
    lastCompletedPlan: buildPlannerCompletedStubFromRow(lastCompletedRow),
  };
};

const insertPlannerPlanEvent = ({
  planId,
  planLegId = null,
  eventType,
  severity = 'info',
  message,
  payload = {},
  createdAt = nowIso(),
}) => {
  insertPlannerPlanEventStmt.run(
    createPlannerEntityId('plev'),
    String(planId),
    planLegId == null ? null : String(planLegId),
    String(eventType ?? 'plan_event'),
    String(severity ?? 'info'),
    String(message ?? 'Planner event'),
    JSON.stringify(payload ?? {}),
    String(createdAt),
  );
};

const persistPlannerLegsForPlan = (planId, normalizedLegs, createdAtIso) => {
  for (const leg of normalizedLegs) {
    const legId = createPlannerEntityId('pll');
    insertPlannerPlanLegStmt.run(
      legId,
      String(planId),
      Math.max(1, Math.floor(Number(leg.order ?? 1))),
      'scheduled',
      Math.max(1, Math.floor(Number(leg.originVillageId ?? 1))),
      String(leg.originVillageNameSnapshot ?? ''),
      String(leg.impactAtUtc),
      String(leg.sendAtUtc),
      Math.max(1, Math.floor(Number(leg.travelDurationSec ?? 1))),
      String(createdAtIso),
      String(createdAtIso),
    );
    for (const unit of leg.units ?? []) {
      insertPlannerPlanLegUnitStmt.run(
        createPlannerEntityId('plu'),
        legId,
        String(unit.unitId ?? ''),
        Math.max(1, Math.floor(Number(unit.amount ?? 1))),
      );
    }
  }
};

const replacePlannerLegsForPlan = (planId, normalizedLegs, updatedAtIso) => {
  deletePlannerPlanLegUnitsByPlanIdStmt.run(String(planId));
  deletePlannerPlanLegsByPlanIdStmt.run(String(planId));
  persistPlannerLegsForPlan(planId, normalizedLegs, updatedAtIso);
};

const readPlannerLegsWithUnits = (planId) => {
  const rows = selectPlannerLegsByPlanIdStmt.all(String(planId));
  const unitRows = selectPlannerLegUnitsByPlanIdStmt.all(String(planId));
  const unitsByLegId = new Map();
  for (const unitRow of unitRows) {
    const legId = String(unitRow.planLegId ?? '');
    if (!legId) {
      continue;
    }
    const bucket = unitsByLegId.get(legId) ?? [];
    bucket.push({
      unitId: String(unitRow.unitId ?? ''),
      plannedAmount: Math.max(0, Math.floor(Number(unitRow.plannedAmount ?? 0))),
    });
    unitsByLegId.set(legId, bucket);
  }

  return rows.map((row) => ({
    ...row,
    units: unitsByLegId.get(String(row.id ?? '')) ?? [],
  }));
};

const toPlannerLegUnitSelection = (leg) => {
  const selection = toCompleteUnitSelection({});
  for (const item of leg?.units ?? []) {
    const unitId = String(item?.unitId ?? '').trim().toLowerCase();
    if (!PLANNER_ALLOWED_ATTACK_UNIT_ID_SET.has(unitId)) {
      continue;
    }
    const amount = Math.max(0, Math.floor(Number(item?.plannedAmount ?? 0)));
    if (amount <= 0) {
      continue;
    }
    selection[unitId] = amount;
  }
  return selection;
};

const resolvePlannerTargetReconfirmationInfo = ({ planRow, targetVillage, world }) => {
  const playerId = Number(planRow?.playerId ?? 0);
  const targetVillageId = Number(planRow?.targetVillageId ?? 0);
  const expectedTargetPlayerId = Number(planRow?.targetPlayerId ?? 0);
  const expectedUsername = String(planRow?.targetPlayerUsernameSnapshot ?? '').trim();
  const expectedKingdom = normalizeKingdomValue(planRow?.targetKingdomSnapshot ?? 'Neutral');

  const targetExists = targetVillage != null && Number(targetVillage.id ?? 0) === targetVillageId;
  const targetInWorld = targetExists && Number(targetVillage.region ?? 0) === Number(world?.region ?? 0);
  const currentTargetPlayerId = targetExists ? Number(targetVillage.playerId ?? 0) : 0;
  const currentUsername = targetExists ? String(targetVillage.ownerUsername ?? '').trim() : '';
  const currentKingdom = targetExists
    ? normalizeKingdomValue(targetVillage.kingdom ?? 'Neutral')
    : normalizeKingdomValue('Neutral');
  const ownerChanged =
    targetExists &&
    (currentTargetPlayerId !== expectedTargetPlayerId ||
      normalizeUsernameComparable(currentUsername) !== normalizeUsernameComparable(expectedUsername));
  const kingdomChanged = targetExists && currentKingdom !== expectedKingdom;
  const targetStillValid = targetInWorld && currentTargetPlayerId > 0 && currentTargetPlayerId !== playerId;

  if (targetStillValid && !ownerChanged && !kingdomChanged) {
    return null;
  }

  const reasonCode = !targetExists || !targetInWorld || !targetStillValid
    ? 'PLANNER_TARGET_NO_LONGER_VALID'
    : ownerChanged
      ? 'PLANNER_TARGET_OWNER_CHANGED'
      : 'PLANNER_TARGET_KINGDOM_CHANGED';

  const message =
    reasonCode === 'PLANNER_TARGET_NO_LONGER_VALID'
      ? 'Cil uz neni validni pro planner utok. Plan vyzaduje upravu.'
      : ownerChanged && kingdomChanged
        ? 'Cil zmenil majitele i kralovstvi. Plan vyzaduje reconfirm.'
        : ownerChanged
          ? 'Cil zmenil majitele. Plan vyzaduje reconfirm.'
          : 'Cil zmenil kralovstvi. Plan vyzaduje reconfirm.';

  return {
    reasonCode,
    message,
    payload: {
      previous: {
        targetPlayerId: expectedTargetPlayerId,
        targetPlayerUsername: expectedUsername,
        targetVillageId,
        targetVillageName: String(planRow?.targetVillageNameSnapshot ?? ''),
        targetKingdom: expectedKingdom,
      },
      current: targetExists
        ? {
            targetPlayerId: currentTargetPlayerId,
            targetPlayerUsername: currentUsername,
            targetVillageId: Number(targetVillage.id),
            targetVillageName: String(targetVillage.name ?? ''),
            targetKingdom: currentKingdom,
          }
        : null,
      targetStillValid,
      worldId: String(world?.id ?? planRow?.worldId ?? ''),
    },
  };
};

const refundPlannerLegUnits = (legs) => {
  for (const leg of legs) {
    const originVillageId = Number(leg?.originVillageId ?? 0);
    if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
      continue;
    }
    for (const item of leg?.units ?? []) {
      const unitId = String(item?.unitId ?? '').trim().toLowerCase();
      if (!PLANNER_ALLOWED_ATTACK_UNIT_ID_SET.has(unitId)) {
        continue;
      }
      const plannedAmount = Math.max(0, Math.floor(Number(item?.plannedAmount ?? 0)));
      if (plannedAmount <= 0) {
        continue;
      }
      const currentAmount = Math.max(
        0,
        Math.floor(Number(selectUnitAmountByVillageAndUnitStmt.get(originVillageId, unitId)?.amount ?? 0)),
      );
      updateUnitAmountStmt.run(currentAmount + plannedAmount, originVillageId, unitId);
    }
  }
};

const failPlannerPlanNow = ({
  planRow,
  tickTimeIso,
  failCode,
  failMessage,
  failedLeg = null,
  refundLegs = [],
  payload = {},
}) => {
  if (Array.isArray(refundLegs) && refundLegs.length > 0) {
    refundPlannerLegUnits(refundLegs);
  }

  if (failedLeg) {
    updatePlannerLegToFailedStmt.run(
      String(failCode ?? 'PLANNER_DISPATCH_FAILED'),
      String(failMessage ?? 'Planner leg selhal.'),
      String(tickTimeIso),
      String(failedLeg.id),
    );
  }
  updatePlannerScheduledLegsToCanceledByPlanStmt.run(String(tickTimeIso), String(planRow.id));
  updatePlannerPlanToFailedStmt.run(String(tickTimeIso), String(tickTimeIso), String(planRow.id));

  insertPlannerPlanEvent({
    planId: String(planRow.id),
    planLegId: failedLeg ? String(failedLeg.id) : null,
    eventType: 'plan_failed',
    severity: 'error',
    message: String(failMessage ?? 'Planner plan selhal.'),
    payload: {
      planId: String(planRow.id),
      planStatus: String(planRow.status ?? ''),
      failCode: String(failCode ?? 'PLANNER_DISPATCH_FAILED'),
      failedLegOrder: failedLeg ? Number(failedLeg.legOrder ?? 0) : null,
      ...payload,
    },
    createdAt: String(tickTimeIso),
  });
};

const movePlannerPlanToNeedsReconfirmation = ({ planRow, reconfirmation, tickTimeIso }) => {
  const updated = updatePlannerPlanToNeedsReconfirmationStmt.run(String(tickTimeIso), String(planRow.id));
  if (Number(updated?.changes ?? 0) <= 0) {
    return false;
  }

  insertPlannerPlanEvent({
    planId: String(planRow.id),
    eventType: 'plan_needs_reconfirmation',
    severity: 'warning',
    message: String(reconfirmation?.message ?? 'Plan vyzaduje reconfirm.'),
    payload: {
      planId: String(planRow.id),
      reasonCode: String(reconfirmation?.reasonCode ?? 'PLANNER_TARGET_CHANGED'),
      ...(reconfirmation?.payload ?? {}),
    },
    createdAt: String(tickTimeIso),
  });
  return true;
};

const preflightPlannerPlanDispatch = ({ planRow, world, legs, targetVillage }) => {
  const scheduledLegs = legs.filter((leg) => String(leg.status ?? '') === 'scheduled');
  if (scheduledLegs.length <= 0) {
    return {
      ok: false,
      failure: {
        code: 'PLANNER_LEGS_REQUIRED',
        message: 'Plan nema zadne planovane legy.',
        leg: null,
      },
      reservations: [],
    };
  }

  if (!targetVillage || Number(targetVillage.region ?? 0) !== Number(world?.region ?? 0)) {
    return {
      ok: false,
      failure: {
        code: 'PLANNER_TARGET_NO_LONGER_VALID',
        message: 'Cil uz neni v tomto svete dostupny.',
        leg: null,
      },
      reservations: [],
    };
  }

  if (Number(targetVillage.playerId ?? 0) === Number(planRow.playerId ?? 0)) {
    return {
      ok: false,
      failure: {
        code: 'PLANNER_TARGET_NO_LONGER_VALID',
        message: 'Cil uz patri tobe, plan nelze odeslat.',
        leg: null,
      },
      reservations: [],
    };
  }

  const spawnConfig = resolveWorldSpawnConfig(world);
  const protectionDays = Math.max(0, Number(spawnConfig.playerProtectionDays ?? 0));
  const targetOwnerUsernameComparable = normalizeUsernameComparable(String(targetVillage.ownerUsername ?? ''));
  const isTargetAbandonedBot =
    Number(targetVillage.ownerIsBot ?? 0) === 1 &&
    targetOwnerUsernameComparable.startsWith(normalizeUsernameComparable(ABANDONED_BOT_USERNAME_PREFIX));

  const attackerPrestige = getPlayerPrestigeInRegion(Number(planRow.playerId), Number(world.region));
  const defenderPrestige = getPlayerPrestigeInRegion(Number(targetVillage.playerId), Number(targetVillage.region));
  const prestigeLock = evaluatePrestigeAttackLock({
    attackerPrestige,
    defenderPrestige,
    attackerPlayerId: Number(planRow.playerId),
    defenderPlayerId: Number(targetVillage.playerId),
    region: Number(world.region),
  });
  if (!isTargetAbandonedBot && !prestigeLock.canAttack) {
    return {
      ok: false,
      failure: {
        code: 'PLANNER_ATTACK_BLOCKED_PRESTIGE',
        message:
          `Balanc prestize blokuje utok: cil ma ${Math.floor(defenderPrestige).toLocaleString('cs-CZ')} prestize, ` +
          `potrebuje alespon ${prestigeLock.minimumDefenderPrestige.toLocaleString('cs-CZ')}.`,
        leg: null,
      },
      reservations: [],
    };
  }

  const reservationsByVillageUnit = new Map();
  const originVillageById = new Map();
  const reserve = (originVillageId, unitId, amount) => {
    const key = `${originVillageId}:${unitId}`;
    const current = Math.max(0, Math.floor(Number(reservationsByVillageUnit.get(key) ?? 0)));
    reservationsByVillageUnit.set(key, current + amount);
  };

  for (const leg of scheduledLegs) {
    const originVillageId = Number(leg.originVillageId ?? 0);
    const legOrder = Math.max(1, Math.floor(Number(leg.legOrder ?? 1)));
    if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
      return {
        ok: false,
        failure: {
          code: 'PLANNER_ORIGIN_NOT_OWNED',
          message: `Leg #${legOrder} ma neplatny puvod.`,
          leg,
        },
        reservations: [],
      };
    }

    const originVillage =
      originVillageById.get(originVillageId) ?? selectVillageWithOwnerByIdStmt.get(originVillageId) ?? null;
    if (!originVillageById.has(originVillageId)) {
      originVillageById.set(originVillageId, originVillage);
    }
    if (
      !originVillage ||
      Number(originVillage.playerId ?? 0) !== Number(planRow.playerId ?? 0) ||
      Number(originVillage.region ?? 0) !== Number(world?.region ?? 0)
    ) {
      return {
        ok: false,
        failure: {
          code: 'PLANNER_ORIGIN_NOT_OWNED',
          message: `Leg #${legOrder} uz nema validni puvodni leno.`,
          leg,
        },
        reservations: [],
      };
    }

    if (Number(originVillage.id ?? 0) === Number(targetVillage.id ?? 0)) {
      return {
        ok: false,
        failure: {
          code: 'PLANNER_TARGET_NO_LONGER_VALID',
          message: `Leg #${legOrder} miri na stejne leno jako puvod.`,
          leg,
        },
        reservations: [],
      };
    }

    if (protectionDays > 0 && !isTargetAbandonedBot) {
      if (isVillageUnderSpawnProtection(originVillage, protectionDays)) {
        return {
          ok: false,
          failure: {
            code: 'PLANNER_ATTACK_BLOCKED_SPAWN_PROTECTION',
            message:
              `Leg #${legOrder} je blokovan: puvodni leno je pod novackou ochranou (max ${protectionDays} dni).`,
            leg,
          },
          reservations: [],
        };
      }
      if (isVillageUnderSpawnProtection(targetVillage, protectionDays)) {
        return {
          ok: false,
          failure: {
            code: 'PLANNER_ATTACK_BLOCKED_SPAWN_PROTECTION',
            message:
              `Leg #${legOrder} je blokovan: cil je pod novackou ochranou (max ${protectionDays} dni).`,
            leg,
          },
          reservations: [],
        };
      }
    }

    const selectedUnits = toPlannerLegUnitSelection(leg);
    const totalUnits = sumSelectedUnits(selectedUnits);
    if (totalUnits <= 0) {
      return {
        ok: false,
        failure: {
          code: 'PLANNER_UNIT_AMOUNT_INVALID',
          message: `Leg #${legOrder} nema validni jednotky.`,
          leg,
        },
        reservations: [],
      };
    }

    for (const unitId of PLANNER_ALLOWED_ATTACK_UNIT_IDS) {
      const requestedAmount = Math.max(0, Math.floor(Number(selectedUnits[unitId] ?? 0)));
      if (requestedAmount <= 0) {
        continue;
      }
      const availableAmount = Math.max(
        0,
        Math.floor(Number(selectUnitAmountByVillageAndUnitStmt.get(originVillageId, unitId)?.amount ?? 0)),
      );
      if (requestedAmount > availableAmount) {
        return {
          ok: false,
          failure: {
            code: 'PLANNER_UNIT_AMOUNT_INVALID',
            message: `Leg #${legOrder} nema dostatek jednotek '${unitId}'.`,
            leg,
          },
          reservations: [],
        };
      }
      reserve(originVillageId, unitId, requestedAmount);
    }
  }

  const reservations = [];
  for (const [key, amount] of reservationsByVillageUnit.entries()) {
    if (amount <= 0) {
      continue;
    }
    const [originVillageIdRaw, unitId] = key.split(':');
    const originVillageId = Number(originVillageIdRaw);
    if (!Number.isFinite(originVillageId) || originVillageId <= 0 || !unitId) {
      continue;
    }
    reservations.push({
      originVillageId,
      unitId,
      amount: Math.max(0, Math.floor(Number(amount))),
    });
  }

  return { ok: true, reservations, failure: null };
};

const reservePlannerUnitsForDispatch = (reservations) => {
  for (const entry of reservations) {
    const originVillageId = Number(entry.originVillageId);
    const unitId = String(entry.unitId ?? '');
    const amount = Math.max(0, Math.floor(Number(entry.amount ?? 0)));
    if (!Number.isFinite(originVillageId) || originVillageId <= 0 || !unitId || amount <= 0) {
      continue;
    }
    const availableAmount = Math.max(
      0,
      Math.floor(Number(selectUnitAmountByVillageAndUnitStmt.get(originVillageId, unitId)?.amount ?? 0)),
    );
    if (amount > availableAmount) {
      return {
        ok: false,
        code: 'PLANNER_UNIT_AMOUNT_INVALID',
        message: `Pri rezervaci chybi jednotky '${unitId}' v lenu #${originVillageId}.`,
      };
    }
    updateUnitAmountStmt.run(availableAmount - amount, originVillageId, unitId);
  }
  return { ok: true };
};

const finalizePlannerPlanIfDispatched = (planId, tickTimeIso) => {
  const pendingLegs = selectPlannerLegsByPlanIdStmt
    .all(String(planId))
    .filter((leg) => String(leg.status ?? '') === 'scheduled');
  if (pendingLegs.length > 0) {
    return false;
  }
  const updated = updatePlannerPlanToCompletedStmt.run(String(tickTimeIso), String(tickTimeIso), String(planId));
  if (Number(updated?.changes ?? 0) <= 0) {
    return false;
  }
  insertPlannerPlanEvent({
    planId: String(planId),
    eventType: 'plan_completed',
    severity: 'info',
    message: 'Plan byl kompletne odeslan.',
    payload: {
      planId: String(planId),
      completedAt: String(tickTimeIso),
    },
    createdAt: String(tickTimeIso),
  });
  return true;
};

const processPlannerDispatches = (tickTimeIso) => {
  const tickTimeMs = Date.parse(String(tickTimeIso));
  const safeTickMs = Number.isFinite(tickTimeMs) ? tickTimeMs : Date.now();
  const stats = {
    plansNeedsReconfirmation: 0,
    plansDispatchingStarted: 0,
    plansFailed: 0,
    plansCompleted: 0,
    legsSent: 0,
  };

  const scheduledPlans = selectPlannerPlansByStatusStmt.all('scheduled');
  for (const planRow of scheduledPlans) {
    const planId = String(planRow.id ?? '');
    if (!planId) {
      continue;
    }

    let world = null;
    try {
      world = resolveWorldById(String(planRow.worldId ?? ''));
    } catch {
      failPlannerPlanNow({
        planRow,
        tickTimeIso,
        failCode: 'PLANNER_WORLD_NOT_FOUND',
        failMessage: `Plan ${planId} ma neplatny world.`,
        failedLeg: null,
      });
      stats.plansFailed += 1;
      continue;
    }

    const targetVillage = selectVillageWithOwnerByIdStmt.get(Number(planRow.targetVillageId ?? 0));
    const reconfirmation = resolvePlannerTargetReconfirmationInfo({
      planRow,
      targetVillage,
      world,
    });
    if (reconfirmation) {
      if (
        movePlannerPlanToNeedsReconfirmation({
          planRow,
          reconfirmation,
          tickTimeIso,
        })
      ) {
        stats.plansNeedsReconfirmation += 1;
      }
      continue;
    }

    const firstSendAtMs = Date.parse(String(planRow.firstSendAtUtc ?? ''));
    if (!Number.isFinite(firstSendAtMs) || firstSendAtMs > safeTickMs) {
      continue;
    }

    const legs = readPlannerLegsWithUnits(planId);
    const preflight = preflightPlannerPlanDispatch({
      planRow,
      world,
      legs,
      targetVillage,
    });
    if (!preflight.ok) {
      failPlannerPlanNow({
        planRow,
        tickTimeIso,
        failCode: String(preflight.failure?.code ?? 'PLANNER_DISPATCH_FAILED'),
        failMessage: String(preflight.failure?.message ?? 'Planner dispatch selhal.'),
        failedLeg: preflight.failure?.leg ?? null,
        payload: {
          stage: 'preflight',
        },
      });
      stats.plansFailed += 1;
      continue;
    }

    const reservationResult = reservePlannerUnitsForDispatch(preflight.reservations);
    if (!reservationResult.ok) {
      failPlannerPlanNow({
        planRow,
        tickTimeIso,
        failCode: String(reservationResult.code ?? 'PLANNER_DISPATCH_FAILED'),
        failMessage: String(reservationResult.message ?? 'Planner rezervace jednotek selhala.'),
        failedLeg: null,
        payload: {
          stage: 'reserve',
        },
      });
      stats.plansFailed += 1;
      continue;
    }

    const updated = updatePlannerPlanToDispatchingStmt.run(String(tickTimeIso), String(tickTimeIso), planId);
    if (Number(updated?.changes ?? 0) <= 0) {
      const notSentLegs = legs.filter((leg) => String(leg.status ?? '') === 'scheduled');
      if (notSentLegs.length > 0) {
        refundPlannerLegUnits(notSentLegs);
      }
      continue;
    }

    insertPlannerPlanEvent({
      planId,
      eventType: 'plan_dispatch_started',
      severity: 'info',
      message: 'Planner pre-flight uspesny, plan prechazi do dispatchingu.',
      payload: {
        planId,
        legsCount: legs.length,
      },
      createdAt: String(tickTimeIso),
    });
    stats.plansDispatchingStarted += 1;
  }

  const dispatchingPlans = selectPlannerPlansByStatusStmt.all('dispatching');
  for (const planRow of dispatchingPlans) {
    const planId = String(planRow.id ?? '');
    if (!planId) {
      continue;
    }

    let world = null;
    try {
      world = resolveWorldById(String(planRow.worldId ?? ''));
    } catch {
      const allLegs = readPlannerLegsWithUnits(planId);
      const pendingLegs = allLegs.filter((leg) => String(leg.status ?? '') === 'scheduled');
      failPlannerPlanNow({
        planRow,
        tickTimeIso,
        failCode: 'PLANNER_WORLD_NOT_FOUND',
        failMessage: `Plan ${planId} ma neplatny world.`,
        failedLeg: null,
        refundLegs: pendingLegs,
      });
      stats.plansFailed += 1;
      continue;
    }

    const targetVillage = selectVillageWithOwnerByIdStmt.get(Number(planRow.targetVillageId ?? 0));
    const allLegs = readPlannerLegsWithUnits(planId);
    const pendingLegs = allLegs.filter((leg) => String(leg.status ?? '') === 'scheduled');

    if (
      !targetVillage ||
      Number(targetVillage.region ?? 0) !== Number(world.region ?? 0) ||
      Number(targetVillage.playerId ?? 0) === Number(planRow.playerId ?? 0)
    ) {
      failPlannerPlanNow({
        planRow,
        tickTimeIso,
        failCode: 'PLANNER_TARGET_NO_LONGER_VALID',
        failMessage: 'Cil uz neni validni v dobe dispatchingu.',
        failedLeg: null,
        refundLegs: pendingLegs,
      });
      stats.plansFailed += 1;
      continue;
    }

    if (pendingLegs.length <= 0) {
      if (finalizePlannerPlanIfDispatched(planId, tickTimeIso)) {
        stats.plansCompleted += 1;
      }
      continue;
    }

    const dueLegs = pendingLegs.filter((leg) => {
      const sendAtMs = Date.parse(String(leg.sendAtUtc ?? ''));
      return Number.isFinite(sendAtMs) && sendAtMs <= safeTickMs;
    });
    if (dueLegs.length <= 0) {
      continue;
    }

    const commander = selectPlayerByIdStmt.get(Number(planRow.playerId ?? 0));
    let planFailed = false;
    for (const leg of dueLegs) {
      if (planFailed) {
        break;
      }
      const originVillage = selectVillageByIdStmt.get(Number(leg.originVillageId ?? 0));
      if (!originVillage || Number(originVillage.playerId ?? 0) !== Number(planRow.playerId ?? 0)) {
        failPlannerPlanNow({
          planRow,
          tickTimeIso,
          failCode: 'PLANNER_ORIGIN_NOT_OWNED',
          failMessage: `Leg #${Math.max(1, Math.floor(Number(leg.legOrder ?? 1)))} uz nema validni puvodni leno.`,
          failedLeg: leg,
          refundLegs: pendingLegs,
          payload: {
            stage: 'dispatch',
          },
        });
        stats.plansFailed += 1;
        planFailed = true;
        break;
      }

      const legSelection = toPlannerLegUnitSelection(leg);
      const totalUnits = sumSelectedUnits(legSelection);
      if (totalUnits <= 0) {
        failPlannerPlanNow({
          planRow,
          tickTimeIso,
          failCode: 'PLANNER_UNIT_AMOUNT_INVALID',
          failMessage: `Leg #${Math.max(1, Math.floor(Number(leg.legOrder ?? 1)))} nema validni jednotky.`,
          failedLeg: leg,
          refundLegs: pendingLegs,
          payload: {
            stage: 'dispatch',
          },
        });
        stats.plansFailed += 1;
        planFailed = true;
        break;
      }

      const parsedSendAtMs = Date.parse(String(leg.sendAtUtc ?? ''));
      const startedAtIso = Number.isFinite(parsedSendAtMs) ? String(leg.sendAtUtc) : String(tickTimeIso);
      const parsedImpactAtMs = Date.parse(String(leg.impactAtUtc ?? ''));
      const fallbackArriveAtMs =
        (Number.isFinite(parsedSendAtMs) ? parsedSendAtMs : safeTickMs) +
        Math.max(1, Math.floor(Number(leg.travelDurationSec ?? 1))) * 1000;
      const arriveAtIso =
        Number.isFinite(parsedImpactAtMs) && parsedImpactAtMs > (Number.isFinite(parsedSendAtMs) ? parsedSendAtMs : 0)
          ? String(leg.impactAtUtc)
          : new Date(fallbackArriveAtMs).toISOString();

      try {
        const inserted = insertArmyMovementWithPlannerRefsStmt.run(
          Number(planRow.playerId),
          planId,
          String(leg.id),
          'attack',
          Number(originVillage.id),
          Number(targetVillage.id),
          Number(originVillage.id),
          null,
          0,
          0,
          0,
          startedAtIso,
          arriveAtIso,
          'in_progress',
        );
        const movementId = Number(inserted.lastInsertRowid);
        for (const unitId of PLANNER_ALLOWED_ATTACK_UNIT_IDS) {
          const amount = Math.max(0, Math.floor(Number(legSelection[unitId] ?? 0)));
          if (amount <= 0) {
            continue;
          }
          insertArmyMovementUnitStmt.run(movementId, unitId, amount);
        }

        updatePlannerLegToSentStmt.run(String(tickTimeIso), String(tickTimeIso), String(leg.id));
        insertPlannerPlanEvent({
          planId,
          planLegId: String(leg.id),
          eventType: 'leg_sent',
          severity: 'info',
          message: `Leg #${Math.max(1, Math.floor(Number(leg.legOrder ?? 1)))} byl odeslan.`,
          payload: {
            planId,
            planLegId: String(leg.id),
            movementId,
            originVillageId: Number(originVillage.id),
            targetVillageId: Number(targetVillage.id),
            totalUnits,
            sendAtUtc: String(leg.sendAtUtc ?? tickTimeIso),
            impactAtUtc: String(leg.impactAtUtc ?? arriveAtIso),
          },
          createdAt: String(tickTimeIso),
        });

        if (Number(targetVillage.ownerIsBot ?? 0) !== 1) {
          registerCombatRetaliationFlag({
            aggressorPlayerId: Number(planRow.playerId),
            defenderPlayerId: Number(targetVillage.playerId),
            region: Number(world.region),
            attackedAtIso: String(tickTimeIso),
          });
        }

        const remainingSec = Math.max(0, Math.ceil((Date.parse(arriveAtIso) - safeTickMs) / 1000));
        createPlayerNotification({
          playerId: Number(planRow.playerId),
          region: Number(world.region),
          category: 'command',
          eventType: 'army_command_sent',
          severity: 'info',
          title: 'Plánovaný útok odeslán',
          summary:
            `Plánovaný útok z osady ${String(originVillage.name)} na ${String(targetVillage.name)} ` +
            `dorazí za ${formatRemaining(remainingSec)}.`,
          payload: {
            movementId,
            planId,
            planLegId: String(leg.id),
            commandType: 'attack',
            originVillageId: Number(originVillage.id),
            originVillageName: String(originVillage.name ?? ''),
            targetVillageId: Number(targetVillage.id),
            targetVillageName: String(targetVillage.name ?? ''),
            totalUnits,
            arriveAt: arriveAtIso,
          },
          sourceType: 'army_movement',
          sourceId: movementId,
          createdAt: String(tickTimeIso),
        });
        if (Number(targetVillage.playerId) !== Number(planRow.playerId) && Number(targetVillage.ownerIsBot ?? 0) !== 1) {
          createPlayerNotification({
            playerId: Number(targetVillage.playerId),
            region: Number(targetVillage.region),
            category: 'combat',
            eventType: 'incoming_attack',
            severity: 'critical',
            title: `Příchozí útok na ${String(targetVillage.name)}`,
            summary:
              `${String(commander?.username ?? 'Neznamy velitel')} vyslal plánovaný útok z ` +
              `${String(originVillage.name)}. ETA ${formatRemaining(remainingSec)}.`,
            payload: {
              movementId,
              planId,
              planLegId: String(leg.id),
              commandType: 'attack',
              commanderUsername: String(commander?.username ?? 'Neznamy velitel'),
              originVillageId: Number(originVillage.id),
              originVillageName: String(originVillage.name ?? ''),
              targetVillageId: Number(targetVillage.id),
              targetVillageName: String(targetVillage.name ?? ''),
              totalUnits,
              arriveAt: arriveAtIso,
            },
            sourceType: 'army_movement',
            sourceId: movementId,
            createdAt: String(tickTimeIso),
          });
        }

        stats.legsSent += 1;
      } catch {
        const refreshedLegs = readPlannerLegsWithUnits(planId);
        const notSentLegs = refreshedLegs.filter((item) => String(item.status ?? '') === 'scheduled');
        failPlannerPlanNow({
          planRow,
          tickTimeIso,
          failCode: 'PLANNER_DISPATCH_FAILED',
          failMessage: `Leg #${Math.max(1, Math.floor(Number(leg.legOrder ?? 1)))} se nepodarilo odeslat.`,
          failedLeg: leg,
          refundLegs: notSentLegs,
          payload: {
            stage: 'dispatch',
          },
        });
        stats.plansFailed += 1;
        planFailed = true;
        break;
      }
    }

    if (planFailed) {
      continue;
    }

    if (finalizePlannerPlanIfDispatched(planId, tickTimeIso)) {
      stats.plansCompleted += 1;
    }
  }

  return stats;
};

const validatePlannerPayloadCore = (username, worldIdRaw, payload, options = {}) => {
  const throwOnBlocked = options.throwOnBlocked === true;
  const leadTimeBlockedStatusCode = Number(options.leadTimeBlockedStatusCode ?? 400);
  const { player, world } = resolvePlannerContext(username, worldIdRaw);
  const resolvedTarget = resolvePlannerTarget({
    actorPlayerId: Number(player.id),
    world,
    targetPlayerUsernameRaw: payload?.targetPlayerUsername,
    targetVillageIdRaw: payload?.targetVillageId,
  });

  const legs = payload?.legs;
  if (!Array.isArray(legs) || legs.length <= 0) {
    throwPlannerError('Koncept planu musi obsahovat alespon jeden leg.', 'PLANNER_LEGS_REQUIRED', 400);
  }
  if (legs.length > PLANNER_MAX_LEGS) {
    throwPlannerError(
      `Planovac podporuje maximalne ${PLANNER_MAX_LEGS} legu.`,
      'PLANNER_MAX_LEGS_EXCEEDED',
      400,
      {
        maxLegs: PLANNER_MAX_LEGS,
        receivedLegs: legs.length,
      },
    );
  }

  const ownVillages = selectVillagesByPlayerAndRegionStmt.all(Number(player.id), Number(world.region));
  const ownVillageById = new Map(ownVillages.map((village) => [Number(village.id), village]));
  const unitCountsByVillageId = new Map();
  const readVillageUnits = (villageId) => {
    const numericVillageId = Number(villageId);
    if (unitCountsByVillageId.has(numericVillageId)) {
      return unitCountsByVillageId.get(numericVillageId);
    }
    const counts = toUnitCountMap(selectUnitsByVillageStmt.all(numericVillageId));
    unitCountsByVillageId.set(numericVillageId, counts);
    return counts;
  };

  const issues = [];
  const normalizedLegs = [];
  const seenOrigins = new Set();
  const seenOrders = new Set();
  const nowMs = Date.now();
  const minAllowedSendAtMs = nowMs + PLANNER_LEAD_TIME_SEC * 1000;
  const minImpactGapMs = PLANNER_MIN_IMPACT_GAP_MINUTES * 60 * 1000;

  for (let index = 0; index < legs.length; index += 1) {
    const legRaw = legs[index] ?? {};
    const parsedOrder = Number(legRaw.order);
    const parsedOriginVillageId = Number(legRaw.originVillageId);
    const legOrder = Number.isInteger(parsedOrder) && parsedOrder > 0 ? parsedOrder : null;
    const legOriginVillageId =
      Number.isInteger(parsedOriginVillageId) && parsedOriginVillageId > 0 ? parsedOriginVillageId : null;
    let legHasBlockingIssue = false;

    if (legOrder == null) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_ORDER_INVALID',
        message: `Leg #${index + 1} ma neplatne poradi.`,
        scope: 'leg',
        legOrder: index + 1,
      });
      legHasBlockingIssue = true;
    } else if (seenOrders.has(legOrder)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_ORDER_INVALID',
        message: `Poradi legu musi byt unikatni (duplicitni poradi ${legOrder}).`,
        scope: 'leg',
        legOrder,
      });
      legHasBlockingIssue = true;
    } else {
      seenOrders.add(legOrder);
    }

    if (legOriginVillageId == null || !ownVillageById.has(legOriginVillageId)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_ORIGIN_NOT_OWNED',
        message: `Leg #${legOrder ?? index + 1} pouziva neplatne nebo cizi puvodni leno.`,
        scope: 'leg',
        legOrder: legOrder ?? index + 1,
        legOriginVillageId,
      });
      legHasBlockingIssue = true;
    } else if (seenOrigins.has(legOriginVillageId)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_DUPLICATE_ORIGIN',
        message: `Puvodni leno ${legOriginVillageId} lze v planu pouzit jen jednou.`,
        scope: 'leg',
        legOrder: legOrder ?? index + 1,
        legOriginVillageId,
      });
      legHasBlockingIssue = true;
    } else {
      seenOrigins.add(legOriginVillageId);
    }

    const impactAtPrague = String(legRaw.impactAtPrague ?? '').trim();
    const impactAtMs = Date.parse(impactAtPrague);
    if (!impactAtPrague || !Number.isFinite(impactAtMs)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_ORDER_INVALID',
        message: `Leg #${legOrder ?? index + 1} ma neplatny impactAtPrague.`,
        scope: 'leg',
        legOrder: legOrder ?? index + 1,
        legOriginVillageId,
      });
      legHasBlockingIssue = true;
    }

    const unitsRaw = Array.isArray(legRaw.units) ? legRaw.units : [];
    const unitAmountById = new Map();
    if (unitsRaw.length <= 0) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_UNIT_AMOUNT_INVALID',
        message: `Leg #${legOrder ?? index + 1} nema zadane jednotky.`,
        scope: 'leg',
        legOrder: legOrder ?? index + 1,
        legOriginVillageId,
      });
      legHasBlockingIssue = true;
    }

    for (const unitRaw of unitsRaw) {
      const unitId = String(unitRaw?.unitId ?? '')
        .trim()
        .toLowerCase();
      const amount = Number(unitRaw?.amount);
      if (!PLANNER_ALLOWED_ATTACK_UNIT_ID_SET.has(unitId)) {
        pushPlannerIssue(issues, {
          code: 'PLANNER_UNIT_TYPE_NOT_ALLOWED',
          message: `Jednotka '${unitId || 'unknown'}' neni v planovaci povolena.`,
          scope: 'leg',
          legOrder: legOrder ?? index + 1,
          legOriginVillageId,
        });
        legHasBlockingIssue = true;
        continue;
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        pushPlannerIssue(issues, {
          code: 'PLANNER_UNIT_AMOUNT_INVALID',
          message: `Leg #${legOrder ?? index + 1} ma neplatny pocet jednotek '${unitId}'.`,
          scope: 'leg',
          legOrder: legOrder ?? index + 1,
          legOriginVillageId,
        });
        legHasBlockingIssue = true;
        continue;
      }
      const nextAmount = Math.max(0, Math.floor(Number(unitAmountById.get(unitId) ?? 0))) + amount;
      unitAmountById.set(unitId, nextAmount);
    }

    if (legOriginVillageId != null && ownVillageById.has(legOriginVillageId)) {
      const availableUnits = readVillageUnits(legOriginVillageId);
      for (const [unitId, plannedAmount] of unitAmountById.entries()) {
        const availableAmount = Math.max(0, Math.floor(Number(availableUnits?.[unitId] ?? 0)));
        if (plannedAmount > availableAmount) {
          pushPlannerIssue(issues, {
            code: 'PLANNER_UNIT_AMOUNT_INVALID',
            message: `Leg #${legOrder ?? index + 1} nema dostatek jednotek '${unitId}' v puvodnim lenu.`,
            scope: 'leg',
            legOrder: legOrder ?? index + 1,
            legOriginVillageId,
          });
          legHasBlockingIssue = true;
        }
      }
    }

    if (unitAmountById.size <= 0) {
      legHasBlockingIssue = true;
    }

    if (legHasBlockingIssue) {
      continue;
    }

    const originVillage = ownVillageById.get(legOriginVillageId);
    const selectedUnits = toCompleteUnitSelection({});
    for (const [unitId, amount] of unitAmountById.entries()) {
      selectedUnits[unitId] = amount;
    }
    const distanceTiles = calculateTileDistance(originVillage, resolvedTarget);
    const travelDurationSec = Math.max(
      1,
      Math.floor(Number(calculateArmyTravelDurationSec(selectedUnits, distanceTiles))),
    );
    if (!Number.isFinite(travelDurationSec) || travelDurationSec <= 0) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_UNIT_AMOUNT_INVALID',
        message: `Leg #${legOrder} nema validni slozeni pro vypocet cesty.`,
        scope: 'leg',
        legOrder,
        legOriginVillageId,
      });
      continue;
    }

    const sendAtMs = impactAtMs - travelDurationSec * 1000;
    if (!Number.isFinite(sendAtMs)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_ORDER_INVALID',
        message: `Leg #${legOrder} ma neplatny impact cas.`,
        scope: 'leg',
        legOrder,
        legOriginVillageId,
      });
      continue;
    }

    if (sendAtMs < minAllowedSendAtMs) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_LEAD_TIME_EXPIRED',
        message: `Lead time vyprsel pro leg #${legOrder}.`,
        scope: 'leg',
        legOrder,
        legOriginVillageId,
        httpStatus: leadTimeBlockedStatusCode,
      });
      continue;
    }

    normalizedLegs.push({
      order: legOrder,
      originVillageId: legOriginVillageId,
      originVillageNameSnapshot: String(originVillage?.name ?? `Leno #${legOriginVillageId}`),
      impactAtPrague,
      impactAtUtc: new Date(impactAtMs).toISOString(),
      impactAtMs,
      sendAtUtc: new Date(sendAtMs).toISOString(),
      sendAtMs,
      travelDurationSec,
      units: PLANNER_ALLOWED_ATTACK_UNIT_IDS.map((unitId) => ({
        unitId,
        amount: Math.max(0, Math.floor(Number(unitAmountById.get(unitId) ?? 0))),
      })).filter((unit) => unit.amount > 0),
    });
  }

  normalizedLegs.sort((left, right) => Number(left.order) - Number(right.order));
  for (let index = 1; index < normalizedLegs.length; index += 1) {
    const previous = normalizedLegs[index - 1];
    const current = normalizedLegs[index];
    if (Number(current.impactAtMs) <= Number(previous.impactAtMs)) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_ORDER_INVALID',
        message: `Leg #${current.order} musi mit pozdejsi impact nez leg #${previous.order}.`,
        scope: 'leg',
        legOrder: current.order,
        legOriginVillageId: current.originVillageId,
      });
      continue;
    }
    const gapMs = Number(current.impactAtMs) - Number(previous.impactAtMs);
    if (gapMs < minImpactGapMs) {
      pushPlannerIssue(issues, {
        code: 'PLANNER_IMPACT_GAP_TOO_SMALL',
        message: `Mezi legy #${previous.order} a #${current.order} musi byt alespon ${PLANNER_MIN_IMPACT_GAP_MINUTES} minuta.`,
        scope: 'plan',
      });
    }
  }

  const validationStatus = resolvePlannerValidationStatus(issues);
  const publicIssues = issues.map((issue) => toPublicPlannerIssue(issue));
  const response = {
    resolvedTarget,
    normalizedLegs: normalizedLegs.map(({ impactAtMs: _impactAtMs, sendAtMs: _sendAtMs, ...leg }) => leg),
    validation: {
      status: validationStatus,
      issues: publicIssues,
    },
  };

  if (throwOnBlocked && validationStatus === 'blocked') {
    const blockingIssue = issues.find((issue) => String(issue.severity) === 'blocked') ?? issues[0];
    const blockedStatusCode =
      String(blockingIssue.code ?? '') === 'PLANNER_LEAD_TIME_EXPIRED'
        ? leadTimeBlockedStatusCode
        : Number(blockingIssue.httpStatus ?? 400);
    throwPlannerError(
      String(blockingIssue.message ?? 'Planner koncept je blokovany.'),
      String(blockingIssue.code ?? 'PLANNER_VALIDATION_ERROR'),
      blockedStatusCode,
      {
        issues: publicIssues,
      },
    );
  }

  return {
    player,
    world,
    validation: response,
  };
};

const createPlannerPlanTransaction = db.transaction((username, payload = {}, worldIdRaw = null) => {
  const confirmation = payload?.confirmation;
  if (!confirmation || confirmation.confirmedByPlayer !== true) {
    throwPlannerError('Pred ulozenim je nutne potvrzeni planu.', 'PLANNER_CONFIRMATION_REQUIRED', 400);
  }

  const { player, world } = resolvePlannerContext(username, worldIdRaw);
  const existingActivePlan = selectActivePlannerPlanByPlayerAndWorldStmt.get(Number(player.id), String(world.id));
  if (existingActivePlan) {
    throwPlannerError('V tomto svete uz mas aktivni planner plan.', 'PLANNER_ACTIVE_PLAN_ALREADY_EXISTS', 409, {
      activePlanId: String(existingActivePlan.id),
      activePlanStatus: String(existingActivePlan.status),
    });
  }

  const { validation } = validatePlannerPayloadCore(username, String(world.id), payload, {
    throwOnBlocked: true,
    leadTimeBlockedStatusCode: 400,
  });
  const nowTimeIso = nowIso();
  const firstSendAtUtc = validation.normalizedLegs[0]?.sendAtUtc ?? null;
  const lastSendAtUtc = validation.normalizedLegs[validation.normalizedLegs.length - 1]?.sendAtUtc ?? null;
  const planId = createPlannerEntityId('pln');

  try {
    insertPlannerPlanStmt.run(
      planId,
      Number(player.id),
      String(world.id),
      'scheduled',
      1,
      Number(validation.resolvedTarget.targetPlayerId),
      Number(validation.resolvedTarget.targetVillageId),
      String(validation.resolvedTarget.targetPlayerUsername),
      String(validation.resolvedTarget.targetVillageName),
      String(validation.resolvedTarget.targetKingdom),
      String(validation.resolvedTarget.snapshotHash),
      nowTimeIso,
      firstSendAtUtc,
      lastSendAtUtc,
      nowTimeIso,
      nowTimeIso,
    );
    persistPlannerLegsForPlan(planId, validation.normalizedLegs, nowTimeIso);
    insertPlannerPlanEvent({
      planId,
      eventType: 'plan_confirmed',
      severity: 'info',
      message: 'Plan byl potvrzen a ulozen.',
      payload: {
        planId,
        status: 'scheduled',
        legsCount: validation.normalizedLegs.length,
      },
      createdAt: nowTimeIso,
    });
  } catch (error) {
    if (error instanceof GameRuleError) {
      throw error;
    }
    throwPlannerError('Plan se nepodarilo ulozit.', 'PLANNER_SAVE_FAILED', 500);
  }

  const activePlan = buildPlannerPlanDetailFromRow(
    selectPlannerPlanByIdForPlayerAndWorldStmt.get(planId, Number(player.id), String(world.id)),
  );
  const lastCompletedPlan = buildPlannerCompletedStubFromRow(
    selectLatestCompletedPlannerPlanByPlayerAndWorldStmt.get(Number(player.id), String(world.id)),
  );
  return {
    plan: {
      id: planId,
      status: 'scheduled',
      revision: 1,
      confirmedAt: nowTimeIso,
    },
    activePlan,
    lastCompletedPlan,
  };
});

const updatePlannerPlanTransaction = db.transaction(
  (username, planIdRaw, payload = {}, worldIdRaw = null) => {
    const planId = String(planIdRaw ?? '').trim();
    if (!planId) {
      throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404);
    }

    const expectedRevision = parsePlannerExpectedRevision(payload?.expectedRevision);
    const { player, world } = resolvePlannerContext(username, worldIdRaw);
    const existingPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
      planId,
      Number(player.id),
      String(world.id),
    );
    if (!existingPlan) {
      throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404, {
        planId,
      });
    }
    if (!PLANNER_EDITABLE_PLAN_STATUSES.has(String(existingPlan.status ?? ''))) {
      throwPlannerError('Tento plan uz nelze upravit.', 'PLANNER_PLAN_NOT_EDITABLE', 409, {
        planId,
        status: String(existingPlan.status ?? ''),
      });
    }
    if (Number(existingPlan.revision) !== expectedRevision) {
      throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
        planId,
        expectedRevision,
        actualRevision: Number(existingPlan.revision ?? 0),
      });
    }

    const { validation } = validatePlannerPayloadCore(username, String(world.id), payload, {
      throwOnBlocked: true,
      leadTimeBlockedStatusCode: 409,
    });
    const nowTimeIso = nowIso();
    const firstSendAtUtc = validation.normalizedLegs[0]?.sendAtUtc ?? null;
    const lastSendAtUtc = validation.normalizedLegs[validation.normalizedLegs.length - 1]?.sendAtUtc ?? null;

    try {
      const updated = updatePlannerPlanForPatchStmt.run(
        'scheduled',
        Number(validation.resolvedTarget.targetPlayerId),
        Number(validation.resolvedTarget.targetVillageId),
        String(validation.resolvedTarget.targetPlayerUsername),
        String(validation.resolvedTarget.targetVillageName),
        String(validation.resolvedTarget.targetKingdom),
        String(validation.resolvedTarget.snapshotHash),
        firstSendAtUtc,
        lastSendAtUtc,
        nowTimeIso,
        planId,
        Number(player.id),
        String(world.id),
        expectedRevision,
      );
      if (Number(updated.changes ?? 0) <= 0) {
        throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
          planId,
          expectedRevision,
        });
      }

      replacePlannerLegsForPlan(planId, validation.normalizedLegs, nowTimeIso);
      insertPlannerPlanEvent({
        planId,
        eventType: 'plan_updated',
        severity: 'info',
        message: 'Plan byl aktualizovan.',
        payload: {
          planId,
          expectedRevision,
          nextRevision: expectedRevision + 1,
        },
        createdAt: nowTimeIso,
      });
    } catch (error) {
      if (error instanceof GameRuleError) {
        throw error;
      }
      throwPlannerError('Plan se nepodarilo aktualizovat.', 'PLANNER_UPDATE_FAILED', 500);
    }

    const reloadedPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
      planId,
      Number(player.id),
      String(world.id),
    );
    return {
      plan: toPlannerPlanStatusSummary(reloadedPlan),
      activePlan: buildPlannerPlanDetailFromRow(reloadedPlan),
    };
  },
);

const reconfirmPlannerPlanTransaction = db.transaction(
  (username, planIdRaw, payload = {}, worldIdRaw = null) => {
    const planId = String(planIdRaw ?? '').trim();
    if (!planId) {
      throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404);
    }

    const expectedRevision = parsePlannerExpectedRevision(payload?.expectedRevision);
    const confirmWithConsequences = payload?.confirmWithConsequences === true;
    if (!confirmWithConsequences) {
      throwPlannerError(
        'Pro reconfirm je nutne potvrdit nasledky.',
        'PLANNER_RECONFIRM_NOT_ALLOWED',
        409,
      );
    }

    const { player, world } = resolvePlannerContext(username, worldIdRaw);
    const existingPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
      planId,
      Number(player.id),
      String(world.id),
    );
    if (!existingPlan) {
      throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404, {
        planId,
      });
    }
    if (String(existingPlan.status ?? '') !== PLANNER_NEEDS_RECONFIRMATION_STATUS) {
      throwPlannerError('Plan neni ve stavu vyzadujicim reconfirm.', 'PLANNER_RECONFIRM_NOT_ALLOWED', 409, {
        planId,
        status: String(existingPlan.status ?? ''),
      });
    }
    if (Number(existingPlan.revision) !== expectedRevision) {
      throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
        planId,
        expectedRevision,
        actualRevision: Number(existingPlan.revision ?? 0),
      });
    }

    const currentTargetVillage = selectVillageWithOwnerByIdStmt.get(Number(existingPlan.targetVillageId));
    const targetStillValid =
      currentTargetVillage &&
      Number(currentTargetVillage.region) === Number(world.region) &&
      Number(currentTargetVillage.playerId) !== Number(player.id);
    if (!targetStillValid) {
      throwPlannerError(
        'Cil uz neni validni pro planner utok.',
        'PLANNER_TARGET_NO_LONGER_VALID',
        409,
        {
          planId,
          targetVillageId: Number(existingPlan.targetVillageId ?? 0),
        },
      );
    }

    const nowTimeIso = nowIso();
    const updated = updatePlannerPlanForReconfirmStmt.run(
      nowTimeIso,
      nowTimeIso,
      planId,
      Number(player.id),
      String(world.id),
      expectedRevision,
    );
    if (Number(updated.changes ?? 0) <= 0) {
      throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
        planId,
        expectedRevision,
      });
    }

    insertPlannerPlanEvent({
      planId,
      eventType: 'plan_reconfirmed',
      severity: 'warning',
      message: 'Plan byl znovu potvrzen i se zmenenym cilem.',
      payload: {
        planId,
        expectedRevision,
        nextRevision: expectedRevision + 1,
      },
      createdAt: nowTimeIso,
    });

    const reloadedPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
      planId,
      Number(player.id),
      String(world.id),
    );
    return {
      plan: toPlannerPlanStatusSummary(reloadedPlan),
      activePlan: buildPlannerPlanDetailFromRow(reloadedPlan),
    };
  },
);

const cancelPlannerPlanTransaction = db.transaction((username, planIdRaw, payload = {}, worldIdRaw = null) => {
  const planId = String(planIdRaw ?? '').trim();
  if (!planId) {
    throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404);
  }

  const expectedRevision = parsePlannerExpectedRevision(payload?.expectedRevision);
  const { player, world } = resolvePlannerContext(username, worldIdRaw);
  const existingPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
    planId,
    Number(player.id),
    String(world.id),
  );
  if (!existingPlan) {
    throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404, {
      planId,
    });
  }
  if (!PLANNER_CANCELABLE_PLAN_STATUSES.has(String(existingPlan.status ?? ''))) {
    throwPlannerError('Tento plan uz nelze zrusit.', 'PLANNER_CANCEL_NOT_ALLOWED', 409, {
      planId,
      status: String(existingPlan.status ?? ''),
    });
  }
  if (Number(existingPlan.revision) !== expectedRevision) {
    throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
      planId,
      expectedRevision,
      actualRevision: Number(existingPlan.revision ?? 0),
    });
  }

  const nowTimeIso = nowIso();
  const updated = updatePlannerPlanForCancelStmt.run(
    nowTimeIso,
    nowTimeIso,
    planId,
    Number(player.id),
    String(world.id),
    expectedRevision,
  );
  if (Number(updated.changes ?? 0) <= 0) {
    throwPlannerError('Plan byl mezitim zmenen v jine relaci.', 'PLANNER_REVISION_CONFLICT', 409, {
      planId,
      expectedRevision,
    });
  }
  updatePlannerLegStatusesByPlanIdStmt.run('canceled', nowTimeIso, planId);
  insertPlannerPlanEvent({
    planId,
    eventType: 'plan_canceled',
    severity: 'info',
    message: 'Plan byl zrusen.',
    payload: {
      planId,
      expectedRevision,
      nextRevision: expectedRevision + 1,
    },
    createdAt: nowTimeIso,
  });

  const reloadedPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
    planId,
    Number(player.id),
    String(world.id),
  );
  return {
    plan: toPlannerPlanStatusSummary(reloadedPlan),
    activePlan: buildPlannerReadModelForPlayerWorld(Number(player.id), String(world.id)).activePlan,
  };
});

const listPlannerPlanEventsCore = (username, planIdRaw, options = {}, worldIdRaw = null) => {
  const planId = String(planIdRaw ?? '').trim();
  if (!planId) {
    throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404);
  }
  const { player, world } = resolvePlannerContext(username, worldIdRaw);
  const existingPlan = selectPlannerPlanByIdForPlayerAndWorldStmt.get(
    planId,
    Number(player.id),
    String(world.id),
  );
  if (!existingPlan) {
    throwPlannerError('Planner plan nebyl nalezen.', 'PLANNER_PLAN_NOT_FOUND', 404, {
      planId,
    });
  }

  const requestedLimit = Number(options?.limit ?? PLANNER_DEFAULT_EVENTS_LIMIT);
  const limit = Math.max(
    1,
    Math.min(
      PLANNER_MAX_EVENTS_LIMIT,
      Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : PLANNER_DEFAULT_EVENTS_LIMIT,
    ),
  );
  const requestedCursor = Number(options?.cursor ?? 0);
  const cursor = Math.max(0, Number.isFinite(requestedCursor) ? Math.floor(requestedCursor) : 0);
  const rows = selectPlannerEventsByPlanIdStmt.all(planId, limit, cursor);
  const total = Math.max(0, Math.floor(Number(countPlannerEventsByPlanIdStmt.get(planId)?.total ?? 0)));
  const nextOffset = cursor + rows.length;
  const nextCursor = nextOffset < total ? String(nextOffset) : null;

  return {
    items: rows.map((row) => ({
      id: String(row.id ?? ''),
      planId: String(row.planId ?? planId),
      planLegId: row.planLegId == null ? null : String(row.planLegId),
      eventType: String(row.eventType ?? ''),
      severity: String(row.severity ?? 'info'),
      message: String(row.message ?? ''),
      payload: parseJsonSafe(row.payloadJson, {}),
      createdAt: String(row.createdAt ?? nowIso()),
    })),
    nextCursor,
  };
};

export const validatePlannerPlan = (username, payload = {}, worldIdRaw = null) =>
  validatePlannerPayloadCore(username, worldIdRaw, payload, {
    throwOnBlocked: false,
    leadTimeBlockedStatusCode: 400,
  }).validation;

export const createPlannerPlan = (username, payload = {}, worldIdRaw = null) =>
  createPlannerPlanTransaction(username, payload, worldIdRaw);

export const updatePlannerPlan = (username, planId, payload = {}, worldIdRaw = null) =>
  updatePlannerPlanTransaction(username, planId, payload, worldIdRaw);

export const reconfirmPlannerPlan = (username, planId, payload = {}, worldIdRaw = null) =>
  reconfirmPlannerPlanTransaction(username, planId, payload, worldIdRaw);

export const cancelPlannerPlan = (username, planId, payload = {}, worldIdRaw = null) =>
  cancelPlannerPlanTransaction(username, planId, payload, worldIdRaw);

export const listPlannerPlanEvents = (username, planId, options = {}, worldIdRaw = null) =>
  listPlannerPlanEventsCore(username, planId, options, worldIdRaw);

export const getArmyOverview = (username = 'Hayato', worldId = null) => {
  const { player, world } = requireVillageForUser(username, null, worldId, 'center', {
    syncEconomy: false,
  });
  const ownVillages = selectVillagesByPlayerAndRegionStmt.all(Number(player.id), Number(world.region));
  const stationedSupportRows = selectStationedSupportUnitTotalsByOwnerRegionStmt.all(
    Number(player.id),
    Number(world.region),
  );
  const supportAmountByVillageUnitKey = new Map();
  for (const row of stationedSupportRows) {
    const targetVillageId = Number(row.targetVillageId);
    const unitId = String(row.unitId ?? '');
    const supportAmount = Math.max(0, Math.floor(Number(row.supportAmount ?? 0)));
    if (!Number.isFinite(targetVillageId) || targetVillageId <= 0 || !unitId) {
      continue;
    }
    supportAmountByVillageUnitKey.set(`${targetVillageId}:${unitId}`, supportAmount);
  }

  const villages = ownVillages
    .map((villageRow) => {
      const villageId = Number(villageRow.id);
      const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(villageId));
      const units = ARMY_OVERVIEW_UNITS_ORDER.map((unitId, index) => {
        const ownAmount = Math.max(0, Math.floor(Number(unitCounts[unitId] ?? 0)));
        const supportAmount = Math.max(
          0,
          Math.floor(Number(supportAmountByVillageUnitKey.get(`${villageId}:${unitId}`) ?? 0)),
        );
        const availableForPlanning = ownAmount;
        return {
          unitId,
          unitName: String(UNIT_DEFS[unitId]?.name ?? unitId),
          sortOrder: index + 1,
          ownAmount,
          supportAmount,
          availableForPlanning,
          visibleLabel: `${ownAmount.toLocaleString('cs-CZ')} (${supportAmount.toLocaleString('cs-CZ')})`,
        };
      });
      const totalOwnUnits = units.reduce((sum, unit) => sum + Number(unit.ownAmount ?? 0), 0);
      const totalSupportUnits = units.reduce((sum, unit) => sum + Number(unit.supportAmount ?? 0), 0);
      const sortLabel = buildVillageSortLabel(villageRow);
      const plannerSelectable = units.some((unit) => Number(unit.availableForPlanning ?? 0) > 0);
      return {
        villageId,
        villageName: String(villageRow.name ?? `Leno #${villageId}`),
        coordX: Number(villageRow.coordX ?? 0),
        coordY: Number(villageRow.coordY ?? 0),
        kingdom: String(villageRow.kingdom ?? 'Neutral'),
        sortLabel,
        totalOwnUnits,
        totalSupportUnits,
        plannerSelectable,
        plannerSelected: false,
        units,
      };
    })
    .sort((left, right) =>
      String(left.sortLabel ?? '').localeCompare(String(right.sortLabel ?? ''), 'cs', {
        sensitivity: 'base',
        numeric: true,
      }),
    );

  return {
    worldId: String(world.id),
    generatedAt: nowIso(),
    villages,
  };
};

export const getPlannerOpenSnapshot = (username = 'Hayato', worldId = null) => {
  const { player, world } = resolvePlannerContext(username, worldId);
  const plannerReadModel = buildPlannerReadModelForPlayerWorld(Number(player.id), String(world.id));
  return {
    worldId: String(world.id),
    timezone: PLANNER_TIMEZONE,
    constraints: {
      maxLegs: PLANNER_MAX_LEGS,
      minImpactGapMinutes: PLANNER_MIN_IMPACT_GAP_MINUTES,
      leadTimeSec: PLANNER_LEAD_TIME_SEC,
      activePlansPerPlayerPerWorld: 1,
    },
    bannerText: PLANNER_BANNER_TEXT,
    activePlan: plannerReadModel.activePlan,
    lastCompletedPlan: plannerReadModel.lastCompletedPlan,
    recentTargets: toPlannerRecentTargets(Number(player.id), Number(world.region)),
  };
};

export const getVillageSnapshot = (
  username = 'Hayato',
  requestedVillageId = null,
  worldId = null,
  spawnDirectionRaw = 'center',
  options = {},
) => {
  const includeWorldMap = options?.includeWorldMap !== false;
  const includeLeaderboard = options?.includeLeaderboard !== false;
  const includeKingdomHub = options?.includeKingdomHub !== false;
  const includeResearch = options?.includeResearch !== false;
  const includeMarket = options?.includeMarket !== false;
  const includeMercenaries = options?.includeMercenaries !== false;
  const includeRules = options?.includeRules !== false;
  const snapshotIso = nowIso();
  const { player, village, villages, world } = requireVillageForUser(
    username,
    requestedVillageId,
    worldId,
    spawnDirectionRaw,
    { syncEconomy: false },
  );
  const worldRegion = resolveWorldRegionDefinition(world);
  const resourcesRow = synchronizeVillageEconomyAt(Number(village.id), snapshotIso, { persist: false });
  if (!resourcesRow) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }

  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(village.id));
  const townhallLevel = buildingLevels.townhall ?? 0;
  const resourceCap = calculateResourceCap(buildingLevels.warehouse ?? 0);
  const mintLevel = Math.max(0, Math.floor(Number(buildingLevels.mint ?? 0)));
  const mintGoldCap = calculateMintGoldStorageCap(mintLevel);
  const mintCoinCap = calculateMintCoinStorageCap(mintLevel);
  const mintThroughputPerHour = calculateMintThroughputPerHour(mintLevel);
  const academicCountInVillage = Math.max(
    0,
    Math.floor(Number(countActiveAcademicsByVillageStmt.get(Number(village.id))?.total ?? 0)),
  );
  const awayUnitCounts = getVillageAwayUnitCounts(Number(village.id));
  const populationSnapshot = getVillagePopulationStatus(Number(village.id), {
    buildingLevels,
    unitCounts,
    awayUnitCounts,
    academicCount: academicCountInVillage,
  });
  const populationCap = Number(populationSnapshot.populationCap ?? 0);
  const academicPopulationUsed = Number(populationSnapshot.academicPopulationUsed ?? 0);
  const populationUsed = Number(populationSnapshot.populationUsed ?? 0);
  const availablePopulation = Number(populationSnapshot.availablePopulation ?? 0);
  const garrisonState = synchronizeVillageGarrisonAt(Number(village.id), snapshotIso, {
    persist: false,
    buildingLevels,
  });
  const baseProduction = calculateProductionPerHour(buildingLevels, populationUsed, populationCap);
  const developerResourceBoost = resolveDeveloperResourceBoostForWorld(world);
  const production = applyProductionMultiplier(baseProduction, developerResourceBoost.multiplier);
  const activeUpgrades = selectActiveUpgradesByVillageStmt.all(village.id);
  const currentlyActiveUpgrade = activeUpgrades.length > 0 ? activeUpgrades[0] : null;
  const highestQueuedUpgradeLevelByBuilding = toHighestQueuedUpgradeLevelByBuildingMap(activeUpgrades);
  const activeRecruitments = selectActiveRecruitmentsByVillageStmt.all(village.id);
  const armyState = buildArmyState(player.id, village.id, world.region);
  const relevantArmyMovements = armyState.activeMovements.filter((movement) => movement.isRelatedToCurrentVillage);
  const relevantStationedSupports = armyState.stationedSupports.filter(
    (movement) => movement.isRelatedToCurrentVillage,
  );
  const relevantIncomingMovements = armyState.incomingMovements.filter((movement) => movement.isRelatedToCurrentVillage);
  const activeRecruitmentCountByUnit = {};
  for (const recruitment of activeRecruitments) {
    const unitId = recruitment.unitId;
    activeRecruitmentCountByUnit[unitId] =
      Number(activeRecruitmentCountByUnit[unitId] ?? 0) + Number(recruitment.amount);
  }
  const stationedSupportCountByUnit = toUnitTemplateMap({});
  const stationedSupportRows = selectStationedSupportsByTargetVillageStmt.all(Number(village.id));
  for (const supportRow of stationedSupportRows) {
    const supportUnits = selectMovementUnitsStmt.all(Number(supportRow.id));
    for (const unitRow of supportUnits) {
      const unitId = String(unitRow.unitId);
      const amount = Math.max(0, Math.floor(Number(unitRow.amount ?? 0)));
      if (!UNIT_ORDER.includes(unitId)) {
        continue;
      }
      stationedSupportCountByUnit[unitId] = Number(stationedSupportCountByUnit[unitId] ?? 0) + amount;
    }
  }

  const currentResources = {
    wood: Number(resourcesRow.wood),
    stone: Number(resourcesRow.stone),
    iron: Number(resourcesRow.iron),
    gold: Number(resourcesRow.gold ?? 0),
    coins: Number(resourcesRow.coins ?? 0),
  };

  const reservedPopulationForRecruitment = calculateReservedPopulationForRecruitments(activeRecruitments);
  const availablePopulationForRecruitment = calculateAvailablePopulationForRecruitment(
    populationCap,
    populationUsed,
    reservedPopulationForRecruitment,
  );
  const villageAcademicCapacity = getVillageUniversityCapacity(buildingLevels);
  const villageAcademicAvailableSlots = Math.max(0, villageAcademicCapacity - academicCountInVillage);
  const knightCapacity = getPlayerKnightCapacity(Number(player.id), Number(world.region));
  const playerKnightTotal = getPlayerKnightTotalInWorld(Number(player.id), Number(world.region));
  const remainingKnightCapacity = Math.max(0, knightCapacity - playerKnightTotal);
  const researchRows = resolveResearchProgressForPlayerRegion(
    Number(player.id),
    Number(world.region),
    snapshotIso,
    { persist: false },
  );
  const completedResearchIds = buildCompletedResearchSet(researchRows);
  const researchView = includeResearch
    ? buildResearchViewModel(researchRows, {
        playerId: Number(player.id),
        region: Number(world.region),
        snapshotIso,
      })
    : [];
  const totalAcademicsInRegion = includeResearch
    ? Math.max(
        0,
        Math.floor(
          Number(countActiveAcademicsByPlayerRegionStmt.get(Number(player.id), Number(world.region))?.total ?? 0),
        ),
      )
    : 0;
  const regionAcademicCapacity = includeResearch
    ? Math.max(
        0,
        Math.floor(
          Number(
            selectTotalUniversityAcademicCapacityByPlayerAndRegionStmt.get(Number(player.id), Number(world.region))
              ?.totalCapacity ?? 0,
          ),
        ),
      )
    : 0;
  const regionAcademicAvailableSlots = includeResearch ? Math.max(0, regionAcademicCapacity - totalAcademicsInRegion) : 0;
  const idleAcademicsInRegion = includeResearch
    ? Math.max(
        0,
        Math.floor(
          Number(countIdleAcademicsByPlayerRegionStmt.get(Number(player.id), Number(world.region))?.total ?? 0),
        ),
      )
    : 0;
  const activeResearchRow = selectActiveResearchByPlayerRegionStmt.get(Number(player.id), Number(world.region));

  const buildings = BUILDING_ORDER.map((buildingId) => {
    const def = BUILDING_DEFS[buildingId];
    const level = buildingLevels[buildingId] ?? 0;
    const effectiveLevel = Math.max(level, Number(highestQueuedUpgradeLevelByBuilding.get(buildingId) ?? level));
    const maxLevel = getMaxBuildingLevel(buildingId);
    const nextCost = calculateUpgradeCost(buildingId, effectiveLevel);
    const nextDurationSec =
      nextCost == null ? null : calculateUpgradeDurationSec(buildingId, effectiveLevel, townhallLevel);
    const nextLevelPreview =
      effectiveLevel >= maxLevel
        ? null
        : buildBuildingNextLevelPreview({
            buildingId,
            fromLevel: effectiveLevel,
            toLevel: effectiveLevel + 1,
          });
    const workersUsed = (def.workerPerLevel ?? 0) * level;
    const activeUpgradeForBuilding =
      currentlyActiveUpgrade && String(currentlyActiveUpgrade.buildingId) === String(buildingId)
        ? currentlyActiveUpgrade
        : null;
    const isInProgress = activeUpgradeForBuilding != null;
    let blockedReason = null;
    let canUpgrade = false;
    const requirementError = resolveBuildingRequirementError(buildingId, buildingLevels);
    const requiredResearchId = BUILDING_RESEARCH_REQUIREMENTS[buildingId] ?? null;
    const missingRequiredResearch =
      requiredResearchId && !completedResearchIds.has(String(requiredResearchId))
        ? getResearchDefinition(requiredResearchId)?.name ?? requiredResearchId
        : null;

    if (effectiveLevel >= maxLevel) {
      blockedReason = 'Maximalni uroven dosazena';
    } else if (requirementError) {
      blockedReason = requirementError;
    } else if (missingRequiredResearch) {
      blockedReason = `Vyzkum '${missingRequiredResearch}' je povinny.`;
    } else if (nextCost && !canAfford(currentResources, nextCost)) {
      blockedReason = 'Nedostatek surovin';
    } else {
      canUpgrade = nextCost != null;
    }

    const finishAt = isInProgress ? activeUpgradeForBuilding.finishAt : null;
    const remainingSec =
      finishAt == null ? null : Math.max(0, Math.ceil((Date.parse(finishAt) - Date.now()) / 1000));

    return {
      id: buildingId,
      name: def.name,
      category: def.category,
      level,
      maxLevel,
      workersUsed,
      effect: calculateBuildingEffect(buildingId, level),
      nextLevelPreview,
      nextCost,
      nextDurationSec,
      canUpgrade,
      blockedReason,
      isInProgress,
      finishesAt: finishAt,
      remainingSec,
    };
  });

  const units = UNIT_ORDER.map((unitId) => {
    const def = UNIT_DEFS[unitId];
    const amount = unitCounts[unitId] ?? 0;
    const requiredBuildingId = def.requiredBuilding;
    const requiredBuildingCurrentLevel = buildingLevels[requiredBuildingId] ?? 0;
    const requiredBuildingLevel = Math.max(1, Math.floor(Number(def.requiredBuildingLevel ?? 1)));
    const queuedCount = Number(activeRecruitmentCountByUnit[unitId] ?? 0);
    const hasVillageKnightSlotOccupied = unitId === KNIGHT_UNIT_ID && amount + queuedCount > 0;
    const maxByResources = calculateMaxRecruitableByResources(currentResources, def.cost);
    const unitPopulationCost = getUnitPopulationCost(unitId);
    const maxByPopulation = Math.max(0, Math.floor(availablePopulationForRecruitment / unitPopulationCost));
    const maxByKnightLimit = unitId === KNIGHT_UNIT_ID ? remainingKnightCapacity : Number.POSITIVE_INFINITY;
    const maxBySingleOrder = unitId === KNIGHT_UNIT_ID ? 1 : Number.POSITIVE_INFINITY;
    const maxByVillageKnightSlot = hasVillageKnightSlotOccupied ? 0 : Number.POSITIVE_INFINITY;
    const isSpecialNonRecruitable = def.isRecruitable === false;
    const maxRecruitable = isSpecialNonRecruitable
      ? 0
      : Math.max(
          0,
          Math.min(maxByPopulation, maxByResources, maxByKnightLimit, maxBySingleOrder, maxByVillageKnightSlot),
        );

    let blockedReason = null;
    let canRecruit = false;
    const requiredResearchId = UNIT_RESEARCH_REQUIREMENTS[unitId] ?? null;
    const missingRequiredResearch =
      requiredResearchId && !completedResearchIds.has(String(requiredResearchId))
        ? getResearchDefinition(requiredResearchId)?.name ?? requiredResearchId
        : null;
    if (isSpecialNonRecruitable) {
      blockedReason = 'Speciální jednotka (nábor přes kontrakt)';
    } else if (requiredBuildingCurrentLevel < requiredBuildingLevel) {
      blockedReason =
        requiredBuildingLevel <= 1
          ? `Vybuduj ${BUILDING_DEFS[requiredBuildingId].name}`
          : `Vybuduj ${BUILDING_DEFS[requiredBuildingId].name} na uroveň ${requiredBuildingLevel}`;
    } else if (missingRequiredResearch) {
      blockedReason = `Vyzkum '${missingRequiredResearch}' je povinny`;
    } else if (hasVillageKnightSlotOccupied) {
      blockedReason = 'V osade uz je rytir nebo je ve vycviku';
    } else if (unitId === KNIGHT_UNIT_ID && remainingKnightCapacity <= 0) {
      blockedReason = 'Limit rytiru podle poctu osad v tomto svete je vycerpan';
    } else if (availablePopulationForRecruitment <= 0) {
      blockedReason = 'Nedostatek volne populace';
    } else if (!canAfford(currentResources, def.cost)) {
      blockedReason = 'Nedostatek surovin';
    } else if (maxByPopulation <= 0) {
      blockedReason = 'Nedostatek volne populace';
    } else {
      canRecruit = true;
    }

    return {
      id: unitId,
      name: def.name,
      role: def.role,
      amount,
      maxAmount: amount + maxRecruitable,
      cost: def.cost,
      requiredBuildingId,
      requiredBuildingLevel,
      maxRecruitable,
      queuedCount,
      stationedSupportCount: Number(stationedSupportCountByUnit[unitId] ?? 0),
      canRecruit,
      blockedReason,
    };
  });

  const activeOrders = [];
  if (activeUpgrades.length > 0) {
    for (const activeUpgrade of activeUpgrades) {
      const remainingSec = Math.max(0, Math.ceil((Date.parse(activeUpgrade.finishAt) - Date.now()) / 1000));
      const buildingName = BUILDING_DEFS[activeUpgrade.buildingId]?.name ?? activeUpgrade.buildingId;
      activeOrders.push(
        `Vystavba: ${buildingName} ${activeUpgrade.fromLevel} -> ${activeUpgrade.toLevel} (zbyva ${formatRemaining(
          remainingSec,
        )})`,
      );
    }
  } else {
    activeOrders.push('Vystavba: zadna aktivni fronta');
  }

  if (activeRecruitments.length > 0) {
    for (const recruitment of activeRecruitments) {
      const remainingSec = Math.max(0, Math.ceil((Date.parse(recruitment.finishAt) - Date.now()) / 1000));
      const unitName = UNIT_DEFS[recruitment.unitId]?.name ?? recruitment.unitId;
      activeOrders.push(
        `Nabor: ${unitName} +${Number(recruitment.amount)} (zbyva ${formatRemaining(remainingSec)})`,
      );
    }
  } else {
    activeOrders.push('Nabor: zadna aktivni fronta');
  }

  if (relevantArmyMovements.length > 0) {
    const commandLabelByType = {
      attack: 'Utok',
      support: 'Podpora',
      move: 'Presun',
      return: 'Navrat',
    };
    for (const movement of relevantArmyMovements) {
      const commandLabel = commandLabelByType[movement.commandType] ?? movement.commandType;
      const unitsTotal = movement.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
      activeOrders.push(
        `Armada: ${commandLabel} ${movement.originName} -> ${movement.targetName} (${unitsTotal} jednotek, ETA ${formatRemaining(
          movement.remainingSec,
        )})`,
      );
    }
  } else {
    activeOrders.push('Armada: zadny aktivni presun');
  }

  if (relevantIncomingMovements.length > 0) {
    for (const movement of relevantIncomingMovements) {
      const commanderName = String(movement.commanderUsername ?? 'Neznamy velitel');
      const unitsTotal = movement.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
      const incomingLabel =
        movement.commandType === 'attack'
          ? 'Prichozi utok'
          : movement.commandType === 'support'
            ? 'Prichozi podpora'
            : 'Prichozi presun';
      activeOrders.push(
        `Hrozba: ${incomingLabel} od ${commanderName} na ${movement.targetName} (${unitsTotal} jednotek, ETA ${formatRemaining(
          movement.remainingSec,
        )})`,
      );
    }
  } else {
    activeOrders.push('Hrozby: zadny prichozi pohyb na tve osady');
  }

  if (relevantStationedSupports.length > 0) {
    for (const support of relevantStationedSupports) {
      const unitsTotal = support.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
      activeOrders.push(`Armada: Podpora stacionovana v ${support.targetName} (${unitsTotal} jednotek)`);
    }
  }

  if (activeResearchRow) {
    const definition = getResearchDefinition(String(activeResearchRow.researchId));
    const requiredPoints = getResearchProgressPointsRequired(definition);
    const percent =
      requiredPoints > 0
        ? Math.max(0, Math.min(100, (Number(activeResearchRow.progress ?? 0) / requiredPoints) * 100))
        : 0;
    activeOrders.push(
      `Vyzkum: ${definition?.name ?? activeResearchRow.researchId} (${percent.toFixed(1)} %, akademici ${Math.max(
        0,
        Number(activeResearchRow.assignedAcademics ?? 0),
      )})`,
    );
  } else {
    activeOrders.push('Vyzkum: zadny aktivni projekt');
  }

  const latestMercenaryContract = includeMercenaries
    ? selectLatestMercenaryContractByPlayerRegionStmt.get(Number(player.id), Number(world.region))
    : null;
  const mercenaryCooldownSec = MERCENARY_CONTRACT_COOLDOWN_HOURS * 60 * 60;
  const mercenaryDeliveryDelaySec = MERCENARY_DELIVERY_DELAY_MINUTES * 60;
  const mercenaryDurationSec = MERCENARY_DURATION_HOURS * 60 * 60;
  const mercenaryCooldownRemainingSec = includeMercenaries
    ? getMercenaryCooldownRemainingSec(latestMercenaryContract, snapshotIso)
    : 0;
  const mercenaryCooldownEndsAt = includeMercenaries
    ? (() => {
        const orderedAtMs = Date.parse(String(latestMercenaryContract?.orderedAt ?? ''));
        if (!Number.isFinite(orderedAtMs)) {
          return null;
        }
        return new Date(orderedAtMs + mercenaryCooldownSec * 1000).toISOString();
      })()
    : null;
  const mercenaryUnlocked = includeMercenaries
    ? isResearchCompleted(researchRows, 'verven-bank')
    : false;
  const mercenaryContracts = includeMercenaries
    ? selectMercenaryContractsByVillageStmt.all(Number(village.id))
    : [];
  const activeMercenaryContract = includeMercenaries
    ? mercenaryContracts.find((contract) => ['en_route', 'active'].includes(String(contract.status)))
    : null;
  const mercenaryHiringOptions = includeMercenaries
    ? villages.map((entry) => {
        const optionVillageId = Number(entry.id);
        const optionResources = selectResourcesByVillageStmt.get(optionVillageId);
        const optionCoins = Math.max(0, Math.floor(Number(optionResources?.coins ?? 0)));
        const optionContracts = selectMercenaryContractsByVillageStmt.all(optionVillageId);
        const optionActiveContract =
          optionContracts.find((contract) =>
            ['en_route', 'active'].includes(String(contract.status ?? '').toLocaleLowerCase('cs-CZ')),
          ) ?? null;
        const missingCoins = Math.max(0, MERCENARY_CONTRACT_COST_COINS - optionCoins);
        let blockedReason = null;
        if (!mercenaryUnlocked) {
          blockedReason = "Vyzkum 'Vervenska zlata banka' neni dokoncen.";
        } else if (mercenaryCooldownRemainingSec > 0) {
          blockedReason = `Zoldacka blokace: ${formatRemaining(mercenaryCooldownRemainingSec)}.`;
        } else if (missingCoins > 0) {
          blockedReason = `Chybi ${missingCoins.toLocaleString('cs-CZ')} minci.`;
        }
        return {
          villageId: optionVillageId,
          villageName: String(entry.name ?? `Leno #${optionVillageId}`),
          coordX: Number(entry.coordX ?? 0),
          coordY: Number(entry.coordY ?? 0),
          coins: optionCoins,
          hasEnoughCoins: optionCoins >= MERCENARY_CONTRACT_COST_COINS,
          canHire: blockedReason == null,
          blockedReason,
          isCurrentVillage: optionVillageId === Number(village.id),
          activeContractStatus: optionActiveContract ? String(optionActiveContract.status ?? '') : null,
          activeContractArriveAt: optionActiveContract ? String(optionActiveContract.arriveAt ?? nowIso()) : null,
          activeContractExpiresAt: optionActiveContract ? String(optionActiveContract.expiresAt ?? nowIso()) : null,
          activeContractUnitAmount: optionActiveContract
            ? Math.max(0, Math.floor(Number(optionActiveContract.unitAmount ?? 0)))
            : 0,
        };
      })
    : [];
  if (includeMercenaries) {
    if (activeMercenaryContract) {
      if (String(activeMercenaryContract.status) === 'en_route') {
        const remainingSec = Math.max(
          0,
          Math.ceil((Date.parse(String(activeMercenaryContract.arriveAt)) - Date.now()) / 1000),
        );
        activeOrders.push(`Zoldaci: kontrakt na ceste (dorazi za ${formatRemaining(remainingSec)})`);
      } else {
        const remainingSec = Math.max(
          0,
          Math.ceil((Date.parse(String(activeMercenaryContract.expiresAt)) - Date.now()) / 1000),
        );
        activeOrders.push(
          `Zoldaci: aktivni obrana (${Number(activeMercenaryContract.unitAmount)} jednotek, zbyva ${formatRemaining(
            remainingSec,
          )})`,
        );
      }
    } else {
      activeOrders.push('Zoldaci: zadny aktivni kontrakt');
    }
  }

  activeOrders.push('Ekonomika jede v realnem case podle cron ticku.');
  activeOrders.push('Nabor i vystavba bezi oddelene pro kazde leno.');
  if (developerResourceBoost.isActive) {
    activeOrders.push(
      `Vyvojarsky boost: ${developerResourceBoost.label} (zbyva ${formatRemaining(developerResourceBoost.remainingSec)})`,
    );
  }

  const activeUpgrade = activeUpgrades.length > 0 ? activeUpgrades[0] : null;
  const worldReadModel = includeWorldMap
    ? buildWorldMapReadModel({
        player,
        village,
        world,
        referenceIso: snapshotIso,
      })
    : null;
  const leaderboard = includeLeaderboard ? listPlayerLeaderboard(world.id) : null;
  const kingdomHub = includeKingdomHub ? buildKingdomHubState(player, village) : null;
  const recentLogisticsRoutes = includeMarket
    ? selectRecentLogisticsByVillageStmt.all(Number(village.id), Number(village.id), Number(world.region)).map((route) => {
        const arriveAtMs = Date.parse(String(route.arriveAt ?? ''));
        const completedAtMs = Date.parse(String(route.completedAt ?? ''));
        const remainingSec =
          String(route.status) === 'in_progress' && Number.isFinite(arriveAtMs)
            ? Math.max(0, Math.ceil((arriveAtMs - Date.now()) / 1000))
            : 0;
        return {
          id: Number(route.id),
          ownerPlayerId: Number(route.ownerPlayerId),
          sourceVillageId: Number(route.sourceVillageId),
          targetVillageId: Number(route.targetVillageId),
          sourceVillageName: String(route.sourceVillageName ?? ''),
          targetVillageName: String(route.targetVillageName ?? ''),
          mode: String(route.mode ?? 'manual'),
          status: String(route.status ?? 'completed'),
          wood: Math.max(0, Math.floor(Number(route.wood ?? 0))),
          stone: Math.max(0, Math.floor(Number(route.stone ?? 0))),
          iron: Math.max(0, Math.floor(Number(route.iron ?? 0))),
          startedAt: String(route.startedAt ?? nowIso()),
          arriveAt: String(route.arriveAt ?? nowIso()),
          completedAt: Number.isFinite(completedAtMs) ? String(route.completedAt) : null,
          remainingSec,
        };
      })
    : [];
  const marketLevel = includeMarket ? Math.max(0, Math.floor(Number(buildingLevels.market ?? 0))) : 0;
  const marketCapacity = includeMarket ? calculateMarketCapacity(marketLevel) : 0;
  const marketMerchants = includeMarket ? calculateMarketMerchantStateByVillage(Number(village.id), marketLevel) : null;
  const hideoutProtection = calculateLootProtectionPocket(buildingLevels);
  const vaultProtection = calculateCurrencyProtectionPocket(buildingLevels);
  const marketGuildUnlocked = includeMarket ? isMarketGuildUnlocked(marketLevel, completedResearchIds) : false;
  const marketGuildAutomation = includeMarket
    ? buildMarketGuildAutomationState({
        playerId: Number(player.id),
        region: Number(world.region),
        sourceVillageId: Number(village.id),
        sourceMarketLevel: marketLevel,
        guildUnlocked: marketGuildUnlocked,
        referenceIso: snapshotIso,
        persist: false,
      })
    : null;
  const worldSpawnConfig = resolveWorldSpawnConfig(world);
  const villageProtectionRuleDays = Math.max(0, Number(worldSpawnConfig.playerProtectionDays ?? 0));
  const villageProtectionUntil = resolveVillageProtectionUntilIso(village, villageProtectionRuleDays);
  const villageProtectionRemainingSec = getVillageProtectionRemainingSec(village, villageProtectionRuleDays);
  const isVillageUnderProtection = villageProtectionRemainingSec > 0;

  return {
    serverTime: snapshotIso,
    stateVersion: buildStateReadModelVersion(snapshotIso),
    player: {
      id: Number(player.id),
      username: player.username,
    },
    ...(includeKingdomHub ? { kingdomHub } : {}),
    villages: villages.map((entry) => ({
      id: Number(entry.id),
      name: entry.name,
      coordX: Number(entry.coordX),
      coordY: Number(entry.coordY),
      region: Number(entry.region),
      kingdom: entry.kingdom,
      prestige: Number(entry.prestige),
      loyalty: Number(entry.loyalty),
      protectionUntil: resolveVillageProtectionUntilIso(entry, villageProtectionRuleDays),
      protectionRemainingSec: getVillageProtectionRemainingSec(entry, villageProtectionRuleDays),
      protectionRuleDays: villageProtectionRuleDays,
    })),
    village: {
      id: Number(village.id),
      name: village.name,
      coordX: Number(village.coordX),
      coordY: Number(village.coordY),
      region: Number(village.region),
      kingdom: village.kingdom,
      prestige: Number(village.prestige),
      loyalty: Number(village.loyalty),
      protectionUntil: villageProtectionUntil,
      protectionRemainingSec: villageProtectionRemainingSec,
      protectionRuleDays: villageProtectionRuleDays,
      isUnderProtection: isVillageUnderProtection,
    },
    world: {
      id: String(world.id),
      name: String(world.name),
      version: worldReadModel?.version ?? null,
      snapshotKey: worldReadModel?.snapshotKey ?? null,
      region: Number(worldRegion.id),
      originX: Number(worldRegion.originX),
      originY: Number(worldRegion.originY),
      size: Number(worldRegion.size),
      settlements: worldReadModel?.settlements ?? [],
      kingdoms: worldReadModel?.kingdoms ?? [],
    },
    resources: {
      wood: Math.floor(currentResources.wood),
      stone: Math.floor(currentResources.stone),
      iron: Math.floor(currentResources.iron),
      gold: Math.floor(currentResources.gold),
      coins: Math.floor(currentResources.coins),
      cap: resourceCap,
      goldCap: mintGoldCap,
      coinsCap: mintCoinCap,
      productionPerHour: {
        wood: Math.max(0, Math.floor(Number(production.wood ?? 0))),
        stone: Math.max(0, Math.floor(Number(production.stone ?? 0))),
        iron: Math.max(0, Math.floor(Number(production.iron ?? 0))),
        gold: Math.max(0, Math.floor(Number(production.gold ?? 0))),
        mintCoins: Math.max(0, Math.floor(Number(mintThroughputPerHour ?? 0))),
        penalty: Number(production.penalty.toFixed(2)),
      },
      protection: {
        wood: hideoutProtection.wood,
        stone: hideoutProtection.stone,
        iron: hideoutProtection.iron,
        gold: vaultProtection.gold,
        coins: vaultProtection.coins,
      },
      developerBoost: {
        isActive: Boolean(developerResourceBoost.isActive),
        source: String(developerResourceBoost.source ?? 'developer-apology'),
        worldId: developerResourceBoost.worldId == null ? null : String(developerResourceBoost.worldId),
        reason: developerResourceBoost.reason == null ? null : String(developerResourceBoost.reason),
        label: developerResourceBoost.label == null ? null : String(developerResourceBoost.label),
        bonusPercent: Math.max(0, Number(developerResourceBoost.bonusPercent ?? 0)),
        multiplier: Number(developerResourceBoost.multiplier ?? 1),
        startsAt: developerResourceBoost.startsAt == null ? null : String(developerResourceBoost.startsAt),
        endsAt: developerResourceBoost.endsAt == null ? null : String(developerResourceBoost.endsAt),
        remainingSec: Math.max(0, Number(developerResourceBoost.remainingSec ?? 0)),
      },
      overflow: {
        wood: Number(currentResources.wood ?? 0) > Number(resourceCap),
        stone: Number(currentResources.stone ?? 0) > Number(resourceCap),
        iron: Number(currentResources.iron ?? 0) > Number(resourceCap),
        gold: Number(currentResources.gold ?? 0) > Number(mintGoldCap),
        coins: Number(currentResources.coins ?? 0) > Number(mintCoinCap),
        any:
          Number(currentResources.wood ?? 0) > Number(resourceCap) ||
          Number(currentResources.stone ?? 0) > Number(resourceCap) ||
          Number(currentResources.iron ?? 0) > Number(resourceCap) ||
          Number(currentResources.gold ?? 0) > Number(mintGoldCap) ||
          Number(currentResources.coins ?? 0) > Number(mintCoinCap),
      },
    },
    population: {
      used: populationUsed,
      cap: populationCap,
      available: availablePopulation,
      academicsUsed: academicPopulationUsed,
      breakdown: {
        buildings: Number(populationSnapshot.buildingPopulationUsed ?? 0),
        unitsHome: Number(populationSnapshot.homeUnitPopulationUsed ?? 0),
        unitsAway: Number(populationSnapshot.awayUnitPopulationUsed ?? 0),
        academics: Number(populationSnapshot.academicPopulationUsed ?? 0),
        garrisonReserved: Number(populationSnapshot.garrisonPopulationReserved ?? GARRISON_RESERVED_POPULATION),
        recruitmentReserved: reservedPopulationForRecruitment,
      },
      overflow: {
        amount: Math.max(0, Number(populationUsed) - Number(populationCap)),
        any: Number(populationUsed) > Number(populationCap),
      },
    },
    garrison: {
      isUnlocked: Boolean(garrisonState.isUnlocked),
      activeCap: Number(garrisonState.activeCap ?? 0),
      reservedPopulation: Number(garrisonState.reservedPopulation ?? GARRISON_RESERVED_POPULATION),
      totalCap: Number(garrisonState.totalCap ?? GARRISON_RESERVED_POPULATION),
      totalUnits: Number(garrisonState.totalUnits ?? 0),
      lastSyncAt: garrisonState.lastSyncAt ? String(garrisonState.lastSyncAt) : null,
      units: {
        militia: {
          amount: Number(garrisonState.units?.militia?.amount ?? 0),
          cap: Number(garrisonState.units?.militia?.cap ?? GARRISON_UNIT_CAPS.militia),
          missing: Number(garrisonState.units?.militia?.missing ?? 0),
          refillSecPerUnit: Number(garrisonState.units?.militia?.refillSecPerUnit ?? 0),
          nextRefillSec: garrisonState.units?.militia?.nextRefillSec ?? null,
        },
        archer: {
          amount: Number(garrisonState.units?.archer?.amount ?? 0),
          cap: Number(garrisonState.units?.archer?.cap ?? GARRISON_UNIT_CAPS.archer),
          missing: Number(garrisonState.units?.archer?.missing ?? 0),
          refillSecPerUnit: Number(garrisonState.units?.archer?.refillSecPerUnit ?? 0),
          nextRefillSec: garrisonState.units?.archer?.nextRefillSec ?? null,
        },
      },
    },
    buildings,
    units,
    ...(includeLeaderboard ? { leaderboard } : {}),
    activeUpgrade: activeUpgrade
      ? {
          id: Number(activeUpgrade.id),
          buildingId: activeUpgrade.buildingId,
          fromLevel: Number(activeUpgrade.fromLevel),
          toLevel: Number(activeUpgrade.toLevel),
          startedAt: activeUpgrade.startedAt,
          finishAt: activeUpgrade.finishAt,
          woodCost: Number(activeUpgrade.woodCost),
          stoneCost: Number(activeUpgrade.stoneCost),
          ironCost: Number(activeUpgrade.ironCost),
          remainingSec: Math.max(0, Math.ceil((Date.parse(activeUpgrade.finishAt) - Date.now()) / 1000)),
        }
      : null,
    activeUpgrades: activeUpgrades.map((upgrade) => ({
      id: Number(upgrade.id),
      buildingId: upgrade.buildingId,
      fromLevel: Number(upgrade.fromLevel),
      toLevel: Number(upgrade.toLevel),
      startedAt: upgrade.startedAt,
      finishAt: upgrade.finishAt,
      woodCost: Number(upgrade.woodCost),
      stoneCost: Number(upgrade.stoneCost),
      ironCost: Number(upgrade.ironCost),
      remainingSec: Math.max(0, Math.ceil((Date.parse(upgrade.finishAt) - Date.now()) / 1000)),
    })),
    activeRecruitments: activeRecruitments.map((recruitment) => ({
      id: Number(recruitment.id),
      unitId: recruitment.unitId,
      amount: Number(recruitment.amount),
      startedAt: recruitment.startedAt,
      finishAt: recruitment.finishAt,
      woodCost: Number(recruitment.woodCost),
      stoneCost: Number(recruitment.stoneCost),
      ironCost: Number(recruitment.ironCost),
      remainingSec: Math.max(0, Math.ceil((Date.parse(recruitment.finishAt) - Date.now()) / 1000)),
    })),
    army: armyState,
    ...(includeResearch
      ? {
          research: {
            totalAcademics: totalAcademicsInRegion,
            idleAcademics: idleAcademicsInRegion,
            regionAcademicCapacity,
            regionAcademicAvailableSlots,
            villageAcademics: academicCountInVillage,
            villageAcademicCapacity,
            villageAcademicAvailableSlots,
            activeProjectId: activeResearchRow ? String(activeResearchRow.researchId) : null,
            projects: researchView,
          },
        }
      : {}),
    ...(includeMarket
      ? {
          market: {
            level: marketLevel,
            capacity: marketCapacity,
            maxDistance: MARKET_MAX_DISTANCE_TILES,
            guildUnlocked: marketGuildUnlocked,
            merchants: marketMerchants,
            logisticsRoutes: recentLogisticsRoutes,
            guildAutomation: marketGuildAutomation,
          },
        }
      : {}),
    ...(includeMercenaries
      ? {
          mercenaries: {
            contracts: mercenaryContracts.map((contract) => ({
              id: Number(contract.id),
              villageId: Number(village.id),
              villageName: String(village.name ?? `Leno #${Number(village.id)}`),
              status: String(contract.status ?? 'expired'),
              orderedAt: String(contract.orderedAt ?? nowIso()),
              arriveAt: String(contract.arriveAt ?? nowIso()),
              expiresAt: String(contract.expiresAt ?? nowIso()),
              deliveredAt: contract.deliveredAt ? String(contract.deliveredAt) : null,
              finishedAt: contract.finishedAt ? String(contract.finishedAt) : null,
              unitAmount: Math.max(0, Math.floor(Number(contract.unitAmount ?? 0))),
            })),
            cooldownRemainingSec: mercenaryCooldownRemainingSec,
            cooldownEndsAt: mercenaryCooldownEndsAt,
            cooldownSec: mercenaryCooldownSec,
            deliveryDelaySec: mercenaryDeliveryDelaySec,
            durationSec: mercenaryDurationSec,
            contractCoinCost: MERCENARY_CONTRACT_COST_COINS,
            contractUnitAmount: MERCENARY_CONTRACT_UNIT_AMOUNT,
            unlocked: mercenaryUnlocked,
            hiringOptions: mercenaryHiringOptions,
          },
        }
      : {}),
    ...(includeRules
      ? {
          rules: {
            nightMode: {
              startHourUtc: NIGHT_MODE_START_HOUR,
              endHourUtc: NIGHT_MODE_END_HOUR,
              isActiveNow: isNightModeAtTime(nowIso()),
              defenseBonusPct: 100,
            },
            prestigeBalance: {
              minAttackablePrestigeRatio: MIN_ATTACKABLE_PRESTIGE_RATIO,
              minLootModifier: MIN_LOOT_MODIFIER,
              retaliationRule:
                'Pokud slabsi hrac zautoci na silnejsiho, ztraci ochranu prestize vuci tomuto hraci a muze dostat odvetny utok.',
            },
            cancelCommandProgressLimit: COMMAND_CANCEL_MAX_PROGRESS,
          },
        }
      : {}),
    activeOrders,
    limits: {
      maxBuildingLevel: getGlobalMaxBuildingLevel(),
      maxUnitCount: null,
    },
  };
};

const requirePositiveInteger = (value, fieldName) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new GameRuleError(`Pole '${fieldName}' musi byt kladne cele cislo.`);
  }
  return normalized;
};

const ARMY_COMMAND_TYPES = new Set(['attack', 'support', 'move', 'return']);

const issueArmyCommandTransaction = db.transaction((username, requestedVillageId, payload, worldId = null) => {
  const { player, village, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const commandType = String(payload?.commandType ?? '')
    .trim()
    .toLowerCase();

  if (!ARMY_COMMAND_TYPES.has(commandType)) {
    throw new GameRuleError('Neznamy typ armadniho rozkazu.');
  }

  const issuedAtIso = nowIso();
  const lootPriority = commandType === 'attack' ? normalizeLootPriority(payload?.lootPriority) : null;

  if (commandType === 'return') {
    const supportMovementId = requirePositiveInteger(payload?.supportMovementId, 'supportMovementId');
    const support = selectStationedSupportByIdForPlayerStmt.get(supportMovementId, Number(player.id));
    if (!support) {
      throw new GameRuleError('Podporna armada pro navrat nebyla nalezena.', 404);
    }

    const supportUnits = selectMovementUnitsStmt.all(Number(support.id));
    if (supportUnits.length === 0) {
      throw new GameRuleError('Podporna armada nema dostupne jednotky.', 400);
    }

    const unitSelection = {};
    for (const supportUnit of supportUnits) {
      unitSelection[supportUnit.unitId] = Number(supportUnit.amount);
    }
    if (sumSelectedUnits(unitSelection) <= 0) {
      throw new GameRuleError('Podporna armada nema dostupne jednotky.', 400);
    }

    const distanceTiles = Math.max(
      Math.abs(Number(support.homeCoordX) - Number(support.targetCoordX)),
      Math.abs(Number(support.homeCoordY) - Number(support.targetCoordY)),
    );
    const durationSec = calculateArmyTravelDurationSec(unitSelection, distanceTiles);
    const effectiveDurationSec = Math.max(1, Math.floor(Number(durationSec ?? 0)));
    const arriveAtIso = new Date(Date.parse(issuedAtIso) + effectiveDurationSec * 1000).toISOString();
    const inserted = insertArmyMovementStmt.run(
      Number(player.id),
      'return',
      Number(support.targetVillageId),
      Number(support.homeVillageId),
      Number(support.homeVillageId),
      null,
      0,
      0,
      0,
      issuedAtIso,
      arriveAtIso,
      'in_progress',
    );
    const movementId = Number(inserted.lastInsertRowid);
    for (const unitId of UNIT_ORDER) {
      const amount = Number(unitSelection[unitId] ?? 0);
      if (amount <= 0) {
        continue;
      }
      insertArmyMovementUnitStmt.run(movementId, unitId, amount);
    }

    updateArmyMovementStatusStmt.run('completed', issuedAtIso, Number(support.id));

    return {
      orderId: movementId,
      commandType: 'return',
      originVillageId: Number(support.targetVillageId),
      targetVillageId: Number(support.homeVillageId),
      totalUnits: sumSelectedUnits(unitSelection),
      distanceTiles,
      durationSec: effectiveDurationSec,
      arriveAt: arriveAtIso,
      arrivesDuringNightMode: false,
    };
  }

  let targetVillage = null;
  if (commandType === 'attack' && payload?.manualTargetCoordX != null && payload?.manualTargetCoordY != null) {
    const manualCoordX = Number(payload?.manualTargetCoordX);
    const manualCoordY = Number(payload?.manualTargetCoordY);
    if (
      Number.isFinite(manualCoordX) &&
      Number.isFinite(manualCoordY) &&
      Number.isInteger(manualCoordX) &&
      Number.isInteger(manualCoordY)
    ) {
      targetVillage = selectVillageWithOwnerByCoordsAndRegionStmt.get(
        Math.floor(manualCoordX),
        Math.floor(manualCoordY),
        Number(village.region),
      );
      if (!targetVillage) {
        throw new GameRuleError('Rucne zadane souradnice neodpovidaji zadnemu lenu v tomto svete.', 404);
      }
    }
  }

  if (!targetVillage) {
    const targetVillageId = requirePositiveInteger(payload?.targetVillageId, 'targetVillageId');
    targetVillage = selectVillageWithOwnerByIdStmt.get(targetVillageId);
  }
  if (!targetVillage) {
    throw new GameRuleError('Cilove leno neexistuje.', 404);
  }
  if (Number(targetVillage.region) !== Number(village.region)) {
    throw new GameRuleError('Cilove leno je v jinem svete.', 400);
  }

  if (Number(targetVillage.id) === Number(village.id)) {
    throw new GameRuleError('Cilove leno musi byt odlisne od puvodniho.');
  }

  if (commandType === 'move' && Number(targetVillage.playerId) !== Number(player.id)) {
    throw new GameRuleError('Presun armady je mozny pouze mezi tvymi leny.');
  }

  if (commandType === 'support' && String(targetVillage.kingdom) !== String(village.kingdom)) {
    throw new GameRuleError('Podpora je povolena pouze v ramci stejneho kralovstvi.');
  }

  if (commandType === 'attack' && Number(targetVillage.playerId) === Number(player.id)) {
    throw new GameRuleError('Utok nelze poslat na vlastni leno.');
  }

  if (commandType === 'attack') {
    const spawnConfig = resolveWorldSpawnConfig(world);
    const protectionDays = Math.max(0, Number(spawnConfig.playerProtectionDays ?? 0));
    const targetOwnerUsernameComparable = normalizeUsernameComparable(String(targetVillage.ownerUsername ?? ''));
    const isTargetAbandonedBot =
      Number(targetVillage.ownerIsBot) === 1 &&
      targetOwnerUsernameComparable.startsWith(normalizeUsernameComparable(ABANDONED_BOT_USERNAME_PREFIX));
    if (protectionDays > 0) {
      if (!isTargetAbandonedBot && isVillageUnderSpawnProtection(village, protectionDays)) {
        throw new GameRuleError(
          'Jsi pod novackou ochranou. Po dobu 5 dni muzes utocit jen na opustene osady.',
          403,
        );
      }
      if (!isTargetAbandonedBot && isVillageUnderSpawnProtection(targetVillage, protectionDays)) {
        throw new GameRuleError(
          'Cilovy hrac je pod novackou ochranou. Utok je po dobu 5 dni blokovan.',
          403,
        );
      }
    }

    const isTargetSubjectToPrestigeLock = !isTargetAbandonedBot;
    if (isTargetSubjectToPrestigeLock) {
      const attackerPrestige = getPlayerPrestigeInRegion(Number(player.id), Number(village.region));
      const defenderPrestige = getPlayerPrestigeInRegion(Number(targetVillage.playerId), Number(targetVillage.region));
      const prestigeLock = evaluatePrestigeAttackLock({
        attackerPrestige,
        defenderPrestige,
        attackerPlayerId: Number(player.id),
        defenderPlayerId: Number(targetVillage.playerId),
        region: Number(village.region),
      });
      if (!prestigeLock.canAttack) {
        throw new GameRuleError(
          `Balanc prestize blokuje utok: cil ma ${Math.floor(defenderPrestige).toLocaleString(
            'cs-CZ',
          )} prestize, potrebuje alespon ${prestigeLock.minimumDefenderPrestige.toLocaleString(
            'cs-CZ',
          )}. Ochrana se zrusi, pokud te cilovy hrac napadne jako prvni.`,
          403,
        );
      }
    }
  }

  const selectedUnits = parseArmyUnitSelection(payload?.units);
  if (Math.max(0, Math.floor(Number(selectedUnits[MERCENARY_UNIT_ID] ?? 0))) > 0) {
    throw new GameRuleError('Zoldaky nelze vysilat mimo jejich domovske leno.');
  }
  if (commandType === 'support' && Number(selectedUnits.caravan ?? 0) > 0) {
    throw new GameRuleError('Karavany nelze posilat jako podporu.');
  }
  const totalUnits = sumSelectedUnits(selectedUnits);
  if (totalUnits <= 0) {
    throw new GameRuleError('Vyber alespon jednu jednotku pro armadni rozkaz.');
  }

  if (commandType === 'move') {
    const targetPopulation = getVillagePopulationStatus(Number(targetVillage.id));
    const selectedPopulationCost = calculateSelectionPopulationCost(selectedUnits);
    if (selectedPopulationCost > targetPopulation.availablePopulation) {
      throw new GameRuleError(
        `Cilove leno ma volnou populaci jen pro ${targetPopulation.availablePopulation} populace.`,
      );
    }
  }

  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(village.id));
  for (const unitId of UNIT_ORDER) {
    const requestedAmount = Number(selectedUnits[unitId] ?? 0);
    if (requestedAmount <= 0) {
      continue;
    }

    const availableAmount = Number(unitCounts[unitId] ?? 0);
    if (requestedAmount > availableAmount) {
      throw new GameRuleError(`Nedostatek jednotek: ${UNIT_DEFS[unitId].name}.`);
    }
  }

  const distanceTiles = calculateTileDistance(village, targetVillage);
  const durationSec = calculateArmyTravelDurationSec(selectedUnits, distanceTiles);
  if (durationSec <= 0) {
    throw new GameRuleError('Nelze vypocitat dobu presunu armady.');
  }
  const effectiveDurationSec = Math.max(1, Math.floor(Number(durationSec ?? 0)));
  const arriveAtIso = new Date(Date.parse(issuedAtIso) + effectiveDurationSec * 1000).toISOString();

  for (const unitId of UNIT_ORDER) {
    const requestedAmount = Number(selectedUnits[unitId] ?? 0);
    if (requestedAmount <= 0) {
      continue;
    }

    const availableAmount = Number(unitCounts[unitId] ?? 0);
    updateUnitAmountStmt.run(availableAmount - requestedAmount, Number(village.id), unitId);
  }

  const insertedMovement = insertArmyMovementStmt.run(
    Number(player.id),
    commandType,
    Number(village.id),
    Number(targetVillage.id),
    Number(village.id),
    lootPriority,
    0,
    0,
    0,
    issuedAtIso,
    arriveAtIso,
    'in_progress',
  );
  const movementId = Number(insertedMovement.lastInsertRowid);
  for (const unitId of UNIT_ORDER) {
    const amount = Number(selectedUnits[unitId] ?? 0);
    if (amount <= 0) {
      continue;
    }
    insertArmyMovementUnitStmt.run(movementId, unitId, amount);
  }

  if (commandType === 'attack' && Number(targetVillage.ownerIsBot ?? 0) !== 1) {
    registerCombatRetaliationFlag({
      aggressorPlayerId: Number(player.id),
      defenderPlayerId: Number(targetVillage.playerId),
      region: Number(village.region),
      attackedAtIso: issuedAtIso,
    });
  }

  const commandLabel =
    commandType === 'attack' ? 'Útok' : commandType === 'support' ? 'Podpora' : commandType === 'move' ? 'Přesun' : 'Rozkaz';
  createPlayerNotification({
    playerId: Number(player.id),
    region: Number(village.region),
    category: 'command',
    eventType: 'army_command_sent',
    severity: 'info',
    title: `${commandLabel} odeslán`,
    summary: `${commandLabel} z osady ${String(village.name)} na ${String(targetVillage.name)} dorazí za ${formatRemaining(effectiveDurationSec)}.`,
    payload: {
      movementId,
      commandType,
      originVillageId: Number(village.id),
      originVillageName: String(village.name),
      targetVillageId: Number(targetVillage.id),
      targetVillageName: String(targetVillage.name),
      totalUnits,
      arriveAt: arriveAtIso,
    },
    sourceType: 'army_movement',
    sourceId: movementId,
    createdAt: issuedAtIso,
  });
  if (Number(targetVillage.playerId) !== Number(player.id) && Number(targetVillage.ownerIsBot ?? 0) !== 1) {
    const incomingSeverity = commandType === 'attack' ? 'critical' : 'warning';
    const incomingTitle =
      commandType === 'attack'
        ? `Příchozí útok na ${String(targetVillage.name)}`
        : commandType === 'support'
          ? `Příchozí podpora na ${String(targetVillage.name)}`
          : `Příchozí přesun na ${String(targetVillage.name)}`;
    createPlayerNotification({
      playerId: Number(targetVillage.playerId),
      region: Number(targetVillage.region),
      category: commandType === 'attack' ? 'combat' : 'command',
      eventType: commandType === 'attack' ? 'incoming_attack' : 'incoming_command',
      severity: incomingSeverity,
      title: incomingTitle,
      summary: `${player.username} vyslal ${commandLabel.toLowerCase()} z ${String(village.name)}. ETA ${formatRemaining(effectiveDurationSec)}.`,
      payload: {
        movementId,
        commandType,
        commanderUsername: String(player.username),
        originVillageId: Number(village.id),
        originVillageName: String(village.name),
        targetVillageId: Number(targetVillage.id),
        targetVillageName: String(targetVillage.name),
        totalUnits,
        arriveAt: arriveAtIso,
      },
      sourceType: 'army_movement',
      sourceId: movementId,
      createdAt: issuedAtIso,
    });
  }

  return {
    orderId: movementId,
    commandType,
    originVillageId: Number(village.id),
    targetVillageId: Number(targetVillage.id),
    totalUnits,
    totalCost: sumSelectedCost(selectedUnits),
    distanceTiles,
    durationSec: effectiveDurationSec,
    arriveAt: arriveAtIso,
    arrivesDuringNightMode: commandType === 'attack' ? isNightModeAtTime(arriveAtIso) : false,
    lootPriority,
  };
});

const cancelArmyCommandTransaction = db.transaction((username, movementIdRaw, requestedVillageId, worldId = null) => {
  const { player, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const movementId = requirePositiveInteger(movementIdRaw, 'movementId');
  const movement = selectInProgressMovementByIdForPlayerStmt.get(
    Number(movementId),
    Number(player.id),
    Number(world.region),
  );
  if (!movement) {
    throw new GameRuleError('Rozkaz nebyl nalezen nebo uz nelze zrusit.', 404);
  }

  const commandType = String(movement.commandType ?? '');
  if (!['attack', 'support', 'move'].includes(commandType)) {
    throw new GameRuleError('Tento typ rozkazu nelze zrusit.', 400);
  }

  const startedAtMs = Date.parse(String(movement.startedAt));
  const arriveAtMs = Date.parse(String(movement.arriveAt));
  const nowMs = Date.now();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(arriveAtMs) || arriveAtMs <= startedAtMs) {
    throw new GameRuleError('Rozkaz ma neplatna casova data a nelze jej zrusit.', 400);
  }

  const totalDurationSec = Math.max(1, (arriveAtMs - startedAtMs) / 1000);
  const elapsedSec = Math.max(0, Math.min(totalDurationSec, (nowMs - startedAtMs) / 1000));
  const maxCancelableSec = totalDurationSec * COMMAND_CANCEL_MAX_PROGRESS;
  if (elapsedSec > maxCancelableSec) {
    throw new GameRuleError(
      `Rozkaz lze zrusit pouze do 1/3 cesty. Aktualni prubeh: ${Math.round((elapsedSec / totalDurationSec) * 100)} %.`,
      400,
    );
  }

  const movementUnitsRows = selectMovementUnitsStmt.all(Number(movement.id));
  const returnSelection = toCompleteUnitSelection({});
  for (const unitRow of movementUnitsRows) {
    const unitId = String(unitRow.unitId ?? '');
    if (!UNIT_ORDER.includes(unitId)) {
      continue;
    }
    returnSelection[unitId] = Math.max(0, Math.floor(Number(unitRow.amount ?? 0)));
  }
  const totalUnits = sumSelectedUnits(returnSelection);
  if (totalUnits <= 0) {
    updateArmyMovementStatusStmt.run('completed', nowIso(), Number(movement.id));
    return {
      canceledMovementId: Number(movement.id),
      returnMovementId: null,
      totalUnits: 0,
      elapsedSec: Math.round(elapsedSec),
      returnDurationSec: 0,
      returnArriveAt: null,
    };
  }

  const returnDurationSec = Math.max(1, Math.round(elapsedSec));
  const startedAtIso = nowIso();
  const returnArriveAtIso = new Date(Date.parse(startedAtIso) + returnDurationSec * 1000).toISOString();
  const insertedReturn = insertArmyMovementStmt.run(
    Number(player.id),
    'return',
    Number(movement.targetVillageId),
    Number(movement.homeVillageId),
    Number(movement.homeVillageId),
    null,
    0,
    0,
    0,
    startedAtIso,
    returnArriveAtIso,
    'in_progress',
  );
  const returnMovementId = Number(insertedReturn.lastInsertRowid);
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(returnSelection[unitId] ?? 0)));
    if (amount <= 0) {
      continue;
    }
    insertArmyMovementUnitStmt.run(returnMovementId, unitId, amount);
  }

  updateArmyMovementStatusStmt.run('completed', startedAtIso, Number(movement.id));

  createPlayerNotification({
    playerId: Number(player.id),
    region: Number(world.region),
    category: 'command',
    eventType: 'army_command_canceled',
    severity: 'info',
    title: 'Rozkaz byl zrusen',
    summary: `Jednotky se vraceji (${totalUnits.toLocaleString('cs-CZ')} jednotek, navrat za ${formatRemaining(returnDurationSec)}).`,
    payload: {
      canceledMovementId: Number(movement.id),
      returnMovementId,
      elapsedSec: Math.round(elapsedSec),
      returnDurationSec,
      returnArriveAt: returnArriveAtIso,
    },
    sourceType: 'army_movement',
    sourceId: returnMovementId,
    createdAt: startedAtIso,
  });

  return {
    canceledMovementId: Number(movement.id),
    returnMovementId,
    totalUnits,
    elapsedSec: Math.round(elapsedSec),
    returnDurationSec,
    returnArriveAt: returnArriveAtIso,
  };
});

const resolveUpgradeDurationMs = (upgrade) => {
  const startMs = Date.parse(String(upgrade?.startedAt ?? ''));
  const finishMs = Date.parse(String(upgrade?.finishAt ?? ''));
  if (Number.isFinite(startMs) && Number.isFinite(finishMs)) {
    return Math.max(1000, finishMs - startMs);
  }
  return 1000;
};

const applyUpgradeQueueTimeline = (villageIdRaw, orderedUpgrades, nowIsoRaw = nowIso()) => {
  const villageId = Number(villageIdRaw);
  if (!Number.isFinite(villageId) || villageId <= 0 || !Array.isArray(orderedUpgrades) || orderedUpgrades.length <= 0) {
    return;
  }

  const nowMsRaw = Date.parse(String(nowIsoRaw));
  const nowMs = Number.isFinite(nowMsRaw) ? nowMsRaw : Date.now();

  let cursorMs = nowMs;
  for (let index = 0; index < orderedUpgrades.length; index += 1) {
    const upgrade = orderedUpgrades[index];
    const originalStartMs = Date.parse(String(upgrade.startedAt));
    const originalFinishMs = Date.parse(String(upgrade.finishAt));
    const originalDurationMs = resolveUpgradeDurationMs(upgrade);

    let nextStartMs = cursorMs;
    let nextFinishMs = cursorMs + originalDurationMs;

    if (index === 0) {
      const isAlreadyActive =
        Number.isFinite(originalStartMs) &&
        Number.isFinite(originalFinishMs) &&
        originalStartMs <= nowMs &&
        originalFinishMs > nowMs;
      if (isAlreadyActive) {
        nextFinishMs = originalFinishMs;
        nextStartMs = Math.max(nowMs - originalDurationMs, nextFinishMs - originalDurationMs);
      }
    }

    cursorMs = nextFinishMs;

    const changed =
      !Number.isFinite(originalStartMs) ||
      !Number.isFinite(originalFinishMs) ||
      Math.abs(originalStartMs - nextStartMs) > 500 ||
      Math.abs(originalFinishMs - nextFinishMs) > 500;
    if (!changed) {
      continue;
    }

    updateActiveUpgradeTimingByIdStmt.run(
      new Date(nextStartMs).toISOString(),
      new Date(nextFinishMs).toISOString(),
      Number(upgrade.id),
      villageId,
    );
  }
};

const rebalanceUpgradeQueueTimeline = (villageIdRaw, nowIsoRaw = nowIso()) => {
  const villageId = Number(villageIdRaw);
  if (!Number.isFinite(villageId) || villageId <= 0) {
    return;
  }
  const activeUpgrades = selectActiveUpgradesByVillageStmt.all(villageId);
  if (activeUpgrades.length <= 0) {
    return;
  }
  applyUpgradeQueueTimeline(villageId, activeUpgrades, nowIsoRaw);
};

const resolveResearchProgressForPlayerRegion = (
  playerId,
  region,
  updatedAtIso = nowIso(),
  options = {},
) => {
  const persist = options?.persist !== false;
  if (persist) {
    ensureResearchRowsForPlayerRegion(playerId, region, updatedAtIso);
  }
  const rows = selectResearchProgressByPlayerRegionStmt.all(Number(playerId), Number(region));
  const byId = new Map(rows.map((row) => [String(row.researchId), row]));
  const completedIds = buildCompletedResearchSet(rows);
  const resolvedRows = [];

  for (const definition of RESEARCH_DEFS) {
    const row = byId.get(String(definition.id)) ?? null;
    const nextStatus = resolveResearchStatusForDefinition(definition, row, completedIds);
    const progress = Math.max(0, Number(row?.progress ?? 0));
    const assignedAcademics =
      nextStatus === 'researching'
        ? Math.max(
            0,
            Math.floor(
              Number(
                countAssignedAcademicsForResearchByPlayerRegionStmt.get(
                  Number(playerId),
                  Number(region),
                  String(definition.id),
                )?.total ?? 0,
              ),
            ),
          )
        : 0;
    const startedAt = nextStatus === 'researching' ? String(row?.startedAt ?? updatedAtIso) : row?.startedAt ?? null;
    const completedAt = nextStatus === 'completed' ? String(row?.completedAt ?? updatedAtIso) : row?.completedAt ?? null;
    const resolvedRow =
      row == null ||
      String(row.status) !== nextStatus ||
      Number(row.assignedAcademics ?? 0) !== assignedAcademics ||
      String(row.updatedAt ?? '') !== String(updatedAtIso)
        ? {
            id: Number(row?.id ?? 0),
            playerId: Number(playerId),
            region: Number(region),
            researchId: String(definition.id),
            status: nextStatus,
            progress,
            assignedAcademics,
            startedAt,
            completedAt,
            updatedAt: String(updatedAtIso),
          }
        : row;

    if (persist && resolvedRow !== row) {
      upsertResearchProgressStmt.run(
        Number(playerId),
        Number(region),
        String(definition.id),
        nextStatus,
        progress,
        assignedAcademics,
        startedAt,
        completedAt,
        String(updatedAtIso),
      );
    }

    resolvedRows.push(resolvedRow);
  }

  return persist ? selectResearchProgressByPlayerRegionStmt.all(Number(playerId), Number(region)) : resolvedRows;
};

const startUpgradeTransaction = db.transaction((username, buildingId, startedAtIso, requestedVillageId, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const activeUpgrades = selectActiveUpgradesByVillageStmt.all(village.id);
  const projectedBuildingLevels = buildProjectedBuildingLevels(buildingLevels, activeUpgrades);
  const currentLevel = buildingLevels[buildingId];
  if (currentLevel == null) {
    throw new GameRuleError('Neznama budova.');
  }
  const requirementError = resolveBuildingRequirementError(buildingId, buildingLevels, {
    effectiveBuildingLevels: projectedBuildingLevels,
  });
  if (requirementError) {
    throw new GameRuleError(requirementError, 400);
  }

  const requiredResearchId = BUILDING_RESEARCH_REQUIREMENTS[buildingId] ?? null;
  if (requiredResearchId) {
    const researchRows = ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(village.region), startedAtIso);
    if (!isResearchCompleted(researchRows, requiredResearchId)) {
      const researchName = getResearchDefinition(requiredResearchId)?.name ?? requiredResearchId;
      throw new GameRuleError(`Pro vystavbu je nejprve potreba dokoncit vyzkum '${researchName}'.`, 400);
    }
  }
  const maxLevel = getMaxBuildingLevel(buildingId);
  const queuedUpgradesForBuilding = activeUpgrades.filter(
    (upgrade) => String(upgrade.buildingId) === String(buildingId),
  );
  const queuedHighestLevel = queuedUpgradesForBuilding.reduce(
    (maxQueuedLevel, upgrade) => Math.max(maxQueuedLevel, Number(upgrade.toLevel ?? currentLevel)),
    currentLevel,
  );
  if (queuedHighestLevel >= maxLevel) {
    throw new GameRuleError('Budova je na maximalni urovni.');
  }

  const resources = synchronizeVillageEconomyAt(Number(village.id));
  if (!resources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }

  const effectiveFromLevel = Math.max(0, Math.floor(queuedHighestLevel));
  const cost = calculateUpgradeCost(buildingId, effectiveFromLevel);
  if (!cost) {
    throw new GameRuleError('Upgrade neni dostupny.');
  }
  const townhallLevel = buildingLevels.townhall ?? 0;
  const durationSec = calculateUpgradeDurationSec(buildingId, effectiveFromLevel, townhallLevel);
  const nowMs = Date.parse(startedAtIso);
  const queueTailFinishMs = activeUpgrades.reduce((latestFinishMs, upgrade) => {
    const finishMs = Date.parse(String(upgrade.finishAt));
    if (!Number.isFinite(finishMs)) {
      return latestFinishMs;
    }
    return Math.max(latestFinishMs, finishMs);
  }, nowMs);
  const queueStartMs = Math.max(nowMs, queueTailFinishMs);
  const queueStartIso = new Date(queueStartMs).toISOString();
  const finishAtIso = new Date(queueStartMs + durationSec * 1000).toISOString();

  const pocket = {
    wood: Number(resources.wood),
    stone: Number(resources.stone),
    iron: Number(resources.iron),
  };
  if (!canAfford(pocket, cost)) {
    throw new GameRuleError('Nedostatek surovin pro upgrade.');
  }

  updateResourcesAfterSpendStmt.run(
    roundResource(pocket.wood - cost.wood),
    roundResource(pocket.stone - cost.stone),
    roundResource(pocket.iron - cost.iron),
    roundResource(Number(resources.gold ?? 0)),
    roundResource(Number(resources.coins ?? 0)),
    nowIso(),
    village.id,
  );

  const insertedUpgradeResult = insertUpgradeStmt.run(
    village.id,
    buildingId,
    effectiveFromLevel,
    effectiveFromLevel + 1,
    cost.wood,
    cost.stone,
    cost.iron,
    queueStartIso,
    finishAtIso,
  );
  const insertedUpgradeId = Number(insertedUpgradeResult.lastInsertRowid ?? 0);
  rebalanceUpgradeQueueTimeline(Number(village.id), startedAtIso);
  const rebalancedUpgrade =
    insertedUpgradeId > 0
      ? selectActiveUpgradeByIdForVillageStmt.get(insertedUpgradeId, Number(village.id))
      : null;
  const resolvedStartedAt = rebalancedUpgrade?.startedAt ?? queueStartIso;
  const resolvedFinishAt = rebalancedUpgrade?.finishAt ?? finishAtIso;
  const resolvedRemainingSec = Math.max(0, Math.ceil((Date.parse(String(resolvedFinishAt)) - Date.now()) / 1000));

  return {
    buildingId,
    fromLevel: effectiveFromLevel,
    toLevel: effectiveFromLevel + 1,
    cost,
    durationSec,
    startedAt: resolvedStartedAt,
    finishAt: resolvedFinishAt,
    remainingSec: resolvedRemainingSec,
  };
});

export const startBuildingUpgrade = (username, buildingId, requestedVillageId = null, worldId = null) => {
  const startedAtIso = nowIso();
  return startUpgradeTransaction(username, buildingId, startedAtIso, requestedVillageId, worldId);
};

const cancelBuildingUpgradeTransaction = db.transaction((username, upgradeIdRaw, requestedVillageId, worldId = null) => {
  const { village } = requireVillageForUser(username, requestedVillageId, worldId);
  const upgradeId = requirePositiveInteger(upgradeIdRaw, 'upgradeId');

  const targetUpgrade = selectActiveUpgradeByIdForVillageStmt.get(upgradeId, Number(village.id));
  if (!targetUpgrade) {
    throw new GameRuleError('Upgrade nebyl nalezen nebo uz neni aktivni.', 404);
  }

  const sameBuildingQueue = selectActiveUpgradesByVillageAndBuildingStmt.all(
    Number(village.id),
    String(targetUpgrade.buildingId),
  );
  const targetFinishMs = Date.parse(String(targetUpgrade.finishAt));
  const fallbackTargetId = Number(targetUpgrade.id);
  const upgradesToCancel = sameBuildingQueue.filter((upgrade) => {
    const finishMs = Date.parse(String(upgrade.finishAt));
    if (!Number.isFinite(targetFinishMs) || !Number.isFinite(finishMs)) {
      return Number(upgrade.id) >= fallbackTargetId;
    }
    if (finishMs > targetFinishMs) {
      return true;
    }
    if (finishMs < targetFinishMs) {
      return false;
    }
    return Number(upgrade.id) >= fallbackTargetId;
  });

  const queueSlice = upgradesToCancel.length > 0 ? upgradesToCancel : [targetUpgrade];
  const refunded = queueSlice.reduce(
    (sum, upgrade) => ({
      wood: sum.wood + Math.max(0, Math.floor(Number(upgrade.woodCost ?? 0))),
      stone: sum.stone + Math.max(0, Math.floor(Number(upgrade.stoneCost ?? 0))),
      iron: sum.iron + Math.max(0, Math.floor(Number(upgrade.ironCost ?? 0))),
    }),
    { wood: 0, stone: 0, iron: 0 },
  );

  for (const upgrade of queueSlice) {
    deleteActiveUpgradeByIdStmt.run(Number(upgrade.id), Number(village.id));
  }

  const currentBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(village.id)));
  const cancelByDependency = [];
  let remainingUpgrades = selectActiveUpgradesByVillageStmt.all(Number(village.id));

  // If prerequisite upgrades were canceled, remove dependent upgrades that are no longer valid.
  while (remainingUpgrades.length > 0) {
    const projectedLevels = buildProjectedBuildingLevels(currentBuildingLevels, remainingUpgrades);
    const invalidUpgrades = remainingUpgrades.filter((upgrade) => {
      const requirementError = resolveBuildingRequirementError(String(upgrade.buildingId), currentBuildingLevels, {
        effectiveBuildingLevels: projectedLevels,
      });
      return requirementError != null;
    });

    if (invalidUpgrades.length <= 0) {
      break;
    }

    const invalidIds = new Set(invalidUpgrades.map((upgrade) => Number(upgrade.id)));
    for (const invalidUpgrade of invalidUpgrades) {
      cancelByDependency.push(invalidUpgrade);
      deleteActiveUpgradeByIdStmt.run(Number(invalidUpgrade.id), Number(village.id));
    }
    remainingUpgrades = remainingUpgrades.filter((upgrade) => !invalidIds.has(Number(upgrade.id)));
  }

  const dependencyRefunded = cancelByDependency.reduce(
    (sum, upgrade) => ({
      wood: sum.wood + Math.max(0, Math.floor(Number(upgrade.woodCost ?? 0))),
      stone: sum.stone + Math.max(0, Math.floor(Number(upgrade.stoneCost ?? 0))),
      iron: sum.iron + Math.max(0, Math.floor(Number(upgrade.ironCost ?? 0))),
    }),
    { wood: 0, stone: 0, iron: 0 },
  );
  const totalRefunded = {
    wood: refunded.wood + dependencyRefunded.wood,
    stone: refunded.stone + dependencyRefunded.stone,
    iron: refunded.iron + dependencyRefunded.iron,
  };

  addResourcesWithoutCap(Number(village.id), totalRefunded);
  rebalanceUpgradeQueueTimeline(Number(village.id), nowIso());

  return {
    canceledUpgradeId: Number(targetUpgrade.id),
    buildingId: String(targetUpgrade.buildingId),
    canceledCount: queueSlice.length + cancelByDependency.length,
    dependencyCanceledCount: cancelByDependency.length,
    refunded: totalRefunded,
  };
});

export const cancelBuildingUpgrade = (username, upgradeId, requestedVillageId = null, worldId = null) =>
  cancelBuildingUpgradeTransaction(username, upgradeId, requestedVillageId, worldId);

const cancelAllBuildingUpgradesTransaction = db.transaction((username, requestedVillageId = null, worldId = null) => {
  const { village } = requireVillageForUser(username, requestedVillageId, worldId);
  const villageId = Number(village.id);
  const activeUpgrades = selectActiveUpgradesByVillageStmt.all(villageId);
  if (activeUpgrades.length <= 0) {
    return {
      canceledCount: 0,
      refunded: { wood: 0, stone: 0, iron: 0 },
    };
  }

  const refunded = activeUpgrades.reduce(
    (sum, upgrade) => ({
      wood: sum.wood + Math.max(0, Math.floor(Number(upgrade.woodCost ?? 0))),
      stone: sum.stone + Math.max(0, Math.floor(Number(upgrade.stoneCost ?? 0))),
      iron: sum.iron + Math.max(0, Math.floor(Number(upgrade.ironCost ?? 0))),
    }),
    { wood: 0, stone: 0, iron: 0 },
  );

  for (const upgrade of activeUpgrades) {
    deleteActiveUpgradeByIdStmt.run(Number(upgrade.id), villageId);
  }

  addResourcesWithoutCap(villageId, refunded);

  return {
    canceledCount: activeUpgrades.length,
    refunded,
  };
});

export const cancelAllBuildingUpgrades = (username, requestedVillageId = null, worldId = null) =>
  cancelAllBuildingUpgradesTransaction(username, requestedVillageId, worldId);

const reorderBuildingUpgradeQueueTransaction = db.transaction(
  (username, upgradeIdRaw, targetIndexRaw, requestedVillageId = null, worldId = null) => {
    const { village } = requireVillageForUser(username, requestedVillageId, worldId);
    const villageId = Number(village.id);
    const upgradeId = requirePositiveInteger(upgradeIdRaw, 'upgradeId');
    const activeUpgrades = selectActiveUpgradesByVillageStmt.all(villageId);
    if (activeUpgrades.length <= 1) {
      throw new GameRuleError('Stavebni fronta nema dostatek polozek pro presun.', 400);
    }

    const fromIndex = activeUpgrades.findIndex((upgrade) => Number(upgrade.id) === upgradeId);
    if (fromIndex < 0) {
      throw new GameRuleError('Upgrade nebyl nalezen nebo uz neni aktivni.', 404);
    }
    if (fromIndex === 0) {
      throw new GameRuleError('Aktivne probiha upgrade nelze presouvat.', 400);
    }

    const rawTargetIndex = Math.floor(Number(targetIndexRaw));
    if (!Number.isFinite(rawTargetIndex)) {
      throw new GameRuleError('Neplatny cilovy index fronty.', 400);
    }
    const minTargetIndex = 1;
    const maxTargetIndex = activeUpgrades.length - 1;
    const targetIndex = Math.max(minTargetIndex, Math.min(maxTargetIndex, rawTargetIndex));

    if (targetIndex === fromIndex) {
      return {
        movedUpgradeId: upgradeId,
        fromIndex,
        toIndex: targetIndex,
        queueLength: activeUpgrades.length,
        moved: false,
      };
    }

    const reorderedUpgrades = [...activeUpgrades];
    const [movedUpgrade] = reorderedUpgrades.splice(fromIndex, 1);
    reorderedUpgrades.splice(targetIndex, 0, movedUpgrade);
    applyUpgradeQueueTimeline(villageId, reorderedUpgrades, nowIso());

    return {
      movedUpgradeId: upgradeId,
      fromIndex,
      toIndex: targetIndex,
      queueLength: reorderedUpgrades.length,
      moved: true,
    };
  },
);

export const reorderBuildingUpgradeQueue = (
  username,
  upgradeId,
  targetIndex,
  requestedVillageId = null,
  worldId = null,
) => reorderBuildingUpgradeQueueTransaction(username, upgradeId, targetIndex, requestedVillageId, worldId);

const conquerVillageTransaction = db.transaction((username, villageIdRaw, requestedVillageId = null, worldId = null) => {
  const { player, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const villageId = requirePositiveInteger(villageIdRaw, 'villageId');
  const targetVillage = selectVillageForConquestStmt.get(villageId);
  if (!targetVillage) {
    throw new GameRuleError('Cilova osada neexistuje.', 404);
  }
  if (Number(targetVillage.region) !== Number(world.region)) {
    throw new GameRuleError('Cilova osada patri do jineho sveta.', 400);
  }

  if (Number(targetVillage.ownerId) === Number(player.id)) {
    return {
      villageId,
      villageName: targetVillage.name,
      previousOwner: player.username,
      newOwner: player.username,
      renamed: false,
    };
  }

  const kingdomRow = selectPrimaryKingdomByPlayerAndRegionStmt.get(Number(player.id), Number(world.region));
  const conquerorKingdom = String(kingdomRow?.kingdom ?? 'Neutral');

  clearResearchAssignmentsByVillageStmt.run(Number(villageId));
  removeAcademicsByVillageStmt.run(nowIso(), Number(villageId));
  updateVillageOwnerForConquestStmt.run(Number(player.id), conquerorKingdom, villageId);

  return {
    villageId,
    villageName: targetVillage.name,
    previousOwner: targetVillage.ownerUsername,
    newOwner: player.username,
    renamed: false,
  };
});

export const conquerVillage = (username, villageId, requestedVillageId = null, worldId = null) =>
  conquerVillageTransaction(username, villageId, requestedVillageId, worldId);
const renameVillageTransaction = db.transaction((username, nameRaw, requestedVillageId = null, worldId = null) => {
  const { player, village, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const villageName = validateVillageName(nameRaw);
  const villageId = Number(village.id);
  const ownerId = Number(player.id);
  const region = Number(world.region);
  const previousName = String(village.name ?? '');
  const changed = Number(updateVillageNameByOwnerAndRegionStmt.run(villageName, villageId, ownerId, region).changes ?? 0);
  const resolvedVillage = selectVillageByIdStmt.get(villageId);
  const currentName = String(resolvedVillage?.name ?? previousName);
  return {
    villageId,
    previousName,
    newName: currentName,
    renamed: changed > 0,
    changedAt: nowIso(),
  };
});
export const renameVillage = (username, name, requestedVillageId = null, worldId = null) =>
  renameVillageTransaction(username, name, requestedVillageId, worldId);
export const restartVillageProgress = (username, requestedVillageId = null, worldId = null) =>
  restartVillageProgressTransaction(username, requestedVillageId, worldId);
export const createAbandonedVillages = (count = 1) => createAbandonedVillagesTransaction(count);

const requireKingdomLeadership = (player, kingdomName, region) => {
  if (isNeutralKingdom(kingdomName)) {
    throw new GameRuleError('Nejsi clenem zadneho kralovstvi.', 400);
  }

  const leader = resolveKingdomLeader(kingdomName, region);
  if (!leader || Number(leader.playerId) !== Number(player.id)) {
    throw new GameRuleError('Pouze vudce kralovstvi muze provest tuto akci.', 403);
  }

  return leader;
};

const validateKingdomName = (rawValue, region) => {
  const normalized = normalizeKingdomValue(rawValue).replace(/\s+/g, ' ');
  if (normalized.length < 3) {
    throw new GameRuleError('Nazev kralovstvi musi mit alespon 3 znaky.', 400);
  }
  if (normalized.length > 28) {
    throw new GameRuleError('Nazev kralovstvi muze mit maximalne 28 znaku.', 400);
  }
  if (!/^[\p{L}\p{N}\s-]+$/u.test(normalized)) {
    throw new GameRuleError('Nazev kralovstvi obsahuje nepovolene znaky.', 400);
  }
  if (isNeutralKingdom(normalized)) {
    throw new GameRuleError('Tento nazev kralovstvi neni povolen.', 400);
  }

  const normalizedComparable = normalizeKingdomComparable(normalized);
  const existing = selectDistinctPlayerKingdomNamesStmt
    .all(Number(region))
    .map((row) => String(row.kingdom))
    .find((kingdomName) => normalizeKingdomComparable(kingdomName) === normalizedComparable);
  if (existing) {
    throw new GameRuleError('Království s tímto názvem už existuje.', 400);
  }

  return normalized;
};

const createKingdomTransaction = db.transaction((username, kingdomNameRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = Number(village.region);
  const currentKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  if (!isNeutralKingdom(currentKingdom)) {
    throw new GameRuleError('Už jsi členem království. Nejprve musíš odejít.', 400);
  }

  const kingdomName = validateKingdomName(kingdomNameRaw, worldRegion);
  updateVillagesKingdomByPlayerStmt.run(kingdomName, Number(player.id), worldRegion);
  const respondedAt = nowIso();
  rejectAllPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(player.id), worldRegion);
  createKingdomEvent({
    region: worldRegion,
    kingdom: kingdomName,
    eventType: 'kingdom_created',
    actorPlayerId: Number(player.id),
    payload: { founderUsername: player.username },
  });
  createPlayerNotification({
    playerId: Number(player.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_created',
    severity: 'success',
    title: `Království založeno: ${kingdomName}`,
    summary: `Tvé království ${kingdomName} bylo úspěšně založeno.`,
    payload: { kingdom: kingdomName, founderUsername: player.username },
    sourceType: 'kingdom_event',
    sourceId: null,
    createdAt: respondedAt,
  });

  return {
    kingdom: kingdomName,
    founderUsername: player.username,
    createdAt: respondedAt,
  };
});

const invitePlayerToKingdomTransaction = db.transaction(
  (username, targetUsernameRaw, requestedVillageId = null, worldId = null) => {
    const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
    const worldRegion = Number(village.region);
    const inviterKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
    requireKingdomLeadership(player, inviterKingdom, worldRegion);

    const targetUsername = normalizeUsername(targetUsernameRaw);
    if (!targetUsername) {
      throw new GameRuleError("Pole 'targetUsername' je povinne.");
    }

    const targetPlayer = selectNonBotPlayerByUsernameStmt.get(targetUsername);
    if (!targetPlayer) {
      throw new GameRuleError(`Hrac '${targetUsername}' neexistuje.`, 404);
    }
    if (Number(targetPlayer.id) === Number(player.id)) {
      throw new GameRuleError('Do kralovstvi nemuzes pozvat sam sebe.', 400);
    }

    const targetKingdom = resolvePrimaryKingdomByPlayerId(Number(targetPlayer.id), worldRegion);
    if (!isNeutralKingdom(targetKingdom)) {
      throw new GameRuleError('Cilovy hrac uz je clenem jineho kralovstvi.', 400);
    }

    const existingInvite = selectPendingKingdomInviteByTargetStmt.get(Number(targetPlayer.id), worldRegion);
    if (existingInvite) {
      throw new GameRuleError('Cilovy hrac uz ma aktivni pozvanku.', 400);
    }

    const createdAt = nowIso();
    const insertion = insertKingdomInviteStmt.run(
      worldRegion,
      inviterKingdom,
      Number(player.id),
      Number(targetPlayer.id),
      createdAt,
    );
    const inviteId = Number(insertion.lastInsertRowid);
    createKingdomEvent({
      region: worldRegion,
      kingdom: inviterKingdom,
      eventType: 'invite_sent',
      actorPlayerId: Number(player.id),
      targetPlayerId: Number(targetPlayer.id),
      payload: { inviteId },
    });
    createPlayerNotification({
      playerId: Number(player.id),
      region: worldRegion,
      category: 'kingdom',
      eventType: 'kingdom_invite_sent',
      severity: 'info',
      title: `Pozvánka odeslána: ${targetPlayer.username}`,
      summary: `Do království ${inviterKingdom} byla odeslána pozvánka hráči ${targetPlayer.username}.`,
      payload: { inviteId, kingdom: inviterKingdom, targetUsername: String(targetPlayer.username) },
      sourceType: 'kingdom_invite',
      sourceId: inviteId,
      createdAt,
    });
    createPlayerNotification({
      playerId: Number(targetPlayer.id),
      region: worldRegion,
      category: 'kingdom',
      eventType: 'kingdom_invite_received',
      severity: 'warning',
      title: `Pozvánka do království ${inviterKingdom}`,
      summary: `${player.username} tě pozval do království ${inviterKingdom}.`,
      payload: { inviteId, kingdom: inviterKingdom, inviterUsername: player.username },
      sourceType: 'kingdom_invite',
      sourceId: inviteId,
      createdAt,
    });

    return {
      inviteId,
      kingdom: inviterKingdom,
      inviterUsername: player.username,
      targetUsername: String(targetPlayer.username),
      createdAt,
    };
  },
);

const acceptKingdomInviteTransaction = db.transaction((username, inviteIdRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = Number(village.region);
  const inviteId = requirePositiveInteger(inviteIdRaw, 'inviteId');

  if (!isNeutralKingdom(village.kingdom)) {
    throw new GameRuleError('Uz jsi clenem kralovstvi. Nejdrive odejdi.', 400);
  }

  const invite = selectPendingKingdomInviteByIdForTargetStmt.get(inviteId, Number(player.id), worldRegion);
  if (!invite) {
    throw new GameRuleError('Pozvanka nebyla nalezena nebo uz neni aktivni.', 404);
  }

  const targetKingdom = normalizeKingdomValue(invite.kingdom) || 'Neutral';
  if (isNeutralKingdom(targetKingdom)) {
    updateKingdomInviteStatusByIdStmt.run('rejected', nowIso(), inviteId, worldRegion);
    throw new GameRuleError('Pozvanka odkazuje na neplatne kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run(targetKingdom, Number(player.id), worldRegion);
  const respondedAt = nowIso();
  updateKingdomInviteStatusByIdStmt.run('accepted', respondedAt, inviteId, worldRegion);
  rejectOtherPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(player.id), worldRegion, inviteId);
  createKingdomEvent({
    region: worldRegion,
    kingdom: targetKingdom,
    eventType: 'invite_accepted',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(invite.inviterPlayerId),
    payload: { inviteId },
  });
  createPlayerNotification({
    playerId: Number(player.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_invite_accepted',
    severity: 'success',
    title: `Vstup do království ${targetKingdom}`,
    summary: `Přijal jsi pozvánku do království ${targetKingdom}.`,
    payload: { inviteId, kingdom: targetKingdom, inviterUsername: String(invite.inviterUsername) },
    sourceType: 'kingdom_invite',
    sourceId: inviteId,
    createdAt: respondedAt,
  });
  createPlayerNotification({
    playerId: Number(invite.inviterPlayerId),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_invite_target_joined',
    severity: 'success',
    title: `Pozvánka přijata: ${player.username}`,
    summary: `${player.username} přijal pozvánku do království ${targetKingdom}.`,
    payload: { inviteId, kingdom: targetKingdom, actorUsername: player.username },
    sourceType: 'kingdom_invite',
    sourceId: inviteId,
    createdAt: respondedAt,
  });

  return {
    inviteId,
    kingdom: targetKingdom,
    inviterUsername: String(invite.inviterUsername),
    acceptedAt: respondedAt,
  };
});

const rejectKingdomInviteTransaction = db.transaction((username, inviteIdRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = Number(village.region);
  const inviteId = requirePositiveInteger(inviteIdRaw, 'inviteId');
  const invite = selectPendingKingdomInviteByIdForTargetStmt.get(inviteId, Number(player.id), worldRegion);
  if (!invite) {
    throw new GameRuleError('Pozvanka nebyla nalezena nebo uz neni aktivni.', 404);
  }

  const respondedAt = nowIso();
  updateKingdomInviteStatusByIdStmt.run('rejected', respondedAt, inviteId, worldRegion);
  createKingdomEvent({
    region: worldRegion,
    kingdom: String(invite.kingdom),
    eventType: 'invite_rejected',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(invite.inviterPlayerId),
    payload: { inviteId },
  });
  createPlayerNotification({
    playerId: Number(player.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_invite_rejected',
    severity: 'info',
    title: `Pozvánka odmítnuta: ${String(invite.kingdom)}`,
    summary: `Odmítl jsi pozvánku do království ${String(invite.kingdom)}.`,
    payload: { inviteId, kingdom: String(invite.kingdom) },
    sourceType: 'kingdom_invite',
    sourceId: inviteId,
    createdAt: respondedAt,
  });
  createPlayerNotification({
    playerId: Number(invite.inviterPlayerId),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_invite_declined_by_target',
    severity: 'warning',
    title: `Pozvánka odmítnuta: ${player.username}`,
    summary: `${player.username} odmítl pozvánku do království ${String(invite.kingdom)}.`,
    payload: { inviteId, kingdom: String(invite.kingdom), actorUsername: player.username },
    sourceType: 'kingdom_invite',
    sourceId: inviteId,
    createdAt: respondedAt,
  });
  return {
    inviteId,
    kingdom: String(invite.kingdom),
    rejectedAt: respondedAt,
  };
});

const leaveKingdomTransaction = db.transaction((username, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = Number(village.region);
  const currentKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  if (isNeutralKingdom(currentKingdom)) {
    throw new GameRuleError('Nejsi clenem zadneho kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run('Neutral', Number(player.id), worldRegion);
  const respondedAt = nowIso();
  cancelPendingKingdomInvitesByInviterStmt.run(respondedAt, Number(player.id), worldRegion);
  createKingdomEvent({
    region: worldRegion,
    kingdom: currentKingdom,
    eventType: 'member_left',
    actorPlayerId: Number(player.id),
  });
  createPlayerNotification({
    playerId: Number(player.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_member_left',
    severity: 'warning',
    title: `Opuštěné království: ${currentKingdom}`,
    summary: `Opustil jsi království ${currentKingdom}.`,
    payload: { kingdom: currentKingdom },
    sourceType: 'kingdom_event',
    sourceId: null,
    createdAt: respondedAt,
  });

  return {
    username: player.username,
    previousKingdom: currentKingdom,
    leftAt: respondedAt,
  };
});

const kickKingdomMemberTransaction = db.transaction((username, targetUsernameRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = Number(village.region);
  const managerKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  requireKingdomLeadership(player, managerKingdom, worldRegion);

  const targetUsername = normalizeUsername(targetUsernameRaw);
  if (!targetUsername) {
    throw new GameRuleError("Pole 'targetUsername' je povinne.");
  }

  const targetPlayer = selectNonBotPlayerByUsernameStmt.get(targetUsername);
  if (!targetPlayer) {
    throw new GameRuleError(`Hrac '${targetUsername}' neexistuje.`, 404);
  }
  if (Number(targetPlayer.id) === Number(player.id)) {
    throw new GameRuleError('Pro odchod pouzij akci Odejit z kralovstvi.', 400);
  }

  const targetKingdom = resolvePrimaryKingdomByPlayerId(Number(targetPlayer.id), worldRegion);
  if (String(targetKingdom) !== String(managerKingdom)) {
    throw new GameRuleError('Cilovy hrac neni clenem tveho kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run('Neutral', Number(targetPlayer.id), worldRegion);
  const respondedAt = nowIso();
  rejectAllPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(targetPlayer.id), worldRegion);
  cancelPendingKingdomInvitesByInviterStmt.run(respondedAt, Number(targetPlayer.id), worldRegion);
  createKingdomEvent({
    region: worldRegion,
    kingdom: managerKingdom,
    eventType: 'member_kicked',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(targetPlayer.id),
  });
  createPlayerNotification({
    playerId: Number(player.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_member_kicked',
    severity: 'warning',
    title: `Člen odstraněn: ${String(targetPlayer.username)}`,
    summary: `Hráč ${String(targetPlayer.username)} byl odebrán z království ${managerKingdom}.`,
    payload: { kingdom: managerKingdom, targetUsername: String(targetPlayer.username) },
    sourceType: 'kingdom_event',
    sourceId: null,
    createdAt: respondedAt,
  });
  createPlayerNotification({
    playerId: Number(targetPlayer.id),
    region: worldRegion,
    category: 'kingdom',
    eventType: 'kingdom_removed_by_leader',
    severity: 'critical',
    title: `Byl jsi vyhozen z království ${managerKingdom}`,
    summary: `${player.username} tě vyřadil z království ${managerKingdom}.`,
    payload: { kingdom: managerKingdom, actorUsername: player.username },
    sourceType: 'kingdom_event',
    sourceId: null,
    createdAt: respondedAt,
  });

  return {
    kickedUsername: String(targetPlayer.username),
    kingdom: managerKingdom,
    kickedAt: respondedAt,
  };
});

const transferKingdomLeadershipTransaction = db.transaction(
  (username, targetUsernameRaw, requestedVillageId = null, worldId = null) => {
    const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
    const worldRegion = Number(village.region);
    const kingdomName = normalizeKingdomValue(village.kingdom) || 'Neutral';
    requireKingdomLeadership(player, kingdomName, worldRegion);

    const targetUsername = normalizeUsername(targetUsernameRaw);
    if (!targetUsername) {
      throw new GameRuleError("Pole 'targetUsername' je povinne.");
    }

    const targetPlayer = selectNonBotPlayerByUsernameStmt.get(targetUsername);
    if (!targetPlayer) {
      throw new GameRuleError(`Hrac '${targetUsername}' neexistuje.`, 404);
    }
    if (Number(targetPlayer.id) === Number(player.id)) {
      throw new GameRuleError('Kralovstvi uz vedes ty.', 400);
    }

    const targetKingdom = resolvePrimaryKingdomByPlayerId(Number(targetPlayer.id), worldRegion);
    if (normalizeKingdomComparable(targetKingdom) !== normalizeKingdomComparable(kingdomName)) {
      throw new GameRuleError('Cilovy hrac neni clenem tveho kralovstvi.', 400);
    }

    const transferredAt = nowIso();
    createKingdomEvent({
      region: worldRegion,
      kingdom: kingdomName,
      eventType: 'leadership_transferred',
      actorPlayerId: Number(player.id),
      targetPlayerId: Number(targetPlayer.id),
      payload: {
        previousLeaderPlayerId: Number(player.id),
        previousLeaderUsername: String(player.username),
        newLeaderPlayerId: Number(targetPlayer.id),
        newLeaderUsername: String(targetPlayer.username),
      },
    });
    createPlayerNotification({
      playerId: Number(player.id),
      region: worldRegion,
      category: 'kingdom',
      eventType: 'kingdom_leadership_transferred_out',
      severity: 'warning',
      title: 'Predal jsi titul Krale',
      summary: `Titul Krale v kralovstvi ${kingdomName} byl predan hraci ${String(targetPlayer.username)}.`,
      payload: { kingdom: kingdomName, targetUsername: String(targetPlayer.username) },
      sourceType: 'kingdom_event',
      sourceId: null,
      createdAt: transferredAt,
    });
    createPlayerNotification({
      playerId: Number(targetPlayer.id),
      region: worldRegion,
      category: 'kingdom',
      eventType: 'kingdom_leadership_transferred_in',
      severity: 'success',
      title: 'Byl ti predan titul Krale',
      summary: `${player.username} ti predal titul Krale v kralovstvi ${kingdomName}.`,
      payload: { kingdom: kingdomName, actorUsername: player.username },
      sourceType: 'kingdom_event',
      sourceId: null,
      createdAt: transferredAt,
    });

    return {
      kingdom: kingdomName,
      previousLeaderUsername: String(player.username),
      newLeaderUsername: String(targetPlayer.username),
      transferredAt,
    };
  },
);

export const createKingdom = (username, kingdomName, requestedVillageId = null, worldId = null) =>
  createKingdomTransaction(username, kingdomName, requestedVillageId, worldId);

export const invitePlayerToKingdom = (username, targetUsername, requestedVillageId = null, worldId = null) =>
  invitePlayerToKingdomTransaction(username, targetUsername, requestedVillageId, worldId);

export const acceptKingdomInvite = (username, inviteId, requestedVillageId = null, worldId = null) =>
  acceptKingdomInviteTransaction(username, inviteId, requestedVillageId, worldId);

export const rejectKingdomInvite = (username, inviteId, requestedVillageId = null, worldId = null) =>
  rejectKingdomInviteTransaction(username, inviteId, requestedVillageId, worldId);

export const leaveKingdom = (username, requestedVillageId = null, worldId = null) =>
  leaveKingdomTransaction(username, requestedVillageId, worldId);

export const kickKingdomMember = (username, targetUsername, requestedVillageId = null, worldId = null) =>
  kickKingdomMemberTransaction(username, targetUsername, requestedVillageId, worldId);

export const transferKingdomLeadership = (username, targetUsername, requestedVillageId = null, worldId = null) =>
  transferKingdomLeadershipTransaction(username, targetUsername, requestedVillageId, worldId);

const recruitTransaction = db.transaction((username, unitId, amount, requestedVillageId, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const unitDef = UNIT_DEFS[unitId];
  if (!unitDef) {
    throw new GameRuleError('Neznama jednotka.');
  }
  if (unitDef.isRecruitable === false) {
    throw new GameRuleError('Tuto jednotku nelze naverbovat bez specialniho kontraktu.');
  }

  const recruitAmount = requirePositiveInteger(amount, 'amount');
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(village.id));
  const resources = synchronizeVillageEconomyAt(Number(village.id));
  if (!resources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }

  const requiredBuildingLevel = Math.max(1, Math.floor(Number(unitDef.requiredBuildingLevel ?? 1)));
  const currentBuildingLevel = buildingLevels[unitDef.requiredBuilding] ?? 0;
  if (currentBuildingLevel < requiredBuildingLevel) {
    if (requiredBuildingLevel <= 1) {
      throw new GameRuleError(`Pro nabor chybi budova ${BUILDING_DEFS[unitDef.requiredBuilding].name}.`);
    }
    throw new GameRuleError(
      `Pro nabor je potreba ${BUILDING_DEFS[unitDef.requiredBuilding].name} na urovni ${requiredBuildingLevel}.`,
    );
  }

  const currentAmount = unitCounts[unitId] ?? 0;
  const activeRecruitments = selectActiveRecruitmentsByVillageStmt.all(village.id);
  const queuedCountForUnit = activeRecruitments
    .filter((recruitment) => recruitment.unitId === unitId)
    .reduce((sum, recruitment) => sum + Number(recruitment.amount), 0);
  const academicCount = Math.max(
    0,
    Math.floor(Number(countActiveAcademicsByVillageStmt.get(Number(village.id))?.total ?? 0)),
  );
  const awayUnitCounts = getVillageAwayUnitCounts(Number(village.id));
  const populationStatus = getVillagePopulationStatus(Number(village.id), {
    buildingLevels,
    unitCounts,
    awayUnitCounts,
    academicCount,
  });
  const populationCap = Number(populationStatus.populationCap ?? 0);
  const populationUsed = Number(populationStatus.populationUsed ?? 0);
  const reservedPopulationForRecruitment = calculateReservedPopulationForRecruitments(activeRecruitments);
  const availablePopulationForRecruitment = calculateAvailablePopulationForRecruitment(
    populationCap,
    populationUsed,
    reservedPopulationForRecruitment,
  );
  const unitPopulationCost = getUnitPopulationCost(unitId);
  const maxByPopulation = Math.max(0, Math.floor(availablePopulationForRecruitment / unitPopulationCost));

  if (unitId === KNIGHT_UNIT_ID && recruitAmount !== 1) {
    throw new GameRuleError('Rytire lze svolat pouze po jednom.');
  }

  const requiredResearchId = UNIT_RESEARCH_REQUIREMENTS[unitId] ?? null;
  if (requiredResearchId) {
    const researchRows = ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(village.region));
    if (!isResearchCompleted(researchRows, requiredResearchId)) {
      const researchName = getResearchDefinition(requiredResearchId)?.name ?? requiredResearchId;
      throw new GameRuleError(`Pro nabor jednotky je potreba dokoncit vyzkum '${researchName}'.`);
    }
  }

  if (unitId === KNIGHT_UNIT_ID) {
    const currentKnightInVillage = Math.max(0, Math.floor(Number(unitCounts[KNIGHT_UNIT_ID] ?? 0)));
    const queuedKnightInVillage = activeRecruitments
      .filter((recruitment) => String(recruitment.unitId) === KNIGHT_UNIT_ID)
      .reduce((sum, recruitment) => sum + Math.max(0, Math.floor(Number(recruitment.amount ?? 0))), 0);
    if (currentKnightInVillage + queuedKnightInVillage >= 1) {
      throw new GameRuleError('V teto osade uz je rytir nebo je ve vycviku.', 400);
    }
    const knightCapacity = getPlayerKnightCapacity(Number(player.id), Number(village.region));
    const playerKnightTotal = getPlayerKnightTotalInWorld(Number(player.id), Number(village.region));
    if (playerKnightTotal >= knightCapacity) {
      throw new GameRuleError('Limit rytiru podle poctu osad v tomto svete je vycerpan.');
    }
  }

  if (maxByPopulation <= 0) {
    throw new GameRuleError('Nedostatek volne populace pro nabor.');
  }

  if (recruitAmount > maxByPopulation) {
    throw new GameRuleError(
      `Lze naverbovat maximalne ${maxByPopulation} jednotek podle volne populace.`,
    );
  }

  const pocket = {
    wood: Number(resources.wood),
    stone: Number(resources.stone),
    iron: Number(resources.iron),
  };
  const maxByResources = calculateMaxRecruitableByResources(pocket, unitDef.cost);
  if (maxByResources <= 0) {
    throw new GameRuleError('Nedostatek surovin pro nabor.');
  }
  if (recruitAmount > maxByResources) {
    throw new GameRuleError(`Lze naverbovat maximalne ${maxByResources} ks teto jednotky podle surovin.`);
  }

  const totalCost = {
    wood: unitDef.cost.wood * recruitAmount,
    stone: unitDef.cost.stone * recruitAmount,
    iron: unitDef.cost.iron * recruitAmount,
  };

  if (!canAfford(pocket, totalCost)) {
    throw new GameRuleError('Nedostatek surovin pro nabor.');
  }

  updateResourcesAfterSpendStmt.run(
    roundResource(pocket.wood - totalCost.wood),
    roundResource(pocket.stone - totalCost.stone),
    roundResource(pocket.iron - totalCost.iron),
    roundResource(Number(resources.gold ?? 0)),
    roundResource(Number(resources.coins ?? 0)),
    nowIso(),
    village.id,
  );
  const startedAtIso = nowIso();
  const calculatedDurationSec = calculateRecruitDurationSec(unitId, recruitAmount, currentBuildingLevel);
  const durationSec = Math.max(1, Math.floor(Number(calculatedDurationSec ?? 0)));
  const finishAtIso = new Date(Date.parse(startedAtIso) + durationSec * 1000).toISOString();

  const insertion = insertRecruitmentStmt.run(
    village.id,
    unitId,
    recruitAmount,
    totalCost.wood,
    totalCost.stone,
    totalCost.iron,
    startedAtIso,
    finishAtIso,
  );

  return {
    unitId,
    queuedAmount: recruitAmount,
    currentAmount,
    queuedTotal: queuedCountForUnit + recruitAmount,
    orderId: Number(insertion.lastInsertRowid),
    totalCost,
    durationSec,
    finishAt: finishAtIso,
  };
});

const cancelRecruitmentTransaction = db.transaction((username, recruitmentIdRaw, requestedVillageId, worldId = null) => {
  const { village } = requireVillageForUser(username, requestedVillageId, worldId);
  const recruitmentId = requirePositiveInteger(recruitmentIdRaw, 'recruitmentId');
  const recruitment = selectActiveRecruitmentByIdForVillageStmt.get(
    recruitmentId,
    Number(village.id),
  );
  if (!recruitment) {
    throw new GameRuleError('Nabor nebyl nalezen nebo uz neni aktivni.', 404);
  }

  deleteActiveRecruitmentByIdStmt.run(Number(recruitment.id), Number(village.id));
  const refunded = {
    wood: Math.max(0, Math.floor(Number(recruitment.woodCost ?? 0))),
    stone: Math.max(0, Math.floor(Number(recruitment.stoneCost ?? 0))),
    iron: Math.max(0, Math.floor(Number(recruitment.ironCost ?? 0))),
  };
  addResourcesWithoutCap(Number(village.id), refunded);

  return {
    canceledRecruitmentId: Number(recruitment.id),
    unitId: String(recruitment.unitId),
    amount: Math.max(0, Math.floor(Number(recruitment.amount ?? 0))),
    refunded,
  };
});

const recallKnightTransaction = db.transaction((username, requestedVillageId, worldId = null) => {
  const { village } = requireVillageForUser(username, requestedVillageId, worldId);
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(village.id)));
  if (Number(buildingLevels.townhall ?? 0) < 1) {
    throw new GameRuleError('Pro odvolani rytire chybi Radnice.', 400);
  }

  const unitRow = selectUnitAmountByVillageAndUnitStmt.get(Number(village.id), KNIGHT_UNIT_ID);
  const knightAmount = Math.max(0, Math.floor(Number(unitRow?.amount ?? 0)));
  if (knightAmount <= 0) {
    throw new GameRuleError('V teto osade neni zadny rytir k odvolani.', 400);
  }

  updateUnitAmountStmt.run(knightAmount - 1, Number(village.id), KNIGHT_UNIT_ID);
  const refunded = {
    wood: Number(KNIGHT_RECALL_REFUND.wood),
    stone: Number(KNIGHT_RECALL_REFUND.stone),
    iron: Number(KNIGHT_RECALL_REFUND.iron),
  };
  addResourcesWithoutCap(Number(village.id), refunded);
  updateVillagePrestigeFromCurrentState(Number(village.id));

  return {
    villageId: Number(village.id),
    unitId: KNIGHT_UNIT_ID,
    recalled: 1,
    refunded,
  };
});

const hireAcademicsTransaction = db.transaction((username, amountRaw, requestedVillageId, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const hireAmountRequested = requirePositiveInteger(amountRaw, 'amount');
  const selectedVillageBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(village.id)));
  const selectedVillageUniversityLevel = Math.max(0, Math.floor(Number(selectedVillageBuildingLevels.university ?? 0)));
  const villagesInRegion = selectVillagesByPlayerAndRegionStmt.all(Number(player.id), Number(village.region));
  if (!Array.isArray(villagesInRegion) || villagesInRegion.length <= 0) {
    throw new GameRuleError('Hrac nema v regionu zadne osady pro najem akademiku.', 400);
  }

  const orderedVillages = [...villagesInRegion].sort((left, right) => {
    if (Number(left.id) === Number(village.id)) {
      return -1;
    }
    if (Number(right.id) === Number(village.id)) {
      return 1;
    }
    return Number(left.id) - Number(right.id);
  });
  let regionUniversityCapacity = 0;
  const hireCandidates = [];

  for (const candidateVillage of orderedVillages) {
    const candidateVillageId = Number(candidateVillage.id);
    if (!Number.isFinite(candidateVillageId) || candidateVillageId <= 0) {
      continue;
    }
    const candidateBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(candidateVillageId));
    const candidateVillageCapacity = getVillageUniversityCapacity(candidateBuildingLevels);
    regionUniversityCapacity += candidateVillageCapacity;
    if (candidateVillageCapacity <= 0) {
      continue;
    }

    const activeInCandidateVillage = Math.max(
      0,
      Math.floor(Number(countActiveAcademicsByVillageStmt.get(candidateVillageId)?.total ?? 0)),
    );
    const freeUniversitySlots = Math.max(0, candidateVillageCapacity - activeInCandidateVillage);
    if (freeUniversitySlots <= 0) {
      continue;
    }

    const candidatePopulation = getVillagePopulationStatus(candidateVillageId);
    const freePopulationSlots = Math.max(
      0,
      Math.floor(Number(candidatePopulation.availablePopulation ?? 0) / ACADEMIC_POPULATION_COST),
    );
    const hireableSlots = Math.max(0, Math.min(freeUniversitySlots, freePopulationSlots));
    if (hireableSlots <= 0) {
      continue;
    }

    hireCandidates.push({
      villageId: candidateVillageId,
      slots: hireableSlots,
    });
  }

  if (regionUniversityCapacity <= 0) {
    throw new GameRuleError('Pro najem akademiku je potreba Univerzita alespon na urovni 1 v nekterem z tvych len.', 400);
  }

  const regionAvailableSlots = hireCandidates.reduce((sum, candidate) => sum + Number(candidate.slots), 0);
  if (regionAvailableSlots <= 0) {
    throw new GameRuleError('Kapacita akademiku je v regionu vycerpana nebo chybi volna populace.', 400);
  }

  const hireAmount = Math.min(hireAmountRequested, regionAvailableSlots);
  if (hireAmount <= 0) {
    throw new GameRuleError('Neni dostupny zadny slot pro akademika.', 400);
  }

  const resources = synchronizeVillageEconomyAt(Number(village.id));
  if (!resources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }
  const totalCoinCost = hireAmount * ACADEMIC_COST_COINS;
  const currentCoins = Math.max(0, Number(resources.coins ?? 0));
  if (currentCoins < totalCoinCost) {
    throw new GameRuleError(`Nedostatek minci. Potrebujes ${totalCoinCost.toLocaleString('cs-CZ')} minci.`, 400);
  }

  updateResourcesAfterSpendStmt.run(
    roundResource(Number(resources.wood ?? 0)),
    roundResource(Number(resources.stone ?? 0)),
    roundResource(Number(resources.iron ?? 0)),
    roundResource(Number(resources.gold ?? 0)),
    roundResource(currentCoins - totalCoinCost),
    nowIso(),
    Number(village.id),
  );

  const hiredAtIso = nowIso();
  let remainingToHire = hireAmount;
  for (const candidate of hireCandidates) {
    if (remainingToHire <= 0) {
      break;
    }
    const assignAmount = Math.min(remainingToHire, Number(candidate.slots));
    for (let index = 0; index < assignAmount; index += 1) {
      insertAcademicStmt.run(Number(player.id), Number(candidate.villageId), Number(village.region), hiredAtIso);
    }
    remainingToHire -= assignAmount;
  }

  if (remainingToHire > 0) {
    throw new GameRuleError('Nepodarilo se rozmistit vsechny akademiky do dostupnych len.', 500);
  }

  return {
    hired: hireAmount,
    villageId: Number(village.id),
    universityLevel: selectedVillageUniversityLevel,
    totalCoinCost,
    hiredAt: hiredAtIso,
  };
});

const startResearchProjectTransaction = db.transaction(
  (username, researchIdRaw, requestedAcademicsRaw, requestedVillageId, worldId = null) => {
    const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
    const researchId = String(researchIdRaw ?? '').trim();
    const definition = getResearchDefinition(researchId);
    if (!definition) {
      throw new GameRuleError('Neznamy vyzkumny projekt.', 404);
    }

    const nowTimeIso = nowIso();
    ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(village.region), nowTimeIso);
    const currentRow =
      selectResearchProgressByPlayerRegionAndResearchStmt.get(Number(player.id), Number(village.region), researchId) ??
      null;
    if (String(currentRow?.status ?? '') === 'completed') {
      throw new GameRuleError('Tento vyzkum uz byl dokoncen.', 400);
    }

    const requestedAcademics = Math.max(
      1,
      Math.min(MAX_ACADEMICS_PER_RESEARCH, Math.floor(Number(requestedAcademicsRaw ?? 1))),
    );
    const idleAcademics = Math.max(
      0,
      Math.floor(Number(countIdleAcademicsByPlayerRegionStmt.get(Number(player.id), Number(village.region))?.total ?? 0)),
    );
    const currentAssignedAcademics = Math.max(
      0,
      Math.floor(
        Number(
          countAssignedAcademicsForResearchByPlayerRegionStmt.get(
            Number(player.id),
            Number(village.region),
            researchId,
          )?.total ?? 0,
        ),
      ),
    );
    const freeProjectSlots = Math.max(0, MAX_ACADEMICS_PER_RESEARCH - currentAssignedAcademics);
    const desiredAssignedAcademics = Math.min(requestedAcademics, freeProjectSlots);
    if (desiredAssignedAcademics <= 0) {
      throw new GameRuleError('Projekt uz dosahl maximalniho poctu akademiku.', 400);
    }
    let assignedAcademics = Math.min(desiredAssignedAcademics, idleAcademics);
    let reassignedAcademics = 0;

    if (assignedAcademics < desiredAssignedAcademics) {
      let academicsStillNeeded = desiredAssignedAcademics - assignedAcademics;
      const donorRows = selectResearchingProjectsByPlayerRegionStmt
        .all(Number(player.id), Number(village.region))
        .filter((row) => {
          const donorResearchId = String(row?.researchId ?? '').trim();
          return donorResearchId.length > 0 && donorResearchId !== researchId;
        });

      for (const donorRow of donorRows) {
        if (academicsStillNeeded <= 0) {
          break;
        }
        const donorResearchId = String(donorRow.researchId);
        const donorAssignedAcademics = Math.max(
          0,
          Math.floor(
            Number(
              countAssignedAcademicsForResearchByPlayerRegionStmt.get(
                Number(player.id),
                Number(village.region),
                donorResearchId,
              )?.total ?? 0,
            ),
          ),
        );
        // Keep at least one academic on donor projects so running research does not hard-stop.
        const donorReleasableAcademics = Math.max(0, donorAssignedAcademics - 1);
        if (donorReleasableAcademics <= 0) {
          continue;
        }
        const transferredAcademics = Math.min(academicsStillNeeded, donorReleasableAcademics);
        if (transferredAcademics <= 0) {
          continue;
        }
        releaseAcademicAssignmentByResearchForPlayerRegionStmt.run(
          Number(player.id),
          Number(village.region),
          donorResearchId,
          transferredAcademics,
        );

        const donorAssignedAfterTransfer = donorAssignedAcademics - transferredAcademics;
        const donorStartedAt = donorRow?.startedAt ? String(donorRow.startedAt) : nowTimeIso;
        upsertResearchProgressStmt.run(
          Number(player.id),
          Number(village.region),
          donorResearchId,
          'researching',
          Math.max(0, Number(donorRow?.progress ?? 0)),
          donorAssignedAfterTransfer,
          donorStartedAt,
          null,
          nowTimeIso,
        );

        academicsStillNeeded -= transferredAcademics;
        reassignedAcademics += transferredAcademics;
      }

      assignedAcademics = Math.min(desiredAssignedAcademics, idleAcademics + reassignedAcademics);
    }

    if (assignedAcademics <= 0) {
      throw new GameRuleError('Pro zahajeni vyzkumu chybi volni akademici.', 400);
    }

    const shouldPayCoins =
      Math.max(0, Number(currentRow?.progress ?? 0)) <= 0 &&
      String(currentRow?.status ?? '') !== 'researching' &&
      String(currentRow?.status ?? '') !== 'completed';
    const resources = synchronizeVillageEconomyAt(Number(village.id));
    if (!resources) {
      throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
    }
    const currentCoins = Math.max(0, Number(resources.coins ?? 0));
    const coinCost = shouldPayCoins ? Math.max(0, Number(definition.coinCost ?? 0)) : 0;
    if (coinCost > 0 && currentCoins < coinCost) {
      throw new GameRuleError(`Nedostatek minci pro vyzkum '${definition.name}'.`, 400);
    }

    if (coinCost > 0) {
      updateResourcesAfterSpendStmt.run(
        roundResource(Number(resources.wood ?? 0)),
        roundResource(Number(resources.stone ?? 0)),
        roundResource(Number(resources.iron ?? 0)),
        roundResource(Number(resources.gold ?? 0)),
        roundResource(currentCoins - coinCost),
        nowTimeIso,
        Number(village.id),
      );
    }

    updateAcademicAssignmentByPlayerRegionStmt.run(
      'assigned',
      researchId,
      Number(player.id),
      Number(village.region),
      assignedAcademics,
    );
    const updatedAssignedAcademics = currentAssignedAcademics + assignedAcademics;
    const startedAtIso = currentRow?.startedAt ? String(currentRow.startedAt) : nowTimeIso;

    upsertResearchProgressStmt.run(
      Number(player.id),
      Number(village.region),
      researchId,
      'researching',
      Math.max(0, Number(currentRow?.progress ?? 0)),
      updatedAssignedAcademics,
      startedAtIso,
      null,
      nowTimeIso,
    );

    return {
      researchId,
      researchName: String(definition.name),
      assignedAcademics: updatedAssignedAcademics,
      coinCostPaid: coinCost,
      startedAt: startedAtIso,
    };
  },
);

const adjustResearchProjectAcademicsTransaction = db.transaction(
  (username, researchIdRaw, deltaRaw, requestedVillageId, worldId = null) => {
    const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
    const researchId = String(researchIdRaw ?? '').trim();
    const definition = getResearchDefinition(researchId);
    if (!definition) {
      throw new GameRuleError('Neznamy vyzkumny projekt.', 404);
    }

    const nowTimeIso = nowIso();
    ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(village.region), nowTimeIso);

    const currentRow =
      selectResearchProgressByPlayerRegionAndResearchStmt.get(Number(player.id), Number(village.region), researchId) ?? null;
    if (!currentRow || String(currentRow.status ?? '') !== 'researching') {
      throw new GameRuleError('Vybrany projekt momentalne neni ve stavu vyzkumu.', 400);
    }

    const requestedDelta = Math.trunc(Number(deltaRaw ?? 0));
    if (!Number.isFinite(requestedDelta) || requestedDelta === 0) {
      throw new GameRuleError('Pole delta musi byt cele cislo ruzne od nuly.', 400);
    }

    const currentAssignedAcademics = Math.max(
      0,
      Math.floor(
        Number(
          countAssignedAcademicsForResearchByPlayerRegionStmt.get(
            Number(player.id),
            Number(village.region),
            researchId,
          )?.total ?? 0,
        ),
      ),
    );

    let deltaApplied = 0;
    if (requestedDelta > 0) {
      const idleAcademics = Math.max(
        0,
        Math.floor(Number(countIdleAcademicsByPlayerRegionStmt.get(Number(player.id), Number(village.region))?.total ?? 0)),
      );
      const freeProjectSlots = Math.max(0, MAX_ACADEMICS_PER_RESEARCH - currentAssignedAcademics);
      const assignable = Math.max(0, Math.min(requestedDelta, idleAcademics, freeProjectSlots));
      if (assignable <= 0) {
        if (currentAssignedAcademics >= MAX_ACADEMICS_PER_RESEARCH) {
          throw new GameRuleError('Projekt uz dosahl maximalniho poctu akademiku.', 400);
        }
        throw new GameRuleError('V regionu nejsou dostupni volni akademici.', 400);
      }
      updateAcademicAssignmentByPlayerRegionStmt.run(
        'assigned',
        researchId,
        Number(player.id),
        Number(village.region),
        assignable,
      );
      deltaApplied = assignable;
    } else {
      const releasable = Math.max(0, Math.min(Math.abs(requestedDelta), currentAssignedAcademics));
      if (releasable <= 0) {
        throw new GameRuleError('V projektu nejsou zadni akademici k odebrani.', 400);
      }
      releaseAcademicAssignmentByResearchForPlayerRegionStmt.run(
        Number(player.id),
        Number(village.region),
        researchId,
        releasable,
      );
      deltaApplied = -releasable;
    }

    const updatedAssignedAcademics = Math.max(
      0,
      Math.floor(
        Number(
          countAssignedAcademicsForResearchByPlayerRegionStmt.get(
            Number(player.id),
            Number(village.region),
            researchId,
          )?.total ?? 0,
        ),
      ),
    );
    const startedAtIso = currentRow?.startedAt ? String(currentRow.startedAt) : nowTimeIso;
    upsertResearchProgressStmt.run(
      Number(player.id),
      Number(village.region),
      researchId,
      'researching',
      Math.max(0, Number(currentRow?.progress ?? 0)),
      updatedAssignedAcademics,
      startedAtIso,
      null,
      nowTimeIso,
    );

    return {
      researchId,
      researchName: String(definition.name),
      deltaApplied,
      assignedAcademics: updatedAssignedAcademics,
      updatedAt: nowTimeIso,
    };
  },
);

const hireMercenaryContractTransaction = db.transaction((username, requestedVillageId, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const nowTimeIso = nowIso();
  const researchRows = ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(village.region), nowTimeIso);
  if (!isResearchCompleted(researchRows, 'verven-bank')) {
    throw new GameRuleError("Pro nájem žoldáků je potřeba výzkum 'Vervenská zlatá banka'.", 400);
  }

  const latestContract = selectLatestMercenaryContractByPlayerRegionStmt.get(Number(player.id), Number(village.region));
  const cooldownRemainingSec = getMercenaryCooldownRemainingSec(latestContract, nowTimeIso);
  if (cooldownRemainingSec > 0) {
    throw new GameRuleError(
      `Zoldaky lze najmout znovu za ${formatRemaining(cooldownRemainingSec)}.`,
      400,
    );
  }

  const resources = synchronizeVillageEconomyAt(Number(village.id));
  if (!resources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }
  const currentCoins = Math.max(0, Number(resources.coins ?? 0));
  if (currentCoins < MERCENARY_CONTRACT_COST_COINS) {
    throw new GameRuleError(
      `Nedostatek minci. Kontrakt vyzaduje ${MERCENARY_CONTRACT_COST_COINS.toLocaleString('cs-CZ')} minci.`,
      400,
    );
  }

  updateResourcesAfterSpendStmt.run(
    roundResource(Number(resources.wood ?? 0)),
    roundResource(Number(resources.stone ?? 0)),
    roundResource(Number(resources.iron ?? 0)),
    roundResource(Number(resources.gold ?? 0)),
    roundResource(currentCoins - MERCENARY_CONTRACT_COST_COINS),
    nowTimeIso,
    Number(village.id),
  );

  const orderedAtIso = nowTimeIso;
  const arriveAtIso = new Date(Date.parse(orderedAtIso) + MERCENARY_DELIVERY_DELAY_MINUTES * 60 * 1000).toISOString();
  const expiresAtIso = new Date(Date.parse(arriveAtIso) + MERCENARY_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  const insertion = insertMercenaryContractStmt.run(
    Number(player.id),
    Number(village.id),
    Number(village.region),
    'en_route',
    orderedAtIso,
    arriveAtIso,
    expiresAtIso,
    MERCENARY_CONTRACT_UNIT_AMOUNT,
  );

  return {
    contractId: Number(insertion.lastInsertRowid),
    villageId: Number(village.id),
    villageName: String(village.name ?? `Leno #${Number(village.id)}`),
    orderedAt: orderedAtIso,
    arriveAt: arriveAtIso,
    expiresAt: expiresAtIso,
    unitAmount: MERCENARY_CONTRACT_UNIT_AMOUNT,
    cooldownHours: MERCENARY_CONTRACT_COOLDOWN_HOURS,
  };
});

const normalizeMarketGuildTargetVillageIds = (targetVillageIdsRaw) => {
  if (!Array.isArray(targetVillageIdsRaw)) {
    return null;
  }
  const normalized = [];
  const seen = new Set();
  for (const entry of targetVillageIdsRaw) {
    const villageId = Number(entry);
    if (!Number.isFinite(villageId) || villageId <= 0) {
      continue;
    }
    const key = String(Math.floor(villageId));
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(Number(Math.floor(villageId)));
  }
  return normalized;
};

const clampMarketGuildShipmentToCapacity = (payloadRaw, capacityRaw) => {
  const capacity = Math.max(0, Math.floor(Number(capacityRaw ?? 0)));
  const base = {
    wood: Math.max(0, Math.floor(Number(payloadRaw?.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(payloadRaw?.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(payloadRaw?.iron ?? 0))),
  };
  const total = base.wood + base.stone + base.iron;
  if (capacity <= 0 || total <= 0) {
    return { wood: 0, stone: 0, iron: 0, total: 0 };
  }
  if (total <= capacity) {
    return { ...base, total };
  }

  const ratio = capacity / total;
  const scaled = {
    wood: Math.floor(base.wood * ratio),
    stone: Math.floor(base.stone * ratio),
    iron: Math.floor(base.iron * ratio),
  };
  let scaledTotal = scaled.wood + scaled.stone + scaled.iron;
  let remainder = Math.max(0, capacity - scaledTotal);
  if (remainder > 0) {
    const order = ['wood', 'stone', 'iron'].sort((left, right) => base[right] - base[left]);
    while (remainder > 0) {
      let changed = false;
      for (const resourceId of order) {
        if (remainder <= 0) {
          break;
        }
        if (scaled[resourceId] >= base[resourceId]) {
          continue;
        }
        scaled[resourceId] += 1;
        remainder -= 1;
        changed = true;
      }
      if (!changed) {
        break;
      }
    }
    scaledTotal = scaled.wood + scaled.stone + scaled.iron;
  }
  return {
    wood: Math.max(0, scaled.wood),
    stone: Math.max(0, scaled.stone),
    iron: Math.max(0, scaled.iron),
    total: Math.max(0, scaledTotal),
  };
};

export const getWorldMapSnapshot = (
  username = 'Hayato',
  requestedVillageId = null,
  worldId = null,
  spawnDirectionRaw = 'center',
) => {
  const snapshotIso = nowIso();
  const { player, village, world } = requireVillageForUser(
    username,
    requestedVillageId,
    worldId,
    spawnDirectionRaw,
    { syncEconomy: false },
  );
  return {
    serverTime: snapshotIso,
    world: buildWorldMapReadModel({
      player,
      village,
      world,
      referenceIso: snapshotIso,
    }),
  };
};

const resolveMarketGuildAutoShipment = ({
  sourceResources,
  sourceCap,
  targetResources,
  targetCap,
  routeCapacity,
}) => {
  const normalizedSource = toNonNegativeResourcePocket(sourceResources);
  const normalizedTarget = toNonNegativeResourcePocket(targetResources);
  const sourceCapSafe = Math.max(1, Math.floor(Number(sourceCap ?? 0)));
  const targetCapSafe = Math.max(1, Math.floor(Number(targetCap ?? 0)));
  const routeCapacitySafe = Math.max(0, Math.floor(Number(routeCapacity ?? 0)));
  const sourceTotal = normalizedSource.wood + normalizedSource.stone + normalizedSource.iron;
  const targetTotal = normalizedTarget.wood + normalizedTarget.stone + normalizedTarget.iron;
  const sourceFill = Math.max(0, Math.min(1, sourceTotal / Math.max(1, sourceCapSafe * 3)));
  const targetFill = Math.max(0, Math.min(1, targetTotal / Math.max(1, targetCapSafe * 3)));
  const fillGap = sourceFill - targetFill;
  const emptyShipment = {
    wood: 0,
    stone: 0,
    iron: 0,
    total: 0,
  };

  if (routeCapacitySafe <= 0) {
    return {
      shipment: emptyShipment,
      reasonCode: 'route_capacity_zero',
      metrics: {
        sourceFillPct: Number((sourceFill * 100).toFixed(1)),
        targetFillPct: Number((targetFill * 100).toFixed(1)),
      },
    };
  }

  if (sourceFill < 0.7) {
    return {
      shipment: emptyShipment,
      reasonCode: 'source_fill_too_low',
      metrics: {
        sourceFillPct: Number((sourceFill * 100).toFixed(1)),
        targetFillPct: Number((targetFill * 100).toFixed(1)),
      },
    };
  }

  if (fillGap < 0.06) {
    return {
      shipment: emptyShipment,
      reasonCode: 'fill_gap_too_small',
      metrics: {
        sourceFillPct: Number((sourceFill * 100).toFixed(1)),
        targetFillPct: Number((targetFill * 100).toFixed(1)),
      },
    };
  }

  const sourceReservePct = Math.max(0.45, Math.min(0.82, 0.72 - Math.max(0, sourceFill - 0.7) * 0.55));
  const targetGoalPct = Math.max(0.55, Math.min(0.86, Math.min(0.82, sourceFill - 0.06)));
  const draft = { wood: 0, stone: 0, iron: 0 };
  for (const resourceId of ['wood', 'stone', 'iron']) {
    const sourceReserve = Math.max(0, Math.floor(sourceCapSafe * sourceReservePct));
    const targetGoal = Math.max(0, Math.floor(targetCapSafe * targetGoalPct));
    const available = Math.max(0, Number(normalizedSource[resourceId] ?? 0) - sourceReserve);
    const needed = Math.max(0, targetGoal - Number(normalizedTarget[resourceId] ?? 0));
    draft[resourceId] = Math.max(0, Math.floor(Math.min(available, needed)));
  }
  const hasSourceSurplus = Object.values(draft).some((value) => Number(value) > 0);
  if (!hasSourceSurplus) {
    return {
      shipment: emptyShipment,
      reasonCode: 'no_target_need_or_surplus',
      metrics: {
        sourceFillPct: Number((sourceFill * 100).toFixed(1)),
        targetFillPct: Number((targetFill * 100).toFixed(1)),
        sourceReservePct: Number((sourceReservePct * 100).toFixed(1)),
        targetGoalPct: Number((targetGoalPct * 100).toFixed(1)),
      },
    };
  }

  const shipment = clampMarketGuildShipmentToCapacity(draft, routeCapacitySafe);
  const minimumShipment = Math.max(250, Math.floor(Math.min(routeCapacitySafe * 0.08, 2000)));
  if (
    shipment.total > 0 &&
    shipment.total < minimumShipment &&
    !(targetFill < 0.4 && sourceFill > 0.9)
  ) {
    return {
      shipment: emptyShipment,
      reasonCode: 'shipment_below_minimum',
      metrics: {
        sourceFillPct: Number((sourceFill * 100).toFixed(1)),
        targetFillPct: Number((targetFill * 100).toFixed(1)),
        minimumShipment,
        computedShipment: shipment.total,
      },
    };
  }

  return {
    shipment,
    reasonCode: shipment.total > 0 ? 'ok' : 'shipment_zero',
    metrics: {
      sourceFillPct: Number((sourceFill * 100).toFixed(1)),
      targetFillPct: Number((targetFill * 100).toFixed(1)),
      fillGapPct: Number((fillGap * 100).toFixed(1)),
      sourceReservePct: Number((sourceReservePct * 100).toFixed(1)),
      targetGoalPct: Number((targetGoalPct * 100).toFixed(1)),
      minimumShipment,
    },
  };
};

const configureMarketGuildAutomationTransaction = db.transaction((username, payload, requestedVillageId, worldId = null) => {
  const { player, village, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const sourceVillageId = Number(village.id);
  const sourceBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(sourceVillageId));
  const sourceMarketLevel = Math.max(0, Math.floor(Number(sourceBuildingLevels.market ?? 0)));
  const researchRows = ensureResolvedResearchProgressForPlayerRegion(Number(player.id), Number(world.region));
  const completedResearchIds = buildCompletedResearchSet(researchRows);
  const guildUnlocked = isMarketGuildUnlocked(sourceMarketLevel, completedResearchIds);
  if (!guildUnlocked) {
    throw new GameRuleError(
      'Cech obchodniku vyzaduje Mestsky trh alespon na urovni 4 a vyzkum Vliv cechu.',
      400,
    );
  }

  const existingSetting = selectMarketGuildSettingBySourceVillageStmt.get(sourceVillageId) ?? null;
  const existingTargets = selectMarketGuildTargetsBySourceVillageStmt.all(sourceVillageId);
  const existingTargetIdSet = new Set(existingTargets.map((entry) => Number(entry.targetVillageId)));
  const existingPausedTargetIdSet = new Set(
    existingTargets
      .filter((entry) => Number(entry.isPaused ?? 0) === 1)
      .map((entry) => Number(entry.targetVillageId)),
  );
  const requestedTargets = normalizeMarketGuildTargetVillageIds(payload?.targetVillageIds);
  const requestedPausedTargets = normalizeMarketGuildTargetVillageIds(payload?.pausedTargetVillageIds);
  const nextTargetVillageIds =
    requestedTargets == null
      ? existingTargets.map((entry) => Number(entry.targetVillageId))
      : requestedTargets.filter((targetVillageId) => Number(targetVillageId) !== sourceVillageId);

  const validatedTargetVillageIds = [];
  const seen = new Set();
  for (const targetVillageId of nextTargetVillageIds) {
    const targetId = Number(targetVillageId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      continue;
    }
    if (seen.has(targetId)) {
      continue;
    }
    seen.add(targetId);

    if (!existingTargetIdSet.has(targetId)) {
      const targetVillage = selectVillageWithOwnerByIdStmt.get(targetId);
      if (!targetVillage) {
        continue;
      }
      const isOwnVillage =
        Number(targetVillage.playerId) === Number(player.id) && Number(targetVillage.region) === Number(world.region);
      if (!isOwnVillage) {
        throw new GameRuleError('Do Cechu lze pridat pouze tvoje lena v aktualnim svete.', 400);
      }
    }

    validatedTargetVillageIds.push(targetId);
  }
  const nextPausedTargetIdSet = new Set();
  if (requestedPausedTargets == null) {
    for (const targetVillageId of validatedTargetVillageIds) {
      if (existingPausedTargetIdSet.has(Number(targetVillageId))) {
        nextPausedTargetIdSet.add(Number(targetVillageId));
      }
    }
  } else {
    const requestedPausedSet = new Set(requestedPausedTargets.map((targetVillageId) => Number(targetVillageId)));
    for (const targetVillageId of validatedTargetVillageIds) {
      if (requestedPausedSet.has(Number(targetVillageId))) {
        nextPausedTargetIdSet.add(Number(targetVillageId));
      }
    }
  }

  const enabledRaw = payload?.enabled;
  const enabled =
    enabledRaw == null
      ? Boolean(existingSetting?.enabled ?? (validatedTargetVillageIds.length > 0 ? 1 : 0))
      : Boolean(enabledRaw);
  const cycleIntervalSec = MARKET_GUILD_CYCLE_INTERVAL_SEC;
  const nowTimeIso = nowIso();
  const currentCursor = Math.max(0, Math.floor(Number(existingSetting?.cursorIndex ?? 0)));
  const normalizedCursor =
    validatedTargetVillageIds.length <= 0 ? 0 : Math.min(currentCursor, validatedTargetVillageIds.length - 1);
  const nextDispatchAt =
    enabled && validatedTargetVillageIds.length > 0
      ? existingSetting?.nextDispatchAt
        ? String(existingSetting.nextDispatchAt)
        : alignMarketGuildDispatchToWindowIso(Date.now())
      : null;
  const lastDispatchAt = existingSetting?.lastDispatchAt ? String(existingSetting.lastDispatchAt) : null;

  upsertMarketGuildSettingStmt.run(
    sourceVillageId,
    Number(player.id),
    Number(world.region),
    enabled ? 1 : 0,
    cycleIntervalSec,
    normalizedCursor,
    nextDispatchAt,
    lastDispatchAt,
    nowTimeIso,
  );

  deleteMarketGuildTargetsBySourceVillageStmt.run(sourceVillageId);
  for (let index = 0; index < validatedTargetVillageIds.length; index += 1) {
    const targetVillageId = Number(validatedTargetVillageIds[index]);
    const isPaused = nextPausedTargetIdSet.has(targetVillageId) ? 1 : 0;
    insertMarketGuildTargetStmt.run(sourceVillageId, targetVillageId, index, isPaused, nowTimeIso);
  }

  return {
    sourceVillageId,
    enabled,
    targetCount: validatedTargetVillageIds.length,
    pausedTargetCount: nextPausedTargetIdSet.size,
    cycleIntervalSec,
    nextDispatchAt,
    updatedAt: nowTimeIso,
  };
});

const sendMarketLogisticsTransaction = db.transaction((username, payload, requestedVillageId, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const targetVillageId = requirePositiveInteger(payload?.targetVillageId, 'targetVillageId');
  const targetVillage = selectVillageByIdStmt.get(Number(targetVillageId));
  if (!targetVillage) {
    throw new GameRuleError('Cilove leno neexistuje.', 404);
  }
  if (Number(targetVillage.region) !== Number(village.region)) {
    throw new GameRuleError('Cilove leno je v jinem svete.', 400);
  }

  const resourcesToSend = {
    wood: Math.max(0, Math.floor(Number(payload?.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(payload?.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(payload?.iron ?? 0))),
  };
  const total = resourcesToSend.wood + resourcesToSend.stone + resourcesToSend.iron;
  if (total <= 0) {
    throw new GameRuleError('Vypln alespon jednu surovinu k odeslani.', 400);
  }

  const sourceBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(village.id)));
  const sourceMarketLevel = Math.max(0, Math.floor(Number(sourceBuildingLevels.market ?? 0)));
  if (sourceMarketLevel <= 0) {
    throw new GameRuleError('Pro logistiku je potreba Mestsky trh alespon na urovni 1.', 400);
  }
  const capacity = calculateMarketCapacity(sourceMarketLevel);
  if (total > capacity) {
    throw new GameRuleError(
      `Aktualni trh pojme maximalne ${capacity.toLocaleString('cs-CZ')} surovin na jednu zasilku.`,
      400,
    );
  }
  const merchantState = calculateMarketMerchantStateByVillage(Number(village.id), sourceMarketLevel);
  if (merchantState.available <= 0) {
    throw new GameRuleError('Vsechny obchodniky jsou aktualne na cestach.', 400);
  }

  const distanceTiles = calculateTileDistance(village, targetVillage);
  if (distanceTiles > MARKET_MAX_DISTANCE_TILES) {
    throw new GameRuleError(`Logistika presahuje maximalni dosah ${MARKET_MAX_DISTANCE_TILES} policek.`, 400);
  }

  const sourceResources = synchronizeVillageEconomyAt(Number(village.id));
  if (!sourceResources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }
  const currentPocket = toNonNegativeResourcePocket(sourceResources);
  if (
    resourcesToSend.wood > currentPocket.wood ||
    resourcesToSend.stone > currentPocket.stone ||
    resourcesToSend.iron > currentPocket.iron
  ) {
    throw new GameRuleError('Nedostatek surovin ve sklade zdrojove osady.', 400);
  }

  subtractResources(Number(village.id), resourcesToSend, { wood: 0, stone: 0, iron: 0, gold: 0, coins: 0 });

  const startedAtIso = nowIso();
  const durationSec = calculateLogisticsDurationSec(distanceTiles);
  const arriveAtIso = new Date(Date.parse(startedAtIso) + durationSec * 1000).toISOString();
  const insertion = insertLogisticsRouteStmt.run(
    Number(player.id),
    Number(village.id),
    Number(targetVillage.id),
    Number(village.region),
    'manual',
    resourcesToSend.wood,
    resourcesToSend.stone,
    resourcesToSend.iron,
    startedAtIso,
    arriveAtIso,
  );

  return {
    routeId: Number(insertion.lastInsertRowid),
    sourceVillageId: Number(village.id),
    targetVillageId: Number(targetVillage.id),
    distanceTiles,
    durationSec,
    arriveAt: arriveAtIso,
    resources: resourcesToSend,
  };
});

const cancelMarketLogisticsTransaction = db.transaction((username, routeIdRaw, requestedVillageId, worldId = null) => {
  const { player, village, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const routeId = requirePositiveInteger(routeIdRaw, 'routeId');
  const route = selectInProgressLogisticsRouteByIdForPlayerStmt.get(Number(routeId), Number(player.id), Number(world.region));
  if (!route) {
    throw new GameRuleError('Logisticka trasa nebyla nalezena nebo uz nelze zrusit.', 404);
  }

  const startedAtMs = Date.parse(String(route.startedAt));
  const arriveAtMs = Date.parse(String(route.arriveAt));
  const nowMs = Date.now();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(arriveAtMs) || arriveAtMs <= startedAtMs) {
    throw new GameRuleError('Logisticka trasa ma neplatna casova data a nelze ji zrusit.', 400);
  }

  const totalDurationSec = Math.max(1, (arriveAtMs - startedAtMs) / 1000);
  const elapsedSec = Math.max(0, Math.min(totalDurationSec, (nowMs - startedAtMs) / 1000));
  const maxCancelableSec = totalDurationSec * COMMAND_CANCEL_MAX_PROGRESS;
  if (elapsedSec > maxCancelableSec) {
    throw new GameRuleError(
      `Transport lze zrusit pouze do 1/3 cesty. Aktualni prubeh: ${Math.round((elapsedSec / totalDurationSec) * 100)} %.`,
      400,
    );
  }

  const canceledAt = nowIso();
  const changed = Number(cancelLogisticsRouteStmt.run(canceledAt, Number(route.id)).changes ?? 0);
  if (changed <= 0) {
    throw new GameRuleError('Logisticka trasa uz byla zpracovana.', 400);
  }

  const refundRequest = {
    wood: Math.max(0, Math.floor(Number(route.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(route.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(route.iron ?? 0))),
    gold: 0,
    coins: 0,
  };
  const refundResult = applyResourceDeltaWithCap(Number(route.sourceVillageId), refundRequest);
  const refunded = {
    wood: Math.max(0, Math.floor(Number(refundResult?.applied?.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(refundResult?.applied?.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(refundResult?.applied?.iron ?? 0))),
  };

  createPlayerNotification({
    playerId: Number(player.id),
    region: Number(world.region),
    category: 'economy',
    eventType: 'logistics_canceled',
    severity: 'info',
    title: 'Logistika zrusena',
    summary: `Transport #${Number(route.id)} byl zrusen a suroviny byly vraceny do ${String(village.name)}.`,
    payload: {
      routeId: Number(route.id),
      sourceVillageId: Number(route.sourceVillageId),
      targetVillageId: Number(route.targetVillageId),
      refunded,
      canceledAt,
    },
    sourceType: 'logistics_route',
    sourceId: Number(route.id),
    createdAt: canceledAt,
  });

  return {
    canceledRouteId: Number(route.id),
    sourceVillageId: Number(route.sourceVillageId),
    targetVillageId: Number(route.targetVillageId),
    refunded,
    elapsedSec: Math.round(elapsedSec),
    totalDurationSec: Math.round(totalDurationSec),
    canceledAt,
  };
});

export const recruitUnits = (username, unitId, amount, requestedVillageId = null, worldId = null) =>
  recruitTransaction(username, unitId, amount, requestedVillageId, worldId);

export const cancelRecruitment = (username, recruitmentId, requestedVillageId = null, worldId = null) =>
  cancelRecruitmentTransaction(username, recruitmentId, requestedVillageId, worldId);

export const recallKnight = (username, requestedVillageId = null, worldId = null) =>
  recallKnightTransaction(username, requestedVillageId, worldId);

export const issueArmyCommand = (username, payload, requestedVillageId = null, worldId = null) =>
  issueArmyCommandTransaction(username, requestedVillageId, payload, worldId);

export const cancelArmyCommand = (username, movementId, requestedVillageId = null, worldId = null) =>
  cancelArmyCommandTransaction(username, movementId, requestedVillageId, worldId);

export const hireAcademics = (username, amount, requestedVillageId = null, worldId = null) =>
  hireAcademicsTransaction(username, amount, requestedVillageId, worldId);

export const startResearchProject = (username, researchId, assignedAcademics = 1, requestedVillageId = null, worldId = null) =>
  startResearchProjectTransaction(username, researchId, assignedAcademics, requestedVillageId, worldId);

export const adjustResearchProjectAcademics = (
  username,
  researchId,
  delta,
  requestedVillageId = null,
  worldId = null,
) => adjustResearchProjectAcademicsTransaction(username, researchId, delta, requestedVillageId, worldId);

export const hireMercenaryContract = (username, requestedVillageId = null, worldId = null) =>
  hireMercenaryContractTransaction(username, requestedVillageId, worldId);

export const sendMarketLogistics = (username, payload, requestedVillageId = null, worldId = null) =>
  sendMarketLogisticsTransaction(username, payload, requestedVillageId, worldId);

export const cancelMarketLogistics = (username, routeId, requestedVillageId = null, worldId = null) =>
  cancelMarketLogisticsTransaction(username, routeId, requestedVillageId, worldId);

export const configureMarketGuildAutomation = (username, payload, requestedVillageId = null, worldId = null) =>
  configureMarketGuildAutomationTransaction(username, payload, requestedVillageId, worldId);

export { GameRuleError };

