import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDING_ORDER, UNIT_ORDER } from './gameConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'game.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const WORLD_REGION = {
  id: 1,
  originX: 200,
  originY: 430,
  size: 50,
};

const BASE_ACCOUNTS = ['Hayato', 'Torreya', 'Pegak', 'Sentryn', 'TSN'];
const EXTRA_ACCOUNTS = Array.from({ length: 100 }, (_, index) => `Player${String(index + 1).padStart(3, '0')}`);
const SPECIAL_PLAYER_ACCOUNTS = [
  { username: '-SaThAn?!', password: '123' },
  { username: '*333*', password: '123' },
];
const ALL_ACCOUNTS = [...BASE_ACCOUNTS, ...EXTRA_ACCOUNTS, ...SPECIAL_PLAYER_ACCOUNTS.map((entry) => entry.username)];
const SPECIAL_PLAYER_ACCOUNT_BY_USERNAME = new Map(
  SPECIAL_PLAYER_ACCOUNTS.map((entry) => [entry.username, entry]),
);
const KINGDOMS = ['Aurora Pact', 'Iron Dominion', 'Emerald Circle', 'Skywatch Union', 'Obsidian League'];
const ABANDONED_BOT_VILLAGE_COUNT = 20;
const ABANDONED_BOT_USERNAME_PREFIX = '__abandoned_ai__';
const ABANDONED_BOT_VILLAGE_NAME_PREFIX = 'Opuštěná vesnice';
const STARTING_RESOURCES = {
  wood: 1000,
  stone: 1000,
  iron: 1000,
};
const STARTING_BUILDING_LEVELS = {
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  warehouse: 1,
  'residential-quarter': 1,
};
const VILLAGE_BUILDING_LEVEL_FLOORS = {
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  warehouse: 1,
  barracks: 0,
  stable: 0,
  workshop: 0,
  fortification: 0,
  gate: 0,
  townhall: 0,
  university: 0,
  'residential-quarter': 1,
};
const ABANDONED_STARTING_BUILDING_LEVELS = {
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  warehouse: 5,
};
const SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS = {
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  warehouse: 5,
};
const ABANDONED_MILITIA_COUNT = 100;

const nowIso = () => new Date().toISOString();

