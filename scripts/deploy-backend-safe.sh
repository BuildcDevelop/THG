#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/server/data"
BACKUP_DIR="${ROOT_DIR}/server/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

if [[ -f "${DATA_DIR}/game.sqlite" ]]; then
  cp "${DATA_DIR}/game.sqlite" "${BACKUP_DIR}/game.${STAMP}.sqlite"
  echo "[deploy] backup created: ${BACKUP_DIR}/game.${STAMP}.sqlite"
else
  echo "[deploy] no existing game.sqlite found, skipping backup copy"
fi

cd "${ROOT_DIR}"
docker compose up -d --build
echo "[deploy] docker compose up -d --build done"

if command -v curl >/dev/null 2>&1; then
  echo "[deploy] health check:"
  curl -fsS "http://127.0.0.1:3001/api/health" || true
  echo
fi
