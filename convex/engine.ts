import { mutation, query } from "./_generated/server";
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

const isRecord = (value: unknown): value is SnapshotRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const clearTable = async (
  ctx: { db: { query: (table: ConvexTableName) => { collect: () => Promise<Array<{ _id: Id<ConvexTableName> }>> }; delete: (id: Id<ConvexTableName>) => Promise<void> } },
  tableName: ConvexTableName,
) => {
  const docs = await ctx.db.query(tableName).collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
};

export const getSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const players = (await ctx.db.query("players").collect())
      .sort((a, b) => Number(a.legacyId) - Number(b.legacyId))
      .map((row) => ({
        id: Number(row.legacyId),
        username: row.username,
        password: row.password,
        is_bot: row.isBot ? 1 : 0,
        created_at: row.createdAt,
      }));

    const villages = (await ctx.db.query("villages").collect())
      .sort((a, b) => Number(a.legacyId) - Number(b.legacyId))
      .map((row) => ({
        id: Number(row.legacyId),
        player_id: Number(row.playerLegacyId),
        name: row.name,
        kingdom: row.kingdom,
        coord_x: Number(row.coordX),
        coord_y: Number(row.coordY),
        region: Number(row.region),
        prestige: Number(row.prestige),
        loyalty: Number(row.loyalty),
        created_at: row.createdAt,
      }));

    const resources = (await ctx.db.query("resources").collect())
      .sort((a, b) => Number(a.villageLegacyId) - Number(b.villageLegacyId))
      .map((row) => ({
        village_id: Number(row.villageLegacyId),
        wood: Number(row.wood),
        stone: Number(row.stone),
        iron: Number(row.iron),
      }));

    const buildings = (await ctx.db.query("buildings").collect())
      .sort((a, b) => {
        const villageCmp = Number(a.villageLegacyId) - Number(b.villageLegacyId);
        if (villageCmp !== 0) {
          return villageCmp;
        }
        return String(a.buildingId).localeCompare(String(b.buildingId), "cs");
      })
      .map((row) => ({
        village_id: Number(row.villageLegacyId),
        building_id: row.buildingId,
        level: Number(row.level),
      }));

    const units = (await ctx.db.query("units").collect())
      .sort((a, b) => {
        const villageCmp = Number(a.villageLegacyId) - Number(b.villageLegacyId);
        if (villageCmp !== 0) {
          return villageCmp;
        }
        return String(a.unitId).localeCompare(String(b.unitId), "cs");
      })
      .map((row) => ({
        village_id: Number(row.villageLegacyId),
        unit_id: row.unitId,
        amount: Number(row.amount),
      }));

    const buildingUpgrades = (await ctx.db.query("buildingUpgrades").collect())
      .sort((a, b) => Number(a.legacyId) - Number(b.legacyId))
      .map((row) => ({
        id: Number(row.legacyId),
        village_id: Number(row.villageLegacyId),
        building_id: row.buildingId,
        from_level: Number(row.fromLevel),
        to_level: Number(row.toLevel),
        wood_cost: Number(row.woodCost),
        stone_cost: Number(row.stoneCost),
        iron_cost: Number(row.ironCost),
        started_at: row.startedAt,
        finish_at: row.finishAt,
        status: row.status,
        completed_at: row.completedAt ?? null,
      }));

    const unitRecruitments = (await ctx.db.query("unitRecruitments").collect())
      .sort((a, b) => Number(a.legacyId) - Number(b.legacyId))
      .map((row) => ({
        id: Number(row.legacyId),
        village_id: Number(row.villageLegacyId),
        unit_id: row.unitId,
        amount: Number(row.amount),
        wood_cost: Number(row.woodCost),
        stone_cost: Number(row.stoneCost),
        iron_cost: Number(row.ironCost),
        started_at: row.startedAt,
        finish_at: row.finishAt,
        status: row.status,
        completed_at: row.completedAt ?? null,
      }));

    const armyMovements = (await ctx.db.query("armyMovements").collect())
      .sort((a, b) => Number(a.legacyId) - Number(b.legacyId))
      .map((row) => ({
        id: Number(row.legacyId),
        player_id: Number(row.playerLegacyId),
        command_type: row.commandType,
        origin_village_id: Number(row.originVillageLegacyId),
        target_village_id: Number(row.targetVillageLegacyId),
        home_village_id: Number(row.homeVillageLegacyId),
        loot_priority: row.lootPriority ?? null,
        carry_wood: Number(row.carryWood),
        carry_stone: Number(row.carryStone),
        carry_iron: Number(row.carryIron),
        started_at: row.startedAt,
        arrive_at: row.arriveAt,
        status: row.status,
        completed_at: row.completedAt ?? null,
      }));

    const armyMovementUnits = (await ctx.db.query("armyMovementUnits").collect())
      .sort((a, b) => {
        const movementCmp = Number(a.movementLegacyId) - Number(b.movementLegacyId);
        if (movementCmp !== 0) {
          return movementCmp;
        }
        return String(a.unitId).localeCompare(String(b.unitId), "cs");
      })
      .map((row) => ({
        movement_id: Number(row.movementLegacyId),
        unit_id: row.unitId,
        amount: Number(row.amount),
      }));

    const battleReports = (await ctx.db.query("battleReports").collect())
      .sort((a, b) => {
        const createdCmp = String(a.createdAt).localeCompare(String(b.createdAt), "cs");
        if (createdCmp !== 0) {
          return createdCmp;
        }
        return Number(a.legacyId) - Number(b.legacyId);
      })
      .map((row) => ({
        id: Number(row.legacyId),
        player_id: Number(row.playerLegacyId),
        origin_village_id: row.originVillageLegacyId ?? null,
        target_village_id: row.targetVillageLegacyId ?? null,
        battle_at: row.battleAt,
        created_at: row.createdAt,
        title: row.title,
        summary: row.summary,
        payload_json: row.payloadJson,
      }));

    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_key", (index) => index.eq("key", "global"))
      .unique();

    const revision = Number(gameState?.revision ?? 0);
    const gameStateRows = [
      {
        id: Number(gameState?.legacyId ?? 1),
        last_tick_at: String(gameState?.lastTickAt ?? new Date().toISOString()),
        revision,
      },
    ];

    return {
      revision,
      snapshot: {
        players,
        villages,
        resources,
        buildings,
        units,
        buildingUpgrades,
        unitRecruitments,
        armyMovements,
        armyMovementUnits,
        battleReports,
        gameState: gameStateRows,
      },
    };
  },
});

