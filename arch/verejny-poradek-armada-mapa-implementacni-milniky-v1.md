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
- ikona je zamerne o neco vetsi nez okoli, aby se neztracela v headeru,
- `100 %` zobrazi jen ikonu,
- `<100 %` zobrazi ikonu + procento,
- `49-30 %` vizualni varovani,
- `29-0 %` silnejsi varovani,
- tooltip je kratky, tematicky a popisuje:
  - co ikona znamena
  - aktualni procento
  - zda bezi debuff nebo je stav bez postihu.

### 2.2 Armada vsech len

- Goal: rychly read-only prehled vsech vlastnich len se zamenenim dnesni akcni `Spravy vsech len` za kompakni list.
- Authoritative state: server-side read model po lenu.
- Fetch model: samostatny endpoint pouze pri otevrenem panelu `Armada vsech len`.
- Affected panels: nova podstranka pod `Armada`.
- Regression risk: pridani velkeho pole do hlavniho game snapshotu, background polling skryteho panelu, drazsi render pres tabulkovy layout.
- Before metrics: payload size hlavniho snapshotu, request count pri zavrenem panelu, mount/rerender cost armadniho panelu.
- Expected impact: lepsi hracsky prehled bez dopadu na mapovy renderer.

UI contract:

- panel je read-only, bez build/recruit akci,
- vhodny na mensi obrazovky, bez samostatnych akcnych radku,
- zadne tvrde tabulkove mrizky,
- zadne tezke ramecky,
- roster styl s horizontalnimi pruhy, malymi ikonami a jemnymi separatory,
- jednotky jsou zobrazene do radku podobne jako v detailu lena z mapy, ale s mensimi minimalistickymi ikonami,
- opevneni a brana se zobrazuji jen jako ikona + uroven,
- `Otevrit profil lena` zustava jako kompaktni inline ikona v hlavicce radku,
- tooltip `Posadka` se znovu pouzije beze zmen kontraktu,
- `Aktualni rekrut` se v tomto listu nezobrazuje.

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
- `statusBadges`

Poznamka:

- pro prvni read-only verzi preferovat reuse existujiciho `army/overview` payloadu,
- dalsi pole nepridavat, pokud nejsou potreba primo pro render kompaktniho listu.

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
- premena dnesni `Spravy vsech len` na read-only prehledovy list,
- roster-like layout bez tabulkoveho vzhledu.

Deliverables:

- panel prejmenovany a zretelne komunikovany jako prehled, ne jako akcni sprava,
- radky/pruhy:
  - nazev lena
  - souradnice
  - inline ikona pro otevreni profilu lena
  - jednotky a pocty v kompaktnim ikonovem radku
  - `Opevneni` jako ikona + `Lx`
  - `Brana` jako ikona + `Lx`
  - `Posadka`
- znovupouzity tooltip `Posadka`,
- zadny souhrn ani tooltip aktualniho rekrutu,
- quick open do detailu lena pres inline ikonu,
- nula requestu, kdyz panel neni aktivni.

Exit:

- panel je citelny i pri vetsim poctu len,
- render neni tabulkovy a neni DOM-tezky,
- i na mensim displeji nevznika samostatny radek jen pro akce.

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

## 13. Milnik K - Research plati z aktivniho lena + zlato/mince v logistice

Scope:

- zpevnit kontrakt `research pays from active village`,
- umoznit presun `gold` a `coins` mezi vlastnimi leny pres stavajici logistiku,
- zachovat jeden ekonomicky a auditni flow.

Deliverables:

- research panel vzdy pracuje s explicitnim `activeVillageId`,
- research UI jasne ukazuje, ze projekt platis z aktualne vybraneho lena,
- manualni logistika v research panelu rozsiri payload o:
  - `wood`
  - `stone`
  - `iron`
  - `gold`
  - `coins`
- znovupouzije se stavajici route `POST /api/v1/market/logistics/send`,
- pokud logisticka trasa uklada payload do DB, schema a tick delivery/refund flow se rozsiri konzistentne i pro `gold/coins`.

Guardrails:

- nezavadet druhy transfer system,
- nemichat regionalni research progres s lokalni ekonomikou,
- neexpandovat hlavni `state snapshot`.

