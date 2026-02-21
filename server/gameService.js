import { db } from './db.js';
import {
  BUILDING_DEFS,
  BUILDING_ORDER,
  getGlobalMaxBuildingLevel,
  getMaxBuildingLevel,
  MAX_PLAYER_VILLAGES,
  UNIT_DEFS,
  UNIT_ORDER,
  calculatePopulationCap,
  calculatePopulationUsed,
  calculateProductionPerHour,
  calculateResourceNodeProductionPerHour,
  calculateResourceCap,
  calculateUpgradeCost,
  calculateUpgradeDurationSec,
  calculateRecruitDurationSec,
  calculateArmyTravelDurationSec,
  canAfford,
} from './gameConfig.js';

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
      abandonedTemplateType: 'fire-world',
      nearbyAbandonedCount: DOMINION_FIRE_NEARBY_ABANDONED_COUNT,
      playerProtectionDays: DOMINION_FIRE_PLAYER_PROTECTION_DAYS,
    },
  },
]);
const DEFAULT_WORLD_ID = WORLD_CATALOG[0]?.id ?? 'dominion-1';
const WORLD_REGION_BY_ID = new Map(Object.values(WORLD_REGIONS).map((region) => [Number(region.id), region]));
const KNIGHT_UNIT_ID = 'knight';
const KNIGHT_RECALL_REFUND = { wood: 1000, stone: 1000, iron: 1000 };
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const ABANDONED_BOT_USERNAME_PREFIX = '__abandoned_ai__';
const PLAYER_VILLAGE_NAME_PREFIX = 'Leno';
const ABANDONED_VILLAGE_NAME_PREFIX = 'Opustene leno';
const STARTING_RESOURCES = {
  wood: 1000,
  stone: 1000,
  iron: 1000,
};
const STARTING_PLAYER_BUILDING_LEVELS = {
  townhall: 1,
  warehouse: 1,
  'residential-quarter': 1,
  university: 0,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  barracks: 0,
  stable: 0,
  workshop: 0,
  fortification: 0,
  gate: 0,
};
const STARTING_ABANDONED_BUILDING_LEVELS = {
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  warehouse: 1,
};
const FIRE_WORLD_STARTING_BUILDING_LEVELS = {
  townhall: 1,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  warehouse: 1,
  'residential-quarter': 1,
  barracks: 1,
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

class GameRuleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'GameRuleError';
    this.statusCode = statusCode;
  }
}

