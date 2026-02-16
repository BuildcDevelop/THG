type ResourceCost = {
  wood: number;
  stone: number;
  iron: number;
};

export type LootPriority = 'wood' | 'stone' | 'iron';

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
};

export type GameStateResponse = {
  serverTime: string;
  player: {
    id: number;
    username: string;
  };
  villages: {
    id: number;
    name: string;
    coordX: number;
    coordY: number;
    region: number;
    kingdom: string;
    prestige: number;
    loyalty: number;
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
  };
  world: {
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
    id: number;
    name: string;
    kingdom: string;
    coordX: number;
    coordY: number;
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

export type BattleReportPayload = {
  perspective?: 'attacker' | 'defender';
  role?: 'support';
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
  armyDestroyed?: boolean;
  attackerForcesUnknown?: boolean;
  lootPriority?: LootPriority;
  lootTaken?: {
    wood: number;
    stone: number;
    iron: number;
  };
  support?: {
    start?: Record<string, number>;
    losses?: Record<string, number>;
    survivors?: Record<string, number>;
    survivorsTotal?: number;
  };
  battle?: {
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

export type ArmyCommandType = 'attack' | 'support' | 'move' | 'return';

export type IssueArmyCommandPayload = {
  commandType: ArmyCommandType;
  villageId?: number | null;
  targetVillageId?: number;
  supportMovementId?: number;
  lootPriority?: LootPriority;
  units?: Partial<Record<'militia' | 'archer' | 'cavalry' | 'ram' | 'caravan', number>>;
};

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

const baseUrl = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
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

export const loginRequest = async (username: string, password: string): Promise<LoginResponse> => {
  const payload = await request<ApiOk<LoginResponse>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  return payload.data;
};

export const fetchAdminPlayers = async (): Promise<AdminPlayerRow[]> => {
  const payload = await request<ApiOk<AdminPlayerRow[]>>('/api/v1/admin/players');
  return payload.data;
};

export const fetchGameState = async (
  username: string,
  villageId?: number | null,
): Promise<GameStateResponse> => {
  const params = new URLSearchParams({ username });
  if (villageId != null && Number.isFinite(villageId)) {
    params.set('villageId', String(villageId));
  }
  const payload = await request<ApiOk<GameStateResponse>>(`/api/v1/state?${params.toString()}`);
  return payload.data;
};

export const upgradeBuilding = async (
  username: string,
  buildingId: string,
  villageId?: number | null,
): Promise<GameStateResponse> => {
  const payload = await request<ApiOk<GameStateResponse>>(
    `/api/v1/buildings/${encodeURIComponent(buildingId)}/upgrade`,
    {
      method: 'POST',
      body: JSON.stringify({ username, villageId }),
    },
  );

  return payload.data;
};

export const recruitUnit = async (
  username: string,
  unitId: string,
  amount: number,
  villageId?: number | null,
): Promise<GameStateResponse> => {
  const payload = await request<ApiOk<GameStateResponse>>(
    `/api/v1/units/${encodeURIComponent(unitId)}/recruit`,
    {
      method: 'POST',
      body: JSON.stringify({ username, amount, villageId }),
    },
  );

  return payload.data;
};

export const conquerVillage = async (
  username: string,
  villageId: number,
): Promise<{ result: ConquerVillageResult; data: GameStateResponse }> => {
  const payload = await request<ApiOk<GameStateResponse> & { result: ConquerVillageResult }>(
    `/api/v1/villages/${encodeURIComponent(String(villageId))}/conquer`,
    {
      method: 'POST',
      body: JSON.stringify({ username }),
    },
  );

  return {
    result: payload.result,
    data: payload.data,
  };
};

export const issueArmyCommand = async (
  username: string,
  payload: IssueArmyCommandPayload,
): Promise<{ result: unknown; data: GameStateResponse }> => {
  const requestBody = {
    username,
    villageId: payload.villageId,
    commandType: payload.commandType,
    targetVillageId: payload.targetVillageId,
    supportMovementId: payload.supportMovementId,
    lootPriority: payload.lootPriority,
    units: payload.units,
  };

  const response = await request<ApiOk<GameStateResponse> & { result: unknown }>('/api/v1/army/command', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  return {
    result: response.result,
    data: response.data,
  };
};

export const fetchBattleReports = async (
  username: string,
  page = 1,
  pageSize = 20,
): Promise<BattleReportListResponse> => {
  const params = new URLSearchParams({
    username,
    page: String(page),
    pageSize: String(pageSize),
  });
  const payload = await request<ApiOk<BattleReportListResponse>>(`/api/v1/reports?${params.toString()}`);
  return payload.data;
};
