# Docker + Git Workflow Guide (SQLite)

Purpose: safe branching, environment separation, and database protection
for self-hosted `Express + SQLite` backend (Docker) + Netlify frontend.

------------------------------------------------------------------------

## 1) Branching Strategy

- `main` -> production (live players)
- `develop` -> integration branch
- `feature/<name>` -> feature work
- `fix/<name>` / `hotfix/<name>` -> urgent fixes

Rules:

- never push directly to `main`
- merge to `main` only via PR
- tag production releases (e.g. `v0.1.07`)
- keep commits small and meaningful

------------------------------------------------------------------------

## 2) Environment Separation (Critical)

Branches manage code. Environments manage data.

Keep these separate:

- Netlify: frontend only (static SPA)
- Docker backend: production API + SQLite data storage

Have at least:

- production backend data (`./server/data` on server)
- development backend data (separate folder)

Never point dev frontend to production backend unless intentional.

------------------------------------------------------------------------

## 3) Backend Environment Variables (Docker)

Production:

    NODE_ENV=production
    THG_DATA_DIR=/data
    CORS_ORIGIN=https://thelastdominion.netlify.app

Optional:

    GAME_TICK_SCHEDULE=*/5 * * * * *
    TLD_VERSION_LABEL=build-0.1.07
    TLD_BUILD_ID=<commit-sha>

------------------------------------------------------------------------

## 4) Data Safety Guards

- Do not run SQLite in serverless production (Netlify Functions). Ephemeral filesystem -> rollbacky dat.
- Use persistent host storage mapped to `/data` (`./server/data:/data`).
- Keep regular backups of `game.sqlite`.

The backend refuses destructive auto-reseed in production (see `server/db.js`).

------------------------------------------------------------------------

## 5) Seed Strategy

- `server/data/game.seed.sqlite.backup` is a bootstrap snapshot.
- Use it only when the production storage is empty.
- Once production has live data, do not replace `game.sqlite` with seed.

------------------------------------------------------------------------

## 6) Release Flow (Recommended)

1) Backup production DB (`game.sqlite`) before deploy
2) Deploy backend (Docker) and verify `/api/health`
3) Deploy frontend (Netlify) and verify gameplay

------------------------------------------------------------------------

## 7) Backup Example (Linux Server)

- copy `./server/data/game.sqlite` to `backups/game.<timestamp>.sqlite`

------------------------------------------------------------------------

## 8) Production Safety Checklist

- `/api/health` returns expected version/build
- DB volume is mounted and non-empty
- no seed/reseed happened unexpectedly (check logs)
- frontend `/api/*` calls go to Docker backend (see `netlify.toml`)
