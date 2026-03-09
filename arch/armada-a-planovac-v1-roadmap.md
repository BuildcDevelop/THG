# Armada a Planovac v1 Roadmap

Tento dokument je implementacni roadmap a specifikace pro `Armadu` a `Planovac` v The Last Dominion.

Scope tohoto dokumentu je zamerne omezen pouze na:

- `Armada`
- `Planovac`

Mimo scope:

- redesign jinych panelu
- upravy mapy
- upravy ekonomiky
- upravy komunikace
- upravy UI Zaznamu jako samostatne stranky

Planner eventy se mohou zapisovat do backend logu/notifikaci, ale tento dokument neresi UI implementaci Zaznamu.

## 1. Cile v1

- Vytvorit novou stranku/panel `Armada` jako read-only souhrn vsech vlastnich len.
- Vytvorit novy `Planovac` pro jeden casovany utok na jeden cil z vice vlastnich len.
- Zachovat vykon hry tim, ze nova data nepujdou do hlavniho `gameState` snapshotu.
- Odpojit klik na leno v Armade od zmeny aktivniho lena hry.

## 2. Finalni produktovy kontrakt

### Armada

- Zobrazuje pouze vlastni lena v aktualnim svete.
- Lena jsou razena A/Z stejne jako jinde ve hre.
- Kazda karta lena ukazuje:
  - nazev lena
  - souradnice
  - horizontalni unit pills
  - hodnoty ve formatu `vlastni (podpora)`
- `podpora` znamena stacionovane obranne jednotky poslanych do lena jako support.
- Podpora je pouze informacni a nelze ji pouzit do utoku.
- Klik kamkoliv na kartu lena:
  - neprepne aktivni leno hry
  - otevre Planovac, pokud neni otevreny
  - prida dane leno jako novy leg do konceptu planu
- Pokud je leno v planu uz vybrane:
  - nevytvori se duplikat
  - planner fokusne existujici leg
- Maximalni pocet vybranych len do planu je `10`.
- Tooltip u armadniho kontextu:
  - `Utocne a obranne prikazy a presuny jednotek`

### Planovac v1

- Planner umi pouze:
  - `1` aktivni plan na hrace a svet
  - `1` cil
  - `1` casovany utok
  - vice vlastnich len jako legy
- Planner je dostupny oddelene pro kazdy svet.
- Pokud existuje aktivni serverovy plan pro dany svet, ma vzdy prioritu nad lokalnim draftem.
- Lokalne se uklada pouze `posledni relace` rozpracovaneho konceptu.
- Planner zobrazi banner:
  - `Planovac je zatim mozne vyuzit jen pro jeden cil z vice len.`
- Cil se v `v1` vybera pres hrace, ktery ma v danem svete prave jedno leno.
- Planner uklada `resolved targetVillageId`, ne jen textovy target.
- Legy lze menit poradi drag&drop.
- Poradi legu je autoritativni:
  - horni leg ma nejdrivejsi dopad
  - dalsi legy musi mit pozdejsi dopad
  - stejny cas dopadu neni nikdy povolen
  - mezi dopady musi byt minimalne `1 minuta`
- Editace aktivniho planu je povolena do `lead time`.
- Pokud hrac otevrel editaci, ale ulozil ji az pozdeji nebo ji neulozil vubec:
  - stale plati posledni serverove ulozena verze planu
  - neulozeny koncept nesmi prepsat aktivni plan
- Pri chybe validace nebo dispatch failu musi hra nabidnout navrat zpet do konceptu planu.

## 3. Klicova rozhodnuti a guardrails

- Nove funkcionality nesmi nafouknout hlavni `fetchGameState`.
- Armada musi mit vlastni lehky read model.
- Planovac musi mit vlastni read/write model.
- Nepridavat novy globalni polling loop.
- Skryty planner nema delat sitove requesty.
- Klik v Armade nesmi menit aktivni leno hry.
- V `v1` nejsou jednotky tvrde rezervovane.
- Pred skutecnym spustenim planu probiha `pre-flight` kontrola na serveru.
- Pokud jeden leg neprojde, failne cely plan.

## 4. UX pravidla

### Armada

- Kompaktni karty, zadne tezke tabulky.
- Jednotky horizontalne vedle sebe.
- Sirka jednotlivych unit pill se prizpusobuje textu.
- Support je informacni a vizualne slabsi nez vlastni jednotky.
- Klik na kartu = hlavni akce `Pridat do planovace`.

### Planovac

- 3 rezimy UI:
  - prazdny koncept
  - editace konceptu
  - aktivni serverovy plan
- Pokud existuje lokalni draft a neexistuje aktivni serverovy plan:
  - UI nabidne `Obnovit posledni koncept`
- Pokud existuje aktivni serverovy plan:
  - UI otevre ten
  - lokalni draft nema prioritu
