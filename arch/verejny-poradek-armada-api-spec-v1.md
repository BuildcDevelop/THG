# Verejny poradek, armada vsech len, mapa a queue v1 - API spec

Tento dokument navazuje na:

- `arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md`
- `arch/optimalizace-a-vykonove-guardrails.md`

Cil:

- dodat presny API kontrakt pro verejny poradek, `Armadu vsech len`, recruit queue a support rebase,
- dodat presny API kontrakt i pro mapovy ownership/diplomacy read model,
- drzet se stavajiciho stylu `ok/data` a `result + data`,
- nepritahovat tezka data do hlavniho snapshotu, pokud je nepotrebuje vic panelu zaroven.

## 1. Scope

V1 API pokryva:

- summary `Verejny poradek` v hlavnim game state,
- additive zpevneni kontraktu `GET /api/v1/world-map`,
- rozsireni existujiciho `GET /api/v1/army/overview`,
- reorder recruit queue,
- cancel recruit queue item,
- support rebase,
- zpevneni kontraktu battle reportu vuci notifikacim.

Mimo scope:

- samostatny polling endpoint pro verejny poradek,
- samostatny endpoint pro canvas mapu,
- redesign battle report listu,
- engine-level combat rewrite.

## 2. Auth a tenancy model

Stejny model jako zbytek `api/v1`:

- session cookie je povinna,
- `username` musi odpovidat session uzivateli,
- world je urcen `worldId`,
- `GET` endpointy cteni pouzivaji `username` a `worldId` v query,
- `POST` endpointy zapisu pouzivaji `username` a `worldId` v body.

## 3. Envelope

### 3.1 Success

```json
{
  "ok": true,
  "data": {}
}
```

### 3.2 Mutation success

```json
{
  "ok": true,
  "result": {},
  "data": {}
}
```

Poznamka:

- `data` zustava aktualizovany `GameStateResponse`, pokud je endpoint napojeny na aktivni herni panel.

### 3.3 Error

```json
{
  "ok": false,
  "error": "Human readable message",
  "errorCode": "STABLE_MACHINE_CODE",
  "details": {}
}
```

## 4. Spolecne typy

```ts
type PublicOrderBand = 'stable' | 'warning' | 'critical'

type PublicOrderSummary = {
  currentPct: number
  maxPct: 100
  regenPctPerHour: number
  band: PublicOrderBand
  knightRecruitBlocked: boolean
  globalSpeedPenaltyPct: number
  updatedAt: string
}

type ArmyOverviewVillageGarrison = {
  totalUnits: number
  militiaAmount: number
  archerAmount: number
  militiaCap: number
  archerCap: number
}

type ArmyOverviewRecruitmentItem = {
  recruitmentId: number
  unitId: string
  unitName: string
  amount: number
  queueIndex: number
  status: 'queued' | 'in_progress'
  startedAt: string
  finishAt: string
  remainingSec: number
}

type ArmyOverviewRecruitmentSummary = {
  queueLength: number
  queuedUnitCount: number
  inProgressItem: ArmyOverviewRecruitmentItem | null
  nextQueuedItems: Array<Pick<ArmyOverviewRecruitmentItem, 'recruitmentId' | 'unitId' | 'unitName' | 'amount' | 'queueIndex'>>
}
```

## 5. `GET /api/v1/state`

V1 nema pridavat novy endpoint pro badge v headeru. Summary `Verejny poradek` je dost male na to, aby bylo soucasti bezneho snapshotu.

### 5.1 Zmena response shape

Do `GameStateResponse` se prida:

```ts
type GameStateResponse = {
  // existing fields...
  publicOrder: PublicOrderSummary
}
```

### 5.2 Contract

- field je vzdy pritomen pro prihlaseneho hrace,
- `currentPct` je cele cislo `0..100`,
- `band` je odvozen:
  - `stable` pro `50..100`
  - `warning` pro `30..49`
  - `critical` pro `0..29`
- `knightRecruitBlocked` je `true` pro `0..49`,
- `globalSpeedPenaltyPct` je:
  - `0` pro `30..100`
  - `50` pro `0..29`

### 5.3 Poznamka k UI

Frontend z tohoto summary odvodi:

- zda badge zobrazi jen ikonu nebo i procento,
- tonalitu badge,
- tooltip copy.

Server nema vracet hotovy tooltip text.

## 6. `GET /api/v1/army/overview`

Toto je preferovana cesta pro `Armadu vsech len`. Nema vzniknout novy paralelni endpoint, pokud stavajici overview zustane panel-scoped a lightweight.

