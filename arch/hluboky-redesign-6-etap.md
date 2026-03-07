# Hluboky redesign - 6 etap

Tento dokument je implementacni plan a prubezny stav hlubokeho redesignu.

## Etapa 1 - Kontrakty domen a ownership stavu

Status: `done` (prvni verze)

- Definovany kontrakt pro:
  - authoritative state,
  - cache a snapshoty,
  - odvozeny view-model,
  - loading pravidla po panelech.
- Zakotveno v guardrails dokumentu.

## Etapa 2 - Frontend state boundaries

Status: `in_progress`

- Gameplay snapshot a map snapshot drzeny oddelene.
- Pridan guard proti zbytecnym update:
  - skip full `setGameState` pokud se zmenil jen `serverTime`,
  - skip `setWorldMapState` pri identickych map datech.

## Etapa 3 - Fetch orchestrace podle panelu

Status: `in_progress`

- Polling reportu a activity je panel-aware:
  - otevreny panel: plny fetch,
  - zavreny panel: summary fetch v delsim intervalu.
- Pridany summary endpointy:
  - `/api/v1/reports/summary`
  - `/api/v1/activity/summary`

## Etapa 4 - Backend read model separation

Status: `in_progress`

- Read endpointy uz netriggeruji `runGameTick`:
  - worlds, admin players, state, ranking, reports, communication, world-map.
- Tick zustava na mutacnich cestach a cron scheduleru.

## Etapa 5 - Map rendering redesign

Status: `in_progress`

- Pridany viewport culling markeru:
  - renderuje se pouze viewport + bezpecny margin.
- Centrovani na settlement uz neni zavisle na tom, ze marker je v DOM.

## Etapa 6 - Stabilizace, testy a release guardrails

Status: `done`

- Doplneno:
  - regresni test `summary-polling-consistency`:
    - kontrola konzistence full vs summary (`reports`, `activity`),
    - guardrail na pomer payloadu summary/full.
  - regresni test `read-models-no-tick-side-effects`:
    - read-model volani nesmi posouvat frontu zpracovani bez explicitniho `runGameTick`.
  - map stress test `map-render-scope-stress`:
    - umele zvyseni hustoty osad,
    - mereni `renderedSettlements` vs `totalSettlements`,
    - guardrail na maximalni render ratio.

- Spousteni:
  - cele regresni testy: `npm run test:regression`
  - jen etapa 6: `node --test --test-name-pattern "stage6" tests/regression/game-rules.regression.test.mjs`
  - report metrik etapy 6: `npm run report:stage6`

- CI guard:
  - workflow `.github/workflows/ci.yml` obsahuje job `stage6-guardrails`
  - job spousti lint + `test:stage6` + `report:stage6` a publikuje JSON artefakty `artifacts/perf/*.json`

## Akceptacni pravidla

- Zadny novy globalni polling bez jasneho duvodu.
- Hidden panel nesmi bezet na plnem fetchi.
- Zoom/pan mapy nesmi tahat data.
- Read endpointy nesmi potichu posouvat herni cas.
- Kazda dalsi feature musi projit feature kontraktem z guardrails.
