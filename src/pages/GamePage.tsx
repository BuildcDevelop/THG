import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getSession, logout, setSelectedWorld } from '../auth';
import {
  acceptKingdomInvite as acceptKingdomInviteRequest,
  cancelArmyCommand as cancelArmyCommandRequest,
  cancelBuildingUpgrade as cancelBuildingUpgradeRequest,
  cancelRecruitment as cancelRecruitmentRequest,
  createCommunicationNotificationShare,
  createKingdom as createKingdomRequest,
  fetchCommunicationInbox,
  fetchCommunicationNotificationSharePreview,
  fetchCommunicationTokenSuggestions,
  fetchGameActivity,
  fetchBattleReports,
  fetchGameState,
  fetchWorlds,
  markAllGameActivityRead,
  markGameActivityRead,
  archiveGameActivity,
  unarchiveGameActivity,
  deleteGameActivity,
  invitePlayerToKingdom as invitePlayerToKingdomRequest,
  issueArmyCommand,
  hireAcademics as hireAcademicsRequest,
  adjustResearchProjectAcademics as adjustResearchProjectAcademicsRequest,
  hireMercenaryContract as hireMercenaryContractRequest,
  kickKingdomMember as kickKingdomMemberRequest,
  leaveKingdom as leaveKingdomRequest,
  rejectKingdomInvite as rejectKingdomInviteRequest,
  recallKnight as recallKnightRequest,
  recruitUnit,
  renameVillage as renameVillageRequest,
  restartVillageProgress as restartVillageProgressRequest,
  sendMarketLogistics as sendMarketLogisticsRequest,
  sendCommunicationFriendRequest,
  sendCommunicationMessageRequest,
  startResearchProject as startResearchProjectRequest,
  setCommunicationAvatarRequest,
  transferKingdomLeadership as transferKingdomLeadershipRequest,
  upgradeBuilding,
  type ArmyCommandType,
  type BattleReportItem,
  type ArmyMovementState,
  type BattleReportListResponse,
  type BattleReportPayload,
  type GameActivityItem,
  type GameActivityListResponse,
  type DeveloperResourceBoostState,
  type GameBuildingState,
  type GameStateResponse,
  type GameUnitState,
  type KingdomHubState,
  type KingdomIncomingInvite,
  type KingdomAvailableSummary,
  type KingdomAuditLogEntry,
  type LeaderboardRow,
  type LootPriority,
  type WorldPortalItem,
} from '../api/gameApi';
import {
  COMMUNICATION_SUMMARY_EVENT,
  openCommunicationHub,
  openCommunicationThreadByUsername,
  type CommunicationSummaryEventDetail,
} from '../components/communicationEvents';

type PanelType =
  | 'city'
  | 'map'
  | 'army'
  | 'military'
  | 'commands'
  | 'research'
  | 'messages'
  | 'activity'
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
type MapSettlementKind =
  | 'active'
  | 'own'
  | 'royal'
  | 'allied'
  | 'nap'
  | 'opponent'
  | 'enemy'
  | 'abandoned';

