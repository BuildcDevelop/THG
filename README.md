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
GAME_TICK_SCHEDULE="* * * * * *"
```

## Self-host backend (Docker, bez Convexu)

Pokud chces odchod z Convexu kvuli limitum, nejjednodussi je bezet na vlastnim Node serveru se SQLite.
V repu je pripraveny `compose.yaml` pro backend (`server/index.js`).

Na serveru v rootu repa spust:

```bash
docker compose up -d --build
```

Bezpecnejsi varianta s automatickym backupem DB:

```bash
bash scripts/deploy-backend-safe.sh
```

Stack obsahuje:

- `api` (Express + SQLite)
- `proxy` (Caddy reverse proxy/TLS pro `api.tld.com`)

Data se ukladaji do SQLite souboru (volume mount):

- host: `server/data/`
- container: `/data/` (pres `THG_DATA_DIR=/data`)

Pri prvnim startu (prazdny volume) se DB zbootstrappuje ze `server/data/game.seed.sqlite.backup`.

### Frontend napojeni na self-host backend

Frontend defaultne vola relativni `'/api/*'`. Pro oddeleny backend nastav ve frontendu env:

- `VITE_API_BASE=https://<tvoje-api-domena>` (bez trailing slash)

Na Netlify to nastav jako environment variable pro build.

### Bezpecny lokalni vyvoj (dulezite)

- `npm run dev` je ted branch-aware:
  - `develop` pouzije frontend `http://localhost:5173`, backend `http://localhost:3001` a SQLite v `server/data/branches/develop/`
  - `main`/`master` pouzije frontend `http://localhost:5174`, backend `http://localhost:3002` a SQLite v `server/data/branches/main/`
  - ostatni branche defaultne pouziji vlastni branch scope a fallback porty `5175/3003`, pokud si je neprebijes v `.env.<branch>.local`
- Pri prvnim lokalnim startu po teto zmene se stary sdileny `server/data/game.sqlite` automaticky zkopiruje do aktualni branch slozky, aby se neztratil rozpracovany stav.
- Sdilene lokalni hodnoty nech v `.env.local`; branch-specific porty/data patri do `.env.develop.local`, `.env.main.local` nebo `.env.<branch>.local`.
- Lokalni `npm run dev` ma mit `VITE_API_BASE` namirene na lokalni backend dane branche.
- Pokud otevres aplikaci na `localhost` a `VITE_API_BASE` miri na vzdalenou API domenu, klient to ted zablokuje.
- Vyjimka je mozna jen vedome pres `VITE_ALLOW_REMOTE_API_FROM_LOCALHOST=true`.

## Build

```bash
npm run build
npm run preview
```

## Netlify deploy

Netlify slouzi jen jako frontend (SPA). Backend se ma provozovat self-host (Docker + SQLite).

- frontend se builduje do `dist/`
- requesty na `'/api/*'` Netlify proxyuje na backend (viz `netlify.toml`)

### Netlify nastaveni

V Netlify UI nastav:

- Build command: `npm run build`
- Publish directory: `dist`

Jednorazove propojeni projektu (volitelne):

```bash
npx netlify link
```

Pozn.: produkcni stav hry nesmi bezet na SQLite v serverless prostredi (ephemeral filesystem -> opakovane rollbacky dat). Pouzij Docker s persistentnim volume.

### Lokalni simulace Netlify

```bash
npm run dev:netlify
```

### Deploy prikazy

Preview deploy:

```bash
npx netlify deploy --build
```

Production deploy:

```bash
npx netlify deploy --prod --build
```

### Release doctor (pred/po deployi)

Pro rychly release contract + smoke check:

```bash
npm run release:doctor:prod
```

Volitelne lze kontrolovat i Netlify production env kontrakt:

```bash
npm run release:doctor -- --base-url=https://thelastdominion.netlify.app --check-netlify-env
```

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
