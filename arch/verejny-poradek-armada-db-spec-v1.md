# Verejny poradek, armada vsech len a queue v1 - DB spec

Tento dokument navazuje na:

- `arch/verejny-poradek-armada-api-spec-v1.md`
- `arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md`

Cil:

- dodat konkretni DB navrh pro verejny poradek, recruit queue a audit kolem support/report retention,
- drzet se stavajicich SQLite vzoru v repu,
- nevyzadovat tick-on-read ani masivni write operace pri beznem cteni.

## 1. Verejny poradek

### 1.1 `player_world_governance`

```sql
CREATE TABLE player_world_governance (
  player_id INTEGER NOT NULL,
  region INTEGER NOT NULL DEFAULT 1,
  public_order INTEGER NOT NULL DEFAULT 100 CHECK (public_order >= 0 AND public_order <= 100),
  last_regenerated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, region),
  FOREIGN KEY (player_id) REFERENCES players(id)
);
```

Indexy:

```sql
CREATE INDEX idx_player_world_governance_region_updated
  ON player_world_governance(region, updated_at DESC);
```

Poznamka:

- v aktualnim modelu je region prakticky world scope uvnitr jedne DB branch,
- `loyalty` na `villages` se pro tuto feature nepouziva.

### 1.2 Audit zmen verejneho poradku

```sql
CREATE TABLE player_world_governance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  region INTEGER NOT NULL DEFAULT 1,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'initialize',
    'conquest_penalty',
    'hourly_regeneration',
    'admin_adjustment'
  )),
  delta INTEGER NOT NULL,
  before_value INTEGER NOT NULL,
  after_value INTEGER NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);
```

Indexy:

```sql
CREATE INDEX idx_player_world_governance_events_player_created
  ON player_world_governance_events(player_id, region, created_at DESC, id DESC);
```

Toto je append-only audit:

- lze z nej vysvetlit nahly propad po dobyti lena,
- neni urcen pro heavy frontend feed,
- tooltip a badge ctou jen summary, ne event log.

## 2. Recruit queue

V1 nema vytvaret novou tabulku. Doporucena cesta je rozsireni stavajici `unit_recruitments`.

### 2.1 Kanonicka schema `unit_recruitments` v2

```sql
CREATE TABLE unit_recruitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  wood_cost INTEGER NOT NULL,
  stone_cost INTEGER NOT NULL,
  iron_cost INTEGER NOT NULL,
  queue_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'in_progress', 'completed', 'canceled')),
  started_at TEXT NOT NULL,
  finish_at TEXT NOT NULL,
  base_duration_sec INTEGER NOT NULL,
  effective_duration_sec INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  canceled_at TEXT,
  FOREIGN KEY (village_id) REFERENCES villages(id)
);
```

### 2.2 Indexy

```sql
CREATE INDEX idx_unit_recruitments_status_finish
  ON unit_recruitments(status, finish_at);

CREATE INDEX idx_unit_recruitments_village_queue
  ON unit_recruitments(village_id, status, queue_index);

CREATE UNIQUE INDEX idx_unit_recruitments_active_queue_position
  ON unit_recruitments(village_id, queue_index)
  WHERE status IN ('queued', 'in_progress');
```

### 2.3 Semantika

- `queue_index` je poradi uvnitr jednoho lena,
- `started_at` a `finish_at` jsou planovane casy po poslednim rebalancu,
- `base_duration_sec` je zaklad bez bonusu/postihu,
- `effective_duration_sec` je realna delka po bonusech a postizich,
- `status='queued'` znamena cekani na start,
- `status='in_progress'` znamena prvni bezici polozku fronty,
- `completed` a `canceled` zustavaji kvuli auditu a konzistentnimu contractu.

### 2.4 Migracni poznamky

- existujici aktivni recruitments se pri migraci seradi podle `started_at`, `finish_at`, `id`,
- dostanou `queue_index` od `0`,
- pokud jsou vsechny aktivni dnes oznacene jako `in_progress`, migrace prvni necha `in_progress` a zbytek prepne na `queued`,
- `created_at` a `updated_at` se u starych radku naplni z `started_at`.

## 3. Support rebase audit

Pro auditovatelnost support rebase se doporucuje append-only tabulka pohybovych eventu.

### 3.1 `army_movement_events`

```sql
CREATE TABLE army_movement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'arrived',
    'stationed',
    'canceled',
    'returned',
    'support_rebased'
  )),
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (movement_id) REFERENCES army_movements(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);
```

Indexy:

```sql
CREATE INDEX idx_army_movement_events_movement_created
  ON army_movement_events(movement_id, created_at DESC, id DESC);
```

Poznamka:

- `support_rebased` nahradi potrebu "tajne" zmeny bez dohledatelne stopy,
- event log neni zdrojem pravdy pro stav, ale auditni stopou.

## 4. Battle report retention

`battle_reports` zustavaji autoritativni immutable detail. Inbox reference ma byt v `player_notifications`, ale nesmi byt jediny zpusob, jak report dohledat.

### 4.1 Doporucena hardening zmena `player_notifications`

```sql
ALTER TABLE player_notifications
  ADD COLUMN report_id INTEGER REFERENCES battle_reports(id);
```

Index:

```sql
CREATE INDEX idx_player_notifications_report_ref
  ON player_notifications(player_id, report_id, created_at DESC, id DESC);
```

### 4.2 Contract

- pro battle-related notifikace se plni:
  - `source_type = 'battle_report'`
  - `source_id = report_id`
  - `report_id = battle_reports.id`
- `payload_json` muze stale obsahovat display metadata,
- `payload_json` nesmi byt jediny zdroj reference na report.

### 4.3 Retention rules

- archivace nebo mazani notifikace nikdy nema mazat `battle_reports`,
- cleanup reportu musi byt samostatna vedoma politika, ne vedlejsi efekt inboxu,
- report detail je cten primo z `battle_reports`, ne pres notifikaci.

## 5. Public order a rychlostni debuff

Verejny poradek nesmi vyvolavat globalni rewrite vsech len pri kazde zmene. Doporucena strategie:

- pri beznem cteni se nic neprepisuje,
- pri zmene pasma `stable|warning|critical` se provede event-driven rebalance pouze pro dotceneho hrace,
- rebalance sahne jen na:
  - aktivni building queue daneho hrace,
  - recruit queue jeho len,
  - produkcni vypocet zustava odvozeny z aktualniho pasma.

To znamena:

- zadny tick-on-read,
- zadny world-wide rewrite,
- write dopad jen pri threshold crossing nebo pri explicitni queue operaci.

## 6. Guardrails

- zadna nova tezka data do `villages`,
- `player_world_governance` je player-scoped, ne village-scoped,
- `unit_recruitments` zustavaji per-village a rebalancuji se lokalne,
- audit tabulky jsou append-only,
- `battle_reports` jsou immutable detail.
