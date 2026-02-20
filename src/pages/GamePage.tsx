import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, logout } from '../auth';
import {
  acceptKingdomInvite as acceptKingdomInviteRequest,
  cancelBuildingUpgrade as cancelBuildingUpgradeRequest,
  cancelRecruitment as cancelRecruitmentRequest,
  createKingdom as createKingdomRequest,
  fetchBattleReports,
  fetchGameState,
  invitePlayerToKingdom as invitePlayerToKingdomRequest,
  issueArmyCommand,
  kickKingdomMember as kickKingdomMemberRequest,
  leaveKingdom as leaveKingdomRequest,
  rejectKingdomInvite as rejectKingdomInviteRequest,
  recallKnight as recallKnightRequest,
  recruitUnit,
  restartVillageProgress as restartVillageProgressRequest,
  upgradeBuilding,
  type ArmyCommandType,
  type BattleReportItem,
  type ArmyMovementState,
  type BattleReportListResponse,
  type BattleReportPayload,
  type GameBuildingState,
  type GameStateResponse,
  type GameUnitState,
  type KingdomHubState,
  type KingdomIncomingInvite,
  type KingdomAvailableSummary,
  type KingdomAuditLogEntry,
  type LeaderboardRow,
  type LootPriority,
} from '../api/gameApi';

type PanelType =
  | 'city'
  | 'map'
  | 'army'
  | 'research'
  | 'messages'
  | 'battleReport'
  | 'kingdom'
  | 'rankings'
  | 'profile'
  | 'settings'
  | 'kingdomProfile'
  | 'playerProfile'
  | 'village'
  | 'building';

type StaticPanelType = Exclude<PanelType, 'village' | 'building' | 'battleReport'>;

type PinSide = 'left' | 'right';

type SettlementKind = 'own' | 'player' | 'bot' | 'abandoned';
type MapSettlementKind = SettlementKind | 'active';

type RegionSettlement = {
  id: string;
  villageId?: number;
  name: string;
  kind: SettlementKind;
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
  visibility?: 'full' | 'public';
  relation?: 'self' | 'ally' | 'enemy';
};

type SettlementOrderMarkerCounts = {
  attack: number;
  support: number;
  move: number;
  knightAttack: number;
};

type PanelMeta = {
  type: PanelType;
  label: string;
  side: PinSide;
  width: number;
  height: number;
};

type PanelWindow = PanelMeta & {
  id: string;
  settlementId?: string;
  buildingId?: string;
  battleReportId?: number;
  villageName?: string;
  kingdomName?: string;
  playerUsername?: string;
  x: number;
  y: number;
  z: number;
  expanded: boolean;
  alert: boolean;
};

type ResourceStock = {
  name: string;
  amount: number;
  delta: string;
  cap: number;
  buildingId: string;
};

type ResourceCost = {
  wood: number;
  stone: number;
  iron: number;
};

type Building = {
  id: string;
  name: string;
  icon: string;
  level: number;
  category: string;
  workers: string;
  effect: string;
  nextCostRaw: ResourceCost | null;
  nextCost: string;
  nextTime: string;
  canUpgrade: boolean;
  blockedReason: string | null;
  isInProgress: boolean;
  remainingSec: number | null;
};

type Unit = {
  id: string;
  name: string;
  amount: number;
  queuedCount: number;
  stationedSupportCount: number;
  role: string;
  cost: string;
  requiredBuildingId: string;
  requiredBuildingLevel: number;
  canRecruit: boolean;
  blockedReason: string | null;
  maxRecruitable: number;
};

type RecruitQueueOrder = {
  id: number;
  unitId: string;
  unitName: string;
  amount: number;
  remainingSec: number;
  finishAt: string;
};

type BuildingUpgradeQueueOrder = {
  id: number;
  buildingId: string;
  fromLevel: number;
  toLevel: number;
  remainingSec: number;
  finishAt: string;
};

type RankingMode = 'players' | 'kingdoms';
type RankingPageSize = 20 | 50;

type KingdomLeaderboardRow = {
  rank: number;
  kingdom: string;
  prestige: number;
  villages: number;
  members: number;
};

type ResearchTask = {
  name: string;
  progress: number;
  eta: string;
  academics: number;
};

type DragState = {
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  latestX: number;
  latestY: number;
  panelWidth: number;
  panelHeight: number;
  rafId: number | null;
};

type ResizeState = {
  id: string;
  panelType: PanelType;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
  latestWidth: number;
  latestHeight: number;
  minWidth: number;
  minHeight: number;
  panelX: number;
  panelY: number;
  rafId: number | null;
};

type WindowSize = {
  width: number;
  height: number;
};

type VillageMenuPosition = {
  left: number;
  top: number;
  width: number;
};

type PersistedPanelWindow = Pick<
  PanelWindow,
  | 'id'
  | 'type'
  | 'label'
  | 'side'
  | 'width'
  | 'height'
  | 'x'
  | 'y'
  | 'z'
  | 'expanded'
  | 'alert'
  | 'settlementId'
  | 'buildingId'
  | 'battleReportId'
  | 'villageName'
  | 'kingdomName'
  | 'playerUsername'
>;

const PANEL_META: Record<PanelType, PanelMeta> = {
  city: {
    type: 'city',
    label: 'Přehled léna',
    side: 'left',
    width: 1280,
    height: 660,
  },
  map: {
    type: 'map',
    label: 'Mapa regionu',
    side: 'left',
    width: 900,
    height: 660,
  },
  army: {
    type: 'army',
    label: 'Armáda a nábor',
    side: 'left',
    width: 520,
    height: 470,
  },
  research: {
    type: 'research',
    label: 'Výzkum',
    side: 'right',
    width: 500,
    height: 470,
  },
  messages: {
    type: 'messages',
    label: 'Zprávy',
    side: 'right',
    width: 480,
    height: 430,
  },
  battleReport: {
    type: 'battleReport',
    label: 'Bitevní hlášení',
    side: 'right',
    width: 760,
    height: 620,
  },
  kingdom: {
    type: 'kingdom',
    label: 'Království',
    side: 'right',
    width: 520,
    height: 460,
  },
  rankings: {
    type: 'rankings',
    label: 'Žebříček',
    side: 'right',
    width: 820,
    height: 540,
  },
  profile: {
    type: 'profile',
    label: 'Profil',
    side: 'left',
    width: 460,
    height: 420,
  },
  settings: {
    type: 'settings',
    label: 'Nastavení',
    side: 'left',
    width: 420,
    height: 390,
  },
  kingdomProfile: {
    type: 'kingdomProfile',
    label: 'Profil království',
    side: 'right',
    width: 660,
    height: 560,
  },
  playerProfile: {
    type: 'playerProfile',
    label: 'Profil hráče',
    side: 'left',
    width: 640,
    height: 560,
  },
  village: {
    type: 'village',
    label: 'Profil osady',
    side: 'right',
    width: 500,
    height: 480,
  },
  building: {
    type: 'building',
    label: 'Detail budovy',
    side: 'left',
    width: 520,
    height: 520,
  },
};

const NAV_BUTTONS: { type: StaticPanelType; text: string }[] = [
  { type: 'city', text: 'Přehled léna' },
  { type: 'map', text: 'Mapa regionu' },
  { type: 'army', text: 'Armáda/Nábor' },
  { type: 'research', text: 'Výzkum' },
  { type: 'messages', text: 'Zprávy' },
  { type: 'kingdom', text: 'Království' },
  { type: 'rankings', text: 'Žebříček' },
  { type: 'profile', text: 'Profil' },
  { type: 'settings', text: 'Nastavení' },
];

const DEFAULT_STRETCHED_PANEL_TYPES = new Set<StaticPanelType>([
  'city',
  'map',
  'army',
  'research',
  'messages',
  'kingdom',
  'profile',
  'settings',
]);

const isStretchablePanelType = (panelType: PanelType): boolean => {
  void panelType;
  return true;
};
const BUILDING_ICON_BASE_PATH = '/assets/buildings';
const getBuildingIconPath = (fileName: string): string => `${BUILDING_ICON_BASE_PATH}/${fileName}`;
const DEFAULT_BUILDING_ICON = getBuildingIconPath('warehouse.png');
const UNIT_ICON_BASE_PATH = '/assets/units';
const getUnitIconPath = (fileName: string): string => `${UNIT_ICON_BASE_PATH}/${fileName}`;
const DEFAULT_UNIT_ICON = getUnitIconPath('militia.svg');

const BUILDING_ART: Record<string, { icon: string; fallbackName: string; fallbackCategory: string }> = {
  woodcutter: {
    icon: getBuildingIconPath('woodcutter.png'),
    fallbackName: 'Dřevorubec',
    fallbackCategory: 'Produkce',
  },
  quarry: {
    icon: getBuildingIconPath('quarry.png'),
    fallbackName: 'Kamenolom',
    fallbackCategory: 'Produkce',
  },
  'iron-mine': {
    icon: getBuildingIconPath('iron-mine.png'),
    fallbackName: 'Železný důl',
    fallbackCategory: 'Produkce',
  },
  warehouse: {
    icon: getBuildingIconPath('warehouse.png'),
    fallbackName: 'Sklad surovin',
    fallbackCategory: 'Podpora',
  },
  barracks: {
    icon: getBuildingIconPath('barracks.png'),
    fallbackName: 'Kasárna',
    fallbackCategory: 'Vojenské',
  },
  stable: {
    icon: getBuildingIconPath('stable.png'),
    fallbackName: 'Stáje',
    fallbackCategory: 'Vojenské',
  },
  workshop: {
    icon: getBuildingIconPath('workshop.png'),
    fallbackName: 'Dílna',
    fallbackCategory: 'Vojenské',
  },
  fortification: {
    icon: getBuildingIconPath('fortification.png'),
    fallbackName: 'Opevnění',
    fallbackCategory: 'Obrana',
  },
  gate: {
    icon: getBuildingIconPath('gate.png'),
    fallbackName: 'Brána',
    fallbackCategory: 'Obrana',
  },
  townhall: {
    icon: getBuildingIconPath('townhall.png'),
    fallbackName: 'Radnice',
    fallbackCategory: 'Administrativa',
  },
  university: {
    icon: getBuildingIconPath('university.png'),
    fallbackName: 'Univerzita',
    fallbackCategory: 'Administrativa',
  },
  'residential-quarter': {
    icon: getBuildingIconPath('residential-quarter.png'),
    fallbackName: 'Obytná čtvrť',
    fallbackCategory: 'Podpora',
  },
};

const UNIT_META: Record<string, { fallbackName: string; fallbackRole: string; icon: string }> = {
  militia: {
    fallbackName: 'Ozbrojenci',
    fallbackRole: 'Základní pěchota',
    icon: getUnitIconPath('militia.svg'),
  },
  archer: {
    fallbackName: 'Lučištníci',
    fallbackRole: 'Obrana hradeb',
    icon: getUnitIconPath('archer.svg'),
  },
  cavalry: {
    fallbackName: 'Jezdci',
    fallbackRole: 'Rychlý útok',
    icon: getUnitIconPath('cavalry.svg'),
  },
  knight: {
    fallbackName: 'Rytíř',
    fallbackRole: 'Dobytel osad',
    icon: getUnitIconPath('knight.svg'),
  },
  ram: {
    fallbackName: 'Beranidla',
    fallbackRole: 'Prolomení brány',
    icon: getUnitIconPath('ram.svg'),
  },
  caravan: {
    fallbackName: 'Karavany',
    fallbackRole: 'Převoz kořisti',
    icon: getUnitIconPath('caravan.svg'),
  },
};
const getUnitMetaById = (unitId: string): { fallbackName: string; fallbackRole: string; icon: string } => {
  const meta = UNIT_META[unitId];
  if (meta) {
    return meta;
  }
  return {
    fallbackName: unitId,
    fallbackRole: 'Jednotka',
    icon: DEFAULT_UNIT_ICON,
  };
};
const COMMAND_UNIT_ORDER = ['militia', 'archer', 'cavalry', 'knight', 'ram', 'caravan'] as const;
type CommandUnitId = (typeof COMMAND_UNIT_ORDER)[number];
const UNIT_ATTACK_POWER: Record<CommandUnitId, number> = {
  militia: 12,
  archer: 8,
  cavalry: 17,
  knight: 340,
  ram: 7,
  caravan: 0,
};
const UNIT_DEFENSE_POWER: Record<CommandUnitId, number> = {
  militia: 12,
  archer: 14,
  cavalry: 9,
  knight: 280,
  ram: 7,
  caravan: 0,
};
const RAM_ATTACK_BONUS_MULTIPLIER = 1.1;
const CARAVAN_LOOT_CAPACITY = 250;

const ARMY_COMMAND_LABELS: Record<ArmyCommandType, string> = {
  attack: 'Útok',
  support: 'Podpora',
  move: 'Přesun',
  return: 'Návrat',
};
const LOOT_PRIORITY_LABELS: Record<LootPriority, string> = {
  wood: 'Dřevo',
  stone: 'Kámen',
  iron: 'Železo',
};

const RESOURCE_COST_TYPES: (keyof ResourceCost)[] = ['wood', 'stone', 'iron'];

const CITY_OVERVIEW_GROUPS: {
  id: string;
  label: string;
  subtitle: string;
  buildingIds: string[];
}[] = [
  {
    id: 'capital',
    label: 'Hlavní město',
    subtitle: 'Správa, zásoby a populace',
    buildingIds: ['townhall', 'warehouse', 'residential-quarter', 'university'],
  },
  {
    id: 'economy',
    label: 'Infrastruktura',
    subtitle: 'Produkce základních surovin',
    buildingIds: ['woodcutter', 'quarry', 'iron-mine'],
  },
  {
    id: 'military',
    label: 'Vojenský okruh',
    subtitle: 'Nábor a rozšíření armády',
    buildingIds: ['barracks', 'stable', 'workshop'],
  },
  {
    id: 'defense',
    label: 'Obrana',
    subtitle: 'Pevnostní a vstupní prvky',
    buildingIds: ['fortification', 'gate'],
  },
];

type MapOrderCommandType = 'attack' | 'support' | 'move';
type ArmyCommandSelectableType = Extract<ArmyCommandType, MapOrderCommandType>;
type ArmyTargetHistoryByVillageId = Record<string, Partial<Record<MapOrderCommandType, number>>>;
type ArmyQuickSelection = {
  requestId: number;
  commandType: ArmyCommandSelectableType;
  targetVillageId: number;
};

const MAP_ORDER_ICON_LABELS: Record<MapOrderCommandType, string> = {
  attack: 'Útok',
  support: 'Podpora',
  move: 'Přesun',
};

const MAP_ORDER_COMMAND_TYPES: MapOrderCommandType[] = ['attack', 'support', 'move'];

const getArmyCommandSymbol = (commandType: ArmyCommandType | MapOrderCommandType): string => {
  if (commandType === 'attack') {
    return '⌖';
  }
  if (commandType === 'support') {
    return '🛡';
  }
  if (commandType === 'move') {
    return '➜';
  }
  return '↩';
};

const parseArmyOrderCommandType = (order: string): ArmyCommandType | null => {
  const normalized = order.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (!normalized.includes('armada:')) {
    return null;
  }
  if (normalized.includes('utok')) {
    return 'attack';
  }
  if (normalized.includes('podpora')) {
    return 'support';
  }
  if (normalized.includes('presun')) {
    return 'move';
  }
  if (normalized.includes('navrat')) {
    return 'return';
  }
  return null;
};

const normalizeRecruitBlockedReason = (blockedReason: string | null): string =>
  (blockedReason ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const isBlockedByRecruitRule = (unit: Pick<Unit, 'canRecruit' | 'blockedReason'>): boolean => {
  if (unit.canRecruit || !unit.blockedReason) {
    return false;
  }

  const normalizedReason = normalizeRecruitBlockedReason(unit.blockedReason);
  return normalizedReason.startsWith('vybuduj ') || normalizedReason.includes('limit rytiru');
};

const buildSelectedUnitsFromDraft = (
  units: Unit[],
  draftUnitAmounts: Record<string, string>,
  options?: { excludeCaravan?: boolean },
): Record<CommandUnitId, number> => {
  const selectedUnits = {} as Record<CommandUnitId, number>;
  for (const unitId of COMMAND_UNIT_ORDER) {
    selectedUnits[unitId] = 0;
  }

  for (const unit of units) {
    if (!COMMAND_UNIT_ORDER.includes(unit.id as CommandUnitId)) {
      continue;
    }
    if (options?.excludeCaravan && unit.id === 'caravan') {
      continue;
    }
    const rawValue = Number(draftUnitAmounts[unit.id] ?? 0);
    if (!Number.isInteger(rawValue) || rawValue <= 0) {
      continue;
    }
    selectedUnits[unit.id as CommandUnitId] = Math.min(unit.amount, rawValue);
  }

  return selectedUnits;
};

const calculateTotalUnitsInSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0), 0);

const calculateAttackPowerFromSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0) * UNIT_ATTACK_POWER[unitId], 0);

const calculateDefensePowerFromSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0) * UNIT_DEFENSE_POWER[unitId], 0);

const FALLBACK_ACTIVE_ORDERS = [
  'Výstavba: žádná aktivní fronta',
  'Ekonomika běží na backend cron tiku.',
  'Nábor a upgrady zapisují změny do databáze.',
];

const RESEARCH_TASKS: ResearchTask[] = [
  { name: 'Střelba I', progress: 62, eta: '1d 6h', academics: 2 },
  { name: 'Jezdectví I', progress: 24, eta: '3d 4h', academics: 1 },
  { name: 'Logistika', progress: 91, eta: '4h 20m', academics: 1 },
];

const RANKING_FALLBACK: LeaderboardRow[] = [];
const EMPTY_KINGDOM_AVAILABLE: KingdomAvailableSummary[] = [];
const EMPTY_KINGDOM_INVITES: KingdomIncomingInvite[] = [];
const EMPTY_KINGDOM_MEMBERS: KingdomHubState['members'] = [];
const EMPTY_KINGDOM_AUDIT_LOG: KingdomAuditLogEntry[] = [];

const REGION_SIZE = 50;
const REGION_ORIGIN_X = 200;
const REGION_ORIGIN_Y = 430;
const REGION_CELL_SIZE = 25;
const MAP_ZOOM_MIN = -50;
const MAP_ZOOM_MAX = 50;
const MAP_ZOOM_STEP = 10;
const MAP_WINDOW_SIZE_STORAGE_KEY = 'thg_map_window_size';
const PANEL_LAYOUT_STORAGE_KEY_PREFIX = 'thg_panel_layout';
const LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX = 'thg_last_own_settlement';
const MAP_ZOOM_STORAGE_KEY_PREFIX = 'thg_map_zoom';
const ACTIVE_VILLAGE_STORAGE_KEY_PREFIX = 'thg_active_village';
const ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX = 'thg_army_target_history';
const MAP_WINDOW_MIN_WIDTH = 620;
const MAP_WINDOW_MIN_HEIGHT = 460;
const STATE_POLL_INTERVAL_MS = 7000;
const REPORTS_POLL_INTERVAL_MS = 7000;
const PANEL_DEFAULT_MIN_WIDTH = 360;
const PANEL_DEFAULT_MIN_HEIGHT = 280;
const PANEL_CITY_MIN_WIDTH = 1080;
const PANEL_CITY_MIN_HEIGHT = 600;
const PANEL_ARMY_MIN_WIDTH = 760;
const PANEL_ARMY_MIN_HEIGHT = 520;
const PANEL_VIEWPORT_MARGIN_X = 32;
const PANEL_VIEWPORT_MARGIN_Y = 56;
const PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH = 280;
const PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT = 220;

const REGION_SETTLEMENTS: RegionSettlement[] = [
  {
    id: 'vlg-hradisko',
    name: 'Hradisko',
    kind: 'own',
    owner: 'Ty',
    kingdom: 'Železná Liga',
    region: 1,
    localX: 14,
    localY: 26,
    globalX: 213,
    globalY: 455,
    prestige: 7420,
    loyalty: 100,
    note: 'Hlavní město hráče',
  },
  {
    id: 'vlg-ticha',
    name: 'Tichá osada',
    kind: 'bot',
    owner: 'Královská osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 20,
    localY: 22,
    globalX: 219,
    globalY: 451,
    prestige: 1210,
    loyalty: 100,
    note: 'PvE cíl vhodný pro farmení',
  },
  {
    id: 'vlg-popel',
    name: 'Popelavý brod',
    kind: 'abandoned',
    owner: 'Opuštěná osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 11,
    localY: 31,
    globalX: 210,
    globalY: 460,
    prestige: 640,
    loyalty: 100,
    note: 'Nízká obrana, vysoký loot potenciál',
  },
  {
    id: 'vlg-kaleb',
    name: 'Kalebova tvrz',
    kind: 'player',
    owner: 'Kaleb',
    kingdom: 'Železná Liga',
    region: 1,
    localX: 18,
    localY: 27,
    globalX: 217,
    globalY: 456,
    prestige: 7010,
    loyalty: 100,
    note: 'Spojenecká obranná linie',
  },
  {
    id: 'vlg-aria',
    name: 'Aria Keep',
    kind: 'player',
    owner: 'Aria',
    kingdom: 'Železná Liga',
    region: 1,
    localX: 23,
    localY: 18,
    globalX: 222,
    globalY: 447,
    prestige: 12820,
    loyalty: 100,
    note: 'Silná ekonomická osada',
  },
  {
    id: 'vlg-varden',
    name: 'Varden Hold',
    kind: 'player',
    owner: 'Varden',
    kingdom: 'Železná Liga',
    region: 1,
    localX: 17,
    localY: 34,
    globalX: 216,
    globalY: 463,
    prestige: 6890,
    loyalty: 100,
    note: 'Krátká doba podpory na jižní křídlo',
  },
  {
    id: 'vlg-mira',
    name: 'Mirašín',
    kind: 'player',
    owner: 'Mira',
    kingdom: 'Stínová Koruna',
    region: 1,
    localX: 34,
    localY: 19,
    globalX: 233,
    globalY: 448,
    prestige: 6340,
    loyalty: 100,
    note: 'Konkurenční klan na východě',
  },
  {
    id: 'vlg-horska',
    name: 'Horská hlídka',
    kind: 'bot',
    owner: 'Královská osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 31,
    localY: 12,
    globalX: 230,
    globalY: 441,
    prestige: 1800,
    loyalty: 100,
    note: 'Silnější PvE osada s hradbami',
  },
  {
    id: 'vlg-brod',
    name: 'Stříbrný brod',
    kind: 'abandoned',
    owner: 'Opuštěná osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 28,
    localY: 30,
    globalX: 227,
    globalY: 459,
    prestige: 540,
    loyalty: 100,
    note: 'Dobrá zásobárna železa',
  },
  {
    id: 'vlg-trznice',
    name: 'Tržní dvůr',
    kind: 'player',
    owner: 'Elandor',
    kingdom: 'Stínová Koruna',
    region: 1,
    localX: 37,
    localY: 26,
    globalX: 236,
    globalY: 455,
    prestige: 5920,
    loyalty: 100,
    note: 'Obchodní uzel nepřátelského klanu',
  },
  {
    id: 'vlg-kotlina',
    name: 'Kotlina',
    kind: 'bot',
    owner: 'Královská osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 9,
    localY: 16,
    globalX: 208,
    globalY: 445,
    prestige: 970,
    loyalty: 100,
    note: 'Rychlý nájezd na dřevo',
  },
  {
    id: 'vlg-step',
    name: 'Šeptající step',
    kind: 'abandoned',
    owner: 'Opuštěná osada',
    kingdom: 'Neutral',
    region: 1,
    localX: 40,
    localY: 36,
    globalX: 239,
    globalY: 465,
    prestige: 410,
    loyalty: 100,
    note: 'Nízké riziko, nízká obrana',
  },
];

const settlementKindLabel: Record<MapSettlementKind, string> = {
  active: 'Aktuální osada',
  own: 'Moje osada',
  player: 'Osada hráče',
  bot: 'Královská osada',
  abandoned: 'Opuštěná osada',
};

const VILLAGE_SCOPED_BUILDING_IDS = new Set<string>([
  'woodcutter',
  'quarry',
  'iron-mine',
  'warehouse',
  'barracks',
  'stable',
  'workshop',
  'fortification',
  'gate',
  'townhall',
  'university',
  'residential-quarter',
]);

const hasVillageContext = (panel: Pick<PanelWindow, 'type' | 'buildingId'>): boolean => {
  if (panel.type === 'city' || panel.type === 'map' || panel.type === 'army') {
    return true;
  }

  if (panel.type === 'building' && panel.buildingId) {
    return VILLAGE_SCOPED_BUILDING_IDS.has(panel.buildingId);
  }

  return false;
};

const getSettlementMapKind = (
  settlement: Pick<RegionSettlement, 'kind' | 'relation' | 'owner' | 'villageId'>,
  activeVillageId: number | null = null,
): MapSettlementKind => {
  const ownerNormalized = settlement.owner.trim().toLowerCase();
  const isAbandonedSettlement =
    settlement.kind === 'abandoned' ||
    ownerNormalized === 'opuštěná osada' ||
    ownerNormalized === 'opustena osada';
  if (isAbandonedSettlement) {
    return 'abandoned';
  }

  const isOwnSettlement = settlement.kind === 'own' || settlement.relation === 'self';
  if (
    activeVillageId != null &&
    settlement.villageId != null &&
    Number(settlement.villageId) === activeVillageId &&
    isOwnSettlement
  ) {
    return 'active';
  }

  if (isOwnSettlement) {
    return 'own';
  }

  if (settlement.kind === 'bot' || (settlement.kind === 'player' && settlement.relation === 'ally')) {
    return 'bot';
  }

  return 'player';
};

const canTargetSettlementForArmyCommand = ({
  settlement,
  commandType,
  currentVillageId,
  currentUsername,
}: {
  settlement: Pick<RegionSettlement, 'villageId' | 'owner' | 'relation'>;
  commandType: ArmyCommandSelectableType;
  currentVillageId: number | null;
  currentUsername: string;
}): boolean => {
  const targetVillageId =
    settlement.villageId != null && Number.isFinite(settlement.villageId)
      ? Number(settlement.villageId)
      : null;
  if (targetVillageId == null) {
    return false;
  }

  if (currentVillageId != null && targetVillageId === currentVillageId) {
    return false;
  }

  const normalizedCurrentUsername = currentUsername.trim().toLowerCase();
  const normalizedOwner = settlement.owner.trim().toLowerCase();
  const isOwnSettlement = settlement.relation === 'self' || normalizedOwner === normalizedCurrentUsername;
  const isAlliedSettlement = settlement.relation === 'ally';

  if (commandType === 'move') {
    return isOwnSettlement;
  }

  if (commandType === 'support') {
    return isOwnSettlement || isAlliedSettlement;
  }

  return !isOwnSettlement && !isAlliedSettlement;
};

const isNeutralKingdom = (kingdom: string): boolean => {
  const normalized = kingdom.trim().toLowerCase();
  return (
    normalized === 'neutral' || normalized === 'kralovska osada' || normalized === 'královská osada'
  );
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const calculateCellDistance = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number => Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));

const getPanelMinSize = (type: PanelType): WindowSize => {
  if (type === 'map') {
    return { width: MAP_WINDOW_MIN_WIDTH, height: MAP_WINDOW_MIN_HEIGHT };
  }
  if (type === 'city') {
    return { width: PANEL_CITY_MIN_WIDTH, height: PANEL_CITY_MIN_HEIGHT };
  }
  if (type === 'army') {
    return { width: PANEL_ARMY_MIN_WIDTH, height: PANEL_ARMY_MIN_HEIGHT };
  }
  if (type === 'rankings') {
    return { width: 760, height: 420 };
  }
  if (type === 'kingdomProfile' || type === 'playerProfile' || type === 'battleReport') {
    return { width: 560, height: 420 };
  }

  return { width: PANEL_DEFAULT_MIN_WIDTH, height: PANEL_DEFAULT_MIN_HEIGHT };
};

type ClampPanelToViewportOptions = {
  allowBelowMinSize?: boolean;
  forceFullWidth?: boolean;
};

const clampPanelToViewport = (
  panel: PanelWindow,
  viewportWidth: number,
  viewportHeight: number,
  options: ClampPanelToViewportOptions = {},
): PanelWindow => {
  const allowBelowMinSize = options.allowBelowMinSize === true;
  const forceFullWidth = options.forceFullWidth === true;
  const minSize = getPanelMinSize(panel.type);

  const minWidth = allowBelowMinSize
    ? Math.min(
        minSize.width,
        Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X),
      )
    : minSize.width;
  const minHeight = allowBelowMinSize
    ? Math.min(
        minSize.height,
        Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y),
      )
    : minSize.height;

  const maxWidth = Math.max(minWidth, viewportWidth - PANEL_VIEWPORT_MARGIN_X);
  const maxHeight = Math.max(minHeight, viewportHeight - PANEL_VIEWPORT_MARGIN_Y);
  const nextWidth = forceFullWidth ? maxWidth : clamp(panel.width, minWidth, maxWidth);
  const nextHeight = clamp(panel.height, minHeight, maxHeight);
  const maxX = Math.max(8, viewportWidth - nextWidth - PANEL_VIEWPORT_MARGIN_X);
  const maxY = Math.max(12, viewportHeight - nextHeight - PANEL_VIEWPORT_MARGIN_Y);
  const nextX = forceFullWidth ? 8 : clamp(panel.x, 8, maxX);
  const nextY = clamp(panel.y, 12, maxY);

  if (
    panel.width === nextWidth &&
    panel.height === nextHeight &&
    panel.x === nextX &&
    panel.y === nextY
  ) {
    return panel;
  }

  return {
    ...panel,
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
    x: Math.round(nextX),
    y: Math.round(nextY),
  };
};

const fitPanelToViewport = (
  panel: PanelWindow,
  viewportWidth: number,
  viewportHeight: number,
  options: ClampPanelToViewportOptions = {},
): PanelWindow =>
  clampPanelToViewport(panel, viewportWidth, viewportHeight, {
    allowBelowMinSize: true,
    ...options,
  });

