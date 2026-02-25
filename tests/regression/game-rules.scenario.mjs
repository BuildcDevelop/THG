import { conquerVillage, getVillageSnapshot, issueArmyCommand, runGameTick } from '../../server/gameService.js';
import { db } from '../../server/db.js';
import { MAX_PLAYER_VILLAGES, UNIT_ORDER } from '../../server/gameConfig.js';

const ATTACKER_USERNAME = 'Hayato';
const DEFENDER_USERNAME = 'Torreya';
const WORLD_PRIMARY = 'dominion-1';
const WORLD_FIRE = 'dominion-1-fire';
const REGION_PRIMARY = 1;
const REGION_FIRE = 2;
const KINGDOM_ATTACKER = 'Aurora Pact';
const KINGDOM_DEFENDER = 'Neutral';

const selectPlayerByUsernameStmt = db.prepare(
  `SELECT id, username
   FROM players
   WHERE username = ? COLLATE NOCASE
   LIMIT 1`,
);
const selectVillageIdsByRegionStmt = db.prepare(
  `SELECT id
   FROM villages
   WHERE region = ?
   ORDER BY id ASC`,
);
const selectVillageCountByPlayerAndRegionStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM villages
   WHERE player_id = ? AND region = ?`,
);
const selectBattleReportsByPlayerStmt = db.prepare(
  `SELECT id, payload_json AS payloadJson
   FROM battle_reports
   WHERE player_id = ?
   ORDER BY id DESC
   LIMIT 100`,
);
const selectBuildingLevelStmt = db.prepare(
  `SELECT level
   FROM buildings
   WHERE village_id = ? AND building_id = ?
   LIMIT 1`,
);
const upsertUnitStmt = db.prepare(
  `INSERT INTO units (village_id, unit_id, amount)
   VALUES (?, ?, ?)
   ON CONFLICT(village_id, unit_id)
   DO UPDATE SET amount = excluded.amount`,
);
const upsertBuildingStmt = db.prepare(
  `INSERT INTO buildings (village_id, building_id, level)
   VALUES (?, ?, ?)
   ON CONFLICT(village_id, building_id)
   DO UPDATE SET level = excluded.level`,
);
const upsertResourceStmt = db.prepare(
  `INSERT INTO resources (village_id, wood, stone, iron)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(village_id)
   DO UPDATE SET
     wood = excluded.wood,
     stone = excluded.stone,
     iron = excluded.iron`,
);
const updateVillageOwnerStmt = db.prepare(
  `UPDATE villages
   SET player_id = ?, kingdom = ?, loyalty = 100
   WHERE id = ?`,
);
const updateMovementArrivalStmt = db.prepare(
  `UPDATE army_movements
   SET arrive_at = ?
   WHERE id = ?`,
);

const emptySelection = () => Object.fromEntries(UNIT_ORDER.map((unitId) => [unitId, 0]));
const toCompleteSelection = (partialSelection = {}) => {
  const complete = emptySelection();
  for (const unitId of UNIT_ORDER) {
    complete[unitId] = Math.max(0, Math.floor(Number(partialSelection[unitId] ?? 0)));
  }
  return complete;
};
const sumSelection = (selection = {}) =>
  UNIT_ORDER.reduce((sum, unitId) => sum + Math.max(0, Math.floor(Number(selection[unitId] ?? 0))), 0);
const getPlayer = (username) => {
  const player = selectPlayerByUsernameStmt.get(String(username));
  if (!player) {
    throw new Error(`Player '${username}' not found.`);
  }
  return { id: Number(player.id), username: String(player.username) };
};
const getVillageForPlayerInWorld = (username, worldId) => {
  const snapshot = getVillageSnapshot(username, null, worldId);
  return {
    villageId: Number(snapshot.village.id),
    worldId: String(snapshot.world.id),
    region: Number(snapshot.village.region),
  };
};
const clearTransientState = () => {
  db.exec(`
    DELETE FROM army_movement_units;
    DELETE FROM army_movements;
    DELETE FROM battle_reports;
    DELETE FROM unit_recruitments;
    DELETE FROM building_upgrades;
  `);
};
const setVillageUnits = (villageId, unitSelection = {}) => {
  const normalized = toCompleteSelection(unitSelection);
  for (const unitId of UNIT_ORDER) {
    upsertUnitStmt.run(Number(villageId), unitId, Number(normalized[unitId]));
  }
};
const setVillageBuildings = (villageId, buildingLevels = {}) => {
  for (const [buildingId, rawLevel] of Object.entries(buildingLevels)) {
    const level = Math.max(0, Math.floor(Number(rawLevel ?? 0)));
    upsertBuildingStmt.run(Number(villageId), String(buildingId), level);
  }
};
const setVillageResources = (villageId, resources) => {
  const wood = Math.max(0, Math.floor(Number(resources?.wood ?? 0)));
  const stone = Math.max(0, Math.floor(Number(resources?.stone ?? 0)));
  const iron = Math.max(0, Math.floor(Number(resources?.iron ?? 0)));
  upsertResourceStmt.run(Number(villageId), wood, stone, iron);
};
const findAttackerPayloadByMovement = (username, movementId) => {
  const player = getPlayer(username);
  const reportRows = selectBattleReportsByPlayerStmt.all(Number(player.id));
  for (const row of reportRows) {
    try {
      const payload = JSON.parse(String(row.payloadJson ?? '{}'));
      if (Number(payload?.movementId) === Number(movementId) && String(payload?.perspective) === 'attacker') {
        return payload;
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Attacker report for movement ${movementId} was not found.`);
};
const forceMovementArrivalNow = (movementId) => {
  const pastIso = new Date(Date.now() - 60 * 1000).toISOString();
  updateMovementArrivalStmt.run(pastIso, Number(movementId));
};
const runAttackAndGetPayload = ({
  username,
  originVillageId,
  targetVillageId,
  units,
  lootPriority,
}) => {
  const commandPayload = {
    commandType: 'attack',
    targetVillageId: Number(targetVillageId),
    units: toCompleteSelection(units),
  };
  if (lootPriority != null) {
    commandPayload.lootPriority = lootPriority;
  }

  const order = issueArmyCommand(
    username,
    commandPayload,
    Number(originVillageId),
  );
  forceMovementArrivalNow(Number(order.orderId));
  runGameTick();
  const payload = findAttackerPayloadByMovement(username, Number(order.orderId));
  return { orderId: Number(order.orderId), payload };
};
const getBuildingLevel = (villageId, buildingId) =>
  Math.max(0, Math.floor(Number(selectBuildingLevelStmt.get(Number(villageId), String(buildingId))?.level ?? 0)));