Exit:

- projekt lze spustit z aktivne vybraneho vlastniho lena bez fallback mateni,
- hrac umi preskladat mince a zlato mezi vlastnimi leny bez noveho subsystemu.

## 14. Milnik L - Mapovy ownership + diplomacy contract

Scope:

- sjednotit barevne rozliseni mapy a minimapy pod jeden serverovy kontrakt,
- oddelit `ownership` a `diplomacy`,
- sjednotit command gating pro mapu, dialog armady a planner.

Deliverables:

- server vraci autoritativni mapove rozliseni odvozene z:
  - vlastnictvi hrace
  - typu lena
  - diplomacie mezi Kralovstvimi
- klient prestane vyrabet `DoN/opponent/enemy` heuristikou z `note` nebo newbie ochrany,
- `DoN` a `spojenec` vznikaji pouze z diplomacie Kralovstvi,
- `royal` je explicitni serverova kategorie, ne mrtva klientska legenda,
- command permissions se nebudou odvozovat z barev ad hoc.
- soucasti milestone je i explicitni permission matrix pro:
  - `move`
  - `support`
  - `attack`

Pozadovany kontrakt:

- `active` = aktualne vybrane vlastni leno
- `own` = ostatni vlastni lena
- `royal` = kralovska lena
- `allied` = diplomacie `ally`
- `don` = diplomacie `non-aggression`
- `opponent` = neutralni cizi hrac bez specialni diplomacie
- `enemy` = aktivni valecny stav mezi Kralovstvimi

Permission matrix k finalnimu potvrzeni v acceptance:

- `move` = pouze mezi vlastnimi leny
- `support` = povolena na vlastni, royal, allied, don, opponent i enemy cile; nikdy se neblokuje jen kvuli barve vztahu
- `attack` = povolen na royal, allied, don, opponent i enemy cile; barva vztahu neni sama o sobe blokace
- `self-attack` = specialni podmnozina `attack` s vlastnim kontraktem

Finalni decision note pro `jiny hrac ve stejnem Kralovstvi`:

- nema samostatnou legendovou barvu v prvni verzi, aby se nekomplikoval mapovy kontrakt
- vizualne se radi do `opponent`
- server o nem ale stale vraci explicitni informaci jako o cizim hraci ve stejnem Kralovstvi pro tooltip, army dialog a planner
- `move` = nepovolen
- `support` = povolen
- `attack` = povolen
- tento stav se nikdy nesmi sloucit s `own`, `allied` ani `don`
- stejne Kralovstvi samo o sobe nevytvari diplomatickou barvu; tu vytvari jen diplomaticky stav mezi Kralovstvimi

Bezpecnostni poznamka:

- pokud se povoli `self-attack`, musi byt explicitne rozhodnuto, zda plati:
  - bez lootu
  - bez dobyti
  - bez retaliation flagu
  - bez war/rank side efektu
- bez tohoto sub-kontraktu se self-attack nema shipovat jen odblokovanim validace.

Exit:

- mapa, minimapa, army target dialog a planner ctou stejnou pravdu,
- hrac nikdy neuvidi ciziho hrace jako `moje leno` jen proto, ze je ve stejnem Kralovstvi.

## 15. Milnik M - Recruit queue UI completion

Scope:

- dokoncit frontend pro reorder naborove fronty,
- opravit copy a UX kolem sekvencniho casovani.

Deliverables:

- preusporadani queued polozek pres sipky nebo drag/drop,
- aktivne probihaici polozka zustava neprenositelna,
- UI vola existujici `POST /api/v1/units/recruitments/reorder`,
- texty a tooltipy odpovidaji realne sekvencni backend timeline,
- zachova se stavajici cancel flow.

Guardrails:

- zadny novy polling,
- poradim a ETA zustavaji autoritativni na serveru.

Exit:

- hrac vidi poradi, ETA a umi queued polozky prehazovat primo v naboru,
- UI nelze splest s paralelnim zpracovanim.

## 16. Milnik N - Combat ranky podle novych pravidel

Scope:

- upravit serverove agregace `attacker/defender/supporter` bez klientskych prepocitu.

Deliverables:

