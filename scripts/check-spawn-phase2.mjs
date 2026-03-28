import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gameServiceSource = fs.readFileSync(path.join(root, "server", "gameService.js"), "utf8");
const sourceDbPath = path.resolve(
  root,
  String(process.env.TLD_SPAWN_CHECK_SOURCE_DB ?? "server/data/game.sqlite").trim(),
);
const checkCount = Math.max(1, Number.parseInt(String(process.env.TLD_SPAWN_CHECK_COUNT ?? "12"), 10) || 12);
const runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tempDataDir = path.join(root, "artifacts", "spawn-check-runs", runToken);
const copiedDbPath = path.join(tempDataDir, "game.sqlite");

if (!fs.existsSync(sourceDbPath)) {
  throw new Error(`Zdrojova DB pro spawn check neexistuje: ${sourceDbPath}`);
}

fs.mkdirSync(tempDataDir, { recursive: true });
fs.copyFileSync(sourceDbPath, copiedDbPath);

process.env.TLD_DATA_DIR = tempDataDir;
process.env.TLD_ENV = process.env.TLD_ENV ?? "development";

const { createPlayerAccount, spawnPlayerInWorld } = await import("../server/gameService.js");

const worldSectorSizeMatch = gameServiceSource.match(/const\s+WORLD_SECTOR_SIZE\s*=\s*(\d+);/);
const dominion1BlockMatch = gameServiceSource.match(/dominion1\s*:\s*{([\s\S]*?)},\s*dominionFire\s*:/);
if (!worldSectorSizeMatch || !dominion1BlockMatch) {
  throw new Error("Nelze nacist konfiguraci dominion1/WORLD_SECTOR_SIZE ze server/gameService.js.");
}

const parseNumericProp = (source, key) => {
  const match = source.match(new RegExp(`${key}\\s*:\\s*(\\d+)`));
  if (!match) {
    throw new Error(`Nelze najit hodnotu ${key} ve spawn check skriptu.`);
  }
  return Number(match[1]);
};

const region = {
  originX: parseNumericProp(dominion1BlockMatch[1], "originX"),
  originY: parseNumericProp(dominion1BlockMatch[1], "originY"),
  size: parseNumericProp(dominion1BlockMatch[1], "size"),
  sectorSize: Number(worldSectorSizeMatch[1]),
};
const sectorCount = Math.ceil(region.size / region.sectorSize);
const centerSectorIndex = Math.floor(sectorCount / 2);
const legacyCore = {
  minX: region.originX + centerSectorIndex * region.sectorSize,
  maxX: region.originX + (centerSectorIndex + 1) * region.sectorSize - 1,
  minY: region.originY + centerSectorIndex * region.sectorSize,
  maxY: region.originY + (centerSectorIndex + 1) * region.sectorSize - 1,
};

const results = [];
for (let index = 0; index < checkCount; index += 1) {
  const username = `sp2${runToken.slice(-6)}${String(index).padStart(2, "0")}`;
  createPlayerAccount(username, "phase2-check-password");
  const spawnResult = spawnPlayerInWorld(username, "dominion-1", "center");
  const firstVillage = Array.isArray(spawnResult?.villages) && spawnResult.villages.length > 0
    ? spawnResult.villages[0]
    : null;
  const coordX = Number(firstVillage?.coordX);
  const coordY = Number(firstVillage?.coordY);
  const sectorX = Math.max(0, Math.min(sectorCount - 1, Math.floor((coordX - region.originX) / region.sectorSize)));
  const sectorY = Math.max(0, Math.min(sectorCount - 1, Math.floor((coordY - region.originY) / region.sectorSize)));
  const sectorRing = Math.max(Math.abs(sectorX - centerSectorIndex), Math.abs(sectorY - centerSectorIndex));
  const inLegacyCore =
    coordX >= legacyCore.minX &&
    coordX <= legacyCore.maxX &&
    coordY >= legacyCore.minY &&
    coordY <= legacyCore.maxY;

  results.push({
    username,
    coordX,
    coordY,
    sectorX,
    sectorY,
    sectorRing,
    inLegacyCore,
  });
}

const failures = results.filter((entry) => entry.inLegacyCore || entry.sectorRing < 1);

if (failures.length > 0) {
  console.error("[check:spawn-phase2] FAILED");
  console.error(JSON.stringify({ tempDataDir, failures, results }, null, 2));
  process.exit(1);
}

console.log("[check:spawn-phase2] OK");
console.log(
  `[check:spawn-phase2] source=${sourceDbPath} tempDataDir=${tempDataDir} created=${results.length} failures=${failures.length}`,
);
console.log(JSON.stringify(results, null, 2));
