import { query } from "./_generated/server";

type SummaryTableName =
  | "players"
  | "villages"
  | "resources"
  | "buildings"
  | "units"
  | "buildingUpgrades"
  | "unitRecruitments"
  | "armyMovements"
  | "armyMovementUnits"
  | "battleReports";

type CountTableCtx = {
  db: {
    query: (tableName: SummaryTableName) => {
      collect: () => Promise<unknown[]>;
    };
  };
};

const countTable = async (ctx: CountTableCtx, tableName: SummaryTableName) => {
  const rows = await ctx.db.query(tableName).collect();
  return rows.length;
};

export const getDatabaseSummary = query({
  args: {},
  handler: async (ctx) => {
    const gameState = await ctx.db
      .query("gameState")
      .withIndex("by_key", (query) => query.eq("key", "global"))
      .unique();

    return {
      players: await countTable(ctx, "players"),
      villages: await countTable(ctx, "villages"),
      resources: await countTable(ctx, "resources"),
      buildings: await countTable(ctx, "buildings"),
      units: await countTable(ctx, "units"),
      buildingUpgrades: await countTable(ctx, "buildingUpgrades"),
      unitRecruitments: await countTable(ctx, "unitRecruitments"),
      armyMovements: await countTable(ctx, "armyMovements"),
      armyMovementUnits: await countTable(ctx, "armyMovementUnits"),
      battleReports: await countTable(ctx, "battleReports"),
      lastTickAt: gameState?.lastTickAt ?? null,
    };
  },
});