export const replaceSnapshotIfRevision = mutation({
  args: {
    snapshot: v.any(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isRecord(args.snapshot)) {
      throw new Error("Snapshot musi byt objekt.");
    }

    const stateRow = await ctx.db
      .query("gameState")
      .withIndex("by_key", (index) => index.eq("key", "global"))
      .unique();
    const currentRevision = Number(stateRow?.revision ?? 0);
    if (currentRevision !== Number(args.expectedRevision)) {
      throw new Error("SNAPSHOT_CONFLICT");
    }

    const snapshot = args.snapshot;
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

    for (const tableName of TABLES) {
      await clearTable(ctx, tableName);
    }

    const playerIdByLegacyId = new Map<number, Id<"players">>();
    const villageIdByLegacyId = new Map<number, Id<"villages">>();
    const movementIdByLegacyId = new Map<number, Id<"armyMovements">>();

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
    }

    const sourceGameState = gameStateRows[0];
    const lastTickAt =
      sourceGameState && typeof sourceGameState.last_tick_at === "string"
        ? sourceGameState.last_tick_at
        : new Date().toISOString();
    await ctx.db.insert("gameState", {
      key: "global",
      legacyId: 1,
      lastTickAt,
      revision: currentRevision + 1,
    });

    return {
      ok: true,
      revision: currentRevision + 1,
    };
  },
});