const getResponsiveArmyPanelSize = (viewportWidth: number, viewportHeight: number): WindowSize => {
  const availableWidth = Math.max(PANEL_ARMY_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X);
  const availableHeight = Math.max(PANEL_ARMY_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y);
  const preferredWidth = Math.round(availableWidth * 0.74);
  const preferredHeight = Math.round(availableHeight * 0.78);

  return {
    width: clamp(preferredWidth, PANEL_ARMY_MIN_WIDTH, availableWidth),
    height: clamp(preferredHeight, PANEL_ARMY_MIN_HEIGHT, availableHeight),
  };
};

const readStoredMapWindowSize = (): WindowSize | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MAP_WINDOW_SIZE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as WindowSize;
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) {
      return null;
    }

    return {
      width: clamp(parsed.width, MAP_WINDOW_MIN_WIDTH, 1800),
      height: clamp(parsed.height, MAP_WINDOW_MIN_HEIGHT, 1300),
    };
  } catch {
    return null;
  }
};

const saveMapWindowSize = (size: WindowSize): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    MAP_WINDOW_SIZE_STORAGE_KEY,
    JSON.stringify({
      width: Math.round(size.width),
      height: Math.round(size.height),
    }),
  );
};

const getLastOwnSettlementStorageKey = (username: string): string =>
  `${LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredLastOwnSettlementId = (username: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getLastOwnSettlementStorageKey(username));
    if (!raw) {
      return null;
    }
    return raw.trim() || null;
  } catch {
    return null;
  }
};

const saveLastOwnSettlementId = (username: string, settlementId: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const key = getLastOwnSettlementStorageKey(username);

  try {
    if (!settlementId) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, settlementId);
  } catch {
    // Ignore storage errors.
  }
};

const getActiveVillageStorageKey = (username: string): string =>
  `${ACTIVE_VILLAGE_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredActiveVillageId = (username: string): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getActiveVillageStorageKey(username));
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.floor(parsed);
  } catch {
    return null;
  }
};

const saveActiveVillageId = (username: string, villageId: number | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const key = getActiveVillageStorageKey(username);
  try {
    if (villageId == null || !Number.isFinite(villageId) || villageId <= 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, String(Math.floor(villageId)));
  } catch {
    // Ignore storage errors.
  }
};

const getArmyTargetHistoryStorageKey = (username: string): string =>
  `${ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredArmyTargetHistory = (username: string): ArmyTargetHistoryByVillageId => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getArmyTargetHistoryStorageKey(username));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const history: ArmyTargetHistoryByVillageId = {};
    for (const [originVillageIdRaw, value] of Object.entries(parsed)) {
      const originVillageId = Number(originVillageIdRaw);
      if (!Number.isFinite(originVillageId) || originVillageId <= 0 || !value || typeof value !== 'object') {
        continue;
      }

      const maybeByCommand = value as Partial<Record<MapOrderCommandType, unknown>>;
      const byCommand: Partial<Record<MapOrderCommandType, number>> = {};
      for (const commandType of MAP_ORDER_COMMAND_TYPES) {
        const targetVillageId = Number(maybeByCommand[commandType]);
        if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
          continue;
        }
        byCommand[commandType] = Math.floor(targetVillageId);
      }

      if (Object.keys(byCommand).length > 0) {
        history[String(Math.floor(originVillageId))] = byCommand;
      }
    }

    return history;
  } catch {
    return {};
  }
};

const saveStoredArmyTargetHistory = (username: string, history: ArmyTargetHistoryByVillageId): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitizedHistory: ArmyTargetHistoryByVillageId = {};
  for (const [originVillageIdRaw, byCommand] of Object.entries(history)) {
    const originVillageId = Number(originVillageIdRaw);
    if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
      continue;
    }

    const sanitizedByCommand: Partial<Record<MapOrderCommandType, number>> = {};
    for (const commandType of MAP_ORDER_COMMAND_TYPES) {
      const targetVillageId = Number(byCommand?.[commandType] ?? 0);
      if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
        continue;
      }
      sanitizedByCommand[commandType] = Math.floor(targetVillageId);
    }

    if (Object.keys(sanitizedByCommand).length > 0) {
      sanitizedHistory[String(Math.floor(originVillageId))] = sanitizedByCommand;
    }
  }

  try {
    const key = getArmyTargetHistoryStorageKey(username);
    if (Object.keys(sanitizedHistory).length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(sanitizedHistory));
  } catch {
    // Ignore storage errors.
  }
};

const getMapZoomStorageKey = (username: string): string =>
  `${MAP_ZOOM_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const normalizeMapZoom = (value: number): number => {
  const clamped = clamp(value, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  return Math.round(clamped / MAP_ZOOM_STEP) * MAP_ZOOM_STEP;
};

const readStoredMapZoom = (username: string): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(getMapZoomStorageKey(username));
    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return normalizeMapZoom(parsed);
  } catch {
    return 0;
  }
};

const saveStoredMapZoom = (username: string, zoomPercent: number): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getMapZoomStorageKey(username), String(normalizeMapZoom(zoomPercent)));
  } catch {
    // Ignore storage errors.
  }
};

