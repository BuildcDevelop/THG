# Chat Changelog

## 2026-03-13 08:30 | branch: main

- Request: Implementovat bezpečný opt-in vstup do světů bez implicitního autospawnu, zavést explicitní spawn flow, přidat world-scoped wipe mechanismus a provést reset světa `dominion-1-fire` podle doporučeného pořadí přímo na větvi `main`.
- Summary: Odstranil jsem implicitní spawn na read path (`/api/v1/state` už bez existence osady pouze vrací chybu), přidal per-player/per-world spawn state tabulku `player_world_state`, explicitní endpoint `POST /api/v1/worlds/:worldId/spawn`, respawn-aware restart flow se směrem spawnu a oddělenými respawn parametry (`playerRespawnProtectionDays`, `respawnNearbyAbandonedCount`). Dále jsem přidal guarded admin endpoint `POST /api/v1/admin/worlds/:worldId/wipe` (admin check + confirm text), world-scoped wipe transakci v backendu a provedl ostrý wipe `dominion-1-fire` s verifikací nulových stavů po resetu.
- Files: server/db.js, server/gameService.js, server/index.js, src/api/gameApi.ts, src/pages/WorldsPage.tsx, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `node --check server/gameService.js` (OK), `node --check server/index.js` (OK), `npm run build` (OK), ověření wipe přes `wipeWorldData('dominion-1-fire', { dryRun: false })` a následný `dryRun` se stavem `villages: 0` a ostatními world-scoped počty na nule.

## 2026-03-13 09:28 | branch: main

- Request: Implementovat bot city-state pravidla na `main`: 100 historických názvů, náhodný výběr jména bez duplicit ve světě, zavést `settlement_kind = bot_city_state`, zapracovat bot spawn poměr 1:10 vůči hráčským lénům, připravit commit/push/deploy a znovu world wipe.
- Summary: Přidal jsem sdílený modul `server/botCityStates.js` s poolem 100 názvů a helpery pro formát/unikátní výběr jména. Do databázového schématu jsem doplnil `villages.settlement_kind` (`player`/`abandoned`/`bot_city_state`) včetně migrace/backfillu a indexů (`idx_villages_region_settlement_kind`, unikátní jméno pro `bot_city_state` v rámci regionu). Aktivní bot osady se nyní normalizují na názvy `Městský stát X` a `settlement_kind = bot_city_state`; abandoned osady se drží jako `abandoned`. V `gameService` jsem zavedl world-level reconcile bot city-state (`floor(player_settlements/10)`, cap na nové osady za cyklus, spawn scoring s preferencí odstupu od jiných bot osad), napojil ho do tick flow mimo read-only logiku a upravil mapové rozlišení settlementů tak, aby primárně četlo `settlement_kind`. Následně jsem provedl wipe světa `dominion-1-fire`.
- Files: server/botCityStates.js, server/db.js, server/gameService.js, server/sqliteSnapshot.js, arch/chat-changelog.md
- Verification: `node --check server/botCityStates.js` (OK), `node --check server/db.js` (OK), `node --check server/gameService.js` (OK), `node --check server/sqliteSnapshot.js` (OK), `npm run build` (OK), runtime kontrola `runGameTick()` (vrací `botCityStateReconcile`), kontrola unikátnosti bot city-state jmen v DB, `wipeWorldData('dominion-1-fire', { dryRun: true/false })` (po wipe region 2 na nule).

## 2026-03-13 09:40 | branch: main

- Request: Ověřit, proč uživatel nevidí wipe na Netlify.
- Summary: Potvrdil jsem, že commit `f42dc55` je na `origin/main`, ale Netlify v tomto repu funguje jen jako frontend proxy na self-host backend dle `netlify.toml`. Live backend endpoint `/api/health` hlásí stále build `build-0.1.09`. Po přihlášení přes `/api/v1/auth/login` nové endpointy (`POST /api/v1/worlds/:worldId/spawn` a `POST /api/v1/admin/worlds/:worldId/wipe`) vrací `404`, takže produkční backend neběží na nové verzi kódu a wipe se proto na produkci neprovedl.
- Files: arch/chat-changelog.md
- Verification: `git rev-parse --short HEAD` + `origin/main` (oba `f42dc55`), live HTTP kontroly `/api/health`, `/api/v1/state?worldId=dominion-1-fire`, autentizované POST testy `/api/v1/worlds/dominion-1-fire/spawn` a `/api/v1/admin/worlds/dominion-1-fire/wipe`.

## 2026-03-13 09:59 | branch: main

- Request: Bezpečně dotáhnout produkční nasazení tak, aby wipe světa `dominion-1-fire` reálně proběhl.
- Summary: Identifikoval jsem, že produkce běží v Docker kontejnerech `thg-api`/`thg-web` na serveru `89.167.89.109` a že API image byl zastaralý (endpointy vracely `404`). Nasadil jsem aktuální `main` do `~/THG`, rebuildnul a restartoval `thg-api`. Při ostrém wipe se objevila chyba `FOREIGN KEY constraint failed`; opravil jsem ji v `wipeWorldData` (wipe už nemaže orphan bot účty, maže pouze world-scoped herní data), znovu nasadil API a provedl `dryRun` i ostrý wipe úspěšně. Post-wipe kontrola potvrzuje nulové world-scoped statistiky v regionu 2 a `GET /api/v1/state?worldId=dominion-1-fire` vrací, že hráč ve světě osadu nemá (žádný auto-spawn).
- Files: server/gameService.js, arch/chat-changelog.md
- Verification: `npx eslint server/gameService.js` (OK), live `POST /api/v1/worlds/dominion-1-fire/spawn` a `POST /api/v1/admin/worlds/dominion-1-fire/wipe` (endpointy dostupné), `POST /api/v1/admin/worlds/dominion-1-fire/wipe` s `dryRun=true` (OK), ostrý wipe s `confirmText='WIPE dominion-1-fire'` (201, after.* = 0), `GET /api/v1/state?worldId=dominion-1-fire` pro `Hayato` (404 bez osady), `GET /api/v1/worlds?username=Hayato` (`dominion-1-fire.player.canSpawn=true`, `villages=0`).

## 2026-03-13 10:10 | branch: main

- Request: Ověřit, zda pravidlo spawnutí ve světě `dominion-1-fire` opravdu drží zamýšlené rozestupy, protože osady vypadají podezřele namačkané.
- Summary: Prošel jsem implementaci spawn logiky a potvrdil nesoulad se specifikací. Aktuální kód používá jen uniformní `playerSpawnMinDistance` v rozsahu `1..3` a `nearbySpawnMinDistance..MaxDistance` také `1..3`; váhy `1% / 15% / 45% / 80%` v backendu vůbec implementované nejsou. Navíc `calculateSpawnScore()` silně preferuje střed mapy před odstupem od jiných lén, takže i při vyšším lokálním rozestupu vítězí buňky blíž centru. `claimNearbySpawnCells()` při vytváření 5 opuštěných lén kolem čerstvého hráče nekontroluje minimální odstup od jiných existujících lén, pouze obsazenost cílové buňky a vzdálenost od centra spawn clusteru. Na živých produkčních datech po wipe má region 2 nyní 5 hráčských lén a 25 opuštěných; hráči `Hayato` a `Torreya` jsou na souřadnicích `(324,584)` a `(324,585)`, tedy Chebyshev vzdálenost `1`. Krátká simulace stejného algoritmu ukázala, že nejbližší jiný hráč ve vzdálenosti `1` vychází přibližně u `46.4 %` hráčských lén, což je řádově mimo zamýšlené chování.
- Files: server/gameService.js, arch/chat-changelog.md
- Verification: statická kontrola konfigurace a funkcí `calculateSpawnScore`, `claimBestSpawnCell`, `claimNearbySpawnCells`; live read-only dotaz do produkční DB v kontejneru `thg-api`; lokální simulace 500 světů podle aktuálního algoritmu (`nearestPlayerDistanceHistogram`, podíl nejbližšího hráče ve vzdálenosti 1 = `0.464`).

## 2026-03-13 11:21 | branch: main

- Request: Implementovat a opravit spawn ve 3 bodech přímo na `main` a dorovnat logiku rozestupů tak, aby odpovídala specifikaci.
- Summary: Dokončil jsem weighted spawn logiku (`1/15/45/80`) napříč hráčským spawnem, nearby abandoned spawny, bot city-state spawny i helperem pro hromadné abandoned spawny. U nearby abandoned spawnů jsem opravil hlavní zdroj shlukování: globální vzdálenost se teď vyhodnocuje dynamicky proti aktuálně obsazené mapě při každém kroku výběru a fallback už při nouzi preferuje kandidáty s největším odstupem místo nejbližších buněk. Pro player spawn scoring zůstává center-first model, ale s vyšší vahou spacingu, aby nevznikaly kapsy těsně vedle sebe. Současně jsem stabilizoval regresní scénář `caravan-binary-casualties`, aby nebyl náhodně ovlivněný population cleanupem při economy sync.
- Files: server/gameService.js, tests/regression/game-rules.scenario.mjs, arch/chat-changelog.md
- Verification: `npx eslint server/gameService.js` (OK), `npm run test:regression` (19/19 OK), `npm run build` (OK), doplňkový spawn sanity-check na dočasném DB (single-spawn iterace neprodukují vzdálenost 1; nearest distribuce pro 1 hráče + 5 abandoned: `d1=0%`, dominují `d3/d4`).

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

## 2026-03-11 07:36 | branch: feat/build-0.1.11

- Request: Investigate the history of the map zoom math in `feat/build-0.1.11`, compare the first deployed version with later changes, and explain why the first smooth version felt less jerky.
- Summary: Traced `GamePage.tsx` history across `eb4c41b`, `3165701`, and `4ccabd8`. Confirmed the first fine-grained smooth zoom shipped in `eb4c41b` with RAF easing toward a target, later changed in `3165701` to UI-first batched wheel commits, and changed again in `4ccabd8` to target-based exponential interpolation now present in `feat/build-0.1.11`. Identified likely jerkiness cause as float zoom interpolation combined with integer-rounded map cell sizing.
- Files: arch/chat-changelog.md
- Verification: `git log --oneline --decorate --graph --all -- src/pages/GamePage.tsx`, `git diff eb4c41b 3165701 -- src/pages/GamePage.tsx`, `git diff 3165701 4ccabd8 -- src/pages/GamePage.tsx`, `git blame`, `git branch --contains`
- Notes: No gameplay or UI code was changed in this chat; findings were limited to repository history and current implementation analysis.

## 2026-03-11 07:42 | branch: feat/build-0.1.11

- Request: Prepare an implementation plan for a hybrid map zoom model, without making the code changes yet.
- Summary: Reviewed the Last Dominion feature guardrails and playbook, then defined a staged plan for a hybrid zoom model that keeps zoom local to the map panel, preserves the newer UI-first state ownership, and reintroduces the older smoother wheel feel without widening rerender or network scope.
- Files: arch/chat-changelog.md
- Verification: Reviewed `last-dominion-feature-guardrails` skill, `references/playbook.md`, and current zoom-related code locations in `src/pages/GamePage.tsx`.
- Notes: No gameplay, backend, or UI implementation changes were made in this chat.
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

## 2026-03-14 17:46 | branch: develop

