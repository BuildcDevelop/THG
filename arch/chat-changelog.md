# Chat Changelog

Purpose: persistent archive of repository chats and outcomes.

Rule:

- After every chat, append a new entry.
- Do not delete or rewrite older entries unless the user explicitly asks for cleanup.
- Keep entries short, factual, and scoped to the actual work done in that chat.

Entry template:

## YYYY-MM-DD HH:MM | branch: <branch-name>

- Request: <what the user asked for>
- Summary: <what was explained, changed, or decided>
- Files: <comma-separated file list or "none">
- Verification: <tests/checks run, or "not run">
- Notes: <important follow-up, assumptions, or rule updates>

## 2026-03-10 11:05 | branch: feat/build-0.1.11

- Request: Explain what this project is about and set a permanent rule to keep a per-chat summary changelog in `arch`.
- Summary: Reviewed the repository purpose from `README.md`, confirmed the active branch, created this archive file, and added a permanent instruction in `AGENTS.md` so every future chat appends a history entry here.
- Files: AGENTS.md, arch/chat-changelog.md
- Verification: Confirmed current branch is `feat/build-0.1.11`; no tests were run because this change is documentation-only.
- Notes: Future chats should append new sections to this file instead of replacing existing content.

## 2026-03-10 23:17 | branch: feat/build-0.1.11

- Request: Implement the previously proposed CPU/RAM optimization changes on branch `feat/build-0.1.11`.
- Summary: Reduced frontend background work by removing the root one-second `GamePage` timer, stopping hidden panel polling, memoizing heavy city/army panels, and narrowing communication polling to active contexts. Preserved read-only behavior for `/api/v1/state` and `/api/v1/world-map` while keeping world-map versioned snapshots on the client, then updated the mint regression to match the new no-write-on-read contract.
- Files: server/gameService.js, src/api/gameApi.ts, src/components/CommunicationHub.tsx, src/pages/GamePage.tsx, tests/regression/game-rules.regression.test.mjs, tests/regression/game-rules.scenario.mjs, arch/chat-changelog.md
- Verification: `npm run build`; `npm run test:regression`
- Notes: World-map read models in this branch already use a cached versioned read model; the remaining long-term backend opportunity is to split shared world snapshot data from viewer-specific overlay invalidation.

## 2026-03-11 07:54 | branch: codex/feat/build-0.1.12

- Request: Create a new `0.1.12` branch from `feat/build-0.1.11`, switch to it, and implement the planned hybrid map zoom behavior.
- Summary: Created and switched to `codex/feat/build-0.1.12`. Implemented a hybrid zoom controller in `MapPanel`: kept local UI-first zoom state and debounced parent commits, replaced exponential target interpolation with RAF wheel-target easing from the earlier smooth model, and retuned wheel sensitivity/clamp to the earlier values.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build`
- Notes: Scope intentionally stays frontend-local; no backend, polling, tick, or read/write flow changes.

## 2026-03-11 07:58 | branch: codex/feat/build-0.1.12

- Request: Rename the working branch from `codex/feat/build-0.1.12` to `feat/build-0.1.12`.
- Summary: Checked the current branch and worktree state, but did not rename the branch because the active Codex environment requires branch creation and usage under the `codex/` prefix.
- Files: arch/chat-changelog.md
- Verification: `git branch --show-current`; `git status --short`
- Notes: The working changes remain on `codex/feat/build-0.1.12`.

## 2026-03-11 11:32 | branch: codex/feat/build-0.1.12

- Request: Explain whether the game would benefit from only reading data for currently visible in-game screens/panels, and describe how it works now.
- Summary: Inspected the current data-flow in `GamePage`, `CommunicationHub`, `App`, `gameApi`, and the server read-model. Confirmed that some flows are already panel-scoped or route-scoped (`/api/v1/world-map`, reports, activity, planner/army overview, communication summary/inbox), while the main `/api/v1/state` poll still loads a broad village snapshot regardless of which game subpanels are visible.
- Files: arch/chat-changelog.md
- Verification: Reviewed polling/fetch code in `src/pages/GamePage.tsx`, `src/components/CommunicationHub.tsx`, `src/App.tsx`, `src/api/gameApi.ts`, `server/index.js`, and `server/gameService.js`
- Notes: No gameplay or UI code changes were made in this chat.

## 2026-03-11 12:07 | branch: codex/feat/build-0.1.12

- Request: Do both follow-up tasks: propose a concrete `core + panel` breakup of `/api/v1/state` and audit which frontend panels still depend unnecessarily on the main payload.
- Summary: Mapped current panel rendering and data dependencies in `GamePage`, confirmed which panel families already use dedicated endpoints, identified the broad `/api/v1/state` domains that can move behind panel-scoped loaders, and noted that existing report/activity summary endpoints are available but currently not used in `GamePage` for cheap closed-panel badge updates.
- Files: arch/chat-changelog.md
- Verification: Reviewed panel switch/render paths and payload usage in `src/pages/GamePage.tsx`, endpoint definitions in `src/api/gameApi.ts`, and server-side state read-model construction in `server/index.js` and `server/gameService.js`
- Notes: No implementation changes were made in this chat; output is architectural guidance and dependency audit only.

## 2026-03-11 12:11 | branch: codex/feat/build-0.1.12

- Request: Continue only with the first follow-up point and provide a realistic optimization roadmap for the `core + panel` state split, with explicit caution around risky changes.
- Summary: Produced a staged roadmap focused on high-value, lower-risk read-model splits first: closed-panel summaries, then extracting leaderboard and kingdom data from the core snapshot, followed by research/market domains, and only later city/commands detail. Flagged risky areas such as over-fragmenting requests, command/economy staleness after mutations, and panel-local data divergence.
- Files: arch/chat-changelog.md
- Verification: Based on previously reviewed `GamePage`, API, and server read-model code plus the repository performance guardrails
- Notes: No code changes were made in this chat; output is an implementation plan only.

## 2026-03-11 08:33 | branch: codex/feat/build-0.1.12

- Request: Design how docked full-width panels could coexist with page switching so the player does not need to repin panels left/right just to navigate elsewhere.
- Summary: Reviewed the current dock and panel flow in `GamePage` and the related layout CSS. Confirmed the current blocker is the exclusivity rule where any `full` dock panel suppresses rendering of split-left/right dock slots, so newly opened dockable pages can exist in state without becoming visible. Proposed design directions for decoupling panel content switching from dock placement without implementing changes.
- Files: arch/chat-changelog.md
- Verification: `git branch --show-current`; inspected `src/pages/GamePage.tsx` and `src/App.css`; no tests run because this chat was design-only.
- Notes: Recommended next step is to choose a panel-state contract before changing layout behavior.

## 2026-03-11 08:48 | branch: codex/feat/build-0.1.12

- Request: Implement the full "center stage" dock model where clicking another page always shows visible content, with previous full panel parked in left/right dock tabs.
- Summary: Refactored panel docking behavior in `GamePage` so dockable panels open into center-stage `full` mode by default, previous full panel(s) are auto-parked back to split side based on their stored side, and side-tab activation promotes to center stage when a full center is active. Kept split-left/right as explicit compare mode and removed legacy normalization that forced city away from full mode.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build`
- Notes: No backend, polling contract, or tick/read-path changes; scope is panel-layout state flow and dock interaction behavior only.

## 2026-03-11 11:31 | branch: codex/feat/build-0.1.12