const getPanelLayoutStorageKey = (username: string): string =>
  `${PANEL_LAYOUT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const isPanelType = (value: unknown): value is PanelType =>
  typeof value === 'string' && value in PANEL_META;

const sanitizeStoredPanel = (value: unknown, index: number): PanelWindow | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PersistedPanelWindow>;
  if (!isPanelType(candidate.type)) {
    return null;
  }

  const meta = PANEL_META[candidate.type];
  const side: PinSide = candidate.side === 'right' ? 'right' : 'left';
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const minSize = getPanelMinSize(candidate.type);
  const minWidth = Math.min(
    minSize.width,
    Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X),
  );
  const minHeight = Math.min(
    minSize.height,
    Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y),
  );
  const maxWidth = Math.max(minWidth, viewportWidth - PANEL_VIEWPORT_MARGIN_X);
  const maxHeight = Math.max(minHeight, viewportHeight - PANEL_VIEWPORT_MARGIN_Y);
  let width = clamp(Number(candidate.width ?? meta.width), minWidth, maxWidth);
  let height = clamp(Number(candidate.height ?? meta.height), minHeight, maxHeight);

  if (candidate.type === 'army') {
    const storedWidth = Number(candidate.width);
    const storedHeight = Number(candidate.height);
    const looksLikeLegacyArmySize =
      Number.isFinite(storedWidth) &&
      Number.isFinite(storedHeight) &&
      storedWidth <= PANEL_META.army.width + 24 &&
      storedHeight <= PANEL_META.army.height + 24;

    if (looksLikeLegacyArmySize) {
      const responsiveArmySize = getResponsiveArmyPanelSize(viewportWidth, viewportHeight);
      width = clamp(responsiveArmySize.width, minWidth, maxWidth);
      height = clamp(responsiveArmySize.height, minHeight, maxHeight);
    }
  }
  const maxX = Math.max(8, viewportWidth - width - PANEL_VIEWPORT_MARGIN_X);
  const maxY = Math.max(12, viewportHeight - height - PANEL_VIEWPORT_MARGIN_Y);
  const x = clamp(Number(candidate.x ?? 96), 8, maxX);
  const y = clamp(Number(candidate.y ?? 136), 12, maxY);
  const z = Number.isFinite(Number(candidate.z)) ? Number(candidate.z) : 40 + index;

  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id : `${meta.type}-${index}`;
  const label =
    typeof candidate.label === 'string' && candidate.label.trim().length > 0 ? candidate.label : meta.label;

  return {
    ...meta,
    id,
    type: meta.type,
    label: candidate.type === 'city' ? PANEL_META.city.label : label,
    side,
    width,
    height,
    x,
    y,
    z,
    expanded: candidate.expanded !== false,
    alert: false,
    settlementId: typeof candidate.settlementId === 'string' ? candidate.settlementId : undefined,
    buildingId: typeof candidate.buildingId === 'string' ? candidate.buildingId : undefined,
    battleReportId: Number.isFinite(Number(candidate.battleReportId))
      ? Number(candidate.battleReportId)
      : undefined,
    villageName: typeof candidate.villageName === 'string' ? candidate.villageName : undefined,
    kingdomName: typeof candidate.kingdomName === 'string' ? candidate.kingdomName : undefined,
    playerUsername: typeof candidate.playerUsername === 'string' ? candidate.playerUsername : undefined,
  };
};

const readStoredPanelLayout = (username: string): PanelWindow[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getPanelLayoutStorageKey(username));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const seenIds = new Set<string>();
    const restored = parsed
      .map((panel, index) => sanitizeStoredPanel(panel, index))
      .filter((panel): panel is PanelWindow => panel != null)
      .filter((panel) => {
        if (seenIds.has(panel.id)) {
          return false;
        }
        seenIds.add(panel.id);
        return true;
      });

    return restored.length > 0 ? restored : null;
  } catch {
    return null;
  }
};

const savePanelLayout = (username: string, panels: PanelWindow[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedPanelWindow[] = panels.map((panel) => ({
    id: panel.id,
    type: panel.type,
    label: panel.label,
    side: panel.side,
    width: panel.width,
    height: panel.height,
    x: panel.x,
    y: panel.y,
    z: panel.z,
    expanded: panel.expanded,
    alert: false,
    settlementId: panel.settlementId,
    buildingId: panel.buildingId,
    battleReportId: panel.battleReportId,
    villageName: panel.villageName,
    kingdomName: panel.kingdomName,
    playerUsername: panel.playerUsername,
  }));

  try {
    window.localStorage.setItem(getPanelLayoutStorageKey(username), JSON.stringify(payload));
  } catch {
    // Ignore storage errors in private mode/quota pressure.
  }
};

const createPanelWindow = (
  type: PanelType,
  z: number,
  index: number,
  overrides: Partial<
    Pick<
      PanelWindow,
      | 'id'
      | 'label'
      | 'side'
      | 'width'
      | 'height'
      | 'settlementId'
      | 'buildingId'
      | 'battleReportId'
      | 'villageName'
      | 'kingdomName'
      | 'playerUsername'
    >
  > = {},
): PanelWindow => {
  const meta = PANEL_META[type];
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const minSize = getPanelMinSize(type);
  const minWidth = Math.min(
    minSize.width,
    Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X),
  );
  const minHeight = Math.min(
    minSize.height,
    Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y),
  );
  const maxWidth = Math.max(minWidth, viewportWidth - PANEL_VIEWPORT_MARGIN_X);
  const maxHeight = Math.max(minHeight, viewportHeight - PANEL_VIEWPORT_MARGIN_Y);
  const responsiveArmySize =
    type === 'army' && (overrides.width == null || overrides.height == null)
      ? getResponsiveArmyPanelSize(viewportWidth, viewportHeight)
      : null;
  const defaultWidth = responsiveArmySize?.width ?? meta.width;
  const defaultHeight = responsiveArmySize?.height ?? meta.height;
  const width = clamp(overrides.width ?? defaultWidth, minWidth, maxWidth);
  const height = clamp(overrides.height ?? defaultHeight, minHeight, maxHeight);
  const side = overrides.side ?? meta.side;
  const usableWidth = width;
  const rowOffset = index % 3;

  const leftStart = 96 + rowOffset * 30;
  const rightStart = Math.max(240, viewportWidth - usableWidth - 140 - rowOffset * 30);

  const created: PanelWindow = {
    ...meta,
    ...overrides,
    id: overrides.id ?? meta.type,
    label: overrides.label ?? meta.label,
    side,
    width,
    height,
    z,
    x: side === 'left' ? leftStart : rightStart,
    y: 136 + rowOffset * 34,
    expanded: true,
    alert: false,
  };

  return fitPanelToViewport(created, viewportWidth, viewportHeight);
};

const formatCostLabel = (cost: ResourceCost | null): string => {
  if (!cost) {
    return 'Max úroveň';
  }

  return `${cost.wood} dřevo, ${cost.stone} kámen, ${cost.iron} železo`;
};

const formatResourceBundleLabel = (cost: ResourceCost): string =>
  `${Math.floor(cost.wood).toLocaleString('cs-CZ')} dřevo, ${Math.floor(cost.stone).toLocaleString('cs-CZ')} kámen, ${Math.floor(cost.iron).toLocaleString('cs-CZ')} železo`;

const formatDurationLabel = (seconds: number | null): string => {
  if (seconds == null) {
    return '-';
  }

  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Akce se nepodařila. Zkus to znovu.';
};

const isTypingElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

const handleActionOnEnter = <TElement extends HTMLElement>(
  event: ReactKeyboardEvent<TElement>,
  action: () => void,
): void => {
  if (event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  action();
};

const CityPanel = ({
  villageLabel,
  regionLabel,
  ownerName,
  prestige,
  loyalty,
  availableResources,
  buildings,
  units,
  orders,
  recruitQueueOrders,
  onOpenBuilding,
  onOpenArmyRecruitment,
  onUpgradeBuilding,
  onCancelBuildingUpgrade,
  onCancelRecruitment,
  buildingUpgradeQueueByBuilding,
  upgradePendingBuildingId,
  cancelUpgradePendingOrderId,
  cancelRecruitmentPendingId,
  buildingNotices,
}: {
  villageLabel: string;
  regionLabel: string;
  ownerName: string;
  prestige: number;
  loyalty: number;
  availableResources: ResourceCost;
  buildings: Building[];
  units: Unit[];
  orders: string[];
  recruitQueueOrders: RecruitQueueOrder[];
  onOpenBuilding: (building: Building) => void;
  onOpenArmyRecruitment: () => void;
  onUpgradeBuilding: (building: Building) => void;
  onCancelBuildingUpgrade: (upgradeOrderId: number, buildingId: string) => void;
  onCancelRecruitment: (order: RecruitQueueOrder) => void;
  buildingUpgradeQueueByBuilding: Map<string, BuildingUpgradeQueueOrder[]>;
  upgradePendingBuildingId: string | null;
  cancelUpgradePendingOrderId: number | null;
  cancelRecruitmentPendingId: number | null;
  buildingNotices: Record<string, string>;
}) => {
  const buildingsById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );

  const groupedBuildings = useMemo(() => {
    const seenBuildingIds = new Set<string>();
    const grouped = CITY_OVERVIEW_GROUPS.map((group) => {
      const orderedBuildings = group.buildingIds
        .map((buildingId) => {
          const resolvedBuilding = buildingsById.get(buildingId);
          if (resolvedBuilding) {
            seenBuildingIds.add(buildingId);
          }
          return resolvedBuilding;
        })
        .filter((building): building is Building => building != null);

      return {
        ...group,
        buildings: orderedBuildings,
      };
    }).filter((group) => group.buildings.length > 0);

    const additionalBuildings = buildings.filter((building) => !seenBuildingIds.has(building.id));
    if (additionalBuildings.length > 0) {
      grouped.push({
        id: 'additional',
        label: 'Další stavby',
        subtitle: 'Speciální řetězce a unikátní budovy',
        buildingIds: additionalBuildings.map((building) => building.id),
        buildings: additionalBuildings,
      });
    }

    return grouped;
  }, [buildings, buildingsById]);

  const activeUpgradeOrders = useMemo(() => {
    const merged = Array.from(buildingUpgradeQueueByBuilding.values()).flat();
    return [...merged].sort((a, b) => {
      const byEta = a.remainingSec - b.remainingSec;
      if (byEta !== 0) {
        return byEta;
      }
      return a.id - b.id;
    });
  }, [buildingUpgradeQueueByBuilding]);

  const remainingOrders = useMemo(() => {
    return orders.filter((order) => {
      const normalized = order.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      return !normalized.startsWith('vystavba:') && !normalized.startsWith('nabor:');
    });
  }, [orders]);

  return (
    <div className="city-panel">
      <div className="city-overview-layout">
        <aside className="city-stats-grid">
          <article>
            <h4>Město</h4>
            <strong>{villageLabel}</strong>
            <span>{regionLabel}</span>
          </article>
          <article>
            <h4>Prestiž</h4>
            <strong>{prestige.toLocaleString('cs-CZ')} bodů</strong>
            <span>Tier: opevněné město</span>
          </article>
          <article>
            <h4>Vlastník</h4>
            <strong>{ownerName}</strong>
            <span>Aktuální držitel léna</span>
          </article>
          <article>
            <h4>Oddanost</h4>
            <strong>{loyalty} %</strong>
            <span>Bez rizika převzetí</span>
          </article>
        </aside>

        <div className="city-layout">
          <section className="city-core-view">
            <div className="city-core-headline">
              <h3>Přehled léna</h3>
              <p>
                Každá karta zobrazuje cenu a čas další úrovně. Upgrady můžeš spustit rovnou tady bez přepnutí do
                detailu.
              </p>
            </div>
            <div className="city-upgrade-board">
              {groupedBuildings.map((group) => (
                <section key={group.id} className="city-upgrade-column">
                  <header>
                    <h4>{group.label}</h4>
                    <p>{group.subtitle}</p>
                  </header>
                  <div className="city-building-list">
                    {group.buildings.map((building) => {
                      const isUpgradePending = upgradePendingBuildingId === building.id;
                      const notice = buildingNotices[building.id] ?? '';
                      const normalizedNotice = notice
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, '')
                        .toLowerCase();
                      const isPositiveNotice = normalizedNotice.includes('uspesne');
                      const statusText = building.isInProgress
                        ? `Probíhá upgrade (${building.nextTime})`
                        : building.canUpgrade
                          ? `Připraveno (${building.nextTime})`
                          : building.blockedReason ?? 'Max úroveň';
                      const statusToneClass = building.isInProgress
                        ? 'progress'
                        : building.canUpgrade
                          ? 'ready'
                          : 'blocked';
                      const upgradeQueue = buildingUpgradeQueueByBuilding.get(building.id) ?? [];
                      const canCancelUpgrade = upgradeQueue.length > 0;
                      const cancelOrderId = canCancelUpgrade ? upgradeQueue[0].id : null;
                      const isCancelPending =
                        cancelOrderId != null && cancelUpgradePendingOrderId === cancelOrderId;
                      const queuedUpgradeCount = upgradeQueue.length;
                      const canTriggerUpgrade = building.canUpgrade && !isUpgradePending;
                      const isUnbuilt = building.level <= 0;
                      const queueInfoLabel =
                        queuedUpgradeCount > 1
                          ? `Ve frontě: ${queuedUpgradeCount.toLocaleString('cs-CZ')} upgrady`
                          : null;

                      return (
                        <article
                          key={building.id}
                          className={`city-building-card ${building.isInProgress ? 'is-progress' : ''} ${isUnbuilt ? 'is-unbuilt' : ''}`}
                          role="button"
                          tabIndex={0}
                          title={
                            canTriggerUpgrade
                              ? 'Levé kliknutí: postav/rozšiř budovu. Pravé kliknutí: detail budovy.'
                              : 'Pravé kliknutí: detail budovy.'
                          }
                          aria-label={`${building.name}, úroveň ${building.level}`}
                          onClick={() => {
                            if (!canTriggerUpgrade) {
                              return;
                            }
                            onUpgradeBuilding(building);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onOpenBuilding(building);
                          }}
                          onKeyDown={(event) =>
                            handleActionOnEnter(event, () => {
                              if (!canTriggerUpgrade) {
                                return;
                              }
                              onUpgradeBuilding(building);
                            })
                          }
                        >
                          <div className="city-building-main">
                            <img src={building.icon} alt={building.name} loading="lazy" />
                            <div>
                              <span>{building.category}</span>
                              <strong>{building.name}</strong>
                              <em>Úroveň {building.level}</em>
                              {isUnbuilt ? (
                                <small className="city-building-unbuilt-label">Neaktivní budova</small>
                              ) : null}
                            </div>
                          </div>
                          <div className="city-building-status-row">
                            <p className={`city-building-status ${statusToneClass}`}>{statusText}</p>
                            {canCancelUpgrade && cancelOrderId != null ? (
                              <button
                                type="button"
                                className="inline-cancel-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onCancelBuildingUpgrade(cancelOrderId, building.id);
                                }}
                                onContextMenu={(event) => {
                                  event.stopPropagation();
                                }}
                                disabled={isCancelPending}
                                title="Zrušit tento upgrade a navazující položky ve frontě"
                                aria-label="Zrušit upgrade budovy"
                              >
                                {isCancelPending ? '…' : '✕'}
                              </button>
                            ) : null}
                          </div>
                          {queueInfoLabel ? <small className="row-help">{queueInfoLabel}</small> : null}
                          <small className="city-building-hover-hint">
                            Levým klikem postav/rozšiř budovu · pravým klikem zobraz detail budovy
                          </small>
                          <div className="city-building-costs">
                            {building.nextCostRaw ? (
                              RESOURCE_COST_TYPES.map((resourceType) => {
                                const requiredAmount = building.nextCostRaw?.[resourceType] ?? 0;
                                const availableAmount = availableResources[resourceType];
                                const canAffordResource = availableAmount >= requiredAmount;
                                return (
                                  <span
                                    key={`${building.id}-${resourceType}`}
                                    className={`city-cost-chip ${canAffordResource ? 'ok' : 'missing'}`}
                                    title={`${LOOT_PRIORITY_LABELS[resourceType]}: máš ${availableAmount.toLocaleString('cs-CZ')}`}
                                  >
                                    <b>{LOOT_PRIORITY_LABELS[resourceType]}</b>
                                    <i>{requiredAmount.toLocaleString('cs-CZ')}</i>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="city-cost-chip maxed">Max úroveň</span>
                            )}
                          </div>
                          {notice ? (
                            <p className={`city-building-notice ${isPositiveNotice ? 'success' : 'error'}`}>
                              {notice}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <aside className="city-side-info">
            <section>
              <h3>Jednotky ve městě</h3>
              <ul>
                {units.map((unit) => (
                  <li
                    key={unit.id}
                    className="city-unit-line"
                    role="button"
                    tabIndex={0}
                    title="Levé kliknutí: otevřít okno Armáda a nábor"
                    onClick={() => onOpenArmyRecruitment()}
                    onKeyDown={(event) =>
                      handleActionOnEnter(event, () => {
                        onOpenArmyRecruitment();
                      })
                    }
                  >
                    <div className="city-unit-header">
                      <span className="unit-name-with-icon">
                        <span className="unit-icon-shell" aria-hidden="true">
                          <img
                            src={getUnitMetaById(unit.id).icon}
                            alt=""
                            className="unit-icon-image"
                            loading="lazy"
                          />
                        </span>
                        <span>{unit.name}</span>
                      </span>
                      <strong>
                        {unit.amount.toLocaleString('cs-CZ')}
                        {unit.stationedSupportCount > 0
                          ? ` (+${unit.stationedSupportCount.toLocaleString('cs-CZ')})`
                          : ''}
                      </strong>
                    </div>
                    {unit.stationedSupportCount > 0 ? (
                      <small className="row-help">
                        v závorce stacionovaná podpora v lénu
                      </small>
                    ) : null}
                    <em>{unit.role}</em>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Aktivní rozkazy</h3>
              <ul>
                {activeUpgradeOrders.length > 0 ? (
                  activeUpgradeOrders.map((order) => {
                    const queuedBuilding = buildingsById.get(order.buildingId);
                    const buildingName = queuedBuilding?.name ?? order.buildingId;
                    const buildingIcon = queuedBuilding?.icon ?? BUILDING_ART[order.buildingId]?.icon ?? DEFAULT_BUILDING_ICON;
                    const isCancelPending = cancelUpgradePendingOrderId === order.id;
                    return (
                      <li key={`active-upgrade-${order.id}`} className="order-line order-line-action">
                        <span className="order-line-text queue-order-text">
                          <span className="queue-order-icon-shell" aria-hidden="true">
                            <img
                              src={buildingIcon}
                              alt=""
                              className="queue-order-icon-image building"
                              loading="lazy"
                            />
                          </span>
                          <span>
                            Vystavba: {buildingName} {order.fromLevel} -&gt; {order.toLevel} (zbyva{' '}
                            {formatDurationLabel(order.remainingSec)})
                          </span>
                        </span>
                        <button
                          type="button"
                          className="inline-cancel-button"
                          onClick={() => onCancelBuildingUpgrade(order.id, order.buildingId)}
                          disabled={isCancelPending}
                          title="Zrušit tento upgrade a navazující položky ve frontě"
                          aria-label="Zrušit upgrade ve frontě"
                        >
                          {isCancelPending ? '…' : '✕'}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="order-line">
                    <span>Vystavba: zadna aktivni fronta</span>
                  </li>
                )}
                {recruitQueueOrders.length > 0 ? (
                  recruitQueueOrders.map((order) => {
                    const isCancelPending = cancelRecruitmentPendingId === order.id;
                    return (
                      <li key={`active-recruit-${order.id}`} className="order-line order-line-action">
                        <span className="order-line-text queue-order-text">
                          <span className="queue-order-icon-shell unit" aria-hidden="true">
                            <img
                              src={getUnitMetaById(order.unitId).icon}
                              alt=""
                              className="queue-order-icon-image unit"
                              loading="lazy"
                            />
                          </span>
                          <span>
                            Nabor: {order.unitName} +{order.amount} (zbyva {formatDurationLabel(order.remainingSec)})
                          </span>
                        </span>
                        <button
                          type="button"
                          className="inline-cancel-button"
                          onClick={() => onCancelRecruitment(order)}
                          disabled={isCancelPending}
                          title="Zrušit tuto položku náboru"
                          aria-label="Zrušit nábor ve frontě"
                        >
                          {isCancelPending ? '…' : '✕'}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="order-line">
                    <span>Nabor: zadna aktivni fronta</span>
                  </li>
                )}
                {remainingOrders.map((order, index) => {
                  const commandType = parseArmyOrderCommandType(order);
                  return (
                    <li key={`${index}-${order}`} className={commandType ? 'order-line with-icon' : 'order-line'}>
                      {commandType ? (
                        <span
                          className={`command-badge ${commandType} compact`}
                          aria-label={ARMY_COMMAND_LABELS[commandType]}
                          title={ARMY_COMMAND_LABELS[commandType]}
                        >
                          <span className="symbol">{getArmyCommandSymbol(commandType)}</span>
                        </span>
                      ) : null}
                      <span>{order}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

const ArmyPanel = ({
  units,
  recruitQueueOrders,
  activeMovements,
  stationedSupports,
  settlements,
  currentVillageId,
  currentUsername,
  commandHistory,
  quickSelection,
  onRecruit,
  onCancelRecruitment,
  onIssueArmyCommand,
  onReturnSupport,
  onOpenSettlementByVillageId,
  recruitPendingUnitId,
  cancelRecruitmentPendingId,
  isArmyCommandPending,
  notice,
  noticeUnitId,
  commandNotice,
}: {
  units: Unit[];
  recruitQueueOrders: RecruitQueueOrder[];
  activeMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  settlements: RegionSettlement[];
  currentVillageId: number | null;
  currentUsername: string;
  commandHistory: Partial<Record<MapOrderCommandType, number>>;
  quickSelection: ArmyQuickSelection | null;
  onRecruit: (unit: Unit, amount: number) => Promise<boolean>;
  onCancelRecruitment: (order: RecruitQueueOrder) => void;
  onIssueArmyCommand: (payload: {
    commandType: ArmyCommandType;
    targetVillageId: number;
    lootPriority?: LootPriority;
    units: Record<string, number>;
  }) => void;
  onReturnSupport: (supportMovementId: number) => void;
  onOpenSettlementByVillageId: (villageId: number) => void;
  recruitPendingUnitId: string | null;
  cancelRecruitmentPendingId: number | null;
  isArmyCommandPending: boolean;
  notice: string | null;
  noticeUnitId: string | null;
  commandNotice: string | null;
}) => {
  const [commandType, setCommandType] = useState<ArmyCommandType>('move');
  const [lootPriority, setLootPriority] = useState<LootPriority>('wood');
  const [targetVillageId, setTargetVillageId] = useState<number | null>(null);
  const [draftUnitAmounts, setDraftUnitAmounts] = useState<Record<string, string>>({});
  const [recruitDraftAmounts, setRecruitDraftAmounts] = useState<Record<string, string>>({});
  const isRecruitMutationPending = recruitPendingUnitId != null;
  const lastAppliedQuickSelectionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!quickSelection) {
      return;
    }

    if (lastAppliedQuickSelectionRef.current === quickSelection.requestId) {
      return;
    }

    lastAppliedQuickSelectionRef.current = quickSelection.requestId;
    const frameId = window.requestAnimationFrame(() => {
      setCommandType(quickSelection.commandType);
      setTargetVillageId(quickSelection.targetVillageId);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [quickSelection]);

  const availableTargets = useMemo(() => {
    if (commandType === 'return') {
      return [];
    }

    return settlements.filter((settlement) =>
      canTargetSettlementForArmyCommand({
        settlement,
        commandType,
        currentVillageId,
        currentUsername,
      }),
    );
  }, [commandType, currentUsername, currentVillageId, settlements]);

  const resolvedTargetVillageId = useMemo(() => {
    if (availableTargets.length === 0) {
      return null;
    }
    if (targetVillageId != null && availableTargets.some((settlement) => settlement.villageId === targetVillageId)) {
      return targetVillageId;
    }
    return availableTargets[0]?.villageId ?? null;
  }, [availableTargets, targetVillageId]);

  const historyItems = useMemo(
    () =>
      MAP_ORDER_COMMAND_TYPES.map((commandType) => {
        const targetVillageId = Number(commandHistory[commandType] ?? 0);
        if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
          return null;
        }

        const settlement =
          settlements.find((candidate) => Number(candidate.villageId) === targetVillageId) ?? null;
        const isSelectable = settlement
          ? canTargetSettlementForArmyCommand({
              settlement,
              commandType,
              currentVillageId,
              currentUsername,
            })
          : false;

        return {
          commandType,
          targetVillageId,
          settlement,
          isSelectable,
        };
      }).filter((item): item is {
        commandType: MapOrderCommandType;
        targetVillageId: number;
        settlement: RegionSettlement | null;
        isSelectable: boolean;
      } => item != null),
    [commandHistory, currentUsername, currentVillageId, settlements],
  );

  const activeMovementsForVillage = useMemo(
    () => activeMovements.filter((movement) => movement.isRelatedToCurrentVillage),
    [activeMovements],
  );
  const stationedSupportsForVillage = useMemo(
    () => stationedSupports.filter((movement) => movement.isRelatedToCurrentVillage),
    [stationedSupports],
  );
  const lockedRecruitUnits = useMemo(
    () => units.filter((unit) => isBlockedByRecruitRule(unit)),
    [units],
  );
  const recruitTableUnits = useMemo(
    () => units.filter((unit) => !isBlockedByRecruitRule(unit)),
    [units],
  );

  const handleDraftAmountChange = (unitId: string, value: string) => {
    setDraftUnitAmounts((previous) => ({
      ...previous,
      [unitId]: value,
    }));
  };

  const handleRecruitAmountChange = (unitId: string, value: string) => {
    setRecruitDraftAmounts((previous) => ({
      ...previous,
      [unitId]: value,
    }));
  };

  const getRequestedRecruitAmount = (unit: Unit) => {
    const raw = Number(recruitDraftAmounts[unit.id] ?? 0);
    if (!Number.isInteger(raw) || raw <= 0) {
      return 0;
    }
    return Math.min(unit.maxRecruitable, raw);
  };
  const renderUnitAmountBadges = (armyUnits: { unitId: string; amount: number }[], keyPrefix: string) => (
    <div className="unit-badge-list">
      {armyUnits.map((armyUnit, index) => {
        const meta = getUnitMetaById(armyUnit.unitId);
        return (
          <span key={`${keyPrefix}-${armyUnit.unitId}-${index}`} className="unit-badge-pill">
            <span className="unit-icon-shell tiny" aria-hidden="true">
              <img src={meta.icon} alt="" className="unit-icon-image" loading="lazy" />
            </span>
            <span>
              {meta.fallbackName} {armyUnit.amount.toLocaleString('cs-CZ')}
            </span>
          </span>
        );
      })}
    </div>
  );
  const handleApplyHistoryTarget = (historyItem: {
    commandType: MapOrderCommandType;
    targetVillageId: number;
    settlement: RegionSettlement | null;
    isSelectable: boolean;
  }) => {
    if (isArmyCommandPending) {
      return;
    }
    setCommandType(historyItem.commandType);
    setTargetVillageId(historyItem.targetVillageId);
  };
  const handleRecruitUnit = useCallback(
    async (unit: Unit, amount: number) => {
      if (!unit.canRecruit || isRecruitMutationPending) {
        return;
      }

      const requestedAmount = Math.max(0, Math.floor(amount));
      if (requestedAmount <= 0) {
        return;
      }

      const wasRecruited = await onRecruit(unit, requestedAmount);
      if (!wasRecruited) {
        return;
      }

      setRecruitDraftAmounts((previous) => {
        if (!(unit.id in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[unit.id];
        return next;
      });
    },
    [isRecruitMutationPending, onRecruit],
  );

  const selectedCommandUnits = useMemo(
    () =>
      buildSelectedUnitsFromDraft(units, draftUnitAmounts, {
        excludeCaravan: commandType === 'support',
      }),
    [commandType, draftUnitAmounts, units],
  );
  const selectedCommandUnitCount = useMemo(
    () => calculateTotalUnitsInSelection(selectedCommandUnits),
    [selectedCommandUnits],
  );
  const selectedCaravanCount = Number(selectedCommandUnits.caravan ?? 0);
  const baseAttackPower = useMemo(
    () => calculateAttackPowerFromSelection(selectedCommandUnits),
    [selectedCommandUnits],
  );
  const baseDefensePower = useMemo(
    () => calculateDefensePowerFromSelection(selectedCommandUnits),
    [selectedCommandUnits],
  );
  const hasRamAttackBonus = commandType === 'attack' && Number(selectedCommandUnits.ram ?? 0) > 0;
  const attackPowerWithBonuses = hasRamAttackBonus
    ? Math.round(baseAttackPower * RAM_ATTACK_BONUS_MULTIPLIER)
    : baseAttackPower;
  const caravanLootCapacity = selectedCaravanCount * CARAVAN_LOOT_CAPACITY;

  const handleSendCommand = () => {
    if (resolvedTargetVillageId == null) {
      return;
    }

    if (selectedCommandUnitCount <= 0) {
      return;
    }

    const selectedUnitsPayload: Record<string, number> = {};
    for (const unitId of COMMAND_UNIT_ORDER) {
      const amount = Number(selectedCommandUnits[unitId] ?? 0);
      if (amount <= 0) {
        continue;
      }
      selectedUnitsPayload[unitId] = amount;
    }

    onIssueArmyCommand({
      commandType,
      targetVillageId: resolvedTargetVillageId,
      lootPriority: commandType === 'attack' ? lootPriority : undefined,
      units: selectedUnitsPayload,
    });
    setDraftUnitAmounts({});
  };

  return (
    <div className="panel-stack">
      <section>
        <h3>Nábor jednotek</h3>
        <p>Nábor běží ve frontě pro aktuální léno. Limitem je dostupná populace a suroviny.</p>
        {notice ? (
          <p className={`panel-feedback ${noticeUnitId ? 'panel-feedback-with-unit' : ''}`}>
            {noticeUnitId ? (
              <span className="unit-icon-shell tiny" aria-hidden="true">
                <img src={getUnitMetaById(noticeUnitId).icon} alt="" className="unit-icon-image" loading="lazy" />
              </span>
            ) : null}
            <span>{notice}</span>
          </p>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Jednotka</th>
              <th>Počet</th>
              <th>Role</th>
              <th>Cena</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {recruitTableUnits.map((unit) => {
              const requestedRecruitAmount = getRequestedRecruitAmount(unit);
              const unitMeta = getUnitMetaById(unit.id);
              return (
                <tr key={unit.id}>
                  <td>
                    <span className="unit-name-with-icon">
                      <span className="unit-icon-shell" aria-hidden="true">
                        <img src={unitMeta.icon} alt="" className="unit-icon-image" loading="lazy" />
                      </span>
                      <span>{unit.name}</span>
                    </span>
                  </td>
                  <td>
                    {unit.amount.toLocaleString('cs-CZ')}
                    {unit.stationedSupportCount > 0 ? (
                      <small className="row-help">
                        podpora v lénu: +{unit.stationedSupportCount.toLocaleString('cs-CZ')}
                      </small>
                    ) : null}
                    <small className="row-help">
                      maximálně {unit.maxRecruitable.toLocaleString('cs-CZ')} počet k rekrutu
                    </small>
                    {unit.queuedCount > 0 ? (
                      <small className="row-help">ve fronte: +{unit.queuedCount.toLocaleString('cs-CZ')}</small>
                    ) : null}
                    {unit.blockedReason ? <small className="row-help">{unit.blockedReason}</small> : null}
                  </td>
                  <td>{unit.role}</td>
                  <td>{unit.cost}</td>
                  <td>
                    <div className="recruit-controls">
                      <input
                        className="recruit-amount-input"
                        type="number"
                        min={1}
                        max={Math.max(1, unit.maxRecruitable)}
                        step={1}
                        value={recruitDraftAmounts[unit.id] ?? ''}
                        onChange={(event) => handleRecruitAmountChange(unit.id, event.target.value)}
                        onKeyDown={(event) =>
                          handleActionOnEnter(event, () => {
                            void handleRecruitUnit(unit, requestedRecruitAmount);
                          })
                        }
                        disabled={!unit.canRecruit || isRecruitMutationPending}
                        placeholder="1"
                      />
                      <button
                        className="secondary-action recruit-action"
                        onClick={() => {
                          void handleRecruitUnit(unit, requestedRecruitAmount);
                        }}
                        disabled={
                          !unit.canRecruit ||
                          isRecruitMutationPending ||
                          requestedRecruitAmount <= 0
                        }
                      >
                        {recruitPendingUnitId === unit.id ? 'Nábor...' : 'Naverbovat'}
                      </button>
                      <button
                        className="secondary-action recruit-max-action"
                        onClick={() => {
                          void handleRecruitUnit(unit, unit.maxRecruitable);
                        }}
                        disabled={!unit.canRecruit || isRecruitMutationPending || unit.maxRecruitable <= 0}
                      >
                        {recruitPendingUnitId === unit.id
                          ? 'Nábor...'
                          : `Rekrutovat vše (${unit.maxRecruitable.toLocaleString('cs-CZ')})`}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recruitTableUnits.length === 0 ? (
              <tr>
                <td colSpan={5}>Náborové jednotky nejsou dostupné.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {lockedRecruitUnits.length > 0 ? (
          <div className="recruit-rule-cards">
            <h4>Zamčené jednotky - nejdřív splň pravidlo</h4>
            <div className="recruit-rule-card-grid">
              {lockedRecruitUnits.map((unit) => {
                const normalizedReason = normalizeRecruitBlockedReason(unit.blockedReason);
                const requiredBuildingName =
                  BUILDING_ART[unit.requiredBuildingId]?.fallbackName ?? unit.requiredBuildingId;
                const requirementHint = normalizedReason.startsWith('vybuduj ')
                  ? `Požadovaná budova: ${requiredBuildingName}.`
                  : normalizedReason.includes('limit rytiru')
                    ? 'Požadavek: uvolni kapacitu rytířů podle počtu osad.'
                    : 'Požadavek: splň pravidlo dostupnosti jednotky.';

                return (
                  <article key={`recruit-rule-${unit.id}`} className="recruit-rule-card">
                    <strong className="unit-name-with-icon">
                      <span className="unit-icon-shell" aria-hidden="true">
                        <img src={getUnitMetaById(unit.id).icon} alt="" className="unit-icon-image" loading="lazy" />
                      </span>
                      <span>{unit.name}</span>
                    </strong>
                    <span>{unit.role}</span>
                    <p>{unit.blockedReason ?? 'Jednotka je zamčená pravidlem.'}</p>
                    <small>{requirementHint}</small>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      <section>
        <h3>Fronta kasáren</h3>
        <p>Každý záznam běží paralelně. ETA se odečítá podle backend ticku.</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jednotka</th>
              <th>Počet</th>
              <th>ETA</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {recruitQueueOrders.map((order, index) => (
              <tr key={`rq-${order.id}`} className="queue-row">
                <td>{index + 1}</td>
                <td>
                  <span className="unit-name-with-icon">
                    <span className="unit-icon-shell" aria-hidden="true">
                      <img
                        src={getUnitMetaById(order.unitId).icon}
                        alt=""
                        className="unit-icon-image"
                        loading="lazy"
                      />
                    </span>
                    <span>{order.unitName}</span>
                  </span>
                </td>
                <td>+{order.amount}</td>
                <td>{formatDurationLabel(order.remainingSec)}</td>
                <td>
                  <button
                    type="button"
                    className="inline-cancel-button"
                    onClick={() => onCancelRecruitment(order)}
                    disabled={cancelRecruitmentPendingId === order.id}
                    title="Zrušit tuto položku náboru"
                    aria-label="Zrušit náborovou položku"
                  >
                    {cancelRecruitmentPendingId === order.id ? '…' : '✕'}
                  </button>
                </td>
              </tr>
            ))}
            {recruitQueueOrders.length === 0 ? (
              <tr>
                <td colSpan={5}>Náborová fronta je prázdná.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Přesuny armád a rozkazy</h3>
        <div className="army-command-controls">
          <label>
            Rozkaz
            <select
              value={commandType}
              onChange={(event) => setCommandType(event.target.value as ArmyCommandType)}
              disabled={isArmyCommandPending}
            >
              <option value="move">{ARMY_COMMAND_LABELS.move}</option>
              <option value="support">{ARMY_COMMAND_LABELS.support}</option>
              <option value="attack">{ARMY_COMMAND_LABELS.attack}</option>
            </select>
          </label>
          <label>
            Cílové léno
            <select
              value={resolvedTargetVillageId == null ? '' : String(resolvedTargetVillageId)}
              onChange={(event) => setTargetVillageId(Number(event.target.value))}
              disabled={isArmyCommandPending || availableTargets.length === 0}
            >
              {availableTargets.length === 0 ? (
                <option value="">Žádné dostupné cíle</option>
              ) : (
                availableTargets.map((settlement) => (
                  <option key={settlement.id} value={settlement.villageId}>
                    {settlement.name} ({settlement.globalX}|{settlement.globalY})
                  </option>
                ))
              )}
            </select>
          </label>
          {commandType === 'attack' ? (
            <label>
              Priorita drancování
              <select
                value={lootPriority}
                onChange={(event) => setLootPriority(event.target.value as LootPriority)}
                disabled={isArmyCommandPending}
              >
                <option value="wood">{LOOT_PRIORITY_LABELS.wood}</option>
                <option value="stone">{LOOT_PRIORITY_LABELS.stone}</option>
                <option value="iron">{LOOT_PRIORITY_LABELS.iron}</option>
              </select>
            </label>
          ) : null}
        </div>
        {historyItems.length > 0 ? (
          <div className="army-command-history">
            <h4>Rychlá historie cílů</h4>
            <p className="row-help">Levé kliknutí nastaví cíl. Pravé kliknutí otevře profil léna.</p>
            <div className="army-command-history-list">
              {historyItems.map((historyItem) => {
                const targetLabel = historyItem.settlement
                  ? `${historyItem.settlement.name} (${historyItem.settlement.globalX}|${historyItem.settlement.globalY})`
                  : `Léno #${historyItem.targetVillageId}`;

                return (
                  <button
                    key={`history-${historyItem.commandType}-${historyItem.targetVillageId}`}
                    type="button"
                    className={`secondary-action army-command-history-item ${historyItem.commandType} ${historyItem.isSelectable ? '' : 'is-disabled'}`}
                    onClick={() => handleApplyHistoryTarget(historyItem)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!historyItem.settlement) {
                        return;
                      }
                      onOpenSettlementByVillageId(historyItem.targetVillageId);
                    }}
                    title={
                      historyItem.isSelectable
                        ? `${ARMY_COMMAND_LABELS[historyItem.commandType]} - ${targetLabel}`
                        : `${targetLabel} nyní není dostupný cíl`
                    }
                  >
                    <span className={`command-badge ${historyItem.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(historyItem.commandType)}</span>
                    </span>
                    <span>{targetLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="army-draft-grid">
          {units.map((unit) => (
            <label key={`draft-${unit.id}`}>
              <span className="unit-draft-label">
                <span className="unit-name-with-icon">
                  <span className="unit-icon-shell tiny" aria-hidden="true">
                    <img src={getUnitMetaById(unit.id).icon} alt="" className="unit-icon-image" loading="lazy" />
                  </span>
                  <span>{unit.name}</span>
                </span>{' '}
                <small className="row-help inline">k dispozici: {unit.amount.toLocaleString('cs-CZ')}</small>
              </span>
              <input
                type="number"
                min={0}
                max={unit.amount}
                step={1}
                value={draftUnitAmounts[unit.id] ?? ''}
                onChange={(event) => handleDraftAmountChange(unit.id, event.target.value)}
                onKeyDown={(event) => {
                  handleActionOnEnter(event, () => {
                    handleSendCommand();
                  });
                }}
                disabled={isArmyCommandPending || (commandType === 'support' && unit.id === 'caravan')}
              />
              {commandType === 'support' && unit.id === 'caravan' ? (
                <small className="row-help">Karavany nelze posílat jako podporu.</small>
              ) : null}
            </label>
          ))}
        </div>
        <div className="army-command-preview">
          <p>
            Vybráno jednotek: <strong>{selectedCommandUnitCount.toLocaleString('cs-CZ')}</strong>
          </p>
          {commandType === 'attack' ? (
            <>
              <p>
                Síla útoku: <strong>{attackPowerWithBonuses.toLocaleString('cs-CZ')}</strong>{' '}
                {hasRamAttackBonus ? <span>(včetně +10 % bonusu beranidel bez brány)</span> : null}
              </p>
              <p>
                Kapacita kořisti (karavany):{' '}
                <strong>{caravanLootCapacity.toLocaleString('cs-CZ')} surovin</strong>
              </p>
            </>
          ) : (
            <p>
              Síla obrany vybraných jednotek: <strong>{baseDefensePower.toLocaleString('cs-CZ')}</strong>
            </p>
          )}
        </div>
        <button
          className="secondary-action"
          onClick={handleSendCommand}
          disabled={isArmyCommandPending || resolvedTargetVillageId == null || selectedCommandUnitCount <= 0}
        >
          {isArmyCommandPending ? 'Odesílám rozkaz...' : 'Odeslat armádní rozkaz'}
        </button>
        {commandNotice ? <p className="panel-feedback">{commandNotice}</p> : null}
      </section>
      <section>
        <h3>Aktivní přesuny armád</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Rozkaz</th>
              <th>Trasa</th>
              <th>Jednotky</th>
              <th>ETA</th>
            </tr>
          </thead>
          <tbody>
            {activeMovementsForVillage.map((movement, index) => (
              <tr key={`mv-${movement.id}`}>
                <td>{index + 1}</td>
                <td>
                  <span className={`command-badge ${movement.commandType}`}>
                    <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    <span>{ARMY_COMMAND_LABELS[movement.commandType]}</span>
                  </span>
                </td>
                <td>
                  {movement.originName} → {movement.targetName}
                </td>
                <td>{renderUnitAmountBadges(movement.units, `movement-${movement.id}`)}</td>
                <td>{formatDurationLabel(movement.remainingSec)}</td>
              </tr>
            ))}
            {activeMovementsForVillage.length === 0 ? (
              <tr>
                <td colSpan={5}>Aktuálně není žádný aktivní přesun.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Stacionované podpory</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Osada</th>
              <th>Jednotky</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {stationedSupportsForVillage.map((support, index) => (
              <tr key={`sp-${support.id}`}>
                <td>{index + 1}</td>
                <td>
                  <span className="command-badge support compact">
                    <span className="symbol">{getArmyCommandSymbol('support')}</span>
                  </span>{' '}
                  {support.targetName}
                </td>
                <td>{renderUnitAmountBadges(support.units, `support-${support.id}`)}</td>
                <td>
                  <button
                    className="secondary-action recruit-action"
                    onClick={() => onReturnSupport(support.id)}
                    disabled={isArmyCommandPending}
                  >
                    Návrat
                  </button>
                </td>
              </tr>
            ))}
            {stationedSupportsForVillage.length === 0 ? (
              <tr>
                <td colSpan={4}>Žádná stacionovaná podpora.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const ResearchPanel = () => (
  <div className="panel-stack">
    <section>
      <h3>Univerzita - úroveň 2</h3>
      <p>Aktivní akademici: 3 / 4. Výzkum je účetní (platný pro celý účet).</p>
      <div className="research-list">
        {RESEARCH_TASKS.map((task) => (
          <article key={task.name}>
            <header>
              <strong>{task.name}</strong>
              <span>{task.eta}</span>
            </header>
            <div className="progress-track" role="progressbar" aria-valuenow={task.progress}>
              <span style={{ width: `${task.progress}%` }} />
            </div>
            <p>{task.progress}% dokončeno · akademici: {task.academics}</p>
          </article>
        ))}
      </div>
    </section>
  </div>
);

type BattleUnitSnapshot = {
  start?: Record<string, number>;
  losses?: Record<string, number>;
  survivors?: Record<string, number>;
  survivorsTotal?: number;
};

type BattleUnitRow = {
  unitId: string;
  start: number;
  losses: number;
  survivors: number;
};

type BattleOutcomeTone = 'victory' | 'defeat' | 'neutral';

const isCommandUnitId = (unitId: string): unitId is CommandUnitId =>
  COMMAND_UNIT_ORDER.includes(unitId as CommandUnitId);

const normalizeBattleAmount = (value: number | undefined): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
};

const sumBattleSelection = (selection?: Record<string, number>): number => {
  if (!selection) {
    return 0;
  }
  return Object.values(selection).reduce((sum, amount) => sum + normalizeBattleAmount(amount), 0);
};

const collectBattleUnitRows = (
  start?: Record<string, number>,
  losses?: Record<string, number>,
  survivors?: Record<string, number>,
): BattleUnitRow[] => {
  const ids = new Set<string>();
  for (const source of [start, losses, survivors]) {
    if (!source) {
      continue;
    }
    for (const [unitId, amount] of Object.entries(source)) {
      if (normalizeBattleAmount(amount) > 0) {
        ids.add(unitId);
      }
    }
  }

  const orderedKnown = COMMAND_UNIT_ORDER.filter((unitId) => ids.has(unitId));
  const orderedUnknown = [...ids]
    .filter((unitId) => !isCommandUnitId(unitId))
    .sort((a, b) => a.localeCompare(b, 'cs'));
  const orderedIds = [...orderedKnown, ...orderedUnknown];

  return orderedIds.map((unitId) => ({
    unitId,
    start: normalizeBattleAmount(start?.[unitId]),
    losses: normalizeBattleAmount(losses?.[unitId]),
    survivors: normalizeBattleAmount(survivors?.[unitId]),
  }));
};

const collectSelectionRows = (selection?: Record<string, number>): { unitId: string; amount: number }[] => {
  if (!selection) {
    return [];
  }

  const ids = new Set<string>();
  for (const [unitId, amount] of Object.entries(selection)) {
    if (normalizeBattleAmount(amount) > 0) {
      ids.add(unitId);
    }
  }

  const orderedKnown = COMMAND_UNIT_ORDER.filter((unitId) => ids.has(unitId));
  const orderedUnknown = [...ids]
    .filter((unitId) => !isCommandUnitId(unitId))
    .sort((a, b) => a.localeCompare(b, 'cs'));
  const orderedIds = [...orderedKnown, ...orderedUnknown];

  return orderedIds.map((unitId) => ({
    unitId,
    amount: normalizeBattleAmount(selection[unitId]),
  }));
};

const getBattleOutcomeMeta = (payload: BattleReportPayload): { label: string; tone: BattleOutcomeTone } => {
  const perspective = payload.perspective ?? 'attacker';
  if (payload.outcome === 'attacker_victory') {
    if (perspective === 'attacker') {
      return { label: 'Vítězství', tone: 'victory' };
    }
    return { label: 'Obrana prolomena', tone: 'defeat' };
  }
  if (payload.outcome === 'defender_victory') {
    if (perspective === 'defender') {
      return { label: 'Obrana úspěšná', tone: 'victory' };
    }
    return { label: 'Útok odražen', tone: 'defeat' };
  }
  return { label: 'Střet bez výsledku', tone: 'neutral' };
};

const hasBattleIntel = (payload: BattleReportPayload): boolean =>
  Boolean(
    payload.battle ||
      payload.support ||
      payload.returnMovement ||
      payload.armyDestroyed ||
      (payload.lootTaken &&
        (normalizeBattleAmount(payload.lootTaken.wood) > 0 ||
          normalizeBattleAmount(payload.lootTaken.stone) > 0 ||
          normalizeBattleAmount(payload.lootTaken.iron) > 0)),
  );

const formatBattlePower = (value: number | undefined): string =>
  value == null ? '-' : normalizeBattleAmount(value).toLocaleString('cs-CZ');

const formatBattleMultiplier = (value: number | undefined): string =>
  value == null || !Number.isFinite(value) ? '-' : `${value.toFixed(2)}×`;

const formatBattlePercent = (value: number | undefined): string =>
  value == null || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(1)} %`;

const BattleArmyBreakdownCard = ({
  heading,
  subheading,
  tone,
  snapshot,
  hidden,
  hiddenReason,
}: {
  heading: string;
  subheading?: string;
  tone: 'attacker' | 'defender' | 'support';
  snapshot?: BattleUnitSnapshot;
  hidden?: boolean;
  hiddenReason?: string;
}) => {
  const rows = collectBattleUnitRows(snapshot?.start, snapshot?.losses, snapshot?.survivors);
  const startTotal = sumBattleSelection(snapshot?.start);
  const lossesTotal = sumBattleSelection(snapshot?.losses);
  const survivorsTotalFromSnapshot = Number(snapshot?.survivorsTotal);
  const survivorsTotal = Number.isFinite(survivorsTotalFromSnapshot)
    ? Math.max(0, Math.floor(survivorsTotalFromSnapshot))
    : sumBattleSelection(snapshot?.survivors);

  return (
    <article className={`battle-army-card ${tone}`}>
      <header>
        <h4>{heading}</h4>
        {subheading ? <p>{subheading}</p> : null}
      </header>
      {hidden ? (
        <p className="battle-army-hidden">{hiddenReason ?? 'Průzkum nepřinesl přesné počty.'}</p>
      ) : rows.length === 0 ? (
        <p className="battle-army-hidden">Pro tuto stranu nejsou dostupná jednotková data.</p>
      ) : (
        <>
          <div className="battle-army-kpis">
            <span>
              Start: <strong>{startTotal.toLocaleString('cs-CZ')}</strong>
            </span>
            <span>
              Ztráty: <strong>{lossesTotal.toLocaleString('cs-CZ')}</strong>
            </span>
            <span>
              Přežilo: <strong>{survivorsTotal.toLocaleString('cs-CZ')}</strong>
            </span>
          </div>
          <table className="battle-army-table">
            <thead>
              <tr>
                <th>Jednotka</th>
                <th>Start</th>
                <th>Ztráty</th>
                <th>Přežilo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${heading}-${row.unitId}`}>
                  <td>{UNIT_META[row.unitId]?.fallbackName ?? row.unitId}</td>
                  <td>{row.start.toLocaleString('cs-CZ')}</td>
                  <td>{row.losses.toLocaleString('cs-CZ')}</td>
                  <td>{row.survivors.toLocaleString('cs-CZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
};

const BattleReportPanel = ({ report }: { report: BattleReportItem | null }) => {
  if (!report) {
    return (
      <div className="panel-stack battle-report-view">
        <section>
          <h3>Bitevní hlášení není dostupné</h3>
          <p>Report se nenačetl. Otevři panel Zprávy a obnov seznam.</p>
        </section>
      </div>
    );
  }

  const payload = report.payload;
  const battle = payload.battle;
  const outcomeMeta = getBattleOutcomeMeta(payload);
  const attackerName = payload.attacker ?? 'Neznámý útočník';
  const defenderName = payload.defender ?? 'Neznámý obránce';
  const defenderCardTitle = payload.role === 'support' ? 'Podpora obránce' : `Obránce · ${defenderName}`;
  const defenderSnapshot = payload.role === 'support' ? payload.support : battle?.defender;
  const attackerIsUnknown = payload.attackerForcesUnknown === true && payload.perspective === 'defender';
  const bonuses = battle?.bonuses ?? [];
  const returnMovement = payload.returnMovement;
  const returnRows = collectSelectionRows(returnMovement?.units);
  const lootTaken = returnMovement?.lootTaken ?? payload.lootTaken;
  const lootWood = normalizeBattleAmount(lootTaken?.wood);
  const lootStone = normalizeBattleAmount(lootTaken?.stone);
  const lootIron = normalizeBattleAmount(lootTaken?.iron);
  const totalLoot = lootWood + lootStone + lootIron;
  const attackerLosses = sumBattleSelection(battle?.attacker?.losses);
  const defenderLosses = sumBattleSelection(defenderSnapshot?.losses);
  const hasPowerIntel =
    battle?.baseAttackPower != null ||
    battle?.baseDefensePower != null ||
    battle?.finalAttackPower != null ||
    battle?.finalDefensePower != null;

  return (
    <div className="panel-stack battle-report-view">
      <section className="battle-report-hero">
        <div className="battle-report-title-wrap">
          <p className="battle-report-kicker">War Ledger · Report #{report.id}</p>
          <h3>{report.title}</h3>
          <p>{report.summary}</p>
        </div>
        <div className={`battle-outcome-pill ${outcomeMeta.tone}`}>{outcomeMeta.label}</div>
        <div className="battle-report-meta">
          <span>
            Čas střetu: <strong>{new Date(report.battleAt).toLocaleString('cs-CZ')}</strong>
          </span>
          <span>
            Útočník: <strong>{attackerName}</strong>
          </span>
          <span>
            Obránce: <strong>{defenderName}</strong>
          </span>
          <span>
            Trasa: <strong>{payload.originVillageName ?? 'Neznámý původ'} → {payload.targetVillageName ?? 'Neznámý cíl'}</strong>
          </span>
        </div>
        {payload.armyDestroyed ? <p className="battle-alert">Útočná armáda byla zcela zničena.</p> : null}
      </section>

      <section>
        <h3>Armády ve střetu</h3>
        <div className="battle-frontline-grid">
          <BattleArmyBreakdownCard
            heading={`Útočník · ${attackerName}`}
            subheading={payload.originVillageName}
            tone="attacker"
            snapshot={battle?.attacker}
            hidden={attackerIsUnknown}
            hiddenReason="Obranná strana byla zničena. Přesné počty útočníka nejsou známé."
          />
          <BattleArmyBreakdownCard
            heading={defenderCardTitle}
            subheading={payload.targetVillageName}
            tone={payload.role === 'support' ? 'support' : 'defender'}
            snapshot={defenderSnapshot}
          />
        </div>
      </section>

      <section>
        <h3>Bojová síla a bonusy</h3>
        {hasPowerIntel ? (
          <div className="battle-power-grid">
            <article>
              <span>Základ útok/obrana</span>
              <strong>
                {formatBattlePower(battle?.baseAttackPower)} / {formatBattlePower(battle?.baseDefensePower)}
              </strong>
            </article>
            <article>
              <span>Finální útok/obrana</span>
              <strong>
                {formatBattlePower(battle?.finalAttackPower)} / {formatBattlePower(battle?.finalDefensePower)}
              </strong>
            </article>
            <article>
              <span>Multiplikátor útok/obrana</span>
              <strong>
                {formatBattleMultiplier(battle?.attackMultiplier)} / {formatBattleMultiplier(battle?.defenseMultiplier)}
              </strong>
            </article>
            <article>
              <span>Ztráty útok/obrana</span>
              <strong>
                {attackerLosses.toLocaleString('cs-CZ')} / {defenderLosses.toLocaleString('cs-CZ')}
              </strong>
              <small>
                Poměr: {formatBattlePercent(battle?.attackerLossRatio)} / {formatBattlePercent(battle?.defenderLossRatio)}
              </small>
            </article>
          </div>
        ) : (
          <p>Není dostupný kompletní rozklad síly střetu.</p>
        )}
        {bonuses.length > 0 ? (
          <ul className="battle-bonus-list">
            {bonuses.map((bonus) => (
              <li key={`${report.id}-${bonus}`}>{bonus}</li>
            ))}
          </ul>
        ) : (
          <p>Žádné aktivní bojové bonusy.</p>
        )}
      </section>

      <section>
        <h3>Návrat armády a kořist</h3>
        {returnMovement ? (
          <div className="battle-return-block">
            <p>
              Návrat: <strong>{returnMovement.fromVillageName ?? 'Cíl'} → {returnMovement.toVillageName ?? 'Domov'}</strong>{' '}
              · ETA <strong>{new Date(returnMovement.arriveAt ?? report.createdAt).toLocaleString('cs-CZ')}</strong> ·{' '}
              trvání <strong>{formatDurationLabel(returnMovement.durationSec ?? null)}</strong>
            </p>
            {returnRows.length > 0 ? (
              <table className="battle-return-table">
                <thead>
                  <tr>
                    <th>Vracející se jednotka</th>
                    <th>Počet</th>
                  </tr>
                </thead>
                <tbody>
                  {returnRows.map((row) => (
                    <tr key={`${report.id}-return-${row.unitId}`}>
                      <td>{UNIT_META[row.unitId]?.fallbackName ?? row.unitId}</td>
                      <td>{row.amount.toLocaleString('cs-CZ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="battle-army-hidden">Žádná vracející se armáda nebyla zaznamenána.</p>
            )}
          </div>
        ) : (
          <p>Po bitvě nevznikl návratový přesun (armáda padla nebo nebyly jednotky k návratu).</p>
        )}
        <div className="battle-loot-strip">
          <span>
            Dřevo <strong>{lootWood.toLocaleString('cs-CZ')}</strong>
          </span>
          <span>
            Kámen <strong>{lootStone.toLocaleString('cs-CZ')}</strong>
          </span>
          <span>
            Železo <strong>{lootIron.toLocaleString('cs-CZ')}</strong>
          </span>
          <span>
            Celkem <strong>{totalLoot.toLocaleString('cs-CZ')}</strong>
          </span>
        </div>
      </section>
    </div>
  );
};

const MessagesPanel = ({
  reports,
  incomingInvites,
  selectedReportId,
  loading,
  error,
  actionPending,
  onOpenReport,
  onSetPage,
  onRefresh,
  onAcceptInvite,
  onRejectInvite,
}: {
  reports: BattleReportListResponse | null;
  incomingInvites: KingdomIncomingInvite[];
  selectedReportId: number | null;
  loading: boolean;
  error: string | null;
  actionPending: boolean;
  onOpenReport: (reportId: number) => void;
  onSetPage: (page: number) => void;
  onRefresh: () => void;
  onAcceptInvite: (inviteId: number) => void;
  onRejectInvite: (inviteId: number) => void;
}) => {
  const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null);
  const page = reports?.page ?? 1;
  const totalPages = reports?.totalPages ?? 1;
  const total = reports?.total ?? 0;
  const items = reports?.items ?? [];
  const selectedInvite = incomingInvites.find((invite) => invite.id === selectedInviteId) ?? incomingInvites[0] ?? null;
  const selectedReport =
    items.find((item) => item.id === selectedReportId) ??
    (selectedReportId == null ? items[0] ?? null : null);
  const warNoticeCount = total;
  const communicationUnreadCount = incomingInvites.length;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="panel-stack messages">
      <section>
        <div className="messages-header">
          <h3>Bitevní reporty</h3>
          <button className="secondary-action" onClick={onRefresh} disabled={loading}>
            {loading ? 'Načítám...' : 'Obnovit'}
          </button>
        </div>
        <div className="messages-pagination">
          <button onClick={() => onSetPage(1)} disabled={!canGoPrev || loading}>
            První
          </button>
          <button onClick={() => onSetPage(page - 1)} disabled={!canGoPrev || loading}>
            Předchozí
          </button>
          <span>
            Strana {page} / {totalPages} · Celkem {total}
          </span>
          <button onClick={() => onSetPage(page + 1)} disabled={!canGoNext || loading}>
            Další
          </button>
          <button onClick={() => onSetPage(totalPages)} disabled={!canGoNext || loading}>
            Poslední
          </button>
        </div>
        {error ? <p className="panel-feedback">{error}</p> : null}
        <div className="messages-signal-strip" aria-label="Stav notifikací">
          <article className={`messages-signal-chip ${warNoticeCount > 0 ? 'is-active' : 'is-idle'}`}>
            <span className="messages-signal-icon" aria-hidden="true">
              ⚔
            </span>
            <div>
              <p>Nové oznámení</p>
              <small>bitvy, podpory, přesuny</small>
            </div>
            <strong>{warNoticeCount.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className={`messages-signal-chip ${communicationUnreadCount > 0 ? 'is-active' : 'is-idle'}`}>
            <span className="messages-signal-icon" aria-hidden="true">
              ✉
            </span>
            <div>
              <p>Komunikace</p>
              <small>zprávy od hráčů</small>
            </div>
            <strong>{communicationUnreadCount.toLocaleString('cs-CZ')}</strong>
          </article>
        </div>
        <div className="messages-invite-block">
          <h4>Pozvánky do království</h4>
          {incomingInvites.length > 0 ? (
            <ul className="messages-report-list">
              {incomingInvites.map((invite) => (
                <li key={`messages-invite-${invite.id}`}>
                  <button
                    type="button"
                    className={`messages-report-item kingdom-invite ${
                      selectedInvite?.id === invite.id ? 'is-active' : ''
                    }`}
                    onClick={() => setSelectedInviteId(invite.id)}
                    disabled={actionPending}
                  >
                    <strong>Pozvánka do království {invite.kingdom}</strong>
                    <span>Poslal: {invite.inviterUsername}</span>
                    <small>
                      {new Date(invite.createdAt).toLocaleString('cs-CZ')} · Klikni pro rozhodnutí ↗
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Zatím nemáš žádnou aktivní pozvánku.</p>
          )}
        </div>
        <ul className="messages-report-list">
          {items.map((report) => {
            const outcomeMeta = getBattleOutcomeMeta(report.payload);
            const intelKnown = hasBattleIntel(report.payload);
            return (
              <li key={report.id}>
                <button
                  className={`messages-report-item war-notice ${selectedReport?.id === report.id ? 'is-active' : ''}`}
                  onClick={() => onOpenReport(report.id)}
                >
                  <div className="messages-report-topline">
                    <span className={`messages-outcome-pill ${outcomeMeta.tone}`}>{outcomeMeta.label}</span>
                    <span className={`messages-intel-pill ${intelKnown ? 'known' : 'limited'}`}>
                      {intelKnown ? 'Detail známý' : 'Omezený intel'}
                    </span>
                  </div>
                  <strong>{report.title}</strong>
                  <span>{report.summary}</span>
                  <small>
                    {new Date(report.createdAt).toLocaleString('cs-CZ')} · Otevřít válečný report ↗
                  </small>
                </button>
              </li>
            );
          })}
          {items.length === 0 && !loading ? <li>Žádné reporty pro tuto stránku.</li> : null}
        </ul>
        <div className="messages-pagination">
          <button onClick={() => onSetPage(1)} disabled={!canGoPrev || loading}>
            První
          </button>
          <button onClick={() => onSetPage(page - 1)} disabled={!canGoPrev || loading}>
            Předchozí
          </button>
          <span>
            Strana {page} / {totalPages} · Celkem {total}
          </span>
          <button onClick={() => onSetPage(page + 1)} disabled={!canGoNext || loading}>
            Další
          </button>
          <button onClick={() => onSetPage(totalPages)} disabled={!canGoNext || loading}>
            Poslední
          </button>
        </div>
      </section>

      <section className="messages-detail">
        <h3>Vybraná pozvánka</h3>
        {selectedInvite ? (
          <div className="messages-detail-card">
            <h4>{selectedInvite.kingdom}</h4>
            <p>
              Pozvánku poslal hráč <strong>{selectedInvite.inviterUsername}</strong>.
            </p>
            <p>Vytvořeno: {new Date(selectedInvite.createdAt).toLocaleString('cs-CZ')}</p>
            <div className="kingdom-inline-actions">
              <button
                type="button"
                className="upgrade-action kingdom-action-button"
                onClick={() => onAcceptInvite(selectedInvite.id)}
                disabled={actionPending}
              >
                Přijmout
              </button>
              <button
                type="button"
                className="secondary-action kingdom-action-button"
                onClick={() => onRejectInvite(selectedInvite.id)}
                disabled={actionPending}
              >
                Odmítnout
              </button>
            </div>
          </div>
        ) : (
          <p>Vyber pozvánku ze seznamu. Pokud žádná není, někdo tě zatím nepozval.</p>
        )}
        <h3>Náhled vybraného reportu</h3>
        {selectedReport ? (
          <div className="messages-detail-card">
            <h4>{selectedReport.title}</h4>
            <p>{selectedReport.summary}</p>
            <p>
              Útočník: <strong>{selectedReport.payload.attacker ?? 'Neznámý'}</strong> · Obránce:{' '}
              <strong>{selectedReport.payload.defender ?? 'Neznámý'}</strong>
            </p>
            <button className="secondary-action" onClick={() => onOpenReport(selectedReport.id)}>
              Otevřít detailní válečný report
            </button>
          </div>
        ) : (
          <p>Vyber hlášení ze seznamu a otevři ho v samostatném okně.</p>
        )}
      </section>
    </div>
  );
};

const KingdomPanel = ({
  kingdomHub,
  currentUsername,
  notice,
  actionPending,
  onCreateKingdom,
  onInvitePlayer,
  onAcceptInvite,
  onRejectInvite,
  onLeaveKingdom,
  onKickMember,
  onOpenPlayerProfile,
  onOpenKingdomProfile,
}: {
  kingdomHub: KingdomHubState | null;
  currentUsername: string;
  notice: string | null;
  actionPending: boolean;
  onCreateKingdom: (kingdomName: string) => void;
  onInvitePlayer: (targetUsername: string) => void;
  onAcceptInvite: (inviteId: number) => void;
  onRejectInvite: (inviteId: number) => void;
  onLeaveKingdom: () => void;
  onKickMember: (targetUsername: string) => void;
  onOpenPlayerProfile: (username: string) => void;
  onOpenKingdomProfile: (kingdomName: string) => void;
}) => {
  const [createKingdomName, setCreateKingdomName] = useState('');
  const [inviteTargetUsername, setInviteTargetUsername] = useState('');
  const [selectedIncomingInviteId, setSelectedIncomingInviteId] = useState<number | null>(null);
  const availableKingdoms: KingdomAvailableSummary[] =
    kingdomHub?.availableKingdoms ?? EMPTY_KINGDOM_AVAILABLE;
  const incomingInvites: KingdomIncomingInvite[] = kingdomHub?.incomingInvites ?? EMPTY_KINGDOM_INVITES;
  const members = kingdomHub?.members ?? EMPTY_KINGDOM_MEMBERS;
  const selectedIncomingInvite =
    incomingInvites.find((invite) => invite.id === selectedIncomingInviteId) ?? incomingInvites[0] ?? null;
  const auditLog = kingdomHub?.auditLog ?? EMPTY_KINGDOM_AUDIT_LOG;
  const currentKingdom = kingdomHub?.isMember ? kingdomHub.kingdom : null;
  const canManageInvites = kingdomHub?.canManageInvites ?? false;
  const isKingdomLeader = kingdomHub?.leaderUsername === currentUsername;
  const totalKingdomPrestige = members.reduce((sum, member) => sum + member.prestige, 0);
  const totalKingdomVillages = members.reduce((sum, member) => sum + member.villages, 0);

  const handleCreateKingdomSubmit = () => {
    const normalizedKingdomName = createKingdomName.trim();
    if (!normalizedKingdomName) {
      return;
    }
    onCreateKingdom(normalizedKingdomName);
  };

  const handleInviteSubmit = () => {
    const normalizedTarget = inviteTargetUsername.trim();
    if (!normalizedTarget) {
      return;
    }

    onInvitePlayer(normalizedTarget);
    setInviteTargetUsername('');
  };

  const handleLeaveClick = () => {
    const confirmed = window.confirm(
      'Opravdu chces odejit z kralovstvi? Budes prepnuty do neutralniho stavu.',
    );
    if (!confirmed) {
      return;
    }
    onLeaveKingdom();
  };

  const handleKickClick = (targetUsername: string) => {
    const confirmed = window.confirm(
      `Opravdu chces vyhodit hrace ${targetUsername} z kralovstvi?`,
    );
    if (!confirmed) {
      return;
    }
    onKickMember(targetUsername);
  };

  if (!kingdomHub) {
    return (
      <div className="panel-stack kingdom-panel">
        <section>
          <h3>Království</h3>
          <p>Načítám data o království...</p>
        </section>
      </div>
    );
  }

  if (!currentKingdom) {
    return (
      <div className="panel-stack kingdom-panel">
        <section>
          <h3>Království</h3>
          <p>
            Tady v žebříčku království najdeš ostatní hráčské skupiny, do kterých se můžeš pokusit
            přidat přes pozvánku od jejich vůdce.
          </p>
          {notice ? <p className="panel-feedback">{notice}</p> : null}
        </section>

        <section>
          <h3>Založit nové království</h3>
          <p>Jestli nejsi v žádném království, můžeš si založit vlastní a stát se jeho vůdcem.</p>
          <div className="kingdom-create-controls">
            <input
              type="text"
              value={createKingdomName}
              onChange={(event) => setCreateKingdomName(event.target.value)}
              onKeyDown={(event) =>
                handleActionOnEnter(event, () => {
                  if (actionPending || createKingdomName.trim().length < 3) {
                    return;
                  }
                  handleCreateKingdomSubmit();
                })
              }
              maxLength={28}
              placeholder="Název království"
              disabled={actionPending}
            />
            <button
              type="button"
              className="upgrade-action kingdom-action-button"
              onClick={handleCreateKingdomSubmit}
              disabled={actionPending || createKingdomName.trim().length < 3}
            >
              Založit království
            </button>
          </div>
        </section>

        <section>
          <h3>Příchozí pozvánky</h3>
          {incomingInvites.length > 0 ? (
            <>
              <ul className="kingdom-invite-list">
                {incomingInvites.map((invite) => (
                  <li key={`incoming-invite-${invite.id}`} className="kingdom-invite-item">
                    <button
                      type="button"
                      className={`kingdom-invite-picker ${
                        selectedIncomingInvite?.id === invite.id ? 'is-active' : ''
                      }`}
                      onClick={() => setSelectedIncomingInviteId(invite.id)}
                      disabled={actionPending}
                    >
                      <strong>{invite.kingdom}</strong>
                      <span>
                        Poslal: {invite.inviterUsername} · {new Date(invite.createdAt).toLocaleString('cs-CZ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedIncomingInvite ? (
                <div className="kingdom-inline-actions">
                  <button
                    type="button"
                    className="upgrade-action kingdom-action-button"
                    onClick={() => onAcceptInvite(selectedIncomingInvite.id)}
                    disabled={actionPending}
                  >
                    Přijmout
                  </button>
                  <button
                    type="button"
                    className="secondary-action kingdom-action-button"
                    onClick={() => onRejectInvite(selectedIncomingInvite.id)}
                    disabled={actionPending}
                  >
                    Odmítnout
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>Zatím nemáš žádnou aktivní pozvánku.</p>
          )}
        </section>

        <section>
          <h3>Žebříček království</h3>
          <table>
            <thead>
              <tr>
                <th>Království</th>
                <th>Prestiž</th>
                <th>Osady</th>
                <th>Členové</th>
              </tr>
            </thead>
            <tbody>
              {availableKingdoms.map((entry) => (
                <tr key={`kingdom-summary-${entry.kingdom}`}>
                  <td>
                    <button
                      type="button"
                      className="ranking-link-button"
                      onClick={() => onOpenKingdomProfile(entry.kingdom)}
                    >
                      {entry.kingdom}
                    </button>
                  </td>
                  <td>{entry.prestige.toLocaleString('cs-CZ')}</td>
                  <td>{entry.villages}</td>
                  <td>{entry.members}</td>
                </tr>
              ))}
              {availableKingdoms.length === 0 ? (
                <tr>
                  <td colSpan={4}>Žádné hráčské království zatím není aktivní.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Audit log (debug)</h3>
          {auditLog.length > 0 ? (
            <ul className="kingdom-audit-list">
              {auditLog.map((entry) => (
                <li key={`kingdom-audit-${entry.id}`} className="kingdom-audit-item">
                  <strong>{entry.message}</strong>
                  <span>{new Date(entry.createdAt).toLocaleString('cs-CZ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Zatím nejsou žádné královské události.</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="panel-stack kingdom-panel">
      <section>
        <h3>Jsi součástí království {currentKingdom}</h3>
        <ul>
          <li>Vůdce: {kingdomHub.leaderUsername ?? 'Neznámý'}</li>
          <li>Počet členů: {members.length}</li>
          <li>Počet osad: {totalKingdomVillages}</li>
          <li>Celková prestiž: {totalKingdomPrestige.toLocaleString('cs-CZ')}</li>
        </ul>
        <button
          type="button"
          className="danger-button kingdom-leave-button"
          onClick={handleLeaveClick}
          disabled={actionPending}
        >
          Odejít z kmene
        </button>
        {notice ? <p className="panel-feedback">{notice}</p> : null}
      </section>

      <section>
        <h3>Členové království</h3>
        <table>
          <thead>
            <tr>
              <th>Hráč</th>
              <th>Prestiž</th>
              <th>Osady</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.username === currentUsername;
              const canKick = canManageInvites && !isSelf;
              return (
                <tr key={`kingdom-member-${member.playerId}`} className={isSelf ? 'is-self' : ''}>
                  <td>
                    <button
                      type="button"
                      className="ranking-link-button"
                      onClick={() => onOpenPlayerProfile(member.username)}
                    >
                      {member.username}
                    </button>
                    {member.isLeader ? <span className="row-help inline">vůdce</span> : null}
                  </td>
                  <td>{member.prestige.toLocaleString('cs-CZ')}</td>
                  <td>{member.villages}</td>
                  <td>
                    {canKick ? (
                      <button
                        type="button"
                        className="secondary-action kingdom-action-button"
                        onClick={() => handleKickClick(member.username)}
                        disabled={actionPending}
                      >
                        Vyhodit
                      </button>
                    ) : (
                      <span className="row-help inline">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {isKingdomLeader ? (
        <section>
          <h3>Pozvat hráče do království</h3>
          <p>Pouze vůdce může posílat pozvánky. Zadej přesný nick hráče a odešli pozvánku.</p>
          <div className="kingdom-invite-controls">
            <input
              type="text"
              value={inviteTargetUsername}
              onChange={(event) => setInviteTargetUsername(event.target.value)}
              onKeyDown={(event) =>
                handleActionOnEnter(event, () => {
                  if (actionPending || inviteTargetUsername.trim().length === 0) {
                    return;
                  }
                  handleInviteSubmit();
                })
              }
              maxLength={32}
              placeholder="Nick hráče"
              disabled={actionPending}
            />
            <button
              type="button"
              className="upgrade-action kingdom-action-button"
              onClick={handleInviteSubmit}
              disabled={actionPending || inviteTargetUsername.trim().length === 0}
            >
              Poslat pozvánku
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h3>Audit log (debug)</h3>
        {auditLog.length > 0 ? (
          <ul className="kingdom-audit-list">
            {auditLog.map((entry) => (
              <li key={`kingdom-audit-${entry.id}`} className="kingdom-audit-item">
                <strong>{entry.message}</strong>
                <span>{new Date(entry.createdAt).toLocaleString('cs-CZ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Zatím nejsou žádné královské události.</p>
        )}
      </section>
    </div>
  );
};

const RankingPanel = ({
  rows,
  currentUsername,
  currentKingdom,
  onOpenPlayerProfile,
  onOpenKingdomProfile,
}: {
  rows: LeaderboardRow[];
  currentUsername: string;
  currentKingdom: string;
  onOpenPlayerProfile: (username: string) => void;
  onOpenKingdomProfile: (kingdomName: string) => void;
}) => {
  const [mode, setMode] = useState<RankingMode>('players');
  const [pageSize, setPageSize] = useState<RankingPageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);

  const kingdomRows = useMemo<KingdomLeaderboardRow[]>(() => {
    const byKingdom = new Map<string, Omit<KingdomLeaderboardRow, 'rank'>>();
    for (const player of rows) {
      if (isNeutralKingdom(player.kingdom)) {
        continue;
      }

      const existing = byKingdom.get(player.kingdom) ?? {
        kingdom: player.kingdom,
        prestige: 0,
        villages: 0,
        members: 0,
      };

      existing.prestige += player.prestige;
      existing.villages += player.villages;
      existing.members += 1;
      byKingdom.set(player.kingdom, existing);
    }

    return [...byKingdom.values()]
      .sort((a, b) => {
        if (b.prestige !== a.prestige) {
          return b.prestige - a.prestige;
        }
        if (b.villages !== a.villages) {
          return b.villages - a.villages;
        }
        if (b.members !== a.members) {
          return b.members - a.members;
        }
        return a.kingdom.localeCompare(b.kingdom, 'cs');
      })
      .map((item, index) => ({
        rank: index + 1,
        kingdom: item.kingdom,
        prestige: item.prestige,
        villages: item.villages,
        members: item.members,
      }));
  }, [rows]);

  const activeRows = mode === 'players' ? rows : kingdomRows;
  const totalRows = activeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const normalizedCurrentPage = clamp(currentPage, 1, totalPages);
  const pageStart = (normalizedCurrentPage - 1) * pageSize;
  const pageRows = activeRows.slice(pageStart, pageStart + pageSize);
  const visibleFrom = totalRows === 0 ? 0 : pageStart + 1;
  const visibleTo = totalRows === 0 ? 0 : Math.min(pageStart + pageSize, totalRows);

  const selfRowIndex = useMemo(() => {
    if (mode === 'players') {
      return rows.findIndex((entry) => entry.username === currentUsername);
    }
    if (isNeutralKingdom(currentKingdom)) {
      return -1;
    }
    return kingdomRows.findIndex((entry) => entry.kingdom === currentKingdom);
  }, [mode, rows, currentUsername, currentKingdom, kingdomRows]);
  const currentPlayerRow = useMemo(
    () => rows.find((entry) => entry.username === currentUsername) ?? null,
    [rows, currentUsername],
  );

  const jumpToTop = () => {
    setCurrentPage(1);
  };

  const jumpToEnd = () => {
    setCurrentPage(totalPages);
  };

  const centerOnSelf = () => {
    if (selfRowIndex < 0) {
      return;
    }
    setCurrentPage(Math.floor(selfRowIndex / pageSize) + 1);
  };

  const bestButtonLabel = mode === 'players' ? 'Ten nejlepší hráč' : 'To nejlepší království';
  const centerButtonLabel =
    mode === 'players' ? 'Vycentruj mě v žebříčku' : 'Vycentruj mě v žebříčku';

  const renderPagination = (placement: 'top' | 'bottom') => (
    <div className={`ranking-pagination ranking-pagination-${placement}`}>
      <div className="ranking-pagination-main">
        <button
          onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
          disabled={normalizedCurrentPage <= 1}
        >
          Předchozí
        </button>
        <span>
          Strana {normalizedCurrentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
          disabled={normalizedCurrentPage >= totalPages}
        >
          Další
        </button>
      </div>
      <div className="ranking-pagination-jumps">
        <button onClick={jumpToTop} disabled={totalRows === 0 || normalizedCurrentPage === 1}>
          {bestButtonLabel}
        </button>
        <button onClick={jumpToEnd} disabled={totalRows === 0 || normalizedCurrentPage === totalPages}>
          Na konec
        </button>
        <button onClick={centerOnSelf} disabled={selfRowIndex < 0}>
          {centerButtonLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="panel-stack ranking-panel">
      <section>
        <h3>Globální žebříček podle prestiže</h3>

        <div className="ranking-toolbar">
          <div className="ranking-mode-switch">
            <button
              className={mode === 'players' ? 'is-active' : ''}
              onClick={() => {
                setMode('players');
                setCurrentPage(1);
              }}
            >
              Žebříček hráčů
            </button>
            <button
              className={mode === 'kingdoms' ? 'is-active' : ''}
              onClick={() => {
                setMode('kingdoms');
                setCurrentPage(1);
              }}
            >
              Žebříček království
            </button>
          </div>

          <span className="ranking-summary-inline">
            Zobrazeno {visibleFrom}-{visibleTo} z {totalRows}{' '}
            {mode === 'players' ? 'hráčů' : 'království'}.
          </span>

          <div className="ranking-limit-switch">
            <button
              className={pageSize === 20 ? 'is-active' : ''}
              onClick={() => {
                setPageSize(20);
                setCurrentPage(1);
              }}
            >
              20 nejlepších
            </button>
            <button
              className={pageSize === 50 ? 'is-active' : ''}
              onClick={() => {
                setPageSize(50);
                setCurrentPage(1);
              }}
            >
              50 nejlepších
            </button>
          </div>
        </div>

        {renderPagination('top')}

        <table>
          <thead>
            {mode === 'players' ? (
              <tr>
                <th>#</th>
                <th>Hráč</th>
                <th>Království</th>
                <th>Prestiž</th>
                <th>Vesnice</th>
              </tr>
            ) : (
              <tr>
                <th>#</th>
                <th>Království</th>
                <th>Prestiž</th>
                <th>Osady</th>
                <th>Členové</th>
              </tr>
            )}
          </thead>
          <tbody>
            {mode === 'players'
              ? pageRows.map((item) => {
                  const playerRow = item as LeaderboardRow;
                  const isSelf = playerRow.username === currentUsername;
                  return (
                    <tr key={playerRow.playerId} className={isSelf ? 'is-self' : ''}>
                      <td>{playerRow.rank}</td>
                      <td>
                        <button
                          className="ranking-link-button"
                          onClick={() => onOpenPlayerProfile(playerRow.username)}
                        >
                          {playerRow.username}
                        </button>
                      </td>
                      <td>
                        <button
                          className="ranking-link-button"
                          onClick={() => onOpenKingdomProfile(playerRow.kingdom)}
                        >
                          {playerRow.kingdom}
                        </button>
                      </td>
                      <td>{playerRow.prestige.toLocaleString('cs-CZ')}</td>
                      <td>{playerRow.villages}</td>
                    </tr>
                  );
                })
              : pageRows.map((item) => {
                  const kingdomRow = item as KingdomLeaderboardRow;
                  const isSelf = kingdomRow.kingdom === currentKingdom;
                  return (
                    <tr key={kingdomRow.kingdom} className={isSelf ? 'is-self' : ''}>
                      <td>{kingdomRow.rank}</td>
                      <td>
                        <button
                          className="ranking-link-button"
                          onClick={() => onOpenKingdomProfile(kingdomRow.kingdom)}
                        >
                          {kingdomRow.kingdom}
                        </button>
                      </td>
                      <td>{kingdomRow.prestige.toLocaleString('cs-CZ')}</td>
                      <td>{kingdomRow.villages}</td>
                      <td>{kingdomRow.members}</td>
                    </tr>
                  );
                })}

            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5}>Žebříček zatím nemá data.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {renderPagination('bottom')}
        <p className="ranking-player-position-note">
          Aktuálně jsi na pozici{' '}
          <strong>{currentPlayerRow ? `#${currentPlayerRow.rank}` : 'N/A'}</strong> mezi hráči.
        </p>
      </section>
    </div>
  );
};

const KingdomProfilePanel = ({
  kingdomName,
  rows,
  settlements,
  currentManagedVillage,
  onOpenPlayerProfile,
}: {
  kingdomName: string;
  rows: LeaderboardRow[];
  settlements: RegionSettlement[];
  currentManagedVillage: {
    name: string;
    coordX: number;
    coordY: number;
    region: number;
  } | null;
  onOpenPlayerProfile: (username: string) => void;
}) => {
  const [view, setView] = useState<'members' | 'villages'>('members');
  const members = useMemo(
    () =>
      rows
        .filter((row) => row.kingdom === kingdomName)
        .sort((a, b) => {
          if (b.prestige !== a.prestige) {
            return b.prestige - a.prestige;
          }
          if (b.villages !== a.villages) {
            return b.villages - a.villages;
          }
          return a.username.localeCompare(b.username, 'cs');
        }),
    [kingdomName, rows],
  );

  const memberSet = useMemo(() => new Set(members.map((member) => member.username)), [members]);
  const visibleSettlements = useMemo(
    () => settlements.filter((settlement) => memberSet.has(settlement.owner)),
    [memberSet, settlements],
  );
  const totalPrestige = members.reduce((sum, member) => sum + member.prestige, 0);
  const totalVillages = members.reduce((sum, member) => sum + member.villages, 0);
  const membersByUsername = useMemo(() => new Map(members.map((member) => [member.username, member])), [members]);
  const groupedVillages = useMemo(() => {
    const bucket = new Map<string, RegionSettlement[]>();
    for (const settlement of visibleSettlements) {
      const list = bucket.get(settlement.owner) ?? [];
      list.push(settlement);
      bucket.set(settlement.owner, list);
    }

    return [...bucket.entries()]
      .sort((a, b) => {
        const aRow = membersByUsername.get(a[0]);
        const bRow = membersByUsername.get(b[0]);
        if (aRow && bRow) {
          return aRow.rank - bRow.rank;
        }
        if (aRow) {
          return -1;
        }
        if (bRow) {
          return 1;
        }
        return a[0].localeCompare(b[0], 'cs');
      })
      .map(([owner, villages]) => ({
        owner,
        villages: [...villages].sort((a, b) => b.prestige - a.prestige),
      }));
  }, [membersByUsername, visibleSettlements]);
  const managedVillageLabel = currentManagedVillage
    ? `${currentManagedVillage.name} (${currentManagedVillage.coordX}|${currentManagedVillage.coordY})`
    : 'Neznámá';

  return (
    <div className="panel-stack kingdom-profile-panel">
      <section>
        <h3>{kingdomName}</h3>
        <ul>
          <li>Počet členů: {members.length}</li>
          <li>Prestiž království: {totalPrestige.toLocaleString('cs-CZ')}</li>
          <li>Počet osad (součet členů): {totalVillages}</li>
          <li>Viditelné osady v regionu: {visibleSettlements.length}</li>
          <li>Aktivně spravovaná osada: {managedVillageLabel}</li>
        </ul>
      </section>
      <section>
        <div className="kingdom-profile-tabs">
          <button
            className={view === 'members' ? 'is-active' : ''}
            onClick={() => setView('members')}
          >
            Členové království
          </button>
          <button
            className={view === 'villages' ? 'is-active' : ''}
            onClick={() => setView('villages')}
          >
            Léna království
          </button>
        </div>

        {view === 'members' ? (
          <>
            <h3>Žebříček členů království</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hráč</th>
                  <th>Prestiž</th>
                  <th>Osady</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr key={`${kingdomName}-${member.username}`}>
                    <td>{index + 1}</td>
                    <td>
                      <button
                        className="ranking-link-button"
                        onClick={() => onOpenPlayerProfile(member.username)}
                      >
                        {member.username}
                      </button>
                    </td>
                    <td>{member.prestige.toLocaleString('cs-CZ')}</td>
                    <td>{member.villages}</td>
                  </tr>
                ))}
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Království zatím nemá žádné členy.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h3>Léna království (seskupeno podle hráče)</h3>
            <div className="kingdom-village-groups">
              {groupedVillages.map((group) => (
                <article key={`${kingdomName}-group-${group.owner}`} className="kingdom-village-group">
                  <header>
                    <button
                      className="ranking-link-button"
                      onClick={() => onOpenPlayerProfile(group.owner)}
                    >
                      {group.owner}
                    </button>
                    <span>{group.villages.length} lén</span>
                  </header>
                  <table>
                    <thead>
                      <tr>
                        <th>Léno</th>
                        <th>Souřadnice</th>
                        <th>Region</th>
                        <th>Prestiž</th>
                        <th>Vzdálenost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.villages.map((village) => {
                        const distance =
                          currentManagedVillage == null
                            ? null
                            : calculateCellDistance(
                                currentManagedVillage.coordX,
                                currentManagedVillage.coordY,
                                village.globalX,
                                village.globalY,
                              );

                        return (
                          <tr key={`${group.owner}-${village.id}`}>
                            <td>{village.name}</td>
                            <td>
                              {village.globalX}|{village.globalY}
                            </td>
                            <td>{village.region}</td>
                            <td>{village.prestige.toLocaleString('cs-CZ')}</td>
                            <td>{distance == null ? '-' : `${distance} polí`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </article>
              ))}
              {groupedVillages.length === 0 ? (
                <p>Království zatím nemá v tomto regionu viditelná léna.</p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const PlayerProfilePanel = ({
  username,
  rows,
  settlements,
  onOpenSettlement,
}: {
  username: string;
  rows: LeaderboardRow[];
  settlements: RegionSettlement[];
  onOpenSettlement: (settlement: RegionSettlement) => void;
}) => {
  const playerRow = useMemo(() => rows.find((row) => row.username === username) ?? null, [rows, username]);
  const villages = useMemo(
    () =>
      settlements
        .filter((settlement) => settlement.owner === username)
        .sort((a, b) => b.prestige - a.prestige),
    [settlements, username],
  );

  return (
    <div className="panel-stack player-profile-panel">
      <section>
        <h3>{username}</h3>
        <ul>
          <li>Království: {playerRow?.kingdom ?? 'Neznámé'}</li>
          <li>Pořadí v globálním žebříčku: {playerRow ? `#${playerRow.rank}` : 'N/A'}</li>
          <li>Prestiž: {(playerRow?.prestige ?? 0).toLocaleString('cs-CZ')}</li>
          <li>Počet lén: {playerRow?.villages ?? villages.length}</li>
        </ul>
      </section>
      <section>
        <h3>Seznam lén hráče</h3>
        <table>
          <thead>
            <tr>
              <th>Léno</th>
              <th>Souřadnice</th>
              <th>Prestiž</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {villages.map((village) => (
              <tr key={`${username}-${village.id}`}>
                <td>{village.name}</td>
                <td>
                  {village.globalX}|{village.globalY}
                </td>
                <td>{village.prestige.toLocaleString('cs-CZ')}</td>
                <td>
                  <button className="ranking-link-button" onClick={() => onOpenSettlement(village)}>
                    Otevřít
                  </button>
                </td>
              </tr>
            ))}
            {villages.length === 0 ? (
              <tr>
                <td colSpan={4}>V tomto regionu nejsou viditelná žádná léna hráče.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const ProfilePanel = ({
  username,
  kingdom,
  prestige,
  villageCount,
  rank,
}: {
  username: string;
  kingdom: string;
  prestige: number;
  villageCount: number;
  rank: number | null;
}) => (
  <div className="panel-stack">
    <section>
      <h3>Profil velitele</h3>
      <ul>
        <li>Jméno: {username}</li>
        <li>Království: {kingdom}</li>
        <li>Počet měst: {villageCount}</li>
        <li>Celková prestiž: {prestige.toLocaleString('cs-CZ')}</li>
        <li>Pořadí v žebříčku: {rank ? `#${rank}` : 'N/A'}</li>
        <li>Poslední aktivita: ekonomický tick backendu</li>
      </ul>
    </section>
  </div>
);

const SettingsPanel = ({
  onLogout,
  onRestartVillageProgress,
  restartPending,
  notice,
}: {
  onLogout: () => void;
  onRestartVillageProgress: () => void;
  restartPending: boolean;
  notice: string | null;
}) => (
  <div className="panel-stack">
    <section>
      <h3>Nastavení účtu</h3>
      <p>
        Můžeš resetovat svůj postup. Všechna aktuální léna se změní na opuštěná a dostaneš nové startovní
        léno.
      </p>
      <button className="danger-button" onClick={onRestartVillageProgress} disabled={restartPending}>
        {restartPending ? 'Resetuji...' : 'Začít znovu'}
      </button>
      {notice ? <p className="panel-feedback">{notice}</p> : null}
      <p>Odhlášení ze session zůstává dostupné níže.</p>
      <button className="danger-button" onClick={onLogout}>
        Odhlásit účet
      </button>
    </section>
  </div>
);

const MapPanel = memo(({
  settlements,
  regionId,
  regionSize,
  regionOriginX,
  regionOriginY,
  focusedSettlementId,
  activeVillageId,
  currentUsername,
  zoomPercent,
  orderMarkersByVillageId,
  onZoomChange,
  onOpenSettlement,
  onPinSettlement,
  onQuickArmyCommand,
  onOpenPlayerProfile,
  onOpenKingdomProfile,
}: {
  settlements: RegionSettlement[];
  regionId: number;
  regionSize: number;
  regionOriginX: number;
  regionOriginY: number;
  focusedSettlementId: string | null;
  activeVillageId: number | null;
  currentUsername: string;
  zoomPercent: number;
  orderMarkersByVillageId: Map<number, SettlementOrderMarkerCounts>;
  onZoomChange: (zoomPercent: number) => void;
  onOpenSettlement: (settlement: RegionSettlement) => void;
  onPinSettlement: (settlement: RegionSettlement, side: PinSide) => void;
  onQuickArmyCommand: (commandType: ArmyCommandSelectableType, settlement: RegionSettlement) => void;
  onOpenPlayerProfile: (username: string) => void;
  onOpenKingdomProfile: (kingdomName: string) => void;
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedSettlementId, setPinnedSettlementId] = useState<string | null>(null);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const miniViewportRef = useRef<HTMLDivElement | null>(null);
  const miniViewportRafRef = useRef<number | null>(null);
  const miniViewportInitializedRef = useRef(false);
  const miniViewportStateRef = useRef({
    leftPct: 0,
    topPct: 0,
    widthPct: 100,
    heightPct: 100,
  });
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const ownSettlement = useMemo(() => {
    if (focusedSettlementId) {
      const focused = settlements.find((settlement) => settlement.id === focusedSettlementId);
      if (focused) {
        return focused;
      }
    }

    return (
      settlements.find((settlement) => settlement.kind === 'own' || settlement.relation === 'self') ?? null
    );
  }, [focusedSettlementId, settlements]);

  const settlementsByCell = useMemo(() => {
    const map = new Map<string, RegionSettlement>();
    for (const settlement of settlements) {
      map.set(`${settlement.localX}|${settlement.localY}`, settlement);
    }
    return map;
  }, [settlements]);

  const settlementsById = useMemo(() => {
    const map = new Map<string, RegionSettlement>();
    for (const settlement of settlements) {
      map.set(settlement.id, settlement);
    }
    return map;
  }, [settlements]);

  const safeHoveredId = hoveredId && settlementsById.has(hoveredId) ? hoveredId : null;
  const safePinnedSettlementId =
    pinnedSettlementId && settlementsById.has(pinnedSettlementId) ? pinnedSettlementId : null;
  const hoveredSettlement = safeHoveredId ? settlementsById.get(safeHoveredId) ?? null : null;
  const pinnedSettlement = safePinnedSettlementId
    ? settlementsById.get(safePinnedSettlementId) ?? null
    : null;
  const previewSettlement = pinnedSettlement ?? hoveredSettlement;
  const isPreviewPinned = pinnedSettlement != null;
  const previewSettlementKind = previewSettlement
    ? getSettlementMapKind(previewSettlement, activeVillageId)
    : null;
  const isPreviewAbandoned = previewSettlementKind === 'abandoned';
  const previewCommandAvailability = useMemo<Record<ArmyCommandSelectableType, boolean>>(() => {
    if (!previewSettlement) {
      return { attack: false, support: false, move: false };
    }

    return {
      attack: canTargetSettlementForArmyCommand({
        settlement: previewSettlement,
        commandType: 'attack',
        currentVillageId: activeVillageId,
        currentUsername,
      }),
      support: canTargetSettlementForArmyCommand({
        settlement: previewSettlement,
        commandType: 'support',
        currentVillageId: activeVillageId,
        currentUsername,
      }),
      move: canTargetSettlementForArmyCommand({
        settlement: previewSettlement,
        commandType: 'move',
        currentVillageId: activeVillageId,
        currentUsername,
      }),
    };
  }, [activeVillageId, currentUsername, previewSettlement]);
  const zoomScale = 1 + zoomPercent / 100;
  const cellSize = Math.max(8, REGION_CELL_SIZE * zoomScale);
  const mapCellGapPx = 2;

  const distanceOriginSettlement = useMemo(() => {
    if (focusedSettlementId) {
      return settlementsById.get(focusedSettlementId) ?? null;
    }
    return ownSettlement;
  }, [focusedSettlementId, ownSettlement, settlementsById]);

  const previewDistanceTiles = useMemo(() => {
    if (!previewSettlement || !distanceOriginSettlement) {
      return null;
    }
    return calculateCellDistance(
      distanceOriginSettlement.globalX,
      distanceOriginSettlement.globalY,
      previewSettlement.globalX,
      previewSettlement.globalY,
    );
  }, [distanceOriginSettlement, previewSettlement]);

  const previewCardPlacement = useMemo(() => {
    if (!previewSettlement) {
      return 'placement-right-above';
    }
    const horizontal = previewSettlement.localX > regionSize - 4 ? 'left' : 'right';
    const vertical = previewSettlement.localY <= 4 ? 'below' : 'above';
    return `placement-${horizontal}-${vertical}`;
  }, [previewSettlement, regionSize]);

  const previewCardStyle = useMemo<CSSProperties | null>(() => {
    if (!previewSettlement) {
      return null;
    }
    const anchorX =
      (previewSettlement.localX - 1) * (cellSize + mapCellGapPx) + cellSize / 2;
    const anchorY =
      (previewSettlement.localY - 1) * (cellSize + mapCellGapPx) + cellSize / 2;

    return {
      '--map-preview-anchor-x': `${anchorX}px`,
      '--map-preview-anchor-y': `${anchorY}px`,
    } as CSSProperties;
  }, [cellSize, previewSettlement]);

  const updateMiniViewportImmediate = useCallback(() => {
    const wrap = gridWrapRef.current;
    if (!wrap) {
      return;
    }

    const scrollWidth = Math.max(1, wrap.scrollWidth);
    const scrollHeight = Math.max(1, wrap.scrollHeight);
    const clientWidth = Math.max(1, wrap.clientWidth);
    const clientHeight = Math.max(1, wrap.clientHeight);

    const widthPct = clamp((clientWidth / scrollWidth) * 100, 5, 100);
    const heightPct = clamp((clientHeight / scrollHeight) * 100, 5, 100);
    const leftPct = clamp((wrap.scrollLeft / scrollWidth) * 100, 0, 100 - widthPct);
    const topPct = clamp((wrap.scrollTop / scrollHeight) * 100, 0, 100 - heightPct);

    const nextViewport = {
      leftPct,
      topPct,
      widthPct,
      heightPct,
    };
    const previousViewport = miniViewportStateRef.current;
    const hasMeaningfulDelta =
      Math.abs(previousViewport.leftPct - nextViewport.leftPct) >= 0.05 ||
      Math.abs(previousViewport.topPct - nextViewport.topPct) >= 0.05 ||
      Math.abs(previousViewport.widthPct - nextViewport.widthPct) >= 0.05 ||
      Math.abs(previousViewport.heightPct - nextViewport.heightPct) >= 0.05;

    if (!hasMeaningfulDelta && miniViewportInitializedRef.current) {
      return;
    }

    miniViewportStateRef.current = nextViewport;
    const viewportNode = miniViewportRef.current;
    if (viewportNode) {
      miniViewportInitializedRef.current = true;
      viewportNode.style.left = `${nextViewport.leftPct}%`;
      viewportNode.style.top = `${nextViewport.topPct}%`;
      viewportNode.style.width = `${nextViewport.widthPct}%`;
      viewportNode.style.height = `${nextViewport.heightPct}%`;
    }
  }, []);

  const updateMiniViewport = useCallback(() => {
    if (miniViewportRafRef.current != null) {
      return;
    }

    miniViewportRafRef.current = window.requestAnimationFrame(() => {
      miniViewportRafRef.current = null;
      updateMiniViewportImmediate();
    });
  }, [updateMiniViewportImmediate]);

  const applyZoom = useCallback(
    (nextZoomPercent: number, anchor?: { clientX: number; clientY: number }) => {
      const normalizedNext = normalizeMapZoom(nextZoomPercent);
      if (normalizedNext === zoomPercent) {
        return;
      }

      const wrap = gridWrapRef.current;
      if (!wrap) {
        onZoomChange(normalizedNext);
        return;
      }

      const rect = wrap.getBoundingClientRect();
      const fallbackAnchor = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      const anchorPoint = anchor ?? fallbackAnchor;
      const anchorOffsetX = anchorPoint.clientX - rect.left;
      const anchorOffsetY = anchorPoint.clientY - rect.top;
      const worldX = wrap.scrollLeft + anchorOffsetX;
      const worldY = wrap.scrollTop + anchorOffsetY;
      const prevScale = 1 + zoomPercent / 100;
      const nextScale = 1 + normalizedNext / 100;
      const scaleFactor = nextScale / prevScale;

      onZoomChange(normalizedNext);

      window.requestAnimationFrame(() => {
        const nextWrap = gridWrapRef.current;
        if (!nextWrap) {
          return;
        }

        nextWrap.scrollLeft = worldX * scaleFactor - anchorOffsetX;
        nextWrap.scrollTop = worldY * scaleFactor - anchorOffsetY;
        updateMiniViewport();
      });
    },
    [onZoomChange, updateMiniViewport, zoomPercent],
  );

  const centerOnSettlement = useCallback(
    (settlementId: string | null, behavior: ScrollBehavior = 'auto') => {
      if (!settlementId) {
        return;
      }

      const wrap = gridWrapRef.current;
      if (!wrap) {
        return;
      }

      const target = wrap.querySelector(`[data-settlement-id="${settlementId}"]`) as HTMLElement | null;
      if (!target) {
        return;
      }

      const targetLeft = target.offsetLeft + target.offsetWidth / 2 - wrap.clientWidth / 2;
      const targetTop = target.offsetTop + target.offsetHeight / 2 - wrap.clientHeight / 2;

      wrap.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior,
      });
      updateMiniViewport();
    },
    [updateMiniViewport],
  );

  useEffect(() => {
    const wrap = gridWrapRef.current;
    if (!wrap) {
      return;
    }

    const onScroll = () => updateMiniViewport();
    wrap.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateMiniViewport();

    return () => {
      if (miniViewportRafRef.current != null) {
        window.cancelAnimationFrame(miniViewportRafRef.current);
        miniViewportRafRef.current = null;
      }
      wrap.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [updateMiniViewport]);

  useEffect(() => {
    centerOnSettlement(focusedSettlementId, 'auto');
  }, [centerOnSettlement, focusedSettlementId, settlements.length]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const panState = panStateRef.current;
      const wrap = gridWrapRef.current;
      if (!panState || !wrap) {
        return;
      }

      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;
      wrap.scrollLeft = panState.startLeft - deltaX;
      wrap.scrollTop = panState.startTop - deltaY;
    };

    const finishPan = () => {
      const panState = panStateRef.current;
      const wrap = gridWrapRef.current;
      if (!panState || !wrap) {
        return;
      }

      wrap.classList.remove('panning');
      panStateRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishPan);
    window.addEventListener('pointercancel', finishPan);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishPan);
      window.removeEventListener('pointercancel', finishPan);
    };
  }, []);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.map-settlement-info-card')) {
      return;
    }
    if (target.closest('button.settlement')) {
      return;
    }

    if (pinnedSettlementId != null) {
      setPinnedSettlementId(null);
      setHoveredId(null);
    }

    const wrap = gridWrapRef.current;
    if (!wrap) {
      return;
    }

    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: wrap.scrollLeft,
      startTop: wrap.scrollTop,
    };
    wrap.classList.add('panning');
    event.preventDefault();
  };

  const handleRegionWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP;
    applyZoom(zoomPercent + delta, { clientX: event.clientX, clientY: event.clientY });
  };

  const jumpToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const miniMap = miniMapRef.current;
      const wrap = gridWrapRef.current;
      if (!miniMap || !wrap) {
        return;
      }

      const rect = miniMap.getBoundingClientRect();
      const ratioX = clamp((clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((clientY - rect.top) / rect.height, 0, 1);

      wrap.scrollLeft = ratioX * wrap.scrollWidth - wrap.clientWidth / 2;
      wrap.scrollTop = ratioY * wrap.scrollHeight - wrap.clientHeight / 2;
    },
    [],
  );

  const handleMinimapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    jumpToMinimapPoint(event.clientX, event.clientY);
  };

  const regionGridCells = useMemo(
    () =>
      Array.from({ length: regionSize * regionSize }, (_, index) => {
        const localX = (index % regionSize) + 1;
        const localY = Math.floor(index / regionSize) + 1;
        const settlement = settlementsByCell.get(`${localX}|${localY}`);

        if (!settlement) {
          return <div key={`${localX}-${localY}`} className="region-cell" />;
        }

        const markerState =
          settlement.villageId != null
            ? orderMarkersByVillageId.get(Number(settlement.villageId)) ?? null
            : null;
        const coverageCommandTypes = markerState
          ? MAP_ORDER_COMMAND_TYPES.filter((commandType) => Number(markerState[commandType] ?? 0) > 0)
          : [];

        return (
          <button
            key={settlement.id}
            className={`region-cell settlement ${getSettlementMapKind(settlement, activeVillageId)} ${focusedSettlementId === settlement.id ? 'focused' : ''}`}
            data-settlement-id={settlement.id}
            onMouseEnter={() =>
              setHoveredId((previous) => (previous === settlement.id ? previous : settlement.id))
            }
            onMouseLeave={() =>
              setHoveredId((previous) => (previous === settlement.id ? null : previous))
            }
            onFocus={() =>
              setHoveredId((previous) => (previous === settlement.id ? previous : settlement.id))
            }
            onBlur={() => setHoveredId((previous) => (previous === settlement.id ? null : previous))}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setPinnedSettlementId(settlement.id);
              setHoveredId(settlement.id);
            }}
            title={`${settlement.name} (${settlement.globalX}|${settlement.globalY})`}
          >
            {coverageCommandTypes.length > 0 ? (
              <div className="settlement-order-coverage" aria-hidden="true">
                {coverageCommandTypes.map((commandType, index) => (
                  <span
                    key={`${settlement.id}-coverage-${commandType}`}
                    className={`coverage-dot ${commandType} layer-${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
            <span className="settlement-core-dot" />
            {markerState ? (
              <div className="settlement-order-icons" aria-hidden="true">
                {MAP_ORDER_COMMAND_TYPES.map((commandType) => {
                  const markerCount = Number(markerState[commandType] ?? 0);
                  if (markerCount <= 0) {
                    return null;
                  }

                  const symbol = getArmyCommandSymbol(commandType);

                  return (
                    <span
                      key={`${settlement.id}-${commandType}`}
                      className={`settlement-order-icon ${commandType}`}
                      title={`${MAP_ORDER_ICON_LABELS[commandType]}${markerCount > 1 ? ` x${markerCount}` : ''}`}
                    >
                      <span className="symbol">{symbol}</span>
                      {markerCount > 1 ? <small>{markerCount}</small> : null}
                    </span>
                  );
                })}
                {Number(markerState.knightAttack ?? 0) > 0 ? (
                  <span
                    className="settlement-order-icon knight-attack"
                    title={`Rytířský útok${Number(markerState.knightAttack) > 1 ? ` x${Number(markerState.knightAttack)}` : ''}`}
                  >
                    <span className="symbol">♞</span>
                    {Number(markerState.knightAttack) > 1 ? <small>{Number(markerState.knightAttack)}</small> : null}
                  </span>
                ) : null}
              </div>
            ) : null}
          </button>
        );
      }),
    [
      activeVillageId,
      focusedSettlementId,
      orderMarkersByVillageId,
      regionSize,
      settlementsByCell,
    ],
  );

  const miniMapDots = useMemo(
    () =>
      settlements.map((settlement) => (
        <span
          key={`mini-${settlement.id}`}
          className={`mini-map-dot ${getSettlementMapKind(settlement, activeVillageId)} ${focusedSettlementId === settlement.id ? 'focused' : ''}`}
          style={{
            left: `${((settlement.localX - 0.5) / regionSize) * 100}%`,
            top: `${((settlement.localY - 0.5) / regionSize) * 100}%`,
          }}
          aria-hidden="true"
        />
      )),
    [activeVillageId, focusedSettlementId, regionSize, settlements],
  );

  return (
    <div className="map-panel">
      <section className="map-header">
        <div>
          <h3>
            Region {regionId} - mřížka {regionSize}x{regionSize}
          </h3>
          <p>
            Rozsah regionu: {regionOriginX}|{regionOriginY} až {regionOriginX + regionSize - 1}|
            {regionOriginY + regionSize - 1}
          </p>
        </div>
        {ownSettlement ? (
          <div className="map-header-actions">
            <button onClick={() => centerOnSettlement(ownSettlement.id, 'smooth')}>Centrovat</button>
            <button onClick={() => onOpenSettlement(ownSettlement)}>Otevřít moje město</button>
          </div>
        ) : null}
      </section>

      <section className="map-legend">
        <span className="legend active">Aktuální osada</span>
        <span className="legend own">Moje osada</span>
        <span className="legend player">Osada hráče</span>
        <span className="legend bot">Královská / spojenecká osada</span>
        <span className="legend abandoned">Opuštěná</span>
      </section>

      <div className="map-workspace">
        <div
          className="region-grid-wrap"
          ref={gridWrapRef}
          onPointerDown={handleGridPointerDown}
          onWheel={handleRegionWheel}
        >
          <div
            className="region-grid"
            style={{
              gridTemplateColumns: `repeat(${regionSize}, ${cellSize}px)`,
            }}
          >
            {regionGridCells}
            {previewSettlement && previewCardStyle ? (
              <article
                className={`map-settlement-info-card ${previewCardPlacement} ${isPreviewPinned ? 'is-pinned' : 'is-hover'}`}
                style={previewCardStyle}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <header>
                  <h4>
                    {previewSettlement.name} ({previewSettlement.globalX}|{previewSettlement.globalY})
                  </h4>
                  <small>Region {previewSettlement.region}</small>
                </header>
                <div className="map-settlement-info-body">
                  {isPreviewPinned ? (
                    isPreviewAbandoned ? (
                      <button
                        type="button"
                        className="map-settlement-link abandoned"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenSettlement(previewSettlement);
                        }}
                      >
                        Opuštěná osada - otevřít profil
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="map-settlement-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPlayerProfile(previewSettlement.owner);
                        }}
                      >
                        {previewSettlement.owner}
                      </button>
                    )
                  ) : (
                    <p className="map-settlement-owner">{previewSettlement.owner}</p>
                  )}
                  <p className="map-settlement-prestige">
                    Prestiž <strong>{previewSettlement.prestige.toLocaleString('cs-CZ')}</strong>
                  </p>
                  {isPreviewPinned ? (
                    <button
                      type="button"
                      className="map-settlement-link kingdom"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenKingdomProfile(previewSettlement.kingdom);
                      }}
                    >
                      {previewSettlement.kingdom}
                    </button>
                  ) : (
                    <p className="map-settlement-kingdom">{previewSettlement.kingdom}</p>
                  )}
                  <p className="map-settlement-distance">
                    Vzdálenost <strong>{previewDistanceTiles == null ? '-' : `${previewDistanceTiles} polí`}</strong>
                  </p>
                </div>
                {isPreviewPinned ? (
                  <>
                    <div className="map-settlement-action-grid">
                      {MAP_ORDER_COMMAND_TYPES.map((commandType) => (
                        <button
                          key={`${previewSettlement.id}-${commandType}-quick`}
                          type="button"
                          className={`secondary-action map-settlement-action ${commandType}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!previewCommandAvailability[commandType]) {
                              return;
                            }
                            onQuickArmyCommand(commandType, previewSettlement);
                          }}
                          disabled={!previewCommandAvailability[commandType]}
                          title={
                            previewCommandAvailability[commandType]
                              ? `${ARMY_COMMAND_LABELS[commandType]} z aktivního léna`
                              : 'Tato akce není pro zvolenou osadu dostupná'
                          }
                        >
                          <span className="symbol">{getArmyCommandSymbol(commandType)}</span>{' '}
                          {commandType === 'attack'
                            ? 'Zaútočit'
                            : commandType === 'support'
                              ? 'Podpořit'
                              : 'Přesunout jednotky'}
                        </button>
                      ))}
                    </div>
                    <div className="map-settlement-pin-controls">
                      <span>Zapinovat osadu</span>
                      <button
                        type="button"
                        className="map-settlement-pin-arrow"
                        title="Zapinovat osadu vlevo"
                        aria-label="Zapinovat osadu vlevo"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPinSettlement(previewSettlement, 'left');
                        }}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="map-settlement-pin-arrow"
                        title="Zapinovat osadu vpravo"
                        aria-label="Zapinovat osadu vpravo"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPinSettlement(previewSettlement, 'right');
                        }}
                      >
                        →
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            ) : null}
          </div>
        </div>

        <section className="map-navigation">
          <div className="mini-map-shell">
            <h4>Minimapa</h4>
            <div
              className="mini-map"
              ref={miniMapRef}
              onPointerDown={handleMinimapPointerDown}
              role="button"
              aria-label="Minimapa pro rychlou navigaci"
              tabIndex={0}
            >
              {miniMapDots}
              <div
                className="mini-map-viewport"
                ref={miniViewportRef}
              />
            </div>
            <div className="map-zoom-controls">
              <label htmlFor="map-zoom-range">
                Měřítko: {zoomPercent > 0 ? `+${zoomPercent}` : zoomPercent}%
              </label>
              <input
                id="map-zoom-range"
                type="range"
                min={MAP_ZOOM_MIN}
                max={MAP_ZOOM_MAX}
                step={MAP_ZOOM_STEP}
                value={zoomPercent}
                onChange={(event) => applyZoom(Number(event.target.value))}
              />
              <div className="map-zoom-buttons">
                <button onClick={() => applyZoom(0)}>0</button>
                <button onClick={() => applyZoom(MAP_ZOOM_MAX)}>+50%</button>
                <button onClick={() => applyZoom(MAP_ZOOM_MIN)}>-50%</button>
              </div>
            </div>
          </div>
          <div className="map-nav-hint">
            <p>Zoom mapy: kolečko myši po 10 %. Rozsah je od -50 % do +50 %.</p>
            <p>Značky rozkazů: <strong className="order-legend attack">⌖ útok</strong>, <strong className="order-legend support">🛡 podpora</strong>, <strong className="order-legend move">➜ přesun</strong>, <strong className="order-legend knight">♞ rytířský útok</strong>.</p>
            <p>Klik na osadu kartu zakotví, klik do mapy ji odkotví.</p>
          </div>
        </section>
      </div>
    </div>
  );
});

