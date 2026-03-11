# Planovac v1 - API spec

Tento dokument navazuje na:

- `arch/armada-a-planovac-v1-roadmap.md`
- `arch/planovac-budouci-nasazeni-koncept.md`

Cil:

- dodat presny API kontrakt pro planner flow
- sjednotit request/response payloady
- doplnit error code katalog pro FE logiku a QA

## 1. Scope

Planner v1 API pokryva:

- otevreni planneru (`open`)
- validaci konceptu (`validate`)
- ulozeni planu (`create`)
- editaci planu (`update`)
- reconfirm (`reconfirm`)
- cancel (`cancel`)
- event feed planu (`events`)

Mimo scope:

- archiv planu
- samostatna report page

## 2. Auth a tenancy model

Planner endpointy pouzivaji stejne auth pravidlo jako ostatni `api/v1`:

- session cookie je povinna
- `username` v requestu musi odpovidat session uzivateli
- planner je world-scoped (`worldId`)

Konvence:

- `GET` endpointy: `username` a `worldId` v query
- `POST/PATCH` endpointy: `username` a `worldId` v body

## 3. Envelope

### Success

```json
{
  "ok": true,
  "data": {}
}
```

### Error

```json
{
  "ok": false,
  "error": "Human readable message",
  "errorCode": "PLANNER_LEAD_TIME_EXPIRED",
  "details": {}
}
```

Poznamky:

- `error` je pro uzivatele
- `errorCode` je stabilni programovy identifikator
- `details` je volitelny objekt pro FE rozhodovani

## 4. Spolecne typy

```ts
type PlannerUnitAmount = {
  unitId: 'cavalry' | 'ram' | 'scout'
  amount: number
}

type PlannerLegInput = {
  order: number
  originVillageId: number
  impactAtPrague: string
  units: PlannerUnitAmount[]
}

type PlannerValidationIssue = {
  code: string
  severity: 'warning' | 'blocked'
  message: string
  scope: 'plan' | 'target' | 'leg'
  legOrder?: number
  legOriginVillageId?: number
}
```

## 5. Endpointy

### 5.1 `GET /api/v1/planner/open`

Query:

- `username` (required)
- `worldId` (required)

Success `200`:

```json
{
  "ok": true,
  "data": {
    "worldId": "dominion-1",
    "timezone": "Europe/Prague",
    "constraints": {
      "maxLegs": 10,
      "minImpactGapMinutes": 1,
      "leadTimeSec": 300,
      "activePlansPerPlayerPerWorld": 1
    },
    "bannerText": "Planovac je zatim mozne vyuzit jen pro jeden cil z vice len.",
    "activePlan": {},
    "lastCompletedPlan": {},
    "recentTargets": []
  }
}
```

Error kody:

- `AUTH_REQUIRED` (`401`)
- `SESSION_USERNAME_MISMATCH` (`403`)
- `PLANNER_WORLD_REQUIRED` (`400`)
- `PLANNER_WORLD_NOT_FOUND` (`404`)

---

### 5.2 `POST /api/v1/planner/validate`

Body:

```json
{
  "username": "Hayato",
  "worldId": "dominion-1",
  "targetPlayerUsername": "Enemy",
  "targetVillageId": 901,
  "legs": [
    {
      "order": 1,
      "originVillageId": 111,
      "impactAtPrague": "2026-03-12T10:30:00+01:00",
      "units": [
        { "unitId": "cavalry", "amount": 120 },
        { "unitId": "ram", "amount": 5 },
        { "unitId": "scout", "amount": 1 }
      ]
    }
  ]
}
```

Success `200`:

```json
{
  "ok": true,
  "data": {
    "resolvedTarget": {
      "targetPlayerId": 42,
      "targetPlayerUsername": "Enemy",
      "targetVillageId": 901,
      "targetVillageName": "Leno Enemy",
      "targetKingdom": "Noctis",
      "coordX": 322,
      "coordY": 488,
      "snapshotHash": "sha256:..."
    },
    "normalizedLegs": [
      {
        "order": 1,
        "originVillageId": 111,
        "impactAtPrague": "2026-03-12T10:30:00+01:00",
        "impactAtUtc": "2026-03-12T09:30:00Z",
        "sendAtUtc": "2026-03-12T09:09:12Z",
        "travelDurationSec": 1248,
        "units": [
          { "unitId": "cavalry", "amount": 120 },
          { "unitId": "ram", "amount": 5 },
          { "unitId": "scout", "amount": 1 }
        ]
      }
    ],
    "validation": {
      "status": "ok",
      "issues": []
    }
  }
}
```