- Request: On Správa page, make "Správa vybraného léna" the first/default tab, and in that view reorder sections so recruitment is first, barracks queue second, and building management below.
- Summary: Updated `ArmyPanel` view defaults and tab order so `selectedVillage` is the initial active page when opening Správa. Reordered selected-village sections to render `Nábor jednotek` at top, `Fronta kasáren` directly under it, and `Správa staveb vybraného léna` after both.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build`
- Notes: Layout/content reorder only; no gameplay rule, backend, polling, or data-flow changes.

## 2026-03-11 09:20 | branch: codex/feat/build-0.1.12

- Request: Rebalance selected building max levels, capacities, and timing as a design-only proposal without implementing code changes.
- Summary: Proposed new max-level caps and per-level curves for Residential Quarter, Townhall, Workshop, Stable, Barracks, and Warehouse; preserved the already corrected integer production curves for resource buildings; and defined a global design rule to increase all building upgrade durations by 50 percent and all building costs by 10 percent.
- Files: arch/chat-changelog.md
- Verification: Design-only review against current economy/building baselines in `server/gameConfig.js`; no code changes or tests run.
- Notes: Unlock thresholds remain reachable under the new level caps, so no additional unlock redesign is required in this proposal.

## 2026-03-11 09:27 | branch: codex/feat/build-0.1.12

- Request: Format the current building rebalance proposal into a full design table with effects, unlocks, and adjusted base build cost/time.
- Summary: Consolidated the design-only building rebalance into a documentation-style table covering max levels, level effects, unlock thresholds, and globally adjusted base build cost/time values for all buildings.
- Files: arch/chat-changelog.md
- Verification: Design-only continuation based on the same reviewed economy/building baselines; no implementation or tests run.
- Notes: This turn only formalizes the proposed numbers for documentation and review.

## 2026-03-11 09:39 | branch: codex/feat/build-0.1.12

- Request: Prepare a clean migration proposal for the current building rebalance without implementing it.
- Summary: Defined a design-only migration approach for compressed building level ladders, including target mapping rules, overflow handling guidance for storage/population caps, and treatment of in-progress upgrades under the proposed rebalance.
- Files: arch/chat-changelog.md
- Verification: Design-only proposal derived from the active rebalance tables; no implementation or tests run.
- Notes: Intended as a migration spec for later implementation planning, not as a code change.

## 2026-03-11 09:47 | branch: codex/feat/build-0.1.12

- Request: Clarify whether each level of the Gold Mine currently uses the same build time.
- Summary: Reviewed the live upgrade-duration formula and confirmed Gold Mine upgrade time is not constant per level; it scales by current level and is additionally reduced by Townhall level.
- Files: arch/chat-changelog.md
- Verification: Inspected `server/gameConfig.js`; no code changes or tests run.
- Notes: Included concrete example durations to support the design discussion.

## 2026-03-11 10:02 | branch: codex/feat/build-0.1.12

- Request: Prepare an implementation-ready backend migration checklist for the current building rebalance.
- Summary: Reviewed the real backend storage and queue flow for buildings, resources, and upgrades, then prepared a concrete migration checklist aligned with the existing `app_meta` migration pattern and the active village economy/tick logic.
- Files: arch/chat-changelog.md
- Verification: Inspected `server/db.js`, `server/gameConfig.js`, and `server/gameService.js`; no implementation or tests run.
- Notes: Checklist is intended to drive later code changes, including level remaps, queue handling, overflow policy, and post-migration validation.

## 2026-03-11 09:23 | branch: codex/feat/build-0.1.12

- Request: Upravit panel surovin a tooltip rozložení, přidat hromadné ukončení stavební fronty, umožnit rušení konkrétních staveb, přidat změnu pořadí fronty (drag/drop + šipky) a vizuálně vylepšit UI fronty.
- Summary: Přidal jsem backend podporu pro hromadné zrušení celé stavební fronty a pro reorder položek fronty s přepočtem timeline, doplnil odpovídající frontend API volání a napojil je v `CityPanel`. Ve frontě jsou teď ovládací prvky pro ukončení celé fronty, přesuny položek nahoru/dolů i přetažením a jasně oddělené akce pro zrušení konkrétní karty vs. celé konkrétní budovy. U surovin jsem zúžil kartu „Suroviny v léně“ a v tooltipu přeuspořádal dvousloupcové pořadí na: vlevo dřevo/kámen/železo, vpravo zlato/mince/populace.
- Files: server/gameService.js, server/index.js, src/api/gameApi.ts, src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build`; `npm run test:regression`; `npm run lint` (selhává na existujících `react-hooks/set-state-in-effect` v `src/App.tsx` a `src/pages/GamePage.tsx` mimo rozsah této změny)
- Notes: Polling/fetch model se neměnil; nové akce běží pouze na explicitní uživatelské interakce a autoritativní pořadí fronty zůstává na backendu.

## 2026-03-11 11:17 | branch: codex/feat/build-0.1.12

- Request: Navrhnout balance statické obranné posádky v léně navázané na úroveň Radnice, s automatickou obnovou, vazbou na populaci a rolí counteru proti spamu levných jednotek.
- Summary: Prošel jsem aktuální herní baseline pro Town Hall, populace, recruit časy, staty ozbrojenců/lučištníků a existující obranné násobiče z opevnění, brány a nočního režimu. Na tomto základě jsem připravil design-only návrh posádky s odemčením od Radnice L5, umírněnou křivkou maximální kapacity, pozdějším odemykáním podílu lučištníků a s důrazem na to, aby obnova posádky používala stejné resource/population/recruit-time limity jako běžný nábor a nevznikla z toho free army.
- Files: arch/chat-changelog.md
- Verification: Design-only review proti aktuálním baseline v `server/gameConfig.js`, `server/gameService.js` a placeholder UI v `src/pages/GamePage.tsx`; bez implementace a bez testů.
- Notes: Hlavní balance riziko je stacking posádky s fortifikací, branou, lučištníky na hradbách a noční obranou, proto návrh drží konzervativní cap i refill pravidla.

## 2026-03-11 11:32 | branch: codex/feat/build-0.1.12

- Request: Doplnit grafické tooltippy k tlačítkům stavební fronty, přepnout stavové texty více na ikonky/čas, zvýraznit a přeusadit pořadové číslo karty, přesunout drag-handle nenápadně vlevo a přesunout text verze hry z horní lišty dolů na herní stránku.
- Summary: Ve stavební frontě jsem přidal custom cursor tooltip overlay pro akční prvky (včetně ukončení celé fronty), přepracoval kartu fronty na ikoničtější layout (stavová ikona, časové chips s ikonami, výrazný rank badge uprostřed výšky), přesunul drag-handle na levý nenápadný prvek a zredukoval textové věty. Verzi hry jsem odstranil z horní části u world-indicatoru a přesunul do patičky herního layoutu.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build`; `npm run test:regression`
- Notes: Polling/fetch model ani backend tick/read flow se neměnily; změna je čistě UI/UX vrstva panelu města.

## 2026-03-11 11:41 | branch: codex/feat/build-0.1.12

- Request: Analyzovat současný model populace a ověřit hlášený bug mizení jednotek z léna, zejména ve vztahu k vysílání armád na mise a návratům.
- Summary: Prošel jsem backend populaci, dispatch armád, návraty, support a cleanup logiku. Potvrdil jsem, že populace se dnes počítá jen z jednotek uložených přímo v tabulce `units` konkrétního léna, takže odeslání armády okamžitě uvolní populaci a neváže ji na původní léno po dobu mise. Zároveň jsem dohledal dvě cesty ztráty jednotek: explicitní rozpuštění části vracející se armády při overflow populace a samostatný silent cleanup domácích jednotek při economy syncu, který zapisuje do DB i v read-model flow.
- Files: arch/chat-changelog.md
- Verification: Statická analýza `server/gameService.js` a `server/gameConfig.js`; bez implementace a bez spuštění testů. Kontrola `tests/regression` neukázala coverage pro invariant „odeslané jednotky stále rezervují populaci“ ani pro silent cleanup při population overflow.
- Notes: Pokud se to bude opravovat, authoritative population model by měl zahrnout i jednotky v pohybu a stationnuté supporty podle domovského léna, jinak budou návraty a refill dál produkovat nekonzistence.

## 2026-03-11 11:49 | branch: codex/feat/build-0.1.12

- Request: Připravit implementační návrh na opravu populace a nový návrh posádky s fixní rezervací 300 obyvatel, bez nákladů na suroviny při obnově.
- Summary: Připravil jsem design-first implementační návrh, který nejdřív nahrazuje současný population model jednotným ledgerem pro domácí, vyslané a stationnuté jednotky podle domovského léna a teprve na něj vrství posádku jako samostatný obranný systém. Návrh počítá s fixní rezervou 300 populace pro posádku od vytvoření léna, s odděleným garrison stavem mimo běžnou tabulku `units`, s paralelní bezsurovinovou obnovou a s doporučeným offsetem kapacity, aby rezerva 300 nerozbila early-game osady s dnešní základní kapacitou 220.
- Files: arch/chat-changelog.md
- Verification: Design-only navázání na předchozí analýzu `server/gameService.js`, `server/gameConfig.js` a UI textů v `src/pages/GamePage.tsx`; bez implementace a bez testů.
- Notes: Klíčové rozhodnutí návrhu je oddělit `physical location` jednotek od `population reservation village`, jinak se bug s uvolněním populace po dispatchi vrátí i s novou posádkou.

## 2026-03-11 11:46 | branch: codex/feat/build-0.1.12

- Request: Přesunout text verze hry pod levý dock a držet ho po levé straně centrovaně, protože aktuálně není vidět.
- Summary: Odstranil jsem verzi z globální patičky herního layoutu a přesunul ji přímo do `central-panel-dock` jako `dock-version-note` pod levou polovinu docku. Přidal jsem styly pro pevné umístění pod levý dock, centrování v levé části a kompatibilitu s font-scale + dark-medieval skin.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build`
- Notes: Změna je čistě prezentační (UI pozice textu verze), bez zásahu do backendu nebo datových toků.

