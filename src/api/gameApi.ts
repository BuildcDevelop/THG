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

export type GameStateResponse = {
  serverTime: string;
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
    cap: number;
    productionPerHour: {
      wood: number;
      stone: number;
      iron: number;
      penalty: number;
    };
    developerBoost: DeveloperResourceBoostState;
  };
  population: {
    used: number;
    cap: number;
    available: number;
  };
  buildings: GameBuildingState[];
  units: GameUnitState[];
  leaderboard: LeaderboardRow[];
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
  };
  activeOrders: string[];
  limits: {
    maxBuildingLevel: number;
    maxUnitCount: number | null;
  };
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
  totalCost?: ResourceCost;
  lootPriority?: LootPriority | null;
};

export type CancelBuildingUpgradeResult = {
  canceledUpgradeId: number;
  buildingId: string;
  canceledCount: number;
  refunded: ResourceCost;
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
  username: string,
  villageId?: number | null,
  worldId?: string | null,
  spawnDirection?: SpawnDirection | string | null,
): Promise<GameStateResponse> => {
  const params = new URLSearchParams({ username });
  if (villageId != null && Number.isFinite(villageId)) {
    params.set('villageId', String(villageId));
  }
  if (worldId != null && String(worldId).trim() !== '') {
    params.set('worldId', String(worldId).trim());
  }
  if (spawnDirection != null && String(spawnDirection).trim() !== '') {
    params.set('spawnDirection', String(spawnDirection).trim());
  }
  const payload = await request<ApiOk<GameStateResponse>>(`/api/v1/state?${params.toString()}`);
  return payload.data;
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
  username: string,
  options?: {
    threadId?: number | null;
    beforeMessageId?: number | null;
    threadLimit?: number | null;
    messageLimit?: number | null;
    search?: string | null;
  },
): Promise<CommunicationInboxResponse> => {
  const params = new URLSearchParams({ username });
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
