import { conquerVillage, getVillageSnapshot, issueArmyCommand, recruitUnits, runGameTick } from '../../server/gameService.js';
import { db } from '../../server/db.js';
import { UNIT_ORDER } from '../../server/gameConfig.js';
import { listCommunicationInbox, sendCommunicationMessage } from '../../server/communicationService.js';

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
const updateVillagePrestigeByPlayerRegionStmt = db.prepare(
  `UPDATE villages
   SET prestige = ?
   WHERE player_id = ?
     AND region = ?`,
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
const sumSelectionWithoutCaravans = (selection = {}) =>
  UNIT_ORDER.reduce((sum, unitId) => {
    if (unitId === 'caravan') {
      return sum;
    }
    return sum + Math.max(0, Math.floor(Number(selection[unitId] ?? 0)));
  }, 0);
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
    DELETE FROM combat_retaliation_flags;
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

const runScenarioScoutComboAttackMatrix = () => {
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);
  const defenderPlayer = getPlayer(DEFENDER_USERNAME);
  const combos = ['militia', 'archer', 'cavalry', 'knight', 'ram', 'caravan'];
  const comboResults = [];

  for (const unitId of combos) {
    clearTransientState();
    updateVillageOwnerStmt.run(Number(defenderPlayer.id), KINGDOM_DEFENDER, Number(defenderVillage.villageId));
    setVillageUnits(attackerVillage.villageId, { scout: 5, [unitId]: 3 });
    setVillageUnits(defenderVillage.villageId, {});
    setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
    setVillageResources(defenderVillage.villageId, { wood: 1200, stone: 1200, iron: 1200 });

    try {
      const { payload } = runAttackAndGetPayload({
        username: ATTACKER_USERNAME,
        originVillageId: attackerVillage.villageId,
        targetVillageId: defenderVillage.villageId,
        units: { scout: 5, [unitId]: 3 },
        lootPriority: 'balanced',
      });

      const attackerStart = payload?.battle?.attacker?.start ?? {};
      const attackerSurvivors = payload?.battle?.attacker?.survivors ?? {};
      const lootTaken = payload?.lootTaken ?? { wood: 0, stone: 0, iron: 0 };
      comboResults.push({
        unitId,
        orderAccepted: true,
        sentScout: Number(attackerStart.scout ?? 0),
        sentPartner: Number(attackerStart[unitId] ?? 0),
        survivingScouts: Number(attackerSurvivors.scout ?? 0),
        survivingPartner: Number(attackerSurvivors[unitId] ?? 0),
        totalLoot: Number(lootTaken.wood ?? 0) + Number(lootTaken.stone ?? 0) + Number(lootTaken.iron ?? 0),
      });
    } catch (error) {
      comboResults.push({
        unitId,
        orderAccepted: false,
        error: String(error?.message ?? error),
      });
    }
  }

  clearTransientState();
  updateVillageOwnerStmt.run(Number(defenderPlayer.id), KINGDOM_DEFENDER, Number(defenderVillage.villageId));
  setVillageUnits(attackerVillage.villageId, { scout: 7 });
  setVillageUnits(defenderVillage.villageId, { scout: 2 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });

  const { payload: scoutOnlyPayload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { scout: 7 },
    lootPriority: 'balanced',
  });

  return {
    combos: comboResults,
    scoutOnly: {
      isSpy: Boolean(scoutOnlyPayload?.spy),
      sentScout: Number(scoutOnlyPayload?.spy?.attackerScouts?.start ?? 0),
      scoutLosses: Number(scoutOnlyPayload?.spy?.attackerScouts?.losses ?? 0),
      scoutSurvivors: Number(scoutOnlyPayload?.spy?.attackerScouts?.survivors ?? 0),
    },
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

const runScenarioCaravanBinaryCasualties = () => {
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);
  const defender = getPlayer(DEFENDER_USERNAME);

  clearTransientState();
  updateVillageOwnerStmt.run(Number(defender.id), KINGDOM_DEFENDER, Number(defenderVillage.villageId));
  setVillageUnits(attackerVillage.villageId, { militia: 60, caravan: 4 });
  setVillageUnits(defenderVillage.villageId, { militia: 25 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
  const { payload: survivorPayload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 60, caravan: 4 },
    lootPriority: 'balanced',
  });

  clearTransientState();
  updateVillageOwnerStmt.run(Number(defender.id), KINGDOM_DEFENDER, Number(defenderVillage.villageId));
  setVillageUnits(attackerVillage.villageId, { militia: 8, caravan: 4 });
  setVillageUnits(defenderVillage.villageId, { militia: 180, archer: 80 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 3, gate: 0 });
  const { payload: wipedPayload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { militia: 8, caravan: 4 },
    lootPriority: 'balanced',
  });

  const survivingArmy = survivorPayload?.battle?.attacker?.survivors ?? {};
  const wipedArmy = wipedPayload?.battle?.attacker?.survivors ?? {};
  return {
    survivorCase: {
      attackerWins: Boolean(survivorPayload?.battle?.attackerWins),
      sentCaravans: Number(survivorPayload?.battle?.attacker?.start?.caravan ?? 0),
      survivingCaravans: Number(survivingArmy.caravan ?? 0),
      survivingCombatUnits: sumSelectionWithoutCaravans(survivingArmy),
    },
    wipedCase: {
      attackerWins: Boolean(wipedPayload?.battle?.attackerWins),
      sentCaravans: Number(wipedPayload?.battle?.attacker?.start?.caravan ?? 0),
      survivingCaravans: Number(wipedArmy.caravan ?? 0),
      survivingCombatUnits: sumSelectionWithoutCaravans(wipedArmy),
    },
  };
};

