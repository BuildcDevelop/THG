import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  BUILDING_DEFS,
  BUILDING_ORDER,
  UNIT_ORDER,
  calculateMintCoinStorageCap,
  calculateMintGoldStorageCap,
  calculateResourceCap,
  calculateUpgradeDurationSec,
  convertLegacyBuildingLevelToCurrent,
  convertLegacyResourceBuildingLevelToCurrent,
  getMaxBuildingLevel,
} from './gameConfig.js';
import {
  ABANDONED_SETTLEMENT_KIND,
  BOT_CITY_STATE_SETTLEMENT_KIND,
  PLAYER_SETTLEMENT_KIND,
  createFallbackBotCityStateVillageName,
  extractBotCityStateHistoricalName,
  formatBotCityStateVillageName,
  pickRandomUnusedBotCityStateName,
} from './botCityStates.js';

const RESOURCE_BUILDING_SCALE_MIGRATION_KEY = 'resource_building_scale_version';
const RESOURCE_BUILDING_SCALE_MIGRATION_VERSION = 'resource-buildings-max-10';
const BUILDING_REBALANCE_MIGRATION_KEY = 'building_rebalance_version';
const BUILDING_REBALANCE_MIGRATION_VERSION = 'buildings-rebalance-max10-v1';

const configuredDataDir = String(process.env.TLD_DATA_DIR ?? process.env.THG_DATA_DIR ?? '').trim();
const configuredSeedDbPath = String(process.env.TLD_SEED_DB_PATH ?? process.env.THG_SEED_DB_PATH ?? '').trim();
const isNetlifyRuntime = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const appEnv = String(process.env.TLD_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
const isProduction = appEnv === 'production';
const enableLocalTestSetup =
  !isProduction && String(process.env.TLD_LOCAL_TEST_SETUP ?? 'true').trim().toLowerCase() !== 'false';
const allowServerlessSqlite =
  String(process.env.TLD_ALLOW_SERVERLESS_SQLITE ?? '').trim().toLowerCase() === 'true';
const localDataDir = path.join(process.cwd(), 'server', 'data');
const localSeedDbPath = path.join(localDataDir, 'game.seed.sqlite.backup');
const dataDir = configuredDataDir
  ? path.resolve(configuredDataDir)
  : isNetlifyRuntime
    ? path.join('/tmp', 'tld-data')
    : localDataDir;
const dbPath = path.join(dataDir, 'game.sqlite');
const seedDbPath = configuredSeedDbPath ? path.resolve(configuredSeedDbPath) : localSeedDbPath;

if (isProduction && isNetlifyRuntime && !allowServerlessSqlite) {
  throw new Error(
    '[db] Odmitam spustit SQLite v serverless produkci (ephemeral filesystem). ' +
      'Pouzij self-host backend (Docker) s persistentnim volume pro TLD_DATA_DIR/THG_DATA_DIR.',
  );
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const hasExistingDatabase = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
if (!hasExistingDatabase && fs.existsSync(seedDbPath)) {
  fs.copyFileSync(seedDbPath, dbPath);
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const WORLD_REGION = {
  id: 1,
  originX: 200,
  originY: 430,
  size: 50,
};

const BASE_ACCOUNTS = ['Hayato', 'Torreya', 'Pegak', 'Sentryn', 'TSN'];
const EXTRA_ACCOUNTS = Array.from({ length: 100 }, (_, index) => `Player${String(index + 1).padStart(3, '0')}`);
const SPECIAL_PLAYER_ACCOUNTS = [
  { username: '-SaThAn?!', password: 'SaThAn?!_Abyss26', boostedStart: true },
  { username: '*333*', password: 'Star333!Forge26', boostedStart: true },
  { username: 'Wild', password: '7777dd95' },
  { username: 'Insanity', password: '98854657da5' },
  { username: 'Nicol', password: '22244444433a' },
  { username: 'Chakitis', password: '5555s6s6s5' },
];
const PRIORITY_PLAYER_PASSWORDS = new Map([
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
]);
const ALL_ACCOUNTS = [...BASE_ACCOUNTS, ...EXTRA_ACCOUNTS, ...SPECIAL_PLAYER_ACCOUNTS.map((entry) => entry.username)];
const SPECIAL_PLAYER_ACCOUNT_BY_USERNAME = new Map(
  SPECIAL_PLAYER_ACCOUNTS.map((entry) => [entry.username, entry]),
);
const KINGDOMS = ['Aurora Pact', 'Iron Dominion', 'Emerald Circle', 'Skywatch Union', 'Obsidian League'];
const ABANDONED_BOT_VILLAGE_COUNT = 20;
const ABANDONED_BOT_USERNAME_PREFIX = '__abandoned_ai__';
const ACTIVE_BOT_USERNAME = 'Bot';
const ACTIVE_BOT_VILLAGE_COUNT = 3;
const ACTIVE_BOT_PROTECTION_DAYS = 5;
const ABANDONED_BOT_VILLAGE_NAME_PREFIX = 'Opuštěná vesnice';
const GARRISON_MILITIA_CAP = 180;
const GARRISON_ARCHER_CAP = 120;
const STARTING_RESOURCES = {
  wood: 1000,
  stone: 1000,
  iron: 1000,
};
const ACTIVE_BOT_STARTING_RESOURCES = {
  wood: 6000,
  stone: 6000,
  iron: 6000,
  gold: 0,
  coins: 0,
};
const STARTING_BUILDING_LEVELS = {
  townhall: 1,
  warehouse: 1,
  'residential-quarter': 1,
  university: 0,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  'gold-mine': 0,
  barracks: 0,
  stable: 0,
  workshop: 0,
  market: 0,
  mint: 0,
  vault: 0,
  hideout: 0,
  fortification: 0,
  gate: 0,
};
const VILLAGE_BUILDING_LEVEL_FLOORS = {
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  'gold-mine': 0,
  warehouse: 1,
  hideout: 0,
  mint: 0,
  vault: 0,
  market: 0,
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
const ACTIVE_BOT_STARTING_BUILDING_LEVELS = {
  townhall: 1,
  warehouse: 1,
  'residential-quarter': 1,
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  hideout: 0,
  barracks: 1,
};
const SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS = {
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  'gold-mine': 1,
  warehouse: 1,
};
const ABANDONED_MILITIA_COUNT = 100;
const ACTIVE_BOT_STARTING_UNITS = {
  militia: 20,
};

const nowIso = () => new Date().toISOString();
const resolveSeedPassword = (username, fallbackPassword = '123') =>
  String(PRIORITY_PLAYER_PASSWORDS.get(String(username)) ?? fallbackPassword);

const createSchema = () => {
  db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_bot INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_username_nocase
  ON players(username COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS villages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kingdom TEXT NOT NULL DEFAULT 'Neutral',
  coord_x INTEGER NOT NULL,
  coord_y INTEGER NOT NULL,
  region INTEGER NOT NULL,
  peace_until TEXT,
  prestige INTEGER NOT NULL DEFAULT 0,
  loyalty INTEGER NOT NULL DEFAULT 100,
  settlement_kind TEXT NOT NULL DEFAULT 'player',
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS resources (
  village_id INTEGER PRIMARY KEY,
  wood REAL NOT NULL,
  stone REAL NOT NULL,
  iron REAL NOT NULL,
  gold REAL NOT NULL DEFAULT 0,
  coins REAL NOT NULL DEFAULT 0,
  last_sync_at TEXT,
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

CREATE TABLE IF NOT EXISTS village_garrisons (
  village_id INTEGER PRIMARY KEY,
  militia_amount INTEGER NOT NULL DEFAULT 180,
  archer_amount INTEGER NOT NULL DEFAULT 120,
  militia_progress REAL NOT NULL DEFAULT 0,
  archer_progress REAL NOT NULL DEFAULT 0,
  last_sync_at TEXT,
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
  plan_id TEXT,
  plan_leg_id TEXT,
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

CREATE TABLE IF NOT EXISTS combat_retaliation_flags (
  aggressor_player_id INTEGER NOT NULL,
  defender_player_id INTEGER NOT NULL,
  region INTEGER NOT NULL DEFAULT 1,
  first_attacked_at TEXT NOT NULL,
  last_attacked_at TEXT NOT NULL,
  PRIMARY KEY (aggressor_player_id, defender_player_id, region),
  FOREIGN KEY (aggressor_player_id) REFERENCES players(id),
  FOREIGN KEY (defender_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_combat_retaliation_defender_region
  ON combat_retaliation_flags(defender_player_id, region, last_attacked_at DESC);

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

CREATE TABLE IF NOT EXISTS kingdom_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region INTEGER NOT NULL DEFAULT 1,
  kingdom TEXT NOT NULL,
  inviter_player_id INTEGER NOT NULL,
  target_player_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT,
  FOREIGN KEY (inviter_player_id) REFERENCES players(id),
  FOREIGN KEY (target_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_kingdom_invites_target_status
  ON kingdom_invites(target_player_id, region, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_kingdom_invites_inviter_status
  ON kingdom_invites(inviter_player_id, region, status, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_invites_target_pending
  ON kingdom_invites(target_player_id, region)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS kingdom_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region INTEGER NOT NULL DEFAULT 1,
  kingdom TEXT,
  event_type TEXT NOT NULL,
  actor_player_id INTEGER,
  target_player_id INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_player_id) REFERENCES players(id),
  FOREIGN KEY (target_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_kingdom_events_kingdom_created
  ON kingdom_events(region, kingdom, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_kingdom_events_actor_created
  ON kingdom_events(actor_player_id, region, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_kingdom_events_target_created
  ON kingdom_events(target_player_id, region, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS player_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  region INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT,
  source_type TEXT,
  source_id INTEGER,
  created_at TEXT NOT NULL,
  read_at TEXT,
  archived_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_player_notifications_player_created
  ON player_notifications(player_id, region, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_player_notifications_visibility
  ON player_notifications(player_id, region, deleted_at, archived_at, read_at, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_player_notifications_cleanup
  ON player_notifications(region, archived_at, deleted_at, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_notifications_source_unique
  ON player_notifications(player_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_profiles (
  player_id INTEGER PRIMARY KEY,
  avatar_url TEXT,
  avatar_updated_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS player_presence (
  player_id INTEGER PRIMARY KEY,
  last_active_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS player_friendships (
  player_low_id INTEGER NOT NULL,
  player_high_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (player_low_id, player_high_id),
  FOREIGN KEY (player_low_id) REFERENCES players(id),
  FOREIGN KEY (player_high_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS player_friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_player_id INTEGER NOT NULL,
  receiver_player_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT,
  FOREIGN KEY (sender_player_id) REFERENCES players(id),
  FOREIGN KEY (receiver_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_player_friend_requests_receiver_status
  ON player_friend_requests(receiver_player_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_player_friend_requests_sender_status
  ON player_friend_requests(sender_player_id, status, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_friend_requests_unique_pending
  ON player_friend_requests(sender_player_id, receiver_player_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS player_blocks (
  blocker_player_id INTEGER NOT NULL,
  blocked_player_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_player_id, blocked_player_id),
  FOREIGN KEY (blocker_player_id) REFERENCES players(id),
  FOREIGN KEY (blocked_player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'direct',
  created_by_player_id INTEGER NOT NULL,
  direct_low_player_id INTEGER,
  direct_high_player_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by_player_id) REFERENCES players(id),
  FOREIGN KEY (direct_low_player_id) REFERENCES players(id),
  FOREIGN KEY (direct_high_player_id) REFERENCES players(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_direct_unique
  ON chat_threads(kind, direct_low_player_id, direct_high_player_id)
  WHERE kind = 'direct'
    AND direct_low_player_id IS NOT NULL
    AND direct_high_player_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_thread_members (
  thread_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  archived_at TEXT,
  last_opened_at TEXT,
  last_read_message_id INTEGER,
  PRIMARY KEY (thread_id, player_id),
  FOREIGN KEY (thread_id) REFERENCES chat_threads(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_members_player_archived
  ON chat_thread_members(player_id, archived_at, thread_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  sender_player_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (thread_id) REFERENCES chat_threads(id),
  FOREIGN KEY (sender_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON chat_messages(thread_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created
  ON chat_messages(sender_player_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
  ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_threads_creator_created
  ON chat_threads(created_by_player_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS chat_abuse_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_abuse_events_player_type_created
  ON chat_abuse_events(player_id, event_type, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS player_ui_state (
  player_id INTEGER PRIMARY KEY,
  communication_json TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS notification_shares (
  share_token TEXT PRIMARY KEY,
  source_player_id INTEGER NOT NULL,
  source_notification_id INTEGER NOT NULL,
  source_region INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_player_id) REFERENCES players(id),
  FOREIGN KEY (source_notification_id) REFERENCES player_notifications(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_shares_source
  ON notification_shares(source_player_id, source_notification_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_sessions (
  session_token_hash TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_player_expires
  ON player_sessions(player_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_sessions_expires
  ON player_sessions(expires_at);

CREATE TABLE IF NOT EXISTS market_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  village_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  give_wood INTEGER NOT NULL DEFAULT 0,
  give_stone INTEGER NOT NULL DEFAULT 0,
  give_iron INTEGER NOT NULL DEFAULT 0,
  want_wood INTEGER NOT NULL DEFAULT 0,
  want_stone INTEGER NOT NULL DEFAULT 0,
  want_iron INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_market_offers_status_region_created
  ON market_offers(status, region, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS logistics_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_player_id INTEGER NOT NULL,
  source_village_id INTEGER NOT NULL,
  target_village_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  wood INTEGER NOT NULL DEFAULT 0,
  stone INTEGER NOT NULL DEFAULT 0,
  iron INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TEXT NOT NULL,
  arrive_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (owner_player_id) REFERENCES players(id),
  FOREIGN KEY (source_village_id) REFERENCES villages(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_logistics_routes_status_arrive
  ON logistics_routes(status, arrive_at, region);

CREATE TABLE IF NOT EXISTS market_guild_settings (
  source_village_id INTEGER PRIMARY KEY,
  owner_player_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  cycle_interval_sec INTEGER NOT NULL DEFAULT 18000,
  cursor_index INTEGER NOT NULL DEFAULT 0,
  next_dispatch_at TEXT,
  last_dispatch_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_player_id) REFERENCES players(id),
  FOREIGN KEY (source_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_market_guild_settings_due
  ON market_guild_settings(enabled, next_dispatch_at, region, source_village_id);

CREATE TABLE IF NOT EXISTS market_guild_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_village_id INTEGER NOT NULL,
  target_village_id INTEGER NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_village_id) REFERENCES villages(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id),
  UNIQUE(source_village_id, target_village_id)
);

CREATE INDEX IF NOT EXISTS idx_market_guild_targets_source_sort
  ON market_guild_targets(source_village_id, sort_index ASC, id ASC);

CREATE TABLE IF NOT EXISTS market_guild_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_player_id INTEGER NOT NULL,
  source_village_id INTEGER NOT NULL,
  target_village_id INTEGER,
  region INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  reason_code TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_player_id) REFERENCES players(id),
  FOREIGN KEY (source_village_id) REFERENCES villages(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_market_guild_audit_source_created
  ON market_guild_audit_logs(source_village_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_market_guild_audit_owner_created
  ON market_guild_audit_logs(owner_player_id, region, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS academics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  village_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  assigned_research_id TEXT,
  created_at TEXT NOT NULL,
  removed_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_academics_player_region_status
  ON academics(player_id, region, status, id DESC);

CREATE TABLE IF NOT EXISTS research_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  research_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  progress REAL NOT NULL DEFAULT 0,
  assigned_academics INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(player_id, region, research_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_research_progress_player_region
  ON research_progress(player_id, region, status, research_id);

CREATE TABLE IF NOT EXISTS mercenary_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  village_id INTEGER NOT NULL,
  region INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_route',
  ordered_at TEXT NOT NULL,
  arrive_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  delivered_at TEXT,
  finished_at TEXT,
  unit_amount INTEGER NOT NULL DEFAULT 1000,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_mercenary_contracts_status_timing
  ON mercenary_contracts(status, region, arrive_at, expires_at);

CREATE TABLE IF NOT EXISTS planner_plans (
  id TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'scheduled',
    'needs_reconfirmation',
    'dispatching',
    'completed',
    'failed',
    'canceled'
  )),
  revision INTEGER NOT NULL DEFAULT 1,
  target_player_id INTEGER NOT NULL,
  target_village_id INTEGER NOT NULL,
  target_player_username_snapshot TEXT NOT NULL,
  target_village_name_snapshot TEXT NOT NULL,
  target_kingdom_snapshot TEXT NOT NULL,
  target_snapshot_hash TEXT NOT NULL,
  confirmed_at TEXT,
  first_send_at_utc TEXT,
  last_send_at_utc TEXT,
  dispatch_started_at_utc TEXT,
  completed_at TEXT,
  failed_at TEXT,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (target_player_id) REFERENCES players(id),
  FOREIGN KEY (target_village_id) REFERENCES villages(id)
);

CREATE INDEX IF NOT EXISTS idx_planner_plans_player_world_status
  ON planner_plans(player_id, world_id, status);

CREATE INDEX IF NOT EXISTS idx_planner_plans_world_status_first_send
  ON planner_plans(world_id, status, first_send_at_utc);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_active_plan_per_player_world
  ON planner_plans(player_id, world_id)
  WHERE status IN ('scheduled', 'needs_reconfirmation', 'dispatching');

CREATE TABLE IF NOT EXISTS planner_plan_legs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  leg_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sent', 'failed', 'canceled')),
  origin_village_id INTEGER NOT NULL,
  origin_village_name_snapshot TEXT NOT NULL,
  impact_at_utc TEXT NOT NULL,
  send_at_utc TEXT NOT NULL,
  travel_duration_sec INTEGER NOT NULL,
  sent_at_utc TEXT,
  fail_code TEXT,
  fail_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES planner_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (origin_village_id) REFERENCES villages(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_legs_order
  ON planner_plan_legs(plan_id, leg_order);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_legs_origin
  ON planner_plan_legs(plan_id, origin_village_id);

CREATE INDEX IF NOT EXISTS idx_planner_plan_legs_plan_send
  ON planner_plan_legs(plan_id, send_at_utc);

CREATE TABLE IF NOT EXISTS planner_plan_leg_units (
  id TEXT PRIMARY KEY,
  plan_leg_id TEXT NOT NULL,
  unit_id TEXT NOT NULL CHECK (unit_id IN ('cavalry', 'ram', 'scout')),
  planned_amount INTEGER NOT NULL CHECK (planned_amount > 0),
  FOREIGN KEY (plan_leg_id) REFERENCES planner_plan_legs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planner_plan_leg_units_leg
  ON planner_plan_leg_units(plan_leg_id);

CREATE TABLE IF NOT EXISTS planner_plan_events (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  plan_leg_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES planner_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_leg_id) REFERENCES planner_plan_legs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_planner_plan_events_plan_created
  ON planner_plan_events(plan_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_tick_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_world_state (
  player_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  has_spawned INTEGER NOT NULL DEFAULT 0,
  spawn_count INTEGER NOT NULL DEFAULT 0,
  last_spawn_at TEXT,
  last_spawn_direction TEXT,
  last_spawn_reason TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, world_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_player_world_state_world
  ON player_world_state(world_id, has_spawned, spawn_count);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

  const villageColumns = db.prepare('PRAGMA table_info(villages)').all();
  const hasKingdomColumn = villageColumns.some((column) => column.name === 'kingdom');
  if (!hasKingdomColumn) {
    db.prepare("ALTER TABLE villages ADD COLUMN kingdom TEXT NOT NULL DEFAULT 'Neutral'").run();
  }
  const hasPeaceUntilColumn = villageColumns.some((column) => column.name === 'peace_until');
  if (!hasPeaceUntilColumn) {
    db.prepare('ALTER TABLE villages ADD COLUMN peace_until TEXT').run();
  }
  const hasSettlementKindColumn = villageColumns.some((column) => column.name === 'settlement_kind');
  if (!hasSettlementKindColumn) {
    db.prepare(`ALTER TABLE villages ADD COLUMN settlement_kind TEXT NOT NULL DEFAULT '${PLAYER_SETTLEMENT_KIND}'`).run();
  }
  db.prepare(
    `UPDATE villages
     SET settlement_kind = CASE
       WHEN EXISTS (
         SELECT 1
         FROM players p
         WHERE p.id = villages.player_id
           AND p.is_bot = 1
           AND p.username GLOB ?
       ) THEN ?
       WHEN EXISTS (
         SELECT 1
         FROM players p
         WHERE p.id = villages.player_id
           AND p.is_bot = 1
       ) THEN ?
       ELSE ?
     END
     WHERE settlement_kind IS NULL
        OR TRIM(settlement_kind) = ''
        OR settlement_kind NOT IN (?, ?, ?)`,
  ).run(
    `${ABANDONED_BOT_USERNAME_PREFIX}*`,
    ABANDONED_SETTLEMENT_KIND,
    BOT_CITY_STATE_SETTLEMENT_KIND,
    PLAYER_SETTLEMENT_KIND,
    PLAYER_SETTLEMENT_KIND,
    ABANDONED_SETTLEMENT_KIND,
    BOT_CITY_STATE_SETTLEMENT_KIND,
  );
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_villages_region_settlement_kind
     ON villages(region, settlement_kind, id)`,
  ).run();
  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_villages_region_bot_city_state_name_unique
     ON villages(region, name)
     WHERE settlement_kind = '${BOT_CITY_STATE_SETTLEMENT_KIND}'`,
  ).run();

  const garrisonColumns = db.prepare('PRAGMA table_info(village_garrisons)').all();
  const hasMilitiaAmountColumn = garrisonColumns.some((column) => column.name === 'militia_amount');
  if (!hasMilitiaAmountColumn) {
    db.prepare(`ALTER TABLE village_garrisons ADD COLUMN militia_amount INTEGER NOT NULL DEFAULT ${GARRISON_MILITIA_CAP}`).run();
  }
  const hasArcherAmountColumn = garrisonColumns.some((column) => column.name === 'archer_amount');
  if (!hasArcherAmountColumn) {
    db.prepare(`ALTER TABLE village_garrisons ADD COLUMN archer_amount INTEGER NOT NULL DEFAULT ${GARRISON_ARCHER_CAP}`).run();
  }
  const hasMilitiaProgressColumn = garrisonColumns.some((column) => column.name === 'militia_progress');
  if (!hasMilitiaProgressColumn) {
    db.prepare('ALTER TABLE village_garrisons ADD COLUMN militia_progress REAL NOT NULL DEFAULT 0').run();
  }
  const hasArcherProgressColumn = garrisonColumns.some((column) => column.name === 'archer_progress');
  if (!hasArcherProgressColumn) {
    db.prepare('ALTER TABLE village_garrisons ADD COLUMN archer_progress REAL NOT NULL DEFAULT 0').run();
  }
  const hasGarrisonLastSyncAtColumn = garrisonColumns.some((column) => column.name === 'last_sync_at');
  if (!hasGarrisonLastSyncAtColumn) {
    db.prepare('ALTER TABLE village_garrisons ADD COLUMN last_sync_at TEXT').run();
  }
  db.prepare(
    `INSERT INTO village_garrisons (village_id, militia_amount, archer_amount, militia_progress, archer_progress, last_sync_at)
     SELECT
       v.id,
       ?,
       ?,
       0,
       0,
       COALESCE((SELECT last_tick_at FROM game_state WHERE id = 1), ?)
     FROM villages v
     LEFT JOIN village_garrisons g ON g.village_id = v.id
     WHERE g.village_id IS NULL`,
  ).run(GARRISON_MILITIA_CAP, GARRISON_ARCHER_CAP, nowIso());
  db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_village_garrison_after_village_insert
AFTER INSERT ON villages
BEGIN
  INSERT OR IGNORE INTO village_garrisons (
    village_id,
    militia_amount,
    archer_amount,
    militia_progress,
    archer_progress,
    last_sync_at
  ) VALUES (NEW.id, ${GARRISON_MILITIA_CAP}, ${GARRISON_ARCHER_CAP}, 0, 0, NEW.created_at);
END;
`);

  const playerColumns = db.prepare('PRAGMA table_info(players)').all();
  const hasIsBotColumn = playerColumns.some((column) => column.name === 'is_bot');
  if (!hasIsBotColumn) {
    db.prepare('ALTER TABLE players ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0').run();
  }

  const resourceColumns = db.prepare('PRAGMA table_info(resources)').all();
  const hasGoldColumn = resourceColumns.some((column) => column.name === 'gold');
  if (!hasGoldColumn) {
    db.prepare('ALTER TABLE resources ADD COLUMN gold REAL NOT NULL DEFAULT 0').run();
  }
  const hasCoinsColumn = resourceColumns.some((column) => column.name === 'coins');
  if (!hasCoinsColumn) {
    db.prepare('ALTER TABLE resources ADD COLUMN coins REAL NOT NULL DEFAULT 0').run();
  }
  const hasLastSyncAtColumn = resourceColumns.some((column) => column.name === 'last_sync_at');
  if (!hasLastSyncAtColumn) {
    db.prepare('ALTER TABLE resources ADD COLUMN last_sync_at TEXT').run();
  }
  db.prepare(
    `UPDATE resources
     SET last_sync_at = COALESCE(
       last_sync_at,
       (SELECT last_tick_at FROM game_state WHERE id = 1),
       ?
     )`,
  ).run(nowIso());

  const movementColumns = db.prepare('PRAGMA table_info(army_movements)').all();
  const hasPlanIdColumn = movementColumns.some((column) => column.name === 'plan_id');
  if (!hasPlanIdColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN plan_id TEXT').run();
  }
  const hasPlanLegIdColumn = movementColumns.some((column) => column.name === 'plan_leg_id');
  if (!hasPlanLegIdColumn) {
    db.prepare('ALTER TABLE army_movements ADD COLUMN plan_leg_id TEXT').run();
  }
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
  db.exec(`
CREATE INDEX IF NOT EXISTS idx_army_movements_plan_refs
  ON army_movements(plan_id, plan_leg_id, started_at DESC, id DESC);
`);

  const marketGuildTargetColumns = db.prepare('PRAGMA table_info(market_guild_targets)').all();
  const hasPausedColumn = marketGuildTargetColumns.some((column) => column.name === 'is_paused');
  if (!hasPausedColumn) {
    db.prepare('ALTER TABLE market_guild_targets ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0').run();
  }

  const kingdomInviteColumns = db.prepare('PRAGMA table_info(kingdom_invites)').all();
  const hasKingdomInviteRegionColumn = kingdomInviteColumns.some((column) => column.name === 'region');
  if (!hasKingdomInviteRegionColumn) {
    db.prepare(`ALTER TABLE kingdom_invites ADD COLUMN region INTEGER NOT NULL DEFAULT ${Number(WORLD_REGION.id)}`).run();
    // Best-effort backfill for legacy rows: infer world by inviter's first village.
    db.prepare(
      `UPDATE kingdom_invites
       SET region = COALESCE((
         SELECT vv.region
         FROM villages vv
         WHERE vv.player_id = kingdom_invites.inviter_player_id
         ORDER BY vv.id ASC
         LIMIT 1
       ), region)`,
    ).run();
  }

  const kingdomEventColumns = db.prepare('PRAGMA table_info(kingdom_events)').all();
  const hasKingdomEventRegionColumn = kingdomEventColumns.some((column) => column.name === 'region');
  if (!hasKingdomEventRegionColumn) {
    db.prepare(`ALTER TABLE kingdom_events ADD COLUMN region INTEGER NOT NULL DEFAULT ${Number(WORLD_REGION.id)}`).run();
    // Best-effort backfill for legacy rows using actor/target world presence.
    db.prepare(
      `UPDATE kingdom_events
       SET region = COALESCE((
         SELECT vv.region
         FROM villages vv
         WHERE vv.player_id = kingdom_events.actor_player_id
         ORDER BY vv.id ASC
         LIMIT 1
       ), (
         SELECT vv.region
         FROM villages vv
         WHERE vv.player_id = kingdom_events.target_player_id
         ORDER BY vv.id ASC
         LIMIT 1
       ), region)`,
    ).run();
  }

  // Recreate indexes to enforce per-world membership/invite isolation.
  db.exec(`
DROP INDEX IF EXISTS idx_kingdom_invites_target_status;
DROP INDEX IF EXISTS idx_kingdom_invites_inviter_status;
DROP INDEX IF EXISTS idx_kingdom_invites_target_pending;
DROP INDEX IF EXISTS idx_kingdom_events_kingdom_created;
DROP INDEX IF EXISTS idx_kingdom_events_actor_created;
DROP INDEX IF EXISTS idx_kingdom_events_target_created;
`);
  db.exec(`
CREATE INDEX IF NOT EXISTS idx_kingdom_invites_target_status
  ON kingdom_invites(target_player_id, region, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_kingdom_invites_inviter_status
  ON kingdom_invites(inviter_player_id, region, status, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_invites_target_pending
  ON kingdom_invites(target_player_id, region)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_kingdom_events_kingdom_created
  ON kingdom_events(region, kingdom, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_kingdom_events_actor_created
  ON kingdom_events(actor_player_id, region, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_kingdom_events_target_created
  ON kingdom_events(target_player_id, region, created_at DESC, id DESC);
`);
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
DELETE FROM combat_retaliation_flags;
DELETE FROM kingdom_invites;
DELETE FROM kingdom_events;
DELETE FROM player_notifications;
DELETE FROM chat_messages;
DELETE FROM chat_thread_members;
DELETE FROM chat_threads;
DELETE FROM player_friend_requests;
DELETE FROM player_friendships;
DELETE FROM player_blocks;
DELETE FROM chat_abuse_events;
DELETE FROM player_presence;
DELETE FROM player_profiles;
DELETE FROM player_ui_state;
DELETE FROM player_sessions;
DELETE FROM mercenary_contracts;
DELETE FROM research_progress;
DELETE FROM academics;
DELETE FROM market_guild_audit_logs;
DELETE FROM market_guild_targets;
DELETE FROM market_guild_settings;
DELETE FROM logistics_routes;
DELETE FROM market_offers;
DELETE FROM units;
DELETE FROM buildings;
DELETE FROM resources;
DELETE FROM villages;
DELETE FROM player_world_state;
DELETE FROM players;
DELETE FROM game_state;
DELETE FROM app_meta;
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
  const updateVillageSettlementKindStmt = db.prepare(
    'UPDATE villages SET settlement_kind = ? WHERE id = ?',
  );
  const insertResourceStmt = db.prepare(
    'INSERT INTO resources (village_id, wood, stone, iron, gold, coins) VALUES (?, ?, ?, ?, ?, ?)',
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
    const password = resolveSeedPassword(username, specialAccount?.password ?? '123');
    const boostedStartLevels = specialAccount?.boostedStart ? SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS : null;
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
      0,
      0,
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
    updateVillageSettlementKindStmt.run(ABANDONED_SETTLEMENT_KIND, villageId);
    updateVillageSettlementKindStmt.run(ABANDONED_SETTLEMENT_KIND, villageId);

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
  db.prepare(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(RESOURCE_BUILDING_SCALE_MIGRATION_KEY, RESOURCE_BUILDING_SCALE_MIGRATION_VERSION);
  db.prepare(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(BUILDING_REBALANCE_MIGRATION_KEY, BUILDING_REBALANCE_MIGRATION_VERSION);
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
    'INSERT INTO resources (village_id, wood, stone, iron, gold, coins) VALUES (?, ?, ?, ?, ?, ?)',
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
      0,
      0,
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

const ensureActiveBotVillages = db.transaction(() => {
  const selectNamedBotPlayerStmt = db.prepare(
    `SELECT
        id,
        is_bot AS isBot
     FROM players
     WHERE username = ? COLLATE NOCASE
     LIMIT 1`,
  );
  const insertPlayerStmt = db.prepare(
    'INSERT INTO players (username, password, is_bot, created_at) VALUES (?, ?, ?, ?)',
  );
  const updatePlayerToBotStmt = db.prepare('UPDATE players SET is_bot = 1, password = ? WHERE id = ?');
  const selectBotVillagesStmt = db.prepare(
    `SELECT
        id,
        name,
        settlement_kind AS settlementKind
     FROM villages
     WHERE player_id = ? AND region = ?
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
  const updateVillageSettlementKindStmt = db.prepare(
    'UPDATE villages SET settlement_kind = ? WHERE id = ?',
  );
  const updateVillageNameAndSettlementKindStmt = db.prepare(
    'UPDATE villages SET name = ?, settlement_kind = ? WHERE id = ?',
  );
  const upsertResourceStmt = db.prepare(
    `INSERT INTO resources (village_id, wood, stone, iron, gold, coins)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(village_id) DO UPDATE SET
       wood = CASE WHEN resources.wood < excluded.wood THEN excluded.wood ELSE resources.wood END,
       stone = CASE WHEN resources.stone < excluded.stone THEN excluded.stone ELSE resources.stone END,
       iron = CASE WHEN resources.iron < excluded.iron THEN excluded.iron ELSE resources.iron END,
       gold = CASE WHEN resources.gold < excluded.gold THEN excluded.gold ELSE resources.gold END,
       coins = CASE WHEN resources.coins < excluded.coins THEN excluded.coins ELSE resources.coins END`,
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
  const updateVillagePeaceUntilStmt = db.prepare(
    `UPDATE villages
     SET peace_until = ?
     WHERE id = ?
       AND (peace_until IS NULL OR TRIM(peace_until) = '')`,
  );

  const usedVillageNames = new Set(
    db
      .prepare(
        `SELECT name
         FROM villages
         WHERE region = ?`,
      )
      .all(Number(WORLD_REGION.id))
      .map((row) => String(row.name ?? '').trim())
      .filter((name) => name.length > 0),
  );
  const usedHistoricalNames = new Set();
  const allocateBotVillageName = () => {
    const historicalName = pickRandomUnusedBotCityStateName(usedHistoricalNames);
    if (historicalName) {
      usedHistoricalNames.add(historicalName);
      const villageName = formatBotCityStateVillageName(historicalName);
      usedVillageNames.add(villageName);
      return villageName;
    }
    const fallbackVillageName = createFallbackBotCityStateVillageName(usedVillageNames, 101);
    usedVillageNames.add(fallbackVillageName);
    return fallbackVillageName;
  };

  let botPlayer = selectNamedBotPlayerStmt.get(ACTIVE_BOT_USERNAME);
  if (!botPlayer) {
    const insertion = insertPlayerStmt.run(ACTIVE_BOT_USERNAME, '', 1, nowIso());
    botPlayer = {
      id: Number(insertion.lastInsertRowid),
      isBot: 1,
    };
  } else if (Number(botPlayer.isBot ?? 0) !== 1) {
    updatePlayerToBotStmt.run('', Number(botPlayer.id));
    botPlayer = {
      id: Number(botPlayer.id),
      isBot: 1,
    };
  }

  const playerId = Number(botPlayer.id);
  const existingVillages = selectBotVillagesStmt.all(playerId, WORLD_REGION.id);
  const assignedHistoricalNames = new Set();
  for (const village of existingVillages) {
    const currentName = String(village.name ?? '').trim();
    const historicalName = extractBotCityStateHistoricalName(currentName);
    const isAlreadyAssigned = historicalName.length > 0 && assignedHistoricalNames.has(historicalName);
    if (historicalName.length > 0 && !isAlreadyAssigned) {
      assignedHistoricalNames.add(historicalName);
      usedHistoricalNames.add(historicalName);
      usedVillageNames.add(currentName);
      if (String(village.settlementKind ?? '') !== BOT_CITY_STATE_SETTLEMENT_KIND) {
        updateVillageSettlementKindStmt.run(BOT_CITY_STATE_SETTLEMENT_KIND, Number(village.id));
      }
      continue;
    }

    const renamedVillage = allocateBotVillageName();
    const nextHistoricalName = extractBotCityStateHistoricalName(renamedVillage);
    if (nextHistoricalName.length > 0) {
      assignedHistoricalNames.add(nextHistoricalName);
    }
    updateVillageNameAndSettlementKindStmt.run(
      renamedVillage,
      BOT_CITY_STATE_SETTLEMENT_KIND,
      Number(village.id),
    );
  }

  const missingVillageCount = Math.max(0, ACTIVE_BOT_VILLAGE_COUNT - existingVillages.length);
  if (missingVillageCount > 0) {
    const occupied = new Set(
      db
        .prepare('SELECT coord_x AS coordX, coord_y AS coordY FROM villages')
        .all()
        .map((row) => `${Number(row.coordX)}|${Number(row.coordY)}`),
    );
    const allCells = buildSpawnCells(WORLD_REGION.size * WORLD_REGION.size);
    const freeCells = allCells.filter((cell) => {
      const coordX = WORLD_REGION.originX + cell.localX - 1;
      const coordY = WORLD_REGION.originY + cell.localY - 1;
      return !occupied.has(`${coordX}|${coordY}`);
    });

    for (let index = 0; index < missingVillageCount; index += 1) {
      const spawn = freeCells[index];
      if (!spawn) {
        break;
      }
      const coordX = WORLD_REGION.originX + spawn.localX - 1;
      const coordY = WORLD_REGION.originY + spawn.localY - 1;
      const villageName = allocateBotVillageName();
      const insertion = insertVillageStmt.run(
        playerId,
        villageName,
        'Neutral',
        coordX,
        coordY,
        WORLD_REGION.id,
        startingPrestige(Math.max(0, Number(ACTIVE_BOT_STARTING_UNITS.militia ?? 0))),
        100,
        nowIso(),
      );
      const villageId = Number(insertion.lastInsertRowid);
      updateVillageSettlementKindStmt.run(BOT_CITY_STATE_SETTLEMENT_KIND, villageId);
    }
  }

  const botVillages = selectBotVillagesStmt
    .all(playerId, WORLD_REGION.id)
    .slice(0, ACTIVE_BOT_VILLAGE_COUNT);
  const activeBotProtectionUntilIso = new Date(
    Date.now() + ACTIVE_BOT_PROTECTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  for (const village of botVillages) {
    const villageId = Number(village.id);
    updateVillagePeaceUntilStmt.run(activeBotProtectionUntilIso, villageId);
    upsertResourceStmt.run(
      villageId,
      ACTIVE_BOT_STARTING_RESOURCES.wood,
      ACTIVE_BOT_STARTING_RESOURCES.stone,
      ACTIVE_BOT_STARTING_RESOURCES.iron,
      ACTIVE_BOT_STARTING_RESOURCES.gold,
      ACTIVE_BOT_STARTING_RESOURCES.coins,
    );

    for (const buildingId of BUILDING_ORDER) {
      const targetLevel = Math.max(0, Number(ACTIVE_BOT_STARTING_BUILDING_LEVELS[buildingId] ?? 0));
      upsertBuildingStmt.run(villageId, buildingId, targetLevel);
    }

    for (const unitId of UNIT_ORDER) {
      const targetAmount = Math.max(0, Math.floor(Number(ACTIVE_BOT_STARTING_UNITS[unitId] ?? 0)));
      upsertUnitStmt.run(villageId, unitId, targetAmount);
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
  db.prepare(
    `UPDATE villages
     SET settlement_kind = ?
     WHERE player_id IN (
       SELECT id
       FROM players
       WHERE is_bot = 1
         AND username GLOB ?
     )`,
  ).run(ABANDONED_SETTLEMENT_KIND, `${ABANDONED_BOT_USERNAME_PREFIX}*`);
  db.prepare(
    `UPDATE villages
     SET settlement_kind = ?
     WHERE player_id IN (
       SELECT id
       FROM players
       WHERE is_bot = 1
         AND username NOT GLOB ?
     )`,
  ).run(BOT_CITY_STATE_SETTLEMENT_KIND, `${ABANDONED_BOT_USERNAME_PREFIX}*`);
  db.prepare(
    `UPDATE villages
     SET settlement_kind = ?
     WHERE player_id IN (
       SELECT id
       FROM players
       WHERE is_bot = 0
     )`,
  ).run(PLAYER_SETTLEMENT_KIND);
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

const ensureHayatoLocalTestVillageState = db.transaction(() => {
  if (!enableLocalTestSetup) {
    return;
  }

  const targetCoordX = 211;
  const targetCoordY = 469;
  const targetUnitAmounts = {
    militia: 600,
    archer: 420,
    cavalry: 280,
    scout: 180,
    knight: 1,
    ram: 120,
    caravan: 200,
    mercenary: 0,
  };

  const hayato = db
    .prepare(
      `SELECT
          p.id AS playerId,
          COALESCE((SELECT vv.kingdom FROM villages vv WHERE vv.player_id = p.id ORDER BY vv.id ASC LIMIT 1), 'Neutral') AS kingdom
       FROM players p
       WHERE p.username = 'Hayato' AND p.is_bot = 0
       LIMIT 1`,
    )
    .get();
  if (!hayato) {
    return;
  }

  let village = db
    .prepare(
      `SELECT
          id,
          player_id AS playerId,
          name
       FROM villages
       WHERE coord_x = ? AND coord_y = ? AND region = ?
       LIMIT 1`,
    )
    .get(targetCoordX, targetCoordY, WORLD_REGION.id);

  if (!village) {
    const insertedVillage = db
      .prepare(
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
      )
      .run(
        Number(hayato.playerId),
        `Hayato test ${targetCoordX}|${targetCoordY}`,
        String(hayato.kingdom ?? 'Neutral'),
        targetCoordX,
        targetCoordY,
        WORLD_REGION.id,
        startingPrestige(20),
        100,
        nowIso(),
      );
    village = {
      id: Number(insertedVillage.lastInsertRowid),
      playerId: Number(hayato.playerId),
      name: `Hayato test ${targetCoordX}|${targetCoordY}`,
    };
  }

  if (Number(village.playerId) !== Number(hayato.playerId)) {
    db.prepare(
      `UPDATE villages
       SET player_id = ?, kingdom = ?, loyalty = 100
       WHERE id = ?`,
    ).run(Number(hayato.playerId), String(hayato.kingdom ?? 'Neutral'), Number(village.id));
  }

  const upsertBuildingStmt = db.prepare(
    `INSERT INTO buildings (village_id, building_id, level)
     VALUES (?, ?, ?)
     ON CONFLICT(village_id, building_id) DO UPDATE SET
       level = CASE
         WHEN buildings.level < excluded.level THEN excluded.level
         ELSE buildings.level
       END`,
  );
  for (const buildingId of BUILDING_ORDER) {
    const halfLevel = Math.max(1, Math.ceil(getMaxBuildingLevel(buildingId) / 2));
    upsertBuildingStmt.run(Number(village.id), buildingId, halfLevel);
  }

  const buildingRows = db
    .prepare(
      `SELECT building_id AS buildingId, level
       FROM buildings
       WHERE village_id = ?`,
    )
    .all(Number(village.id));
  const buildingLevelById = Object.fromEntries(
    buildingRows.map((row) => [String(row.buildingId), Math.max(0, Math.floor(Number(row.level ?? 0)))]),
  );
  const warehouseLevel = Math.max(0, Math.floor(Number(buildingLevelById['warehouse'] ?? 0)));
  const mintLevel = Math.max(0, Math.floor(Number(buildingLevelById['mint'] ?? 0)));
  const targetResourceStock = {
    wood: Math.max(0, Math.floor(calculateResourceCap(warehouseLevel))),
    stone: Math.max(0, Math.floor(calculateResourceCap(warehouseLevel))),
    iron: Math.max(0, Math.floor(calculateResourceCap(warehouseLevel))),
    gold: Math.max(0, Math.floor(calculateMintGoldStorageCap(mintLevel))),
    coins: Math.max(0, Math.floor(calculateMintCoinStorageCap(mintLevel))),
  };

  db.prepare(
    `INSERT INTO resources (village_id, wood, stone, iron, gold, coins)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(village_id) DO UPDATE SET
       wood = excluded.wood,
       stone = excluded.stone,
       iron = excluded.iron,
       gold = excluded.gold,
       coins = excluded.coins`,
  ).run(
    Number(village.id),
    targetResourceStock.wood,
    targetResourceStock.stone,
    targetResourceStock.iron,
    targetResourceStock.gold,
    targetResourceStock.coins,
  );

  const upsertUnitStmt = db.prepare(
    `INSERT INTO units (village_id, unit_id, amount)
     VALUES (?, ?, ?)
     ON CONFLICT(village_id, unit_id) DO UPDATE SET
       amount = CASE
         WHEN units.amount < excluded.amount THEN excluded.amount
         ELSE units.amount
       END`,
  );
  for (const unitId of UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(targetUnitAmounts[unitId] ?? 0)));
    upsertUnitStmt.run(Number(village.id), unitId, amount);
  }
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
    `INSERT INTO resources (village_id, wood, stone, iron, gold, coins)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(village_id) DO UPDATE SET
       wood = CASE WHEN resources.wood < excluded.wood THEN excluded.wood ELSE resources.wood END,
       stone = CASE WHEN resources.stone < excluded.stone THEN excluded.stone ELSE resources.stone END,
       iron = CASE WHEN resources.iron < excluded.iron THEN excluded.iron ELSE resources.iron END,
       gold = CASE WHEN resources.gold < excluded.gold THEN excluded.gold ELSE resources.gold END,
       coins = CASE WHEN resources.coins < excluded.coins THEN excluded.coins ELSE resources.coins END`,
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
        0,
        0,
      );

      for (const buildingId of BUILDING_ORDER) {
        const boostedStartLevels = account.boostedStart ? SPECIAL_PLAYER_BOOSTED_BUILDING_LEVELS : null;
        const targetLevel = boostedStartLevels?.[buildingId] ?? STARTING_BUILDING_LEVELS[buildingId] ?? 0;
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

const ensureAbandonedVillageTemplateMinimums = db.transaction(() => {
  const selectAbandonedVillageIdsStmt = db.prepare(
    `SELECT
        v.id AS villageId
     FROM villages v
     INNER JOIN players p ON p.id = v.player_id
     WHERE p.is_bot = 1
       AND p.username LIKE ?`,
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
  const abandonedVillages = selectAbandonedVillageIdsStmt.all(`${ABANDONED_BOT_USERNAME_PREFIX}%`);
  for (const row of abandonedVillages) {
    const villageId = Number(row.villageId);
    for (const buildingId of BUILDING_ORDER) {
      const targetLevel = Math.max(0, Number(ABANDONED_STARTING_BUILDING_LEVELS[buildingId] ?? 0));
      upsertBuildingStmt.run(villageId, buildingId, targetLevel);
    }
    upsertUnitStmt.run(villageId, 'militia', ABANDONED_MILITIA_COUNT);
  }
});

const ensureVillageBuildingLevelCaps = db.transaction(() => {
  const capBuildingLevelStmt = db.prepare(
    `UPDATE buildings
     SET level = ?
     WHERE building_id = ? AND level > ?`,
  );

  for (const buildingId of BUILDING_ORDER) {
    const maxLevel = Math.max(0, Number(getMaxBuildingLevel(buildingId) ?? 0));
    capBuildingLevelStmt.run(maxLevel, buildingId, maxLevel);
  }
});

const ensureResourceBuildingScaleMigration = db.transaction(() => {
  const currentVersion = String(
    db.prepare('SELECT value FROM app_meta WHERE key = ? LIMIT 1').get(RESOURCE_BUILDING_SCALE_MIGRATION_KEY)?.value ??
      '',
  );
  if (currentVersion === RESOURCE_BUILDING_SCALE_MIGRATION_VERSION) {
    return;
  }

  const resourceBuildingRows = db
    .prepare(
      `SELECT village_id AS villageId, building_id AS buildingId, level
       FROM buildings
       WHERE building_id IN ('woodcutter', 'quarry', 'iron-mine')`,
    )
    .all();
  const updateBuildingLevelStmt = db.prepare(
    `UPDATE buildings
     SET level = ?
     WHERE village_id = ? AND building_id = ?`,
  );

  for (const row of resourceBuildingRows) {
    const buildingId = String(row.buildingId ?? '');
    const nextLevel = convertLegacyResourceBuildingLevelToCurrent(buildingId, Number(row.level ?? 0));
    updateBuildingLevelStmt.run(nextLevel, Number(row.villageId), buildingId);
  }

  db.prepare(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(RESOURCE_BUILDING_SCALE_MIGRATION_KEY, RESOURCE_BUILDING_SCALE_MIGRATION_VERSION);
});

const BUILDING_REBALANCE_MIGRATION_BUILDING_IDS = Object.freeze([
  'warehouse',
  'townhall',
  'residential-quarter',
  'barracks',
  'stable',
  'workshop',
]);
const BUILDING_REBALANCE_MIGRATION_BUILDING_ID_SET = new Set(BUILDING_REBALANCE_MIGRATION_BUILDING_IDS);
const toBuildingLevelMap = (rows) => {
  const levelMap = {};
  for (const buildingId of BUILDING_ORDER) {
    levelMap[buildingId] = 0;
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    const buildingId = String(row?.buildingId ?? '');
    if (!BUILDING_ORDER.includes(buildingId)) {
      continue;
    }
    levelMap[buildingId] = Math.max(0, Math.floor(Number(row?.level ?? 0)));
  }
  return levelMap;
};
const hasBuildingRequirementsSatisfied = (buildingId, projectedBuildingLevels) => {
  const requirements = BUILDING_DEFS[buildingId]?.requiredBuildings;
  if (!requirements || typeof requirements !== 'object') {
    return true;
  }
  for (const [requiredBuildingId, requiredLevelRaw] of Object.entries(requirements)) {
    const requiredLevel = Math.max(1, Math.floor(Number(requiredLevelRaw ?? 0)));
    const currentLevel = Math.max(0, Math.floor(Number(projectedBuildingLevels?.[requiredBuildingId] ?? 0)));
    if (currentLevel < requiredLevel) {
      return false;
    }
  }
  return true;
};
const clampProgress = (valueRaw) => {
  const value = Number(valueRaw ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const ensureBuildingRebalanceMigration = db.transaction(() => {
  const currentVersion = String(
    db.prepare('SELECT value FROM app_meta WHERE key = ? LIMIT 1').get(BUILDING_REBALANCE_MIGRATION_KEY)?.value ?? '',
  );
  if (currentVersion === BUILDING_REBALANCE_MIGRATION_VERSION) {
    return;
  }

  const nowIso = new Date().toISOString();
  const nowMsRaw = Date.parse(nowIso);
  const nowMs = Number.isFinite(nowMsRaw) ? nowMsRaw : Date.now();

  const buildingPlaceholders = BUILDING_REBALANCE_MIGRATION_BUILDING_IDS.map(() => '?').join(', ');
  const affectedBuildingRows = db
    .prepare(
      `SELECT village_id AS villageId, building_id AS buildingId, level
       FROM buildings
       WHERE building_id IN (${buildingPlaceholders})`,
    )
    .all(...BUILDING_REBALANCE_MIGRATION_BUILDING_IDS);

  const updateBuildingLevelStmt = db.prepare(
    `UPDATE buildings
     SET level = ?
     WHERE village_id = ? AND building_id = ?`,
  );

  for (const row of affectedBuildingRows) {
    const buildingId = String(row?.buildingId ?? '');
    const currentLevel = Math.max(0, Math.floor(Number(row?.level ?? 0)));
    if (!BUILDING_REBALANCE_MIGRATION_BUILDING_ID_SET.has(buildingId)) {
      continue;
    }
    const mappedLevel = convertLegacyBuildingLevelToCurrent(buildingId, currentLevel);
    if (mappedLevel !== currentLevel) {
      updateBuildingLevelStmt.run(mappedLevel, Number(row.villageId), buildingId);
    }
  }

  const hideoutWarehouseRows = db
    .prepare(
      `SELECT
          h.village_id AS villageId,
          h.level AS hideoutLevel,
          COALESCE(w.level, 0) AS warehouseLevel
       FROM buildings h
       LEFT JOIN buildings w
         ON w.village_id = h.village_id
        AND w.building_id = 'warehouse'
       WHERE h.building_id = 'hideout'
         AND h.level > 0`,
    )
    .all();
  for (const row of hideoutWarehouseRows) {
    const warehouseLevel = Math.max(0, Math.floor(Number(row?.warehouseLevel ?? 0)));
    if (warehouseLevel >= 5) {
      continue;
    }
    updateBuildingLevelStmt.run(5, Number(row.villageId), 'warehouse');
  }

  const villageIdRows = db
    .prepare(
      `SELECT village_id AS villageId FROM buildings WHERE building_id IN (${buildingPlaceholders})
       UNION
       SELECT village_id AS villageId FROM building_upgrades WHERE status = 'in_progress'`,
    )
    .all(...BUILDING_REBALANCE_MIGRATION_BUILDING_IDS);
  const villageIds = villageIdRows
    .map((row) => Number(row?.villageId ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const uniqueVillageIds = [...new Set(villageIds)];

  const selectVillageBuildingsStmt = db.prepare(
    `SELECT building_id AS buildingId, level
     FROM buildings
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
     WHERE village_id = ?
       AND status = 'in_progress'
     ORDER BY datetime(started_at) ASC, id ASC`,
  );
  const deleteUpgradeByIdStmt = db.prepare(
    `DELETE FROM building_upgrades
     WHERE id = ?
       AND village_id = ?
       AND status = 'in_progress'`,
  );
  const updateUpgradeByIdStmt = db.prepare(
    `UPDATE building_upgrades
     SET from_level = ?,
         to_level = ?,
         started_at = ?,
         finish_at = ?
     WHERE id = ?
       AND village_id = ?
       AND status = 'in_progress'`,
  );
  const refundVillageResourcesStmt = db.prepare(
    `UPDATE resources
     SET wood = COALESCE(wood, 0) + ?,
         stone = COALESCE(stone, 0) + ?,
         iron = COALESCE(iron, 0) + ?
     WHERE village_id = ?`,
  );

  for (const villageId of uniqueVillageIds) {
    const buildingLevels = toBuildingLevelMap(selectVillageBuildingsStmt.all(villageId));
    if (Number(buildingLevels.hideout ?? 0) > 0 && Number(buildingLevels.warehouse ?? 0) < 5) {
      buildingLevels.warehouse = 5;
      updateBuildingLevelStmt.run(5, villageId, 'warehouse');
    }

    const activeUpgrades = selectActiveUpgradesByVillageStmt.all(villageId);
    if (!Array.isArray(activeUpgrades) || activeUpgrades.length <= 0) {
      continue;
    }

    const projectedLevels = { ...buildingLevels };
    const refundPocket = { wood: 0, stone: 0, iron: 0 };
    let hasTimelineAnchor = false;
    let cursorMs = nowMs;

    for (const upgrade of activeUpgrades) {
      const buildingId = String(upgrade?.buildingId ?? '');
      const maxLevel = Math.max(0, Number(getMaxBuildingLevel(buildingId) ?? 0));
      const mappedToLevel = convertLegacyBuildingLevelToCurrent(buildingId, Number(upgrade?.toLevel ?? 0));
      const currentProjectedLevel = Math.max(0, Math.floor(Number(projectedLevels[buildingId] ?? 0)));
      const canProgressLevel = maxLevel > currentProjectedLevel;
      const requirementsMet = hasBuildingRequirementsSatisfied(buildingId, projectedLevels);
      const isNoOpAfterMapping = mappedToLevel <= currentProjectedLevel;

      if (!BUILDING_ORDER.includes(buildingId) || !canProgressLevel || !requirementsMet || isNoOpAfterMapping) {
        refundPocket.wood += Math.max(0, Math.floor(Number(upgrade?.woodCost ?? 0)));
        refundPocket.stone += Math.max(0, Math.floor(Number(upgrade?.stoneCost ?? 0)));
        refundPocket.iron += Math.max(0, Math.floor(Number(upgrade?.ironCost ?? 0)));
        deleteUpgradeByIdStmt.run(Number(upgrade?.id), villageId);
        continue;
      }

      const nextFromLevel = currentProjectedLevel;
      const nextToLevel = Math.min(maxLevel, nextFromLevel + 1);
      if (nextToLevel <= nextFromLevel) {
        refundPocket.wood += Math.max(0, Math.floor(Number(upgrade?.woodCost ?? 0)));
        refundPocket.stone += Math.max(0, Math.floor(Number(upgrade?.stoneCost ?? 0)));
        refundPocket.iron += Math.max(0, Math.floor(Number(upgrade?.ironCost ?? 0)));
        deleteUpgradeByIdStmt.run(Number(upgrade?.id), villageId);
        continue;
      }

      const townhallLevelForDuration = Math.max(0, Math.floor(Number(projectedLevels.townhall ?? 0)));
      const durationSec = Math.max(1, Math.floor(Number(calculateUpgradeDurationSec(buildingId, nextFromLevel, townhallLevelForDuration))));
      const durationMs = durationSec * 1000;
      let startedAtMs = cursorMs;
      let finishAtMs = cursorMs + durationMs;

      if (!hasTimelineAnchor) {
        const oldStartMs = Date.parse(String(upgrade?.startedAt ?? ''));
        const oldFinishMs = Date.parse(String(upgrade?.finishAt ?? ''));
        if (Number.isFinite(oldStartMs) && Number.isFinite(oldFinishMs) && oldFinishMs > oldStartMs) {
          const oldDurationMs = oldFinishMs - oldStartMs;
          const progress = clampProgress((nowMs - oldStartMs) / oldDurationMs);
          const progressedMs = Math.round(progress * durationMs);
          const remainingMs = Math.max(0, durationMs - progressedMs);
          startedAtMs = nowMs - progressedMs;
          finishAtMs = nowMs + remainingMs;
        } else {
          startedAtMs = nowMs;
          finishAtMs = nowMs + durationMs;
        }
        hasTimelineAnchor = true;
      }

      cursorMs = finishAtMs;
      updateUpgradeByIdStmt.run(
        nextFromLevel,
        nextToLevel,
        new Date(startedAtMs).toISOString(),
        new Date(finishAtMs).toISOString(),
        Number(upgrade?.id),
        villageId,
      );
      projectedLevels[buildingId] = nextToLevel;
    }

    if (refundPocket.wood > 0 || refundPocket.stone > 0 || refundPocket.iron > 0) {
      refundVillageResourcesStmt.run(refundPocket.wood, refundPocket.stone, refundPocket.iron, villageId);
    }
  }

  db.prepare(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(BUILDING_REBALANCE_MIGRATION_KEY, BUILDING_REBALANCE_MIGRATION_VERSION);
});

const ensureReferentialIntegrity = db.transaction(() => {
  const cleanupStatements = [
    db.prepare(
      `DELETE FROM army_movement_units
       WHERE NOT EXISTS (
         SELECT 1
         FROM army_movements m
         WHERE m.id = army_movement_units.movement_id
       )`,
    ),
    db.prepare(
      `DELETE FROM battle_reports
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = battle_reports.player_id
         )
          OR (
           battle_reports.origin_village_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM villages v WHERE v.id = battle_reports.origin_village_id
           )
         )
          OR (
           battle_reports.target_village_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM villages v WHERE v.id = battle_reports.target_village_id
           )
         )`,
    ),
    db.prepare(
      `DELETE FROM kingdom_invites
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = kingdom_invites.inviter_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = kingdom_invites.target_player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM combat_retaliation_flags
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = combat_retaliation_flags.aggressor_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = combat_retaliation_flags.defender_player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM kingdom_events
       WHERE (
           kingdom_events.actor_player_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM players p WHERE p.id = kingdom_events.actor_player_id
           )
         )
          OR (
           kingdom_events.target_player_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM players p WHERE p.id = kingdom_events.target_player_id
           )
         )`,
    ),
    db.prepare(
      `DELETE FROM player_notifications
       WHERE NOT EXISTS (
         SELECT 1
         FROM players p
         WHERE p.id = player_notifications.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM notification_shares
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = notification_shares.source_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM player_notifications n WHERE n.id = notification_shares.source_notification_id
         )`,
    ),
    db.prepare(
      `DELETE FROM player_profiles
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = player_profiles.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM player_presence
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = player_presence.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM player_ui_state
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = player_ui_state.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM player_sessions
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = player_sessions.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM player_friendships
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_friendships.player_low_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_friendships.player_high_id
         )`,
    ),
    db.prepare(
      `DELETE FROM player_friend_requests
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_friend_requests.sender_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_friend_requests.receiver_player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM player_blocks
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_blocks.blocker_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = player_blocks.blocked_player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM chat_threads
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = chat_threads.created_by_player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM chat_thread_members
       WHERE NOT EXISTS (
           SELECT 1 FROM chat_threads t WHERE t.id = chat_thread_members.thread_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = chat_thread_members.player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM chat_messages
       WHERE NOT EXISTS (
           SELECT 1 FROM chat_threads t WHERE t.id = chat_messages.thread_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = chat_messages.sender_player_id
         )`,
    ),
    db.prepare(
      `DELETE FROM chat_abuse_events
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = chat_abuse_events.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM market_offers
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = market_offers.player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = market_offers.village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM logistics_routes
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = logistics_routes.owner_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = logistics_routes.source_village_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = logistics_routes.target_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM market_guild_settings
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = market_guild_settings.owner_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = market_guild_settings.source_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM market_guild_targets
       WHERE NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = market_guild_targets.source_village_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = market_guild_targets.target_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM market_guild_audit_logs
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = market_guild_audit_logs.owner_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = market_guild_audit_logs.source_village_id
         )
          OR (
           market_guild_audit_logs.target_village_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM villages v WHERE v.id = market_guild_audit_logs.target_village_id
           )
         )`,
    ),
    db.prepare(
      `DELETE FROM planner_plan_events
       WHERE NOT EXISTS (
           SELECT 1 FROM planner_plans p WHERE p.id = planner_plan_events.plan_id
         )
          OR (
           planner_plan_events.plan_leg_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM planner_plan_legs l WHERE l.id = planner_plan_events.plan_leg_id
           )
         )`,
    ),
    db.prepare(
      `DELETE FROM planner_plan_leg_units
       WHERE NOT EXISTS (
         SELECT 1 FROM planner_plan_legs l WHERE l.id = planner_plan_leg_units.plan_leg_id
       )`,
    ),
    db.prepare(
      `DELETE FROM planner_plan_legs
       WHERE NOT EXISTS (
           SELECT 1 FROM planner_plans p WHERE p.id = planner_plan_legs.plan_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = planner_plan_legs.origin_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM planner_plans
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = planner_plans.player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = planner_plans.target_player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = planner_plans.target_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM academics
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = academics.player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = academics.village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM research_progress
       WHERE NOT EXISTS (
         SELECT 1 FROM players p WHERE p.id = research_progress.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM mercenary_contracts
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = mercenary_contracts.player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = mercenary_contracts.village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM army_movements
       WHERE NOT EXISTS (
           SELECT 1 FROM players p WHERE p.id = army_movements.player_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = army_movements.origin_village_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = army_movements.target_village_id
         )
          OR NOT EXISTS (
           SELECT 1 FROM villages v WHERE v.id = army_movements.home_village_id
         )`,
    ),
    db.prepare(
      `DELETE FROM building_upgrades
       WHERE NOT EXISTS (
         SELECT 1 FROM villages v WHERE v.id = building_upgrades.village_id
       )`,
    ),
    db.prepare(
      `DELETE FROM unit_recruitments
       WHERE NOT EXISTS (
         SELECT 1 FROM villages v WHERE v.id = unit_recruitments.village_id
       )`,
    ),
    db.prepare(
      `DELETE FROM resources
       WHERE NOT EXISTS (
         SELECT 1 FROM villages v WHERE v.id = resources.village_id
       )`,
    ),
    db.prepare(
      `DELETE FROM buildings
       WHERE NOT EXISTS (
         SELECT 1 FROM villages v WHERE v.id = buildings.village_id
       )`,
    ),
    db.prepare(
      `DELETE FROM units
       WHERE NOT EXISTS (
          SELECT 1 FROM villages v WHERE v.id = units.village_id
        )`,
    ),
    db.prepare(
      `DELETE FROM village_garrisons
       WHERE NOT EXISTS (
         SELECT 1 FROM villages v WHERE v.id = village_garrisons.village_id
       )`,
    ),
    db.prepare(
      `DELETE FROM villages
       WHERE NOT EXISTS (
          SELECT 1 FROM players p WHERE p.id = villages.player_id
       )`,
    ),
    db.prepare(
      `DELETE FROM army_movement_units
       WHERE NOT EXISTS (
         SELECT 1
         FROM army_movements m
         WHERE m.id = army_movement_units.movement_id
       )`,
    ),
  ];

  let totalDeletedRows = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    let passDeletedRows = 0;
    for (const statement of cleanupStatements) {
      passDeletedRows += Number(statement.run().changes ?? 0);
    }
    totalDeletedRows += passDeletedRows;
    if (passDeletedRows === 0) {
      break;
    }
  }

  const violations = db.prepare('PRAGMA foreign_key_check').all();
  if (violations.length > 0) {
    console.warn(
      `[db] Referential integrity check still reports ${violations.length} violation(s) after cleanup.`,
    );
  } else if (totalDeletedRows > 0) {
    console.warn(`[db] Referential integrity cleanup removed ${totalDeletedRows} orphan row(s).`);
  }
});

const ensurePriorityPlayerPasswords = db.transaction(() => {
  const updatePasswordStmt = db.prepare(
    `UPDATE players
     SET password = ?
     WHERE username = ? COLLATE NOCASE
       AND is_bot = 0`,
  );

  for (const [username, password] of PRIORITY_PLAYER_PASSWORDS.entries()) {
    updatePasswordStmt.run(String(password), String(username));
  }
});

const ensureCaseInsensitiveUsernameUniqueness = () => {
  const duplicates = db
    .prepare(
      `SELECT
          LOWER(username) AS normalizedUsername,
          GROUP_CONCAT(username, ', ') AS conflictingUsernames,
          COUNT(*) AS total
       FROM players
       WHERE is_bot = 0
       GROUP BY LOWER(username)
       HAVING COUNT(*) > 1`,
    )
    .all();

  if (duplicates.length > 0) {
    console.warn(
      `[db] Nelze aktivovat case-insensitive unikatnost nicku: existuji konfliktni ucty (${duplicates.length}).`,
    );
    return;
  }

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username_nocase
     ON players(username COLLATE NOCASE)
     WHERE is_bot = 0`,
  ).run();
};

const shouldReseedWorld = () => {
  const playerRows = db.prepare('SELECT username FROM players').all();
  if (playerRows.length === 0) {
    return true;
  }

  const usernames = new Set(playerRows.map((row) => row.username));
  return BASE_ACCOUNTS.some((username) => !usernames.has(username));
};

createSchema();
ensureCaseInsensitiveUsernameUniqueness();

if (shouldReseedWorld()) {
  if (isProduction) {
    throw new Error(
      '[db] Detekovana prazdna/poskozena DB (chybi zakladni ucty). ' +
        'Auto-reseed je v produkci zakazan. Obnov DB ze zalohy.',
    );
  }
  clearWorld();
  seedWorld();
}

ensureBotFlagConsistency();
ensureAbandonedVillages();
ensureActiveBotVillages();
ensureSpecialPlayerAccounts();
ensurePriorityPlayerPasswords();
ensureVillageBuildingLevelFloors();
ensureAbandonedVillageTemplateMinimums();
ensureResourceBuildingScaleMigration();
ensureBuildingRebalanceMigration();
ensureVillageBuildingLevelCaps();
ensureHayatoOwnsAbandonedVillage13();
ensureHayatoLocalTestVillageState();
ensureReferentialIntegrity();