Error kody:

- `AUTH_REQUIRED` (`401`)
- `SESSION_USERNAME_MISMATCH` (`403`)
- `PLANNER_WORLD_REQUIRED` (`400`)
- `PLANNER_TARGET_REQUIRED` (`400`)
- `PLANNER_LEGS_REQUIRED` (`400`)
- `PLANNER_MAX_LEGS_EXCEEDED` (`400`)
- `PLANNER_DUPLICATE_ORIGIN` (`400`)
- `PLANNER_ORIGIN_NOT_OWNED` (`400`)
- `PLANNER_UNIT_TYPE_NOT_ALLOWED` (`400`)
- `PLANNER_UNIT_AMOUNT_INVALID` (`400`)
- `PLANNER_IMPACT_ORDER_INVALID` (`400`)
- `PLANNER_IMPACT_GAP_TOO_SMALL` (`400`)
- `PLANNER_LEAD_TIME_EXPIRED` (`400`)
- `PLANNER_TARGET_NOT_FOUND` (`404`)
- `PLANNER_TARGET_NOT_SINGLE_VILLAGE` (`409`)

Poznamka:

- `validate` vraci `200` i pro `warning`/`blocked`.
- `blocked` je business vysledek, ne HTTP chyba.

---

### 5.3 `POST /api/v1/planner/plans`

Body:

```json
{
  "username": "Hayato",
  "worldId": "dominion-1",
  "targetPlayerUsername": "Enemy",
  "targetVillageId": 901,
  "legs": [],
  "confirmation": {
    "confirmedByPlayer": true,
    "clientValidatedAt": "2026-03-12T09:15:00Z"
  }
}
```

Success `201`:

```json
{
  "ok": true,
  "data": {
    "plan": {
      "id": "pln_01JXYZ...",
      "status": "scheduled",
      "revision": 1,
      "confirmedAt": "2026-03-12T09:15:02Z"
    },
    "activePlan": {},
    "lastCompletedPlan": null
  }
}
```

Error kody:

- vsechny relevantni validacni kody z `validate`
- `PLANNER_ACTIVE_PLAN_ALREADY_EXISTS` (`409`)
- `PLANNER_CONFIRMATION_REQUIRED` (`400`)
- `PLANNER_SAVE_FAILED` (`500`)

Poznamka:

- server pred create vzdy interne provede final validate/pre-flight.

---

### 5.4 `PATCH /api/v1/planner/plans/:planId`

Body:

```json
{
  "username": "Hayato",
  "worldId": "dominion-1",
  "expectedRevision": 3,
  "targetPlayerUsername": "Enemy",
  "targetVillageId": 901,
  "legs": []
}
```

Success `200`:

```json
{
  "ok": true,
  "data": {
    "plan": {
      "id": "pln_01JXYZ...",
      "status": "scheduled",
      "revision": 4,
      "updatedAt": "2026-03-12T09:22:00Z"
    },
    "activePlan": {}
  }
}
```

Error kody:

- `PLANNER_PLAN_NOT_FOUND` (`404`)
- `PLANNER_PLAN_NOT_EDITABLE` (`409`)
- `PLANNER_LEAD_TIME_EXPIRED` (`409`)
- `PLANNER_REVISION_CONFLICT` (`409`)
- `PLANNER_UPDATE_FAILED` (`500`)

---

### 5.5 `POST /api/v1/planner/plans/:planId/reconfirm`

Body:

```json
{
  "username": "Hayato",
  "worldId": "dominion-1",
  "expectedRevision": 6,
  "confirmWithConsequences": true
}
```

Success `200`:

```json
{
  "ok": true,
  "data": {
    "plan": {
      "id": "pln_01JXYZ...",
      "status": "scheduled",
      "revision": 7,
      "confirmedAt": "2026-03-12T10:00:03Z"
    },
    "activePlan": {}
  }
}
```

