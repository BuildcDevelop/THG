# Verejny poradek, Armada vsech len a mapa - implementacni milniky v1

Tento dokument prevadi navrh do realizovatelnych fazi pred samotnou implementaci.

Navazuje na:

- `arch/optimalizace-a-vykonove-guardrails.md`
- `arch/chat-changelog.md`

## 1. Cile

Hlavni cile:

- pridat `Verejny poradek` jako world-scoped mechaniku bez znecisteni modelu len,
- pridat novou stranku `Armada vsech len` jako lehky prehledovy read model,
- dokoncit nedonasazene casti `0.1.14`,
- srovnat release contract a observability,
- pripravit mapu na dlouhodoby prechod marker vrstvy na `canvas`,
- neporusit guardrails pro mapu, polling, snapshot a backend timing.

## 2. Feature contracts

### 2.1 Verejny poradek

- Goal: hrac okamzite vidi globalni stav rise a aktivni debuffy bez otevirani vedlejsi stranky.
- Authoritative state: server, world-scoped player state.
- Fetch model: maly summary payload pri nacteni hry; aktualizace pouze s beznym game refresh, bez noveho globalniho pollingu.
- Affected panels: horni lista vedle aktivniho lena, recruit gating, conquest reporty.
- Regression risk: zneuziti existujici `loyalty`, nafouknuti hlavniho snapshotu, nahodne write side efekty pri cteni.
- Before metrics: velikost hlavniho snapshotu, pocet requestu pri otevrene hre, rerender scope headeru.
- Expected impact: vyssi citelnost globalniho debuffu bez navyseni mapoveho nebo paneloveho vykreslovani.

UI contract:

- badge je hned vedle aktivniho lena,
- ikona je viditelna vzdy,
- `100 %` zobrazi jen ikonu,
- `<100 %` zobrazi ikonu + procento,
- `49-30 %` vizualni varovani,
- `29-0 %` silnejsi varovani,
- tooltip je kratky, tematicky a popisuje aktualni efekt.

### 2.2 Armada vsech len

- Goal: rychly prehled armady, opevneni, brany, posadky a aktualniho rekrutu ve vsech hracovych lenech.
- Authoritative state: server-side read model po lenu.
- Fetch model: samostatny endpoint pouze pri otevrenem panelu `Armada vsech len`.
- Affected panels: nova podstranka pod `Armada`.
- Regression risk: pridani velkeho pole do hlavniho game snapshotu, background polling skryteho panelu, drazsi render pres tabulkovy layout.
- Before metrics: payload size hlavniho snapshotu, request count pri zavrenem panelu, mount/rerender cost armadniho panelu.
- Expected impact: lepsi hracsky prehled bez dopadu na mapovy renderer.

UI contract:

- zadne tvrde tabulkove mrizky,
- zadne tezke ramecky,
- roster styl s horizontálními pruhy, ikonami a jemnymi separatoru,
- tooltip `Posadka` se znovu pouzije beze zmen kontraktu,
- tooltip `Aktualni rekrut` bude obdobne kratky a informacni.

### 2.3 Canvas marker layer

- Goal: snizit DOM tlak mapy pri velkem poctu len a overlayu.
- Authoritative state: stejna mapova data jako dnes; meni se jen renderer.
- Fetch model: beze zmen, zadne nove requesty.
- Affected panels: pouze hlavni mapa a minimapa, pokud se ji zmena dotkne.
- Regression risk: rozbite hit-testing, selection, hover, pin overlay a vizualni nekonzistence.
- Before metrics: FPS pri pan/zoom, pocet DOM node, rerender scope marker layer.
- Expected impact: levnejsi pan/zoom, mensi React tlak, stabilnejsi vykon pri velkem poctu markeru.

Podminka:

- `canvas` az po oddeleni hover/pin overlay od marker vrstvy a po doocisteni datovych toku.

## 3. Milnik A - Release contract a observability

Scope:

- sjednotit `buildId` a `versionLabel` mezi frontendem a backendem,
- rozhodnout jeden produkcni API path,
- doplnit post-deploy smoke check,
- odstranit matoucí fallbacky verzi.

Deliverables:

- stejna release identita v `package.json`, `src/version.ts`, `server/index.js`,
- finalni rozhodnuti:
  - bud `VITE_API_BASE` primo na backend,
  - nebo Netlify `/api` proxy,
  - ale ne oboje bez jasneho contractu,