## 2026-03-12 09:53 | branch: codex/feat/build-0.1.12

- Request: Analyzovat současné docky a práci s panely a vytáhnout možnosti zlepšení v mechanice, bezpečnosti, kvalitě kódu a šetření dat včetně rizik a chybějících částí.
- Summary: Prošel jsem lifecycle panelů v `GamePage`, perzistenci layoutu do `localStorage`, dock/tab mechaniku, drag/resize workflow, polling a související server route pořadí. Review identifikovalo hlavně tři oblasti: nechráněný `/api/v1/state` endpoint mimo auth middleware, world-agnostic perzistenci panel layoutu pod pouhým username a monolitický polling/render model, který drží celý dock systém v jednom velkém React hot path.
- Files: src/pages/GamePage.tsx, src/api/gameApi.ts, src/App.css, server/index.js, arch/chat-changelog.md
- Verification: Statická analýza přes čtení konkrétních úseků souborů a line-level cross-check; bez implementace a bez spuštění testů.
- Notes: Pro docky už jsou pozitivní guardrails na map/reports/activity pollingu a drag preview přes RAF, ale další rozvoj by měl začít oddělením auth, world scoping perzistence a panel-scoped data kontraktů.

## 2026-03-12 10:25 | branch: codex/feat/build-0.1.12

- Request: Vysvětlit předchozí technickou analýzu docků a panelů srozumitelně pro nevývojáře, ideálně vizuálně.
- Summary: Přeložil jsem review do netechnického vysvětlení pomocí analogií a jednoduchých schémat. Zaměřil jsem se hlavně na rozdíl mezi kosmetickými nedostatky a systémovými riziky: otevřený přístup ke state snapshotu, míchání layoutu mezi světy, zbytečně široké obnovování dat a příliš centralizovanou správu panelů v jednom místě.
- Files: arch/chat-changelog.md
- Verification: Bez implementace; navazuje na předchozí statickou analýzu `src/pages/GamePage.tsx`, `src/api/gameApi.ts`, `server/index.js` a `src/App.css`.
- Notes: Cíl této odpovědi je rozhodovací podpora, ne změna chování hry.

## 2026-03-12 10:57 | branch: codex/feat/build-0.1.12

- Request: Naplánovat implementaci všech doporučených oprav docků a panelů.
- Summary: Připravil jsem implementační roadmapu rozdělenou do etap podle rizika a závislostí. Plán staví nejdřív na zabezpečení state endpointu, world-scoped perzistenci layoutu a základním test harnessen, teprve potom na rozdělení monolitického `GamePage`, zúžení pollingu a nakonec na UX/a11y dotažení dock systému.
- Files: arch/chat-changelog.md
- Verification: Navazuje na statickou analýzu `src/pages/GamePage.tsx`, `src/api/gameApi.ts`, `server/index.js`, `src/App.css` a rychlou kontrolu existujících testů v `tests/regression`.
- Notes: Test coverage pro docky/panely dnes chybí, proto roadmapa obsahuje i malý ochranný milestone před samotným refactorem.

## 2026-03-12 09:56 | branch: codex/feat/build-0.1.12

- Request: Implementovat optimalizace po krocích (zaměřit se na první bod: panel-scoped načítání a nižší background zátěž) na aktuální větvi.
- Summary: Implementoval jsem summary-only polling pro zavřené panely `messages` a `activity` (aby se v backgroundu nestahovaly celé seznamy), rozšířil klient/server kontrakt `/api/v1/state` o include flagy pro domény (`leaderboard`, `kingdomHub`, `research`, `market`, `mercenaries`, `rules`) a napojil je na stav otevřených panelů. Backend snapshot nyní podmíněně skládá a vrací pouze požadované části, včetně omezení nákladných dotazů na leaderboard/kingdom/market/mercenary domény.
- Files: src/pages/GamePage.tsx, src/api/gameApi.ts, server/index.js, server/gameService.js, arch/chat-changelog.md
- Verification: `npm run build` (OK), `node --check server/gameService.js` (OK), `node --check server/index.js` (OK).
- Notes: Změna je navržená jako nízkoriziková incremental optimalizace bez zásahu do tick timing modelu; pro kvantifikaci dopadu zbývá runtime měření payload size a requests/min před/po.

## 2026-03-12 11:08 | branch: codex/feat/build-0.1.12

- Request: Implementovat kompletně dohodnutý economy/building rebalance včetně backend migrace.
- Summary: Implementoval jsem nové max levely a balanc křivky pro dotčené budovy (warehouse/townhall/residential/barracks/stable/workshop), globálně navýšené base cost/time pro všechny budovy, integer throughput/caps model pro gold+mint, nové helpery pro building speed bonusy a legacy remap. Do backendu jsem přidal jednorázovou `app_meta` migraci pro přemapování levelů, queue retiming a refund invalidních upgrade položek, plus nedestruktivní overflow režim: resources nad cap se neclampují dolů a population overflow už nerozpouští jednotky. Snapshot API nově vrací i overflow stav pro resources/population.
- Files: server/gameConfig.js, server/gameService.js, server/db.js, tests/regression/game-rules.regression.test.mjs, tests/regression/game-rules.scenario.mjs, arch/chat-changelog.md
- Verification: `node --check server/gameConfig.js`; `node --check server/gameService.js`; `node --check server/db.js`; `node --check tests/regression/game-rules.regression.test.mjs`; `node --check tests/regression/game-rules.scenario.mjs`; `npm run test:regression` (27/27 pass); `npm run build` (OK).
- Notes: Migrace je idempotentní přes `building_rebalance_version` a je nastavena i v seed flow, aby se na fresh world databázi nespouštěl legacy remap.

## 2026-03-12 12:31 | branch: codex/feat/build-0.1.12

- Request: Implementovat kompletně návrh opravy populace + novou posádku (rezervace 300, bez resource cost obnovy, napojení do obrany/UI).
- Summary: Opravil jsem populační model tak, aby zahrnoval i jednotky mimo leno podle `home_village_id` (in-progress + stationed), odstranil jsem destruktivní cleanup jednotek z economy sync path a upravil návraty armád tak, aby se neodpařovaly kvůli population cap při návratu domů. Přidal jsem perzistentní systém posádky (`village_garrisons`) s oddělenou obnovou ozbrojenců/lučištníků bez nákladů na suroviny; aktivní obrana se odemyká od Radnice 5, ale rezervace 300 populace běží systémově hned. Posádka je zapojená do bojové obrany (včetně ztrát) a API/UI nyní vrací/zobrazuje reálný stav posádky i populační breakdown.
- Files: server/db.js, server/gameService.js, src/api/gameApi.ts, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `node --check server/gameService.js`; `node --check server/db.js`; `npm run build` (OK); `npm run test:regression` (27/27 pass).
- Notes: Změna drží backend guardrail “no tick-on-read write side effects” pro populaci; refill posádky se počítá bez resource spendu a je oddělený per jednotku.

