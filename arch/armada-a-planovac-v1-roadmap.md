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
- Planner ma jasne rezimy UI:
  - `draft`
  - `confirmation`
  - `active_plan`
  - `completed_stub`
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
- `Stav konceptu: validni` nikdy neznamena, ze se neco samo odesle.
- Pred ulozenim vzdy existuje krok `Potvrzeni planu`.
- Po uspesnem potvrzeni a ulozeni se plan prepne do serveroveho stavu `scheduled`.
- `scheduled` se v UI zobrazuje jako `Potvrzeno / naplanovano`.
- Aktivni karta planu ukazuje:
  - cil
  - impact okno
  - cas do prvniho odeslani
  - stav planu
  - progress pri `dispatching`
- Planner ukazuje maximalne:
  - jeden aktivni nebo potvrzeny plan
  - jeden posledni `completed_stub`
- Kdyz se dokonci dalsi plan, predchozi `completed_stub` se prepise.
- Planner umi automaticke srovnani impact casu:
  - od prvniho legu dopredu
  - od posledniho legu zpet
- Planner umi akci `Vyplnit vse` pouze pro utocne jednotky:
  - `cavalry`
  - `ram`
  - `scout`
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

- 4 rezimy UI:
  - prazdny koncept
  - editace konceptu
  - potvrzeni planu
  - aktivni serverovy plan
- Volitelny doplnkovy read-only blok:
  - posledni `completed_stub`
- Pokud existuje lokalni draft a neexistuje aktivni serverovy plan:
  - UI nabidne `Obnovit posledni koncept`
- Pokud existuje aktivni serverovy plan:
  - UI otevre ten
  - lokalni draft nema prioritu
  - hrac neni defaultne v konceptu
- Kazdy leg ukazuje:
  - poradi
  - puvodni leno
  - vybrane jednotky
  - cas dopadu v Praze
  - dopocitany cas odeslani
- Aktivni karta planu ukazuje:
  - cil
  - impact okno `od -> do`
  - countdown do prvniho odeslani
  - progress `odeslano N / total` pri `dispatching`
- Planner musi umet:
  - pridat leg
  - odebrat leg
  - upravit jednotky
  - upravit cas dopadu
  - preskladat poradi drag&drop
- planner musi umet:
  - `Vyplnit vse` pro `cavalry + ram + scout`
  - automaticke srovnani casu dopredu
  - automaticke srovnani casu zpet od posledniho legu
- Summary a confirmation krok musi ukazat:
  - cil
  - vsechna lena v poradi
  - dopady
  - send times
  - vybrane jednotky
  - warningy nebo blokace
- Confirmation krok ma akce:
  - `Ulozit plan`
  - `Zpet do konceptu`
- Kazdy `warning` nebo `blocked` stav musi mit akci:
  - `Zpet do konceptu`

## 5. Stavovy model

### Lokalni draft

- existuje jen jako `last session draft`
- uklada se lokalne
- neni autoritativni
- `confirmation` neni samostatny persistentni serverovy stav
- `confirmation` je read-only krok nad poslednim vysledkem `validate`

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
- `scheduled` znamena serverove ulozeny a potvrzeny plan
- `scheduled` se v UI zobrazuje jako `Potvrzeno / naplanovano`
- `scheduled` a `needs_reconfirmation` lze editovat do lead time
- pokud `lead time` vyprsi behem editace:
  - save failne
  - stale plati posledni serverova verze planu
- `dispatching` uz nelze editovat
- `dispatching` zacina ve chvili, kdy prvni leg vstoupi do dispatch okna
- progress pri `dispatching` se pocita jako `sent legs / total legs`
- `completed` znamena, ze vsechny legy byly uspesne odeslany
- `failed` musi vratit jasne duvody
- `needs_reconfirmation` nastane pri zmene owner/kingdom cile

### Posledni dokonceny plan

