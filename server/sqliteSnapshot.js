const TABLE_SELECT_QUERIES = {
  players:
    'SELECT id, username, password, is_bot, created_at FROM players ORDER BY id ASC',
  villages:
    'SELECT id, player_id, name, kingdom, coord_x, coord_y, region, prestige, loyalty, created_at FROM villages ORDER BY id ASC',
  resources:
    'SELECT village_id, wood, stone, iron FROM resources ORDER BY village_id ASC',
  buildings:
    'SELECT village_id, building_id, level FROM buildings ORDER BY village_id ASC, building_id ASC',
  units:
    'SELECT village_id, unit_id, amount FROM units ORDER BY village_id ASC, unit_id ASC',
  buildingUpgrades:
    'SELECT id, village_id, building_id, from_level, to_level, wood_cost, stone_cost, iron_cost, started_at, finish_at, status, completed_at FROM building_upgrades ORDER BY id ASC',
  unitRecruitments:
    'SELECT id, village_id, unit_id, amount, wood_cost, stone_cost, iron_cost, started_at, finish_at, status, completed_at FROM unit_recruitments ORDER BY id ASC',
  armyMovements:
    'SELECT id, player_id, command_type, origin_village_id, target_village_id, home_village_id, loot_priority, carry_wood, carry_stone, carry_iron, started_at, arrive_at, status, completed_at FROM army_movements ORDER BY id ASC',
  armyMovementUnits:
    'SELECT movement_id, unit_id, amount FROM army_movement_units ORDER BY movement_id ASC, unit_id ASC',
  battleReports:
    'SELECT id, player_id, origin_village_id, target_village_id, battle_at, created_at, title, summary, payload_json FROM battle_reports ORDER BY created_at ASC, id ASC',
  kingdomInvites:
    'SELECT id, region, kingdom, inviter_player_id, target_player_id, status, created_at, responded_at FROM kingdom_invites ORDER BY created_at ASC, id ASC',
  kingdomEvents:
    'SELECT id, region, kingdom, event_type, actor_player_id, target_player_id, payload_json, created_at FROM kingdom_events ORDER BY created_at ASC, id ASC',
  gameState:
    'SELECT id, last_tick_at FROM game_state ORDER BY id ASC',
};

const SNAPSHOT_TABLE_KEYS = {
  players: ['id'],
  villages: ['id'],
  resources: ['village_id'],
  buildings: ['village_id', 'building_id'],
  units: ['village_id', 'unit_id'],
  buildingUpgrades: ['id'],
  unitRecruitments: ['id'],
  armyMovements: ['id'],
  armyMovementUnits: ['movement_id', 'unit_id'],
  battleReports: ['id'],
  kingdomInvites: ['id'],
  kingdomEvents: ['id'],
  gameState: ['id'],
};

const normalizeRows = (value) => (Array.isArray(value) ? value : []);

const buildRowKey = (row, keys) =>
  keys
    .map((key) => {
      const value = row?.[key];
      return value == null ? 'null' : String(value);
    })
    .join('::');

const areRowsEqual = (left, right) => {
  if (left === right) {
    return true;
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!(key in right)) {
      return false;
    }
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
};

export const createSnapshotPatch = (previousSnapshot, nextSnapshot) => {
  const patch = {};

  for (const [tableName, keyColumns] of Object.entries(SNAPSHOT_TABLE_KEYS)) {
    const previousRows = normalizeRows(previousSnapshot?.[tableName]);
    const nextRows = normalizeRows(nextSnapshot?.[tableName]);

    const previousByKey = new Map();
    for (const row of previousRows) {
      previousByKey.set(buildRowKey(row, keyColumns), row);
    }

    const changedRows = [];
    for (const row of nextRows) {
      const rowKey = buildRowKey(row, keyColumns);
      const previousRow = previousByKey.get(rowKey);
      if (!previousRow || !areRowsEqual(previousRow, row)) {
        changedRows.push(row);
      }
    }

    if (changedRows.length > 0) {
      patch[tableName] = changedRows;
    }
  }

  return patch;
};

export const isSnapshotPatchEmpty = (patch) => {
  if (!patch || typeof patch !== 'object') {
    return true;
  }

  return Object.values(patch).every((rows) => !Array.isArray(rows) || rows.length === 0);
};