const runScenarioScoutOnlyNoDefenderScouts = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { scout: 9 });
  setVillageUnits(defenderVillage.villageId, { militia: 250, archer: 150, cavalry: 80 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 10, gate: 1 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { scout: 9 },
    lootPriority: 'balanced',
  });

  return {
    isSpyReport: Boolean(payload?.spy),
    scoutStart: Number(payload?.spy?.attackerScouts?.start ?? 0),
    scoutLosses: Number(payload?.spy?.attackerScouts?.losses ?? 0),
    scoutSurvivors: Number(payload?.spy?.attackerScouts?.survivors ?? 0),
    defenderScouts: Number(payload?.spy?.defenderScouts ?? 0),
    success: Boolean(payload?.spy?.success),
  };
};

const runScenarioConquestKnightLootCapacity = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { knight: 1 });
  setVillageUnits(defenderVillage.villageId, {});
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });
  setVillageResources(defenderVillage.villageId, { wood: 300, stone: 300, iron: 300 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: { knight: 1 },
    lootPriority: 'balanced',
  });
  const lootTaken = payload?.lootTaken ?? { wood: 0, stone: 0, iron: 0 };

  return {
    conquest: payload?.conquest ?? null,
    returnMovement: payload?.returnMovement ?? null,
    lootTaken,
    totalLoot: Number(lootTaken.wood ?? 0) + Number(lootTaken.stone ?? 0) + Number(lootTaken.iron ?? 0),
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

  const fireCountBeforeBlockedAttempt = getVillageCountInRegion(attacker.id, REGION_FIRE);
  let secondConquest = null;
  let blockedError = null;
  try {
    secondConquest = conquerVillage(
      ATTACKER_USERNAME,
      Number(fireTargetForBlocked),
      Number(attackerFire.villageId),
      WORLD_FIRE,
    );
  } catch (error) {
    blockedError = String(error?.message ?? error);
  }

  return {
    primaryCount: getVillageCountInRegion(attacker.id, REGION_PRIMARY),
    fireCountAfterSuccess,
    fireCountBeforeBlockedAttempt,
    fireCountAfterSecondAttempt: getVillageCountInRegion(attacker.id, REGION_FIRE),
    firstConquest,
    secondConquest,
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

const runScenarioKnightDefenderEliminatedOnVictory = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  setVillageUnits(attackerVillage.villageId, {
    cavalry: 2311,
    scout: 380,
    knight: 1,
    ram: 3,
  });
  setVillageUnits(defenderVillage.villageId, { knight: 1 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });

  const { payload } = runAttackAndGetPayload({
    username: ATTACKER_USERNAME,
    originVillageId: attackerVillage.villageId,
    targetVillageId: defenderVillage.villageId,
    units: {
      cavalry: 2311,
      scout: 380,
      knight: 1,
      ram: 3,
    },
    lootPriority: 'balanced',
  });

  const defenderSnapshotAfter = getVillageSnapshot(
    DEFENDER_USERNAME,
    Number(defenderVillage.villageId),
    WORLD_PRIMARY,
  );
  const defenderKnightAfter = Math.max(
    0,
    Math.floor(
      Number(
        defenderSnapshotAfter?.units?.find((unit) => String(unit.id) === 'knight')?.amount ?? 0,
      ),
    ),
  );

  return {
    attackerWins: Boolean(payload?.battle?.attackerWins),
    reportDefenderKnightStart: Number(payload?.battle?.defender?.start?.knight ?? 0),
    reportDefenderKnightLosses: Number(payload?.battle?.defender?.losses?.knight ?? 0),
    reportDefenderKnightSurvivors: Number(payload?.battle?.defender?.survivors?.knight ?? 0),
    defenderKnightAfter,
  };
};

const runScenarioCommunicationThreadIsolation = () => {
  clearTransientState();
  const playerA = 'Player001';
  const playerB = 'Player002';
  const playerC = 'Player003';
  const playerD = 'Player004';

  getPlayer(playerA);
  getPlayer(playerB);
  getPlayer(playerC);
  getPlayer(playerD);

  sendCommunicationMessage(playerA, {
    targetUsername: playerB,
    body: 'private A->B',
  });
  sendCommunicationMessage(playerC, {
    targetUsername: playerD,
    body: 'private C->D',
  });

  const inboxA = listCommunicationInbox(playerA, {
    threadLimit: 20,
    messageLimit: 20,
  });
  const visibleOthers = (inboxA?.threads ?? [])
    .map((thread) => String(thread?.otherPlayer?.username ?? ''))
    .filter((username) => username.length > 0);
  const leakedUsernames = visibleOthers.filter((username) => username === playerC || username === playerD);

  const inboxC = listCommunicationInbox(playerC, {
    threadLimit: 20,
    messageLimit: 20,
  });
  const foreignThread = (inboxC?.threads ?? []).find(
    (thread) => String(thread?.otherPlayer?.username ?? '') === playerD,
  );

  let blockedForeignThreadAccess = false;
  let blockedMessage = null;
  if (foreignThread) {
    try {
      listCommunicationInbox(playerA, {
        threadId: Number(foreignThread.id),
        messageLimit: 20,
      });
    } catch (error) {
      blockedMessage = String(error?.message ?? error);
      blockedForeignThreadAccess = blockedMessage
        .toLocaleLowerCase('cs-CZ')
        .includes('konverzace nebyla nalezena');
    }
  }

  return {
    visibleOthers,
    leakedUsernames,
    foreignThreadId: Number(foreignThread?.id ?? 0),
    blockedForeignThreadAccess,
    blockedMessage,
  };
};

const runScenarioKnightSingleSlotPerVillage = () => {
  clearTransientState();
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  setVillageResources(attackerVillage.villageId, { wood: 50000, stone: 50000, iron: 50000 });

  setVillageUnits(attackerVillage.villageId, { knight: 1 });
  let blockedWithExistingKnight = null;
  try {
    recruitUnits(ATTACKER_USERNAME, 'knight', 1, Number(attackerVillage.villageId), WORLD_PRIMARY);
  } catch (error) {
    blockedWithExistingKnight = String(error?.message ?? error);
  }

  setVillageUnits(attackerVillage.villageId, { knight: 0 });
  const firstRecruitment = recruitUnits(
    ATTACKER_USERNAME,
    'knight',
    1,
    Number(attackerVillage.villageId),
    WORLD_PRIMARY,
  );

  let blockedWithQueuedKnight = null;
  try {
    recruitUnits(ATTACKER_USERNAME, 'knight', 1, Number(attackerVillage.villageId), WORLD_PRIMARY);
  } catch (error) {
    blockedWithQueuedKnight = String(error?.message ?? error);
  }

  return {
    firstRecruitmentOrderId: Number(firstRecruitment?.orderId ?? 0),
    blockedWithExistingKnight,
    blockedWithQueuedKnight,
  };
};

const runScenarioPrestigeRetaliationUnlock = () => {
  clearTransientState();
  const attacker = getPlayer(ATTACKER_USERNAME);
  const defender = getPlayer(DEFENDER_USERNAME);
  const attackerVillage = getVillageForPlayerInWorld(ATTACKER_USERNAME, WORLD_PRIMARY);
  const defenderVillage = getVillageForPlayerInWorld(DEFENDER_USERNAME, WORLD_PRIMARY);

  updateVillagePrestigeByPlayerRegionStmt.run(50000, Number(attacker.id), REGION_PRIMARY);
  updateVillagePrestigeByPlayerRegionStmt.run(100, Number(defender.id), REGION_PRIMARY);

  setVillageUnits(attackerVillage.villageId, { militia: 20 });
  setVillageUnits(defenderVillage.villageId, { militia: 20 });
  setVillageBuildings(attackerVillage.villageId, { fortification: 0, gate: 0 });
  setVillageBuildings(defenderVillage.villageId, { fortification: 0, gate: 0 });

  let blockedBeforeRetaliation = null;
  try {
    issueArmyCommand(
      ATTACKER_USERNAME,
      {
        commandType: 'attack',
        targetVillageId: Number(defenderVillage.villageId),
        units: { militia: 1 },
      },
      Number(attackerVillage.villageId),
      WORLD_PRIMARY,
    );
  } catch (error) {
    blockedBeforeRetaliation = String(error?.message ?? error);
  }

  const smallerAttack = issueArmyCommand(
    DEFENDER_USERNAME,
    {
      commandType: 'attack',
      targetVillageId: Number(attackerVillage.villageId),
      units: { militia: 1 },
    },
    Number(defenderVillage.villageId),
    WORLD_PRIMARY,
  );

  const retaliationAttack = issueArmyCommand(
    ATTACKER_USERNAME,
    {
      commandType: 'attack',
      targetVillageId: Number(defenderVillage.villageId),
      units: { militia: 1 },
    },
    Number(attackerVillage.villageId),
    WORLD_PRIMARY,
  );

  return {
    blockedBeforeRetaliation,
    smallerAttackOrderId: Number(smallerAttack?.orderId ?? 0),
    retaliationAttackOrderId: Number(retaliationAttack?.orderId ?? 0),
  };
};

const scenarioName = String(process.argv[2] ?? '').trim();
const scenarioHandlers = new Map([
  ['empty-fortified-no-loss', runScenarioEmptyFortifiedNoLoss],
  ['ram-breaks-gate', runScenarioRamBreaksGate],
  ['mixed-scout-attack-loot', runScenarioMixedScoutAttackAndLoot],
  ['scout-combo-attack-matrix', runScenarioScoutComboAttackMatrix],
  ['loot-capacity-all-units', runScenarioLootCapacity],
  ['default-balanced-loot-priority', runScenarioDefaultBalancedLootPriority],
  ['caravan-binary-casualties', runScenarioCaravanBinaryCasualties],
  ['scout-only-no-defender-scouts', runScenarioScoutOnlyNoDefenderScouts],
  ['conquest-knight-loot-capacity', runScenarioConquestKnightLootCapacity],
  ['world-village-limit', runScenarioWorldVillageLimit],
  ['large-army-balance', runScenarioLargeArmyBalance],
  ['knight-defender-eliminated-on-victory', runScenarioKnightDefenderEliminatedOnVictory],
  ['communication-thread-isolation', runScenarioCommunicationThreadIsolation],
  ['knight-single-slot-per-village', runScenarioKnightSingleSlotPerVillage],
  ['prestige-retaliation-unlock', runScenarioPrestigeRetaliationUnlock],
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
