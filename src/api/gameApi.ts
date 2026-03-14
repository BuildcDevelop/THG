type ResourceCost = {
  wood: number;
  stone: number;
  iron: number;
};

export type LootPriority = 'wood' | 'stone' | 'iron' | 'balanced';
export type SpawnDirection = 'center' | 'north' | 'east' | 'south' | 'west';

export type WorldSettlement = {
  id: string;
  villageId: number;
  playerId?: number | null;
  name: string;
  kind: 'own' | 'player' | 'bot' | 'abandoned';
  owner: string;
  kingdom: string;
  region: number;
  localX: number;
  localY: number;
  globalX: number;
  globalY: number;
  prestige: number;
  loyalty: number;
  note: string;
  visibility: 'full' | 'public';
  relation: 'self' | 'ally' | 'enemy';
  protectionUntil?: string | null;
  protectionRemainingSec?: number;
  protectionRuleDays?: number;
  viewerPrestige?: number;
  ownerTotalPrestige?: number;
  prestigeAttackMinimumForViewer?: number;
  prestigeAttackBlockedForViewer?: boolean;
  retaliationUnlockedForViewer?: boolean;
  retaliationUnlockedAt?: string | null;
};

export type WorldKingdomSummary = {
  kingdom: string;
  villages: number;
  prestige: number;
};

export type GameBuildingState = {
  id: string;
  name: string;
  category: string;
  level: number;
  maxLevel: number;
  workersUsed: number;
  effect: string;
  nextLevelPreview?: {
    fromLevel: number;
    toLevel: number;
    deltas: string[];
    unlocks: string[];
  } | null;
  nextCost: ResourceCost | null;
  nextDurationSec: number | null;
  canUpgrade: boolean;
  blockedReason: string | null;
  isInProgress: boolean;
  finishesAt: string | null;
  remainingSec: number | null;
};

export type GameUnitState = {
  id: string;
  name: string;
  role: string;
  amount: number;
  maxAmount: number;
  queuedCount: number;
  stationedSupportCount?: number;
  cost: ResourceCost;
  requiredBuildingId: string;
  requiredBuildingLevel: number;
  maxRecruitable: number;
  canRecruit: boolean;
  blockedReason: string | null;
};

export type ArmyMovementState = {
  id: number;
  commandType: 'attack' | 'support' | 'move' | 'return';
  commanderPlayerId?: number | null;
  commanderUsername?: string | null;
  originVillageId: number;
  targetVillageId: number;
  homeVillageId: number;
  originName: string;
  originCoordX: number;
  originCoordY: number;
  targetName: string;
  targetCoordX: number;
  targetCoordY: number;
  homeName: string;
  homeCoordX: number;
  homeCoordY: number;
  lootPriority?: LootPriority | null;
  carryWood?: number;
  carryStone?: number;
  carryIron?: number;
  startedAt: string;
  arriveAt: string;
  distance: number;
  remainingSec: number;
  isRelatedToCurrentVillage: boolean;
  isIncoming?: boolean;
  units: {
    unitId: string;
    amount: number;
  }[];
};

export type RecentAttackTargetState = {
  targetVillageId: number;
  targetName: string;
  targetCoordX: number;
  targetCoordY: number;
  lastIssuedAt: string;
};

export type ArmyVillageUnitSummary = {
  unitId: string;
  unitName: string;
  sortOrder: number;
  ownAmount: number;
  supportAmount: number;
  availableForPlanning: number;
  visibleLabel: string;
};

export type ArmyVillageSummary = {
  villageId: number;
  villageName: string;
  coordX: number;
  coordY: number;
  kingdom: string;
  sortLabel: string;
  totalOwnUnits: number;
  totalSupportUnits: number;
  plannerSelectable: boolean;
  plannerSelected: boolean;
  units: ArmyVillageUnitSummary[];
};

export type ArmyOverviewResponse = {
  worldId: string;
  generatedAt: string;
  villages: ArmyVillageSummary[];
};

export type PlannerPlanStatus =
  | 'scheduled'
  | 'needs_reconfirmation'
  | 'dispatching'
  | 'completed'
  | 'failed'
  | 'canceled';

export type PlannerPlanLegStatus = 'scheduled' | 'sent' | 'failed' | 'canceled';

export type PlannerPlanDetail = {
  plan: {
    id: string;
    status: PlannerPlanStatus;
    revision: number;
    targetVillageId: number;
    targetPlayerId: number;
    targetPlayerUsernameSnapshot: string;
    targetVillageNameSnapshot: string;
    targetKingdomSnapshot: string;
    confirmedAt: string | null;
    createdAt: string;
    updatedAt: string;
    failedAt: string | null;
    canceledAt: string | null;
  };
  legs: Array<{
    id: string;
    order: number;
    status: PlannerPlanLegStatus;
    originVillageId: number;
    originVillageNameSnapshot: string;
    impactAtUtc: string;
    sendAtUtc: string;
    travelDurationSec: number;
    units: Array<{ unitId: string; plannedAmount: number }>;
    failCode: string | null;
    failMessage: string | null;
  }>;
};

export type PlannerCompletedStub = {
  planId: string;
  targetPlayerUsernameSnapshot: string;
  targetVillageNameSnapshot: string;
  targetKingdomSnapshot: string;
  legsCount: number;
  firstSendAtUtc: string;
  lastSendAtUtc: string;
  completedAt: string;
};

export type PlannerRecentTarget = {
  targetPlayerId: number;
  targetPlayerUsername: string;
  targetVillageId: number;
  targetVillageName: string;
  targetKingdom: string;
  coordX: number;
  coordY: number;
  lastUsedAt: string;
};

export type PlannerOpenResponse = {
  worldId: string;
  timezone: 'Europe/Prague';
  constraints: {
    maxLegs: 10;
    minImpactGapMinutes: 1;
    leadTimeSec: number;
    activePlansPerPlayerPerWorld: 1;
  };
  bannerText: string;
  activePlan: PlannerPlanDetail | null;
  lastCompletedPlan: PlannerCompletedStub | null;
  recentTargets: PlannerRecentTarget[];
};

export type PlannerUnitId = 'militia' | 'archer' | 'cavalry' | 'scout' | 'knight' | 'ram' | 'caravan';

export type PlannerUnitAmount = {
  unitId: PlannerUnitId;
  amount: number;
};

export type PlannerLegInput = {
  order: number;
  originVillageId: number;
  impactAtPrague: string;
  units: PlannerUnitAmount[];
};

export type PlannerValidationIssue = {
  code: string;
  severity: 'warning' | 'blocked';
  message: string;
  scope: 'plan' | 'target' | 'leg';
  legOrder?: number;
  legOriginVillageId?: number;
};

export type PlannerValidationResponse = {
  resolvedTarget: {
    targetPlayerId: number;
    targetPlayerUsername: string;
    targetVillageId: number;
    targetVillageName: string;
    targetKingdom: string;
    coordX: number;
    coordY: number;
    snapshotHash: string;
  } | null;
  normalizedLegs: Array<{
    order: number;
    originVillageId: number;
    impactAtPrague: string;
    impactAtUtc: string;
    sendAtUtc: string;
    travelDurationSec: number;
    units: PlannerUnitAmount[];
  }>;
  validation: {
    status: 'ok' | 'warning' | 'blocked';
    issues: PlannerValidationIssue[];
  };
};

export type ValidatePlannerPlanRequest = {
  username: string;
  worldId: string;
  targetPlayerUsername: string;
  targetVillageId?: number | null;
  legs: PlannerLegInput[];
};

export type PlannerPlanMutationSummary = {
  id: string;
  status: PlannerPlanStatus;
  revision: number;
  confirmedAt?: string | null;
  updatedAt?: string | null;
  canceledAt?: string | null;
};

export type CreatePlannerPlanRequest = {
  username: string;
  worldId: string;
  targetPlayerUsername: string;
  targetVillageId?: number | null;
  legs: PlannerLegInput[];
  confirmation: {
    confirmedByPlayer: boolean;
    clientValidatedAt?: string | null;
  };
};

export type CreatePlannerPlanResponse = {
  plan: PlannerPlanMutationSummary;
  activePlan: PlannerPlanDetail | null;
  lastCompletedPlan: PlannerCompletedStub | null;
};