- Kazdy leg ukazuje:
  - poradi
  - puvodni leno
  - vybrane jednotky
  - cas dopadu v Praze
  - dopocitany cas odeslani
- Planner musi umet:
  - pridat leg
  - odebrat leg
  - upravit jednotky
  - upravit cas dopadu
  - preskladat poradi drag&drop
- Summary krok musi ukazat:
  - cil
  - vsechna lena v poradi
  - dopady
  - send times
  - vybrane jednotky
  - warningy nebo blokace
- Kazdy `warning` nebo `blocked` stav musi mit akci:
  - `Zpet do konceptu`

## 5. Stavovy model

### Lokalni draft

- existuje jen jako `last session draft`
- uklada se lokalne
- neni autoritativni

### Serverovy plan

Stavy:

- `scheduled`
- `needs_reconfirmation`
- `dispatching`
- `completed`
- `failed`
- `canceled`

Pravidla:

- aktivni plan na hrace a svet muze byt jen jeden
- `scheduled` a `needs_reconfirmation` lze editovat do lead time
- `dispatching` uz nelze editovat
- `failed` musi vratit jasne duvody
- `needs_reconfirmation` nastane pri zmene owner/kingdom cile

## 6. Datovy kontrakt

### Army Overview

```ts
type ArmyOverviewResponse = {
  worldId: string
  generatedAt: string
  villages: ArmyVillageSummary[]
}

type ArmyVillageSummary = {
  villageId: number
  villageName: string
  coordX: number
  coordY: number
  kingdom: string
  sortLabel: string
  totalOwnUnits: number
  totalSupportUnits: number
  plannerSelectable: boolean
  plannerSelected: boolean
  units: ArmyVillageUnitSummary[]
}

type ArmyVillageUnitSummary = {
  unitId: string
  unitName: string
  sortOrder: number
  ownAmount: number
  supportAmount: number
  availableForPlanning: number
  visibleLabel: string
}
```

### Planner Open

```ts
type PlannerOpenResponse = {
  worldId: string
  timezone: 'Europe/Prague'
  constraints: {
    maxLegs: 10
    minImpactGapMinutes: 1
    leadTimeSec: number
    activePlansPerPlayerPerWorld: 1
  }
  bannerText: string
  activePlan: PlannerPlanDetail | null
  recentTargets: PlannerRecentTarget[]
}
```

### Planner Validation

```ts
type ValidatePlannerRequest = {
  worldId: string
  targetPlayerUsername: string
  legs: Array<{
    order: number
    originVillageId: number
    impactAtPrague: string
    units: Array<{ unitId: string; amount: number }>
  }>
}

type ValidatePlannerResponse = {
  resolvedTarget: {
    targetPlayerId: number
    targetPlayerUsername: string
    targetVillageId: number
    targetVillageName: string
    targetKingdom: string
    coordX: number
    coordY: number
    snapshotHash: string
  } | null
  normalizedLegs: Array<{
    order: number
    originVillageId: number
    impactAtPrague: string
    impactAtUtc: string
    sendAtUtc: string
    travelDurationSec: number
    units: Array<{ unitId: string; amount: number }>
  }>
  validation: {
    status: 'ok' | 'warning' | 'blocked'
    issues: PlannerValidationIssue[]
  }
}
```

### Planner Persisted Plan

```ts
type PlannerPlanDetail = {
  plan: {
    id: string
    status: 'scheduled' | 'needs_reconfirmation' | 'dispatching' | 'completed' | 'failed' | 'canceled'
    revision: number
    targetVillageId: number
    targetPlayerId: number
    targetPlayerUsernameSnapshot: string
    targetVillageNameSnapshot: string
    targetKingdomSnapshot: string
    confirmedAt: string | null
    createdAt: string
    updatedAt: string
    failedAt: string | null
    canceledAt: string | null
  }
  legs: Array<{
    id: string
    order: number
    status: 'scheduled' | 'sent' | 'failed' | 'canceled'
    originVillageId: number
    originVillageNameSnapshot: string
    impactAtUtc: string
    sendAtUtc: string
    travelDurationSec: number
    units: Array<{ unitId: string; plannedAmount: number }>
    failCode: string | null
    failMessage: string | null
  }>
}
```

## 7. API roadmap

### Read

- `GET /api/v1/army/overview?worldId=...`
- `GET /api/v1/planner/open?worldId=...`
- `GET /api/v1/planner/plans/:planId/events?worldId=...`

### Write

- `POST /api/v1/planner/validate`
- `POST /api/v1/planner/plans`
- `PATCH /api/v1/planner/plans/:planId`
- `POST /api/v1/planner/plans/:planId/reconfirm`
- `POST /api/v1/planner/plans/:planId/cancel`

### Interni scheduler