## 2026-03-12 10:30 | branch: codex/feat/build-0.1.12

- Request: Opravit spotlight kartu aktuálního výzkumu tak, aby šla otevřít i bez dostupných projektů, po dokončení nezobrazovala instrukci na třetím řádku a při absenci projektů byla zešedlá/téměř neviditelná.
- Summary: Sjednotil jsem spotlight kartu výzkumu na vždy klikací `button`, napojil ji na jemnější stavy podle `research.projects` a upravil texty/tooltipy pro `researching`, `available`, `complete` a depleted stav. Pokud už není co zkoumat, karta zůstává klikací a otevře panel Výzkum, ale zobrazuje jen stručný headline bez třetí instrukční řádky; zároveň dostala utlumený vizuál s vysokou desaturací a nízkou opacitou.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK); `npm run lint` (fails on pre-existing repo issues v `src/App.tsx`, starším `useEffect` bloku v `src/pages/GamePage.tsx` a generated/backup souborech mimo tento task).
- Notes: Feature contract zůstává UI-only nad autoritativním `gameState.research.projects`, bez nového pollingu nebo změny datového toku; hlavní mitigace rizika je ponechat klikání aktivní i v utlumeném stavu.

## 2026-03-12 10:57 | branch: codex/feat/build-0.1.12

- Request: Naplánovat bezpečnou implementaci wipe herních dat pro druhý svět `Síla ohně` bez zásahu do účtů a současně zhodnotit návrh spawnu, botů a začátečnické ochrany.
- Summary: Prošel jsem backend/frontend kontrakt pro světy a spawn a vytáhl hlavní provozní riziko: po wipe by se svět v aktuální architektuře začal znovu automaticky osazovat při prvním `GET /api/v1/state`, protože `requireVillageForUser()` implicitně zakládá nové léno při absenci presence ve světě. Návrh proto stavím na dvoufázovém rolloutu: nejdřív explicitní world-entry/spawn-flow a per-player/per-world spawn state, teprve potom samotný wipe regionově scoped dat druhého světa přes offline admin skript/transakci s dry-runem, zálohou a post-wipe verifikací. Součástí review jsou i logické/rizikové body pro spawn pravděpodobnosti, reset po ztrátě posledního léna, ochranu proti abuse restartů a oddělení typu osady od username-prefix botů.
- Files: server/gameService.js, server/db.js, server/index.js, src/pages/WorldsPage.tsx, src/pages/GamePage.tsx, src/auth.ts, src/api/gameApi.ts, arch/chat-changelog.md
- Verification: Statická analýza konkrétních flow a schema bodů; bez implementace a bez spuštění testů.
- Notes: Analýza vychází z aktuální větve/worktree `codex/feat/build-0.1.12`, ne z čistého nasazeného `main`, takže před realizací wipe na produkci je nutný ještě diff proti skutečně nasazenému backendu a DB snapshotu.

## 2026-03-12 11:05 | branch: codex/feat/build-0.1.12

- Request: Navrhnout konkrétní řešení k připomínkám kolem opt-in vstupu do světů, spawnu, botů a sestavit nasazovací plán.
- Summary: Rozpracoval jsem explicitní opt-in model vstupu do světa bez povinné presence v jakémkoli světě, navrhl rozdělení spawn flow na `world entry` a samostatný `spawn commit`, oddělil první sezonní spawn od běžného respawnu a doplnil doporučení pro settlement typy, jmenný model botů a pravidla ochrany. Z toho jsem složil rollout po etapách: schema + kontrakt, UI flow, admin wipe tooling, staging dry-run, maintenance window a produkční verifikace.
- Files: arch/chat-changelog.md
- Verification: Design-only návrh nad dříve analyzovanými flow v `server/gameService.js`, `server/index.js`, `server/db.js`, `src/pages/WorldsPage.tsx`, `src/pages/GamePage.tsx`, `src/auth.ts`, `src/api/gameApi.ts`; bez implementace a bez testů.
- Notes: Základní guardrail zůstává stejný: žádný spawn nesmí vznikat při read requestu a wipe musí být region/world scoped, ne account scoped.

## 2026-03-12 11:17 | branch: codex/feat/build-0.1.12

- Request: Analyzovat využití obrazovky, logiku horního MENU vs. dock tabů/šablon, překryv s kartami aktivního léna a výzkumu a navrhnout responsive/smartphone implementace bez kódování.
- Summary: Prošel jsem aktuální layout shellu v `GamePage`/`App.css` a vytáhl klíčové body: herní MENU se na game page ve skutečnosti nezalamuje, ale drží jeden řádek s horizontálním scrollováním; breakpoint na `1400px` pouze přesune `world` a `nav` do dvou řádků. Dock naproti tomu zůstává i na menších šířkách ve fixním splitu 50/50, jeho tab-stripy jsou absolutně posunuté nad dock záporným `top`, mají vysoký `z-index` a proto překrývají karty aktivního léna/výzkumu. Pro prázdné místo jsem identifikoval dvě vrstvy: nahoře je záměrně vložený `resource-strip-spacer`, dole pak některé panely nevyužijí výšku kvůli interním limitům (např. stavební fronta má pevný `max-height`). Výstupem je návrh zavést pro dock stejné pravidlo jako menu jen ve formě jednoradkového scroll railu, přesunout taby do vyhrazené layout řady místo absolutního overlaye a pro tablet/mobil přejít ze split docku na single-panel / stacked shell.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: Statická analýza implementace a breakpointů; bez kódu a bez spuštění testů.
- Notes: Doporučený rollout je UI-only a CSS-first, bez zásahu do game logic nebo pollingu; pro mobil dává největší smysl oddělit desktop window-manager od phone shellu s jedním aktivním panelem.

## 2026-03-12 11:24 | branch: codex/feat/build-0.1.12

- Request: Posoudit design-only vylepšení žoldáků: doplnění statů v panelu Armáda, časových stavů nasazení/spawnu/blokace, přesun sekce z Výzkumu do Armády a možnost vybrat cílové léno bez přepínání aktivního léna.
- Summary: Prošel jsem současný `MilitaryPanel`, `ResearchPanel` a API kontrakt pro žoldáky. Potvrdil jsem, že karta žoldáků v Armádě dnes padá na nulové staty kvůli tomu, že výpočet útoku/obrany bere jen `COMMAND_UNIT_ORDER`, zatímco žoldáci jsou mimo něj; zároveň je celý žoldácký modul aktuálně umístěný ve Výzkumu. Designově doporučuji přesunout „Žoldáckou službu“ do spodní části Armády, na kartu žoldáků přidat stavový modrý progress background s hover tooltipem pro přesný zbývající čas a rozlišit stavy `příchod` vs. `aktivní nasazení` vs. `blokace`. Výběr cílového léna považuji za dobré UX zlepšení, ale pouze přes lehký picker s eligible seznamem a důvody nevalidity, ne přes nový těžký snapshot nebo per-village fetch při hoveru.
- Files: src/pages/GamePage.tsx, src/api/gameApi.ts, arch/chat-changelog.md
- Verification: Statická analýza UI a datového kontraktu; bez implementace a bez spuštění testů.
- Notes: Současný kontrakt `MercenaryContractState` už nese časy `orderedAt/arriveAt/expiresAt`, ale pro cross-village UX by při implementaci dávalo smysl doplnit i cílové `villageId/villageName`, protože hlavní snapshot dnes drží mince jen pro aktuálně aktivní léno.

## 2026-03-12 11:40 | branch: codex/feat/build-0.1.12

- Request: Navrhnout implementační plán pro přesun a rozšíření žoldáků s explicitním feature kontraktem bez nového globálního pollingu.
- Summary: Prošel jsem aktuální polling a write/read flow kolem `loadGameState`, `includeMercenaries`, `getArmyOverview` a `hireMercenaryContract`. Plán stavím na tom, že žoldáci se přesunou z panelu Výzkum do Armády bez nového globálního intervalu: current-village kontrakt zůstane panel-scoped přes existující `/api/v1/state` include flagy, zatímco cross-village picker a eligibility data půjdou přes lehký army overview read model nebo dedikovaný mercenary read model načítaný jen při otevřeném panelu / ručním refreshi. Součástí plánu je i ochrana proti nechtěnému přepnutí aktivního léna, protože write endpoint dnes vrací snapshot cílového léna.
- Files: src/pages/GamePage.tsx, src/api/gameApi.ts, server/gameService.js, server/index.js, arch/chat-changelog.md
- Verification: Statická analýza panel lifecycle, API kontraktu a write/read flow; bez implementace a bez spuštění testů.
- Notes: Klíčový guardrail je zachovat read cesty bez tick-on-read side efektů a nespouštět žádný nový background polling mimo už existující state loop.

