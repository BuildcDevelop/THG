import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    legacyId: v.number(),
    username: v.string(),
    password: v.string(),
    isBot: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_username", ["username"])
    .index("by_is_bot", ["isBot"]),

  villages: defineTable({
    legacyId: v.number(),
    playerId: v.id("players"),
    playerLegacyId: v.number(),
    name: v.string(),
    kingdom: v.string(),
    coordX: v.number(),
    coordY: v.number(),
    region: v.number(),
    prestige: v.number(),
    loyalty: v.number(),
    createdAt: v.string(),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_player_id", ["playerId"])
    .index("by_region_coord", ["region", "coordX", "coordY"])
    .index("by_player_legacy_id", ["playerLegacyId"]),

  resources: defineTable({
    villageId: v.id("villages"),
    villageLegacyId: v.number(),
    wood: v.number(),
    stone: v.number(),
    iron: v.number(),
  })
    .index("by_village_id", ["villageId"])
    .index("by_village_legacy_id", ["villageLegacyId"]),

  buildings: defineTable({
    villageId: v.id("villages"),
    villageLegacyId: v.number(),
    buildingId: v.string(),
    level: v.number(),
  })
    .index("by_village_id", ["villageId"])
    .index("by_village_building", ["villageId", "buildingId"])
    .index("by_village_legacy_id", ["villageLegacyId"]),

  units: defineTable({
    villageId: v.id("villages"),
    villageLegacyId: v.number(),
    unitId: v.string(),
    amount: v.number(),
  })
    .index("by_village_id", ["villageId"])
    .index("by_village_unit", ["villageId", "unitId"])
    .index("by_village_legacy_id", ["villageLegacyId"]),

  buildingUpgrades: defineTable({
    legacyId: v.number(),
    villageId: v.id("villages"),
    villageLegacyId: v.number(),
    buildingId: v.string(),
    fromLevel: v.number(),
    toLevel: v.number(),
    woodCost: v.number(),
    stoneCost: v.number(),
    ironCost: v.number(),
    startedAt: v.string(),
    finishAt: v.string(),
    status: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_village_id", ["villageId"])
    .index("by_status_finish", ["status", "finishAt"])
    .index("by_village_legacy_id", ["villageLegacyId"]),

  unitRecruitments: defineTable({
    legacyId: v.number(),
    villageId: v.id("villages"),
    villageLegacyId: v.number(),
    unitId: v.string(),
    amount: v.number(),
    woodCost: v.number(),
    stoneCost: v.number(),
    ironCost: v.number(),
    startedAt: v.string(),
    finishAt: v.string(),
    status: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_village_id", ["villageId"])
    .index("by_status_finish", ["status", "finishAt"])
    .index("by_village_legacy_id", ["villageLegacyId"]),

  armyMovements: defineTable({
    legacyId: v.number(),
    playerId: v.id("players"),
    playerLegacyId: v.number(),
    commandType: v.string(),
    originVillageId: v.id("villages"),
    targetVillageId: v.id("villages"),
    homeVillageId: v.id("villages"),
    originVillageLegacyId: v.number(),
    targetVillageLegacyId: v.number(),
    homeVillageLegacyId: v.number(),
    lootPriority: v.optional(v.string()),
    carryWood: v.number(),
    carryStone: v.number(),
    carryIron: v.number(),
    startedAt: v.string(),
    arriveAt: v.string(),
    status: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_player_id_status", ["playerId", "status"])
    .index("by_status_arrive", ["status", "arriveAt"])
    .index("by_target_village_id_status", ["targetVillageId", "status"])
    .index("by_player_legacy_id", ["playerLegacyId"]),

  armyMovementUnits: defineTable({
    movementId: v.id("armyMovements"),
    movementLegacyId: v.number(),
    unitId: v.string(),
    amount: v.number(),
  })
    .index("by_movement_id", ["movementId"])
    .index("by_movement_unit", ["movementId", "unitId"])
    .index("by_movement_legacy_id", ["movementLegacyId"]),

  battleReports: defineTable({
    legacyId: v.number(),
    playerId: v.id("players"),
    playerLegacyId: v.number(),
    originVillageId: v.optional(v.id("villages")),
    targetVillageId: v.optional(v.id("villages")),
    originVillageLegacyId: v.optional(v.number()),
    targetVillageLegacyId: v.optional(v.number()),
    battleAt: v.string(),
    createdAt: v.string(),
    title: v.string(),
    summary: v.string(),
    payloadJson: v.string(),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_player_id_created", ["playerId", "createdAt"])
    .index("by_player_legacy_id", ["playerLegacyId"]),

  kingdomInvites: defineTable({
    legacyId: v.number(),
    kingdom: v.string(),
    inviterPlayerId: v.id("players"),
    inviterPlayerLegacyId: v.number(),
    targetPlayerId: v.id("players"),
    targetPlayerLegacyId: v.number(),
    status: v.string(),
    createdAt: v.string(),
    respondedAt: v.optional(v.string()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_target_player_id_status", ["targetPlayerId", "status"])
    .index("by_inviter_player_id_status", ["inviterPlayerId", "status"])
    .index("by_target_player_legacy_id", ["targetPlayerLegacyId"])
    .index("by_inviter_player_legacy_id", ["inviterPlayerLegacyId"]),

  kingdomEvents: defineTable({
    legacyId: v.number(),
    kingdom: v.optional(v.string()),
    eventType: v.string(),
    actorPlayerId: v.optional(v.id("players")),
    actorPlayerLegacyId: v.optional(v.number()),
    targetPlayerId: v.optional(v.id("players")),
    targetPlayerLegacyId: v.optional(v.number()),
    payloadJson: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_kingdom_created", ["kingdom", "createdAt"])
    .index("by_actor_player_legacy_id", ["actorPlayerLegacyId"])
    .index("by_target_player_legacy_id", ["targetPlayerLegacyId"]),

  gameState: defineTable({
    key: v.string(),
    legacyId: v.optional(v.number()),
    lastTickAt: v.string(),
    revision: v.optional(v.number()),
  }).index("by_key", ["key"]),
});
