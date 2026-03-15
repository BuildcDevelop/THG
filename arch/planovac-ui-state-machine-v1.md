# Planovac v1 - UI state machine

Tento dokument navazuje na:

- `arch/planovac-api-spec-v1.md`
- `arch/planovac-budouci-nasazeni-koncept.md`

Cil:

- presne popsat UI rezimy planneru
- definovat prechody, guard podminky a akce
- omezit nejasne UX mezistavy

## 1. Hlavni stavy

Planner panel ma tyto stavy:

1. `draft_empty`
2. `draft_editing`
3. `confirmation`
4. `active_plan`
5. `active_plan_editing`
6. `needs_reconfirmation`
7. `failed_plan`
8. `completed_stub`

Poznamka:

- `confirmation` je UI krok, ne serverovy lifecycle stav

## 2. Stavova priorita po otevreni panelu

Po `GET /planner/open`:

1. pokud `activePlan.status = needs_reconfirmation` -> `needs_reconfirmation`
2. pokud `activePlan.status = failed` -> `failed_plan`
3. pokud `activePlan.status IN (scheduled, dispatching)` -> `active_plan`
4. pokud `activePlan = null` a existuje draft -> `draft_editing`
5. pokud `activePlan = null` a draft neexistuje -> `draft_empty`

`completed_stub` je doplnkovy read-only blok, ne primarni stav.

## 3. Prechody

### 3.1 Draft flow

- `draft_empty -> draft_editing`
  - trigger: pridani prvniho legu nebo obnova local draftu

- `draft_editing -> confirmation`
  - trigger: `Potvrdit plan`
  - guard:
    - `validate.status = ok|warning`
  - action:
    - ulozit posledni validate payload pro read-only review

- `draft_editing -> draft_editing`
  - trigger: `Potvrdit plan`
  - guard:
    - `validate.status = blocked`
  - action:
    - zobrazit blocked issue list

- `confirmation -> draft_editing`
  - trigger: `Zpet do konceptu`

- `confirmation -> active_plan`
  - trigger: `Ulozit plan`
  - guard:
    - create success
  - action:
    - refetch `planner/open`
    - clear local draft

### 3.2 Active plan flow

- `active_plan -> active_plan_editing`
  - trigger: `Upravit plan`
  - guard:
    - status `scheduled|needs_reconfirmation`
    - lead time validni

- `active_plan_editing -> active_plan`
  - trigger: `Ulozit upravy`
  - guard:
    - patch success
  - action:
    - refetch `planner/open`

- `active_plan_editing -> active_plan`
  - trigger: `Ulozit upravy`
  - guard:
    - `PLANNER_LEAD_TIME_EXPIRED`
  - action:
    - zobrazit fail message
    - vratit serverovou verzi

- `active_plan -> draft_empty`
  - trigger: `Zrusit plan`
  - guard:
    - cancel success

- `active_plan -> completed_stub`
  - trigger:
    - plan status prejde na `completed`

### 3.3 Reconfirmation / fail flow

- `needs_reconfirmation -> active_plan`
  - trigger: `Potvrdit i tak`
  - guard:
    - reconfirm success

- `needs_reconfirmation -> draft_editing`
  - trigger: `Zpet do konceptu`
  - action:
    - prenest reconfirm duvody do konceptu

- `failed_plan -> draft_editing`
  - trigger: `Zpet do konceptu`
  - action:
    - prenest fail duvody per-leg do konceptu

## 4. Guard pravidla

### 4.1 Editace

Editace je povolena jen pro:

- `scheduled`
- `needs_reconfirmation`

Editace neni povolena pro:

- `dispatching`
- `completed`
- `failed`
- `canceled`

### 4.2 Lead time

- lead time se vyhodnocuje server-side
- FE muze predbezne varovat, ale finalni autorita je backend

### 4.3 Aktivni plan vs koncept

- pokud existuje aktivni plan, uzivatel neni defaultne v konceptu
- koncept je pristupny jen explicitni akci
- local koncept nesmi prepsat aktivni serverovy plan bez patch flow

## 5. UI komponenty podle stavu

### `draft_empty`

- empty placeholder
- CTA: `Pridat leg z armady`
- CTA: `Obnovit posledni koncept` (pokud existuje)

### `draft_editing`

- target picker
- leg list
- auto-align controls
- `Vyplnit vse`
- summary blok
- CTA: `Potvrdit plan`

### `confirmation`

- read-only souhrn validated planu
- issue list (`warning`/`blocked`)
- CTA:
  - `Ulozit plan`
  - `Zpet do konceptu`

### `active_plan`

- karta aktivniho planu
- countdown + impact window
- per-leg status
- progress v `dispatching`
- CTA:
  - `Upravit plan` (jen kdyz dovoleno)
  - `Zrusit plan` (jen kdyz dovoleno)

### `needs_reconfirmation`

- diff stareho vs noveho target state
- consequences blok
- CTA:
  - `Potvrdit i tak`
  - `Zpet do konceptu`

### `failed_plan`

- fail summary + per-leg duvody
- CTA:
  - `Zpet do konceptu`

### `completed_stub`

- compact readonly karta
- posledni dokonceny plan
- bez archivu

## 6. UX zpravy (minimal)

- create success:
  - `Plan potvrzen. Prvni odeslani za X min.`
- patch success:
  - `Plan byl aktualizovan.`
- lead time expired:
  - `Lead time vyprsel. Plan uz nelze upravit.`
- reconfirm warning:
  - `Cil se zmenil. Pred pokracovanim potvrdit s nasledky.`
- fail -> draft:
  - `Posledni pokus selhal. Duvody zustaly v konceptu.`

## 7. `completed_stub` pravidla

- zobrazuje se nanejvys jeden na hrace+svet
- pri dokonceni noveho planu se stary prepise
- stub je read-only, bez detailni historie

## 8. Metriky pro QA

Sledovat minimalne:

- pocet requestu pri otevrenem planner panelu
- pocet requestu pri skrytem planner panelu
- cas od `Ulozit plan` do zobrazeni `active_plan`
- procento failed prechodu kvuli lead time/revision conflict