## 2026-03-12 12:06 | branch: codex/feat/build-0.1.12

- Request: Navrhnout nové rozlišení typů lén podle současných bodů prestiže po rebalance budov a prestiže.
- Summary: Ověřil jsem autoritativní výpočet prestiže na backendu, aktuální prahy pro settlement art na frontendu a reálnou distribuci `villages.prestige` v lokální databázi. Z toho vychází, že dnešní prahy `3000/6000/10000/20000` jsou po kompresi building ladderů příliš natažené: building-only strop je nyní 14520 prestiže a většina současných vesnic spadá do pásma pod 4000. Doporučil jsem proto zachovat 5 tierů, ale posunout prahy tak, aby early game dostal dřívější vizuální upgrade, abandoned/default vesnice kolem ~3800 ještě nezískaly art města a top tier zůstal vyhrazený skoro maxnutým a vojensky silným lénům.
- Files: arch/chat-changelog.md
- Verification: Statická analýza `server/gameService.js`, `server/gameConfig.js`, `src/pages/GamePage.tsx` a read-only kontrola distribuce v `server/data/game.sqlite`; bez implementace a bez spuštění testů.
- Notes: Návrh je design-only a počítá s tím, že budoucí implementace bude měnit jen tier threshold mapping bez nového pollingu nebo rozšiřování hlavního snapshotu.

## 2026-03-13 13:05 | branch: feat/build-0.1.12

- Request: Navrhnout design pravidel pro spawn botů bez implementace, včetně hustoty, umístění a názvosloví `Městský stát X`.
- Summary: Ověřil jsem současný stav bot/abandoned seedingu v `server/db.js`, kde jsou dnes jen fixní počty abandoned a active bot osad. Na tom základě jsem navrhl, aby budoucí bot spawn nebyl odvozený od celkového počtu všech lén, ale od cílového poměru k hráčským lénům, s world-level reconcile krokem mimo read path. Součástí návrhu jsou hard spacing pravidla, výběr kandidátních polí podle score preferujícího odstup od jiných botů i běžných lén, cap na počet nových botů za cyklus a názvový model `Městský stát <historické jméno>`.
- Files: arch/chat-changelog.md
- Verification: Design-only návrh nad read-only analýzou `server/db.js`; bez implementace a bez testů.
- Notes: Guardrail zůstává stejný: žádný bot spawn nesmí vznikat na `GET` requestu ani být navázaný na prostý růst všech lén včetně abandoned.

## 2026-03-13 10:09 | branch: feat/build-0.1.12

- Request: Sepsat konkrétní responsive/UI backlog pro menu, dock taby, překryvy a smartphone režim bez implementace.
- Summary: Přepsal jsem předchozí high-level úvahy do konkrétní specifikace: menu v game shellu je aktuálně jednoradkový scroll rail, ne wrap; slim resource strip záměrně nechává prázdný střed; dock zůstává absolutní overlay se split 50/50 a negativně posunutými tab-stripy, což vytváří překryv s horními kartami. Výstup proto konkretizuje doporučené breakpointy, přesun dock tabů do vyhrazené řady, přechod ze split docku na single-panel režim na tabletu a samostatný phone shell s jedním aktivním panelem.
- Files: src/App.css, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: Statická analýza layout shellu a responsive pravidel; bez implementace a bez testů.
- Notes: Návrh drží guardrail UI-only změny bez zásahu do gameplay, API a pollingu; preferuje CSS-first breakpoints a lokální stav shellu místo nových globálních watcherů.

## 2026-03-13 08:22 | branch: feat/build-0.1.12

- Request: Ověřit, zda v rámci tohoto chatu nezůstalo něco nenasazené, a dorovnat chybějící nasazení prestige tier thresholdů.
- Summary: Zkontroloval jsem aktuální worktree a zjistil, že rename větve sedí, ale `src/pages/GamePage.tsx` pořád obsahoval staré prahy `3000/6000/10000/20000`. Prahy jsem proto znovu propsal na dohodnuté hodnoty `1500/4500/9000/16000` a ověřil jejich přítomnost přímo v souboru.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: Kontrola aktuálních podmínek ve `src/pages/GamePage.tsx`; bez spuštění testů v tomto kroku.
- Notes: Šlo o čistou frontend mapping opravu bez zásahu do backend výpočtu prestiže.

## 2026-03-13 10:19 | branch: feat/build-0.1.12

- Request: Navrhnout, jak v horním herním menu nahradit dřívější doplňková okna malými číselnými indikátory pro Příkazy, Komunikaci a Žebříček.
- Summary: Ověřil jsem aktivní větev `feat/build-0.1.12` a prošel současný tok dat i render menu v `src/pages/GamePage.tsx` a `src/components/CommunicationHub.tsx`. Návrh drží změnu jako UI-only: `Příkazy` mají zobrazovat jen počet příchozích útoků na hráče z existujícího `armyIncomingMovements`, `Žebříček` jen utlumené `#rank` z již načteného `leaderboardRows`, a `Komunikace` je vhodné navázat na počet vojenských záznamů, prakticky na summary bitevních hlášení, ne na chat badge. Doporučená implementace je přidat do `MenuButton` jednotný `indicator` prop a neotvírat žádné nové polling smyčky; případné dopočítání vojenských záznamů má jít přes existující summary flow nebo lehké rozšíření stávajícího summary payloadu.
- Files: arch/chat-changelog.md
- Verification: Statická analýza `src/pages/GamePage.tsx`, `src/components/CommunicationHub.tsx`, `src/api/gameApi.ts`, `server/index.js` a `server/gameService.js`; bez implementace a bez spuštění testů.
- Notes: Guardrail zůstává beze změny: žádný nový globální polling a žádné tahání těžkých panelových dat jen kvůli horním badge.

## 2026-03-13 10:29 | branch: feat/build-0.1.12

- Request: Začít postupně implementovat celou roadmapu dock/panel oprav, nejdřív bezpečnost a world-scoped perzistenci.
- Summary: Implementoval jsem první produkční etapu roadmapy. Na backendu jsem přesunul `/api/v1` auth middleware před gameplay endpointy, takže `state` už není mimo session boundary, a `GET /api/v1/state` navíc používá `req.authSession.username` místo důvěry v query. Na frontendu jsem zavedl world-scoped panel storage klíče (`schema v2`, `username + worldId`), přepojil read/save helpery, přidal rehydrataci panelů při změně světa a guard refy proti přepsání nového world scope starým layoutem při prvním efektu po switchi. Současně jsem upravil aktivaci dock tabů tak, aby klik na tab už nepřestavoval layout do center-stage režimu jako skrytý side effect.
- Files: server/index.js, src/pages/GamePage.tsx, tests/api/state-auth.test.mjs, arch/chat-changelog.md
- Verification: `node --check server/index.js`; `node --test tests/api/state-auth.test.mjs`; `npm run test:regression`; `npm run build` (padá na existujících TS chybách v `src/pages/GamePage.tsx` mimo tento patch, viz typy kolem `MilitaryPanel`/`ResearchPanel`).
- Notes: Etapa odpovídá guardrail prioritě `security + correctness` před širším refactorem data-flow a render boundaries.

## 2026-03-13 11:41 | branch: feat/build-0.1.12