export type UpdatePlannerPlanRequest = {
  username: string;
  worldId: string;
  expectedRevision: number;
  targetPlayerUsername: string;
  targetVillageId?: number | null;
  legs: PlannerLegInput[];
};

export type UpdatePlannerPlanResponse = {
  plan: PlannerPlanMutationSummary;
  activePlan: PlannerPlanDetail | null;
};

export type ReconfirmPlannerPlanRequest = {
  username: string;
  worldId: string;
  expectedRevision: number;
  confirmWithConsequences: boolean;
};

export type ReconfirmPlannerPlanResponse = {
  plan: PlannerPlanMutationSummary;
  activePlan: PlannerPlanDetail | null;
};

export type CancelPlannerPlanRequest = {
  username: string;
  worldId: string;
  expectedRevision: number;
};

export type CancelPlannerPlanResponse = {
  plan: PlannerPlanMutationSummary;
  activePlan: PlannerPlanDetail | null;
};

export type PlannerPlanEventItem = {
  id: string;
  planId: string;
  planLegId: string | null;
  eventType: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type PlannerPlanEventsResponse = {
  items: PlannerPlanEventItem[];
  nextCursor: string | null;
};

export type LeaderboardRow = {
  rank: number;
  playerId: number;
  username: string;
  kingdom: string;
  villages: number;
  prestige: number;
  attackerScore?: number;
  defenderScore?: number;
  supporterScore?: number;
  attackerRank?: number | null;
  defenderRank?: number | null;
  supporterRank?: number | null;
};

export type KingdomHubMember = {
  playerId: number;
  username: string;
  villages: number;
  prestige: number;
  isLeader: boolean;
};

export type KingdomInviteCandidate = {
  playerId: number;
  username: string;
  villages: number;
  prestige: number;
};

export type KingdomIncomingInvite = {
  id: number;
  kingdom: string;
  inviterUsername: string;
  createdAt: string;
};

export type KingdomAvailableSummary = {
  kingdom: string;
  villages: number;
  members: number;
  prestige: number;
};

export type KingdomAuditLogEntry = {
  id: number;
  kingdom: string | null;
  eventType: string;
  createdAt: string;
  actorUsername: string;
  targetUsername: string | null;
  message: string;
};

export type KingdomHubState = {
  isMember: boolean;
  kingdom: string | null;
  leaderUsername: string | null;
  canManageInvites: boolean;
  members: KingdomHubMember[];
  inviteCandidates: KingdomInviteCandidate[];
  incomingInvites: KingdomIncomingInvite[];
  availableKingdoms: KingdomAvailableSummary[];
  auditLog: KingdomAuditLogEntry[];
};

export type DeveloperResourceBoostState = {
  isActive: boolean;
  source: string;
  worldId: string | null;
  reason: string | null;
  label: string | null;
  bonusPercent: number;
  multiplier: number;
  startsAt: string | null;
  endsAt: string | null;
  remainingSec: number;
};

export type ResearchProjectState = {
  id: string;
  name: string;
  description: string;
  coinCost: number;
  unlocks: string;
  requiredResearchIds: string[];
  status: 'locked' | 'available' | 'researching' | 'completed';
  progressPoints: number;
  requiredPoints: number;
  progressPercent: number;
  assignedAcademics: number;
  progressPerHour?: number;
  remainingSec?: number | null;
  estimatedCompletionAt?: string | null;
  assignedVillageBreakdown?: {
    villageId: number;
    villageName: string;
    coordX: number;
    coordY: number;
    universityLevel: number;
    assignedAcademics: number;
  }[];
  startedAt: string | null;
  completedAt: string | null;
};

export type LogisticsRouteState = {
  id: number;
  ownerPlayerId: number;
  sourceVillageId: number;
  targetVillageId: number;
  sourceVillageName: string;
  targetVillageName: string;
  mode: string;
  status: string;
  wood: number;
  stone: number;
  iron: number;
  startedAt: string;
  arriveAt: string;
  completedAt: string | null;
  remainingSec: number;
};

export type MarketMerchantState = {
  total: number;
  inUse: number;
  available: number;
};

export type MarketGuildVillageEconomyState = {
  villageId: number;
  name: string;
  coordX: number;
  coordY: number;
  marketLevel: number;
  cap: number;
  resources: {
    wood: number;
    stone: number;
    iron: number;
  };
  totalResources: number;
  fillPct: number;
  merchants: MarketMerchantState;
};

export type MarketGuildTargetState = {
  id: number;
  targetVillageId: number;
  sortIndex: number;
  isPaused: boolean;
  name: string;
  coordX: number;
  coordY: number;
  isActive: boolean;
  warning: string | null;
  cap: number;
  resources: {
    wood: number;
    stone: number;
    iron: number;
  };
  totalResources: number;
  fillPct: number;
};

export type MarketGuildAuditLogEntry = {
  id: number;
  ownerPlayerId: number;
  sourceVillageId: number;
  targetVillageId: number | null;
  region: number;
  severity: string;
  reasonCode: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type MarketGuildAutomationState = {
  enabled: boolean;
  cycleIntervalSec: number;
  nextDispatchAt: string | null;
  lastDispatchAt: string | null;
  cursorIndex: number;
  dispatchWindow: {
    startHourUtc: number;
    endHourUtc: number;
    isActiveNow: boolean;
  };
  merchants: MarketMerchantState;
  ownVillages: MarketGuildVillageEconomyState[];
  targets: MarketGuildTargetState[];
  auditLog: MarketGuildAuditLogEntry[];
};

export type WorldMapSnapshotResponse = {
  serverTime: string;
  world: {
    id?: string;
    name?: string;
    snapshotKey?: string;
    version?: string | null;
    region: number;
    originX: number;
    originY: number;
    size: number;
    settlements: WorldSettlement[];
    kingdoms: WorldKingdomSummary[];
  };
};

export type MercenaryContractState = {
  id: number;
  villageId?: number;
  villageName?: string;
  status: string;
  orderedAt: string;
  arriveAt: string;
  expiresAt: string;
  deliveredAt: string | null;
  finishedAt: string | null;
  unitAmount: number;
};

export type MercenaryHiringOptionState = {
  villageId: number;
  villageName: string;
  coordX: number;
  coordY: number;
  coins: number;
  hasEnoughCoins: boolean;
  canHire: boolean;
  blockedReason: string | null;
  isCurrentVillage: boolean;
  activeContractStatus: string | null;
  activeContractArriveAt: string | null;
  activeContractExpiresAt: string | null;
  activeContractUnitAmount: number;
};

export type GameStateResponse = {
  serverTime: string;
  stateVersion?: string;
  player: {
    id: number;
    username: string;
  };
  kingdomHub?: KingdomHubState;
  villages: {
    id: number;
    name: string;
    coordX: number;
    coordY: number;
    region: number;
    kingdom: string;
    prestige: number;
    loyalty: number;
    protectionUntil?: string | null;
    protectionRemainingSec?: number;
    protectionRuleDays?: number;
  }[];
  village: {
    id: number;
    name: string;
    coordX: number;
    coordY: number;
    region: number;
    kingdom: string;
    prestige: number;
    loyalty: number;
    protectionUntil?: string | null;
    protectionRemainingSec?: number;
    protectionRuleDays?: number;
    isUnderProtection?: boolean;
  };
  world: {
    id?: string;
    name?: string;
    snapshotKey?: string;
    version?: string | null;
    region: number;
    originX: number;
    originY: number;
    size: number;
    settlements: WorldSettlement[];
    kingdoms: WorldKingdomSummary[];
  };
  resources: {
    wood: number;
    stone: number;
    iron: number;
    gold: number;
    coins: number;
    cap: number;
    goldCap: number;
    coinsCap: number;
    productionPerHour: {
      wood: number;
      stone: number;
      iron: number;
      gold: number;
      mintCoins: number;
      penalty: number;
    };
    protection: {
      wood: number;
      stone: number;
      iron: number;
      gold: number;
      coins: number;
    };
    developerBoost: DeveloperResourceBoostState;
  };
  population: {
    used: number;
    cap: number;
    available: number;
    academicsUsed?: number;
    breakdown?: {
      buildings: number;
      unitsHome: number;
      unitsAway: number;
      academics: number;
      garrisonReserved: number;
      recruitmentReserved: number;
    };
    overflow?: {
      amount: number;
      any: boolean;
    };
  };
  garrison: {
    isUnlocked?: boolean;
    activeCap?: number;
    reservedPopulation: number;
    totalCap: number;
    totalUnits: number;
    lastSyncAt: string | null;
    units: {
      militia: {
        amount: number;
        cap: number;
        missing: number;
        refillSecPerUnit: number;
        nextRefillSec: number | null;
      };
      archer: {
        amount: number;
        cap: number;
        missing: number;
        refillSecPerUnit: number;
        nextRefillSec: number | null;
      };
    };
  };
  buildings: GameBuildingState[];
  units: GameUnitState[];
  leaderboard?: LeaderboardRow[];
  activeUpgrade: {
    id: number;
    buildingId: string;
    fromLevel: number;
    toLevel: number;
    startedAt: string;
    finishAt: string;
    woodCost: number;
    stoneCost: number;
    ironCost: number;
    remainingSec: number;
  } | null;
  activeUpgrades: {
    id: number;
    buildingId: string;
    fromLevel: number;
    toLevel: number;
    startedAt: string;
    finishAt: string;
    woodCost: number;
    stoneCost: number;
    ironCost: number;
    remainingSec: number;
  }[];
  activeRecruitments: {
    id: number;
    unitId: string;
    amount: number;
    startedAt: string;
    finishAt: string;
    woodCost: number;
    stoneCost: number;
    ironCost: number;
    remainingSec: number;
  }[];
  army: {
    activeMovements: ArmyMovementState[];
    stationedSupports: ArmyMovementState[];
    incomingMovements: ArmyMovementState[];
    recentAttackTargets?: RecentAttackTargetState[];
  };
  research?: {
    totalAcademics: number;
    idleAcademics: number;
    regionAcademicCapacity?: number;
    regionAcademicAvailableSlots?: number;
    villageAcademics?: number;
    villageAcademicCapacity?: number;
    villageAcademicAvailableSlots?: number;
    activeProjectId: string | null;
    projects: ResearchProjectState[];
  };
  market?: {
    level: number;
    capacity: number;
    maxDistance: number;
    guildUnlocked: boolean;
    merchants: MarketMerchantState;
    logisticsRoutes: LogisticsRouteState[];
    guildAutomation: MarketGuildAutomationState;
  };
  mercenaries?: {
    contracts: MercenaryContractState[];
    cooldownRemainingSec: number;
    cooldownEndsAt?: string | null;
    cooldownSec?: number;
    deliveryDelaySec?: number;
    durationSec?: number;
    contractCoinCost?: number;
    contractUnitAmount?: number;
    unlocked?: boolean;
    hiringOptions?: MercenaryHiringOptionState[];
  };
  rules?: {
    nightMode: {
      startHourUtc: number;
      endHourUtc: number;
      isActiveNow: boolean;
      defenseBonusPct: number;
    };
    prestigeBalance?: {
      minAttackablePrestigeRatio: number;
      minLootModifier: number;
      retaliationRule?: string;
    };
    cancelCommandProgressLimit: number;
  };
  activeOrders: string[];
  limits: {
    maxBuildingLevel: number;
    maxUnitCount: number | null;
  };
};

export type FetchGameStateOptions = {
  includeWorldMap?: boolean;
  includeLeaderboard?: boolean;
  includeKingdomHub?: boolean;
  includeResearch?: boolean;
  includeMarket?: boolean;
  includeMercenaries?: boolean;
  includeRules?: boolean;
};

export type LoginResponse = {
  username: string;
  village: {
    id: number | null;
    name: string | null;
    kingdom: string | null;
    coordX: number | null;
    coordY: number | null;
  };
};

export type RegisterResponse = LoginResponse;

export type WorldsPortalProfile = {
  id: number;
  username: string;
  kingdom: string;
  villageCount: number;
  prestige: number;
  joinedAt: string;
};

export type WorldPortalItem = {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  region: number;
  regionSize: number;
  seasonLabel: string;
  timelineLabel: string;
  description: string;
  isDefault: boolean;
  player: {
    hasPresence: boolean;
    villages: number;
    prestige: number;
    rank: number | null;
    kingdom: string | null;
  };
  stats: {
    playerAccounts: number;
  };
};

export type WorldsPortalResponse = {
  profile: WorldsPortalProfile;
  worlds: WorldPortalItem[];
  defaultWorldId: string;
};

export type BackendHealthStatus = {
  ok: true;
  service: string;
  serverTime: string;
  deployment?: {
    provider?: string;
    versionLabel?: string;
    buildId?: string;
    isUpdating?: boolean;
    status?: string;
  };
  features?: {
    useConvexAuth?: boolean;
    useConvexState?: boolean;
    useConvexFull?: boolean;
    convexConfigured?: boolean;
  };
};

export type AdminPlayerRow = {
  id: number;
  username: string;
  kingdom: string;
  villageName: string;
  villageCount: number;
  prestige: number;
  coordX: number;
  coordY: number;
  createdAt: string;
};

export type ConquerVillageResult = {
  villageId: number;
  villageName: string;
  previousOwner: string;
  newOwner: string;
  renamed: false;
};

export type RestartVillageResult = {
  username: string;
  restartedAt: string;
  abandonedVillagesConverted: number;
  convertedVillages: {
    villageId: number;
    botPlayerId: number;
    botUsername: string;
    villageName: string;
  }[];
  newVillage: {
    id: number;
    name: string;
    coordX: number;
    coordY: number;
    region: number;
    kingdom: string;
  } | null;
};

export type CreateAbandonedVillagesResult = {
  requestedCount: number;
  createdCount: number;
  villages: {
    villageId: number;
    villageName: string;
    coordX: number;
    coordY: number;
    owner: string;
  }[];
};

export type BattleReportPayload = {
  perspective?: 'attacker' | 'defender';
  role?: 'support' | 'spy';
  movementId?: number;
  supportMovementId?: number;
  at?: string;
  originVillageId?: number;
  targetVillageId?: number;
  originVillageName?: string;
  targetVillageName?: string;
  attacker?: string;
  defender?: string;
  outcome?: 'attacker_victory' | 'defender_victory';
  gateBlocked?: boolean;
  armyDestroyed?: boolean;
  attackerForcesUnknown?: boolean;
  lootPriority?: LootPriority;
  lootTaken?: {
    wood: number;
    stone: number;
    iron: number;
  };
  returnMovement?: {
    movementId?: number;
    startedAt?: string;
    arriveAt?: string;
    durationSec?: number;
    distanceTiles?: number;
    fromVillageId?: number;
    fromVillageName?: string;
    toVillageId?: number;
    toVillageName?: string;
    units?: Record<string, number>;
    lootTaken?: {
      wood: number;
      stone: number;
      iron: number;
    };
  };
  support?: {
    start?: Record<string, number>;
    losses?: Record<string, number>;
    survivors?: Record<string, number>;
    survivorsTotal?: number;
  };
  spy?: {
    success?: boolean;
    quality?: 'exact' | 'approximate' | 'none';
    approximate?: boolean;
    defenderScouts?: number;
    uncertainty?: number;
    attackerScouts?: {
      start?: number;
      losses?: number;
      survivors?: number;
    };
    intel?: {
      units?: Record<string, number>;
      buildings?: Record<string, number>;
    };
  };
  conquest?: {
    conquered?: boolean;
    blockedByVillageLimit?: boolean;
    villageLimit?: number;
    previousOwner?: string;
    newOwner?: string;
    targetVillageId?: number;
    targetVillageName?: string;
    knightConsumed?: boolean;
  };
  sentArmy?: {
    start?: Record<string, number>;
    totalUnits?: number;
    baseAttackPower?: number;
    finalAttackPower?: number;
    attackMultiplier?: number;
  };
  battle?: {
    blockedByGate?: boolean;
    gateDamageLossRatio?: number;
    baseAttackPower?: number;
    baseDefensePower?: number;
    finalAttackPower?: number;
    finalDefensePower?: number;
    attackMultiplier?: number;
    defenseMultiplier?: number;
    prestigeBalance?: {
      attackerPrestige?: number;
      defenderPrestige?: number;
      powerRatio?: number;
      attackAllowed?: boolean;
      retaliationOverrideApplied?: boolean;
      attackModifier?: number;
      defenseBonus?: number;
      defenseMultiplier?: number;
      lootModifier?: number;
    };
    bonuses?: string[];
    attackerLossRatio?: number;
    defenderLossRatio?: number;
    attacker?: {
      start?: Record<string, number>;
      losses?: Record<string, number>;
      survivors?: Record<string, number>;
      survivorsTotal?: number;
    };
    defender?: {
      start?: Record<string, number>;
      losses?: Record<string, number>;
      survivors?: Record<string, number>;
      survivorsTotal?: number;
    };
  };
};

export type BattleReportItem = {
  id: number;
  playerId: number;
  originVillageId: number | null;
  targetVillageId: number | null;
  battleAt: string;
  createdAt: string;
  title: string;
  summary: string;
  payload: BattleReportPayload;
};

export type BattleReportListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: BattleReportItem[];
};

export type BattleReportSummaryResponse = {
  total: number;
  updatedAt: string;
};

export type GameActivitySeverity = 'info' | 'success' | 'warning' | 'critical';

export type GameActivityItem = {
  id: number;
  playerId: number;
  region: number;
  category: string;
  eventType: string;
  severity: GameActivitySeverity;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  sourceType: string | null;
  sourceId: number | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

export type GameActivityListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  includeArchived: boolean;
  unreadTotal: number;
  attentionTotal: number;
  unreadFeed: GameActivityItem[];
  items: GameActivityItem[];
};

export type GameActivitySummaryResponse = {
  unreadTotal: number;
  attentionTotal: number;
  unreadFeed: GameActivityItem[];
  updatedAt: string;
};

export type GameActivityMutationResult = {
  notificationId?: number;
  action?: 'read' | 'archive' | 'unarchive' | 'delete';
  actedAt: string;
  changed?: number;
  summary: {
    unreadTotal: number;
    attentionTotal: number;
    unreadFeed: GameActivityItem[];
  };
};

export type ArmyCommandType = 'attack' | 'support' | 'move' | 'return';

export type IssueArmyCommandPayload = {
  commandType: ArmyCommandType;
  villageId?: number | null;
  worldId?: string | null;
  targetVillageId?: number;
  manualTargetCoordX?: number;
  manualTargetCoordY?: number;
  supportMovementId?: number;
  lootPriority?: LootPriority;
  units?: Partial<Record<'militia' | 'archer' | 'cavalry' | 'scout' | 'knight' | 'ram' | 'caravan', number>>;
};

export type IssueArmyCommandResult = {
  orderId: number;
  commandType: ArmyCommandType;
  originVillageId: number;
  targetVillageId: number;
  totalUnits: number;
  distanceTiles: number;
  durationSec: number;
  arriveAt: string;
  arrivesDuringNightMode?: boolean;
  totalCost?: ResourceCost;
  lootPriority?: LootPriority | null;
};

export type CancelArmyCommandResult = {
  canceledMovementId: number;
  returnMovementId: number | null;
  totalUnits: number;
  elapsedSec: number;
  returnDurationSec: number;
  returnArriveAt: string | null;
};

export type CancelBuildingUpgradeResult = {
  canceledUpgradeId: number;
  buildingId: string;
  canceledCount: number;
  refunded: ResourceCost;
};

export type CancelAllBuildingUpgradesResult = {
  canceledCount: number;
  refunded: ResourceCost;
};

export type ReorderBuildingUpgradeQueueResult = {
  movedUpgradeId: number;
  fromIndex: number;
  toIndex: number;
  queueLength: number;
  moved: boolean;
};

export type CancelRecruitmentResult = {
  canceledRecruitmentId: number;
  unitId: string;
  amount: number;
  refunded: ResourceCost;
};

export type RecallKnightResult = {
  villageId: number;
  unitId: string;
  recalled: number;
  refunded: ResourceCost;
};

export type HireAcademicsResult = {
  hired: number;
  villageId: number;
  universityLevel: number;
  totalCoinCost: number;
  hiredAt: string;
};

export type StartResearchProjectResult = {
  researchId: string;
  researchName: string;
  assignedAcademics: number;
  coinCostPaid: number;
  startedAt: string;
};

export type AdjustResearchProjectAcademicsResult = {
  researchId: string;
  researchName: string;
  deltaApplied: number;
  assignedAcademics: number;
  updatedAt: string;
};

export type HireMercenaryContractResult = {
  contractId: number;
  villageId: number;
  villageName?: string;
  orderedAt: string;
  arriveAt: string;
  expiresAt: string;
  unitAmount: number;
  cooldownHours: number;
};

export type SendMarketLogisticsResult = {
  routeId: number;
  sourceVillageId: number;
  targetVillageId: number;
  distanceTiles: number;
  durationSec: number;
  arriveAt: string;
  resources: {
    wood: number;
    stone: number;
    iron: number;
  };
};

export type CancelMarketLogisticsResult = {
  canceledRouteId: number;
  sourceVillageId: number;
  targetVillageId: number;
  refunded: {
    wood: number;
    stone: number;
    iron: number;
  };
  elapsedSec: number;
  totalDurationSec: number;
  canceledAt: string;
};

export type ConfigureMarketGuildAutomationResult = {
  sourceVillageId: number;
  enabled: boolean;
  targetCount: number;
  pausedTargetCount?: number;
  cycleIntervalSec: number;
  nextDispatchAt: string | null;
  updatedAt: string;
};

export type KingdomInviteResult = {
  inviteId: number;
  kingdom: string;
  inviterUsername: string;
  targetUsername: string;
  createdAt: string;
};

export type KingdomCreateResult = {
  kingdom: string;
  founderUsername: string;
  createdAt: string;
};

export type KingdomInviteAcceptResult = {
  inviteId: number;
  kingdom: string;
  inviterUsername: string;
  acceptedAt: string;
};

export type KingdomInviteRejectResult = {
  inviteId: number;
  kingdom: string;
  rejectedAt: string;
};

export type KingdomLeaveResult = {
  username: string;
  previousKingdom: string;
  leftAt: string;
};

export type KingdomKickResult = {
  kickedUsername: string;
  kingdom: string;
  kickedAt: string;
};

export type KingdomTransferLeadershipResult = {
  kingdom: string;
  previousLeaderUsername: string;
  newLeaderUsername: string;
  transferredAt: string;
};

export type CommunicationRelation = 'friend' | 'kingdom' | 'stranger';

export type CommunicationInternalLinkPayload = {
  kind: 'internal-link';
  worldId: string;
  path: string;
  label: string;
  createdAt?: string;
};

export type CommunicationNotificationSharePayload = {
  kind: 'notification-share';
  shareToken: string;
  notificationId: number;
  label: string;
  createdAt?: string;
};

export type CommunicationMessagePayload =
  | CommunicationInternalLinkPayload
  | CommunicationNotificationSharePayload
  | Record<string, unknown>;

export type CommunicationMessage = {
  id: number;
  threadId: number;
  senderPlayerId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  body: string;
  payload: CommunicationMessagePayload | null;
  createdAt: string;
  deletedAt: string | null;
};

export type CommunicationThreadSummary = {
  id: number;
  kind: string;
  createdByPlayerId: number;
  createdAt: string;
  relation: CommunicationRelation;
  isFriend: boolean;
  isMessageRequest: boolean;
  unreadCount: number;
  lastOpenedAt: string | null;
  otherPlayer: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastActiveAt: string | null;
  };
  lastMessage: CommunicationMessage | null;
  lastActivityAt: string;
};