type RegionSettlement = {
  id: string;
  villageId?: number;
  playerId?: number | null;
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

type GridPosition = {
  x: number;
  y: number;
};

type GridPixelPosition = {
  left: number;
  top: number;
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
  boostLabel: string | null;
  cap: number;
  buildingId: string;
  buildingName: string;
  buildingLevel: number;
  upgradeQueueCount: number;
  upgradeSummary: string | null;
};

type TownhallDeveloperBoostNotice = {
  isActive: boolean;
  label: string;
  reason: string;
  remainingSec: number;
  endsAtLabel: string;
};

type WorldSwitchOption = {
  id: string;
  name: string;
  status: string;
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
  nextLevelPreview: GameBuildingState['nextLevelPreview'] | null;
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

type RankingMode = 'players' | 'kingdoms' | 'attacker' | 'defender' | 'supporter';
type CombatRankingMode = Extract<RankingMode, 'attacker' | 'defender' | 'supporter'>;
type KingdomRankingMetric = 'prestige' | 'attack' | 'defense' | 'support';
type RankingPageSize = 20 | 50;

type KingdomLeaderboardRow = {
  rank: number;
  kingdom: string;
  prestige: number;
  villages: number;
  members: number;
  attackScore: number;
  defenseScore: number;
  supportScore: number;
};

type CombatLeaderboardRow = {
  rank: number;
  playerId: number;
  username: string;
  kingdom: string;
  villages: number;
  prestige: number;
  score: number;
  mode: CombatRankingMode;
};

type PlayerProfileAvatarState = {
  avatarUrl: string | null;
  loaded: boolean;
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
    label: 'Mapa',
    side: 'left',
    width: 900,
    height: 660,
  },
  army: {
    type: 'army',
    label: 'Správa lén',
    side: 'left',
    width: 520,
    height: 470,
  },
  military: {
    type: 'military',
    label: 'Armáda',
    side: 'left',
    width: 840,
    height: 620,
  },
  commands: {
    type: 'commands',
    label: 'Příkazy',
    side: 'left',
    width: 840,
    height: 620,
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
  activity: {
    type: 'activity',
    label: 'Herní záznamy',
    side: 'right',
    width: 920,
    height: 620,
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

const NAV_BUTTONS: { type: StaticPanelType; text: string; glyph: string }[] = [
  { type: 'city', text: 'Přehled léna', glyph: '⌂' },
  { type: 'map', text: 'Mapa', glyph: '⌗' },
  { type: 'army', text: 'Správa lén', glyph: '▣' },
  { type: 'military', text: 'Armáda', glyph: '⚔︎' },
  { type: 'commands', text: 'Příkazy', glyph: '✦' },
  { type: 'research', text: 'Výzkum', glyph: '✶' },
  { type: 'messages', text: 'Komunikace', glyph: '✉︎' },
  { type: 'activity', text: 'Herní záznamy', glyph: '✎' },
  { type: 'kingdom', text: 'Království', glyph: '♜' },
  { type: 'rankings', text: 'Žebříček', glyph: '☷' },
  { type: 'profile', text: 'Profil', glyph: '⚜︎' },
  { type: 'settings', text: 'Nastavení', glyph: '⚙︎' },
];

type MenuButtonProps = {
  text: string;
  title: string;
  onClick: () => void;
  className: string;
  glyph?: string;
  isOpen?: boolean;
};

const MenuButton = ({ text, title, onClick, className, glyph, isOpen = false }: MenuButtonProps) => (
  <button
    className={`menu-button-base ${className} ${isOpen ? 'is-open' : ''}`}
    onClick={onClick}
    title={title}
  >
    {glyph ? (
      <span className="nav-action-glyph" aria-hidden="true">
        {glyph}
      </span>
    ) : null}
    <span className="nav-action-title">{text}</span>
  </button>
);

const resolveResourceGlyph = (resourceName: string): string => {
  const normalized = resourceName.toLocaleLowerCase('cs-CZ');
  if (normalized.includes('dře') || normalized.includes('dre')) {
    return '/assets/ui/resources/wood-log.svg';
  }
  if (normalized.includes('ká') || normalized.includes('ka')) {
    return '/assets/ui/resources/stone-block.svg';
  }
  if (normalized.includes('žele') || normalized.includes('zele')) {
    return '/assets/ui/resources/iron-ingot.svg';
  }
  if (normalized.includes('minc') || normalized.includes('coin')) {
    return '/assets/ui/resources/coin-stack.svg';
  }
  if (normalized.includes('zlat') || normalized.includes('gold')) {
    return '/assets/ui/resources/coin-stack.svg';
  }
  if (normalized.includes('popul') || normalized.includes('obyvat')) {
    return '/assets/ui/resources/population.svg';
  }
  return '◈';
};

const resolveResourceTone = (resourceName: string): string => {
  const normalized = resourceName.toLocaleLowerCase('cs-CZ');
  if (normalized.includes('dře') || normalized.includes('dre')) {
    return 'wood';
  }
  if (normalized.includes('ká') || normalized.includes('ka')) {
    return 'stone';
  }
  if (normalized.includes('žele') || normalized.includes('zele')) {
    return 'iron';
  }
  if (normalized.includes('zlat') || normalized.includes('gold')) {
    return 'gold';
  }
  return 'neutral';
};

const DEFAULT_STRETCHED_PANEL_TYPES = new Set<StaticPanelType>([
  'city',
  'map',
  'army',
  'military',
  'commands',
  'research',
  'messages',
  'activity',
  'kingdom',
  'rankings',
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
  'gold-mine': {
    icon: getBuildingIconPath('gold-mine.png'),
    fallbackName: 'Zlatý důl',
    fallbackCategory: 'Produkce',
  },
  warehouse: {
    icon: getBuildingIconPath('warehouse.png'),
    fallbackName: 'Sklad surovin',
    fallbackCategory: 'Podpora',
  },
  hideout: {
    icon: getBuildingIconPath('hideout.png'),
    fallbackName: 'Skrýš',
    fallbackCategory: 'Podpora',
  },
  mint: {
    icon: getBuildingIconPath('mint.png'),
    fallbackName: 'Mincovna',
    fallbackCategory: 'Administrativa',
  },
  vault: {
    icon: getBuildingIconPath('vault.png'),
    fallbackName: 'Trezor',
    fallbackCategory: 'Podpora',
  },
  market: {
    icon: getBuildingIconPath('market.png'),
    fallbackName: 'Městský trh',
    fallbackCategory: 'Ekonomika',
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
const BUILDING_INTEL_ORDER = [
  'townhall',
  'warehouse',
  'hideout',
  'mint',
  'vault',
  'market',
  'residential-quarter',
  'university',
  'woodcutter',
  'quarry',
  'iron-mine',
  'gold-mine',
  'barracks',
  'stable',
  'workshop',
  'fortification',
  'gate',
] as const;

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
  scout: {
    fallbackName: 'Zvěd',
    fallbackRole: 'Špion osad',
    icon: getUnitIconPath('scout.svg'),
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
  mercenary: {
    fallbackName: 'Žoldáci',
    fallbackRole: 'Dočasná elitní obrana',
    icon: getUnitIconPath('militia.svg'),
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
const COMMAND_UNIT_ORDER = ['militia', 'archer', 'cavalry', 'scout', 'knight', 'ram', 'caravan'] as const;
type CommandUnitId = (typeof COMMAND_UNIT_ORDER)[number];
const UNIT_ATTACK_POWER: Record<CommandUnitId, number> = {
  militia: 11,
  archer: 9,
  cavalry: 18,
  scout: 4,
  knight: 300,
  ram: 0,
  caravan: 0,
};
const UNIT_DEFENSE_POWER: Record<CommandUnitId, number> = {
  militia: 12,
  archer: 14,
  cavalry: 10,
  scout: 4,
  knight: 255,
  ram: 0,
  caravan: 0,
};
const RAM_ATTACK_BONUS_MULTIPLIER = 1.1;
const UNIT_LOOT_CAPACITY: Record<CommandUnitId, number> = {
  militia: 20,
  archer: 16,
  cavalry: 80,
  scout: 0,
  knight: 45,
  ram: 0,
  caravan: 250,
};
const UNIT_TRAVEL_SPEED_TILES_PER_HOUR: Record<CommandUnitId, number> = {
  militia: 18,
  archer: 16,
  cavalry: 28,
  scout: 36,
  knight: 42,
  ram: 10,
  caravan: 14,
};
const ARMY_TRAVEL_TIME_MULTIPLIER = 1.25;
const MIN_ARMY_TRAVEL_DURATION_SEC = 45;

const ARMY_COMMAND_LABELS: Record<ArmyCommandType, string> = {
  attack: 'Útok',
  support: 'Podpora',
  move: 'Přesun',
  return: 'Návrat',
};
const LOOT_PRIORITY_LABELS: Record<LootPriority, string> = {
  balanced: 'Rovnoměrně',
  wood: 'Dřevo',
  stone: 'Kámen',
  iron: 'Železo',
};

const getOrderedMovementUnits = (
  movement: Pick<ArmyMovementState, 'units'>,
): Array<{ unitId: string; amount: number }> =>
  [...movement.units]
    .map((unit) => ({
      unitId: String(unit.unitId ?? ''),
      amount: Math.max(0, Math.floor(Number(unit.amount ?? 0))),
    }))
    .filter((unit) => unit.unitId.length > 0 && unit.amount > 0)
    .sort((left, right) => {
      const leftIndex = COMMAND_UNIT_ORDER.indexOf(left.unitId as CommandUnitId);
      const rightIndex = COMMAND_UNIT_ORDER.indexOf(right.unitId as CommandUnitId);
      const safeLeft = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
      const safeRight = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
      return safeLeft - safeRight || left.unitId.localeCompare(right.unitId, 'cs-CZ');
    });

const getMovementUnitsTotal = (movement: Pick<ArmyMovementState, 'units'>): number =>
  movement.units.reduce((sum, unit) => sum + Math.max(0, Math.floor(Number(unit.amount ?? 0))), 0);

type TooltipCursorPosition = {
  x: number;
  y: number;
};

const TOOLTIP_CURSOR_OFFSET_X = 18;
const TOOLTIP_CURSOR_OFFSET_Y = 18;
const TOOLTIP_VIEWPORT_PADDING = 10;

const clampTooltipPosition = (
  cursorPosition: TooltipCursorPosition,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): TooltipCursorPosition => {
  const maxLeft = Math.max(
    TOOLTIP_VIEWPORT_PADDING,
    Math.floor(viewportWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING),
  );
  const maxTop = Math.max(
    TOOLTIP_VIEWPORT_PADDING,
    Math.floor(viewportHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING),
  );
  const preferredLeft = Math.floor(cursorPosition.x + TOOLTIP_CURSOR_OFFSET_X);
  const preferredTop = Math.floor(cursorPosition.y + TOOLTIP_CURSOR_OFFSET_Y);
  return {
    x: Math.min(Math.max(preferredLeft, TOOLTIP_VIEWPORT_PADDING), maxLeft),
    y: Math.min(Math.max(preferredTop, TOOLTIP_VIEWPORT_PADDING), maxTop),
  };
};

const MovementArmyTooltip = ({
  movement,
  cursorPosition,
}: {
  movement: ArmyMovementState;
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const orderedUnits = getOrderedMovementUnits(movement);

  const resolvedCursorPosition = useMemo(() => {
    if (!cursorPosition || typeof window === 'undefined') {
      return null;
    }
    const estimatedTooltipWidth = Math.max(220, Math.min(360, Math.floor(window.innerWidth * 0.34)));
    const estimatedTooltipHeight = 210;
    return clampTooltipPosition(
      cursorPosition,
      estimatedTooltipWidth,
      estimatedTooltipHeight,
      window.innerWidth,
      window.innerHeight,
    );
  }, [cursorPosition]);

  if (orderedUnits.length <= 0) {
    return null;
  }

  const tooltipStyle: CSSProperties | undefined =
    resolvedCursorPosition
      ? {
          left: `${resolvedCursorPosition.x}px`,
          top: `${resolvedCursorPosition.y}px`,
        }
      : undefined;

  const tooltipNode = (
    <div
      className={`commands-army-tooltip${cursorPosition ? ' is-follow-cursor' : ''}`}
      style={tooltipStyle}
      role="tooltip"
    >
      <p>Složení armády</p>
      <ul>
        {orderedUnits.map((unit) => {
          const unitMeta = getUnitMetaById(unit.unitId);
          return (
            <li key={`movement-tooltip-${movement.id}-${unit.unitId}`}>
              <span className="unit-icon-shell tiny" aria-hidden="true">
                <img src={unitMeta.icon} alt="" className="unit-icon-image" loading="lazy" />
              </span>
              <span>{unitMeta.fallbackName}</span>
              <strong>{unit.amount.toLocaleString('cs-CZ')}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (cursorPosition && typeof document !== 'undefined') {
    return createPortal(tooltipNode, document.body);
  }

  return tooltipNode;
};

const BuildingUpgradePreviewTooltip = ({
  building,
  cursorPosition,
}: {
  building: Building;
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const preview = building.nextLevelPreview;
  const deltaLines = preview?.deltas ?? [];
  const unlockLines = preview?.unlocks ?? [];
  if (!preview || (deltaLines.length <= 0 && unlockLines.length <= 0)) {
    return null;
  }

  const resolvedCursorPosition = useMemo(() => {
    if (!cursorPosition || typeof window === 'undefined') {
      return null;
    }
    const estimatedTooltipWidth = Math.max(260, Math.min(430, Math.floor(window.innerWidth * 0.4)));
    const estimatedTooltipHeight = 260;
    return clampTooltipPosition(
      cursorPosition,
      estimatedTooltipWidth,
      estimatedTooltipHeight,
      window.innerWidth,
      window.innerHeight,
    );
  }, [cursorPosition]);

  const tooltipStyle: CSSProperties | undefined =
    resolvedCursorPosition
      ? {
          left: `${resolvedCursorPosition.x}px`,
          top: `${resolvedCursorPosition.y}px`,
        }
      : undefined;

  const tooltipNode = (
    <div
      className={`commands-army-tooltip building-upgrade-tooltip${cursorPosition ? ' is-follow-cursor' : ''}`}
      style={tooltipStyle}
      role="tooltip"
    >
      <p>
        Další úroveň {preview.fromLevel} → {preview.toLevel}
      </p>
      {deltaLines.length > 0 ? (
        <ul className="building-upgrade-tooltip-list">
          {deltaLines.map((line, index) => (
            <li key={`${building.id}-delta-${index}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {unlockLines.length > 0 ? (
        <>
          <p className="building-upgrade-tooltip-subtitle">Co se odemkne</p>
          <ul className="building-upgrade-tooltip-list">
            {unlockLines.map((line, index) => (
              <li key={`${building.id}-unlock-${index}`}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );

  if (cursorPosition && typeof document !== 'undefined') {
    return createPortal(tooltipNode, document.body);
  }

  return tooltipNode;
};

const ResearchCollaborationTooltip = ({
  project,
  cursorPosition,
}: {
  project: NonNullable<GameStateResponse['research']>['projects'][number];
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const collaborations = project.assignedVillageBreakdown ?? [];
  if (project.status !== 'researching' || collaborations.length <= 0) {
    return null;
  }

  const resolvedCursorPosition = useMemo(() => {
    if (!cursorPosition || typeof window === 'undefined') {
      return null;
    }
    const estimatedTooltipWidth = Math.max(260, Math.min(420, Math.floor(window.innerWidth * 0.36)));
    const estimatedTooltipHeight = 250;
    return clampTooltipPosition(
      cursorPosition,
      estimatedTooltipWidth,
      estimatedTooltipHeight,
      window.innerWidth,
      window.innerHeight,
    );
  }, [cursorPosition]);

  const tooltipStyle: CSSProperties | undefined =
    resolvedCursorPosition
      ? {
          left: `${resolvedCursorPosition.x}px`,
          top: `${resolvedCursorPosition.y}px`,
        }
      : undefined;

  const etaLabel =
    project.estimatedCompletionAt && project.remainingSec != null
      ? `${formatDateTimeLabel(project.estimatedCompletionAt)} (${formatDurationLabel(project.remainingSec)})`
      : 'Pozastaveno (0 akademiků)';

  const tooltipNode = (
    <div
      className={`commands-army-tooltip research-collaboration-tooltip${cursorPosition ? ' is-follow-cursor' : ''}`}
      style={tooltipStyle}
      role="tooltip"
    >
      <p>Kolaborace akademiků</p>
      <ul>
        {collaborations.map((entry) => (
          <li key={`research-collaboration-${project.id}-${entry.villageId}`}>
            <span>
              {entry.villageName} ({entry.coordX}|{entry.coordY}) · Univerzita L{entry.universityLevel}
            </span>
            <strong>{entry.assignedAcademics.toLocaleString('cs-CZ')}</strong>
          </li>
        ))}
      </ul>
      <p className="research-collaboration-footer">Odhad dokončení: {etaLabel}</p>
    </div>
  );

  if (cursorPosition && typeof document !== 'undefined') {
    return createPortal(tooltipNode, document.body);
  }

  return tooltipNode;
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
    label: 'Průmysl',
    subtitle: 'Produkce surovin a drahých kovů',
    buildingIds: ['woodcutter', 'quarry', 'iron-mine', 'gold-mine'],
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
type GameFontScaleOption = 'base' | 'plus5' | 'plus10' | 'plus15' | 'plus20';
type ShortcutActionId =
  | 'togglePinColumns'
  | 'peekPinColumnsWhileHeld'
  | 'pinActivePanelLeft'
  | 'pinActivePanelRight'
  | 'switchActivePanelSide'
  | 'closeActivePanel'
  | 'openVillageSwitchMode'
  | 'openCityPanel'
  | 'openMapPanel'
  | 'openArmyPanel'
  | 'openMilitaryPanel'
  | 'openCommandsPanel'
  | 'openResearchPanel'
  | 'openMessagesPanel'
  | 'openActivityPanel'
  | 'openRankingsPanel'
  | 'openProfilePanel'
  | 'openSettingsPanel';
type ShortcutBinding = {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
};
type PersistedShortcutSettings = {
  autoHidePinColumns?: unknown;
  bindings?: Partial<Record<ShortcutActionId, unknown>>;
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

const buildDraftUnitAmountsFromAvailable = (
  units: Unit[],
  options?: { excludeCaravan?: boolean },
): Record<string, string> => {
  const draft = {} as Record<string, string>;
  for (const unit of units) {
    if (!COMMAND_UNIT_ORDER.includes(unit.id as CommandUnitId)) {
      continue;
    }
    if (options?.excludeCaravan && unit.id === 'caravan') {
      continue;
    }
    const availableAmount = Math.max(0, Math.floor(Number(unit.amount ?? 0)));
    if (availableAmount <= 0) {
      continue;
    }
    draft[unit.id] = String(availableAmount);
  }
  return draft;
};

const calculateTotalUnitsInSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0), 0);

const calculateAttackPowerFromSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0) * UNIT_ATTACK_POWER[unitId], 0);

const calculateDefensePowerFromSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0) * UNIT_DEFENSE_POWER[unitId], 0);

const calculateLootCapacityFromSelection = (selection: Record<CommandUnitId, number>): number =>
  COMMAND_UNIT_ORDER.reduce((sum, unitId) => sum + Number(selection[unitId] ?? 0) * UNIT_LOOT_CAPACITY[unitId], 0);

const FALLBACK_ACTIVE_ORDERS = [
  'Výstavba: žádná aktivní fronta',
  'Ekonomika běží na backend cron tiku.',
  'Nábor a upgrady zapisují změny do databáze.',
];
const ACADEMIC_HIRE_COIN_COST = 250;
const RESEARCH_MAX_ASSIGNED_ACADEMICS = 3;
const MERCENARY_CONTRACT_COIN_COST = 1500;

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
const MAP_ZOOM_MAX = 100;
const MAP_ZOOM_STEP = 0.5;
const MAP_ZOOM_WHEEL_SENSITIVITY = 0.022;
const MAP_ZOOM_WHEEL_MIN_DELTA = 0.35;
const MAP_ZOOM_WHEEL_MAX_DELTA = 2.4;
const MAP_CELL_GAP_PX = 2;
const MAP_PREVIEW_CARD_WIDTH_PX = 560;
const MAP_PREVIEW_CARD_OFFSET_PX = 10;
const MAP_PREVIEW_CARD_SAFE_EDGE_PX = 12;
const MAP_PREVIEW_CARD_SAFE_TOP_PX = 80;
const MAP_PREVIEW_CARD_HOVER_HEIGHT_PX = 430;
const MAP_PREVIEW_CARD_PINNED_HEIGHT_PX = 500;
const MAP_HOVER_CLEAR_DELAY_MS = 110;
const MAP_WINDOW_SIZE_STORAGE_KEY = 'tld_map_window_size';
const LEGACY_MAP_WINDOW_SIZE_STORAGE_KEY = 'thg_map_window_size';
const PANEL_LAYOUT_STORAGE_KEY_PREFIX = 'tld_panel_layout';
const LEGACY_PANEL_LAYOUT_STORAGE_KEY_PREFIX = 'thg_panel_layout';
const LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX = 'tld_last_own_settlement';
const LEGACY_LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX = 'thg_last_own_settlement';
const MAP_ZOOM_STORAGE_KEY_PREFIX = 'tld_map_zoom';
const LEGACY_MAP_ZOOM_STORAGE_KEY_PREFIX = 'thg_map_zoom';
const ACTIVE_VILLAGE_STORAGE_KEY_PREFIX = 'tld_active_village';
const LEGACY_ACTIVE_VILLAGE_STORAGE_KEY_PREFIX = 'thg_active_village';
const ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX = 'tld_army_target_history';
const LEGACY_ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX = 'thg_army_target_history';
const GAME_FONT_SCALE_STORAGE_KEY_PREFIX = 'tld_game_font_scale';
const LEGACY_GAME_FONT_SCALE_STORAGE_KEY_PREFIX = 'thg_game_font_scale';
const SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX = 'tld_shortcut_settings';
const LEGACY_SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX = 'thg_shortcut_settings';
const MAP_WINDOW_MIN_WIDTH = 620;
const MAP_WINDOW_MIN_HEIGHT = 460;
const STATE_POLL_INTERVAL_MS = 15000;
const REPORTS_POLL_INTERVAL_MS = 25000;
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
const WORLD_LABELS: Record<string, string> = {
  'dominion-1': 'Dominion I: První úsvit',
  'dominion-1-fire': 'Dominion I: Síla ohně',
};
const GAME_FONT_SCALE_OPTIONS: { value: GameFontScaleOption; label: string; scalePercent: number }[] = [
  { value: 'base', label: 'Aktuální', scalePercent: 100 },
  { value: 'plus5', label: 'Zvětšit font o 5 %', scalePercent: 105 },
  { value: 'plus10', label: 'Zvětšit font o 10 %', scalePercent: 110 },
  { value: 'plus15', label: 'Zvětšit font o 15 %', scalePercent: 115 },
  { value: 'plus20', label: 'Zvětšit font o 20 %', scalePercent: 120 },
];
const GAME_FONT_SCALE_PERCENT_BY_OPTION: Record<GameFontScaleOption, number> = {
  base: 100,
  plus5: 105,
  plus10: 110,
  plus15: 115,
  plus20: 120,
};
const SHORTCUT_ACTIONS: Array<{
  id: ShortcutActionId;
  label: string;
  defaultBinding: ShortcutBinding;
}> = [
  {
    id: 'togglePinColumns',
    label: 'Zobrazit/Skrýt pin sloupce',
    defaultBinding: { key: 'space', ctrl: true, alt: false, shift: false, meta: false },
  },
  {
    id: 'peekPinColumnsWhileHeld',
    label: 'Přepnout overlay pin sloupců',
    defaultBinding: { key: 'v', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'pinActivePanelLeft',
    label: 'Připnout aktivní okno vlevo',
    defaultBinding: { key: 'arrowleft', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'pinActivePanelRight',
    label: 'Připnout aktivní okno vpravo',
    defaultBinding: { key: 'arrowright', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'switchActivePanelSide',
    label: 'Přesunout aktivní okno na druhou stranu',
    defaultBinding: { key: 'arrowup', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'closeActivePanel',
    label: 'Zavřít aktivní okno',
    defaultBinding: { key: 'arrowdown', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openVillageSwitchMode',
    label: 'Rychlá změna léna (TAB režim)',
    defaultBinding: { key: 'tab', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openCityPanel',
    label: 'Přehled léna',
    defaultBinding: { key: 'l', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openMapPanel',
    label: 'Mapa',
    defaultBinding: { key: 'm', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openArmyPanel',
    label: 'Správa lén',
    defaultBinding: { key: 's', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openMilitaryPanel',
    label: 'Armáda',
    defaultBinding: { key: 'a', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openCommandsPanel',
    label: 'Příkazy',
    defaultBinding: { key: 'p', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openResearchPanel',
    label: 'Výzkum',
    defaultBinding: { key: 'v', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openMessagesPanel',
    label: 'Komunikace',
    defaultBinding: { key: 'k', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openActivityPanel',
    label: 'Herní záznamy',
    defaultBinding: { key: 'h', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openRankingsPanel',
    label: 'Žebříček',
    defaultBinding: { key: 'ž', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openProfilePanel',
    label: 'Profil',
    defaultBinding: { key: 'u', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openSettingsPanel',
    label: 'Nastavení',
    defaultBinding: { key: 'n', ctrl: false, alt: false, shift: false, meta: false },
  },
];
const PANEL_SHORTCUT_ACTION_TO_PANEL_TYPE: Record<
  | 'openCityPanel'
  | 'openMapPanel'
  | 'openArmyPanel'
  | 'openMilitaryPanel'
  | 'openCommandsPanel'
  | 'openResearchPanel'
  | 'openMessagesPanel'
  | 'openActivityPanel'
  | 'openRankingsPanel'
  | 'openProfilePanel'
  | 'openSettingsPanel',
  StaticPanelType
> = {
  openCityPanel: 'city',
  openMapPanel: 'map',
  openArmyPanel: 'army',
  openMilitaryPanel: 'military',
  openCommandsPanel: 'commands',
  openResearchPanel: 'research',
  openMessagesPanel: 'messages',
  openActivityPanel: 'activity',
  openRankingsPanel: 'rankings',
  openProfilePanel: 'profile',
  openSettingsPanel: 'settings',
};
const PANEL_SHORTCUT_ACTION_IDS = Object.keys(PANEL_SHORTCUT_ACTION_TO_PANEL_TYPE) as Array<
  keyof typeof PANEL_SHORTCUT_ACTION_TO_PANEL_TYPE
>;
const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutActionId, ShortcutBinding> = Object.fromEntries(
  SHORTCUT_ACTIONS.map((item) => [item.id, item.defaultBinding]),
) as Record<ShortcutActionId, ShortcutBinding>;
const RESERVED_SHORTCUT_SERIALS = new Set([
  'ctrl+w',
  'ctrl+t',
  'ctrl+n',
  'ctrl+r',
  'ctrl+l',
  'ctrl+p',
  'ctrl+shift+t',
  'ctrl+tab',
  'ctrl+shift+tab',
]);
const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_CROP_VIEW_SIZE_PX = 220;
const AVATAR_OUTPUT_SIZE_PX = 300;
const AVATAR_OUTPUT_MAX_BYTES = 900_000;
const AVATAR_ZOOM_MIN = 1;
const AVATAR_ZOOM_MAX = 3;
const AVATAR_ZOOM_STEP = 0.01;

type AvatarCropSource = {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  image: HTMLImageElement;
};

type AvatarCropMetrics = {
  baseScale: number;
  scaledWidth: number;
  scaledHeight: number;
  maxOffsetX: number;
  maxOffsetY: number;
};

const normalizeShortcutKey = (keyRaw: unknown): string => {
  const key = String(keyRaw ?? '').trim().toLowerCase();
  if (!key) {
    return '';
  }
  if (key === ' ') {
    return 'space';
  }
  if (key === 'esc') {
    return 'escape';
  }
  return key;
};

const isModifierOnlyShortcutKey = (key: string): boolean =>
  key === 'control' || key === 'shift' || key === 'alt' || key === 'meta';

const normalizeShortcutBinding = (binding: ShortcutBinding): ShortcutBinding => ({
  key: normalizeShortcutKey(binding.key),
  ctrl: binding.ctrl === true,
  alt: binding.alt === true,
  shift: binding.shift === true,
  meta: binding.meta === true,
});

const isShortcutBinding = (value: unknown): value is ShortcutBinding => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ShortcutBinding>;
  const key = normalizeShortcutKey(candidate.key);
  return (
    key.length > 0 &&
    !isModifierOnlyShortcutKey(key) &&
    typeof candidate.ctrl === 'boolean' &&
    typeof candidate.alt === 'boolean' &&
    typeof candidate.shift === 'boolean' &&
    typeof candidate.meta === 'boolean'
  );
};

const serializeShortcutBinding = (binding: ShortcutBinding): string => {
  const normalized = normalizeShortcutBinding(binding);
  const parts: string[] = [];
  if (normalized.ctrl) {
    parts.push('ctrl');
  }
  if (normalized.alt) {
    parts.push('alt');
  }
  if (normalized.shift) {
    parts.push('shift');
  }
  if (normalized.meta) {
    parts.push('meta');
  }
  parts.push(normalized.key);
  return parts.join('+');
};

const parseShortcutBinding = (value: unknown): ShortcutBinding | null => {
  if (isShortcutBinding(value)) {
    return normalizeShortcutBinding(value);
  }

  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) {
    return null;
  }
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const modifiers = new Set(parts.slice(0, -1));
  const key = normalizeShortcutKey(parts.at(-1));
  if (!key || isModifierOnlyShortcutKey(key)) {
    return null;
  }
  return {
    key,
    ctrl: modifiers.has('ctrl'),
    alt: modifiers.has('alt'),
    shift: modifiers.has('shift'),
    meta: modifiers.has('meta'),
  };
};

const formatShortcutBindingLabel = (binding: ShortcutBinding): string => {
  const normalized = normalizeShortcutBinding(binding);
  const parts: string[] = [];
  if (normalized.ctrl) {
    parts.push('Ctrl');
  }
  if (normalized.alt) {
    parts.push('Alt');
  }
  if (normalized.shift) {
    parts.push('Shift');
  }
  if (normalized.meta) {
    parts.push('Meta');
  }
  const keyLabelMap: Record<string, string> = {
    space: 'Space',
    backspace: 'Backspace',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    enter: 'Enter',
    escape: 'Escape',
    tab: 'Tab',
  };
  parts.push(keyLabelMap[normalized.key] ?? normalized.key.toUpperCase());
  return parts.join('+');
};

const buildShortcutBindingFromKeyboardEvent = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
): ShortcutBinding | null => {
  const key = normalizeShortcutKey(event.key);
  if (!key || isModifierOnlyShortcutKey(key)) {
    return null;
  }
  return normalizeShortcutBinding({
    key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  });
};

const doesShortcutMatchEvent = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  binding: ShortcutBinding,
): boolean => {
  const eventBinding = buildShortcutBindingFromKeyboardEvent(event);
  if (!eventBinding) {
    return false;
  }
  const normalizedBinding = normalizeShortcutBinding(binding);
  return (
    eventBinding.key === normalizedBinding.key &&
    eventBinding.ctrl === normalizedBinding.ctrl &&
    eventBinding.alt === normalizedBinding.alt &&
    eventBinding.shift === normalizedBinding.shift &&
    eventBinding.meta === normalizedBinding.meta
  );
};

const isReservedShortcutBinding = (binding: ShortcutBinding): boolean =>
  RESERVED_SHORTCUT_SERIALS.has(serializeShortcutBinding(binding));

const detectTouchDevice = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    return true;
  }
  return Number(window.navigator.maxTouchPoints ?? 0) > 0;
};

const clampAvatarValue = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const computeAvatarCropMetrics = (
  source: AvatarCropSource | null,
  zoom: number,
): AvatarCropMetrics | null => {
  if (!source || source.width <= 0 || source.height <= 0) {
    return null;
  }
  const safeZoom = clampAvatarValue(
    Number.isFinite(zoom) ? zoom : AVATAR_ZOOM_MIN,
    AVATAR_ZOOM_MIN,
    AVATAR_ZOOM_MAX,
  );
  const baseScale = Math.max(AVATAR_CROP_VIEW_SIZE_PX / source.width, AVATAR_CROP_VIEW_SIZE_PX / source.height);
  const scaledWidth = source.width * baseScale * safeZoom;
  const scaledHeight = source.height * baseScale * safeZoom;
  const maxOffsetX = Math.max(0, (scaledWidth - AVATAR_CROP_VIEW_SIZE_PX) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - AVATAR_CROP_VIEW_SIZE_PX) / 2);
  return {
    baseScale,
    scaledWidth,
    scaledHeight,
    maxOffsetX,
    maxOffsetY,
  };
};

const clampAvatarOffset = (
  source: AvatarCropSource | null,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } => {
  const metrics = computeAvatarCropMetrics(source, zoom);
  if (!metrics) {
    return { offsetX: 0, offsetY: 0 };
  }
  return {
    offsetX: clampAvatarValue(offsetX, -metrics.maxOffsetX, metrics.maxOffsetX),
    offsetY: clampAvatarValue(offsetY, -metrics.maxOffsetY, metrics.maxOffsetY),
  };
};

const loadImageElementFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Obrazek se nepodarilo nacist.'));
    image.decoding = 'async';
    image.src = dataUrl;
  });

const readAvatarFileAsSource = async (file: File): Promise<AvatarCropSource> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = typeof reader.result === 'string' ? reader.result : '';
      if (!nextValue) {
        reject(new Error('Nahrany soubor nelze zpracovat.'));
        return;
      }
      resolve(nextValue);
    };
    reader.onerror = () => reject(new Error('Nahrany soubor nelze precist.'));
    reader.readAsDataURL(file);
  });

  const image = await loadImageElementFromDataUrl(dataUrl);
  const width = Math.max(1, Math.floor(Number(image.naturalWidth ?? image.width ?? 0)));
  const height = Math.max(1, Math.floor(Number(image.naturalHeight ?? image.height ?? 0)));
  return {
    dataUrl,
    mimeType: file.type || 'image/png',
    fileName: file.name || 'avatar',
    width,
    height,
    image,
  };
};

const buildCroppedAvatarDataUrl = (
  source: AvatarCropSource | null,
  zoom: number,
  offsetX: number,
  offsetY: number,
): string | null => {
  if (!source) {
    return null;
  }

  const metrics = computeAvatarCropMetrics(source, zoom);
  if (!metrics) {
    return null;
  }
  const safeOffsets = clampAvatarOffset(source, zoom, offsetX, offsetY);
  const totalScale = metrics.baseScale * clampAvatarValue(zoom, AVATAR_ZOOM_MIN, AVATAR_ZOOM_MAX);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE_PX;
  canvas.height = AVATAR_OUTPUT_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const displayedWidth = source.width * totalScale;
  const displayedHeight = source.height * totalScale;
  const displayedLeft = (AVATAR_CROP_VIEW_SIZE_PX - displayedWidth) / 2 + safeOffsets.offsetX;
  const displayedTop = (AVATAR_CROP_VIEW_SIZE_PX - displayedHeight) / 2 + safeOffsets.offsetY;

  const sourceX = clampAvatarValue((0 - displayedLeft) / totalScale, 0, source.width - 1);
  const sourceY = clampAvatarValue((0 - displayedTop) / totalScale, 0, source.height - 1);
  const sourceWidth = clampAvatarValue(AVATAR_CROP_VIEW_SIZE_PX / totalScale, 1, source.width - sourceX);
  const sourceHeight = clampAvatarValue(AVATAR_CROP_VIEW_SIZE_PX / totalScale, 1, source.height - sourceY);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    source.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    AVATAR_OUTPUT_SIZE_PX,
    AVATAR_OUTPUT_SIZE_PX,
  );
  const webpDataUrl = canvas.toDataURL('image/webp', 0.86);
  if (webpDataUrl.startsWith('data:image/webp;base64,')) {
    return webpDataUrl;
  }
  return canvas.toDataURL('image/png');
};

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
  royal: 'Královská osada',
  allied: 'Spojenecká osada',
  nap: 'Dohoda o neútočení',
  opponent: 'Protivník',
  enemy: 'Nepřítel',
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
  if (panel.type === 'city' || panel.type === 'map' || panel.type === 'army' || panel.type === 'commands') {
    return true;
  }

  if (panel.type === 'building' && panel.buildingId) {
    return VILLAGE_SCOPED_BUILDING_IDS.has(panel.buildingId);
  }

  return false;
};

const getSettlementMapKind = (
  settlement: Pick<
    RegionSettlement,
    'kind' | 'relation' | 'owner' | 'villageId' | 'protectionRemainingSec' | 'note' | 'kingdom'
  >,
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

  if (settlement.kind === 'bot') {
    return 'royal';
  }

  if (settlement.relation === 'ally') {
    return 'allied';
  }

  const isEnemy = settlement.relation === 'enemy';
  if (!isEnemy) {
    return 'opponent';
  }

  const protectionRemainingSec = Math.max(0, Number(settlement.protectionRemainingSec ?? 0));
  const noteNormalized = String(settlement.note ?? '').toLowerCase();
  if (protectionRemainingSec > 0 || /(nap|neútočení|neutoceni|pakt|příměří|primiri|dohoda)/i.test(noteNormalized)) {
    return 'nap';
  }

  if (/(nepřítel|nepritel|válka|valka|hrozba|war|hostile)/i.test(noteNormalized)) {
    return 'enemy';
  }

  if (String(settlement.kingdom ?? '').trim().toLowerCase() === 'neutral') {
    return 'opponent';
  }

  return 'enemy';
};

const canTargetSettlementForArmyCommand = ({
  settlement,
  commandType,
  currentVillageId,
  currentUsername,
}: {
  settlement: Pick<
    RegionSettlement,
    'villageId' | 'owner' | 'relation' | 'protectionRemainingSec' | 'prestigeAttackBlockedForViewer'
  >;
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
    return isOwnSettlement;
  }

  const targetProtectionRemainingSec = Math.max(0, Number(settlement.protectionRemainingSec ?? 0));
  if (targetProtectionRemainingSec > 0) {
    return false;
  }
  if (settlement.prestigeAttackBlockedForViewer === true) {
    return false;
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

type SettlementPrestigeTier = 'A' | 'B' | 'C' | 'D' | 'E';

type SettlementPrestigeMeta = {
  tier: SettlementPrestigeTier;
  letter: SettlementPrestigeTier;
  label: string;
  imagePath: string;
};

const SETTLEMENT_PRESTIGE_META_BY_TIER: Record<SettlementPrestigeTier, SettlementPrestigeMeta> = {
  A: {
    tier: 'A',
    letter: 'A',
    label: 'Osada',
    imagePath: '/assets/map/settlements/osada.png',
  },
  B: {
    tier: 'B',
    letter: 'B',
    label: 'Vesnice',
    imagePath: '/assets/map/settlements/vesnice.png',
  },
  C: {
    tier: 'C',
    letter: 'C',
    label: 'Město',
    imagePath: '/assets/map/settlements/mesto.png',
  },
  D: {
    tier: 'D',
    letter: 'D',
    label: 'Královské město',
    imagePath: '/assets/map/settlements/kralovske-mesto.png',
  },
  E: {
    tier: 'E',
    letter: 'E',
    label: 'Hlavní město říše',
    imagePath: '/assets/map/settlements/hlavni-mesto-rise.png',
  },
};

const resolveSettlementPrestigeTier = (prestigeRaw: number): SettlementPrestigeTier => {
  const prestige = Math.max(0, Math.floor(Number(prestigeRaw ?? 0)));
  if (prestige >= 20000) {
    return 'E';
  }
  if (prestige >= 10000) {
    return 'D';
  }
  if (prestige >= 6000) {
    return 'C';
  }
  if (prestige >= 3000) {
    return 'B';
  }
  return 'A';
};

const resolveSettlementPrestigeMeta = (prestigeRaw: number): SettlementPrestigeMeta =>
  SETTLEMENT_PRESTIGE_META_BY_TIER[resolveSettlementPrestigeTier(prestigeRaw)];

const resolveUnitTravelDurationSec = (
  unitId: CommandUnitId,
  distanceTilesRaw: number | null,
): number | null => {
  if (distanceTilesRaw == null) {
    return null;
  }
  const distanceTiles = Math.max(0, Math.floor(Number(distanceTilesRaw ?? 0)));
  const speedTilesPerHour = Math.max(0, Number(UNIT_TRAVEL_SPEED_TILES_PER_HOUR[unitId] ?? 0));
  if (!Number.isFinite(speedTilesPerHour) || speedTilesPerHour <= 0) {
    return null;
  }
  const durationSec = (distanceTiles / speedTilesPerHour) * 3600 * ARMY_TRAVEL_TIME_MULTIPLIER;
  return Math.max(MIN_ARMY_TRAVEL_DURATION_SEC, Math.round(durationSec));
};

const toGridCellKey = (position: GridPosition): string => `${position.x},${position.y}`;

const toGridPixelPosition = (
  position: GridPosition,
  cellSize: number,
  cellGap: number,
  inset = 0,
): GridPixelPosition => ({
  left: (position.x - 1) * (cellSize + cellGap) + inset,
  top: (position.y - 1) * (cellSize + cellGap) + inset,
});

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
    const raw =
      window.localStorage.getItem(MAP_WINDOW_SIZE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_MAP_WINDOW_SIZE_STORAGE_KEY);
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
const getLegacyLastOwnSettlementStorageKey = (username: string): string =>
  `${LEGACY_LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredLastOwnSettlementId = (username: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getLastOwnSettlementStorageKey(username)) ??
      window.localStorage.getItem(getLegacyLastOwnSettlementStorageKey(username));
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
const getLegacyActiveVillageStorageKey = (username: string): string =>
  `${LEGACY_ACTIVE_VILLAGE_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredActiveVillageId = (username: string): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getActiveVillageStorageKey(username)) ??
      window.localStorage.getItem(getLegacyActiveVillageStorageKey(username));
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
const getLegacyArmyTargetHistoryStorageKey = (username: string): string =>
  `${LEGACY_ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredArmyTargetHistory = (username: string): ArmyTargetHistoryByVillageId => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw =
      window.localStorage.getItem(getArmyTargetHistoryStorageKey(username)) ??
      window.localStorage.getItem(getLegacyArmyTargetHistoryStorageKey(username));
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
const getLegacyMapZoomStorageKey = (username: string): string =>
  `${LEGACY_MAP_ZOOM_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const normalizeMapZoom = (value: number): number => {
  const clamped = clamp(value, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  return Math.round(clamped / MAP_ZOOM_STEP) * MAP_ZOOM_STEP;
};

const readStoredMapZoom = (username: string): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const raw =
      window.localStorage.getItem(getMapZoomStorageKey(username)) ??
      window.localStorage.getItem(getLegacyMapZoomStorageKey(username));
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

const getGameFontScaleStorageKey = (username: string): string =>
  `${GAME_FONT_SCALE_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;
const getLegacyGameFontScaleStorageKey = (username: string): string =>
  `${LEGACY_GAME_FONT_SCALE_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const isGameFontScaleOption = (value: unknown): value is GameFontScaleOption =>
  value === 'base' || value === 'plus5' || value === 'plus10' || value === 'plus15' || value === 'plus20';

const normalizeGameFontScaleOption = (value: unknown): GameFontScaleOption => {
  if (isGameFontScaleOption(value)) {
    return value;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '105' || normalized === '1.05') {
    return 'plus5';
  }
  if (normalized === '110' || normalized === '1.1' || normalized === '1.10') {
    return 'plus10';
  }
  if (normalized === '115' || normalized === '1.15') {
    return 'plus15';
  }
  if (normalized === '120' || normalized === '1.2' || normalized === '1.20') {
    return 'plus20';
  }
  return 'base';
};

const readStoredGameFontScaleOption = (username: string): GameFontScaleOption => {
  if (typeof window === 'undefined') {
    return 'base';
  }

  try {
    const raw =
      window.localStorage.getItem(getGameFontScaleStorageKey(username)) ??
      window.localStorage.getItem(getLegacyGameFontScaleStorageKey(username));
    if (!raw) {
      return 'base';
    }
    return normalizeGameFontScaleOption(raw);
  } catch {
    return 'base';
  }
};

const saveStoredGameFontScaleOption = (username: string, option: GameFontScaleOption): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getGameFontScaleStorageKey(username), option);
  } catch {
    // Ignore storage errors.
  }
};

const getShortcutSettingsStorageKey = (username: string): string =>
  `${SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;
const getLegacyShortcutSettingsStorageKey = (username: string): string =>
  `${LEGACY_SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredShortcutSettings = (
  username: string,
): { autoHidePinColumns: boolean; customBindings: Partial<Record<ShortcutActionId, ShortcutBinding>> } => {
  if (typeof window === 'undefined') {
    return {
      autoHidePinColumns: false,
      customBindings: {},
    };
  }

  try {
    const raw =
      window.localStorage.getItem(getShortcutSettingsStorageKey(username)) ??
      window.localStorage.getItem(getLegacyShortcutSettingsStorageKey(username));
    if (!raw) {
      return {
        autoHidePinColumns: false,
        customBindings: {},
      };
    }

    const parsed = JSON.parse(raw) as PersistedShortcutSettings;
    const customBindings: Partial<Record<ShortcutActionId, ShortcutBinding>> = {};
    for (const action of SHORTCUT_ACTIONS) {
      const parsedBinding = parseShortcutBinding(parsed?.bindings?.[action.id]);
      if (!parsedBinding) {
        continue;
      }
      customBindings[action.id] = parsedBinding;
    }

    return {
      autoHidePinColumns: parsed?.autoHidePinColumns === true,
      customBindings,
    };
  } catch {
    return {
      autoHidePinColumns: false,
      customBindings: {},
    };
  }
};

const saveStoredShortcutSettings = (
  username: string,
  settings: { autoHidePinColumns: boolean; customBindings: Partial<Record<ShortcutActionId, ShortcutBinding>> },
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const bindingsPayload: Partial<Record<ShortcutActionId, string>> = {};
  for (const action of SHORTCUT_ACTIONS) {
    const binding = settings.customBindings[action.id];
    if (!binding) {
      continue;
    }
    bindingsPayload[action.id] = serializeShortcutBinding(binding);
  }

  try {
    window.localStorage.setItem(
      getShortcutSettingsStorageKey(username),
      JSON.stringify({
        autoHidePinColumns: settings.autoHidePinColumns === true,
        bindings: bindingsPayload,
      }),
    );
  } catch {
    // Ignore storage errors.
  }
};

const getPanelLayoutStorageKey = (username: string): string =>
  `${PANEL_LAYOUT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;
const getLegacyPanelLayoutStorageKey = (username: string): string =>
  `${LEGACY_PANEL_LAYOUT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

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
    const raw =
      window.localStorage.getItem(getPanelLayoutStorageKey(username)) ??
      window.localStorage.getItem(getLegacyPanelLayoutStorageKey(username));
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

const formatCzechCountLabel = (countRaw: number, one: string, few: string, many: string): string => {
  const count = Math.abs(Math.floor(Number(countRaw)));
  if (count % 10 === 1 && count % 100 !== 11) {
    return one;
  }
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return few;
  }
  return many;
};

const formatDurationVerboseLabel = (seconds: number | null): string => {
  if (seconds == null) {
    return '-';
  }

  const safe = Math.max(0, Math.floor(seconds));
  const totalHours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  const parts: string[] = [];
  if (totalHours > 0) {
    parts.push(`${totalHours} ${formatCzechCountLabel(totalHours, 'hodina', 'hodiny', 'hodin')}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${formatCzechCountLabel(minutes, 'minuta', 'minuty', 'minut')}`);
  }
  if (parts.length === 0) {
    parts.push(`${secs} ${formatCzechCountLabel(secs, 'sekunda', 'sekundy', 'sekund')}`);
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts[0]} a ${parts[1]}`;
};

const formatDateTimeLabel = (value: string | number | Date | null | undefined): string => {
  if (value == null) {
    return '-';
  }
  const timestampMs = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(timestampMs)) {
    return '-';
  }
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestampMs));
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

const adjustNumericInputByWheel = (
  event: ReactWheelEvent<HTMLInputElement>,
  onValueChange: (nextValue: string) => void,
): void => {
  event.preventDefault();
  const target = event.currentTarget;
  const min = Number(target.min || 0);
  const max = Number(target.max || Number.MAX_SAFE_INTEGER);
  const step = Math.max(1, Math.floor(Number(target.step || 1)));
  const current = Math.max(0, Math.floor(Number(target.value || 0)));
  const direction = event.deltaY < 0 ? 1 : -1;
  const next = clamp(current + direction * step, min, max);
  onValueChange(next <= 0 ? '' : String(next));
};

const extractVillageBaseName = (label: string): string => {
  const normalized = String(label ?? '').trim();
  if (!normalized) {
    return '';
  }
  return normalized
    .replace(/\s*\(\d{1,4}\|\d{1,4}\)\s*$/u, '')
    .replace(/\s+\d{1,4}\|\d{1,4}\s*$/u, '')
    .trim();
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
  armyMovementOrders,
  recruitQueueOrders,
  onOpenBuilding,
  onOpenArmyRecruitment,
  onRenameVillage,
  onUpgradeBuilding,
  onCancelBuildingUpgrade,
  onCancelRecruitment,
  buildingUpgradeQueueByBuilding,
  upgradePendingBuildingId,
  isRenameVillagePending,
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
  armyMovementOrders: ArmyMovementState[];
  recruitQueueOrders: RecruitQueueOrder[];
  onOpenBuilding: (building: Building) => void;
  onOpenArmyRecruitment: () => void;
  onRenameVillage: (nextName: string) => Promise<string>;
  onUpgradeBuilding: (building: Building) => void;
  onCancelBuildingUpgrade: (upgradeOrderId: number, buildingId: string) => void;
  onCancelRecruitment: (order: RecruitQueueOrder) => void;
  buildingUpgradeQueueByBuilding: Map<string, BuildingUpgradeQueueOrder[]>;
  upgradePendingBuildingId: string | null;
  isRenameVillagePending: boolean;
  cancelUpgradePendingOrderId: number | null;
  cancelRecruitmentPendingId: number | null;
  buildingNotices: Record<string, string>;
}) => {
  const [renameDraft, setRenameDraft] = useState(() => extractVillageBaseName(villageLabel));
  const [renameNotice, setRenameNotice] = useState<string | null>(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [buildingTooltipCursorPosition, setBuildingTooltipCursorPosition] = useState<TooltipCursorPosition | null>(
    null,
  );
  const [hoveredArmyOrderKey, setHoveredArmyOrderKey] = useState<string | null>(null);
  const [armyOrderTooltipCursorPosition, setArmyOrderTooltipCursorPosition] = useState<TooltipCursorPosition | null>(
    null,
  );
  const buildingsById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );

  useEffect(() => {
    setRenameDraft(extractVillageBaseName(villageLabel));
  }, [villageLabel]);

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
        label: 'Infrastruktura',
        subtitle: 'Speciální řetězce a podpůrné budovy',
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

  const handleRenameSubmit = useCallback(async () => {
    const notice = await onRenameVillage(renameDraft);
    setRenameNotice(notice);
  }, [onRenameVillage, renameDraft]);

  return (
    <div className="city-panel">
      <div className="city-overview-layout">
        <aside className="city-stats-grid">
          <article>
            <h4>Město</h4>
            <strong>{villageLabel}</strong>
            <span>{regionLabel}</span>
            <div className="settings-avatar-input">
              <label>
                Změnit název léna
                <input
                  type="text"
                  value={renameDraft}
                  maxLength={14}
                  onChange={(event) => {
                    setRenameDraft(event.target.value);
                    setRenameNotice(null);
                  }}
                  onKeyDown={(event) => handleActionOnEnter(event, () => void handleRenameSubmit())}
                  disabled={isRenameVillagePending}
                />
              </label>
              <small className="row-help">Souřadnice se nemění a zůstávají vždy za názvem léna.</small>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  void handleRenameSubmit();
                }}
                disabled={isRenameVillagePending || !renameDraft.trim()}
              >
                {isRenameVillagePending ? 'Ukládám...' : 'Přejmenovat'}
              </button>
              {renameNotice ? <small className="row-help">{renameNotice}</small> : null}
            </div>
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
                      const queueInfoLabel = `Fronta staveb: ${queuedUpgradeCount.toLocaleString('cs-CZ')} ${formatCzechCountLabel(
                        queuedUpgradeCount,
                        'položka',
                        'položky',
                        'položek',
                      )}`;

                      return (
                        <article
                          key={building.id}
                          className={`city-building-card has-army-tooltip ${building.isInProgress ? 'is-progress' : ''} ${isUnbuilt ? 'is-unbuilt' : ''} ${hoveredBuildingId === building.id ? 'is-tooltip-open' : ''}`}
                          role="button"
                          tabIndex={0}
                          title={
                            canTriggerUpgrade
                              ? 'Klikni pro rozšíření budovy.'
                              : 'Detail budovy.'
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
                          onMouseEnter={(event) => {
                            if (!building.nextLevelPreview) {
                              return;
                            }
                            setHoveredBuildingId(building.id);
                            setBuildingTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                          }}
                          onMouseMove={(event) => {
                            if (hoveredBuildingId !== building.id) {
                              return;
                            }
                            setBuildingTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                          }}
                          onMouseLeave={() => {
                            setHoveredBuildingId((previous) => (previous === building.id ? null : previous));
                            setBuildingTooltipCursorPosition(null);
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
                          <small className="row-help">{queueInfoLabel}</small>
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
                          {hoveredBuildingId === building.id ? (
                            <BuildingUpgradePreviewTooltip
                              building={building}
                              cursorPosition={buildingTooltipCursorPosition}
                            />
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
                      <strong className="city-unit-amount">
                        {unit.amount.toLocaleString('cs-CZ')}
                        {unit.stationedSupportCount > 0
                          ? ` (+${unit.stationedSupportCount.toLocaleString('cs-CZ')})`
                          : ''}
                      </strong>
                    </div>
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
                {armyMovementOrders.map((movement) => {
                  const movementKey = `city-movement-${movement.commandType}-${movement.id}-${movement.originVillageId}-${movement.targetVillageId}`;
                  const unitsTotal = getMovementUnitsTotal(movement);
                  const isIncoming = movement.isIncoming === true;
                  return (
                    <li
                      key={movementKey}
                      className={`order-line with-icon city-army-order-line has-army-tooltip${
                        hoveredArmyOrderKey === movementKey ? ' is-tooltip-open' : ''
                      }`}
                      onMouseEnter={(event) => {
                        setHoveredArmyOrderKey(movementKey);
                        setArmyOrderTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                      }}
                      onMouseMove={(event) => {
                        setArmyOrderTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                      }}
                      onMouseLeave={() => {
                        setHoveredArmyOrderKey((previous) => (previous === movementKey ? null : previous));
                        setArmyOrderTooltipCursorPosition(null);
                      }}
                    >
                      <span
                        className={`command-badge ${movement.commandType} compact`}
                        aria-label={ARMY_COMMAND_LABELS[movement.commandType]}
                        title={ARMY_COMMAND_LABELS[movement.commandType]}
                      >
                        <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                      </span>
                      <div className="city-army-order-content">
                        <span>
                          {ARMY_COMMAND_LABELS[movement.commandType]}
                          {isIncoming ? ' (příchozí)' : ''}: {movement.originName} → {movement.targetName}
                        </span>
                        <small>
                          Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA{' '}
                          {formatDurationLabel(Math.max(0, movement.remainingSec))}
                        </small>
                      </div>
                      {hoveredArmyOrderKey === movementKey ? (
                        <MovementArmyTooltip movement={movement} cursorPosition={armyOrderTooltipCursorPosition} />
                      ) : null}
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
  buildings,
  recruitQueueOrders,
  settlements,
  currentUsername,
  onRecruit,
  onCancelRecruitment,
  onUpgradeBuilding,
  onUpgradeBuildingInVillage,
  onRecruitInVillage,
  onOpenSettlementByVillageId,
  recruitPendingUnitId,
  cancelRecruitmentPendingId,
  upgradePendingBuildingId,
  notice,
  noticeUnitId,
}: {
  units: Unit[];
  buildings: Building[];
  recruitQueueOrders: RecruitQueueOrder[];
  settlements: RegionSettlement[];
  currentUsername: string;
  onRecruit: (unit: Unit, amount: number) => Promise<boolean>;
  onCancelRecruitment: (order: RecruitQueueOrder) => void;
  onUpgradeBuilding: (building: Building) => void;
  onUpgradeBuildingInVillage: (villageId: number, buildingId: string) => Promise<string>;
  onRecruitInVillage: (
    villageId: number,
    unitId: string,
    amount: number,
  ) => Promise<string>;
  onOpenSettlementByVillageId: (villageId: number) => void;
  recruitPendingUnitId: string | null;
  cancelRecruitmentPendingId: number | null;
  upgradePendingBuildingId: string | null;
  notice: string | null;
  noticeUnitId: string | null;
}) => {
  const [recruitDraftAmounts, setRecruitDraftAmounts] = useState<Record<string, string>>({});
  const [armyViewMode, setArmyViewMode] = useState<'selectedVillage' | 'multiVillage'>('selectedVillage');
  const [multiVillageBuildingDraftById, setMultiVillageBuildingDraftById] = useState<Record<number, string>>({});
  const [multiVillageUnitDraftById, setMultiVillageUnitDraftById] = useState<Record<number, string>>({});
  const [multiVillageAmountDraftById, setMultiVillageAmountDraftById] = useState<Record<number, string>>({});
  const [multiVillageNoticeById, setMultiVillageNoticeById] = useState<Record<number, string>>({});
  const [multiVillagePendingById, setMultiVillagePendingById] = useState<Record<number, boolean>>({});
  const isRecruitMutationPending = recruitPendingUnitId != null;

  const lockedRecruitUnits = useMemo(
    () => units.filter((unit) => isBlockedByRecruitRule(unit)),
    [units],
  );
  const recruitTableUnits = useMemo(
    () => units.filter((unit) => !isBlockedByRecruitRule(unit)),
    [units],
  );
  const buildingTable = useMemo(
    () => [...buildings].sort((left, right) => left.name.localeCompare(right.name, 'cs')),
    [buildings],
  );
  const selectedVillageBuildingGroups = useMemo(() => {
    const buildingById = new Map(buildingTable.map((building) => [building.id, building]));
    const usedIds = new Set<string>();
    const grouped = CITY_OVERVIEW_GROUPS.map((group) => {
      const items = group.buildingIds
        .map((buildingId) => {
          const building = buildingById.get(buildingId);
          if (building) {
            usedIds.add(buildingId);
          }
          return building ?? null;
        })
        .filter((building): building is Building => building != null);
      return {
        id: group.id,
        label: group.label,
        subtitle: group.subtitle,
        buildings: items,
      };
    }).filter((group) => group.buildings.length > 0);

    const remaining = buildingTable.filter((building) => !usedIds.has(building.id));
    if (remaining.length > 0) {
      grouped.push({
        id: 'additional',
        label: 'Infrastruktura',
        subtitle: 'Speciální řetězce a podpůrné budovy',
        buildings: remaining,
      });
    }
    return grouped;
  }, [buildingTable]);

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
    return Math.min(getEffectiveMaxRecruitable(unit), raw);
  };

  const draftRecruitByUnitId = useMemo(() => {
    const result: Record<string, number> = {};
    for (const unit of recruitTableUnits) {
      const draftAmount = Number(recruitDraftAmounts[unit.id] ?? 0);
      result[unit.id] = Number.isFinite(draftAmount) && draftAmount > 0 ? Math.floor(draftAmount) : 0;
    }
    return result;
  }, [recruitDraftAmounts, recruitTableUnits]);

  const totalDraftRecruitAmount = useMemo(
    () => Object.values(draftRecruitByUnitId).reduce((sum, amount) => sum + amount, 0),
    [draftRecruitByUnitId],
  );

  const getEffectiveMaxRecruitable = useCallback(
    (unit: Unit): number => {
      const ownDraft = Number(draftRecruitByUnitId[unit.id] ?? 0);
      const otherDraft = Math.max(0, totalDraftRecruitAmount - ownDraft);
      return Math.max(0, unit.maxRecruitable - otherDraft);
    },
    [draftRecruitByUnitId, totalDraftRecruitAmount],
  );

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

  const ownSettlements = useMemo(
    () =>
      settlements.filter((settlement) => {
        const ownerComparable = String(settlement.owner ?? '').trim().toLocaleLowerCase('cs-CZ');
        const currentComparable = String(currentUsername ?? '').trim().toLocaleLowerCase('cs-CZ');
        return (
          settlement.villageId != null &&
          Number.isFinite(settlement.villageId) &&
          (settlement.kind === 'own' || settlement.relation === 'self' || ownerComparable === currentComparable)
        );
      }),
    [currentUsername, settlements],
  );

  const handleMultiVillageUpgrade = useCallback(
    async (villageId: number) => {
      const draftBuildingId = String(
        multiVillageBuildingDraftById[villageId] ??
          buildingTable.find((building) => building.canUpgrade)?.id ??
          buildingTable[0]?.id ??
          '',
      ).trim();
      if (!draftBuildingId) {
        return;
      }
      setMultiVillagePendingById((previous) => ({ ...previous, [villageId]: true }));
      setMultiVillageNoticeById((previous) => ({ ...previous, [villageId]: '' }));
      try {
        const result = await onUpgradeBuildingInVillage(villageId, draftBuildingId);
        setMultiVillageNoticeById((previous) => ({ ...previous, [villageId]: result }));
      } finally {
        setMultiVillagePendingById((previous) => ({ ...previous, [villageId]: false }));
      }
    },
    [buildingTable, multiVillageBuildingDraftById, onUpgradeBuildingInVillage],
  );

  const handleMultiVillageRecruit = useCallback(
    async (villageId: number) => {
      const draftUnitId = String(
        multiVillageUnitDraftById[villageId] ??
          recruitTableUnits[0]?.id ??
          '',
      ).trim();
      const draftAmount = Math.max(0, Math.floor(Number(multiVillageAmountDraftById[villageId] ?? 0)));
      if (!draftUnitId || draftAmount <= 0) {
        setMultiVillageNoticeById((previous) => ({
          ...previous,
          [villageId]: 'Zadej jednotku a počet > 0.',
        }));
        return;
      }
      setMultiVillagePendingById((previous) => ({ ...previous, [villageId]: true }));
      setMultiVillageNoticeById((previous) => ({ ...previous, [villageId]: '' }));
      try {
        const result = await onRecruitInVillage(villageId, draftUnitId, draftAmount);
        setMultiVillageNoticeById((previous) => ({ ...previous, [villageId]: result }));
      } finally {
        setMultiVillagePendingById((previous) => ({ ...previous, [villageId]: false }));
      }
    },
    [
      multiVillageAmountDraftById,
      multiVillageUnitDraftById,
      onRecruitInVillage,
      recruitTableUnits,
    ],
  );

  return (
    <div className="panel-stack">
      <section className="army-panel-tabs">
        <button
          type="button"
          className={`secondary-action ${armyViewMode === 'selectedVillage' ? 'is-active' : ''}`}
          onClick={() => setArmyViewMode('selectedVillage')}
        >
          Správa vybraného léna
        </button>
        <button
          type="button"
          className={`secondary-action ${armyViewMode === 'multiVillage' ? 'is-active' : ''}`}
          onClick={() => setArmyViewMode('multiVillage')}
        >
          Správa všech lén
        </button>
      </section>
      {armyViewMode === 'multiVillage' ? (
        <section className="army-panel-view is-enter">
          <h3>Správa všech lén</h3>
          <p>
            Z této stránky můžeš stavět a rekrutovat napříč všemi svými lény v aktuálním světě.
          </p>
          {ownSettlements.length > 0 ? (
            <ul className="commands-list multi-village-manage-list">
              {ownSettlements.map((settlement) => (
                <li key={`army-multi-${settlement.id}`} className="commands-item">
                  <div className="commands-item-line">
                    <strong>{settlement.name}</strong>
                    <span>
                      {settlement.globalX}|{settlement.globalY}
                    </span>
                  </div>
                  <small>
                    Království: {settlement.kingdom} · Region {settlement.region}
                  </small>
                  <div className="multi-village-actions-row">
                    <label>
                      Stavba
                      <select
                        value={multiVillageBuildingDraftById[Number(settlement.villageId)] ?? buildingTable[0]?.id ?? ''}
                        onChange={(event) =>
                          setMultiVillageBuildingDraftById((previous) => ({
                            ...previous,
                            [Number(settlement.villageId)]: event.target.value,
                          }))
                        }
                        disabled={multiVillagePendingById[Number(settlement.villageId)]}
                      >
                        {buildingTable.map((building) => (
                          <option key={`multi-building-${settlement.id}-${building.id}`} value={building.id}>
                            {building.name} (lvl {building.level})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        if (settlement.villageId != null) {
                          void handleMultiVillageUpgrade(settlement.villageId);
                        }
                      }}
                      disabled={settlement.villageId == null || multiVillagePendingById[Number(settlement.villageId)]}
                    >
                      {multiVillagePendingById[Number(settlement.villageId)] ? 'Provádím...' : 'Stavět/Vylepšit'}
                    </button>
                  </div>
                  <div className="multi-village-actions-row">
                    <label>
                      Nábor
                      <select
                        value={multiVillageUnitDraftById[Number(settlement.villageId)] ?? recruitTableUnits[0]?.id ?? ''}
                        onChange={(event) =>
                          setMultiVillageUnitDraftById((previous) => ({
                            ...previous,
                            [Number(settlement.villageId)]: event.target.value,
                          }))
                        }
                        disabled={multiVillagePendingById[Number(settlement.villageId)]}
                      >
                        {recruitTableUnits.map((unit) => (
                          <option key={`multi-unit-${settlement.id}-${unit.id}`} value={unit.id}>
                            {unit.name} (dostupné {unit.amount.toLocaleString('cs-CZ')})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Počet
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={multiVillageAmountDraftById[Number(settlement.villageId)] ?? ''}
                        onChange={(event) =>
                          setMultiVillageAmountDraftById((previous) => ({
                            ...previous,
                            [Number(settlement.villageId)]: event.target.value,
                          }))
                        }
                        disabled={multiVillagePendingById[Number(settlement.villageId)]}
                        placeholder="1"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        if (settlement.villageId != null) {
                          void handleMultiVillageRecruit(settlement.villageId);
                        }
                      }}
                      disabled={settlement.villageId == null || multiVillagePendingById[Number(settlement.villageId)]}
                    >
                      {multiVillagePendingById[Number(settlement.villageId)] ? 'Provádím...' : 'Rekrutovat'}
                    </button>
                  </div>
                  {settlement.villageId != null && multiVillageNoticeById[settlement.villageId] ? (
                    <p className="panel-feedback">{multiVillageNoticeById[settlement.villageId]}</p>
                  ) : null}
                  <div className="activity-item-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        if (settlement.villageId != null) {
                          onOpenSettlementByVillageId(settlement.villageId);
                        }
                      }}
                    >
                      Otevřít profil léna
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>V tomto světě zatím nemáš žádná dostupná léna.</p>
          )}
        </section>
      ) : (
      <>
      <section>
        <h3>Správa staveb vybraného léna</h3>
        <p>Budovy jsou rozdělené do 4 řádků podle městských okruhů a připravené pro rychlé vylepšení.</p>
        <div className="selected-village-building-groups">
          {selectedVillageBuildingGroups.map((group) => (
            <section key={`army-building-group-${group.id}`} className="selected-village-building-group">
              <header>
                <h4>{group.label}</h4>
                <p>{group.subtitle}</p>
              </header>
              <div className="selected-village-building-strip">
                {group.buildings.map((building) => (
                  <article key={`army-building-${group.id}-${building.id}`} className="selected-village-building-card">
                    <header>
                      <span className="unit-icon-shell" aria-hidden="true">
                        <img src={building.icon} alt="" className="unit-icon-image" loading="lazy" />
                      </span>
                      <strong>{building.name}</strong>
                    </header>
                    <p>
                      Úroveň <strong>{building.level}</strong>
                    </p>
                    <small>
                      {building.isInProgress
                        ? `Probíhá (${building.nextTime})`
                        : building.canUpgrade
                          ? `Připraveno (${building.nextTime})`
                          : building.blockedReason ?? 'Max úroveň'}
                    </small>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onUpgradeBuilding(building)}
                      disabled={!building.canUpgrade || upgradePendingBuildingId === building.id}
                    >
                      {upgradePendingBuildingId === building.id ? 'Vylepšuji...' : 'Vylepšit'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {selectedVillageBuildingGroups.length === 0 ? <p>Žádné stavby nejsou dostupné.</p> : null}
        </div>
      </section>
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
              <th>Cena</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {recruitTableUnits.map((unit) => {
              const requestedRecruitAmount = getRequestedRecruitAmount(unit);
              const effectiveMaxRecruitable = getEffectiveMaxRecruitable(unit);
              const unitMeta = getUnitMetaById(unit.id);
              return (
                <tr key={unit.id}>
                  <td>
                    <span className="unit-name-with-icon unit-name-with-icon-strong">
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
                      maximálně {effectiveMaxRecruitable.toLocaleString('cs-CZ')} počet k rekrutu
                    </small>
                    {unit.queuedCount > 0 ? (
                      <small className="row-help">ve fronte: +{unit.queuedCount.toLocaleString('cs-CZ')}</small>
                    ) : null}
                    {unit.blockedReason ? <small className="row-help">{unit.blockedReason}</small> : null}
                  </td>
                  <td>{unit.cost}</td>
                  <td>
                    <div className="recruit-controls">
                      <input
                        className="recruit-amount-input"
                        type="number"
                        min={1}
                        max={Math.max(1, effectiveMaxRecruitable)}
                        step={1}
                        value={recruitDraftAmounts[unit.id] ?? ''}
                        onChange={(event) => handleRecruitAmountChange(unit.id, event.target.value)}
                        onWheel={(event) =>
                          adjustNumericInputByWheel(event, (nextValue) => {
                            handleRecruitAmountChange(unit.id, nextValue);
                          })
                        }
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
                          void handleRecruitUnit(unit, effectiveMaxRecruitable);
                        }}
                        disabled={!unit.canRecruit || isRecruitMutationPending || effectiveMaxRecruitable <= 0}
                      >
                        {recruitPendingUnitId === unit.id
                          ? 'Nábor...'
                          : `Rekrutovat vše (${effectiveMaxRecruitable.toLocaleString('cs-CZ')})`}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recruitTableUnits.length === 0 ? (
              <tr>
                <td colSpan={4}>Náborové jednotky nejsou dostupné.</td>
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
                    <strong className="unit-name-with-icon unit-name-with-icon-strong">
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
                  <span className="unit-name-with-icon unit-name-with-icon-strong">
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
      </>
      )}
    </div>
  );
};

const MilitaryPanel = ({
  units,
  activeMovements,
  incomingMovements,
  stationedSupports,
  currentVillageName,
}: {
  units: Unit[];
  activeMovements: ArmyMovementState[];
  incomingMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  currentVillageName: string;
}) => {
  const orderedUnits = useMemo(
    () =>
      [...units].sort((left, right) => {
        const leftIndex = COMMAND_UNIT_ORDER.indexOf(left.id as CommandUnitId);
        const rightIndex = COMMAND_UNIT_ORDER.indexOf(right.id as CommandUnitId);
        if (leftIndex >= 0 && rightIndex >= 0) {
          return leftIndex - rightIndex;
        }
        if (leftIndex >= 0) {
          return -1;
        }
        if (rightIndex >= 0) {
          return 1;
        }
        return left.name.localeCompare(right.name, 'cs');
      }),
    [units],
  );

  const totalUnits = useMemo(
    () => orderedUnits.reduce((sum, unit) => sum + Number(unit.amount ?? 0), 0),
    [orderedUnits],
  );
  const totalAttackPower = useMemo(
    () =>
      orderedUnits.reduce((sum, unit) => {
        const unitId = unit.id as CommandUnitId;
        const unitPower = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_ATTACK_POWER[unitId] : 0;
        return sum + Number(unit.amount ?? 0) * unitPower;
      }, 0),
    [orderedUnits],
  );
  const totalDefensePower = useMemo(
    () =>
      orderedUnits.reduce((sum, unit) => {
        const unitId = unit.id as CommandUnitId;
        const unitPower = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_DEFENSE_POWER[unitId] : 0;
        return sum + Number(unit.amount ?? 0) * unitPower;
      }, 0),
    [orderedUnits],
  );
  const totalLootCapacity = useMemo(
    () =>
      orderedUnits.reduce((sum, unit) => {
        const unitId = unit.id as CommandUnitId;
        const unitCapacity = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_LOOT_CAPACITY[unitId] : 0;
        return sum + Number(unit.amount ?? 0) * unitCapacity;
      }, 0),
    [orderedUnits],
  );

  const activeOutgoingForVillage = useMemo(
    () =>
      activeMovements
        .filter((movement) => movement.isRelatedToCurrentVillage && movement.commandType !== 'return')
        .sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [activeMovements],
  );
  const activeIncomingForVillage = useMemo(
    () =>
      incomingMovements
        .filter((movement) => movement.isRelatedToCurrentVillage)
        .sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [incomingMovements],
  );
  const activeStationedSupports = useMemo(
    () =>
      stationedSupports
        .filter((movement) => movement.isRelatedToCurrentVillage)
        .sort((left, right) => left.id - right.id),
    [stationedSupports],
  );
  const [hoveredMovementId, setHoveredMovementId] = useState<number | null>(null);
  const [tooltipCursorPosition, setTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);

  return (
    <div className="panel-stack military-panel">
      <section>
        <h3>Válečný štáb · {currentVillageName}</h3>
        <div className="commands-kpi-strip">
          <article>
            <span>🪖 Celkem jednotek</span>
            <strong>{totalUnits.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>⚔ Souhrnná síla útoku</span>
            <strong>{totalAttackPower.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>🛡 Souhrnná síla obrany</span>
            <strong>{totalDefensePower.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>📦 Kapacita kořisti</span>
            <strong>{totalLootCapacity.toLocaleString('cs-CZ')}</strong>
          </article>
        </div>
      </section>

      <section>
        <h3>Armáda ve vybraném lénu</h3>
        <div className="military-unit-grid">
          {orderedUnits.map((unit) => {
            const unitId = unit.id as CommandUnitId;
            const attackPower = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_ATTACK_POWER[unitId] : 0;
            const defensePower = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_DEFENSE_POWER[unitId] : 0;
            const lootCapacity = COMMAND_UNIT_ORDER.includes(unitId) ? UNIT_LOOT_CAPACITY[unitId] : 0;
            const attackContribution = Number(unit.amount ?? 0) * attackPower;
            const defenseContribution = Number(unit.amount ?? 0) * defensePower;

            return (
              <article key={`military-unit-${unit.id}`} className="military-unit-card">
                <header>
                  <span className="unit-icon-shell" aria-hidden="true">
                    <img src={getUnitMetaById(unit.id).icon} alt="" className="unit-icon-image" loading="lazy" />
                  </span>
                  <div>
                    <strong className="unit-name-large">{unit.name}</strong>
                  </div>
                </header>
                <p className="military-unit-amount unit-count-large">{Number(unit.amount ?? 0).toLocaleString('cs-CZ')}</p>
                <div className="military-unit-stats">
                  <small>Útok: {attackContribution.toLocaleString('cs-CZ')}</small>
                  <small>Obrana: {defenseContribution.toLocaleString('cs-CZ')}</small>
                  <small>Kořist: {(Number(unit.amount ?? 0) * lootCapacity).toLocaleString('cs-CZ')}</small>
                </div>
                {unit.queuedCount > 0 ? (
                  <small className="row-help">Ve frontě náboru: +{unit.queuedCount.toLocaleString('cs-CZ')}</small>
                ) : null}
                {unit.stationedSupportCount > 0 ? (
                  <small className="row-help">
                    Stacionovaná podpora: +{unit.stationedSupportCount.toLocaleString('cs-CZ')}
                  </small>
                ) : null}
              </article>
            );
          })}
          {orderedUnits.length === 0 ? <p>V lénu zatím nejsou žádné jednotky.</p> : null}
        </div>
      </section>

      <section>
        <h3>Aktivita armády</h3>
        <div className="military-activity-grid">
          <article>
            <h4>Odchozí rozkazy</h4>
            <ul className="commands-list">
              {activeOutgoingForVillage.map((movement) => (
                <li
                  key={`military-outgoing-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className={`command-badge ${movement.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    </span>
                    <strong>{ARMY_COMMAND_LABELS[movement.commandType]}</strong>
                    <span>
                      {movement.originName} → {movement.targetName}
                    </span>
                  </div>
                  <small>ETA {formatDurationLabel(movement.remainingSec)}</small>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              ))}
              {activeOutgoingForVillage.length === 0 ? <li>Žádný aktivní odchozí rozkaz.</li> : null}
            </ul>
          </article>

          <article>
            <h4>Příchozí hrozby</h4>
            <ul className="commands-list">
              {activeIncomingForVillage.map((movement) => (
                <li
                  key={`military-incoming-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className={`command-badge ${movement.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    </span>
                    <strong>{ARMY_COMMAND_LABELS[movement.commandType]}</strong>
                    <span>
                      {movement.commanderUsername ?? 'Neznámý velitel'} → {movement.targetName}
                    </span>
                  </div>
                  <small>ETA {formatDurationLabel(movement.remainingSec)}</small>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              ))}
              {activeIncomingForVillage.length === 0 ? <li>Žádná příchozí armáda.</li> : null}
            </ul>
          </article>

          <article>
            <h4>Stacionovaná podpora</h4>
            <ul className="commands-list">
              {activeStationedSupports.map((movement) => (
                <li
                  key={`military-support-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className="command-badge support compact">
                      <span className="symbol">{getArmyCommandSymbol('support')}</span>
                    </span>
                    <strong>{movement.originName}</strong>
                    <span>Podpora v lénu {movement.targetName}</span>
                  </div>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              ))}
              {activeStationedSupports.length === 0 ? <li>Žádná stacionovaná podpora.</li> : null}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
};

const ResearchPanel = ({
  research,
  mercenaries,
  rules,
  resources,
  notice,
  researchActionPending,
  mercenaryActionPending,
  onHireAcademics,
  onAdjustResearchAcademics,
  onStartResearchProject,
  onHireMercenaries,
}: {
  research: GameStateResponse['research'] | undefined;
  mercenaries: GameStateResponse['mercenaries'] | undefined;
  rules: GameStateResponse['rules'] | undefined;
  resources:
    | Pick<GameStateResponse['resources'], 'coins' | 'gold' | 'productionPerHour' | 'protection'>
    | undefined;
  notice: string | null;
  researchActionPending: boolean;
  mercenaryActionPending: boolean;
  onHireAcademics: (amount: number) => Promise<boolean>;
  onAdjustResearchAcademics: (researchId: string, delta: number) => Promise<boolean>;
  onStartResearchProject: (researchId: string, academics: number) => void;
  onHireMercenaries: () => void;
}) => {
  const projects = research?.projects ?? [];
  const mercenaryCooldownRemainingSec = Math.max(0, Math.floor(Number(mercenaries?.cooldownRemainingSec ?? 0)));
  const [isHireImpactActive, setIsHireImpactActive] = useState(false);
  const [hoveredResearchProjectId, setHoveredResearchProjectId] = useState<string | null>(null);
  const [researchTooltipCursorPosition, setResearchTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const [projectAcademicDrafts, setProjectAcademicDrafts] = useState<Record<string, string>>({});

  const activeProject = useMemo(
    () => projects.find((project) => project.status === 'researching') ?? null,
    [projects],
  );
  const availableProjects = useMemo(
    () => projects.filter((project) => project.status === 'available'),
    [projects],
  );
  const mercenaryResearch = useMemo(
    () => projects.find((project) => project.id === 'verven-bank') ?? null,
    [projects],
  );
  const mercenaryUnlocked = mercenaryResearch?.status === 'completed';
  const sortedContracts = useMemo(
    () => {
      const statusPriority: Record<string, number> = {
        active: 0,
        ordered: 1,
        in_transit: 2,
        completed: 3,
        expired: 4,
        canceled: 5,
      };
      return [...(mercenaries?.contracts ?? [])].sort((left, right) => {
        const leftPriority = statusPriority[String(left.status).toLocaleLowerCase('cs-CZ')] ?? 99;
        const rightPriority = statusPriority[String(right.status).toLocaleLowerCase('cs-CZ')] ?? 99;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        const rightOrderedAtMs = Date.parse(String(right.orderedAt));
        const leftOrderedAtMs = Date.parse(String(left.orderedAt));
        const safeRight = Number.isFinite(rightOrderedAtMs) ? rightOrderedAtMs : 0;
        const safeLeft = Number.isFinite(leftOrderedAtMs) ? leftOrderedAtMs : 0;
        return safeRight - safeLeft;
      });
    },
    [mercenaries?.contracts],
  );
  const parseDraftAmount = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  };

  const canHireMercenaries =
    mercenaryUnlocked &&
    mercenaryCooldownRemainingSec <= 0 &&
    Number(resources?.coins ?? 0) >= MERCENARY_CONTRACT_COIN_COST &&
    !mercenaryActionPending;
  const totalAcademics = Math.max(0, Math.floor(Number(research?.totalAcademics ?? 0)));
  const idleAcademics = Math.max(0, Math.floor(Number(research?.idleAcademics ?? 0)));
  const villageAcademics = Math.max(0, Math.floor(Number(research?.villageAcademics ?? 0)));
  const villageAcademicCapacity = Math.max(0, Math.floor(Number(research?.villageAcademicCapacity ?? 0)));
  const villageAcademicAvailableSlots = Math.max(
    0,
    Math.floor(
      Number(
        research?.villageAcademicAvailableSlots ??
          Math.max(0, villageAcademicCapacity - villageAcademics),
      ),
    ),
  );
  const canHireSingleAcademic =
    !researchActionPending &&
    villageAcademicAvailableSlots > 0 &&
    Number(resources?.coins ?? 0) >= ACADEMIC_HIRE_COIN_COST;
  const isVillageAcademicLimitReached = villageAcademicCapacity > 0 && villageAcademicAvailableSlots <= 0;
  const activeProjectProgressPercent = activeProject
    ? Math.max(0, Math.min(100, Number(activeProject.progressPercent ?? 0)))
    : 0;

  useEffect(() => {
    if (!isHireImpactActive) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setIsHireImpactActive(false);
    }, 720);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isHireImpactActive]);

  const resolveProjectStatusLabel = (status: string): string => {
    if (status === 'locked') {
      return 'Uzamčeno';
    }
    if (status === 'available') {
      return 'Dostupné';
    }
    if (status === 'researching') {
      return 'Probíhá';
    }
    return 'Dokončeno';
  };

  const resolveRouteStatusLabel = (statusRaw: string): string => {
    const status = String(statusRaw ?? '').toLocaleLowerCase('cs-CZ');
    if (status === 'ordered') {
      return 'Objednáno';
    }
    if (status === 'active') {
      return 'Aktivní';
    }
    if (status === 'expired') {
      return 'Vypršelo';
    }
    if (status === 'in_transit') {
      return 'Na cestě';
    }
    if (status === 'completed') {
      return 'Doručeno';
    }
    if (status === 'canceled') {
      return 'Zrušeno';
    }
    return statusRaw;
  };

  const handleHireSingleAcademic = useCallback(async () => {
    if (!canHireSingleAcademic) {
      return;
    }
    const wasHired = await onHireAcademics(1);
    if (!wasHired) {
      return;
    }
    setIsHireImpactActive(true);
  }, [canHireSingleAcademic, onHireAcademics]);

  return (
    <div className="panel-stack research-panel">
      <section className="research-command-section">
        <header className="research-command-header">
          <div>
            <p className="research-command-overline">Arcane Collegium</p>
            <h3>Univerzita a výzkum</h3>
            <p className="row-help research-command-intro">
              Velitelé akademie urychlují pokrok napříč celým světem. Vyber projekt, přiřaď akademiky a sleduj
              rituální průběh v reálném čase.
            </p>
          </div>
          <div className="research-active-emblem" aria-hidden="true">
            <span>{activeProject ? '✶' : '✧'}</span>
          </div>
        </header>

        <div className="research-command-stats" aria-label="Výzkumný přehled">
          <div className="research-command-stat">
            <span>Akademici</span>
            <strong>{totalAcademics.toLocaleString('cs-CZ')}</strong>
            <small>
              {idleAcademics.toLocaleString('cs-CZ')} volných · {villageAcademics.toLocaleString('cs-CZ')} v tomto lénu
            </small>
          </div>
          <div className="research-command-divider" aria-hidden="true" />
          <div className="research-command-stat">
            <span>Měna</span>
            <strong>
              {Math.max(0, Math.floor(Number(resources?.coins ?? 0))).toLocaleString('cs-CZ')} mincí ·{' '}
              {Math.max(0, Math.floor(Number(resources?.gold ?? 0))).toLocaleString('cs-CZ')} zlata
            </strong>
            <small>Strategická rezerva výzkumu</small>
          </div>
          <div className="research-command-divider" aria-hidden="true" />
          <div className={`research-command-stat ${activeProject ? 'is-live' : 'is-danger'}`}>
            <span>Aktivní projekt</span>
            <strong>{activeProject?.name ?? 'Žádný aktivní výzkum'}</strong>
            <small>
              {activeProject
                ? `${Math.round(activeProjectProgressPercent).toLocaleString('cs-CZ')} % dokončeno`
                : 'Spusť projekt a přiděluj akademiky napříč osadami'}
            </small>
          </div>
        </div>

        <div className="research-panel-inline-actions research-academy-hire">
          <button
            type="button"
            className={`secondary-action research-hire-button${isHireImpactActive ? ' is-hire-impact' : ''}`}
            onClick={() => {
              void handleHireSingleAcademic();
            }}
            disabled={!canHireSingleAcademic}
            aria-live="polite"
          >
            {researchActionPending ? 'Najímám akademika...' : 'Najmout akademika'}
          </button>
          <small className="row-help research-hire-cost-note">
            Cena: {ACADEMIC_HIRE_COIN_COST.toLocaleString('cs-CZ')} mincí · kapacita léna{' '}
            {villageAcademics.toLocaleString('cs-CZ')} / {villageAcademicCapacity.toLocaleString('cs-CZ')} ·
            Univerzita: 1 úroveň = 1 akademik (max 3)
          </small>
          {isVillageAcademicLimitReached ? (
            <p className="research-hire-limit-warning">Limit akademiků překročen</p>
          ) : null}
        </div>

        <div className="research-list research-project-grid">
          {projects.map((project, projectIndex) => {
            const projectDraft = projectAcademicDrafts[project.id] ?? '1';
            const projectProgressPercent = Math.max(0, Math.min(100, Number(project.progressPercent ?? 0)));
            const projectCoinCost = Math.max(0, Math.floor(Number(project.coinCost ?? 0)));
            const projectRequiredPoints = Math.max(1, Math.floor(Number(project.requiredPoints ?? 1)));
            const projectProgressPoints = Math.max(0, Math.floor(Number(project.progressPoints ?? 0)));
            const assignedAcademics = Math.max(0, Math.floor(Number(project.assignedAcademics ?? 0)));
            const estimatedFinishLabel =
              project.status === 'researching'
                ? project.estimatedCompletionAt
                  ? `${formatDateTimeLabel(project.estimatedCompletionAt)} (${formatDurationLabel(
                      Math.max(0, Number(project.remainingSec ?? 0)),
                    )})`
                  : 'Pozastaveno – bez akademiků'
                : null;
            const canStartProject =
              project.status === 'available' &&
              !researchActionPending &&
              Number(resources?.coins ?? 0) >= projectCoinCost &&
              idleAcademics > 0;
            const canAddAcademic =
              project.status === 'researching' &&
              !researchActionPending &&
              idleAcademics > 0 &&
              assignedAcademics < RESEARCH_MAX_ASSIGNED_ACADEMICS;
            const canRemoveAcademic =
              project.status === 'researching' &&
              !researchActionPending &&
              assignedAcademics > 0;

            return (
              <article
                key={project.id}
                className={`research-project-card is-${project.status}${hoveredResearchProjectId === project.id ? ' is-tooltip-open' : ''}`}
                style={
                  {
                    '--project-delay': `${Math.min(projectIndex, 9) * 70}ms`,
                  } as CSSProperties
                }
                onMouseEnter={(event) => {
                  if (project.status !== 'researching' || (project.assignedVillageBreakdown?.length ?? 0) <= 0) {
                    return;
                  }
                  setHoveredResearchProjectId(project.id);
                  setResearchTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                }}
                onMouseMove={(event) => {
                  if (hoveredResearchProjectId !== project.id) {
                    return;
                  }
                  setResearchTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                }}
                onMouseLeave={() => {
                  setHoveredResearchProjectId((previous) => (previous === project.id ? null : previous));
                  setResearchTooltipCursorPosition(null);
                }}
              >
                <header className="research-project-card-head">
                  <div className="research-project-title-wrap">
                    <strong>{project.name}</strong>
                    <small>{project.unlocks}</small>
                  </div>
                  <span className={`research-project-status is-${project.status}`}>
                    {resolveProjectStatusLabel(project.status)}
                  </span>
                </header>

                <p className="research-project-card-desc">{project.description}</p>

                <div className="research-progress-shell">
                  <div className="progress-track research-progress-track" role="progressbar" aria-valuenow={projectProgressPercent}>
                    <span style={{ width: `${projectProgressPercent}%` }} />
                  </div>
                  <p className="research-progress-meta">
                    <span>{Math.round(projectProgressPercent)} %</span>
                    <span>
                      {projectProgressPoints.toLocaleString('cs-CZ')} / {projectRequiredPoints.toLocaleString('cs-CZ')} bodů
                    </span>
                  </p>
                </div>

                <div className="research-project-chip-row">
                  <span className="research-project-chip">
                    <b>Cena</b>
                    <i>{projectCoinCost.toLocaleString('cs-CZ')} mincí</i>
                  </span>
                  <span className="research-project-chip">
                    <b>Akademici</b>
                    <i>
                      {assignedAcademics.toLocaleString('cs-CZ')} / {RESEARCH_MAX_ASSIGNED_ACADEMICS.toLocaleString('cs-CZ')}
                    </i>
                  </span>
                  {project.status === 'researching' ? (
                    <span className="research-project-chip">
                      <b>Rychlost</b>
                      <i>{Math.max(0, Number(project.progressPerHour ?? 0)).toFixed(2)} bodů/h</i>
                    </span>
                  ) : null}
                </div>

                {estimatedFinishLabel ? (
                  <p className="row-help research-finish-label">Dokončení: {estimatedFinishLabel}</p>
                ) : null}

                {project.status === 'researching' ? (
                  <div className="research-project-actions is-card">
                    <div className="research-allocation-control">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => {
                          void onAdjustResearchAcademics(project.id, -1);
                        }}
                        disabled={!canRemoveAcademic}
                      >
                        − Akademik
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => {
                          void onAdjustResearchAcademics(project.id, 1);
                        }}
                        disabled={!canAddAcademic}
                      >
                        + Akademik
                      </button>
                    </div>
                    <small className="row-help">
                      Přidělení je regionální – akademiky můžeš přidávat i z jiných osad. Najetím myši zobrazíš
                      rozpad kolaborace.
                    </small>
                  </div>
                ) : null}

                {project.status === 'available' ? (
                  <div className="research-project-actions is-card">
                    <label>
                      Akademici při startu
                      <input
                        className="recruit-amount-input"
                        type="number"
                        min={1}
                        max={RESEARCH_MAX_ASSIGNED_ACADEMICS}
                        step={1}
                        value={projectDraft}
                        onChange={(event) =>
                          setProjectAcademicDrafts((previous) => ({
                            ...previous,
                            [project.id]: event.target.value,
                          }))
                        }
                        disabled={researchActionPending}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onStartResearchProject(project.id, Math.max(1, parseDraftAmount(projectDraft)))}
                      disabled={!canStartProject}
                    >
                      Spustit výzkum
                    </button>
                  </div>
                ) : null}

                {hoveredResearchProjectId === project.id ? (
                  <ResearchCollaborationTooltip project={project} cursorPosition={researchTooltipCursorPosition} />
                ) : null}
              </article>
            );
          })}
          {projects.length === 0 ? <p>Výzkumný strom se načítá.</p> : null}
          {projects.length > 0 && availableProjects.length === 0 && !activeProject ? (
            <p className="row-help">Všechny dostupné projekty jsou hotové nebo uzamčené.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h3>Mincovna a žoldáci</h3>
        <div className="commands-kpi-strip">
          <article>
            <span>Chráněné mince</span>
            <strong>{Math.max(0, Math.floor(Number(resources?.protection.coins ?? 0))).toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Ražba / h</span>
            <strong>{Math.max(0, Number(resources?.productionPerHour.mintCoins ?? 0)).toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Cooldown žoldáků</span>
            <strong>{mercenaryCooldownRemainingSec > 0 ? formatDurationLabel(mercenaryCooldownRemainingSec) : 'Připraveno'}</strong>
          </article>
          <article className={mercenaryUnlocked ? '' : 'is-danger'}>
            <span>Výzkum banky</span>
            <strong>{mercenaryUnlocked ? 'Odemčeno' : 'Zamčeno'}</strong>
          </article>
        </div>
        <div className="research-panel-inline-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={onHireMercenaries}
            disabled={!canHireMercenaries}
          >
            {mercenaryActionPending
              ? 'Najímám žoldáky...'
              : `Najmout žoldáky (${MERCENARY_CONTRACT_COIN_COST.toLocaleString('cs-CZ')} mincí)`}
          </button>
          <small className="row-help">Žoldáci brání pouze domovské léno a po 72 hodinách vyprší.</small>
        </div>
        {sortedContracts.length > 0 ? (
          <ul className="commands-list">
            {sortedContracts.map((contract) => (
              <li key={`mercenary-contract-${contract.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>Kontrakt #{contract.id}</strong>
                  <span>
                    {resolveRouteStatusLabel(contract.status)} · +{Math.max(0, Math.floor(Number(contract.unitAmount))).toLocaleString('cs-CZ')} žoldáků
                  </span>
                </div>
                <small>
                  Objednáno {formatDateTimeLabel(contract.orderedAt)} · Dorazí {formatDateTimeLabel(contract.arriveAt)} ·
                  Expirace {formatDateTimeLabel(contract.expiresAt)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Zatím nemáš žádný žoldácký kontrakt.</p>
        )}
      </section>

      <section>
        <h3>Pravidla světa</h3>
        <ul className="commands-list">
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Noční režim</strong>
              <span>{rules?.nightMode?.isActiveNow ? 'Aktivní' : 'Neaktivní'}</span>
            </div>
            <small>
              Interval {String(rules?.nightMode?.startHourUtc ?? 0).padStart(2, '0')}:00 -{' '}
              {String(rules?.nightMode?.endHourUtc ?? 0).padStart(2, '0')}:00 UTC · obrana +{Math.max(
                0,
                Math.floor(Number(rules?.nightMode?.defenseBonusPct ?? 0)),
              ).toLocaleString('cs-CZ')}
              %
            </small>
          </li>
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Balanc prestiže</strong>
              <span>
                Min. cíl {Math.max(0, Math.round(Number(rules?.prestigeBalance?.minAttackablePrestigeRatio ?? 0) * 100)).toLocaleString('cs-CZ')} %
              </span>
            </div>
            <small>
              Kořist minimum{' '}
              {Math.max(0, Math.round(Number(rules?.prestigeBalance?.minLootModifier ?? 0.1) * 100)).toLocaleString(
                'cs-CZ',
              )}
              % ·{' '}
              {rules?.prestigeBalance?.retaliationRule ??
                'Když slabší zaútočí jako první, silnější může útok vrátit i přes ochranu.'}
            </small>
          </li>
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Zrušení příkazu</strong>
              <span>
                Do{' '}
                {Math.max(0, Math.round(Number(rules?.cancelCommandProgressLimit ?? 0) * 100)).toLocaleString('cs-CZ')}
                % cesty
              </span>
            </div>
            <small>Při zrušení se armáda vrací stejnou dobu, jakou byla na cestě.</small>
          </li>
        </ul>
        {notice ? <p className="panel-feedback">{notice}</p> : null}
      </section>
    </div>
  );
};

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

const collectSpyIntelRows = (
  selection: Record<string, number> | undefined,
  orderedIds: readonly string[],
): { id: string; amount: number }[] => {
  if (!selection) {
    return [];
  }

  const ids = new Set<string>();
  for (const [entryId, amount] of Object.entries(selection)) {
    if (normalizeBattleAmount(amount) > 0) {
      ids.add(entryId);
    }
  }

  const known = orderedIds.filter((entryId) => ids.has(entryId));
  const unknown = [...ids]
    .filter((entryId) => !orderedIds.includes(entryId))
    .sort((a, b) => a.localeCompare(b, 'cs'));
  const ordered = [...known, ...unknown];

  return ordered.map((entryId) => ({
    id: entryId,
    amount: normalizeBattleAmount(selection[entryId]),
  }));
};

const getBattleOutcomeMeta = (payload: BattleReportPayload): { label: string; tone: BattleOutcomeTone } => {
  if (payload.spy) {
    const success = payload.spy.success === true;
    if (payload.perspective === 'defender') {
      return success
        ? { label: 'Špionáž pronikla', tone: 'defeat' }
        : { label: 'Špionáž odražena', tone: 'victory' };
    }
    return success
      ? { label: 'Průzkum úspěšný', tone: 'victory' }
      : { label: 'Zvěd zlikvidován', tone: 'defeat' };
  }

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
    (payload.spy && payload.spy.quality !== 'none') ||
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
  const spy = payload.spy;
  const defenderCardTitle = payload.role === 'support' ? 'Podpora obránce' : `Obránce · ${defenderName}`;
  const defenderSnapshot = payload.role === 'support' ? payload.support : battle?.defender;
  const attackerIsUnknown =
    spy == null && payload.attackerForcesUnknown === true && payload.perspective === 'defender';
  const bonuses = battle?.bonuses ?? [];
  const returnMovement = payload.returnMovement;
  const returnRows = collectSelectionRows(returnMovement?.units);
  const spyUnitRows = collectSpyIntelRows(spy?.intel?.units, COMMAND_UNIT_ORDER);
  const spyBuildingRows = collectSpyIntelRows(spy?.intel?.buildings, BUILDING_INTEL_ORDER);
  const hasSpyIntel = spy != null && spy.quality !== 'none';
  const isSpyApproximate = spy?.quality === 'approximate' || spy?.approximate === true;
  const attackerScoutStart = normalizeBattleAmount(spy?.attackerScouts?.start);
  const attackerScoutLosses = normalizeBattleAmount(spy?.attackerScouts?.losses);
  const attackerScoutSurvivors = normalizeBattleAmount(spy?.attackerScouts?.survivors);
  const defenderScoutCount = normalizeBattleAmount(spy?.defenderScouts);
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
  const prestigeBalance = battle?.prestigeBalance;
  const hasPrestigeBalanceIntel =
    prestigeBalance != null &&
    (prestigeBalance.attackerPrestige != null ||
      prestigeBalance.defenderPrestige != null ||
      prestigeBalance.attackModifier != null ||
      prestigeBalance.defenseBonus != null ||
      prestigeBalance.lootModifier != null ||
      prestigeBalance.retaliationOverrideApplied === true);
  const debugRows: Array<{ label: string; value: string }> = [];
  if (payload.movementId != null) {
    debugRows.push({ label: 'Movement ID', value: String(payload.movementId) });
  }
  if (payload.supportMovementId != null) {
    debugRows.push({ label: 'Support movement ID', value: String(payload.supportMovementId) });
  }
  if (battle?.blockedByGate != null || payload.gateBlocked != null) {
    debugRows.push({
      label: 'Gate blocked',
      value: battle?.blockedByGate ?? payload.gateBlocked ? 'ano' : 'ne',
    });
  }
  if (battle?.baseAttackPower != null || battle?.baseDefensePower != null) {
    debugRows.push({
      label: 'Base power (A/D)',
      value: `${formatBattlePower(battle?.baseAttackPower)} / ${formatBattlePower(battle?.baseDefensePower)}`,
    });
  }
  if (battle?.finalAttackPower != null || battle?.finalDefensePower != null) {
    debugRows.push({
      label: 'Final power (A/D)',
      value: `${formatBattlePower(battle?.finalAttackPower)} / ${formatBattlePower(battle?.finalDefensePower)}`,
    });
  }
  if (battle?.attackMultiplier != null || battle?.defenseMultiplier != null) {
    debugRows.push({
      label: 'Multipliers (A/D)',
      value: `${formatBattleMultiplier(battle?.attackMultiplier)} / ${formatBattleMultiplier(battle?.defenseMultiplier)}`,
    });
  }
  if (prestigeBalance) {
    debugRows.push({
      label: 'Prestize (A/D)',
      value: `${Math.max(0, Number(prestigeBalance.attackerPrestige ?? 0)).toLocaleString('cs-CZ')} / ${Math.max(
        0,
        Number(prestigeBalance.defenderPrestige ?? 0),
      ).toLocaleString('cs-CZ')}`,
    });
    debugRows.push({
      label: 'Prestizni modifikatory',
      value: `Utok x${Number(prestigeBalance.attackModifier ?? 1).toFixed(2)}, obrana +${Math.round(
        Number(prestigeBalance.defenseBonus ?? 0) * 100,
      )} %, korist x${Number(prestigeBalance.lootModifier ?? 1).toFixed(2)}`,
    });
    if (prestigeBalance.retaliationOverrideApplied) {
      debugRows.push({
        label: 'Retaliace',
        value: 'aktivni (cil uz predtim zautocil)',
      });
    }
  }
  if (battle?.attackerLossRatio != null || battle?.defenderLossRatio != null) {
    debugRows.push({
      label: 'Loss ratio (A/D)',
      value: `${formatBattlePercent(battle?.attackerLossRatio)} / ${formatBattlePercent(battle?.defenderLossRatio)}`,
    });
  }
  if (payload.sentArmy) {
    debugRows.push({
      label: 'Sent army total',
      value: Number(payload.sentArmy.totalUnits ?? 0).toLocaleString('cs-CZ'),
    });
    debugRows.push({
      label: 'Sent army power (base/final)',
      value: `${formatBattlePower(payload.sentArmy.baseAttackPower)} / ${formatBattlePower(payload.sentArmy.finalAttackPower)}`,
    });
  }
  if (returnMovement?.distanceTiles != null || returnMovement?.durationSec != null) {
    debugRows.push({
      label: 'Return movement (tiles/sec)',
      value: `${Number(returnMovement?.distanceTiles ?? 0).toLocaleString('cs-CZ')} / ${Number(
        returnMovement?.durationSec ?? 0,
      ).toLocaleString('cs-CZ')}`,
    });
  }
  const debugPayloadJson = JSON.stringify(payload, null, 2);

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

      {spy ? (
        <>
          <section>
            <h3>Špionážní hlášení</h3>
            <div className="battle-power-grid">
              <article>
                <span>Nasazení zvědů</span>
                <strong>{attackerScoutStart.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Ztráty zvědů</span>
                <strong>{attackerScoutLosses.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Přežilo zvědů</span>
                <strong>{attackerScoutSurvivors.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Obranní zvědi v osadě</span>
                <strong>{defenderScoutCount.toLocaleString('cs-CZ')}</strong>
              </article>
            </div>
            {hasSpyIntel ? (
              <p className="battle-spy-note">
                {isSpyApproximate
                  ? 'Zvědové utrpěli ztráty. Intel je přibližný a může být zkreslený.'
                  : 'Zvědové pronikli bez ztrát. Intel je přesný.'}
              </p>
            ) : (
              <p className="battle-army-hidden">Zvědové nepřežili. Žádné informace o osadě nebyly získány.</p>
            )}
          </section>

          {hasSpyIntel ? (
            <section>
              <h3>Zjištěné informace o osadě</h3>
              <div className="battle-frontline-grid">
                <article className="battle-army-card attacker">
                  <header>
                    <h4>Jednotky v osadě</h4>
                  </header>
                  {spyUnitRows.length > 0 ? (
                    <table className="battle-army-table">
                      <thead>
                        <tr>
                          <th>Jednotka</th>
                          <th>Počet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spyUnitRows.map((row) => (
                          <tr key={`${report.id}-spy-unit-${row.id}`}>
                            <td>{UNIT_META[row.id]?.fallbackName ?? row.id}</td>
                            <td>{row.amount.toLocaleString('cs-CZ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="battle-army-hidden">V osadě nebyly zachyceny žádné jednotky.</p>
                  )}
                </article>

                <article className="battle-army-card defender">
                  <header>
                    <h4>Budovy v osadě</h4>
                  </header>
                  {spyBuildingRows.length > 0 ? (
                    <table className="battle-army-table">
                      <thead>
                        <tr>
                          <th>Budova</th>
                          <th>Úroveň</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spyBuildingRows.map((row) => (
                          <tr key={`${report.id}-spy-building-${row.id}`}>
                            <td>{BUILDING_ART[row.id]?.fallbackName ?? row.id}</td>
                            <td>{row.amount.toLocaleString('cs-CZ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="battle-army-hidden">Zvědové neidentifikovali žádné budovy.</p>
                  )}
                </article>
              </div>
            </section>
          ) : null}

          <section>
            <h3>Návrat zvědů</h3>
            {returnMovement ? (
              <div className="battle-return-block">
                <p>
                  Návrat: <strong>{returnMovement.fromVillageName ?? 'Cíl'} → {returnMovement.toVillageName ?? 'Domov'}</strong>{' '}
                  · ETA <strong>{new Date(returnMovement.arriveAt ?? report.createdAt).toLocaleString('cs-CZ')}</strong>{' '}
                  · trvání <strong>{formatDurationLabel(returnMovement.durationSec ?? null)}</strong>
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
                  <p className="battle-army-hidden">Žádná vracející se jednotka nebyla zaznamenána.</p>
                )}
              </div>
            ) : (
              <p>Zvědové byli eliminováni a žádný návratový přesun nevznikl.</p>
            )}
          </section>
        </>
      ) : (
        <>
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
            {hasPowerIntel || hasPrestigeBalanceIntel ? (
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
                {hasPrestigeBalanceIntel ? (
                  <article>
                    <span>Balanc prestiže</span>
                    <strong>
                      A/D {Math.max(0, Number(prestigeBalance?.attackerPrestige ?? 0)).toLocaleString('cs-CZ')} /{' '}
                      {Math.max(0, Number(prestigeBalance?.defenderPrestige ?? 0)).toLocaleString('cs-CZ')}
                    </strong>
                    <small>
                      Útok x{Number(prestigeBalance?.attackModifier ?? 1).toFixed(2)} · obrana +
                      {Math.round(Number(prestigeBalance?.defenseBonus ?? 0) * 100)} % · kořist x
                      {Number(prestigeBalance?.lootModifier ?? 1).toFixed(2)}
                      {prestigeBalance?.retaliationOverrideApplied ? ' · odvetný útok aktivní' : ''}
                    </small>
                  </article>
                ) : null}
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
        </>
      )}
      <section className="battle-debug-wrap">
        <details className="battle-debug-details">
          <summary>Debug výpočtů (rozbalit)</summary>
          {debugRows.length > 0 ? (
            <ul className="battle-debug-list">
              {debugRows.map((row) => (
                <li key={`${report.id}-${row.label}`}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="battle-army-hidden">Pro tento report nejsou dostupné detailní výpočty.</p>
          )}
          <details className="battle-debug-json">
            <summary>Raw payload (JSON)</summary>
            <pre>{debugPayloadJson}</pre>
          </details>
        </details>
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

const CommandsPanel = ({
  activeMovements,
  incomingMovements,
  stationedSupports,
  activeUpgrades,
  activeRecruitments,
  units,
  settlements,
  market,
  resources,
  currentVillageId,
  currentUsername,
  commandHistory,
  recentAttackTargets,
  quickSelection,
  onIssueArmyCommand,
  onCancelArmyCommand,
  onReturnSupport,
  isArmyCommandPending,
  logisticsActionPending,
  commandNotice,
  onSendMarketLogistics,
  onOpenSettlementByVillageId,
}: {
  activeMovements: ArmyMovementState[];
  incomingMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  activeUpgrades: GameStateResponse['activeUpgrades'];
  activeRecruitments: GameStateResponse['activeRecruitments'];
  units: Unit[];
  settlements: RegionSettlement[];
  market: GameStateResponse['market'] | undefined;
  resources: Pick<GameStateResponse['resources'], 'wood' | 'stone' | 'iron'> | undefined;
  currentVillageId: number | null;
  currentUsername: string;
  commandHistory: Partial<Record<MapOrderCommandType, number>>;
  recentAttackTargets: NonNullable<GameStateResponse['army']['recentAttackTargets']>;
  quickSelection: ArmyQuickSelection | null;
  onIssueArmyCommand: (payload: {
      commandType: ArmyCommandType;
      targetVillageId: number;
      manualTargetCoordX?: number;
      manualTargetCoordY?: number;
      lootPriority?: LootPriority;
      units: Record<string, number>;
    }) => void;
  onCancelArmyCommand: (movementId: number) => void;
  onReturnSupport: (supportMovementId: number) => void;
  isArmyCommandPending: boolean;
  logisticsActionPending: boolean;
  commandNotice: string | null;
  onSendMarketLogistics: (payload: { targetVillageId: number; wood: number; stone: number; iron: number }) => void;
  onOpenSettlementByVillageId: (villageId: number) => void;
}) => {
  const sortedOutgoing = useMemo(
    () =>
      [...activeMovements]
        .filter((movement) => movement.commandType !== 'return')
        .sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [activeMovements],
  );
  const sortedReturns = useMemo(
    () =>
      [...activeMovements]
        .filter((movement) => movement.commandType === 'return')
        .sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [activeMovements],
  );
  const sortedIncoming = useMemo(
    () => [...incomingMovements].sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [incomingMovements],
  );
  const sortedUpgrades = useMemo(
    () => [...activeUpgrades].sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [activeUpgrades],
  );
  const sortedRecruitments = useMemo(
    () => [...activeRecruitments].sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [activeRecruitments],
  );
  const incomingAttackCount = sortedIncoming.filter((movement) => movement.commandType === 'attack').length;
  const [commandType, setCommandType] = useState<ArmyCommandType>('attack');
  const [lootPriority, setLootPriority] = useState<LootPriority>('balanced');
  const [targetVillageId, setTargetVillageId] = useState<number | null>(null);
  const [manualAttackTargetDraft, setManualAttackTargetDraft] = useState('');
  const [draftUnitAmounts, setDraftUnitAmounts] = useState<Record<string, string>>({});
  const [hoveredMovementId, setHoveredMovementId] = useState<number | null>(null);
  const [tooltipCursorPosition, setTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const [logisticsTargetVillageId, setLogisticsTargetVillageId] = useState<number | null>(null);
  const [manualLogisticsTargetDraft, setManualLogisticsTargetDraft] = useState('');
  const [logisticsDraft, setLogisticsDraft] = useState<{ wood: string; stone: string; iron: string }>({
    wood: '',
    stone: '',
    iron: '',
  });
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

  const parseCoordinateDraft = (value: string): GridPosition | null => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }
    const match = normalized.match(/^(-?\d{1,4})\s*[|,xX]\s*(-?\d{1,4})$/);
    if (!match) {
      return null;
    }
    const coordX = Number(match[1]);
    const coordY = Number(match[2]);
    if (!Number.isInteger(coordX) || !Number.isInteger(coordY)) {
      return null;
    }
    return { x: coordX, y: coordY };
  };

  const availableTargets = useMemo(() => {
    if (commandType === 'return') {
      return [];
    }

    if (commandType === 'attack') {
      const recentByVillageId = new Set(
        recentAttackTargets
          .map((entry) => Number(entry.targetVillageId))
          .filter((villageId) => Number.isFinite(villageId) && villageId > 0),
      );
      return settlements.filter((settlement) => {
        const villageId = Number(settlement.villageId ?? 0);
        if (!recentByVillageId.has(villageId)) {
          return false;
        }
        return canTargetSettlementForArmyCommand({
          settlement,
          commandType,
          currentVillageId,
          currentUsername,
        });
      });
    }

    return settlements.filter((settlement) =>
      canTargetSettlementForArmyCommand({
        settlement,
        commandType,
        currentVillageId,
        currentUsername,
      }),
    );
  }, [commandType, currentUsername, currentVillageId, recentAttackTargets, settlements]);

  const resolvedTargetVillageId = useMemo(() => {
    if (commandType === 'return') {
      return null;
    }
    if (targetVillageId != null) {
      const settlement =
        settlements.find((candidate) => Number(candidate.villageId) === Number(targetVillageId)) ?? null;
      if (
        settlement &&
        canTargetSettlementForArmyCommand({
          settlement,
          commandType,
          currentVillageId,
          currentUsername,
        })
      ) {
        return Number(targetVillageId);
      }
    }
    return null;
  }, [commandType, currentUsername, currentVillageId, settlements, targetVillageId]);

  const historyItems = useMemo(
    () =>
      MAP_ORDER_COMMAND_TYPES.map((historyCommandType) => {
        const rememberedTargetVillageId = Number(commandHistory[historyCommandType] ?? 0);
        if (!Number.isFinite(rememberedTargetVillageId) || rememberedTargetVillageId <= 0) {
          return null;
        }

        const settlement =
          settlements.find((candidate) => Number(candidate.villageId) === rememberedTargetVillageId) ?? null;
        const isSelectable = settlement
          ? canTargetSettlementForArmyCommand({
              settlement,
              commandType: historyCommandType,
              currentVillageId,
              currentUsername,
            })
          : false;

        return {
          commandType: historyCommandType,
          targetVillageId: rememberedTargetVillageId,
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
  const lootCapacity = useMemo(() => calculateLootCapacityFromSelection(selectedCommandUnits), [selectedCommandUnits]);
  const selectedTargetSettlement = useMemo(
    () =>
      resolvedTargetVillageId == null
        ? null
        : settlements.find((settlement) => Number(settlement.villageId) === resolvedTargetVillageId) ?? null,
    [resolvedTargetVillageId, settlements],
  );
  const manualAttackTargetCoordinates = useMemo(
    () => (commandType === 'attack' ? parseCoordinateDraft(manualAttackTargetDraft) : null),
    [commandType, manualAttackTargetDraft],
  );
  const manualAttackTargetSettlementByCoords = useMemo(() => {
    if (!manualAttackTargetCoordinates) {
      return null;
    }
    return (
      settlements.find(
        (candidate) =>
          Number(candidate.globalX) === Number(manualAttackTargetCoordinates.x) &&
          Number(candidate.globalY) === Number(manualAttackTargetCoordinates.y),
      ) ?? null
    );
  }, [manualAttackTargetCoordinates, settlements]);
  const manualAttackTargetBlockedByPrestige =
    manualAttackTargetSettlementByCoords?.prestigeAttackBlockedForViewer === true;
  const manualAttackTargetSettlement = useMemo(() => {
    const settlement = manualAttackTargetSettlementByCoords;
    if (!settlement) {
      return null;
    }
    const isAllowed = canTargetSettlementForArmyCommand({
      settlement,
      commandType: 'attack',
      currentVillageId,
      currentUsername,
    });
    return isAllowed ? settlement : null;
  }, [currentUsername, currentVillageId, manualAttackTargetSettlementByCoords]);
  const effectiveTargetSettlement =
    commandType === 'attack' && manualAttackTargetSettlement ? manualAttackTargetSettlement : selectedTargetSettlement;
  const manualAttackHasInput = commandType === 'attack' && manualAttackTargetDraft.trim().length > 0;
  const manualAttackTargetError = useMemo(() => {
    if (!manualAttackHasInput) {
      return null;
    }
    if (!manualAttackTargetCoordinates) {
      return 'Neplatný formát. Použij X|Y.';
    }
    if (!manualAttackTargetSettlementByCoords) {
      return 'Na zadaných souřadnicích není platný cíl útoku v tomto světě.';
    }
    if (manualAttackTargetBlockedByPrestige) {
      return 'Cíl je pod ochranou prestiže. Pokud tě tento hráč napadne, ochrana se zruší a útok můžeš vrátit.';
    }
    if (!manualAttackTargetSettlement) {
      return 'Na zadaných souřadnicích není platný cíl útoku v tomto světě.';
    }
    return null;
  }, [
    manualAttackHasInput,
    manualAttackTargetBlockedByPrestige,
    manualAttackTargetCoordinates,
    manualAttackTargetSettlement,
    manualAttackTargetSettlementByCoords,
  ]);
  const effectiveTargetVillageId =
    effectiveTargetSettlement == null ? null : Number(effectiveTargetSettlement.villageId ?? null);
  const selectedTargetDistanceTiles = useMemo(() => {
    if (!effectiveTargetSettlement) {
      return null;
    }
    const originSettlement =
      settlements.find((settlement) => Number(settlement.villageId) === Number(currentVillageId)) ?? null;
    if (!originSettlement) {
      return null;
    }
    return calculateCellDistance(
      originSettlement.globalX,
      originSettlement.globalY,
      effectiveTargetSettlement.globalX,
      effectiveTargetSettlement.globalY,
    );
  }, [currentVillageId, effectiveTargetSettlement, settlements]);
  const selectedTargetEtaLabel = useMemo(() => {
    if (selectedTargetDistanceTiles == null) {
      return '-';
    }
    let duration: number | null = null;
    for (const unitId of COMMAND_UNIT_ORDER) {
      if (Number(selectedCommandUnits[unitId] ?? 0) <= 0) {
        continue;
      }
      duration = resolveUnitTravelDurationSec(unitId, selectedTargetDistanceTiles);
      break;
    }
    return duration == null ? '-' : formatDurationLabel(duration);
  }, [selectedCommandUnits, selectedTargetDistanceTiles]);
  const selectedTargetPrestigeBlocked =
    commandType === 'attack' && effectiveTargetSettlement?.prestigeAttackBlockedForViewer === true;
  const selectedTargetRetaliationUnlocked =
    commandType === 'attack' && effectiveTargetSettlement?.retaliationUnlockedForViewer === true;
  const selectedTargetRetaliationAtLabel =
    selectedTargetRetaliationUnlocked && effectiveTargetSettlement?.retaliationUnlockedAt
      ? formatDateTimeLabel(effectiveTargetSettlement.retaliationUnlockedAt)
      : null;
  const hasAvailableCommandUnits = useMemo(
    () =>
      units.some((unit) => {
        if (commandType === 'support' && unit.id === 'caravan') {
          return false;
        }
        return Number(unit.amount ?? 0) > 0;
      }),
    [commandType, units],
  );
  const selectAllCommandUnitsTooltip =
    commandType === 'support'
      ? 'Vyplní dostupné jednotky bez karavan (podpora je nepovoluje).'
      : 'Vyplní dostupné množství všech aktuálních jednotek.';

  const handleSelectAllCommandUnits = () => {
    setDraftUnitAmounts(
      buildDraftUnitAmountsFromAvailable(units, {
        excludeCaravan: commandType === 'support',
      }),
    );
  };

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

  const handleSendCommand = () => {
    if (effectiveTargetVillageId == null || selectedCommandUnitCount <= 0) {
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
      targetVillageId: effectiveTargetVillageId,
      manualTargetCoordX:
        commandType === 'attack' && manualAttackTargetCoordinates ? manualAttackTargetCoordinates.x : undefined,
      manualTargetCoordY:
        commandType === 'attack' && manualAttackTargetCoordinates ? manualAttackTargetCoordinates.y : undefined,
      lootPriority: commandType === 'attack' ? lootPriority : undefined,
      units: selectedUnitsPayload,
    });
    setDraftUnitAmounts({});
    setLootPriority('balanced');
  };

  const handleDraftAmountChange = (unitId: string, value: string) => {
    setDraftUnitAmounts((previous) => ({
      ...previous,
      [unitId]: value,
    }));
  };
  const handleFillSingleCommandUnit = (unitId: string, availableAmountRaw: number) => {
    if (isArmyCommandPending) {
      return;
    }
    if (commandType === 'support' && unitId === 'caravan') {
      return;
    }
    const availableAmount = Math.max(0, Math.floor(Number(availableAmountRaw ?? 0)));
    setDraftUnitAmounts((previous) => ({
      ...previous,
      [unitId]: availableAmount > 0 ? String(availableAmount) : '',
    }));
  };

  const marketLevel = Math.max(0, Math.floor(Number(market?.level ?? 0)));
  const marketCapacity = Math.max(0, Math.floor(Number(market?.capacity ?? 0)));
  const marketMaxDistance = Math.max(0, Math.floor(Number(market?.maxDistance ?? 0)));
  const logisticsRoutes = useMemo(
    () =>
      [...(market?.logisticsRoutes ?? [])].sort(
        (left, right) => left.remainingSec - right.remainingSec || left.id - right.id,
      ),
    [market?.logisticsRoutes],
  );
  const logisticsTargets = useMemo(
    () =>
      settlements
        .filter((settlement) => {
          const villageId = Number(settlement.villageId ?? 0);
          if (!Number.isFinite(villageId) || villageId <= 0) {
            return false;
          }
          return currentVillageId == null || villageId !== Number(currentVillageId);
        })
        .sort((left, right) => left.name.localeCompare(right.name, 'cs-CZ')),
    [currentVillageId, settlements],
  );

  useEffect(() => {
    if (
      logisticsTargetVillageId != null &&
      logisticsTargets.some((settlement) => Number(settlement.villageId) === logisticsTargetVillageId)
    ) {
      return;
    }
    setLogisticsTargetVillageId(logisticsTargets.length > 0 ? Number(logisticsTargets[0]?.villageId ?? null) : null);
  }, [logisticsTargetVillageId, logisticsTargets]);

  const parseLogisticsAmount = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  };
  const logisticsWood = parseLogisticsAmount(logisticsDraft.wood);
  const logisticsStone = parseLogisticsAmount(logisticsDraft.stone);
  const logisticsIron = parseLogisticsAmount(logisticsDraft.iron);
  const logisticsTotal = logisticsWood + logisticsStone + logisticsIron;
  const selectedLogisticsSettlement =
    logisticsTargetVillageId == null
      ? null
      : settlements.find((settlement) => Number(settlement.villageId) === Number(logisticsTargetVillageId)) ?? null;
  const manualLogisticsCoordinates = parseCoordinateDraft(manualLogisticsTargetDraft);
  const manualLogisticsSettlement = manualLogisticsCoordinates
    ? settlements.find(
        (candidate) =>
          Number(candidate.globalX) === Number(manualLogisticsCoordinates.x) &&
          Number(candidate.globalY) === Number(manualLogisticsCoordinates.y),
      ) ?? null
    : null;
  const manualLogisticsHasInput = manualLogisticsTargetDraft.trim().length > 0;
  const effectiveLogisticsSettlement =
    manualLogisticsHasInput && manualLogisticsSettlement ? manualLogisticsSettlement : selectedLogisticsSettlement;
  const logisticsDistanceTiles = useMemo(() => {
    if (!effectiveLogisticsSettlement) {
      return null;
    }
    const originSettlement =
      settlements.find((settlement) => Number(settlement.villageId) === Number(currentVillageId)) ?? null;
    if (!originSettlement) {
      return null;
    }
    return calculateCellDistance(
      originSettlement.globalX,
      originSettlement.globalY,
      effectiveLogisticsSettlement.globalX,
      effectiveLogisticsSettlement.globalY,
    );
  }, [currentVillageId, effectiveLogisticsSettlement, settlements]);
  const logisticsEtaSec =
    logisticsDistanceTiles == null ? null : Math.max(60, Math.floor((10 + logisticsDistanceTiles * 2) * 60));
  const logisticsWarnings: string[] = [];
  if (manualLogisticsHasInput && !manualLogisticsCoordinates) {
    logisticsWarnings.push('Ruční cíl musí mít formát X|Y.');
  } else if (manualLogisticsHasInput && !manualLogisticsSettlement) {
    logisticsWarnings.push('Na zadaných souřadnicích nebylo nalezeno léno v tomto světě.');
  }
  if (logisticsTotal > marketCapacity && marketLevel > 0) {
    logisticsWarnings.push(
      `Součet zásilky překračuje kapacitu trhu (${marketCapacity.toLocaleString('cs-CZ')}).`,
    );
  }
  if (logisticsWood > Number(resources?.wood ?? 0)) {
    logisticsWarnings.push('Nedostatek dřeva.');
  }
  if (logisticsStone > Number(resources?.stone ?? 0)) {
    logisticsWarnings.push('Nedostatek kamene.');
  }
  if (logisticsIron > Number(resources?.iron ?? 0)) {
    logisticsWarnings.push('Nedostatek železa.');
  }
  if (logisticsDistanceTiles != null && marketMaxDistance > 0 && logisticsDistanceTiles > marketMaxDistance) {
    logisticsWarnings.push(`Cíl je mimo dosah trhu (${marketMaxDistance} polí).`);
  }
  const canSendLogistics =
    marketLevel > 0 &&
    effectiveLogisticsSettlement != null &&
    logisticsTotal > 0 &&
    logisticsWarnings.length === 0 &&
    !logisticsActionPending;

  const resolveRouteStatusLabel = (statusRaw: string): string => {
    const status = String(statusRaw ?? '').toLocaleLowerCase('cs-CZ');
    if (status === 'ordered') {
      return 'Objednáno';
    }
    if (status === 'active') {
      return 'Aktivní';
    }
    if (status === 'expired') {
      return 'Vypršelo';
    }
    if (status === 'in_transit') {
      return 'Na cestě';
    }
    if (status === 'completed') {
      return 'Doručeno';
    }
    if (status === 'canceled') {
      return 'Zrušeno';
    }
    return statusRaw;
  };

  return (
    <div className="panel-stack commands-panel">
      <section>
        <h3>Prioritní hrozby</h3>
        <div className="commands-kpi-strip">
          <article className={incomingAttackCount > 0 ? 'is-danger' : ''}>
            <span>Příchozí útoky</span>
            <strong>{incomingAttackCount.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Příchozí rozkazy celkem</span>
            <strong>{sortedIncoming.length.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Odchozí rozkazy</span>
            <strong>{sortedOutgoing.length.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Návraty armád</span>
            <strong>{sortedReturns.length.toLocaleString('cs-CZ')}</strong>
          </article>
        </div>
      </section>

      <section className="army-order-workbench">
        <header className="army-order-workbench-header">
          <div>
            <h3>Vydat armádní rozkaz</h3>
            <p className="army-order-subtitle">Nastav cíl, připrav složení výpravy a potvrď rozkaz z velitelské mapy.</p>
          </div>
          <span className={`army-order-type-pill ${commandType}`}>
            <span className="army-order-type-symbol" aria-hidden="true">
              {getArmyCommandSymbol(commandType)}
            </span>
            <span>{ARMY_COMMAND_LABELS[commandType]}</span>
          </span>
        </header>
        <div className="army-command-controls army-order-control-grid">
          <label className="army-order-field">
            <span className="army-order-field-label">Rozkaz</span>
            <select
              className={`army-command-type-select ${commandType}`}
              value={commandType}
              onChange={(event) => setCommandType(event.target.value as ArmyCommandType)}
              disabled={isArmyCommandPending}
            >
              <option value="attack">{ARMY_COMMAND_LABELS.attack}</option>
              <option value="support">{ARMY_COMMAND_LABELS.support}</option>
              <option value="move">{ARMY_COMMAND_LABELS.move}</option>
            </select>
          </label>
          <label className="army-order-field">
            <span className="army-order-field-label">Cílové léno</span>
            <select
              value={resolvedTargetVillageId == null ? '' : String(resolvedTargetVillageId)}
              onChange={(event) => {
                const value = String(event.target.value ?? '').trim();
                setTargetVillageId(value ? Number(value) : null);
              }}
              disabled={isArmyCommandPending || availableTargets.length === 0}
            >
              <option value="">-</option>
              {availableTargets.map((settlement) => (
                <option key={settlement.id} value={settlement.villageId}>
                  {settlement.name} ({settlement.globalX}|{settlement.globalY})
                </option>
              ))}
            </select>
          </label>
          {commandType === 'attack' ? (
            <label className="army-order-field">
              <span className="army-order-field-label">Ruční cíl (X|Y)</span>
              <input
                type="text"
                className="army-command-manual-target-input"
                value={manualAttackTargetDraft}
                onChange={(event) => setManualAttackTargetDraft(event.target.value)}
                placeholder="např. 225|452"
                disabled={isArmyCommandPending}
              />
            </label>
          ) : null}
          {commandType === 'attack' ? (
            <label className="army-order-field">
              <span className="army-order-field-label">Priorita drancování</span>
              <select
                value={lootPriority}
                onChange={(event) => setLootPriority(event.target.value as LootPriority)}
                disabled={isArmyCommandPending}
              >
                <option value="balanced">{LOOT_PRIORITY_LABELS.balanced}</option>
                <option value="wood">{LOOT_PRIORITY_LABELS.wood}</option>
                <option value="stone">{LOOT_PRIORITY_LABELS.stone}</option>
                <option value="iron">{LOOT_PRIORITY_LABELS.iron}</option>
              </select>
            </label>
          ) : null}
        </div>
        {manualAttackTargetError ? <p className="panel-feedback is-danger">{manualAttackTargetError}</p> : null}
        {historyItems.length > 0 ? (
          <div className="army-command-history army-order-history">
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
        <div className="army-order-unit-board">
          <div className="army-draft-actions army-order-draft-toolbar">
            <div>
              <p className="army-order-toolbar-title">Složení výpravy</p>
              <p className="row-help">Použij MAX pro rychlé nasazení konkrétního typu jednotky.</p>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={handleSelectAllCommandUnits}
              disabled={isArmyCommandPending || !hasAvailableCommandUnits}
              title={selectAllCommandUnitsTooltip}
            >
              Přidat všechny
            </button>
          </div>
          <div className="army-draft-grid army-order-unit-grid">
            {units.map((unit) => {
              const isSupportCaravanBlocked = commandType === 'support' && unit.id === 'caravan';
              const draftInputId = `command-draft-${commandType}-${unit.id}`;
              return (
                <article
                  key={`command-draft-${unit.id}`}
                  className={`army-order-unit-card ${isSupportCaravanBlocked ? 'is-locked' : ''}`}
                >
                  <header className="army-order-unit-head">
                    <span className="unit-name-with-icon unit-name-with-icon-strong">
                      <span className="unit-icon-shell tiny" aria-hidden="true">
                        <img src={getUnitMetaById(unit.id).icon} alt="" className="unit-icon-image" loading="lazy" />
                      </span>
                      <span>{unit.name}</span>
                    </span>
                    <small className="row-help">k dispozici: {unit.amount.toLocaleString('cs-CZ')}</small>
                  </header>
                  <div className="army-order-unit-controls">
                    <label htmlFor={draftInputId} className="army-order-unit-label">
                      Nasadit
                    </label>
                    <div className="army-draft-input-row">
                      <input
                        id={draftInputId}
                        type="number"
                        min={0}
                        max={unit.amount}
                        step={1}
                        value={draftUnitAmounts[unit.id] ?? ''}
                        onChange={(event) => handleDraftAmountChange(unit.id, event.target.value)}
                        onWheel={(event) =>
                          adjustNumericInputByWheel(event, (nextValue) => {
                            handleDraftAmountChange(unit.id, nextValue);
                          })
                        }
                        onKeyDown={(event) => {
                          handleActionOnEnter(event, () => {
                            handleSendCommand();
                          });
                        }}
                        disabled={isArmyCommandPending || isSupportCaravanBlocked}
                      />
                      <button
                        type="button"
                        className="secondary-action compact army-draft-unit-fill-button"
                        onClick={() => handleFillSingleCommandUnit(unit.id, unit.amount)}
                        disabled={isArmyCommandPending || unit.amount <= 0 || isSupportCaravanBlocked}
                        title="Vložit všechny dostupné jednotky tohoto typu"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  {isSupportCaravanBlocked ? (
                    <small className="row-help army-order-unit-warning">Karavany nelze posílat jako podporu.</small>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
        <div className="army-command-preview army-order-preview">
          <p className="army-command-preview-target">
            Cíl:{' '}
            <strong>
              {effectiveTargetSettlement
                ? `${effectiveTargetSettlement.name} (${effectiveTargetSettlement.globalX}|${effectiveTargetSettlement.globalY})`
                : '-'}
            </strong>
            {' · '}
            ETA: <strong>{selectedTargetEtaLabel}</strong>
          </p>
          {selectedTargetPrestigeBlocked ? (
            <p className="panel-feedback is-danger">
              Ochrana prestiže je aktivní: tento cíl je zatím mimo rozsah útoku. Jakmile tě tento hráč napadne,
              ochrana padá a útok můžeš vrátit.
            </p>
          ) : null}
          {selectedTargetRetaliationUnlocked ? (
            <p className="panel-feedback">
              Retaliace je aktivní: tento hráč už na tebe zaútočil
              {selectedTargetRetaliationAtLabel ? ` (${selectedTargetRetaliationAtLabel})` : ''} a útok můžeš vrátit.
            </p>
          ) : null}
          <div className="army-order-preview-metrics">
            <article>
              <span>Vybráno jednotek</span>
              <strong>{selectedCommandUnitCount.toLocaleString('cs-CZ')}</strong>
            </article>
            {commandType === 'attack' ? (
              <>
                <article>
                  <span>Síla útoku</span>
                  <strong>{attackPowerWithBonuses.toLocaleString('cs-CZ')}</strong>
                  {hasRamAttackBonus ? <small>včetně +10 % bonusu beranidel bez brány</small> : null}
                </article>
                <article>
                  <span>Kapacita kořisti</span>
                  <strong>{lootCapacity.toLocaleString('cs-CZ')} surovin</strong>
                  <small>bez zvědů a beranidel</small>
                </article>
              </>
            ) : (
              <article>
                <span>Síla obrany výpravy</span>
                <strong>{baseDefensePower.toLocaleString('cs-CZ')}</strong>
              </article>
            )}
          </div>
        </div>
        <button
          className="secondary-action army-order-submit"
          onClick={handleSendCommand}
          disabled={isArmyCommandPending || effectiveTargetVillageId == null || selectedCommandUnitCount <= 0}
        >
          {isArmyCommandPending ? 'Odesílám rozkaz...' : 'Odeslat armádní rozkaz'}
        </button>
        {commandNotice ? <p className="panel-feedback">{commandNotice}</p> : null}
      </section>

      <section>
        <h3>Příchozí rozkazy na tvé osady</h3>
        {sortedIncoming.length > 0 ? (
          <ul className="commands-list">
            {sortedIncoming.map((movement) => {
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={`incoming-command-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className={`command-badge ${movement.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    </span>
                    <strong>
                      {movement.commandType === 'attack'
                        ? 'Útok'
                        : movement.commandType === 'support'
                          ? 'Podpora'
                          : 'Přesun'}
                    </strong>
                    <span>
                      {movement.commanderUsername ?? 'Neznámý velitel'} → {movement.targetName}
                    </span>
                  </div>
                  <small>
                    Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA {formatDurationLabel(movement.remainingSec)}
                  </small>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => onOpenSettlementByVillageId(movement.targetVillageId)}
                  >
                    Otevřít osadu
                  </button>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Na tvé osady aktuálně nemíří žádný cizí rozkaz.</p>
        )}
      </section>

      <section>
        <h3>Odchozí armádní rozkazy</h3>
        {sortedOutgoing.length > 0 ? (
          <ul className="commands-list">
            {sortedOutgoing.map((movement) => {
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={`outgoing-command-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className={`command-badge ${movement.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    </span>
                    <strong>{ARMY_COMMAND_LABELS[movement.commandType]}</strong>
                    <span>
                      {movement.originName} → {movement.targetName}
                    </span>
                  </div>
                  <small>
                    Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA {formatDurationLabel(movement.remainingSec)}
                  </small>
                  {movement.commandType === 'attack' ||
                  movement.commandType === 'support' ||
                  movement.commandType === 'move' ? (
                    <div className="activity-item-actions">
                      <button
                        type="button"
                        className="inline-cancel-button"
                        onClick={() => onCancelArmyCommand(movement.id)}
                        disabled={isArmyCommandPending}
                        title="Zrušit tento rozkaz (do 1/3 cesty)"
                      >
                        {isArmyCommandPending ? '…' : 'Zrušit rozkaz'}
                      </button>
                    </div>
                  ) : null}
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Nemáš žádný odchozí rozkaz.</p>
        )}
      </section>

      <section>
        <h3>Stacionované podpory a návraty</h3>
        {stationedSupports.length > 0 || sortedReturns.length > 0 ? (
          <ul className="commands-list">
            {stationedSupports.map((movement) => {
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={`stationed-support-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className="command-badge support compact">
                      <span className="symbol">{getArmyCommandSymbol('support')}</span>
                    </span>
                    <strong>Stacionovaná podpora</strong>
                    <span>
                      {movement.originName} → {movement.targetName}
                    </span>
                  </div>
                  <small>Jednotky: {unitsTotal.toLocaleString('cs-CZ')}</small>
                  <div className="activity-item-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onReturnSupport(movement.id)}
                      disabled={isArmyCommandPending}
                    >
                      Poslat návrat
                    </button>
                  </div>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
            {sortedReturns.map((movement) => {
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={`return-command-${movement.id}`}
                  className={`commands-item has-army-tooltip${hoveredMovementId === movement.id ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementId(movement.id);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementId((previous) => (previous === movement.id ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className="command-badge return compact">
                      <span className="symbol">{getArmyCommandSymbol('return')}</span>
                    </span>
                    <strong>Návrat armády</strong>
                    <span>
                      {movement.originName} → {movement.targetName}
                    </span>
                  </div>
                  <small>
                    Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA {formatDurationLabel(movement.remainingSec)}
                  </small>
                  {hoveredMovementId === movement.id ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Žádné návraty ani stacionované podpory nejsou aktivní.</p>
        )}
      </section>

      <section>
        <h3>Ekonomické fronty</h3>
        {sortedUpgrades.length > 0 || sortedRecruitments.length > 0 ? (
          <ul className="commands-list">
            {sortedUpgrades.map((upgrade) => (
              <li key={`upgrade-order-${upgrade.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>Výstavba</strong>
                  <span>
                    {BUILDING_ART[upgrade.buildingId]?.fallbackName ?? upgrade.buildingId} {upgrade.fromLevel} →{' '}
                    {upgrade.toLevel}
                  </span>
                </div>
                <small>ETA {formatDurationLabel(upgrade.remainingSec)}</small>
              </li>
            ))}
            {sortedRecruitments.map((recruitment) => (
              <li key={`recruit-order-${recruitment.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>Nábor</strong>
                  <span>
                    {UNIT_META[recruitment.unitId]?.fallbackName ?? recruitment.unitId} +{recruitment.amount}
                  </span>
                </div>
                <small>ETA {formatDurationLabel(recruitment.remainingSec)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Výstavba i nábor jsou momentálně bez aktivní fronty.</p>
        )}
      </section>

      <section>
        <h3>Trh a logistika</h3>
        <div className="commands-kpi-strip">
          <article>
            <span>Úroveň trhu</span>
            <strong>{marketLevel.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Kapacita zásilky</span>
            <strong>{marketCapacity.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Max. vzdálenost</span>
            <strong>{marketMaxDistance.toLocaleString('cs-CZ')} polí</strong>
          </article>
          <article className={market?.guildUnlocked ? '' : 'is-danger'}>
            <span>Cech obchodníků</span>
            <strong>{market?.guildUnlocked ? '08:00 - 20:00' : 'Připravuje se'}</strong>
          </article>
        </div>
        {marketLevel > 0 ? (
          <div className="research-logistics-form">
            <label>
              Cílové léno (výběr)
              <select
                value={logisticsTargetVillageId == null ? '' : String(logisticsTargetVillageId)}
                onChange={(event) => {
                  const value = String(event.target.value ?? '').trim();
                  setLogisticsTargetVillageId(value ? Number(value) : null);
                }}
                disabled={logisticsActionPending || logisticsTargets.length === 0}
              >
                <option value="">-</option>
                {logisticsTargets.map((settlement) => (
                  <option key={`logistics-target-${settlement.id}`} value={settlement.villageId}>
                    {settlement.name} ({settlement.globalX}|{settlement.globalY})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ruční cíl (X|Y)
              <input
                type="text"
                value={manualLogisticsTargetDraft}
                onChange={(event) => setManualLogisticsTargetDraft(event.target.value)}
                placeholder="např. 229|447"
                disabled={logisticsActionPending}
              />
            </label>
            <div className="research-logistics-grid">
              <label>
                🌲 Dřevo
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={logisticsDraft.wood}
                  onChange={(event) =>
                    setLogisticsDraft((previous) => ({
                      ...previous,
                      wood: event.target.value,
                    }))
                  }
                  disabled={logisticsActionPending}
                />
              </label>
              <label>
                🧱 Kámen
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={logisticsDraft.stone}
                  onChange={(event) =>
                    setLogisticsDraft((previous) => ({
                      ...previous,
                      stone: event.target.value,
                    }))
                  }
                  disabled={logisticsActionPending}
                />
              </label>
              <label>
                ⛓ Železo
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={logisticsDraft.iron}
                  onChange={(event) =>
                    setLogisticsDraft((previous) => ({
                      ...previous,
                      iron: event.target.value,
                    }))
                  }
                  disabled={logisticsActionPending}
                />
              </label>
            </div>
            <div className="army-command-preview">
              <p className="army-command-preview-target">
                Cíl:{' '}
                <strong>
                  {effectiveLogisticsSettlement
                    ? `${effectiveLogisticsSettlement.name} (${effectiveLogisticsSettlement.globalX}|${effectiveLogisticsSettlement.globalY})`
                    : '-'}
                </strong>{' '}
                · ETA: <strong>{logisticsEtaSec == null ? '-' : formatDurationLabel(logisticsEtaSec)}</strong>
              </p>
              <p>
                Součet zásilky: <strong>{logisticsTotal.toLocaleString('cs-CZ')}</strong> /{' '}
                <strong>{marketCapacity.toLocaleString('cs-CZ')}</strong>
              </p>
            </div>
            {logisticsWarnings.map((warning) => (
              <p key={`logistics-warning-${warning}`} className="panel-feedback is-danger">
                {warning}
              </p>
            ))}
            <div className="research-panel-inline-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  if (effectiveLogisticsSettlement == null) {
                    return;
                  }
                  onSendMarketLogistics({
                    targetVillageId: Number(effectiveLogisticsSettlement.villageId ?? 0),
                    wood: logisticsWood,
                    stone: logisticsStone,
                    iron: logisticsIron,
                  });
                }}
                disabled={!canSendLogistics}
              >
                {logisticsActionPending ? 'Odesílám zásilku...' : 'Odeslat logistiku'}
              </button>
            </div>
          </div>
        ) : (
          <p>Postav Městský trh alespoň na úroveň 1 pro ruční logistiku.</p>
        )}
        {logisticsRoutes.length > 0 ? (
          <ul className="commands-list">
            {logisticsRoutes.map((route) => (
              <li key={`logistics-route-${route.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>
                    {route.sourceVillageName} → {route.targetVillageName}
                  </strong>
                  <span>{resolveRouteStatusLabel(route.status)}</span>
                </div>
                <small>
                  🌲 {Math.max(0, Math.floor(Number(route.wood))).toLocaleString('cs-CZ')} · 🧱{' '}
                  {Math.max(0, Math.floor(Number(route.stone))).toLocaleString('cs-CZ')} · ⛓{' '}
                  {Math.max(0, Math.floor(Number(route.iron))).toLocaleString('cs-CZ')}
                </small>
                <small>
                  ETA {route.status === 'completed' ? 'doručeno' : formatDurationLabel(route.remainingSec)} · Start{' '}
                  {formatDateTimeLabel(route.startedAt)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Žádné aktivní logistické zásilky.</p>
        )}
        <p className="row-help">Cech obchodníků: mechanika automatické logistiky se připravuje.</p>
      </section>
    </div>
  );
};

const ActivityPanel = ({
  activity,
  loading,
  error,
  includeArchived,
  militaryOnly,
  actionPending,
  onSetPage,
  onToggleIncludeArchived,
  onToggleMilitaryOnly,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
  onShare,
  onOpenBattleReport,
}: {
  activity: GameActivityListResponse | null;
  loading: boolean;
  error: string | null;
  includeArchived: boolean;
  militaryOnly: boolean;
  actionPending: boolean;
  onSetPage: (page: number) => void;
  onToggleIncludeArchived: () => void;
  onToggleMilitaryOnly: () => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (notificationId: number) => void;
  onArchive: (notificationId: number) => void;
  onUnarchive: (notificationId: number) => void;
  onDelete: (notificationId: number) => void;
  onShare: (item: GameActivityItem) => void;
  onOpenBattleReport: (reportId: number) => void;
}) => {
  const page = activity?.page ?? 1;
  const totalPages = activity?.totalPages ?? 1;
  const total = activity?.total ?? 0;
  const unreadTotal = activity?.unreadTotal ?? 0;
  const attentionTotal = activity?.attentionTotal ?? 0;
  const items = activity?.items ?? [];
  const isMilitaryActivity = (item: GameActivityItem): boolean => {
    const category = String(item.category ?? '').toLocaleLowerCase('cs-CZ');
    const eventType = String(item.eventType ?? '').toLocaleLowerCase('cs-CZ');
    const title = String(item.title ?? '').toLocaleLowerCase('cs-CZ');
    const summary = String(item.summary ?? '').toLocaleLowerCase('cs-CZ');
    const militaryKeywords = [
      'battle',
      'army',
      'attack',
      'support',
      'move',
      'combat',
      'boj',
      'utok',
      'podpora',
      'presun',
      'obrana',
      'spion',
      'zved',
    ];
    return militaryKeywords.some((keyword) =>
      category.includes(keyword) ||
      eventType.includes(keyword) ||
      title.includes(keyword) ||
      summary.includes(keyword),
    );
  };
  const visibleItems = militaryOnly ? items.filter((item) => isMilitaryActivity(item)) : items;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const resolveActivitySeverityLabel = (severity: GameActivityItem['severity']): string => {
    if (severity === 'critical') {
      return 'Kritické';
    }
    if (severity === 'warning') {
      return 'Varování';
    }
    if (severity === 'success') {
      return 'Pozitivní';
    }
    return 'Info';
  };

  return (
    <div className="panel-stack activity-panel">
      <section>
        <div className="messages-header">
          <h3>Herní záznamy</h3>
          <button className="secondary-action" onClick={onRefresh} disabled={loading || actionPending}>
            {loading ? 'Načítám...' : 'Obnovit'}
          </button>
        </div>
        <div className="commands-kpi-strip">
          <article className={unreadTotal > 0 ? 'is-danger' : ''}>
            <span>Nepřečtené</span>
            <strong>{unreadTotal.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className={attentionTotal > 0 ? 'is-danger' : ''}>
            <span>Vyžaduje pozornost</span>
            <strong>{attentionTotal.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Celkem položek</span>
            <strong>{total.toLocaleString('cs-CZ')}</strong>
          </article>
        </div>
        <div className="messages-pagination">
          <button onClick={() => onSetPage(1)} disabled={!canGoPrev || loading || actionPending}>
            První
          </button>
          <button onClick={() => onSetPage(page - 1)} disabled={!canGoPrev || loading || actionPending}>
            Předchozí
          </button>
          <span>
            Strana {page} / {totalPages}
          </span>
          <button onClick={() => onSetPage(page + 1)} disabled={!canGoNext || loading || actionPending}>
            Další
          </button>
          <button onClick={() => onSetPage(totalPages)} disabled={!canGoNext || loading || actionPending}>
            Poslední
          </button>
        </div>
        <div className="activity-toolbar">
          <button type="button" className="secondary-action" onClick={onToggleIncludeArchived} disabled={loading || actionPending}>
            {includeArchived ? 'Skrýt archiv' : 'Zobrazit archiv'}
          </button>
          <button type="button" className="secondary-action" onClick={onToggleMilitaryOnly} disabled={loading || actionPending}>
            {militaryOnly ? 'Zobrazit vše' : 'Zobrazit jen vojenské akce'}
          </button>
          <button type="button" className="secondary-action" onClick={onMarkAllRead} disabled={loading || actionPending || unreadTotal <= 0}>
            Označit vše jako přečtené
          </button>
        </div>
        {error ? <p className="panel-feedback">{error}</p> : null}
        <div className="activity-list-frame">
          <ul className="commands-list activity-list">
            {visibleItems.map((item) => {
            const payloadRecord = item.payload ?? {};
            const maybeReportId = Number((payloadRecord as Record<string, unknown>).reportId ?? 0);
            const canOpenBattleReport = Number.isFinite(maybeReportId) && maybeReportId > 0;
            return (
              <li
                key={`activity-item-${item.id}`}
                className={`commands-item activity-item ${item.readAt == null ? 'is-unread' : ''} ${
                  item.severity === 'critical' || item.severity === 'warning' ? 'is-danger' : ''
                }`}
              >
                <div className="commands-item-line">
                  <strong>{item.title}</strong>
                  <span>{resolveActivitySeverityLabel(item.severity)}</span>
                </div>
                <p>{item.summary}</p>
                <small>{new Date(item.createdAt).toLocaleString('cs-CZ')}</small>
                <div className="activity-item-actions">
                  {item.readAt == null ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onMarkRead(item.id)}
                      disabled={loading || actionPending}
                    >
                      Přečteno
                    </button>
                  ) : null}
                  {item.archivedAt == null ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onArchive(item.id)}
                      disabled={loading || actionPending}
                    >
                      Archivovat
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onUnarchive(item.id)}
                      disabled={loading || actionPending}
                    >
                      Vrátit z archivu
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => onDelete(item.id)}
                    disabled={loading || actionPending}
                  >
                    Smazat
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => onShare(item)}
                    disabled={loading || actionPending}
                  >
                    Sdílet
                  </button>
                  {canOpenBattleReport ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onOpenBattleReport(maybeReportId)}
                      disabled={loading || actionPending}
                    >
                      Otevřít report
                    </button>
                  ) : null}
                </div>
              </li>
            );
            })}
            {visibleItems.length === 0 && !loading ? <li>Žádné záznamy pro zvolený filtr.</li> : null}
          </ul>
        </div>
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
  onTransferLeadership,
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
  onTransferLeadership: (targetUsername: string) => void;
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
      'Opravdu chceš odejít z království? Budeš přepnutý do neutrálního stavu.',
    );
    if (!confirmed) {
      return;
    }
    onLeaveKingdom();
  };

  const handleKickClick = (targetUsername: string) => {
    const confirmed = window.confirm(
      `Opravdu chceš vyhodit hráče ${targetUsername} z království?`,
    );
    if (!confirmed) {
      return;
    }
    onKickMember(targetUsername);
  };

  const handleTransferLeadershipClick = (targetUsername: string) => {
    const confirmed = window.confirm(
      `Opravdu chceš předat titul Krále hráči ${targetUsername}?`,
    );
    if (!confirmed) {
      return;
    }
    onTransferLeadership(targetUsername);
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
          <li>Král: {kingdomHub.leaderUsername ?? 'Neznámý'}</li>
          <li>Počet členů: {members.length}</li>
          <li>Počet osad: {totalKingdomVillages}</li>
          <li>Celková prestiž: {totalKingdomPrestige.toLocaleString('cs-CZ')}</li>
        </ul>
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
              const canTransferLeadership = isKingdomLeader && !isSelf;
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
                    {member.isLeader ? <span className="row-help inline">👑 Král</span> : null}
                  </td>
                  <td>{member.prestige.toLocaleString('cs-CZ')}</td>
                  <td>{member.villages}</td>
                  <td>
                    {canTransferLeadership ? (
                      <button
                        type="button"
                        className="secondary-action kingdom-action-button"
                        onClick={() => handleTransferLeadershipClick(member.username)}
                        disabled={actionPending}
                      >
                        Předat titul Krále
                      </button>
                    ) : null}
                    {canKick ? (
                      <button
                        type="button"
                        className="secondary-action kingdom-action-button"
                        onClick={() => handleKickClick(member.username)}
                        disabled={actionPending}
                      >
                        Vyhodit
                      </button>
                    ) : null}
                    {!canTransferLeadership && !canKick ? <span className="row-help inline">-</span> : null}
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

      <section>
        <button
          type="button"
          className="danger-button kingdom-leave-button"
          onClick={handleLeaveClick}
          disabled={actionPending}
        >
          Odejít z kmene
        </button>
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
  const [lastPlayerMode, setLastPlayerMode] = useState<Exclude<RankingMode, 'kingdoms'>>('players');
  const [kingdomMetric, setKingdomMetric] = useState<KingdomRankingMetric>('prestige');
  const [pageSize, setPageSize] = useState<RankingPageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const rankingScope: 'players' | 'kingdoms' = mode === 'kingdoms' ? 'kingdoms' : 'players';

  const selectPlayerMode = useCallback((nextMode: Exclude<RankingMode, 'kingdoms'>) => {
    setLastPlayerMode(nextMode);
    setMode(nextMode);
    setCurrentPage(1);
  }, []);

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
        attackScore: 0,
        defenseScore: 0,
        supportScore: 0,
      };

      existing.prestige += player.prestige;
      existing.villages += player.villages;
      existing.members += 1;
      existing.attackScore += Number(player.attackerScore ?? 0);
      existing.defenseScore += Number(player.defenderScore ?? 0);
      existing.supportScore += Number(player.supporterScore ?? 0);
      byKingdom.set(player.kingdom, existing);
    }

    const resolveKingdomMetricValue = (entry: Omit<KingdomLeaderboardRow, 'rank'>): number => {
      if (kingdomMetric === 'attack') {
        return entry.attackScore;
      }
      if (kingdomMetric === 'defense') {
        return entry.defenseScore;
      }
      if (kingdomMetric === 'support') {
        return entry.supportScore;
      }
      return entry.prestige;
    };

    return [...byKingdom.values()]
      .sort((a, b) => {
        const metricDiff = resolveKingdomMetricValue(b) - resolveKingdomMetricValue(a);
        if (metricDiff !== 0) {
          return metricDiff;
        }
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
        attackScore: item.attackScore,
        defenseScore: item.defenseScore,
        supportScore: item.supportScore,
      }));
  }, [kingdomMetric, rows]);

  const combatRowsByMode = useMemo(() => {
    const buildRows = (
      targetMode: CombatRankingMode,
      resolveScore: (entry: LeaderboardRow) => number,
    ): CombatLeaderboardRow[] =>
      [...rows]
        .sort((left, right) => {
          const scoreDiff = resolveScore(right) - resolveScore(left);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }
          if (right.prestige !== left.prestige) {
            return right.prestige - left.prestige;
          }
          if (right.villages !== left.villages) {
            return right.villages - left.villages;
          }
          return left.username.localeCompare(right.username, 'cs');
        })
        .map((entry, index) => ({
          rank: index + 1,
          playerId: entry.playerId,
          username: entry.username,
          kingdom: entry.kingdom,
          villages: entry.villages,
          prestige: entry.prestige,
          score: resolveScore(entry),
          mode: targetMode,
        }));

    return {
      attacker: buildRows('attacker', (entry) => Number(entry.attackerScore ?? 0)),
      defender: buildRows('defender', (entry) => Number(entry.defenderScore ?? 0)),
      supporter: buildRows('supporter', (entry) => Number(entry.supporterScore ?? 0)),
    };
  }, [rows]);

  const activeRows =
    mode === 'players'
      ? rows
      : mode === 'kingdoms'
        ? kingdomRows
        : mode === 'attacker'
          ? combatRowsByMode.attacker
          : mode === 'defender'
            ? combatRowsByMode.defender
            : combatRowsByMode.supporter;
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
    if (mode === 'kingdoms') {
      if (isNeutralKingdom(currentKingdom)) {
        return -1;
      }
      return kingdomRows.findIndex((entry) => entry.kingdom === currentKingdom);
    }
    const combatRows =
      mode === 'attacker'
        ? combatRowsByMode.attacker
        : mode === 'defender'
          ? combatRowsByMode.defender
          : combatRowsByMode.supporter;
    return combatRows.findIndex((entry) => entry.username === currentUsername);
  }, [mode, rows, currentUsername, currentKingdom, kingdomRows, combatRowsByMode]);

  const currentPlayerRow = useMemo(
    () => rows.find((entry) => entry.username === currentUsername) ?? null,
    [rows, currentUsername],
  );
  const currentCombatRow = useMemo(() => {
    if (mode === 'attacker') {
      return combatRowsByMode.attacker.find((entry) => entry.username === currentUsername) ?? null;
    }
    if (mode === 'defender') {
      return combatRowsByMode.defender.find((entry) => entry.username === currentUsername) ?? null;
    }
    if (mode === 'supporter') {
      return combatRowsByMode.supporter.find((entry) => entry.username === currentUsername) ?? null;
    }
    return null;
  }, [mode, combatRowsByMode, currentUsername]);
  const currentKingdomRow = useMemo(() => {
    if (isNeutralKingdom(currentKingdom)) {
      return null;
    }
    return kingdomRows.find((entry) => entry.kingdom === currentKingdom) ?? null;
  }, [currentKingdom, kingdomRows]);

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

  const bestButtonLabel =
    mode === 'players'
      ? 'Top hráč'
      : mode === 'kingdoms'
        ? 'Top království'
        : mode === 'attacker'
          ? 'Top útočník'
          : mode === 'defender'
            ? 'Top obránce'
            : 'Top podporovatel';
  const centerButtonLabel = 'Vycentruj mě';
  const currentPlacementLabel =
    mode === 'players'
      ? currentPlayerRow?.rank != null
        ? `#${currentPlayerRow.rank}`
        : 'N/A'
      : mode === 'kingdoms'
        ? currentKingdomRow?.rank != null
          ? `#${currentKingdomRow.rank}`
          : 'N/A'
        : currentCombatRow?.rank != null
          ? `#${currentCombatRow.rank}`
          : 'N/A';
  const currentPlacementSuffix =
    mode === 'players'
      ? 'v pořadí hráčů'
      : mode === 'kingdoms'
        ? 'v pořadí království'
        : mode === 'attacker'
          ? 'v pořadí útočníků'
          : mode === 'defender'
            ? 'v pořadí obránců'
            : 'v pořadí podporovatelů';
  const summaryNoun =
    mode === 'players'
      ? 'hráčů'
      : mode === 'kingdoms'
        ? 'království'
        : mode === 'attacker'
          ? 'útočníků'
          : mode === 'defender'
            ? 'obránců'
            : 'podporovatelů';
  const combatScoreColumnLabel = mode === 'supporter' ? 'Padlé jednotky' : 'Zabitých jednotek';
  const kingdomMetricLabel =
    kingdomMetric === 'attack'
      ? 'Útočník'
      : kingdomMetric === 'defense'
        ? 'Obránce'
        : kingdomMetric === 'support'
          ? 'Podporovatel'
          : 'Prestiž';
  const resolveKingdomMetricDisplayValue = (row: KingdomLeaderboardRow): number => {
    if (kingdomMetric === 'attack') {
      return row.attackScore;
    }
    if (kingdomMetric === 'defense') {
      return row.defenseScore;
    }
    if (kingdomMetric === 'support') {
      return row.supportScore;
    }
    return row.prestige;
  };

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
        <h3>Válečný žebříček Dominionu</h3>

        <div className="ranking-toolbar">
          <div className="ranking-mode-switch">
            <button
              className={rankingScope === 'players' ? 'is-active' : ''}
              onClick={() => {
                setMode(lastPlayerMode);
                setCurrentPage(1);
              }}
            >
              Hráči
            </button>
            <button
              className={rankingScope === 'kingdoms' ? 'is-active' : ''}
              onClick={() => {
                setMode('kingdoms');
                setCurrentPage(1);
              }}
            >
              Království
            </button>
          </div>

          {rankingScope === 'players' ? (
            <div className="ranking-mode-switch ranking-submode-switch">
              <button
                className={mode === 'players' ? 'is-active' : ''}
                onClick={() => selectPlayerMode('players')}
              >
                Prestiž
              </button>
              <button
                className={mode === 'attacker' ? 'is-active' : ''}
                onClick={() => selectPlayerMode('attacker')}
              >
                Útočník
              </button>
              <button
                className={mode === 'defender' ? 'is-active' : ''}
                onClick={() => selectPlayerMode('defender')}
              >
                Obránce
              </button>
              <button
                className={mode === 'supporter' ? 'is-active' : ''}
                onClick={() => selectPlayerMode('supporter')}
              >
                Podporovatel
              </button>
            </div>
          ) : (
            <div className="ranking-mode-switch ranking-kingdom-metric-switch">
              <button
                className={kingdomMetric === 'prestige' ? 'is-active' : ''}
                onClick={() => {
                  setKingdomMetric('prestige');
                  setCurrentPage(1);
                }}
              >
                Prestiž
              </button>
              <button
                className={kingdomMetric === 'attack' ? 'is-active' : ''}
                onClick={() => {
                  setKingdomMetric('attack');
                  setCurrentPage(1);
                }}
              >
                Útočník
              </button>
              <button
                className={kingdomMetric === 'defense' ? 'is-active' : ''}
                onClick={() => {
                  setKingdomMetric('defense');
                  setCurrentPage(1);
                }}
              >
                Obránce
              </button>
              <button
                className={kingdomMetric === 'support' ? 'is-active' : ''}
                onClick={() => {
                  setKingdomMetric('support');
                  setCurrentPage(1);
                }}
              >
                Podporovatel
              </button>
            </div>
          )}

          <span className="ranking-summary-inline">
            Zobrazeno {visibleFrom}-{visibleTo} z {totalRows} {summaryNoun}.
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
            ) : mode === 'kingdoms' ? (
              <tr>
                <th>#</th>
                <th>Království</th>
                <th>{kingdomMetricLabel}</th>
                <th>Osady</th>
                <th>Členové</th>
              </tr>
            ) : (
              <tr>
                <th>#</th>
                <th>Hráč</th>
                <th>Království</th>
                <th>{combatScoreColumnLabel}</th>
                <th>Prestiž</th>
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
              : mode === 'kingdoms'
                ? pageRows.map((item) => {
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
                      <td>{resolveKingdomMetricDisplayValue(kingdomRow).toLocaleString('cs-CZ')}</td>
                      <td>{kingdomRow.villages}</td>
                      <td>{kingdomRow.members}</td>
                    </tr>
                  );
                })
                : pageRows.map((item) => {
                  const combatRow = item as CombatLeaderboardRow;
                  const isSelf = combatRow.username === currentUsername;
                  return (
                    <tr key={`${combatRow.mode}-${combatRow.playerId}`} className={isSelf ? 'is-self' : ''}>
                      <td>{combatRow.rank}</td>
                      <td>
                        <button
                          className="ranking-link-button"
                          onClick={() => onOpenPlayerProfile(combatRow.username)}
                        >
                          {combatRow.username}
                        </button>
                      </td>
                      <td>
                        <button
                          className="ranking-link-button"
                          onClick={() => onOpenKingdomProfile(combatRow.kingdom)}
                        >
                          {combatRow.kingdom}
                        </button>
                      </td>
                      <td>{combatRow.score.toLocaleString('cs-CZ')}</td>
                      <td>{combatRow.prestige.toLocaleString('cs-CZ')}</td>
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
        <p className="ranking-player-position-note ranking-player-position-epic">
          <span>Tvé umístění je</span> <strong>{currentPlacementLabel}</strong> <span>{currentPlacementSuffix}</span>.
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
  const totalAttackScore = members.reduce((sum, member) => sum + Number(member.attackerScore ?? 0), 0);
  const totalDefenseScore = members.reduce((sum, member) => sum + Number(member.defenderScore ?? 0), 0);
  const totalSupportScore = members.reduce((sum, member) => sum + Number(member.supporterScore ?? 0), 0);
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
          <li>Válečné skóre útoku: {totalAttackScore.toLocaleString('cs-CZ')}</li>
          <li>Válečné skóre obrany: {totalDefenseScore.toLocaleString('cs-CZ')}</li>
          <li>Válečné skóre podpory: {totalSupportScore.toLocaleString('cs-CZ')}</li>
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
                  <th>Útočník</th>
                  <th>Obránce</th>
                  <th>Podporovatel</th>
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
                    <td>{Number(member.attackerScore ?? 0).toLocaleString('cs-CZ')}</td>
                    <td>{Number(member.defenderScore ?? 0).toLocaleString('cs-CZ')}</td>
                    <td>{Number(member.supporterScore ?? 0).toLocaleString('cs-CZ')}</td>
                  </tr>
                ))}
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Království zatím nemá žádné členy.</td>
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
  viewerUsername,
  username,
  avatarUrl,
  rows,
  settlements,
  onOpenSettlement,
  onOpenKingdomProfile,
  onMessagePlayer,
  onSendFriendRequest,
}: {
  viewerUsername: string;
  username: string;
  avatarUrl: string | null;
  rows: LeaderboardRow[];
  settlements: RegionSettlement[];
  onOpenSettlement: (settlement: RegionSettlement) => void;
  onOpenKingdomProfile: (kingdomName: string) => void;
  onMessagePlayer: (username: string) => void;
  onSendFriendRequest: (targetUsername: string) => Promise<string | null>;
}) => {
  const [friendRequestPending, setFriendRequestPending] = useState(false);
  const [friendRequestNotice, setFriendRequestNotice] = useState<string | null>(null);
  const playerRow = useMemo(() => rows.find((row) => row.username === username) ?? null, [rows, username]);
  const villages = useMemo(
    () =>
      settlements
        .filter((settlement) => settlement.owner === username)
        .sort((a, b) => b.prestige - a.prestige),
    [settlements, username],
  );
  const protectedVillages = useMemo(
    () => villages.filter((village) => Math.max(0, Number(village.protectionRemainingSec ?? 0)) > 0),
    [villages],
  );
  const maxProtectionRemainingSec = useMemo(
    () =>
      protectedVillages.reduce(
        (max, village) => Math.max(max, Math.max(0, Number(village.protectionRemainingSec ?? 0))),
        0,
      ),
    [protectedVillages],
  );
  const isSelfProfile = viewerUsername.toLocaleLowerCase('cs-CZ') === username.toLocaleLowerCase('cs-CZ');
  const kingdomName = String(playerRow?.kingdom ?? '').trim();
  const attackerScore = Number(playerRow?.attackerScore ?? 0);
  const defenderScore = Number(playerRow?.defenderScore ?? 0);
  const supporterScore = Number(playerRow?.supporterScore ?? 0);
  const attackerRankLabel = playerRow?.attackerRank ? `#${playerRow.attackerRank}` : 'N/A';
  const defenderRankLabel = playerRow?.defenderRank ? `#${playerRow.defenderRank}` : 'N/A';
  const supporterRankLabel = playerRow?.supporterRank ? `#${playerRow.supporterRank}` : 'N/A';

  const handleSendFriendRequest = useCallback(async () => {
    if (isSelfProfile || friendRequestPending) {
      return;
    }
    setFriendRequestPending(true);
    setFriendRequestNotice(null);
    try {
      const errorMessage = await onSendFriendRequest(username);
      if (errorMessage) {
        setFriendRequestNotice(errorMessage);
      } else {
        setFriendRequestNotice(`Hráči ${username} byla odeslána žádost o přátelství.`);
      }
    } catch {
      setFriendRequestNotice('Žádost o přátelství se nepodařilo odeslat.');
    } finally {
      setFriendRequestPending(false);
    }
  }, [friendRequestPending, isSelfProfile, onSendFriendRequest, username]);

  return (
    <div className="panel-stack player-profile-panel">
      <section className="player-profile-hero-card">
        <div className="player-profile-header">
          <div className="player-profile-avatar-frame" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" /> : <span>{username.slice(0, 1)}</span>}
          </div>
          <div className="player-profile-header-main">
            <h3 className="player-profile-name">{username}</h3>
            <p className="player-profile-subline">
              {kingdomName ? (
                <button
                  type="button"
                  className="ranking-link-button player-profile-kingdom-pill player-profile-kingdom-link"
                  onClick={() => onOpenKingdomProfile(kingdomName)}
                >
                  {kingdomName}
                </button>
              ) : (
                <span className="player-profile-kingdom-pill">Neznámé království</span>
              )}
              <span>{playerRow?.villages ?? villages.length} lén v regionu</span>
            </p>
          </div>
          <div className="player-profile-header-actions">
            <button
              type="button"
              className="secondary-action player-profile-message-button"
              onClick={() => onMessagePlayer(username)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75zm2.2.75 6.8 5.1L18.8 6zm13.8 1.5-6.55 4.92a.75.75 0 0 1-.9 0L5 7.5v11.25a.75.75 0 0 0 .75.75h13.5a.75.75 0 0 0 .75-.75z" />
              </svg>
              Odeslat zprávu
            </button>
            <button
              type="button"
              className="secondary-action player-profile-friend-button"
              onClick={() => {
                void handleSendFriendRequest();
              }}
              disabled={friendRequestPending || isSelfProfile}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8m0 2c-3.314 0-6 1.79-6 4v1h10.5c-.322-.59-.5-1.268-.5-2 0-1.13.425-2.16 1.122-2.94A10.25 10.25 0 0 0 9 13m10 1h-2v-2h-2v2h-2v2h2v2h2v-2h2z" />
              </svg>
              Přidat do přátel
            </button>
          </div>
        </div>
        {friendRequestNotice ? <p className="player-profile-action-notice">{friendRequestNotice}</p> : null}
        <div className="player-profile-main-stats">
          <article className="player-profile-stat-card player-profile-stat-card-main">
            <span>Globální pořadí</span>
            <strong>{playerRow ? `#${playerRow.rank}` : 'N/A'}</strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-main">
            <span>Prestiž</span>
            <strong>{(playerRow?.prestige ?? 0).toLocaleString('cs-CZ')}</strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-main">
            <span>Léna</span>
            <strong>{playerRow?.villages ?? villages.length}</strong>
          </article>
        </div>
        <div className="player-profile-combat-stats">
          <article className="player-profile-stat-card player-profile-stat-card-compact">
            <span>Útočník</span>
            <strong>{`${attackerRankLabel} (${attackerScore.toLocaleString('cs-CZ')} zabitých)`}</strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-compact">
            <span>Obránce</span>
            <strong>{`${defenderRankLabel} (${defenderScore.toLocaleString('cs-CZ')} zabitých)`}</strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-compact">
            <span>Podporovatel</span>
            <strong>{`${supporterRankLabel} (${supporterScore.toLocaleString('cs-CZ')} zabitých)`}</strong>
          </article>
        </div>
        <p className="player-profile-protection-strip">
          Nováčkovská ochrana:{' '}
          {protectedVillages.length > 0
            ? `${protectedVillages.length} lén · max ${formatDurationLabel(maxProtectionRemainingSec)}`
            : 'neaktivní'}
        </p>
      </section>
      <section className="player-profile-settlements">
        <div className="player-profile-section-head">
          <h3>Seznam lén hráče</h3>
          <p>Regionální rozložení síly</p>
        </div>
        <table className="player-profile-table">
          <thead>
            <tr>
              <th>Léno</th>
              <th>Souřadnice</th>
              <th>Prestiž</th>
              <th>Ochrana</th>
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
                  {Math.max(0, Number(village.protectionRemainingSec ?? 0)) > 0
                    ? formatDurationLabel(Math.max(0, Number(village.protectionRemainingSec ?? 0)))
                    : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    className="ranking-link-button player-profile-open-village"
                    onClick={() => onOpenSettlement(village)}
                  >
                    Otevřít
                  </button>
                </td>
              </tr>
            ))}
            {villages.length === 0 ? (
              <tr>
                <td colSpan={5}>V tomto regionu nejsou viditelná žádná léna hráče.</td>
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
  attackerRank,
  defenderRank,
  supporterRank,
}: {
  username: string;
  kingdom: string;
  prestige: number;
  villageCount: number;
  rank: number | null;
  attackerRank: number | null;
  defenderRank: number | null;
  supporterRank: number | null;
}) => (
  <div className="panel-stack player-profile-panel">
    <section className="player-profile-hero-card">
      <div className="player-profile-header">
        <div className="player-profile-avatar-frame" aria-hidden="true">
          <span>{username.slice(0, 1)}</span>
        </div>
        <div className="player-profile-header-main">
          <h3 className="player-profile-name">Profil</h3>
          <p className="player-profile-subline">
            <span className="player-profile-kingdom-pill">{kingdom || 'Bez království'}</span>
            <span>{villageCount.toLocaleString('cs-CZ')} měst</span>
          </p>
        </div>
      </div>

      <div className="player-profile-main-stats">
        <article className="player-profile-stat-card player-profile-stat-card-main">
          <span>Velitel</span>
          <strong>{username}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-main">
          <span>Globální pořadí</span>
          <strong>{rank ? `#${rank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-main">
          <span>Prestiž</span>
          <strong>{prestige.toLocaleString('cs-CZ')}</strong>
        </article>
      </div>

      <div className="player-profile-combat-stats">
        <article className="player-profile-stat-card player-profile-stat-card-compact">
          <span>Útočník</span>
          <strong>{attackerRank ? `#${attackerRank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-compact">
          <span>Obránce</span>
          <strong>{defenderRank ? `#${defenderRank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-compact">
          <span>Podporovatel</span>
          <strong>{supporterRank ? `#${supporterRank}` : 'N/A'}</strong>
        </article>
      </div>

      <p className="player-profile-protection-strip">Poslední aktivita: ekonomický tick backendu</p>
    </section>
  </div>
);

const SettingsPanel = ({
  username,
  avatarUrl,
  avatarPending,
  onSaveAvatar,
  onRestartVillageProgress,
  fontScaleOption,
  isFontScaleDirty,
  onFontScaleChange,
  onSaveFontScale,
  restartPending,
  notice,
  shortcutBindings,
  customShortcutBindings,
  autoHidePinColumns,
  shortcutNotice,
  isTouchDevice,
  onCaptureShortcut,
  onResetShortcutBinding,
  onResetAllShortcuts,
  onAutoHidePinColumnsChange,
}: {
  username: string;
  avatarUrl: string | null;
  avatarPending: boolean;
  onSaveAvatar: (nextAvatarUrl: string | null) => Promise<string>;
  onRestartVillageProgress: () => void;
  fontScaleOption: GameFontScaleOption;
  isFontScaleDirty: boolean;
  onFontScaleChange: (option: GameFontScaleOption) => void;
  onSaveFontScale: () => void;
  restartPending: boolean;
  notice: string | null;
  shortcutBindings: Record<ShortcutActionId, ShortcutBinding>;
  customShortcutBindings: Partial<Record<ShortcutActionId, ShortcutBinding>>;
  autoHidePinColumns: boolean;
  shortcutNotice: string | null;
  isTouchDevice: boolean;
  onCaptureShortcut: (actionId: ShortcutActionId, binding: ShortcutBinding) => void;
  onResetShortcutBinding: (actionId: ShortcutActionId) => void;
  onResetAllShortcuts: () => void;
  onAutoHidePinColumnsChange: (enabled: boolean) => void;
}) => {
  const [settingsTab, setSettingsTab] = useState<'account' | 'interface' | 'shortcuts' | 'world'>('account');
  const [avatarSource, setAvatarSource] = useState<AvatarCropSource | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(AVATAR_ZOOM_MIN);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const holdPinColumnsShortcutLabel = formatShortcutBindingLabel(shortcutBindings.peekPinColumnsWhileHeld);

  const avatarMetrics = useMemo(
    () => computeAvatarCropMetrics(avatarSource, avatarZoom),
    [avatarSource, avatarZoom],
  );
  const clampedAvatarOffsets = useMemo(
    () => clampAvatarOffset(avatarSource, avatarZoom, avatarOffsetX, avatarOffsetY),
    [avatarOffsetX, avatarOffsetY, avatarSource, avatarZoom],
  );
  const avatarDraftDataUrl = useMemo(
    () =>
      buildCroppedAvatarDataUrl(
        avatarSource,
        avatarZoom,
        clampedAvatarOffsets.offsetX,
        clampedAvatarOffsets.offsetY,
      ),
    [avatarSource, avatarZoom, clampedAvatarOffsets.offsetX, clampedAvatarOffsets.offsetY],
  );

  const handleAvatarFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const file = target.files?.[0] ?? null;
    target.value = '';
    if (!file) {
      return;
    }

    const normalizedType = String(file.type ?? '').toLocaleLowerCase('cs-CZ');
    if (!normalizedType.startsWith('image/')) {
      setAvatarError('Nahraj prosim pouze obrazek (png/jpg/jpeg/webp).');
      return;
    }
    if (file.size > AVATAR_MAX_UPLOAD_BYTES) {
      setAvatarError('Obrazek je moc velky. Maximalni velikost je 5 MB.');
      return;
    }

    try {
      const source = await readAvatarFileAsSource(file);
      setAvatarSource(source);
      setAvatarZoom(AVATAR_ZOOM_MIN);
      setAvatarOffsetX(0);
      setAvatarOffsetY(0);
      setAvatarError(null);
      setAvatarNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Avatar se nepodarilo nacist.';
      setAvatarError(message);
    }
  }, []);

  const handleSaveAvatar = useCallback(async () => {
    const nextAvatarUrl = avatarDraftDataUrl ?? avatarUrl;
    if (!nextAvatarUrl) {
      setAvatarError('Nejprve nahraj obrazek pro avatar.');
      return;
    }
    const encodedPayload = nextAvatarUrl.split(',', 2)[1] ?? '';
    const approxBytes = Math.floor((encodedPayload.length * 3) / 4);
    if (nextAvatarUrl.startsWith('data:image/') && approxBytes > AVATAR_OUTPUT_MAX_BYTES) {
      setAvatarError('Avatar je prilis velky. Zkus mensi zoom nebo jednodussi orez.');
      return;
    }
    setAvatarError(null);
    const message = await onSaveAvatar(nextAvatarUrl);
    setAvatarNotice(message);
    setAvatarSource(null);
    setAvatarZoom(AVATAR_ZOOM_MIN);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  }, [avatarDraftDataUrl, avatarUrl, onSaveAvatar]);

  const handleRemoveAvatar = useCallback(async () => {
    setAvatarError(null);
    const message = await onSaveAvatar(null);
    setAvatarNotice(message);
    setAvatarSource(null);
    setAvatarZoom(AVATAR_ZOOM_MIN);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  }, [onSaveAvatar]);

  const hasAvatarDraft = avatarDraftDataUrl != null && avatarDraftDataUrl.length > 0;
  const avatarPreviewStyle: CSSProperties | undefined =
    avatarSource && avatarMetrics
      ? {
          width: `${avatarSource.width * avatarMetrics.baseScale}px`,
          height: `${avatarSource.height * avatarMetrics.baseScale}px`,
          transform: `translate(${clampedAvatarOffsets.offsetX}px, ${clampedAvatarOffsets.offsetY}px) scale(${avatarZoom})`,
          transformOrigin: 'center center',
        }
      : undefined;
  const horizontalOffsetLimit = avatarMetrics?.maxOffsetX ?? 0;
  const verticalOffsetLimit = avatarMetrics?.maxOffsetY ?? 0;

  return (
    <div className="panel-stack settings-panel">
      <section className="settings-tab-row">
        <button
          type="button"
          className={`secondary-action ${settingsTab === 'account' ? 'is-active' : ''}`}
          onClick={() => setSettingsTab('account')}
        >
          Avatar
        </button>
        <button
          type="button"
          className={`secondary-action ${settingsTab === 'interface' ? 'is-active' : ''}`}
          onClick={() => setSettingsTab('interface')}
        >
          Rozhraní hry
        </button>
        <button
          type="button"
          className={`secondary-action ${settingsTab === 'shortcuts' ? 'is-active' : ''}`}
          onClick={() => setSettingsTab('shortcuts')}
        >
          Klávesové zkratky
        </button>
        <button
          type="button"
          className={`secondary-action ${settingsTab === 'world' ? 'is-active' : ''}`}
          onClick={() => setSettingsTab('world')}
        >
          Svět
        </button>
      </section>

      {settingsTab === 'account' ? (
        <section>
          <h3>Avatar</h3>
          <p>Avatar se používá v profilu i v komunikaci. Výstupní velikost je max 300x300 px.</p>
          <div className="settings-avatar-row">
            <div className="settings-avatar-preview" aria-hidden="true">
              {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" /> : <span>{username.slice(0, 1)}</span>}
            </div>
            <div className="settings-avatar-input">
              <label>
                Nový avatar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarFileChange}
                  disabled={avatarPending}
                />
              </label>
              <small className="row-help">
                Podporované formáty: PNG, JPG, JPEG, WEBP. Vyber výřez, který se uloží jako 300x300 px.
              </small>
            </div>
          </div>
          {avatarSource ? (
            <div className="settings-avatar-crop-layout">
              <div className="settings-avatar-crop-frame" aria-label="Náhled ořezu avataru">
                <img src={avatarSource.dataUrl} alt="" style={avatarPreviewStyle} />
              </div>
              <div className="settings-avatar-crop-controls">
                <label>
                  Zoom
                  <input
                    type="range"
                    min={AVATAR_ZOOM_MIN}
                    max={AVATAR_ZOOM_MAX}
                    step={AVATAR_ZOOM_STEP}
                    value={avatarZoom}
                    onChange={(event) => {
                      const nextZoom = Number(event.target.value);
                      const safeZoom = clampAvatarValue(nextZoom, AVATAR_ZOOM_MIN, AVATAR_ZOOM_MAX);
                      const nextOffsets = clampAvatarOffset(avatarSource, safeZoom, avatarOffsetX, avatarOffsetY);
                      setAvatarZoom(safeZoom);
                      setAvatarOffsetX(nextOffsets.offsetX);
                      setAvatarOffsetY(nextOffsets.offsetY);
                    }}
                  />
                </label>
                <label>
                  Posun vodorovně
                  <input
                    type="range"
                    min={-horizontalOffsetLimit}
                    max={horizontalOffsetLimit}
                    step={1}
                    value={clampedAvatarOffsets.offsetX}
                    disabled={horizontalOffsetLimit <= 0}
                    onChange={(event) => {
                      const nextOffset = Number(event.target.value);
                      setAvatarOffsetX(nextOffset);
                    }}
                  />
                </label>
                <label>
                  Posun svisle
                  <input
                    type="range"
                    min={-verticalOffsetLimit}
                    max={verticalOffsetLimit}
                    step={1}
                    value={clampedAvatarOffsets.offsetY}
                    disabled={verticalOffsetLimit <= 0}
                    onChange={(event) => {
                      const nextOffset = Number(event.target.value);
                      setAvatarOffsetY(nextOffset);
                    }}
                  />
                </label>
              </div>
              <div className="settings-avatar-preview is-cropped-result" aria-hidden="true">
                {avatarDraftDataUrl ? <img src={avatarDraftDataUrl} alt="" loading="lazy" /> : <span>?</span>}
              </div>
            </div>
          ) : null}
          <div className="settings-avatar-actions">
            <button
              type="button"
              className="upgrade-action"
              onClick={() => {
                void handleSaveAvatar();
              }}
              disabled={avatarPending || !hasAvatarDraft}
            >
              {avatarPending ? 'Ukladam avatar...' : 'Ulozit avatar'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setAvatarSource(null);
                setAvatarZoom(AVATAR_ZOOM_MIN);
                setAvatarOffsetX(0);
                setAvatarOffsetY(0);
                setAvatarError(null);
              }}
              disabled={avatarPending || !avatarSource}
            >
              Zrusit orez
            </button>
            <button
              type="button"
              className="secondary-action danger-button"
              onClick={() => {
                void handleRemoveAvatar();
              }}
              disabled={avatarPending || !avatarUrl}
            >
              Odebrat avatar
            </button>
          </div>
          {avatarError ? <p className="panel-feedback">{avatarError}</p> : null}
          {avatarNotice ? <p className="panel-feedback">{avatarNotice}</p> : null}
          <div className="settings-password-box">
            <h4>Změna hesla</h4>
            <label>
              Aktuální heslo
              <input type="password" placeholder="Aktuální heslo" disabled />
            </label>
            <label>
              Nové heslo
              <input type="password" placeholder="Nové heslo" disabled />
            </label>
            <label>
              Potvrdit nové heslo
              <input type="password" placeholder="Potvrzení nového hesla" disabled />
            </label>
            <small className="row-help">
              Správa hesla bude doplněna na backendu. Pokud si aktuální heslo nepamatuješ, kontaktuj vývojáře na
              Discordu: <strong>Mmykron</strong>.
            </small>
          </div>
        </section>
      ) : null}

      {settingsTab === 'interface' ? (
        <section>
          <h3>Nastavení rozhraní hry</h3>
          <p>Velikost písma se aplikuje pouze ve hře a ukládá se pro tvůj účet.</p>
          <div className="settings-font-scale-options" role="radiogroup" aria-label="Velikost herního fontu">
            {GAME_FONT_SCALE_OPTIONS.map((option) => {
              const isActive = fontScaleOption === option.value;
              return (
                <label key={`font-scale-${option.value}`} className="settings-font-scale-option">
                  <input
                    type="radio"
                    name="game-font-scale"
                    value={option.value}
                    checked={isActive}
                    onChange={() => onFontScaleChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="upgrade-action settings-save-button"
            onClick={onSaveFontScale}
            disabled={!isFontScaleDirty}
          >
            Uložit velikost fontu
          </button>
        </section>
      ) : null}

      {settingsTab === 'shortcuts' ? (
        <section>
          <h3>Klávesové zkratky</h3>
          <p>
            Definuj vlastní zkratky. Výchozí kombinace jsou neměnné, vlastní mapování se ukládá lokálně pro tento
            účet.
          </p>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={autoHidePinColumns}
              onChange={(event) => onAutoHidePinColumnsChange(event.target.checked)}
            />
            <span>Chci mizející pin sloupce</span>
          </label>
          <small className="row-help">
            {autoHidePinColumns
              ? 'Mizející režim: sloupce jsou skryté a zobrazují se jen jako overlay po zkratce.'
              : 'Statický režim: sloupce jsou viditelné a zkratka je pouze dočasně skryje.'}
          </small>
          <small className="row-help">
            Nezávisle na režimu: stisknutím <strong>{holdPinColumnsShortcutLabel}</strong> přepneš overlay pin
            sloupců (zapnuto/vypnuto).
          </small>
          {isTouchDevice ? (
            <small className="row-help">
              Dotykové zařízení: klávesové zkratky jsou vypnuté, sloupce vyvoláš tlačítkem v herním GUI.
            </small>
          ) : null}
          <div className="settings-shortcuts-table-wrap">
            <table className="settings-shortcuts-table">
              <thead>
                <tr>
                  <th>Funkce</th>
                  <th>Defaultní zkratka</th>
                  <th>Vlastní zkratka</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUT_ACTIONS.map((action) => {
                  const defaultLabel = formatShortcutBindingLabel(DEFAULT_SHORTCUT_BINDINGS[action.id]);
                  const customBinding = customShortcutBindings[action.id];
                  const customLabel = customBinding
                    ? formatShortcutBindingLabel(customBinding)
                    : formatShortcutBindingLabel(shortcutBindings[action.id]);

                  return (
                    <tr key={`shortcut-row-${action.id}`}>
                      <td>{action.label}</td>
                      <td>
                        <code>{defaultLabel}</code>
                      </td>
                      <td>
                        <div className="settings-shortcut-capture-cell">
                          <input
                            type="text"
                            className="settings-shortcut-capture"
                            value={customLabel}
                            onKeyDown={(event) => {
                              event.preventDefault();
                              const captured = buildShortcutBindingFromKeyboardEvent(event.nativeEvent);
                              if (!captured) {
                                return;
                              }
                              onCaptureShortcut(action.id, captured);
                            }}
                            readOnly
                            placeholder="Stiskni kombinaci"
                            aria-label={`Nastavit zkratku: ${action.label}`}
                          />
                          <button
                            type="button"
                            className="secondary-action compact"
                            onClick={() => onResetShortcutBinding(action.id)}
                            disabled={!customBinding}
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="secondary-action" onClick={onResetAllShortcuts}>
            Obnovit všechny vlastní zkratky
          </button>
          {shortcutNotice ? <p className="panel-feedback">{shortcutNotice}</p> : null}
        </section>
      ) : null}

      {settingsTab === 'world' ? (
        <section>
          <h3>Svět</h3>
          <p>
            Začít znovu provede restart postupu ve světě: tvá léna se převedou na opuštěná a dostaneš nový
            start.
          </p>
          <button className="danger-button" onClick={onRestartVillageProgress} disabled={restartPending}>
            {restartPending ? 'Resetuji...' : 'Začít znovu'}
          </button>
          {notice ? <p className="panel-feedback">{notice}</p> : null}
        </section>
      ) : null}
    </div>
  );
};

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
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
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
    didDrag: boolean;
  } | null>(null);
  const panRafRef = useRef<number | null>(null);
  const panPendingRef = useRef<{ left: number; top: number } | null>(null);
  const wheelZoomRafRef = useRef<number | null>(null);
  const wheelZoomTargetRef = useRef<number | null>(null);
  const wheelAnchorRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const zoomPercentRef = useRef(zoomPercent);
  const dragSuppressClickUntilRef = useRef(0);
  const hoverClearTimeoutRef = useRef<number | null>(null);
  const [gridViewportState, setGridViewportState] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 0,
    clientHeight: 0,
  });

  const clearHoverTimeout = useCallback(() => {
    if (hoverClearTimeoutRef.current != null) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
  }, []);

  const scheduleHoveredSettlementClear = useCallback(
    (settlementId: string) => {
      clearHoverTimeout();
      hoverClearTimeoutRef.current = window.setTimeout(() => {
        hoverClearTimeoutRef.current = null;
        setHoveredId((previous) => (previous === settlementId ? null : previous));
      }, MAP_HOVER_CLEAR_DELAY_MS);
    },
    [clearHoverTimeout],
  );

  useEffect(
    () => () => {
      clearHoverTimeout();
    },
    [clearHoverTimeout],
  );

  useEffect(() => {
    zoomPercentRef.current = zoomPercent;
  }, [zoomPercent]);

  const toggleMapFullscreen = useCallback(async () => {
    const root = mapPanelRef.current;
    if (!root) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await root.requestFullscreen();
  }, []);
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

  const settlementsById = useMemo(() => {
    const map = new Map<string, RegionSettlement>();
    for (const settlement of settlements) {
      map.set(settlement.id, settlement);
    }
    return map;
  }, [settlements]);
  const normalizeKey = useCallback(
    (valueRaw: string): string => String(valueRaw ?? '').trim().toLocaleLowerCase('cs-CZ'),
    [],
  );
  const playerPrestigeByOwner = useMemo(() => {
    const totals = new Map<string, number>();
    for (const settlement of settlements) {
      if (getSettlementMapKind(settlement, activeVillageId) === 'abandoned') {
        continue;
      }
      const key = normalizeKey(settlement.owner);
      const nextTotal = Number(totals.get(key) ?? 0) + Math.max(0, Math.floor(Number(settlement.prestige ?? 0)));
      totals.set(key, nextTotal);
    }
    return totals;
  }, [activeVillageId, normalizeKey, settlements]);
  const kingdomPrestigeByName = useMemo(() => {
    const totals = new Map<string, number>();
    for (const settlement of settlements) {
      if (getSettlementMapKind(settlement, activeVillageId) === 'abandoned') {
        continue;
      }
      const key = normalizeKey(settlement.kingdom);
      const nextTotal = Number(totals.get(key) ?? 0) + Math.max(0, Math.floor(Number(settlement.prestige ?? 0)));
      totals.set(key, nextTotal);
    }
    return totals;
  }, [activeVillageId, normalizeKey, settlements]);

  const safeHoveredId = hoveredId && settlementsById.has(hoveredId) ? hoveredId : null;
  const safePinnedSettlementId =
    pinnedSettlementId && settlementsById.has(pinnedSettlementId) ? pinnedSettlementId : null;
  const hoveredSettlement = safeHoveredId ? settlementsById.get(safeHoveredId) ?? null : null;
  const pinnedSettlement = safePinnedSettlementId
    ? settlementsById.get(safePinnedSettlementId) ?? null
    : null;
  const resolveSettlementGridCoords = useCallback(
    (settlement: RegionSettlement): GridPosition => {
      const globalX = Number(settlement.globalX);
      const globalY = Number(settlement.globalY);
      if (Number.isFinite(globalX) && Number.isFinite(globalY)) {
        return {
          x: Math.round(globalX - Number(regionOriginX) + 1),
          y: Math.round(globalY - Number(regionOriginY) + 1),
        };
      }

      return {
        x: Math.round(Number(settlement.localX)),
        y: Math.round(Number(settlement.localY)),
      };
    },
    [regionOriginX, regionOriginY],
  );
  const mapDisplaySettlements = useMemo(() => {
    const occupiedCells = new Set<string>();
    const byCell = new Map<
      string,
      { settlement: RegionSettlement; localX: number; localY: number; score: number }
    >();
    const kindPriority: Record<MapSettlementKind, number> = {
      active: 8,
      own: 7,
      enemy: 6,
      opponent: 5,
      nap: 4,
      allied: 3,
      royal: 2,
      abandoned: 1,
    };

    const scoreSettlement = (settlement: RegionSettlement): number => {
      let score = 0;
      if (focusedSettlementId && settlement.id === focusedSettlementId) {
        score += 10000;
      }
      if (safePinnedSettlementId && settlement.id === safePinnedSettlementId) {
        score += 8000;
      }
      if (safeHoveredId && settlement.id === safeHoveredId) {
        score += 6000;
      }

      const mapKind = getSettlementMapKind(settlement, activeVillageId);
      score += kindPriority[mapKind] * 1000;

      if (settlement.villageId != null) {
        score += 100;
      }

      score += Math.max(0, Number(settlement.prestige ?? 0));
      return score;
    };

    for (const settlement of settlements) {
      const gridPosition = resolveSettlementGridCoords(settlement);
      const { x: localX, y: localY } = gridPosition;
      if (localX < 1 || localX > regionSize || localY < 1 || localY > regionSize) {
        continue;
      }

      const key = toGridCellKey(gridPosition);
      const candidateScore = scoreSettlement(settlement);
      if (!occupiedCells.has(key)) {
        occupiedCells.add(key);
        byCell.set(key, { settlement, localX, localY, score: candidateScore });
        continue;
      }

      const current = byCell.get(key);
      if (!current) {
        byCell.set(key, { settlement, localX, localY, score: candidateScore });
        continue;
      }

      if (candidateScore > current.score) {
        byCell.set(key, { settlement, localX, localY, score: candidateScore });
        continue;
      }
      if (candidateScore === current.score && settlement.id.localeCompare(current.settlement.id, 'cs') < 0) {
        byCell.set(key, { settlement, localX, localY, score: candidateScore });
      }
    }

    return Array.from(byCell.values()).map(({ settlement, localX, localY }) => ({
      settlement,
      localX,
      localY,
    }));
  }, [
    activeVillageId,
    focusedSettlementId,
    regionSize,
    resolveSettlementGridCoords,
    safeHoveredId,
    safePinnedSettlementId,
    settlements,
  ]);
  const mapDisplaySettlementById = useMemo(() => {
    const byId = new Map<string, { settlement: RegionSettlement; localX: number; localY: number }>();
    for (const entry of mapDisplaySettlements) {
      byId.set(entry.settlement.id, entry);
    }
    return byId;
  }, [mapDisplaySettlements]);
  const previewSettlement = pinnedSettlement ?? hoveredSettlement;
  const isPreviewPinned = pinnedSettlement != null;
  const previewSettlementCell = useMemo(() => {
    if (!previewSettlement) {
      return null;
    }

    const visibleEntry = mapDisplaySettlementById.get(previewSettlement.id);
    if (visibleEntry) {
      return visibleEntry;
    }

    const gridPosition = resolveSettlementGridCoords(previewSettlement);
    return { settlement: previewSettlement, localX: gridPosition.x, localY: gridPosition.y };
  }, [mapDisplaySettlementById, previewSettlement, resolveSettlementGridCoords]);
  const previewSettlementKind = previewSettlement
    ? getSettlementMapKind(previewSettlement, activeVillageId)
    : null;
  const previewTargetUnderProtection =
    previewSettlement != null && Math.max(0, Number(previewSettlement.protectionRemainingSec ?? 0)) > 0;
  const previewTargetPrestigeBlocked =
    previewSettlement != null && previewSettlement.prestigeAttackBlockedForViewer === true;
  const previewRetaliationUnlocked =
    previewSettlement != null && previewSettlement.retaliationUnlockedForViewer === true;
  const previewRetaliationUnlockedAtLabel =
    previewRetaliationUnlocked && previewSettlement?.retaliationUnlockedAt
      ? formatDateTimeLabel(previewSettlement.retaliationUnlockedAt)
      : null;
  const isPreviewAbandoned = previewSettlementKind === 'abandoned';
  const isPreviewPlayerSettlement =
    previewSettlementKind === 'opponent' ||
    previewSettlementKind === 'enemy' ||
    previewSettlementKind === 'nap';
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
  const cellSize = Math.max(8, Math.round(REGION_CELL_SIZE * zoomScale));
  const mapCellGapPx = MAP_CELL_GAP_PX;
  const mapGridSizePx = regionSize * cellSize + Math.max(0, regionSize - 1) * mapCellGapPx;
  const resolveCellAnchorPx = useCallback(
    (localX: number, localY: number): { x: number; y: number } => ({
      x: toGridPixelPosition({ x: localX, y: localY }, cellSize, mapCellGapPx).left + cellSize / 2,
      y: toGridPixelPosition({ x: localX, y: localY }, cellSize, mapCellGapPx).top + cellSize / 2,
    }),
    [cellSize, mapCellGapPx],
  );

  const distanceOriginSettlement = useMemo(() => {
    if (activeVillageId != null) {
      const activeVillage = settlements.find(
        (settlement) => settlement.villageId != null && Number(settlement.villageId) === Number(activeVillageId),
      );
      if (activeVillage) {
        return activeVillage;
      }
    }

    return settlements.find((settlement) => settlement.kind === 'own' || settlement.relation === 'self') ?? null;
  }, [activeVillageId, settlements]);

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
  const previewPrestigeTier = previewSettlement
    ? resolveSettlementPrestigeTier(Number(previewSettlement.prestige ?? 0))
    : null;
  const previewPrestigeMeta = previewSettlement
    ? resolveSettlementPrestigeMeta(Number(previewSettlement.prestige ?? 0))
    : null;
  const previewPlayerTotalPrestige = useMemo(() => {
    if (!previewSettlement) {
      return null;
    }
    const key = normalizeKey(previewSettlement.owner);
    return Math.max(
      Math.floor(Number(previewSettlement.prestige ?? 0)),
      Math.floor(Number(playerPrestigeByOwner.get(key) ?? previewSettlement.prestige ?? 0)),
    );
  }, [normalizeKey, playerPrestigeByOwner, previewSettlement]);
  const previewKingdomTotalPrestige = useMemo(() => {
    if (!previewSettlement) {
      return null;
    }
    const key = normalizeKey(previewSettlement.kingdom);
    return Math.max(
      Math.floor(Number(previewSettlement.prestige ?? 0)),
      Math.floor(Number(kingdomPrestigeByName.get(key) ?? previewSettlement.prestige ?? 0)),
    );
  }, [kingdomPrestigeByName, normalizeKey, previewSettlement]);
  const previewTravelRows = useMemo(() => {
    if (previewDistanceTiles == null) {
      return [];
    }
    return COMMAND_UNIT_ORDER.map((unitId) => {
      const attackDurationSec = resolveUnitTravelDurationSec(unitId, previewDistanceTiles);
      const supportDurationSec =
        unitId === 'caravan'
          ? null
          : resolveUnitTravelDurationSec(unitId, previewDistanceTiles);
      return {
        unitId,
        attackDurationSec,
        supportDurationSec,
      };
    });
  }, [previewDistanceTiles]);

  const previewCardStyle = useMemo<CSSProperties | null>(() => {
    if (!previewSettlementCell) {
      return null;
    }
    const { x: anchorX, y: anchorY } = resolveCellAnchorPx(previewSettlementCell.localX, previewSettlementCell.localY);
    const viewportWidth = Math.max(1, gridViewportState.clientWidth || mapGridSizePx);
    const viewportHeight = Math.max(1, gridViewportState.clientHeight || mapGridSizePx);
    const visibleLeftMin = gridViewportState.scrollLeft + MAP_PREVIEW_CARD_SAFE_EDGE_PX;
    const visibleTopMin = gridViewportState.scrollTop + MAP_PREVIEW_CARD_SAFE_TOP_PX;
    const cardWidth = Math.min(MAP_PREVIEW_CARD_WIDTH_PX, Math.max(168, viewportWidth - MAP_PREVIEW_CARD_SAFE_EDGE_PX * 2));
    const cardHeight = isPreviewPinned ? MAP_PREVIEW_CARD_PINNED_HEIGHT_PX : MAP_PREVIEW_CARD_HOVER_HEIGHT_PX;
    const preferLeft = previewSettlementCell.localX > regionSize - 4;
    const preferBelow = previewSettlementCell.localY <= 4;

    const preferredLeft = preferLeft
      ? anchorX - MAP_PREVIEW_CARD_OFFSET_PX - cardWidth
      : anchorX + MAP_PREVIEW_CARD_OFFSET_PX;
    const preferredTop = preferBelow
      ? anchorY + MAP_PREVIEW_CARD_OFFSET_PX
      : anchorY - MAP_PREVIEW_CARD_OFFSET_PX - cardHeight;
    const globalMaxLeft = Math.max(
      MAP_PREVIEW_CARD_SAFE_EDGE_PX,
      mapGridSizePx - cardWidth - MAP_PREVIEW_CARD_SAFE_EDGE_PX,
    );
    const globalMaxTop = Math.max(
      MAP_PREVIEW_CARD_SAFE_TOP_PX,
      mapGridSizePx - cardHeight - MAP_PREVIEW_CARD_SAFE_EDGE_PX,
    );
    const viewportMaxLeft = gridViewportState.scrollLeft + viewportWidth - cardWidth - MAP_PREVIEW_CARD_SAFE_EDGE_PX;
    const viewportMaxTop = gridViewportState.scrollTop + viewportHeight - cardHeight - MAP_PREVIEW_CARD_SAFE_EDGE_PX;
    const minLeft = Math.max(MAP_PREVIEW_CARD_SAFE_EDGE_PX, visibleLeftMin);
    const minTop = Math.max(MAP_PREVIEW_CARD_SAFE_TOP_PX, visibleTopMin);
    const maxLeft = Math.min(globalMaxLeft, viewportMaxLeft);
    const maxTop = Math.min(globalMaxTop, viewportMaxTop);
    const safeLeft =
      minLeft <= maxLeft
        ? clamp(preferredLeft, minLeft, maxLeft)
        : clamp(preferredLeft, MAP_PREVIEW_CARD_SAFE_EDGE_PX, globalMaxLeft);
    const safeTop =
      minTop <= maxTop
        ? clamp(preferredTop, minTop, maxTop)
        : clamp(preferredTop, MAP_PREVIEW_CARD_SAFE_TOP_PX, globalMaxTop);

    return {
      width: `${Math.round(cardWidth)}px`,
      left: `${Math.round(safeLeft)}px`,
      top: `${Math.round(safeTop)}px`,
    } as CSSProperties;
  }, [
    gridViewportState.clientHeight,
    gridViewportState.clientWidth,
    gridViewportState.scrollLeft,
    gridViewportState.scrollTop,
    isPreviewPinned,
    mapGridSizePx,
    previewSettlementCell,
    regionSize,
    resolveCellAnchorPx,
  ]);

  const updateMiniViewportImmediate = useCallback(() => {
    const wrap = gridWrapRef.current;
    if (!wrap) {
      return;
    }

    const scrollWidth = Math.max(1, wrap.scrollWidth);
    const scrollHeight = Math.max(1, wrap.scrollHeight);
    const clientWidth = Math.max(1, wrap.clientWidth);
    const clientHeight = Math.max(1, wrap.clientHeight);
    const nextGridViewportState = {
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
      clientWidth,
      clientHeight,
    };
    setGridViewportState((previous) => {
      if (
        Math.abs(previous.scrollLeft - nextGridViewportState.scrollLeft) < 0.5 &&
        Math.abs(previous.scrollTop - nextGridViewportState.scrollTop) < 0.5 &&
        Math.abs(previous.clientWidth - nextGridViewportState.clientWidth) < 0.5 &&
        Math.abs(previous.clientHeight - nextGridViewportState.clientHeight) < 0.5
      ) {
        return previous;
      }
      return nextGridViewportState;
    });

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

  useEffect(() => {
    const onFullscreenChange = () => {
      const root = mapPanelRef.current;
      const fullscreenElement = document.fullscreenElement;
      setIsMapFullscreen(Boolean(root && fullscreenElement && root === fullscreenElement));
      updateMiniViewport();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [updateMiniViewport]);

  useEffect(
    () => () => {
      if (wheelZoomRafRef.current != null) {
        window.cancelAnimationFrame(wheelZoomRafRef.current);
        wheelZoomRafRef.current = null;
      }
      wheelZoomTargetRef.current = null;
      wheelAnchorRef.current = null;
    },
    [],
  );

  const applyZoom = useCallback(
    (nextZoomPercent: number, anchor?: { clientX: number; clientY: number }) => {
      const currentZoom = zoomPercentRef.current;
      const normalizedNext = normalizeMapZoom(nextZoomPercent);
      if (normalizedNext === currentZoom) {
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
      const prevScale = 1 + currentZoom / 100;
      const nextScale = 1 + normalizedNext / 100;
      const scaleFactor = nextScale / prevScale;

      onZoomChange(normalizedNext);
      zoomPercentRef.current = normalizedNext;

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
    [onZoomChange, updateMiniViewport],
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
      if (event.pointerId !== panState.pointerId) {
        return;
      }

      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;
      if (!panState.didDrag && Math.hypot(deltaX, deltaY) >= 5) {
        panState.didDrag = true;
        wrap.classList.add('panning');
      }
      if (!panState.didDrag) {
        return;
      }
      panPendingRef.current = {
        left: panState.startLeft - deltaX,
        top: panState.startTop - deltaY,
      };
      if (panRafRef.current == null) {
        panRafRef.current = window.requestAnimationFrame(() => {
          panRafRef.current = null;
          const pending = panPendingRef.current;
          const currentWrap = gridWrapRef.current;
          if (!pending || !currentWrap) {
            return;
          }
          currentWrap.scrollLeft = pending.left;
          currentWrap.scrollTop = pending.top;
          panPendingRef.current = null;
        });
      }
    };

    const finishPan = (event: PointerEvent) => {
      const panState = panStateRef.current;
      const wrap = gridWrapRef.current;
      if (!panState || !wrap) {
        return;
      }
      if (event.pointerId !== panState.pointerId) {
        return;
      }

      wrap.classList.remove('panning');
      if (panState.didDrag) {
        dragSuppressClickUntilRef.current = Date.now() + 140;
      }
      if (panRafRef.current != null) {
        window.cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      panPendingRef.current = null;
      panStateRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishPan);
    window.addEventListener('pointercancel', finishPan);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishPan);
      window.removeEventListener('pointercancel', finishPan);
      if (panRafRef.current != null) {
        window.cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      panPendingRef.current = null;
    };
  }, []);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    clearHoverTimeout();

    const target = event.target as HTMLElement;
    if (target.closest('.map-settlement-info-card')) {
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
      didDrag: false,
    };
    event.preventDefault();
  };

  const handleRegionWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const wheelDelta = clamp(
      Math.abs(event.deltaY) * MAP_ZOOM_WHEEL_SENSITIVITY,
      MAP_ZOOM_WHEEL_MIN_DELTA,
      MAP_ZOOM_WHEEL_MAX_DELTA,
    );
    const delta = event.deltaY < 0 ? wheelDelta : -wheelDelta;
    const baseTarget = wheelZoomTargetRef.current ?? zoomPercentRef.current;
    wheelZoomTargetRef.current = clamp(baseTarget + delta, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    wheelAnchorRef.current = { clientX: event.clientX, clientY: event.clientY };

    if (wheelZoomRafRef.current != null) {
      return;
    }

    const animateWheelZoom = () => {
      const targetZoom = wheelZoomTargetRef.current;
      if (targetZoom == null) {
        wheelZoomRafRef.current = null;
        return;
      }

      const currentZoom = zoomPercentRef.current;
      const remaining = targetZoom - currentZoom;
      const nextZoom = Math.abs(remaining) <= 0.2 ? targetZoom : currentZoom + remaining * 0.24;
      const anchor = wheelAnchorRef.current ?? undefined;
      applyZoom(nextZoom, anchor);

      if (Math.abs(targetZoom - zoomPercentRef.current) <= 0.2) {
        applyZoom(targetZoom, anchor);
        wheelZoomTargetRef.current = null;
        wheelZoomRafRef.current = null;
        return;
      }

      wheelZoomRafRef.current = window.requestAnimationFrame(animateWheelZoom);
    };

    wheelZoomRafRef.current = window.requestAnimationFrame(animateWheelZoom);
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

  const settlementMarkers = useMemo(
    () =>
      mapDisplaySettlements.map(({ settlement, localX, localY }) => {
        const settlementMapKind = getSettlementMapKind(settlement, activeVillageId);
        const settlementPrestigeMeta = resolveSettlementPrestigeMeta(Number(settlement.prestige ?? 0));
        const settlementPrestigeTier = settlementPrestigeMeta.tier;
        const isHoveredPlayerSettlement =
          safeHoveredId === settlement.id &&
          (settlementMapKind === 'opponent' || settlementMapKind === 'enemy' || settlementMapKind === 'nap');
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
            className={`region-cell settlement ${settlementMapKind} prestige-tier-${settlementPrestigeTier.toLocaleLowerCase('cs-CZ')} ${focusedSettlementId === settlement.id ? 'focused' : ''} ${isHoveredPlayerSettlement ? 'hover-player' : ''}`}
            data-settlement-id={settlement.id}
            style={{
              gridColumnStart: localX,
              gridRowStart: localY,
            }}
            onMouseEnter={() => {
              clearHoverTimeout();
              setHoveredId((previous) => (previous === settlement.id ? previous : settlement.id));
            }}
            onMouseLeave={() => {
              scheduleHoveredSettlementClear(settlement.id);
            }}
            onFocus={() => {
              clearHoverTimeout();
              setHoveredId((previous) => (previous === settlement.id ? previous : settlement.id));
            }}
            onBlur={() => {
              scheduleHoveredSettlementClear(settlement.id);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (Date.now() < dragSuppressClickUntilRef.current) {
                return;
              }
              clearHoverTimeout();
              setPinnedSettlementId(settlement.id);
              setHoveredId(settlement.id);
            }}
            title={`${settlement.name} (${settlement.globalX}|${settlement.globalY}) • ${settlementPrestigeMeta.label} (${settlementPrestigeMeta.letter})`}
          >
            <span className="settlement-art" aria-hidden="true">
              <img
                src={settlementPrestigeMeta.imagePath}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </span>
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
                    title={`Pohyb rytíře${Number(markerState.knightAttack) > 1 ? ` x${Number(markerState.knightAttack)}` : ''}`}
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
      clearHoverTimeout,
      focusedSettlementId,
      mapDisplaySettlements,
      orderMarkersByVillageId,
      safeHoveredId,
      scheduleHoveredSettlementClear,
    ],
  );

  const miniMapDots = useMemo(
    () =>
      mapDisplaySettlements.map(({ settlement, localX, localY }) => {
        const tier = resolveSettlementPrestigeTier(Number(settlement.prestige ?? 0));
        return (
          <span
            key={`mini-${settlement.id}`}
            className={`mini-map-dot ${getSettlementMapKind(settlement, activeVillageId)} prestige-tier-${tier.toLocaleLowerCase('cs-CZ')} ${focusedSettlementId === settlement.id ? 'focused' : ''}`}
            style={{
              left: `${((localX - 0.5) / regionSize) * 100}%`,
              top: `${((localY - 0.5) / regionSize) * 100}%`,
            }}
            aria-hidden="true"
          />
        );
      }),
    [activeVillageId, focusedSettlementId, mapDisplaySettlements, regionSize],
  );
  return (
    <div className={`map-panel ${isMapFullscreen ? 'is-fullscreen' : ''}`} ref={mapPanelRef}>
      <section className="map-header">
        <div>
          <h3>
            Region {regionId} - mřížka {regionSize}x{regionSize}
          </h3>
        </div>
        <div className="map-header-actions">
          <button onClick={() => centerOnSettlement(distanceOriginSettlement?.id ?? ownSettlement?.id ?? null, 'smooth')}>
            Centrovat
          </button>
          <button
            type="button"
            className="map-fullscreen-toggle"
            onClick={() => {
              void toggleMapFullscreen();
            }}
            title={isMapFullscreen ? 'Ukončit režim celé obrazovky' : 'Rozšířit mapu na celou obrazovku'}
            aria-label={isMapFullscreen ? 'Ukončit režim celé obrazovky' : 'Rozšířit mapu na celou obrazovku'}
          >
            <span className="symbol" aria-hidden="true">
              ⛶
            </span>
            <span>{isMapFullscreen ? 'Zmenšit mapu' : 'Celá obrazovka'}</span>
          </button>
        </div>
      </section>

      <section className="map-legend">
        <span className="legend active">Aktuální osada</span>
        <span className="legend own">Moje osada</span>
        <span className="legend royal">Královská</span>
        <span className="legend allied">Spojenecká</span>
        <span className="legend nap">Dohoda o neútočení</span>
        <span className="legend opponent">Protivník</span>
        <span className="legend enemy">Nepřítel</span>
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
            style={
              {
                '--map-grid-size': `${mapGridSizePx}px`,
                '--map-grid-count': `${regionSize}`,
                '--map-cell-size': `${cellSize}px`,
                '--map-cell-gap': `${mapCellGapPx}px`,
              } as CSSProperties
            }
          >
            {settlementMarkers}
            {previewSettlement && previewCardStyle ? (
              <article
                className={`map-settlement-info-card ${isPreviewPinned ? 'is-pinned' : 'is-hover'} ${isPreviewPlayerSettlement ? 'is-player' : ''} ${previewPrestigeTier ? `prestige-tier-${previewPrestigeTier.toLocaleLowerCase('cs-CZ')}` : ''}`}
                style={previewCardStyle}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <header>
                  <h4>
                    {previewSettlement.name} ({previewSettlement.globalX}|{previewSettlement.globalY})
                  </h4>
                  <small>
                    Region {previewSettlement.region} · Grid {previewSettlementCell?.localX ?? '-'}|
                    {previewSettlementCell?.localY ?? '-'}
                  </small>
                </header>
                <div className="map-settlement-info-body">
                  <div className="map-settlement-detail-grid">
                    <div className="map-settlement-overview">
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
                            className={`map-settlement-link owner ${isPreviewPlayerSettlement ? 'player-owner' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenPlayerProfile(previewSettlement.owner);
                            }}
                          >
                            <span className="map-settlement-owner-label">Hráč:</span> {previewSettlement.owner}
                          </button>
                        )
                      ) : (
                        <p className={`map-settlement-owner ${isPreviewPlayerSettlement ? 'player-owner' : ''}`}>
                          <span className="map-settlement-owner-label">Hráč:</span> {previewSettlement.owner}
                        </p>
                      )}
                      <p className="map-settlement-prestige">
                        Prestiž osady <strong>{previewSettlement.prestige.toLocaleString('cs-CZ')}</strong>{' '}
                        {previewPrestigeMeta ? (
                          <em className="map-prestige-tier-badge">
                            {previewPrestigeMeta.label} <small>{previewPrestigeMeta.letter}</small>
                          </em>
                        ) : null}
                      </p>
                      <p className="map-settlement-prestige-total">
                        Prestiž hráče celkem{' '}
                        <strong>
                          {previewPlayerTotalPrestige == null ? '-' : previewPlayerTotalPrestige.toLocaleString('cs-CZ')}
                        </strong>
                      </p>
                      <p className="map-settlement-prestige-total">
                        Prestiž království celkem{' '}
                        <strong>
                          {previewKingdomTotalPrestige == null
                            ? '-'
                            : previewKingdomTotalPrestige.toLocaleString('cs-CZ')}
                        </strong>
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
                        Vzdálenost od <em>{distanceOriginSettlement?.name ?? 'aktivního léna'}</em>{' '}
                        <strong>{previewDistanceTiles == null ? '-' : `${previewDistanceTiles} polí`}</strong>
                      </p>
                      {previewTargetUnderProtection ? (
                        <p className="map-settlement-protection">
                          Nováčkovská ochrana: {formatDurationLabel(Number(previewSettlement?.protectionRemainingSec ?? 0))}
                        </p>
                      ) : null}
                      {previewTargetPrestigeBlocked ? (
                        <p className="map-settlement-balance-warning is-blocked">
                          Ochrana prestiže: na toto léno teď útočit nemůžeš. Hráč má{' '}
                          <strong>{Math.max(0, Math.floor(Number(previewSettlement?.ownerTotalPrestige ?? 0))).toLocaleString('cs-CZ')}</strong>{' '}
                          prestiže a pro útok potřebuje alespoň{' '}
                          <strong>
                            {Math.max(
                              1,
                              Math.floor(Number(previewSettlement?.prestigeAttackMinimumForViewer ?? 1)),
                            ).toLocaleString('cs-CZ')}
                          </strong>
                          . Pokud tě napadne jako první, ochrana se zruší a můžeš útok vrátit.
                        </p>
                      ) : null}
                      {previewRetaliationUnlocked ? (
                        <p className="map-settlement-balance-warning is-unlocked">
                          Retaliace aktivní: tento hráč už na tebe útočil, můžeš útok vrátit bez prestižní blokace.
                          {previewRetaliationUnlockedAtLabel ? (
                            <>
                              {' '}
                              Poslední agrese: <strong>{previewRetaliationUnlockedAtLabel}</strong>.
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    {previewDistanceTiles != null ? (
                      <div className="map-settlement-travel">
                        <p className="map-settlement-travel-title">
                          Časy přesunu jednotek ({previewDistanceTiles.toLocaleString('cs-CZ')} polí)
                        </p>
                        <div className="map-settlement-travel-head">
                          <span>Jednotka</span>
                          <span>⌖ Útok</span>
                          <span>🛡 Podpora</span>
                        </div>
                        <div className="map-settlement-travel-list">
                          {previewTravelRows.map((row) => {
                            const unitMeta = getUnitMetaById(row.unitId);
                            const attackLabel = row.attackDurationSec == null ? '—' : formatDurationLabel(row.attackDurationSec);
                            const supportLabel =
                              row.supportDurationSec == null ? '—' : formatDurationLabel(row.supportDurationSec);

                            return (
                              <div key={`${previewSettlement.id}-travel-${row.unitId}`} className="map-settlement-travel-row">
                                <span className="map-settlement-travel-unit">
                                  <span className="unit-icon-shell tiny" aria-hidden="true">
                                    <img src={unitMeta.icon} alt="" className="unit-icon-image" loading="lazy" />
                                  </span>
                                  <small>{unitMeta.fallbackName}</small>
                                </span>
                                <strong>{attackLabel}</strong>
                                <strong>{supportLabel}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                {isPreviewPinned ? (
                  <>
                    <div className="map-settlement-action-grid">
                      {MAP_ORDER_COMMAND_TYPES.map((commandType) => {
                        if (commandType === 'attack' && previewTargetUnderProtection) {
                          return null;
                        }

                        return (
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
                        );
                      })}
                    </div>
                    <div className="map-settlement-pin-controls">
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
                      <span>Zapinovat osadu</span>
                    </div>
                  </>
                ) : null}
              </article>
            ) : null}
          </div>
        </div>

        <section
          className="map-navigation"
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div className="mini-map-shell">
            <h4>Minimapa</h4>
            <div
              className="mini-map"
              ref={miniMapRef}
              onPointerDown={handleMinimapPointerDown}
              onWheel={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
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
                <button onClick={() => applyZoom(60)}>+60%</button>
                <button onClick={() => applyZoom(70)}>+70%</button>
                <button onClick={() => applyZoom(100)}>+100%</button>
                <button onClick={() => applyZoom(MAP_ZOOM_MIN)}>-50%</button>
              </div>
            </div>
          </div>
          <div className="map-nav-hint">
            <p>
              Zoom mapy: kolečko myši po {MAP_ZOOM_STEP} %. Rozsah je od {MAP_ZOOM_MIN} % do +
              {MAP_ZOOM_MAX} %.
            </p>
            <p>Značky rozkazů: <strong className="order-legend attack">⌖ útok</strong>, <strong className="order-legend support">🛡 podpora</strong>, <strong className="order-legend move">➜ přesun</strong>, <strong className="order-legend knight">♞ pohyb rytíře</strong>.</p>
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
  const [attackLootPriority, setAttackLootPriority] = useState<LootPriority>('balanced');
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
  const villageLootCapacity = useMemo(() => calculateLootCapacityFromSelection(selectedUnits), [selectedUnits]);
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
  const [hoveredMovementKey, setHoveredMovementKey] = useState<string | null>(null);
  const [tooltipCursorPosition, setTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
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
    setAttackLootPriority('balanced');
  };
  const hasAvailableVillageUnits = useMemo(
    () => units.some((unit) => Number(unit.amount ?? 0) > 0),
    [units],
  );
  const isSupportOnlyTarget = useMemo(
    () => availableCommandTypes.length === 1 && availableCommandTypes[0] === 'support',
    [availableCommandTypes],
  );
  const handleFillSingleVillageUnit = (unitId: string, availableAmountRaw: number) => {
    if (isArmyCommandPending) {
      return;
    }
    if (isSupportOnlyTarget && unitId === 'caravan') {
      return;
    }
    const availableAmount = Math.max(0, Math.floor(Number(availableAmountRaw ?? 0)));
    setDraftUnitAmounts((previous) => ({
      ...previous,
      [unitId]: availableAmount > 0 ? String(availableAmount) : '',
    }));
  };
  const selectAllVillageUnitsTooltip = isSupportOnlyTarget
    ? 'Vyplní dostupné jednotky bez karavan (podpora je nepovoluje).'
    : 'Vyplní dostupné množství všech aktuálních jednotek.';
  const handleSelectAllVillageUnits = () => {
    setDraftUnitAmounts(
      buildDraftUnitAmountsFromAvailable(units, {
        excludeCaravan: isSupportOnlyTarget,
      }),
    );
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
            <div className="army-draft-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleSelectAllVillageUnits}
                disabled={isArmyCommandPending || !hasAvailableVillageUnits}
                title={selectAllVillageUnitsTooltip}
              >
                Přidat všechny
              </button>
            </div>
            <div className="army-draft-grid village-action-draft">
              {units.map((unit) => (
                <label key={`village-draft-${settlement.id}-${unit.id}`}>
                  <span>
                    {unit.name}{' '}
                    <small className="row-help inline">k dispozici: {unit.amount.toLocaleString('cs-CZ')}</small>
                  </span>
                  <div className="army-draft-input-row">
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
                      disabled={isArmyCommandPending || (isSupportOnlyTarget && unit.id === 'caravan')}
                    />
                    <button
                      type="button"
                      className="secondary-action compact army-draft-unit-fill-button"
                      onClick={() => handleFillSingleVillageUnit(unit.id, unit.amount)}
                      disabled={
                        isArmyCommandPending ||
                        unit.amount <= 0 ||
                        (isSupportOnlyTarget && unit.id === 'caravan')
                      }
                      title="Vložit všechny dostupné jednotky tohoto typu"
                    >
                      Všechny k dispozici
                    </button>
                  </div>
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
                Kapacita kořisti (bez zvědů a beranidel):{' '}
                <strong>{villageLootCapacity.toLocaleString('cs-CZ')}</strong>
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
                  <option value="balanced">{LOOT_PRIORITY_LABELS.balanced}</option>
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
          <ul className="commands-list">
            {activeMovementsAtSettlement.map((movement) => {
              const rowKey = `movement-${movement.id}`;
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={rowKey}
                  className={`commands-item village-action-line has-army-tooltip${hoveredMovementKey === rowKey ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementKey(rowKey);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementKey((previous) => (previous === rowKey ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className={`command-badge ${movement.commandType} compact`}>
                      <span className="symbol">{getArmyCommandSymbol(movement.commandType)}</span>
                    </span>
                    <strong>{ARMY_COMMAND_LABELS[movement.commandType]}</strong>
                    <span>
                      {movement.originName} → {movement.targetName}
                    </span>
                  </div>
                  <small>
                    Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA {formatDurationLabel(movement.remainingSec)}
                  </small>
                  {hoveredMovementKey === rowKey ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
            {supportMovementsAtSettlement.map((movement) => {
              const rowKey = `visible-support-${movement.id}`;
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={rowKey}
                  className={`commands-item village-action-line has-army-tooltip${hoveredMovementKey === rowKey ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementKey(rowKey);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementKey((previous) => (previous === rowKey ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div className="commands-item-line">
                    <span className="command-badge support compact">
                      <span className="symbol">{getArmyCommandSymbol('support')}</span>
                    </span>
                    <strong>Stacionovaná podpora</strong>
                    <span>{movement.originName} → {movement.targetName}</span>
                  </div>
                  <small>Jednotky: {unitsTotal.toLocaleString('cs-CZ')}</small>
                  {hoveredMovementKey === rowKey ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Pro tuto osadu aktuálně nevidíš žádné aktivní akce.</p>
        )}
      </section>
      {supportMovementsAtSettlement.length > 0 ? (
        <section>
          <h3>Podpora v osadě</h3>
          <ul className="commands-list">
            {supportMovementsAtSettlement.map((movement) => {
              const rowKey = `panel-support-${movement.id}`;
              const unitsTotal = getMovementUnitsTotal(movement);
              return (
                <li
                  key={rowKey}
                  className={`commands-item village-support-row has-army-tooltip${hoveredMovementKey === rowKey ? ' is-tooltip-open' : ''}`}
                  onMouseEnter={(event) => {
                    setHoveredMovementKey(rowKey);
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredMovementKey((previous) => (previous === rowKey ? null : previous));
                    setTooltipCursorPosition(null);
                  }}
                >
                  <div>
                    <strong>Podpora z {movement.originName}</strong>
                    <small>Jednotky: {unitsTotal.toLocaleString('cs-CZ')}</small>
                  </div>
                  <button
                    className="secondary-action recruit-action"
                    onClick={() => onReturnSupport(movement.id)}
                    disabled={isArmyCommandPending}
                  >
                    Návrat
                  </button>
                  {hoveredMovementKey === rowKey ? (
                    <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                  ) : null}
                </li>
              );
            })}
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
  developerBoost,
  notice,
}: {
  building: Building;
  onBackToCity: () => void;
  onUpgrade: (building: Building) => void;
  onRecallKnight: (() => void) | null;
  knightCount: number;
  isRecallKnightPending: boolean;
  isUpgradePending: boolean;
  developerBoost: TownhallDeveloperBoostNotice | null;
  notice: string | null;
}) => (
  <div className="panel-stack building-panel">
    <section>
      <h3>{building.name}</h3>
      <p>{building.effect}</p>
      {building.id === 'residential-quarter' ? (
        <p className="row-help">
          Poznámka: část populace je systémově rezervovaná na provoz budov, aby se po rekrutu nebo ztrátách
          nerozpadla ekonomická obsluha.
        </p>
      ) : null}
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
            {developerBoost ? (
              <div className={`townhall-dev-boost ${developerBoost.isActive ? 'is-active' : 'is-inactive'}`}>
                <p className="townhall-dev-boost-title">
                  {developerBoost.isActive
                    ? `Boost od vývojáře: ${developerBoost.label}`
                    : 'Boost od vývojáře je ukončen'}
                </p>
                <p className="townhall-dev-boost-meta">
                  {developerBoost.isActive
                    ? `Trvání: ${formatDurationLabel(developerBoost.remainingSec)} (konec ${developerBoost.endsAtLabel})`
                    : `Boost skončil ${developerBoost.endsAtLabel}.`}
                </p>
                <p className="townhall-dev-boost-reason">{developerBoost.reason}</p>
              </div>
            ) : null}
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
  const worldMenuRef = useRef<HTMLDivElement | null>(null);
  const stateRequestPromiseRef = useRef<Promise<void> | null>(null);
  const reportsRequestPromiseRef = useRef<Promise<void> | null>(null);
  const activityRequestPromiseRef = useRef<Promise<void> | null>(null);
  const mutationPendingRef = useRef(false);
  const hasStoredPanelLayoutRef = useRef(false);
  const initialAutoStretchAppliedRef = useRef(false);
  const armyQuickSelectionRequestIdRef = useRef(0);
  const username = session?.username ?? 'Hayato';
  const selectedWorldId = session?.selectedWorldId ?? null;
  const selectedSpawnDirection = session?.selectedSpawnDirection ?? null;
  const selectedWorldName = selectedWorldId
    ? WORLD_LABELS[selectedWorldId] ?? selectedWorldId
    : null;
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
  const [researchNotice, setResearchNotice] = useState<string | null>(null);
  const [researchActionPending, setResearchActionPending] = useState(false);
  const [mercenaryActionPending, setMercenaryActionPending] = useState(false);
  const [logisticsActionPending, setLogisticsActionPending] = useState(false);
  const [recruitPendingUnitId, setRecruitPendingUnitId] = useState<string | null>(null);
  const [cancelRecruitmentPendingId, setCancelRecruitmentPendingId] = useState<number | null>(null);
  const [armyCommandPending, setArmyCommandPending] = useState(false);
  const [upgradePendingBuildingId, setUpgradePendingBuildingId] = useState<string | null>(null);
  const [cancelUpgradePendingOrderId, setCancelUpgradePendingOrderId] = useState<number | null>(null);
  const [recallKnightPending, setRecallKnightPending] = useState(false);
  const [renameVillagePending, setRenameVillagePending] = useState(false);
  const [buildingNotices, setBuildingNotices] = useState<Record<string, string>>({});
  const [battleReports, setBattleReports] = useState<BattleReportListResponse | null>(null);
  const [battleReportsLoading, setBattleReportsLoading] = useState(false);
  const [battleReportsError, setBattleReportsError] = useState<string | null>(null);
  const [battleReportsPage, setBattleReportsPage] = useState(1);
  const [selectedBattleReportId, setSelectedBattleReportId] = useState<number | null>(null);
  const [battleReportCacheById, setBattleReportCacheById] = useState<Record<number, BattleReportItem>>({});
  const [activityEntries, setActivityEntries] = useState<GameActivityListResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [activityIncludeArchived, setActivityIncludeArchived] = useState(false);
  const [activityMilitaryOnly, setActivityMilitaryOnly] = useState(false);
  const [activityActionPending, setActivityActionPending] = useState(false);
  const [activityLastOpenedAt, setActivityLastOpenedAt] = useState<string | null>(null);
  const [activityShareItem, setActivityShareItem] = useState<GameActivityItem | null>(null);
  const [activityShareQuery, setActivityShareQuery] = useState('');
  const [activityShareSuggestions, setActivityShareSuggestions] = useState<
    Array<{ username: string; relation: string }>
  >([]);
  const [activityShareLoading, setActivityShareLoading] = useState(false);
  const [activitySharePending, setActivitySharePending] = useState(false);
  const [activityShareError, setActivityShareError] = useState<string | null>(null);
  const [communicationBadgeCount, setCommunicationBadgeCount] = useState(0);
  const [isCommunicationHubOpen, setIsCommunicationHubOpen] = useState(false);
  const [availableWorlds, setAvailableWorlds] = useState<WorldPortalItem[]>([]);
  const [isWorldMenuOpen, setIsWorldMenuOpen] = useState(false);
  const [worldMenuError, setWorldMenuError] = useState<string | null>(null);
  const worldSwitchOptions = useMemo<WorldSwitchOption[]>(() => {
    if (availableWorlds.length > 0) {
      return availableWorlds.map((world) => ({
        id: world.id,
        name: world.name,
        status: world.status,
      }));
    }
    if (!selectedWorldId) {
      return [];
    }
    return [
      {
        id: selectedWorldId,
        name: selectedWorldName ?? selectedWorldId,
        status: 'online',
      },
    ];
  }, [availableWorlds, selectedWorldId, selectedWorldName]);
  const [kingdomActionPending, setKingdomActionPending] = useState(false);
  const [kingdomNotice, setKingdomNotice] = useState<string | null>(null);
  const [restartVillagePending, setRestartVillagePending] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [playerAvatarByUsername, setPlayerAvatarByUsername] = useState<Record<string, PlayerProfileAvatarState>>({});
  const [gameFontScaleOption, setGameFontScaleOption] = useState<GameFontScaleOption>(() =>
    readStoredGameFontScaleOption(username),
  );
  const [gameFontScaleDraft, setGameFontScaleDraft] = useState<GameFontScaleOption>(() =>
    readStoredGameFontScaleOption(username),
  );
  const [shortcutCustomBindings, setShortcutCustomBindings] = useState<Partial<Record<ShortcutActionId, ShortcutBinding>>>(
    () => readStoredShortcutSettings(username).customBindings,
  );
  const [autoHidePinColumns, setAutoHidePinColumns] = useState<boolean>(
    () => readStoredShortcutSettings(username).autoHidePinColumns,
  );
  const [shortcutNotice, setShortcutNotice] = useState<string | null>(null);
  const [isPinColumnsTemporarilyHidden, setIsPinColumnsTemporarilyHidden] = useState(false);
  const [isPinColumnsOverlayVisible, setIsPinColumnsOverlayVisible] = useState(false);
  const [isPinColumnsHoldVisible, setIsPinColumnsHoldVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => detectTouchDevice());
  const [shortcutSettingsLoadedForUser, setShortcutSettingsLoadedForUser] = useState(username);
  const [isVillageMenuOpen, setVillageMenuOpen] = useState(false);
  const [villageMenuPosition, setVillageMenuPosition] = useState<VillageMenuPosition | null>(null);
  const [isVillageHotkeyMode, setIsVillageHotkeyMode] = useState(false);
  const [villageHotkeyIndex, setVillageHotkeyIndex] = useState(0);
  const [armyTargetHistoryByVillageId, setArmyTargetHistoryByVillageId] = useState<ArmyTargetHistoryByVillageId>(
    () => readStoredArmyTargetHistory(username),
  );
  const [armyQuickSelection, setArmyQuickSelection] = useState<ArmyQuickSelection | null>(null);
  const [protectionClockMs, setProtectionClockMs] = useState(() => Date.now());

  useEffect(() => {
    mutationPendingRef.current = Boolean(
      recruitPendingUnitId ||
        cancelRecruitmentPendingId != null ||
        upgradePendingBuildingId ||
        cancelUpgradePendingOrderId != null ||
        armyCommandPending ||
        researchActionPending ||
        mercenaryActionPending ||
        logisticsActionPending ||
        kingdomActionPending ||
        restartVillagePending ||
        renameVillagePending ||
        recallKnightPending ||
        activityActionPending,
    );
  }, [
    activityActionPending,
    armyCommandPending,
    cancelRecruitmentPendingId,
    cancelUpgradePendingOrderId,
    logisticsActionPending,
    kingdomActionPending,
    mercenaryActionPending,
    recruitPendingUnitId,
    recallKnightPending,
    researchActionPending,
    renameVillagePending,
    restartVillagePending,
    upgradePendingBuildingId,
  ]);

  useEffect(() => {
    setArmyTargetHistoryByVillageId(readStoredArmyTargetHistory(username));
    const storedFontScale = readStoredGameFontScaleOption(username);
    const storedShortcutSettings = readStoredShortcutSettings(username);
    setGameFontScaleOption(storedFontScale);
    setGameFontScaleDraft(storedFontScale);
    setShortcutCustomBindings(storedShortcutSettings.customBindings);
    setAutoHidePinColumns(storedShortcutSettings.autoHidePinColumns);
    setShortcutNotice(null);
    setIsPinColumnsTemporarilyHidden(false);
    setIsPinColumnsOverlayVisible(false);
    setIsPinColumnsHoldVisible(false);
    setShortcutSettingsLoadedForUser(username);
    setMyAvatarUrl(null);
    setPlayerAvatarByUsername({});
  }, [username]);

  useEffect(() => {
    setIsTouchDevice(detectTouchDevice());
  }, []);

  useEffect(() => {
    if (!isTouchDevice) {
      return;
    }
    setIsPinColumnsHoldVisible(false);
  }, [isTouchDevice]);

  useEffect(() => {
    if (shortcutSettingsLoadedForUser !== username) {
      return;
    }
    saveStoredShortcutSettings(username, {
      autoHidePinColumns,
      customBindings: shortcutCustomBindings,
    });
  }, [autoHidePinColumns, shortcutCustomBindings, shortcutSettingsLoadedForUser, username]);

  const activeGameFontScalePercent = GAME_FONT_SCALE_PERCENT_BY_OPTION[gameFontScaleOption];
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    const previousDataFontScale = root.getAttribute('data-game-font-scale');
    root.style.fontSize = `${activeGameFontScalePercent}%`;
    root.setAttribute('data-game-font-scale', gameFontScaleOption);

    return () => {
      root.style.fontSize = previousFontSize;
      if (previousDataFontScale == null) {
        root.removeAttribute('data-game-font-scale');
      } else {
        root.setAttribute('data-game-font-scale', previousDataFontScale);
      }
    };
  }, [activeGameFontScalePercent, gameFontScaleOption]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProtectionClockMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handleCommunicationSummary = (event: Event) => {
      const detail = (event as CustomEvent<CommunicationSummaryEventDetail>).detail;
      const countRaw = Number(detail?.newSinceLastOpen ?? detail?.totalAttention ?? 0);
      if (!Number.isFinite(countRaw)) {
        return;
      }
      setCommunicationBadgeCount(Math.max(0, Math.floor(countRaw)));
      setIsCommunicationHubOpen(Boolean(detail?.hubOpen));
    };

    window.addEventListener(COMMUNICATION_SUMMARY_EVENT, handleCommunicationSummary as EventListener);
    return () => {
      window.removeEventListener(COMMUNICATION_SUMMARY_EVENT, handleCommunicationSummary as EventListener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCommunicationInbox(username, {
      threadLimit: 5,
      messageLimit: 10,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const avatarUrl = response.me?.avatarUrl ?? null;
        setMyAvatarUrl(avatarUrl);
        setPlayerAvatarByUsername((previous) => ({
          ...previous,
          [username.toLocaleLowerCase('cs-CZ')]: {
            avatarUrl,
            loaded: true,
          },
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
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
        nextLevelPreview: building.nextLevelPreview ?? null,
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
  const armyIncomingMovements = useMemo<ArmyMovementState[]>(
    () => gameState?.army?.incomingMovements ?? [],
    [gameState],
  );
  const cityPanelArmyOrders = useMemo<ArmyMovementState[]>(() => {
    const merged = new Map<string, ArmyMovementState>();
    const attachMovement = (movement: ArmyMovementState) => {
      if (!movement.isRelatedToCurrentVillage) {
        return;
      }
      const uniqueKey = [
        movement.commandType,
        movement.id,
        movement.originVillageId,
        movement.targetVillageId,
        movement.arriveAt,
      ].join(':');
      if (!merged.has(uniqueKey)) {
        merged.set(uniqueKey, movement);
      }
    };

    for (const movement of armyIncomingMovements) {
      attachMovement(movement);
    }
    for (const movement of armyActiveMovements) {
      attachMovement(movement);
    }
    for (const movement of armyStationedSupports) {
      attachMovement(movement);
    }

    return [...merged.values()].sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id);
  }, [armyActiveMovements, armyIncomingMovements, armyStationedSupports]);
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
    for (const movement of armyIncomingMovements) {
      if (movement.commandType === 'attack' || movement.commandType === 'support' || movement.commandType === 'move') {
        const hasKnightAttack =
          movement.commandType === 'attack' &&
          movement.units.some((unit) => unit.unitId === 'knight' && Number(unit.amount) > 0);
        addMarker(movement.targetVillageId, movement.commandType, { hasKnightAttack });
      }
    }

    return markerMap;
  }, [armyActiveMovements, armyIncomingMovements, armyStationedSupports]);
  const townhallDeveloperBoost = useMemo<TownhallDeveloperBoostNotice | null>(() => {
    const developerBoost: DeveloperResourceBoostState | undefined = gameState?.resources?.developerBoost;
    if (!developerBoost || !developerBoost.worldId || !developerBoost.reason || !developerBoost.label) {
      return null;
    }

    const endsAtMs = Date.parse(String(developerBoost.endsAt ?? ''));
    if (!Number.isFinite(endsAtMs)) {
      return null;
    }
    const remainingSec = Math.max(0, Math.ceil((endsAtMs - protectionClockMs) / 1000));
    const isActive = Boolean(developerBoost.isActive) && remainingSec > 0;

    return {
      isActive,
      label: String(developerBoost.label),
      reason: String(developerBoost.reason),
      remainingSec,
      endsAtLabel: formatDateTimeLabel(endsAtMs),
    };
  }, [gameState?.resources?.developerBoost, protectionClockMs]);

  const resourceStocks = useMemo<ResourceStock[]>(() => {
    const resolveUpgradeMeta = (buildingId: string): { upgradeQueueCount: number; upgradeSummary: string | null } => {
      const queue = buildingUpgradeQueueByBuilding.get(buildingId) ?? [];
      if (queue.length === 0) {
        return {
          upgradeQueueCount: 0,
          upgradeSummary: null,
        };
      }

      const firstOrder = queue[0];
      const lastOrder = queue[queue.length - 1];
      const levelIncrease = Math.max(1, Number(lastOrder.toLevel) - Number(firstOrder.fromLevel));
      const levelIncreaseLabel = `${levelIncrease} ${formatCzechCountLabel(levelIncrease, 'stupeň', 'stupně', 'stupňů')}`;
      return {
        upgradeQueueCount: queue.length,
        upgradeSummary: `Rozšiřuje se o ${levelIncreaseLabel} ${formatDurationVerboseLabel(lastOrder.remainingSec)}.`,
      };
    };

    const resolveBuildingMeta = (buildingId: string): { buildingName: string; buildingLevel: number } => {
      if (!gameState) {
        return {
          buildingName: BUILDING_ART[buildingId]?.fallbackName ?? buildingId,
          buildingLevel: 0,
        };
      }
      const building = gameState.buildings.find((entry) => entry.id === buildingId);
      return {
        buildingName: BUILDING_ART[buildingId]?.fallbackName ?? building?.name ?? buildingId,
        buildingLevel: Math.max(0, Number(building?.level ?? 0)),
      };
    };

    if (!gameState) {
      return [
        {
          name: 'Dřevo',
          amount: 0,
          delta: '+0 / h',
          boostLabel: null,
          cap: 0,
          buildingId: 'woodcutter',
          ...resolveBuildingMeta('woodcutter'),
          ...resolveUpgradeMeta('woodcutter'),
        },
        {
          name: 'Kámen',
          amount: 0,
          delta: '+0 / h',
          boostLabel: null,
          cap: 0,
          buildingId: 'quarry',
          ...resolveBuildingMeta('quarry'),
          ...resolveUpgradeMeta('quarry'),
        },
        {
          name: 'Železo',
          amount: 0,
          delta: '+0 / h',
          boostLabel: null,
          cap: 0,
          buildingId: 'iron-mine',
          ...resolveBuildingMeta('iron-mine'),
          ...resolveUpgradeMeta('iron-mine'),
        },
        {
          name: 'Zlato',
          amount: 0,
          delta: '+0 / h',
          boostLabel: null,
          cap: 0,
          buildingId: 'gold-mine',
          ...resolveBuildingMeta('gold-mine'),
          ...resolveUpgradeMeta('gold-mine'),
        },
        {
          name: 'Mince',
          amount: 0,
          delta: '+0 / h',
          boostLabel: null,
          cap: 0,
          buildingId: 'mint',
          ...resolveBuildingMeta('mint'),
          ...resolveUpgradeMeta('mint'),
        },
        {
          name: 'Populace',
          amount: 0,
          delta: 'kapacita 0',
          boostLabel: null,
          cap: 0,
          buildingId: 'residential-quarter',
          ...resolveBuildingMeta('residential-quarter'),
          ...resolveUpgradeMeta('residential-quarter'),
        },
      ];
    }

    const resourceBoostLabel =
      gameState.resources.developerBoost?.isActive && gameState.resources.developerBoost.label
        ? String(gameState.resources.developerBoost.label)
        : null;

    return [
      {
        name: 'Dřevo',
        amount: gameState.resources.wood,
        delta: `+${gameState.resources.productionPerHour.wood.toLocaleString('cs-CZ')} / h`,
        boostLabel: resourceBoostLabel,
        cap: gameState.resources.cap,
        buildingId: 'woodcutter',
        ...resolveBuildingMeta('woodcutter'),
        ...resolveUpgradeMeta('woodcutter'),
      },
      {
        name: 'Kámen',
        amount: gameState.resources.stone,
        delta: `+${gameState.resources.productionPerHour.stone.toLocaleString('cs-CZ')} / h`,
        boostLabel: resourceBoostLabel,
        cap: gameState.resources.cap,
        buildingId: 'quarry',
        ...resolveBuildingMeta('quarry'),
        ...resolveUpgradeMeta('quarry'),
      },
      {
        name: 'Železo',
        amount: gameState.resources.iron,
        delta: `+${gameState.resources.productionPerHour.iron.toLocaleString('cs-CZ')} / h`,
        boostLabel: resourceBoostLabel,
        cap: gameState.resources.cap,
        buildingId: 'iron-mine',
        ...resolveBuildingMeta('iron-mine'),
        ...resolveUpgradeMeta('iron-mine'),
      },
      {
        name: 'Zlato',
        amount: gameState.resources.gold,
        delta: `+${gameState.resources.productionPerHour.gold.toLocaleString('cs-CZ')} / h`,
        boostLabel: null,
        cap: gameState.resources.goldCap,
        buildingId: 'gold-mine',
        ...resolveBuildingMeta('gold-mine'),
        ...resolveUpgradeMeta('gold-mine'),
      },
      {
        name: 'Mince',
        amount: gameState.resources.coins,
        delta: `+${gameState.resources.productionPerHour.mintCoins.toLocaleString('cs-CZ')} / h`,
        boostLabel: null,
        cap: gameState.resources.coinsCap,
        buildingId: 'mint',
        ...resolveBuildingMeta('mint'),
        ...resolveUpgradeMeta('mint'),
      },
      {
        name: 'Populace',
        amount: gameState.population.used,
        delta: `kapacita ${gameState.population.cap.toLocaleString('cs-CZ')}`,
        boostLabel: null,
        cap: gameState.population.cap,
        buildingId: 'residential-quarter',
        ...resolveBuildingMeta('residential-quarter'),
        ...resolveUpgradeMeta('residential-quarter'),
      },
    ];
  }, [buildingUpgradeQueueByBuilding, gameState]);
  const currentResearchTask = useMemo(
    () =>
      gameState?.research?.projects?.find((project) => project.status === 'researching') ??
      gameState?.research?.projects?.find((project) => project.status === 'available') ??
      null,
    [gameState?.research?.projects],
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
  const isGameFontScaleDirty = gameFontScaleDraft !== gameFontScaleOption;
  const shortcutBindings = useMemo<Record<ShortcutActionId, ShortcutBinding>>(() => {
    const merged = { ...DEFAULT_SHORTCUT_BINDINGS };
    for (const action of SHORTCUT_ACTIONS) {
      const customBinding = shortcutCustomBindings[action.id];
      if (!customBinding) {
        continue;
      }
      const normalized = normalizeShortcutBinding(customBinding);
      if (!normalized.key || isModifierOnlyShortcutKey(normalized.key)) {
        continue;
      }
      if (isReservedShortcutBinding(normalized)) {
        continue;
      }
      merged[action.id] = normalized;
    }
    return merged;
  }, [shortcutCustomBindings]);
  const basePinColumnsVisible = autoHidePinColumns ? isPinColumnsOverlayVisible : !isPinColumnsTemporarilyHidden;
  const arePinColumnsVisible = basePinColumnsVisible || isPinColumnsHoldVisible;
  const shouldReservePinColumnsSpace = !autoHidePinColumns && basePinColumnsVisible;
  const isPinColumnsOverlayVisibleInCanvas = arePinColumnsVisible && !shouldReservePinColumnsSpace;
  const gameCanvasClassName = `game-canvas${autoHidePinColumns ? ' is-pin-columns-auto-mode' : ''}${
    arePinColumnsVisible ? '' : ' is-pin-columns-hidden'
  }${isPinColumnsOverlayVisibleInCanvas ? ' is-pin-columns-overlay-visible' : ''}`;
  const activeVillageProtection = useMemo(() => {
    const protectionRuleDays = Math.max(0, Number(gameState?.village.protectionRuleDays ?? 0));
    const protectionUntil = gameState?.village.protectionUntil;
    if (protectionRuleDays <= 0 || !protectionUntil) {
      return null;
    }

    const protectionUntilMs = Date.parse(protectionUntil);
    if (!Number.isFinite(protectionUntilMs)) {
      return null;
    }

    const remainingSec = Math.max(0, Math.ceil((protectionUntilMs - protectionClockMs) / 1000));
    const formattedUntil = new Intl.DateTimeFormat('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(protectionUntilMs));

    return {
      isActive: remainingSec > 0,
      remainingSec,
      formattedUntil,
    };
  }, [gameState?.village.protectionRuleDays, gameState?.village.protectionUntil, protectionClockMs]);
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
  const incomingAttackAttentionCount = useMemo(
    () => armyIncomingMovements.filter((movement) => movement.commandType === 'attack').length,
    [armyIncomingMovements],
  );
  const activityUnreadCount = activityEntries?.unreadTotal ?? 0;
  const activityAttentionCount = activityEntries?.attentionTotal ?? 0;
  const activityUnreadFeed = useMemo(
    () => activityEntries?.unreadFeed ?? [],
    [activityEntries?.unreadFeed],
  );
  const activityNavBadgeCount = useMemo(() => {
    if (!activityLastOpenedAt) {
      return activityUnreadCount;
    }
    const openedAtMs = Date.parse(activityLastOpenedAt);
    if (!Number.isFinite(openedAtMs)) {
      return activityUnreadCount;
    }
    return activityUnreadFeed.filter((item) => {
      const createdAtMs = Date.parse(item.createdAt);
      return Number.isFinite(createdAtMs) && createdAtMs > openedAtMs;
    }).length;
  }, [activityLastOpenedAt, activityUnreadCount, activityUnreadFeed]);
  const menuInfoByType = useMemo<Partial<Record<StaticPanelType, string>>>(
    () => ({
      commands: `Útoky: ${incomingAttackAttentionCount.toLocaleString('cs-CZ')}`,
      army: 'Stavba/Rekrut',
      activity: `Záznamy: ${activityUnreadCount.toLocaleString('cs-CZ')}`,
      messages: `Zprávy: ${communicationBadgeCount.toLocaleString('cs-CZ')}`,
      rankings: `#${playerLeaderboardEntry?.rank?.toLocaleString('cs-CZ') ?? '?'}`,
      profile: username,
    }),
    [
      activityUnreadCount,
      communicationBadgeCount,
      incomingAttackAttentionCount,
      playerLeaderboardEntry?.rank,
      username,
    ],
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
          const nextState = await fetchGameState(
            username,
            activeVillageId,
            selectedWorldId,
            selectedSpawnDirection,
          );
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
    [activeVillageId, applyIncomingGameState, selectedSpawnDirection, selectedWorldId, session, username],
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
          const nextReports = await fetchBattleReports(username, battleReportsPage, 20, selectedWorldId);
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
    [battleReportsPage, selectedWorldId, session, username],
  );

  const loadActivity = useCallback(
    async (silent = false) => {
      if (!session || !selectedWorldId) {
        return;
      }

      if (activityRequestPromiseRef.current) {
        return activityRequestPromiseRef.current;
      }

      const requestPromise = (async () => {
        if (!silent) {
          setActivityLoading(true);
        }

        try {
          const nextActivity = await fetchGameActivity(username, {
            page: activityPage,
            pageSize: 25,
            includeArchived: activityIncludeArchived,
            worldId: selectedWorldId,
          });
          setActivityEntries(nextActivity);
          setActivityPage(nextActivity.page);
          setActivityError(null);
        } catch (error) {
          setActivityError(getErrorMessage(error));
        } finally {
          if (!silent) {
            setActivityLoading(false);
          }
        }
      })();

      activityRequestPromiseRef.current = requestPromise;

      try {
        await requestPromise;
      } finally {
        if (activityRequestPromiseRef.current === requestPromise) {
          activityRequestPromiseRef.current = null;
        }
      }
    },
    [activityIncludeArchived, activityPage, selectedWorldId, session, username],
  );

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }
    if (!selectedWorldId) {
      navigate('/worlds', { replace: true });
      return;
    }

    const pollGameState = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      void loadGameState(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadGameState(true);
      }
    };

    void loadGameState(false);
    const pollTimer = window.setInterval(pollGameState, STATE_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadGameState, navigate, selectedWorldId, session]);

  useEffect(() => {
    if (!session || !selectedWorldId) {
      return;
    }

    const pollBattleReports = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      void loadBattleReports(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadBattleReports(true);
      }
    };

    void loadBattleReports(false);
    const reportsTimer = window.setInterval(pollBattleReports, REPORTS_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(reportsTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadBattleReports, selectedWorldId, session]);

  useEffect(() => {
    if (!session || !selectedWorldId) {
      return;
    }

    const pollActivity = () => {
      if (document.hidden || mutationPendingRef.current || activityActionPending) {
        return;
      }
      void loadActivity(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadActivity(true);
      }
    };

    void loadActivity(false);
    const activityTimer = window.setInterval(pollActivity, REPORTS_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(activityTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activityActionPending, loadActivity, selectedWorldId, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;
    const loadWorldOptions = async () => {
      try {
        const response = await fetchWorlds(username);
        if (cancelled) {
          return;
        }
        setAvailableWorlds(response.worlds);
        setWorldMenuError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setWorldMenuError(getErrorMessage(error));
      }
    };

    void loadWorldOptions();
    return () => {
      cancelled = true;
    };
  }, [session, username]);

  useEffect(() => {
    if (!isWorldMenuOpen) {
      return;
    }

    const handleGlobalMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && worldMenuRef.current?.contains(target)) {
        return;
      }
      setIsWorldMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWorldMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleGlobalMouseDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleGlobalMouseDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isWorldMenuOpen]);

  useEffect(() => {
    setPanels((previous) =>
      previous.map((panel) => {
        let nextAlert = panel.alert;
        if (panel.type === 'commands') {
          nextAlert = !panel.expanded && incomingAttackAttentionCount > 0;
        } else if (panel.type === 'activity') {
          nextAlert = !panel.expanded && (activityUnreadCount > 0 || activityAttentionCount > 0);
        } else if (panel.type === 'messages') {
          nextAlert = !panel.expanded && Number(battleReports?.total ?? 0) > 0;
        }

        if (nextAlert === panel.alert) {
          return panel;
        }
        return {
          ...panel,
          alert: nextAlert,
        };
      }),
    );
  }, [
    activityAttentionCount,
    activityUnreadCount,
    battleReports?.total,
    incomingAttackAttentionCount,
  ]);

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
    setIsVillageHotkeyMode(false);
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
    setIsVillageHotkeyMode(false);
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

  useEffect(() => {
    if (!isVillageMenuOpen || !isVillageHotkeyMode) {
      return;
    }
    const selectedNode = villageMenuOverlayRef.current?.querySelector(
      `[data-village-hotkey-index="${villageHotkeyIndex}"]`,
    ) as HTMLElement | null;
    selectedNode?.scrollIntoView({ block: 'nearest' });
  }, [isVillageHotkeyMode, isVillageMenuOpen, villageHotkeyIndex]);

  const getStretchedPanelFrame = useCallback((viewportWidth: number, viewportHeight: number) => {
    const canvasNode = canvasRef.current;
    const leftPinNode = canvasNode?.querySelector('.pin-column.left') as HTMLElement | null;
    const rightPinNode = canvasNode?.querySelector('.pin-column.right') as HTMLElement | null;
    const pinClearance = 12;

    const leftPinEnd = shouldReservePinColumnsSpace && leftPinNode
      ? Math.floor(leftPinNode.offsetLeft + leftPinNode.offsetWidth + pinClearance)
      : 8;
    const rightPinStart = shouldReservePinColumnsSpace && rightPinNode
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
  }, [shouldReservePinColumnsSpace]);

  const openPanel = useCallback((type: StaticPanelType) => {
    setActivePanelId(type);
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const panelVillageName =
      type === 'city' || type === 'map' || type === 'army' || type === 'commands'
        ? currentVillageName
        : undefined;
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

  useEffect(() => {
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const stretchedFrame = getStretchedPanelFrame(viewportWidth, viewportHeight);
    let nextMapSize: WindowSize | null = null;

    setPanels((previous) => {
      let changed = false;
      const nextPanels = previous.map((panel) => {
        if (!panel.expanded || !DEFAULT_STRETCHED_PANEL_TYPES.has(panel.type as StaticPanelType)) {
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
        if (stretched !== panel) {
          changed = true;
          if (panel.type === 'map') {
            nextMapSize = { width: stretched.width, height: stretched.height };
          }
        }
        return stretched;
      });
      return changed ? nextPanels : previous;
    });

    if (nextMapSize) {
      mapWindowSizeRef.current = nextMapSize;
      saveMapWindowSize(nextMapSize);
    }
  }, [arePinColumnsVisible, getCanvasViewportSize, getStretchedPanelFrame, shouldReservePinColumnsSpace]);

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
      openPanel('commands');
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

  const ensurePlayerAvatarLoaded = useCallback(
    (targetUsernameRaw: string) => {
      const targetUsername = String(targetUsernameRaw ?? '').trim();
      if (!targetUsername) {
        return;
      }
      const key = targetUsername.toLocaleLowerCase('cs-CZ');
      const existingState = playerAvatarByUsername[key];
      if (existingState?.loaded) {
        return;
      }
      if (targetUsername.toLocaleLowerCase('cs-CZ') === username.toLocaleLowerCase('cs-CZ')) {
        setPlayerAvatarByUsername((previous) => ({
          ...previous,
          [key]: {
            avatarUrl: myAvatarUrl,
            loaded: true,
          },
        }));
        return;
      }

      setPlayerAvatarByUsername((previous) => ({
        ...previous,
        [key]: {
          avatarUrl: previous[key]?.avatarUrl ?? null,
          loaded: false,
        },
      }));

      void fetchCommunicationTokenSuggestions(username, {
        tokenType: 'user',
        query: targetUsername,
        limit: 12,
      })
        .then((response) => {
          const exact = (response.suggestions ?? []).find(
            (suggestion) =>
              suggestion.kind === 'user' &&
              String(suggestion.value ?? '').slice(1).toLocaleLowerCase('cs-CZ') === key,
          );
          setPlayerAvatarByUsername((previous) => ({
            ...previous,
            [key]: {
              avatarUrl: exact && exact.kind === 'user' ? exact.avatarUrl ?? null : null,
              loaded: true,
            },
          }));
        })
        .catch(() => {
          setPlayerAvatarByUsername((previous) => ({
            ...previous,
            [key]: {
              avatarUrl: previous[key]?.avatarUrl ?? null,
              loaded: true,
            },
          }));
        });
    },
    [myAvatarUrl, playerAvatarByUsername, username],
  );

  const openPlayerProfilePanel = useCallback((targetUsername: string) => {
    if (!targetUsername) {
      return;
    }
    ensurePlayerAvatarLoaded(targetUsername);

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
  }, [ensurePlayerAvatarLoaded, getCanvasViewportSize]);

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
    openPanel('research');
  }, [openPanel]);

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

  const closePanel = useCallback((id: string) => {
    setActivePanelId((previous) => (previous === id ? null : previous));
    setPanels((previous) => previous.filter((panel) => panel.id !== id));
  }, []);

  const closePinnedPanelsOnSide = useCallback((side: PinSide) => {
    setPanels((previous) => {
      const removedPanelIds = previous.filter((panel) => panel.side === side).map((panel) => panel.id);
      if (removedPanelIds.length <= 0) {
        return previous;
      }
      const removedSet = new Set(removedPanelIds);
      setActivePanelId((activeId) => (activeId != null && removedSet.has(activeId) ? null : activeId));
      return previous.filter((panel) => panel.side !== side);
    });
  }, []);

  const togglePinColumnsVisibility = useCallback(() => {
    if (autoHidePinColumns) {
      setIsPinColumnsOverlayVisible((previous) => !previous);
      return;
    }
    setIsPinColumnsTemporarilyHidden((previous) => !previous);
  }, [autoHidePinColumns]);

  const stretchPanelToViewport = useCallback(
    (id: string) => {
      const canvasNode = canvasRef.current;
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      let nextMapSize: WindowSize | null = null;

      const leftPinNode = canvasNode?.querySelector('.pin-column.left') as HTMLElement | null;
      const rightPinNode = canvasNode?.querySelector('.pin-column.right') as HTMLElement | null;
      const pinClearance = 12;

      const leftPinEnd = shouldReservePinColumnsSpace && leftPinNode
        ? Math.floor(leftPinNode.offsetLeft + leftPinNode.offsetWidth + pinClearance)
        : 8;
      const rightPinStart = shouldReservePinColumnsSpace && rightPinNode
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
    [getCanvasViewportSize, shouldReservePinColumnsSpace],
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

  const switchSide = useCallback((id: string) => {
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
  }, []);

  const movePinToSideAndMinimize = useCallback((id: string, side: PinSide) => {
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
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTouchDevice) {
        return;
      }
      if (isTypingElement(event.target)) {
        return;
      }

      const matchedPanelShortcutActionId = PANEL_SHORTCUT_ACTION_IDS.find((actionId) =>
        doesShortcutMatchEvent(event, shortcutBindings[actionId]),
      );
      if (matchedPanelShortcutActionId) {
        event.preventDefault();
        openPanel(PANEL_SHORTCUT_ACTION_TO_PANEL_TYPE[matchedPanelShortcutActionId]);
        return;
      }

      if (doesShortcutMatchEvent(event, shortcutBindings.openVillageSwitchMode)) {
        event.preventDefault();
        if (playerVillages.length <= 0) {
          return;
        }
        if (isVillageHotkeyMode) {
          closeVillageMenu();
          return;
        }

        const activeIndex = Math.max(
          0,
          playerVillages.findIndex((village) => village.id === activeVillageResolvedId),
        );
        setVillageHotkeyIndex(activeIndex);
        updateVillageMenuPosition();
        setVillageMenuOpen(true);
        setIsVillageHotkeyMode(true);
        return;
      }

      if (isVillageHotkeyMode && isVillageMenuOpen) {
        const key = normalizeShortcutKey(event.key);
        if (key === 'escape') {
          event.preventDefault();
          closeVillageMenu();
          return;
        }
        if (key === 'w' || key === 'arrowup') {
          event.preventDefault();
          setVillageHotkeyIndex((previous) =>
            playerVillages.length <= 0 ? 0 : (previous - 1 + playerVillages.length) % playerVillages.length,
          );
          return;
        }
        if (key === 's' || key === 'arrowdown') {
          event.preventDefault();
          setVillageHotkeyIndex((previous) =>
            playerVillages.length <= 0 ? 0 : (previous + 1) % playerVillages.length,
          );
          return;
        }
        if (key === 'f' || key === 'enter') {
          event.preventDefault();
          const selectedVillage = playerVillages[villageHotkeyIndex];
          if (!selectedVillage) {
            return;
          }
          applyActiveVillageSelection(selectedVillage.id);
          closeVillageMenu();
          return;
        }

        event.preventDefault();
        return;
      }

      if (doesShortcutMatchEvent(event, shortcutBindings.peekPinColumnsWhileHeld)) {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        setIsPinColumnsHoldVisible((previous) => !previous);
        return;
      }

      const matchedAction = SHORTCUT_ACTIONS.find((action) =>
        action.id !== 'peekPinColumnsWhileHeld' &&
        doesShortcutMatchEvent(event, shortcutBindings[action.id]),
      );
      if (!matchedAction) {
        return;
      }

      if (matchedAction.id === 'togglePinColumns') {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        togglePinColumnsVisibility();
        return;
      }

      const activePanel = panels.find((panel) => panel.id === activePanelId && panel.expanded);
      if (!activePanel) {
        return;
      }

      event.preventDefault();
      if (matchedAction.id === 'pinActivePanelLeft') {
        movePinToSideAndMinimize(activePanel.id, 'left');
      } else if (matchedAction.id === 'pinActivePanelRight') {
        movePinToSideAndMinimize(activePanel.id, 'right');
      } else if (matchedAction.id === 'switchActivePanelSide') {
        switchSide(activePanel.id);
      } else if (matchedAction.id === 'closeActivePanel') {
        closePanel(activePanel.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePanelId,
    activeVillageResolvedId,
    applyActiveVillageSelection,
    closePanel,
    closeVillageMenu,
    isTouchDevice,
    isVillageHotkeyMode,
    isVillageMenuOpen,
    movePinToSideAndMinimize,
    openPanel,
    panels,
    playerVillages,
    shortcutBindings,
    switchSide,
    togglePinColumnsVisibility,
    updateVillageMenuPosition,
    villageHotkeyIndex,
  ]);

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
          selectedWorldId,
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
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
  );

  const handleRecruitInVillage = useCallback(
    async (
      villageIdRaw: number,
      unitIdRaw: string,
      amountRaw: number,
    ): Promise<string> => {
      const villageId = Math.max(0, Math.floor(Number(villageIdRaw)));
      const unitId = String(unitIdRaw ?? '').trim();
      const amount = Math.max(0, Math.floor(Number(amountRaw)));
      if (!villageId || !unitId || amount <= 0) {
        return 'Neplatné parametry náboru.';
      }

      try {
        const nextState = await recruitUnit(
          username,
          unitId,
          amount,
          villageId,
          selectedWorldId,
        );
        if ((gameState?.village.id ?? activeVillageId) === villageId) {
          applyIncomingGameState(nextState);
          void loadGameState(true, true);
        }
        const unitLabel = getUnitMetaById(unitId).fallbackName;
        return `Léno #${villageId}: nábor ${unitLabel} +${amount.toLocaleString('cs-CZ')} spuštěn.`;
      } catch (error) {
        return getErrorMessage(error);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
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
          selectedWorldId,
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
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
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
      manualTargetCoordX?: number;
      manualTargetCoordY?: number;
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
          worldId: selectedWorldId,
          targetVillageId: payload.targetVillageId,
          manualTargetCoordX: payload.manualTargetCoordX,
          manualTargetCoordY: payload.manualTargetCoordY,
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
        const nightWarning =
          payload.commandType === 'attack' && response.result.arrivesDuringNightMode
            ? ' Cíl je v nočním režimu (+100 % obrana).'
            : '';
        setArmyCommandNotice(
          `Rozkaz ${ARMY_COMMAND_LABELS[payload.commandType]} byl odeslán. ETA ${etaLabel}.${nightWarning}`,
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
      selectedWorldId,
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
          worldId: selectedWorldId,
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
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
  );

  const handleCancelArmyCommand = useCallback(
    async (movementId: number) => {
      if (!Number.isFinite(movementId) || movementId <= 0) {
        return;
      }
      setArmyCommandPending(true);
      setArmyCommandNotice(null);

      try {
        const response = await cancelArmyCommandRequest(
          username,
          movementId,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        const etaLabel = response.result.returnDurationSec > 0
          ? formatDurationLabel(response.result.returnDurationSec)
          : 'okamžitě';
        setArmyCommandNotice(`Rozkaz zrušen. Jednotky se vrací (${etaLabel}).`);
        void loadGameState(true, true);
      } catch (error) {
        setArmyCommandNotice(getErrorMessage(error));
      } finally {
        setArmyCommandPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleHireAcademics = useCallback(
    async (amount: number): Promise<boolean> => {
      const normalizedAmount = Math.max(1, Math.floor(Number(amount ?? 1)));
      setResearchActionPending(true);
      setResearchNotice(null);
      try {
        const response = await hireAcademicsRequest(
          username,
          normalizedAmount,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        setResearchNotice(
          `Najato akademiků: ${response.result.hired.toLocaleString('cs-CZ')} (cena ${response.result.totalCoinCost.toLocaleString('cs-CZ')} mincí).`,
        );
        void loadGameState(true, true);
        return true;
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
        return false;
      } finally {
        setResearchActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleStartResearchProject = useCallback(
    async (researchId: string, academics: number) => {
      const normalizedResearchId = String(researchId ?? '').trim();
      if (!normalizedResearchId) {
        return;
      }
      const normalizedAcademics = Math.max(1, Math.floor(Number(academics ?? 1)));
      setResearchActionPending(true);
      setResearchNotice(null);
      try {
        const response = await startResearchProjectRequest(
          username,
          normalizedResearchId,
          normalizedAcademics,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        setResearchNotice(
          `Výzkum spuštěn: ${response.result.researchName} (akademici ${response.result.assignedAcademics}, cena ${response.result.coinCostPaid.toLocaleString('cs-CZ')} mincí).`,
        );
        void loadGameState(true, true);
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
      } finally {
        setResearchActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleAdjustResearchAcademics = useCallback(
    async (researchId: string, delta: number): Promise<boolean> => {
      const normalizedResearchId = String(researchId ?? '').trim();
      const normalizedDelta = Math.trunc(Number(delta ?? 0));
      if (!normalizedResearchId || normalizedDelta === 0) {
        return false;
      }

      setResearchActionPending(true);
      setResearchNotice(null);
      try {
        const response = await adjustResearchProjectAcademicsRequest(
          username,
          normalizedResearchId,
          normalizedDelta,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        const deltaLabel =
          response.result.deltaApplied >= 0
            ? `+${response.result.deltaApplied.toLocaleString('cs-CZ')}`
            : response.result.deltaApplied.toLocaleString('cs-CZ');
        setResearchNotice(
          `${response.result.researchName}: změna akademiků ${deltaLabel}, nyní ${response.result.assignedAcademics.toLocaleString('cs-CZ')}.`,
        );
        void loadGameState(true, true);
        return true;
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
        return false;
      } finally {
        setResearchActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleHireMercenaries = useCallback(async () => {
    setMercenaryActionPending(true);
    setResearchNotice(null);
    try {
      const response = await hireMercenaryContractRequest(
        username,
        gameState?.village.id ?? activeVillageId,
        selectedWorldId,
      );
      applyIncomingGameState(response.data);
      setResearchNotice(
        `Žoldáci najati. Dorazí za 30 minut do ${new Date(response.result.arriveAt).toLocaleString('cs-CZ')}.`,
      );
      void loadGameState(true, true);
    } catch (error) {
      setResearchNotice(getErrorMessage(error));
    } finally {
      setMercenaryActionPending(false);
    }
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username]);

  const handleSendMarketLogistics = useCallback(
    async (payload: { targetVillageId: number; wood: number; stone: number; iron: number }) => {
      setLogisticsActionPending(true);
      setResearchNotice(null);
      try {
        const response = await sendMarketLogisticsRequest(username, {
          targetVillageId: payload.targetVillageId,
          wood: payload.wood,
          stone: payload.stone,
          iron: payload.iron,
          villageId: gameState?.village.id ?? activeVillageId,
          worldId: selectedWorldId,
        });
        applyIncomingGameState(response.data);
        setResearchNotice(
          `Logistická zásilka #${response.result.routeId} odeslána. ETA ${formatDurationLabel(response.result.durationSec)}.`,
        );
        void loadGameState(true, true);
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
      } finally {
        setLogisticsActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
          selectedWorldId,
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
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
  );

  const handleRenameVillage = useCallback(
    async (nextNameRaw: string): Promise<string> => {
      const nextName = String(nextNameRaw ?? '').trim();
      if (!nextName) {
        return 'Zadej nový název léna.';
      }
      if (nextName.length > 14) {
        return 'Název léna může mít maximálně 14 znaků (bez souřadnic).';
      }

      setRenameVillagePending(true);
      try {
        const response = await renameVillageRequest(
          username,
          nextName,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId ?? gameState?.world.id ?? null,
        );
        applyIncomingGameState(response.data);
        void loadGameState(true, true);
        if (!response.result.renamed) {
          return `Název léna je beze změny: ${response.result.newName}.`;
        }
        return `Léno přejmenováno: ${response.result.previousName} → ${response.result.newName}.`;
      } catch (error) {
        return getErrorMessage(error);
      } finally {
        setRenameVillagePending(false);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      gameState?.village.id,
      gameState?.world.id,
      loadGameState,
      selectedWorldId,
      username,
    ],
  );

  const handleUpgradeBuildingInVillage = useCallback(
    async (villageIdRaw: number, buildingIdRaw: string): Promise<string> => {
      const villageId = Math.max(0, Math.floor(Number(villageIdRaw)));
      const buildingId = String(buildingIdRaw ?? '').trim();
      if (!villageId || !buildingId) {
        return 'Neplatné parametry výstavby.';
      }

      try {
        const nextState = await upgradeBuilding(username, buildingId, villageId, selectedWorldId);
        if ((gameState?.village.id ?? activeVillageId) === villageId) {
          applyIncomingGameState(nextState);
          void loadGameState(true, true);
        }
        const buildingLabel = BUILDING_ART[buildingId]?.fallbackName ?? buildingId;
        return `Léno #${villageId}: ${buildingLabel} bylo zařazeno do výstavby.`;
      } catch (error) {
        return getErrorMessage(error);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
        selectedWorldId,
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
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username]);

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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleLeaveKingdom = useCallback(async () => {
    setKingdomActionPending(true);
    setKingdomNotice(null);

    try {
      const response = await leaveKingdomRequest(
        username,
        gameState?.village.id ?? activeVillageId,
        selectedWorldId,
      );
      const nextState = response.data;
      applyIncomingGameState(nextState);
      setKingdomNotice(`Opustil jsi království ${response.result.previousKingdom}.`);
      void loadGameState(true, true);
    } catch (error) {
      setKingdomNotice(getErrorMessage(error));
    } finally {
      setKingdomActionPending(false);
    }
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username]);

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
          selectedWorldId,
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
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleTransferKingdomLeadership = useCallback(
    async (targetUsername: string) => {
      const normalizedTarget = targetUsername.trim();
      if (!normalizedTarget) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await transferKingdomLeadershipRequest(
          username,
          normalizedTarget,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        setKingdomNotice(`Titul Krále byl předán hráči ${response.result.newLeaderUsername}.`);
        void loadGameState(true, true);
      } catch (error) {
        setKingdomNotice(getErrorMessage(error));
      } finally {
        setKingdomActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleChangeFontScale = useCallback((option: GameFontScaleOption) => {
    setGameFontScaleDraft(option);
    setSettingsNotice(null);
  }, []);

  const handleSaveFontScale = useCallback(() => {
    saveStoredGameFontScaleOption(username, gameFontScaleDraft);
    setGameFontScaleOption(gameFontScaleDraft);
    setSettingsNotice(
      `Nastavení fontu uloženo (${GAME_FONT_SCALE_PERCENT_BY_OPTION[gameFontScaleDraft]} %).`,
    );
  }, [gameFontScaleDraft, username]);

  const handleShortcutCapture = useCallback((actionId: ShortcutActionId, binding: ShortcutBinding) => {
    const normalized = normalizeShortcutBinding(binding);
    if (!normalized.key || isModifierOnlyShortcutKey(normalized.key)) {
      setShortcutNotice('Neplatná zkratka. Zkus kombinaci s konkrétní klávesou.');
      return;
    }
    if (isReservedShortcutBinding(normalized)) {
      setShortcutNotice('Tuto zkratku nelze použít, je rezervovaná pro prohlížeč.');
      return;
    }
    setShortcutCustomBindings((previous) => ({
      ...previous,
      [actionId]: normalized,
    }));
    setShortcutNotice(
      `Uloženo: ${SHORTCUT_ACTIONS.find((action) => action.id === actionId)?.label ?? actionId} = ${formatShortcutBindingLabel(normalized)}.`,
    );
  }, []);

  const handleShortcutResetOne = useCallback((actionId: ShortcutActionId) => {
    setShortcutCustomBindings((previous) => {
      const next = { ...previous };
      delete next[actionId];
      return next;
    });
    setShortcutNotice(
      `Zkratka pro "${SHORTCUT_ACTIONS.find((action) => action.id === actionId)?.label ?? actionId}" byla vrácena na default.`,
    );
  }, []);

  const handleShortcutResetAll = useCallback(() => {
    setShortcutCustomBindings({});
    setShortcutNotice('Všechny vlastní zkratky byly vráceny na výchozí nastavení.');
  }, []);

  const handleAutoHidePinColumnsChange = useCallback((enabled: boolean) => {
    setAutoHidePinColumns(enabled);
    setIsPinColumnsOverlayVisible(false);
    setIsPinColumnsTemporarilyHidden(false);
    setShortcutNotice(
      enabled
        ? 'Mizející režim aktivní. Pin sloupce jsou skryté a zobrazují se jako overlay.'
        : 'Mizející režim vypnut. Pin sloupce jsou opět statické.',
    );
  }, []);

  const handleSaveAvatar = useCallback(
    async (nextAvatarUrl: string | null): Promise<string> => {
      setAvatarPending(true);
      setSettingsNotice(null);
      try {
        const response = await setCommunicationAvatarRequest(username, nextAvatarUrl);
        const savedAvatarUrl = response.result.avatarUrl ?? null;
        setMyAvatarUrl(savedAvatarUrl);
        setPlayerAvatarByUsername((previous) => ({
          ...previous,
          [username.toLocaleLowerCase('cs-CZ')]: {
            avatarUrl: savedAvatarUrl,
            loaded: true,
          },
        }));
        return savedAvatarUrl ? 'Avatar byl ulozen.' : 'Avatar byl odebran.';
      } catch (error) {
        return getErrorMessage(error);
      } finally {
        setAvatarPending(false);
      }
    },
    [username],
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
      const response = await restartVillageProgressRequest(
        username,
        gameState?.village.id ?? activeVillageId,
        selectedWorldId,
      );
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
  }, [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [navigate]);

  const handleLeaveWorld = useCallback(() => {
    setSelectedWorld('');
    navigate('/worlds', { replace: true });
  }, [navigate]);

  const handleSwitchWorld = useCallback(
    (worldId: string) => {
      const nextWorldId = String(worldId ?? '').trim();
      if (!nextWorldId) {
        return;
      }
      setSelectedWorld(nextWorldId);
      setIsWorldMenuOpen(false);
      navigate('/worlds', { replace: true });
    },
    [navigate],
  );

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

  const runActivityMutation = useCallback(
    async (mutation: () => Promise<unknown>) => {
      setActivityActionPending(true);
      try {
        await mutation();
        await loadActivity(true);
      } catch (error) {
        setActivityError(getErrorMessage(error));
      } finally {
        setActivityActionPending(false);
      }
    },
    [loadActivity],
  );

  const handleActivityPageChange = useCallback((page: number) => {
    if (!Number.isFinite(page)) {
      return;
    }
    setActivityPage(Math.max(1, Math.floor(page)));
  }, []);

  const handleActivityRefresh = useCallback(() => {
    void loadActivity(false);
  }, [loadActivity]);

  const handleToggleActivityArchivedFilter = useCallback(() => {
    setActivityIncludeArchived((previous) => !previous);
    setActivityPage(1);
  }, []);

  const handleToggleActivityMilitaryFilter = useCallback(() => {
    setActivityMilitaryOnly((previous) => !previous);
    setActivityPage(1);
  }, []);

  const handleMarkAllActivityRead = useCallback(() => {
    void runActivityMutation(() => markAllGameActivityRead(username, selectedWorldId));
  }, [runActivityMutation, selectedWorldId, username]);

  const handleMarkActivityRead = useCallback(
    (notificationId: number) => {
      void runActivityMutation(() => markGameActivityRead(username, notificationId, selectedWorldId));
    },
    [runActivityMutation, selectedWorldId, username],
  );

  const handleArchiveActivity = useCallback(
    (notificationId: number) => {
      void runActivityMutation(() => archiveGameActivity(username, notificationId, selectedWorldId));
    },
    [runActivityMutation, selectedWorldId, username],
  );

  const handleUnarchiveActivity = useCallback(
    (notificationId: number) => {
      void runActivityMutation(() => unarchiveGameActivity(username, notificationId, selectedWorldId));
    },
    [runActivityMutation, selectedWorldId, username],
  );

  const handleDeleteActivity = useCallback(
    (notificationId: number) => {
      void runActivityMutation(() => deleteGameActivity(username, notificationId, selectedWorldId));
    },
    [runActivityMutation, selectedWorldId, username],
  );

  const handleShareActivity = useCallback(
    (item: GameActivityItem) => {
      setActivityShareItem(item);
      setActivityShareQuery('');
      setActivityShareSuggestions([]);
      setActivityShareError(null);
    },
    [],
  );

  const handleSendActivityShare = useCallback(
    async (targetUsernameRaw: string) => {
      if (!activityShareItem) {
        return;
      }
      const targetUsername = String(targetUsernameRaw ?? '').trim();
      if (!targetUsername) {
        setActivityShareError('Vyber hráče, kterému chceš oznámení poslat.');
        return;
      }

      setActivitySharePending(true);
      setActivityShareError(null);
      try {
        const share = await createCommunicationNotificationShare(username, {
          notificationId: activityShareItem.id,
          worldId: selectedWorldId,
        });
        await sendCommunicationMessageRequest(username, {
          targetUsername,
          body: `Sdílené oznámení: ${activityShareItem.title}`,
          payload: {
            kind: 'notification-share',
            shareToken: share.shareToken,
            notificationId: share.notification.id,
            label: activityShareItem.title,
            reportId: Number(share.notification.payload?.reportId ?? 0) || null,
          },
        });
        openCommunicationHub();
        openCommunicationThreadByUsername(targetUsername);
        setActivityShareItem(null);
        setActivityShareQuery('');
        setActivityShareSuggestions([]);
      } catch (shareError) {
        setActivityShareError(getErrorMessage(shareError));
      } finally {
        setActivitySharePending(false);
      }
    },
    [activityShareItem, selectedWorldId, username],
  );

  useEffect(() => {
    const onCommunicationTokenClick = (event: Event) => {
      const detail = (
        event as CustomEvent<{ token?: string; shareToken?: string | null; reportId?: number | null }>
      ).detail;
      const token = String(detail?.token ?? '').trim();
      if (!token) {
        return;
      }

      const notificationMatch = token.match(/^\/\/Ozn[aá]men[ií]:(\d+)$/i);
      if (notificationMatch) {
        const reportIdRaw = Number(detail?.reportId ?? 0);
        const reportId =
          Number.isFinite(reportIdRaw) && reportIdRaw > 0 ? Math.floor(reportIdRaw) : null;
        if (reportId != null && battleReportsById.has(reportId)) {
          openBattleReportPanel(reportId);
          return;
        }
        const shareToken = String(detail?.shareToken ?? '').trim();
        if (shareToken) {
          void (async () => {
            try {
              const preview = await fetchCommunicationNotificationSharePreview(username, shareToken);
              const sharedReport = preview.battleReport ?? null;
              if (preview.available && !preview.deleted && sharedReport) {
                setBattleReportCacheById((previous) => ({
                  ...previous,
                  [sharedReport.id]: sharedReport,
                }));
                openBattleReportPanel(sharedReport.id);
                return;
              }
            } catch {
              // fallback to activity panel below
            }
            setActivityLastOpenedAt(new Date().toISOString());
            openPanel('activity');
          })();
          return;
        }
        setActivityLastOpenedAt(new Date().toISOString());
        openPanel('activity');
        return;
      }

      if (token.startsWith('#')) {
        const kingdomName = token.slice(1).trim();
        if (!kingdomName) {
          return;
        }
        openKingdomProfilePanel(kingdomName);
        return;
      }

      if (token.startsWith('@')) {
        const targetUsername = token.slice(1).trim();
        if (!targetUsername) {
          return;
        }
        openPlayerProfilePanel(targetUsername);
        return;
      }

      const villageMatch = token.match(/^_(\d{1,4})\|(\d{1,4})_$/);
      if (villageMatch) {
        const targetX = Number(villageMatch[1]);
        const targetY = Number(villageMatch[2]);
        const matchedSettlement = mapSettlements.find(
          (settlement) =>
            Number(settlement.globalX) === targetX &&
            Number(settlement.globalY) === targetY &&
            Number.isFinite(Number(settlement.villageId ?? 0)) &&
            Number(settlement.villageId ?? 0) > 0,
        );
        if (matchedSettlement?.villageId) {
          openSettlementByVillageId(matchedSettlement.villageId);
          return;
        }
        setStateError(`Léno ${targetX}|${targetY} nebylo v tomto světě nalezeno.`);
      }
    };

    window.addEventListener('tld:communication:token-click', onCommunicationTokenClick as EventListener);
    return () => {
      window.removeEventListener('tld:communication:token-click', onCommunicationTokenClick as EventListener);
    };
  }, [
    mapSettlements,
    battleReportsById,
    openBattleReportPanel,
    openKingdomProfilePanel,
    openPanel,
    openPlayerProfilePanel,
    openSettlementByVillageId,
    username,
  ]);

  useEffect(() => {
    if (!activityShareItem) {
      return;
    }
    const query = activityShareQuery.trim();
    if (!query) {
      setActivityShareSuggestions([]);
      setActivityShareLoading(false);
      return;
    }

    let cancelled = false;
    setActivityShareLoading(true);
    void fetchCommunicationTokenSuggestions(username, {
      tokenType: 'user',
      query,
      limit: 15,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const suggestions = (response.suggestions ?? [])
          .filter((item) => item.kind === 'user')
          .map((item) => ({
            username: String(item.value ?? '').replace(/^@/, ''),
            relation: String(item.relation ?? 'stranger'),
          }))
          .sort((left, right) => {
            const relationOrder = (relation: string): number => {
              if (relation === 'friend') {
                return 0;
              }
              if (relation === 'kingdom') {
                return 1;
              }
              return 2;
            };
            const relationDiff = relationOrder(left.relation) - relationOrder(right.relation);
            if (relationDiff !== 0) {
              return relationDiff;
            }
            return left.username.localeCompare(right.username, 'cs');
          });
        setActivityShareSuggestions(suggestions);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setActivityShareError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setActivityShareLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activityShareItem, activityShareQuery, username]);

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
            armyMovementOrders={cityPanelArmyOrders}
            recruitQueueOrders={recruitQueueOrders}
            onOpenBuilding={openBuildingPanel}
            onOpenArmyRecruitment={() => openPanel('army')}
            onRenameVillage={handleRenameVillage}
            onUpgradeBuilding={handleBuildingUpgrade}
            onCancelBuildingUpgrade={handleCancelBuildingUpgrade}
            onCancelRecruitment={handleCancelRecruitment}
            buildingUpgradeQueueByBuilding={buildingUpgradeQueueByBuilding}
            upgradePendingBuildingId={upgradePendingBuildingId}
            isRenameVillagePending={renameVillagePending}
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
            buildings={buildings}
            recruitQueueOrders={recruitQueueOrders}
            settlements={mapSettlements}
            currentUsername={username}
            onRecruit={handleRecruit}
            onCancelRecruitment={handleCancelRecruitment}
            onUpgradeBuilding={handleBuildingUpgrade}
            onUpgradeBuildingInVillage={handleUpgradeBuildingInVillage}
            onRecruitInVillage={handleRecruitInVillage}
            onOpenSettlementByVillageId={openSettlementByVillageId}
            recruitPendingUnitId={recruitPendingUnitId}
            cancelRecruitmentPendingId={cancelRecruitmentPendingId}
            upgradePendingBuildingId={upgradePendingBuildingId}
            notice={armyNotice}
            noticeUnitId={armyNoticeUnitId}
          />
        );
      case 'military':
        return (
          <MilitaryPanel
            units={units}
            activeMovements={armyActiveMovements}
            incomingMovements={armyIncomingMovements}
            stationedSupports={armyStationedSupports}
            currentVillageName={villageLabel}
          />
        );
      case 'commands':
        return (
          <CommandsPanel
            activeMovements={armyActiveMovements}
            incomingMovements={armyIncomingMovements}
            stationedSupports={armyStationedSupports}
            activeUpgrades={gameState?.activeUpgrades ?? []}
            activeRecruitments={gameState?.activeRecruitments ?? []}
            units={units}
            settlements={mapSettlements}
            market={gameState?.market}
            resources={gameState?.resources}
            currentVillageId={gameState?.village.id ?? activeVillageId}
            currentUsername={username}
            commandHistory={currentVillageCommandHistory}
            recentAttackTargets={gameState?.army.recentAttackTargets ?? []}
            quickSelection={armyQuickSelection}
            onIssueArmyCommand={handleIssueArmyCommand}
            onCancelArmyCommand={handleCancelArmyCommand}
            onReturnSupport={handleReturnSupport}
            isArmyCommandPending={armyCommandPending}
            logisticsActionPending={logisticsActionPending}
            commandNotice={armyCommandNotice}
            onSendMarketLogistics={handleSendMarketLogistics}
            onOpenSettlementByVillageId={openSettlementByVillageId}
          />
        );
      case 'research':
        return (
          <ResearchPanel
            research={gameState?.research}
            mercenaries={gameState?.mercenaries}
            rules={gameState?.rules}
            resources={gameState?.resources}
            notice={researchNotice}
            researchActionPending={researchActionPending}
            mercenaryActionPending={mercenaryActionPending}
            onHireAcademics={handleHireAcademics}
            onAdjustResearchAcademics={handleAdjustResearchAcademics}
            onStartResearchProject={handleStartResearchProject}
            onHireMercenaries={handleHireMercenaries}
          />
        );
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
      case 'activity':
        return (
          <ActivityPanel
            activity={activityEntries}
            loading={activityLoading}
            error={activityError}
            includeArchived={activityIncludeArchived}
            militaryOnly={activityMilitaryOnly}
            actionPending={activityActionPending}
            onSetPage={handleActivityPageChange}
            onToggleIncludeArchived={handleToggleActivityArchivedFilter}
            onToggleMilitaryOnly={handleToggleActivityMilitaryFilter}
            onRefresh={handleActivityRefresh}
            onMarkAllRead={handleMarkAllActivityRead}
            onMarkRead={handleMarkActivityRead}
            onArchive={handleArchiveActivity}
            onUnarchive={handleUnarchiveActivity}
            onDelete={handleDeleteActivity}
            onShare={handleShareActivity}
            onOpenBattleReport={openBattleReportPanel}
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
            onTransferLeadership={handleTransferKingdomLeadership}
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
            viewerUsername={username}
            username={panel.playerUsername}
            avatarUrl={
              playerAvatarByUsername[panel.playerUsername.toLocaleLowerCase('cs-CZ')]?.avatarUrl ?? null
            }
            rows={leaderboardRows}
            settlements={mapSettlements}
            onOpenSettlement={openSettlementPanel}
            onOpenKingdomProfile={openKingdomProfilePanel}
            onMessagePlayer={(targetUsername) => {
              openCommunicationHub();
              openCommunicationThreadByUsername(targetUsername);
            }}
            onSendFriendRequest={async (targetUsername) => {
              const normalizedTarget = String(targetUsername ?? '').trim();
              if (!normalizedTarget) {
                return 'Neplatný cíl žádosti o přátelství.';
              }
              if (normalizedTarget.toLocaleLowerCase('cs-CZ') === username.toLocaleLowerCase('cs-CZ')) {
                return 'Sám sebe nelze přidat do přátel.';
              }
              try {
                await sendCommunicationFriendRequest(username, normalizedTarget);
                return null;
              } catch (error) {
                return getErrorMessage(error);
              }
            }}
          />
        );
      }
      case 'profile':
        return (
          <ProfilePanel
            username={username}
            kingdom={gameState?.village.kingdom ?? 'Neznámé království'}
            prestige={gameState?.village.prestige ?? 0}
            villageCount={playerLeaderboardEntry?.villages ?? 1}
            rank={playerLeaderboardEntry?.rank ?? null}
            attackerRank={playerLeaderboardEntry?.attackerRank ?? null}
            defenderRank={playerLeaderboardEntry?.defenderRank ?? null}
            supporterRank={playerLeaderboardEntry?.supporterRank ?? null}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            username={username}
            avatarUrl={myAvatarUrl}
            avatarPending={avatarPending}
            onSaveAvatar={handleSaveAvatar}
            onRestartVillageProgress={handleRestartVillageProgress}
            fontScaleOption={gameFontScaleDraft}
            isFontScaleDirty={isGameFontScaleDirty}
            onFontScaleChange={handleChangeFontScale}
            onSaveFontScale={handleSaveFontScale}
            restartPending={restartVillagePending}
            notice={settingsNotice}
            shortcutBindings={shortcutBindings}
            customShortcutBindings={shortcutCustomBindings}
            autoHidePinColumns={autoHidePinColumns}
            shortcutNotice={shortcutNotice}
            isTouchDevice={isTouchDevice}
            onCaptureShortcut={handleShortcutCapture}
            onResetShortcutBinding={handleShortcutResetOne}
            onResetAllShortcuts={handleShortcutResetAll}
            onAutoHidePinColumnsChange={handleAutoHidePinColumnsChange}
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
            developerBoost={building.id === 'townhall' ? townhallDeveloperBoost : null}
            notice={buildingNotices[building.id] ?? null}
          />
        );
      }
      default:
        return null;
    }
  };

  if (!session || !selectedWorldId) {
    return null;
  }

  return (
    <div className="game-page">
      <div className="game-bg-layer" />
      <div className="game-grid-layer" />

      <header className="top-navigation">
        <div className="world-indicator-wrap">
          <div className="world-indicator">
            <span>Svět:</span> <strong>{selectedWorldName}</strong>
          </div>
          <small className="world-version-note">Aktuální verze hry 0.1.09</small>
        </div>
        <nav>
          {NAV_BUTTONS.map((button) => {
            const isPanelOpen = panels.some((panel) => panel.type === button.type && panel.expanded);
            const isOpen = button.type === 'messages' ? isPanelOpen || isCommunicationHubOpen : isPanelOpen;
            const infoText = menuInfoByType[button.type];
            return (
              <div key={button.type} className="nav-action-stack">
                <MenuButton
                  className={`nav-action nav-action--${button.type}`}
                  isOpen={isOpen}
                  onClick={() => {
                    if (button.type === 'messages') {
                      setIsCommunicationHubOpen(true);
                      openCommunicationHub();
                      return;
                    }
                    if (button.type === 'activity') {
                      setActivityLastOpenedAt(new Date().toISOString());
                    }
                    openPanel(button.type);
                  }}
                  title={`Otevřít panel: ${button.text}`}
                  glyph={button.glyph}
                  text={button.text}
                />
                {infoText ? <small className="nav-action-meta">{infoText}</small> : null}
              </div>
            );
          })}
        </nav>
        <div className="session-actions" ref={worldMenuRef}>
          <MenuButton
            className="quick-session-action"
            onClick={() => setIsWorldMenuOpen((previous) => !previous)}
            title="Otevřít nabídku změny světa"
            text="Změnit svět"
          />
          <MenuButton className="quick-session-action" onClick={handleLeaveWorld} title="Odejít ze světa" text="Odejít ze světa" />
          <MenuButton className="quick-session-action quick-logout" onClick={handleLogout} title="Odhlásit ze hry" text="Odhlásit" />
          {isWorldMenuOpen ? (
            <div className="world-switch-menu" role="menu" aria-label="Nabídka herních světů">
              <header>
                <h4>Změna světa</h4>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsWorldMenuOpen(false)}
                  aria-label="Zavřít nabídku změny světa"
                >
                  Zavřít
                </button>
              </header>
              <ul>
                {worldSwitchOptions.map((world) => {
                  const worldStatus = String(world.status).toLowerCase();
                  const isPlayable = worldStatus === 'online';
                  const isActive = world.id === selectedWorldId;
                  return (
                    <li key={`world-switch-${world.id}`}>
                      <button
                        type="button"
                        className={`world-switch-option ${isActive ? 'is-active' : ''}`}
                        disabled={!isPlayable}
                        onClick={() => handleSwitchWorld(world.id)}
                      >
                        <strong>{world.name}</strong>
                        <span>{isPlayable ? 'ONLINE' : 'UZAVŘENO'}</span>
                      </button>
                    </li>
                  );
                })}
                {worldSwitchOptions.length === 0 ? <li className="world-switch-empty">Světy se načítají...</li> : null}
              </ul>
              {worldMenuError ? <p className="world-switch-error">{worldMenuError}</p> : null}
            </div>
          ) : null}
        </div>
      </header>

      <section className="resource-strip">
        <div className="village-card-stack">
          <article className="resource-card village-resource-card" aria-label="Aktivní léno a seznam lén">
            <p>Aktivní léno</p>
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
          {activeVillageProtection ? (
            <div className={`village-protection-timer ${activeVillageProtection.isActive ? '' : 'is-expired'}`}>
              {activeVillageProtection.isActive
                ? `Nováčkovská ochrana: ${formatDurationLabel(activeVillageProtection.remainingSec)} (do ${activeVillageProtection.formattedUntil})`
                : `Nováčkovská ochrana vypršela (${activeVillageProtection.formattedUntil})`}
            </div>
          ) : null}
        </div>
        {resourceStocks.map((resource) => (
          (() => {
            const capacityPercent =
              resource.cap > 0 ? clamp((resource.amount / resource.cap) * 100, 0, 100) : 0;
            const resourceTone = resolveResourceTone(resource.name);
            const resourceGlyph = resolveResourceGlyph(resource.name);

            return (
              <button
                key={resource.name}
                type="button"
                className={`resource-card resource-card-split tone-${resourceTone}`}
                onClick={() => handleResourceCardClick(resource)}
                title={`Otevřít budovu: ${resource.name}`}
              >
                <div className="resource-card-left">
                  <p className="resource-slot-heading">
                    <span className="resource-slot-icon" aria-hidden="true">
                      {resourceGlyph.startsWith('/') ? (
                        <img src={resourceGlyph} alt="" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        resourceGlyph
                      )}
                    </span>
                    {resource.name}
                  </p>
                  <strong>{resource.amount.toLocaleString('cs-CZ')}</strong>
                  <span>{resource.delta}</span>
                  {resource.boostLabel ? <small className="resource-boost-note">{resource.boostLabel}</small> : null}
                  <small>Kapacita {resource.cap.toLocaleString('cs-CZ')}</small>
                  <div className="resource-capacity-meter" aria-hidden="true">
                    <span style={{ width: `${capacityPercent}%` }} />
                  </div>
                </div>
                <div className="resource-card-right">
                  <p>{resource.buildingName}</p>
                  <strong>Úroveň {resource.buildingLevel}</strong>
                  {resource.upgradeSummary ? (
                    <small className="resource-upgrade-note">{resource.upgradeSummary}</small>
                  ) : (
                    <small className="resource-upgrade-idle">Bez aktivního rozšíření</small>
                  )}
                  {resource.upgradeQueueCount > 0 ? (
                    <small className="resource-upgrade-queue">
                      Fronta: {resource.upgradeQueueCount.toLocaleString('cs-CZ')}{' '}
                      {formatCzechCountLabel(resource.upgradeQueueCount, 'položka', 'položky', 'položek')}
                    </small>
                  ) : null}
                </div>
              </button>
            );
          })()
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
              {Math.round(currentResearchTask.progressPercent)} % ·{' '}
              {currentResearchTask.status === 'researching'
                ? `akademici ${Math.max(0, Math.floor(Number(currentResearchTask.assignedAcademics ?? 0))).toLocaleString('cs-CZ')}`
                : currentResearchTask.status === 'available'
                  ? 'připraveno ke spuštění'
                  : 'dokončeno'}
            </span>
            <small>Klikni pro detail v panelu Výzkum</small>
            <small className="research-preparing-note">
              {currentResearchTask.status === 'researching'
                ? 'Projekt právě běží.'
                : currentResearchTask.status === 'available'
                  ? 'Čeká na přidělení akademiků.'
                  : 'Projekt je dokončený.'}
            </small>
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
          {isVillageHotkeyMode ? (
            <p className="village-menu-hotkey-hint">TAB režim · W/S výběr · F potvrdit · ESC zavřít</p>
          ) : null}
          <ul>
            {playerVillages.map((village, index) => {
              const isActive = activeVillageResolvedId === village.id;
              const isHotkeySelected = isVillageHotkeyMode && villageHotkeyIndex === index;
              return (
                <li key={`menu-village-${village.id}`}>
                  <button
                    type="button"
                    className={`village-menu-option ${isActive ? 'is-active' : ''} ${isHotkeySelected ? 'is-hotkey-selected' : ''}`}
                    data-village-hotkey-index={index}
                    onClick={() => {
                      applyActiveVillageSelection(village.id);
                      closeVillageMenu();
                    }}
                  >
                    <strong>{village.name}</strong>
                    <span>
                      {village.coordX}|{village.coordY} · Region {village.region}
                    </span>
                    {isHotkeySelected ? <em className="village-hotkey-selected-note">▶ Výběr TAB</em> : null}
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

      {activityShareItem ? (
        <div className="activity-share-overlay" role="dialog" aria-modal="true" aria-label="Sdílet oznámení">
          <section className="activity-share-dialog">
            <header>
              <h4>Sdílet oznámení</h4>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  if (activitySharePending) {
                    return;
                  }
                  setActivityShareItem(null);
                  setActivityShareQuery('');
                  setActivityShareSuggestions([]);
                  setActivityShareError(null);
                }}
                disabled={activitySharePending}
              >
                Zavřít
              </button>
            </header>
            <p>
              <strong>{activityShareItem.title}</strong>
            </p>
            <label>
              Vyhledat hráče
              <input
                type="text"
                value={activityShareQuery}
                onChange={(event) => {
                  setActivityShareQuery(event.target.value);
                  setActivityShareError(null);
                }}
                placeholder="Zadej nick hráče"
                maxLength={32}
                disabled={activitySharePending}
              />
            </label>
            {activityShareLoading ? <p className="row-help">Načítám hráče…</p> : null}
            {activityShareSuggestions.length > 0 ? (
              <ul className="activity-share-suggestion-list">
                {activityShareSuggestions.map((suggestion) => (
                  <li key={`activity-share-${suggestion.username}-${suggestion.relation}`}>
                    <button
                      type="button"
                      className={`secondary-action relation-${suggestion.relation}`}
                      onClick={() => {
                        void handleSendActivityShare(suggestion.username);
                      }}
                      disabled={activitySharePending}
                    >
                      @{suggestion.username}
                    </button>
                    <small>
                      {suggestion.relation === 'friend'
                        ? 'Přítel'
                        : suggestion.relation === 'kingdom'
                          ? 'Království'
                          : 'Cizí hráč'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : null}
            {activityShareError ? <p className="panel-feedback">{activityShareError}</p> : null}
            <div className="activity-item-actions">
              <button
                type="button"
                className="upgrade-action"
                onClick={() => {
                  void handleSendActivityShare(activityShareQuery);
                }}
                disabled={activitySharePending || !activityShareQuery.trim()}
              >
                {activitySharePending ? 'Odesílám…' : 'Odeslat sdílení'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className={gameCanvasClassName} ref={canvasRef}>
        {isTouchDevice ? (
          <button type="button" className="pin-columns-mobile-toggle" onClick={togglePinColumnsVisibility}>
            {arePinColumnsVisible ? 'Skrýt pin sloupce' : 'Zobrazit pin sloupce'}
          </button>
        ) : null}
        <aside className="pin-column left">
          <div className="pin-column-header">
            <h4>Připnuté (L)</h4>
            <button
              type="button"
              className="pin-column-close-all"
              onClick={() => closePinnedPanelsOnSide('left')}
              disabled={leftPins.length <= 0}
              title="Zavřít vše vlevo"
              aria-label="Zavřít vše vlevo"
            >
              ✕
            </button>
          </div>
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
          <div className="pin-column-header">
            <h4>Připnuté (P)</h4>
            <button
              type="button"
              className="pin-column-close-all"
              onClick={() => closePinnedPanelsOnSide('right')}
              disabled={rightPins.length <= 0}
              title="Zavřít vše vpravo"
              aria-label="Zavřít vše vpravo"
            >
              ✕
            </button>
          </div>
          <div className="pin-live-feed">
            <h5>Novinky</h5>
            <p>
              Nové záznamy: <strong>{activityNavBadgeCount.toLocaleString('cs-CZ')}</strong>
            </p>
            <p>
              Nepřečtené: {activityUnreadCount.toLocaleString('cs-CZ')} · Vyžaduje pozornost:{' '}
              {activityAttentionCount.toLocaleString('cs-CZ')}
            </p>
            <button
              type="button"
              className="secondary-action pin-feed-open"
              onClick={() => openPanel('activity')}
            >
              Otevřít Herní záznamy
            </button>
          </div>
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
