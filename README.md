# THG - Strategy Game Prototype (Frontend + Backend)

SPA prototyp inspirovany hrami Divoke Kmeny, Eco a Civilizace, nove se zivym backendem.

## Co je hotove

- Vstupni stranka s tmavym UI a kratkym popisem hry.
- Login system pres realne herni ucty.
- Admin panel (`/admin`) pro prepnuti mezi hraci bez loginu (test rezim).
- Chranena herni stranka po prihlaseni.
- Top navigace podle navrhu dokumentu (mesto, armada, vyzkum, zpravy, kralovstvi, zebricek, profil, nastaveni).
- Resource panel (drevo, kamen, zelezo, populace) napojeny na backend data.
- Float/pin system oken:
  - leva i prava pin lista,
  - otevirani/sbaleni/zavreni oken,
  - prepnuti pinu mezi stranami,
  - pretahovani oken mysi (desktop),
  - fokus pres z-index.
- Vychozi okno po loginu je stranka mesta:
  - budovy a jejich urovne,
  - klik na budovu otevre samostatne plovouci/pinovatelne okno detailu budovy s vetsim artem,
  - prehled jednotek,
  - aktivni rozkazy z backendu.
- Dalsi panely: armada, vyzkum, zpravy/chat, kralovstvi, zebricek, profil a nastaveni.
- Backend (Express + SQLite + cron tick):
  - periodicky tick (`node-cron`) posouva ekonomiku v case,
  - ukladani surovin, budov, jednotek a fronty upgradu do DB,
  - upgrade budov pouze pri dostatku surovin,
  - nabor jednotek pouze pri dostatku surovin,
  - limity: budovy max `10`, jednotky max `99`.

## Spusteni

```bash
npm install
npm run dev
```

Spusti se:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

Tick interval lze zmenit pres env promennou:

```bash
GAME_TICK_SCHEDULE="*/5 * * * * *"
```

## Self-host backend (Docker, bez Convexu)

Pokud chces odchod z Convexu kvuli limitum, nejjednodussi je bezet na vlastnim Node serveru se SQLite.
V repu je pripraveny `compose.yaml` pro backend (`server/index.js`).

Na serveru v rootu repa spust:

```bash
docker compose up -d --build
```

Stack obsahuje:

- `api` (Express + SQLite)
- `proxy` (Caddy reverse proxy/TLS pro `api.tld.com`)

Data se ukladaji do SQLite souboru (volume mount):

- host: `server/data/`
- container: `/data/` (pres `THG_DATA_DIR=/data`)

### Frontend napojeni na self-host backend

Frontend defaultne vola relativni `'/api/*'`. Pro oddeleny backend nastav ve frontendu env:

- `VITE_API_BASE=https://<tvoje-api-domena>` (bez trailing slash)

Na Netlify to nastav jako environment variable pro build.

### Bezpecny lokalni vyvoj (dulezite)

- Lokalni `npm run dev` ma mit `VITE_API_BASE=http://localhost:3001` (viz `.env.development`).
- Pokud otevres aplikaci na `localhost` a `VITE_API_BASE` miri na vzdalenou API domenu, klient to ted zablokuje.
- Vyjimka je mozna jen vedome pres `VITE_ALLOW_REMOTE_API_FROM_LOCALHOST=true`.

## Build

```bash
npm run build
npm run preview
```

## Convex databaze

Convex cast je ponechana jen jako historicka reference. Aktivni backend rezim je `Express + SQLite` a pro self-host deployment se pouziva Docker (`compose.yaml`).

## Netlify deploy

Projekt je pripraveny pro Netlify:

- frontend se builduje do `dist/`,
- API je routovane pres Netlify Function (`netlify/functions/api.mjs`),
- vsechny `'/api/*'` requesty jdou na funkci pres `netlify.toml`.

### Netlify nastaveni

V Netlify UI nastav:

- Build command: `npm run build`
- Publish directory: `dist`

Jednorazove propojeni projektu:

```bash
npx netlify link
```

Environment variables:

- `VITE_API_BASE` (napr. `https://api.tvoje-domena.cz`)
- `TLD_VERSION_LABEL` (napr. `build-0.1.04`)
- `TLD_BUILD_ID` (unikatni identifikator buildu, idealne commit SHA)
- `TLD_UPDATE_STATUS` (`idle` / `building` / `deploying` / `maintenance`)

Pozn.: pokud chces na Netlify pouzivat Netlify Functions (`/api/*`), nenechavej `VITE_API_BASE` nastavene na externi produkcni API. Jinak frontend obejde Netlify funkci a mutace pujdou primo na externi databazi.

Volitelne:

- `GAME_TICK_SCHEDULE` (hlavne pro lokalni server, v serverless full rezimu se cron nepouziva)
- `THG_DATA_DIR` (custom cesta pro SQLite fallback)

### Lokalni simulace Netlify

```bash
npm run dev:netlify
```

To spusti Vite + Netlify Functions lokalne pod jednim hostem.

### Deploy prikazy

Preview deploy:

```bash
npx netlify deploy --build
```

Production deploy:

```bash
npx netlify deploy --prod --build
```

Poznamka pro deploy z Windows (native `better-sqlite3`):

- pred deployem priprav Linux binarku:
  - `npm_config_platform=linux npm_config_arch=x64 npm rebuild better-sqlite3 --build-from-source=false`
- deploy spoustet s `--skip-functions-cache`, aby se prebundlovala funkce:
  - `npx netlify deploy --prod --build --skip-functions-cache`
- po deployi vrat lokalni Windows binarku:
  - `npm rebuild better-sqlite3 --build-from-source=false`

## Prihlaseni (prototyp)

- Specialni ucty:
  - `Hayato / 123`
  - `Torreya / 123`
  - `Pegak / 123`
  - `Sentryn / 123`
  - `TSN / 123`
- Dalsich 100 testovacich uctu: `Player001` az `Player100`, heslo vzdy `123`.

## API (zaklad)

- `GET /api/health`
- `POST /api/v1/auth/login`
- `GET /api/v1/admin/players`
- `GET /api/v1/state?username=Hayato`
- `POST /api/v1/buildings/:buildingId/upgrade`
- `POST /api/v1/units/:unitId/recruit`
- `POST /api/v1/tick`

## Assety

- Ikony budov: **Kenney - Medieval RTS** (CC0)
- Zdroj: `https://kenney.nl/assets/medieval-rts`
- Lokalni ulozene v `public/assets/buildings/` (vcetne `LICENSE_KENNEY.txt`)
- Slozka `for_public/` slouzi jen jako vstup pro nove obrazky; hra cte assety pouze z `public/assets/buildings/`.