export type CommunicationFriend = {
  playerId: number;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastActiveAt: string | null;
};

export type CommunicationFriendRequestIncoming = {
  id: number;
  senderPlayerId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  createdAt: string;
};

export type CommunicationFriendRequestOutgoing = {
  id: number;
  receiverPlayerId: number;
  receiverUsername: string;
  receiverAvatarUrl: string | null;
  createdAt: string;
};

export type CommunicationBlockedPlayer = {
  playerId: number;
  username: string;
};

export type CommunicationSuggestion = {
  playerId: number;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastActiveAt: string | null;
  isFriend: boolean;
  isBlocked: boolean;
  relation: CommunicationRelation;
};

export type CommunicationSummary = {
  unreadMessages: number;
  messageRequests: number;
  friendRequests: number;
  totalAttention: number;
};

export type CommunicationSummaryResponse = {
  serverTime: string;
  summary: CommunicationSummary;
};

export type CommunicationInboxResponse = {
  serverTime: string;
  me: {
    playerId: number;
    username: string;
    avatarUrl: string | null;
    avatarUpdatedAt: string | null;
  };
  uiState: {
    communication: Record<string, unknown>;
    updatedAt: string | null;
  };
  summary: CommunicationSummary;
  threads: CommunicationThreadSummary[];
  selectedThreadId: number | null;
  selectedMessages: CommunicationMessage[];
  friends: CommunicationFriend[];
  friendRequests: {
    incoming: CommunicationFriendRequestIncoming[];
    outgoing: CommunicationFriendRequestOutgoing[];
  };
  blockedPlayers: CommunicationBlockedPlayer[];
  suggestions: CommunicationSuggestion[];
};

