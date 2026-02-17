import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.CONVEX_URL;
const convexDeployKey = process.env.CONVEX_DEPLOY_KEY;
const sqlitePath = path.resolve(process.cwd(), process.env.SQLITE_PATH ?? "server/data/game.sqlite");
const wipeBeforeImport = process.env.WIPE_BEFORE_IMPORT !== "false";

if (!convexUrl) {
  throw new Error("Chybi CONVEX_URL. Nastav URL deploymentu pred spustenim migrace.");
}

if (!convexDeployKey) {
  throw new Error("Chybi CONVEX_DEPLOY_KEY. Nastav admin key deploymentu pred spustenim migrace.");
}

if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite soubor nebyl nalezen: ${sqlitePath}`);
}

const db = new Database(sqlitePath, { readonly: true });

const selectAll = (query) => db.prepare(query).all();

const snapshot = {
  players: selectAll(
    "SELECT id, username, password, is_bot, created_at FROM players ORDER BY id ASC",
  ),
  villages: selectAll(
    "SELECT id, player_id, name, kingdom, coord_x, coord_y, region, prestige, loyalty, created_at FROM villages ORDER BY id ASC",
  ),
  resources: selectAll(
    "SELECT village_id, wood, stone, iron FROM resources ORDER BY village_id ASC",
  ),
  buildings: selectAll(
    "SELECT village_id, building_id, level FROM buildings ORDER BY village_id ASC, building_id ASC",
  ),
  units: selectAll(
    "SELECT village_id, unit_id, amount FROM units ORDER BY village_id ASC, unit_id ASC",
  ),
  buildingUpgrades: selectAll(
    "SELECT id, village_id, building_id, from_level, to_level, wood_cost, stone_cost, iron_cost, started_at, finish_at, status, completed_at FROM building_upgrades ORDER BY id ASC",
  ),
  unitRecruitments: selectAll(
    "SELECT id, village_id, unit_id, amount, wood_cost, stone_cost, iron_cost, started_at, finish_at, status, completed_at FROM unit_recruitments ORDER BY id ASC",
  ),
  armyMovements: selectAll(
    "SELECT id, player_id, command_type, origin_village_id, target_village_id, home_village_id, loot_priority, carry_wood, carry_stone, carry_iron, started_at, arrive_at, status, completed_at FROM army_movements ORDER BY id ASC",
  ),
  armyMovementUnits: selectAll(
    "SELECT movement_id, unit_id, amount FROM army_movement_units ORDER BY movement_id ASC, unit_id ASC",
  ),
  battleReports: selectAll(
    "SELECT id, player_id, origin_village_id, target_village_id, battle_at, created_at, title, summary, payload_json FROM battle_reports ORDER BY created_at ASC, id ASC",
  ),
  gameState: selectAll(
    "SELECT id, last_tick_at FROM game_state ORDER BY id ASC",
  ),
};

const client = new ConvexHttpClient(convexUrl);
client.setAdminAuth(convexDeployKey);

console.log(`[convex-migrate] SQLite: ${sqlitePath}`);
console.log(`[convex-migrate] wipeBeforeImport=${wipeBeforeImport}`);

const result = await client.mutation("migrations.js:importSqliteSnapshot", {
  snapshot,
  wipeBeforeImport,
});

const summary = await client.query("status.js:getDatabaseSummary", {});

console.log("[convex-migrate] Import result:");
console.log(JSON.stringify(result, null, 2));
console.log("[convex-migrate] Database summary:");
console.log(JSON.stringify(summary, null, 2));

db.close();