const createSchema = () => {
  db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_bot INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS villages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kingdom TEXT NOT NULL DEFAULT 'Neutral',
  coord_x INTEGER NOT NULL,
  coord_y INTEGER NOT NULL,
  region INTEGER NOT NULL,
  prestige INTEGER NOT NULL DEFAULT 0,
  loyalty INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS resources (
  village_id INTEGER PRIMARY KEY,
  wood REAL NOT NULL,
  stone REAL NOT NULL,
  iron REAL NOT NULL,
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE TABLE IF NOT EXISTS buildings (
  village_id INTEGER NOT NULL,
  building_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  PRIMARY KEY (village_id, building_id),
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE TABLE IF NOT EXISTS units (
  village_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (village_id, unit_id),
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE TABLE IF NOT EXISTS building_upgrades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id INTEGER NOT NULL,
  building_id TEXT NOT NULL,
  from_level INTEGER NOT NULL,
  to_level INTEGER NOT NULL,
  wood_cost INTEGER NOT NULL,
  stone_cost INTEGER NOT NULL,
  iron_cost INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finish_at TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_building_upgrades_status_finish
  ON building_upgrades(status, finish_at);

CREATE TABLE IF NOT EXISTS unit_recruitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  wood_cost INTEGER NOT NULL,
  stone_cost INTEGER NOT NULL,
  iron_cost INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finish_at TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_unit_recruitments_status_finish
  ON unit_recruitments(status, finish_at);

CREATE TABLE IF NOT EXISTS army_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  command_type TEXT NOT NULL,
  origin_village_id INTEGER NOT NULL,
  target_village_id INTEGER NOT NULL,
  home_village_id INTEGER NOT NULL,
  loot_priority TEXT,
  carry_wood INTEGER NOT NULL DEFAULT 0,
  carry_stone INTEGER NOT NULL DEFAULT 0,
  carry_iron INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  arrive_at TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (origin_village_id) REFERENCES villages(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id),
  FOREIGN KEY (home_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_army_movements_status_arrive
  ON army_movements(status, arrive_at);

CREATE TABLE IF NOT EXISTS army_movement_units (
  movement_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (movement_id, unit_id),
  FOREIGN KEY (movement_id) REFERENCES army_movements(id)
);

CREATE TABLE IF NOT EXISTS battle_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  origin_village_id INTEGER,
  target_village_id INTEGER,
  battle_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (origin_village_id) REFERENCES villages(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_battle_reports_player_created
  ON battle_reports(player_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_tick_at TEXT NOT NULL
);
`);

  const villageColumns = db.prepare('PRAGMA table_info(villages)').all();
  const hasKingdomColumn = villageColumns.some((column) => column.name === 'kingdom');
  if (!hasKingdomColumn) {
    db.prepare("ALTER TABLE villages ADD COLUMN kingdom TEXT NOT NULL DEFAULT 'Neutral'").run();
  }

  const playerColumns = db.prepare('PRAGMA table_info(players)').all();
  const hasIsBotColumn = playerColumns.some((column) => column.name === 'is_bot');
  if (!hasIsBotColumn) {
    db.prepare('ALTER TABLE players ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0').run();
  }

  const movementColumns = db.prepare('PRAGMA table_info(army_movements)').all();
  const hasLootPriorityColumn = movementColumns.some((column) => column.name === 'loot_priority');
  if (!hasLootPriorityColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN loot_priority TEXT').run();
  }
  const hasCarryWoodColumn = movementColumns.some((column) => column.name === 'carry_wood');
  if (!hasCarryWoodColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN carry_wood INTEGER NOT NULL DEFAULT 0').run();
  }
  const hasCarryStoneColumn = movementColumns.some((column) => column.name === 'carry_stone');
  if (!hasCarryStoneColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN carry_stone INTEGER NOT NULL DEFAULT 0').run();
  }
  const hasCarryIronColumn = movementColumns.some((column) => column.name === 'carry_iron');
  if (!hasCarryIronColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN carry_iron INTEGER NOT NULL DEFAULT 0').run();
  }
};

const buildSpawnCells = (count) => {
  const cells = [];
  for (let y = 1; y <= WORLD_REGION.size; y += 1) {
    for (let x = 1; x <= WORLD_REGION.size; x += 1) {
      cells.push({ localX: x, localY: y });
    }
  }

  let seed = 20260215;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, count);
};

const startingPrestige = (militiaCount) => militiaCount * 2;
const abandonedVillagePrestige = () =>
  BUILDING_ORDER.reduce((total, buildingId) => total + ((ABANDONED_STARTING_BUILDING_LEVELS[buildingId] ?? 0) * 120), 0) +
  ABANDONED_MILITIA_COUNT * 2;

const clearWorld = db.transaction(() => {
  db.exec(`
DELETE FROM building_upgrades;
DELETE FROM unit_recruitments;
DELETE FROM army_movement_units;
DELETE FROM army_movements;
DELETE FROM battle_reports;
DELETE FROM units;
DELETE FROM buildings;
DELETE FROM resources;
DELETE FROM villages;
DELETE FROM players;
DELETE FROM game_state;
`);
});

const seedWorld = db.transaction(() => {
  const spawns = buildSpawnCells(ALL_ACCOUNTS.length + ABANDONED_BOT_VILLAGE_COUNT);

  const insertPlayerStmt = db.prepare(
    'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, ?, ?)',
  );
  const insertVillageStmt = db.prepare(
    `INSERT INTO villages (
      player_id,
      name,
      kingdom,
      coord_x,
      coord_y,
      region,
      prestige,
      loyalty,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertResourceStmt = db.prepare(
    'INSERT INTO resources (village_id, wood, stone, iron) VALUES (?, ?, ?, ?)',
  );
  const insertBuildingStmt = db.prepare(
    'INSERT INTO buildings (village_id, building_id, level) VALUES (?, ?, ?)',
  );
  const insertUnitStmt = db.prepare(
    'INSERT INTO units (village_id, unit_id, amount) VALUES (?, ?, ?)',
  );

  for (let index = 0; index < ALL_ACCOUNTS.length; index += 1) {
    const username = ALL_ACCOUNTS[index];
    const specialAccount = SPECIAL_PLAYER_ACCOUNT_BY_USERNAME.get(username);
    const password = specialAccount?.password ?? '123';
    const boostedStartLevels = specialAccount ? SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS : null;
    const kingdom = KINGDOMS[index % KINGDOMS.length];
    const spawn = spawns[index];
    const coordX = WORLD_REGION.originX + spawn.localX - 1;
    const coordY = WORLD_REGION.originY + spawn.localY - 1;
    const militiaCount = 5 + (index % 6);

    const playerResult = insertPlayerStmt.run(username, password, 0, nowIso());
    const playerId = Number(playerResult.lastInsertRowid);

    const villageResult = insertVillageStmt.run(
      playerId,
      `Leno ${username}`,
      kingdom,
      coordX,
      coordY,
      WORLD_REGION.id,
      startingPrestige(militiaCount),
      100,
      nowIso(),
    );

    const villageId = Number(villageResult.lastInsertRowid);

    insertResourceStmt.run(
      villageId,
      STARTING_RESOURCES.wood,
      STARTING_RESOURCES.stone,
      STARTING_RESOURCES.iron,
    );

    for (const buildingId of BUILDING_ORDER) {
      const startingLevel = boostedStartLevels?.[buildingId] ?? STARTING_BUILDING_LEVELS[buildingId] ?? 0;
      insertBuildingStmt.run(villageId, buildingId, startingLevel);
    }

    for (const unitId of UNIT_ORDER) {
      const amount = unitId === 'militia' ? militiaCount : 0;
      insertUnitStmt.run(villageId, unitId, amount);
    }
  }

  for (let index = 0; index < ABANDONED_BOT_VILLAGE_COUNT; index += 1) {
    const spawn = spawns[ALL_ACCOUNTS.length + index];
    if (!spawn) {
      break;
    }

    const botUsername = `${ABANDONED_BOT_USERNAME_PREFIX}${String(index + 1).padStart(2, '0')}`;
    const villageName = `${ABANDONED_BOT_VILLAGE_NAME_PREFIX} ${String(index + 1).padStart(2, '0')}`;
    const coordX = WORLD_REGION.originX + spawn.localX - 1;
    const coordY = WORLD_REGION.originY + spawn.localY - 1;

    const botResult = insertPlayerStmt.run(botUsername, '', 1, nowIso());
    const botPlayerId = Number(botResult.lastInsertRowid);
    const villageResult = insertVillageStmt.run(
      botPlayerId,
      villageName,
      'Neutral',
      coordX,
      coordY,
      WORLD_REGION.id,
      abandonedVillagePrestige(),
      100,
      nowIso(),
    );
    const villageId = Number(villageResult.lastInsertRowid);

    insertResourceStmt.run(
      villageId,
      STARTING_RESOURCES.wood,
      STARTING_RESOURCES.stone,
      STARTING_RESOURCES.iron,
    );

    for (const buildingId of BUILDING_ORDER) {
      const startingLevel = ABANDONED_STARTING_BUILDING_LEVELS[buildingId] ?? 0;
      insertBuildingStmt.run(villageId, buildingId, startingLevel);
    }

    for (const unitId of UNIT_ORDER) {
      const amount = unitId === 'militia' ? ABANDONED_MILITIA_COUNT : 0;
      insertUnitStmt.run(villageId, unitId, amount);
    }
  }

  db.prepare('INSERT INTO game_state (id, last_tick_at) VALUES (1, ?)').run(nowIso());
});

const ensureAbandonedVillages = db.transaction(() => {
  const existingCountRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM villages v
       INNER JOIN players p ON p.id = v.player_id
       WHERE p.is_bot = 1 AND p.username GLOB ?`,
    )
    .get(`${ABANDONED_BOT_USERNAME_PREFIX}*`);
  const existingCount = Number(existingCountRow?.total ?? 0);
  const missingCount = Math.max(0, ABANDONED_BOT_VILLAGE_COUNT - existingCount);
  if (missingCount === 0) {
    return;
  }

  const existingBotPlayers = db
    .prepare(
      `SELECT username
       FROM players
       WHERE username GLOB ?`,
    )
    .all(`${ABANDONED_BOT_USERNAME_PREFIX}*`);
  const existingSerials = new Set(
    existingBotPlayers
      .map((row) => {
        const match = String(row.username).match(/(\d+)$/);
        return match ? Number(match[1]) : Number.NaN;
      })
      .filter((serial) => Number.isFinite(serial) && serial > 0),
  );
  let nextSerialHint = 1;
  const allocateNextSerial = () => {
    while (existingSerials.has(nextSerialHint)) {
      nextSerialHint += 1;
    }
    const allocated = nextSerialHint;
    existingSerials.add(allocated);
    nextSerialHint += 1;
    return allocated;
  };

  const allCells = buildSpawnCells(WORLD_REGION.size * WORLD_REGION.size);
  const occupied = new Set(
    db
      .prepare('SELECT coord_x AS coordX, coord_y AS coordY FROM villages')
      .all()
      .map((row) => `${Number(row.coordX)}|${Number(row.coordY)}`),
  );
  const freeCells = allCells.filter((cell) => {
    const coordX = WORLD_REGION.originX + cell.localX - 1;
    const coordY = WORLD_REGION.originY + cell.localY - 1;
    return !occupied.has(`${coordX}|${coordY}`);
  });

  const insertPlayerStmt = db.prepare(
    'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, ?, ?)',
  );
  const insertVillageStmt = db.prepare(
    `INSERT INTO villages (
      player_id,
      name,
      kingdom,
      coord_x,
      coord_y,
      region,
      prestige,
      loyalty,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertResourceStmt = db.prepare(
    'INSERT INTO resources (village_id, wood, stone, iron) VALUES (?, ?, ?, ?)',
  );
  const insertBuildingStmt = db.prepare(
    'INSERT INTO buildings (village_id, building_id, level) VALUES (?, ?, ?)',
  );
  const insertUnitStmt = db.prepare(
    'INSERT INTO units (village_id, unit_id, amount) VALUES (?, ?, ?)',
  );

  for (let index = 0; index < missingCount; index += 1) {
    const spawn = freeCells[index];
    if (!spawn) {
      break;
    }

    const serial = allocateNextSerial();
    const botUsername = `${ABANDONED_BOT_USERNAME_PREFIX}${String(serial).padStart(2, '0')}`;
    const villageName = `${ABANDONED_BOT_VILLAGE_NAME_PREFIX} ${String(serial).padStart(2, '0')}`;
    const coordX = WORLD_REGION.originX + spawn.localX - 1;
    const coordY = WORLD_REGION.originY + spawn.localY - 1;

    const botResult = insertPlayerStmt.run(botUsername, '', 1, nowIso());
    const botPlayerId = Number(botResult.lastInsertRowid);
    const villageResult = insertVillageStmt.run(
      botPlayerId,
      villageName,
      'Neutral',
      coordX,
      coordY,
      WORLD_REGION.id,
      abandonedVillagePrestige(),
      100,
      nowIso(),
    );
    const villageId = Number(villageResult.lastInsertRowid);

    insertResourceStmt.run(
      villageId,
      STARTING_RESOURCES.wood,
      STARTING_RESOURCES.stone,
      STARTING_RESOURCES.iron,
    );

    for (const buildingId of BUILDING_ORDER) {
      const startingLevel = ABANDONED_STARTING_BUILDING_LEVELS[buildingId] ?? 0;
      insertBuildingStmt.run(villageId, buildingId, startingLevel);
    }

    for (const unitId of UNIT_ORDER) {
      const amount = unitId === 'militia' ? ABANDONED_MILITIA_COUNT : 0;
      insertUnitStmt.run(villageId, unitId, amount);
    }
  }
});

const ensureBotFlagConsistency = db.transaction(() => {
  db.prepare(
    `UPDATE players
     SET is_bot = 1
     WHERE is_bot = 0
       AND username GLOB ?`,
  ).run(`${ABANDONED_BOT_USERNAME_PREFIX}*`);
});

const ensureHayatoOwnsAbandonedVillage13 = db.transaction(() => {
  const hayato = db
    .prepare(
      `SELECT
          p.id AS playerId,
          COALESCE((
            SELECT vv.kingdom
            FROM villages vv
            WHERE vv.player_id = p.id
            ORDER BY vv.id ASC
            LIMIT 1
          ), 'Neutral') AS kingdom
       FROM players p
       WHERE p.username = 'Hayato' AND p.is_bot = 0
       LIMIT 1`,
    )
    .get();
  if (!hayato) {
    return;
  }

  const targetVillage = db
    .prepare(
      `SELECT id, player_id AS playerId
       FROM villages
       WHERE coord_x = ? AND coord_y = ?
       LIMIT 1`,
    )
    .get(214, 473);
  if (!targetVillage) {
    return;
  }

  if (Number(targetVillage.playerId) === Number(hayato.playerId)) {
    return;
  }

  db.prepare(
    `UPDATE villages
     SET player_id = ?, kingdom = ?, loyalty = 100
     WHERE id = ?`,
  ).run(Number(hayato.playerId), String(hayato.kingdom ?? 'Neutral'), Number(targetVillage.id));
});

const ensureSpecialPlayerAccounts = db.transaction(() => {
  const selectPlayerStmt = db.prepare(
    `SELECT id, password
     FROM players
     WHERE username = ? AND is_bot = 0
     LIMIT 1`,
  );
  const updatePlayerPasswordStmt = db.prepare('UPDATE players SET password = ? WHERE id = ?');
  const insertPlayerStmt = db.prepare(
    'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, ?, ?)',
  );
  const selectVillagesByPlayerStmt = db.prepare(
    `SELECT id
     FROM villages
     WHERE player_id = ?
     ORDER BY id ASC`,
  );
  const insertVillageStmt = db.prepare(
    `INSERT INTO villages (
      player_id,
      name,
      kingdom,
      coord_x,
      coord_y,
      region,
      prestige,
      loyalty,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertResourceStmt = db.prepare(
    `INSERT INTO resources (village_id, wood, stone, iron)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(village_id) DO UPDATE SET
       wood = CASE WHEN resources.wood < excluded.wood THEN excluded.wood ELSE resources.wood END,
       stone = CASE WHEN resources.stone < excluded.stone THEN excluded.stone ELSE resources.stone END,
       iron = CASE WHEN resources.iron < excluded.iron THEN excluded.iron ELSE resources.iron END`,
  );
  const upsertBuildingStmt = db.prepare(
    `INSERT INTO buildings (village_id, building_id, level)
     VALUES (?, ?, ?)
     ON CONFLICT(village_id, building_id) DO UPDATE SET
       level = CASE WHEN buildings.level < excluded.level THEN excluded.level ELSE buildings.level END`,
  );
  const upsertUnitStmt = db.prepare(
    `INSERT INTO units (village_id, unit_id, amount)
     VALUES (?, ?, ?)
     ON CONFLICT(village_id, unit_id) DO UPDATE SET
       amount = CASE WHEN units.amount < excluded.amount THEN excluded.amount ELSE units.amount END`,
  );

  const occupiedCoords = new Set(
    db
      .prepare('SELECT coord_x AS coordX, coord_y AS coordY FROM villages')
      .all()
      .map((row) => `${Number(row.coordX)}|${Number(row.coordY)}`),
  );
  const allCells = buildSpawnCells(WORLD_REGION.size * WORLD_REGION.size);
  let nextCellIndex = 0;
  const takeNextFreeSpawnCell = () => {
    while (nextCellIndex < allCells.length) {
      const spawn = allCells[nextCellIndex++];
      const coordX = WORLD_REGION.originX + spawn.localX - 1;
      const coordY = WORLD_REGION.originY + spawn.localY - 1;
      const key = `${coordX}|${coordY}`;
      if (occupiedCoords.has(key)) {
        continue;
      }
      occupiedCoords.add(key);
      return { coordX, coordY };
    }
    return null;
  };

  for (const account of SPECIAL_PLAYER_ACCOUNTS) {
    let player = selectPlayerStmt.get(account.username);
    if (!player) {
      const inserted = insertPlayerStmt.run(account.username, account.password, 0, nowIso());
      player = {
        id: Number(inserted.lastInsertRowid),
        password: account.password,
      };
    } else if (String(player.password) !== account.password) {
      updatePlayerPasswordStmt.run(account.password, Number(player.id));
    }

    let villages = selectVillagesByPlayerStmt.all(Number(player.id));
    if (villages.length === 0) {
      const spawn = takeNextFreeSpawnCell();
      if (!spawn) {
        continue;
      }

      const accountSeedIndex = ALL_ACCOUNTS.indexOf(account.username);
      const kingdom = KINGDOMS[Math.max(0, accountSeedIndex) % KINGDOMS.length];
      const militiaCount = 5;
      const insertedVillage = insertVillageStmt.run(
        Number(player.id),
        `Leno ${account.username}`,
        kingdom,
        spawn.coordX,
        spawn.coordY,
        WORLD_REGION.id,
        startingPrestige(militiaCount),
        100,
        nowIso(),
      );
      villages = [{ id: Number(insertedVillage.lastInsertRowid) }];
    }

    for (const village of villages) {
      const villageId = Number(village.id);
      upsertResourceStmt.run(
        villageId,
        STARTING_RESOURCES.wood,
        STARTING_RESOURCES.stone,
        STARTING_RESOURCES.iron,
      );

      for (const buildingId of BUILDING_ORDER) {
        const targetLevel = SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS[buildingId] ?? STARTING_BUILDING_LEVELS[buildingId] ?? 0;
        upsertBuildingStmt.run(villageId, buildingId, targetLevel);
      }

      for (const unitId of UNIT_ORDER) {
        const targetAmount = unitId === 'militia' ? 5 : 0;
        upsertUnitStmt.run(villageId, unitId, targetAmount);
      }
    }
  }
});

const ensureVillageBuildingLevelFloors = db.transaction(() => {
  const selectVillageIdsStmt = db.prepare('SELECT id FROM villages');
  const upsertBuildingStmt = db.prepare(
    `INSERT INTO buildings (village_id, building_id, level)
     VALUES (?, ?, ?)
     ON CONFLICT(village_id, building_id) DO UPDATE SET
       level = CASE WHEN buildings.level < excluded.level THEN excluded.level ELSE buildings.level END`,
  );

  const villages = selectVillageIdsStmt.all();
  for (const village of villages) {
    const villageId = Number(village.id);
    for (const buildingId of BUILDING_ORDER) {
      const targetLevel = Math.max(0, Number(VILLAGE_BUILDING_LEVEL_FLOORS[buildingId] ?? 0));
      upsertBuildingStmt.run(villageId, buildingId, targetLevel);
    }
  }
});

const shouldReseedWorld = () => {
  const playerRows = db.prepare('SELECT username FROM players').all();
  if (playerRows.length === 0) {
    return true;
  }

  const usernames = new Set(playerRows.map((row) => row.username));
  return BASE_ACCOUNTS.some((username) => !usernames.has(username));
};

createSchema();

if (shouldReseedWorld()) {
  clearWorld();
  seedWorld();
}

ensureBotFlagConsistency();
ensureAbandonedVillages();
ensureSpecialPlayerAccounts();
ensureVillageBuildingLevelFloors();
ensureHayatoOwnsAbandonedVillage13();