- skript `release doctor`,
- smoke check:
  - `health`
  - login
  - state snapshot
  - research list
  - avatar upload path

Exit:

- frontend i backend hlasi stejny build,
- release jde overit bez rucni forenzni analyzy,
- deploy jasne ukaze, ktery commit skutecne bezi.

## 4. Milnik B - Uzavreni 0.1.14

Scope:

- backend rollout jiz hotovych, ale nenasazenych veci,
- audit around reports a activity,
- samostatny UI pass mapovych karet.

Deliverables:

- research ceny a `Rytirsky stav`,
- knight cost/time/research gate,
- `support any village`,
- avatar storage fix,
- pravidlo:
  - `battle report` = immutable detail,
  - `activity` = inbox reference,
- samostatne doladeni clippingu a typografie mapovych karet.

Exit:

- produkce odpovida tomu, co je v `main`,
- report nezmizi s inboxovou reference,
- mapove karty maji konzistentni velikost a clipping.

## 5. Milnik C - Verejny poradek backend

Scope:

- navrhnout a ulozit world-scoped player state,
- pridat conquest penalty a hodinovou regeneraci,
- odvodit gameplay efekty bez hromadnych zapisu do len.

DB navrh:

- tabulka typu `player_world_governance`
- sloupce:
  - `player_id`
  - `world_id`
  - `public_order`
  - `last_regenerated_at`
  - `updated_at`

Pravidla:

- novy hrac zacina na `100`,
- dobyti ciziho lena snizi stav o nahodnych `1-25`,
- stav nikdy neklesne pod `0`,
- regenerace `+2 % / hod`,
- efekty:
  - `50-100`: bez postihu
  - `30-49`: blok rytire
  - `0-29`: `-50 %` rychlost recruit/build/production

Exit:

- gameplay umi precist `publicOrder` a `derivedDebuff`,
- neni pouzita `loyalty`,
- read endpointy nic neprepocitavaji bokem pri cteni.

## 6. Milnik D - Verejny poradek UI

Scope:

- badge vedle aktivniho lena,
- tooltip,
- contextual gating.

Deliverables:

- header badge s ikonou,
- procento jen pod `100`,
- vizualni stav:
  - neutralni
  - warning
  - critical
- tooltip s kratkym flavor textem a konkretni mechanikou,
- blokacni hlaska u rekrutu rytire,
- conquest report line s dopadem na poradek.

Exit:

- hrac vidi globalni stav bez otevirani vedlejsiho panelu,
- debuff je citelny z UI bez studovani detailu.

## 7. Milnik E - Armada vsech len backend

Scope:

- lehky per-village overview endpoint,
- zadne napojeni na hlavni snapshot.

Preferovana cesta:

- rozsirit existujici `GET /api/v1/army/overview`
- novy endpoint vytvaret jen pokud by doslo k nechtenemu contract creep nebo kolizi s planner flow

Payload per village:

- `villageId`
- `name`
- `coords`
- `fortificationLevel`
- `gateLevel`
- `unitsSummary`
- `garrisonSummary`
- `recruitSummary`
- `statusBadges`

Guardrails:

- endpoint nesmi spoustet tick,
- vraci jen data, ktera panel skutecne zobrazi,
- dotaz musi byt omezen na hracova lena.

Exit:

- overview se da nacist bez nafouknuti `state snapshot`,
- query scope je uzky a indexovatelny.

## 8. Milnik F - Armada vsech len UI

Scope:

- nova podstranka pod `Armada`,
- roster-like layout bez tabulkoveho vzhledu.

Deliverables:

- `Armada vsech len` panel,
- radky/pruhy:
  - nazev lena
  - souradnice
  - jednotky a pocty
  - `Opevneni Lx`
  - `Brana Lx`
  - `Posadka`
  - `Aktualni rekrut`
- znovupouzity tooltip `Posadka`,
- novy tooltip `Aktualni rekrut`,
- quick open do detailu lena,
- nula requestu, kdyz panel neni aktivni.

Exit:

- panel je citelny i pri vetsim poctu len,
- render neni tabulkovy a neni DOM-tezky.

## 9. Milnik G - Recruit queue a support rebase

Scope:

- recruit prevest na skutecnou frontu,
- pridat explicitni command pro zmenu stationed support na nove domovske leno.

