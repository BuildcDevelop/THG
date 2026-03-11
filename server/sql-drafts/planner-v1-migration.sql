-- Planner v1 migration draft
-- Scope:
-- - planner persistence tables
-- - active plan constraints
-- - event log foundations
-- - foresight columns for plan_id / plan_leg_id
--
-- NOTE:
-- This file is a review draft, not auto-applied by runtime.
-- Validate on a copy of production data before executing.

BEGIN;

CREATE TABLE IF NOT EXISTS planner_plans (
  id TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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

  target_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  target_village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE RESTRICT,
  target_player_username_snapshot TEXT NOT NULL,
  target_village_name_snapshot TEXT NOT NULL,
  target_kingdom_snapshot TEXT NOT NULL,
  target_snapshot_hash TEXT NOT NULL,

  confirmed_at TEXT NULL,
  first_send_at_utc TEXT NULL,
  last_send_at_utc TEXT NULL,
  dispatch_started_at_utc TEXT NULL,
  completed_at TEXT NULL,
  failed_at TEXT NULL,
  canceled_at TEXT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planner_plan_legs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sent', 'failed', 'canceled')),

  origin_village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE RESTRICT,
  origin_village_name_snapshot TEXT NOT NULL,

  impact_at_utc TEXT NOT NULL,
  send_at_utc TEXT NOT NULL,
  travel_duration_sec INTEGER NOT NULL CHECK (travel_duration_sec > 0),

  sent_at_utc TEXT NULL,
  fail_code TEXT NULL,
  fail_message TEXT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planner_plan_leg_units (
  id TEXT PRIMARY KEY,
  plan_leg_id TEXT NOT NULL REFERENCES planner_plan_legs(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL CHECK (unit_id IN ('cavalry', 'ram', 'scout')),
  planned_amount INTEGER NOT NULL CHECK (planned_amount > 0)
);

CREATE TABLE IF NOT EXISTS planner_plan_events (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  plan_leg_id TEXT NULL REFERENCES planner_plan_legs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planner_plans_player_world_status
  ON planner_plans(player_id, world_id, status);

CREATE INDEX IF NOT EXISTS idx_planner_plans_world_status_first_send
  ON planner_plans(world_id, status, first_send_at_utc);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_legs_order
  ON planner_plan_legs(plan_id, leg_order);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_legs_origin
  ON planner_plan_legs(plan_id, origin_village_id);

CREATE INDEX IF NOT EXISTS idx_planner_plan_legs_plan_send
  ON planner_plan_legs(plan_id, send_at_utc);

CREATE INDEX IF NOT EXISTS idx_planner_plan_events_plan_created
  ON planner_plan_events(plan_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planner_active_plan_per_player_world
  ON planner_plans(player_id, world_id)
  WHERE status IN ('scheduled', 'needs_reconfirmation', 'dispatching');

-- Foresight columns for future report linking.
-- Run only if target columns do not exist yet.
-- ALTER TABLE army_movements ADD COLUMN plan_id TEXT NULL;
-- ALTER TABLE army_movements ADD COLUMN plan_leg_id TEXT NULL;
-- ALTER TABLE player_notifications ADD COLUMN plan_id TEXT NULL;
-- ALTER TABLE player_notifications ADD COLUMN plan_leg_id TEXT NULL;
-- CREATE INDEX IF NOT EXISTS idx_army_movements_plan_id ON army_movements(plan_id);
-- CREATE INDEX IF NOT EXISTS idx_player_notifications_plan_id ON player_notifications(plan_id);

COMMIT;