export type OpenCommunicationThreadResult = {
  threadId: number;
  openedAt: string;
  latestMessageId: number | null;
};

export type SendCommunicationMessageResult = {
  threadId: number;
  message: CommunicationMessage;
};

export type ArchiveCommunicationThreadResult = {
  threadId: number;
  archivedAt: string;
};

export type DeleteCommunicationMessageResult = {
  messageId: number;
  threadId: number;
  deletedAt: string;
};

export type SendCommunicationFriendRequestResult =
  | {
      acceptedImmediately: true;
      friendPlayerId: number;
      friendUsername: string;
      actedAt: string;
    }
  | {
      requestId: number;
      senderPlayerId: number;
      senderUsername: string;
      receiverPlayerId: number;
      receiverUsername: string;
      createdAt: string;
    };

export type RespondCommunicationFriendRequestResult = {
  requestId: number;
  action: 'accept' | 'reject';
  actedAt: string;
};

export type RemoveCommunicationFriendResult = {
  removedPlayerId: number;
  removedUsername: string;
};

export type BlockCommunicationPlayerResult = {
  blockedPlayerId: number;
  blockedUsername: string;
  blockedAt: string;
};

export type UnblockCommunicationPlayerResult = {
  unblockedPlayerId: number;
  unblockedUsername: string;
  unblockedAt: string;
};