Recruit fronta:

- `queue_index`
- `started_at`
- `finish_at`
- `rebalanceRecruitmentQueueTimeline(villageId)`

Support rebase endpoint:

- `POST /api/v1/army/support/:movementId/rebase`

Validace:

- cilove leno patri stejnemu hraci,
- jde o stationed support,
- obytna ctvrt a volna populace to dovoli.

Efekt:

- jednotky se prepisou do ciloveho lena jako vlastni,
- zmeni se jejich domovske leno,
- akce se auditovatelne uzavre.

Exit:

- recruit se chova jako budovaci fronta,
- support rebase je explicitni a auditovatelny.

## 10. Milnik H - Combat a report contract

Scope:

- rozdelit combat do cistych vrstev,
- sjednotit report shape,
- dodefinovat skauty a karavany.

Rozdeleni:

- `combat resolution`
- `visibility policy`
- `report serialization`

Pravidla:

- scouti prezivani resit oddelene proti scoutum,
- karavana prezije jen s ozbrojenym eskortem,
- scout neni bojovy garant karavany,
- report ma stale stejny shape a jen skryva neviditelne casti.

Deliverables:

- simulacni harness nad combat enginem,
- regression scenare pro visibility a escort rules.

Exit:

- reporty jsou konzistentni,
- combat logika se da ladit bez zavislosti na cele request flow.

## 11. Milnik I - Canvas marker layer

Scope:

- prevedeni marker vrstvy mapy z DOM-heavy renderu na `canvas`,
- React ponechat pro aktivni overlaye, tooltipy, selection, piny a detail karet.

Predpoklady:

- hover/pin overlay uz je oddelen od marker layer,
- visible settlements + overscan uz existuji a jsou stabilni,
- mapovy read model je oddelen od detailu vybraneho lena.

Deliverables:

- `canvas` renderer pro settlement markery,
- hit-testing pro klik a hover,
- zachovani existujiciho vyberu, pinu a overlayu,
- meritelne snizeni DOM node a render costu.

Co to prinasi:

- plynulejsi pan a zoom,
- mensi pressure na React,
- levnejsi zmeny hoveru,
- lepsi skalu pri hustsi mape.

Co to neresi:

- gameplay logiku,
- backend konzistenci,
- release/deploy problem.

Exit:

- funkce hry zustane stejna,
- zmeni se jen renderer markeru,
- vykon mapy je lepsi i pri velkem poctu len.

## 12. Milnik J - Technicky zaklad a QA

Scope:

- databazove migrace,
- release doctor,
- view-model testy,
- acceptance a mereni.

Deliverables:

- DB migrace framework,
- release doctor skript,
- view-model testy:
  - map card
  - village panel
  - battle report window
- acceptance pro:
  - verejny poradek
  - armada vsech len
  - recruit queue
  - support rebase
  - combat/report visibility

Exit:

- zmeny jsou auditovatelne,
- release je overitelny,
- logika ma regression coverage.

## 13. Doporucene poradi realizace

1. Milnik A - release contract
2. Milnik B - uzavreni 0.1.14
3. Milnik C - verejny poradek backend
4. Milnik D - verejny poradek UI
5. Milnik E - armada overview backend
6. Milnik F - armada overview UI
7. Milnik G - recruit queue a support rebase
8. Milnik H - combat a report contract
9. Milnik J - technicky zaklad a QA
10. Milnik I - canvas marker layer

Poznamka:

- `canvas` je zamerne az na konci teto vlny, protoze je to renderer upgrade, ne nahrada za cistejsi data flow.

## 14. Dalsi krok pred implementaci

Pred samotnym psanim kodu vytvorit tri navazujici specifikace:

1. `API spec`
- `public-order summary`
- `army villages overview`
- `support rebase`

2. `DB spec`
- `player_world_governance`
- recruit queue timeline schema
- event/audit schema pro combat/report retention

3. `Acceptance scenare`
- verejny poradek thresholdy
- badge/tooltip chovani
- armada overview loading lifecycle
- recruit queue reorder/cancel
- support rebase validace
- scout/caravan/combat visibility

Toto je dalsi krok pred implementaci, protoze bez techto tri dokumentu by se zacaly michat UI rozhodnuti, backend kontrakty a gameplay pravidla.
