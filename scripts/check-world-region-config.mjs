import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const parseNumericProps = (source, descriptor, keys) => {
  const parsed = {};
  for (const key of keys) {
    const match = source.match(new RegExp(`${key}\\s*:\\s*(\\d+)`));
    if (!match) {
      throw new Error(`Nelze najit hodnotu "${key}" v ${descriptor}.`);
    }
    parsed[key] = Number(match[1]);
  }
  return parsed;
};

const parseDominion1Region = (source) => {
  const blockMatch = source.match(/dominion1\s*:\s*{([\s\S]*?)},\s*dominionFire\s*:/);
  if (!blockMatch) {
    throw new Error('Nelze najit blok "dominion1" v server/gameService.js.');
  }
  return parseNumericProps(blockMatch[1], "server/gameService.js (dominion1)", [
    "id",
    "originX",
    "originY",
    "size",
  ]);
};

const parseWorldRegionConst = (source, descriptor) => {
  const blockMatch = source.match(/const\s+WORLD_REGION\s*=\s*{([\s\S]*?)};/);
  if (!blockMatch) {
    throw new Error(`Nelze najit "WORLD_REGION" v ${descriptor}.`);
  }
  return parseNumericProps(blockMatch[1], descriptor, ["id", "originX", "originY", "size"]);
};

const parseFrontendFallbackRegion = (source) => {
  const regionSize = source.match(/const\s+REGION_SIZE\s*=\s*(\d+);/);
  const regionOriginX = source.match(/const\s+REGION_ORIGIN_X\s*=\s*(\d+);/);
  const regionOriginY = source.match(/const\s+REGION_ORIGIN_Y\s*=\s*(\d+);/);
  const sectorSize = source.match(/const\s+MAP_SECTOR_SIZE\s*=\s*(\d+);/);
  if (!regionSize || !regionOriginX || !regionOriginY || !sectorSize) {
    throw new Error("Nelze najit fallback konstanty mapy ve src/pages/GamePage.tsx.");
  }
  return {
    id: 1,
    originX: Number(regionOriginX[1]),
    originY: Number(regionOriginY[1]),
    size: Number(regionSize[1]),
    mapSectorSize: Number(sectorSize[1]),
  };
};

const equalsRegion = (a, b) =>
  a.id === b.id && a.originX === b.originX && a.originY === b.originY && a.size === b.size;

try {
  const gameService = read("server/gameService.js");
  const db = read("server/db.js");
  const gamePage = read("src/pages/GamePage.tsx");

  const dominion1Region = parseDominion1Region(gameService);
  const dbRegion = parseWorldRegionConst(db, "server/db.js");
  const frontendRegion = parseFrontendFallbackRegion(gamePage);

  const failures = [];
  if (!equalsRegion(dominion1Region, dbRegion)) {
    failures.push("server/db.js WORLD_REGION neni konzistentni se server/gameService.js dominion1.");
  }
  if (!equalsRegion(dominion1Region, frontendRegion)) {
    failures.push(
      "src/pages/GamePage.tsx fallback REGION_* konstanty nejsou konzistentni se server/gameService.js dominion1.",
    );
  }

  if (frontendRegion.size % frontendRegion.mapSectorSize !== 0) {
    failures.push("REGION_SIZE neni delitelne MAP_SECTOR_SIZE, sektorove cary nebudou presne na hranach.");
  }

  if (failures.length > 0) {
    console.error("[check:world-config] FAILED");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  const centerX = dominion1Region.originX + (dominion1Region.size - 1) / 2;
  const centerY = dominion1Region.originY + (dominion1Region.size - 1) / 2;
  const sectors = frontendRegion.mapSectorSize > 0 ? frontendRegion.size / frontendRegion.mapSectorSize : 0;

  console.log("[check:world-config] OK");
  console.log(
    `[check:world-config] dominion1 region: id=${dominion1Region.id}, origin=${dominion1Region.originX}|${dominion1Region.originY}, size=${dominion1Region.size}`,
  );
  console.log(`[check:world-config] map center: ${centerX}|${centerY}`);
  console.log(
    `[check:world-config] sector grid: ${sectors}x${sectors} (step ${frontendRegion.mapSectorSize})`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[check:world-config] ERROR: ${message}`);
  process.exit(1);
}
