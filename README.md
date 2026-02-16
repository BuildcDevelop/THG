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

## Build

```bash
npm run build
npm run preview
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
