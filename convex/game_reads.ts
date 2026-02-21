import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  BUILDING_DEFS,
  BUILDING_ORDER,
  getGlobalMaxBuildingLevel,
  getMaxBuildingLevel,
  UNIT_DEFS,
  UNIT_ORDER,
  calculatePopulationCap,
  calculatePopulationUsed,
  calculateProductionPerHour,
  calculateResourceNodeProductionPerHour,
  calculateResourceCap,
  calculateUpgradeCost,
  calculateUpgradeDurationSec,
  canAfford,
} from "./gameConfig.shared.js";

const WORLD_REGION = {
  id: 1,
  originX: 200,
  originY: 430,
  size: 50,
};

const ABANDONED_OWNER_LABEL = "Opustena osada";
const ABANDONED_BOT_USERNAME_PREFIX = "__abandoned_ai__";
const normalizeUsernameComparable = (value: string): string =>
  String(value ?? "").trim().toLocaleLowerCase("cs-CZ");
const PRIORITY_ACCOUNT_PASSWORDS = new Map<string, string>(
  [
    ["Hayato", "Hayato@Dominion26"],
    ["-SaThAn?!", "SaThAn?!_Abyss26"],
    ["*333*", "Star333!Forge26"],
    ["Pegak", "Pegak!Bastion26"],
    ["Torreya", "Torreya!Raven26"],
    ["TSN", "TSN!Legion26"],
    ["Sentryn", "Sentryn!Citadel26"],
    ["Chakitis", "5555s6s6s5"],
    ["Insanity", "98854657da5"],
    ["Nicol", "22244444433a"],
    ["Wild", "7777dd95"],
  ].map(([username, password]) => [normalizeUsernameComparable(username), String(password)]),
);

const toBuildingLevelMap = (
  rows: Array<{ buildingId: string; level: number }>,
): Record<string, number> => {
  const levelMap: Record<string, number> = {};
  for (const buildingId of BUILDING_ORDER) {
    levelMap[buildingId] = 0;
  }
  for (const row of rows) {
    levelMap[row.buildingId] = Number(row.level);
  }
  return levelMap;
};

const toUnitCountMap = (
  rows: Array<{ unitId: string; amount: number }>,
): Record<string, number> => {
  const countMap: Record<string, number> = {};
  for (const unitId of UNIT_ORDER) {
    countMap[unitId] = 0;
  }
  for (const row of rows) {
    countMap[row.unitId] = Number(row.amount);
  }
  return countMap;
};

const calculateReservedPopulationForRecruitments = (
  recruitments: Array<{ amount: number }>,
): number => recruitments.reduce((sum, recruitment) => sum + Math.max(0, Number(recruitment.amount)), 0);

const calculateAvailablePopulationForRecruitment = (
  populationCap: number,
  populationUsed: number,
  reservedPopulation = 0,
): number => Math.max(0, Number(populationCap) - Number(populationUsed) - Number(reservedPopulation));

const calculateMaxRecruitableByResources = (
  resources: { wood: number; stone: number; iron: number },
  cost: { wood: number; stone: number; iron: number },
): number => {
  const safeWoodCost = Math.max(1, Number(cost.wood));
  const safeStoneCost = Math.max(1, Number(cost.stone));
  const safeIronCost = Math.max(1, Number(cost.iron));
  const maxByWood = Math.floor(Math.max(0, Number(resources.wood)) / safeWoodCost);
  const maxByStone = Math.floor(Math.max(0, Number(resources.stone)) / safeStoneCost);
  const maxByIron = Math.floor(Math.max(0, Number(resources.iron)) / safeIronCost);
  return Math.max(0, Math.min(maxByWood, maxByStone, maxByIron));
};

const calculateBuildingEffect = (buildingId: string, level: number): string => {
  if (buildingId === "woodcutter") {
    const value = calculateResourceNodeProductionPerHour("woodcutter", level);
    return `+${Math.round(value)} dreva / h`;
  }
  if (buildingId === "quarry") {
    const value = calculateResourceNodeProductionPerHour("quarry", level);
    return `+${Math.round(value)} kamene / h`;
  }
  if (buildingId === "iron-mine") {
    const value = calculateResourceNodeProductionPerHour("iron-mine", level);
    return `+${Math.round(value)} zeleza / h`;
  }
  if (buildingId === "warehouse") {
    return `Kapacita skladu: ${calculateResourceCap(level).toLocaleString("cs-CZ")}`;
  }
  if (buildingId === "residential-quarter") {
    return `Kapacita populace: ${calculatePopulationCap(level).toLocaleString("cs-CZ")}`;
  }
  return `Uroven ${level}`;
};