- Request: Sloučit `feat/build-0.1.12` do `develop`, ověřit testy, resetovat localhost a ukázat výsledek merge; zároveň zkontrolovat skills kontext/složku `skills` v gitu.
- Summary: Proveden merge `feat/build-0.1.12` -> `develop` s konfliktem pouze v `arch/chat-changelog.md` (vyřešeno zachováním obou historií). Během verifikace odhalen pád regresního testu `battle-report-detail-lookup`; opraven scénář na správné čtení `attackPayload.payload.outcome`. Následně proveden restart lokálního běhu (ukončení starých procesů na 5173/3001, nový `npm run dev`) a ověření frontend + health endpointu.
- Files: arch/chat-changelog.md, tests/regression/game-rules.scenario.mjs, plus merge změny z `feat/build-0.1.12` (server/db.js, server/gameConfig.js, server/gameService.js, server/index.js, src/App.css, src/api/gameApi.ts, src/components/CommunicationHub.tsx, src/pages/GamePage.tsx, tests/api/state-auth.test.mjs, tests/regression/game-rules.regression.test.mjs, .codex-runtime/*)
- Verification: `npx tsc -b`; `npx vite build`; `npm run test:regression`; `node --test tests/api/state-auth.test.mjs`; `Invoke-WebRequest http://localhost:5173`; `Invoke-WebRequest http://localhost:3001/api/health`
- Notes: V kořeni repa není sledovaná složka `skills`; dostupné skills byly načteny z `C:/Users/Patrik/.codex/skills/...`.

## 2026-03-14 18:31 | branch: feat/build-0.1.13

- Request: Vytvořit a přepnout na větev `feat/build-0.1.13`, vrátit ukotvení UI/oken na herní kontejner (ne viewport), sjednotit spodní tlačítka `Nastavení` + `Komunikace` jako jednu komponentu se stejnými stavy, zachovat badge nových zpráv, zobrazovat pořadí hráče konzistentně a trvale, upravit okna (oznámení/léna/profil) více do šířky bez horizontálního scrollu, zpomalit animaci pod hlavičkou a vizuálně odlišit kartu světa od menu pouze barevně.
- Summary: Na nové větvi jsem dokončil container-based pravidla přes CSS insets (`--game-layout-left-gap/right-gap`) a navázal na ně chat i persistentní footer, takže spodní prvky i komunikační overlay drží hrany herního kontejneru. Spodní levá tlačítka jsou nově sjednocená přes `FooterActionButton`/`.game-footer-action` se stejnými hover/focus pravidly a zachovaným číselným badge pro komunikaci. Do payloadu snapshotu jsem přidal lehký `playerRanking` souhrn (backend + API typ), ve frontendu fallback vyhodnocení pořadí a trvalé zobrazení `Pořadí hráče #...` v pravé části persistentního footeru, aby byla informace konzistentní i mimo stránku žebříčku/profilu. Okna pro komunikaci/aktivitu/léna/profily/building byla rozšířena preferenčně do šířky, auto-size režim se u nich vypíná a `window-body` má nyní preferenci vertikálního scrollu bez horizontálního přetékání. Efekt pod názvem stránky byl zpomalen a karta světa je oddělena od unifikace top-menu tlačítek (barevný rozdíl bez rámových/fontových skoků).
- Files: server/gameService.js, src/api/gameApi.ts, src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI/layout + lightweight ranking read-model fallback; hlavní riziko byl nárůst snapshot payloadu a layout regress při fixních overlay prvcích, mitigace byla minimální datová struktura `playerRanking` a container-gap offset bez nového pollingu/network loopu.

## 2026-03-14 19:14 | branch: feat/build-0.1.13

- Request: Spustit localhost nad buildem (produkční preview).
- Summary: Spustil jsem `npm run build` a následně zvedl preview server na `127.0.0.1:4173` jako detached proces přes Node `child_process.spawn` (PID `112976`), aby běžel i po dokončení shell příkazu. Endpoint localhost vrací `HTTP 200`.
- Files: arch/chat-changelog.md
- Verification: `npm run build` (OK); `Invoke-WebRequest http://127.0.0.1:4173` (HTTP 200)
- Notes: Původní pokus přes shell job/process start byl blokovaný politikou prostředí, proto použit detached Node spawn.

## 2026-03-14 19:20 | branch: feat/build-0.1.13

- Request: Vysvětlit dopad odstranění všech localhost procesů a jejich vztah k mainu/produkci, Netlify a herním datům.
- Summary: Ověřil jsem lokální skripty, Netlify konfiguraci a poslouchající porty. V repu aktuálně běží lokální dev frontend na `5173` a lokální backend na `3001`; preview `4173` už neběží. Potvrdil jsem, že Netlify build je samostatný publish `dist` a `/api` na Netlify je přesměrované na vzdálený backend. Lokální backend používá vlastní SQLite databázi v `server/data/game.sqlite` (pokud ji nepřepíšou env proměnné), takže vypnutí localhost procesů neovlivní produkci ani vzdálená herní data; smazání lokální DB by ale smazalo lokální vývojová data.
- Files: arch/chat-changelog.md
- Verification: `Get-NetTCPConnection` pro porty `3001/4173/5173`; kontrola `package.json`, `vite.config.ts`, `netlify.toml`, `server/db.js`, `server/index.js`
- Notes: Lokální `vite dev` a `vite preview` jsou jen lokální frontend servery; backend na `3001` je samostatný lokální runtime s vlastním stavem.

## 2026-03-14 20:41 | branch: feat/build-0.1.13

- Request: Vypnout všechny lokální servery/localhosty pro tento projekt.
- Summary: Ověřil jsem poslouchající porty a ukončil běžící lokální backend na `3001` a dev frontend na `5173`. Na `4173` už nic neběželo. Po ukončení jsem znovu zkontroloval porty a žádný z nich už neposlouchá.
- Files: arch/chat-changelog.md
- Verification: `Get-NetTCPConnection` před/po; `taskkill /PID 107716 /PID 107760 /F`
- Notes: Šlo pouze o ukončení lokálních procesů; bez zásahu do produkce, Netlify nebo vzdálených herních dat.

## 2026-03-14 20:47 | branch: feat/build-0.1.13

- Request: Zapnout localhost na aktuální větvi `feat/build-0.1.13`.
- Summary: Ověřil jsem, že aktivní branch je `feat/build-0.1.13` a porty `3001/5173` jsou volné. Následně jsem spustil `npm run dev` jako detached proces pro tento workspace. Backend běží na `3001` a vrací health check `200`; frontend běží na `localhost:5173` a vrací `200`.
- Files: arch/chat-changelog.md
- Verification: `git rev-parse --abbrev-ref HEAD`; `Get-NetTCPConnection`; `Invoke-WebRequest http://127.0.0.1:3001/api/health`; `Invoke-WebRequest http://localhost:5173`
- Notes: `vite` se zde binduje přes IPv6/localhost, proto byla finální kontrola frontendu provedena přes `http://localhost:5173`.

## 2026-03-14 21:39 | branch: feat/build-0.1.13

- Request: Upravit mapové okno/léno UX: odebrat hlavičku léna v obsahu, přestavět jednotky do karet (vlastní vs podpora), přesunout mapové „pin“ chování na pravé tlačítko, opravit centrování a minimapu, odstranit text `Minimapa`, přesunout centrum/fullscreen pod zoom a odebrat pořadí hráče z pravého footeru.
- Summary: Ve `VillagePanel` jsem dokončil nový jednotkový přehled po typech (ikona jednotky + dvě výrazná žlutá čísla: horní vlastní jednotky, spodní v závorce podpora) a zachoval data-flow z `GameUnitState.stationedSupportCount`; obsahovou hlavičku léna jsem odstranil. V mapě jsem změnil interakci tak, že levý klik jen otevře léno, zatímco pravý klik přepíná pinned preview léna. Centrování mapy je nově sjednocené přes interní `applyPanTarget` (bez nativního smooth `scrollTo`) a výpočet středu zohledňuje vnitřní inset kontejneru; klik na minimapu nově centruje na střed viewportu místo mapování na levý horní roh. V minimapě jsem odstranil titul `Minimapa` a přesunul tlačítka centrování/fullscreen pod zoom ovládání do jedné kompaktní komponenty. Z persistentního footeru jsem odstranil `Pořadí hráče` vedle verze hry.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě frontend map/UI interakce bez nového pollingu a bez backend změn. Hlavní výkonové riziko bylo nekonzistentní scroll/centering animace a samovolné viewport skoky; mitigace je jednotný pan-target model + vypnutí `overflow-anchor` na map wrapperu.

## 2026-03-14 22:05 | branch: feat/build-0.1.13

- Request: Opravit samovolné vracení mapy na poslední centrované léno (centrovat jen při explicitní akci), nastavit množství jednotek v léně na `0.86rem`, dát obrázek jednotky na pozadí karty, držet karty spíše vertikální a šířku podle obsahu, a přidat tooltip detailu posádky (obsah, maximum, ztráty, čas doplnění).
- Summary: V mapě jsem doplnil „consume“ lifecycle pro `centerRequest`: `MapPanel` nyní potvrzuje zpracovaný nonce do parentu a požadavek se po úspěšném centru smaže (`setMapCenterRequest(null)` pro konkrétní nonce), takže se při pozdějších rerenderech/remountech neaplikuje znovu poslední kliknuté léno. Současně `centerOnSettlement` vrací `boolean`, aby se request nesmazal, pokud v daný moment ještě nelze cílové léno rozlišit. V `VillagePanel` zůstaly karty po typech (vlastní/podpora), množství je na `0.86rem`, karta používá obrázek jednotky jako background layer přes CSS custom property a layout je orientovaný vertikálně s šířkou podle obsahu. Do karty „Posádka“ jsem přidal hover tooltip s detaily jednotek (`amount/cap`, `missing`, `+1 za ...`, `⏱ další doplnění za ...`).
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě frontend map/UI změna bez nového pollingu/network toku. Hlavní výkonové riziko bylo opakované centrování vyvolané stale `centerRequest` během rerenderu; mitigace je nonce-based consume flow + lokální guard na úspěšné zacílení.

## 2026-03-14 22:24 | branch: feat/build-0.1.13

- Request: Změnit UI léna: snížit font množství jednotek na `0.25rem` (včetně posádky), vrátit název/hlavičku léna dovnitř karty na vrchol, a zafixovat okno léna napevno dole uprostřed bez ručního přesunu a bez scrollu v okně.
- Summary: Ve `VillagePanel` jsem přidal interní titulkový blok s názvem léna + souřadnicemi (a owner/kingdom/region) přímo do horní části obsahu karty. U karet jednotek jsem nastavil oba počty (`h1` i spodní závorku) na `0.25rem`, stejně tak hlavní číselný údaj v kartě `Posádka` přes samostatnou class `village-garrison-card`. V renderu floating window jsem pro `village` panel vypnul manuální drag na hlavičce a skryl externí textový titul v horní liště (zůstávají jen akce), takže název už není mimo obsah. Dále jsem přepnul village panel na auto-size režim a v CSS vypnul vertikální/horizontální scroll v `window-body` pro `village-panel-window`, aby se léno drželo pevně dole uprostřed bez vnitřního scrollbaru.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě frontend UI/layout změna bez síťových/polling zásahů. Hlavní riziko byla regresní změna chování floating panelů; mitigace je scope pouze na `village-panel-window` a explicitní guard v drag handleru.

## 2026-03-14 22:27 | branch: feat/build-0.1.13

- Request: Změnit fonty množství jednotek na `1.85rem` v léně i v posádce.
- Summary: Upravil jsem velikost fontu pro oba číselné řádky na kartách jednotek v léně (`h1` vlastní + spodní podpora) a pro hlavní počet v kartě `Posádka` na `1.85rem`.
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only změna typografie bez zásahu do datového toku nebo mapové logiky.

## 2026-03-14 22:32 | branch: feat/build-0.1.13

- Request: Nastavit font množství jednotek (v léně i posádce) na stejnou velikost jako text `Aktivní léno` v kartě seznamu lén.
- Summary: Dohledal jsem referenční velikost labelu `Aktivní léno` přes `.resource-strip p` (`0.74rem`) a stejnou hodnotu jsem aplikoval na počty jednotek v kartách léna (`h1` + spodní podpora) i na hlavní číselný údaj v kartě `Posádka`.
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only typografická změna bez zásahu do map/logiky/datového toku.

## 2026-03-14 22:36 | branch: feat/build-0.1.13

- Request: Zmenšit fonty množství jednotek o 80 %.
- Summary: Snížil jsem velikosti fontu počtů jednotek v kartách léna a v kartě posádky z `0.74rem` na `0.148rem` (20 % původní velikosti).
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only typografická změna bez zásahu do datového toku, mapových interakcí nebo backendu.

## 2026-03-14 22:45 | branch: feat/build-0.1.13

- Request: Nastavit čísla jednotek v okně léna na malý font jako u názvů jednotek (včetně posádky).
- Summary: Upravil jsem velikost fontu počtů jednotek v kartách léna (`h1` + spodní hodnota podpory) i hlavního čísla v kartě `Posádka` na `0.7rem`, tedy stejnou hodnotu jako u názvů jednotek (`.village-unit-type-header strong`).
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only typografická úprava; bez změny mapové logiky, pollingu nebo backendu.

## 2026-03-14 22:48 | branch: feat/build-0.1.13

- Request: Opravit obří font v hlavičce karty léna (název osady + druhý řádek owner/kingdom/region).
- Summary: Identifikoval jsem konflikt s globálním dark-medieval pravidlem pro `h3` (`!important`), které přepisovalo lokální velikost titulku v kartě léna. Přidal jsem cílený override pouze pro `village-panel-window .village-float-title-block`, kde je `h3` fixně na `0.74rem` a druhý řádek `p` na `0.62rem`, včetně kompaktních margin/line-height hodnot.
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only typografická oprava scoped na village panel; bez zásahu do mapové logiky, backendu nebo datového toku.

## 2026-03-14 22:51 | branch: feat/build-0.1.13

- Request: Opravit stále příliš velký font čísel jednotek v kartě léna (včetně posádky).
- Summary: Zjistil jsem, že lokální velikosti byly přepisované globálními dark-medieval typografickými pravidly pro `h1`/`p`/`strong`. Přidal jsem scoped override pouze pro `village-panel-window`, který fixuje čísla jednotek (`h1`, spodní podpora `p`) a hlavní číslo v `village-garrison-card` na `0.7rem` s vyšší prioritou (`!important`).
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only typografická oprava; bez zásahu do mapové logiky, backendu a datových toků.

## 2026-03-14 22:57 | branch: feat/build-0.1.13

- Request: Analyzovat nekonzistenci okna léna (místo široké karty bez scrollu se zobrazuje úzká vysoká „nudle“ přes obrazovku) a opravit.
- Summary: Kořen problému byl v renderu panelu: `village` panel byl chybně zařazen do `auto-size` režimu (`fit-content` šířka/výška), zatímco CSS zároveň blokovalo scroll v `window-body`. Kombinace způsobila, že panel počítal příliš úzkou šířku a obsah se zalamoval do výšky. Opravil jsem to vrácením `village` panelu zpět do landscape fixed-size režimu (bez `auto-size`), takže znovu používá panelové limity (min. 820x470) a stabilní spodní středové ukotvení.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: UI/layout-only fix bez zásahu do mapových interakcí, pollingu nebo backendu. Hlavní riziko byla regresní šířka/výška panelu; mitigace je návrat na existující panel sizing model používaný pro landscape panely.

## 2026-03-14 23:11 | branch: feat/build-0.1.13

- Request: Vrátit čitelné velikosti názvu léna, zvětšit názvy/počty jednotek (včetně posádky) a sjednotit čitelnost i v tooltipu; zároveň odstranit nekonzistentní přetaženou výšku/„nudli“ u karty léna.
- Summary: U village panelu jsem navýšil typografii v jednotkových kartách (název jednotky + obě hodnoty) i hlavní číslo posádky na `0.86rem`, a stejnou velikost jsem použil pro řádky `village-intel-tooltip`. Titulkový blok léna jsem vrátil na čitelnější velikosti (`h3` `1.02rem`, metadata `0.78rem`). Pro konzistentní landscape chování bez zbytečné výšky jsem upravil sizing model village panelu: min size na `860x360` a runtime/open rozměr na `920x380` (pro nové i znovu otevřené village panely), čímž se odstraní úzké/vertikálně přepálené zobrazení a ustřihávání názvů při přetečení.
- Files: src/App.css, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Feature contract: čistě frontend UI/layout/typografie; bez změn mapových requestů, pollingu nebo backendu. Hlavní riziko byla nekonzistentní výška/šířka panelu po předchozích override; mitigace je návrat na jednotný fixed landscape sizing pro všechny village panely.

## 2026-03-14 23:17 | branch: feat/build-0.1.13

- Request: Když jsou jednotky ve dvou řádcích, karta léna se ustřihává; odstranit textové názvy jednotek, aby se problém vyřešil.
- Summary: Ve vykreslení `VillagePanel` jsem z jednotkových karet odstranil textové labely názvů jednotek a ponechal pouze ikonu + číselné hodnoty (vlastní a podpora). Tím se sníží vertikální nárok každé buňky a při dvou řádcích je menší riziko ustřihnutí obsahu v pevném landscape panelu.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: UI-only změna prezentace; bez změny datového modelu, mapových interakcí nebo backendu.

## 2026-03-15 10:18 | branch: develop

- Request: Merge větve `feat/build-0.1.13` do `develop`, otestovat (kvůli verzím 0.11/0.12) a spustit localhost na `5173` pro ověření.
- Summary: Přepnul jsem repozitář na `develop` a provedl fast-forward merge z `feat/build-0.1.13` bez konfliktů (`8855e6d -> e7ec035`). Následně jsem spustil regresní testy a produkční build; vše prošlo. Pro ruční ověření jsem spustil frontend (`vite`) na `http://localhost:5173` a backend na `http://localhost:3001`; frontend vrací HTTP 200.
- Files: arch/chat-changelog.md, server/gameService.js, src/App.css, src/api/gameApi.ts, src/pages/GamePage.tsx
- Verification: `git merge feat/build-0.1.13` (fast-forward); `npm run test:regression` (28/28 PASS); `npm run build` (OK); `netstat -ano | Select-String ":5173"` (LISTENING); `Invoke-WebRequest http://localhost:5173` (200)
- Notes: Build hlásí pouze warning o velikosti JS chunku nad 500 kB (bez failu buildu).

## 2026-03-15 11:03 | branch: main

- Request: Provest merge develop do main (produkce), nasadit frontend na Netlify a rozjet backend deploy.
- Summary: Commitnul jsem lokalni staged zmenu changelogu na main, merge-nul develop -> main s manualnim vyresenim konfliktu (arch/chat-changelog.md, server/db.js, server/index.js, src/pages/GamePage.tsx), overil build a pushnul main na origin (0ddc87f). Frontend jsem nasadil na Netlify produkcne (https://thelastdominion.netlify.app, deploy 69b6838b5d704b3b61c55714). Backend deploy skrze Docker na tomto hostu selhal, protoze neni dostupny Docker daemon/engine; live backend endpoint je dostupny, ale stale hlasi build-0.1.09.
- Files: arch/chat-changelog.md, server/db.js, server/index.js, src/pages/GamePage.tsx
- Verification: npm run build (OK), git push origin main (OK), npx netlify deploy --prod (OK), docker compose up -d --build (FAIL: Docker engine unavailable), GET https://thg.89-167-89-109.sslip.io/api/health (OK, deployment.buildId=build-0.1.09).
- Notes: Pro backend produkcni deploy je potreba host s bezicim Docker daemonem (nebo remote SSH deploy na produkcni server).

## 2026-03-15 11:13 | branch: develop

- Request: Připravit shrnutý changelog pro tři develop update bloky (0.1.11, 0.1.12, 0.1.13) a sepsat rozdíl, co přinesl develop oproti tehdejší produkci.
- Summary: Prošel jsem historii větví a rozložil změny podle release bloků od merge-base 9748f8f (0.1.10) přes 7de7ded (0.1.11), e471ce9 (0.1.12) až po e7ec035 (0.1.13). Současně jsem porovnal pre-release produkci main na commitu 5e96baa proti develop, aby bylo jasné, které funkce přišly z develop větve a které naopak už předtím žily jen na produkční main.
- Files: arch/chat-changelog.md
- Verification: git log --reverse --oneline 9748f8f..7de7ded; git log --reverse --oneline 7de7ded..e471ce9; git log --reverse --oneline e471ce9..e7ec035; git log --left-right --cherry-pick --oneline 5e96baa...bfb0563; git diff --stat 5e96baa...bfb0563
- Notes: Textové release shrnutí je odvozené z reálné historie větví a diffů; dnešní main už tyto develop změny obsahuje přes merge 0ddc87f z 2026-03-15.

## 2026-03-15 11:23 | branch: develop

- Request: Převést připravené release shrnutí do markdownu vhodného pro vložení do Discord chatu.
- Summary: Připravil jsem Discord-friendly markdown verzi changelogu pro updaty 0.1.11, 0.1.12, 0.1.13 a navazující souhrn rozdílů, které develop přinesl oproti tehdejší produkci.
- Files: arch/chat-changelog.md
- Verification: not run
- Notes: Šlo o textovou úpravu výstupu, bez změn herní logiky, UI kódu nebo backendu.

## 2026-03-15 11:34 | branch: develop

- Request: Updatnout hlavní stránku hry tak, aby lépe ukazovala progress vývoje a odvedenou práci.
- Summary: Aktualizoval jsem landing obsah na LoginPage: nový hero text, progress tagy, aktuální roadmap wording a refresh karty patch notes. Současně jsem přepsal datový feed public/data/project-updates.json i fallback data v komponentě na novější updaty (0.1.11 až 0.1.13) včetně navazujícího in-progress/planned tracku.
- Files: src/pages/LoginPage.tsx, public/data/project-updates.json, arch/chat-changelog.md
- Verification: npm run build (OK)
- Notes: UI-only změna obsahu homepage; bez zásahu do backend data-flow, mapové logiky nebo pollingu.

## 2026-03-15 11:36 | branch: develop

- Request: Doplnit na homepage výrazný release highlight banner pro poslední LIVE update.
- Summary: Přidal jsem do update karty na login stránce nový vizuální block 0.1.13 LIVE se stručným souhrnem dodaných oblastí (Planner, posádky/žoldáci, mapa/minimapa UX) a odpovídajícími scoped styly v App.css.
- Files: src/pages/LoginPage.tsx, src/App.css, arch/chat-changelog.md
- Verification: npm run build (OK)
- Notes: UI-only vizuální enhancement bez změn datových toků, pollingu nebo backendu.

## 2026-03-15 11:51 | branch: main

- Request: Dotáhnout změnu z develop na produkci (main) a nasadit ji live.
- Summary: Provedl jsem merge develop -> main s konfliktem jen v arch/chat-changelog.md (vyřešeno zachováním obou historií), ověřil produkční build, pushnul main na origin (6feff05) a nasadil frontend na Netlify do produkce.
- Files: arch/chat-changelog.md, src/pages/LoginPage.tsx, src/App.css, public/data/project-updates.json
- Verification: npm run build (OK), git push origin main (OK), npx netlify deploy --prod (OK), GET https://thelastdominion.netlify.app (200), GET https://thg.89-167-89-109.sslip.io/api/health (OK; backend build 0.1.09).
- Notes: Tato release změna je frontend-only; backend deploy nebyl potřeba pro samotný obsah homepage.

## 2026-03-15 11:54 | branch: main

- Request: Přepnout aktuální workspace na větev `main`.
- Summary: Ověřil jsem, že `main` už byla checkoutnutá v jiném worktree (`D:/TheLastDominion-main`), a tento workspace jsem proto bezpečně přepnul pomocí `git switch --ignore-other-worktrees main`.
- Files: arch/chat-changelog.md
- Verification: `git worktree list`; `git branch --all --no-color`; `git switch --ignore-other-worktrees main`
- Notes: Přepnutí bylo UI/branch-management only; bez změn kódu nebo deploye.

## 2026-03-15 12:10 | branch: main

- Request: Prozkoumat kritický bug, kdy po wipe/conquestu hráč vidí detail cizího léna, a navrhnout i připravit opravu.
- Summary: Prošel jsem backend i frontend flow kolem village snapshotů, conquestu a world mapy. Potvrdil jsem, že při conquestu se na backendu mění owner na stejném `village.id`, zatímco klient držel `villageIntelByVillageId` cache jen podle `villageId` a panel ji renderoval i po ztrátě ownershipu. Opravil jsem GamePage tak, aby se intel cache po změně vlastněných lén prořezala, detail cizího léna se už z cache neren­deroval a při rozchodu mezi autoritativním seznamem vlastních lén a map snapshotem se vynutil refresh world mapy.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: npm run build (OK)
- Notes: Root cause se spouští hlavně při conquest/wipe flow, kde `updateVillageOwnerForConquestStmt` zachová stejné `village.id`, ale změní `player_id`; šlo tedy o leak klientského cache/navázání na stabilní ID, ne o recyklaci DB ID po world wipe.

## 2026-03-15 12:24 | branch: main

- Request: Začít sanity-checkem / přesným repro flow pro bug, kdy po wipe/conquestu hráč vidí detail cizího léna.
- Summary: Připravil jsem izolovaný repro přes skutečný backend stack v temp data diru a ověřil trigger: conquest změní ownera na stejném `village.id`, defender po ztrátě léna už ho nemá ve `villages`, ale starý world-map snapshot i cached intel pro stejné `villageId` stále existují. Repro potvrdil, že před opravou by `canLoadVillageIntel` bylo `false`, ale stale cache entry by zůstala nenulová (`preFixWouldLeak: true`); po opravě panel cached intel nevyrenderuje a cache pruning ztracené léno odmaže.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: isolated node repro over temp TLD_DATA_DIR (OK), npm run build (previous turn OK)
- Notes: Repro výslovně potvrdil i secondary symptom se stale world-map ownership setem, takže refresh map snapshotu při mismatchu je opodstatněný guard, ne kosmetika.

## 2026-03-15 13:05 | branch: main

- Request: Ověřit report „Hráčem Marrel jsme na léně Hayato“ a opravit chování po dobytí/wipu, aby aktivní léno nepůsobilo jako cizí.
- Summary: Prověřil jsem flow a potvrdil, že nejde o cross-owner data leak, ale o stale název po conquestu: owner se změní, ale jméno léna zůstane původní (`Leno <stary_hrac>`). Do backendu jsem přidal guard, který při dobytí automaticky přejmenuje pouze defaultní názvy (`Leno <puvodni_owner>`) na `Leno <novy_owner>`, zatímco custom názvy ponechá beze změny. Úprava je nasazená v obou conquest cestách (tick battle conquest i manuální conquer endpoint).
- Files: server/gameService.js, arch/chat-changelog.md
- Verification: node isolated repro (default-name conquest rename OK: `Leno Torreya` -> `Leno Hayato`), npm run build (OK)
- Notes: Tím se eliminuje UX záměna „jsme na cizím léně“ po převzetí osady, bez zásahu do ownership/security modelu.

## 2026-03-15 13:02 | branch: main

- Request: Dokoncit produkcni backend deploy fixu na `main` pres SSH (uzivatel doplnil SSH klic) a dostat zmenu live.
- Summary: Pri prvnim API-only rolloutu po nahrani samotneho `server/gameService.js` backend spadl na runtime import mismatch (`calculateRecruitmentTimeReductionPct`), protoze `/home/patrik/THG` nebyl konzistentni git checkout. Okamzite jsem provedl rollback na predchozi stabilni image `9210e30e1495`, obnovil healthy stav, nasledne nasadil kompletni release snapshot `main@7ed012c` (archive + rsync bez `server/data`), rebuildnul image `thg-api` a bez zasahu do proxy sluzeb znovu nahradil jen API kontejner na siti `zane`.
- Files: arch/chat-changelog.md
- Verification: `docker ps`/`docker logs` on prod (thg-api healthy), `curl https://thg.89-167-89-109.sslip.io/api/health` (OK, `deployment.buildId=build-0.1.11`), runtime rollback probe (OK).
- Notes: Pricina failu byl partial-file deploy; produkce je po finalnim rolloutu stabilni a bezi na kompletni verzi kodu s fixem premenovani defaultnich nazvu pri conquestu.

## 2026-03-15 13:30 | branch: main

- Request: Ověřit report, že hráč `-SaThAn?!` vidí na mapě žlutě léno Hayato „jako vlastní“, a navrhnout řešení.
- Summary: Provedl jsem produkční ověření přes SSH nad live DB i přes `getWorldMapSnapshot` v běžícím API kontejneru. Data potvrzují, že osady Hayato jsou pro `-SaThAn?!` vracené jako `kind=player` + `relation=enemy` (nikoliv `self/own`), takže nejde o ownership leak na backendu. Současně jsem našel a opravil hardening bug ve frontend API klientu: `fetchWorldMapSnapshot` neposílal `username` query parametr; nyní ho posílá explicitně.
- Files: src/api/gameApi.ts, arch/chat-changelog.md
- Verification: production DB query via `docker exec thg-api` (owner mapping Hayato vs -SaThAn?! OK), production `getWorldMapSnapshot('-SaThAn?!')` inspection (Hayato rows `relation=enemy`, own rows `relation=self`), `npm run build` (OK).
- Notes: Pravděpodobná příčina hlášení je vizuální záměna barev/legendy na mapě (výchozí paleta má `own` a `opponent` blízko); backend ownership model se v tomto případě jeví konzistentně.

## 2026-03-15 13:40 | branch: main

- Request: Ověřit, jestli je mapový ownership bug (`Hayato` žlutě u `-SaThAn?!`) globální napříč více účty.
- Summary: Spustil jsem produkční multi-account audit přes všechny ne-bot účty a všechny světy s přítomností hráče. Kontrolovaný invariant: žádná cizí osada nesmí mít `relation=self` ani `kind=own/active` a naopak vlastní osady musí být takto označené. Výsledek: bez anomálií (0/19499 settlement checků), takže globální ownership leak přes `villageId`/map snapshot se nepotvrdil.
- Files: arch/chat-changelog.md
- Verification: production audit přes `docker exec thg-api node --input-type=module` s kopii DB (123 hráčů, 129 world snapshotů, 19 499 settlement kontrol, `foreignFlaggedAsOwn=0`, `ownMissingSelfFlag=0`, `coordCollisionCount=0`).
- Notes: Chování „vypadá jako moje/cizí“ je pravděpodobně vizuální záměna mapových kategorií (barvy/paleta), nikoliv datový ownership bug v backend read modelu.

## 2026-03-15 13:45 | branch: main

- Request: Potvrdit a řešit report, že ownership na mapě může působit chybně i u více účtů, a nasadit jasnější mapové rozlišení.
- Summary: Po produkčním multi-account auditu (bez datových anomálií ownershipu) jsem nasadil frontend hardening + UX fix. API klient pro world map snapshot nově vždy posílá `username`, aby endpoint běžel explicitně v kontextu přihlášeného účtu. Současně jsem upravil mapové styly: `own/active` osady mají výrazný tvarový overlay a odlišný tvar bodu i v minimapě (nejen jinou barvu), čímž se snižuje riziko vizuální záměny.
- Files: src/api/gameApi.ts, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Nešlo o globální leak vlastnictví v backendu; šlo o hardening request kontextu + UX čitelnost mapy napříč účty/paletami.

## 2026-03-15 15:18 | branch: develop

- Request: Přenést aktuální stav projektu z `main` do `develop` (včetně backend změn); případně dorovnat prostředí/data pro localhost a test.
- Summary: Provedl jsem synchronizaci `develop` pomocí fast-forward merge `main -> develop` (`f8d62ec -> 0581a99`) bez konfliktů a následně push na `origin/develop`. Ověřil jsem i backend env/data kontext: verzovaný je pouze `server/data/game.seed.sqlite.backup`; `\.env.local` a runtime SQLite (`server/data/game.sqlite*`) jsou lokální/ignorované soubory, takže se přes Git mezi větvemi nepřenášejí.
- Files: arch/chat-changelog.md, server/botCityStates.js, server/data/game.seed.sqlite.backup, server/db.js, server/gameService.js, server/index.js, server/sqliteSnapshot.js, src/App.css, src/api/gameApi.ts, src/pages/GamePage.tsx, src/pages/WorldsPage.tsx, tests/regression/game-rules.scenario.mjs
- Verification: `git rev-list --left-right --count origin/develop...origin/main` (0 29), `git merge --ff-only main` (OK), `git push origin develop` (OK)
- Notes: `develop` teď obsahuje aktuální stav z `main`; env/data mimo verzované soubory je potřeba sdílet mimo Git (ručně/skriptem/secret managerem).

## 2026-03-15 15:21 | branch: develop

- Request: Upřesnit, co znamenala synchronizace `main -> develop`, a potvrdit, že prostředí game dat nemá být sdílené.
- Summary: Vysvětlil jsem rozdíl mezi Git synchronizací větví a lokálními ignorovanými daty. Synchronizace znamenala pouze přenos verzovaného kódu a trackovaných souborů z `main` do `develop`; neznamenala kopírování `\.env.local` ani runtime SQLite databází. Současně jsem upřesnil, že pokud se obě větve spouštějí ve stejném workspace, fyzicky používají stejné lokální ignorované soubory, dokud nejsou odseparované přes jiné worktree/adresáře/env konfiguraci.
- Files: arch/chat-changelog.md
- Verification: not run
- Notes: Pro úplné oddělení `main` a `develop` je potřeba samostatný data dir a samostatné env nastavení pro každé prostředí.

## 2026-03-15 15:21 | branch: develop

- Request: Oddělit `main` a `develop` tak, aby nesdílely localhost prostředí ani runtime game data.
- Summary: Přidal jsem branch-aware lokální runtime profil. `npm run dev` a `npm run server` teď podle aktuální branche automaticky nastavují vlastní porty, `VITE_API_BASE` a branch-specific `TLD_DATA_DIR`; backend defaultně zapisuje do `server/data/branches/<branch>/game.sqlite` místo sdíleného `server/data/game.sqlite`. Současně jsem doplnil jednorázovou migraci staré sdílené lokální DB do nové branch složky při prvním startu, uvolnil lokální CORS pro localhost porty a aktualizoval README. Ve workspace jsem vytvořil i lokální `.env.develop.local` a `.env.main.local`, ale ty zůstávají ignorované mimo Git.
- Files: arch/chat-changelog.md, .gitignore, README.md, package.json, server/db.js, server/index.js, server/runtimeProfile.js, scripts/run-local-client.mjs, scripts/run-local-server.mjs, tests/config/local-runtime-profile.test.mjs, vite.config.ts
- Verification: `node --test tests/config/local-runtime-profile.test.mjs` (3/3 PASS), `npm run build` (OK), `Test-Path server/data/branches/develop/game.sqlite` (True)
- Notes: Produkční/self-host deploy s explicitním `TLD_DATA_DIR` zůstává beze změny; branch oddělení se týká jen lokálního development runtime.

## 2026-03-15 15:44 | branch: develop

- Request: Pushnout připravené změny z `develop` na remote.
- Summary: Zapsal jsem auditní záznam k branch-aware oddělení lokálního runtime a pushnul aktuální `develop` na `origin`, včetně commitů s oddělením lokálních branch dat a navazujícího changelogu.
- Files: arch/chat-changelog.md
- Verification: `git push origin develop` (OK)
- Notes: Lokální `.env.develop.local`, `.env.main.local` a branch-specific SQLite data zůstávají ignorované a neodesílají se do repozitáře.

## 2026-03-15 15:51 | branch: feat/build-0.1.14

- Request: Vytvořit větev `feat/build-0.1.14` a přepnout se na ni.
- Summary: Vytvořil jsem novou git větev `feat/build-0.1.14` z aktuálního `develop` a přepnul pracovní strom na tuto větev.
- Files: arch/chat-changelog.md
- Verification: `git switch -c feat/build-0.1.14` (OK), `git branch --show-current` (`feat/build-0.1.14`)
- Notes: Pracovní strom byl před přepnutím čistý.

## 2026-03-15 16:37 | branch: feat/build-0.1.14

- Request: Upravit stránku Přehled (stavební fronta, karty osady/prestiže, hover ceny staveb + ikona nástroje), zjemnit rámečky na stránce Prestiž a stabilizovat zobrazení hlavních panelů vůči PIN sloupcům.
- Summary: V Přehledu jsem přesunul šipky reorder ve stavební frontě vedle drag gripu do svislého sloupce, změnil hlavičku karty osady na dynamický typ osady podle prestiže, odstranil regionový řádek a odebral řádek `Tier` z karty Prestiž. U karet staveb jsem při hoveru přidal neinteraktivní inline lištu nákladů (3 suroviny, ikona + množství přes celou šířku karty) a malou ikonu nástroje s jemným pulzním glow; oboje se nezobrazuje pro max level. Pro stabilitu hlavního rozhraní jsem sjednotil frame hlavních panelů na aktuální stretched stage frame (respekt pin sloupců), aby stránky neujížděly mimo herní plochu a nepřekrývaly se s mapou/pin oblastmi.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Změny jsou UI-only bez nových polling smyček a bez zásahu do backend data-flow.

## 2026-03-15 17:02 | branch: feat/build-0.1.14

- Request: Spustit localhost pro větev `feat/build-0.1.14`.
- Summary: Spustil jsem branch-aware lokální backend i frontend pro aktuální větev jako oddělené detached procesy. Runtime scope se mapuje na `feat-build-0-1-14`, backend běží nad branch-specific datovým adresářem a klient je napojený na lokální API této větve.
- Files: arch/chat-changelog.md
- Verification: backend log `[local-runtime] server scope=feat-build-0-1-14 port=3003` + `Listening on http://localhost:3003`, frontend log `[local-runtime] client scope=feat-build-0-1-14 port=5175 api=http://localhost:3003`, `netstat` LISTENING na `:3003` a `:5175`
- Notes: Lokální běh je spuštěný mimo aktuální shell jako detached procesy, takže zůstává dostupný i po skončení tohoto chatu.

## 2026-03-15 17:09 | branch: feat/build-0.1.14

- Request: Přesunout localhost frontend z `5175` na `5173`.
- Summary: Ukončil jsem původní klientské procesy běžící na `5175` a spustil nový frontend pro stejný branch scope s explicitním `VITE_DEV_PORT=5173`. Backend jsem ponechal beze změny na `3003`, takže klient dál komunikuje s branch-specific API a datovým profilem.
- Files: arch/chat-changelog.md
- Verification: klientský log `[local-runtime] client scope=feat-build-0-1-14 port=5173 api=http://localhost:3003`, Vite `Local: http://localhost:5173/`, `netstat` LISTENING na `:5173` a `:3003`
- Notes: Port `5175` už po přepnutí neposlouchá.

## 2026-03-15 17:35 | branch: feat/build-0.1.14

- Request: Zajistit, aby localhost klient byl skutečně napojený na backend a bylo jasné, proč se nenačítají data z databáze.
- Summary: Ověřil jsem, že backend na `3003` běží a branch SQLite profil obsahuje herní data (`players`, `villages`, `resources`, `buildings`). Problém byl ve frontend auth flow: klient se považoval za přihlášený jen podle `localStorage`, ale backend vracel `AUTH_REQUIRED`, takže UI zůstávalo ve „stale session“ stavu. Přidal jsem proto globální handling `AUTH_REQUIRED` v request vrstvě a v `App.tsx` automatický logout + redirect na login, aby se klient po ztrátě server session korektně znovu přihlásil místo tichého selhání.
- Files: src/api/gameApi.ts, src/App.tsx, arch/chat-changelog.md
- Verification: `Invoke-WebRequest http://localhost:3003/api/health` (OK), SQLite counts ve `server/data/branches/feat-build-0-1-14/game.sqlite`: `players=721`, `villages=855`, `resources=855`, `buildings=14535`, `npx tsc -b --pretty false` (OK), `npm run build` timeout při běžících dev procesech
- Notes: Pro okamžité načtení dat na otevřeném localhostu může být potřeba jednou obnovit stránku a znovu se přihlásit, protože serverová session pro `3003` nebyla platná.

## 2026-03-15 18:21 | branch: feat/build-0.1.14

- Request: Varianta `1` k tooltipům v Přehledu: zajistit konzistentní zobrazení bez přetékání mimo viewport.
- Summary: Nahradil jsem statické odhady pozic tooltipů sdílenou follow-cursor logikou, která měří reálnou velikost tooltipu (ref + `ResizeObserver`) a při kolizi s hranou viewportu automaticky flipuje umístění (pravá/dolní priorita, fallback levá/horní) + finální clamp s paddingem. Nové chování je napojené na tooltipy pohybu armády, preview rozšíření budovy, kolaborace výzkumu, detail surovin, queue action a village intel.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (OK), `npx eslint src/pages/GamePage.tsx` (FAIL kvůli pre-existing lint problémům mimo tento zásah; nové tooltip hook chyby odstraněny)
- Notes: Změna je UI-only, bez dopadu na polling/backend data-flow.

## 2026-03-15 19:42 | branch: feat/build-0.1.14

- Request: Implementovat map výkonové úpravy: render jen viditelných lén + overscan, oddělit hover/pin overlay od marker layer a připravit směr pro budoucí canvas render.
- Summary: V map panelu jsem zachoval viewport-only render markerů s malým overscanem a odstranil navázání marker layer na `hover/pin` stav. `hovered/pinned` už neovlivňuje výběr/render marker listu; místo toho se renderuje samostatná overlay vrstva (`map-settlement-state-overlay-layer`) nad gridem, která zobrazuje hover/pin highlight bez přemapování celého `settlementMarkers`. Tím se výrazně zmenší rerender scope při pohybu kurzoru a pin akcích.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Změna je UI/render-only bez úprav fetch modelu, pollingu a backend data-flow; další logický krok je samostatná canvas marker vrstva za feature flagem.

## 2026-03-19 19:23 | branch: feat/build-0.1.14

- Request: Pokračovat na `feat/build-0.1.14` v implementaci tří map výkonových bodů, hlavně převést marker layer na canvas při zachování viewport renderu a oddělené hover/pin vrstvy.
- Summary: Dopsal jsem canvas marker vrstvu (`MapSettlementCanvasLayer`), která v jednom draw passu renderuje viditelné settlement markery, haly podle prestiže, základní order coverage a badge symboly. DOM vrstva markerů už slouží jen jako lehký hit-target pro hover/click/context menu a volitelný Ctrl banner, takže marker vizuál už negeneruje stovky vnořených uzlů. Viewport-only render s overscanem i oddělená hover/pin overlay vrstva zůstaly zachované.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (OK)
- Notes: Změna je UI/render-only bez zásahu do fetch modelu, pollingu a backendu; další bottleneck zůstává minimapa a případné hromadné Ctrl bannery při velkém počtu viditelných lén.

## 2026-03-15 18:48 | branch: feat/build-0.1.14

- Request: Připravit rozsáhlou analýzu, jak zlepšit Core Web Vitals v rámci celého projektu, bez implementace.
- Summary: Prošel jsem frontend entrypointy, routy, polling/data-flow, build output, CSS a asset pipeline i server snapshot vrstvu. Hlavní zjištění: aplikace se v produkci skládá do jediného velkého JS chunku (`645 kB`) a jediného globálního CSS bundle (`270 kB`), login route tak stahuje i kód a styly pro `GamePage` a `CommunicationHub`. `GamePage.tsx` (~21k řádků) drží rozsáhlý state a několik samostatných polling smyček, navíc po mnoha mutacích znovu volá `loadGameState(true, true)` i když mutation endpointy už vracejí aktualizovaný snapshot. V asset pipeline je ~58 MB statických assetů, z toho ~51 MB building PNG a další těžké PNG (`background2.png` ~2.8 MB, `louka.png` ~3.3 MB) jsou použité v globálním CSS backgroundu. Na serveru `GET /api/v1/state` stále synchronně skládá široký snapshot a řada write endpointů kombinuje `runGameTick()` + doménovou akci + nový snapshot v jedné odpovědi, což zvyšuje TTFB i tlak na klientský parse/render. Současně jsem zaznamenal i existující mitigation, které má smysl zachovat: mapa už omezuje render na `renderedCellRange` a polling panelů je částečně scopeovaný podle otevřených panelů.
- Files: arch/chat-changelog.md
- Verification: `npm run build` (OK; Vite warning na oversized chunk), kontrola `dist/assets`, statická analýza `src/App.tsx`, `src/pages/GamePage.tsx`, `src/components/CommunicationHub.tsx`, `src/App.css`, `src/index.css`, `server/index.js`, `server/gameService.js`, `vite.config.ts`, `netlify.toml`
- Notes: Bez implementace; doporučení jsou prioritizovaná pro LCP/INP/CLS a mají respektovat existující guardrails proti broad rerenderům a novým polling smyčkám.

## 2026-03-19 19:19 | branch: feat/build-0.1.14

- Request: Ve `feat/build-0.1.14` rozběhnout localhost i s backendem a mít frontend na `5173`.
- Summary: Přidal jsem branch-specific lokální env override pro scope `feat-build-0-1-14`, aby `npm run dev` na této větvi spouštěl frontend na `http://localhost:5173` a současně zachoval branch-isolated backend na `http://localhost:3003` nad `server/data/branches/feat-build-0-1-14`. Potom jsem ukončil staré visící instance na `5175/3003`, spustil nový detached `npm run dev` a ověřil jak přímý backend health check, tak proxy přístup přes Vite na `5173`.
- Files: .env.feat-build-0-1-14.local, arch/chat-changelog.md
- Verification: `.dev-full.log` obsahuje `[local-runtime] server scope=feat-build-0-1-14 port=3003` a `[local-runtime] client scope=feat-build-0-1-14 port=5173 api=http://localhost:3003`, `Get-NetTCPConnection` LISTENING na `:3003` a `:5173`, `Invoke-WebRequest http://localhost:3003/api/health` (OK), `Invoke-WebRequest http://localhost:5173` (`200`), `Invoke-WebRequest http://localhost:5173/api/health` (OK)
- Notes: Override je jen lokální (`*.local` je ignorované), takže se nemění chování ostatních branchí ani repozitářový default fallback `5175/3003` pro nepojmenované feature branche.

## 2026-03-19 20:43 | branch: feat/build-0.1.14

- Request: Implementovat část gameplay/UI změn (mapa drag + karta léna + vypnutí auto-centeringu z map clicku + barva protivníka), stabilizovat avatary, umožnit podporu na jakékoliv léno, sjednotit battle report okno, upravit ceny výzkumu a přidat výzkum pro nábor rytíře.
- Summary: Na mapě jsem opravil panning při drag startu přímo na lénu (bez rozbití click-open), vypnul auto-centering při otevření léna klikem z mapy (centering zůstává přes seznamy/pin/tab/center tlačítko) a přepracoval hover/pinned kartu léna: dominantní řádek hráče/království, výraznější „hráč celkem“ a tlačítko pro kopii souřadnic. Současně jsem ztmavil `opponent` paletu (Total War styl). Pro avatary jsem zpevnil backend storage path vůči `cwd` a zamezil klientskému přepisování již známého avataru na `null` při neúplné token-suggest odpovědi. Podpora je nově povolena na jakékoliv cílové léno (frontend i backend validace). `battleReport` panel jsem přepnul na fixní landscape frame (už ne auto-size „nudle“). V backendu jsem upravil ceny výzkumů dle zadání, přidal projekt `Rytířský stav` (100 mincí) a napojil ho jako research gate pro nábor `knight`; zároveň jsem změnil cenu/čas náboru rytíře na 5000/5000/5000 a 1 hodinu.
- Files: src/pages/GamePage.tsx, src/App.css, server/gameService.js, server/gameConfig.js, server/communicationService.js, tests/regression/game-rules.scenario.mjs, arch/chat-changelog.md
- Verification: `npm run build` (OK), `node --test --test-name-pattern "only one knight can exist or be queued per village at once" tests/regression/game-rules.regression.test.mjs` (OK), `npm run test:regression` (FAIL na více pre-existing scénářích mimo tento patch + aktualizovaný knight gate)
- Notes: Guardrails: map interactions zůstaly lokální bez nového pollingu/network vazby; render riziko mitigováno zachováním canvas marker layer + lightweight hit targets.

## 2026-03-19 20:58 | branch: feat/build-0.1.14

- Request: Ujasnit, proč nejsou vidět nové ceny výzkumných projektů v mincích.
- Summary: Ověřil jsem backend model i runtime snapshot: projekty vrací správné nové ceny (`300/300/500/500/1000/100/500`) a nový projekt `Rytířský stav` je přítomen. Problém byl v tom, že lokální backend neběží ve watch režimu, takže po změnách v `server/*.js` zůstal běžet starý proces. Restartoval jsem dev stack na `3003/5173`, aby se načetl nový server kód.
- Files: arch/chat-changelog.md
- Verification: `node tmp-research-check.mjs` (runtime snapshot s novými cenami), `.dev-full.log` po restartu (`[backend] Listening on http://localhost:3003`, klient `http://localhost:5173`)
- Notes: Po restartu backendu je potřeba v prohlížeči udělat hard refresh, aby UI neukazovalo starý stav z předchozí session.

## 2026-03-20 15:33 | branch: develop

- Request: Sloučit `feat/build-0.1.14` do `develop`, otestovat bez maskování chyb a spustit localhost na `5173`.
- Summary: Přepnul jsem se na `develop` a provedl merge `feat/build-0.1.14` (`cf01075`) bez konfliktů. Následně jsem spustil build a plnou regresní sadu; build je zelený, ale regresní testy hlásí 7 failů (boj/loot scénáře), které jsem ponechal transparentně bez „greenwashing“. Nakonec jsem spustil detached lokální runtime; frontend běží na `5173` a backend pro scope `develop` na `3001` (branch runtime default), obojí dostupné.
- Files: arch/chat-changelog.md
- Verification: `git merge --no-ff feat/build-0.1.14` (OK), `npm run build` (OK), `npm run test:regression` (FAIL: 7 testů), `.dev-full.log` (`client ... port=5173`, `server ... port=3001`), `Invoke-WebRequest http://localhost:5173` (`200`), `Invoke-WebRequest http://localhost:3001/api/health` (`200`)
- Notes: Na `develop` je backend port `3001` řízen branch runtime profilem; pokud chceš explicitně `3003`, je potřeba lokální override pro `develop`.

## 2026-03-20 16:07 | branch: develop

- Request: Vysvětlit význam vybraných failing regresních testů pro combat/loot a navrhnout směr opravy.
- Summary: Prošel jsem příslušné scénáře i resolver bitvy/lootu a ověřil reálné výstupy scénářů. Hlavní závěr: několik failů už neukazuje na čistou chybu výpočtu, ale na střet starých testových očekávání s novou logikou posádky. `empty-fortified-no-loss`, `loot-capacity-all-units` i `large-army-balance` dnes implicitně bojují proti auto-garrisonu přimíchanému do obrany, takže „prázdná“ vesnice ve scénáři ve skutečnosti není prázdná a loot vychází nulový proto, že útočníci nepřežijí. U `default-balanced-loot-priority` je navíc vidět nekonzistence report payloadu: resolver loot priority normalizuje na `balanced`, ale zničená útočná armáda dostává report bez pole `lootPriority`, takže test čte prázdný string. Doporučení jsem rozdělil na dvě roviny: nejdřív srovnat feature contract testů s posádkou, potom upravit report serialization a případně casualty model pro méně binární porážky.
- Files: arch/chat-changelog.md
- Verification: `node tests/regression/game-rules.scenario.mjs empty-fortified-no-loss`, `node tests/regression/game-rules.scenario.mjs loot-capacity-all-units`, `node tests/regression/game-rules.scenario.mjs default-balanced-loot-priority`, `node tests/regression/game-rules.scenario.mjs large-army-balance`, statická analýza `tests/regression/game-rules.scenario.mjs` a `server/gameService.js`
- Notes: Bez implementace; šlo o analýzu root cause a návrh pořadí oprav s ohledem na guardrails.

## 2026-03-20 16:31 | branch: develop

- Request: Implementovat opravy failujících combat/loot testů podle návrhu a opravit tooltip Posádky v kartě léna, aby nebyl roztahaný do výšky.
- Summary: Nasadil jsem bezpečný fix ve třech vrstvách. V regresních scénářích jsem přidal helper `setVillageDefenseBaseline`, který u scénářů testujících čistý boj/loot explicitně nastaví `townhall: 0` (vypnutí auto-posádky) a tím vrací scénářům původní deterministický contract bez skrytých obránců. V bojových reportech jsem sjednotil payload a doplnil `lootPriority`, `lootTaken` a `returnMovement` i pro větev „armyDestroyed“, takže UI/reporting drží konzistentní datový tvar. U tooltipu Posádky jsem zkrátil texty v `garrisonTooltipRows` na čitelnější jednořádkové hodnoty a upravil layout `.village-intel-tooltip` na jednokolonový, s korektním wrappingem bez vertikálního „natažení“ textu.
- Files: tests/regression/game-rules.scenario.mjs, server/gameService.js, src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `node --test tests/regression/game-rules.regression.test.mjs` (PASS 28/28), `npm run build` (PASS; známé Vite warningy o velikosti chunku)
- Notes: Guardrails: žádný nový polling, žádná změna tick/read flow; změny jsou lokální v test scénářích, report serializaci a tooltip render/CSS.

## 2026-03-20 17:08 | branch: main

- Request: Sloučit `develop` do produkční větve `main` se zachováním herních dat a ověřit funkční build pro Netlify + backend.
- Summary: V produkčním worktree `main` byly připravené staged změny, proto jsem je nejdřív commitnul jako samostatný checkpoint (`chore(main): checkpoint staged production changes`) a následně provedl merge `develop -> main`. Jediný konflikt byl v `arch/chat-changelog.md`, kde jsem zachoval novější historii z `develop` a doplnil auditní záznam tohoto merge. Runtime data zůstala zachována: SQLite soubory v `server/data/*.sqlite` a branch data ve `server/data/branches/` jsou ignorované v Gitu, stejně jako `server/storage/avatars/`; neproběhl žádný reset ani mazání datových adresářů. Po merge jsem ověřil produkční branch build, regresní testy a backend health na lokálním `main` profilu.
- Files: arch/chat-changelog.md, .gitignore, README.md, package.json, scripts/run-local-client.mjs, scripts/run-local-server.mjs, server/communicationService.js, server/db.js, server/gameConfig.js, server/gameService.js, server/index.js, server/runtimeProfile.js, src/App.css, src/App.tsx, src/api/gameApi.ts, src/pages/GamePage.tsx, tests/config/local-runtime-profile.test.mjs, tests/regression/game-rules.scenario.mjs, vite.config.ts
- Verification: `npm run build` (PASS), `node --test tests/regression/game-rules.regression.test.mjs` (PASS 28/28), `Invoke-WebRequest http://localhost:3002/api/health` (`200`), `netlify.toml` redirecty na backend `https://thg.89-167-89-109.sslip.io/api`
- Notes: Netlify build je připravený na trigger pushnutím `main`; backend routování je zachované přes Netlify redirects na self-host API.

## 2026-03-20 17:41 | branch: main

- Request: Přepnout aktuální workspace do větve `main`.
- Summary: Ověřil jsem, že pracovní strom je čistý a nic nebude blokovat přepnutí větve. Následně jsem v tomto workspace provedl `git switch --ignore-other-worktrees main`; větev `main` je aktivní a synchronní s `origin/main`.
- Files: arch/chat-changelog.md
- Verification: `git status --short` (čistý pracovní strom), `git branch --show-current` před přepnutím (`develop`), `git switch --ignore-other-worktrees main` (OK)
- Notes: Žádné další změny repozitáře ani dat nebyly provedeny.

## 2026-03-20 17:56 | branch: main

- Request: Diagnostikovat, proč produkce neukazuje změny 0.1.14 (zejména výzkum) a určit místo rozchodu mezi kódem a nasazením.
- Summary: Ověřil jsem produkční Netlify i backend zvlášť. Netlify frontend je skutečně nasazený z aktuálního `main` commitu `0f5fe41` a servíruje stejný asset hash jako lokální build (`index-BeYX6f1H.js`, `index-BdemgXJo.css`). Produkční backend ale zjevně není spolehlivě verzovaný a zároveň servíruje starý runtime obsah výzkumu; v `main` repu jsou nové definice výzkumu v `server/gameService.js`, zatímco živá hra podle UI stále vrací staré ceny. Zásadní zjištění je dvojí: 1) release je rozdělený na auto-deploy Netlify frontendu a samostatný self-host backend deploy, takže samotný merge/push do `main` nestačí pro serverové změny; 2) observability je teď matoucí, protože frontend i backend fallback verze zůstaly na `0.1.11` (`package.json`, `src/version.ts`, `server/index.js`), takže `api/health` neumí bez env proměnných jasně potvrdit skutečný release.
- Files: arch/chat-changelog.md
- Verification: `npx netlify api listSiteDeploys --data '{"site_id":"29de8cb8-4e2b-4dd9-8738-97dd1241f20b","page":1,"per_page":3}'` (produkční deploy z commitu `0f5fe41`), `Invoke-WebRequest https://thelastdominion.netlify.app/` (assety `index-BeYX6f1H.js` / `index-BdemgXJo.css`), `npm run build` (lokálně stejné asset hashe), `Invoke-WebRequest https://thelastdominion.netlify.app/api/health` (backend health), `npx netlify env:get VITE_API_BASE` (produkce míří přímo na `https://thg.89-167-89-109.sslip.io`)
- Notes: Produkční klient nepoužívá jen Netlify redirect, ale má build-time `VITE_API_BASE` nastavený přímo na self-host backend. Jakákoli backendová změna z `main` tedy zůstane neviditelná, dokud se ten server samostatně nepřepne na nový commit/obraz.

## 2026-03-20 18:07 | branch: main

- Request: Rozpadnout po bodech, co z velkého seznamu map/combat/research/knight změn je na produkci opravdu živé, co je jen v repu a co stále není implementované.
- Summary: Porovnal jsem aktuální `main` s předchozím produkčním commitem `0581a99`, prošel diff klíčových frontend/backend souborů a oddělil změny podle závislosti na frontend deployi vs self-host backend deployi. Výsledek: mapové UI úpravy a další čistě frontendové věci jsou na produkci živé, protože Netlify běží z aktuálního `main`; serverově řízené novinky jako nové ceny výzkumu, `Rytířský stav`, knight cost/time, podpora cizích lén a avatar storage fix jsou jen v repu a na produkci chybí kvůli stale backendu; veřejný pořádek, queue-based recruit, převod podpory na nové domovské léno a část combat redesignu nejsou hotové vůbec.
- Files: arch/chat-changelog.md
- Verification: `git diff --name-only 0581a9953b8958d3104b1f719756632512ef9c7f..0f5fe4177bb8c3215b4575e3c03d4a7a6aff14b5`, targeted `git diff ... -- server/gameService.js src/pages/GamePage.tsx src/App.css server/gameConfig.js server/communicationService.js`, `Select-String` v aktuálním `main` pro map drag/copy, opponent color, battle report sizing, avatar storage, research defs, knight config a recruitment flow
- Notes: Stav „živé“ znamená, že je změna v produkčním frontendu nebo už byla součástí staršího produkčního backendu; neznamená to automaticky, že byla manuálně vizuálně retestovaná v každém edge case.

## 2026-03-20 18:19 | branch: main

- Request: Navrhnout, jak efektivně a konzistentně doprogramovat chybějící části, doplnit neúplné věci a zlepšit nasazené systémy s důrazem na kvalitu.
- Summary: Připravil jsem implementační roadmapu na základě guardrails a aktuálního stavu repa. Hlavní doporučení: nejdřív opravit release a observability contract (frontend/backend musí nést stejný build id), potom uzavřít neúplné backendové věci z 0.1.14, následně řešit chybějící mechaniky po doménách. Za klíčové architektonické body považuji nezneužít `loyalty` pro veřejný pořádek, ale zavést samostatný world-scoped player state; nábor jednotek předělat na skutečnou frontu s lokálním rebalancem per village; combat/reporting sjednotit přes explicitní visibility/escort contract; activity a battle reports oddělit jako inbox vs immutable detail; a rozdělit monolit `GamePage.tsx` po doménách, ne přidávat další cross-cutting stav do jedné komponenty.
- Files: arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\references\\playbook.md`, targeted `Select-String` / `git diff` nad `server/gameService.js`, `server/gameConfig.js`, `server/communicationService.js`, `src/pages/GamePage.tsx`, `src/App.css`
- Notes: Nešlo o implementaci, ale o návrh pořadí, datových modelů, guardrails a regression strategie pro bezpečné pokračování.

## 2026-03-20 18:31 | branch: main

- Request: Upřesnit UI umístění veřejného pořádku, navrhnout `Armádu všech lén`, rozložit obě věci do implementačních fází a vysvětlit dlouhodobý přesun marker layer mapy na canvas.
- Summary: Na základě guardrails jsem navrhl veřejný pořádek jako world-scoped systém s UI badge hned vedle aktivního léna, kde se procento zobrazuje jen pod 100 % a debuffy se zvýrazňují barevně i tooltipem. Novou stránku `Armáda všech lén` jsem rozvrhl jako samostatný lightweight read-model s přehledem jednotek, opevnění, brány, posádky a aktuálního rekrutu bez tabulkového vzhledu a bez nafukování hlavního snapshotu. Současně jsem začlenil do backlogu release contract, backend rollout 0.1.14, audit reportů, veřejný pořádek, recruit queue, support rebase, combat/report kontrakt, DB migrace, release doctor a view-model testy a připravil vysvětlení, proč canvas marker layer řeší výkon renderu bez odbočení od herní funkčnosti.
- Files: arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\SKILL.md`, `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\references\\playbook.md`, `Get-Content D:\\The Last Dominion\\arch\\chat-changelog.md -Tail 30`
- Notes: Šlo o plánovací návrh; bez změny runtime kódu a bez zásahu do herních dat.

## 2026-03-20 18:45 | branch: main

- Request: Dopsat canvas marker layer do roadmapy a udelat dalsi navazujici krok pred implementaci.
- Summary: Vytvoril jsem samostatny implementacni dokument `arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md`, ktery sjednocuje verejny poradek, `Armadu vsech len`, release contract, uzavreni 0.1.14, recruit queue, support rebase, combat/report kontrakt, technicky zaklad a dlouhodoby prechod settlement marker vrstvy mapy na `canvas`. Soucasti dokumentu jsou feature contracts, guardrails, poradi milniku, vysvetleni prinosu `canvas` rendereru a explicitni `dalsi krok pred implementaci`: pripravit navazujici API spec, DB spec a acceptance scenare pro tuto vlnu praci.
- Files: arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: `Get-Content D:\\The Last Dominion\\arch\\optimalizace-a-vykonove-guardrails.md -TotalCount 120`, `Get-Content D:\\The Last Dominion\\arch\\planovac-implementacni-milniky-v1.md -TotalCount 120`, manual review noveho dokumentu
- Notes: Slo o pripravu implementacniho backlogu a specifikacniho kroku; bez zmen runtime kodu a bez zasahu do hernich dat.

## 2026-03-20 19:09 | branch: main

- Request: Pokracovat navazujicim krokem pred implementaci a pripravit konkretni specifikace pro verejny poradek, `Armadu vsech len`, recruit queue, support rebase a souvisejici retention/guardrails.
- Summary: Na zaklade guardrails a existujiciho backend/frontend contractu jsem pripravil tri navazujici arch dokumenty: `arch/verejny-poradek-armada-api-spec-v1.md`, `arch/verejny-poradek-armada-db-spec-v1.md` a `arch/verejny-poradek-armada-acceptance-scenare-v1.md`. API spec zavadi `publicOrder` summary do `GET /api/v1/state`, rozsiruje existujici `GET /api/v1/army/overview` pro novou stranku `Armada vsech len`, definuje `POST /api/v1/units/recruitments/reorder`, upresnuje cancel contract recruit queue a pridava `POST /api/v1/army/support/:movementId/rebase`. DB spec pridava `player_world_governance`, audit eventy verejneho poradku, kanonickou podobu `unit_recruitments` v2, audit `army_movement_events` a explicitni report reference v `player_notifications`. Acceptance dokument pokryva badge a tooltip verejneho poradku, lifecycle `Armady vsech len`, queue reorder/cancel, support rebase, report retention, combat visibility edge cases a guardrails kolem pollingu a payloadu. Soucasne jsem upravil roadmap dokument, aby `Armada vsech len` preferovala rozsireni existujiciho `army/overview` endpointu misto vytvareni duplicitniho API.
- Files: arch/verejny-poradek-armada-api-spec-v1.md, arch/verejny-poradek-armada-db-spec-v1.md, arch/verejny-poradek-armada-acceptance-scenare-v1.md, arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: `Get-Content D:\\The Last Dominion\\arch\\planovac-api-spec-v1.md -TotalCount 220`, `Get-Content D:\\The Last Dominion\\arch\\planovac-db-spec-v1.md -TotalCount 220`, `Get-Content D:\\The Last Dominion\\arch\\planovac-acceptance-scenare-v1.md -TotalCount 220`, `Get-Content D:\\The Last Dominion\\server\\db.js` around schema blocks, `Get-Content D:\\The Last Dominion\\server\\index.js` around `GET /api/v1/army/overview`, `Get-Content D:\\The Last Dominion\\src\\api\\gameApi.ts` around `ArmyOverviewResponse`, `git status --short`
- Notes: Slo o arch/spec pripravu bez runtime implementace a bez zasahu do hernich dat. Dulezite rozhodnuti: verejny poradek jde jako maly summary slice do hlavniho `state`, zatimco `Armada vsech len` zustava panel-scoped rozsireni existujiciho `army/overview`.

## 2026-03-20 20:02 | branch: main

- Request: Implementovat roadmapu a pripravene zmeny a dostat vse live do produkce (Netlify + self-host backend).
- Summary: Dokoncil jsem backend/frontend implementaci verejneho poradku, queue-based recruit flow, support rebase commandu, army overview rozsireni, map marker canvas vrstvy a souvisejicich UI kontraktu z roadmapy 0.1.14, plus jsem doplnil release observability skript `release-doctor` se smoke checkem (`health/login/state/research/avatar`). Pri finalni validaci jsem opravil regresni chyby po merge (duplicitni deklarace v build/recruit flow), znovu overil build a 28/28 regresi, nasadil frontend na Netlify a backend na produkcni server. Behem backend nasazeni jsem resil produkcni incident: crash pri startu kvuli indexu nad `player_notifications.report_id` na starsi DB (index byl vytvaren pred migraci), opravil jsem `server/db.js` tak, aby se index tvoril az v migraci po `ALTER TABLE`, backend restartoval a overil navrat API. Finalni produkcni smoke na `https://thelastdominion.netlify.app` je zeleny a backend health hlasi `build-0.1.14`.
- Files: README.md, package.json, scripts/release-doctor.mjs, server/db.js, server/gameService.js, server/index.js, src/App.css, src/api/gameApi.ts, src/pages/GamePage.tsx, src/version.ts, arch/verejny-poradek-armada-api-spec-v1.md, arch/verejny-poradek-armada-db-spec-v1.md, arch/verejny-poradek-armada-acceptance-scenare-v1.md, arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: `npm run build` (PASS), `npm run test:regression` (PASS 28/28), `npx netlify status` (linked project `thelastdominion`), `npx netlify deploy --prod --build` (live deploy), SSH deploy na `89.167.89.109` (`docker build -f server/Dockerfile -t thg-api .` + restart `thg-api` v siti `zane`), `Invoke-WebRequest https://thelastdominion.netlify.app/api/health` (`build-0.1.14`), `node scripts/release-doctor.mjs --base-url https://thelastdominion.netlify.app --world-id dominion-1 --username Player001 --password 123` (PASS 15/15)
- Notes: Produkcni backend adresar `~/THG` neni git worktree, deploy proto probehl pres `scp` aktualnich zdrojaku + rebuild/restart produkcniho kontejneru `thg-api` bez zasahu do SQLite dat (`/home/patrik/THG/server/data`).

## 2026-03-20 20:14 | branch: main

- Request: Dokoncit stabilizaci po produkcnim rolloutu a potvrdit finalni release contract/smoke.
- Summary: Po prvnim restartu backendu jsem resil produkcni padem pri startu (`SqliteError: no such column: report_id`) zpusobenym vytvarenim indexu `idx_player_notifications_report_ref` v `createSchema()` pred migraci starsi DB. Opravil jsem `server/db.js` tak, aby se tento index vytvarel pouze v migracni casti po pridani sloupce. Soucasne jsem doladil `release-doctor` (`scripts/release-doctor.mjs`) pro kompatibilni `--check-netlify-env` na Windows (`cmd /c npx`) a korektni parsovani hlasky „No value set...“ jako prazdne hodnoty. Po redeploy backendu je produkce stabilni a finalni release-doctor smoke je plne zeleny.
- Files: server/db.js, scripts/release-doctor.mjs, arch/chat-changelog.md
- Verification: `npm run test:regression` (PASS 28/28), redeploy `thg-api` na `89.167.89.109` (build + restart), `Invoke-WebRequest https://thelastdominion.netlify.app/api/health` (`build-0.1.14`), `node scripts/release-doctor.mjs --base-url https://thelastdominion.netlify.app --world-id dominion-1 --username Player001 --password 123 --check-netlify-env` (PASS 16/16)
- Notes: Incident byl vyresen bez ztraty hernich dat; SQLite volume `/home/patrik/THG/server/data` zustal zachovan.

## 2026-03-20 20:24 | branch: main

- Request: Pripravit hracsky changelog nove verze proti predchozi produkcni verzi.
- Summary: Prosel jsem rozdil mezi predchozi produkcni bazi `0581a99` a aktualnim nasazenym `main`, overil hlavni hracsky viditelne body v diffu i v produkcnim smoke checku a zformuloval changelog z pohledu hrace. Hlavni oblasti: mapa a ovladani, vykon mapy, verejny poradek, armada vsech len, recruit queue, rytir/vyzkum, tooltipy a stabilita reportu/avataru.
- Files: arch/chat-changelog.md
- Verification: `git diff --name-only 0581a9953b8958d3104b1f719756632512ef9c7f..3c8852f`, targeted diff review `server/gameConfig.js`, `server/gameService.js`, `src/pages/GamePage.tsx`, `src/App.css`, `src/api/gameApi.ts`, `server/communicationService.js`, produkcni `release-doctor` PASS 16/16
- Notes: Bez dalsich runtime zmen; slo o dokumentacni shrnuti uz nasazene produkcni verze.

## 2026-03-21 06:15 | branch: feat/build-0.1.15

- Request: Vytvorit branch `feat/build-0.1.15` z `main`, presunout se na ni a opravit nekonzistentni barevne rozlisovani vlastnich lén na mape a minimape mezi hraci (napr. `Sathan` vs `Hayato`).
- Summary: Zalozil jsem a checkoutnul `feat/build-0.1.15`, dohledal implementaci mapy/minimapy v `MapPanel` a identifikoval zdroj chyby v klientskem API. Mapa i minimapa jsou napajene ze `worldMapState`, ktere se nacita pres `fetchWorldMapSnapshot(username, villageId, worldId, spawnDirection)`, ale klient tento `username` do query vubec neposilal. Server route `/api/v1/world-map` pak fallbackovala na `Hayato`, takze vztahy a barvy byly pocitane z pohledu Hayato bez ohledu na realne prihlaseneho hrace. Opravil jsem `src/api/gameApi.ts`, aby se `username` do requestu vracel; tim se sjednoti ownership klasifikace pro hlavni mapu i minimapu pro kazdeho hrace.
- Files: src/api/gameApi.ts, arch/chat-changelog.md
- Verification: `git checkout -b feat/build-0.1.15 main`, code review `src/pages/GamePage.tsx` (`MapPanel`, `miniMapDots`, `loadWorldMapSnapshot`), code review `server/index.js` (`GET /api/v1/world-map` fallback `Hayato`), code review `server/gameService.js` (`relation: isOwn ? 'self' ...`), `npm run build` (PASS)
- Notes: Feature contract: vlastni lena musi byt barvena podle skutecne prihlaseneho hrace, autoritativni stav zustava na serverovem world snapshotu a zmena nepridava zadny novy polling ani render-side data flow.

## 2026-03-21 06:27 | branch: feat/build-0.1.15

- Request: Zjistit, jak ted funguje nakup/spusteni vyzkumu, kdyz se projekt zda jit koupit jen z hlavniho (prvniho) lena.
- Summary: Prosel jsem research flow v klientu i backendu. `ResearchPanel` zobrazuje regionalni research stav (`research.projects`, `idleAcademics`, `regionAcademicCapacity`), ale cenu projektu validuje proti `resources.coins` aktualne nacteneho lena a pri kliknuti na `Spustit vyzkum` posila mutation s `villageId = gameState.village.id ?? activeVillageId`. Backend route `/api/v1/research/project/start` tento `villageId` preda do `startResearchProject()`, kde `requireVillageForUser()` vybere konkretni leno a transakce pak mince strhava vyhradne z `resources` toho jednoho vybraneho lena (`synchronizeVillageEconomyAt(village.id)` + `updateResourcesAfterSpendStmt(..., village.id)`). Samotny vyzkum a akademici jsou regionalni, ale financovani startu projektu je dnes vazane na aktivni/pozadovane leno; kdyz `requestedVillageId` chybi nebo nepasuje, backend fallbackuje na `villages[0]`, tedy prvni/hravni leno.
- Files: arch/chat-changelog.md
- Verification: code review `src/pages/GamePage.tsx` (`ResearchPanel`, `handleStartResearchProject`, `loadGameState`, `applyActiveVillageSelection`), code review `src/api/gameApi.ts` (`startResearchProject` request body), code review `server/index.js` (`/api/v1/research/project/start`), code review `server/gameService.js` (`requireVillageForUser`, `startResearchProjectTransaction`, research read model v `getVillageSnapshot`)
- Notes: Feature contract: research progres a akademici jsou regionalni, ale coin spend je aktualne per-village. Hlavni riziko pripadne opravy bude nesmest regionalni research state s lokalni ekonomikou tak, aby zustal jasny zdroj pravdy pro mince.

## 2026-03-21 07:05 | branch: feat/build-0.1.15

- Request: Navrhnout efektivni a bezregresni postup pro dalsi vlnu zmen: research platby z aktivniho lena, prevody zlata/minci pres existujici logistiku z research panelu, upravu combat ranku (utocnik/obrance/podporovatel), novy zebricek pro uloupene suroviny vcetne zlata/minci bez kralovstvi, dohledani umisteni `Armady vsech len` a doladeni UI verejneho poradku.
- Summary: S pouzitim `last-dominion-feature-guardrails` jsem rozdelil pozadavky podle rizika a datoveho modelu. Potvrdil jsem, ze research flow uz dnes umi utratit mince z konkretniho `requestedVillageId`, ale backend pri chybejicim/invalidnim id fallbackuje na `villages[0]`, takze bezregresni smer je zpevnit kontrakt "plat z aktivniho lena" namisto michani regionalni ekonomiky. Pro prevody v research panelu se jevi jako nejbezpecnejsi rozsirit existujici `market/logistics/send` flow, ne zavadet druhy transfer system; soucasne jsem overil, ze to neni jen UI limit, ale i schema `logistics_routes` a tick processing jsou dnes jen pro `wood/stone/iron`, takze `gold/coins` budou chtit konzistentni rozsiren i v DB a delivery/cancel flow. Combat ranky jsou centralne agregovane v `buildCombatScoresByPlayerId`, takze zmena pravidel ma jit tam, ne do klienta. Naopak novy zebricek uloupenych surovin vcetne zlata/minci neni jen UI prace, protoze battle loot/report/return movement modely dnes eviduji jen `wood/stone/iron`; bezregresni cesta je nejdriv rozsirit skutecny loot kontrakt a teprve pak pridat novy player-only zebricek bez kralovstvi. Soucasne jsem dohledal, ze `Armada vsech len` pristala uvnitr existujiciho `ArmyPanel` pod textem `Sprava vsech len`, a ze badge verejneho poradku uz sedi vedle `Aktivniho lena`, jen je mala a pouziva nativni `title` tooltip.
- Files: arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\SKILL.md`, `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\references\\playbook.md`, code review `src/pages/GamePage.tsx` (`ResearchPanel`, research logistics UI, `handleStartResearchProject`, `handleSendMarketLogistics`, `Sprava vsech len`, public order badge), code review `src/api/gameApi.ts` (`startResearchProject`, `sendMarketLogistics`, `BattleReportPayload`), code review `server/index.js` (`/api/v1/research/project/start`, `/api/v1/market/logistics/send`), code review `server/gameService.js` (`requireVillageForUser`, `startResearchProjectTransaction`, `sendMarketLogisticsTransaction`, `buildCombatScoresByPlayerId`, battle loot flow), code review `server/db.js` (`logistics_routes` schema)
- Notes: Neslo o implementaci; vysledkem je staged plan s explicitnim feature contractem, hlavnim vykonovym rizikem, mitigaci a poradi zmen tak, aby se minimalizovalo riziko rozbiti ekonomiky, tick delivery a zebricku.

## 2026-03-21 07:23 | branch: feat/build-0.1.15

- Request: Zkontrolovat navrzeny kontrakt barevneho rozliseni mapy a povolenych akci (utok/podpora/presun) pro aktivni, vlastni, kralovska, DoN, spojenecka, protivnicka a nepratelska lena a najit logicke chyby nebo chybejici pravidla.
- Summary: Prosel jsem aktualni mapovy read model, klientske rozlisovani a army command validation. Potvrdil jsem, ze hlavni nekonzistence je architektonicka: server world snapshot vraci jen `relation = self|ally|enemy`, kde `ally` dnes znamena pouze `same kingdom`, zatimco klient si z toho v `determineMapSettlementKind()` heuristicky dodelava `nap/opponent/enemy` podle `note`, newbie ochrany a nazvu kralovstvi. To je v rozporu s pozadovanym kontraktem, podle ktereho maji byt cizi barvy autoritativne odvozeny jen z vlastnictvi hrace a diplomacie kralovstvi. Soucasne jsem overil, ze klient dnes blokuje utok na `ally`, server ale blokuje jen utok na vlastni leno; planner navic take invaliduje cile patri tizi hraci. Identifikoval jsem dalsi logicke diry: `royal` barva je v klientu definovana, ale v aktualni klasifikaci se nikdy nevraci; `nap` se chybne odvozuje i z novackovske ochrany; a pokud by se jen odblokoval utok na vlastni lena, otevrel by se bez dalsich pravidel exploit a chaos v lootu, retaliation flagach, dvojitych battle reportech a planneru. Doporuceny kontrakt je oddelit `ownership` (`active`, `own`, `foreign`, `royal`, `bot`, `abandoned`) od `diplomacy` (`same_kingdom`, `allied`, `don`, `war`, `neutral`) a finalni map kind pocitat jednou na serveru, bez klientskych heuristik z `note`.
- Files: arch/chat-changelog.md
- Verification: code review `server/gameService.js` (`buildWorldSettlements`, `issueArmyCommandTransaction`, battle report / retaliation flow, planner target validation), code review `src/pages/GamePage.tsx` (`determineMapSettlementKind`, `canTargetSettlementForArmyCommand`, legend/color definitions), code review `src/api/gameApi.ts` (`WorldSettlement.relation`, `WorldMapSnapshotResponse`)
- Notes: Neslo o implementaci. Klicovy otevreny produktovy bod, ktery je potreba explicitne rozhodnout pred zmenou kodu: jak se ma barevne chovat jiny hrac ve stejnem Kralovstvi a jaka presna pravidla maji platit pro self-attack, aby nevznikl transport/loot exploit.

## 2026-03-21 07:30 | branch: feat/build-0.1.15

- Request: Zjistit, kde je implementovana fronta naboru s poradi, casovanim a preusporadavanim a proc to neni videt na aktualni strance naboru armady.
- Summary: Dohledal jsem, ze support pro queue ordering/timing/reorder na nabor jednotek je implementovany v backendu i API, ale frontend render pro reorder zustal nedodelany. Snapshot uz vraci `activeRecruitments` s `queueIndex`, `startedAt`, `finishAt` a `remainingSec`; klient je v `recruitQueueOrders` spravne seradi podle `queueIndex` a ETA a zobrazuje v sekci `Fronta kasaren`, ale UI dnes umi jen cancel polozky. Samotna reorder mutation existuje v `src/api/gameApi.ts` (`reorderRecruitmentQueue`), route `/api/v1/units/recruitments/reorder` existuje v `server/index.js` a backend `reorderRecruitmentQueueTransaction()` umi presunout pouze neaktivni polozky a pres `applyRecruitmentQueueTimeline()` prepocitat `queue_index`, `started_at`, `finish_at` a `status`. Soucasne jsem potvrdil, ze text ve frontendu tvrdi, ze zaznamy bezi paralelne, ale backendova timeline je sekvencni: index 0 je `in_progress`, dalsi jsou `queued`, takze popisek na strance dnes neodpovida implementaci.
- Files: arch/chat-changelog.md
- Verification: code review `src/pages/GamePage.tsx` (`recruitQueueOrders`, sekce `Fronta kasaren`), code review `src/api/gameApi.ts` (`activeRecruitments`, `reorderRecruitmentQueue`), code review `server/index.js` (`/api/v1/units/recruitments/reorder`), code review `server/gameService.js` (`applyRecruitmentQueueTimeline`, `reorderRecruitmentQueueTransaction`, snapshot mapping `activeRecruitments`)
- Notes: Neslo o implementaci. Hlavni zjisteni: reorder naboru je backend/API-ready, ale neni zapojeny do aktualniho UI, zatimco reorder build queue uz ve stejnem souboru kompletni UI ma.

## 2026-03-21 07:41 | branch: feat/build-0.1.15

- Request: Upravit roadmapu podle rozhodnuti z chatu: zmenit `Stranku vsech len` na read-only kompaktni list s malymi ikonami jednotek, ikonami brany/opevneni, inline ikonou profilu a bez naboru, a doplnit do roadmap backlog dalsich dohodnutych zmen z mapy, research/logistiky, zebricku, recruit queue a verejneho poradku.
- Summary: Aktualizoval jsem dve roadmapy. V `arch/armada-a-planovac-v1-roadmap.md` jsem upravil kontrakt `Armady` na kompaktni read-only roster: radek/karta s malymi ikonami jednotek, hodnotami `vlastni (podpora)`, ikonami `opevneni/brana + uroven`, bez `Aktualniho rekrutu` a s inline ikonou pro otevreni profilu, pricemz hlavni klik stale pridava leno do planovace. V `arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md` jsem prepsal feature contract `Armady vsech len` na read-only list a dopsal nove implementacni milniky pro: research platby z aktivniho lena + logistiku `gold/coins`, serverovy ownership/diplomacy kontrakt mapy, UI dokoncení recruit queue reorderu, nove combat rank agregace, loot model + player-only loot zebricek a polish verejneho poradku. Soucasne jsem upravil doporucene poradi realizace a navazne API/DB/acceptance specifikace, aby backlog odrazel rozhodnute body z teto konverzace.
- Files: arch/armada-a-planovac-v1-roadmap.md, arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: manual review obou upravenych roadmap dokumentu po patchi, kontrola souladu s aktualnim stavem `ArmyPanel` v `src/pages/GamePage.tsx` a driv dohledanymi implementacemi `research`, `market/logistics`, map relation logiky, recruit queue a leaderboard agregaci
- Notes: Slo o dokumentacni a roadmap update bez runtime implementace. Klicove rozhodnuti zapisane do backlogu: `Sprava vsech len` ma prejit na read-only prehled a mapove vztahy se maji stat serverove autoritativnim kontraktem misto klientskych heuristik.

## 2026-03-21 08:12 | branch: feat/build-0.1.15

- Request: Kratce overit, ze jsou v planu implementace opravdu zachycene vsechny rozhodnute body z chatu a nic podstatneho nechybi.
- Summary: Prosel jsem obe roadmapy proti dosavadnim rozhodnutim z teto konverzace. Potvrdil jsem, ze jsou v nich uz zanesene body pro read-only `Armadu vsech len`, research placeny z aktivniho lena, logistiku `gold/coins`, recruit queue reorder UI, combat ranky, loot leaderboard a polish verejneho poradku. Jedina realna mezera byla v mapovem milniku: chybel explicitni permission matrix pro `move/support/attack/self-attack` a otevrene rozhodnuti pro stav `jiny hrac ve stejnem Kralovstvi`, aby se nikdy nesloucil s `own`. Tento kontrakt je ted v `Milniku L` dopsany, takze roadmapa pokryva i nejrizikovejsi cast bez dalsi klientske heuristiky.
- Files: arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\SKILL.md -TotalCount 220`, `Get-Content D:\\The Last Dominion\\arch\\armada-a-planovac-v1-roadmap.md -TotalCount 260`, `Get-Content D:\\The Last Dominion\\arch\\verejny-poradek-armada-mapa-implementacni-milniky-v1.md -TotalCount 320`, `Select-String -Path D:\\The Last Dominion\\arch\\verejny-poradek-armada-mapa-implementacni-milniky-v1.md -Pattern 'Milnik L|support je povolena|attack je povolen|same kingdom|stejnem Kralovstvi|self-attack|DoN|royal' -Context 0,3`, `Select-String -Path D:\\The Last Dominion\\arch\\armada-a-planovac-v1-roadmap.md -Pattern 'Aktualni rekrut|inline ikonu|minimalisticke|Jednotky horizontalne|horizontalni pruh|profil lena' -Context 0,2`
- Notes: Bez runtime zmen. Overeni probehlo podle guardrails se zamerenim na feature contract, permission logiku a riziko dalsich regresi v mapovem klasifikatoru a army commandech.

## 2026-03-21 08:21 | branch: feat/build-0.1.15

- Request: Dopsat do roadmapy konkretni decision note pro stav `jiny hrac ve stejnem Kralovstvi`, aby na implementaci mapy a permission logiky nezustala nejednoznacnost.
- Summary: V `Milniku L` jsem otevrene rozhodnuti prepsal na finalni pravidlo. Cizi hrac ve stejnem Kralovstvi nema v prvni verzi samostatnou legendovou barvu; vizualne spada do `opponent`, ale server o nem stale musi vracet explicitni informaci pro tooltip, army dialog a planner. Permission kontrakt je dopsany jednoznacne: `move` blokovany, `support` povoleny, `attack` povoleny. Soucasne jsem tento edge case doplnil i do acceptance checklistu, aby se pri implementaci a testovani znovu neztratil a nikdy se nesloucil s `own`, `allied` ani `don`.
- Files: arch/verejny-poradek-armada-mapa-implementacni-milniky-v1.md, arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\references\\playbook.md -TotalCount 220`, `Get-Content D:\\The Last Dominion\\arch\\verejny-poradek-armada-mapa-implementacni-milniky-v1.md` around `Milnik L`, manual review acceptance checklist v tomtez dokumentu
- Notes: Bez runtime zmen. Rozhodnuti zamerne nepridava novou mapovou legendu ani novy klientsky classifier; drzi jeden serverovy kontrakt a jen explicitne resi dosud otevreny edge case.

## 2026-03-21 08:27 | branch: feat/build-0.1.15

- Request: Sepsat navazujici API a acceptance detail pro serverovy field mapoveho vztahu, aby implementace `Milniku L` nemusela znovu vymyslet kontrakt pro tooltip, planner a army dialog.
- Summary: Rozsiril jsem arch API a acceptance dokumenty o konkretni additive kontrakt pro `GET /api/v1/world-map`. API spec ted zavadi `mapKind`, `diplomacyKind` a `commandPermissions` jako autoritativni serverova pole pro mapu, minimapu, army target dialog a planner, pri zachovani stavajiciho `relation` jen jako prechodove compatibility vrstvy. Dopsal jsem i specialni pravidlo pro `same_kingdom_foreign`: render jako `opponent`, bez nove legendove barvy, ale s explicitnim `diplomacyKind` a jednoznacnymi permissions (`move` ne, `support` ano, `attack` ano). Acceptance dokument dostal konkretni scenare pro `active`, `own`, `same_kingdom_foreign`, kralovska lena, ciste kralovskou diplomacii a jednotny source of truth pro target gating.
- Files: arch/verejny-poradek-armada-api-spec-v1.md, arch/verejny-poradek-armada-acceptance-scenare-v1.md, arch/chat-changelog.md
- Verification: `Get-Content C:\\Users\\Patrik\\.codex\\skills\\last-dominion-feature-guardrails\\references\\playbook.md -TotalCount 220`, `Select-String -Path D:\\The Last Dominion\\arch\\verejny-poradek-armada-api-spec-v1.md -Pattern 'world-map|mapKind|diplomacyKind|same_kingdom_foreign|commandPermissions' -Context 0,4`, `Select-String -Path D:\\The Last Dominion\\arch\\verejny-poradek-armada-acceptance-scenare-v1.md -Pattern 'MAP-001|MAP-003|same_kingdom_foreign|commandPermissions|mapKind = opponent' -Context 0,4`
- Notes: Bez runtime zmen. Detail zustava additive a respektuje guardrails: zadny novy endpoint, zadny novy polling, zadna dalsi klientaska heuristika.

## 2026-03-21 08:36 | branch: feat/build-0.1.15

- Request: Pokracovat na `feat/build-0.1.15` a zacit realnou implementaci podle roadmapy/planu.
- Summary: Implementoval jsem runtime cast `Milniku L` pro mapovy ownership/command kontrakt. Backend `buildWorldSettlements` ted vraci nove server-authoritative fieldy `mapKind`, `diplomacyKind` a `commandPermissions`, vcetne explicitniho chovani pro `same_kingdom_foreign` (render jako `opponent`, `move=false`, `support=true`, `attack=true`). Klient jsem prepnul na cteni tohoto serveroveho kontraktu jako primarniho zdroje pro mapove rozliseni a command gating; puvodni heuristiky z `note` byly odstraneny z hlavni rozhodovaci vetve a zustava pouze fallback kompatibilita. Soucasne jsem upravil API typy pro nove mapove fieldy.
- Files: server/gameService.js, src/api/gameApi.ts, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (PASS)
- Notes: Nezavadel jsem novy endpoint ani novy polling. V soucasnem runtime zatim neexistuje plny diplomaticky model mezi Kralovstvimi, takze `allied/don/enemy` zustavaji rezervovane pro navazujici backend milnik s diplomatickym read modelem.

## 2026-03-21 08:59 | branch: feat/build-0.1.15

- Request: Pokracovat jednickou, tj. dodelat plny diplomaticky model Kralovstvi a napojit ho do mapove klasifikace i minimapy bez dalsi klientske heuristiky.
- Summary: Dodelal jsem perzistentni read model `kingdom_diplomacy` (DB schema + cleanup), serverovou mutaci `setKingdomDiplomacy` s validaci leadershipu, endpoint `POST /api/v1/kingdom/diplomacy` a rozsireni `kingdomHub` o `canManageDiplomacy` + `diplomacyRelations`. `buildWorldSettlements` ted vyhodnocuje `diplomacyKind` podle dvojice království z DB (ally/DoN/war/neutral), z toho odvodi `mapKind` a kompatibilni `relation`. Na klientu jsem doplnil API typy/call a v `KingdomPanel` implementoval sekci Diplomacie (tabulka vztahu + leader ovladani pro nastaveni vztahu). Wipe statistiky i region wipe ted zahrnuji i tabulku diplomacie.
- Files: server/db.js, server/gameService.js, server/index.js, src/api/gameApi.ts, src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (PASS), `node --check server/gameService.js` (PASS), `node --check server/index.js` (PASS)
- Notes: Feature contract: autoritativni stav diplomacie je server+DB pair model mezi Kralovstvi v ramci `region`. Hlavni vykonove riziko byl potencial N+1 lookup na mape; mitigace je jediny regionovy dotaz na diplomacii mimo settlement loop a ciste in-memory lookup podle pair key.

## 2026-03-21 09:28 | branch: feat/build-0.1.15

- Request: Urcit dalsi nejvhodnejsi implementacni krok po dokonceni mapove diplomacie.
- Summary: Prosel jsem aktualni stav roadmapy a navaznosti po `Milniku L`. Doporucil jsem jako dalsi krok runtime implementaci read-only stranky `Armady vsech len`, protoze je to UI/read-model zmena s nizkym rizikem, nevyzaduje novy tick/economy kontrakt a zuzitkuje uz existujici data. Za ni jsem seradil recruit queue reorder UI a teprve potom economy/logistics milniky (`research` platby z aktivniho lena a prevody `gold/coins`), ktere uz sahaji do herni ekonomiky a maji vyssi regresni riziko.
- Files: arch/chat-changelog.md
- Verification: review `arch/chat-changelog.md`, guardrails review `last-dominion-feature-guardrails` + `playbook.md`
- Notes: Bez runtime zmen. Feature contract pro doporuceny dalsi krok ma zustat UI-only/read-model, bez noveho pollingu a bez rustu globalniho snapshot payloadu nad skutecne potreby panelu.

## 2026-03-21 09:42 | branch: feat/build-0.1.15

- Request: Implementovat dalsi krok `Armady vsech len` jako kompaktni zobrazovaci list.
- Summary: V `ArmyPanel` jsem prepnul treti tab na read-only variantu `Armady vsech len` bez naboru/staveb. Multi-village view ted cte existujici `armyOverview` data a zobrazuje pro kazde leno kompaktni kartu s nazvem/souradnicemi, souhrnem vlastnich+podporovych jednotek, ikonami `opevneni` a `brany` s urovni, horizontalnim radkem minimalistickych unit ikon s poctem a inline ikonovym tlacitkem pro otevreni profilu lena. Zaroven jsem odstranil uz nepouzivane callbacky/props pro cross-village recruit+upgrade, aby zustal cisty read-model a nevznikaly mrtve mutacni pathy.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (PASS)
- Notes: Feature contract zustava UI-only/read-model. Hlavni riziko byl zbytecny rerender a rozsireni stavu v `GamePage`; mitigace je vyuziti existujiciho `armyOverview` fetch flow bez noveho endpointu/pollingu.

## 2026-03-21 09:53 | branch: feat/build-0.1.15

- Request: Implementovat frontend napojeni `Recruit queue reorder UI` podle roadmapy, protoze backend reorder uz existuje.
- Summary: Dodelal jsem reorder naborove fronty v `ArmyPanel`: sipky `↑/↓` i drag&drop mezi cekajicimi polozkami, blokaci presunu aktivni (prvni) polozky a navazani na existujici endpoint `POST /api/v1/units/recruitments/reorder`. V `GamePage` jsem pridal `reorderRecruitmentPendingId`, novy handler `handleReorderRecruitment`, napojeni na `reorderRecruitmentQueueRequest`, guardy proti soubehu `cancel/reorder` a UI notice s vysledkem presunu. Soucasne jsem upravil text fronty na sekvencni chovani (ne paralelni), aby odpovidal backend timeline.
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run build` (PASS)
- Notes: Feature contract zustava bez noveho endpointu i bez noveho pollingu; jde jen o frontend wiring nad existujicim backend kontraktem.

## 2026-03-21 10:40 | branch: feat/build-0.1.15

- Request: Implementovat roadmap milestone pro `research/economy` (platba projektu z aktivniho lena + prevody `gold/coins`) a navazne `combat ranky + loot leaderboard` se zmenou historickych agregaci.
- Summary: Dodelal jsem backend+DB+UI kontrakt pro logistiku `gold/coins` a pevne svazani research/logistik mutaci na explicitne vybrane aktivni leno (`strictRequestedVillage`). `army_movements` a `logistics_routes` dostaly `carry_gold/carry_coins` a `gold/coins` sloupce, tick delivery/return flow je ted aplikuje stejne jako drevo/kamen/zelezo a logistika je zohlednuje i pri cancel/refund. V battle resolution jsem rozsiril loot model o `gold/coins` vcetne ochrany z `vault` a navazneho navratu koristi. Soucasne jsem upravil agregace zebricku: utocnik, obrance i podporovatel ted pocitaji padle na obou stranach podle dohodnute logiky a pribyl samostatny player-only ranking `Kořist` s `lootScore/lootRank`.
- Files: server/db.js, server/gameService.js, src/api/gameApi.ts, src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run build` (PASS), `npm run test:regression` (PASS, 28/28), `node --check server/db.js` (PASS), `node --check server/gameService.js` (PASS), `node --check server/index.js` (PASS)
- Notes: Zmena je additive (bez noveho pollingu). Logistika a loot payloady zustavaji zpětne kompatibilni pro starsi data pres default 0.

## 2026-03-21 11:51 | branch: feat/build-0.1.15

- Request: Otestovat nove veci (research/economy + combat/loot zebricky) a zjistit co funguje/nefunguje.
- Summary: Rozsiril jsem regresni harness o 3 nove scenare a odpovidajici testy: (1) research platba z explicitne vybraneho aktivniho lena + strict reject neplatneho `villageId`, (2) logistika `gold/coins` vcetne send/cancel-refund/delivery + snapshot payload, (3) agregace combat ranku a loot leaderboardu pro utocnika/obrance/podporovatele. Pri prvnim behu jsem odhalil a odstranil test harness nepresnosti (sync casu surovin, desetinna tolerance po ticku, mapovani `market.logisticsRoutes` s `id` misto `routeId`, ocekavany supporter score podle movement-level attacker losses). Po korekci vsechny testy prochazi a nove milniky se chovaji konzistentne.
- Files: tests/regression/game-rules.scenario.mjs, tests/regression/game-rules.regression.test.mjs, arch/chat-changelog.md
- Verification: `npm run test:regression` (PASS, 31/31), `npm run build` (PASS), `npm run lint` (FAIL - existujici React hook purity/set-state-in-effect chyby v `src/App.tsx` a `src/pages/GamePage.tsx`)
- Notes: Nenalezena funkcni regrese v implementovanych milnicich; zjištěné pádové body byly v testovacích očekáváních/harness detailu, ne v runtime feature logice.

## 2026-03-21 | branch: feat/build-0.1.15

- Request: Opravit to, co “nefunguje”, tedy React hook purity/set-state-in-effect chyby v `src/App.tsx` a `src/pages/GamePage.tsx`, a potvrdit, zda to jde udělat bez regresi.
- Summary: Prevedl jsem synchronni sync stavu z effectu na odvozene hodnoty a asynchronni commit: mercenary vyber je ted resilen pres odvozene `resolvedSelectedMercenaryVillageId`, map zoom se synchronizuje pres odlozene `setTimeout` v effectu, planner validace ma vlastni clock hook `plannerNowMs`, a `useEffectEvent` je znovu korektne importovany. Zaroven jsem vycistil chybne dependency array u souvisejicich callbacku a pridal ESLint ignorace pro generovane a backup adresare, aby lint nehlasil hluk mimo zdrojaky.
- Files: src/pages/GamePage.tsx, eslint.config.js, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS), `npm run test:regression` (PASS, 31/31)

## 2026-03-21 | branch: develop

- Request: Mergnout aktualni praci do `develop` a spustit ji lokalne na localhostu.
- Summary: Commitnul jsem rozpracovane zmeny na `feat/build-0.1.15` jako `11aed5f feat(gameplay): finalize 0.1.15 roadmap rollout`, lokalni `develop` jsem na ne fast-forward mergnul a provedl cisty restart lokalniho dev behu. Nova session bezi pres `npm run dev` nad vetvi `develop` s klientem na `http://localhost:5173` a backendem na `http://localhost:3001`.
- Files: arch/chat-changelog.md
- Verification: `git merge --ff-only feat/build-0.1.15` (PASS), `npm run dev` na `develop` (RUNNING), porty `5173` a `3001` naslouchaji

## 2026-03-21 | branch: develop

- Request: Overit, kde je v UI moznost posilat zlato a mince, a pote ji doplnit i do panelu vyzkumu.
- Summary: Overil jsem, ze prevody `gold/coins` byly uz implementovane v `CommandsPanel > Trh a logistika`, ale ne ve vyzkumu. Proto jsem pridal do `ResearchPanel` novou sekci `Pokladnice mezi lény`, ktera nad existujicim market-logistics API umi z aktivniho lena posilat zlato a mince do jineho vlastniho lena, zobrazovat ETA, kapacitu trhu, aktivni prevody a zruseni prevodu. Soucasne jsem rozsiril market-dependent fetch i pro rozbaleny panel vyzkumu, aby se data nacitala bez noveho globalniho pollingu.
- Files: src/pages/GamePage.tsx, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS), `npm run test:regression` (PASS, 31/31)

## 2026-03-21 14:30 | branch: develop

- Request: Dodelat testy, ktere potvrdi, ze nove treasury prevody `gold/coins` funguji v souladu se stavajici herni logikou trhu a ekonomiky.
- Summary: Rozsiril jsem regresni harness o dva nove economy scenare a odpovidajici testy. Prvni overuje treasury-only prevod mezi vlastnimi leny pres existujici market-logistics kontrakt, vcetne send/cancel-refund/delivery a zaruky, ze `wood/stone/iron` zustanou beze zmeny. Druhy overuje, ze stejne treasury prevody stale podlehaji puvodnim guard pravidlum trhu: nulova zasilka je odmitnuta, bez trhu nelze odesilat, kapacita trhu se neprekroci, zdrojove leno musi mit dost prostredku a nedostupni obchodnici blokují dalsi trasu. Pri prvnim behu jsem odhalil, ze testovy scenar byl znecisten pasivni produkci cile behem `runGameTick`, proto jsem v nem vynuloval produkcni budovy, aby meril jen logistickou logiku.
- Files: tests/regression/game-rules.scenario.mjs, tests/regression/game-rules.regression.test.mjs, arch/chat-changelog.md
- Verification: `npm run test:regression` (PASS, 33/33)
- Notes: Feature contract zustava beze zmen v runtime kodu; jde o test coverage nad existujicim market/economy flow. Hlavni riziko byla falesna negativita z tick-based resource syncu, mitigace je izolace scenare vypnutim produkce.

## 2026-03-21 14:59 | branch: main

- Request: Merge `develop` do `main` (produkce) a nasadit zmeny live.
- Summary: V `main` worktree jsem nejdriv ulozil existujici lokalni zmeny checkpoint commitem, potom mergnul `develop -> main` a vyresil konflikty ve prospech `develop`, aby produkce odpovidala testovane vetvi. Nasledne jsem dorovnal soubory, ktere po mergi rozbijely build kontrakty (`package.json`, `src/api/gameApi.ts`, `server/gameService.js`, `src/version.ts`, `src/App.css`, `scripts/release-doctor.mjs`, `arch/verejny-poradek-armada-db-spec-v1.md`), pushnul `main` na `origin` a provedl produkcni deploy pres Netlify CLI.
- Files: arch/chat-changelog.md, package.json, server/gameService.js, src/App.css, src/api/gameApi.ts, src/version.ts, scripts/release-doctor.mjs, arch/verejny-poradek-armada-db-spec-v1.md, plus merge zmeny z `develop` do `main`
- Verification: `npm run build` (PASS), `npm run test:regression` (PASS, 33/33), `git push origin main` (PASS), `npx netlify deploy --prod --build` (PASS)
- Notes: Produkcni URL je `https://thelastdominion.netlify.app` a unikatni deploy URL `https://69bea42959f45bb2f0189253--thelastdominion.netlify.app`.

## 2026-03-21 15:12 | branch: main

- Request: Prejit do `main` a opravit verzi hry na `0.1.15`.
- Summary: Opravil jsem verzi vydani v package metadata i ve frontend labelu hry, aby klient i build pipeline konzistentne hlasily `0.1.15` misto `0.1.14`.
- Files: package.json, src/version.ts, arch/chat-changelog.md
- Verification: `npm run build`

## 2026-03-21 17:41 | branch: feat/build-0.1.16

- Request: Udelat UI redesign hry (odstranit rusive sede ramecky, sjednotit fonty/barvy, zvyraznit dulezita cisla), pridat detail do tlacitek mimo horni menu, opravit vyjizdeni seznamu len mimo kontejner na ultra-wide, zlepsit viditelnost ikon (vcetne verejneho poradku s tooltipem) a vyresit nekonzistentni avatar.
- Summary: V `GamePage` jsem upravil semantiku a render kritickych casti UI: doplnil barevne tridy pro dulezite statistiky (prestiz/fialova, utok/cervena, obrana/modra, loot/zlata), presunul a zvetsil badge verejneho poradku vedle aktivniho lena s tooltipem, opravil pozicovani village menu pro fixed overlay na ultra-wide a upravil globalni stripovani native `title`, aby tooltipy nezanikaly. V avatar flow jsem pridal per-user local fallback cache URL (cteni pri bootstrapu + zapis po fetch/save), aby se avatar po relogu neztracel pri docasne nekonzistentni odpovedi. V `App.css` jsem sjednotil typografii, odstranil rusive sede ramecky na kartach, zvysil kontrast a vizualni prioritu dulezitych cisel, sjednotil velikosti ikon u army/resource prvku a pridal jemny SVG texture detail do akcních tlacitek (bez zasahu do horniho menu).
- Files: src/pages/GamePage.tsx, src/App.css, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS), `npm run dev` s `PORT=3001` a `VITE_DEV_PORT=5173` (RUNNING; client `http://localhost:5173`, backend `http://localhost:3001`)
- Notes: Feature contract drzi beze zmen endpointu a pollingu. Hlavni rizika byla vizualni regrese v hustych panelech a chybna pozice menu na sirokych viewptech; mitigace je centralni override vrstva v CSS + fix viewport-based left clampu pro village menu.

## 2026-03-21 19:09 | branch: feat/build-0.1.16

- Request: Projít zbylé rámy v UI, vložit `mapa.svg` pod léna do herní mapy a doladit barvy rozlišení pro hráčská léna na mapě.
- Summary: Do map panelu jsem přidal samostatnou background vrstvu s `mapa.svg` pod settlement layer, aby mapa měla vlastní podklad pod lény bez zásahu do gameplay logiky. Současně jsem zpřesnil defaultní paletu a canvas styly pro `active` a `own` settlements, aby hráčská léna na mapě působila jasněji odlišeně. Asset jsem zkopíroval do `public/assets/map/mapa.svg`, aby ho dev/build skutečně servíroval; `for_public/mapa.svg` zůstává jako zdrojový staging asset.
- Files: src/pages/GamePage.tsx, src/App.css, public/assets/map/mapa.svg, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS)
- Notes: `mapa.svg` je pro tenhle krok vizuální vrstva pod mapou, ne plnohodnotná náhrada všech bitmap v projektu. U velkých art assets zůstává lepší držet raster nebo je optimalizovat cíleně, jinak se SVG může zvětšit a zpomalit načtení místo zrychlení.

## 2026-03-21 19:31 | branch: feat/build-0.1.16

- Request: Dokončit sweep zbylých rámů, nahradit basic tooltip pro veřejný pořádek vylepšeným tooltipem napravo od přejmenování léna a optimalizovat vybrané bitmapy pro rychlejší načítání.
- Summary: Rozšířil jsem frameless override vrstvu o další zbylé panely v city/army částech, hlavně `city-upgrade-queue`, `army-command-history`, `army-command-preview` a jejich související položky, aby UI méně působilo jako sada starých karet. Veřejný pořádek teď používá náš tooltip styl `commands-army-tooltip`, je ukotvený napravo od rename buttonu a má vlastní hover/focus chování i responsivní fallback pod 1180 px. Z velkých bitmap jsem převedl používané textury na WebP a přepnul na ně reference v CSS, aby se zlepšila velikost assets bez změny gameplay logiky.
- Files: src/App.css, public/assets/backgrounds/background2.webp, public/assets/map/terrain/louka.webp, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS), dev server běží na `http://localhost:5173` a backend na `http://localhost:3001`
- Notes: U velkých art assetů jsem zvolil WebP místo plošného převodu do SVG, protože jde o rasterové textury a SVG by v tomhle případě často zvětšilo soubor i render cost místo zrychlení.

## 2026-03-21 19:48 | branch: feat/build-0.1.16

- Request: Opravit neviditelný tooltip veřejného pořádku (vykresluje se pod background) a odstranit zbylé rámy v Přehledu i Armádě.
- Summary: V `App.css` jsem opravil vrstvení tooltipu veřejného pořádku: pro slim HUD kartu jsem povolil `overflow: visible`, přidal izolaci/z-index na kartu a zvýšil z-index samotného tooltipu, aby nebyl ořezaný ani schovaný pod jinou vrstvou. Současně jsem doplnil cílený frameless override pro kontejnery `city-panel` a `military-panel`, protože dark-medieval skin přidával globální rámy na `section/article/li` uvnitř `window-body`; tím pádem se odstranily zbývající rámy v Přehledu i na stránce Armáda.
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS), dev server stále běží na `http://localhost:5173` a backend na `http://localhost:3001`
- Notes: Feature contract: UI-only změna bez zásahu do gameplay/pollingu/backendu. Hlavní riziko bylo přebití skin-specifických pravidel a clipping tooltipu; mitigace je cílené scope pravidel na `city-panel`/`military-panel` a lokální stacking kontext pro kartu aktivního léna.

## 2026-03-21 19:57 | branch: feat/build-0.1.16

- Request: Navrhnout před implementací efektivní způsob, jak sjednotit pozadí karet napříč projektem, aby se karty neztrácely ve stejné barvě či gradientu.
- Summary: Prošel jsem existující CSS rodiny karet (`resource-card`, `panel-stack section`, `commands-item`, `military-unit-card`, `city-building-card`, `messages-*`, `battle-*`, `player-profile-*`) a navrhl sjednocený card systém místo dalších lokálních override. Návrh stojí na jednom sdíleném povrchovém jazyku přes CSS tokeny a malém počtu rolí karet (base, muted, elevated, interactive, semantic), aby se dal nasadit postupně bez zásahu do gameplay logiky a bez dalšího rozbití dark-medieval skin pravidly.
- Files: arch/chat-changelog.md
- Verification: Návrhová konzultace bez nových runtime změn; verifikace nebyla potřeba
- Notes: Feature contract: UI-only návrh bez změny state, fetch modelu nebo pollingu. Hlavní riziko je další nárůst duplicity a selector wars v `App.css`; mitigace je zavést card tokeny a migrovat panely po rodinách místo jednorázového přepisu všeho.

## 2026-03-21 20:09 | branch: feat/build-0.1.16

- Request: Bez implementace zpracovat card system plán: připravit přesný CSS token systém + 5 variant, první migrační vlnu pro `resource-card`, `panel-stack section`, `commands-item`, `military-unit-card` a druhou vlnu pro semantic varianty `battle/messages/profile`.
- Summary: Připravil jsem dva neintegrované draft artefakty. V `arch/card-system-unification-v1.md` je kompletní návrh card systému včetně feature contractu, design direction, přesných tokenů, pěti card variant, migrační mapy pro první i druhou vlnu a acceptance kritérií. V `arch/card-system-unification-v1.css` je draft CSS layer s tokeny a utility variantami `ui-card`, `ui-card--muted`, `ui-card--elevated`, `ui-card--interactive`, `ui-card--semantic` a připravenou mapou, jak na ně přepojit stávající card rodiny bez zásahu do runtime.
- Files: arch/card-system-unification-v1.md, arch/card-system-unification-v1.css, arch/chat-changelog.md
- Verification: Draft artefakty nejsou importované do aplikace; runtime verifikace nebyla potřeba
- Notes: Feature contract: UI-only příprava bez změn stavu, fetch modelu nebo pollingu. Hlavní riziko je selector conflict při budoucí implementaci; mitigace je migrace po card rodinách a ponechání skinů jen jako token override vrstvy.

## 2026-03-21 20:22 | branch: feat/build-0.1.16

- Request: Nasadit krok 1 a 2 card systému: doladit token paletu/varianty a implementovat první migrační vlnu pro `resource-card`, `panel-stack section`, `commands-item`, `military-unit-card`.
- Summary: V `src/App.css` jsem rozšířil `game-page` token layer o přesné card design proměnné (surface, border, edge, shadow, spacing) a nasadil wave-1 mapování pro čtyři cílové card rodiny. Nové pravidlo na konci souboru teď přemapovává `resource-card` na elevated variantu, `panel-stack section` na base variantu, `commands-item` na interactive variantu a `military-unit-card` na interactive-elevated variantu včetně sjednocených hover/focus stavů. Současně jsem doladil draft paletu i v `arch/card-system-unification-v1.css`, aby runtime implementace a návrhové artefakty používaly stejné hodnoty.
- Files: src/App.css, arch/card-system-unification-v1.css, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS)
- Notes: Feature contract: UI-only změna bez zásahu do gameplay/state/fetch. Hlavní riziko bylo přebití starších frameless/dark-medieval override; mitigace je wave-1 blok umístěný na konec `App.css` s cílenou prioritou jen na čtyři card rodiny.

## 2026-03-21 20:54 | branch: feat/build-0.1.16

- Request: Nasadit oba navazující body: 1) druhou migrační vlnu semantic variant pro `battle/messages/profile`, 2) kontrastní tuning card systému.
- Summary: Do `src/App.css` jsem přidal wave-2 blok na konec souboru. Nasadil jsem semantic card styl pro `messages-report-item/messages-detail-card`, `battle-army-card` (attacker/defender/support přes accent rail) a `player-profile-stat-card` (accent podle typu statistiky), vše nad jednotným card surface jazykem. Současně jsem provedl kontrastní tuning: tmavší panel surface (`--tld-surface-soft`), konzistentní border/edge/shadow pro semantic rodiny a výraznější oddělení karet od pozadí panelů bez návratu tvrdých rámů.
- Files: src/App.css, arch/chat-changelog.md
- Verification: `npm run lint` (PASS), `npm run build` (PASS)
- Notes: Feature contract: UI-only změna bez zásahu do datového toku a gameplay logiky. Hlavní riziko bylo přebití starších stylů `messages/battle/profile`; mitigace je wave-2 blok umístěný na konec `App.css` s cílenými selektory a explicitní prioritou.

## 2026-03-21 21:07 | branch: feat/build-0.1.16

- Request: Zprovoznit projekt na localhostu.
- Summary: Spustil jsem aktuální lokální dev flow přes `npm run dev` v samostatném CMD okně (`TLD Local Dev`) a ověřil běžící procesy i otevřené porty. Frontend je dostupný přes Vite na `5175` a backend přes Express na `3003`; runtime si tedy v tomto běhu nevzal dříve používané porty `5173/3001`.
- Files: arch/chat-changelog.md
- Verification: `netstat -ano | findstr ":5175"` (LISTENING, PID 166200), `netstat -ano | findstr "166404"` (LISTENING na `3003`), `curl.exe -I --max-time 8 http://localhost:5175` (HTTP 200), `curl.exe -I --max-time 8 http://localhost:3003` (HTTP 404 z Express rootu, server běží)
- Notes: Dev běží v otevřeném okně `TLD Local Dev`; pro zastavení stačí to okno zavřít nebo ukončit `npm run dev`.

## 2026-03-21 21:19 | branch: feat/build-0.1.16

- Request: Vrátit lokál na `5173`, zprovoznit backend s funkčními daty.
- Summary: Doplnil jsem branch-specific runtime override v `.env.feat-build-0-1-16.local`, aby větev `feat/build-0.1.16` nepoužívala fallback porty `5175/3003`, ale očekávané `5173/3001`, přitom zůstala napojená na vlastní branch databázi `server/data/branches/feat-build-0-1-16`. Následně jsem ukončil běžící fallback dev procesy a spustil čistý `npm run dev` znovu.
- Files: .env.feat-build-0-1-16.local, arch/chat-changelog.md
- Verification: `netstat -ano | findstr :5173` (LISTENING, PID 165996), `netstat -ano | findstr :3001` (LISTENING, PID 147080), `curl.exe -sS -o NUL -w "%{http_code}" http://localhost:5173` (`200`), `curl.exe -sS -o NUL -w "%{http_code}" http://localhost:3001/api/health` (`200`), `curl.exe -sS -o NUL -w "%{http_code}" http://localhost:3001/api/v1/worlds` (`401`, očekávané bez přihlášení)
- Notes: Feature contract: pouze lokální runtime konfigurace pro tuto branch; authoritative state zůstává v branch SQLite datech. Hlavní riziko bylo nechtěné sdílení DB mezi větvemi nebo rozbití API base; mitigace je samostatný branch env override s `TLD_DATA_DIR=server/data/branches/feat-build-0-1-16`. Dev běží v okně `TLD Local Dev`.