const VillagePanel = memo(({
  settlement,
  activeVillageId,
  currentVillageId,
  currentVillageName,
  currentUsername,
  units,
  activeMovements,
  stationedSupports,
  isArmyCommandPending,
  commandNotice,
  onOpenCity,
  onIssueArmyCommand,
  onReturnSupport,
}: {
  settlement: RegionSettlement;
  activeVillageId: number | null;
  currentVillageId: number | null;
  currentVillageName: string;
  currentUsername: string;
  units: Unit[];
  activeMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  isArmyCommandPending: boolean;
  commandNotice: string | null;
  onOpenCity: () => void;
  onIssueArmyCommand: (payload: {
    commandType: Extract<ArmyCommandType, 'attack' | 'support' | 'move'>;
    targetVillageId: number;
    lootPriority?: LootPriority;
    units: Record<string, number>;
  }) => void;
  onReturnSupport: (supportMovementId: number) => void;
}) => {
  const settlementKind = getSettlementMapKind(settlement, activeVillageId);
  const [draftUnitAmounts, setDraftUnitAmounts] = useState<Record<string, string>>({});
  const [attackLootPriority, setAttackLootPriority] = useState<LootPriority>('wood');
  const normalizedUsername = currentUsername.trim().toLowerCase();
  const targetVillageId =
    settlement.villageId != null && Number.isFinite(settlement.villageId)
      ? Number(settlement.villageId)
      : null;
  const isSameAsCurrentVillage =
    targetVillageId != null && currentVillageId != null && targetVillageId === currentVillageId;
  const isOwnTarget =
    settlement.kind === 'own' ||
    settlement.relation === 'self' ||
    settlement.owner.trim().toLowerCase() === normalizedUsername;
  const isAlliedTarget = settlement.relation === 'ally';
  const availableCommandTypes = useMemo<Extract<ArmyCommandType, 'attack' | 'support' | 'move'>[]>(
    () => {
      if (targetVillageId == null || isSameAsCurrentVillage) {
        return [];
      }

      if (isOwnTarget) {
        return ['move', 'support'];
      }

      if (isAlliedTarget) {
        return ['support'];
      }

      return ['attack'];
    },
    [isAlliedTarget, isOwnTarget, isSameAsCurrentVillage, targetVillageId],
  );
  const selectedUnits = useMemo(() => {
    return buildSelectedUnitsFromDraft(units, draftUnitAmounts);
  }, [draftUnitAmounts, units]);
  const selectedUnitCount = useMemo(
    () => calculateTotalUnitsInSelection(selectedUnits),
    [selectedUnits],
  );
  const selectedCaravanCount = Number(selectedUnits.caravan ?? 0);
  const villageAttackPower = useMemo(() => calculateAttackPowerFromSelection(selectedUnits), [selectedUnits]);
  const villageDefensePower = useMemo(() => calculateDefensePowerFromSelection(selectedUnits), [selectedUnits]);
  const villageHasRamAttackBonus = Number(selectedUnits.ram ?? 0) > 0;
  const villageAttackPowerWithBonus = villageHasRamAttackBonus
    ? Math.round(villageAttackPower * RAM_ATTACK_BONUS_MULTIPLIER)
    : villageAttackPower;
  const villageLootCapacity = selectedCaravanCount * CARAVAN_LOOT_CAPACITY;
  const supportWithCaravansSelected = selectedCaravanCount > 0;
  const supportMovementsAtSettlement = useMemo(
    () =>
      targetVillageId == null
        ? []
        : stationedSupports.filter((movement) => Number(movement.targetVillageId) === targetVillageId),
    [stationedSupports, targetVillageId],
  );
  const activeMovementsAtSettlement = useMemo(
    () =>
      targetVillageId == null
        ? []
        : activeMovements.filter(
            (movement) =>
              Number(movement.targetVillageId) === targetVillageId ||
              Number(movement.originVillageId) === targetVillageId,
          ),
    [activeMovements, targetVillageId],
  );
  const canViewSettlementActions = activeMovementsAtSettlement.length > 0 || supportMovementsAtSettlement.length > 0;
  const handleDraftAmountChange = (unitId: string, value: string) => {
    setDraftUnitAmounts((previous) => ({
      ...previous,
      [unitId]: value,
    }));
  };
  const handleIssueVillageCommand = (commandType: Extract<ArmyCommandType, 'attack' | 'support' | 'move'>) => {
    if (targetVillageId == null || selectedUnitCount <= 0) {
      return;
    }
    if (commandType === 'support' && supportWithCaravansSelected) {
      return;
    }

    onIssueArmyCommand({
      commandType,
      targetVillageId,
      lootPriority: commandType === 'attack' ? attackLootPriority : undefined,
      units: selectedUnits,
    });
    setDraftUnitAmounts({});
  };

  return (
    <div className="panel-stack village-panel">
      <section>
        <h3>
          {settlement.name} ({settlement.globalX}|{settlement.globalY})
        </h3>
        <p>{settlement.note}</p>
        <ul>
          <li>Typ osady: {settlementKindLabel[settlementKind]}</li>
          <li>Vlastník: {settlement.owner}</li>
          <li>Království: {settlement.kingdom}</li>
          <li>Region: {settlement.region}</li>
          <li>Prestiž: {settlement.prestige.toLocaleString('cs-CZ')}</li>
          <li>
            {settlementKind === 'own' || settlementKind === 'active'
              ? `Oddanost: ${settlement.loyalty}%`
              : 'Oddanost: skryto'}
          </li>
        </ul>
      </section>

      <section>
        <h3>Průzkumné informace</h3>
        {settlementKind === 'own' || settlementKind === 'active' ? (
          <>
            <p>Jde o tvoji osadu. Přepni se do plného městského managementu.</p>
            <button className="upgrade-action" onClick={onOpenCity}>
              Otevřít městský panel
            </button>
          </>
        ) : (
          <ul>
            <li>Veřejná data: souřadnice, vlastník, království, prestiž.</li>
            <li>Skrytá data: přesné počty jednotek a úrovně budov.</li>
            <li>Doporučení: před útokem poslat průzkum nebo podporu spojence.</li>
          </ul>
        )}
      </section>
      <section>
        <h3>Vojenské akce z aktivní osady</h3>
        <p>
          Zdroj jednotek: <strong>{currentVillageName}</strong>
        </p>
        {targetVillageId == null ? (
          <p>Tato osada nemá validní cílový identifikátor. Rozkazy nelze odeslat.</p>
        ) : isSameAsCurrentVillage ? (
          <p>Jsi v této osadě. Pro přesun nebo útok otevři jiné léno na mapě.</p>
        ) : (
          <>
            <div className="army-draft-grid village-action-draft">
              {units.map((unit) => (
                <label key={`village-draft-${settlement.id}-${unit.id}`}>
                  <span>
                    {unit.name}{' '}
                    <small className="row-help inline">k dispozici: {unit.amount.toLocaleString('cs-CZ')}</small>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={unit.amount}
                    step={1}
                    value={draftUnitAmounts[unit.id] ?? ''}
                    onChange={(event) => handleDraftAmountChange(unit.id, event.target.value)}
                    onKeyDown={(event) => {
                      handleActionOnEnter(event, () => {
                        if (availableCommandTypes.length !== 1) {
                          return;
                        }
                        handleIssueVillageCommand(availableCommandTypes[0]);
                      });
                    }}
                    disabled={isArmyCommandPending}
                  />
                </label>
              ))}
            </div>
            <div className="army-command-preview">
              <p>
                Vybráno jednotek: <strong>{selectedUnitCount.toLocaleString('cs-CZ')}</strong>
              </p>
              <p>
                Síla útoku: <strong>{villageAttackPowerWithBonus.toLocaleString('cs-CZ')}</strong>{' '}
                {villageHasRamAttackBonus ? <span>(+10 % bez brány)</span> : null}
              </p>
              <p>
                Síla obrany: <strong>{villageDefensePower.toLocaleString('cs-CZ')}</strong>
              </p>
              <p>
                Kapacita kořisti (karavany): <strong>{villageLootCapacity.toLocaleString('cs-CZ')}</strong>
              </p>
            </div>
            <div className="village-action-buttons">
              {availableCommandTypes.map((commandType) => (
                <button
                  key={`${settlement.id}-${commandType}`}
                  className={`secondary-action village-action-btn ${commandType}`}
                  onClick={() => handleIssueVillageCommand(commandType)}
                  disabled={
                    isArmyCommandPending ||
                    selectedUnitCount <= 0 ||
                    (commandType === 'support' && supportWithCaravansSelected)
                  }
                >
                  {commandType === 'attack' ? '⌖ ' : commandType === 'support' ? '🛡 ' : '➜ '}
                  {ARMY_COMMAND_LABELS[commandType]}
                </button>
              ))}
            </div>
            {supportWithCaravansSelected && availableCommandTypes.includes('support') ? (
              <p className="panel-feedback">Karavany nelze poslat jako podporu. Odeber je z výběru.</p>
            ) : null}
            {availableCommandTypes.includes('attack') ? (
              <label className="village-loot-priority">
                Priorita drancování
                <select
                  value={attackLootPriority}
                  onChange={(event) => setAttackLootPriority(event.target.value as LootPriority)}
                  disabled={isArmyCommandPending}
                >
                  <option value="wood">{LOOT_PRIORITY_LABELS.wood}</option>
                  <option value="stone">{LOOT_PRIORITY_LABELS.stone}</option>
                  <option value="iron">{LOOT_PRIORITY_LABELS.iron}</option>
                </select>
              </label>
            ) : null}
          </>
        )}
        {selectedUnitCount <= 0 && targetVillageId != null && !isSameAsCurrentVillage ? (
          <p className="panel-feedback">Vyber alespoň jednu jednotku pro odeslání rozkazu.</p>
        ) : null}
        {commandNotice ? <p className="panel-feedback">{commandNotice}</p> : null}
      </section>
      <section>
        <h3>Viditelné akce u osady</h3>
        {canViewSettlementActions ? (
          <ul>
            {activeMovementsAtSettlement.map((movement) => (
              <li key={`movement-${movement.id}`} className="village-action-line">
                <span className={`command-badge ${movement.commandType} compact`}>
                  <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                </span>
                <span>
                  {ARMY_COMMAND_LABELS[movement.commandType]}: {movement.originName} → {movement.targetName} · ETA{' '}
                  {formatDurationLabel(movement.remainingSec)}
                </span>
              </li>
            ))}
            {supportMovementsAtSettlement.map((movement) => (
              <li key={`support-stationed-${movement.id}`} className="village-action-line">
                <span className="command-badge support compact">
                  <span className="symbol">{getArmyCommandSymbol('support')}</span>
                </span>
                <span>
                  Stacionovaná podpora z {movement.originName} ·{' '}
                  {movement.units
                    .map((unit) => `${UNIT_META[unit.unitId]?.fallbackName ?? unit.unitId} ${unit.amount}`)
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Pro tuto osadu aktuálně nevidíš žádné aktivní akce.</p>
        )}
      </section>
      {supportMovementsAtSettlement.length > 0 ? (
        <section>
          <h3>Podpora v osadě</h3>
          <ul>
            {supportMovementsAtSettlement.map((movement) => (
              <li key={`support-${movement.id}`} className="village-support-row">
                <div>
                  Podpora z {movement.originName}:{' '}
                  {movement.units
                    .map((unit) => `${UNIT_META[unit.unitId]?.fallbackName ?? unit.unitId} ${unit.amount}`)
                    .join(', ')}
                </div>
                <button
                  className="secondary-action recruit-action"
                  onClick={() => onReturnSupport(movement.id)}
                  disabled={isArmyCommandPending}
                >
                  Návrat
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
});

const BuildingPanel = memo(({
  building,
  onBackToCity,
  onUpgrade,
  onRecallKnight,
  knightCount,
  isRecallKnightPending,
  isUpgradePending,
  notice,
}: {
  building: Building;
  onBackToCity: () => void;
  onUpgrade: (building: Building) => void;
  onRecallKnight: (() => void) | null;
  knightCount: number;
  isRecallKnightPending: boolean;
  isUpgradePending: boolean;
  notice: string | null;
}) => (
  <div className="panel-stack building-panel">
    <section>
      <h3>{building.name}</h3>
      <p>{building.effect}</p>
      <div className="building-hero-art">
        <img src={building.icon} alt={building.name} loading="lazy" />
      </div>
      <dl className="building-meta-grid">
        <div>
          <dt>Kategorie</dt>
          <dd>{building.category}</dd>
        </div>
        <div>
          <dt>Aktuální úroveň</dt>
          <dd>{building.level}</dd>
        </div>
        <div>
          <dt>Pracovní síla</dt>
          <dd>{building.workers}</dd>
        </div>
        <div>
          <dt>Další náklady</dt>
          <dd>{building.nextCost}</dd>
        </div>
        <div>
          <dt>Čas výstavby</dt>
          <dd>{building.nextTime}</dd>
        </div>
        <div>
          <dt>Stav</dt>
          <dd>
            {building.isInProgress
              ? `Probíhá (${building.nextTime})`
              : building.blockedReason ?? 'Připraveno k upgradu'}
          </dd>
        </div>
      </dl>
      <div className="building-actions">
        <button
          className="upgrade-action"
          onClick={() => onUpgrade(building)}
          disabled={!building.canUpgrade || isUpgradePending}
        >
          {isUpgradePending ? 'Spouštím...' : 'Naplánovat upgrade'}
        </button>
        {building.id === 'townhall' ? (
          <>
            <p className="building-knight-meta">
              Rytíř v osadě: <strong>{Math.max(0, Math.floor(knightCount)).toLocaleString('cs-CZ')}</strong>
            </p>
            <button
              type="button"
              className="secondary-action"
              onClick={() => onRecallKnight?.()}
              disabled={isRecallKnightPending || knightCount <= 0 || onRecallKnight == null}
            >
              {isRecallKnightPending ? 'Odvolávám rytíře...' : 'Odvolat rytíře (+1000 dřevo/kámen/železo)'}
            </button>
          </>
        ) : null}
        {notice ? <p className="panel-feedback">{notice}</p> : null}
        <button className="secondary-action" onClick={onBackToCity}>
          Zpět do města
        </button>
      </div>
    </section>
  </div>
));

export const GamePage = () => {
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);
  const topZ = useRef(40);
  const dragState = useRef<DragState | null>(null);
  const resizeState = useRef<ResizeState | null>(null);
  const mapWindowSizeRef = useRef<WindowSize | null>(readStoredMapWindowSize());
  const panelElementRefs = useRef<Record<string, HTMLElement | null>>({});
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const villageMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const villageMenuOverlayRef = useRef<HTMLDivElement | null>(null);
  const stateRequestPromiseRef = useRef<Promise<void> | null>(null);
  const reportsRequestPromiseRef = useRef<Promise<void> | null>(null);
  const mutationPendingRef = useRef(false);
  const hasStoredPanelLayoutRef = useRef(false);
  const initialAutoStretchAppliedRef = useRef(false);
  const armyQuickSelectionRequestIdRef = useRef(0);
  const username = session?.username ?? 'Hayato';
  const getCanvasViewportSize = useCallback(() => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const viewportWidth = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH + PANEL_VIEWPORT_MARGIN_X,
      Math.floor(bounds?.width ?? window.innerWidth - 16),
    );
    const viewportHeight = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT + PANEL_VIEWPORT_MARGIN_Y,
      Math.floor(bounds?.height ?? window.innerHeight - 120),
    );

    return { viewportWidth, viewportHeight };
  }, []);
  const [selectedOwnSettlementId, setSelectedOwnSettlementId] = useState<string | null>(() =>
    readStoredLastOwnSettlementId(username),
  );
  const [activeVillageId, setActiveVillageId] = useState<number | null>(() =>
    readStoredActiveVillageId(username),
  );
  const [mapZoomPercent, setMapZoomPercent] = useState<number>(() => readStoredMapZoom(username));

  const [panels, setPanels] = useState<PanelWindow[]>(() => {
    const restored = readStoredPanelLayout(username);
    if (restored && restored.length > 0) {
      hasStoredPanelLayoutRef.current = true;
      const highestZ = restored.reduce((maxZ, panel) => Math.max(maxZ, panel.z), 40);
      topZ.current = Math.max(40, highestZ);

      const mapPanel = restored.find((panel) => panel.type === 'map');
      if (mapPanel) {
        mapWindowSizeRef.current = {
          width: mapPanel.width,
          height: mapPanel.height,
        };
      }

      return restored;
    }

    hasStoredPanelLayoutRef.current = false;

    return [createPanelWindow('city', 40, 0)];
  });
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [, setLoadingState] = useState(true);
  const [, setStateError] = useState<string | null>(null);
  const [armyNotice, setArmyNotice] = useState<string | null>(null);
  const [armyNoticeUnitId, setArmyNoticeUnitId] = useState<string | null>(null);
  const [armyCommandNotice, setArmyCommandNotice] = useState<string | null>(null);
  const [recruitPendingUnitId, setRecruitPendingUnitId] = useState<string | null>(null);
  const [cancelRecruitmentPendingId, setCancelRecruitmentPendingId] = useState<number | null>(null);
  const [armyCommandPending, setArmyCommandPending] = useState(false);
  const [upgradePendingBuildingId, setUpgradePendingBuildingId] = useState<string | null>(null);
  const [cancelUpgradePendingOrderId, setCancelUpgradePendingOrderId] = useState<number | null>(null);
  const [recallKnightPending, setRecallKnightPending] = useState(false);
  const [buildingNotices, setBuildingNotices] = useState<Record<string, string>>({});
  const [battleReports, setBattleReports] = useState<BattleReportListResponse | null>(null);
  const [battleReportsLoading, setBattleReportsLoading] = useState(false);
  const [battleReportsError, setBattleReportsError] = useState<string | null>(null);
  const [battleReportsPage, setBattleReportsPage] = useState(1);
  const [selectedBattleReportId, setSelectedBattleReportId] = useState<number | null>(null);
  const [battleReportCacheById, setBattleReportCacheById] = useState<Record<number, BattleReportItem>>({});
  const [kingdomActionPending, setKingdomActionPending] = useState(false);
  const [kingdomNotice, setKingdomNotice] = useState<string | null>(null);
  const [restartVillagePending, setRestartVillagePending] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [isVillageMenuOpen, setVillageMenuOpen] = useState(false);
  const [villageMenuPosition, setVillageMenuPosition] = useState<VillageMenuPosition | null>(null);
  const [armyTargetHistoryByVillageId, setArmyTargetHistoryByVillageId] = useState<ArmyTargetHistoryByVillageId>(
    () => readStoredArmyTargetHistory(username),
  );
  const [armyQuickSelection, setArmyQuickSelection] = useState<ArmyQuickSelection | null>(null);

  useEffect(() => {
    mutationPendingRef.current = Boolean(
      recruitPendingUnitId ||
        cancelRecruitmentPendingId != null ||
        upgradePendingBuildingId ||
        cancelUpgradePendingOrderId != null ||
        armyCommandPending ||
        kingdomActionPending ||
        restartVillagePending ||
        recallKnightPending,
    );
  }, [
    armyCommandPending,
    cancelRecruitmentPendingId,
    cancelUpgradePendingOrderId,
    kingdomActionPending,
    recruitPendingUnitId,
    recallKnightPending,
    restartVillagePending,
    upgradePendingBuildingId,
  ]);

  useEffect(() => {
    setArmyTargetHistoryByVillageId(readStoredArmyTargetHistory(username));
  }, [username]);

  const latestAppliedStateServerTimeMsRef = useRef(0);
  const applyIncomingGameState = useCallback((nextState: GameStateResponse): boolean => {
    const parsedServerTimeMs = Date.parse(nextState.serverTime);
    const nextServerTimeMs = Number.isFinite(parsedServerTimeMs) ? parsedServerTimeMs : Date.now();
    if (nextServerTimeMs < latestAppliedStateServerTimeMsRef.current) {
      return false;
    }

    latestAppliedStateServerTimeMsRef.current = nextServerTimeMs;
    setGameState(nextState);
    setActiveVillageId((previous) => (previous === nextState.village.id ? previous : nextState.village.id));
    setStateError(null);
    return true;
  }, []);

  const buildings = useMemo<Building[]>(() => {
    if (!gameState) {
      return [];
    }

    return gameState.buildings.map((building: GameBuildingState) => {
      const art = BUILDING_ART[building.id];
      const isBuildingInProgress = building.isInProgress && building.remainingSec != null;
      return {
        id: building.id,
        name: art?.fallbackName ?? building.name,
        icon: art?.icon ?? DEFAULT_BUILDING_ICON,
        level: building.level,
        category: art?.fallbackCategory ?? building.category,
        workers: `${building.workersUsed}`,
        effect: building.effect,
        nextCostRaw: building.nextCost,
        nextCost: formatCostLabel(building.nextCost),
        nextTime: isBuildingInProgress
          ? formatDurationLabel(building.remainingSec)
          : formatDurationLabel(building.nextDurationSec),
        canUpgrade: building.canUpgrade,
        blockedReason: building.blockedReason,
        isInProgress: building.isInProgress,
        remainingSec: building.remainingSec,
      };
    });
  }, [gameState]);

  const units = useMemo<Unit[]>(() => {
    if (!gameState) {
      return [];
    }

    return gameState.units.map((unit: GameUnitState) => {
      const unitMeta = getUnitMetaById(unit.id);
      return {
        id: unit.id,
        name: unitMeta?.fallbackName ?? unit.name,
        amount: unit.amount,
        queuedCount: unit.queuedCount ?? 0,
        stationedSupportCount: Math.max(0, Math.floor(Number(unit.stationedSupportCount ?? 0))),
        role: unitMeta?.fallbackRole ?? unit.role,
        cost: formatCostLabel(unit.cost),
        requiredBuildingId: unit.requiredBuildingId,
        requiredBuildingLevel: unit.requiredBuildingLevel,
        canRecruit: unit.canRecruit,
        blockedReason: unit.blockedReason,
        maxRecruitable: unit.maxRecruitable,
      };
    });
  }, [gameState]);

  const currentVillageKnightCount = useMemo(
    () => Math.max(0, Math.floor(Number(gameState?.units?.find((unit) => unit.id === 'knight')?.amount ?? 0))),
    [gameState],
  );

  const recruitQueueOrders = useMemo<RecruitQueueOrder[]>(() => {
    if (!gameState) {
      return [];
    }

    return [...(gameState.activeRecruitments ?? [])]
      .sort((a, b) => {
        const byEta = a.remainingSec - b.remainingSec;
        if (byEta !== 0) {
          return byEta;
        }
        return a.id - b.id;
      })
      .map((order) => ({
        id: order.id,
        unitId: order.unitId,
        unitName: getUnitMetaById(order.unitId).fallbackName,
        amount: order.amount,
        remainingSec: order.remainingSec,
        finishAt: order.finishAt,
      }));
  }, [gameState]);

  const buildingUpgradeQueueByBuilding = useMemo<Map<string, BuildingUpgradeQueueOrder[]>>(() => {
    const grouped = new Map<string, BuildingUpgradeQueueOrder[]>();
    if (!gameState) {
      return grouped;
    }

    for (const upgrade of gameState.activeUpgrades ?? []) {
      const next: BuildingUpgradeQueueOrder = {
        id: upgrade.id,
        buildingId: upgrade.buildingId,
        fromLevel: upgrade.fromLevel,
        toLevel: upgrade.toLevel,
        remainingSec: upgrade.remainingSec,
        finishAt: upgrade.finishAt,
      };
      const current = grouped.get(upgrade.buildingId);
      if (current) {
        current.push(next);
      } else {
        grouped.set(upgrade.buildingId, [next]);
      }
    }

    for (const [buildingId, queue] of grouped.entries()) {
      grouped.set(
        buildingId,
        [...queue].sort((a, b) => {
          const byEta = a.remainingSec - b.remainingSec;
          if (byEta !== 0) {
            return byEta;
          }
          return a.id - b.id;
        }),
      );
    }

    return grouped;
  }, [gameState]);
  const armyActiveMovements = useMemo<ArmyMovementState[]>(
    () => gameState?.army?.activeMovements ?? [],
    [gameState],
  );
  const armyStationedSupports = useMemo<ArmyMovementState[]>(
    () => gameState?.army?.stationedSupports ?? [],
    [gameState],
  );
  const battleReportsById = useMemo(() => {
    const byId = new Map<number, BattleReportItem>();
    for (const [id, report] of Object.entries(battleReportCacheById)) {
      const numericId = Number(id);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        continue;
      }
      byId.set(numericId, report);
    }
    for (const report of battleReports?.items ?? []) {
      byId.set(report.id, report);
    }
    return byId;
  }, [battleReportCacheById, battleReports]);
  const mapOrderMarkersByVillageId = useMemo<Map<number, SettlementOrderMarkerCounts>>(() => {
    const markerMap = new Map<number, SettlementOrderMarkerCounts>();
    const addMarker = (
      villageIdRaw: number,
      commandType: Extract<keyof SettlementOrderMarkerCounts, 'attack' | 'support' | 'move'>,
      options?: { hasKnightAttack?: boolean },
    ) => {
      const villageId = Number(villageIdRaw);
      if (!Number.isFinite(villageId)) {
        return;
      }

      const current = markerMap.get(villageId) ?? { attack: 0, support: 0, move: 0, knightAttack: 0 };
      current[commandType] += 1;
      if (options?.hasKnightAttack) {
        current.knightAttack += 1;
      }
      markerMap.set(villageId, current);
    };

    for (const movement of armyActiveMovements) {
      if (movement.commandType === 'attack' || movement.commandType === 'support' || movement.commandType === 'move') {
        const hasKnightAttack =
          movement.commandType === 'attack' &&
          movement.units.some((unit) => unit.unitId === 'knight' && Number(unit.amount) > 0);
        addMarker(movement.targetVillageId, movement.commandType, { hasKnightAttack });
      }
    }
    for (const movement of armyStationedSupports) {
      addMarker(movement.targetVillageId, 'support');
    }

    return markerMap;
  }, [armyActiveMovements, armyStationedSupports]);

  const resourceStocks = useMemo<ResourceStock[]>(() => {
    if (!gameState) {
      return [
        { name: 'Dřevo', amount: 0, delta: '+0 / h', cap: 0, buildingId: 'woodcutter' },
        { name: 'Kámen', amount: 0, delta: '+0 / h', cap: 0, buildingId: 'quarry' },
        { name: 'Železo', amount: 0, delta: '+0 / h', cap: 0, buildingId: 'iron-mine' },
        { name: 'Populace', amount: 0, delta: 'kapacita 0', cap: 0, buildingId: 'residential-quarter' },
      ];
    }

    return [
      {
        name: 'Dřevo',
        amount: gameState.resources.wood,
        delta: `+${gameState.resources.productionPerHour.wood.toLocaleString('cs-CZ')} / h`,
        cap: gameState.resources.cap,
        buildingId: 'woodcutter',
      },
      {
        name: 'Kámen',
        amount: gameState.resources.stone,
        delta: `+${gameState.resources.productionPerHour.stone.toLocaleString('cs-CZ')} / h`,
        cap: gameState.resources.cap,
        buildingId: 'quarry',
      },
      {
        name: 'Železo',
        amount: gameState.resources.iron,
        delta: `+${gameState.resources.productionPerHour.iron.toLocaleString('cs-CZ')} / h`,
        cap: gameState.resources.cap,
        buildingId: 'iron-mine',
      },
      {
        name: 'Populace',
        amount: gameState.population.used,
        delta: `kapacita ${gameState.population.cap.toLocaleString('cs-CZ')}`,
        cap: gameState.population.cap,
        buildingId: 'residential-quarter',
      },
    ];
  }, [gameState]);
  const currentResearchTask = useMemo(
    () => RESEARCH_TASKS.find((task) => task.progress < 100) ?? null,
    [],
  );

  const villageLabel = gameState
    ? `${gameState.village.name} (${gameState.village.coordX}|${gameState.village.coordY})`
    : 'Načítám město...';
  const activeVillageResolvedId = gameState?.village.id ?? activeVillageId ?? null;
  const currentVillageHistoryKey =
    activeVillageResolvedId != null && Number.isFinite(activeVillageResolvedId)
      ? String(Math.floor(activeVillageResolvedId))
      : null;
  const currentVillageCommandHistory = useMemo<Partial<Record<MapOrderCommandType, number>>>(
    () => (currentVillageHistoryKey ? armyTargetHistoryByVillageId[currentVillageHistoryKey] ?? {} : {}),
    [armyTargetHistoryByVillageId, currentVillageHistoryKey],
  );
  const playerVillages = gameState?.villages ?? [];
  const currentVillageName = gameState?.village.name ?? 'Neznámé léno';
  const villageRegionLabel = gameState
    ? `Region ${gameState.village.region}, království ${gameState.village.kingdom}`
    : 'Čekám na data backendu';
  const activeOrders = gameState?.activeOrders.length ? gameState.activeOrders : FALLBACK_ACTIVE_ORDERS;
  const leaderboardRows = useMemo(() => {
    const rows = gameState?.leaderboard?.length ? gameState.leaderboard : RANKING_FALLBACK;
    return rows.filter((entry) => !entry.username.startsWith('__abandoned_ai__'));
  }, [gameState]);
  const kingdomHub = gameState?.kingdomHub ?? null;
  const playerLeaderboardEntry = useMemo(
    () => leaderboardRows.find((entry) => entry.username === username) ?? null,
    [leaderboardRows, username],
  );
  const mapRegionSize = gameState?.world.size ?? REGION_SIZE;
  const mapRegionOriginX = gameState?.world.originX ?? REGION_ORIGIN_X;
  const mapRegionOriginY = gameState?.world.originY ?? REGION_ORIGIN_Y;
  const mapRegionId = gameState?.world.region ?? 1;
  const mapSettlements = useMemo<RegionSettlement[]>(
    () => gameState?.world.settlements ?? REGION_SETTLEMENTS,
    [gameState],
  );
  const isOwnSettlementForPlayer = useCallback(
    (settlement: RegionSettlement) =>
      settlement.owner === username || settlement.kind === 'own' || settlement.relation === 'self',
    [username],
  );
  const ownSettlements = useMemo(
    () => mapSettlements.filter((settlement) => isOwnSettlementForPlayer(settlement)),
    [isOwnSettlementForPlayer, mapSettlements],
  );
  const focusedOwnSettlementId = useMemo(() => {
    if (selectedOwnSettlementId && ownSettlements.some((settlement) => settlement.id === selectedOwnSettlementId)) {
      return selectedOwnSettlementId;
    }
    return ownSettlements[0]?.id ?? null;
  }, [ownSettlements, selectedOwnSettlementId]);
  const settlementsById = useMemo(
    () => new Map(mapSettlements.map((settlement) => [settlement.id, settlement])),
    [mapSettlements],
  );

  const buildingsById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);

  const loadGameState = useCallback(
    async (silent = false, forceFresh = false) => {
      if (!session) {
        return;
      }

      if (stateRequestPromiseRef.current) {
        if (!forceFresh) {
          return stateRequestPromiseRef.current;
        }
        try {
          await stateRequestPromiseRef.current;
        } catch {
          // Ignore; we'll continue with a fresh state request below.
        }
      }

      const requestPromise = (async () => {
        if (!silent) {
          setLoadingState(true);
        }

        try {
          const nextState = await fetchGameState(username, activeVillageId);
          applyIncomingGameState(nextState);
        } catch (error) {
          setStateError(getErrorMessage(error));
        } finally {
          if (!silent) {
            setLoadingState(false);
          }
        }
      })();

      stateRequestPromiseRef.current = requestPromise;

      try {
        await requestPromise;
      } finally {
        if (stateRequestPromiseRef.current === requestPromise) {
          stateRequestPromiseRef.current = null;
        }
      }
    },
    [activeVillageId, applyIncomingGameState, session, username],
  );

  const loadBattleReports = useCallback(
    async (silent = false) => {
      if (!session) {
        return;
      }

      if (reportsRequestPromiseRef.current) {
        return reportsRequestPromiseRef.current;
      }

      const requestPromise = (async () => {
        if (!silent) {
          setBattleReportsLoading(true);
        }

        try {
          const nextReports = await fetchBattleReports(username, battleReportsPage, 20);
          setBattleReports(nextReports);
          setBattleReportCacheById((previous) => {
            const merged = { ...previous };
            for (const report of nextReports.items) {
              merged[report.id] = report;
            }
            return merged;
          });
          setBattleReportsPage(nextReports.page);
          setBattleReportsError(null);
          setSelectedBattleReportId((previous) => {
            if (previous != null && nextReports.items.some((item) => item.id === previous)) {
              return previous;
            }
            return nextReports.items[0]?.id ?? null;
          });
        } catch (error) {
          setBattleReportsError(getErrorMessage(error));
        } finally {
          if (!silent) {
            setBattleReportsLoading(false);
          }
        }
      })();

      reportsRequestPromiseRef.current = requestPromise;

      try {
        await requestPromise;
      } finally {
        if (reportsRequestPromiseRef.current === requestPromise) {
          reportsRequestPromiseRef.current = null;
        }
      }
    },
    [battleReportsPage, session, username],
  );

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }

    void loadGameState(false);
    const pollTimer = window.setInterval(() => {
      if (mutationPendingRef.current) {
        return;
      }
      void loadGameState(true);
    }, STATE_POLL_INTERVAL_MS);

    return () => window.clearInterval(pollTimer);
  }, [loadGameState, navigate, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadBattleReports(false);
    const reportsTimer = window.setInterval(() => {
      if (mutationPendingRef.current) {
        return;
      }
      void loadBattleReports(true);
    }, REPORTS_POLL_INTERVAL_MS);

    return () => window.clearInterval(reportsTimer);
  }, [loadBattleReports, session]);

  useEffect(() => {
    const notifyTimer = window.setInterval(() => {
      setPanels((previous) =>
        previous.map((panel) => {
          if (panel.type === 'messages' && !panel.expanded) {
            return { ...panel, alert: true };
          }

          return panel;
        }),
      );
    }, 35000);

    return () => window.clearInterval(notifyTimer);
  }, []);

  useEffect(() => {
    setPanels((previous) => {
      let changed = false;
      const nextPanels = previous.map((panel) => {
        if (panel.type !== 'city' || panel.label === PANEL_META.city.label) {
          return panel;
        }
        changed = true;
        return {
          ...panel,
          label: PANEL_META.city.label,
        };
      });

      return changed ? nextPanels : previous;
    });
  }, []);

  useEffect(() => {
    if (ownSettlements.length === 0) {
      if (selectedOwnSettlementId != null) {
        setSelectedOwnSettlementId(null);
        saveLastOwnSettlementId(username, null);
      }
      if (activeVillageId != null) {
        setActiveVillageId(null);
      }
      return;
    }

    if (selectedOwnSettlementId && ownSettlements.some((settlement) => settlement.id === selectedOwnSettlementId)) {
      return;
    }

    const fallbackId = ownSettlements[0].id;
    setSelectedOwnSettlementId(fallbackId);
    saveLastOwnSettlementId(username, fallbackId);
    if (ownSettlements[0].villageId != null && Number.isFinite(ownSettlements[0].villageId)) {
      setActiveVillageId(ownSettlements[0].villageId);
    }
  }, [activeVillageId, ownSettlements, selectedOwnSettlementId, username]);

  useEffect(() => {
    if (activeVillageId == null) {
      return;
    }

    const activeOwnSettlement = ownSettlements.find(
      (settlement) => settlement.villageId != null && Number(settlement.villageId) === activeVillageId,
    );
    if (!activeOwnSettlement) {
      return;
    }

    if (selectedOwnSettlementId === activeOwnSettlement.id) {
      return;
    }

    setSelectedOwnSettlementId(activeOwnSettlement.id);
    saveLastOwnSettlementId(username, activeOwnSettlement.id);
  }, [activeVillageId, ownSettlements, selectedOwnSettlementId, username]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timer = window.setTimeout(() => {
      savePanelLayout(username, panels);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [panels, session, username]);

  useEffect(() => {
    if (!session) {
      return;
    }

    saveStoredMapZoom(username, mapZoomPercent);
  }, [mapZoomPercent, session, username]);

  useEffect(() => {
    if (!session) {
      return;
    }

    saveActiveVillageId(username, activeVillageId);
  }, [activeVillageId, session, username]);

  useEffect(() => {
    if (!gameState) {
      return;
    }

    setPanels((previous) => {
      let changed = false;
      const nextPanels = previous.map((panel) => {
        if (!hasVillageContext(panel) || panel.villageName) {
          return panel;
        }

        changed = true;
        return {
          ...panel,
          villageName: currentVillageName,
        };
      });

      return changed ? nextPanels : previous;
    });
  }, [currentVillageName, gameState]);

  useEffect(() => {
    const normalizePanelsToViewport = () => {
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      let nextMapSize: WindowSize | null = null;

      setPanels((previous) => {
        let changed = false;
        const nextPanels = previous.map((panel) => {
          const adjusted = fitPanelToViewport(panel, viewportWidth, viewportHeight);

          if (adjusted !== panel) {
            changed = true;
            if (panel.type === 'map') {
              nextMapSize = { width: adjusted.width, height: adjusted.height };
            }
          }

          return adjusted;
        });

        return changed ? nextPanels : previous;
      });

      if (nextMapSize) {
        mapWindowSizeRef.current = nextMapSize;
        saveMapWindowSize(nextMapSize);
      }
    };

    const initRaf = window.requestAnimationFrame(normalizePanelsToViewport);
    window.addEventListener('resize', normalizePanelsToViewport);

    return () => {
      window.cancelAnimationFrame(initRaf);
      window.removeEventListener('resize', normalizePanelsToViewport);
    };
  }, [getCanvasViewportSize]);

  useEffect(() => {
    const applyDragFrame = () => {
      const activeDrag = dragState.current;
      if (!activeDrag) {
        return;
      }

      activeDrag.rafId = null;
      const node = panelElementRefs.current[activeDrag.id];
      if (!node) {
        return;
      }

      const deltaX = activeDrag.latestX - activeDrag.originX;
      const deltaY = activeDrag.latestY - activeDrag.originY;
      node.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    };

    const applyResizeFrame = () => {
      const activeResize = resizeState.current;
      if (!activeResize) {
        return;
      }

      activeResize.rafId = null;
      const node = panelElementRefs.current[activeResize.id];
      if (!node) {
        return;
      }

      node.style.width = `${activeResize.latestWidth}px`;
      node.style.height = `${activeResize.latestHeight}px`;
    };

    const onPointerMove = (event: PointerEvent) => {
      const activeResize = resizeState.current;
      if (activeResize && canvasRef.current) {
        const deltaX = event.clientX - activeResize.startX;
        const deltaY = event.clientY - activeResize.startY;
        const bounds = canvasRef.current.getBoundingClientRect();
        const maxWidth = Math.max(activeResize.minWidth, bounds.width - activeResize.panelX - 12);
        const maxHeight = Math.max(activeResize.minHeight, bounds.height - activeResize.panelY - 12);

        activeResize.latestWidth = clamp(activeResize.originWidth + deltaX, activeResize.minWidth, maxWidth);
        activeResize.latestHeight = clamp(
          activeResize.originHeight + deltaY,
          activeResize.minHeight,
          maxHeight,
        );

        if (activeResize.rafId == null) {
          activeResize.rafId = window.requestAnimationFrame(applyResizeFrame);
        }
        return;
      }

      const activeDrag = dragState.current;
      if (!activeDrag || !canvasRef.current) {
        return;
      }

      const deltaX = event.clientX - activeDrag.startX;
      const deltaY = event.clientY - activeDrag.startY;
      const bounds = canvasRef.current.getBoundingClientRect();
      const maxX = Math.max(8, bounds.width - activeDrag.panelWidth - 32);
      const maxY = Math.max(24, bounds.height - activeDrag.panelHeight - 56);

      activeDrag.latestX = clamp(activeDrag.originX + deltaX, 8, maxX);
      activeDrag.latestY = clamp(activeDrag.originY + deltaY, 12, maxY);

      if (activeDrag.rafId == null) {
        activeDrag.rafId = window.requestAnimationFrame(applyDragFrame);
      }
    };

    const onPointerUp = () => {
      const activeResize = resizeState.current;
      if (activeResize) {
        if (activeResize.rafId != null) {
          window.cancelAnimationFrame(activeResize.rafId);
          activeResize.rafId = null;
        }

        const { id, latestWidth, latestHeight } = activeResize;
        const node = panelElementRefs.current[id];
        if (node) {
          node.classList.remove('resizing');
        }

        resizeState.current = null;
        const { viewportWidth, viewportHeight } = getCanvasViewportSize();
        let nextMapSize: WindowSize | null = null;
        setPanels((previous) =>
          previous.map((panel) => {
            if (panel.id !== id) {
              return panel;
            }
            const adjusted = fitPanelToViewport(
              { ...panel, width: latestWidth, height: latestHeight },
              viewportWidth,
              viewportHeight,
            );
            if (adjusted.type === 'map') {
              nextMapSize = { width: adjusted.width, height: adjusted.height };
            }
            return adjusted;
          }),
        );
        if (nextMapSize) {
          mapWindowSizeRef.current = nextMapSize;
          saveMapWindowSize(nextMapSize);
        }
        return;
      }

      const activeDrag = dragState.current;
      if (!activeDrag) {
        return;
      }

      if (activeDrag.rafId != null) {
        window.cancelAnimationFrame(activeDrag.rafId);
        activeDrag.rafId = null;
      }

      const { id, latestX, latestY } = activeDrag;
      const node = panelElementRefs.current[id];
      if (node) {
        node.style.transform = '';
        node.classList.remove('dragging');
      }

      dragState.current = null;
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      setPanels((previous) =>
        previous.map((panel) =>
          panel.id === id
            ? fitPanelToViewport({ ...panel, x: latestX, y: latestY }, viewportWidth, viewportHeight)
            : panel,
        ),
      );
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      if (dragState.current?.rafId != null) {
        window.cancelAnimationFrame(dragState.current.rafId);
      }
      if (resizeState.current?.rafId != null) {
        window.cancelAnimationFrame(resizeState.current.rafId);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [getCanvasViewportSize]);

  const applyActiveVillageSelection = useCallback(
    (nextVillageIdRaw: number) => {
      const nextVillageId = Math.floor(Number(nextVillageIdRaw));
      if (!Number.isFinite(nextVillageId) || nextVillageId <= 0) {
        return;
      }

      if (activeVillageResolvedId === nextVillageId) {
        return;
      }

      setActiveVillageId(nextVillageId);
      setArmyNotice(null);
      setArmyNoticeUnitId(null);
      setArmyCommandNotice(null);
      setBuildingNotices({});
      setStateError(null);
    },
    [activeVillageResolvedId],
  );

  const closeVillageMenu = useCallback(() => {
    setVillageMenuOpen(false);
  }, []);

  const updateVillageMenuPosition = useCallback(() => {
    const trigger = villageMenuTriggerRef.current;
    if (!trigger || typeof window === 'undefined') {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const safeLeft = clamp(Math.floor(rect.left), 8, Math.max(8, window.innerWidth - width - 8));
    const safeTop = Math.floor(rect.bottom + 8);

    setVillageMenuPosition({
      left: safeLeft,
      top: safeTop,
      width,
    });
  }, []);

  const toggleVillageMenu = useCallback(() => {
    if (isVillageMenuOpen) {
      closeVillageMenu();
      return;
    }
    updateVillageMenuPosition();
    setVillageMenuOpen(true);
  }, [closeVillageMenu, isVillageMenuOpen, updateVillageMenuPosition]);

  useEffect(() => {
    if (!isVillageMenuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (villageMenuOverlayRef.current?.contains(target)) {
        return;
      }
      if (villageMenuTriggerRef.current?.contains(target)) {
        return;
      }

      closeVillageMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeVillageMenu();
      }
    };

    const onViewportChange = () => {
      updateVillageMenuPosition();
    };

    updateVillageMenuPosition();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [closeVillageMenu, isVillageMenuOpen, updateVillageMenuPosition]);

  const previousActiveVillageRef = useRef<number | null>(activeVillageResolvedId);
  useEffect(() => {
    const previousActiveVillageId = previousActiveVillageRef.current;
    previousActiveVillageRef.current = activeVillageResolvedId;

    if (!isVillageMenuOpen) {
      return;
    }

    if (previousActiveVillageId == null || previousActiveVillageId === activeVillageResolvedId) {
      return;
    }

    closeVillageMenu();
  }, [activeVillageResolvedId, closeVillageMenu, isVillageMenuOpen]);

  const getStretchedPanelFrame = useCallback((viewportWidth: number, viewportHeight: number) => {
    const canvasNode = canvasRef.current;
    const leftPinNode = canvasNode?.querySelector('.pin-column.left') as HTMLElement | null;
    const rightPinNode = canvasNode?.querySelector('.pin-column.right') as HTMLElement | null;
    const pinClearance = 12;

    const leftPinEnd = leftPinNode
      ? Math.floor(leftPinNode.offsetLeft + leftPinNode.offsetWidth + pinClearance)
      : 8;
    const rightPinStart = rightPinNode
      ? Math.floor(rightPinNode.offsetLeft - pinClearance)
      : viewportWidth - PANEL_VIEWPORT_MARGIN_X;
    const availableLeft = clamp(
      leftPinEnd,
      8,
      Math.max(8, viewportWidth - PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH),
    );
    const maxRight = Math.max(
      availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
      viewportWidth - PANEL_VIEWPORT_MARGIN_X,
    );
    const availableRight = clamp(
      rightPinStart,
      availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
      maxRight,
    );

    return {
      x: Math.round(availableLeft),
      y: 12,
      width: Math.round(
        clamp(
          availableRight - availableLeft,
          PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
          viewportWidth - PANEL_VIEWPORT_MARGIN_X,
        ),
      ),
      height: Math.round(
        clamp(
          viewportHeight - PANEL_VIEWPORT_MARGIN_Y,
          PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT,
          viewportHeight - PANEL_VIEWPORT_MARGIN_Y,
        ),
      ),
    };
  }, []);

  const openPanel = useCallback((type: StaticPanelType) => {
    setActivePanelId(type);
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const panelVillageName =
      type === 'city' || type === 'map' || type === 'army' ? currentVillageName : undefined;
    const shouldDefaultStretch = DEFAULT_STRETCHED_PANEL_TYPES.has(type);
    let nextMapSize: WindowSize | null = null;

    setPanels((previous) => {
      const existing = previous.find((panel) => panel.type === type);
      const nextZ = ++topZ.current;

      if (existing) {
        return previous.map((panel) => {
          if (panel.type !== type) {
            return panel;
          }

          const adjusted = fitPanelToViewport(
            {
              ...panel,
              z: nextZ,
              expanded: true,
              alert: false,
              label: PANEL_META[type].label,
              villageName: panelVillageName ?? panel.villageName,
            },
            viewportWidth,
            viewportHeight,
          );
          if (adjusted.type === 'map') {
            nextMapSize = { width: adjusted.width, height: adjusted.height };
          }
          return adjusted;
        });
      }

      const mapSizeOverride =
        type === 'map' && mapWindowSizeRef.current
          ? {
              width: clamp(
                mapWindowSizeRef.current.width,
                MAP_WINDOW_MIN_WIDTH,
                Math.max(MAP_WINDOW_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X),
              ),
              height: clamp(
                mapWindowSizeRef.current.height,
                MAP_WINDOW_MIN_HEIGHT,
                Math.max(MAP_WINDOW_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y),
              ),
            }
          : undefined;

      const created = fitPanelToViewport(
        createPanelWindow(type, nextZ, previous.length, {
          ...(mapSizeOverride ?? {}),
          villageName: panelVillageName,
        }),
        viewportWidth,
        viewportHeight,
      );
      const nextCreated = shouldDefaultStretch
        ? fitPanelToViewport(
            {
              ...created,
              ...getStretchedPanelFrame(viewportWidth, viewportHeight),
            },
            viewportWidth,
            viewportHeight,
          )
        : created;
      if (nextCreated.type === 'map') {
        nextMapSize = { width: nextCreated.width, height: nextCreated.height };
      }
      return [...previous, nextCreated];
    });

    if (nextMapSize) {
      mapWindowSizeRef.current = nextMapSize;
      saveMapWindowSize(nextMapSize);
    }
  }, [currentVillageName, getCanvasViewportSize, getStretchedPanelFrame]);

  useEffect(() => {
    if (initialAutoStretchAppliedRef.current) {
      return;
    }

    initialAutoStretchAppliedRef.current = true;
    if (hasStoredPanelLayoutRef.current) {
      return;
    }

    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const stretchedFrame = getStretchedPanelFrame(viewportWidth, viewportHeight);
    setPanels((previous) => {
      let changed = false;
      const nextPanels = previous.map((panel) => {
        if (!DEFAULT_STRETCHED_PANEL_TYPES.has(panel.type as StaticPanelType)) {
          return panel;
        }

        const stretched = fitPanelToViewport(
          {
            ...panel,
            ...stretchedFrame,
          },
          viewportWidth,
          viewportHeight,
        );
        if (stretched === panel) {
          return panel;
        }
        changed = true;
        return stretched;
      });

      return changed ? nextPanels : previous;
    });
  }, [getCanvasViewportSize, getStretchedPanelFrame]);

  const openSettlementPanel = useCallback(
    (settlement: RegionSettlement, options?: { pinSide?: PinSide }) => {
      if (isOwnSettlementForPlayer(settlement)) {
        setSelectedOwnSettlementId(settlement.id);
        saveLastOwnSettlementId(username, settlement.id);
      }

      const pinSide = options?.pinSide ?? null;
      const shouldPin = pinSide != null;
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      const id = `village-${settlement.id}`;
      const label = `${settlement.name} (${settlement.globalX}|${settlement.globalY})`;
      const defaultSide: PinSide = settlement.kind === 'own' ? 'left' : 'right';
      const nextSide = pinSide ?? defaultSide;

      if (!shouldPin) {
        setActivePanelId(id);
      }

      setPanels((previous) => {
        const existing = previous.find((panel) => panel.id === id);
        const nextZ = ++topZ.current;

        if (existing) {
          return previous.map((panel) =>
            panel.id === id
              ? fitPanelToViewport(
                  {
                    ...panel,
                    z: nextZ,
                    settlementId: settlement.id,
                    label,
                    side: nextSide,
                    expanded: !shouldPin,
                    alert: false,
                  },
                  viewportWidth,
                  viewportHeight,
                )
              : panel,
          );
        }

        const baseCreated = createPanelWindow('village', nextZ, previous.length, {
          id,
          settlementId: settlement.id,
          label,
          side: nextSide,
          width: 520,
          height: 460,
        });

        const created = fitPanelToViewport(
          {
            ...baseCreated,
            side: nextSide,
            expanded: !shouldPin,
            alert: false,
          },
          viewportWidth,
          viewportHeight,
        );

        return [...previous, created];
      });
    },
    [getCanvasViewportSize, isOwnSettlementForPlayer, username],
  );

  const pinSettlementPanelToSide = useCallback(
    (settlement: RegionSettlement, side: PinSide) => {
      openSettlementPanel(settlement, { pinSide: side });
    },
    [openSettlementPanel],
  );

  const openSettlementByVillageId = useCallback(
    (villageId: number) => {
      const normalizedVillageId = Number(villageId);
      if (!Number.isFinite(normalizedVillageId) || normalizedVillageId <= 0) {
        return;
      }

      const settlement =
        mapSettlements.find((candidate) => Number(candidate.villageId) === Math.floor(normalizedVillageId)) ?? null;
      if (!settlement) {
        return;
      }

      openSettlementPanel(settlement);
    },
    [mapSettlements, openSettlementPanel],
  );

  const queueArmyQuickSelection = useCallback(
    (commandType: ArmyCommandSelectableType, targetVillageIdRaw: number) => {
      const targetVillageId = Number(targetVillageIdRaw);
      if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
        return;
      }

      armyQuickSelectionRequestIdRef.current += 1;
      setArmyQuickSelection({
        requestId: armyQuickSelectionRequestIdRef.current,
        commandType,
        targetVillageId: Math.floor(targetVillageId),
      });
    },
    [],
  );

  const handleMapQuickArmyCommand = useCallback(
    (commandType: ArmyCommandSelectableType, settlement: RegionSettlement) => {
      const targetVillageId =
        settlement.villageId != null && Number.isFinite(settlement.villageId)
          ? Number(settlement.villageId)
          : null;
      if (targetVillageId == null) {
        return;
      }

      queueArmyQuickSelection(commandType, targetVillageId);
      openPanel('army');
    },
    [openPanel, queueArmyQuickSelection],
  );

  const openBuildingPanel = useCallback((building: Building) => {
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const id = `building-${building.id}`;
    setActivePanelId(id);
    const label = `${building.name} (Úroveň ${building.level})`;
    const villageName = currentVillageName;

    setPanels((previous) => {
      const existing = previous.find((panel) => panel.id === id);
      const nextZ = ++topZ.current;

      if (existing) {
        return previous.map((panel) =>
          panel.id === id
            ? fitPanelToViewport(
                {
                  ...panel,
                  z: nextZ,
                  expanded: true,
                  alert: false,
                  label,
                  villageName,
                },
                viewportWidth,
                viewportHeight,
              )
            : panel,
        );
      }

      const created = fitPanelToViewport(
        createPanelWindow('building', nextZ, previous.length, {
          id,
          buildingId: building.id,
          label,
          side: 'left',
          width: 540,
          height: 560,
          villageName,
        }),
        viewportWidth,
        viewportHeight,
      );

      return [...previous, created];
    });
  }, [currentVillageName, getCanvasViewportSize]);

  const openKingdomProfilePanel = useCallback((kingdomName: string) => {
    if (!kingdomName || isNeutralKingdom(kingdomName)) {
      return;
    }

    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const id = `kingdom-profile-${encodeURIComponent(kingdomName)}`;
    const label = `Profil království: ${kingdomName}`;
    setActivePanelId(id);

    setPanels((previous) => {
      const existing = previous.find((panel) => panel.id === id);
      const nextZ = ++topZ.current;

      if (existing) {
        return previous.map((panel) =>
          panel.id === id
            ? fitPanelToViewport(
                {
                  ...panel,
                  z: nextZ,
                  expanded: true,
                  alert: false,
                  label,
                  kingdomName,
                },
                viewportWidth,
                viewportHeight,
              )
            : panel,
        );
      }

      const created = fitPanelToViewport(
        createPanelWindow('kingdomProfile', nextZ, previous.length, {
          id,
          label,
          side: 'right',
          width: 680,
          height: 560,
          kingdomName,
        }),
        viewportWidth,
        viewportHeight,
      );

      return [...previous, created];
    });
  }, [getCanvasViewportSize]);

  const openPlayerProfilePanel = useCallback((targetUsername: string) => {
    if (!targetUsername) {
      return;
    }

    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const id = `player-profile-${encodeURIComponent(targetUsername)}`;
    const label = `Profil hráče: ${targetUsername}`;
    setActivePanelId(id);

    setPanels((previous) => {
      const existing = previous.find((panel) => panel.id === id);
      const nextZ = ++topZ.current;

      if (existing) {
        return previous.map((panel) =>
          panel.id === id
            ? fitPanelToViewport(
                {
                  ...panel,
                  z: nextZ,
                  expanded: true,
                  alert: false,
                  label,
                  playerUsername: targetUsername,
                },
                viewportWidth,
                viewportHeight,
              )
            : panel,
        );
      }

      const created = fitPanelToViewport(
        createPanelWindow('playerProfile', nextZ, previous.length, {
          id,
          label,
          side: 'left',
          width: 660,
          height: 560,
          playerUsername: targetUsername,
        }),
        viewportWidth,
        viewportHeight,
      );

      return [...previous, created];
    });
  }, [getCanvasViewportSize]);

  const handleResourceCardClick = useCallback(
    (resource: ResourceStock) => {
      const building = buildingsById.get(resource.buildingId);
      if (!building) {
        return;
      }
      openBuildingPanel(building);
    },
    [buildingsById, openBuildingPanel],
  );

  const handleResearchSpotlightClick = useCallback(() => {
    const universityBuilding = buildingsById.get('university');
    if (universityBuilding) {
      openBuildingPanel(universityBuilding);
      return;
    }
    openPanel('research');
  }, [buildingsById, openBuildingPanel, openPanel]);

  const focusPanel = (id: string) => {
    setActivePanelId(id);
    setPanels((previous) => {
      const target = previous.find((panel) => panel.id === id);
      if (!target) {
        return previous;
      }

      const currentTop = previous.reduce((max, panel) => (panel.z > max ? panel.z : max), 0);
      if (target.z >= currentTop && !target.alert) {
        return previous;
      }

      const nextZ = ++topZ.current;
      return previous.map((panel) => (panel.id === id ? { ...panel, z: nextZ, alert: false } : panel));
    });
  };

  const togglePanelVisibility = (id: string) => {
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    let nextMapSize: WindowSize | null = null;

    setPanels((previous) => {
      const target = previous.find((panel) => panel.id === id);
      if (!target) {
        return previous;
      }

      const nextZ = target.expanded ? target.z : ++topZ.current;

      return previous.map((panel) => {
        if (panel.id !== id) {
          return panel;
        }

        const toggled: PanelWindow = {
          ...panel,
          expanded: !panel.expanded,
          z: nextZ,
          alert: false,
        };

        if (!toggled.expanded) {
          return toggled;
        }

        const adjusted = fitPanelToViewport(toggled, viewportWidth, viewportHeight);
        if (adjusted.type === 'map') {
          nextMapSize = { width: adjusted.width, height: adjusted.height };
        }
        return adjusted;
      });
    });

    if (nextMapSize) {
      mapWindowSizeRef.current = nextMapSize;
      saveMapWindowSize(nextMapSize);
    }
  };

  const closePanel = (id: string) => {
    setActivePanelId((previous) => (previous === id ? null : previous));
    setPanels((previous) => previous.filter((panel) => panel.id !== id));
  };

  const stretchPanelToViewport = useCallback(
    (id: string) => {
      const canvasNode = canvasRef.current;
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      let nextMapSize: WindowSize | null = null;

      const leftPinNode = canvasNode?.querySelector('.pin-column.left') as HTMLElement | null;
      const rightPinNode = canvasNode?.querySelector('.pin-column.right') as HTMLElement | null;
      const pinClearance = 12;

      const leftPinEnd = leftPinNode
        ? Math.floor(leftPinNode.offsetLeft + leftPinNode.offsetWidth + pinClearance)
        : 8;
      const rightPinStart = rightPinNode
        ? Math.floor(rightPinNode.offsetLeft - pinClearance)
        : viewportWidth - PANEL_VIEWPORT_MARGIN_X;

      setPanels((previous) => {
        let changed = false;
        const nextPanels = previous.map((panel) => {
          if (panel.id !== id || !isStretchablePanelType(panel.type)) {
            return panel;
          }

          const availableLeft = clamp(
            leftPinEnd,
            8,
            Math.max(8, viewportWidth - PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH),
          );
          const maxRight = Math.max(
            availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
            viewportWidth - PANEL_VIEWPORT_MARGIN_X,
          );
          const availableRight = clamp(
            rightPinStart,
            availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
            maxRight,
          );
          const stretchedWidth = clamp(
            availableRight - availableLeft,
            PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
            viewportWidth - PANEL_VIEWPORT_MARGIN_X,
          );
          const stretchedHeight = clamp(
            viewportHeight - PANEL_VIEWPORT_MARGIN_Y,
            PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT,
            viewportHeight - PANEL_VIEWPORT_MARGIN_Y,
          );

          const adjusted: PanelWindow = {
            ...panel,
            x: availableLeft,
            y: 12,
            width: stretchedWidth,
            height: stretchedHeight,
          };

          if (
            adjusted.x === panel.x &&
            adjusted.y === panel.y &&
            adjusted.width === panel.width &&
            adjusted.height === panel.height
          ) {
            return panel;
          }

          changed = true;
          if (panel.type === 'map') {
            nextMapSize = { width: adjusted.width, height: adjusted.height };
          }
          return adjusted;
        });

        return changed ? nextPanels : previous;
      });

      if (nextMapSize) {
        mapWindowSizeRef.current = nextMapSize;
        saveMapWindowSize(nextMapSize);
      }
    },
    [getCanvasViewportSize],
  );

  const closePanelOnMiddleClick = (
    event: ReactMouseEvent<HTMLElement>,
    panelId: string,
  ): boolean => {
    if (event.button !== 1) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    closePanel(panelId);
    return true;
  };

  const switchSide = (id: string) => {
    setPanels((previous) =>
      previous.map((panel) => {
        if (panel.id !== id) {
          return panel;
        }

        return {
          ...panel,
          side: panel.side === 'left' ? 'right' : 'left',
        };
      }),
    );
  };

  const movePinToSideAndMinimize = (id: string, side: PinSide) => {
    setPanels((previous) =>
      previous.map((panel) => {
        if (panel.id !== id) {
          return panel;
        }

        return {
          ...panel,
          side,
          expanded: false,
          alert: false,
        };
      }),
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      const activePanel = panels.find((panel) => panel.id === activePanelId && panel.expanded);
      if (!activePanel) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePinToSideAndMinimize(activePanel.id, 'left');
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePinToSideAndMinimize(activePanel.id, 'right');
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        switchSide(activePanel.id);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        closePanel(activePanel.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanelId, panels]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>, panel: PanelWindow) => {
    if (event.button !== 0) {
      return;
    }

    if (window.innerWidth < 900) {
      return;
    }

    event.preventDefault();
    const node = panelElementRefs.current[panel.id];
    if (node) {
      node.classList.add('dragging');
    }

    dragState.current = {
      id: panel.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: panel.x,
      originY: panel.y,
      latestX: panel.x,
      latestY: panel.y,
      panelWidth: panel.width,
      panelHeight: panel.height,
      rafId: null,
    };

    focusPanel(panel.id);
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, panel: PanelWindow) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const node = panelElementRefs.current[panel.id];
    if (node) {
      node.classList.add('resizing');
    }
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const minSize = getPanelMinSize(panel.type);
    const minWidth = Math.min(
      minSize.width,
      Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH, viewportWidth - PANEL_VIEWPORT_MARGIN_X),
    );
    const minHeight = Math.min(
      minSize.height,
      Math.max(PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT, viewportHeight - PANEL_VIEWPORT_MARGIN_Y),
    );

    resizeState.current = {
      id: panel.id,
      panelType: panel.type,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: panel.width,
      originHeight: panel.height,
      latestWidth: panel.width,
      latestHeight: panel.height,
      minWidth,
      minHeight,
      panelX: panel.x,
      panelY: panel.y,
      rafId: null,
    };

    focusPanel(panel.id);
  };

  useEffect(() => {
    setPanels((previous) => {
      let changed = false;
      const nextPanels = previous.map((panel) => {
        if (panel.type !== 'building' || !panel.buildingId) {
          return panel;
        }

        const building = buildingsById.get(panel.buildingId);
        if (!building) {
          return panel;
        }

        const nextLabel = `${building.name} (Úroveň ${building.level})`;
        if (panel.label === nextLabel) {
          return panel;
        }

        changed = true;
        return { ...panel, label: nextLabel };
      });

      return changed ? nextPanels : previous;
    });
  }, [buildingsById]);

  const handleRecruit = useCallback(
    async (unit: Unit, amount: number): Promise<boolean> => {
      const normalizedAmount = Math.max(0, Math.floor(amount));
      if (normalizedAmount <= 0) {
        return false;
      }

      setRecruitPendingUnitId(unit.id);
      setArmyNotice(null);
      setArmyNoticeUnitId(null);

      try {
        const nextState = await recruitUnit(
          username,
          unit.id,
          normalizedAmount,
          gameState?.village.id ?? activeVillageId,
        );
        applyIncomingGameState(nextState);
        setArmyNotice(`${unit.name}: +${normalizedAmount.toLocaleString('cs-CZ')} jednotek`);
        setArmyNoticeUnitId(unit.id);
        void loadGameState(true, true);
        return true;
      } catch (error) {
        setArmyNotice(getErrorMessage(error));
        setArmyNoticeUnitId(null);
        return false;
      } finally {
        setRecruitPendingUnitId(null);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleCancelRecruitment = useCallback(
    async (order: RecruitQueueOrder) => {
      if (!Number.isFinite(order.id) || order.id <= 0) {
        return;
      }

      setCancelRecruitmentPendingId(order.id);
      setArmyNotice(null);
      setArmyNoticeUnitId(null);

      try {
        const response = await cancelRecruitmentRequest(
          username,
          order.id,
          gameState?.village.id ?? activeVillageId,
        );
        applyIncomingGameState(response.data);
        setArmyNotice(
          `${order.unitName}: nábor zrušen, vráceno ${formatResourceBundleLabel(response.result.refunded)}.`,
        );
        setArmyNoticeUnitId(order.unitId);
        void loadGameState(true, true);
      } catch (error) {
        setArmyNotice(getErrorMessage(error));
        setArmyNoticeUnitId(null);
      } finally {
        setCancelRecruitmentPendingId(null);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const rememberArmyCommandTarget = useCallback(
    (
      originVillageIdRaw: number | null,
      commandType: ArmyCommandSelectableType,
      targetVillageIdRaw: number,
    ) => {
      const originVillageId = Number(originVillageIdRaw);
      const targetVillageId = Number(targetVillageIdRaw);
      if (
        !Number.isFinite(originVillageId) ||
        originVillageId <= 0 ||
        !Number.isFinite(targetVillageId) ||
        targetVillageId <= 0
      ) {
        return;
      }

      setArmyTargetHistoryByVillageId((previous) => {
        const originKey = String(Math.floor(originVillageId));
        const currentHistoryForVillage = previous[originKey] ?? {};
        if (currentHistoryForVillage[commandType] === Math.floor(targetVillageId)) {
          return previous;
        }

        const nextHistory: ArmyTargetHistoryByVillageId = {
          ...previous,
          [originKey]: {
            ...currentHistoryForVillage,
            [commandType]: Math.floor(targetVillageId),
          },
        };
        saveStoredArmyTargetHistory(username, nextHistory);
        return nextHistory;
      });
    },
    [username],
  );

  const handleIssueArmyCommand = useCallback(
    async (payload: {
      commandType: ArmyCommandType;
      targetVillageId: number;
      lootPriority?: LootPriority;
      units: Record<string, number>;
    }) => {
      const originVillageId = gameState?.village.id ?? activeVillageId;
      setArmyCommandPending(true);
      setArmyCommandNotice(null);

      try {
        const response = await issueArmyCommand(username, {
          commandType: payload.commandType,
          villageId: originVillageId,
          targetVillageId: payload.targetVillageId,
          lootPriority: payload.lootPriority,
          units: payload.units,
        });
        const nextState = response.data;
        applyIncomingGameState(nextState);
        if (
          payload.commandType === 'attack' ||
          payload.commandType === 'support' ||
          payload.commandType === 'move'
        ) {
          rememberArmyCommandTarget(originVillageId, payload.commandType, payload.targetVillageId);
        }
        const etaLabel = formatDurationLabel(response.result.durationSec);
        const testingHint = payload.commandType === 'attack' ? ' Test režim: útok max 5s.' : '';
        setArmyCommandNotice(
          `Rozkaz ${ARMY_COMMAND_LABELS[payload.commandType]} byl odeslán. ETA ${etaLabel}.${testingHint}`,
        );
        void loadGameState(true, true);
      } catch (error) {
        setArmyCommandNotice(getErrorMessage(error));
      } finally {
        setArmyCommandPending(false);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      rememberArmyCommandTarget,
      username,
    ],
  );

  const handleReturnSupport = useCallback(
    async (supportMovementId: number) => {
      setArmyCommandPending(true);
      setArmyCommandNotice(null);

      try {
        const response = await issueArmyCommand(username, {
          commandType: 'return',
          villageId: gameState?.village.id ?? activeVillageId,
          supportMovementId,
        });
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setArmyCommandNotice('Návrat podpory byl spuštěn.');
        void loadGameState(true, true);
      } catch (error) {
        setArmyCommandNotice(getErrorMessage(error));
      } finally {
        setArmyCommandPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleBuildingUpgrade = useCallback(
    async (building: Building) => {
      setUpgradePendingBuildingId(building.id);
      setBuildingNotices((previous) => ({
        ...previous,
        [building.id]: '',
      }));

      try {
        const nextState = await upgradeBuilding(
          username,
          building.id,
          gameState?.village.id ?? activeVillageId,
        );
        applyIncomingGameState(nextState);
        setBuildingNotices((previous) => ({
          ...previous,
          [building.id]: 'Upgrade byl úspěšně spuštěn.',
        }));
        void loadGameState(true, true);
      } catch (error) {
        setBuildingNotices((previous) => ({
          ...previous,
          [building.id]: getErrorMessage(error),
        }));
      } finally {
        setUpgradePendingBuildingId(null);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleRecallKnight = useCallback(async () => {
    setRecallKnightPending(true);
    setBuildingNotices((previous) => ({
      ...previous,
      townhall: '',
    }));

    try {
      const response = await recallKnightRequest(
        username,
        gameState?.village.id ?? activeVillageId,
      );
      applyIncomingGameState(response.data);
      setBuildingNotices((previous) => ({
        ...previous,
        townhall: `Rytíř byl odvolán. Vráceno ${formatResourceBundleLabel(response.result.refunded)}.`,
      }));
      void loadGameState(true, true);
    } catch (error) {
      setBuildingNotices((previous) => ({
        ...previous,
        townhall: getErrorMessage(error),
      }));
    } finally {
      setRecallKnightPending(false);
    }
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username]);

  const handleCancelBuildingUpgrade = useCallback(
    async (upgradeOrderId: number, buildingId: string) => {
      if (!Number.isFinite(upgradeOrderId) || upgradeOrderId <= 0) {
        return;
      }

      setCancelUpgradePendingOrderId(upgradeOrderId);
      setBuildingNotices((previous) => ({
        ...previous,
        [buildingId]: '',
      }));

      try {
        const response = await cancelBuildingUpgradeRequest(
          username,
          upgradeOrderId,
          gameState?.village.id ?? activeVillageId,
        );
        applyIncomingGameState(response.data);
        const canceledCount = Number(response.result.canceledCount ?? 1);
        const cancelSuffix =
          canceledCount > 1
            ? ` Z fronty bylo odstraněno ${canceledCount.toLocaleString('cs-CZ')} navazujících upgradu.`
            : '';
        setBuildingNotices((previous) => ({
          ...previous,
          [buildingId]: `Upgrade zrušen, vráceno ${formatResourceBundleLabel(response.result.refunded)}.${cancelSuffix}`,
        }));
        void loadGameState(true, true);
      } catch (error) {
        setBuildingNotices((previous) => ({
          ...previous,
          [buildingId]: getErrorMessage(error),
        }));
      } finally {
        setCancelUpgradePendingOrderId(null);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleCreateKingdom = useCallback(
    async (kingdomName: string) => {
      const normalizedKingdomName = kingdomName.trim();
      if (!normalizedKingdomName) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await createKingdomRequest(
          username,
          normalizedKingdomName,
          gameState?.village.id ?? activeVillageId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Království ${response.result.kingdom} bylo založeno.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleInvitePlayerToKingdom = useCallback(
    async (targetUsername: string) => {
      const normalizedTarget = targetUsername.trim();
      if (!normalizedTarget) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await invitePlayerToKingdomRequest(
          username,
          normalizedTarget,
          gameState?.village.id ?? activeVillageId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Pozvánka pro hráče ${response.result.targetUsername} byla odeslána.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleAcceptKingdomInvite = useCallback(
    async (inviteId: number) => {
      if (!Number.isFinite(inviteId) || inviteId <= 0) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await acceptKingdomInviteRequest(
          username,
          inviteId,
          gameState?.village.id ?? activeVillageId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Pozvánka přijata. Nyní jsi členem království ${response.result.kingdom}.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleRejectKingdomInvite = useCallback(
    async (inviteId: number) => {
      if (!Number.isFinite(inviteId) || inviteId <= 0) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await rejectKingdomInviteRequest(
          username,
          inviteId,
          gameState?.village.id ?? activeVillageId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Pozvánka do království ${response.result.kingdom} byla odmítnuta.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleLeaveKingdom = useCallback(async () => {
    setKingdomActionPending(true);
    setKingdomNotice(null);

    try {
      const response = await leaveKingdomRequest(username, gameState?.village.id ?? activeVillageId);
      const nextState = response.data;
      applyIncomingGameState(nextState);
      setKingdomNotice(`Opustil jsi království ${response.result.previousKingdom}.`);
      void loadGameState(true, true);
    } catch (error) {
      setKingdomNotice(getErrorMessage(error));
    } finally {
      setKingdomActionPending(false);
    }
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username]);

  const handleKickKingdomMember = useCallback(
    async (targetUsername: string) => {
      const normalizedTarget = targetUsername.trim();
      if (!normalizedTarget) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await kickKingdomMemberRequest(
          username,
          normalizedTarget,
          gameState?.village.id ?? activeVillageId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Hráč ${response.result.kickedUsername} byl vyhozen z království.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username],
  );

  const handleRestartVillageProgress = useCallback(async () => {
    const confirmed = window.confirm(
      'Potvrď reset postupu. Tvoje stávající léna se změní na opuštěná a dostaneš nové startovní léno.',
    );
    if (!confirmed) {
      return;
    }

    setRestartVillagePending(true);
    setSettingsNotice(null);

    try {
      const response = await restartVillageProgressRequest(username, gameState?.village.id ?? activeVillageId);
      const nextState = response.data;
      applyIncomingGameState(nextState);
      setSettingsNotice(
        `Restart dokoncen. Vytvoreno nove leno (${nextState.village.name}), opustena lena: ${response.result.abandonedVillagesConverted}.`,
      );
      setKingdomNotice(null);
      void loadGameState(true, true);
    } catch (error) {
      setSettingsNotice(getErrorMessage(error));
    } finally {
      setRestartVillagePending(false);
    }
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, username]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [navigate]);

  const openBattleReportPanel = useCallback(
    (reportId: number) => {
      if (!Number.isFinite(reportId) || reportId <= 0) {
        return;
      }

      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      const numericReportId = Math.floor(reportId);
      const report = battleReportsById.get(numericReportId);
      const fallbackLabel = `Bitevní hlášení #${numericReportId}`;
      const trimmedTitle = report?.title?.trim() ?? '';
      const label = trimmedTitle ? `Bitevní hlášení · ${trimmedTitle}` : fallbackLabel;
      const id = `battle-report-${numericReportId}`;

      setSelectedBattleReportId(numericReportId);
      setActivePanelId(id);

      setPanels((previous) => {
        const existing = previous.find((panel) => panel.id === id);
        const nextZ = ++topZ.current;

        if (existing) {
          return previous.map((panel) =>
            panel.id === id
              ? fitPanelToViewport(
                  {
                    ...panel,
                    z: nextZ,
                    expanded: true,
                    alert: false,
                    label,
                    battleReportId: numericReportId,
                  },
                  viewportWidth,
                  viewportHeight,
                )
              : panel,
          );
        }

        const created = fitPanelToViewport(
          createPanelWindow('battleReport', nextZ, previous.length, {
            id,
            label,
            side: 'right',
            width: 780,
            height: 640,
            battleReportId: numericReportId,
          }),
          viewportWidth,
          viewportHeight,
        );

        return [...previous, created];
      });
    },
    [battleReportsById, getCanvasViewportSize],
  );

  const handleBattleReportsPageChange = useCallback((page: number) => {
    if (!Number.isFinite(page)) {
      return;
    }
    setBattleReportsPage(Math.max(1, Math.floor(page)));
  }, []);

  const handleBattleReportsRefresh = useCallback(() => {
    void loadBattleReports(false);
  }, [loadBattleReports]);

  const getPinnedPanelLabel = useCallback((panel: PanelWindow): string => {
    if (!hasVillageContext(panel) || !panel.villageName) {
      return panel.label;
    }

    return `${panel.label} · ${panel.villageName}`;
  }, []);

  const leftPins = panels.filter((panel) => panel.side === 'left');
  const rightPins = panels.filter((panel) => panel.side === 'right');

  const renderPanelContent = (panel: PanelWindow) => {
    switch (panel.type) {
      case 'city':
        return (
          <CityPanel
            villageLabel={villageLabel}
            regionLabel={villageRegionLabel}
            ownerName={gameState?.player.username ?? username}
            prestige={gameState?.village.prestige ?? 0}
            loyalty={gameState?.village.loyalty ?? 0}
            availableResources={{
              wood: gameState?.resources.wood ?? 0,
              stone: gameState?.resources.stone ?? 0,
              iron: gameState?.resources.iron ?? 0,
            }}
            buildings={buildings}
            units={units}
            orders={activeOrders}
            recruitQueueOrders={recruitQueueOrders}
            onOpenBuilding={openBuildingPanel}
            onOpenArmyRecruitment={() => openPanel('army')}
            onUpgradeBuilding={handleBuildingUpgrade}
            onCancelBuildingUpgrade={handleCancelBuildingUpgrade}
            onCancelRecruitment={handleCancelRecruitment}
            buildingUpgradeQueueByBuilding={buildingUpgradeQueueByBuilding}
            upgradePendingBuildingId={upgradePendingBuildingId}
            cancelUpgradePendingOrderId={cancelUpgradePendingOrderId}
            cancelRecruitmentPendingId={cancelRecruitmentPendingId}
            buildingNotices={buildingNotices}
          />
        );
      case 'map':
        return (
          <MapPanel
            settlements={mapSettlements}
            regionId={mapRegionId}
            regionSize={mapRegionSize}
            regionOriginX={mapRegionOriginX}
            regionOriginY={mapRegionOriginY}
            focusedSettlementId={focusedOwnSettlementId}
            activeVillageId={gameState?.village.id ?? activeVillageId}
            currentUsername={username}
            zoomPercent={mapZoomPercent}
            orderMarkersByVillageId={mapOrderMarkersByVillageId}
            onZoomChange={setMapZoomPercent}
            onOpenSettlement={openSettlementPanel}
            onPinSettlement={pinSettlementPanelToSide}
            onQuickArmyCommand={handleMapQuickArmyCommand}
            onOpenPlayerProfile={openPlayerProfilePanel}
            onOpenKingdomProfile={openKingdomProfilePanel}
          />
        );
      case 'army':
        return (
          <ArmyPanel
            units={units}
            recruitQueueOrders={recruitQueueOrders}
            activeMovements={armyActiveMovements}
            stationedSupports={armyStationedSupports}
            settlements={mapSettlements}
            currentVillageId={gameState?.village.id ?? activeVillageId}
            currentUsername={username}
            commandHistory={currentVillageCommandHistory}
            quickSelection={armyQuickSelection}
            onRecruit={handleRecruit}
            onCancelRecruitment={handleCancelRecruitment}
            onIssueArmyCommand={handleIssueArmyCommand}
            onReturnSupport={handleReturnSupport}
            onOpenSettlementByVillageId={openSettlementByVillageId}
            recruitPendingUnitId={recruitPendingUnitId}
            cancelRecruitmentPendingId={cancelRecruitmentPendingId}
            isArmyCommandPending={armyCommandPending}
            notice={armyNotice}
            noticeUnitId={armyNoticeUnitId}
            commandNotice={armyCommandNotice}
          />
        );
      case 'research':
        return <ResearchPanel />;
      case 'messages':
        return (
          <MessagesPanel
            reports={battleReports}
            incomingInvites={kingdomHub?.incomingInvites ?? EMPTY_KINGDOM_INVITES}
            selectedReportId={selectedBattleReportId}
            loading={battleReportsLoading}
            error={battleReportsError}
            actionPending={kingdomActionPending}
            onOpenReport={openBattleReportPanel}
            onSetPage={handleBattleReportsPageChange}
            onRefresh={handleBattleReportsRefresh}
            onAcceptInvite={handleAcceptKingdomInvite}
            onRejectInvite={handleRejectKingdomInvite}
          />
        );
      case 'battleReport': {
        const report = panel.battleReportId != null ? battleReportsById.get(panel.battleReportId) ?? null : null;
        return <BattleReportPanel report={report} />;
      }
      case 'kingdom':
        return (
          <KingdomPanel
            kingdomHub={kingdomHub}
            currentUsername={username}
            notice={kingdomNotice}
            actionPending={kingdomActionPending}
            onCreateKingdom={handleCreateKingdom}
            onInvitePlayer={handleInvitePlayerToKingdom}
            onAcceptInvite={handleAcceptKingdomInvite}
            onRejectInvite={handleRejectKingdomInvite}
            onLeaveKingdom={handleLeaveKingdom}
            onKickMember={handleKickKingdomMember}
            onOpenPlayerProfile={openPlayerProfilePanel}
            onOpenKingdomProfile={openKingdomProfilePanel}
          />
        );
      case 'rankings':
        return (
          <RankingPanel
            rows={leaderboardRows}
            currentUsername={username}
            currentKingdom={gameState?.village.kingdom ?? 'Neutral'}
            onOpenPlayerProfile={openPlayerProfilePanel}
            onOpenKingdomProfile={openKingdomProfilePanel}
          />
        );
      case 'kingdomProfile': {
        if (!panel.kingdomName) {
          return (
            <div className="panel-stack">
              <section>
                <h3>Království nenalezeno</h3>
                <p>Panel odkazuje na neplatné království.</p>
              </section>
            </div>
          );
        }

        return (
          <KingdomProfilePanel
            kingdomName={panel.kingdomName}
            rows={leaderboardRows}
            settlements={mapSettlements}
            currentManagedVillage={
              gameState
                ? {
                    name: gameState.village.name,
                    coordX: gameState.village.coordX,
                    coordY: gameState.village.coordY,
                    region: gameState.village.region,
                  }
                : null
            }
            onOpenPlayerProfile={openPlayerProfilePanel}
          />
        );
      }
      case 'playerProfile': {
        if (!panel.playerUsername) {
          return (
            <div className="panel-stack">
              <section>
                <h3>Hráč nenalezen</h3>
                <p>Panel odkazuje na neplatný profil hráče.</p>
              </section>
            </div>
          );
        }

        return (
          <PlayerProfilePanel
            username={panel.playerUsername}
            rows={leaderboardRows}
            settlements={mapSettlements}
            onOpenSettlement={openSettlementPanel}
          />
        );
      }
      case 'profile':
        return (
          <ProfilePanel
            username={username}
            kingdom={gameState?.village.kingdom ?? 'Nezname kralovstvi'}
            prestige={gameState?.village.prestige ?? 0}
            villageCount={playerLeaderboardEntry?.villages ?? 1}
            rank={playerLeaderboardEntry?.rank ?? null}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            onLogout={handleLogout}
            onRestartVillageProgress={handleRestartVillageProgress}
            restartPending={restartVillagePending}
            notice={settingsNotice}
          />
        );
      case 'village': {
        const settlement = panel.settlementId ? settlementsById.get(panel.settlementId) : undefined;

        if (!settlement) {
          return (
            <div className="panel-stack">
              <section>
                <h3>Osada nenalezena</h3>
                <p>Panel odkazuje na neexistující osadu.</p>
              </section>
            </div>
          );
        }

        return (
          <VillagePanel
            settlement={settlement}
            activeVillageId={gameState?.village.id ?? activeVillageId}
            currentVillageId={gameState?.village.id ?? activeVillageId}
            currentVillageName={villageLabel}
            currentUsername={username}
            units={units}
            activeMovements={armyActiveMovements}
            stationedSupports={armyStationedSupports}
            isArmyCommandPending={armyCommandPending}
            commandNotice={armyCommandNotice}
            onOpenCity={() => openPanel('city')}
            onIssueArmyCommand={handleIssueArmyCommand}
            onReturnSupport={handleReturnSupport}
          />
        );
      }
      case 'building': {
        const building = panel.buildingId ? buildingsById.get(panel.buildingId) : undefined;

        if (!building) {
          return (
            <div className="panel-stack">
              <section>
                <h3>Budova nenalezena</h3>
                <p>Panel odkazuje na neexistující budovu.</p>
              </section>
            </div>
          );
        }

        return (
          <BuildingPanel
            building={building}
            onBackToCity={() => openPanel('city')}
            onUpgrade={handleBuildingUpgrade}
            onRecallKnight={building.id === 'townhall' ? handleRecallKnight : null}
            knightCount={currentVillageKnightCount}
            isRecallKnightPending={recallKnightPending}
            isUpgradePending={upgradePendingBuildingId === building.id}
            notice={buildingNotices[building.id] ?? null}
          />
        );
      }
      default:
        return null;
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="game-page">
      <div className="game-bg-layer" />
      <div className="game-grid-layer" />

      <header className="top-navigation">
        <nav>
          {NAV_BUTTONS.map((button) => (
            <button
              key={button.type}
              className="nav-action"
              onClick={() => openPanel(button.type)}
              title={`Otevřít panel: ${button.text}`}
            >
              {button.text}
            </button>
          ))}
        </nav>

        <button className="quick-logout" onClick={handleLogout}>
          Odhlásit
        </button>
      </header>

      <section className="resource-strip">
        <article className="resource-card village-resource-card" aria-label="Aktivní město a seznam lén">
          <p>Aktivní město</p>
          <strong>{villageLabel}</strong>
          <span>{playerVillages.length.toLocaleString('cs-CZ')} dostupných lén</span>
          <button
            ref={villageMenuTriggerRef}
            type="button"
            className="village-menu-trigger"
            onClick={toggleVillageMenu}
            disabled={playerVillages.length === 0}
            aria-haspopup="menu"
            aria-expanded={isVillageMenuOpen}
          >
            {playerVillages.length === 0 ? 'Načítám léna...' : 'Seznam lén'}
          </button>
        </article>
        {resourceStocks.map((resource) => (
          <button
            key={resource.name}
            type="button"
            className="resource-card"
            onClick={() => handleResourceCardClick(resource)}
            title={`Otevřít budovu: ${resource.name}`}
          >
            <p>{resource.name}</p>
            <strong>{resource.amount.toLocaleString('cs-CZ')}</strong>
            <span>{resource.delta}</span>
            <small>Cap {resource.cap.toLocaleString('cs-CZ')}</small>
          </button>
        ))}
        {currentResearchTask ? (
          <button
            type="button"
            className="resource-card research-spotlight-card"
            onClick={handleResearchSpotlightClick}
            title="Otevřít Univerzitu"
          >
            <p>Aktuální výzkum</p>
            <strong>{currentResearchTask.name}</strong>
            <span>
              {Math.round(currentResearchTask.progress)} % · ETA {currentResearchTask.eta}
            </span>
            <small>Klikni pro detail v Univerzitě</small>
          </button>
        ) : null}
      </section>
      {isVillageMenuOpen && villageMenuPosition ? (
        <div
          ref={villageMenuOverlayRef}
          className="village-menu-overlay"
          role="menu"
          aria-label="Seznam lén"
          style={{
            left: `${villageMenuPosition.left}px`,
            top: `${villageMenuPosition.top}px`,
            width: `${villageMenuPosition.width}px`,
          }}
        >
          <header>
            <h4>Seznam lén</h4>
            <button type="button" onClick={closeVillageMenu} aria-label="Zavřít seznam lén">
              ✕
            </button>
          </header>
          <ul>
            {playerVillages.map((village) => {
              const isActive = activeVillageResolvedId === village.id;
              return (
                <li key={`menu-village-${village.id}`}>
                  <button
                    type="button"
                    className={`village-menu-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      applyActiveVillageSelection(village.id);
                      closeVillageMenu();
                    }}
                  >
                    <strong>{village.name}</strong>
                    <span>
                      {village.coordX}|{village.coordY} · Region {village.region}
                    </span>
                    {isActive ? <em>Aktivní</em> : null}
                  </button>
                </li>
              );
            })}
            {playerVillages.length === 0 ? (
              <li className="village-menu-empty">Načítám dostupná léna...</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="game-canvas" ref={canvasRef}>
        <aside className="pin-column left">
          <h4>Připnuté (L)</h4>
          {leftPins.map((panel) => (
            <button
              key={panel.id}
              className={`pin-tab ${panel.expanded ? 'active' : ''}`}
              onMouseDown={(event) => {
                closePanelOnMiddleClick(event, panel.id);
              }}
              onClick={() => togglePanelVisibility(panel.id)}
            >
              <span>{getPinnedPanelLabel(panel)}</span>
              {panel.alert ? <i /> : null}
            </button>
          ))}
        </aside>

        <aside className="pin-column right">
          <h4>Připnuté (P)</h4>
          {rightPins.map((panel) => (
            <button
              key={panel.id}
              className={`pin-tab ${panel.expanded ? 'active' : ''}`}
              onMouseDown={(event) => {
                closePanelOnMiddleClick(event, panel.id);
              }}
              onClick={() => togglePanelVisibility(panel.id)}
            >
              <span>{getPinnedPanelLabel(panel)}</span>
              {panel.alert ? <i /> : null}
            </button>
          ))}
        </aside>

        {panels
          .filter((panel) => panel.expanded)
          .map((panel) => (
            <article
              key={panel.id}
              className={`floating-window${panel.type === 'map' ? ' map-window' : ''}${panel.type === 'battleReport' ? ' battle-report-window' : ''}`}
              ref={(node) => {
                panelElementRefs.current[panel.id] = node;
              }}
              style={{
                left: `${panel.x}px`,
                top: `${panel.y}px`,
                zIndex: panel.z,
                width: `${panel.width}px`,
                height: `${panel.height}px`,
              }}
              onMouseDown={(event) => {
                if (closePanelOnMiddleClick(event, panel.id)) {
                  return;
                }
                focusPanel(panel.id);
              }}
            >
              <header className="window-header" onPointerDown={(event) => startDrag(event, panel)}>
                <div>
                  <span>{panel.label}</span>
                </div>
                <div className="window-actions" onPointerDown={(event) => event.stopPropagation()}>
                  <button
                    onClick={() => movePinToSideAndMinimize(panel.id, 'left')}
                    title="Přesunout pin na levou stranu"
                    aria-label="Přesunout pin na levou stranu"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => switchSide(panel.id)}
                    title="Přesunout pin na druhou stranu"
                    aria-label="Přesunout pin na druhou stranu"
                  >
                    ↔
                  </button>
                  <button
                    onClick={() => movePinToSideAndMinimize(panel.id, 'right')}
                    title="Přesunout pin na pravou stranu"
                    aria-label="Přesunout pin na pravou stranu"
                  >
                    →
                  </button>
                  {isStretchablePanelType(panel.type) ? (
                    <button
                      className="window-action-fit"
                      onClick={() => stretchPanelToViewport(panel.id)}
                      title="Roztáhnout okno"
                      aria-label="Roztáhnout okno"
                    >
                      Roztáhnout
                    </button>
                  ) : null}
                  <button
                    onClick={() => togglePanelVisibility(panel.id)}
                    title="Sbalit okno"
                    aria-label="Sbalit okno"
                  >
                    −
                  </button>
                  <button onClick={() => closePanel(panel.id)} title="Zavřít okno" aria-label="Zavřít okno">
                    ✕
                  </button>
                </div>
              </header>

              <div className="window-body">{renderPanelContent(panel)}</div>
              <div
                className="window-resize-handle"
                onPointerDown={(event) => startResize(event, panel)}
                role="separator"
                aria-label={`Změnit velikost okna ${panel.label}`}
              />
            </article>
          ))}
      </div>
    </div>
  );
};