- Request: Pokračovat na větvi `feat/build-0.1.12` dalším implementačním krokem.
- Summary: Navázal jsem dalším krokem po security/persistence etapě: v API klientovi jsem odstranil posílání `username` query parametru u session-bound endpointů (`fetchGameState`, `fetchWorldMapSnapshot`, `fetchCommunicationInbox`). Tyto requesty se teď opírají o server-side session identity z middleware a neposílají zbytečný identifikátor v URL. Tím se zmenšuje request surface a drží se jednotný auth model „session je zdroj pravdy“.
- Files: src/api/gameApi.ts, arch/chat-changelog.md
- Verification: `npm run build`; `node --test tests/api/state-auth.test.mjs`; `npm run test:regression`
- Notes: Změna je kompatibilní s backend middlewarem, který `username` dosazuje ze session; nepřidává žádný nový polling ani nové payloady.

## 2026-03-13 11:54 | branch: feat/build-0.1.12

- Request: Vysvětlit účel neversionovaného adresáře `.codex-runtime/`.
- Summary: Ověřil jsem aktuální obsah složky a nejde o produkční část aplikace. V repozitáři teď obsahuje jen lokální runtime artefakty a ad-hoc inspekční skripty (`dev.log`, `inspect-battle-report-rows.mjs`, `inspect-battle-reports.mjs`) používané pro dočasné diagnostické kontroly nad daty/reporty.
- Files: arch/chat-changelog.md
- Verification: Read-only kontrola obsahu `.codex-runtime/` přes shell; bez implementace a bez testů.
- Notes: Složku je bezpečné ignorovat v gitu, pokud ji nechceš používat jako lokální scratchpad.

## 2026-03-13 14:23 | branch: feat/build-0.1.12

- Request: Implementovat žoldácké úpravy z návrhu: přesun sekce z Výzkumu do Armády, doplnit staty v kartě Armáda, přidat stavový progress/hover čas, informace o spawnu+blokaci a výběr cílového léna bez přepínání aktivního léna, bez nového globálního pollingu.
- Summary: Přesunul jsem „Mincovna a žoldáci“ do `MilitaryPanel`, doplnil výběr cílového léna přes `hiringOptions` (preferuje léna s dostatkem mincí), zobrazil spawn/nasazení/blokaci včetně přesných timestampů a přidal modrý progress overlay s hover detail časem na kartě žoldáků. Staty žoldáků v Armádě teď používají stejný útok/obranu jako ozbrojenci. Na backend read model jsem rozšířil mercenary kontrakt o metadata (cooldown/delay/duration/unlocked/cost/unitAmount), cross-village hiring options a village kontext kontraktů; write výsledek náboru vrací i `villageName`. Klientský `handleHireMercenaries` nově přijímá cílové `villageId` a neaplikuje snapshot na UI, pokud se liší od aktuálně aktivního léna (jen refreshne state), aby nedocházelo k nechtěnému přepnutí kontextu.
- Files: server/gameService.js, src/api/gameApi.ts, src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract drží panel-scoped fetch model (`includeMercenaries` jen při otevřeném panelu Armáda) a nepřidává žádný nový globální polling interval.

## 2026-03-14 10:43 | branch: feat/build-0.1.12

- Request: Zjistit, proč se reporty z bojů nezobrazují a nenačtou žádná data.
- Summary: Ověřil jsem read path pro battle reporty na backendu i frontendu. Backend vrací seznam i summary korektně a lokální DB obsahuje plné payloady reportů. Důvod bugu je klientský tok dat: UI umělo otevřít detail reportu z `reportId`, ale dříve spoléhalo jen na lokální cache seznamu reportů; když se report otevíral z `Activity`/sdíleného oznámení mimo předem načtený panel `Zprávy`, detail panel nedostal `BattleReportItem` a skončil ve stavu „report se nenačetl“. Současný kód už obsahuje cílené dočtení reportu podle ID, což přesně adresuje tuhle příčinu.
- Files: arch/chat-changelog.md
- Verification: Statická kontrola `src/pages/GamePage.tsx`, `src/api/gameApi.ts`, `server/index.js`, `server/gameService.js`; lokální ověření přes `node .codex-runtime/verify-battle-report-read.mjs`, které potvrdilo, že `listBattleReports` i `getBattleReportSummary` vracejí data.
- Notes: Feature contract: zdroj pravdy je `battle_reports`; fetch model má být seznam ve `Zprávách` plus on-demand detail podle `reportId`, ne nový polling ani větší globální snapshot.

## 2026-03-14 12:10 | branch: feat/build-0.1.12

- Request: Na mapě zobrazit při podržení Ctrl statické, designově výrazné karty nad lény hráčů a botů, barevně navázané na mapu, bez opuštěných lén a se zachováním stávajícího detailního Ctrl preview.
- Summary: V `MapPanel` jsem přidal lehké banner karty přímo do renderu settlement markerů, takže se centrovaně zobrazují nad každým viditelným lénem typu `own/player/bot` pouze při držení `Ctrl`. Bannery přebírají barevný tón z mapových relation barev (`own`, `allied`, `nap`, `opponent`, `enemy`, `bot`) a ukazují stručný štítek typu, název léna, vlastníka a prestiž. Stávající hover/pinned detailní karta i travel-times preview zůstaly beze změny. Současně jsem opravil izolovanou TypeScript chybu v lazy loaderu detailu battle reportu (`requestPromise` definite assignment), aby větev znovu prošla buildem.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK); `npm run lint` (padá na starších repo-wide chybách mimo tento patch: `src/App.tsx:63`, `src/pages/GamePage.tsx:4096`, `src/pages/GamePage.tsx:7484`, plus warnings v generovaných/back-up souborech).
- Notes: Feature contract: čistě lokální mapový overlay bez nového pollingu a bez rozšíření snapshot payloadu. Hlavní výkonové riziko je počet overlay prvků na mapě; mitigace je render jen při drženém `Ctrl` a jen pro už virtualizované viditelné settlement markery.

## 2026-03-14 12:26 | branch: feat/build-0.1.12

- Request: Zrušit dock/šablony a přestavět hlavní game page na mapově-centrický layout: menu + karta světa nahoře, minimapa uvnitř mapy, aktivní léno/výzkum uvnitř hlavní obrazovky, verze + komunikace uvnitř, mapa bez hlavičky/rychlých tlačítek, zoom až +200 %, zachovat jen pin sloupce a zakázat zavírání panelů prostředním tlačítkem.
- Summary: Vypnul jsem dock režim pro menu panely (prakticky odstraněn z UX), přesunul HUD (top menu, world switch, aktivní léno, aktuální výzkum) dovnitř hlavního `game-canvas` a doplnil utility strip s verzí hry a tlačítkem komunikace. Mapa je teď výchozí centrální panel, nejde zavřít standardní cestou, vykresluje se bez okenní hlavičky/quick akcí a drží pozadí pod ostatními panely. Hlavní menu panely se při otevření roztahují na herní viewport, minimapa + zoom/hint blok jsou přesunuty dovnitř mapového prostoru (overlay), navýšil jsem map zoom limit na +200 % a vypnul middle-click close pro panely/taby.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Změna je UI/layout-only na frontendu; bez nového globálního pollingu a bez změny backend tick/read flow.

## 2026-03-14 12:38 | branch: feat/build-0.1.12

- Request: Upravit hlavní stránku tak, aby MENU fungovalo jako přepínání centrálního obsahu, aktivní léno + výzkum nebyly float, menu okna se vždy roztáhla na celý centrální kontejner, verze byla jako stálý text vlevo dole a menu okna nešla ručně roztahovat.
- Summary: Přepnul jsem menu panely do režimu „single page switch“: při otevření panelu z MENU se ostatní menu panely sbalí a aktivní panel se automaticky roztáhne na celý centrální stage. HUD (MENU, karta světa, aktivní léno, aktuální výzkum) jsem přesunul z absolutního overlay do normálního vertikálního toku nad centrální stage, aby byl obsah panelů centrovaně pod sebou. Verzi hry jsem odstranil z karet a přidal jako trvalý text `Verze hry ...` vlevo dole stránky. U menu panelů jsou vypnuté akce sbalit/zavřít i resize handle, takže je nelze ručně roztahovat do stran.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Úprava je front-end UI/layout only; bez změny backend flow a bez nového pollingu.

## 2026-03-14 13:10 | branch: feat/build-0.1.12