export type SetCommunicationAvatarResult = {
  playerId: number;
  avatarUrl: string | null;
  updatedAt: string;
};

export type SetCommunicationUiStateResult = {
  updatedAt: string;
};

export type CommunicationTokenSuggestion =
  | {
      kind: 'user';
      label: string;
      value: string;
      playerId: number;
      avatarUrl: string | null;
      relation: CommunicationRelation;
      isFriend: boolean;
    }
  | {
      kind: 'kingdom';
      label: string;
      value: string;
      villages: number;
    }
  | {
      kind: 'village';
      label: string;
      value: string;
      villageId: number;
      villageName: string;
      coordX: number;
      coordY: number;
      ownerUsername: string;
      kingdom: string;
    };

export type CommunicationTokenSuggestionsResponse = {
  tokenType: string;
  query: string;
  suggestions: CommunicationTokenSuggestion[];
};

export type CommunicationNotificationShareCreateResult = {
  shareToken: string;
  sharedAt: string;
  notification: {
    id: number;
    region: number;
    category: string;
    eventType: string;
    severity: string;
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
  };
};

export type CommunicationNotificationSharePreview = {
  shareToken: string;
  sharedAt: string;
  sourcePlayerId: number;
  sourceUsername: string;
  sourceNotificationId: number;
  available: boolean;
  deleted: boolean;
  battleReport?: BattleReportItem | null;
  notification: {
    id: number;
    category: string;
    eventType: string;
    severity: string;
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
    readAt: string | null;
    archivedAt: string | null;
  } | null;
};

export type RenameVillageResult = {
  villageId: number;
  previousName: string;
  newName: string;
  renamed: boolean;
  changedAt: string;
};

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
  errorCode?: string;
  details?: Record<string, unknown>;
};

const rawBaseUrl = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';
const allowRemoteApiFromLocalhost =
  String(import.meta.env.VITE_ALLOW_REMOTE_API_FROM_LOCALHOST ?? '')
    .trim()
    .toLowerCase() === 'true';
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);
const shouldForceRelativeApiForRemoteHost = (() => {
  if (typeof window === 'undefined' || !rawBaseUrl) {
    return false;
  }
  const currentHost = String(window.location.hostname ?? '').trim().toLowerCase();
  if (LOCALHOST_NAMES.has(currentHost)) {
    return false;
  }
  try {
    const targetUrl = new URL(rawBaseUrl);
    return LOCALHOST_NAMES.has(String(targetUrl.hostname ?? '').trim().toLowerCase());
  } catch {
    return false;
  }
})();
const baseUrl = shouldForceRelativeApiForRemoteHost ? '' : rawBaseUrl;

const resolveUnsafeLocalhostRemoteApiMessage = (): string | null => {
  if (allowRemoteApiFromLocalhost || !baseUrl || typeof window === 'undefined') {
    return null;
  }

  const currentHost = String(window.location.hostname ?? '').trim().toLowerCase();
  if (!LOCALHOST_NAMES.has(currentHost)) {
    return null;
  }

  let targetHost = '';
  try {
    targetHost = String(new URL(baseUrl).hostname ?? '').trim().toLowerCase();
  } catch {
    return null;
  }

  if (!targetHost || LOCALHOST_NAMES.has(targetHost)) {
    return null;
  }

  return `Blokováno: localhost klient míří na vzdálené API (${baseUrl}). Nastav VITE_API_BASE=http://localhost:3001 nebo povol výjimku přes VITE_ALLOW_REMOTE_API_FROM_LOCALHOST=true.`;
};

const unsafeLocalhostRemoteApiMessage = resolveUnsafeLocalhostRemoteApiMessage();

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (unsafeLocalhostRemoteApiMessage) {
    throw new Error(unsafeLocalhostRemoteApiMessage);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as ApiError).error)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
    throw new Error('Neplatna odpoved backendu.');
  }

  if ((payload as { ok?: boolean }).ok !== true) {
    const errorMessage =
      'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Neplatna odpoved backendu.';
    throw new Error(errorMessage);
  }

  return payload as T;
};

const isHttp404Error = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('HTTP 404');
};

export const loginRequest = async (username: string, password: string): Promise<LoginResponse> => {
  const payload = await request<ApiOk<LoginResponse>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  return payload.data;
};

export const registerRequest = async (username: string, password: string): Promise<RegisterResponse> => {
  const payload = await request<ApiOk<RegisterResponse>>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  return payload.data;
};