- `attackerScore = defenderLosses + attackerLosses`,
- `defenderScore = defenderLosses + attackerLosses`,
- `supporterScore = attackerLosses + supportLosses`,
- centralni zmena v jednom serverovem agregacnim miste,
- bez derivace ve frontendu.

Exit:

- zebricek a profilove ranky ctou stejnou agregaci,
- pravidla odpovidaji novemu produktovemu zadani.

## 17. Milnik O - Loot model + zebricek uloupenych surovin

Scope:

- rozsirit skutecny battle loot model o `gold` a `coins`,
- pridat novy player-only zebricek uloupenych surovin.

Deliverables:

- battle payload a reporty eviduji:
  - `wood`
  - `stone`
  - `iron`
  - `gold`
  - `coins`
- return movement carry model je s loot payloadem konzistentni,
- nova leaderboard stranka nebo tab pro `uloupene suroviny`,
- bez kingdom agregace nebo kingdom verze tehoz zebricku.

Guardrails:

- nejdriv rozsirit zdroj pravdy v combat/report modelu,
- az potom pridat novy zebricek.

Exit:

- hrac vidi ve zprave i zebricku stejne loot hodnoty,
- do zebricku vstupuji vsechny uloupene suroviny vcetne zlata a minci.

## 18. Milnik P - Verejny poradek UI polish

Scope:

- doladit uz nasazenou badge a tooltip bez zmen backend state modelu.

Deliverables:

- badge zustava vedle `Aktivniho lena`,
- ikona je vetsi a citelnejsi,
- tooltip potvrzuje:
  - nazev ikony/systemu
  - aktualni procento
  - zda bezi debuff nebo ne,
- zachovat stavajici fetch model bez noveho pollingu.

Exit:

- verejny poradek je srozumitelny i bez cteni detailu jinde ve hre.

## 19. Doporucene poradi realizace

1. Milnik A - release contract
2. Milnik B - uzavreni 0.1.14
3. Milnik C - verejny poradek backend
4. Milnik D - verejny poradek UI
5. Milnik E - armada overview backend
6. Milnik F - armada overview UI
7. Milnik G - recruit queue a support rebase
8. Milnik M - recruit queue UI completion
9. Milnik K - research aktivni leno + logistika zlata/minci
10. Milnik L - mapovy ownership + diplomacy contract
11. Milnik H - combat a report contract
12. Milnik N - combat ranky
13. Milnik O - loot model + loot leaderboard
14. Milnik P - verejny poradek UI polish
15. Milnik J - technicky zaklad a QA
16. Milnik I - canvas marker layer

Poznamka:

- `canvas` je zamerne az na konci teto vlny, protoze je to renderer upgrade, ne nahrada za cistejsi data flow.
- `Milnik L` ma prednost pred finalnim doladenim barev na klientu, protoze klient nesmi dal domyslet vztahy po svem.

## 20. Dalsi krok pred implementaci

Pred samotnym psanim kodu vytvorit tri navazujici specifikace:

1. `API spec`
- `public-order summary`
- `army villages overview`
- `support rebase`
- `world-map ownership + diplomacy`
- `research source village`
- `market logistics gold/coins`
- `loot leaderboard`

2. `DB spec`
- `player_world_governance`
- recruit queue timeline schema
- event/audit schema pro combat/report retention
- rozsireni `logistics_routes` pro `gold/coins`, pokud zustanou soucasti route persistence
- loot carry schema pro `gold/coins`

3. `Acceptance scenare`
- verejny poradek thresholdy
- badge/tooltip chovani
- armada overview loading lifecycle
- recruit queue reorder/cancel
- support rebase validace
- scout/caravan/combat visibility
- mapove rozliseni `active/own/royal/allied/don/opponent/enemy`
- edge case `jiny hrac ve stejnem Kralovstvi` = render jako `opponent`, `support/attack` povoleny, `move` blokovany, nikdy ne `own`
- research placeny z aktivniho lena
- logistika zlata/minci mezi vlastnimi leny
- player-only zebricek uloupenych surovin

Toto je dalsi krok pred implementaci, protoze bez techto tri dokumentu by se zacaly michat UI rozhodnuti, backend kontrakty a gameplay pravidla.