- `runDuePlannerDispatch(worldId, nowUtc)`

## 8. DB roadmap

### Nove tabulky

- `planner_plans`
- `planner_plan_legs`
- `planner_plan_leg_units`
- `planner_plan_events`

### Nove indexy

- aktivni plan per `player + world`
- unique `leg_order` v planu
- unique `origin_village_id` v planu
- index na `send_at_utc` pro scheduler
- index na event log

### Important

- Army overview v `v1` nepouzije novou tabulku.
- Bude to lehky read model slozeny nad existujicimi hernimi daty.

## 9. Validace a fail pravidla

Pri validate nebo dispatch check musi backend overit:

- target player existuje
- target player ma v danem svete prave jedno leno
- target je validni pro utok
- max 10 legu
- zadne duplicitni origin leno
- vsechna origin lena patri hraci
- vsechny amounty jsou kladne
- pouzivaji se pouze utocne jednotky z vlastniho lena
- dopady jsou striktne rostouci
- rozdil mezi sousednimi dopady je min. 1 minuta
- lead time neni porusen
- pri finalnim dispatchi souhlasi presne pocty jednotek v kazdem legu

Pokud failne jeden leg:

- neodesle se nic
- failne cely plan
- ulozi se detailni duvod per leg
- hrac se muze vratit do konceptu

## 10. Reconfirmation pravidla

Pokud se zmeni:

- owner targetu
- kingdom targetu

pak plan prejde do:

- `needs_reconfirmation`

UI musi ukazat:

- noveho hrace
- nove kralovstvi
- odkazy na oba entity

Hrac ma akce:

- `Potvrdit i tak`
- `Zpet do konceptu`

Pokud target uz neni validni:

- planner zustane blocked
- hrac musi upravit cil nebo plan

## 11. Faze vyvoje

### Phase 1 - Groundwork

- odpojit klik v Armade od zmeny aktivniho lena
- pripravit planner state boundary
- doplnit technicke constraints a constants

Exit criteria:

- klik na kartu lena nikde nemeni aktivni leno
- planner muze mit vlastni lokalni draft state

### Phase 2 - Armada UI

- implementovat `army/overview`
- vykreslit novy seznam vlastnich len
- pridat unit pills `vlastni (podpora)`
- pridat akci `Pridat do planovace`
- pridat limit 10 legu a fokus existujiciho legu

Exit criteria:

- Armada funguje jako read-only overview
- karta lena pridava leg do planneru

### Phase 3 - Planner Draft UI

- prazdny stav
- restore posledni relace
- target picker
- leg list
- drag&drop poradi
- casy dopadu
- local autosave
- summary krok

Exit criteria:

- planner lze kompletne vyplnit bez backend persistu
- dopady jsou v UI vzdy validni

### Phase 4 - Planner Backend Persistence

- create plan
- update plan
- cancel plan
- reconfirm plan
- revision handling
- event log

Exit criteria:

- jeden aktivni plan na hrace a svet
- aktivni serverovy plan ma prioritu nad lokalnim draftem

### Phase 5 - Validate + Dispatch

- backend validate
- final pre-flight
- scheduler dispatch
- all-or-nothing plan execution
- fail handling

Exit criteria:

- `1 leg fail => nic se neodesle`
- `all legs pass => vse se odesle`

### Phase 6 - Polish

- doladeni hlasek
- detailni per-leg errors
- edge cases
- manual QA

Exit criteria:

- planner je pouzitelny bez ztraty dat posledni relace
- fail stavy jsou citelne a vratitelne zpet do konceptu

## 12. Test checklist

- Army overview se nacita bez zasahu do hlavniho snapshotu
- klik na kartu lena nemeni aktivni leno
- nelze pridat 11. leg
- nelze pridat duplicitni origin leno
- nelze ulozit stejny dopad
- nelze ulozit rozestup mensi nez 1 minuta
- target player bez lena failne
- target player s vice leny failne
- change owner => `needs_reconfirmation`
- change kingdom => `needs_reconfirmation`
- jeden leg unit mismatch => fail cely plan
- revision conflict pri editaci
- scheduled plan lze zrusit
- aktivni plan ma prioritu nad lokalnim draftem

## 13. Done definition pro novy chat

Az se bude implementovat podle tohoto dokumentu, ber jako `done`:

- Armada funguje jako read-only souhrn vsech vlastnich len
- karta lena pridava leg do planneru
- klik v Armade nikdy nemeni aktivni leno hry
- planner umi jeden cil, max 10 legu, 1 aktivni plan na hrace a svet
- mezi dopady je vzdy min. 1 minuta
- aktivni serverovy plan ma prioritu nad lokalnim draftem
- pri failu existuje navrat zpet do konceptu
- nova funkcionalita nepridava novy globalni polling ani neexpanduje hlavni `gameState`
