# Planovac v1 - implementacni milniky

Tento dokument prevadi arch navrh do realizovatelnych milniku.

Navazuje na:

- `arch/planovac-api-spec-v1.md`
- `arch/planovac-db-spec-v1.md`
- `arch/planovac-ui-state-machine-v1.md`
- `arch/planovac-acceptance-scenare-v1.md`

## 1. Milnik A - API kontrakty

Scope:

- doplnit planner endpointy do `server/index.js`
- doplnit service metody do `server/gameService.js`
- sladit envelope (`ok/data` + planner `errorCode/details`)

Deliverables:

- `POST /api/v1/planner/validate`
- `POST /api/v1/planner/plans`
- `PATCH /api/v1/planner/plans/:planId`
- `POST /api/v1/planner/plans/:planId/reconfirm`
- `POST /api/v1/planner/plans/:planId/cancel`
- `GET /api/v1/planner/plans/:planId/events`

Exit:

- endpointy vraci payloady dle API spec
- planner error kody jsou stabilni

## 2. Milnik B - DB persistence

Scope:

- planner tabulky/indexy
- `activePlan` read model
- `lastCompletedPlan` read model
- revision concurrency

Deliverables:

- schema pro `planner_plans`, `planner_plan_legs`, `planner_plan_leg_units`, `planner_plan_events`
- unique active plan per `player+world`
- optimistic concurrency (`expectedRevision`)

Exit:

- create/update/cancel/reconfirm zapisuje konzistentni data
- read model vraci `activePlan + lastCompletedPlan`

## 3. Milnik C - Scheduler a dispatch

Scope:

- dispatch loop planner planu
- all-or-nothing fail
- status transitions

Deliverables:

- `scheduled -> dispatching -> completed|failed`
- per-leg status updates
- planner event log pri dispatchi

Exit:

- `completed` az po odeslani vsech legu
- `1 leg fail => nic se neodesle`

## 4. Milnik D - FE planner flow

Scope:

- state machine rezimy v army/planner panelu
- confirmation krok
- active card
- needs reconfirmation flow

Deliverables:

- `draft -> confirmation -> active_plan`
- explicitni `Zpet do konceptu`
- lead time fail hlasky
- pri aktivnim planu defaultne zadny draft editor

Exit:

- UX odpovida state machine dokumentu
- lokalni draft neni autorita pri existenci serveroveho planu

## 5. Milnik E - UX doplnky

Scope:

- `Vyplnit vse` (`cavalry + ram + scout`)
- auto-align dopredu
- auto-align zpet od posledniho legu
- completed stub karta

Exit:

- doplnky jsou dostupne v editoru a testovatelne

## 6. Milnik F - QA a acceptance

Scope:

- projit acceptance scenare `PL-001 ... PL-022`
- doplnit regression testy planner flow

Exit:

- P0 scenare zelene
- planner neporusuje guardrails

## 7. Ticket backlog (doporuceny)

P0:

- API-001 implement `validate`
- API-002 implement `create`
- API-003 implement `patch`
- API-004 implement `reconfirm`
- API-005 implement `cancel`
- DB-001 schema planner tables + indexes
- DB-002 activePlan read model
- DB-003 lastCompletedPlan read model
- SCHED-001 planner dispatch executor
- FE-001 confirmation step
- FE-002 active plan card
- FE-003 lock draft when active plan exists

P1:

- FE-004 `Vyplnit vse`
- FE-005 auto-align dopredu
- FE-006 auto-align zpet
- FE-007 needs reconfirmation diff UI
- QA-001 acceptance P0 + P1

P2:

- EVT-001 planner events feed polish
- FORESIGHT-001 add nullable `plan_id` / `plan_leg_id` to movement/event records

## 8. Doporucene poradi nasazeni

1. Milnik A + B
2. Milnik C
3. Milnik D
4. Milnik E
5. Milnik F