const nowIso = () => new Date().toISOString();

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
      peace_until AS peaceUntil
   FROM villages
   WHERE player_id = ? AND region = ?
   ORDER BY id ASC`,
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
  `INSERT INTO resources (village_id, wood, stone, iron)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(village_id) DO UPDATE SET
     wood = excluded.wood,
     stone = excluded.stone,
     iron = excluded.iron`,
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
const deleteArmyMovementUnitsByPlayerStmt = db.prepare(
  `DELETE FROM army_movement_units
   WHERE movement_id IN (
     SELECT id
     FROM army_movements
     WHERE player_id = ?
   )`,
);
const deleteArmyMovementsByPlayerStmt = db.prepare(
  'DELETE FROM army_movements WHERE player_id = ?',
);
const updateVillageToAbandonedOwnerStmt = db.prepare(
  "UPDATE villages SET player_id = ?, name = ?, kingdom = 'Neutral', loyalty = 100, peace_until = NULL WHERE id = ?",
);
const selectResourcesByVillageStmt = db.prepare(
  'SELECT wood, stone, iron FROM resources WHERE village_id = ? LIMIT 1',
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
const selectAllVillageIdsStmt = db.prepare('SELECT id FROM villages');
const selectAllVillagesForWorldStmt = db.prepare(
  `SELECT
      v.id,
      v.name,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      v.region,
      v.kingdom,
      v.prestige,
      v.loyalty,
      v.peace_until AS peaceUntil,
      CASE
        WHEN p.is_bot = 1 THEN 'OpuÄąË‡tĂ„â€şnÄ‚Ë‡ osada'
        ELSE p.username
      END AS owner,
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
const updateResourcesStmt = db.prepare(
  'UPDATE resources SET wood = ?, stone = ?, iron = ? WHERE village_id = ?',
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
  'UPDATE resources SET wood = ?, stone = ?, iron = ? WHERE village_id = ?',
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
      peace_until AS peaceUntil
   FROM villages
   WHERE id = ?
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
      v.player_id AS ownerId,
      p.username AS ownerUsername
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE v.id = ?
   LIMIT 1`,
);
const selectPrimaryKingdomByPlayerStmt = db.prepare(
  `SELECT COALESCE((
      SELECT vv.kingdom
      FROM villages vv
      WHERE vv.player_id = ?
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
const selectDistinctVillageKingdomsByPlayerStmt = db.prepare(
  `SELECT DISTINCT kingdom
   FROM villages
   WHERE player_id = ?`,
);
const updateVillageOwnerForConquestStmt = db.prepare(
  'UPDATE villages SET player_id = ?, kingdom = ?, loyalty = 100 WHERE id = ?',
);
const updateVillagesKingdomByPlayerStmt = db.prepare(
  'UPDATE villages SET kingdom = ?, loyalty = 100 WHERE player_id = ?',
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
   GROUP BY v.kingdom
   ORDER BY prestige DESC, villages DESC, v.kingdom COLLATE NOCASE ASC`,
);
const selectDistinctPlayerKingdomNamesStmt = db.prepare(
  `SELECT DISTINCT v.kingdom
   FROM villages v
   INNER JOIN players p ON p.id = v.player_id
   WHERE p.is_bot = 0
     AND p.username NOT GLOB '__abandoned_ai__*'`,
);
const insertKingdomInviteStmt = db.prepare(
  `INSERT INTO kingdom_invites (
      kingdom,
      inviter_player_id,
      target_player_id,
      status,
      created_at
   ) VALUES (?, ?, ?, 'pending', ?)`,
);
const selectPendingKingdomInviteByTargetStmt = db.prepare(
  `SELECT
      id,
      kingdom,
      inviter_player_id AS inviterPlayerId,
      target_player_id AS targetPlayerId,
      created_at AS createdAt
   FROM kingdom_invites
   WHERE target_player_id = ? AND status = 'pending'
   ORDER BY created_at DESC, id DESC
   LIMIT 1`,
);
const selectPendingKingdomInviteTargetIdsStmt = db.prepare(
  `SELECT
      target_player_id AS targetPlayerId
   FROM kingdom_invites
   WHERE status = 'pending'`,
);
const selectPendingKingdomInviteByIdForTargetStmt = db.prepare(
  `SELECT
      ki.id,
      ki.kingdom,
      ki.inviter_player_id AS inviterPlayerId,
      ki.target_player_id AS targetPlayerId,
      ki.created_at AS createdAt,
      p.username AS inviterUsername
   FROM kingdom_invites ki
   INNER JOIN players p ON p.id = ki.inviter_player_id
   WHERE ki.id = ?
     AND ki.target_player_id = ?
     AND ki.status = 'pending'
   LIMIT 1`,
);
const selectIncomingKingdomInvitesByTargetStmt = db.prepare(
  `SELECT
      ki.id,
      ki.kingdom,
      ki.created_at AS createdAt,
      p.username AS inviterUsername
   FROM kingdom_invites ki
   INNER JOIN players p ON p.id = ki.inviter_player_id
   WHERE ki.target_player_id = ?
     AND ki.status = 'pending'
   ORDER BY ki.created_at DESC, ki.id DESC`,
);
const updateKingdomInviteStatusByIdStmt = db.prepare(
  'UPDATE kingdom_invites SET status = ?, responded_at = ? WHERE id = ?',
);
const rejectOtherPendingKingdomInvitesForTargetStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE target_player_id = ?
     AND status = 'pending'
     AND id != ?`,
);
const rejectAllPendingKingdomInvitesForTargetStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE target_player_id = ?
     AND status = 'pending'`,
);
const cancelPendingKingdomInvitesByInviterStmt = db.prepare(
  `UPDATE kingdom_invites
   SET status = 'rejected',
       responded_at = ?
   WHERE inviter_player_id = ?
     AND status = 'pending'`,
);
const insertKingdomEventStmt = db.prepare(
  `INSERT INTO kingdom_events (
      kingdom,
      event_type,
      actor_player_id,
      target_player_id,
      payload_json,
      created_at
   ) VALUES (?, ?, ?, ?, ?, ?)`,
);
const selectKingdomEventsByKingdomStmt = db.prepare(
  `SELECT
      ke.id,
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
   WHERE ke.kingdom = ?
   ORDER BY ke.created_at DESC, ke.id DESC
   LIMIT ?`,
);
const selectKingdomEventsByPlayerStmt = db.prepare(
  `SELECT
      ke.id,
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
   WHERE ke.actor_player_id = ?
      OR ke.target_player_id = ?
   ORDER BY ke.created_at DESC, ke.id DESC
   LIMIT ?`,
);

const roundResource = (value) => Number(Math.max(0, value).toFixed(3));

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

const resolveWorldSpawnConfig = (world) => ({
  playerTemplateType: String(world?.spawn?.playerTemplateType ?? 'default-player'),
  abandonedTemplateType: String(world?.spawn?.abandonedTemplateType ?? 'default-abandoned'),
  nearbyAbandonedCount: Math.max(0, Math.floor(Number(world?.spawn?.nearbyAbandonedCount ?? 0))),
  playerProtectionDays: Math.max(0, Number(world?.spawn?.playerProtectionDays ?? 0)),
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

const createKingdomEvent = ({ kingdom = null, eventType, actorPlayerId = null, targetPlayerId = null, payload = null }) =>
  insertKingdomEventStmt.run(
    kingdom == null ? null : String(kingdom),
    String(eventType),
    actorPlayerId == null ? null : Number(actorPlayerId),
    targetPlayerId == null ? null : Number(targetPlayerId),
    payload == null ? null : JSON.stringify(payload),
    nowIso(),
  );

const buildKingdomAuditLog = (playerId, kingdomName) => {
  const rows =
    kingdomName && !isNeutralKingdom(kingdomName)
      ? selectKingdomEventsByKingdomStmt.all(String(kingdomName), 30)
      : selectKingdomEventsByPlayerStmt.all(Number(playerId), Number(playerId), 30);

  return rows.map((row) => {
    const payload = parseJsonSafe(row.payloadJson, {});
    const actorUsername = row.actorUsername ? String(row.actorUsername) : 'NeznÄ‚Ë‡mÄ‚Ëť hrÄ‚Ë‡Ă„Ĺ¤';
    const targetUsername = row.targetUsername ? String(row.targetUsername) : 'NeznÄ‚Ë‡mÄ‚Ëť hrÄ‚Ë‡Ă„Ĺ¤';
    const eventKingdom = row.kingdom ? String(row.kingdom) : null;
    let message = 'NeznÄ‚Ë‡mÄ‚Ë‡ krÄ‚Ë‡lovskÄ‚Ë‡ udÄ‚Ë‡lost.';

    if (row.eventType === 'kingdom_created') {
      message = `${actorUsername} zaloÄąÄľil krÄ‚Ë‡lovstvÄ‚Â­ ${eventKingdom ?? 'bez nÄ‚Ë‡zvu'}.`;
    } else if (row.eventType === 'invite_sent') {
      message = `${actorUsername} poslal pozvÄ‚Ë‡nku hrÄ‚Ë‡Ă„Ĺ¤i ${targetUsername}.`;
    } else if (row.eventType === 'invite_accepted') {
      message = `${actorUsername} pÄąâ„˘ijal pozvÄ‚Ë‡nku do krÄ‚Ë‡lovstvÄ‚Â­ ${eventKingdom ?? 'bez nÄ‚Ë‡zvu'}.`;
    } else if (row.eventType === 'invite_rejected') {
      message = `${actorUsername} odmÄ‚Â­tl pozvÄ‚Ë‡nku do krÄ‚Ë‡lovstvÄ‚Â­ ${eventKingdom ?? 'bez nÄ‚Ë‡zvu'}.`;
    } else if (row.eventType === 'member_left') {
      message = `${actorUsername} opustil krÄ‚Ë‡lovstvÄ‚Â­ ${eventKingdom ?? 'bez nÄ‚Ë‡zvu'}.`;
    } else if (row.eventType === 'member_kicked') {
      message = `${actorUsername} vyhodil hrÄ‚Ë‡Ă„Ĺ¤e ${targetUsername} z krÄ‚Ë‡lovstvÄ‚Â­.`;
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

const resolvePrimaryKingdomByPlayerId = (playerId) => {
  const row = selectPrimaryKingdomByPlayerStmt.get(Number(playerId));
  return normalizeKingdomValue(row?.kingdom || 'Neutral') || 'Neutral';
};

const resolveKingdomLeader = (kingdomName) => {
  if (isNeutralKingdom(kingdomName)) {
    return null;
  }
  const row = selectKingdomLeaderByKingdomStmt.get(String(kingdomName));
  if (!row) {
    return null;
  }
  return {
    playerId: Number(row.playerId),
    username: String(row.username),
  };
};

const listKingdomMembers = (kingdomName, leaderPlayerId = null) => {
  if (isNeutralKingdom(kingdomName)) {
    return [];
  }
  return selectKingdomMembersByKingdomStmt.all(String(kingdomName)).map((member) => ({
    playerId: Number(member.playerId),
    username: String(member.username),
    villages: Number(member.villageCount),
    prestige: Number(member.prestige),
    isLeader: leaderPlayerId != null && Number(member.playerId) === Number(leaderPlayerId),
  }));
};

const listAvailableKingdoms = () =>
  selectKingdomOverviewRowsStmt
    .all()
    .map((row) => ({
      kingdom: String(row.kingdom),
      villages: Number(row.villages),
      members: Number(row.members),
      prestige: Number(row.prestige),
    }))
    .filter((row) => !isNeutralKingdom(row.kingdom));

const listIncomingKingdomInvites = (playerId) =>
  selectIncomingKingdomInvitesByTargetStmt.all(Number(playerId)).map((invite) => ({
    id: Number(invite.id),
    kingdom: String(invite.kingdom),
    inviterUsername: String(invite.inviterUsername),
    createdAt: String(invite.createdAt),
  }));

const listKingdomInviteCandidates = (viewerUsername) => {
  const pendingInviteTargetIds = new Set(
    selectPendingKingdomInviteTargetIdsStmt
      .all()
      .map((row) => Number(row.targetPlayerId))
      .filter((playerId) => Number.isFinite(playerId) && playerId > 0),
  );

  return selectLeaderboardStmt
    .all()
    .filter((row) => {
      if (String(row.username) === String(viewerUsername)) {
        return false;
      }
      if (!isNeutralKingdom(row.kingdom)) {
        return false;
      }

      const playerKingdomRows = selectDistinctVillageKingdomsByPlayerStmt.all(Number(row.playerId));
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
  const kingdomNameRaw = normalizeKingdomValue(village.kingdom);
  const isMember = !isNeutralKingdom(kingdomNameRaw);
  const kingdomName = isMember ? kingdomNameRaw : null;
  const leader = kingdomName ? resolveKingdomLeader(kingdomName) : null;
  const canManageInvites = leader != null && Number(leader.playerId) === playerId;
  const members = kingdomName ? listKingdomMembers(kingdomName, leader?.playerId ?? null) : [];
  const inviteCandidates = canManageInvites ? listKingdomInviteCandidates(player.username) : [];
  const incomingInvites = listIncomingKingdomInvites(playerId);
  const auditLog = buildKingdomAuditLog(playerId, kingdomName);

  return {
    isMember,
    kingdom: kingdomName,
    leaderUsername: leader?.username ?? null,
    canManageInvites,
    members,
    inviteCandidates,
    incomingInvites,
    availableKingdoms: listAvailableKingdoms(),
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

const calculateSpawnScore = (coordX, coordY, occupiedCoords, region) => {
  if (occupiedCoords.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const occupied of occupiedCoords) {
    const distance = Math.max(Math.abs(coordX - occupied.coordX), Math.abs(coordY - occupied.coordY));
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }

  const centerX = Number(region.originX) + (Number(region.size) - 1) / 2;
  const centerY = Number(region.originY) + (Number(region.size) - 1) / 2;
  const distanceFromCenter = Math.max(Math.abs(coordX - centerX), Math.abs(coordY - centerY));

  return nearestDistance * 100 - distanceFromCenter;
};

const claimBestSpawnCell = (spawnContext) => {
  const region = spawnContext.region;
  let best = null;
  for (let localY = 1; localY <= Number(region.size); localY += 1) {
    for (let localX = 1; localX <= Number(region.size); localX += 1) {
      const coordX = Number(region.originX) + localX - 1;
      const coordY = Number(region.originY) + localY - 1;
      const key = toCoordinateKey(coordX, coordY);
      if (spawnContext.occupiedKeys.has(key)) {
        continue;
      }

      const score = calculateSpawnScore(coordX, coordY, spawnContext.occupiedCoords, region);
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

const claimNearbySpawnCells = (spawnContext, originCoordXRaw, originCoordYRaw, countRaw) => {
  const region = spawnContext.region;
  const originCoordX = Number(originCoordXRaw);
  const originCoordY = Number(originCoordYRaw);
  const count = Math.max(0, Math.floor(Number(countRaw ?? 0)));
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

  candidates.sort((left, right) => {
    const byChebyshev = left.chebyshevDistance - right.chebyshevDistance;
    if (byChebyshev !== 0) {
      return byChebyshev;
    }
    const byManhattan = left.manhattanDistance - right.manhattanDistance;
    if (byManhattan !== 0) {
      return byManhattan;
    }
    if (left.coordY !== right.coordY) {
      return left.coordY - right.coordY;
    }
    return left.coordX - right.coordX;
  });

  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= count) {
      break;
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
  const resourceTemplate = template?.resources ?? STARTING_RESOURCES;
  upsertVillageResourcesStmt.run(
    Number(villageId),
    roundResource(Number(resourceTemplate.wood ?? STARTING_RESOURCES.wood)),
    roundResource(Number(resourceTemplate.stone ?? STARTING_RESOURCES.stone)),
    roundResource(Number(resourceTemplate.iron ?? STARTING_RESOURCES.iron)),
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
}) => {
  const resolvedWorld = world ? resolveWorldById(world.id) : resolveWorldById(DEFAULT_WORLD_ID);
  const activeSpawnContext = spawnContext ?? buildSpawnContext(resolvedWorld);
  const spawn = spawnCell ?? claimBestSpawnCell(activeSpawnContext);
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
}) =>
  createVillage({
    playerId,
    villageName: `${PLAYER_VILLAGE_NAME_PREFIX} ${String(username)}`,
    kingdom: 'Neutral',
    template: resolveTemplateByType(templateType, PLAYER_VILLAGE_TEMPLATE),
    world,
    spawnContext,
    createdAtIso,
    spawnCell,
    peaceUntil: buildVillageProtectionUntil(createdAtIso, protectionDays),
  });

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
  applyVillageTemplate(Number(villageId), ABANDONED_VILLAGE_TEMPLATE);

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

const ensurePlayerHasVillageInWorldTransaction = db.transaction((playerId, username, worldIdRaw) => {
  const world = resolveWorldById(worldIdRaw);
  const villages = selectVillagesByPlayerAndRegionStmt.all(Number(playerId), Number(world.region));
  if (villages.length > 0) {
    return villages;
  }

  const spawnConfig = resolveWorldSpawnConfig(world);
  const spawnContext = buildSpawnContext(world);
  const playerSpawnCell = claimBestSpawnCell(spawnContext);
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
  });

  createNearbyAbandonedVillagesAroundSpawn({
    world,
    spawnContext,
    centerCoordX: Number(playerSpawnCell.coordX),
    centerCoordY: Number(playerSpawnCell.coordY),
    count: spawnConfig.nearbyAbandonedCount,
    templateType: spawnConfig.abandonedTemplateType,
  });

  return selectVillagesByPlayerAndRegionStmt.all(Number(playerId), Number(world.region));
});

const ensurePlayerHasVillageTransaction = db.transaction((playerId, username) => {
  const villages = selectVillagesByPlayerStmt.all(Number(playerId));
  if (villages.length > 0) {
    return villages;
  }

  createFreshVillageForPlayer({
    playerId: Number(playerId),
    username: String(username),
    world: resolveWorldById(DEFAULT_WORLD_ID),
  });

  return selectVillagesByPlayerStmt.all(Number(playerId));
});

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
  const village = createFreshVillageForPlayer({
    playerId,
    username,
    createdAtIso: createdAt,
  });

  return {
    username,
    village: village
      ? {
          id: Number(village.id),
          name: String(village.name),
          kingdom: String(village.kingdom ?? 'Neutral'),
          coordX: Number(village.coordX),
          coordY: Number(village.coordY),
        }
      : null,
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

const restartVillageProgressTransaction = db.transaction((username) => {
  const normalizedUsername = normalizeUsername(username);
  const player = selectPlayerByUsernameStmt.get(normalizedUsername);
  if (!player) {
    throw new GameRuleError(`Hrac '${normalizedUsername}' neexistuje.`, 404);
  }

  const playerId = Number(player.id);
  const villages = selectVillagesByPlayerStmt.all(playerId);
  const serialAllocator = createAbandonedBotSerialAllocator();
  const restartedAt = nowIso();
  const convertedVillages = [];

  deleteArmyMovementUnitsByPlayerStmt.run(playerId);
  deleteArmyMovementsByPlayerStmt.run(playerId);

  for (const village of villages) {
    convertedVillages.push(
      convertVillageToAbandoned({
        villageId: Number(village.id),
        serialAllocator,
        createdAtIso: restartedAt,
      }),
    );
  }

  cancelPendingKingdomInvitesByInviterStmt.run(restartedAt, playerId);
  rejectAllPendingKingdomInvitesForTargetStmt.run(restartedAt, playerId);

  const freshVillage = createFreshVillageForPlayer({
    playerId,
    username: normalizedUsername,
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
  Math.max(1, Math.floor(Number(UNIT_DEFS[unitId]?.populationCost ?? 1)));

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

const getPlayerKnightCapacity = (playerId, region = null) =>
  Math.max(0, Math.min(MAX_PLAYER_VILLAGES, getPlayerVillageCount(Number(playerId), region)));

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
  unitScore += (unitCounts.knight ?? 0) * 140;
  unitScore += (unitCounts.ram ?? 0) * 5;
  unitScore += (unitCounts.caravan ?? 0) * 2;

  return Math.max(0, Math.round(buildingScore + unitScore));
};

const calculateRecruitmentSpeedReduction = (level) =>
  Math.min(0.55, Math.max(0, Math.max(0, Number(level ?? 0)) * 0.012 + Math.log2(Number(level ?? 0) + 1) * 0.04));

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
  if (buildingId === 'warehouse') {
    return `Kapacita skladu: ${calculateResourceCap(level).toLocaleString('cs-CZ')}`;
  }
  if (buildingId === 'residential-quarter') {
    return `Kapacita populace: ${calculatePopulationCap(level).toLocaleString('cs-CZ')}`;
  }
  if (buildingId === 'townhall') {
    const reductionPct = Math.round(Math.min(15, Math.max(0, Number(level ?? 0)) * 15));
    return reductionPct > 0
      ? `Vystavba budov: -${reductionPct} % casu`
      : 'Vystavba budov bez casoveho bonusu';
  }
  if (buildingId === 'university') {
    const researchBonusPct = Math.round(Math.max(0, Number(level ?? 0)) * 20);
    return researchBonusPct > 0 ? `Vyzkum: +${researchBonusPct} % rychlost` : 'Vyzkum bez bonusu';
  }
  if (buildingId === 'barracks') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction(level) * 100);
    return reductionPct > 0
      ? `Nabor pesich jednotek: -${reductionPct} % casu`
      : 'Nabor pesich jednotek bez bonusu';
  }
  if (buildingId === 'stable') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction(level) * 100);
    return reductionPct > 0 ? `Nabor jezdectva: -${reductionPct} % casu` : 'Nabor jezdectva bez bonusu';
  }
  if (buildingId === 'workshop') {
    const reductionPct = Math.round(calculateRecruitmentSpeedReduction(level) * 100);
    return reductionPct > 0
      ? `Nabor dilenskych jednotek: -${reductionPct} % casu`
      : 'Nabor dilenskych jednotek bez bonusu';
  }
  if (buildingId === 'fortification') {
    const defenseBonusPct = Math.round(Math.min(45, Math.max(0, Number(level ?? 0)) * 3));
    return defenseBonusPct > 0
      ? `Obrana osady: +${defenseBonusPct} % (dalsi bonus s lucistniky)`
      : 'Obrana osady bez bonusu';
  }
  if (buildingId === 'gate') {
    return Number(level ?? 0) > 0
      ? 'Brana aktivni: utok bez beranidel je odrazen pred bojem'
      : 'Bez brany muze utocnik vstoupit i bez beranidel';
  }

  return `Uroven ${level}`;
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

const LOOT_PRIORITIES = ['wood', 'stone', 'iron'];
const BATTLE_UNIT_POWER = {
  militia: { attack: 12, defense: 12 },
  archer: { attack: 8, defense: 14 },
  cavalry: { attack: 17, defense: 9 },
  knight: { attack: 340, defense: 280 },
  ram: { attack: 7, defense: 7 },
  caravan: { attack: 0, defense: 0 },
};
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

const getVillagePopulationStatus = (villageId) => {
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(villageId)));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(Number(villageId)));
  const populationCap = calculatePopulationCap(buildingLevels['residential-quarter'] ?? 0);
  const populationUsed = calculatePopulationUsed(buildingLevels, unitCounts);
  const availablePopulation = Math.max(0, populationCap - populationUsed);

  return {
    buildingLevels,
    unitCounts,
    populationCap,
    populationUsed,
    availablePopulation,
  };
};

const sumCombatPower = (selection, role) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    const amount = Number(selection[unitId] ?? 0);
    if (amount <= 0) {
      return sum;
    }
    const unitPower = Number(BATTLE_UNIT_POWER[unitId]?.[role] ?? 0);
    return sum + amount * unitPower;
  }, 0);

const applyCasualties = (selection, casualtyRatio) => {
  const safeRatio = clampNumber(Number(casualtyRatio), 0, 1);
  const losses = {};
  const survivors = {};

  for (const unitId of UNIT_ORDER) {
    const startAmount = Math.max(0, Math.floor(Number(selection[unitId] ?? 0)));
    const lossAmount = Math.min(startAmount, Math.round(startAmount * safeRatio));
    const survivorAmount = Math.max(0, startAmount - lossAmount);
    losses[unitId] = lossAmount;
    survivors[unitId] = survivorAmount;
  }

  return { losses, survivors };
};

const normalizeLootPriority = (rawValue) => {
  const normalized = String(rawValue ?? '')
    .trim()
    .toLowerCase();
  if (LOOT_PRIORITIES.includes(normalized)) {
    return normalized;
  }
  return 'wood';
};

const calculateLootDistribution = (resourcePocket, priority, carryingCapacity) => {
  const loot = { wood: 0, stone: 0, iron: 0 };
  let remainingCapacity = Math.max(0, Math.floor(Number(carryingCapacity ?? 0)));
  if (remainingCapacity <= 0) {
    return { loot, total: 0 };
  }

  const order = [priority, ...LOOT_PRIORITIES.filter((resourceId) => resourceId !== priority)];
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

const applyResourceDeltaWithCap = (villageId, delta) => {
  const resourceRow = selectResourcesByVillageStmt.get(Number(villageId));
  if (!resourceRow) {
    return { applied: { wood: 0, stone: 0, iron: 0 }, next: null };
  }

  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(villageId)));
  const cap = calculateResourceCap(buildingLevels.warehouse ?? 0);
  const current = {
    wood: Number(resourceRow.wood),
    stone: Number(resourceRow.stone),
    iron: Number(resourceRow.iron),
  };
  const requested = {
    wood: Number(delta.wood ?? 0),
    stone: Number(delta.stone ?? 0),
    iron: Number(delta.iron ?? 0),
  };
  const next = {
    wood: clampResourceToCap(current.wood + requested.wood, cap),
    stone: clampResourceToCap(current.stone + requested.stone, cap),
    iron: clampResourceToCap(current.iron + requested.iron, cap),
  };
  const applied = {
    wood: Math.max(0, Math.round(next.wood - current.wood)),
    stone: Math.max(0, Math.round(next.stone - current.stone)),
    iron: Math.max(0, Math.round(next.iron - current.iron)),
  };

  updateResourcesStmt.run(roundResource(next.wood), roundResource(next.stone), roundResource(next.iron), Number(villageId));

  return {
    applied,
    next,
  };
};

const addResourcesWithoutCap = (villageId, delta) => {
  const resourceRow = selectResourcesByVillageStmt.get(Number(villageId));
  if (!resourceRow) {
    return { added: { wood: 0, stone: 0, iron: 0 }, next: null };
  }

  const current = {
    wood: Number(resourceRow.wood),
    stone: Number(resourceRow.stone),
    iron: Number(resourceRow.iron),
  };
  const added = {
    wood: Math.max(0, Math.floor(Number(delta.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(delta.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(delta.iron ?? 0))),
  };
  const next = {
    wood: current.wood + added.wood,
    stone: current.stone + added.stone,
    iron: current.iron + added.iron,
  };

  updateResourcesStmt.run(roundResource(next.wood), roundResource(next.stone), roundResource(next.iron), Number(villageId));

  return {
    added,
    next,
  };
};

const subtractResources = (villageId, delta) => {
  const resourceRow = selectResourcesByVillageStmt.get(Number(villageId));
  if (!resourceRow) {
    return { taken: { wood: 0, stone: 0, iron: 0 }, next: null };
  }

  const current = {
    wood: Number(resourceRow.wood),
    stone: Number(resourceRow.stone),
    iron: Number(resourceRow.iron),
  };
  const requested = {
    wood: Math.max(0, Math.floor(Number(delta.wood ?? 0))),
    stone: Math.max(0, Math.floor(Number(delta.stone ?? 0))),
    iron: Math.max(0, Math.floor(Number(delta.iron ?? 0))),
  };
  const taken = {
    wood: Math.min(current.wood, requested.wood),
    stone: Math.min(current.stone, requested.stone),
    iron: Math.min(current.iron, requested.iron),
  };
  const next = {
    wood: Math.max(0, current.wood - taken.wood),
    stone: Math.max(0, current.stone - taken.stone),
    iron: Math.max(0, current.iron - taken.iron),
  };

  updateResourcesStmt.run(roundResource(next.wood), roundResource(next.stone), roundResource(next.iron), Number(villageId));

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

  return Number(result.lastInsertRowid);
};

const simulateAttackBattle = ({
  attackerUnitsRaw,
  defenderUnitsRaw,
  defenderBuildingLevels,
}) => {
  const attackerUnits = toCompleteUnitSelection(attackerUnitsRaw);
  const defenderUnits = toCompleteUnitSelection(defenderUnitsRaw);
  const gateLevel = Math.max(0, Math.floor(Number(defenderBuildingLevels.gate ?? 0)));
  const fortificationLevel = Math.max(0, Math.floor(Number(defenderBuildingLevels.fortification ?? 0)));
  const hasGate = gateLevel > 0;
  const hasFortification = fortificationLevel > 0;
  const hasAttackingRam = Number(attackerUnits.ram ?? 0) > 0;
  const defenderArchers = Number(defenderUnits.archer ?? 0);
  const blockedByGate = hasGate && !hasAttackingRam;

  let attackMultiplier = 1;
  let defenseMultiplier = 1;
  const bonuses = [];

  const baseAttackPower = sumCombatPower(attackerUnits, 'attack');
  const baseDefensePower = sumCombatPower(defenderUnits, 'defense');

  if (blockedByGate) {
    let gateDamageLossRatio = 0;
    if (defenderArchers > 0) {
      const archerPressure = Math.log2(defenderArchers + 1) * 0.025;
      const fortificationPressure = hasFortification ? 0.025 + fortificationLevel * 0.012 : 0.015;
      gateDamageLossRatio = clampNumber(archerPressure + fortificationPressure, 0.03, 0.42);
      bonuses.push('Brana zastavila utok bez beranidel.');
      bonuses.push('Lucistnici ostrelovali utocnika z hradeb.');
    } else {
      bonuses.push('Brana zastavila utok bez beranidel. Obrana neutrpela ztraty.');
    }

    const attackerAfterLoss = applyCasualties(attackerUnits, gateDamageLossRatio);
    const defenderAfterLoss = applyCasualties(defenderUnits, 0);
    const attackerSurvivorsTotal = sumSelectedUnits(attackerAfterLoss.survivors);
    const defenderSurvivorsTotal = sumSelectedUnits(defenderAfterLoss.survivors);

    return {
      attackerWins: false,
      blockedByGate: true,
      gateDamageLossRatio: Number(gateDamageLossRatio.toFixed(4)),
      baseAttackPower: Number(baseAttackPower.toFixed(2)),
      baseDefensePower: Number(baseDefensePower.toFixed(2)),
      finalAttackPower: Number(baseAttackPower.toFixed(2)),
      finalDefensePower: Number(baseDefensePower.toFixed(2)),
      attackMultiplier: Number(attackMultiplier.toFixed(3)),
      defenseMultiplier: Number(defenseMultiplier.toFixed(3)),
      bonuses,
      attackerLossRatio: Number(gateDamageLossRatio.toFixed(4)),
      defenderLossRatio: 0,
      attacker: {
        start: attackerUnits,
        losses: attackerAfterLoss.losses,
        survivors: attackerAfterLoss.survivors,
        survivorsTotal: attackerSurvivorsTotal,
      },
      defender: {
        start: defenderUnits,
        losses: defenderAfterLoss.losses,
        survivors: defenderAfterLoss.survivors,
        survivorsTotal: defenderSurvivorsTotal,
      },
    };
  }

  if (hasGate) {
    defenseMultiplier *= 1.14;
    bonuses.push('Brana aktivni: obrana +14 %');
    if (hasAttackingRam) {
      attackMultiplier *= 1.1;
      bonuses.push('Beranidla prorazi branu: utok +10 %');
    }
  } else if (hasAttackingRam) {
    attackMultiplier *= 1.08;
    bonuses.push('Beranidla bez brany: utok +8 %');
  }
  if (hasFortification) {
    const fortificationDefenseBonus = Math.min(0.45, fortificationLevel * 0.03);
    defenseMultiplier *= 1 + fortificationDefenseBonus;
    bonuses.push(`Opevneni: obrana +${Math.round(fortificationDefenseBonus * 100)} %`);
    if (defenderArchers > 0) {
      const archerWallBonus = Math.min(0.2, fortificationLevel * 0.02);
      defenseMultiplier *= 1 + archerWallBonus;
      bonuses.push(`Lucistnici na hradbach: obrana +${Math.round(archerWallBonus * 100)} %`);
    }
  }

  const finalAttackPower = baseAttackPower * attackMultiplier;
  const finalDefensePower = baseDefensePower * defenseMultiplier;
  const attackerWins = finalAttackPower > finalDefensePower;
  const totalPower = Math.max(1, finalAttackPower + finalDefensePower);

  let attackerLossRatio = 1;
  let defenderLossRatio = 1;
  if (attackerWins) {
    attackerLossRatio = clampNumber(0.22 + (finalDefensePower / totalPower) * 0.58, 0.12, 0.9);
    defenderLossRatio = 1;
  } else {
    attackerLossRatio = 1;
    defenderLossRatio = clampNumber(0.2 + (finalAttackPower / totalPower) * 0.55, 0.1, 0.92);
  }

  const attackerAfterLoss = applyCasualties(attackerUnits, attackerLossRatio);
  const defenderAfterLoss = applyCasualties(defenderUnits, defenderLossRatio);
  const attackerSurvivorsTotal = sumSelectedUnits(attackerAfterLoss.survivors);
  const defenderSurvivorsTotal = sumSelectedUnits(defenderAfterLoss.survivors);

  return {
    attackerWins,
    blockedByGate: false,
    gateDamageLossRatio: 0,
    baseAttackPower: Number(baseAttackPower.toFixed(2)),
    baseDefensePower: Number(baseDefensePower.toFixed(2)),
    finalAttackPower: Number(finalAttackPower.toFixed(2)),
    finalDefensePower: Number(finalDefensePower.toFixed(2)),
    attackMultiplier: Number(attackMultiplier.toFixed(3)),
    defenseMultiplier: Number(defenseMultiplier.toFixed(3)),
    bonuses,
    attackerLossRatio: Number(attackerLossRatio.toFixed(4)),
    defenderLossRatio: Number(defenderLossRatio.toFixed(4)),
    attacker: {
      start: attackerUnits,
      losses: attackerAfterLoss.losses,
      survivors: attackerAfterLoss.survivors,
      survivorsTotal: attackerSurvivorsTotal,
    },
    defender: {
      start: defenderUnits,
      losses: defenderAfterLoss.losses,
      survivors: defenderAfterLoss.survivors,
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

const isVillageUnderSpawnProtection = (village, referenceMs = Date.now()) => {
  const peaceUntil = village?.peaceUntil;
  if (!peaceUntil) {
    return false;
  }
  const peaceUntilMs = Date.parse(String(peaceUntil));
  if (!Number.isFinite(peaceUntilMs)) {
    return false;
  }
  return peaceUntilMs > referenceMs;
};

const requireVillageForUser = (username, requestedVillageId = null, worldId = null) => {
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

  return { player, village, villages, world: selectedWorld };
};

const normalizeSettlementKind = (isOwn, isRoyalSettlement, isAbandonedBot) => {
  if (isOwn) {
    return 'own';
  }

  if (isAbandonedBot) {
    return 'abandoned';
  }

  return isRoyalSettlement ? 'bot' : 'player';
};

const buildWorldSettlements = (viewerVillage, viewerUsername, world) => {
  const region = resolveWorldRegionDefinition(world);
  const villages = selectAllVillagesForWorldStmt.all(Number(world.region));
  const viewerKingdom = viewerVillage.kingdom;

  return villages.map((row) => {
    const coordX = Number(row.coordX);
    const coordY = Number(row.coordY);
    const isAbandonedBot = Number(row.isBot) === 1;
    const isOwn = row.owner === viewerUsername;
    const isRoyalSettlement = row.kingdom === 'Neutral' && !isAbandonedBot;
    const sameKingdom = !isAbandonedBot && row.kingdom === viewerKingdom;

    return {
      id: `vlg-${row.id}`,
      villageId: Number(row.id),
      name: row.name,
      kind: normalizeSettlementKind(isOwn, isRoyalSettlement, isAbandonedBot),
      owner: row.owner,
      kingdom: row.kingdom,
      region: Number(row.region),
      localX: coordX - Number(region.originX) + 1,
      localY: coordY - Number(region.originY) + 1,
      globalX: coordX,
      globalY: coordY,
      prestige: Number(row.prestige),
      loyalty: isOwn ? Number(row.loyalty) : 0,
      note: isOwn
        ? 'Tvoje hlavni vesnice. Mas plny pristup ke statistikam.'
        : isAbandonedBot
          ? 'Opustene leno s AI obranou. Podrobnosti o budovach a jednotkach jsou skryte.'
          : 'Cizi leno - podrobnosti o budovach a jednotkach jsou skryte.',
      visibility: isOwn ? 'full' : 'public',
      relation: isOwn ? 'self' : isAbandonedBot ? 'enemy' : sameKingdom ? 'ally' : 'enemy',
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

const buildArmyState = (playerId, currentVillageId) => {
  const activeMovements = selectActiveArmyMovementsByPlayerStmt
    .all(Number(playerId))
    .map((row) => toMovementWithUnits(row))
    .map((movement) => ({
      ...movement,
      isRelatedToCurrentVillage:
        movement.originVillageId === Number(currentVillageId) ||
        movement.targetVillageId === Number(currentVillageId) ||
        movement.homeVillageId === Number(currentVillageId),
    }));

  const stationedSupports = selectStationedSupportMovementsByPlayerStmt
    .all(Number(playerId))
    .map((row) => toMovementWithUnits(row))
    .map((movement) => ({
      ...movement,
      isRelatedToCurrentVillage:
        movement.originVillageId === Number(currentVillageId) ||
        movement.targetVillageId === Number(currentVillageId) ||
        movement.homeVillageId === Number(currentVillageId),
    }));

  return {
    activeMovements,
    stationedSupports,
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
    items: rows.map((row) => {
      let payload = {};
      try {
        payload = JSON.parse(String(row.payloadJson ?? '{}'));
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
    }),
  };
};

const tickTransaction = db.transaction((tickTimeIso, tickTimeMs) => {
  const state = selectGameStateStmt.get();
  const parsedLastTick = state?.lastTickAt ? Date.parse(state.lastTickAt) : Number.NaN;
  const lastTickMs = Number.isFinite(parsedLastTick) ? parsedLastTick : tickTimeMs;
  const elapsedSec = Math.max(0, (tickTimeMs - lastTickMs) / 1000);
  const villageRows = selectAllVillageIdsStmt.all();

  for (const villageRow of villageRows) {
    const villageId = Number(villageRow.id);
    const resourceRow = selectResourcesByVillageStmt.get(villageId);
    if (!resourceRow) {
      continue;
    }

    const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(villageId));
    const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(villageId));
    const resourceCap = calculateResourceCap(buildingLevels.warehouse ?? 0);
    const populationCap = calculatePopulationCap(buildingLevels['residential-quarter'] ?? 0);
    const populationUsed = calculatePopulationUsed(buildingLevels, unitCounts);
    const production = calculateProductionPerHour(buildingLevels, populationUsed, populationCap);

    if (elapsedSec > 0) {
      const nextWood = roundResource(
        clampResourceToCap(Number(resourceRow.wood) + (production.wood * elapsedSec) / 3600, resourceCap),
      );
      const nextStone = roundResource(
        clampResourceToCap(Number(resourceRow.stone) + (production.stone * elapsedSec) / 3600, resourceCap),
      );
      const nextIron = roundResource(
        clampResourceToCap(Number(resourceRow.iron) + (production.iron * elapsedSec) / 3600, resourceCap),
      );

      updateResourcesStmt.run(nextWood, nextStone, nextIron, villageId);
    }

    updateVillagePrestigeStmt.run(calculateVillagePrestige(buildingLevels, unitCounts), villageId);
  }

  const dueUpgrades = selectDueUpgradesStmt.all(tickTimeIso);
  for (const upgrade of dueUpgrades) {
    const maxLevel = getMaxBuildingLevel(upgrade.buildingId);
    const finalLevel = Math.min(maxLevel, Number(upgrade.toLevel));
    updateBuildingLevelStmt.run(finalLevel, Number(upgrade.villageId), upgrade.buildingId);
    completeUpgradeStmt.run(tickTimeIso, Number(upgrade.id));
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
    }

    completeRecruitmentStmt.run(tickTimeIso, Number(recruitment.id));
  }

  const dueArmyMovements = selectDueArmyMovementsStmt.all(tickTimeIso);
  let stationedSupports = 0;
  let completedArmyMovements = 0;
  let spawnedReturnMovements = 0;
  let generatedBattleReports = 0;
  const villagesToRecalculatePrestige = new Set();
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
      const totalSentUnits = sumSelectedUnits(unitSelection);
      if (!targetVillage || !homeVillage || totalSentUnits <= 0) {
        updateArmyMovementStatusStmt.run('completed', tickTimeIso, movementId);
        completedArmyMovements += 1;
        continue;
      }

      const villageDefenderUnitsBefore = toUnitCountMap(selectUnitsByVillageStmt.all(Number(targetVillage.id)));
      const stationedSupportGroups = buildStationedSupportBattleGroups(Number(targetVillage.id));
      const defenderUnitsBefore = toCompleteUnitSelection(villageDefenderUnitsBefore);
      for (const supportGroup of stationedSupportGroups) {
        addUnitSelection(defenderUnitsBefore, supportGroup.units);
      }
      const defenderBuildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(Number(targetVillage.id)));
      const battle = simulateAttackBattle({
        attackerUnitsRaw: unitSelection,
        defenderUnitsRaw: defenderUnitsBefore,
        defenderBuildingLevels,
      });

      const villageDefenseAfterLoss = applyCasualties(villageDefenderUnitsBefore, battle.defenderLossRatio);
      for (const unitId of UNIT_ORDER) {
        updateUnitAmountStmt.run(
          Number(villageDefenseAfterLoss.survivors[unitId] ?? 0),
          Number(targetVillage.id),
          unitId,
        );
      }
      villagesToRecalculatePrestige.add(Number(targetVillage.id));

      const stationedSupportCasualties = [];
      for (const supportGroup of stationedSupportGroups) {
        const supportAfterLoss = applyCasualties(supportGroup.units, battle.defenderLossRatio);
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
        stationedSupportSurvivorsTotal <= 0 &&
        Number(targetVillage.playerId) !== Number(movement.playerId);
      const attackerVillageCount = getPlayerVillageCount(Number(movement.playerId));
      const canConquerAnotherVillage = attackerVillageCount < MAX_PLAYER_VILLAGES;
      let conquestPayload = null;
      if (canCaptureWithKnight && canConquerAnotherVillage) {
        const kingdomRow = selectPrimaryKingdomByPlayerStmt.get(Number(movement.playerId));
        const conquerorKingdom = String(kingdomRow?.kingdom ?? 'Neutral');
        updateVillageOwnerForConquestStmt.run(Number(movement.playerId), conquerorKingdom, Number(targetVillage.id));
        villagesToRecalculatePrestige.add(Number(targetVillage.id));
        conquestPayload = {
          conquered: true,
          blockedByVillageLimit: false,
          villageLimit: MAX_PLAYER_VILLAGES,
          previousOwner: String(targetVillage.ownerUsername ?? ''),
          newOwner: String(attackerPlayer?.username ?? ''),
          targetVillageId: Number(targetVillage.id),
          targetVillageName: String(targetVillage.name ?? ''),
        };
      } else if (canCaptureWithKnight && !canConquerAnotherVillage) {
        conquestPayload = {
          conquered: false,
          blockedByVillageLimit: true,
          villageLimit: MAX_PLAYER_VILLAGES,
          previousOwner: String(targetVillage.ownerUsername ?? ''),
          newOwner: String(targetVillage.ownerUsername ?? ''),
          targetVillageId: Number(targetVillage.id),
          targetVillageName: String(targetVillage.name ?? ''),
        };
      }

      const lootPriority = normalizeLootPriority(movement.lootPriority);
      let lootTaken = { wood: 0, stone: 0, iron: 0 };
      if (battle.attackerWins && Number(battle.attacker.survivorsTotal) > 0) {
        const survivingCaravans = Number(battle.attacker.survivors.caravan ?? 0);
        if (survivingCaravans > 0) {
          const carryingCapacity = survivingCaravans * 250;
          const defenderResources = selectResourcesByVillageStmt.get(Number(targetVillage.id));
          if (defenderResources) {
            const requestedLoot = calculateLootDistribution(defenderResources, lootPriority, carryingCapacity);
            if (requestedLoot.total > 0) {
              const subtraction = subtractResources(Number(targetVillage.id), requestedLoot.loot);
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
      const returnUnits = toCompleteUnitSelection(battle.attacker.survivors);
      if (conquestPayload?.conquered && Number(returnUnits[KNIGHT_UNIT_ID] ?? 0) > 0) {
        returnUnits[KNIGHT_UNIT_ID] = Math.max(0, Number(returnUnits[KNIGHT_UNIT_ID] ?? 0) - 1);
        conquestPayload.knightConsumed = true;
      }
      const attackerSurvivorsAfterConquestTotal = sumSelectedUnits(returnUnits);
      const shouldSpawnReturnMovement =
        attackerSurvivorsAfterConquestTotal > 0 && (battle.attackerWins || battle.blockedByGate === true);
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
      let attackTitle = blockedByGate
        ? `Utok odrazen branou: ${attackerName} -> ${targetVillage.name}`
        : `Bitva: ${attackerName} -> ${targetVillage.name}`;
      let attackSummary = blockedByGate
        ? attackerLossesTotal > 0
          ? `Brana zastavila utok bez beranidel. Utocnik ztratil ${attackerLossesTotal}/${totalSentUnits} jednotek a ustoupil.`
          : 'Brana zastavila utok bez beranidel. Utocnik ustoupil bez ztrat.'
        : `${outcomeLabelForAttacker}. Ztraty utocnika ${attackerLossesTotal}/${totalSentUnits}, obrance ${defenderLossesTotal}/${defenderStartTotal}.`;
      if (conquestPayload?.conquered) {
        attackTitle = `DobytÄ‚Â­ lÄ‚Â©na: ${targetVillage.name}`;
        attackSummary = `DobytÄ‚Â­ lÄ‚Â©na uspesne. ${targetVillage.name} prechazi pod vladu ${attackerName}.`;
        if (conquestPayload.knightConsumed) {
          attackSummary += ' Rytir osadu obsadil a po dobyti zmizel.';
        }
      } else if (conquestPayload?.blockedByVillageLimit) {
        attackSummary += ` DobytÄ‚Â­ se neprovedlo: dosazen limit ${MAX_PLAYER_VILLAGES} osad.`;
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
            },
          });
        }
        if (reportId != null) {
          generatedBattleReports += 1;
        }
      }

      if (defenderPlayer && Number(defenderPlayer.isBot ?? 0) !== 1) {
        const defenderOwnSurvivorsTotal = sumSelectedUnits(villageDefenseAfterLoss.survivors);
        const defenderForcesDestroyed = defenderOwnSurvivorsTotal <= 0;
        let defenseTitle = blockedByGate
          ? `Obrana: brana odrazila utok na ${targetVillage.name}`
          : `Obrana: ${targetVillage.name} celi utoku`;
        let defenseSummary = blockedByGate
          ? attackerLossesTotal > 0
            ? `Brana odrazila utok bez beranidel. Utocnik prisel o ${attackerLossesTotal}/${totalSentUnits} jednotek.`
            : 'Brana odrazila utok bez beranidel. Obrana neutrpela ztraty.'
          : defenderForcesDestroyed
            ? 'Obrana byla znicena. Vsechny obranne jednotky padly. Pocet jednotek utocnika je neznamy.'
            : `${outcomeLabelForDefender}. Ztraty obrance ${defenderLossesTotal}/${defenderStartTotal}, utocnik ${attackerLossesTotal}/${totalSentUnits}.`;
        if (conquestPayload?.conquered) {
          defenseTitle = `DobytÄ‚Â­ lÄ‚Â©na: ${targetVillage.name}`;
          defenseSummary = `Leno ${targetVillage.name} bylo dobyto hracem ${attackerName}.`;
        } else if (conquestPayload?.blockedByVillageLimit) {
          defenseSummary += ` Utocnik dosahl limitu ${MAX_PLAYER_VILLAGES} osad, dobytÄ‚Â­ se neprovedlo.`;
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
          attackerForcesUnknown: defenderForcesDestroyed,
          returnMovement: defenderForcesDestroyed ? undefined : returnMovementPayload ?? undefined,
          conquest: conquestPayload ?? undefined,
          battle: defenderForcesDestroyed
            ? {
                defenseMultiplier: battle.defenseMultiplier,
                bonuses: battle.bonuses,
                defender: {
                  start: battle.defender.start,
                  losses: battle.defender.losses,
                  survivors: battle.defender.survivors,
                  survivorsTotal: battle.defender.survivorsTotal,
                },
              }
            : battle,
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
          ? `Podpora v osade ${targetVillage.name} byla zcela znicena. Pocet jednotek utocnika je neznamy.`
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
            attackerForcesUnknown: supportForcesDestroyed,
            returnMovement: supportForcesDestroyed ? undefined : returnMovementPayload ?? undefined,
            conquest: conquestPayload ?? undefined,
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
      for (const unitRow of movementUnits) {
        const unitId = unitRow.unitId;
        const amount = Number(unitRow.amount);
        if (amount <= 0) {
          continue;
        }
        const currentAmountRow = selectUnitAmountByVillageAndUnitStmt.get(targetVillageId, unitId);
        const currentAmount = Number(currentAmountRow?.amount ?? 0);
        const finalAmount = amount;
        if (finalAmount > 0) {
          updateUnitAmountStmt.run(currentAmount + finalAmount, targetVillageId, unitId);
        }
      }
      villagesToRecalculatePrestige.add(targetVillageId);
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

  for (const villageId of villagesToRecalculatePrestige) {
    updateVillagePrestigeFromCurrentState(Number(villageId));
  }

  updateGameStateTickStmt.run(tickTimeIso);

  return {
    elapsedSec,
    processedVillages: villageRows.length,
    completedUpgrades: dueUpgrades.length,
    completedRecruitments: dueRecruitments.length,
    completedArmyMovements,
    stationedSupports,
    spawnedReturnMovements,
    generatedBattleReports,
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
  if (!player || String(player.password ?? '') !== normalizedPassword) {
    throw new GameRuleError('Neplatne prihlasovaci udaje.', 401);
  }

  let village = selectVillageByPlayerStmt.get(player.id);
  if (!village) {
    const villages = ensurePlayerHasVillageTransaction(Number(player.id), String(player.username));
    village = villages[0] ?? null;
  }
  if (!village) {
    throw new GameRuleError('Tento ucet nema zalozene leno.', 500);
  }

  return {
    username: player.username,
    village: {
      id: Number(village.id),
      name: village.name,
      kingdom: village.kingdom,
      coordX: Number(village.coordX),
      coordY: Number(village.coordY),
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

export const getVillageSnapshot = (username = 'Hayato', requestedVillageId = null, worldId = null) => {
  const { player, village, villages, world } = requireVillageForUser(username, requestedVillageId, worldId);
  const worldRegion = resolveWorldRegionDefinition(world);
  const resourcesRow = selectResourcesByVillageStmt.get(village.id);
  if (!resourcesRow) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }

  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(village.id));
  const townhallLevel = buildingLevels.townhall ?? 0;
  const resourceCap = calculateResourceCap(buildingLevels.warehouse ?? 0);
  const populationCap = calculatePopulationCap(buildingLevels['residential-quarter'] ?? 0);
  const populationUsed = calculatePopulationUsed(buildingLevels, unitCounts);
  const production = calculateProductionPerHour(buildingLevels, populationUsed, populationCap);
  const activeUpgrades = selectActiveUpgradesByVillageStmt.all(village.id);
  const activeUpgradeByBuilding = toActiveUpgradeByBuildingMap(activeUpgrades);
  const highestQueuedUpgradeLevelByBuilding = toHighestQueuedUpgradeLevelByBuildingMap(activeUpgrades);
  const activeRecruitments = selectActiveRecruitmentsByVillageStmt.all(village.id);
  const armyState = buildArmyState(player.id, village.id);
  const relevantArmyMovements = armyState.activeMovements.filter((movement) => movement.isRelatedToCurrentVillage);
  const relevantStationedSupports = armyState.stationedSupports.filter(
    (movement) => movement.isRelatedToCurrentVillage,
  );
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
  };

  const availablePopulation = Math.max(0, populationCap - populationUsed);
  const reservedPopulationForRecruitment = calculateReservedPopulationForRecruitments(activeRecruitments);
  const availablePopulationForRecruitment = calculateAvailablePopulationForRecruitment(
    populationCap,
    populationUsed,
    reservedPopulationForRecruitment,
  );
  const knightCapacity = getPlayerKnightCapacity(Number(player.id), Number(world.region));
  const playerKnightTotal = getPlayerKnightTotalInWorld(Number(player.id), Number(world.region));
  const remainingKnightCapacity = Math.max(0, knightCapacity - playerKnightTotal);

  const buildings = BUILDING_ORDER.map((buildingId) => {
    const def = BUILDING_DEFS[buildingId];
    const level = buildingLevels[buildingId] ?? 0;
    const effectiveLevel = Math.max(level, Number(highestQueuedUpgradeLevelByBuilding.get(buildingId) ?? level));
    const maxLevel = getMaxBuildingLevel(buildingId);
    const nextCost = calculateUpgradeCost(buildingId, effectiveLevel);
    const nextDurationSec =
      nextCost == null ? null : calculateUpgradeDurationSec(buildingId, effectiveLevel, townhallLevel);
    const workersUsed = (def.workerPerLevel ?? 0) * level;
    const activeUpgradeForBuilding = activeUpgradeByBuilding.get(buildingId) ?? null;
    const isInProgress = activeUpgradeForBuilding != null;
    let blockedReason = null;
    let canUpgrade = false;

    if (effectiveLevel >= maxLevel) {
      blockedReason = 'Maximalni uroven dosazena';
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
    const requiredBuildingLevel = buildingLevels[requiredBuildingId] ?? 0;
    const queuedCount = Number(activeRecruitmentCountByUnit[unitId] ?? 0);
    const maxByResources = calculateMaxRecruitableByResources(currentResources, def.cost);
    const unitPopulationCost = getUnitPopulationCost(unitId);
    const maxByPopulation = Math.max(0, Math.floor(availablePopulationForRecruitment / unitPopulationCost));
    const maxByKnightLimit = unitId === KNIGHT_UNIT_ID ? remainingKnightCapacity : Number.POSITIVE_INFINITY;
    const maxBySingleOrder = unitId === KNIGHT_UNIT_ID ? 1 : Number.POSITIVE_INFINITY;
    const maxRecruitable = Math.max(0, Math.min(maxByPopulation, maxByResources, maxByKnightLimit, maxBySingleOrder));

    let blockedReason = null;
    let canRecruit = false;
    if (requiredBuildingLevel < 1) {
      blockedReason = `Vybuduj ${BUILDING_DEFS[requiredBuildingId].name}`;
    } else if (unitId === KNIGHT_UNIT_ID && remainingKnightCapacity <= 0) {
      blockedReason = 'Limit rytiru podle poctu osad je vycerpan';
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

  if (relevantStationedSupports.length > 0) {
    for (const support of relevantStationedSupports) {
      const unitsTotal = support.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
      activeOrders.push(`Armada: Podpora stacionovana v ${support.targetName} (${unitsTotal} jednotek)`);
    }
  }

  activeOrders.push('Ekonomika jede v realnem case podle cron ticku.');
  activeOrders.push('Nabor i vystavba bezi oddelene pro kazde leno.');

  const activeUpgrade = activeUpgrades.length > 0 ? activeUpgrades[0] : null;
  const settlements = buildWorldSettlements(village, player.username, world);
  const leaderboard = listPlayerLeaderboard(world.id);
  const kingdomHub = buildKingdomHubState(player, village);

  return {
    serverTime: nowIso(),
    player: {
      id: Number(player.id),
      username: player.username,
    },
    kingdomHub,
    villages: villages.map((entry) => ({
      id: Number(entry.id),
      name: entry.name,
      coordX: Number(entry.coordX),
      coordY: Number(entry.coordY),
      region: Number(entry.region),
      kingdom: entry.kingdom,
      prestige: Number(entry.prestige),
      loyalty: Number(entry.loyalty),
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
    },
    world: {
      id: String(world.id),
      name: String(world.name),
      region: Number(worldRegion.id),
      originX: Number(worldRegion.originX),
      originY: Number(worldRegion.originY),
      size: Number(worldRegion.size),
      settlements,
      kingdoms: buildKingdomStats(settlements),
    },
    resources: {
      wood: Math.floor(currentResources.wood),
      stone: Math.floor(currentResources.stone),
      iron: Math.floor(currentResources.iron),
      cap: resourceCap,
      productionPerHour: {
        wood: Number(production.wood.toFixed(2)),
        stone: Number(production.stone.toFixed(2)),
        iron: Number(production.iron.toFixed(2)),
        penalty: Number(production.penalty.toFixed(2)),
      },
    },
    population: {
      used: populationUsed,
      cap: populationCap,
      available: availablePopulation,
    },
    buildings,
    units,
    leaderboard,
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
    const arriveAtIso = new Date(Date.parse(issuedAtIso) + durationSec * 1000).toISOString();
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
      durationSec,
      arriveAt: arriveAtIso,
    };
  }

  const targetVillageId = requirePositiveInteger(payload?.targetVillageId, 'targetVillageId');
  const targetVillage = selectVillageWithOwnerByIdStmt.get(targetVillageId);
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
    if (spawnConfig.playerProtectionDays > 0) {
      const isTargetAbandoned = Number(targetVillage.ownerIsBot) === 1;
      if (!isTargetAbandoned && isVillageUnderSpawnProtection(village)) {
        throw new GameRuleError(
          'Jsi pod novackou ochranou. Po dobu 5 dni muzes utocit jen na opustene osady.',
          403,
        );
      }
      if (!isTargetAbandoned && isVillageUnderSpawnProtection(targetVillage)) {
        throw new GameRuleError(
          'Cilovy hrac je pod novackou ochranou. Utok je po dobu 5 dni blokovan.',
          403,
        );
      }
    }
  }

  const selectedUnits = parseArmyUnitSelection(payload?.units);
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
  const arriveAtIso = new Date(Date.parse(issuedAtIso) + durationSec * 1000).toISOString();

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

  return {
    orderId: movementId,
    commandType,
    originVillageId: Number(village.id),
    targetVillageId: Number(targetVillage.id),
    totalUnits,
    totalCost: sumSelectedCost(selectedUnits),
    distanceTiles,
    durationSec,
    arriveAt: arriveAtIso,
    lootPriority,
  };
});

const startUpgradeTransaction = db.transaction((username, buildingId, startedAtIso, requestedVillageId) => {
  const { village } = requireVillageForUser(username, requestedVillageId);
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const currentLevel = buildingLevels[buildingId];
  if (currentLevel == null) {
    throw new GameRuleError('Neznama budova.');
  }
  const maxLevel = getMaxBuildingLevel(buildingId);
  const queuedUpgradesForBuilding = selectActiveUpgradesByVillageAndBuildingStmt.all(village.id, buildingId);
  const queuedHighestLevel = queuedUpgradesForBuilding.reduce(
    (maxQueuedLevel, upgrade) => Math.max(maxQueuedLevel, Number(upgrade.toLevel ?? currentLevel)),
    currentLevel,
  );
  if (queuedHighestLevel >= maxLevel) {
    throw new GameRuleError('Budova je na maximalni urovni.');
  }

  const resources = selectResourcesByVillageStmt.get(village.id);
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
  const queueTailFinishMs = queuedUpgradesForBuilding.reduce((latestFinishMs, upgrade) => {
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
    village.id,
  );

  insertUpgradeStmt.run(
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

  return {
    buildingId,
    fromLevel: effectiveFromLevel,
    toLevel: effectiveFromLevel + 1,
    cost,
    durationSec,
    startedAt: queueStartIso,
    finishAt: finishAtIso,
  };
});

export const startBuildingUpgrade = (username, buildingId, requestedVillageId = null) => {
  const startedAtIso = nowIso();
  return startUpgradeTransaction(username, buildingId, startedAtIso, requestedVillageId);
};

const cancelBuildingUpgradeTransaction = db.transaction((username, upgradeIdRaw, requestedVillageId) => {
  const { village } = requireVillageForUser(username, requestedVillageId);
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

  addResourcesWithoutCap(Number(village.id), refunded);

  return {
    canceledUpgradeId: Number(targetUpgrade.id),
    buildingId: String(targetUpgrade.buildingId),
    canceledCount: queueSlice.length,
    refunded,
  };
});

export const cancelBuildingUpgrade = (username, upgradeId, requestedVillageId = null) =>
  cancelBuildingUpgradeTransaction(username, upgradeId, requestedVillageId);

const conquerVillageTransaction = db.transaction((username, villageIdRaw) => {
  const { player } = requireVillageForUser(username);
  const villageId = requirePositiveInteger(villageIdRaw, 'villageId');
  const targetVillage = selectVillageForConquestStmt.get(villageId);
  if (!targetVillage) {
    throw new GameRuleError('Cilova osada neexistuje.', 404);
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

  const playerVillageCount = getPlayerVillageCount(Number(player.id));
  if (playerVillageCount >= MAX_PLAYER_VILLAGES) {
    throw new GameRuleError(`Byl dosazen limit ${MAX_PLAYER_VILLAGES} osad.`, 400);
  }

  const kingdomRow = selectPrimaryKingdomByPlayerStmt.get(Number(player.id));
  const conquerorKingdom = String(kingdomRow?.kingdom ?? 'Neutral');

  updateVillageOwnerForConquestStmt.run(Number(player.id), conquerorKingdom, villageId);

  return {
    villageId,
    villageName: targetVillage.name,
    previousOwner: targetVillage.ownerUsername,
    newOwner: player.username,
    renamed: false,
  };
});

export const conquerVillage = (username, villageId) => conquerVillageTransaction(username, villageId);
export const restartVillageProgress = (username) => restartVillageProgressTransaction(username);
export const createAbandonedVillages = (count = 1) => createAbandonedVillagesTransaction(count);

const requireKingdomLeadership = (player, kingdomName) => {
  if (isNeutralKingdom(kingdomName)) {
    throw new GameRuleError('Nejsi clenem zadneho kralovstvi.', 400);
  }

  const leader = resolveKingdomLeader(kingdomName);
  if (!leader || Number(leader.playerId) !== Number(player.id)) {
    throw new GameRuleError('Pouze vudce kralovstvi muze provest tuto akci.', 403);
  }

  return leader;
};

const validateKingdomName = (rawValue) => {
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
    .all()
    .map((row) => String(row.kingdom))
    .find((kingdomName) => normalizeKingdomComparable(kingdomName) === normalizedComparable);
  if (existing) {
    throw new GameRuleError('KrÄ‚Ë‡lovstvÄ‚Â­ s tÄ‚Â­mto nÄ‚Ë‡zvem uÄąÄľ existuje.', 400);
  }

  return normalized;
};

const createKingdomTransaction = db.transaction((username, kingdomNameRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const currentKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  if (!isNeutralKingdom(currentKingdom)) {
    throw new GameRuleError('UÄąÄľ jsi Ă„Ĺ¤lenem krÄ‚Ë‡lovstvÄ‚Â­. Nejprve musÄ‚Â­ÄąË‡ odejÄ‚Â­t.', 400);
  }

  const kingdomName = validateKingdomName(kingdomNameRaw);
  updateVillagesKingdomByPlayerStmt.run(kingdomName, Number(player.id));
  const respondedAt = nowIso();
  rejectAllPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(player.id));
  createKingdomEvent({
    kingdom: kingdomName,
    eventType: 'kingdom_created',
    actorPlayerId: Number(player.id),
    payload: { founderUsername: player.username },
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
  const inviterKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  requireKingdomLeadership(player, inviterKingdom);

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

  const targetKingdom = resolvePrimaryKingdomByPlayerId(Number(targetPlayer.id));
  if (!isNeutralKingdom(targetKingdom)) {
    throw new GameRuleError('Cilovy hrac uz je clenem jineho kralovstvi.', 400);
  }

  const existingInvite = selectPendingKingdomInviteByTargetStmt.get(Number(targetPlayer.id));
  if (existingInvite) {
    throw new GameRuleError('Cilovy hrac uz ma aktivni pozvanku.', 400);
  }

  const createdAt = nowIso();
  const insertion = insertKingdomInviteStmt.run(
    inviterKingdom,
    Number(player.id),
    Number(targetPlayer.id),
    createdAt,
  );
  const inviteId = Number(insertion.lastInsertRowid);
  createKingdomEvent({
    kingdom: inviterKingdom,
    eventType: 'invite_sent',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(targetPlayer.id),
    payload: { inviteId },
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
  const inviteId = requirePositiveInteger(inviteIdRaw, 'inviteId');

  if (!isNeutralKingdom(village.kingdom)) {
    throw new GameRuleError('Uz jsi clenem kralovstvi. Nejdrive odejdi.', 400);
  }

  const invite = selectPendingKingdomInviteByIdForTargetStmt.get(inviteId, Number(player.id));
  if (!invite) {
    throw new GameRuleError('Pozvanka nebyla nalezena nebo uz neni aktivni.', 404);
  }

  const targetKingdom = normalizeKingdomValue(invite.kingdom) || 'Neutral';
  if (isNeutralKingdom(targetKingdom)) {
    updateKingdomInviteStatusByIdStmt.run('rejected', nowIso(), inviteId);
    throw new GameRuleError('Pozvanka odkazuje na neplatne kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run(targetKingdom, Number(player.id));
  const respondedAt = nowIso();
  updateKingdomInviteStatusByIdStmt.run('accepted', respondedAt, inviteId);
  rejectOtherPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(player.id), inviteId);
  createKingdomEvent({
    kingdom: targetKingdom,
    eventType: 'invite_accepted',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(invite.inviterPlayerId),
    payload: { inviteId },
  });

  return {
    inviteId,
    kingdom: targetKingdom,
    inviterUsername: String(invite.inviterUsername),
    acceptedAt: respondedAt,
  };
});

const rejectKingdomInviteTransaction = db.transaction((username, inviteIdRaw, requestedVillageId = null, worldId = null) => {
  const { player } = requireVillageForUser(username, requestedVillageId, worldId);
  const inviteId = requirePositiveInteger(inviteIdRaw, 'inviteId');
  const invite = selectPendingKingdomInviteByIdForTargetStmt.get(inviteId, Number(player.id));
  if (!invite) {
    throw new GameRuleError('Pozvanka nebyla nalezena nebo uz neni aktivni.', 404);
  }

  const respondedAt = nowIso();
  updateKingdomInviteStatusByIdStmt.run('rejected', respondedAt, inviteId);
  createKingdomEvent({
    kingdom: String(invite.kingdom),
    eventType: 'invite_rejected',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(invite.inviterPlayerId),
    payload: { inviteId },
  });
  return {
    inviteId,
    kingdom: String(invite.kingdom),
    rejectedAt: respondedAt,
  };
});

const leaveKingdomTransaction = db.transaction((username, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const currentKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  if (isNeutralKingdom(currentKingdom)) {
    throw new GameRuleError('Nejsi clenem zadneho kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run('Neutral', Number(player.id));
  const respondedAt = nowIso();
  cancelPendingKingdomInvitesByInviterStmt.run(respondedAt, Number(player.id));
  createKingdomEvent({
    kingdom: currentKingdom,
    eventType: 'member_left',
    actorPlayerId: Number(player.id),
  });

  return {
    username: player.username,
    previousKingdom: currentKingdom,
    leftAt: respondedAt,
  };
});

const kickKingdomMemberTransaction = db.transaction((username, targetUsernameRaw, requestedVillageId = null, worldId = null) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId, worldId);
  const managerKingdom = normalizeKingdomValue(village.kingdom) || 'Neutral';
  requireKingdomLeadership(player, managerKingdom);

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

  const targetKingdom = resolvePrimaryKingdomByPlayerId(Number(targetPlayer.id));
  if (String(targetKingdom) !== String(managerKingdom)) {
    throw new GameRuleError('Cilovy hrac neni clenem tveho kralovstvi.', 400);
  }

  updateVillagesKingdomByPlayerStmt.run('Neutral', Number(targetPlayer.id));
  const respondedAt = nowIso();
  rejectAllPendingKingdomInvitesForTargetStmt.run(respondedAt, Number(targetPlayer.id));
  cancelPendingKingdomInvitesByInviterStmt.run(respondedAt, Number(targetPlayer.id));
  createKingdomEvent({
    kingdom: managerKingdom,
    eventType: 'member_kicked',
    actorPlayerId: Number(player.id),
    targetPlayerId: Number(targetPlayer.id),
  });

  return {
    kickedUsername: String(targetPlayer.username),
    kingdom: managerKingdom,
    kickedAt: respondedAt,
  };
});

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

const recruitTransaction = db.transaction((username, unitId, amount, requestedVillageId) => {
  const { player, village } = requireVillageForUser(username, requestedVillageId);
  const unitDef = UNIT_DEFS[unitId];
  if (!unitDef) {
    throw new GameRuleError('Neznama jednotka.');
  }

  const recruitAmount = requirePositiveInteger(amount, 'amount');
  const buildingLevels = toBuildingLevelMap(selectBuildingsByVillageStmt.all(village.id));
  const unitCounts = toUnitCountMap(selectUnitsByVillageStmt.all(village.id));
  const resources = selectResourcesByVillageStmt.get(village.id);
  if (!resources) {
    throw new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }

  const requiredLevel = buildingLevels[unitDef.requiredBuilding] ?? 0;
  if (requiredLevel < 1) {
    throw new GameRuleError(`Pro nabor chybi budova ${BUILDING_DEFS[unitDef.requiredBuilding].name}.`);
  }

  const currentAmount = unitCounts[unitId] ?? 0;
  const activeRecruitments = selectActiveRecruitmentsByVillageStmt.all(village.id);
  const queuedCountForUnit = activeRecruitments
    .filter((recruitment) => recruitment.unitId === unitId)
    .reduce((sum, recruitment) => sum + Number(recruitment.amount), 0);
  const populationCap = calculatePopulationCap(buildingLevels['residential-quarter'] ?? 0);
  const populationUsed = calculatePopulationUsed(buildingLevels, unitCounts);
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

  if (unitId === KNIGHT_UNIT_ID) {
    const knightCapacity = getPlayerKnightCapacity(Number(player.id), Number(village.region));
    const playerKnightTotal = getPlayerKnightTotalInWorld(Number(player.id), Number(village.region));
    if (playerKnightTotal >= knightCapacity) {
      throw new GameRuleError('Limit rytiru podle poctu osad je vycerpan.');
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
    village.id,
  );
  const startedAtIso = nowIso();
  const durationSec = calculateRecruitDurationSec(unitId, recruitAmount, requiredLevel);
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

const cancelRecruitmentTransaction = db.transaction((username, recruitmentIdRaw, requestedVillageId) => {
  const { village } = requireVillageForUser(username, requestedVillageId);
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

const recallKnightTransaction = db.transaction((username, requestedVillageId) => {
  const { village } = requireVillageForUser(username, requestedVillageId);
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

export const recruitUnits = (username, unitId, amount, requestedVillageId = null) =>
  recruitTransaction(username, unitId, amount, requestedVillageId);

export const cancelRecruitment = (username, recruitmentId, requestedVillageId = null) =>
  cancelRecruitmentTransaction(username, recruitmentId, requestedVillageId);

export const recallKnight = (username, requestedVillageId = null) =>
  recallKnightTransaction(username, requestedVillageId);

export const issueArmyCommand = (username, payload, requestedVillageId = null, worldId = null) =>
  issueArmyCommandTransaction(username, requestedVillageId, payload, worldId);

export { GameRuleError };