export const extractSqliteSnapshot = (db) => {
  const selectAll = (query) => db.prepare(query).all();
  return {
    players: selectAll(TABLE_SELECT_QUERIES.players),
    villages: selectAll(TABLE_SELECT_QUERIES.villages),
    resources: selectAll(TABLE_SELECT_QUERIES.resources),
    buildings: selectAll(TABLE_SELECT_QUERIES.buildings),
    units: selectAll(TABLE_SELECT_QUERIES.units),
    buildingUpgrades: selectAll(TABLE_SELECT_QUERIES.buildingUpgrades),
    unitRecruitments: selectAll(TABLE_SELECT_QUERIES.unitRecruitments),
    armyMovements: selectAll(TABLE_SELECT_QUERIES.armyMovements),
    armyMovementUnits: selectAll(TABLE_SELECT_QUERIES.armyMovementUnits),
    battleReports: selectAll(TABLE_SELECT_QUERIES.battleReports),
    kingdomInvites: selectAll(TABLE_SELECT_QUERIES.kingdomInvites),
    kingdomEvents: selectAll(TABLE_SELECT_QUERIES.kingdomEvents),
    gameState: selectAll(TABLE_SELECT_QUERIES.gameState),
  };
};

const applySnapshotTransaction = (db) =>
  db.transaction((snapshot) => {
    db.exec(`
DELETE FROM building_upgrades;
DELETE FROM unit_recruitments;
DELETE FROM army_movement_units;
DELETE FROM army_movements;
DELETE FROM battle_reports;
DELETE FROM kingdom_invites;
DELETE FROM kingdom_events;
DELETE FROM units;
DELETE FROM buildings;
DELETE FROM resources;
DELETE FROM villages;
DELETE FROM players;
DELETE FROM game_state;
`);

    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const villages = Array.isArray(snapshot?.villages) ? snapshot.villages : [];
    const resources = Array.isArray(snapshot?.resources) ? snapshot.resources : [];
    const buildings = Array.isArray(snapshot?.buildings) ? snapshot.buildings : [];
    const units = Array.isArray(snapshot?.units) ? snapshot.units : [];
    const buildingUpgrades = Array.isArray(snapshot?.buildingUpgrades) ? snapshot.buildingUpgrades : [];
    const unitRecruitments = Array.isArray(snapshot?.unitRecruitments) ? snapshot.unitRecruitments : [];
    const armyMovements = Array.isArray(snapshot?.armyMovements) ? snapshot.armyMovements : [];
    const armyMovementUnits = Array.isArray(snapshot?.armyMovementUnits) ? snapshot.armyMovementUnits : [];
    const battleReports = Array.isArray(snapshot?.battleReports) ? snapshot.battleReports : [];
    const kingdomInvites = Array.isArray(snapshot?.kingdomInvites) ? snapshot.kingdomInvites : [];
    const kingdomEvents = Array.isArray(snapshot?.kingdomEvents) ? snapshot.kingdomEvents : [];
    const gameStateRows = Array.isArray(snapshot?.gameState) ? snapshot.gameState : [];

    const insertPlayer = db.prepare(
      'INSERT INTO players (id, username, password, is_bot, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (const row of players) {
      insertPlayer.run(
        Number(row.id),
        String(row.username ?? ''),
        String(row.password ?? ''),
        Number(row.is_bot ?? 0),
        String(row.created_at ?? new Date().toISOString()),
      );
    }

    const insertVillage = db.prepare(
      `INSERT INTO villages (
        id,
        player_id,
        name,
        kingdom,
        coord_x,
        coord_y,
        region,
        prestige,
        loyalty,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of villages) {
      insertVillage.run(
        Number(row.id),
        Number(row.player_id),
        String(row.name ?? ''),
        String(row.kingdom ?? 'Neutral'),
        Number(row.coord_x ?? 0),
        Number(row.coord_y ?? 0),
        Number(row.region ?? 1),
        Number(row.prestige ?? 0),
        Number(row.loyalty ?? 100),
        String(row.created_at ?? new Date().toISOString()),
      );
    }

    const insertResource = db.prepare(
      'INSERT INTO resources (village_id, wood, stone, iron) VALUES (?, ?, ?, ?)',
    );
    for (const row of resources) {
      insertResource.run(
        Number(row.village_id),
        Number(row.wood ?? 0),
        Number(row.stone ?? 0),
        Number(row.iron ?? 0),
      );
    }

    const insertBuilding = db.prepare(
      'INSERT INTO buildings (village_id, building_id, level) VALUES (?, ?, ?)',
    );
    for (const row of buildings) {
      insertBuilding.run(
        Number(row.village_id),
        String(row.building_id ?? ''),
        Number(row.level ?? 0),
      );
    }

    const insertUnit = db.prepare(
      'INSERT INTO units (village_id, unit_id, amount) VALUES (?, ?, ?)',
    );
    for (const row of units) {
      insertUnit.run(
        Number(row.village_id),
        String(row.unit_id ?? ''),
        Number(row.amount ?? 0),
      );
    }

    const insertBuildingUpgrade = db.prepare(
      `INSERT INTO building_upgrades (
        id,
        village_id,
        building_id,
        from_level,
        to_level,
        wood_cost,
        stone_cost,
        iron_cost,
        started_at,
        finish_at,
        status,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of buildingUpgrades) {
      insertBuildingUpgrade.run(
        Number(row.id),
        Number(row.village_id),
        String(row.building_id ?? ''),
        Number(row.from_level ?? 0),
        Number(row.to_level ?? 0),
        Number(row.wood_cost ?? 0),
        Number(row.stone_cost ?? 0),
        Number(row.iron_cost ?? 0),
        String(row.started_at ?? new Date().toISOString()),
        String(row.finish_at ?? new Date().toISOString()),
        String(row.status ?? 'in_progress'),
        row.completed_at == null ? null : String(row.completed_at),
      );
    }

    const insertUnitRecruitment = db.prepare(
      `INSERT INTO unit_recruitments (
        id,
        village_id,
        unit_id,
        amount,
        wood_cost,
        stone_cost,
        iron_cost,
        started_at,
        finish_at,
        status,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of unitRecruitments) {
      insertUnitRecruitment.run(
        Number(row.id),
        Number(row.village_id),
        String(row.unit_id ?? ''),
        Number(row.amount ?? 0),
        Number(row.wood_cost ?? 0),
        Number(row.stone_cost ?? 0),
        Number(row.iron_cost ?? 0),
        String(row.started_at ?? new Date().toISOString()),
        String(row.finish_at ?? new Date().toISOString()),
        String(row.status ?? 'in_progress'),
        row.completed_at == null ? null : String(row.completed_at),
      );
    }

    const insertArmyMovement = db.prepare(
      `INSERT INTO army_movements (
        id,
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
        status,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of armyMovements) {
      insertArmyMovement.run(
        Number(row.id),
        Number(row.player_id),
        String(row.command_type ?? 'move'),
        Number(row.origin_village_id),
        Number(row.target_village_id),
        Number(row.home_village_id),
        row.loot_priority == null ? null : String(row.loot_priority),
        Number(row.carry_wood ?? 0),
        Number(row.carry_stone ?? 0),
        Number(row.carry_iron ?? 0),
        String(row.started_at ?? new Date().toISOString()),
        String(row.arrive_at ?? new Date().toISOString()),
        String(row.status ?? 'in_progress'),
        row.completed_at == null ? null : String(row.completed_at),
      );
    }

    const insertArmyMovementUnit = db.prepare(
      'INSERT INTO army_movement_units (movement_id, unit_id, amount) VALUES (?, ?, ?)',
    );
    for (const row of armyMovementUnits) {
      insertArmyMovementUnit.run(
        Number(row.movement_id),
        String(row.unit_id ?? ''),
        Number(row.amount ?? 0),
      );
    }

    const insertBattleReport = db.prepare(
      `INSERT INTO battle_reports (
        id,
        player_id,
        origin_village_id,
        target_village_id,
        battle_at,
        created_at,
        title,
        summary,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of battleReports) {
      insertBattleReport.run(
        Number(row.id),
        Number(row.player_id),
        row.origin_village_id == null ? null : Number(row.origin_village_id),
        row.target_village_id == null ? null : Number(row.target_village_id),
        String(row.battle_at ?? new Date().toISOString()),
        String(row.created_at ?? new Date().toISOString()),
        String(row.title ?? ''),
        String(row.summary ?? ''),
        String(row.payload_json ?? '{}'),
      );
    }

    const insertKingdomInvite = db.prepare(
      `INSERT INTO kingdom_invites (
        id,
        region,
        kingdom,
        inviter_player_id,
        target_player_id,
        status,
        created_at,
        responded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of kingdomInvites) {
      insertKingdomInvite.run(
        Number(row.id),
        Number(row.region ?? 1),
        String(row.kingdom ?? 'Neutral'),
        Number(row.inviter_player_id),
        Number(row.target_player_id),
        String(row.status ?? 'pending'),
        String(row.created_at ?? new Date().toISOString()),
        row.responded_at == null ? null : String(row.responded_at),
      );
    }

    const insertKingdomEvent = db.prepare(
      `INSERT INTO kingdom_events (
        id,
        region,
        kingdom,
        event_type,
        actor_player_id,
        target_player_id,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of kingdomEvents) {
      insertKingdomEvent.run(
        Number(row.id),
        Number(row.region ?? 1),
        row.kingdom == null ? null : String(row.kingdom),
        String(row.event_type ?? ''),
        row.actor_player_id == null ? null : Number(row.actor_player_id),
        row.target_player_id == null ? null : Number(row.target_player_id),
        row.payload_json == null ? null : String(row.payload_json),
        String(row.created_at ?? new Date().toISOString()),
      );
    }

    const gameStateRow = gameStateRows[0];
    const insertGameState = db.prepare(
      'INSERT INTO game_state (id, last_tick_at) VALUES (?, ?)',
    );
    insertGameState.run(
      Number(gameStateRow?.id ?? 1),
      String(gameStateRow?.last_tick_at ?? new Date().toISOString()),
    );
  });

export const applySqliteSnapshot = (db, snapshot) => {
  const tx = applySnapshotTransaction(db);
  tx(snapshot ?? {});
};