### 6.1 Kompatibilita

- vsechny existujici fieldy zustavaji,
- nove fieldy jsou additive,
- stavajici planner flow se nesmi rozbit.

### 6.2 Rozsireni response shape

Kazde `village` bude rozsiren o:

```ts
type ArmyVillageSummary = {
  // existing fields...
  fortificationLevel: number
  gateLevel: number
  garrison: ArmyOverviewVillageGarrison
  recruitment: ArmyOverviewRecruitmentSummary
  statusBadges: Array<'recruiting' | 'incoming' | 'outgoing' | 'stationed_support'>
}
```

### 6.3 Data contract

- `fortificationLevel` a `gateLevel` jsou aktualni urovne budov,
- `garrison` shrnuje jen to, co je treba pro tooltip,
- `recruitment` vraci jen summary pro panel a tooltip, ne plne admin detaily,
- `nextQueuedItems` je limitovano na dalsi `2` polozky,
- `statusBadges` jsou odvozene z jiz nactenych movement/recruitment dat,
- endpoint nesmi vracet nic, co panel nezobrazi.

### 6.4 Request lifecycle

- endpoint se vola jen pri aktivnim panelu `Armada`,
- zadny background polling pri zavrenem panelu,
- `generatedAt` zustava kvuli stale-state diagnostice.

## 7. `POST /api/v1/units/recruitments/reorder`

Recruit queue se ma ergonomicky chovat stejne jako building queue.

### 7.1 Request

```json
{
  "username": "Hayato",
  "worldId": "world-main",
  "villageId": 123,
  "recruitmentId": 456,
  "targetIndex": 2
}
```

### 7.2 Result

```ts
type ReorderRecruitmentQueueResult = {
  recruitmentId: number
  villageId: number
  fromIndex: number
  toIndex: number
  queueLength: number
}
```

### 7.3 Rules

- lze reorderovat jen `queued` nebo `in_progress` itemy vlastniho lena,
- `targetIndex` je `0-based` stejne jako u building queue,
- po reorderu se prepocita timeline jen daneho lena,
- response vraci `result + data`.

## 8. `POST /api/v1/units/recruitments/:recruitmentId/cancel`

Endpoint zustava zachovan, ale queue contract se upresnuje.

### 8.1 Zmena chovani

- lze zrusit `queued` i `in_progress` item,
- po zruseni se prepocita timeline jen daneho lena,
- `result` vraci i novou delku fronty a refund summary.

```ts
type CancelRecruitmentResult = {
  recruitmentId: number
  villageId: number
  queueLength: number
  refunded: {
    wood: number
    stone: number
    iron: number
  }
}
```

## 9. `POST /api/v1/army/support/:movementId/rebase`

Zmena stationed support na vlastni jednotky ciloveho lena.

### 9.1 Request

```json
{
  "username": "Hayato",
  "worldId": "world-main",
  "targetVillageId": 789,
  "villageId": 789
}
```

Poznamka:

- `villageId` je UI context pro navrat aktualniho snapshotu, nikoli zdroj pravdy.

### 9.2 Result

```ts
type SupportRebaseResult = {
  movementId: number
  targetVillageId: number
  oldHomeVillageId: number
  newHomeVillageId: number
  transferredUnits: Array<{
    unitId: string
    amount: number
  }>
}
```

### 9.3 Rules

- movement musi byt `status='stationed'` a `commandType='support'`,
- cilove leno musi patrit stejnemu hraci,
- obytna ctvrt a volna populace musi prevzeti dovolit,
- uspesna operace movement auditovatelne uzavre a jednotky prepise do ciloveho lena,
- response vraci `result + data`.

## 10. Battle report contract

Battle report endpointy zustavaji:

