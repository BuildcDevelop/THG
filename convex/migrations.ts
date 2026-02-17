import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

type Snapshot = Record<string, unknown>;
type SnapshotRow = Record<string, unknown>;
type ConvexTableName =
  | "players"
  | "villages"
  | "resources"
  | "buildings"
  | "units"
  | "buildingUpgrades"
  | "unitRecruitments"
  | "armyMovements"
  | "armyMovementUnits"
  | "battleReports"
  | "gameState";

const TABLES: ConvexTableName[] = [
  "armyMovementUnits",
  "battleReports",
  "armyMovements",
  "buildingUpgrades",
  "unitRecruitments",
  "buildings",
  "units",
  "resources",
  "villages",
  "players",
  "gameState",
];

type ClearTableCtx = {
  db: {
    query: (tableName: ConvexTableName) => {
      collect: () => Promise<Array<{ _id: Id<ConvexTableName> }>>;
    };
    delete: (id: Id<ConvexTableName>) => Promise<void>;
  };
};

const isRecord = (value: unknown): value is SnapshotRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readSnapshot = (value: unknown): Snapshot => {
  if (!isRecord(value)) {
    throw new Error("Argument 'snapshot' musi byt objekt.");
  }
  return value;
};

const readRows = (snapshot: Snapshot, key: string): SnapshotRow[] => {
  const value = snapshot[key];
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Snapshot pole '${key}' musi byt pole.`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Snapshot pole '${key}' obsahuje neplatny zaznam na indexu ${index}.`);
    }
    return entry;
  });
};

const readNumber = (row: SnapshotRow, key: string, context: string): number => {
  const rawValue = row[key];
  const normalized = Number(rawValue);
  if (!Number.isFinite(normalized)) {
    throw new Error(`Snapshot ${context}.${key} musi byt cislo.`);
  }
  return normalized;
};

const readString = (row: SnapshotRow, key: string, context: string): string => {
  const rawValue = row[key];
  if (typeof rawValue !== "string") {
    throw new Error(`Snapshot ${context}.${key} musi byt text.`);
  }
  return rawValue;
};

const readOptionalString = (row: SnapshotRow, key: string): string | undefined => {
  const rawValue = row[key];
  if (rawValue == null) {
    return undefined;
  }
  return String(rawValue);
};

const readOptionalNumber = (row: SnapshotRow, key: string): number | undefined => {
  const rawValue = row[key];
  if (rawValue == null) {
    return undefined;
  }
  const normalized = Number(rawValue);
  if (!Number.isFinite(normalized)) {
    return undefined;
  }
  return normalized;
};

const readBoolean = (row: SnapshotRow, key: string, context: string): boolean => {
  const rawValue = row[key];
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") {
      return true;
    }
    if (normalized === "0" || normalized === "false") {
      return false;
    }
  }

  throw new Error(`Snapshot ${context}.${key} musi byt boolean nebo 0/1.`);
};

const clearTable = async (ctx: ClearTableCtx, tableName: ConvexTableName) => {
  const docs = await ctx.db.query(tableName).collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
};

export const clearAllTables = mutation({
  args: {},
  handler: async (ctx) => {
    for (const tableName of TABLES) {
      await clearTable(ctx, tableName);
    }

    return {
      ok: true,
      clearedTables: TABLES.length,
    };
  },
});