export const applySnapshotPatchIfRevision = mutation({
  args: {
    patch: v.any(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isRecord(args.patch)) {
      throw new Error("Patch musi byt objekt.");
    }

    const stateRow = await ctx.db
      .query("gameState")
      .withIndex("by_key", (index) => index.eq("key", "global"))
      .unique();
    const currentRevision = Number(stateRow?.revision ?? 0);
    if (currentRevision !== Number(args.expectedRevision)) {
      throw new Error("SNAPSHOT_CONFLICT");
    }

    const patch = args.patch;
    const players = readRows(patch, "players");
    const villages = readRows(patch, "villages");
    const resources = readRows(patch, "resources");
    const buildings = readRows(patch, "buildings");
    const units = readRows(patch, "units");
    const buildingUpgrades = readRows(patch, "buildingUpgrades");
    const unitRecruitments = readRows(patch, "unitRecruitments");
    const armyMovements = readRows(patch, "armyMovements");
    const armyMovementUnits = readRows(patch, "armyMovementUnits");
    const battleReports = readRows(patch, "battleReports");
    const gameStateRows = readRows(patch, "gameState");

    const hasAnyChanges =
      players.length > 0 ||
      villages.length > 0 ||
      resources.length > 0 ||
      buildings.length > 0 ||
      units.length > 0 ||
      buildingUpgrades.length > 0 ||
      unitRecruitments.length > 0 ||
      armyMovements.length > 0 ||
      armyMovementUnits.length > 0 ||
      battleReports.length > 0 ||
      gameStateRows.length > 0;

    if (!hasAnyChanges) {
      return {
        ok: true,
        revision: currentRevision,
        applied: false,
      };
    }

    const playerIdByLegacyId = new Map<number, Id<"players">>();
    const villageIdByLegacyId = new Map<number, Id<"villages">>();
    const movementIdByLegacyId = new Map<number, Id<"armyMovements">>();

    const resolvePlayerId = async (legacyId: number) => {
      const cached = playerIdByLegacyId.get(legacyId);
      if (cached) {
        return cached;
      }

      const doc = await ctx.db
        .query("players")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (!doc) {
        return null;
      }
      playerIdByLegacyId.set(legacyId, doc._id);
      return doc._id;
    };

    const resolveVillageId = async (legacyId: number) => {
      const cached = villageIdByLegacyId.get(legacyId);
      if (cached) {
        return cached;
      }

      const doc = await ctx.db
        .query("villages")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (!doc) {
        return null;
      }
      villageIdByLegacyId.set(legacyId, doc._id);
      return doc._id;
    };

    const resolveMovementId = async (legacyId: number) => {
      const cached = movementIdByLegacyId.get(legacyId);
      if (cached) {
        return cached;
      }

      const doc = await ctx.db
        .query("armyMovements")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (!doc) {
        return null;
      }
      movementIdByLegacyId.set(legacyId, doc._id);
      return doc._id;
    };

    for (const row of players) {
      const context = "players[]";
      const legacyId = readNumber(row, "id", context);
      const payload = {
        legacyId,
        username: readString(row, "username", context),
        password: readString(row, "password", context),
        isBot: readBoolean(row, "is_bot", context),
        createdAt: readString(row, "created_at", context),
      };
      const existing = await ctx.db
        .query("players")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        playerIdByLegacyId.set(legacyId, existing._id);
      } else {
        const playerId = await ctx.db.insert("players", payload);
        playerIdByLegacyId.set(legacyId, playerId);
      }
    }

    for (const row of villages) {
      const context = "villages[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const playerId = await resolvePlayerId(playerLegacyId);
      if (!playerId) {
        throw new Error(`Village ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }

      const payload = {
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
      };

      const existing = await ctx.db
        .query("villages")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        villageIdByLegacyId.set(legacyId, existing._id);
      } else {
        const villageId = await ctx.db.insert("villages", payload);
        villageIdByLegacyId.set(legacyId, villageId);
      }
    }

    for (const row of resources) {
      const context = "resources[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = await resolveVillageId(villageLegacyId);
      if (!villageId) {
        throw new Error(`Resources odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      const payload = {
        villageId,
        villageLegacyId,
        wood: readNumber(row, "wood", context),
        stone: readNumber(row, "stone", context),
        iron: readNumber(row, "iron", context),
      };

      const existing = await ctx.db
        .query("resources")
        .withIndex("by_village_legacy_id", (index) => index.eq("villageLegacyId", villageLegacyId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("resources", payload);
      }
    }

    for (const row of buildings) {
      const context = "buildings[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = await resolveVillageId(villageLegacyId);
      if (!villageId) {
        throw new Error(`Buildings odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      const buildingId = readString(row, "building_id", context);
      const payload = {
        villageId,
        villageLegacyId,
        buildingId,
        level: readNumber(row, "level", context),
      };

      const existingRows = await ctx.db
        .query("buildings")
        .withIndex("by_village_legacy_id", (index) => index.eq("villageLegacyId", villageLegacyId))
        .collect();
      const existing = existingRows.find((entry) => entry.buildingId === buildingId);

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("buildings", payload);
      }
    }

    for (const row of units) {
      const context = "units[]";
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = await resolveVillageId(villageLegacyId);
      if (!villageId) {
        throw new Error(`Units odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      const unitId = readString(row, "unit_id", context);
      const payload = {
        villageId,
        villageLegacyId,
        unitId,
        amount: readNumber(row, "amount", context),
      };

      const existingRows = await ctx.db
        .query("units")
        .withIndex("by_village_legacy_id", (index) => index.eq("villageLegacyId", villageLegacyId))
        .collect();
      const existing = existingRows.find((entry) => entry.unitId === unitId);

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("units", payload);
      }
    }

    for (const row of buildingUpgrades) {
      const context = "buildingUpgrades[]";
      const legacyId = readNumber(row, "id", context);
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = await resolveVillageId(villageLegacyId);
      if (!villageId) {
        throw new Error(`Building upgrade odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      const payload = {
        legacyId,
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
      };

      const existing = await ctx.db
        .query("buildingUpgrades")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("buildingUpgrades", payload);
      }
    }

    for (const row of unitRecruitments) {
      const context = "unitRecruitments[]";
      const legacyId = readNumber(row, "id", context);
      const villageLegacyId = readNumber(row, "village_id", context);
      const villageId = await resolveVillageId(villageLegacyId);
      if (!villageId) {
        throw new Error(`Unit recruitment odkazuje na neexistujici village_id=${villageLegacyId}.`);
      }

      const payload = {
        legacyId,
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
      };

      const existing = await ctx.db
        .query("unitRecruitments")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("unitRecruitments", payload);
      }
    }

    for (const row of armyMovements) {
      const context = "armyMovements[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const originVillageLegacyId = readNumber(row, "origin_village_id", context);
      const targetVillageLegacyId = readNumber(row, "target_village_id", context);
      const homeVillageLegacyId = readNumber(row, "home_village_id", context);

      const playerId = await resolvePlayerId(playerLegacyId);
      const originVillageId = await resolveVillageId(originVillageLegacyId);
      const targetVillageId = await resolveVillageId(targetVillageLegacyId);
      const homeVillageId = await resolveVillageId(homeVillageLegacyId);

      if (!playerId) {
        throw new Error(`Army movement ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }
      if (!originVillageId || !targetVillageId || !homeVillageId) {
        throw new Error(`Army movement ${legacyId} ma neplatne village reference.`);
      }

      const payload = {
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
      };

      const existing = await ctx.db
        .query("armyMovements")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        movementIdByLegacyId.set(legacyId, existing._id);
      } else {
        const movementId = await ctx.db.insert("armyMovements", payload);
        movementIdByLegacyId.set(legacyId, movementId);
      }
    }

    for (const row of armyMovementUnits) {
      const context = "armyMovementUnits[]";
      const movementLegacyId = readNumber(row, "movement_id", context);
      const movementId = await resolveMovementId(movementLegacyId);
      if (!movementId) {
        throw new Error(`Army movement unit odkazuje na neexistujici movement_id=${movementLegacyId}.`);
      }

      const unitId = readString(row, "unit_id", context);
      const payload = {
        movementId,
        movementLegacyId,
        unitId,
        amount: readNumber(row, "amount", context),
      };

      const existingRows = await ctx.db
        .query("armyMovementUnits")
        .withIndex("by_movement_legacy_id", (index) => index.eq("movementLegacyId", movementLegacyId))
        .collect();
      const existing = existingRows.find((entry) => entry.unitId === unitId);

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("armyMovementUnits", payload);
      }
    }

    for (const row of battleReports) {
      const context = "battleReports[]";
      const legacyId = readNumber(row, "id", context);
      const playerLegacyId = readNumber(row, "player_id", context);
      const playerId = await resolvePlayerId(playerLegacyId);
      if (!playerId) {
        throw new Error(`Battle report ${legacyId} odkazuje na neexistujiciho hrace ${playerLegacyId}.`);
      }

      const originVillageLegacyId = readOptionalNumber(row, "origin_village_id");
      const targetVillageLegacyId = readOptionalNumber(row, "target_village_id");
      const originVillageId =
        originVillageLegacyId == null ? undefined : await resolveVillageId(originVillageLegacyId);
      const targetVillageId =
        targetVillageLegacyId == null ? undefined : await resolveVillageId(targetVillageLegacyId);

      const payload = {
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
      };

      const existing = await ctx.db
        .query("battleReports")
        .withIndex("by_legacy_id", (index) => index.eq("legacyId", legacyId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("battleReports", payload);
      }
    }

    const sourceGameState = gameStateRows[0];
    const nextLegacyId =
      sourceGameState == null
        ? Number(stateRow?.legacyId ?? 1)
        : readOptionalNumber(sourceGameState, "id") ?? Number(stateRow?.legacyId ?? 1);
    const nextLastTickAt =
      sourceGameState && typeof sourceGameState.last_tick_at === "string"
        ? sourceGameState.last_tick_at
        : String(stateRow?.lastTickAt ?? new Date().toISOString());

    if (stateRow) {
      await ctx.db.patch(stateRow._id, {
        key: "global",
        legacyId: nextLegacyId,
        lastTickAt: nextLastTickAt,
        revision: currentRevision + 1,
      });
    } else {
      await ctx.db.insert("gameState", {
        key: "global",
        legacyId: nextLegacyId,
        lastTickAt: nextLastTickAt,
        revision: currentRevision + 1,
      });
    }

    return {
      ok: true,
      revision: currentRevision + 1,
      applied: true,
    };
  },
});
