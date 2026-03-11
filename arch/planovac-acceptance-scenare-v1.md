# Planovac v1 - acceptance scenare

Tento dokument navazuje na:

- `arch/planovac-api-spec-v1.md`
- `arch/planovac-ui-state-machine-v1.md`
- `arch/armada-a-planovac-v1-roadmap.md`

Cil:

- konkretni end-to-end scenare pro implementaci a QA
- overit flow `draft -> confirmation -> active_plan -> completed`

## 1. Scenare

### PL-001 Vytvoreni planu (happy path)

Precondition:

- hrac nema aktivni plan
- ma aspon 2 vlastni lena
- existuje validni target (hrac s jednim lenem)

Kroky:

1. otevrit planner
2. pridat 2 legy
3. vyplnit jednotky
4. dat `Potvrdit plan`
5. dat `Ulozit plan`

Expected:

- `validate` vrati `status=ok`
- `create` vrati `201`
- planner se prepne do `active_plan`
- karta ukazuje countdown do prvniho odeslani

### PL-002 `validni koncept` nic neposila bez potvrzeni

Kroky:

1. pripraveny validni draft
2. nekliknout `Potvrdit plan`
3. opustit panel

Expected:

- nevznikne serverovy plan
- nebezi scheduler dispatch
- po navratu je stale jen lokalni draft

### PL-003 Confirmation krok je read-only

Kroky:

1. z `draft_editing` kliknout `Potvrdit plan`

Expected:

- planner je v `confirmation`
- legy ani jednotky nejsou primo editovatelne
- akce jsou jen `Ulozit plan` a `Zpet do konceptu`

### PL-004 Blocked validace

Kroky:

1. vytvorit duplicitni origin leg
2. kliknout `Potvrdit plan`

Expected:

- `validate.status=blocked`
- zustat v `draft_editing`
- blocked issue je viditelny globalne i per-leg

### PL-005 Warning validace

Precondition:

- target zpusobi warning (napr. reconfirm-like business warning)

Expected:

- `validate.status=warning`
- planner prepne do `confirmation`
- `Ulozit plan` je dostupne jen jako explicitni pokracovani

### PL-006 Aktivni plan ma prioritu nad draftem

Precondition:

- existuje aktivni serverovy plan
- v local storage je stary draft

Expected:

- planner otevre `active_plan`
- draft se defaultne nezobrazi

### PL-007 Editace aktivniho planu v lead time

Precondition:

- status `scheduled`
- lead time stale validni

Kroky:

1. `Upravit plan`
2. zmenit casy/jednotky
3. `Ulozit upravy`

Expected:

- `PATCH` success
- revision +1
- planner zobrazi aktualizovany `active_plan`

### PL-008 Lead time vyprsi behem editace

Kroky:

1. otevrit editaci aktivniho planu
2. pockat za hranici lead time
3. ulozit

Expected:

- `PATCH` vrati `PLANNER_LEAD_TIME_EXPIRED`
- planner se vrati na posledni serverovou verzi
- zobrazi se jasna fail hlaska

### PL-009 Revision conflict

Precondition:

- stejny plan otevren ve dvou klientech

Kroky:

1. klient A ulozi upravy
2. klient B uklada stale se starou revision

Expected:

- klient B dostane `PLANNER_REVISION_CONFLICT`
- klient B po refresh vidi novou serverovou verzi

### PL-010 Cancel aktivniho planu

Precondition:

- status `scheduled`

Kroky:

1. kliknout `Zrusit plan`

Expected:

- `cancel` success
- `activePlan=null`
- planner prejde do `draft_empty` nebo obnoveneho draftu

### PL-011 Needs reconfirmation

Precondition:

- target zmeni owner nebo kingdom

Expected:

- plan status `needs_reconfirmation`
- UI ukaze diff stary vs novy stav
- akce:
  - `Potvrdit i tak`
  - `Zpet do konceptu`

### PL-012 Reconfirm success

Kroky:

1. ve stavu `needs_reconfirmation` kliknout `Potvrdit i tak`

Expected:

- `reconfirm` success
- status zpet `scheduled`
- revision +1

### PL-013 Reconfirm -> zpet do konceptu

Kroky:

1. ve stavu `needs_reconfirmation` kliknout `Zpet do konceptu`

Expected:

- otevre se `draft_editing`
- duvody reconfirmation zustanou viditelne v konceptu

### PL-014 `Vyplnit vse` jednotky

Kroky:

1. v legu kliknout `Vyplnit vse`

Expected:

- naplni se jen:
  - `cavalry`
  - `ram`
  - `scout`
- ostatni unit typy zustanou nedotcene

### PL-015 Auto-align dopredu

Kroky:

1. nastavit referencni prvni dopad
2. `Srovnat od prvniho legu dopredu`

Expected:

- impact casy jsou striktne rostouci
- mezera odpovida zadanemu intervalu

### PL-016 Auto-align zpet

Kroky:

1. nastavit referencni posledni dopad
2. `Srovnat od posledniho legu zpet`

Expected:

- impact casy zustanou validni
- posledni leg zustane fixni

### PL-017 Dispatch progress

Precondition:

- plan status `dispatching`

Expected:

- karta ukazuje `odeslano N / total`
- progress procento odpovida sent leg count

### PL-018 `completed` semantika

Expected:

- `completed` nastane po odeslani vsech legu
- neceka se na vysledky boju

### PL-019 Last completed stub

Kroky:

1. dokoncit plan A
2. dokoncit plan B

Expected:

- zobrazi se jen posledni `completed_stub` (plan B)
- plan A stub uz neni viditelny

### PL-020 All-or-nothing dispatch fail

Precondition:

- jeden leg failne pre-flight

Expected:

- nic se neodesle
- plan status `failed`
- per-leg fail duvody jsou ulozene
- uzivatel muze `Zpet do konceptu`

### PL-021 Planner endpointy a auth

Expected:

- bez session -> `401 AUTH_REQUIRED`
- session/username mismatch -> `403 SESSION_USERNAME_MISMATCH`

### PL-022 Plan events feed

Kroky:

1. otevrit `GET /planner/plans/:planId/events`

Expected:

- feed vraci eventy s:
  - `planId`
  - `planLegId`
  - `eventType`
  - `createdAt`

## 2. Ne-funkcni guardrails

Overit:

- planner nepridava novy globalni polling loop
- skryty planner nedela requesty
- planner data nejdou do hlavniho `gameState` snapshotu

## 3. Test prioritizace

P0:

- PL-001, PL-002, PL-003, PL-004, PL-006, PL-008, PL-010, PL-011, PL-020

P1:

- PL-005, PL-007, PL-009, PL-012, PL-013, PL-014, PL-015, PL-016

P2:

- PL-017, PL-018, PL-019, PL-021, PL-022