export const logoutRequest = async (): Promise<void> => {
  await request<ApiOk<{ loggedOut: boolean }>>('/api/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const fetchWorlds = async (username: string): Promise<WorldsPortalResponse> => {
  const params = new URLSearchParams({ username });
  const payload = await request<ApiOk<WorldsPortalResponse>>(`/api/v1/worlds?${params.toString()}`);
  return payload.data;
};

export const fetchHealthStatus = async (): Promise<BackendHealthStatus> => {
  const payload = await request<BackendHealthStatus>('/api/health');
  return payload;
};

export const fetchAdminPlayers = async (): Promise<AdminPlayerRow[]> => {
  const payload = await request<ApiOk<AdminPlayerRow[]>>('/api/v1/admin/players');
  return payload.data;
};

export const fetchGameState = async (
  _username: string,
  villageId?: number | null,
  worldId?: string | null,
  spawnDirection?: SpawnDirection | string | null,
  options?: FetchGameStateOptions | boolean,
): Promise<GameStateResponse> => {
  const resolvedOptions: FetchGameStateOptions =
    typeof options === 'boolean' ? { includeWorldMap: options } : options ?? {};
  const params = new URLSearchParams();
  if (villageId != null && Number.isFinite(villageId)) {
    params.set('villageId', String(villageId));
  }
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  if (spawnDirection != null && String(spawnDirection).trim() !== '') {
    params.set('spawnDirection', String(spawnDirection).trim());
  }
  if (resolvedOptions.includeWorldMap != null) {
    params.set('includeWorldMap', resolvedOptions.includeWorldMap ? '1' : '0');
  }
  if (resolvedOptions.includeLeaderboard != null) {
    params.set('includeLeaderboard', resolvedOptions.includeLeaderboard ? '1' : '0');
  }
  if (resolvedOptions.includeKingdomHub != null) {
    params.set('includeKingdomHub', resolvedOptions.includeKingdomHub ? '1' : '0');
  }
  if (resolvedOptions.includeResearch != null) {
    params.set('includeResearch', resolvedOptions.includeResearch ? '1' : '0');
  }
  if (resolvedOptions.includeMarket != null) {
    params.set('includeMarket', resolvedOptions.includeMarket ? '1' : '0');
  }
  if (resolvedOptions.includeMercenaries != null) {
    params.set('includeMercenaries', resolvedOptions.includeMercenaries ? '1' : '0');
  }
  if (resolvedOptions.includeRules != null) {
    params.set('includeRules', resolvedOptions.includeRules ? '1' : '0');
  }
  const payload = await request<ApiOk<GameStateResponse>>(`/api/v1/state?${params.toString()}`);
  return payload.data;
};

export const fetchWorldMapSnapshot = async (
  _username: string,
  villageId?: number | null,
  worldId?: string | null,
  spawnDirection?: SpawnDirection | string | null,
): Promise<WorldMapSnapshotResponse> => {
  const params = new URLSearchParams();
  if (villageId != null && Number.isFinite(villageId)) {
    params.set('villageId', String(villageId));
  }
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  if (spawnDirection != null && String(spawnDirection).trim() !== '') {
    params.set('spawnDirection', String(spawnDirection).trim());
  }
  const payload = await request<ApiOk<WorldMapSnapshotResponse>>(`/api/v1/world-map?${params.toString()}`);
  return payload.data;
};

export const fetchArmyOverview = async (
  username: string,
  worldId?: string | null,
): Promise<ArmyOverviewResponse> => {
  const params = new URLSearchParams({ username });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<ArmyOverviewResponse>>(`/api/v1/army/overview?${params.toString()}`);
  return payload.data;
};

export const fetchPlannerOpen = async (
  username: string,
  worldId?: string | null,
): Promise<PlannerOpenResponse> => {
  const params = new URLSearchParams({ username });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<PlannerOpenResponse>>(`/api/v1/planner/open?${params.toString()}`);
  return payload.data;
};

export const validatePlannerPlan = async (
  payload: ValidatePlannerPlanRequest,
): Promise<PlannerValidationResponse> => {
  const response = await request<ApiOk<PlannerValidationResponse>>('/api/v1/planner/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
};

export const createPlannerPlan = async (
  payload: CreatePlannerPlanRequest,
): Promise<CreatePlannerPlanResponse> => {
  const response = await request<ApiOk<CreatePlannerPlanResponse>>('/api/v1/planner/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
};

export const updatePlannerPlan = async (
  planId: string,
  payload: UpdatePlannerPlanRequest,
): Promise<UpdatePlannerPlanResponse> => {
  const response = await request<ApiOk<UpdatePlannerPlanResponse>>(
    `/api/v1/planner/plans/${encodeURIComponent(String(planId))}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const reconfirmPlannerPlan = async (
  planId: string,
  payload: ReconfirmPlannerPlanRequest,
): Promise<ReconfirmPlannerPlanResponse> => {
  const response = await request<ApiOk<ReconfirmPlannerPlanResponse>>(
    `/api/v1/planner/plans/${encodeURIComponent(String(planId))}/reconfirm`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const cancelPlannerPlan = async (
  planId: string,
  payload: CancelPlannerPlanRequest,
): Promise<CancelPlannerPlanResponse> => {
  const response = await request<ApiOk<CancelPlannerPlanResponse>>(
    `/api/v1/planner/plans/${encodeURIComponent(String(planId))}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const fetchPlannerPlanEvents = async (
  username: string,
  worldId: string,
  planId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<PlannerPlanEventsResponse> => {
  const params = new URLSearchParams({ username, worldId });
  if (options?.limit != null && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.floor(options.limit)));
  }
  if (options?.cursor != null && String(options.cursor).trim() !== '') {
    params.set('cursor', String(options.cursor).trim());
  }
  const response = await request<ApiOk<PlannerPlanEventsResponse>>(
    `/api/v1/planner/plans/${encodeURIComponent(String(planId))}/events?${params.toString()}`,
  );
  return response.data;
};

export const upgradeBuilding = async (
  username: string,
  buildingId: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<GameStateResponse> => {
  const payload = await request<ApiOk<GameStateResponse>>(
    `/api/v1/buildings/${encodeURIComponent(buildingId)}/upgrade`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return payload.data;
};

export const recruitUnit = async (
  username: string,
  unitId: string,
  amount: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<GameStateResponse> => {
  const payload = await request<ApiOk<GameStateResponse>>(
    `/api/v1/units/${encodeURIComponent(unitId)}/recruit`,
    {
      method: 'POST',
      body: JSON.stringify({ username, amount, villageId, worldId }),
    },
  );

  return payload.data;
};

export const cancelBuildingUpgrade = async (
  username: string,
  upgradeId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: CancelBuildingUpgradeResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: CancelBuildingUpgradeResult }>(
    `/api/v1/buildings/upgrades/${encodeURIComponent(String(upgradeId))}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const cancelAllBuildingUpgrades = async (
  username: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: CancelAllBuildingUpgradesResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: CancelAllBuildingUpgradesResult }>(
    '/api/v1/buildings/upgrades/cancel-all',
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const reorderBuildingUpgradeQueue = async (
  username: string,
  upgradeId: number,
  targetIndex: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: ReorderBuildingUpgradeQueueResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: ReorderBuildingUpgradeQueueResult }>(
    '/api/v1/buildings/upgrades/reorder',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        upgradeId,
        targetIndex,
        villageId,
        worldId,
      }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const cancelRecruitment = async (
  username: string,
  recruitmentId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: CancelRecruitmentResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: CancelRecruitmentResult }>(
    `/api/v1/units/recruitments/${encodeURIComponent(String(recruitmentId))}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const recallKnight = async (
  username: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: RecallKnightResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: RecallKnightResult }>(
    '/api/v1/townhall/knight/recall',
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const conquerVillage = async (
  username: string,
  villageId: number,
  requestedVillageId?: number | null,
  worldId?: string | null,
): Promise<{ result: ConquerVillageResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: ConquerVillageResult }>(
    `/api/v1/villages/${encodeURIComponent(String(villageId))}/conquer`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId: requestedVillageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const restartVillageProgress = async (
  username: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: RestartVillageResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: RestartVillageResult }>(
    '/api/v1/villages/restart',
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const renameVillage = async (
  username: string,
  name: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: RenameVillageResult; data: GameStateResponse }> => {
  const body = JSON.stringify({ username, name, villageId, worldId });
  const candidatePaths = [
    '/api/v1/villages/rename',
    '/api/v1/villages/rename/',
    villageId != null && Number.isFinite(Number(villageId))
      ? `/api/v1/villages/${encodeURIComponent(String(villageId))}/rename`
      : null,
    villageId != null && Number.isFinite(Number(villageId))
      ? `/api/v1/villages/${encodeURIComponent(String(villageId))}/rename/`
      : null,
    villageId != null && Number.isFinite(Number(villageId))
      ? `/api/v1/village/${encodeURIComponent(String(villageId))}/rename`
      : null,
    '/api/v1/village/rename',
    '/api/v1/village/rename/',
  ].filter((path): path is string => path != null);

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      const payload = await request<ApiOk<GameStateResponse> & { result: RenameVillageResult }>(path, {
        method: 'POST',
        body,
      });
      return {
        result: payload.result,
        data: payload.data,
      };
    } catch (error) {
      lastError = error;
      if (!isHttp404Error(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('Přejmenování léna selhalo: endpoint nebyl nalezen.');
};

export const createAbandonedVillages = async (
  count = 1,
): Promise<CreateAbandonedVillagesResult> => {
  const payload = await request<{ ok: true; result: CreateAbandonedVillagesResult }>(
    '/api/v1/admin/abandoned-villages/create',
    {
      method: 'POST',
      body: JSON.stringify({ count }),
    },
  );

  return payload.result;
};

export const issueArmyCommand = async (
  username: string,
  payload: IssueArmyCommandPayload,
): Promise<{ result: IssueArmyCommandResult; data: GameStateResponse }> => {
  const requestBody = {
    username,
    villageId: payload.villageId,
    worldId: payload.worldId,
    commandType: payload.commandType,
    targetVillageId: payload.targetVillageId,
    manualTargetCoordX: payload.manualTargetCoordX,
    manualTargetCoordY: payload.manualTargetCoordY,
    supportMovementId: payload.supportMovementId,
    lootPriority: payload.lootPriority,
    units: payload.units,
  };

  const response = await request<ApiOk<GameStateResponse> & { result: IssueArmyCommandResult }>(
    '/api/v1/army/command',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
    },
  );

  return {
    result: response.result,
    data: response.data,
  };
};

export const cancelArmyCommand = async (
  username: string,
  movementId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: CancelArmyCommandResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: CancelArmyCommandResult }>(
    `/api/v1/army/command/${encodeURIComponent(String(movementId))}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const hireAcademics = async (
  username: string,
  amount = 1,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: HireAcademicsResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: HireAcademicsResult }>(
    '/api/v1/research/academics/hire',
    {
      method: 'POST',
      body: JSON.stringify({ username, amount, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const startResearchProject = async (
  username: string,
  researchId: string,
  academics = 1,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: StartResearchProjectResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: StartResearchProjectResult }>(
    '/api/v1/research/project/start',
    {
      method: 'POST',
      body: JSON.stringify({ username, researchId, academics, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const adjustResearchProjectAcademics = async (
  username: string,
  researchId: string,
  delta: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: AdjustResearchProjectAcademicsResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: AdjustResearchProjectAcademicsResult }>(
    '/api/v1/research/project/academics/adjust',
    {
      method: 'POST',
      body: JSON.stringify({ username, researchId, delta, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const hireMercenaryContract = async (
  username: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: HireMercenaryContractResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: HireMercenaryContractResult }>(
    '/api/v1/mercenaries/hire',
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const sendMarketLogistics = async (
  username: string,
  payload: {
    targetVillageId: number;
    wood?: number;
    stone?: number;
    iron?: number;
    villageId?: number | null;
    worldId?: string | null;
  },
): Promise<{ result: SendMarketLogisticsResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: SendMarketLogisticsResult }>(
    '/api/v1/market/logistics/send',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        villageId: payload.villageId ?? null,
        worldId: payload.worldId ?? null,
        targetVillageId: payload.targetVillageId,
        wood: payload.wood ?? 0,
        stone: payload.stone ?? 0,
        iron: payload.iron ?? 0,
      }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const cancelMarketLogistics = async (
  username: string,
  routeId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: CancelMarketLogisticsResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: CancelMarketLogisticsResult }>(
    `/api/v1/market/logistics/${encodeURIComponent(String(routeId))}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const configureMarketGuildAutomation = async (
  username: string,
  payload: {
    enabled?: boolean;
    targetVillageIds?: number[];
    pausedTargetVillageIds?: number[];
    villageId?: number | null;
    worldId?: string | null;
  },
): Promise<{ result: ConfigureMarketGuildAutomationResult; data: GameStateResponse }> => {
  const response = await request<ApiOk<GameStateResponse> & { result: ConfigureMarketGuildAutomationResult }>(
    '/api/v1/market/guild/configure',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        villageId: payload.villageId ?? null,
        worldId: payload.worldId ?? null,
        enabled: payload.enabled,
        targetVillageIds: payload.targetVillageIds ?? [],
        pausedTargetVillageIds: payload.pausedTargetVillageIds ?? [],
      }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const fetchBattleReports = async (
  username: string,
  page = 1,
  pageSize = 20,
  worldId?: string | null,
): Promise<BattleReportListResponse> => {
  const params = new URLSearchParams({
    username,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<BattleReportListResponse>>(`/api/v1/reports?${params.toString()}`);
  return payload.data;
};

export const fetchBattleReportById = async (
  username: string,
  reportId: number,
  worldId?: string | null,
): Promise<BattleReportItem> => {
  const params = new URLSearchParams({ username });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<BattleReportItem>>(
    `/api/v1/reports/${encodeURIComponent(String(reportId))}?${params.toString()}`,
  );
  return payload.data;
};

export const fetchBattleReportsSummary = async (
  username: string,
  worldId?: string | null,
): Promise<BattleReportSummaryResponse> => {
  const params = new URLSearchParams({ username });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<BattleReportSummaryResponse>>(`/api/v1/reports/summary?${params.toString()}`);
  return payload.data;
};

export const fetchGameActivity = async (
  username: string,
  options?: {
    page?: number;
    pageSize?: number;
    includeArchived?: boolean;
    worldId?: string | null;
  },
): Promise<GameActivityListResponse> => {
  const params = new URLSearchParams({
    username,
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 25),
  });
  if (options?.worldId != null && String(options.worldId).trim() !== '') {
    params.set('worldId', String(options.worldId).trim());
  }
  if (options?.includeArchived) {
    params.set('includeArchived', 'true');
  }
  const payload = await request<ApiOk<GameActivityListResponse>>(`/api/v1/activity?${params.toString()}`);
  return payload.data;
};

export const fetchGameActivitySummary = async (
  username: string,
  worldId?: string | null,
): Promise<GameActivitySummaryResponse> => {
  const params = new URLSearchParams({ username });
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  const payload = await request<ApiOk<GameActivitySummaryResponse>>(`/api/v1/activity/summary?${params.toString()}`);
  return payload.data;
};

export const markAllGameActivityRead = async (
  username: string,
  worldId?: string | null,
): Promise<GameActivityMutationResult> => {
  const payload = await request<{ ok: true; result: GameActivityMutationResult }>('/api/v1/activity/read-all', {
    method: 'POST',
    body: JSON.stringify({ username, worldId }),
  });
  return payload.result;
};

const mutateGameActivity = async (
  username: string,
  notificationId: number,
  action: 'read' | 'archive' | 'unarchive' | 'delete',
  worldId?: string | null,
): Promise<GameActivityMutationResult> => {
  const payload = await request<{ ok: true; result: GameActivityMutationResult }>(
    `/api/v1/activity/${encodeURIComponent(String(notificationId))}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({ username, worldId }),
    },
  );
  return payload.result;
};

export const markGameActivityRead = async (
  username: string,
  notificationId: number,
  worldId?: string | null,
): Promise<GameActivityMutationResult> => mutateGameActivity(username, notificationId, 'read', worldId);

export const archiveGameActivity = async (
  username: string,
  notificationId: number,
  worldId?: string | null,
): Promise<GameActivityMutationResult> => mutateGameActivity(username, notificationId, 'archive', worldId);

export const unarchiveGameActivity = async (
  username: string,
  notificationId: number,
  worldId?: string | null,
): Promise<GameActivityMutationResult> => mutateGameActivity(username, notificationId, 'unarchive', worldId);

export const deleteGameActivity = async (
  username: string,
  notificationId: number,
  worldId?: string | null,
): Promise<GameActivityMutationResult> => mutateGameActivity(username, notificationId, 'delete', worldId);

export const fetchCommunicationInbox = async (
  _username: string,
  options?: {
    threadId?: number | null;
    beforeMessageId?: number | null;
    threadLimit?: number | null;
    messageLimit?: number | null;
    search?: string | null;
  },
): Promise<CommunicationInboxResponse> => {
  const params = new URLSearchParams();
  if (options?.threadId != null && Number.isFinite(options.threadId) && Number(options.threadId) > 0) {
    params.set('threadId', String(Math.floor(Number(options.threadId))));
  }
  if (
    options?.beforeMessageId != null &&
    Number.isFinite(options.beforeMessageId) &&
    Number(options.beforeMessageId) > 0
  ) {
    params.set('beforeMessageId', String(Math.floor(Number(options.beforeMessageId))));
  }
  if (options?.threadLimit != null && Number.isFinite(options.threadLimit) && Number(options.threadLimit) > 0) {
    params.set('threadLimit', String(Math.floor(Number(options.threadLimit))));
  }
  if (options?.messageLimit != null && Number.isFinite(options.messageLimit) && Number(options.messageLimit) > 0) {
    params.set('messageLimit', String(Math.floor(Number(options.messageLimit))));
  }
  if (options?.search != null && String(options.search).trim() !== '') {
    params.set('search', String(options.search).trim());
  }
  const payload = await request<ApiOk<CommunicationInboxResponse>>(
    `/api/v1/communication?${params.toString()}`,
  );
  return payload.data;
};

export const fetchCommunicationSummary = async (
  username: string,
): Promise<CommunicationSummaryResponse> => {
  const params = new URLSearchParams({ username });
  const payload = await request<ApiOk<CommunicationSummaryResponse>>(
    `/api/v1/communication/summary?${params.toString()}`,
  );
  return payload.data;
};

export const openCommunicationThreadRequest = async (
  username: string,
  payload: {
    threadId?: number | null;
    targetUsername?: string | null;
  },
): Promise<{ result: OpenCommunicationThreadResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: OpenCommunicationThreadResult }>(
    '/api/v1/communication/thread/open',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        threadId: payload.threadId,
        targetUsername: payload.targetUsername,
      }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const sendCommunicationMessageRequest = async (
  username: string,
  payload: {
    threadId?: number | null;
    targetUsername?: string | null;
    body?: string;
    payload?: CommunicationMessagePayload | null;
  },
): Promise<{ result: SendCommunicationMessageResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: SendCommunicationMessageResult }>(
    '/api/v1/communication/thread/message',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        threadId: payload.threadId,
        targetUsername: payload.targetUsername,
        body: payload.body ?? '',
        payload: payload.payload ?? null,
      }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const archiveCommunicationThreadRequest = async (
  username: string,
  threadId: number,
): Promise<{ result: ArchiveCommunicationThreadResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: ArchiveCommunicationThreadResult }>(
    `/api/v1/communication/thread/${encodeURIComponent(String(threadId))}/archive`,
    {
      method: 'POST',
      body: JSON.stringify({ username }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const deleteCommunicationMessageRequest = async (
  username: string,
  messageId: number,
): Promise<{ result: DeleteCommunicationMessageResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: DeleteCommunicationMessageResult }>(
    `/api/v1/communication/message/${encodeURIComponent(String(messageId))}/delete`,
    {
      method: 'POST',
      body: JSON.stringify({ username }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const sendCommunicationFriendRequest = async (
  username: string,
  targetUsername: string,
): Promise<{ result: SendCommunicationFriendRequestResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: SendCommunicationFriendRequestResult }>(
    '/api/v1/communication/friends/request',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const respondCommunicationFriendRequest = async (
  username: string,
  requestId: number,
  action: 'accept' | 'reject',
): Promise<{ result: RespondCommunicationFriendRequestResult; data: CommunicationInboxResponse }> => {
  const response = await request<
    ApiOk<CommunicationInboxResponse> & { result: RespondCommunicationFriendRequestResult }
  >(`/api/v1/communication/friends/request/${encodeURIComponent(String(requestId))}/respond`, {
    method: 'POST',
    body: JSON.stringify({ username, action }),
  });
  return {
    result: response.result,
    data: response.data,
  };
};

export const removeCommunicationFriend = async (
  username: string,
  targetUsername: string,
): Promise<{ result: RemoveCommunicationFriendResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: RemoveCommunicationFriendResult }>(
    '/api/v1/communication/friends/remove',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const blockCommunicationPlayer = async (
  username: string,
  targetUsername: string,
): Promise<{ result: BlockCommunicationPlayerResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: BlockCommunicationPlayerResult }>(
    '/api/v1/communication/block',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const unblockCommunicationPlayer = async (
  username: string,
  targetUsername: string,
): Promise<{ result: UnblockCommunicationPlayerResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: UnblockCommunicationPlayerResult }>(
    '/api/v1/communication/unblock',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const setCommunicationAvatarRequest = async (
  username: string,
  avatarUrl: string | null,
): Promise<{ result: SetCommunicationAvatarResult; data: CommunicationInboxResponse }> => {
  const normalizedAvatar = avatarUrl == null ? null : String(avatarUrl);
  const isDataAvatar = normalizedAvatar != null && normalizedAvatar.startsWith('data:image/');
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: SetCommunicationAvatarResult }>(
    '/api/v1/communication/avatar',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        avatarUrl: isDataAvatar ? null : normalizedAvatar,
        avatarDataUrl: isDataAvatar ? normalizedAvatar : null,
      }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const setCommunicationUiStateRequest = async (
  username: string,
  state: Record<string, unknown>,
): Promise<{ result: SetCommunicationUiStateResult; data: CommunicationInboxResponse }> => {
  const response = await request<ApiOk<CommunicationInboxResponse> & { result: SetCommunicationUiStateResult }>(
    '/api/v1/communication/ui-state',
    {
      method: 'POST',
      body: JSON.stringify({ username, state }),
    },
  );
  return {
    result: response.result,
    data: response.data,
  };
};

export const fetchCommunicationTokenSuggestions = async (
  username: string,
  payload: {
    tokenType: 'user' | 'kingdom' | 'village';
    query: string;
    limit?: number;
  },
): Promise<CommunicationTokenSuggestionsResponse> => {
  const params = new URLSearchParams({
    username,
    tokenType: payload.tokenType,
    query: payload.query,
  });
  if (payload.limit != null && Number.isFinite(payload.limit) && payload.limit > 0) {
    params.set('limit', String(Math.floor(payload.limit)));
  }
  const response = await request<ApiOk<CommunicationTokenSuggestionsResponse>>(
    `/api/v1/communication/suggestions?${params.toString()}`,
  );
  return response.data;
};

export const createCommunicationNotificationShare = async (
  username: string,
  payload: {
    notificationId: number;
    worldId?: string | null;
  },
): Promise<CommunicationNotificationShareCreateResult> => {
  const response = await request<{ ok: true; result: CommunicationNotificationShareCreateResult }>(
    '/api/v1/communication/notification/share',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        notificationId: payload.notificationId,
        worldId: payload.worldId ?? null,
      }),
    },
  );
  return response.result;
};

export const fetchCommunicationNotificationSharePreview = async (
  username: string,
  shareToken: string,
): Promise<CommunicationNotificationSharePreview> => {
  const params = new URLSearchParams({ username });
  const response = await request<ApiOk<CommunicationNotificationSharePreview>>(
    `/api/v1/communication/notification/share/${encodeURIComponent(shareToken)}?${params.toString()}`,
  );
  return response.data;
};

export const createKingdom = async (
  username: string,
  kingdomName: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomCreateResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomCreateResult }>(
    '/api/v1/kingdom/create',
    {
      method: 'POST',
      body: JSON.stringify({ username, kingdomName, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const invitePlayerToKingdom = async (
  username: string,
  targetUsername: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomInviteResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomInviteResult }>(
    '/api/v1/kingdom/invite',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const acceptKingdomInvite = async (
  username: string,
  inviteId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomInviteAcceptResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomInviteAcceptResult }>(
    `/api/v1/kingdom/invite/${encodeURIComponent(String(inviteId))}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const rejectKingdomInvite = async (
  username: string,
  inviteId: number,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomInviteRejectResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomInviteRejectResult }>(
    `/api/v1/kingdom/invite/${encodeURIComponent(String(inviteId))}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const leaveKingdom = async (
  username: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomLeaveResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomLeaveResult }>(
    '/api/v1/kingdom/leave',
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const kickKingdomMember = async (
  username: string,
  targetUsername: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomKickResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomKickResult }>(
    '/api/v1/kingdom/kick',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const transferKingdomLeadership = async (
  username: string,
  targetUsername: string,
  villageId?: number | null,
  worldId?: string | null,
): Promise<{ result: KingdomTransferLeadershipResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: KingdomTransferLeadershipResult }>(
    '/api/v1/kingdom/transfer-leadership',
    {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername, villageId, worldId }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};
