# Planovac v1 - DB spec

Tento dokument navazuje na:

- `arch/planovac-api-spec-v1.md`
- `arch/armada-a-planovac-v1-roadmap.md`

Cil:

- konkretni DB navrh pro planner persistence
- jasna pravidla pro `activePlan + lastCompletedPlan`
- pripava na budouci `plan_id` reporting

## 1. Datovy model

### 1.1 `planner_plans`

```sql
CREATE TABLE planner_plans (
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
```

### 1.2 `planner_plan_legs`

```sql
CREATE TABLE planner_plan_legs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sent', 'failed', 'canceled')),

  origin_village_id INTEGER NOT NULL,
  origin_village_name_snapshot TEXT NOT NULL,

  impact_at_utc TEXT NOT NULL,
  send_at_utc TEXT NOT NULL,
  travel_duration_sec INTEGER NOT NULL,

  sent_at_utc TEXT NULL,
  fail_code TEXT NULL,
  fail_message TEXT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 1.3 `planner_plan_leg_units`

```sql
CREATE TABLE planner_plan_leg_units (
  id TEXT PRIMARY KEY,
  plan_leg_id TEXT NOT NULL REFERENCES planner_plan_legs(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL CHECK (unit_id IN ('cavalry', 'ram', 'scout')),
  planned_amount INTEGER NOT NULL CHECK (planned_amount > 0)
);
```

### 1.4 `planner_plan_events`

```sql
CREATE TABLE planner_plan_events (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  plan_leg_id TEXT NULL REFERENCES planner_plan_legs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 2. Indexy a unikatni pravidla

```sql
CREATE INDEX idx_planner_plans_player_world_status
  ON planner_plans(player_id, world_id, status);

CREATE INDEX idx_planner_plans_world_status_first_send
  ON planner_plans(world_id, status, first_send_at_utc);

CREATE INDEX idx_planner_plan_legs_plan_send
  ON planner_plan_legs(plan_id, send_at_utc);

CREATE INDEX idx_planner_plan_events_plan_created
  ON planner_plan_events(plan_id, created_at DESC);
```

Unikaty:

```sql
CREATE UNIQUE INDEX ux_planner_legs_order
  ON planner_plan_legs(plan_id, leg_order);

CREATE UNIQUE INDEX ux_planner_legs_origin
  ON planner_plan_legs(plan_id, origin_village_id);
```

Aktivni plan per `player + world`:

```sql
CREATE UNIQUE INDEX ux_planner_active_plan_per_player_world
  ON planner_plans(player_id, world_id)
  WHERE status IN ('scheduled', 'needs_reconfirmation', 'dispatching');
```

## 3. Read model pravidla

`activePlan`:

- bere se plan se stavem v:
  - `scheduled`
  - `needs_reconfirmation`
  - `dispatching`
- je maximalne jeden kvuli partial unique indexu

`lastCompletedPlan`:

- select posledni plan se stavem `completed`
- `ORDER BY completed_at DESC LIMIT 1`
- neni extra tabulka

## 4. Revision a konkurence

Pravidlo optimistic concurrency:

- vsechny write akce (`update`, `reconfirm`, `cancel`) berou `expectedRevision`
- SQL update musi obsahovat podminku na revision
- pri `0 rows affected` vracet `PLANNER_REVISION_CONFLICT`

Navrh:

- pri kazdem uspesnem write:
  - `revision = revision + 1`
  - `updated_at = now`

## 5. Dispatch integrace

Scheduler cte:

- `planner_plans.status IN ('scheduled', 'needs_reconfirmation')`
- legs podle `send_at_utc <= now`

Prechod stavu:

1. `scheduled` -> `dispatching` pri prvnim due legu
2. leg `scheduled` -> `sent` po uspesnem command create
3. pokud vsechny legy `sent`, plan `dispatching` -> `completed`
4. pokud failne libovolny leg pre-flight/dispatch, plan -> `failed` (all-or-nothing)

`completed` semantika:

- vsechny legy byly odeslany
- neceka se na vysledek boje

## 6. Error persistence

Pri failu legu ukladat:

- `planner_plan_legs.fail_code`
- `planner_plan_legs.fail_message`

Soucasne zapisat `planner_plan_events`:

- `event_type = 'leg_failed'` nebo `plan_failed`
- payload s kontextem (`origin_village_id`, `unit_mismatch`, ...)

To je zaklad pro navrat do konceptu s viditelnym duvodem.

## 7. `plan_id` foresight

Plannerem vygenerovane commandy musi nest:

- `plan_id`
- `plan_leg_id`

Doporucene DB rozsireni (mimo planner tabulky):

- movement/command tabulky:
  - nullable `plan_id`
  - nullable `plan_leg_id`
- notif/report eventy:
  - nullable `plan_id`
  - nullable `plan_leg_id`

To umozni pozdeji bez migrace domyslet report page.

## 8. Migracni poradi

1. vytvorit planner tabulky
2. vytvorit indexy/unikaty
3. nasadit read endpointy pro `activePlan` + `lastCompletedPlan`
4. nasadit write endpointy
5. nasadit scheduler dispatch flow
6. doplnit nullable `plan_id/plan_leg_id` do command/event tabulek

## 9. Data retention

Pro v1:

- `planner_plan_events`: ponechat max 30 dni nebo max N zaznamu na plan
- `completed` plany: drzet minimalne posledni dokonceny plan na hrace/svet
- archiv neimplementovat