- Request: Dotáhnout mapu jako primární centrální obrazovku: minimapa stále viditelná uvnitř mapy, odstranit map header i textový hint blok, přesunout `centrovat/fullscreen` do minimapy jako ikonové buttony, odstranit scrollový pocit mapy, zachovat zoom +200 % a přidat paměť poslední mapové lokace + zoom hloubky.
- Summary: V `MapPanel` jsem odstranil horní map card (`Region ... / mřížka ...`) i spodní textový hint blok s rozkazy. Barevnou legendu lén jsem přesunul dovnitř mapy jako overlay v jednom řádku a zmenšil popisky přibližně o 25 %. Tlačítka `centrovat` a `celá obrazovka` jsou teď součást minimapy jako dva ikonové buttony bez textu. Dále jsem přidal perzistenci mapové pozice (pan lokace přes `left/top ratio` do `localStorage`) vedle existující perzistence zoomu, takže se po návratu obnoví hloubka i pozice. CSS takeover pro hlavní mapové okno teď odstraňuje vnitřní padding/mezery okna, drží minimapu jako overlay i na menších šířkách a map wrap běží bez nativního scrollu.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Úprava je čistě frontend map/UI bez zásahu do backend read/write flow a bez nového pollingu.

## 2026-03-14 13:43 | branch: feat/build-0.1.12

- Request: Dotáhnout mapu bez prostoru kolem (cover zoom), ukotvit legendu lén staticky nahoře bez kartového vzhledu, držet minimapu stále viditelnou, odstranit rámečky oken, vypnout ruční resize zbývajících pinovatelných oken a zjednodušit hover kartu léna na minimalistické info.
- Summary: Přepnul jsem mapový základ na cover výpočet (`fitCellSize` podle delší strany viewportu), nastavil minimální zoom od `0` a přeznačil zoom metriku tak, že `100 %` odpovídá výchozímu maximu podle okna. `region-grid-wrap` je teď transparentní, takže se neukazuje modré okolí mimo mapu. Legenda lén je staticky nahoře v mapě bez pill/card stylu. Minimapa zůstává jako statický overlay vpravo nahoře s vyšším `z-index`, aby se neztrácela při zoom/pan. Pro všechna herní floating okna jsem odstranil vnější rámečkový vzhled a u zbývajících pinovatelných oken zapnul auto-size (`fit-content`) a skryl resize handle. Hover/pin karta léna je zredukovaná na: název + vlastník/opuštěná osada, prestiž léna (u hráčů i celková prestiž hráče), království + typ (a pouze kde dává smysl i prestiž království), vzdálenost; text s instrukcí na Ctrl a těžké detailní bloky jsou pryč.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI-only změna mapového render/layoutu a panel chrome; hlavní riziko je regress v čitelnosti overlay prvků, mitigace je pevné ukotvení, menší hustota textu a bez nových síťových toků/pollingu.

## 2026-03-14 14:02 | branch: feat/build-0.1.12

- Request: Zakotvit minimapu i legendu typů osad k mapovému oknu (ne k mapovému obsahu), roztáhnout mapu víc dolů, mít komunikaci+verzi jako trvale viditelné prvky nezávislé na panelech, otevírat MENU panely dovnitř centrálního mapového okna, přidat centralizovaný název aktuálního okna s jemným červeným glow/pulzem, odstranit rámování HUD prvků (MENU, svět, aktivní léno, výzkum) a držet centrální okno bez rámu.
- Summary: Přesunul jsem minimapu i legendu z `region-grid-wrap` do nové overlay vrstvy `map-window-overlays`, která je absolutně ukotvená na `map-workspace` (okno mapy), takže zůstávají stále viditelné a nepohybují se s mapovým obsahem. MENU panely teď při otevření berou frame přímo z mapového panelu (fallback na stretched frame), takže se renderují uvnitř stejného centrálního herního prostoru; zároveň mapa zůstává otevřená jako background vrstva a ostatní hlavní MENU panely se přepínají nad ní. Přidal jsem centrální titul aktuálního okna (`game-main-stage-title`) s jemným červeným pulzujícím glow efektem včetně mapy pro konzistenci. Footer s komunikací a verzí je nově fixní (`game-persistent-footer`), takže je trvale viditelný nezávisle na jiných panelech. V HUD jsem odstranil rámování/hover rámy pro MENU tlačítka, svět, aktivní léno a výzkum a mapové centrální okno je bez rámu/okraje.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI/layout-only změna bez zásahu do backend data-flow; hlavní riziko je překryv overlay prvků na menších šířkách, mitigace je oddělená overlay vrstva mapového okna + responsive limity šířky legendy/minimapy.

## 2026-03-14 14:05 | branch: feat/build-0.1.12

- Request: Potvrdit finální stav mapově-centrického layoutu po poslední sadě požadavků (ukotvení minimapy/legendy, MENU panely v mapovém okně, persistentní komunikace+verze, frameless HUD/okna).
- Summary: Provedl jsem validační kontrolu implementace v `GamePage.tsx`/`App.css` a ověřil jsem, že minimapa + legenda jsou v `map-window-overlays` ukotvené k mapovému oknu, hlavní MENU panely používají frame mapového panelu, centrální titul okna s červeným glow je aktivní, hlavní mapové okno je bez headeru/rámu a persistentní footer drží komunikaci + verzi nezávisle na ostatních panelech.
- Files: arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI-only ověření bez změn backend data-flow, bez nového pollingu, bez rozšíření payloadu.

## 2026-03-14 14:26 | branch: feat/build-0.1.12

- Request: Přesunout název aktivní stránky mezi kartu aktivního léna a kartu výzkumu, přesunout `Nastavení` k tlačítku komunikace dole, přejmenovat tlačítko `Komunikace` na `Chat` a odstranit žluté rámování menu tlačítek.
- Summary: V horním HUD jsem vyjmul `Nastavení` z hlavního MENU a název aktuální stránky přesunul do středu `resource-strip` mezi `Aktivní léno` a `Aktuální výzkum`, včetně zachování jemného červeného glow efektu. V persistentním spodním panelu jsem přidal nové tlačítko `Nastavení` vedle komunikačního tlačítka a text komunikačního tlačítka změnil na `Chat`. V CSS jsem zároveň odstranil rám/border a box-shadow z top menu komponent (`nav-action` + world trigger) ve všech stavech (`default/hover/open`), aby zmizel žlutý obrys.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě frontend UI/layout změna bez zásahu do backend data-flow a bez přidání nového pollingu.

## 2026-03-14 14:38 | branch: feat/build-0.1.12

- Request: Vrátit hlavní herní okno do plného zobrazení (bez „nudle“), přejmenovat komunikační panel na `Chat` a spodní tlačítko `Nastavení` změnit na ikonové bez textu.
- Summary: Opravil jsem grid layout hlavního kontejneru na dvě řady (`HUD + full stage`), takže `game-canvas` znovu zabírá plnou dostupnou výšku a mapové hlavní okno není stlačené. Panel `messages` jsem přejmenoval na `Chat` v panel meta, hlavním MENU i shortcut popisu. Spodní `Nastavení` je nově ikonové tlačítko se symbolem `⚙︎` (bez textu), s ponechaným `title`/`aria-label`.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI/layout-only úprava; bez změny fetch modelu, bez nového pollingu, bez backend zásahu.

## 2026-03-14 14:54 | branch: feat/build-0.1.12

- Request: Upravit chat prvky: `Chat` button mít jen jako ikonu bez textu, ale otevřená stránka/panel má mít název `Komunikace`; pravý spodní komunikační launcher u verze přejmenovat na `Chat`.
- Summary: Vrátil jsem název panelu `messages` zpět na `Komunikace` (v panel meta, NAV i shortcut label), takže otevřená stránka používá požadovaný název. Levý spodní chat button v persistentním footeru je nově ikonový (`✉︎`) bez textu, se zachovaným badge počtem. Pravý spodní launcher z `CommunicationHub` jsem přejmenoval z `Komunikace` na `Chat`. Současně jsem pro horní NAV tlačítko zpráv skryl textový label, takže zůstává jen ikona obálky.
- Files: src/pages/GamePage.tsx, src/components/CommunicationHub.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI-only text/style změna bez zásahu do datového toku a bez nového pollingu.