- `GET /api/v1/reports`
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/:reportId`

Upresneni kontraktu:

- archivace nebo smazani `player_notification` nesmi smazat nebo znepristupnit `battle_reports`,
- notifikace je jen inbox reference,
- detail reportu musi byt dostupny samostatne pres `reportId`,
- notification payload ma pouzivat explicitni referenci na report a nema byt jediny zdroj pravdy.

## 11. Error code katalog

### 11.1 Verejny poradek

- `PUBLIC_ORDER_KNIGHT_BLOCKED`
- `PUBLIC_ORDER_NOT_AVAILABLE`

### 11.2 Recruit queue

- `RECRUITMENT_NOT_FOUND`
- `RECRUITMENT_NOT_OWNED`
- `RECRUITMENT_QUEUE_INVALID_TARGET_INDEX`
- `RECRUITMENT_QUEUE_REORDER_BLOCKED`
- `RECRUITMENT_QUEUE_POPULATION_LIMIT`

### 11.3 Support rebase

- `SUPPORT_REBASE_NOT_FOUND`
- `SUPPORT_REBASE_NOT_STATIONED`
- `SUPPORT_REBASE_TARGET_NOT_OWNED`
- `SUPPORT_REBASE_POPULATION_LIMIT`
- `SUPPORT_REBASE_HOUSING_LIMIT`

### 11.4 Reports

- `BATTLE_REPORT_NOT_FOUND`
- `BATTLE_REPORT_ACCESS_DENIED`

## 12. Guardrails

- `publicOrder` summary je male additive pole v hlavnim state a nesmi nafouknout payload vic nez je nutne,
- `army/overview` zustava panel-scoped endpoint,
- hidden `Armada` panel dela `0` requestu,
- reorder/cancel/rebase nesmi spoustet nic mimo dotcene leno, krome nezbytneho snapshot refresh,
- zadny novy polling loop.

## 13. `GET /api/v1/world-map`

Mapovy ownership/diplomacy kontrakt se ma resit additive rozsirenim existujiciho endpointu, ne novym read path.

### 13.1 Request

Request shape zustava stejny:

```http
GET /api/v1/world-map?username=Hayato&worldId=world-main&villageId=123
```

Pravidla:

- zadne nove query parametry kvuli zoom/pan/hover,
- endpoint zustava world read modelem pro hlavni mapu i minimapu,
- response je additive; stavajici klienti se nesmi rozbit.

### 13.2 Zmena response shape

Do kazde polozky `settlements[]` se additive prida:

```ts
type WorldSettlementMapKind =
  | 'active'
  | 'own'
  | 'royal'
  | 'allied'
  | 'don'
  | 'opponent'
  | 'enemy'
  | 'bot'
  | 'abandoned'

type WorldSettlementDiplomacyKind =
  | 'same_player'
  | 'same_kingdom_foreign'
  | 'ally'
  | 'non_aggression'
  | 'neutral'
  | 'war'
  | 'none'

type WorldSettlementCommandPermissions = {
  canMove: boolean
  canSupport: boolean
  canAttack: boolean
}

type WorldSettlement = {
  // existing fields...
  relation: 'self' | 'ally' | 'enemy' // deprecated compatibility field
  mapKind: WorldSettlementMapKind
  diplomacyKind: WorldSettlementDiplomacyKind
  commandPermissions: WorldSettlementCommandPermissions
}
```

### 13.3 Data contract

- `mapKind` je autoritativni render bucket pro hlavni mapu i minimapu,
- `diplomacyKind` je autoritativni vysvetlujici bucket pro tooltip, army target dialog a planner,
- `commandPermissions` je autoritativni serverovy vysledek pro:
  - mapove akce
  - army command dialog
  - planner target validation
- klient uz nesmi odvozovat `DoN`, `ally`, `opponent` ani `enemy` z `note`, newbie ochrany nebo jine heuristiky,
- stavajici `relation` zustava jen kvuli kompatibilite prechodove vrstvy a ma byt postupne odstavena z render logiky.

### 13.4 Specialni pravidlo `same_kingdom_foreign`

Pro ciziho hrace ve stejnem Kralovstvi plati:

- `mapKind = 'opponent'`
- `diplomacyKind = 'same_kingdom_foreign'`
- `commandPermissions.canMove = false`
- `commandPermissions.canSupport = true`
- `commandPermissions.canAttack = true`

Poznamky:

- nema samostatnou legendovou barvu v prvni verzi,
- nikdy se nesmi vracet jako `mapKind = 'own'`,
- nikdy se nesmi maskovat jako `allied` nebo `don` jen proto, ze patri do stejneho Kralovstvi,
- stejne Kralovstvi neni samo o sobe diplomaticky stav.

### 13.5 Render a fetch guardrails

- hlavni mapa, minimapa, army dialog a planner musi cist stejna pole bez dalsi transformacni heuristiky,
- endpoint nesmi vracet tezsi detail len nebo dalsi payload, ktery uz patri do village detailu,
- zoom, pan, hover a selection nesmi vytvaret nove requesty,
- pokud se meni jen UI barva nebo target gating, nema se kvuli tomu rozsirivat `GET /api/v1/state`.