const assignVillageOwners = (villageIds, playerId, kingdom) => {
  for (const villageId of villageIds) {
    updateVillageOwnerStmt.run(Number(playerId), String(kingdom), Number(villageId));
  }
};
const getVillageCountInRegion = (playerId, region) =>
  Math.max(0, Math.floor(Number(selectVillageCountByPlayerAndRegionStmt.get(Number(playerId), Number(region))?.total ?? 0)));
const getVillageIdsInRegion = (region) =>
  selectVillageIdsByRegionStmt.all(Number(region)).map((row) => Number(row.id));

const runScenarioEmptyFortifiedNoLoss = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 30, caravan: 2 });
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 5, gate: 1 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 30, caravan: 2 },
  });

  return {
    blockedByGate: Boolean(payload?.gateBlocked),
    attackerLossesTotal: sumSelection(payload?.battle?.attacker?.losses ?? {}),
    attackerSurvivors: payload?.battle?.attacker?.survivors ?? {},
    returnUnits: payload?.returnMovement?.units ?? {},
  };
};

const runScenarioRamBreaksGate = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 20, ram: 1 });
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 5, gate: 1 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 20, ram: 1 },
  });
  const gateLevelAfter = getBuildingLevel(defenderVillage.villageId, 'gate');

  return {
    attackerWins: Boolean(payload?.battle?.attackerWins),
    gate: payload?.battle?.gate ?? {},
    gateLevelAfter,
    attackerSurvivors: payload?.battle?.attacker?.survivors ?? {},
    returnUnits: payload?.returnMovement?.units ?? {},
  };
};

const runScenarioMixedScoutAttackAndLoot = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 1, scout: 5 });
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
  setVillageResources(defenderVillage.villageId, { wood: 300, stone: 300, iron: 300 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 1, scout: 5 },
    lootPriority: 'balanced',
  });
  const lootTaken = payload?.lootTaken ?? { wood: 0, stone: 0, iron: 0 };

  return {
    attackerStart: payload?.battle?.attacker?.start ?? {},
    attackerSurvivors: payload?.battle?.attacker?.survivors ?? {},
    lootTaken,
    totalLoot: Number(lootTaken.wood ?? 0) + Number(lootTaken.stone ?? 0) + Number(lootTaken.iron ?? 0),
  };
};

const runScenarioLootCapacity = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  const attackUnits = {
    militia: 1,
    archer: 1,
    cavalry: 1,
    scout: 1,
    ram: 1,
    caravan: 1,
  };
  setVillageUnits(attackerVillage.villageId, attackUnits);
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
  setVillageResources(defenderVillage.villageId, { wood: 800, stone: 800, iron: 800 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: attackUnits,
    lootPriority: 'balanced',
  });
  const lootTaken = payload?.lootTaken ?? { wood: 0, stone: 0, iron: 0 };

  return {
    lootTaken,
    totalLoot: Number(lootTaken.wood ?? 0) + Number(lootTaken.stone ?? 0) + Number(lootTaken.iron ?? 0),
    survivors: payload?.battle?.attacker?.survivors ?? {},
  };
};

