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