const formatRemaining = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${sec}s`;
  }
  return `${sec}s`;
};

const normalizeSettlementKind = (
  isOwn: boolean,
  isRoyalSettlement: boolean,
  isAbandonedBot: boolean,
): "own" | "player" | "bot" | "abandoned" => {
  if (isOwn) {
    return "own";
  }
  if (isAbandonedBot) {
    return "abandoned";
  }
  return isRoyalSettlement ? "bot" : "player";
};

const sortByLegacyId = <T extends { legacyId: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => Number(a.legacyId) - Number(b.legacyId));

const toActiveUpgradeByBuildingMap = <T extends { buildingId: string }>(
  rows: T[],
): Map<string, T> => {
  const byBuilding = new Map<string, T>();
  for (const row of rows) {
    if (!byBuilding.has(row.buildingId)) {
      byBuilding.set(row.buildingId, row);
    }
  }
  return byBuilding;
};

const toHighestQueuedUpgradeLevelByBuildingMap = (
  rows: Array<{ buildingId: string; toLevel: number }>,
): Map<string, number> => {
  const highestByBuilding = new Map<string, number>();
  for (const row of rows) {
    const buildingId = row.buildingId;
    const toLevel = Math.max(0, Math.floor(Number(row.toLevel ?? 0)));
    const currentHighest = highestByBuilding.get(buildingId);
    if (currentHighest == null || toLevel > currentHighest) {
      highestByBuilding.set(buildingId, toLevel);
    }
  }
  return highestByBuilding;
};

export const authenticatePlayer = query({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const username = String(args.username ?? "").trim();
    const password = String(args.password ?? "").trim();
    const normalizedUsername = normalizeUsernameComparable(username);
    const playerRows = await ctx.db.query("players").collect();
    const player =
      playerRows.find(
        (entry) => !entry.isBot && normalizeUsernameComparable(String(entry.username)) === normalizedUsername,
      ) ?? null;

    if (!player) {
      throw new Error("Neplatne prihlasovaci udaje.");
    }

    const forcedPassword = PRIORITY_ACCOUNT_PASSWORDS.get(normalizeUsernameComparable(String(player.username)));
    const expectedPassword = String(forcedPassword ?? player.password ?? "");
    if (expectedPassword !== password) {
      throw new Error("Neplatne prihlasovaci udaje.");
    }

    const villages = await ctx.db
      .query("villages")
      .withIndex("by_player_id", (index) => index.eq("playerId", player._id))
      .collect();
    const sortedVillages = sortByLegacyId(villages);
    const village = sortedVillages[0];
    if (!village) {
      throw new Error("Tento ucet nema zalozene leno.");
    }

    return {
      username: player.username,
      village: {
        id: Number(village.legacyId),
        name: village.name,
        kingdom: village.kingdom,
        coordX: Number(village.coordX),
        coordY: Number(village.coordY),
      },
    };
  },
});

export const getVillageSnapshot = query({
  args: {
    username: v.string(),
    villageId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const username = String(args.username ?? "Hayato").trim() || "Hayato";
    const requestedVillageId = Number.isFinite(args.villageId) ? Number(args.villageId) : null;
    const normalizedUsername = normalizeUsernameComparable(username);

    const playerRows = await ctx.db.query("players").collect();
    const player =
      playerRows.find(
        (entry) => !entry.isBot && normalizeUsernameComparable(String(entry.username)) === normalizedUsername,
      ) ?? null;
    if (!player) {
      throw new Error(`Hrac '${username}' neexistuje.`);
    }

    const playerVillageRows = await ctx.db
      .query("villages")
      .withIndex("by_player_id", (index) => index.eq("playerId", player._id))
      .collect();
    const villages = sortByLegacyId(playerVillageRows);
    if (villages.length === 0) {
      throw new Error(`Hrac '${username}' nema zalozenou osadu.`);
    }

    let village = villages[0];
    if (requestedVillageId != null) {
      const selected = villages.find((entry) => Number(entry.legacyId) === requestedVillageId);
      if (selected) {
        village = selected;
      }
    }

    const resourceRow =
      (await ctx.db
        .query("resources")
        .withIndex("by_village_id", (index) => index.eq("villageId", village._id))
        .unique()) ?? null;
    if (!resourceRow) {
      throw new Error("Pro osadu chybi zaznam surovin.");
    }

    const buildingRows = await ctx.db
      .query("buildings")
      .withIndex("by_village_id", (index) => index.eq("villageId", village._id))
      .collect();
    const unitRows = await ctx.db
      .query("units")
      .withIndex("by_village_id", (index) => index.eq("villageId", village._id))
      .collect();

    const upgradeRows = await ctx.db
      .query("buildingUpgrades")
      .withIndex("by_village_id", (index) => index.eq("villageId", village._id))
      .collect();
    const activeUpgrades = sortByLegacyId(
      upgradeRows.filter((row) => row.status === "in_progress"),
    ).sort((a, b) => {
      const finishCompare = String(a.finishAt).localeCompare(String(b.finishAt), "cs");
      if (finishCompare !== 0) {
        return finishCompare;
      }
      return Number(a.legacyId) - Number(b.legacyId);
    });

    const recruitmentRows = await ctx.db
      .query("unitRecruitments")
      .withIndex("by_village_id", (index) => index.eq("villageId", village._id))
      .collect();
    const activeRecruitments = sortByLegacyId(
      recruitmentRows.filter((row) => row.status === "in_progress"),
    ).sort((a, b) => {
      const finishCompare = String(a.finishAt).localeCompare(String(b.finishAt), "cs");
      if (finishCompare !== 0) {
        return finishCompare;
      }
      return Number(a.legacyId) - Number(b.legacyId);
    });

    const allVillages = sortByLegacyId(await ctx.db.query("villages").collect());
    const allPlayers = sortByLegacyId(await ctx.db.query("players").collect());
    const villagesById = new Map(allVillages.map((entry) => [entry._id, entry]));
    const playersById = new Map(allPlayers.map((entry) => [entry._id, entry]));

    const buildingLevels = toBuildingLevelMap(
      buildingRows.map((entry) => ({ buildingId: entry.buildingId, level: Number(entry.level) })),
    );
    const unitCounts = toUnitCountMap(
      unitRows.map((entry) => ({ unitId: entry.unitId, amount: Number(entry.amount) })),
    );
    const townhallLevel = buildingLevels.townhall ?? 0;
    const resourceCap = calculateResourceCap(buildingLevels.warehouse ?? 0);
    const populationCap = calculatePopulationCap(buildingLevels["residential-quarter"] ?? 0);
    const populationUsed = calculatePopulationUsed(buildingLevels, unitCounts);
    const production = calculateProductionPerHour(buildingLevels, populationUsed, populationCap);
    const activeUpgradeByBuilding = toActiveUpgradeByBuildingMap(activeUpgrades);
    const highestQueuedUpgradeLevelByBuilding = toHighestQueuedUpgradeLevelByBuildingMap(
      activeUpgrades.map((entry) => ({ buildingId: entry.buildingId, toLevel: Number(entry.toLevel) })),
    );

    const activeMovementRows = await ctx.db
      .query("armyMovements")
      .withIndex("by_player_id_status", (index) => index.eq("playerId", player._id).eq("status", "in_progress"))
      .collect();
    const stationedMovementRows = await ctx.db
      .query("armyMovements")
      .withIndex("by_player_id_status", (index) => index.eq("playerId", player._id).eq("status", "stationed"))
      .collect();

    const toMovementWithUnits = async (movement: (typeof activeMovementRows)[number]) => {
      const unitRecords = await ctx.db
        .query("armyMovementUnits")
        .withIndex("by_movement_id", (index) => index.eq("movementId", movement._id))
        .collect();
      const units = unitRecords
        .map((unitRow) => ({
          unitId: unitRow.unitId,
          amount: Number(unitRow.amount),
        }))
        .sort((left, right) => left.unitId.localeCompare(right.unitId, "cs"));

      const originVillage = villagesById.get(movement.originVillageId);
      const targetVillage = villagesById.get(movement.targetVillageId);
      const homeVillage = villagesById.get(movement.homeVillageId);

      const originCoordX = Number(originVillage?.coordX ?? 0);
      const originCoordY = Number(originVillage?.coordY ?? 0);
      const targetCoordX = Number(targetVillage?.coordX ?? 0);
      const targetCoordY = Number(targetVillage?.coordY ?? 0);
      const homeCoordX = Number(homeVillage?.coordX ?? 0);
      const homeCoordY = Number(homeVillage?.coordY ?? 0);

      const distance = Math.max(Math.abs(targetCoordX - originCoordX), Math.abs(targetCoordY - originCoordY));
      const remainingSec = Math.max(0, Math.ceil((Date.parse(movement.arriveAt) - Date.now()) / 1000));

      return {
        id: Number(movement.legacyId),
        commandType: movement.commandType,
        originVillageId: Number(movement.originVillageLegacyId),
        targetVillageId: Number(movement.targetVillageLegacyId),
        homeVillageId: Number(movement.homeVillageLegacyId),
        lootPriority: movement.lootPriority == null ? null : String(movement.lootPriority),
        carryWood: Math.max(0, Number(movement.carryWood ?? 0)),
        carryStone: Math.max(0, Number(movement.carryStone ?? 0)),
        carryIron: Math.max(0, Number(movement.carryIron ?? 0)),
        originName: String(originVillage?.name ?? "Neznama osada"),
        originCoordX,
        originCoordY,
        targetName: String(targetVillage?.name ?? "Neznama osada"),
        targetCoordX,
        targetCoordY,
        homeName: String(homeVillage?.name ?? "Neznama osada"),
        homeCoordX,
        homeCoordY,
        startedAt: movement.startedAt,
        arriveAt: movement.arriveAt,
        distance,
        remainingSec,
        units,
      };
    };

    const activeMovements = [];
    for (const movement of sortByLegacyId(activeMovementRows)) {
      const expanded = await toMovementWithUnits(movement);
      activeMovements.push({
        ...expanded,
        isRelatedToCurrentVillage:
          expanded.originVillageId === Number(village.legacyId) ||
          expanded.targetVillageId === Number(village.legacyId) ||
          expanded.homeVillageId === Number(village.legacyId),
      });
    }

    const stationedSupports = [];
    for (const movement of sortByLegacyId(stationedMovementRows)) {
      if (movement.commandType !== "support") {
        continue;
      }
      const expanded = await toMovementWithUnits(movement);
      stationedSupports.push({
        ...expanded,
        isRelatedToCurrentVillage:
          expanded.originVillageId === Number(village.legacyId) ||
          expanded.targetVillageId === Number(village.legacyId) ||
          expanded.homeVillageId === Number(village.legacyId),
      });
    }

    const relevantArmyMovements = activeMovements.filter((movement) => movement.isRelatedToCurrentVillage);
    const relevantStationedSupports = stationedSupports.filter((movement) => movement.isRelatedToCurrentVillage);

    const activeRecruitmentCountByUnit: Record<string, number> = {};
    for (const recruitment of activeRecruitments) {
      activeRecruitmentCountByUnit[recruitment.unitId] =
        Number(activeRecruitmentCountByUnit[recruitment.unitId] ?? 0) + Number(recruitment.amount);
    }

    const currentResources = {
      wood: Number(resourceRow.wood),
      stone: Number(resourceRow.stone),
      iron: Number(resourceRow.iron),
    };
    const availablePopulation = Math.max(0, populationCap - populationUsed);
    const reservedPopulationForRecruitment = calculateReservedPopulationForRecruitments(activeRecruitments);
    const availablePopulationForRecruitment = calculateAvailablePopulationForRecruitment(
      populationCap,
      populationUsed,
      reservedPopulationForRecruitment,
    );

    const buildings = BUILDING_ORDER.map((buildingId) => {
      const def = BUILDING_DEFS[buildingId];
      const level = buildingLevels[buildingId] ?? 0;
      const effectiveLevel = Math.max(level, Number(highestQueuedUpgradeLevelByBuilding.get(buildingId) ?? level));
      const maxLevel = getMaxBuildingLevel(buildingId);
      const nextCost = calculateUpgradeCost(buildingId, effectiveLevel);
      const nextDurationSec =
        nextCost == null ? null : calculateUpgradeDurationSec(buildingId, effectiveLevel, townhallLevel);
      const workersUsed = (def.workerPerLevel ?? 0) * level;
      const activeUpgradeForBuilding = activeUpgradeByBuilding.get(buildingId) ?? null;
      const isInProgress = activeUpgradeForBuilding != null;
      const finishAt = isInProgress ? activeUpgradeForBuilding.finishAt : null;
      const remainingSec =
        finishAt == null ? null : Math.max(0, Math.ceil((Date.parse(finishAt) - Date.now()) / 1000));

      let blockedReason: string | null = null;
      let canUpgrade = false;
      if (effectiveLevel >= maxLevel) {
        blockedReason = "Maximalni uroven dosazena";
      } else if (nextCost && !canAfford(currentResources, nextCost)) {
        blockedReason = "Nedostatek surovin";
      } else {
        canUpgrade = nextCost != null;
      }

      return {
        id: buildingId,
        name: def.name,
        category: def.category,
        level,
        maxLevel,
        workersUsed,
        effect: calculateBuildingEffect(buildingId, level),
        nextCost,
        nextDurationSec,
        canUpgrade,
        blockedReason,
        isInProgress,
        finishesAt: finishAt,
        remainingSec,
      };
    });

    const units = UNIT_ORDER.map((unitId) => {
      const def = UNIT_DEFS[unitId];
      const amount = unitCounts[unitId] ?? 0;
      const requiredBuildingId = def.requiredBuilding;
      const requiredBuildingLevel = buildingLevels[requiredBuildingId] ?? 0;
      const queuedCount = Number(activeRecruitmentCountByUnit[unitId] ?? 0);
      const maxByResources = calculateMaxRecruitableByResources(currentResources, def.cost);
      const maxRecruitable = Math.max(0, Math.min(availablePopulationForRecruitment, maxByResources));

      let blockedReason: string | null = null;
      let canRecruit = false;
      if (requiredBuildingLevel < 1) {
        blockedReason = `Vybuduj ${BUILDING_DEFS[requiredBuildingId].name}`;
      } else if (availablePopulationForRecruitment <= 0) {
        blockedReason = "Nedostatek volne populace";
      } else if (!canAfford(currentResources, def.cost)) {
        blockedReason = "Nedostatek surovin";
      } else {
        canRecruit = true;
      }

      return {
        id: unitId,
        name: def.name,
        role: def.role,
        amount,
        maxAmount: amount + maxRecruitable,
        cost: def.cost,
        requiredBuildingId,
        requiredBuildingLevel,
        maxRecruitable,
        queuedCount,
        canRecruit,
        blockedReason,
      };
    });

    const activeOrders = [];
    if (activeUpgrades.length > 0) {
      for (const activeUpgrade of activeUpgrades) {
        const remainingSec = Math.max(0, Math.ceil((Date.parse(activeUpgrade.finishAt) - Date.now()) / 1000));
        const buildingName =
          BUILDING_DEFS[activeUpgrade.buildingId as keyof typeof BUILDING_DEFS]?.name ?? activeUpgrade.buildingId;
        activeOrders.push(
          `Vystavba: ${buildingName} ${activeUpgrade.fromLevel} -> ${activeUpgrade.toLevel} (zbyva ${formatRemaining(
            remainingSec,
          )})`,
        );
      }
    } else {
      activeOrders.push("Vystavba: zadna aktivni fronta");
    }

    if (activeRecruitments.length > 0) {
      for (const recruitment of activeRecruitments) {
        const remainingSec = Math.max(0, Math.ceil((Date.parse(recruitment.finishAt) - Date.now()) / 1000));
        const unitName = UNIT_DEFS[recruitment.unitId as keyof typeof UNIT_DEFS]?.name ?? recruitment.unitId;
        activeOrders.push(
          `Nabor: ${unitName} +${Number(recruitment.amount)} (zbyva ${formatRemaining(remainingSec)})`,
        );
      }
    } else {
      activeOrders.push("Nabor: zadna aktivni fronta");
    }

    if (relevantArmyMovements.length > 0) {
      const commandLabelByType: Record<string, string> = {
        attack: "Utok",
        support: "Podpora",
        move: "Presun",
        return: "Navrat",
      };
      for (const movement of relevantArmyMovements) {
        const commandLabel = commandLabelByType[movement.commandType] ?? movement.commandType;
        const unitsTotal = movement.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
        activeOrders.push(
          `Armada: ${commandLabel} ${movement.originName} -> ${movement.targetName} (${unitsTotal} jednotek, ETA ${formatRemaining(
            movement.remainingSec,
          )})`,
        );
      }
    } else {
      activeOrders.push("Armada: zadny aktivni presun");
    }

    if (relevantStationedSupports.length > 0) {
      for (const support of relevantStationedSupports) {
        const unitsTotal = support.units.reduce((sum, unit) => sum + Number(unit.amount), 0);
        activeOrders.push(`Armada: Podpora stacionovana v ${support.targetName} (${unitsTotal} jednotek)`);
      }
    }
    activeOrders.push("Ekonomika jede v realnem case podle cron ticku.");
    activeOrders.push("Nabor i vystavba bezi oddelene pro kazde leno.");

    const settlements = allVillages.map((row) => {
      const owner = playersById.get(row.playerId);
      const ownerUsername = owner?.username ?? "Neznamy";
      const isAbandonedBot = Boolean(owner?.isBot);
      const ownerLabel = isAbandonedBot ? ABANDONED_OWNER_LABEL : ownerUsername;
      const isOwn = ownerUsername === username;
      const isRoyalSettlement = row.kingdom === "Neutral" && !isAbandonedBot;
      const sameKingdom = !isAbandonedBot && row.kingdom === village.kingdom;
      const coordX = Number(row.coordX);
      const coordY = Number(row.coordY);

      return {
        id: `vlg-${row.legacyId}`,
        villageId: Number(row.legacyId),
        name: row.name,
        kind: normalizeSettlementKind(isOwn, isRoyalSettlement, isAbandonedBot),
        owner: ownerLabel,
        kingdom: row.kingdom,
        region: Number(row.region),
        localX: coordX - WORLD_REGION.originX + 1,
        localY: coordY - WORLD_REGION.originY + 1,
        globalX: coordX,
        globalY: coordY,
        prestige: Number(row.prestige),
        loyalty: isOwn ? Number(row.loyalty) : 0,
        note: isOwn
          ? "Tvoje hlavni vesnice. Mas plny pristup ke statistikam."
          : isAbandonedBot
            ? "Opustene leno s AI obranou. Podrobnosti o budovach a jednotkach jsou skryte."
            : "Cizi leno - podrobnosti o budovach a jednotkach jsou skryte.",
        visibility: isOwn ? "full" : "public",
        relation: isOwn ? "self" : isAbandonedBot ? "enemy" : sameKingdom ? "ally" : "enemy",
      };
    });

    const kingdomBuckets = new Map<string, { kingdom: string; villages: number; prestige: number }>();
    for (const settlement of settlements) {
      const current = kingdomBuckets.get(settlement.kingdom) ?? {
        kingdom: settlement.kingdom,
        villages: 0,
        prestige: 0,
      };
      current.villages += 1;
      current.prestige += Number(settlement.prestige);
      kingdomBuckets.set(settlement.kingdom, current);
    }
    const kingdomStats = [...kingdomBuckets.values()].sort((a, b) => b.prestige - a.prestige);

    const villageStatsByPlayerLegacyId = new Map<number, { villageCount: number; prestige: number; kingdoms: string[] }>();
    for (const row of allVillages) {
      const key = Number(row.playerLegacyId);
      const current = villageStatsByPlayerLegacyId.get(key) ?? { villageCount: 0, prestige: 0, kingdoms: [] };
      current.villageCount += 1;
      current.prestige += Number(row.prestige);
      current.kingdoms.push(String(row.kingdom));
      villageStatsByPlayerLegacyId.set(key, current);
    }

    const leaderboard = allPlayers
      .filter((entry) => !entry.isBot)
      .filter((entry) => !String(entry.username).startsWith(ABANDONED_BOT_USERNAME_PREFIX))
      .map((entry) => {
        const stats = villageStatsByPlayerLegacyId.get(Number(entry.legacyId)) ?? {
          villageCount: 0,
          prestige: 0,
          kingdoms: ["Neutral"],
        };
        const kingdom =
          stats.kingdoms.length === 0
            ? "Neutral"
            : [...stats.kingdoms].sort((left, right) => left.localeCompare(right, "cs"))[0];
        return {
          playerId: Number(entry.legacyId),
          username: entry.username,
          kingdom,
          villages: Number(stats.villageCount),
          prestige: Number(stats.prestige),
        };
      })
      .sort((left, right) => {
        if (right.prestige !== left.prestige) {
          return right.prestige - left.prestige;
        }
        if (right.villages !== left.villages) {
          return right.villages - left.villages;
        }
        return left.username.localeCompare(right.username, "cs", { sensitivity: "base" });
      })
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

    const activeUpgrade = activeUpgrades.length > 0 ? activeUpgrades[0] : null;

    return {
      serverTime: new Date().toISOString(),
      player: {
        id: Number(player.legacyId),
        username: player.username,
      },
      villages: villages.map((entry) => ({
        id: Number(entry.legacyId),
        name: entry.name,
        coordX: Number(entry.coordX),
        coordY: Number(entry.coordY),
        region: Number(entry.region),
        kingdom: entry.kingdom,
        prestige: Number(entry.prestige),
        loyalty: Number(entry.loyalty),
      })),
      village: {
        id: Number(village.legacyId),
        name: village.name,
        coordX: Number(village.coordX),
        coordY: Number(village.coordY),
        region: Number(village.region),
        kingdom: village.kingdom,
        prestige: Number(village.prestige),
        loyalty: Number(village.loyalty),
      },
      world: {
        region: WORLD_REGION.id,
        originX: WORLD_REGION.originX,
        originY: WORLD_REGION.originY,
        size: WORLD_REGION.size,
        settlements,
        kingdoms: kingdomStats,
      },
      resources: {
        wood: Math.floor(currentResources.wood),
        stone: Math.floor(currentResources.stone),
        iron: Math.floor(currentResources.iron),
        cap: resourceCap,
        productionPerHour: {
          wood: Number(production.wood.toFixed(2)),
          stone: Number(production.stone.toFixed(2)),
          iron: Number(production.iron.toFixed(2)),
          penalty: Number(production.penalty.toFixed(2)),
        },
      },
      population: {
        used: populationUsed,
        cap: populationCap,
        available: availablePopulation,
      },
      buildings,
      units,
      leaderboard,
      activeUpgrade: activeUpgrade
        ? {
            id: Number(activeUpgrade.legacyId),
            buildingId: activeUpgrade.buildingId,
            fromLevel: Number(activeUpgrade.fromLevel),
            toLevel: Number(activeUpgrade.toLevel),
            startedAt: activeUpgrade.startedAt,
            finishAt: activeUpgrade.finishAt,
            woodCost: Number(activeUpgrade.woodCost),
            stoneCost: Number(activeUpgrade.stoneCost),
            ironCost: Number(activeUpgrade.ironCost),
            remainingSec: Math.max(0, Math.ceil((Date.parse(activeUpgrade.finishAt) - Date.now()) / 1000)),
          }
        : null,
      activeUpgrades: activeUpgrades.map((upgrade) => ({
        id: Number(upgrade.legacyId),
        buildingId: upgrade.buildingId,
        fromLevel: Number(upgrade.fromLevel),
        toLevel: Number(upgrade.toLevel),
        startedAt: upgrade.startedAt,
        finishAt: upgrade.finishAt,
        woodCost: Number(upgrade.woodCost),
        stoneCost: Number(upgrade.stoneCost),
        ironCost: Number(upgrade.ironCost),
        remainingSec: Math.max(0, Math.ceil((Date.parse(upgrade.finishAt) - Date.now()) / 1000)),
      })),
      activeRecruitments: activeRecruitments.map((recruitment) => ({
        id: Number(recruitment.legacyId),
        unitId: recruitment.unitId,
        amount: Number(recruitment.amount),
        startedAt: recruitment.startedAt,
        finishAt: recruitment.finishAt,
        woodCost: Number(recruitment.woodCost),
        stoneCost: Number(recruitment.stoneCost),
        ironCost: Number(recruitment.ironCost),
        remainingSec: Math.max(0, Math.ceil((Date.parse(recruitment.finishAt) - Date.now()) / 1000)),
      })),
      army: {
        activeMovements,
        stationedSupports,
      },
      activeOrders,
      limits: {
        maxBuildingLevel: getGlobalMaxBuildingLevel(),
        maxUnitCount: null,
      },
    };
  },
});