const runScenarioDefaultBalancedLootPriority = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 2 });
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
  setVillageResources(defenderVillage.villageId, { wood: 100, stone: 100, iron: 100 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 2 },
  });
  const lootTaken = payload?.lootTaken ?? { wood: 0, stone: 0, iron: 0 };
  const lootValues = [Number(lootTaken.wood ?? 0), Number(lootTaken.stone ?? 0), Number(lootTaken.iron ?? 0)];
  const minLoot = Math.min(...lootValues);
  const maxLoot = Math.max(...lootValues);

  return {
    reportedLootPriority: String(payload?.lootPriority ?? ''),
    lootTaken,
    totalLoot: lootValues.reduce((sum, value) => sum + value, 0),
    lootSpread: maxLoot - minLoot,
  };
};

const runScenarioWorldVillageLimit = () => {
  clearTransientState();
  const attacker = getPlayer(ATTACKER_USERNAME);
  const defender = getPlayer(DEFENDER_USERNAME);

  const attackerPrimary = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const attackerFire = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_FIRE);
  getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);
  getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_FIRE);

  const regionPrimaryVillageIds = getVillageIdsInRegion(REGION_PRIMARY);
  const regionFireVillageIds = getVillageIdsInRegion(REGION_FIRE);
  if (regionPrimaryVillageIds.length < 6 || regionFireVillageIds.length < 8) {
    throw new Error('Not enough villages in regions to validate village-limit scenarios.');
  }

  const primaryOwnedByAttacker = [attackerPrimary.villageId, ...regionPrimaryVillageIds.filter(
    (villageId) => villageId !== attackerPrimary.villageId,
  ).slice(0, 5)];
  assignVillageOwners(primaryOwnedByAttacker, attacker.id, KINGDOM_ATTACKER);

  assignVillageOwners(regionFireVillageIds, defender.id, KINGDOM_DEFENDER);
  assignVillageOwners([attackerFire.villageId], attacker.id, KINGDOM_ATTACKER);

  const fireTargetForSuccess = regionFireVillageIds.find((villageId) => villageId !== attackerFire.villageId);
  if (fireTargetForSuccess == null) {
    throw new Error('No target village available for first fire-world conquest attempt.');
  }
  const firstConquest = conquerVillage(
    ATTACKER_USERNAME,
    Number(fireTargetForSuccess),
    Number(attackerFire.villageId),
    WORLD_FIRE,
  );
  const fireCountAfterSuccess = getVillageCountInRegion(attacker.id, REGION_FIRE);

  assignVillageOwners(regionFireVillageIds, defender.id, KINGDOM_DEFENDER);
  const fireOwnedByAttacker = [attackerFire.villageId, ...regionFireVillageIds.filter(
    (villageId) => villageId !== attackerFire.villageId,
  ).slice(0, 5)];
  assignVillageOwners(fireOwnedByAttacker, attacker.id, KINGDOM_ATTACKER);

  const fireTargetForBlocked = regionFireVillageIds.find((villageId) => !fireOwnedByAttacker.includes(villageId));
  if (fireTargetForBlocked == null) {
    throw new Error('No target village available for blocked fire-world conquest attempt.');
  }

  let blockedError = null;
  try {
    conquerVillage(
      ATTACKER_USERNAME,
      Number(fireTargetForBlocked),
      Number(attackerFire.villageId),
      WORLD_FIRE,
    );
  } catch (error) {
    blockedError = String(error?.message ?? error);
  }

  return {
    maxPlayerVillages: MAX_PLAYER_VILLAGES,
    primaryCount: getVillageCountInRegion(attacker.id, REGION_PRIMARY),
    fireCountAfterSuccess,
    fireCountBeforeBlockedAttempt: getVillageCountInRegion(attacker.id, REGION_FIRE),
    firstConquest,
    blockedError,
  };
};

const runScenarioLargeArmyBalance = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 200 });
  setVillageUnits(defenderVillage.villageId, { militia: 5 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 200 },
  });

  return {
    attackerWins: Boolean(payload?.battle?.attackerWins),
    attackerLossRatio: Number(payload?.battle?.attackerLossRatio ?? 0),
    defenderLossRatio: Number(payload?.battle?.defenderLossRatio ?? 0),
    attackerLossesTotal: sumSelection(payload?.battle?.attacker?.losses ?? {}),
    defenderLossesTotal: sumSelection(payload?.battle?.defender?.losses ?? {}),
  };
};

const scenarioName = String(process.argv[2] ?? '').trim();
const scenarioHandlers = new Map([
  ['empty-fortified-no-loss', runScenarioEmptyFortifiedNoLoss],
  ['ram-breaks-gate', runScenarioRamBreaksGate],
  ['mixed-scout-attack-loot', runScenarioMixedScoutAttackAndLoot],
  ['loot-capacity-all-units', runScenarioLootCapacity],
  ['default-balanced-loot-priority', runScenarioDefaultBalancedLootPriority],
  ['world-village-limit', runScenarioWorldVillageLimit],
  ['large-army-balance', runScenarioLargeArmyBalance],
]);

const handler = scenarioHandlers.get(scenarioName);
if (!handler) {
  console.error(`Unknown scenario '${scenarioName}'.`);
  process.exit(2);
}

try {
  const result = handler();
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error);
  process.exit(1);
}