- planner muze zobrazit jeden posledni `completed_stub`
- nejde o archiv
- po dokonceni dalsiho planu se predchozi `completed_stub` prepise

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
  lastCompletedPlan: PlannerCompletedStub | null
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
type PlannerCompletedStub = {
  planId: string
  targetPlayerUsernameSnapshot: string
  targetVillageNameSnapshot: string
  targetKingdomSnapshot: string
  legsCount: number
  firstSendAtUtc: string
  lastSendAtUtc: string
  completedAt: string
}
```

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

Poznamky:

- `confirmedAt` slouzi pro UX vrstvu `Potvrzeno / naplanovano`
- `confirmed` neni samostatny serverovy lifecycle stav
- pri budouci navaznosti na reporty ponesou plannerem vytvorene commandy a eventy:
  - `plan_id`
  - `plan_leg_id`

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
- scheduler pri vytvoreni planner commandu zapisuje foresight identifikatory:
  - `plan_id`
  - `plan_leg_id`

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
- Planner commandy a planner eventy maji byt pripraveny na budouci vazbu pres:
  - `plan_id`
  - `plan_leg_id`

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
- pri editaci aktivniho planu stale plati stejny `lead time` check
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
- predchozi snapshot a novy stav
- odkazy na oba entity

Hrac ma akce:

- `Potvrdit i tak`
- `Zpet do konceptu`

Pokud target uz neni validni:

- planner zustane blocked
- hrac musi upravit cil nebo plan
- pri navratu do konceptu zustanou duvody reconfirmation viditelne

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
- `Vyplnit vse` pro `cavalry + ram + scout`
- auto srovnani casu dopredu
- auto srovnani casu zpet od posledniho legu
- local autosave
- summary krok

Exit criteria:

- planner lze kompletne vyplnit bez backend persistu
- dopady jsou v UI vzdy validni
- hrac umi rychle srovnat cely casovy plan

### Phase 4 - Planner Backend Persistence

- create plan
- update plan
- cancel plan
- reconfirm plan
- revision handling
- event log
- active card read model
- `lastCompletedPlan` stub

Exit criteria:

- jeden aktivni plan na hrace a svet
- aktivni serverovy plan ma prioritu nad lokalnim draftem
- planner umi po ulozeni ukazat potvrzeny serverovy plan

### Phase 5 - Validate + Dispatch

- backend validate
- confirmation krok pred ulozenim
- final pre-flight
- scheduler dispatch
- all-or-nothing plan execution
- fail handling

Exit criteria:

- `1 leg fail => nic se neodesle`
- `all legs pass => vse se odesle`
- `validni koncept` sam o sobe nic neodesila bez potvrzeni a ulozeni

### Phase 6 - Polish

- doladeni hlasek
- detailni per-leg errors
- edge cases
- needs reconfirmation diff
- completed stub UX
- manual QA

Exit criteria:

- planner je pouzitelny bez ztraty dat posledni relace
- fail stavy jsou citelne a vratitelne zpet do konceptu
- aktivni plan a confirmation flow nejsou pro hrace matoucim dojmem

## 12. Test checklist

- Army overview se nacita bez zasahu do hlavniho snapshotu
- klik na kartu lena nemeni aktivni leno
- nelze pridat 11. leg
- nelze pridat duplicitni origin leno
- nelze ulozit stejny dopad
- nelze ulozit rozestup mensi nez 1 minuta
- target player bez lena failne
- target player s vice leny failne
- `validni koncept` bez potvrzeni nic neulozi ani neodesle
- confirmation krok ukazuje finalni read-only souhrn pred save
- po uspesnem save se zobrazi aktivni karta planu
- pokud existuje aktivni plan, planner se defaultne neotevre do konceptu
- `Vyplnit vse` naplni pouze `cavalry + ram + scout`
- auto srovnani funguje dopredu i zpet od posledniho legu
- change owner => `needs_reconfirmation`
- change kingdom => `needs_reconfirmation`
- `needs_reconfirmation` ukaze diff stareho a noveho stavu
- navrat z `needs_reconfirmation` do konceptu zachova viditelne duvody
- jeden leg unit mismatch => fail cely plan
- edit save po vyprseni lead time failne a vrati posledni serverovou verzi
- revision conflict pri editaci
- scheduled plan lze zrusit
- aktivni plan ma prioritu nad lokalnim draftem
- `completed` nastane po odeslani vsech legu
- zobrazuje se jen jeden posledni `completed_stub`

## 13. Done definition pro novy chat

Az se bude implementovat podle tohoto dokumentu, ber jako `done`:

- Armada funguje jako read-only souhrn vsech vlastnich len
- karta lena pridava leg do planneru
- klik v Armade nikdy nemeni aktivni leno hry
- planner umi jeden cil, max 10 legu, 1 aktivni plan na hrace a svet
- mezi dopady je vzdy min. 1 minuta
- planner ma confirmation krok pred ulozenim
- `validni koncept` nikdy nespousti utok sam o sobe
- aktivni serverovy plan ma prioritu nad lokalnim draftem
- aktivni plan se po ulozeni zobrazi jako potvrzeny / naplanovany
- planner umi `Vyplnit vse` pro `cavalry + ram + scout`
- planner umi automaticke srovnani casu dopredu i zpet
- planner umi zobrazit jeden posledni `completed_stub`
- pri failu existuje navrat zpet do konceptu
- planner commandy a eventy jsou pripraveny na budouci vazbu pres `plan_id`
- nova funkcionalita nepridava novy globalni polling ani neexpanduje hlavni `gameState`