export const importSqliteSnapshot = mutation({
  args: {
    snapshot: v.any(),
    wipeBeforeImport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const snapshot = readSnapshot(args.snapshot);
    const wipeBeforeImport = args.wipeBeforeImport ?? true;

    if (wipeBeforeImport) {
      for (const tableName of TABLES) {
        await clearTable(ctx, tableName);
      }
    }

    const players = readRows(snapshot, "players");
    const villages = readRows(snapshot, "villages");
    const resources = readRows(snapshot, "resources");
    const buildings = readRows(snapshot, "buildings");
    const units = readRows(snapshot, "units");
    const buildingUpgrades = readRows(snapshot, "buildingUpgrades");
    const unitRecruitments = readRows(snapshot, "unitRecruitments");
    const armyMovements = readRows(snapshot, "armyMovements");
    const armyMovementUnits = readRows(snapshot, "armyMovementUnits");
    const battleReports = readRows(snapshot, "battleReports");
    const gameStateRows = readRows(snapshot, "gameState");

    const playerIdByLegacyId = new Map<number, Id<"players">>();
    const villageIdByLegacyId = new Map<number, Id<"villages">>();
    const movementIdByLegacyId = new Map<number, Id<"armyMovements">>();

    let playersInserted = 0;
    let villagesInserted = 0;
    let resourcesInserted = 0;
    let buildingsInserted = 0;
    let unitsInserted = 0;
    let buildingUpgradesInserted = 0;
    let unitRecruitmentsInserted = 0;
    let armyMovementsInserted = 0;
    let armyMovementUnitsInserted = 0;
    let battleReportsInserted = 0;

    for (const row of players) {
      const context = "players[]";
      const legacyId = readNumber(row, "id", context);
      const playerId = await ctx.db.insert("players", {
        legacyId,
        username: readString(row, "username", context),
        password: readString(row, "password", context),
        isBot: readBoolean(row, "is_bot", context),
        createdAt: readString(row, "created_at", context),
      });
      playerIdByLegacyId.set(legacyId, playerId);
      playersInserted += 1;
    }

    for (const row of villages) {
      const context = "villages[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const playerId = playerIdByLegacyId.get(playerLegacyId);
      if (!playerId) {
        throw new Error(`Village ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }

      const villageId = await ctx.db.insert("villages", {
        legacyId,
        playerId,
        playerLegacyId,
        name: readString(row, "name", context),
        kingdom: readString(row, "kingdom", context),
        coordX: readNumber(row, "coord_x", context),
        coordY: readNumber(row, "coord_y", context),
        region: readNumber(row, "region", context),
        prestige: readNumber(row, "prestige", context),
        loyalty: readNumber(row, "loyalty", context),
        createdAt: readString(row, "created_at", context),
      });
      villageIdByLegacyId.set(legacyId, villageId);
      villagesInserted += 1;
    }

    for (const row of resources) {
      const context = "resources[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = villageIdByLegacyId.get(villageLegacyId);
      if (!villageId) {
        throw new Error(`Resources odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      await ctx.db.insert("resources", {
        villageId,
        villageLegacyId,
        wood: readNumber(row, "wood", context),
        stone: readNumber(row, "stone", context),
        iron: readNumber(row, "iron", context),
      });
      resourcesInserted += 1;
    }

    for (const row of buildings) {
      const context = "buildings[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = villageIdByLegacyId.get(villageLegacyId);
      if (!villageId) {
        throw new Error(`Buildings odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      await ctx.db.insert("buildings", {
        villageId,
        villageLegacyId,
        buildingId: readString(row, "building_id", context),
        level: readNumber(row, "level", context),
      });
      buildingsInserted += 1;
    }

    for (const row of units) {
      const context = "units[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = villageIdByLegacyId.get(villageLegacyId);
      if (!villageId) {
        throw new Error(`Units odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      await ctx.db.insert("units", {
        villageId,
        villageLegacyId,
        unitId: readString(row, "unit_id", context),
        amount: readNumber(row, "amount", context),
      });
      unitsInserted += 1;
    }

    for (const row of buildingUpgrades) {
      const context = "buildingUpgrades[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = villageIdByLegacyId.get(villageLegacyId);
      if (!villageId) {
        throw new Error(`Building upgrade odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      await ctx.db.insert("buildingUpgrades", {
        legacyId: readNumber(row, "id", context),
        villageId,
        villageLegacyId,
        buildingId: readString(row, "building_id", context),
        fromLevel: readNumber(row, "from_level", context),
        toLevel: readNumber(row, "to_level", context),
        woodCost: readNumber(row, "wood_cost", context),
        stoneCost: readNumber(row, "stone_cost", context),
        ironCost: readNumber(row, "iron_cost", context),
        startedAt: readString(row, "started_at", context),
        finishAt: readString(row, "finish_at", context),
        status: readString(row, "status", context),
        completedAt: readOptionalString(row, "completed_at"),
      });
      buildingUpgradesInserted += 1;
    }

    for (const row of unitRecruitments) {
      const context = "unitRecruitments[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = villageIdByLegacyId.get(villageLegacyId);
      if (!villageId) {
        throw new Error(`Unit recruitment odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      await ctx.db.insert("unitRecruitments", {
        legacyId: readNumber(row, "id", context),
        villageId,
        villageLegacyId,
        unitId: readString(row, "unit_id", context),
        amount: readNumber(row, "amount", context),
        woodCost: readNumber(row, "wood_cost", context),
        stoneCost: readNumber(row, "stone_cost", context),
        ironCost: readNumber(row, "iron_cost", context),
        startedAt: readString(row, "started_at", context),
        finishAt: readString(row, "finish_at", context),
        status: readString(row, "status", context),
        completedAt: readOptionalString(row, "completed_at"),
      });
      unitRecruitmentsInserted += 1;
    }

    for (const row of armyMovements) {
      const context = "armyMovements[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const originVillageLegacyId = readNumber(row, "origin_village_id", context);
      const targetVillageLegacyId = readNumber(row, "target_village_id", context);
      const homeVillageLegacyId = readNumber(row, "home_village_id", context);
      const playerId = playerIdByLegacyId.get(playerLegacyId);
      const originVillageId = villageIdByLegacyId.get(originVillageLegacyId);
      const targetVillageId = villageIdByLegacyId.get(targetVillageLegacyId);
      const homeVillageId = villageIdByLegacyId.get(homeVillageLegacyId);

      if (!playerId) {
        throw new Error(`Army movement ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }
      if (!originVillageId || !targetVillageId || !homeVillageId) {
        throw new Error(`Army movement ${legacyId} ma neplatne village reference.`);
      }

      const movementId = await ctx.db.insert("armyMovements", {
        legacyId,
        playerId,
        playerLegacyId,
        commandType: readString(row, "command_type", context),
        originVillageId,
        targetVillageId,
        homeVillageId,
        originVillageLegacyId,
        targetVillageLegacyId,
        homeVillageLegacyId,
        lootPriority: readOptionalString(row, "loot_priority"),
        carryWood: readNumber(row, "carry_wood", context),
        carryStone: readNumber(row, "carry_stone", context),
        carryIron: readNumber(row, "carry_iron", context),
        startedAt: readString(row, "started_at", context),
        arriveAt: readString(row, "arrive_at", context),
        status: readString(row, "status", context),
        completedAt: readOptionalString(row, "completed_at"),
      });

      movementIdByLegacyId.set(legacyId, movementId);
      armyMovementsInserted += 1;
    }

    for (const row of armyMovementUnits) {
      const context = "armyMovementUnits[]";
      const movementLegacyId = readNumber(row, "movement_id", context);
      const movementId = movementIdByLegacyId.get(movementLegacyId);
      if (!movementId) {
        throw new Error(`Army movement unit odkazuje na neexistujici movement_id=${movementLegacyId}.`);
      }

      await ctx.db.insert("armyMovementUnits", {
        movementId,
        movementLegacyId,
        unitId: readString(row, "unit_id", context),
        amount: readNumber(row, "amount", context),
      });
      armyMovementUnitsInserted += 1;
    }

    for (const row of battleReports) {
      const context = "battleReports[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const playerId = playerIdByLegacyId.get(playerLegacyId);
      if (!playerId) {
        throw new Error(`Battle report ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }

      const originVillageLegacyId = readOptionalNumber(row, "origin_village_id");
      const targetVillageLegacyId = readOptionalNumber(row, "target_village_id");
      const originVillageId =
        originVillageLegacyId == null ? undefined : villageIdByLegacyId.get(originVillageLegacyId);
      const targetVillageId =
        targetVillageLegacyId == null ? undefined : villageIdByLegacyId.get(targetVillageLegacyId);

      await ctx.db.insert("battleReports", {
        legacyId,
        playerId,
        playerLegacyId,
        originVillageId,
        targetVillageId,
        originVillageLegacyId,
        targetVillageLegacyId,
        battleAt: readString(row, "battle_at", context),
        createdAt: readString(row, "created_at", context),
        title: readString(row, "title", context),
        summary: readString(row, "summary", context),
        payloadJson: readString(row, "payload_json", context),
      });
      battleReportsInserted += 1;
    }

    if (gameStateRows.length > 0) {
      const row = gameStateRows[0];
      const context = "gameState[]";
      const existing = await ctx.db
        .query("gameState")
        .withIndex("by_key", (query) => query.eq("key", "global"))
        .unique();
      const nextPayload = {
        key: "global",
        legacyId: readOptionalNumber(row, "id"),
        lastTickAt: readString(row, "last_tick_at", context),
        revision: readOptionalNumber(row, "revision") ?? Number(existing?.revision ?? 1),
      };

      if (existing) {
        await ctx.db.patch(existing._id, nextPayload);
      } else {
        await ctx.db.insert("gameState", nextPayload);
      }
    }

    return {
      ok: true,
      counts: {
        players: playersInserted,
        villages: villagesInserted,
        resources: resourcesInserted,
        buildings: buildingsInserted,
        units: unitsInserted,
        buildingUpgrades: buildingUpgradesInserted,
        unitRecruitments: unitRecruitmentsInserted,
        armyMovements: armyMovementsInserted,
        armyMovementUnits: armyMovementUnitsInserted,
        battleReports: battleReportsInserted,
        gameState: gameStateRows.length > 0 ? 1 : 0,
      },
    };
  },
});