Error kody:

- `PLANNER_PLAN_NOT_FOUND` (`404`)
- `PLANNER_RECONFIRM_NOT_ALLOWED` (`409`)
- `PLANNER_TARGET_NO_LONGER_VALID` (`409`)
- `PLANNER_REVISION_CONFLICT` (`409`)

---

### 5.6 `POST /api/v1/planner/plans/:planId/cancel`

Body:

```json
{
  "username": "Hayato",
  "worldId": "dominion-1",
  "expectedRevision": 4
}
```

Success `200`:

```json
{
  "ok": true,
  "data": {
    "plan": {
      "id": "pln_01JXYZ...",
      "status": "canceled",
      "revision": 5,
      "canceledAt": "2026-03-12T09:26:44Z"
    },
    "activePlan": null
  }
}
```

Error kody:

- `PLANNER_PLAN_NOT_FOUND` (`404`)
- `PLANNER_CANCEL_NOT_ALLOWED` (`409`)
- `PLANNER_REVISION_CONFLICT` (`409`)

---

### 5.7 `GET /api/v1/planner/plans/:planId/events`

Query:

- `username` (required)
- `worldId` (required)
- `limit` (optional, default `50`, max `200`)
- `cursor` (optional)

Success `200`:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "plev_01...",
        "planId": "pln_01...",
        "planLegId": "pll_01...",
        "eventType": "leg_sent",
        "severity": "info",
        "message": "Leg #2 byl odeslan.",
        "payload": {
          "originVillageId": 111,
          "targetVillageId": 901,
          "movementId": 44391
        },
        "createdAt": "2026-03-12T10:01:22Z"
      }
    ],
    "nextCursor": null
  }
}
```

Error kody:

- `PLANNER_PLAN_NOT_FOUND` (`404`)
- `PLANNER_EVENTS_ACCESS_DENIED` (`403`)

## 6. Error code katalog

Minimalni planner katalog:

- auth/session:
  - `AUTH_REQUIRED`
  - `SESSION_USERNAME_MISMATCH`
- input:
  - `PLANNER_WORLD_REQUIRED`
  - `PLANNER_TARGET_REQUIRED`
  - `PLANNER_LEGS_REQUIRED`
  - `PLANNER_UNIT_AMOUNT_INVALID`
- validate:
  - `PLANNER_MAX_LEGS_EXCEEDED`
  - `PLANNER_DUPLICATE_ORIGIN`
  - `PLANNER_ORIGIN_NOT_OWNED`
  - `PLANNER_UNIT_TYPE_NOT_ALLOWED`
  - `PLANNER_IMPACT_ORDER_INVALID`
  - `PLANNER_IMPACT_GAP_TOO_SMALL`
  - `PLANNER_LEAD_TIME_EXPIRED`
  - `PLANNER_TARGET_NOT_FOUND`
  - `PLANNER_TARGET_NOT_SINGLE_VILLAGE`
- lifecycle:
  - `PLANNER_ACTIVE_PLAN_ALREADY_EXISTS`
  - `PLANNER_PLAN_NOT_FOUND`
  - `PLANNER_PLAN_NOT_EDITABLE`
  - `PLANNER_RECONFIRM_NOT_ALLOWED`
  - `PLANNER_CANCEL_NOT_ALLOWED`
  - `PLANNER_REVISION_CONFLICT`
  - `PLANNER_TARGET_NO_LONGER_VALID`
- infra:
  - `PLANNER_SAVE_FAILED`
  - `PLANNER_UPDATE_FAILED`

## 7. `plan_id` foresight

Plannerem vytvorene movementy a planner eventy maji nest:

- `plan_id`
- `plan_leg_id`

To plati pro:

- command creation payload do herniho enginu
- planner event log
- budouci navazne notifikace/reporty

## 8. Kompatibilita

Aktualni backend globalne vraci `{ ok: false, error }`.

Planner spec zavadi navic:

- `errorCode`
- volitelne `details`

Doporuceni:

- FE fallback logika:
  - pokud `errorCode` chybi, pracovat aspon s `error` textem
  - planner endpointy maji po implementaci vracet oba tvary konzistentne