## 2026-03-14 15:37 | branch: feat/build-0.1.12

- Request: Odebrat `Komunikace` z hlavního MENU (ponechat jen spodní ovládání), zvětšit spodní tlačítka `Nastavení` + komunikace, definitivně odstranit žluté rámování MENU tlačítek, roztáhnout panely v herním okně na plné zobrazení, sjednotit mapové léno panely na jedno otevřené, při kliknutí z PIN sloupce přesouvat mapu na léno, přidat do `Nastavení > Rozhraní hry` správu barev rozlišení lén s resetem a opravit mapové karty/ctrl časy.
- Summary: Z horního MENU jsem odstranil položku `messages` (zůstává jen spodní ovládání), spodní ikonové buttony jsem zvětšil cca o 50 % a přidal high-specificity override pro skin `dark-medieval`, který ruší border/box-shadow/outlines na MENU tlačítkách a převádí je do čistého šedého stylu bez žlutého rámování. Pro hlavní stage jsem doplnil `no-window-header` stretch pravidlo, aby bezhlavičkové hlavní panely využily celou výšku. V mapové logice jsem přidal `isInteractionEnabled` gate + cleanup, takže hover/pinned karty se při přepnutí na jiné stránky zavřou; současně jsem obnovil blok `Ctrl` časů přesunu jednotek v preview kartě. Otevírání panelu léna teď kolabuje ostatní otevřená léna (jen jedno aktivní) a klik z PIN tabů navíc vyvolá map centering na dané `settlementId`. Do `Nastavení > Rozhraní hry` jsem doplnil novou sekci RPG palety barev lén (`input[type=color]` pro všechny relation typy) + reset na default, s okamžitou aplikací přes CSS proměnné a perzistencí do stávajícího shortcut settings storage.
- Files: src/pages/GamePage.tsx, src/App.css, src/components/CommunicationHub.tsx, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI/map interaction-only změna bez nového pollingu nebo backend zásahů; hlavní riziko bylo zhoršení mapové čitelnosti, mitigace je jednoznačný single-léno režim + explicitní cleanup overlay karet mimo mapu.

## 2026-03-14 16:06 | branch: feat/build-0.1.12

- Request: Opravit chování lén panelů a MENU: léno okna neroztahovat do úzkého auto-size, držet vždy jedno viditelné léno okno, sjednotit vizuální/stavové chování všech tlačítek v horním MENU podle jednoho vzoru a přidat lehkou, nerušivou animaci při přepínání stránek.
- Summary: Upravil jsem logiku hlavního MENU tak, že aktivní stav tlačítka se teď řídí výhradně `activeMainStagePanel` (už ne souběžně „Mapa + stránka“), takže všechny položky mají konzistentní open stav jako `Přehled`. Pro panely lén jsem vypnul auto-size režim, přidal stage-stretch režim i pro `village` a aplikoval ho při otevření z mapy i při rozbalení z PIN tabů; tím se léno panel roztahuje na plnou šířku hlavního herního kontejneru. Současně zůstává pravidlo single-open: při otevření jednoho léna se ostatní léna sbalí. Do UI jsem doplnil lehkou animaci přechodu hlavních stránek (`fade + slight slide`) přes `main-menu-page-window`. Na závěr jsem přidal finální high-specificity CSS override pro horní MENU tlačítka, aby bez ohledu na skin zmizelo žluté rámování a všechny stavy (`default/hover/open/active`) byly jednotné.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: autoritativní stav je lokální panel state ve `GamePage`; fetch model se nemění; hlavní výkonové riziko je přerender při switchi panelu, mitigace je čistě CSS animace bez nových intervalů/requestů.

## 2026-03-14 16:15 | branch: feat/build-0.1.12

- Request: Vrátit chování lén oken tak, aby nebyla přes celou herní obrazovku, ale přizpůsobovala se vlastnímu obsahu a působila jako menší okna na stránce.
- Summary: Odebral jsem full-width forcing pro `village` panely a vrátil je zpět do `auto-size` režimu podle obsahu. Konkrétně jsem zrušil aplikaci stretched frame pro léna v `openSettlementPanel` i `togglePanelVisibility`, vrátil podmínku `shouldAutoSizeToContent` bez výjimky pro `village` a odstranil doprovodné CSS, které léno oknům nutilo šířku/overflow jako pro full-stage režim. Pravidlo „jen jedno otevřené léno“ zůstává zachované.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě lokální UI state/layout změna bez nových requestů, pollingu nebo backend zásahu.

## 2026-03-14 16:31 | branch: feat/build-0.1.12

- Request: Umístit okno vybraného léna na spodní střed herního zobrazení a odstranit nutnost horizontálního scrollování obsahu okna.
- Summary: V renderu oken jsem pro `village` panel přidal pevné ukotvení na spodní střed (`left: 50%`, `bottom: 4.35rem`, `translateX(-50%)`), takže vybrané léno je vždy dole uprostřed herního stage. Současně jsem doplnil CSS pro village window, které drží kompaktní šířku (`max-width`), vypíná horizontální overflow v `window-body` a převádí hlavičku/detail grid do wrap-safe layoutu bez přetékání do šířky.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI-only změna bez úpravy síťového modelu; hlavní riziko je překrytí s footerem na extrémně malých viewports, mitigace je kompaktní max-width a bottom offset nad persistentním panelem.

## 2026-03-14 17:13 | branch: feat/build-0.1.12

- Request: Opravit mapově-centrický layout podle screenshotu: vrátit plnou šířku využití stage při práci s lénem + resize browseru bez F5, přichytit herní kontejner k levému/pravému/spodnímu okraji, sjednotit tmavé neprůhledné pozadí MENU a world karty, upravit legendu typů osad (stejný font jako měřítko, bez rámování), minimapu zredukovat na 2 ikonová zoom tlačítka (100/300), přidat subtilní „fire underglow“ pod název stránky a doplnit `#rank` badge k tlačítku Žebříček.
- Summary: V `GamePage` jsem opravil resize-driven reflow tím, že `canvasViewportRevision` vstupuje do efektu přepočtu stretched panel frame; díky tomu se stage po změně velikosti okna přizpůsobí bez refresh. Zároveň jsem rozšířil `MenuButton` o volitelný inline badge a na `Žebříček` napojil `#rank` z `playerLeaderboardEntry`. V mapovém ovládání jsem nahradil 6 zoom tlačítek dvěma ikonovými akcemi (`⊟` pro 100 %, `⊞` pro 300 %). V CSS jsem přepnul game layout container na edge-to-edge (`app-content-container` bez max-width/padding, `game-canvas` bez bočního/spodního paddingu), upravil footer offset k dolní hraně, sjednotil menu+world trigger na tmavé neprůhledné pozadí se stejnou výškou, přepnul legendu osad na stejnou velikost fontu jako měřítko a odstranil její rámovací vizuál. Efekt pod názvem stránky jsem změnil z čistého pulzu na jemné „flame flicker“ glow pod textem.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI-only změna bez nového pollingu/network toku; hlavní výkonové riziko bylo nadměrné rerenderování při resize, mitigace je rAF-throttled viewport revision + existující guard `changed ? nextPanels : previous`.

## 2026-03-14 17:19 | branch: feat/build-0.1.12

- Request: Ověřit aktuální stav mapově-centrického layoutu po posledních úpravách (plná šířka stage, resize bez F5, tmavé MENU/world, minimapa/legenda, badge u Žebříčku) a potvrdit sestavitelnost.
- Summary: Provedl jsem kontrolu diffu v `GamePage.tsx` a `App.css` a ověřil přítomnost klíčových změn: reflow panelů při resize přes `canvasViewportRevision`, edge-to-edge layout kontejneru, sjednocené tmavé stavy top menu/world tlačítek, dvě ikonová zoom tlačítka minimapy (100/300), inline badge `#rank` u `Žebříček` a flame underglow efekt pod názvem stránky. Následně jsem spustil build pro potvrzení konzistence.
- Files: arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Ověření bez dalších funkčních zásahů; změny v `src/components/CommunicationHub.tsx` a neznámý `.codex-runtime/verify-battle-report-read.mjs` zůstaly beze změny.
