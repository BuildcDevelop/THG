import { memo, useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getSession, logout, setSelectedWorld } from '../auth';
import { GAME_VERSION_LABEL } from '../version';
import {
  acceptKingdomInvite as acceptKingdomInviteRequest,
  cancelArmyCommand as cancelArmyCommandRequest,
  cancelAllBuildingUpgrades as cancelAllBuildingUpgradesRequest,
  cancelBuildingUpgrade as cancelBuildingUpgradeRequest,
  cancelMarketLogistics as cancelMarketLogisticsRequest,
  cancelPlannerPlan as cancelPlannerPlanRequest,
  cancelRecruitment as cancelRecruitmentRequest,
  configureMarketGuildAutomation as configureMarketGuildAutomationRequest,
  createPlannerPlan as createPlannerPlanRequest,
  createCommunicationNotificationShare,
  createKingdom as createKingdomRequest,
  fetchBattleReportById,
  fetchBattleReportsSummary,
  fetchCommunicationInbox,
  fetchCommunicationNotificationSharePreview,
  fetchCommunicationTokenSuggestions,
  fetchGameActivitySummary,
  fetchGameActivity,
  fetchBattleReports,
  fetchArmyOverview,
  fetchGameState,
  fetchPlannerOpen,
  fetchWorldMapSnapshot,
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
  reconfirmPlannerPlan as reconfirmPlannerPlanRequest,
  recruitUnit,
  rebaseStationedSupport as rebaseStationedSupportRequest,
  reorderBuildingUpgradeQueue as reorderBuildingUpgradeQueueRequest,
  reorderRecruitmentQueue as reorderRecruitmentQueueRequest,
  renameVillage as renameVillageRequest,
  restartVillageProgress as restartVillageProgressRequest,
  sendMarketLogistics as sendMarketLogisticsRequest,
  sendCommunicationFriendRequest,
  sendCommunicationMessageRequest,
  startResearchProject as startResearchProjectRequest,
  setKingdomDiplomacy as setKingdomDiplomacyRequest,
  setCommunicationAvatarRequest,
  transferKingdomLeadership as transferKingdomLeadershipRequest,
  updatePlannerPlan as updatePlannerPlanRequest,
  upgradeBuilding,
  validatePlannerPlan as validatePlannerPlanRequest,
  type ArmyCommandType,
  type BattleReportItem,
  type ArmyMovementState,
  type ArmyOverviewResponse,
  type ArmyVillageSummary,
  type BattleReportListResponse,
  type BattleReportSummaryResponse,
  type BattleReportPayload,
  type GameActivityItem,
  type GameActivityListResponse,
  type GameActivitySummaryResponse,
  type DeveloperResourceBoostState,
  type GameBuildingState,
  type GameStateResponse,
  type GameUnitState,
  type KingdomHubState,
  type KingdomIncomingInvite,
  type KingdomAvailableSummary,
  type KingdomAuditLogEntry,
  type KingdomDiplomacyRelation,
  type KingdomDiplomacyRelationKind,
  type LeaderboardRow,
  type LootPriority,
  type MarketGuildVillageEconomyState,
  type PlayerRankingSummary,
  type PlannerOpenResponse,
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
  | 'bot'
  | 'royal'
  | 'allied'
  | 'nap'
  | 'opponent'
  | 'enemy'
  | 'abandoned';
type SettlementDiplomacyKind =
  | 'same_player'
  | 'same_kingdom_foreign'
  | 'ally'
  | 'non_aggression'
  | 'neutral'
  | 'war'
  | 'none';
type SettlementCommandPermissions = {
  canMove: boolean;
  canSupport: boolean;
  canAttack: boolean;
};

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
  mapKind?: MapSettlementKind;
  diplomacyKind?: SettlementDiplomacyKind;
  commandPermissions?: SettlementCommandPermissions;
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

type SettlementCanvasBadgeKind = MapOrderCommandType | 'knight-attack';

type SettlementCanvasOrderBadge = {
  kind: SettlementCanvasBadgeKind;
  symbol: string;
  count: number;
};

type MapSettlementCanvasMarker = {
  settlement: RegionSettlement;
  localX: number;
  localY: number;
  mapKind: MapSettlementKind;
  prestigeMeta: SettlementPrestigeMeta;
  isFocused: boolean;
  coverageCommandTypes: MapOrderCommandType[];
  orderBadges: SettlementCanvasOrderBadge[];
  hasOrderMarker: boolean;
};

type PanelMeta = {
  type: PanelType;
  label: string;
  side: PinSide;
  width: number;
  height: number;
};

type PanelLayoutMode = 'floating' | 'full' | 'split-left' | 'split-right';

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
  layoutMode: PanelLayoutMode;
};

type TownhallDeveloperBoostNotice = {
  isActive: boolean;
  label: string;
  reason: string;
  endsAt: string;
  endsAtLabel: string;
};

type ActiveVillageProtectionNotice = {
  protectionUntil: string;
  formattedUntil: string;
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

type CityPanelResourceSnapshot = Pick<
  GameStateResponse['resources'],
  'wood' | 'stone' | 'iron' | 'gold' | 'coins' | 'cap' | 'goldCap' | 'coinsCap'
> & {
  populationUsed: number;
  populationCap: number;
  productionPerHour: Pick<GameStateResponse['resources']['productionPerHour'], 'wood' | 'stone' | 'iron' | 'gold' | 'mintCoins'>;
  protection: Pick<GameStateResponse['resources']['protection'], 'wood' | 'stone' | 'iron' | 'gold' | 'coins'>;
};

type CityPanelResourceDefinition = {
  key: 'wood' | 'stone' | 'iron' | 'gold' | 'coins';
  label: string;
  buildingId: string;
  productionField: 'wood' | 'stone' | 'iron' | 'gold' | 'mintCoins';
  protectionField: 'wood' | 'stone' | 'iron' | 'gold' | 'coins';
  capacityField: 'cap' | 'goldCap' | 'coinsCap';
};

type CityPanelResourceRow = {
  key: string;
  label: string;
  icon: string;
  amount: number;
  productionPerHour: number | null;
  capacity: number;
  protectedAmount: number;
  buildingLevel: number;
  buildingName: string;
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

type PlannerLegDraft = {
  originVillageId: number;
  impactAtUtc: string;
  units: Partial<Record<CommandUnitId, number>>;
};

type PlannerDraftState = {
  targetPlayerUsername: string;
  targetVillageId: number | null;
  legs: PlannerLegDraft[];
  updatedAt: string;
};

type PlannerValidationIssue = {
  code: string;
  severity: 'warning' | 'blocked';
  message: string;
  scope?: 'plan' | 'target' | 'leg';
  legOriginVillageId?: number;
};

type PlannerConstraints = PlannerOpenResponse['constraints'];
type PlannerDraftStage = 'draft' | 'confirmation';

type PlannerDraftNormalizationMeta = {
  removedLegCount: number;
  targetReset: boolean;
  timelineAdjusted: boolean;
  unitAmountsAdjusted: boolean;
};

type RecruitQueueOrder = {
  id: number;
  unitId: string;
  unitName: string;
  amount: number;
  queueIndex: number;
  status: string;
  remainingSec: number;
  finishAt: string;
};

type BuildingUpgradeQueueOrder = {
  id: number;
  buildingId: string;
  fromLevel: number;
  toLevel: number;
  startedAt: string;
  remainingSec: number;
  finishAt: string;
};

type VillageIntelBuildingQueueItem = {
  id: number;
  buildingId: string;
  buildingName: string;
  fromLevel: number;
  toLevel: number;
  startedAt: string;
  finishAt: string;
  remainingSec: number;
};

type VillageIntelRecruitQueueItem = {
  id: number;
  unitId: string;
  unitName: string;
  amount: number;
  startedAt: string;
  finishAt: string;
  remainingSec: number;
};

type VillageIntelUnitSummaryItem = {
  unitId: string;
  unitName: string;
  ownAmount: number;
  supportAmount: number;
  order: number;
};

type VillageIntelGarrisonUnitDetail = {
  unitId: string;
  unitName: string;
  icon: string;
  amount: number;
  cap: number;
  missing: number;
  refillSecPerUnit: number;
  nextRefillSec: number | null;
};

type VillageIntelData = {
  villageId: number;
  villageName: string;
  buildingQueue: VillageIntelBuildingQueueItem[];
  recruitQueue: VillageIntelRecruitQueueItem[];
  fortificationLevel: number;
  gateLevel: number;
  garrisonUnits: number;
  garrisonUnlocked: boolean;
  garrisonDetails: VillageIntelGarrisonUnitDetail[];
  resources: Pick<GameStateResponse['resources'], 'wood' | 'stone' | 'iron' | 'gold' | 'coins'>;
  unitSummaries: VillageIntelUnitSummaryItem[];
};

type VillageIntelStatus = 'idle' | 'loading' | 'ready' | 'error';

type VillageIntelEntry = {
  status: VillageIntelStatus;
  data: VillageIntelData | null;
  error: string | null;
  fetchedAt: number | null;
};

type RankingMode = 'players' | 'kingdoms' | 'attacker' | 'defender' | 'supporter' | 'loot';
type CombatRankingMode = Extract<RankingMode, 'attacker' | 'defender' | 'supporter' | 'loot'>;
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
  | 'layoutMode'
  | 'settlementId'
  | 'buildingId'
  | 'battleReportId'
  | 'villageName'
  | 'kingdomName'
  | 'playerUsername'
>;

type StoredPanelPlacementByType = Partial<
  Record<
    StaticPanelType,
    {
      side: PinSide;
      layoutMode: PanelLayoutMode;
    }
  >
>;

const PANEL_META: Record<PanelType, PanelMeta> = {
  city: {
    type: 'city',
    label: 'Přehled',
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
    label: 'Správa',
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
    label: 'Komunikace',
    side: 'right',
    width: 760,
    height: 460,
  },
  activity: {
    type: 'activity',
    label: 'Záznamy',
    side: 'right',
    width: 1020,
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
    width: 700,
    height: 440,
  },
  settings: {
    type: 'settings',
    label: 'Nastavení',
    side: 'left',
    width: 700,
    height: 460,
  },
  kingdomProfile: {
    type: 'kingdomProfile',
    label: 'Profil království',
    side: 'right',
    width: 900,
    height: 560,
  },
  playerProfile: {
    type: 'playerProfile',
    label: 'Profil hráče',
    side: 'left',
    width: 900,
    height: 560,
  },
  village: {
    type: 'village',
    label: 'Profil osady',
    side: 'right',
    width: 860,
    height: 500,
  },
  building: {
    type: 'building',
    label: 'Detail budovy',
    side: 'left',
    width: 760,
    height: 520,
  },
};

const NAV_BUTTONS: { type: StaticPanelType; text: string; glyph: string }[] = [
  { type: 'city', text: 'Přehled', glyph: '⌂' },
  { type: 'map', text: 'Mapa', glyph: '⌗' },
  { type: 'army', text: 'Správa', glyph: '▣' },
  { type: 'military', text: 'Armáda', glyph: '⚔︎' },
  { type: 'commands', text: 'Příkazy', glyph: '✦' },
  { type: 'research', text: 'Výzkum', glyph: '✶' },
  { type: 'messages', text: 'Komunikace', glyph: '✉︎' },
  { type: 'activity', text: 'Záznamy', glyph: '✎' },
  { type: 'kingdom', text: 'Království', glyph: '♜' },
  { type: 'rankings', text: 'Žebříček', glyph: '☷' },
  { type: 'profile', text: 'Profil', glyph: '⚜︎' },
  { type: 'settings', text: 'Nastavení', glyph: '⚙︎' },
];

const TOP_NAV_BUTTONS = NAV_BUTTONS.filter((button) => button.type !== 'settings' && button.type !== 'messages');
const SETTINGS_BUTTON_ICON_SRC = '/assets/ui/settings-icon.webp';
const VILLAGE_NAV_ARROW_ICON_SRC = '/assets/ui/village-nav-arrow.webp';

const MAIN_MENU_PANEL_TYPES = new Set<StaticPanelType>(NAV_BUTTONS.map((button) => button.type));

type MenuButtonProps = {
  text: string;
  title: string;
  onClick: () => void;
  className: string;
  glyph?: string;
  badgeText?: string | null;
  isOpen?: boolean;
};

const MenuButton = ({ text, title, onClick, className, glyph, badgeText = null, isOpen = false }: MenuButtonProps) => (
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
    {badgeText ? <span className="nav-action-inline-badge">{badgeText}</span> : null}
  </button>
);

type FooterActionButtonProps = {
  icon?: string;
  iconSrc?: string;
  label: string;
  onClick: () => void;
  badgeText?: string | null;
};

const FooterActionButton = ({ icon, iconSrc, label, onClick, badgeText = null }: FooterActionButtonProps) => (
  <button type="button" className="game-footer-action icon-only" onClick={onClick} title={label} aria-label={label}>
    <span className={`symbol${iconSrc ? ' is-image' : ''}`} aria-hidden="true">
      {iconSrc ? <img src={iconSrc} alt="" decoding="async" /> : icon}
    </span>
    {badgeText ? <span className="game-footer-action-badge tld-type-value">{badgeText}</span> : null}
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

const MENU_DOCK_PANEL_TYPES = new Set<StaticPanelType>();

const DEFAULT_STRETCHED_PANEL_TYPES = new Set<StaticPanelType>([
  ...MAIN_MENU_PANEL_TYPES,
]);

const isStaticPanelType = (panelType: PanelType): panelType is StaticPanelType =>
  panelType !== 'village' && panelType !== 'building' && panelType !== 'battleReport';

const isMainMenuPanelType = (panelType: PanelType): panelType is StaticPanelType =>
  isStaticPanelType(panelType) && MAIN_MENU_PANEL_TYPES.has(panelType);

const shouldUseStretchedPanelFrame = (panelType: PanelType): boolean =>
  isStaticPanelType(panelType) && DEFAULT_STRETCHED_PANEL_TYPES.has(panelType);

const isDockLayoutMode = (mode: PanelLayoutMode): mode is Exclude<PanelLayoutMode, 'floating'> =>
  mode === 'full' || mode === 'split-left' || mode === 'split-right';

const canPanelUseDockLayout = (panelType: PanelType): boolean =>
  isStaticPanelType(panelType) && MENU_DOCK_PANEL_TYPES.has(panelType);

const canPanelUsePinColumns = (panelType: PanelType): boolean => !canPanelUseDockLayout(panelType);

const resolvePanelDockLayoutMode = (
  panel: Pick<PanelWindow, 'type' | 'layoutMode' | 'side'>,
): PanelLayoutMode => {
  if (panel.layoutMode !== 'floating') {
    return panel.layoutMode;
  }
  if (!canPanelUseDockLayout(panel.type)) {
    return 'floating';
  }
  return panel.side === 'right' ? 'split-right' : 'split-left';
};

const resolveSplitModeBySide = (
  side: PinSide,
): Extract<PanelLayoutMode, 'split-left' | 'split-right'> =>
  side === 'right' ? 'split-right' : 'split-left';

const moveDockPanelToCenterStage = (panels: PanelWindow[], targetPanelId: string): PanelWindow[] => {
  const targetPanel = panels.find(
    (panel) =>
      panel.id === targetPanelId &&
      panel.expanded &&
      canPanelUseDockLayout(panel.type),
  );
  if (!targetPanel) {
    return panels;
  }

  let changed = false;
  const nextPanels: PanelWindow[] = panels.map((panel): PanelWindow => {
    if (!panel.expanded || !canPanelUseDockLayout(panel.type)) {
      return panel;
    }

    if (panel.id === targetPanelId) {
      if (panel.layoutMode === 'full' && !panel.alert) {
        return panel;
      }
      changed = true;
      return {
        ...panel,
        layoutMode: 'full' as PanelLayoutMode,
        alert: false,
      };
    }

    if (resolvePanelDockLayoutMode(panel) !== 'full') {
      return panel;
    }

    const parkedLayoutMode = resolveSplitModeBySide(panel.side);
    if (panel.layoutMode === parkedLayoutMode) {
      return panel;
    }
    changed = true;
    return {
      ...panel,
      layoutMode: parkedLayoutMode,
    };
  });

  return changed ? nextPanels : panels;
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

const VILLAGE_UNIT_CARD_ICON_BY_ID: Record<string, string> = {
  militia: getUnitIconPath('militia-card.webp'),
  archer: getUnitIconPath('archer-card.webp'),
  cavalry: getUnitIconPath('cavalry-card.webp'),
  scout: getUnitIconPath('scout-card.webp'),
  knight: getUnitIconPath('knight-card.webp'),
  ram: getUnitIconPath('ram-card.webp'),
  caravan: getUnitIconPath('caravan-card.webp'),
  mercenary: getUnitIconPath('militia-card.webp'),
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

const buildVillageUnitSummaries = (units: GameStateResponse['units']): VillageIntelUnitSummaryItem[] =>
  [...units]
    .map((unit) => {
      const unitId = String(unit.id);
      const unitMeta = getUnitMetaById(unitId);
      const ownAmount = Math.max(0, Math.floor(Number(unit.amount ?? 0)));
      const supportAmount = Math.max(0, Math.floor(Number(unit.stationedSupportCount ?? 0)));
      const order = COMMAND_UNIT_ORDER.indexOf(unitId as CommandUnitId);

      return {
        unitId,
        unitName: unitMeta.fallbackName,
        ownAmount,
        supportAmount,
        order: order >= 0 ? order : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((unit) => unit.ownAmount > 0 || unit.supportAmount > 0)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.unitName.localeCompare(right.unitName, 'cs-CZ');
    });

const toVillageIntelData = (state: GameStateResponse): VillageIntelData => {
  const sortedBuildingQueue = [...(state.activeUpgrades ?? [])].sort(
    (left, right) => left.remainingSec - right.remainingSec || left.id - right.id,
  );
  const sortedRecruitQueue = [...(state.activeRecruitments ?? [])].sort(
    (left, right) => left.remainingSec - right.remainingSec || left.id - right.id,
  );
  const buildingLevelById = new Map(
    (state.buildings ?? []).map((building) => [String(building.id), Math.max(0, Math.floor(Number(building.level ?? 0)))]),
  );
  const garrisonUnits = Math.max(
    0,
    Math.floor(
      Number(
        state.garrison?.totalUnits ??
          (state.units ?? []).reduce((sum, unit) => sum + Math.max(0, Math.floor(Number(unit.amount ?? 0))), 0),
      ),
    ),
  );
  const garrisonMilitia = state.garrison?.units?.militia;
  const garrisonArcher = state.garrison?.units?.archer;
  const garrisonDetails: VillageIntelGarrisonUnitDetail[] = ['militia', 'archer'].map((unitId) => {
    const garrisonUnit = unitId === 'militia' ? garrisonMilitia : garrisonArcher;
    const unitMeta = getUnitMetaById(unitId);
    return {
      unitId,
      unitName: unitMeta.fallbackName,
      icon: unitMeta.icon,
      amount: Math.max(0, Math.floor(Number(garrisonUnit?.amount ?? 0))),
      cap: Math.max(0, Math.floor(Number(garrisonUnit?.cap ?? 0))),
      missing: Math.max(0, Math.floor(Number(garrisonUnit?.missing ?? 0))),
      refillSecPerUnit: Math.max(0, Math.floor(Number(garrisonUnit?.refillSecPerUnit ?? 0))),
      nextRefillSec:
        garrisonUnit?.nextRefillSec == null ? null : Math.max(0, Math.floor(Number(garrisonUnit.nextRefillSec))),
    };
  });

  return {
    villageId: Math.max(0, Math.floor(Number(state.village.id))),
    villageName: String(state.village.name ?? ''),
    buildingQueue: sortedBuildingQueue.map((queueItem) => ({
      id: Number(queueItem.id),
      buildingId: String(queueItem.buildingId),
      buildingName:
        BUILDING_ART[String(queueItem.buildingId)]?.fallbackName ?? String(queueItem.buildingId),
      fromLevel: Math.max(0, Math.floor(Number(queueItem.fromLevel ?? 0))),
      toLevel: Math.max(0, Math.floor(Number(queueItem.toLevel ?? 0))),
      startedAt: String(queueItem.startedAt),
      finishAt: String(queueItem.finishAt),
      remainingSec: Math.max(0, Math.floor(Number(queueItem.remainingSec ?? 0))),
    })),
    recruitQueue: sortedRecruitQueue.map((queueItem) => ({
      id: Number(queueItem.id),
      unitId: String(queueItem.unitId),
      unitName: getUnitMetaById(String(queueItem.unitId)).fallbackName,
      amount: Math.max(0, Math.floor(Number(queueItem.amount ?? 0))),
      startedAt: String(queueItem.startedAt),
      finishAt: String(queueItem.finishAt),
      remainingSec: Math.max(0, Math.floor(Number(queueItem.remainingSec ?? 0))),
    })),
    fortificationLevel: Math.max(0, Math.floor(Number(buildingLevelById.get('fortification') ?? 0))),
    gateLevel: Math.max(0, Math.floor(Number(buildingLevelById.get('gate') ?? 0))),
    garrisonUnits,
    garrisonUnlocked: Boolean(state.garrison?.isUnlocked ?? true),
    garrisonDetails,
    resources: {
      wood: Math.max(0, Math.floor(Number(state.resources?.wood ?? 0))),
      stone: Math.max(0, Math.floor(Number(state.resources?.stone ?? 0))),
      iron: Math.max(0, Math.floor(Number(state.resources?.iron ?? 0))),
      gold: Math.max(0, Math.floor(Number(state.resources?.gold ?? 0))),
      coins: Math.max(0, Math.floor(Number(state.resources?.coins ?? 0))),
    },
    unitSummaries: buildVillageUnitSummaries(state.units ?? []),
  };
};

const MERCENARY_UNIT_ID = 'mercenary';
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
const resolveCombatPowerUnitId = (unitIdRaw: string): CommandUnitId | null => {
  if (unitIdRaw === MERCENARY_UNIT_ID) {
    return 'militia';
  }
  return COMMAND_UNIT_ORDER.includes(unitIdRaw as CommandUnitId) ? (unitIdRaw as CommandUnitId) : null;
};
const resolveAttackPowerByUnitId = (unitIdRaw: string): number => {
  const powerUnitId = resolveCombatPowerUnitId(unitIdRaw);
  return powerUnitId ? UNIT_ATTACK_POWER[powerUnitId] : 0;
};
const resolveDefensePowerByUnitId = (unitIdRaw: string): number => {
  const powerUnitId = resolveCombatPowerUnitId(unitIdRaw);
  return powerUnitId ? UNIT_DEFENSE_POWER[powerUnitId] : 0;
};
const resolveLootCapacityByUnitId = (unitIdRaw: string): number => {
  if (unitIdRaw === MERCENARY_UNIT_ID) {
    return 0;
  }
  const powerUnitId = resolveCombatPowerUnitId(unitIdRaw);
  return powerUnitId ? UNIT_LOOT_CAPACITY[powerUnitId] : 0;
};
const resolveTravelSpeedByUnitId = (unitIdRaw: string): number => {
  const powerUnitId = resolveCombatPowerUnitId(unitIdRaw);
  return powerUnitId ? Math.max(0, Number(UNIT_TRAVEL_SPEED_TILES_PER_HOUR[powerUnitId] ?? 0)) : 0;
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
const DEFAULT_COMMAND_CANCEL_PROGRESS_LIMIT = 1 / 3;

const ARMY_COMMAND_LABELS: Record<ArmyCommandType, string> = {
  attack: 'Útok',
  support: 'Podpora',
  move: 'Přesun',
  return: 'Návrat',
};

const compareVillageLabelNatural = (
  left: { name: string; coordX: number; coordY: number },
  right: { name: string; coordX: number; coordY: number },
): number => {
  const byName = left.name.localeCompare(right.name, 'cs-CZ', { numeric: true, sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }
  const byX = Number(left.coordX) - Number(right.coordX);
  if (byX !== 0) {
    return byX;
  }
  return Number(left.coordY) - Number(right.coordY);
};

const resolveWorldFlavorById = (worldIdRaw: string | null | undefined): 'test' | 'prealpha' | 'default' => {
  const worldId = String(worldIdRaw ?? '').trim();
  if (worldId === 'dominion-1') {
    return 'test';
  }
  if (worldId === 'dominion-1-fire') {
    return 'prealpha';
  }
  return 'default';
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

const isCancelableArmyMovementType = (commandType: ArmyMovementState['commandType']): boolean =>
  commandType === 'attack' || commandType === 'support' || commandType === 'move';

const resolveCancelCommandProgressLimit = (limitRaw: number | null | undefined): number => {
  const parsed = Number(limitRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_COMMAND_CANCEL_PROGRESS_LIMIT;
  }
  return Math.min(1, parsed);
};

const resolveMovementProgressRatio = (
  movement: Pick<ArmyMovementState, 'startedAt' | 'arriveAt' | 'remainingSec'>,
): number => {
  const startedAtMs = Date.parse(String(movement.startedAt ?? ''));
  const arriveAtMs = Date.parse(String(movement.arriveAt ?? ''));
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(arriveAtMs) || arriveAtMs <= startedAtMs) {
    return 1;
  }

  const totalDurationSec = Math.max(1, (arriveAtMs - startedAtMs) / 1000);
  const parsedRemainingSec = Number(movement.remainingSec ?? Number.NaN);
  const fallbackRemainingSec = Math.max(0, (arriveAtMs - Date.now()) / 1000);
  const remainingSec = Number.isFinite(parsedRemainingSec)
    ? Math.max(0, Math.min(totalDurationSec, parsedRemainingSec))
    : Math.max(0, Math.min(totalDurationSec, fallbackRemainingSec));
  const elapsedSec = Math.max(0, totalDurationSec - remainingSec);
  return Math.max(0, Math.min(1, elapsedSec / totalDurationSec));
};

const resolveMovementCancelMeta = (
  movement: Pick<
    ArmyMovementState,
    | 'commandType'
    | 'startedAt'
    | 'arriveAt'
    | 'remainingSec'
    | 'isCancelable'
    | 'cancelProgressLimit'
    | 'commandProgressRatio'
    | 'commandProgressPct'
  >,
  cancelProgressLimitRaw: number | null | undefined,
) => {
  const limitRatio = resolveCancelCommandProgressLimit(
    movement.cancelProgressLimit ?? cancelProgressLimitRaw,
  );
  const fallbackProgressRatio = resolveMovementProgressRatio(movement);
  const serverProgressRatio = Number(movement.commandProgressRatio ?? Number.NaN);
  const progressRatio = Number.isFinite(serverProgressRatio)
    ? Math.max(0, Math.min(1, serverProgressRatio))
    : fallbackProgressRatio;
  const serverProgressPct = Number(movement.commandProgressPct ?? Number.NaN);
  const progressPct = Number.isFinite(serverProgressPct)
    ? Math.max(0, Math.min(100, Math.round(serverProgressPct)))
    : Math.max(0, Math.round(progressRatio * 100));
  const canCancelByLocalProgress = progressRatio <= limitRatio + 0.000001;
  const canCancel =
    typeof movement.isCancelable === 'boolean'
      ? movement.isCancelable && isCancelableArmyMovementType(movement.commandType)
      : isCancelableArmyMovementType(movement.commandType) && canCancelByLocalProgress;
  return {
    limitRatio,
    limitPct: Math.max(0, Math.round(limitRatio * 100)),
    progressRatio,
    progressPct,
    canCancel,
  };
};

type TooltipCursorPosition = {
  x: number;
  y: number;
};

type TooltipSize = {
  width: number;
  height: number;
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
  const minLeft = TOOLTIP_VIEWPORT_PADDING;
  const minTop = TOOLTIP_VIEWPORT_PADDING;
  const maxLeft = Math.max(
    TOOLTIP_VIEWPORT_PADDING,
    Math.floor(viewportWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING),
  );
  const maxTop = Math.max(
    TOOLTIP_VIEWPORT_PADDING,
    Math.floor(viewportHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING),
  );
  const preferredRight = Math.floor(cursorPosition.x + TOOLTIP_CURSOR_OFFSET_X);
  const preferredLeft = Math.floor(cursorPosition.x - tooltipWidth - TOOLTIP_CURSOR_OFFSET_X);
  const preferredBottom = Math.floor(cursorPosition.y + TOOLTIP_CURSOR_OFFSET_Y);
  const preferredTop = Math.floor(cursorPosition.y - tooltipHeight - TOOLTIP_CURSOR_OFFSET_Y);

  const fitsRight = preferredRight + tooltipWidth <= viewportWidth - TOOLTIP_VIEWPORT_PADDING;
  const fitsLeft = preferredLeft >= TOOLTIP_VIEWPORT_PADDING;
  const fitsBottom = preferredBottom + tooltipHeight <= viewportHeight - TOOLTIP_VIEWPORT_PADDING;
  const fitsTop = preferredTop >= TOOLTIP_VIEWPORT_PADDING;

  const availableRight = viewportWidth - TOOLTIP_VIEWPORT_PADDING - cursorPosition.x;
  const availableLeft = cursorPosition.x - TOOLTIP_VIEWPORT_PADDING;
  const availableBottom = viewportHeight - TOOLTIP_VIEWPORT_PADDING - cursorPosition.y;
  const availableTop = cursorPosition.y - TOOLTIP_VIEWPORT_PADDING;

  const horizontalCandidate =
    fitsRight || (!fitsLeft && availableRight >= availableLeft) ? preferredRight : preferredLeft;
  const verticalCandidate =
    fitsBottom || (!fitsTop && availableBottom >= availableTop) ? preferredBottom : preferredTop;

  return {
    x: Math.min(Math.max(horizontalCandidate, minLeft), maxLeft),
    y: Math.min(Math.max(verticalCandidate, minTop), maxTop),
  };
};

const readTooltipSize = (node: HTMLDivElement | null, fallbackSize: TooltipSize): TooltipSize => {
  if (!node) {
    return fallbackSize;
  }
  const bounds = node.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(bounds.width));
  const height = Math.max(1, Math.ceil(bounds.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return fallbackSize;
  }
  return { width, height };
};

const useFollowCursorTooltipPositioning = ({
  cursorPosition,
  fallbackCursorPosition,
  estimatedSize,
  isEnabled = true,
}: {
  cursorPosition?: TooltipCursorPosition | null;
  fallbackCursorPosition?: TooltipCursorPosition | null;
  estimatedSize: TooltipSize;
  isEnabled?: boolean;
}) => {
  const tooltipNodeRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState<TooltipSize | null>(null);

  const preferredCursor = cursorPosition ?? fallbackCursorPosition ?? null;
  const preferredCursorX = preferredCursor?.x ?? null;
  const preferredCursorY = preferredCursor?.y ?? null;

  const syncTooltipSize = useCallback(() => {
    const nextSize = readTooltipSize(tooltipNodeRef.current, estimatedSize);
    setTooltipSize((currentSize) =>
      currentSize &&
      currentSize.width === nextSize.width &&
      currentSize.height === nextSize.height
        ? currentSize
        : nextSize,
    );
  }, [estimatedSize]);

  const tooltipRef = useCallback(
    (node: HTMLDivElement | null) => {
      tooltipNodeRef.current = node;
      if (!node) {
        return;
      }
      const nextSize = readTooltipSize(node, estimatedSize);
      setTooltipSize((currentSize) =>
        currentSize &&
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      );
    },
    [estimatedSize],
  );

  useEffect(() => {
    if (!isEnabled || preferredCursorX == null || preferredCursorY == null || typeof window === 'undefined') {
      return;
    }
    const node = tooltipNodeRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      syncTooltipSize();
    });
    resizeObserver.observe(node);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isEnabled, preferredCursorX, preferredCursorY, syncTooltipSize]);

  useEffect(() => {
    if (!isEnabled || preferredCursorX == null || preferredCursorY == null || typeof window === 'undefined') {
      return;
    }
    const handleResize = () => {
      syncTooltipSize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isEnabled, preferredCursorX, preferredCursorY, syncTooltipSize]);

  const resolvedCursorPosition = useMemo(() => {
    if (!isEnabled || preferredCursorX == null || preferredCursorY == null || typeof window === 'undefined') {
      return null;
    }
    const effectiveTooltipSize = tooltipSize ?? estimatedSize;
    return clampTooltipPosition(
      { x: preferredCursorX, y: preferredCursorY },
      effectiveTooltipSize.width,
      effectiveTooltipSize.height,
      window.innerWidth,
      window.innerHeight,
    );
  }, [estimatedSize, isEnabled, preferredCursorX, preferredCursorY, tooltipSize]);

  const tooltipStyle: CSSProperties | undefined =
    resolvedCursorPosition
      ? {
          left: `${resolvedCursorPosition.x}px`,
          top: `${resolvedCursorPosition.y}px`,
        }
      : undefined;

  return {
    tooltipRef,
    tooltipStyle,
    resolvedCursorPosition,
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
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 280,
        height: 210,
      };
    }
    return {
      width: Math.max(220, Math.min(360, Math.floor(window.innerWidth * 0.34))),
      height: 210,
    };
  }, []);
  const { tooltipRef, tooltipStyle } = useFollowCursorTooltipPositioning({
    cursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: Boolean(cursorPosition) && orderedUnits.length > 0,
  });

  if (orderedUnits.length <= 0) {
    return null;
  }

  const tooltipNode = (
    <div
      ref={tooltipRef}
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

type CommandCancelActionProps = {
  disabled: boolean;
  pending: boolean;
  actionLabel: string;
  disabledReason: string;
  onClick: () => void;
};

const CommandCancelTooltip = ({
  tooltipId,
  label,
  cursorPosition,
}: {
  tooltipId: string;
  label: string;
  cursorPosition: TooltipCursorPosition | null;
}) => {
  const estimatedTooltipSize = useMemo<TooltipSize>(
    () => ({
      width: 140,
      height: 40,
    }),
    [],
  );
  const { tooltipRef, tooltipStyle } = useFollowCursorTooltipPositioning({
    cursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: Boolean(cursorPosition),
  });

  if (!cursorPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <span ref={tooltipRef} id={tooltipId} className="command-cancel-tooltip is-floating" style={tooltipStyle} role="tooltip">
      {label}
    </span>,
    document.body,
  );
};

const CommandCancelAction = ({
  disabled,
  pending,
  actionLabel,
  disabledReason,
  onClick,
}: CommandCancelActionProps) => {
  const [tooltipCursorPosition, setTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const tooltipId = useId();
  const tooltipLabel = pending ? 'Rušení' : disabled ? 'Zrušení uzamčeno' : 'Zrušení';
  const buttonLabel = pending ? 'Ruším rozkaz' : disabled ? disabledReason : actionLabel;

  const handleTooltipPointerEnter = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
  };

  const handleTooltipPointerMove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setTooltipCursorPosition({ x: event.clientX, y: event.clientY });
  };

  const handleTooltipFocus = (event: ReactFocusEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setTooltipCursorPosition({
      x: Math.round(bounds.left + bounds.width / 2),
      y: Math.round(bounds.top - 8),
    });
  };

  const handleTooltipDismiss = () => {
    setTooltipCursorPosition(null);
  };

  return (
    <span className={`command-cancel-action${disabled ? ' is-disabled' : ''}${pending ? ' is-pending' : ''}`}>
      <button
        type="button"
        className="command-cancel-icon-button"
        onClick={onClick}
        disabled={disabled}
        aria-label={buttonLabel}
        aria-describedby={tooltipCursorPosition ? tooltipId : undefined}
        title={buttonLabel}
        onMouseEnter={handleTooltipPointerEnter}
        onMouseMove={handleTooltipPointerMove}
        onMouseLeave={handleTooltipDismiss}
        onFocus={handleTooltipFocus}
        onBlur={handleTooltipDismiss}
      >
        <span className="command-cancel-icon-mark" aria-hidden="true">
          {pending ? '…' : '✕'}
        </span>
      </button>
      {tooltipCursorPosition ? (
        <CommandCancelTooltip tooltipId={tooltipId} label={tooltipLabel} cursorPosition={tooltipCursorPosition} />
      ) : null}
    </span>
  );
};

const BuildingUpgradePreviewTooltip = ({
  building,
  statusText,
  queueInfoLabel,
  isPositiveNotice,
  notice,
  isMaxed,
  costRows,
  cursorPosition,
}: {
  building: Building;
  statusText: string;
  queueInfoLabel: string;
  isPositiveNotice: boolean;
  notice: string;
  isMaxed: boolean;
  costRows: Array<{
    resourceType: keyof ResourceCost;
    requiredAmount: number;
    availableAmount: number;
    canAffordResource: boolean;
  }>;
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const preview = building.nextLevelPreview;
  const deltaLines = preview?.deltas ?? [];
  const unlockLines = preview?.unlocks ?? [];
  const hasPreviewContent = Boolean(preview) && (deltaLines.length > 0 || unlockLines.length > 0);
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 360,
        height: 260,
      };
    }
    return {
      width: Math.max(260, Math.min(430, Math.floor(window.innerWidth * 0.4))),
      height: 260,
    };
  }, []);

  const { tooltipRef, tooltipStyle, resolvedCursorPosition } = useFollowCursorTooltipPositioning({
    cursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: Boolean(cursorPosition),
  });

  if (!resolvedCursorPosition) {
    return null;
  }

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className={`commands-army-tooltip building-upgrade-tooltip${cursorPosition ? ' is-follow-cursor' : ''}`}
      style={tooltipStyle}
      role="tooltip"
    >
      <p>
        {building.name} · Úroveň {building.level}
        {isMaxed ? ' (max)' : ''}
      </p>
      <p className="building-upgrade-tooltip-subtitle">{statusText}</p>
      <p className="building-upgrade-tooltip-subtitle">{queueInfoLabel}</p>
      {costRows.length > 0 ? (
        <>
          <p className="building-upgrade-tooltip-subtitle">Cena rozšíření</p>
          <ul className="building-upgrade-tooltip-list">
            {costRows.map((row) => (
              <li key={`${building.id}-cost-${row.resourceType}`}>
                <span>{LOOT_PRIORITY_LABELS[row.resourceType]}</span>
                <strong className={row.canAffordResource ? 'ok' : 'missing'}>
                  {row.requiredAmount.toLocaleString('cs-CZ')} · máš {row.availableAmount.toLocaleString('cs-CZ')}
                </strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="building-upgrade-tooltip-subtitle">Cena rozšíření: Max úroveň</p>
      )}
      {notice ? (
        <p className={`building-upgrade-tooltip-subtitle ${isPositiveNotice ? 'success' : 'error'}`}>{notice}</p>
      ) : null}
      {hasPreviewContent && preview && deltaLines.length > 0 ? (
        <>
          <p className="building-upgrade-tooltip-subtitle">
            Další úroveň {preview.fromLevel} → {preview.toLevel}
          </p>
          <ul className="building-upgrade-tooltip-list">
            {deltaLines.map((line, index) => (
              <li key={`${building.id}-delta-${index}`}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      {hasPreviewContent && preview && unlockLines.length > 0 ? (
        <>
          <p className="building-upgrade-tooltip-subtitle">Co se odemkne</p>
          <ul className="building-upgrade-tooltip-list">
            {unlockLines.map((line, index) => (
              <li key={`${building.id}-unlock-${index}`}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      {!hasPreviewContent ? (
        <ul className="building-upgrade-tooltip-list">
          <li>Další informace k rozšíření budou dostupné po odemčení další úrovně.</li>
        </ul>
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
  const showCollaborations = project.status === 'researching' && collaborations.length > 0;
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 340,
        height: 250,
      };
    }
    return {
      width: Math.max(260, Math.min(420, Math.floor(window.innerWidth * 0.36))),
      height: 250,
    };
  }, []);
  const { tooltipRef, tooltipStyle } = useFollowCursorTooltipPositioning({
    cursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: showCollaborations && Boolean(cursorPosition),
  });

  if (!showCollaborations) {
    return null;
  }

  const etaLabel =
    project.estimatedCompletionAt && project.remainingSec != null
      ? `${formatDateTimeLabel(project.estimatedCompletionAt)} (${formatDurationLabel(project.remainingSec)})`
      : 'Pozastaveno (0 akademiků)';

  const tooltipNode = (
    <div
      ref={tooltipRef}
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

const CityResourceSummaryTooltip = ({
  rows,
  cursorPosition,
}: {
  rows: CityPanelResourceRow[];
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const isTwoColumnLayout = rows.length > 4;
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: isTwoColumnLayout ? 520 : 380,
        height: isTwoColumnLayout ? 300 : 380,
      };
    }
    return {
      width: isTwoColumnLayout
        ? Math.max(420, Math.min(660, Math.floor(window.innerWidth * 0.62)))
        : Math.max(320, Math.min(460, Math.floor(window.innerWidth * 0.44))),
      height: isTwoColumnLayout ? 300 : 380,
    };
  }, [isTwoColumnLayout]);
  const fallbackCursorPosition = useMemo<TooltipCursorPosition | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return {
      x: Math.floor(window.innerWidth * 0.54),
      y: Math.floor(window.innerHeight * 0.24),
    };
  }, []);
  const { tooltipRef, tooltipStyle, resolvedCursorPosition } = useFollowCursorTooltipPositioning({
    cursorPosition,
    fallbackCursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: rows.length > 0,
  });

  if (rows.length <= 0 || !resolvedCursorPosition) {
    return null;
  }

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className={`commands-army-tooltip city-resource-stock-tooltip-overlay is-follow-cursor ${isTwoColumnLayout ? 'is-two-columns' : ''}`}
      style={tooltipStyle}
      role="tooltip"
    >
      <p>Detail surovin</p>
      <ul>
        {rows.map((resource) => (
          <li key={`city-resource-tooltip-${resource.key}`}>
            <span className="city-resource-tooltip-head">
              <span className="city-resource-stock-icon" aria-hidden="true">
                {resource.icon.startsWith('/') ? (
                  <img src={resource.icon} alt="" loading="lazy" decoding="async" draggable={false} />
                ) : (
                  resource.icon
                )}
              </span>
              <strong>{resource.label}</strong>
            </span>
            <span>
              {resource.productionPerHour == null
                ? `Kapacita ${resource.capacity.toLocaleString('cs-CZ')}`
                : `Produkce +${resource.productionPerHour.toLocaleString('cs-CZ')} / h · Kapacita ${resource.capacity.toLocaleString('cs-CZ')}`}
            </span>
            <span>
              {resource.buildingName} · Úroveň {resource.buildingLevel.toLocaleString('cs-CZ')} · Ukryto před lupem{' '}
              {resource.protectedAmount.toLocaleString('cs-CZ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(tooltipNode, document.body);
  }

  return tooltipNode;
};

const QueueActionTooltip = ({
  title,
  description,
  cursorPosition,
}: {
  title: string;
  description: string;
  cursorPosition: TooltipCursorPosition | null;
}) => {
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 300,
        height: 132,
      };
    }
    return {
      width: Math.max(240, Math.min(360, Math.floor(window.innerWidth * 0.32))),
      height: 132,
    };
  }, []);
  const { tooltipRef, tooltipStyle, resolvedCursorPosition } = useFollowCursorTooltipPositioning({
    cursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: Boolean(cursorPosition),
  });

  if (!resolvedCursorPosition || !title.trim() || !description.trim()) {
    return null;
  }

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className="commands-army-tooltip city-queue-action-tooltip is-follow-cursor"
      style={tooltipStyle}
      role="tooltip"
    >
      <p>{title}</p>
      <ul>
        <li>
          <span>{description}</span>
        </li>
      </ul>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(tooltipNode, document.body);
  }

  return tooltipNode;
};

const VillageIntelTooltip = ({
  title,
  rows,
  cursorPosition,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  cursorPosition?: TooltipCursorPosition | null;
}) => {
  const estimatedTooltipSize = useMemo<TooltipSize>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 360,
        height: Math.max(140, Math.min(360, 84 + rows.length * 30)),
      };
    }
    return {
      width: Math.max(300, Math.min(460, Math.floor(window.innerWidth * 0.42))),
      height: Math.max(140, Math.min(360, 84 + rows.length * 30)),
    };
  }, [rows.length]);
  const fallbackCursorPosition = useMemo<TooltipCursorPosition | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return {
      x: Math.floor(window.innerWidth * 0.52),
      y: Math.floor(window.innerHeight * 0.26),
    };
  }, []);
  const { tooltipRef, tooltipStyle, resolvedCursorPosition } = useFollowCursorTooltipPositioning({
    cursorPosition,
    fallbackCursorPosition,
    estimatedSize: estimatedTooltipSize,
    isEnabled: rows.length > 0,
  });

  if (rows.length <= 0 || !resolvedCursorPosition) {
    return null;
  }

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className="commands-army-tooltip village-intel-tooltip is-follow-cursor"
      style={tooltipStyle}
      role="tooltip"
    >
      <p>{title}</p>
      <ul>
        {rows.map((row, index) => (
          <li key={`village-intel-tooltip-row-${index}`}>
            <span>{row.label}</span>
            <span className="village-intel-tooltip-value tld-type-value">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (typeof document !== 'undefined') {
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

const CITY_PANEL_RESOURCE_DEFINITIONS: CityPanelResourceDefinition[] = [
  {
    key: 'wood',
    label: 'Dřevo',
    buildingId: 'woodcutter',
    productionField: 'wood',
    protectionField: 'wood',
    capacityField: 'cap',
  },
  {
    key: 'stone',
    label: 'Kámen',
    buildingId: 'quarry',
    productionField: 'stone',
    protectionField: 'stone',
    capacityField: 'cap',
  },
  {
    key: 'iron',
    label: 'Železo',
    buildingId: 'iron-mine',
    productionField: 'iron',
    protectionField: 'iron',
    capacityField: 'cap',
  },
  {
    key: 'gold',
    label: 'Zlato',
    buildingId: 'gold-mine',
    productionField: 'gold',
    protectionField: 'gold',
    capacityField: 'goldCap',
  },
  {
    key: 'coins',
    label: 'Mince',
    buildingId: 'mint',
    productionField: 'mintCoins',
    protectionField: 'coins',
    capacityField: 'coinsCap',
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
type MapPreviewTravelModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';
const SETTLEMENT_COLOR_KEYS = [
  'active',
  'own',
  'bot',
  'royal',
  'allied',
  'nap',
  'opponent',
  'enemy',
  'abandoned',
] as const;
type SettlementColorKey = (typeof SETTLEMENT_COLOR_KEYS)[number];
type SettlementColorPalette = Record<SettlementColorKey, string>;
type PersistedShortcutSettings = {
  autoHidePinColumns?: unknown;
  bindings?: Partial<Record<ShortcutActionId, unknown>>;
  mapPreviewTravelModifier?: unknown;
  settlementColors?: unknown;
};

const MAP_ORDER_COMMAND_TYPES: MapOrderCommandType[] = ['attack', 'support', 'move'];
const MAP_BACKGROUND_ART_PATH = '/assets/map/mapa.svg';
const MAP_SETTLEMENT_KIND_LABELS: Record<MapSettlementKind, string> = {
  active: 'Aktuální osada',
  own: 'Moje osada',
  bot: 'Bot',
  royal: 'Královská',
  allied: 'Spojenecká',
  nap: 'Dohoda o neútočení',
  opponent: 'Protivník',
  enemy: 'Nepřítel',
  abandoned: 'Opuštěná',
};
const SETTLEMENT_COLOR_LABELS: Record<SettlementColorKey, string> = {
  active: 'Aktivní',
  own: 'Moje',
  bot: 'Bot',
  royal: 'Královská',
  allied: 'Spojenecká',
  nap: 'NAP',
  opponent: 'Protivník',
  enemy: 'Nepřítel',
  abandoned: 'Opuštěná',
};
const DEFAULT_SETTLEMENT_COLOR_PALETTE: SettlementColorPalette = {
  active: '#fff4da',
  own: '#e7b24f',
  bot: '#9f8cff',
  royal: '#8fc9ff',
  allied: '#5fbf8f',
  nap: '#6fc6d8',
  opponent: '#cfa868',
  enemy: '#d06767',
  abandoned: '#8f97a0',
};

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

const ACADEMIC_HIRE_COIN_COST = 250;
const RESEARCH_MAX_ASSIGNED_ACADEMICS = 3;
const MERCENARY_CONTRACT_COIN_COST = 1500;

const RANKING_FALLBACK: LeaderboardRow[] = [];
const EMPTY_KINGDOM_AVAILABLE: KingdomAvailableSummary[] = [];
const EMPTY_KINGDOM_INVITES: KingdomIncomingInvite[] = [];
const EMPTY_KINGDOM_MEMBERS: KingdomHubState['members'] = [];
const EMPTY_KINGDOM_AUDIT_LOG: KingdomAuditLogEntry[] = [];
const EMPTY_KINGDOM_DIPLOMACY_RELATIONS: KingdomDiplomacyRelation[] = [];
const KINGDOM_DIPLOMACY_RELATION_LABELS: Record<KingdomDiplomacyRelationKind, string> = {
  neutral: 'Neutrální',
  ally: 'Spojenecké',
  non_aggression: 'DoN',
  war: 'Nepřátelské',
};
const KINGDOM_DIPLOMACY_ASSIGNABLE_OPTIONS: Array<{
  value: Exclude<KingdomDiplomacyRelationKind, 'neutral'>;
  label: string;
}> = [
  { value: 'ally', label: 'Spojenecké' },
  { value: 'non_aggression', label: 'DoN' },
  { value: 'war', label: 'Nepřátelské' },
];

const REGION_SIZE = 50;
const REGION_ORIGIN_X = 200;
const REGION_ORIGIN_Y = 430;
const REGION_CELL_SIZE = 25;
const MAP_ZOOM_MIN = 0;
const MAP_ZOOM_MAX = 200;
const MAP_ZOOM_STEP = 0.5;
const MAP_ZOOM_WHEEL_SENSITIVITY = 0.022;
const MAP_ZOOM_WHEEL_MIN_DELTA = 0.35;
const MAP_ZOOM_WHEEL_MAX_DELTA = 2.4;
const MAP_PAN_TARGET_SMOOTHNESS = 15;
const MAP_PAN_TARGET_EPSILON_PX = 0.65;
const MAP_CELL_GAP_PX = 2;
const MAP_PREVIEW_CARD_WIDTH_PX = 320;
const MAP_PREVIEW_CARD_OFFSET_PX = 10;
const MAP_PREVIEW_CARD_SAFE_EDGE_PX = 12;
const MAP_PREVIEW_CARD_SAFE_TOP_PX = 80;
const MAP_PREVIEW_CARD_HOVER_HEIGHT_PX = 168;
const MAP_PREVIEW_CARD_PINNED_HEIGHT_PX = 248;
const MAP_HOVER_CLEAR_DELAY_MS = 190;
const MAP_WINDOW_SIZE_STORAGE_KEY = 'tld_map_window_size';
const LEGACY_MAP_WINDOW_SIZE_STORAGE_KEY = 'thg_map_window_size';
const PANEL_STORAGE_SCHEMA_VERSION = 'v2';
const PANEL_LAYOUT_STORAGE_KEY_PREFIX = 'tld_panel_layout';
const LEGACY_PANEL_LAYOUT_STORAGE_KEY_PREFIX = 'thg_panel_layout';
const PANEL_PLACEMENT_STORAGE_KEY_PREFIX = 'tld_panel_placement';
const LEGACY_PANEL_PLACEMENT_STORAGE_KEY_PREFIX = 'thg_panel_placement';
const LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX = 'tld_last_own_settlement';
const LEGACY_LAST_OWN_SETTLEMENT_STORAGE_KEY_PREFIX = 'thg_last_own_settlement';
const MAP_ZOOM_STORAGE_KEY_PREFIX = 'tld_map_zoom';
const LEGACY_MAP_ZOOM_STORAGE_KEY_PREFIX = 'thg_map_zoom';
const MAP_VIEWPORT_STORAGE_KEY_PREFIX = 'tld_map_viewport';
const LEGACY_MAP_VIEWPORT_STORAGE_KEY_PREFIX = 'thg_map_viewport';
const ACTIVE_VILLAGE_STORAGE_KEY_PREFIX = 'tld_active_village';
const LEGACY_ACTIVE_VILLAGE_STORAGE_KEY_PREFIX = 'thg_active_village';
const ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX = 'tld_army_target_history';
const LEGACY_ARMY_TARGET_HISTORY_STORAGE_KEY_PREFIX = 'thg_army_target_history';
const PLANNER_LAST_SESSION_STORAGE_KEY_PREFIX = 'tld_planner_last_session';
const LEGACY_PLANNER_LAST_SESSION_STORAGE_KEY_PREFIX = 'thg_planner_last_session';
const GAME_FONT_SCALE_STORAGE_KEY_PREFIX = 'tld_game_font_scale';
const LEGACY_GAME_FONT_SCALE_STORAGE_KEY_PREFIX = 'thg_game_font_scale';
const SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX = 'tld_shortcut_settings';
const LEGACY_SHORTCUT_SETTINGS_STORAGE_KEY_PREFIX = 'thg_shortcut_settings';
const AVATAR_URL_STORAGE_KEY_PREFIX = 'tld_avatar_url';
const LEGACY_AVATAR_URL_STORAGE_KEY_PREFIX = 'thg_avatar_url';
const DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER: MapPreviewTravelModifierKey = 'ctrl';
const MAP_PREVIEW_TRAVEL_MODIFIER_OPTIONS: Array<{
  value: MapPreviewTravelModifierKey;
  label: string;
  keyboardEventKey: 'Control' | 'Alt' | 'Shift' | 'Meta';
}> = [
  { value: 'ctrl', label: 'Ctrl', keyboardEventKey: 'Control' },
  { value: 'alt', label: 'Alt', keyboardEventKey: 'Alt' },
  { value: 'shift', label: 'Shift', keyboardEventKey: 'Shift' },
  { value: 'meta', label: 'Meta (Win/Cmd)', keyboardEventKey: 'Meta' },
];
const DEFAULT_PLANNER_BANNER_TEXT = 'Planovac je zatim mozne vyuzit jen pro jeden cil z vice len.';
const DEFAULT_PLANNER_MAX_LEGS = 10;
const DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES = 1;
const DEFAULT_PLANNER_LEAD_TIME_SEC = 5 * 60;
const RESEARCH_SPOTLIGHT_SIMILAR_PROGRESS_DELTA_PERCENT = 1;
const PRAGUE_TIMEZONE = 'Europe/Prague';
const MAP_WINDOW_MIN_WIDTH = 620;
const MAP_WINDOW_MIN_HEIGHT = 460;
const STATE_POLL_INTERVAL_MS = 15000;
const REPORTS_POLL_INTERVAL_MS = 25000;
const MAP_OPEN_POLL_INTERVAL_MS = 30000;
const MAP_RENDER_MARGIN_CELLS = 2;
const WORLD_MAP_DEPENDENT_PANEL_TYPES = new Set<PanelType>([
  'map',
  'army',
  'commands',
  'village',
  'kingdomProfile',
  'playerProfile',
]);
const LEADERBOARD_DEPENDENT_PANEL_TYPES = new Set<PanelType>(['rankings', 'profile', 'kingdomProfile', 'playerProfile']);
const KINGDOM_HUB_DEPENDENT_PANEL_TYPES = new Set<PanelType>(['kingdom', 'messages']);
const RESEARCH_DEPENDENT_PANEL_TYPES = new Set<PanelType>(['research']);
const MERCENARY_DEPENDENT_PANEL_TYPES = new Set<PanelType>(['military']);
const MARKET_DEPENDENT_PANEL_TYPES = new Set<PanelType>(['commands', 'research']);
const LANDSCAPE_PANEL_TYPES = new Set<PanelType>([
  'messages',
  'activity',
  'battleReport',
  'village',
  'profile',
  'settings',
  'kingdomProfile',
  'playerProfile',
  'building',
]);
const PANEL_DEFAULT_MIN_WIDTH = 360;
const PANEL_DEFAULT_MIN_HEIGHT = 280;
const PANEL_CITY_MIN_WIDTH = 1080;
const PANEL_CITY_MIN_HEIGHT = 600;
const PANEL_ARMY_MIN_WIDTH = 760;
const PANEL_ARMY_MIN_HEIGHT = 520;
const PANEL_VIEWPORT_MARGIN_X = 32;
const PANEL_VIEWPORT_MARGIN_Y = 24;
const PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH = 280;
const PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT = 220;
const GAME_LAYOUT_MAX_WIDTH = 1800;
const GAME_LAYOUT_HORIZONTAL_PADDING = 40;
const FLOATING_PANEL_BASE_Z_INDEX = 2400;
const MAP_BACKGROUND_PANEL_Z_INDEX = 2050;
const VILLAGE_PANEL_BASE_Z_INDEX = 2147480000;
const WORLD_LABELS: Record<string, string> = {
  'dominion-1': 'Dominion I: První úsvit',
  'dominion-1-fire': 'Dominion I: Síla ohně',
};

const getInitialGameLayoutViewportSize = (): WindowSize => {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      height: 900,
    };
  }

  const viewportWidth = Math.max(
    PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH + PANEL_VIEWPORT_MARGIN_X,
    Math.min(GAME_LAYOUT_MAX_WIDTH, window.innerWidth) - GAME_LAYOUT_HORIZONTAL_PADDING,
  );
  const viewportHeight = Math.max(
    PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT + PANEL_VIEWPORT_MARGIN_Y,
    window.innerHeight - 120,
  );

  return {
    width: Math.floor(viewportWidth),
    height: Math.floor(viewportHeight),
  };
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
    label: 'Přehled',
    defaultBinding: { key: 'l', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openMapPanel',
    label: 'Mapa',
    defaultBinding: { key: 'm', ctrl: false, alt: false, shift: false, meta: false },
  },
  {
    id: 'openArmyPanel',
    label: 'Správa',
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
    label: 'Záznamy',
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

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeGameStateForUi = (state: GameStateResponse): GameStateResponse => {
  const rawResources = (state.resources ?? {}) as Partial<GameStateResponse['resources']> & {
    productionPerHour?: Partial<GameStateResponse['resources']['productionPerHour']>;
    protection?: Partial<GameStateResponse['resources']['protection']>;
    developerBoost?: Partial<DeveloperResourceBoostState> | null;
  };
  const rawProduction =
    (rawResources.productionPerHour ?? {}) as Partial<GameStateResponse['resources']['productionPerHour']>;
  const rawProtection = (rawResources.protection ?? {}) as Partial<GameStateResponse['resources']['protection']>;
  const rawBoost = (rawResources.developerBoost ?? {}) as Partial<DeveloperResourceBoostState>;
  const baseCap = Math.max(0, Math.floor(toFiniteNumber(rawResources.cap, 0)));

  return {
    ...state,
    resources: {
      ...rawResources,
      wood: Math.max(0, Math.floor(toFiniteNumber(rawResources.wood, 0))),
      stone: Math.max(0, Math.floor(toFiniteNumber(rawResources.stone, 0))),
      iron: Math.max(0, Math.floor(toFiniteNumber(rawResources.iron, 0))),
      gold: Math.max(0, Math.floor(toFiniteNumber(rawResources.gold, 0))),
      coins: Math.max(0, Math.floor(toFiniteNumber(rawResources.coins, 0))),
      cap: baseCap,
      goldCap: Math.max(0, Math.floor(toFiniteNumber(rawResources.goldCap, baseCap))),
      coinsCap: Math.max(0, Math.floor(toFiniteNumber(rawResources.coinsCap, baseCap))),
      productionPerHour: {
        ...rawProduction,
        wood: Math.max(0, Math.floor(toFiniteNumber(rawProduction.wood, 0))),
        stone: Math.max(0, Math.floor(toFiniteNumber(rawProduction.stone, 0))),
        iron: Math.max(0, Math.floor(toFiniteNumber(rawProduction.iron, 0))),
        gold: Math.max(0, Math.floor(toFiniteNumber(rawProduction.gold, 0))),
        mintCoins: Math.max(0, Math.floor(toFiniteNumber(rawProduction.mintCoins, 0))),
        penalty: toFiniteNumber(rawProduction.penalty, 1),
      },
      protection: {
        ...rawProtection,
        wood: Math.max(0, Math.floor(toFiniteNumber(rawProtection.wood, 0))),
        stone: Math.max(0, Math.floor(toFiniteNumber(rawProtection.stone, 0))),
        iron: Math.max(0, Math.floor(toFiniteNumber(rawProtection.iron, 0))),
        gold: Math.max(0, Math.floor(toFiniteNumber(rawProtection.gold, 0))),
        coins: Math.max(0, Math.floor(toFiniteNumber(rawProtection.coins, 0))),
      },
      developerBoost: {
        isActive: rawBoost.isActive === true,
        source: String(rawBoost.source ?? 'none'),
        worldId: rawBoost.worldId == null ? null : String(rawBoost.worldId),
        reason: rawBoost.reason == null ? null : String(rawBoost.reason),
        label: rawBoost.label == null ? null : String(rawBoost.label),
        bonusPercent: toFiniteNumber(rawBoost.bonusPercent, 0),
        multiplier: toFiniteNumber(rawBoost.multiplier, 1),
        startsAt: rawBoost.startsAt == null ? null : String(rawBoost.startsAt),
        endsAt: rawBoost.endsAt == null ? null : String(rawBoost.endsAt),
        remainingSec: Math.max(0, Math.floor(toFiniteNumber(rawBoost.remainingSec, 0))),
      },
    },
  };
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
    owner: 'Bot',
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
    owner: 'Bot',
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
    owner: 'Bot',
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

const getSettlementProtectionRemainingSec = (
  settlement: Pick<RegionSettlement, 'protectionUntil' | 'protectionRemainingSec'>,
  referenceMs = Date.now(),
): number => {
  const remainingFromIso = getRemainingSecondsToIso(settlement.protectionUntil, referenceMs);
  if (remainingFromIso > 0 || settlement.protectionUntil) {
    return remainingFromIso;
  }
  return Math.max(0, Number(settlement.protectionRemainingSec ?? 0));
};

const getSettlementMapKind = (
  settlement: Pick<
    RegionSettlement,
    | 'kind'
    | 'relation'
    | 'owner'
    | 'villageId'
    | 'protectionRemainingSec'
    | 'protectionUntil'
    | 'kingdom'
    | 'mapKind'
    | 'diplomacyKind'
  >,
  activeVillageId: number | null = null,
): MapSettlementKind => {
  if (settlement.diplomacyKind === 'same_kingdom_foreign') {
    return 'royal';
  }

  const mapKindRaw = String(settlement.mapKind ?? '')
    .trim()
    .toLowerCase();
  if ((SETTLEMENT_COLOR_KEYS as readonly string[]).includes(mapKindRaw)) {
    return mapKindRaw as MapSettlementKind;
  }

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
    return 'bot';
  }

  if (isNeutralKingdom(String(settlement.kingdom ?? ''))) {
    return 'royal';
  }

  if (settlement.diplomacyKind === 'ally') {
    return 'allied';
  }

  if (settlement.diplomacyKind === 'non_aggression') {
    return 'nap';
  }

  if (settlement.diplomacyKind === 'war') {
    return 'enemy';
  }

  if (settlement.relation === 'ally') {
    return 'allied';
  }

  if (settlement.relation === 'enemy') {
    return 'enemy';
  }

  return 'opponent';
};

const shouldShowCtrlSettlementBanner = (settlement: Pick<RegionSettlement, 'kind'>): boolean =>
  settlement.kind === 'own' || settlement.kind === 'player' || settlement.kind === 'bot';

const canTargetSettlementForArmyCommand = ({
  settlement,
  commandType,
  currentVillageId,
  currentUsername,
}: {
  settlement: Pick<
    RegionSettlement,
    | 'villageId'
    | 'owner'
    | 'relation'
    | 'commandPermissions'
    | 'protectionRemainingSec'
    | 'protectionUntil'
    | 'prestigeAttackBlockedForViewer'
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

  if (settlement.commandPermissions) {
    if (commandType === 'move') {
      return settlement.commandPermissions.canMove;
    }
    if (commandType === 'support') {
      return settlement.commandPermissions.canSupport;
    }
    return settlement.commandPermissions.canAttack;
  }

  const normalizedCurrentUsername = currentUsername.trim().toLowerCase();
  const normalizedOwner = settlement.owner.trim().toLowerCase();
  const isOwnSettlement = settlement.relation === 'self' || normalizedOwner === normalizedCurrentUsername;

  if (commandType === 'move') {
    return isOwnSettlement;
  }

  if (commandType === 'support') {
    return true;
  }

  const targetProtectionRemainingSec = getSettlementProtectionRemainingSec(settlement);
  if (targetProtectionRemainingSec > 0) {
    return false;
  }
  if (settlement.prestigeAttackBlockedForViewer === true) {
    return false;
  }

  return !isOwnSettlement;
};

const isNeutralKingdom = (kingdom: string): boolean => {
  const normalized = kingdom.trim().toLowerCase();
  return (
    normalized === 'neutral' || normalized === 'kralovska osada' || normalized === 'královská osada'
  );
};

const normalizeKingdomComparable = (value: string): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .trim();

const areSameKingdomComparable = (left: string, right: string): boolean => {
  const leftComparable = normalizeKingdomComparable(left);
  const rightComparable = normalizeKingdomComparable(right);
  return leftComparable.length > 0 && leftComparable === rightComparable;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeRankValue = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.max(1, Math.floor(parsed));
};

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
  if (prestige >= 16000) {
    return 'E';
  }
  if (prestige >= 9000) {
    return 'D';
  }
  if (prestige >= 4500) {
    return 'C';
  }
  if (prestige >= 1500) {
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

const settlementCanvasImageCache = new Map<string, HTMLImageElement>();

const MAP_SETTLEMENT_CANVAS_KIND_STYLE: Record<
  MapSettlementKind,
  {
    fill: string;
    border: string;
    glowRgb: [number, number, number];
  }
> = {
  active: { fill: 'rgba(255, 244, 218, 0.24)', border: 'rgba(255, 230, 175, 0.96)', glowRgb: [255, 228, 171] },
  own: { fill: 'rgba(231, 178, 79, 0.22)', border: 'rgba(255, 201, 88, 0.9)', glowRgb: [255, 197, 92] },
  bot: { fill: 'rgba(159, 140, 255, 0.18)', border: 'rgba(159, 140, 255, 0.74)', glowRgb: [159, 140, 255] },
  royal: { fill: 'rgba(143, 201, 255, 0.2)', border: 'rgba(143, 201, 255, 0.78)', glowRgb: [143, 201, 255] },
  allied: { fill: 'rgba(97, 191, 143, 0.18)', border: 'rgba(97, 191, 143, 0.72)', glowRgb: [97, 191, 143] },
  nap: { fill: 'rgba(111, 198, 216, 0.18)', border: 'rgba(111, 198, 216, 0.72)', glowRgb: [111, 198, 216] },
  opponent: { fill: 'rgba(138, 96, 52, 0.24)', border: 'rgba(181, 131, 73, 0.84)', glowRgb: [145, 103, 56] },
  enemy: { fill: 'rgba(208, 103, 103, 0.2)', border: 'rgba(208, 103, 103, 0.82)', glowRgb: [208, 103, 103] },
  abandoned: { fill: 'rgba(143, 151, 160, 0.14)', border: 'rgba(143, 151, 160, 0.66)', glowRgb: [152, 163, 176] },
};

const MAP_SETTLEMENT_CANVAS_TIER_STYLE: Record<
  SettlementPrestigeTier,
  {
    haloScale: number;
    haloOpacity: number;
    haloRgb: [number, number, number];
  }
> = {
  A: { haloScale: 0.86, haloOpacity: 0.22, haloRgb: [144, 169, 194] },
  B: { haloScale: 1, haloOpacity: 0.28, haloRgb: [125, 176, 224] },
  C: { haloScale: 1.14, haloOpacity: 0.34, haloRgb: [118, 188, 165] },
  D: { haloScale: 1.3, haloOpacity: 0.42, haloRgb: [225, 185, 115] },
  E: { haloScale: 1.48, haloOpacity: 0.54, haloRgb: [252, 220, 142] },
};

const MAP_SETTLEMENT_CANVAS_BADGE_STYLE: Record<
  SettlementCanvasBadgeKind,
  {
    fill: string;
    border: string;
    text: string;
    glow: string;
  }
> = {
  attack: {
    fill: 'rgba(111, 19, 26, 0.92)',
    border: 'rgba(255, 110, 110, 0.82)',
    text: '#f8fcff',
    glow: 'rgba(255, 74, 74, 0.32)',
  },
  support: {
    fill: 'rgba(16, 45, 82, 0.92)',
    border: 'rgba(126, 184, 255, 0.82)',
    text: '#f8fcff',
    glow: 'rgba(125, 186, 255, 0.3)',
  },
  move: {
    fill: 'rgba(98, 69, 18, 0.92)',
    border: 'rgba(238, 199, 109, 0.84)',
    text: '#f8fcff',
    glow: 'rgba(239, 201, 111, 0.3)',
  },
  'knight-attack': {
    fill: 'rgba(69, 34, 96, 0.92)',
    border: 'rgba(206, 167, 255, 0.82)',
    text: '#f8fcff',
    glow: 'rgba(206, 167, 255, 0.28)',
  },
};

const getSettlementCanvasImage = (imagePath: string): HTMLImageElement => {
  const cachedImage = settlementCanvasImageCache.get(imagePath);
  if (cachedImage) {
    return cachedImage;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = imagePath;
  settlementCanvasImageCache.set(imagePath, image);
  return image;
};

const traceRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

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
  if (type === 'messages') {
    return { width: 760, height: 440 };
  }
  if (type === 'activity') {
    return { width: 960, height: 560 };
  }
  if (type === 'village') {
    return { width: 860, height: 360 };
  }
  if (type === 'profile') {
    return { width: 700, height: 430 };
  }
  if (type === 'settings') {
    return { width: 700, height: 440 };
  }
  if (type === 'building') {
    return { width: 720, height: 480 };
  }
  if (type === 'rankings') {
    return { width: 840, height: 500 };
  }
  if (type === 'kingdomProfile' || type === 'playerProfile' || type === 'battleReport') {
    return { width: 820, height: 500 };
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

const getAvatarUrlStorageKey = (username: string): string =>
  `${AVATAR_URL_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;
const getLegacyAvatarUrlStorageKey = (username: string): string =>
  `${LEGACY_AVATAR_URL_STORAGE_KEY_PREFIX}:${username.toLowerCase()}`;

const readStoredAvatarUrl = (username: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getAvatarUrlStorageKey(username)) ??
      window.localStorage.getItem(getLegacyAvatarUrlStorageKey(username));
    if (!raw) {
      return null;
    }
    const normalized = String(raw).trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const saveStoredAvatarUrl = (username: string, avatarUrl: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const key = getAvatarUrlStorageKey(username);
  try {
    const normalized = String(avatarUrl ?? '').trim();
    if (!normalized) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, normalized);
  } catch {
    // Ignore storage errors.
  }
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

const getPlannerLastSessionStorageKey = (username: string, worldId: string): string =>
  `${PLANNER_LAST_SESSION_STORAGE_KEY_PREFIX}:${username.toLowerCase()}:${worldId.toLowerCase()}`;
const getLegacyPlannerLastSessionStorageKey = (username: string, worldId: string): string =>
  `${LEGACY_PLANNER_LAST_SESSION_STORAGE_KEY_PREFIX}:${username.toLowerCase()}:${worldId.toLowerCase()}`;

const normalizePlannerLegDraft = (value: unknown): PlannerLegDraft | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<PlannerLegDraft>;
  const originVillageId = Math.floor(Number(candidate.originVillageId ?? 0));
  const impactAtUtc = String(candidate.impactAtUtc ?? '').trim();
  if (!Number.isFinite(originVillageId) || originVillageId <= 0 || !impactAtUtc) {
    return null;
  }

  const parsedImpact = Date.parse(impactAtUtc);
  if (!Number.isFinite(parsedImpact)) {
    return null;
  }

  const units: Partial<Record<CommandUnitId, number>> = {};
  const rawUnits =
    candidate.units && typeof candidate.units === 'object'
      ? (candidate.units as Partial<Record<CommandUnitId, unknown>>)
      : {};
  for (const unitId of COMMAND_UNIT_ORDER) {
    const amountRaw = Math.floor(Number(rawUnits[unitId] ?? 0));
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      continue;
    }
    units[unitId] = amountRaw;
  }

  return {
    originVillageId,
    impactAtUtc: new Date(parsedImpact).toISOString(),
    units,
  };
};

const readStoredPlannerLastSessionDraft = (username: string, worldId: string): PlannerDraftState | null => {
  if (typeof window === 'undefined' || !worldId) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getPlannerLastSessionStorageKey(username, worldId)) ??
      window.localStorage.getItem(getLegacyPlannerLastSessionStorageKey(username, worldId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PlannerDraftState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const targetPlayerUsername = String(parsed.targetPlayerUsername ?? '').trim();
    const targetVillageIdRaw = Number(parsed.targetVillageId ?? 0);
    const targetVillageId =
      Number.isFinite(targetVillageIdRaw) && targetVillageIdRaw > 0 ? Math.floor(targetVillageIdRaw) : null;
    const parsedUpdatedAtMs = Date.parse(String(parsed.updatedAt ?? ''));
    const rawLegs = Array.isArray(parsed.legs) ? parsed.legs : [];
    const legs = rawLegs
      .map((leg) => normalizePlannerLegDraft(leg))
      .filter((leg): leg is PlannerLegDraft => leg != null);

    if (legs.length <= 0 && !targetPlayerUsername && targetVillageId == null) {
      return null;
    }

    return {
      targetPlayerUsername,
      targetVillageId,
      legs,
      updatedAt: Number.isFinite(parsedUpdatedAtMs)
        ? new Date(parsedUpdatedAtMs).toISOString()
        : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const saveStoredPlannerLastSessionDraft = (
  username: string,
  worldId: string,
  draft: PlannerDraftState | null,
): void => {
  if (typeof window === 'undefined' || !worldId) {
    return;
  }

  const key = getPlannerLastSessionStorageKey(username, worldId);
  try {
    if (!draft || (!draft.targetPlayerUsername && draft.targetVillageId == null && draft.legs.length <= 0)) {
      window.localStorage.removeItem(key);
      return;
    }
    const draftUpdatedAtMs = Date.parse(String(draft.updatedAt ?? ''));
    const normalizedLegs = draft.legs
      .map((leg) => normalizePlannerLegDraft(leg))
      .filter((leg): leg is PlannerLegDraft => leg != null);
    const payload: PlannerDraftState = {
      targetPlayerUsername: String(draft.targetPlayerUsername ?? '').trim(),
      targetVillageId:
        draft.targetVillageId != null && Number.isFinite(Number(draft.targetVillageId))
          ? Math.floor(Number(draft.targetVillageId))
          : null,
      legs: normalizedLegs,
      updatedAt: Number.isFinite(draftUpdatedAtMs)
        ? new Date(draftUpdatedAtMs).toISOString()
        : new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
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

type StoredMapViewport = {
  leftRatio: number;
  topRatio: number;
};

const getMapViewportStorageKey = (username: string, regionId: number): string =>
  `${MAP_VIEWPORT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}:${Math.max(1, Math.floor(Number(regionId) || 1))}`;
const getLegacyMapViewportStorageKey = (username: string, regionId: number): string =>
  `${LEGACY_MAP_VIEWPORT_STORAGE_KEY_PREFIX}:${username.toLowerCase()}:${Math.max(1, Math.floor(Number(regionId) || 1))}`;

const readStoredMapViewport = (username: string, regionId: number): StoredMapViewport | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getMapViewportStorageKey(username, regionId)) ??
      window.localStorage.getItem(getLegacyMapViewportStorageKey(username, regionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMapViewport> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const leftRatio = Number(parsed.leftRatio);
    const topRatio = Number(parsed.topRatio);
    if (!Number.isFinite(leftRatio) || !Number.isFinite(topRatio)) {
      return null;
    }

    return {
      leftRatio: clamp(leftRatio, 0, 1),
      topRatio: clamp(topRatio, 0, 1),
    };
  } catch {
    return null;
  }
};

const saveStoredMapViewport = (username: string, regionId: number, viewport: StoredMapViewport): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getMapViewportStorageKey(username, regionId),
      JSON.stringify({
        leftRatio: clamp(Number(viewport.leftRatio), 0, 1),
        topRatio: clamp(Number(viewport.topRatio), 0, 1),
      }),
    );
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

const normalizeMapPreviewTravelModifier = (value: unknown): MapPreviewTravelModifierKey => {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('cs-CZ');
  return MAP_PREVIEW_TRAVEL_MODIFIER_OPTIONS.some((item) => item.value === normalized)
    ? (normalized as MapPreviewTravelModifierKey)
    : DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER;
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('cs-CZ');
  if (/^#[0-9a-f]{6}$/u.test(normalized)) {
    return normalized;
  }
  if (/^#[0-9a-f]{3}$/u.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return fallback;
};

const normalizeSettlementColorPalette = (value: unknown): SettlementColorPalette => {
  const normalized: SettlementColorPalette = { ...DEFAULT_SETTLEMENT_COLOR_PALETTE };
  if (!value || typeof value !== 'object') {
    return normalized;
  }
  const rawPalette = value as Partial<Record<SettlementColorKey, unknown>>;
  SETTLEMENT_COLOR_KEYS.forEach((key) => {
    normalized[key] = normalizeHexColor(rawPalette[key], DEFAULT_SETTLEMENT_COLOR_PALETTE[key]);
  });
  return normalized;
};

const readStoredShortcutSettings = (
  username: string,
): {
  autoHidePinColumns: boolean;
  customBindings: Partial<Record<ShortcutActionId, ShortcutBinding>>;
  mapPreviewTravelModifier: MapPreviewTravelModifierKey;
  settlementColors: SettlementColorPalette;
} => {
  if (typeof window === 'undefined') {
    return {
      autoHidePinColumns: false,
      customBindings: {},
      mapPreviewTravelModifier: DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER,
      settlementColors: { ...DEFAULT_SETTLEMENT_COLOR_PALETTE },
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
        mapPreviewTravelModifier: DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER,
        settlementColors: { ...DEFAULT_SETTLEMENT_COLOR_PALETTE },
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
      mapPreviewTravelModifier: normalizeMapPreviewTravelModifier(parsed?.mapPreviewTravelModifier),
      settlementColors: normalizeSettlementColorPalette(parsed?.settlementColors),
    };
  } catch {
    return {
      autoHidePinColumns: false,
      customBindings: {},
      mapPreviewTravelModifier: DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER,
      settlementColors: { ...DEFAULT_SETTLEMENT_COLOR_PALETTE },
    };
  }
};

const saveStoredShortcutSettings = (
  username: string,
  settings: {
    autoHidePinColumns: boolean;
    customBindings: Partial<Record<ShortcutActionId, ShortcutBinding>>;
    mapPreviewTravelModifier: MapPreviewTravelModifierKey;
    settlementColors: SettlementColorPalette;
  },
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
        mapPreviewTravelModifier: normalizeMapPreviewTravelModifier(settings.mapPreviewTravelModifier),
        settlementColors: normalizeSettlementColorPalette(settings.settlementColors),
      }),
    );
  } catch {
    // Ignore storage errors.
  }
};

const normalizePanelStorageScope = (worldId: string | null | undefined): string => {
  const normalized = String(worldId ?? '').trim().toLocaleLowerCase('cs-CZ');
  return normalized.length > 0 ? normalized : 'global';
};
const getPanelLayoutStorageKey = (username: string, worldId: string | null | undefined): string =>
  `${PANEL_LAYOUT_STORAGE_KEY_PREFIX}:${PANEL_STORAGE_SCHEMA_VERSION}:${username.toLocaleLowerCase('cs-CZ')}:${normalizePanelStorageScope(worldId)}`;
const getLegacyPanelLayoutStorageKey = (username: string): string =>
  `${LEGACY_PANEL_LAYOUT_STORAGE_KEY_PREFIX}:${username.toLocaleLowerCase('cs-CZ')}`;
const getPanelPlacementStorageKey = (username: string, worldId: string | null | undefined): string =>
  `${PANEL_PLACEMENT_STORAGE_KEY_PREFIX}:${PANEL_STORAGE_SCHEMA_VERSION}:${username.toLocaleLowerCase('cs-CZ')}:${normalizePanelStorageScope(worldId)}`;
const getLegacyPanelPlacementStorageKey = (username: string): string =>
  `${LEGACY_PANEL_PLACEMENT_STORAGE_KEY_PREFIX}:${username.toLocaleLowerCase('cs-CZ')}`;

const isPanelLayoutMode = (value: unknown): value is PanelLayoutMode =>
  value === 'floating' || value === 'full' || value === 'split-left' || value === 'split-right';

const readStoredPanelPlacement = (
  username: string,
  worldId: string | null | undefined,
): StoredPanelPlacementByType => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const scopedRaw = window.localStorage.getItem(getPanelPlacementStorageKey(username, worldId));
    const raw =
      scopedRaw ??
      (normalizePanelStorageScope(worldId) === 'global'
        ? window.localStorage.getItem(getLegacyPanelPlacementStorageKey(username))
        : null);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const placement: StoredPanelPlacementByType = {};
    for (const [panelTypeRaw, value] of Object.entries(parsed)) {
      if (typeof panelTypeRaw !== 'string') {
        continue;
      }
      if (!(panelTypeRaw in PANEL_META)) {
        continue;
      }
      const panelType = panelTypeRaw as PanelType;
      if (!isStaticPanelType(panelType)) {
        continue;
      }
      if (!value || typeof value !== 'object') {
        continue;
      }
      const candidate = value as Partial<{ side: PinSide; layoutMode: PanelLayoutMode }>;
      const side: PinSide = candidate.side === 'right' ? 'right' : 'left';
      const layoutMode: PanelLayoutMode = isPanelLayoutMode(candidate.layoutMode)
        ? candidate.layoutMode
        : side === 'right'
          ? 'split-right'
          : 'split-left';

      placement[panelType] = {
        side,
        layoutMode,
      };
    }

    return placement;
  } catch {
    return {};
  }
};

const saveStoredPanelPlacement = (
  username: string,
  worldId: string | null | undefined,
  placement: StoredPanelPlacementByType,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: Record<string, { side: PinSide; layoutMode: PanelLayoutMode }> = {};
  for (const [panelTypeRaw, value] of Object.entries(placement)) {
    if (typeof panelTypeRaw !== 'string') {
      continue;
    }
    if (!(panelTypeRaw in PANEL_META)) {
      continue;
    }
    const panelType = panelTypeRaw as PanelType;
    if (!isStaticPanelType(panelType)) {
      continue;
    }
    if (!value || typeof value !== 'object') {
      continue;
    }
    const side: PinSide = value.side === 'right' ? 'right' : 'left';
    const layoutMode: PanelLayoutMode = isPanelLayoutMode(value.layoutMode)
      ? value.layoutMode
      : side === 'right'
        ? 'split-right'
        : 'split-left';
    payload[panelType] = { side, layoutMode };
  }

  try {
    window.localStorage.setItem(getPanelPlacementStorageKey(username, worldId), JSON.stringify(payload));
  } catch {
    // Ignore storage errors.
  }
};

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
  const initialViewport = getInitialGameLayoutViewportSize();
  const viewportWidth = initialViewport.width;
  const viewportHeight = initialViewport.height;
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
  const persistedLayoutMode = candidate.layoutMode;
  const layoutMode: PanelLayoutMode =
    persistedLayoutMode === 'full' ||
    persistedLayoutMode === 'split-left' ||
    persistedLayoutMode === 'split-right' ||
    persistedLayoutMode === 'floating'
      ? persistedLayoutMode
      : canPanelUseDockLayout(meta.type)
        ? 'full'
        : 'floating';
  const normalizedLayoutMode: PanelLayoutMode = !canPanelUseDockLayout(meta.type)
    ? 'floating'
    : layoutMode === 'floating'
      ? side === 'right'
        ? 'split-right'
        : 'split-left'
      : layoutMode;

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
    layoutMode: normalizedLayoutMode,
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

const readStoredPanelLayout = (username: string, worldId: string | null | undefined): PanelWindow[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const scopedRaw = window.localStorage.getItem(getPanelLayoutStorageKey(username, worldId));
    const raw =
      scopedRaw ??
      (normalizePanelStorageScope(worldId) === 'global'
        ? window.localStorage.getItem(getLegacyPanelLayoutStorageKey(username))
        : null);
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

const savePanelLayout = (
  username: string,
  worldId: string | null | undefined,
  panels: PanelWindow[],
): void => {
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
    layoutMode: panel.layoutMode,
    settlementId: panel.settlementId,
    buildingId: panel.buildingId,
    battleReportId: panel.battleReportId,
    villageName: panel.villageName,
    kingdomName: panel.kingdomName,
    playerUsername: panel.playerUsername,
  }));

  try {
    window.localStorage.setItem(getPanelLayoutStorageKey(username, worldId), JSON.stringify(payload));
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
      | 'layoutMode'
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
  const initialViewport = getInitialGameLayoutViewportSize();
  const viewportWidth = initialViewport.width;
  const viewportHeight = initialViewport.height;
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
    layoutMode: overrides.layoutMode ?? 'floating',
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

const formatArmadaGarrisonTooltip = (village: ArmyVillageSummary): string => {
  const garrison = village.garrison;
  if (!garrison?.isUnlocked) {
    return 'Posádka není odemčená (Radnice L5).';
  }
  return `Posádka\nCelkem: ${Math.max(0, Number(garrison.totalUnits ?? 0)).toLocaleString('cs-CZ')} / ${Math.max(
    0,
    Number(garrison.totalCap ?? 0),
  ).toLocaleString('cs-CZ')}\nMilice: ${Math.max(0, Number(garrison.militia ?? 0)).toLocaleString(
    'cs-CZ',
  )}\nLučištníci: ${Math.max(0, Number(garrison.archer ?? 0)).toLocaleString('cs-CZ')}`;
};

const formatArmadaRecruitmentTooltip = (village: ArmyVillageSummary): string => {
  const queue = [...(village.activeRecruitments ?? [])].sort(
    (left, right) => Number(left.queueIndex ?? 0) - Number(right.queueIndex ?? 0),
  );
  if (queue.length <= 0) {
    return 'Žádný aktivní nábor.';
  }
  const rows = queue.slice(0, 6).map((entry, index) => {
    const amount = Math.max(0, Math.floor(Number(entry.amount ?? 0))).toLocaleString('cs-CZ');
    const eta = formatDurationLabel(Math.max(0, Math.floor(Number(entry.remainingSec ?? 0))));
    const status =
      String(entry.status ?? '').toLowerCase() === 'in_progress'
        ? 'běží'
        : String(entry.status ?? '').toLowerCase() === 'queued'
          ? 've frontě'
          : String(entry.status ?? '');
    return `${index + 1}. ${entry.unitName} +${amount} · ${eta} (${status})`;
  });
  if (queue.length > 6) {
    rows.push(`… +${(queue.length - 6).toLocaleString('cs-CZ')} dalších položek`);
  }
  return `Aktuální nábor\n${rows.join('\n')}`;
};

const formatCompactResourceAmount = (amountRaw: number): string => {
  const amount = Math.max(0, Math.floor(Number(amountRaw ?? 0)));
  if (amount >= 1_000_000) {
    const value = amount / 1_000_000;
    const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted.replace(/\.0$/, '').replace('.', ',')}m`;
  }
  if (amount >= 1_000) {
    const value = amount / 1_000;
    const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted.replace(/\.0$/, '').replace('.', ',')}k`;
  }
  return amount.toLocaleString('cs-CZ');
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

const getRemainingSecondsToIso = (value: string | null | undefined, referenceMs = Date.now()): number => {
  if (!value) {
    return 0;
  }
  const targetMs = Date.parse(String(value));
  if (!Number.isFinite(targetMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((targetMs - referenceMs) / 1000));
};

const getWorldSnapshotVersion = (
  world: Pick<GameStateResponse['world'], 'snapshotKey' | 'version'> | null | undefined,
): string | null => {
  const snapshotKey = String(world?.snapshotKey ?? '').trim();
  if (snapshotKey) {
    return snapshotKey;
  }
  const version = String(world?.version ?? '').trim();
  return version || null;
};

const useSecondClock = (enabled = true): number => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const initialTimer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [enabled]);

  return nowMs;
};

const formatDateTimePragueLabel = (value: string | number | Date | null | undefined): string => {
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
    timeZone: PRAGUE_TIMEZONE,
  }).format(new Date(timestampMs));
};

const roundIsoToWholeMinute = (isoValue: string): string => {
  const parsed = Date.parse(String(isoValue));
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }
  const roundedMs = Math.ceil(parsed / 60000) * 60000;
  return new Date(roundedMs).toISOString();
};

const addMinutesToIso = (isoValue: string, deltaMinutes: number): string => {
  const parsed = Date.parse(String(isoValue));
  const safeParsed = Number.isFinite(parsed) ? parsed : Date.now();
  const deltaMs = Math.round(Number(deltaMinutes ?? 0) * 60_000);
  return new Date(safeParsed + deltaMs).toISOString();
};

const calculatePlannerTravelDurationSec = (
  units: Partial<Record<CommandUnitId, number>>,
  originVillage: Pick<ArmyVillageSummary, 'coordX' | 'coordY'>,
  targetVillage: Pick<RegionSettlement, 'globalX' | 'globalY'>,
): number => {
  const distanceTiles = Math.max(
    Math.abs(Number(targetVillage.globalX) - Number(originVillage.coordX)),
    Math.abs(Number(targetVillage.globalY) - Number(originVillage.coordY)),
  );
  if (!Number.isFinite(distanceTiles) || distanceTiles <= 0) {
    return MIN_ARMY_TRAVEL_DURATION_SEC;
  }

  let slowestSpeed = Number.POSITIVE_INFINITY;
  let hasUnits = false;
  for (const unitId of COMMAND_UNIT_ORDER) {
    const amount = Math.max(0, Math.floor(Number(units[unitId] ?? 0)));
    if (amount <= 0) {
      continue;
    }
    const unitSpeed = Math.max(0, Number(UNIT_TRAVEL_SPEED_TILES_PER_HOUR[unitId] ?? 0));
    if (unitSpeed <= 0) {
      continue;
    }
    hasUnits = true;
    slowestSpeed = Math.min(slowestSpeed, unitSpeed);
  }

  if (!hasUnits || !Number.isFinite(slowestSpeed) || slowestSpeed <= 0) {
    return MIN_ARMY_TRAVEL_DURATION_SEC;
  }

  const durationSec = (distanceTiles / slowestSpeed) * 3600 * ARMY_TRAVEL_TIME_MULTIPLIER;
  return Math.max(MIN_ARMY_TRAVEL_DURATION_SEC, Math.round(durationSec));
};

const normalizePlannerLegTimeline = (
  legs: PlannerLegDraft[],
  constraints: PlannerConstraints,
  referenceMs: number = Date.now(),
): PlannerLegDraft[] => {
  if (legs.length <= 0) {
    return [];
  }
  const minGapMinutes = Math.max(1, Math.floor(Number(constraints.minImpactGapMinutes ?? DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES)));
  const leadTimeSec = Math.max(0, Math.floor(Number(constraints.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC)));
  const firstAllowedMs = referenceMs + leadTimeSec * 1000;

  const normalized: PlannerLegDraft[] = [];
  let previousImpactMs = 0;
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const parsedImpactMs = Date.parse(String(leg.impactAtUtc ?? ''));
    const fallbackImpactMs = firstAllowedMs + index * minGapMinutes * 60_000;
    const sourceImpactMs = Number.isFinite(parsedImpactMs) ? parsedImpactMs : fallbackImpactMs;
    const minAllowedForLegMs =
      index === 0 ? firstAllowedMs : previousImpactMs + minGapMinutes * 60_000;
    const nextImpactMs = Math.max(minAllowedForLegMs, sourceImpactMs);
    previousImpactMs = nextImpactMs;
    normalized.push({
      ...leg,
      impactAtUtc: new Date(nextImpactMs).toISOString(),
    });
  }

  return normalized;
};

const normalizePlannerLegTimelineForwardOneMinute = (
  legs: PlannerLegDraft[],
  constraints: PlannerConstraints,
  referenceMs: number = Date.now(),
): PlannerLegDraft[] => {
  if (legs.length <= 0) {
    return [];
  }

  const leadTimeSec = Math.max(0, Math.floor(Number(constraints.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC)));
  const firstAllowedMs = referenceMs + leadTimeSec * 1000;
  const parsedFirstImpactMs = Date.parse(String(legs[0]?.impactAtUtc ?? ''));
  const firstImpactMs = Math.max(
    firstAllowedMs,
    Number.isFinite(parsedFirstImpactMs) ? parsedFirstImpactMs : firstAllowedMs,
  );

  return legs.map((leg, index) => ({
    ...leg,
    impactAtUtc: new Date(firstImpactMs + index * 60_000).toISOString(),
  }));
};

const normalizePlannerLegTimelineFromLast = (
  legs: PlannerLegDraft[],
  constraints: PlannerConstraints,
  referenceMs: number = Date.now(),
): PlannerLegDraft[] => {
  if (legs.length <= 0) {
    return [];
  }

  const minGapMinutes = Math.max(
    1,
    Math.floor(Number(constraints.minImpactGapMinutes ?? DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES)),
  );
  const gapMs = minGapMinutes * 60_000;
  const leadTimeSec = Math.max(0, Math.floor(Number(constraints.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC)));
  const firstAllowedMs = referenceMs + leadTimeSec * 1000;
  const lastIndex = legs.length - 1;
  const minimumLastImpactMs = firstAllowedMs + lastIndex * gapMs;
  const parsedLastImpactMs = Date.parse(String(legs[lastIndex]?.impactAtUtc ?? ''));
  const anchorLastImpactMs = Math.max(
    minimumLastImpactMs,
    Number.isFinite(parsedLastImpactMs) ? parsedLastImpactMs : minimumLastImpactMs,
  );

  const impactByIndex: number[] = new Array(legs.length).fill(0);
  impactByIndex[lastIndex] = anchorLastImpactMs;
  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const parsedImpactMs = Date.parse(String(legs[index]?.impactAtUtc ?? ''));
    const fallbackImpactMs = anchorLastImpactMs - (lastIndex - index) * gapMs;
    const sourceImpactMs = Number.isFinite(parsedImpactMs) ? parsedImpactMs : fallbackImpactMs;
    const maxAllowedMs = impactByIndex[index + 1] - gapMs;
    impactByIndex[index] = Math.min(sourceImpactMs, maxAllowedMs);
  }

  if (impactByIndex[0] < firstAllowedMs) {
    const shiftMs = firstAllowedMs - impactByIndex[0];
    for (let index = 0; index < impactByIndex.length; index += 1) {
      impactByIndex[index] += shiftMs;
    }
  }

  return legs.map((leg, index) => ({
    ...leg,
    impactAtUtc: new Date(impactByIndex[index]).toISOString(),
  }));
};

const toPlannerRequestLegs = (
  legRows: Array<{
    order: number;
    key: number;
    impactAtUtc: string;
    units: Partial<Record<CommandUnitId, number>>;
  }>,
) =>
  legRows.map((legRow) => ({
    order: Math.max(1, Math.floor(Number(legRow.order ?? 1))),
    originVillageId: Math.max(1, Math.floor(Number(legRow.key ?? 1))),
    impactAtPrague: String(legRow.impactAtUtc),
    units: COMMAND_UNIT_ORDER
      .map((unitId) => ({
        unitId,
        amount: Math.max(0, Math.floor(Number(legRow.units?.[unitId] ?? 0))),
      }))
      .filter((item) => item.amount > 0),
  }));

const resolvePlannerPlanStatusMeta = (
  statusRaw: string | null | undefined,
): { label: string; tone: 'ok' | 'warning' | 'blocked' | 'neutral' } => {
  const status = String(statusRaw ?? '').toLocaleLowerCase('cs-CZ');
  if (status === 'scheduled') {
    return { label: 'Naplánováno', tone: 'ok' };
  }
  if (status === 'needs_reconfirmation') {
    return { label: 'Čeká na potvrzení', tone: 'warning' };
  }
  if (status === 'dispatching') {
    return { label: 'Odesílá se', tone: 'neutral' };
  }
  if (status === 'completed') {
    return { label: 'Dokončeno', tone: 'ok' };
  }
  if (status === 'failed') {
    return { label: 'Selhalo', tone: 'blocked' };
  }
  if (status === 'canceled') {
    return { label: 'Zrušeno', tone: 'blocked' };
  }
  return { label: 'Neznámý stav', tone: 'neutral' };
};

const resolvePlannerLegStatusMeta = (
  statusRaw: string | null | undefined,
): { label: string; tone: 'ok' | 'warning' | 'blocked' | 'neutral' } => {
  const status = String(statusRaw ?? '').toLocaleLowerCase('cs-CZ');
  if (status === 'scheduled') {
    return { label: 'Naplánováno', tone: 'ok' };
  }
  if (status === 'sent') {
    return { label: 'Odesláno', tone: 'ok' };
  }
  if (status === 'failed') {
    return { label: 'Selhalo', tone: 'blocked' };
  }
  if (status === 'canceled') {
    return { label: 'Zrušeno', tone: 'blocked' };
  }
  return { label: 'Neznámý stav', tone: 'neutral' };
};

const buildPlannerDraftFromActivePlan = (
  activePlan: PlannerOpenResponse['activePlan'],
): PlannerDraftState => {
  if (!activePlan) {
    return {
      targetPlayerUsername: '',
      targetVillageId: null,
      legs: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const legs = [...(activePlan.legs ?? [])]
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))
    .map((leg) => {
      const units: Partial<Record<CommandUnitId, number>> = {};
      for (const item of leg.units ?? []) {
        const unitId = String(item.unitId ?? '') as CommandUnitId;
        if (!COMMAND_UNIT_ORDER.includes(unitId)) {
          continue;
        }
        const plannedAmount = Math.max(0, Math.floor(Number(item.plannedAmount ?? 0)));
        if (plannedAmount <= 0) {
          continue;
        }
        units[unitId] = plannedAmount;
      }
      return {
        originVillageId: Math.max(0, Math.floor(Number(leg.originVillageId ?? 0))),
        impactAtUtc: String(leg.impactAtUtc ?? ''),
        units,
      };
    })
    .filter((leg) => Number.isFinite(leg.originVillageId) && leg.originVillageId > 0);

  const targetVillageId = Math.floor(Number(activePlan.plan.targetVillageId ?? 0));
  return {
    targetPlayerUsername: String(activePlan.plan.targetPlayerUsernameSnapshot ?? '').trim(),
    targetVillageId: Number.isFinite(targetVillageId) && targetVillageId > 0 ? targetVillageId : null,
    legs,
    updatedAt: new Date().toISOString(),
  };
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

const CityPanel = memo(({
  villageLabel,
  prestige,
  cityResourceSnapshot,
  availableResources,
  buildings,
  onOpenBuilding,
  onUpgradeBuilding,
  onCancelBuildingUpgrade,
  onCancelAllBuildingUpgrades,
  onReorderBuildingUpgrade,
  buildingUpgradeQueueByBuilding,
  upgradePendingBuildingId,
  cancelUpgradePendingOrderId,
  reorderUpgradePendingOrderId,
  cancelUpgradeQueuePending,
  buildingNotices,
}: {
  villageLabel: string;
  prestige: number;
  cityResourceSnapshot: CityPanelResourceSnapshot;
  availableResources: ResourceCost;
  buildings: Building[];
  onOpenBuilding: (building: Building) => void;
  onUpgradeBuilding: (building: Building) => void;
  onCancelBuildingUpgrade: (upgradeOrderId: number, buildingId: string) => void;
  onCancelAllBuildingUpgrades: () => void;
  onReorderBuildingUpgrade: (upgradeOrderId: number, targetIndex: number) => void;
  buildingUpgradeQueueByBuilding: Map<string, BuildingUpgradeQueueOrder[]>;
  upgradePendingBuildingId: string | null;
  cancelUpgradePendingOrderId: number | null;
  reorderUpgradePendingOrderId: number | null;
  cancelUpgradeQueuePending: boolean;
  buildingNotices: Record<string, string>;
}) => {
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [buildingTooltipCursorPosition, setBuildingTooltipCursorPosition] = useState<TooltipCursorPosition | null>(
    null,
  );
  const [isCityResourceTooltipOpen, setIsCityResourceTooltipOpen] = useState(false);
  const [cityResourceTooltipCursorPosition, setCityResourceTooltipCursorPosition] =
    useState<TooltipCursorPosition | null>(null);
  const [draggedQueueOrderId, setDraggedQueueOrderId] = useState<number | null>(null);
  const [queueActionTooltip, setQueueActionTooltip] = useState<{
    title: string;
    description: string;
    cursorPosition: TooltipCursorPosition | null;
  } | null>(null);
  const openQueueActionTooltipAtCursor = useCallback(
    (event: ReactMouseEvent<HTMLElement>, title: string, description: string) => {
      setQueueActionTooltip({
        title,
        description,
        cursorPosition: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    },
    [],
  );
  const openQueueActionTooltipAtElement = useCallback(
    (event: ReactFocusEvent<HTMLElement>, title: string, description: string) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setQueueActionTooltip({
        title,
        description,
        cursorPosition: {
          x: Math.floor(rect.left + rect.width * 0.5),
          y: Math.floor(rect.top + rect.height * 0.5),
        },
      });
    },
    [],
  );
  const moveQueueActionTooltip = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    setQueueActionTooltip((previous) =>
      previous
        ? {
            ...previous,
            cursorPosition: {
              x: event.clientX,
              y: event.clientY,
            },
          }
        : previous,
    );
  }, []);
  const closeQueueActionTooltip = useCallback(() => {
    setQueueActionTooltip(null);
  }, []);
  const bindQueueActionTooltip = useCallback(
    (title: string, description: string) => ({
      onMouseEnter: (event: ReactMouseEvent<HTMLElement>) =>
        openQueueActionTooltipAtCursor(event, title, description),
      onMouseMove: moveQueueActionTooltip,
      onMouseLeave: closeQueueActionTooltip,
      onFocus: (event: ReactFocusEvent<HTMLElement>) =>
        openQueueActionTooltipAtElement(event, title, description),
      onBlur: closeQueueActionTooltip,
    }),
    [
      closeQueueActionTooltip,
      moveQueueActionTooltip,
      openQueueActionTooltipAtCursor,
      openQueueActionTooltipAtElement,
    ],
  );
  const buildingsById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );
  const settlementPrestigeMeta = useMemo(() => resolveSettlementPrestigeMeta(prestige), [prestige]);

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

  const cityResourceRows = useMemo<CityPanelResourceRow[]>(
    () =>
      [
        ...CITY_PANEL_RESOURCE_DEFINITIONS.map((definition) => {
          const building = buildingsById.get(definition.buildingId);
          const resourceLabel = definition.label;
          const resourceIcon = resolveResourceGlyph(resourceLabel);

          return {
            key: definition.key,
            label: definition.label,
            icon: resourceIcon,
            amount: Math.max(0, Math.floor(Number(cityResourceSnapshot[definition.key] ?? 0))),
            productionPerHour: Math.max(
              0,
              Math.floor(Number(cityResourceSnapshot.productionPerHour[definition.productionField] ?? 0)),
            ),
            capacity: Math.max(0, Math.floor(Number(cityResourceSnapshot[definition.capacityField] ?? 0))),
            protectedAmount: Math.max(
              0,
              Math.floor(Number(cityResourceSnapshot.protection[definition.protectionField] ?? 0)),
            ),
            buildingLevel: Math.max(0, Math.floor(Number(building?.level ?? 0))),
            buildingName:
              building?.name ?? BUILDING_ART[definition.buildingId]?.fallbackName ?? definition.buildingId,
          };
        }),
        {
          key: 'population',
          label: 'Populace',
          icon: resolveResourceGlyph('Populace'),
          amount: Math.max(0, Math.floor(Number(cityResourceSnapshot.populationUsed ?? 0))),
          productionPerHour: null,
          capacity: Math.max(0, Math.floor(Number(cityResourceSnapshot.populationCap ?? 0))),
          protectedAmount: 0,
          buildingLevel: Math.max(0, Math.floor(Number(buildingsById.get('residential-quarter')?.level ?? 0))),
          buildingName:
            buildingsById.get('residential-quarter')?.name ??
            BUILDING_ART['residential-quarter']?.fallbackName ??
            'residential-quarter',
        },
      ],
    [buildingsById, cityResourceSnapshot],
  );
  const cityResourceTooltipRows = useMemo(() => {
    const desiredOrder = ['wood', 'gold', 'stone', 'coins', 'iron', 'population'];
    const rowByKey = new Map(cityResourceRows.map((row) => [row.key, row]));
    const ordered = desiredOrder
      .map((key) => rowByKey.get(key))
      .filter((row): row is CityPanelResourceRow => row != null);
    if (ordered.length >= cityResourceRows.length) {
      return ordered;
    }
    const usedKeys = new Set(ordered.map((row) => row.key));
    const remaining = cityResourceRows.filter((row) => !usedKeys.has(row.key));
    return [...ordered, ...remaining];
  }, [cityResourceRows]);

  const upgradeQueueRows = useMemo(() => {
    const allOrders = Array.from(buildingUpgradeQueueByBuilding.values()).flatMap((orders) => orders);
    const sortedOrders = [...allOrders].sort((left, right) => {
      const leftFinishMs = Date.parse(String(left.finishAt));
      const rightFinishMs = Date.parse(String(right.finishAt));
      if (Number.isFinite(leftFinishMs) && Number.isFinite(rightFinishMs) && leftFinishMs !== rightFinishMs) {
        return leftFinishMs - rightFinishMs;
      }
      return Number(left.id) - Number(right.id);
    });

    return sortedOrders.map((order, index) => {
      const startsInSec = index <= 0 ? 0 : Math.max(0, Math.floor(Number(sortedOrders[index - 1]?.remainingSec ?? 0)));
      return {
        ...order,
        queueIndex: index,
        isActive: index === 0,
        startsInSec,
        buildingIcon:
          buildingsById.get(order.buildingId)?.icon ??
          BUILDING_ART[order.buildingId]?.icon ??
          DEFAULT_BUILDING_ICON,
        buildingName:
          buildingsById.get(order.buildingId)?.name ??
          BUILDING_ART[order.buildingId]?.fallbackName ??
          order.buildingId,
      };
    });
  }, [buildingUpgradeQueueByBuilding, buildingsById]);
  const firstQueueOrderIdByBuilding = useMemo(() => {
    const byBuilding = new Map<string, number>();
    for (const order of upgradeQueueRows) {
      if (!byBuilding.has(order.buildingId)) {
        byBuilding.set(order.buildingId, order.id);
      }
    }
    return byBuilding;
  }, [upgradeQueueRows]);
  const isQueueActionPending =
    cancelUpgradeQueuePending || cancelUpgradePendingOrderId != null || reorderUpgradePendingOrderId != null;

  return (
    <div className="city-panel">
      <div className="city-overview-layout">
        <div className="city-layout">
          <section className="city-stats-grid city-overview-summary">
            <article>
              <h4>{settlementPrestigeMeta.label}</h4>
              <strong className="city-stat-value tld-type-stat">{villageLabel}</strong>
            </article>
            <article>
              <h4>Prestiž</h4>
              <strong className="city-stat-value tld-type-stat">{prestige.toLocaleString('cs-CZ')} bodů</strong>
            </article>
            <article
              className="city-resource-stock-card"
              tabIndex={0}
              onMouseEnter={(event) => {
                setIsCityResourceTooltipOpen(true);
                setCityResourceTooltipCursorPosition({ x: event.clientX, y: event.clientY });
              }}
              onMouseMove={(event) => {
                if (!isCityResourceTooltipOpen) {
                  return;
                }
                setCityResourceTooltipCursorPosition({ x: event.clientX, y: event.clientY });
              }}
              onMouseLeave={() => {
                setIsCityResourceTooltipOpen(false);
                setCityResourceTooltipCursorPosition(null);
              }}
              onFocus={() => {
                setIsCityResourceTooltipOpen(true);
                if (typeof window !== 'undefined') {
                  setCityResourceTooltipCursorPosition({
                    x: Math.floor(window.innerWidth * 0.58),
                    y: Math.floor(window.innerHeight * 0.28),
                  });
                }
              }}
              onBlur={() => {
                setIsCityResourceTooltipOpen(false);
                setCityResourceTooltipCursorPosition(null);
              }}
            >
              <h4>Suroviny v léně</h4>
              <ul className="city-resource-stock-list">
                {cityResourceRows.map((resource) => (
                  <li
                    key={`city-resource-stock-${resource.key}`}
                    title={`${resource.label}: ${resource.amount.toLocaleString('cs-CZ')}`}
                    aria-label={`${resource.label}: ${resource.amount.toLocaleString('cs-CZ')}`}
                  >
                    <span className="city-resource-stock-icon" aria-hidden="true">
                      {resource.icon.startsWith('/') ? (
                        <img src={resource.icon} alt="" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        resource.icon
                      )}
                    </span>
                    <strong className="ui-type-resource-value tld-type-value city-resource-stock-amount">
                      {resource.key === 'population'
                        ? `${resource.amount.toLocaleString('cs-CZ')} / ${resource.capacity.toLocaleString('cs-CZ')}`
                        : resource.amount.toLocaleString('cs-CZ')}
                    </strong>
                  </li>
                ))}
              </ul>
              {isCityResourceTooltipOpen ? (
                <CityResourceSummaryTooltip
                  rows={cityResourceTooltipRows}
                  cursorPosition={cityResourceTooltipCursorPosition}
                />
              ) : null}
            </article>
          </section>

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
                      const normalizedBlockedReason = (building.blockedReason ?? '')
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, '')
                        .toLowerCase();
                      const isMaxed =
                        (!building.nextCostRaw && !building.canUpgrade) ||
                        normalizedBlockedReason.includes('maximalni') ||
                        normalizedBlockedReason.includes('max urov');
                      const isReadyForUpgrade = building.canUpgrade && !building.isInProgress;
                      const statusText = building.isInProgress
                        ? `Probíhá upgrade (${building.nextTime})`
                        : isReadyForUpgrade
                          ? `Připraveno (${building.nextTime})`
                          : building.blockedReason ?? (isMaxed ? 'Max úroveň' : 'Čeká na podmínky');
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
                      const costRows = building.nextCostRaw
                        ? RESOURCE_COST_TYPES.map((resourceType) => {
                            const requiredAmount = building.nextCostRaw?.[resourceType] ?? 0;
                            const availableAmount = availableResources[resourceType];
                            return {
                              resourceType,
                              requiredAmount,
                              availableAmount,
                              canAffordResource: availableAmount >= requiredAmount,
                            };
                          })
                        : [];
                      const shouldShowInlineUpgradeCost =
                        hoveredBuildingId === building.id && !isMaxed && costRows.length > 0;
                      const shouldShowUpgradeCue = hoveredBuildingId === building.id && !isMaxed;

                      return (
                        <article
                          key={building.id}
                          className={`city-building-card has-army-tooltip ${building.isInProgress ? 'is-progress' : ''} ${isReadyForUpgrade ? 'is-ready' : ''} ${isMaxed ? 'is-maxed' : ''} ${isUnbuilt ? 'is-unbuilt' : ''} ${hoveredBuildingId === building.id ? 'is-tooltip-open' : ''}`}
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
                              <em>
                                Úroveň {building.level}
                                {isMaxed ? ' (max)' : ''}
                              </em>
                              {canCancelUpgrade && cancelOrderId != null ? (
                                <button
                                  type="button"
                                  className="inline-cancel-button city-building-cancel-inline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onCancelBuildingUpgrade(cancelOrderId, building.id);
                                  }}
                                  onContextMenu={(event) => {
                                    event.stopPropagation();
                                  }}
                                  disabled={isCancelPending}
                                  title="Zrušit aktivní upgrade této budovy"
                                  aria-label="Zrušit upgrade budovy"
                                >
                                  {isCancelPending ? '…' : '✕'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {shouldShowInlineUpgradeCost ? (
                            <div className="city-building-hover-cost" aria-hidden="true">
                              {costRows.map((row) => {
                                const resourceLabel = LOOT_PRIORITY_LABELS[row.resourceType];
                                const resourceIcon = resolveResourceGlyph(resourceLabel);
                                return (
                                  <span
                                    key={`${building.id}-inline-cost-${row.resourceType}`}
                                    className={`city-building-hover-cost-chip ${row.canAffordResource ? 'ok' : 'missing'}`}
                                  >
                                    <span className="city-building-hover-cost-icon" aria-hidden="true">
                                      {resourceIcon.startsWith('/') ? (
                                        <img src={resourceIcon} alt="" loading="lazy" decoding="async" draggable={false} />
                                      ) : (
                                        resourceIcon
                                      )}
                                    </span>
                                    <strong>{row.requiredAmount.toLocaleString('cs-CZ')}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                          {shouldShowUpgradeCue ? (
                            <span className="city-building-upgrade-cue" aria-hidden="true">
                              <span>⚒</span>
                            </span>
                          ) : null}
                          {hoveredBuildingId === building.id ? (
                            <BuildingUpgradePreviewTooltip
                              building={building}
                              statusText={statusText}
                              queueInfoLabel={queueInfoLabel}
                              isPositiveNotice={isPositiveNotice}
                              notice={notice}
                              isMaxed={isMaxed}
                              costRows={costRows}
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

          <section className="city-upgrade-queue-panel">
            <header className="city-upgrade-queue-header">
              <div className="city-upgrade-queue-title">
                <h4>Stavební fronta</h4>
                <small>Zrušení položky vrací 100 % surovin.</small>
              </div>
              <button
                type="button"
                className="city-upgrade-queue-stop-all"
                {...bindQueueActionTooltip(
                  'Ukončit stávající frontu',
                  'Po potvrzení zruší všechny aktivní i čekající upgrady v této frontě a vrátí suroviny.',
                )}
                onClick={() => onCancelAllBuildingUpgrades()}
                disabled={isQueueActionPending || upgradeQueueRows.length <= 0}
              >
                Ukončit stávající frontu
              </button>
            </header>
            {upgradeQueueRows.length > 0 ? (
              <div className="city-upgrade-queue-scroll">
                <ul>
                  {upgradeQueueRows.map((order) => {
                    const isCancelPending = cancelUpgradePendingOrderId === order.id;
                    const cancelBuildingOrderId = firstQueueOrderIdByBuilding.get(order.buildingId) ?? order.id;
                    const isCancelBuildingPending = cancelUpgradePendingOrderId === cancelBuildingOrderId;
                    const isReorderPending = reorderUpgradePendingOrderId === order.id;
                    const canMoveWithinQueue = !order.isActive && !isQueueActionPending;
                    const canMoveUp = canMoveWithinQueue && order.queueIndex > 1;
                    const canMoveDown = canMoveWithinQueue && order.queueIndex < upgradeQueueRows.length - 1;
                    const isDragSource = draggedQueueOrderId === order.id;
                    const isDragTarget =
                      draggedQueueOrderId != null && draggedQueueOrderId !== order.id && !order.isActive;
                    const leadTimeLabel = order.isActive
                      ? formatDurationLabel(order.remainingSec)
                      : formatDurationLabel(order.startsInSec);
                    const finishTimeLabel = formatDateTimeLabel(order.finishAt);

                    return (
                      <li
                        key={`city-queue-${order.id}`}
                        className={`city-upgrade-queue-item ${order.isActive ? 'is-active' : ''} ${isDragSource ? 'is-drag-source' : ''} ${isDragTarget ? 'is-drag-target' : ''}`}
                        draggable={canMoveWithinQueue}
                        onDragStart={() => {
                          closeQueueActionTooltip();
                          setDraggedQueueOrderId(order.id);
                        }}
                        onDragOver={(event) => {
                          if (draggedQueueOrderId == null || draggedQueueOrderId === order.id || order.isActive) {
                            return;
                          }
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedQueueOrderId == null || draggedQueueOrderId === order.id || order.isActive) {
                            return;
                          }
                          onReorderBuildingUpgrade(draggedQueueOrderId, order.queueIndex);
                          setDraggedQueueOrderId(null);
                        }}
                        onDragEnd={() => setDraggedQueueOrderId(null)}
                      >
                        <span
                          className="city-upgrade-queue-grip"
                          aria-hidden="true"
                          {...bindQueueActionTooltip(
                            'Přetažení pořadí',
                            'Uchop kartu a přetáhni ji na novou pozici ve stavební frontě.',
                          )}
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                        <div className="city-upgrade-queue-reorder">
                          <button
                            type="button"
                            className="city-upgrade-queue-action city-upgrade-queue-action-move"
                            {...bindQueueActionTooltip(
                              'Posunout výše',
                              'Posune tuto kartu o jednu pozici výš. Aktivní první pozici nelze přeskočit.',
                            )}
                            onClick={() => onReorderBuildingUpgrade(order.id, order.queueIndex - 1)}
                            disabled={!canMoveUp || isReorderPending}
                            aria-label="Posunout výše"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="city-upgrade-queue-action city-upgrade-queue-action-move"
                            {...bindQueueActionTooltip(
                              'Posunout níže',
                              'Posune tuto kartu o jednu pozici níž ve frontě.',
                            )}
                            onClick={() => onReorderBuildingUpgrade(order.id, order.queueIndex + 1)}
                            disabled={!canMoveDown || isReorderPending}
                            aria-label="Posunout níže"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="city-upgrade-queue-item-main">
                          <div className="city-upgrade-queue-item-head">
                            <span
                              className={`city-upgrade-queue-status-icon ${order.isActive ? 'is-live' : 'is-waiting'}`}
                              aria-label={order.isActive ? 'Aktivní stavba' : 'Čekající stavba'}
                            >
                              {order.isActive ? '●' : '○'}
                            </span>
                            <div className="city-upgrade-queue-time-row">
                              <span className="city-upgrade-queue-time-chip">
                                <span aria-hidden="true">⏱</span>
                                {leadTimeLabel}
                              </span>
                              <span className="city-upgrade-queue-time-chip muted">
                                <span aria-hidden="true">⌚</span>
                                {finishTimeLabel}
                              </span>
                            </div>
                          </div>
                          <div className="city-upgrade-queue-building">
                            <img src={order.buildingIcon} alt="" loading="lazy" decoding="async" draggable={false} />
                            <div>
                              <strong>{order.buildingName}</strong>
                              <span>
                                L{order.fromLevel} → L{order.toLevel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="city-upgrade-queue-rank" aria-label={`Pořadí fronty ${order.queueIndex + 1}`}>
                          {order.queueIndex + 1}
                        </div>
                        <div className="city-upgrade-queue-actions">
                          <button
                            type="button"
                            className="city-upgrade-queue-action is-danger"
                            {...bindQueueActionTooltip(
                              'Zrušit kartu',
                              'Zruší pouze tuto konkrétní položku stavební fronty a vrátí její suroviny.',
                            )}
                            onClick={() => onCancelBuildingUpgrade(order.id, order.buildingId)}
                            disabled={isQueueActionPending || isCancelPending}
                            aria-label="Zrušit tuto konkrétní kartu z fronty"
                          >
                            {isCancelPending ? '…' : '✕'}
                          </button>
                          <button
                            type="button"
                            className="city-upgrade-queue-action is-warning"
                            {...bindQueueActionTooltip(
                              'Zrušit budovu',
                              'Zruší všechny navazující položky této budovy ve stavební frontě.',
                            )}
                            onClick={() => onCancelBuildingUpgrade(cancelBuildingOrderId, order.buildingId)}
                            disabled={isQueueActionPending || isCancelBuildingPending}
                            aria-label="Zrušit všechny položky této budovy"
                          >
                            {isCancelBuildingPending ? '…' : '▣'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="row-help">Ve frontě zatím není žádná stavba.</p>
            )}
          </section>
          {queueActionTooltip ? (
            <QueueActionTooltip
              title={queueActionTooltip.title}
              description={queueActionTooltip.description}
              cursorPosition={queueActionTooltip.cursorPosition}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});

const ArmyPanel = memo(({
  units,
  buildings,
  recruitQueueOrders,
  settlements,
  currentUsername,
  worldId,
  isExpanded,
  onRecruit,
  onCancelRecruitment,
  onReorderRecruitment,
  onUpgradeBuilding,
  onOpenSettlementByVillageId,
  recruitPendingUnitId,
  cancelRecruitmentPendingId,
  reorderRecruitmentPendingId,
  upgradePendingBuildingId,
  notice,
  noticeUnitId,
}: {
  units: Unit[];
  buildings: Building[];
  recruitQueueOrders: RecruitQueueOrder[];
  settlements: RegionSettlement[];
  currentUsername: string;
  worldId: string | null;
  isExpanded: boolean;
  onRecruit: (unit: Unit, amount: number) => Promise<boolean>;
  onCancelRecruitment: (order: RecruitQueueOrder) => void;
  onReorderRecruitment: (recruitmentId: number, targetIndex: number) => void;
  onUpgradeBuilding: (building: Building) => void;
  onOpenSettlementByVillageId: (villageId: number) => void;
  recruitPendingUnitId: string | null;
  cancelRecruitmentPendingId: number | null;
  reorderRecruitmentPendingId: number | null;
  upgradePendingBuildingId: string | null;
  notice: string | null;
  noticeUnitId: string | null;
}) => {
  const [recruitDraftAmounts, setRecruitDraftAmounts] = useState<Record<string, string>>({});
  const [draggedRecruitQueueOrderId, setDraggedRecruitQueueOrderId] = useState<number | null>(null);
  const [armyViewMode, setArmyViewMode] = useState<'armadaPlanner' | 'selectedVillage' | 'multiVillage'>(
    'selectedVillage',
  );
  const [armyOverview, setArmyOverview] = useState<ArmyOverviewResponse | null>(null);
  const [armyOverviewLoading, setArmyOverviewLoading] = useState(false);
  const [armyOverviewError, setArmyOverviewError] = useState<string | null>(null);
  const [plannerOpenSnapshot, setPlannerOpenSnapshot] = useState<PlannerOpenResponse | null>(null);
  const [plannerOpenLoading, setPlannerOpenLoading] = useState(false);
  const [plannerOpenError, setPlannerOpenError] = useState<string | null>(null);
  const [plannerRefreshToken, setPlannerRefreshToken] = useState(0);
  const [plannerDraft, setPlannerDraft] = useState<PlannerDraftState>({
    targetPlayerUsername: '',
    targetVillageId: null,
    legs: [],
    updatedAt: new Date().toISOString(),
  });
  const [plannerDraftStage, setPlannerDraftStage] = useState<PlannerDraftStage>('draft');
  const [plannerDraftDirty, setPlannerDraftDirty] = useState(false);
  const [storedPlannerDraftAvailable, setStoredPlannerDraftAvailable] = useState<PlannerDraftState | null>(null);
  const [plannerNoticeMessage, setPlannerNoticeMessage] = useState<string | null>(null);
  const [plannerForceDraftMode, setPlannerForceDraftMode] = useState(false);
  const [focusedPlannerLegOriginVillageId, setFocusedPlannerLegOriginVillageId] = useState<number | null>(null);
  const [draggedPlannerLegOriginVillageId, setDraggedPlannerLegOriginVillageId] = useState<number | null>(null);
  const [plannerMutationPending, setPlannerMutationPending] = useState(false);
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

  const plannerConstraints = useMemo<PlannerConstraints>(
    () => ({
      maxLegs: Math.max(
        1,
        Math.floor(Number(plannerOpenSnapshot?.constraints?.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS)),
      ) as PlannerConstraints['maxLegs'],
      minImpactGapMinutes: Math.max(
        1,
        Math.floor(
          Number(plannerOpenSnapshot?.constraints?.minImpactGapMinutes ?? DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES),
        ),
      ) as PlannerConstraints['minImpactGapMinutes'],
      leadTimeSec: Math.max(
        0,
        Math.floor(Number(plannerOpenSnapshot?.constraints?.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC)),
      ),
      activePlansPerPlayerPerWorld: 1,
    }),
    [plannerOpenSnapshot?.constraints?.leadTimeSec, plannerOpenSnapshot?.constraints?.maxLegs, plannerOpenSnapshot?.constraints?.minImpactGapMinutes],
  );
  const plannerBannerText = String(plannerOpenSnapshot?.bannerText ?? DEFAULT_PLANNER_BANNER_TEXT);
  const plannerActivePlan = plannerOpenSnapshot?.activePlan ?? null;
  const plannerLastCompletedPlan = plannerOpenSnapshot?.lastCompletedPlan ?? null;
  const plannerActivePlanStatusMeta = plannerActivePlan
    ? resolvePlannerPlanStatusMeta(plannerActivePlan.plan.status)
    : null;
  const plannerCanReturnToDraftFromActivePlan =
    plannerActivePlanStatusMeta?.tone === 'warning' || plannerActivePlanStatusMeta?.tone === 'blocked';
  const plannerIsDraftMode = plannerActivePlan == null || plannerForceDraftMode;

  useEffect(() => {
    if (!plannerIsDraftMode) {
      setPlannerDraftStage('draft');
    }
  }, [plannerIsDraftMode]);

  useEffect(() => {
    setPlannerDraft({
      targetPlayerUsername: '',
      targetVillageId: null,
      legs: [],
      updatedAt: new Date().toISOString(),
    });
    setPlannerDraftStage('draft');
    setPlannerDraftDirty(false);
    setStoredPlannerDraftAvailable(worldId ? readStoredPlannerLastSessionDraft(currentUsername, worldId) : null);
    setPlannerNoticeMessage(null);
    setPlannerForceDraftMode(false);
    setFocusedPlannerLegOriginVillageId(null);
    setDraggedPlannerLegOriginVillageId(null);
    setPlannerMutationPending(false);
  }, [currentUsername, worldId]);

  useEffect(() => {
    if (!isExpanded || !worldId) {
      return;
    }

    let cancelled = false;
    setArmyOverviewLoading(true);
    setArmyOverviewError(null);
    void fetchArmyOverview(currentUsername, worldId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setArmyOverview(response);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setArmyOverviewError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setArmyOverviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUsername, isExpanded, plannerRefreshToken, worldId]);

  useEffect(() => {
    if (!isExpanded || !worldId) {
      return;
    }

    let cancelled = false;
    setPlannerOpenLoading(true);
    setPlannerOpenError(null);
    void fetchPlannerOpen(currentUsername, worldId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPlannerOpenSnapshot(response);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPlannerOpenError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setPlannerOpenLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUsername, isExpanded, plannerRefreshToken, worldId]);

  const plannerVillageById = useMemo(
    () => new Map((armyOverview?.villages ?? []).map((village) => [Number(village.villageId), village])),
    [armyOverview?.villages],
  );
  const plannerTargetCandidates = useMemo(() => {
    const groups = new Map<
      string,
      {
        username: string;
        villages: RegionSettlement[];
      }
    >();
    for (const settlement of settlements) {
      const villageId = Number(settlement.villageId ?? 0);
      const playerId = Number(settlement.playerId ?? 0);
      const username = String(settlement.owner ?? '').trim();
      if (!Number.isFinite(villageId) || villageId <= 0) {
        continue;
      }
      if (!Number.isFinite(playerId) || playerId <= 0) {
        continue;
      }
      if (!username) {
        continue;
      }
      const comparableOwner = username.toLocaleLowerCase('cs-CZ');
      const comparableCurrent = String(currentUsername ?? '').trim().toLocaleLowerCase('cs-CZ');
      if (comparableOwner === comparableCurrent) {
        continue;
      }
      if (settlement.kind === 'bot' || settlement.kind === 'abandoned' || settlement.relation === 'self') {
        continue;
      }
      const key = comparableOwner;
      const bucket = groups.get(key) ?? { username, villages: [] };
      bucket.villages.push(settlement);
      groups.set(key, bucket);
    }

    return [...groups.values()]
      .filter((group) => group.villages.length === 1)
      .map((group) => {
        const village = group.villages[0];
        return {
          username: group.username,
          villageId: Number(village.villageId),
          villageName: String(village.name ?? ''),
          playerId: Number(village.playerId ?? 0),
          kingdom: String(village.kingdom ?? 'Neutral'),
          coordX: Number(village.globalX ?? 0),
          coordY: Number(village.globalY ?? 0),
          settlement: village,
        };
      })
      .sort((left, right) =>
        left.username.localeCompare(right.username, 'cs-CZ', { sensitivity: 'base', numeric: true }),
      );
  }, [currentUsername, settlements]);
  const plannerTargetByVillageId = useMemo(
    () => new Map(plannerTargetCandidates.map((candidate) => [Number(candidate.villageId), candidate])),
    [plannerTargetCandidates],
  );
  const plannerTargetByUsername = useMemo(
    () =>
      new Map(
        plannerTargetCandidates.map((candidate) => [
          candidate.username.toLocaleLowerCase('cs-CZ'),
          candidate,
        ]),
      ),
    [plannerTargetCandidates],
  );

  const normalizePlannerDraftStateWithMeta = useCallback(
    (draft: PlannerDraftState): { draft: PlannerDraftState; meta: PlannerDraftNormalizationMeta } => {
      const maxLegs = Math.max(1, Number(plannerConstraints.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS));
      const seenOrigins = new Set<number>();
      const normalizedLegs: PlannerLegDraft[] = [];
      let unitAmountsAdjusted = false;

      for (const leg of draft.legs) {
        if (normalizedLegs.length >= maxLegs) {
          break;
        }
        const originVillageId = Math.floor(Number(leg.originVillageId ?? 0));
        if (!Number.isFinite(originVillageId) || originVillageId <= 0 || seenOrigins.has(originVillageId)) {
          continue;
        }
        const originVillage = plannerVillageById.get(originVillageId);
        if (!originVillage) {
          continue;
        }
        seenOrigins.add(originVillageId);
        const allowedByUnitId = new Map(
          (originVillage.units ?? []).map((unit) => [
            String(unit.unitId),
            Math.max(0, Math.floor(Number(unit.availableForPlanning ?? 0))),
          ]),
        );
        const normalizedUnits: Partial<Record<CommandUnitId, number>> = {};
        for (const unitId of COMMAND_UNIT_ORDER) {
          const allowed = Math.max(0, Math.floor(Number(allowedByUnitId.get(unitId) ?? 0)));
          const amount = Math.max(0, Math.floor(Number(leg.units?.[unitId] ?? 0)));
          if (amount > 0 && allowed <= 0) {
            unitAmountsAdjusted = true;
            continue;
          }
          if (amount <= 0 || allowed <= 0) {
            continue;
          }
          const nextAmount = Math.min(allowed, amount);
          if (nextAmount !== amount) {
            unitAmountsAdjusted = true;
          }
          normalizedUnits[unitId] = nextAmount;
        }
        normalizedLegs.push({
          originVillageId,
          impactAtUtc: String(leg.impactAtUtc ?? ''),
          units: normalizedUnits,
        });
      }

      const timelineNormalizedLegs = normalizePlannerLegTimeline(normalizedLegs, plannerConstraints);
      const timelineAdjusted = timelineNormalizedLegs.some(
        (leg, index) => String(leg.impactAtUtc) !== String(normalizedLegs[index]?.impactAtUtc ?? ''),
      );
      const targetVillageIdRaw = Number(draft.targetVillageId ?? 0);
      const targetVillageId =
        Number.isFinite(targetVillageIdRaw) && targetVillageIdRaw > 0 ? Math.floor(targetVillageIdRaw) : null;
      const targetCandidate =
        (targetVillageId != null ? plannerTargetByVillageId.get(targetVillageId) : null) ??
        plannerTargetByUsername.get(String(draft.targetPlayerUsername ?? '').trim().toLocaleLowerCase('cs-CZ')) ??
        null;
      const sourceHasTarget =
        (Number.isFinite(targetVillageIdRaw) && targetVillageIdRaw > 0) ||
        String(draft.targetPlayerUsername ?? '').trim().length > 0;
      const updatedAtMs = Date.parse(String(draft.updatedAt ?? ''));

      return {
        draft: {
          targetPlayerUsername: targetCandidate?.username ?? '',
          targetVillageId: targetCandidate?.villageId ?? null,
          legs: timelineNormalizedLegs,
          updatedAt: Number.isFinite(updatedAtMs)
            ? new Date(updatedAtMs).toISOString()
            : new Date().toISOString(),
        },
        meta: {
          removedLegCount: Math.max(0, Number(draft.legs.length ?? 0) - timelineNormalizedLegs.length),
          targetReset: sourceHasTarget && targetCandidate == null,
          timelineAdjusted,
          unitAmountsAdjusted,
        },
      };
    },
    [plannerConstraints, plannerTargetByUsername, plannerTargetByVillageId, plannerVillageById],
  );

  const normalizePlannerDraftState = useCallback(
    (draft: PlannerDraftState): PlannerDraftState => normalizePlannerDraftStateWithMeta(draft).draft,
    [normalizePlannerDraftStateWithMeta],
  );

  const buildPlannerNormalizationNoticeMessage = useCallback(
    (meta: PlannerDraftNormalizationMeta): string | null => {
      const details: string[] = [];
      if (meta.removedLegCount > 0) {
        details.push(`odebráno legů: ${meta.removedLegCount.toLocaleString('cs-CZ')}`);
      }
      if (meta.targetReset) {
        details.push('cíl už není validní');
      }
      if (meta.unitAmountsAdjusted) {
        details.push('počty jednotek byly upraveny podle dostupnosti');
      }
      if (meta.timelineAdjusted) {
        details.push('časová osa byla srovnána podle minimálních mezer');
      }
      if (details.length <= 0) {
        return null;
      }
      return `Koncept byl upraven podle aktuálních dat: ${details.join('; ')}.`;
    },
    [],
  );

  useEffect(() => {
    if (plannerActivePlan && !plannerForceDraftMode) {
      return;
    }
    setPlannerDraft((previous) => {
      const normalizedWithMeta = normalizePlannerDraftStateWithMeta(previous);
      if (JSON.stringify(normalizedWithMeta.draft) === JSON.stringify(previous)) {
        return previous;
      }
      const normalizationNotice = buildPlannerNormalizationNoticeMessage(normalizedWithMeta.meta);
      if (normalizationNotice) {
        setPlannerNoticeMessage(normalizationNotice);
      }
      return normalizedWithMeta.draft;
    });
  }, [
    buildPlannerNormalizationNoticeMessage,
    normalizePlannerDraftStateWithMeta,
    plannerActivePlan,
    plannerForceDraftMode,
  ]);

  useEffect(() => {
    if (!worldId || !plannerDraftDirty || (!plannerIsDraftMode && plannerActivePlan)) {
      return;
    }
    saveStoredPlannerLastSessionDraft(
      currentUsername,
      worldId,
      normalizePlannerDraftState(plannerDraft),
    );
  }, [
    currentUsername,
    normalizePlannerDraftState,
    plannerActivePlan,
    plannerDraft,
    plannerDraftDirty,
    plannerIsDraftMode,
    worldId,
  ]);

  const applyPlannerDraftMutation = useCallback(
    (updater: (previous: PlannerDraftState) => PlannerDraftState) => {
      setPlannerDraft((previous) => normalizePlannerDraftState(updater(previous)));
      setPlannerDraftDirty(true);
      setPlannerDraftStage('draft');
    },
    [normalizePlannerDraftState],
  );

  const plannerSelectedOriginIds = useMemo(
    () => new Set(plannerDraft.legs.map((leg) => Number(leg.originVillageId)).filter((villageId) => Number.isFinite(villageId) && villageId > 0)),
    [plannerDraft.legs],
  );
  const armyOverviewVillages = useMemo(
    () =>
      (armyOverview?.villages ?? []).map((village) => ({
        ...village,
        plannerSelected: plannerSelectedOriginIds.has(Number(village.villageId)),
      })),
    [armyOverview?.villages, plannerSelectedOriginIds],
  );

  const plannerLegRows = useMemo(() => {
    const targetCandidate = plannerDraft.targetVillageId != null ? plannerTargetByVillageId.get(plannerDraft.targetVillageId) ?? null : null;
    return plannerDraft.legs.map((leg, index) => {
      const originVillage = plannerVillageById.get(Number(leg.originVillageId)) ?? null;
      const travelDurationSec =
        originVillage && targetCandidate
          ? calculatePlannerTravelDurationSec(
              leg.units,
              { coordX: originVillage.coordX, coordY: originVillage.coordY },
              { globalX: targetCandidate.coordX, globalY: targetCandidate.coordY },
            )
          : MIN_ARMY_TRAVEL_DURATION_SEC;
      const impactAtMs = Date.parse(String(leg.impactAtUtc ?? ''));
      const sendAtUtc =
        Number.isFinite(impactAtMs) ? new Date(impactAtMs - travelDurationSec * 1000).toISOString() : null;
      const unitsTotal = COMMAND_UNIT_ORDER.reduce(
        (sum, unitId) => sum + Math.max(0, Math.floor(Number(leg.units?.[unitId] ?? 0))),
        0,
      );
      return {
        key: Number(leg.originVillageId),
        order: index + 1,
        originVillage,
        impactAtUtc: leg.impactAtUtc,
        sendAtUtc,
        travelDurationSec,
        units: leg.units,
        unitsTotal,
      };
    });
  }, [plannerDraft.legs, plannerDraft.targetVillageId, plannerTargetByVillageId, plannerVillageById]);

  const plannerNowMs = useSecondClock(
    plannerDraft.legs.length > 0 || Boolean(plannerDraft.targetPlayerUsername) || plannerDraft.targetVillageId != null,
  );
  const plannerValidation = useMemo(() => {
    const issues: PlannerValidationIssue[] = [];
    const nowMs = plannerNowMs;
    const leadTimeSec = Math.max(0, Number(plannerConstraints.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC));
    const minGapMinutes = Math.max(1, Number(plannerConstraints.minImpactGapMinutes ?? DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES));
    if (!plannerDraft.targetPlayerUsername || plannerDraft.targetVillageId == null) {
      issues.push({
        code: 'missing_target',
        severity: 'blocked',
        message: 'Vyber cílového hráče s právě jedním lénem.',
      });
    }
    if (plannerLegRows.length <= 0) {
      issues.push({
        code: 'missing_legs',
        severity: 'blocked',
        message: 'Přidej alespoň jedno vlastní léno do plánu.',
      });
    }
    if (plannerLegRows.length > Number(plannerConstraints.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS)) {
      issues.push({
        code: 'legs_over_limit',
        severity: 'blocked',
        message: `Maximální počet legů je ${Number(plannerConstraints.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS)}.`,
      });
    }

    let previousImpactMs: number | null = null;
    for (const leg of plannerLegRows) {
      if (!leg.originVillage) {
        issues.push({
          code: `origin_missing_${leg.key}`,
          severity: 'blocked',
          message: `Leg #${leg.order} odkazuje na nedostupné léno.`,
          legOriginVillageId: leg.key,
        });
      }
      if (leg.unitsTotal <= 0) {
        issues.push({
          code: `units_missing_${leg.key}`,
          severity: 'blocked',
          message: `Leg #${leg.order} musí mít vybrané jednotky.`,
          legOriginVillageId: leg.key,
        });
      }
      const impactAtMs = Date.parse(String(leg.impactAtUtc ?? ''));
      if (!Number.isFinite(impactAtMs)) {
        issues.push({
          code: `impact_invalid_${leg.key}`,
          severity: 'blocked',
          message: `Leg #${leg.order} má neplatný čas dopadu.`,
          legOriginVillageId: leg.key,
        });
        continue;
      }
      if (previousImpactMs != null && impactAtMs - previousImpactMs < minGapMinutes * 60_000) {
        issues.push({
          code: `impact_gap_${leg.key}`,
          severity: 'blocked',
          message: `Mezi dopady musí být minimálně ${minGapMinutes} minuta.`,
          legOriginVillageId: leg.key,
        });
      }
      previousImpactMs = impactAtMs;
      if (leg.sendAtUtc) {
        const sendAtMs = Date.parse(leg.sendAtUtc);
        if (Number.isFinite(sendAtMs) && sendAtMs < nowMs + leadTimeSec * 1000) {
          issues.push({
            code: `lead_time_${leg.key}`,
            severity: 'blocked',
            message: `Leg #${leg.order} porušuje lead time (${Math.ceil(leadTimeSec / 60)} min).`,
            legOriginVillageId: leg.key,
          });
        }
      }
    }

    const hasBlocked = issues.some((issue) => issue.severity === 'blocked');
    const hasWarning = issues.some((issue) => issue.severity === 'warning');
    return {
      status: hasBlocked ? 'blocked' : hasWarning ? 'warning' : 'ok',
      issues,
    };
  }, [
    plannerConstraints.leadTimeSec,
    plannerConstraints.maxLegs,
    plannerConstraints.minImpactGapMinutes,
    plannerDraft.targetPlayerUsername,
    plannerDraft.targetVillageId,
    plannerLegRows,
    plannerNowMs,
  ]);

  const plannerValidationIssuesByLegOriginVillageId = useMemo(() => {
    const byOriginVillageId = new Map<number, PlannerValidationIssue[]>();
    for (const issue of plannerValidation.issues) {
      const originVillageId = Number(issue.legOriginVillageId ?? 0);
      if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
        continue;
      }
      const bucket = byOriginVillageId.get(originVillageId) ?? [];
      bucket.push(issue);
      byOriginVillageId.set(originVillageId, bucket);
    }
    return byOriginVillageId;
  }, [plannerValidation.issues]);

  const plannerRequestLegs = useMemo(() => toPlannerRequestLegs(plannerLegRows), [plannerLegRows]);
  const plannerCanOpenConfirmation =
    plannerValidation.status === 'ok' &&
    plannerRequestLegs.length > 0 &&
    plannerDraft.targetVillageId != null &&
    plannerDraft.targetPlayerUsername.length > 0 &&
    !plannerMutationPending;

  const plannerActivePlanProgress = useMemo(() => {
    if (!plannerActivePlan) {
      return null;
    }
    const totalLegs = Math.max(0, plannerActivePlan.legs.length);
    const sentLegs = plannerActivePlan.legs.reduce(
      (sum, leg) => sum + (String(leg.status ?? '') === 'sent' ? 1 : 0),
      0,
    );
    const firstSendAtMs = Date.parse(
      String(
        [...plannerActivePlan.legs]
          .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))
          .at(0)?.sendAtUtc ?? '',
      ),
    );
    const countdownSec = Number.isFinite(firstSendAtMs)
      ? Math.max(0, Math.ceil((firstSendAtMs - Date.now()) / 1000))
      : null;

    return {
      totalLegs,
      sentLegs,
      percent: totalLegs > 0 ? Math.round((sentLegs / totalLegs) * 100) : 0,
      countdownSec,
    };
  }, [plannerActivePlan]);

  const handleRefreshArmadaAndPlanner = useCallback(() => {
    setPlannerRefreshToken((previous) => previous + 1);
  }, []);

  const handleRestorePlannerDraft = useCallback(() => {
    if (!storedPlannerDraftAvailable || plannerActivePlan) {
      return;
    }
    const restoredWithMeta = normalizePlannerDraftStateWithMeta(storedPlannerDraftAvailable);
    const restored = restoredWithMeta.draft;
    setPlannerDraft(restored);
    setPlannerDraftDirty(true);
    setPlannerDraftStage('draft');
    setPlannerNoticeMessage(
      buildPlannerNormalizationNoticeMessage(restoredWithMeta.meta) ??
        'Poslední lokální koncept byl obnoven.',
    );
    setPlannerForceDraftMode(true);
    setFocusedPlannerLegOriginVillageId(restored.legs[0]?.originVillageId ?? null);
  }, [
    buildPlannerNormalizationNoticeMessage,
    normalizePlannerDraftStateWithMeta,
    plannerActivePlan,
    storedPlannerDraftAvailable,
  ]);

  const handlePlannerBackToActivePlan = useCallback(() => {
    if (!plannerActivePlan) {
      return;
    }
    setPlannerForceDraftMode(false);
    setPlannerDraftStage('draft');
    setPlannerNoticeMessage('Zobrazen je aktivní serverový plán.');
  }, [plannerActivePlan]);

  const handlePlannerReturnToDraft = useCallback(() => {
    if (!plannerActivePlan) {
      return;
    }
    const draftFromActivePlan = buildPlannerDraftFromActivePlan(plannerActivePlan);
    const normalizedWithMeta = normalizePlannerDraftStateWithMeta(draftFromActivePlan);
    const nextDraft = normalizedWithMeta.draft;
    setPlannerDraft(nextDraft);
    setPlannerDraftDirty(true);
    setPlannerDraftStage('draft');
    setPlannerForceDraftMode(true);
    setFocusedPlannerLegOriginVillageId(nextDraft.legs[0]?.originVillageId ?? null);
    setPlannerNoticeMessage(
      buildPlannerNormalizationNoticeMessage(normalizedWithMeta.meta) ??
        'Do lokálního konceptu byla načtena poslední serverová verze plánu.',
    );
  }, [buildPlannerNormalizationNoticeMessage, normalizePlannerDraftStateWithMeta, plannerActivePlan]);

  const handleClearPlannerDraft = useCallback(() => {
    setPlannerDraft({
      targetPlayerUsername: '',
      targetVillageId: null,
      legs: [],
      updatedAt: new Date().toISOString(),
    });
    setPlannerDraftDirty(true);
    setPlannerDraftStage('draft');
    setPlannerForceDraftMode(true);
    setFocusedPlannerLegOriginVillageId(null);
    setPlannerNoticeMessage('Koncept byl vrácen do prázdného stavu.');
  }, []);

  const handlePlannerAutoAlignForward = useCallback(() => {
    applyPlannerDraftMutation((previous) => ({
      ...previous,
      legs: normalizePlannerLegTimelineForwardOneMinute(previous.legs, plannerConstraints),
      updatedAt: new Date().toISOString(),
    }));
    setPlannerNoticeMessage('Časy dopadů byly srovnány od prvního legu po jedné minutě.');
  }, [applyPlannerDraftMutation, plannerConstraints]);

  const handlePlannerAutoAlignBackward = useCallback(() => {
    applyPlannerDraftMutation((previous) => ({
      ...previous,
      legs: normalizePlannerLegTimelineFromLast(previous.legs, plannerConstraints),
      updatedAt: new Date().toISOString(),
    }));
    setPlannerNoticeMessage('Časy dopadů byly srovnány od posledního legu zpět.');
  }, [applyPlannerDraftMutation, plannerConstraints]);

  const handlePlannerFillLegAll = useCallback(
    (originVillageIdRaw: number) => {
      const originVillageId = Math.floor(Number(originVillageIdRaw));
      if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
        return;
      }
      const originVillage = plannerVillageById.get(originVillageId);
      if (!originVillage) {
        return;
      }
      const amountByUnitId = new Map(
        originVillage.units.map((unit) => [
          String(unit.unitId),
          Math.max(0, Math.floor(Number(unit.availableForPlanning ?? 0))),
        ]),
      );
      applyPlannerDraftMutation((previous) => ({
        ...previous,
        legs: previous.legs.map((leg) => {
          if (Number(leg.originVillageId) !== originVillageId) {
            return leg;
          }
          const nextUnits: Partial<Record<CommandUnitId, number>> = {};
          (['cavalry', 'ram', 'scout'] as const).forEach((unitId) => {
            const nextAmount = Math.max(0, Math.floor(Number(amountByUnitId.get(unitId) ?? 0)));
            if (nextAmount > 0) {
              nextUnits[unitId] = nextAmount;
            }
          });
          return {
            ...leg,
            units: nextUnits,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
      setPlannerNoticeMessage('Leg byl vyplněn útočnými jednotkami (Jezdec, Zvěd, Beranidlo).');
    },
    [applyPlannerDraftMutation, plannerVillageById],
  );

  const handlePlannerOpenConfirmation = useCallback(() => {
    if (!plannerCanOpenConfirmation) {
      setPlannerNoticeMessage('Koncept není validní. Nejprve oprav blokace a poté otevři potvrzení.');
      return;
    }
    setPlannerDraftStage('confirmation');
    setPlannerNoticeMessage('Potvrzení plánu: zkontroluj souhrn a potvrď uložení.');
  }, [plannerCanOpenConfirmation]);

  const handlePlannerBackToDraftFromConfirmation = useCallback(() => {
    setPlannerDraftStage('draft');
    setPlannerNoticeMessage('Vráceno do konceptu plánu.');
  }, []);

  const handlePlannerSaveConfirmed = useCallback(async () => {
    if (!worldId) {
      setPlannerNoticeMessage('Chybí worldId pro planner akci.');
      return;
    }
    if (plannerMutationPending) {
      return;
    }
    if (plannerDraftStage !== 'confirmation') {
      setPlannerNoticeMessage('Nejprve otevři krok Potvrzení plánu.');
      return;
    }
    if (!plannerCanOpenConfirmation) {
      setPlannerDraftStage('draft');
      setPlannerNoticeMessage('Koncept není validní. Oprav blokace a potvrď plán znovu.');
      return;
    }

    setPlannerMutationPending(true);
    try {
      const validationResponse = await validatePlannerPlanRequest({
        username: currentUsername,
        worldId,
        targetPlayerUsername: plannerDraft.targetPlayerUsername,
        targetVillageId: plannerDraft.targetVillageId,
        legs: plannerRequestLegs,
      });
      if (validationResponse.validation.status === 'blocked') {
        const messages = validationResponse.validation.issues
          .slice(0, 3)
          .map((issue) => String(issue.message ?? '').trim())
          .filter(Boolean);
        const summaryMessage =
          messages.length > 0
            ? `Server validace: ${messages.join(' | ')}`
            : 'Server validace zablokovala koncept plánu.';
        setPlannerDraftStage('draft');
        setPlannerNoticeMessage(summaryMessage);
        return;
      }

      if (plannerActivePlan && plannerForceDraftMode) {
        const updated = await updatePlannerPlanRequest(String(plannerActivePlan.plan.id), {
          username: currentUsername,
          worldId,
          expectedRevision: Math.max(1, Math.floor(Number(plannerActivePlan.plan.revision ?? 1))),
          targetPlayerUsername: plannerDraft.targetPlayerUsername,
          targetVillageId: plannerDraft.targetVillageId,
          legs: plannerRequestLegs,
        });
        setPlannerOpenSnapshot((previous) =>
          previous
            ? {
                ...previous,
                activePlan: updated.activePlan ?? previous.activePlan,
              }
            : null,
        );
        setPlannerNoticeMessage('Plán byl potvrzen a aktualizován.');
      } else {
        const created = await createPlannerPlanRequest({
          username: currentUsername,
          worldId,
          targetPlayerUsername: plannerDraft.targetPlayerUsername,
          targetVillageId: plannerDraft.targetVillageId,
          legs: plannerRequestLegs,
          confirmation: {
            confirmedByPlayer: true,
            clientValidatedAt: new Date().toISOString(),
          },
        });
        setPlannerOpenSnapshot((previous) =>
          previous
            ? {
                ...previous,
                activePlan: created.activePlan,
                lastCompletedPlan: created.lastCompletedPlan,
              }
            : null,
        );
        setPlannerNoticeMessage('Plán byl potvrzen a uložen.');
      }

      setPlannerDraftStage('draft');
      setPlannerForceDraftMode(false);
      setPlannerDraftDirty(false);
      saveStoredPlannerLastSessionDraft(currentUsername, worldId, null);
      setStoredPlannerDraftAvailable(null);
      setPlannerRefreshToken((previous) => previous + 1);
    } catch (error) {
      setPlannerDraftStage('draft');
      setPlannerNoticeMessage(getErrorMessage(error));
    } finally {
      setPlannerMutationPending(false);
    }
  }, [
    currentUsername,
    plannerActivePlan,
    plannerCanOpenConfirmation,
    plannerDraft.targetPlayerUsername,
    plannerDraft.targetVillageId,
    plannerDraftStage,
    plannerForceDraftMode,
    plannerMutationPending,
    plannerRequestLegs,
    worldId,
  ]);

  const handlePlannerCancelActivePlan = useCallback(async () => {
    if (!plannerActivePlan || !worldId || plannerMutationPending) {
      return;
    }
    const status = String(plannerActivePlan.plan.status ?? '');
    if (status !== 'scheduled' && status !== 'needs_reconfirmation') {
      setPlannerNoticeMessage('Tento plán už nelze zrušit.');
      return;
    }
    const confirmed = window.confirm('Opravdu chceš aktivní plán zrušit?');
    if (!confirmed) {
      return;
    }

    setPlannerMutationPending(true);
    try {
      const response = await cancelPlannerPlanRequest(String(plannerActivePlan.plan.id), {
        username: currentUsername,
        worldId,
        expectedRevision: Math.max(1, Math.floor(Number(plannerActivePlan.plan.revision ?? 1))),
      });
      setPlannerOpenSnapshot((previous) =>
        previous
          ? {
              ...previous,
              activePlan: response.activePlan,
            }
          : null,
      );
      setPlannerForceDraftMode(true);
      setPlannerDraftStage('draft');
      setPlannerNoticeMessage('Aktivní plán byl zrušen.');
      setPlannerRefreshToken((previous) => previous + 1);
    } catch (error) {
      setPlannerNoticeMessage(getErrorMessage(error));
    } finally {
      setPlannerMutationPending(false);
    }
  }, [currentUsername, plannerActivePlan, plannerMutationPending, worldId]);

  const handlePlannerReconfirmActivePlan = useCallback(async () => {
    if (!plannerActivePlan || !worldId || plannerMutationPending) {
      return;
    }
    if (String(plannerActivePlan.plan.status ?? '') !== 'needs_reconfirmation') {
      setPlannerNoticeMessage('Reconfirm je dostupný jen pro plán ve stavu needs_reconfirmation.');
      return;
    }
    const confirmed = window.confirm(
      'Cíl se změnil. Potvrdit plán i s následky?',
    );
    if (!confirmed) {
      return;
    }

    setPlannerMutationPending(true);
    try {
      const response = await reconfirmPlannerPlanRequest(String(plannerActivePlan.plan.id), {
        username: currentUsername,
        worldId,
        expectedRevision: Math.max(1, Math.floor(Number(plannerActivePlan.plan.revision ?? 1))),
        confirmWithConsequences: true,
      });
      setPlannerOpenSnapshot((previous) =>
        previous
          ? {
              ...previous,
              activePlan: response.activePlan,
            }
          : null,
      );
      setPlannerForceDraftMode(false);
      setPlannerDraftStage('draft');
      setPlannerNoticeMessage('Plán byl znovu potvrzen i se změněným cílem.');
      setPlannerRefreshToken((previous) => previous + 1);
    } catch (error) {
      setPlannerNoticeMessage(getErrorMessage(error));
    } finally {
      setPlannerMutationPending(false);
    }
  }, [currentUsername, plannerActivePlan, plannerMutationPending, worldId]);

  const handleArmadaVillageCardClick = useCallback(
    (village: ArmyVillageSummary) => {
      if (plannerMutationPending) {
        return;
      }
      const villageId = Math.floor(Number(village.villageId));
      if (!Number.isFinite(villageId) || villageId <= 0) {
        return;
      }
      if (plannerActivePlan && !plannerForceDraftMode) {
        setPlannerNoticeMessage('Aktivní serverový plán má prioritu. Nejprve dokonči nebo zruš aktivní plán.');
        return;
      }

      const existingLegIndex = plannerDraft.legs.findIndex((leg) => Number(leg.originVillageId) === villageId);
      if (existingLegIndex >= 0) {
        setFocusedPlannerLegOriginVillageId(villageId);
        setPlannerNoticeMessage('Toto léno je už v konceptu. Fokus přesunut na existující leg.');
        return;
      }

      if (plannerDraft.legs.length >= Number(plannerConstraints.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS)) {
        setPlannerNoticeMessage(`Maximální počet legů je ${Number(plannerConstraints.maxLegs ?? DEFAULT_PLANNER_MAX_LEGS)}.`);
        return;
      }

      const lastImpactAtUtc = plannerDraft.legs[plannerDraft.legs.length - 1]?.impactAtUtc ?? null;
      const defaultFirstImpactAtUtc = roundIsoToWholeMinute(
        new Date(Date.now() + Number(plannerConstraints.leadTimeSec ?? DEFAULT_PLANNER_LEAD_TIME_SEC) * 1000).toISOString(),
      );
      const nextImpactAtUtc =
        lastImpactAtUtc != null
          ? addMinutesToIso(lastImpactAtUtc, Number(plannerConstraints.minImpactGapMinutes ?? DEFAULT_PLANNER_MIN_IMPACT_GAP_MINUTES))
          : defaultFirstImpactAtUtc;

      applyPlannerDraftMutation((previous) => ({
        ...previous,
        legs: [
          ...previous.legs,
          {
            originVillageId: villageId,
            impactAtUtc: nextImpactAtUtc,
            units: {},
          },
        ],
        updatedAt: new Date().toISOString(),
      }));
      setFocusedPlannerLegOriginVillageId(villageId);
      setPlannerNoticeMessage(`Léno ${village.villageName} bylo přidáno do plánovače.`);
    },
    [
      applyPlannerDraftMutation,
      plannerActivePlan,
      plannerConstraints.leadTimeSec,
      plannerConstraints.maxLegs,
      plannerConstraints.minImpactGapMinutes,
      plannerDraft.legs,
      plannerForceDraftMode,
      plannerMutationPending,
    ],
  );

  const handlePlannerTargetChange = useCallback(
    (targetVillageIdRaw: number | null) => {
      const targetVillageId =
        targetVillageIdRaw != null && Number.isFinite(Number(targetVillageIdRaw))
          ? Math.floor(Number(targetVillageIdRaw))
          : null;
      const targetCandidate =
        targetVillageId != null ? plannerTargetByVillageId.get(targetVillageId) ?? null : null;
      applyPlannerDraftMutation((previous) => ({
        ...previous,
        targetPlayerUsername: targetCandidate?.username ?? '',
        targetVillageId: targetCandidate?.villageId ?? null,
        updatedAt: new Date().toISOString(),
      }));
    },
    [applyPlannerDraftMutation, plannerTargetByVillageId],
  );

  const handlePlannerLegRemove = useCallback(
    (originVillageIdRaw: number) => {
      const originVillageId = Math.floor(Number(originVillageIdRaw));
      if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
        return;
      }
      applyPlannerDraftMutation((previous) => ({
        ...previous,
        legs: previous.legs.filter((leg) => Number(leg.originVillageId) !== originVillageId),
        updatedAt: new Date().toISOString(),
      }));
      setFocusedPlannerLegOriginVillageId((previous) =>
        previous === originVillageId ? null : previous,
      );
    },
    [applyPlannerDraftMutation],
  );

  const handlePlannerLegImpactShift = useCallback(
    (originVillageIdRaw: number, deltaMinutes: number) => {
      const originVillageId = Math.floor(Number(originVillageIdRaw));
      if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
        return;
      }
      applyPlannerDraftMutation((previous) => ({
        ...previous,
        legs: previous.legs.map((leg) =>
          Number(leg.originVillageId) === originVillageId
            ? {
                ...leg,
                impactAtUtc: addMinutesToIso(leg.impactAtUtc, deltaMinutes),
              }
            : leg,
        ),
        updatedAt: new Date().toISOString(),
      }));
      setFocusedPlannerLegOriginVillageId(originVillageId);
    },
    [applyPlannerDraftMutation],
  );

  const handlePlannerLegUnitAmountChange = useCallback(
    (originVillageIdRaw: number, unitId: CommandUnitId, value: string) => {
      const originVillageId = Math.floor(Number(originVillageIdRaw));
      if (!Number.isFinite(originVillageId) || originVillageId <= 0) {
        return;
      }
      const originVillage = plannerVillageById.get(originVillageId);
      if (!originVillage) {
        return;
      }
      const unitSummary =
        originVillage.units.find((unit) => String(unit.unitId) === String(unitId)) ?? null;
      const maxAllowed = Math.max(0, Math.floor(Number(unitSummary?.availableForPlanning ?? 0)));
      const requestedAmount = Math.max(0, Math.floor(Number(value)));
      const nextAmount = Math.min(maxAllowed, requestedAmount);
      applyPlannerDraftMutation((previous) => ({
        ...previous,
        legs: previous.legs.map((leg) => {
          if (Number(leg.originVillageId) !== originVillageId) {
            return leg;
          }
          const nextUnits: Partial<Record<CommandUnitId, number>> = { ...(leg.units ?? {}) };
          if (nextAmount <= 0) {
            delete nextUnits[unitId];
          } else {
            nextUnits[unitId] = nextAmount;
          }
          return {
            ...leg,
            units: nextUnits,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
      setFocusedPlannerLegOriginVillageId(originVillageId);
    },
    [applyPlannerDraftMutation, plannerVillageById],
  );

  const handlePlannerLegDrop = useCallback(
    (targetOriginVillageIdRaw: number) => {
      const draggedOriginVillageId = Number(draggedPlannerLegOriginVillageId);
      const targetOriginVillageId = Number(targetOriginVillageIdRaw);
      if (
        !Number.isFinite(draggedOriginVillageId) ||
        draggedOriginVillageId <= 0 ||
        !Number.isFinite(targetOriginVillageId) ||
        targetOriginVillageId <= 0 ||
        draggedOriginVillageId === targetOriginVillageId
      ) {
        return;
      }
      applyPlannerDraftMutation((previous) => {
        const sourceIndex = previous.legs.findIndex(
          (leg) => Number(leg.originVillageId) === Math.floor(draggedOriginVillageId),
        );
        const targetIndex = previous.legs.findIndex(
          (leg) => Number(leg.originVillageId) === Math.floor(targetOriginVillageId),
        );
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
          return previous;
        }
        const nextLegs = [...previous.legs];
        const [movedLeg] = nextLegs.splice(sourceIndex, 1);
        nextLegs.splice(targetIndex, 0, movedLeg);
        return {
          ...previous,
          legs: nextLegs,
          updatedAt: new Date().toISOString(),
        };
      });
      setFocusedPlannerLegOriginVillageId(Math.floor(draggedOriginVillageId));
      setDraggedPlannerLegOriginVillageId(null);
    },
    [applyPlannerDraftMutation, draggedPlannerLegOriginVillageId],
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
          className={`secondary-action ${armyViewMode === 'armadaPlanner' ? 'is-active' : ''}`}
          onClick={() => setArmyViewMode('armadaPlanner')}
        >
          Armada + plánovač
        </button>
        <button
          type="button"
          className={`secondary-action ${armyViewMode === 'multiVillage' ? 'is-active' : ''}`}
          onClick={() => setArmyViewMode('multiVillage')}
        >
          Armády všech lén
        </button>
      </section>
      {armyViewMode === 'armadaPlanner' ? (
        <section className="army-panel-view is-enter armada-planner-view">
          <header className="armada-planner-header">
            <div>
              <h3>Armada</h3>
              <p>Read-only souhrn vlastních lén v aktuálním světě. Klik na kartu přidá léno do plánovače.</p>
            </div>
            <button type="button" className="secondary-action" onClick={handleRefreshArmadaAndPlanner}>
              Obnovit data
            </button>
          </header>
          <p className="row-help">Utocne a obranne prikazy a presuny jednotek</p>
          {armyOverviewError ? <p className="panel-feedback">{armyOverviewError}</p> : null}
          {plannerOpenError ? <p className="panel-feedback">{plannerOpenError}</p> : null}
          {plannerNoticeMessage ? <p className="panel-feedback">{plannerNoticeMessage}</p> : null}
          {armyOverviewLoading ? <p>Načítám armádní přehled…</p> : null}
          {!armyOverviewLoading && armyOverviewVillages.length <= 0 ? (
            <p>V tomto světě zatím nemáš žádná dostupná léna.</p>
          ) : null}
          {armyOverviewVillages.length > 0 ? (
            <ul className="armada-overview-grid">
              {armyOverviewVillages.map((village) => (
                <li key={`armada-overview-${village.villageId}`}>
                  <button
                    type="button"
                    className={`armada-village-card ${
                      village.plannerSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => handleArmadaVillageCardClick(village)}
                  >
                    <div className="commands-item-line">
                      <strong>{village.villageName}</strong>
                      <span>
                        {village.coordX}|{village.coordY}
                      </span>
                    </div>
                    <small>
                      Království: {village.kingdom} · Jednotky {village.totalOwnUnits.toLocaleString('cs-CZ')} (
                      {village.totalSupportUnits.toLocaleString('cs-CZ')})
                    </small>
                    <div className="armada-village-intel-row">
                      <span className="armada-village-intel-pill">
                        Opevnění L{Math.max(0, Math.floor(Number(village.fortificationLevel ?? 0)))}
                      </span>
                      <span className="armada-village-intel-pill">
                        Brána L{Math.max(0, Math.floor(Number(village.gateLevel ?? 0)))}
                      </span>
                      <span
                        className="armada-village-intel-pill is-tooltip"
                        title={formatArmadaGarrisonTooltip(village)}
                        aria-label={formatArmadaGarrisonTooltip(village)}
                      >
                        Posádka {Math.max(0, Math.floor(Number(village.garrison?.totalUnits ?? 0))).toLocaleString('cs-CZ')}
                      </span>
                      <span
                        className="armada-village-intel-pill is-tooltip"
                        title={formatArmadaRecruitmentTooltip(village)}
                        aria-label={formatArmadaRecruitmentTooltip(village)}
                      >
                        Nábor {Math.max(0, Math.floor(Number(village.activeRecruitments?.length ?? 0))).toLocaleString('cs-CZ')}
                      </span>
                    </div>
                    <div className="armada-unit-pill-row">
                      {village.units.map((unit) => (
                        <span
                          key={`armada-pill-${village.villageId}-${unit.unitId}`}
                          className={`armada-unit-pill ${
                            Number(unit.availableForPlanning ?? 0) <= 0 ? 'is-passive' : ''
                          }`}
                        >
                          <span>{getUnitMetaById(unit.unitId).fallbackName}</span>
                          <span className="armada-unit-value tld-type-value">{unit.visibleLabel}</span>
                        </span>
                      ))}
                    </div>
                    <span className="armada-card-action">Přidat do plánovače</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <section className="planner-v1-shell">
            <header className="planner-v1-header">
              <h3>Planovač v1</h3>
              <small>
                max legů {Number(plannerConstraints.maxLegs)} · min mezera{' '}
                {Number(plannerConstraints.minImpactGapMinutes)} min · lead time{' '}
                {Math.ceil(Number(plannerConstraints.leadTimeSec) / 60)} min
              </small>
            </header>
            <p className="planner-v1-banner">{plannerBannerText}</p>
            {plannerOpenLoading ? <p>Načítám planner…</p> : null}
            {plannerLastCompletedPlan ? (
              <article className="planner-active-plan planner-completed-stub">
                <h4>Poslední dokončený plán</h4>
                <p>
                  Cíl: {plannerLastCompletedPlan.targetPlayerUsernameSnapshot} ·{' '}
                  {plannerLastCompletedPlan.targetVillageNameSnapshot}
                </p>
                <p className="row-help">
                  Legy: {plannerLastCompletedPlan.legsCount} · první odeslání{' '}
                  {formatDateTimePragueLabel(plannerLastCompletedPlan.firstSendAtUtc)} · poslední odeslání{' '}
                  {formatDateTimePragueLabel(plannerLastCompletedPlan.lastSendAtUtc)}
                </p>
                <p className="row-help">Dokončeno: {formatDateTimePragueLabel(plannerLastCompletedPlan.completedAt)}</p>
              </article>
            ) : null}
            {!plannerIsDraftMode && plannerActivePlan ? (
              <article className="planner-active-plan">
                <h4>Aktivní serverový plán</h4>
                <p>
                  Cíl: {plannerActivePlan.plan.targetPlayerUsernameSnapshot} ·{' '}
                  {plannerActivePlan.plan.targetVillageNameSnapshot}
                </p>
                <p className={`planner-plan-status is-${plannerActivePlanStatusMeta?.tone ?? 'neutral'}`}>
                  Stav: {plannerActivePlanStatusMeta?.label ?? plannerActivePlan.plan.status} · revize{' '}
                  {plannerActivePlan.plan.revision}
                </p>
                <p className="row-help">
                  Progress: {plannerActivePlanProgress?.sentLegs ?? 0}/{plannerActivePlanProgress?.totalLegs ?? 0}
                  {' '}({plannerActivePlanProgress?.percent ?? 0}%)
                  {plannerActivePlanProgress?.countdownSec != null
                    ? ` · start za ${formatDurationLabel(plannerActivePlanProgress.countdownSec)}`
                    : ''}
                </p>
                <ul className="planner-active-leg-list">
                  {plannerActivePlan.legs.map((leg) => {
                    const legStatusMeta = resolvePlannerLegStatusMeta(leg.status);
                    return (
                      <li
                        key={`planner-active-leg-${leg.id}`}
                        className={`planner-active-leg is-${legStatusMeta.tone}`}
                      >
                        <p>
                          #{leg.order} · {leg.originVillageNameSnapshot} · dopad{' '}
                          {formatDateTimePragueLabel(leg.impactAtUtc)} · odeslání{' '}
                          {formatDateTimePragueLabel(leg.sendAtUtc)}
                        </p>
                        <p className="planner-active-leg-status">
                          Stav legu: {legStatusMeta.label}
                        </p>
                        {leg.failMessage ? (
                          <p className="planner-active-leg-fail">
                            Fail detail: {leg.failMessage}
                            {leg.failCode ? ` (${leg.failCode})` : ''}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="row-help">
                  Aktivní serverový plán má prioritu nad lokálním draftem.
                </p>
                {plannerCanReturnToDraftFromActivePlan ? (
                  <div className="activity-item-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={handlePlannerReturnToDraft}
                      disabled={plannerMutationPending}
                    >
                      Zpet do konceptu
                    </button>
                  </div>
                ) : null}
                {String(plannerActivePlan.plan.status ?? '') === 'needs_reconfirmation' ? (
                  <div className="activity-item-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => void handlePlannerReconfirmActivePlan()}
                      disabled={plannerMutationPending}
                    >
                      {plannerMutationPending ? 'Potvrzuji...' : 'Potvrdit i s následky'}
                    </button>
                  </div>
                ) : null}
                {(String(plannerActivePlan.plan.status ?? '') === 'scheduled' ||
                  String(plannerActivePlan.plan.status ?? '') === 'needs_reconfirmation') ? (
                  <div className="activity-item-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => void handlePlannerCancelActivePlan()}
                      disabled={plannerMutationPending}
                    >
                      {plannerMutationPending ? 'Ruším...' : 'Zrušit plán'}
                    </button>
                  </div>
                ) : null}
              </article>
            ) : (
              <>
                {plannerActivePlan && plannerForceDraftMode ? (
                  <div className="planner-restore-callout">
                    <p>
                      Pracuješ v lokálním konceptu. Aktivní serverový plán zůstává autoritativní, dokud ho výslovně
                      nezměníš.
                    </p>
                    <div className="activity-item-actions">
                      <button type="button" className="secondary-action" onClick={handlePlannerBackToActivePlan}>
                        Zobrazit aktivní plán
                      </button>
                    </div>
                  </div>
                ) : null}
                {storedPlannerDraftAvailable &&
                plannerDraft.legs.length <= 0 &&
                plannerDraft.targetVillageId == null &&
                !plannerDraft.targetPlayerUsername ? (
                  <div className="planner-restore-callout">
                    <p>Byl nalezen poslední lokální koncept.</p>
                    <small className="row-help">
                      Naposledy uložen: {formatDateTimePragueLabel(storedPlannerDraftAvailable.updatedAt)}
                    </small>
                    <button type="button" className="secondary-action" onClick={handleRestorePlannerDraft}>
                      Obnovit poslední koncept
                    </button>
                  </div>
                ) : null}

                {plannerDraftStage === 'confirmation' ? (
                  <section className="planner-summary-step">
                    <h4>Potvrzení plánu</h4>
                    <p className={`planner-summary-status is-${plannerValidation.status}`}>
                      Stav konceptu: {plannerValidation.status === 'ok' ? 'validní' : plannerValidation.status}
                    </p>
                    <p>
                      Cíl:{' '}
                      {plannerDraft.targetVillageId != null
                        ? `${plannerDraft.targetPlayerUsername} (${plannerTargetByVillageId.get(plannerDraft.targetVillageId)?.coordX ?? 0}|${
                            plannerTargetByVillageId.get(plannerDraft.targetVillageId)?.coordY ?? 0
                          })`
                        : 'nevybrán'}
                    </p>
                    <ul>
                      {plannerLegRows.map((leg) => (
                        <li key={`planner-confirm-summary-${leg.key}`}>
                          #{leg.order} · {leg.originVillage?.villageName ?? `Léno #${leg.key}`} · dopad{' '}
                          {formatDateTimePragueLabel(leg.impactAtUtc)} · odeslání{' '}
                          {formatDateTimePragueLabel(leg.sendAtUtc)} · jednotky{' '}
                          {leg.unitsTotal.toLocaleString('cs-CZ')}
                        </li>
                      ))}
                    </ul>
                    {plannerValidation.issues.length > 0 ? (
                      <ul className="planner-validation-list">
                        {plannerValidation.issues.map((issue) => (
                          <li key={`planner-confirm-issue-${issue.code}`} className={`is-${issue.severity}`}>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="row-help">Kliknutím na Uložit plán vznikne serverový stav Potvrzeno/naplánováno.</p>
                    )}
                    <div className="activity-item-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void handlePlannerSaveConfirmed()}
                        disabled={plannerMutationPending || !plannerCanOpenConfirmation}
                      >
                        {plannerMutationPending ? 'Ukládám...' : 'Uložit plán'}
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={handlePlannerBackToDraftFromConfirmation}
                        disabled={plannerMutationPending}
                      >
                        Zpět do konceptu
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    <div className="activity-item-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={handlePlannerAutoAlignForward}
                        disabled={plannerMutationPending || plannerLegRows.length <= 0}
                        title="Synchronizuje útoky všech lén po sobě jdoucích v dopadu po každé jedné minutě."
                      >
                        Srovnat časy dopředu
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={handlePlannerAutoAlignBackward}
                        disabled={plannerMutationPending || plannerLegRows.length <= 0}
                      >
                        Srovnat od posledního
                      </button>
                    </div>

                    <label className="planner-target-picker">
                      <span>Cíl (hráč s právě jedním lénem)</span>
                      <select
                        value={
                          plannerDraft.targetVillageId != null && Number.isFinite(plannerDraft.targetVillageId)
                            ? String(plannerDraft.targetVillageId)
                            : ''
                        }
                        onChange={(event) => {
                          const nextVillageId = Number(event.target.value);
                          handlePlannerTargetChange(
                            Number.isFinite(nextVillageId) && nextVillageId > 0 ? nextVillageId : null,
                          );
                        }}
                        disabled={plannerMutationPending}
                      >
                        <option value="">Vyber cílového hráče</option>
                        {plannerTargetCandidates.map((candidate) => (
                          <option key={`planner-target-${candidate.villageId}`} value={candidate.villageId}>
                            {candidate.username} · {candidate.villageName} ({candidate.coordX}|{candidate.coordY})
                          </option>
                        ))}
                      </select>
                      {plannerTargetCandidates.length <= 0 ? (
                        <small className="row-help">
                          V tomto světě zatím není dostupný hráč s právě jedním lénem.
                        </small>
                      ) : null}
                    </label>

                    <div className="planner-leg-list-wrap">
                      <h4>Legy útoku</h4>
                      {plannerLegRows.length <= 0 ? (
                        <p>
                          Prázdný koncept. Klikni na kartu léna v Armadě a přidej první leg.
                        </p>
                      ) : (
                        <ul className="planner-leg-list">
                          {plannerLegRows.map((legRow) => {
                            const legIssues = plannerValidationIssuesByLegOriginVillageId.get(legRow.key) ?? [];
                            const legIssueTone = legIssues.some((issue) => issue.severity === 'blocked')
                              ? 'has-blocked'
                              : legIssues.some((issue) => issue.severity === 'warning')
                                ? 'has-warning'
                                : '';
                            return (
                              <li
                                key={`planner-leg-${legRow.key}`}
                                draggable={!plannerMutationPending}
                                onDragStart={() => setDraggedPlannerLegOriginVillageId(legRow.key)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  handlePlannerLegDrop(legRow.key);
                                }}
                                className={`planner-leg-card ${focusedPlannerLegOriginVillageId === legRow.key ? 'is-focused' : ''} ${legIssueTone}`}
                              >
                                <header>
                                  <div>
                                    <strong>
                                      #{legRow.order} · {legRow.originVillage?.villageName ?? `Léno #${legRow.key}`}
                                    </strong>
                                    <small>
                                      {legRow.originVillage?.coordX ?? 0}|{legRow.originVillage?.coordY ?? 0} ·
                                      tahem přetáhni pro změnu pořadí
                                    </small>
                                  </div>
                                  <div className="activity-item-actions">
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerFillLegAll(legRow.key)}
                                      disabled={plannerMutationPending}
                                      title="Složení nejlepší kombinace k útoku se špionáží: Jezdec, Zvěd a Beranidlo."
                                    >
                                      Vyplnit útočnými jednotkami
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerLegRemove(legRow.key)}
                                      title="Odebrat léno z plánovače"
                                      aria-label="Odebrat léno z plánovače"
                                      disabled={plannerMutationPending}
                                    >
                                      Odebrat léno
                                    </button>
                                  </div>
                                </header>
                                <div className="planner-impact-controls">
                                  <span>Dopad (Praha): {formatDateTimePragueLabel(legRow.impactAtUtc)}</span>
                                  <div>
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerLegImpactShift(legRow.key, -5)}
                                      disabled={plannerMutationPending}
                                    >
                                      -5m
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerLegImpactShift(legRow.key, -1)}
                                      disabled={plannerMutationPending}
                                    >
                                      -1m
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerLegImpactShift(legRow.key, 1)}
                                      disabled={plannerMutationPending}
                                    >
                                      +1m
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-action compact"
                                      onClick={() => handlePlannerLegImpactShift(legRow.key, 5)}
                                      disabled={plannerMutationPending}
                                    >
                                      +5m
                                    </button>
                                  </div>
                                </div>
                                <small>
                                  Odeslání (Praha): {formatDateTimePragueLabel(legRow.sendAtUtc)} · cesta{' '}
                                  {formatDurationLabel(legRow.travelDurationSec)}
                                </small>
                                {legIssues.length > 0 ? (
                                  <ul className="planner-leg-issues">
                                    {legIssues.map((issue) => (
                                      <li key={`planner-leg-issue-${issue.code}`} className={`is-${issue.severity}`}>
                                        {issue.message}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                <div className="planner-leg-unit-grid">
                                  {COMMAND_UNIT_ORDER.map((unitId) => {
                                    const unitSummary =
                                      legRow.originVillage?.units.find((unit) => String(unit.unitId) === unitId) ?? null;
                                    const availableForPlanning = Math.max(
                                      0,
                                      Math.floor(Number(unitSummary?.availableForPlanning ?? 0)),
                                    );
                                    if (availableForPlanning <= 0) {
                                      return null;
                                    }
                                    return (
                                      <label key={`planner-leg-unit-${legRow.key}-${unitId}`}>
                                        <span>
                                          {getUnitMetaById(unitId).fallbackName} · max{' '}
                                          {availableForPlanning.toLocaleString('cs-CZ')}
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={availableForPlanning}
                                          step={1}
                                          value={String(Math.max(0, Math.floor(Number(legRow.units[unitId] ?? 0))))}
                                          onChange={(event) =>
                                            handlePlannerLegUnitAmountChange(legRow.key, unitId, event.target.value)
                                          }
                                          disabled={plannerMutationPending}
                                        />
                                      </label>
                                    );
                                  })}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <section className="planner-summary-step">
                      <h4>Souhrn konceptu</h4>
                      <p className={`planner-summary-status is-${plannerValidation.status}`}>
                        Stav konceptu: {plannerValidation.status === 'ok' ? 'validní' : plannerValidation.status}
                      </p>
                      <p>
                        Cíl:{' '}
                        {plannerDraft.targetVillageId != null
                          ? `${plannerDraft.targetPlayerUsername} (${plannerTargetByVillageId.get(plannerDraft.targetVillageId)?.coordX ?? 0}|${
                              plannerTargetByVillageId.get(plannerDraft.targetVillageId)?.coordY ?? 0
                            })`
                          : 'nevybrán'}
                      </p>
                      <ul>
                        {plannerLegRows.map((leg) => (
                          <li key={`planner-summary-${leg.key}`}>
                            #{leg.order} · {leg.originVillage?.villageName ?? `Léno #${leg.key}`} · dopad{' '}
                            {formatDateTimePragueLabel(leg.impactAtUtc)} · odeslání{' '}
                            {formatDateTimePragueLabel(leg.sendAtUtc)} · jednotky{' '}
                            {leg.unitsTotal.toLocaleString('cs-CZ')}
                          </li>
                        ))}
                      </ul>
                      {plannerValidation.issues.length > 0 ? (
                        <ul className="planner-validation-list">
                          {plannerValidation.issues.map((issue) => (
                            <li key={`planner-issue-${issue.code}`} className={`is-${issue.severity}`}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="row-help">Koncept je validní pro v1 guardrails.</p>
                      )}
                      <div className="activity-item-actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={handlePlannerOpenConfirmation}
                          disabled={!plannerCanOpenConfirmation || plannerMutationPending}
                        >
                          Potvrzení plánu
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={handleClearPlannerDraft}
                          disabled={plannerMutationPending}
                        >
                          Vyčistit koncept
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </section>
        </section>
      ) : armyViewMode === 'multiVillage' ? (
        <section className="army-panel-view is-enter">
          <h3>Armády všech lén</h3>
          <p>
            Read-only přehled všech vlastních lén. Nábor a stavby se tu neprovádí.
          </p>
          {armyOverviewError ? <p className="panel-feedback">{armyOverviewError}</p> : null}
          {armyOverviewLoading ? <p>Načítám armádní přehled…</p> : null}
          {!armyOverviewLoading && armyOverviewVillages.length > 0 ? (
            <ul className="commands-list multi-village-overview-list">
              {armyOverviewVillages.map((village) => {
                const villageId = Math.max(0, Math.floor(Number(village.villageId ?? 0)));
                const fortificationLevel = Math.max(0, Math.floor(Number(village.fortificationLevel ?? 0)));
                const gateLevel = Math.max(0, Math.floor(Number(village.gateLevel ?? 0)));
                const villageUnits = (village.units ?? [])
                  .map((unit) => {
                    const ownAmount = Math.max(0, Math.floor(Number(unit.ownAmount ?? 0)));
                    const supportAmount = Math.max(0, Math.floor(Number(unit.supportAmount ?? 0)));
                    const totalAmount = ownAmount + supportAmount;
                    return {
                      unit,
                      ownAmount,
                      supportAmount,
                      totalAmount,
                    };
                  })
                  .filter((entry) => entry.totalAmount > 0);
                return (
                  <li key={`army-multi-${village.villageId}`} className="commands-item multi-village-overview-item">
                    <header className="multi-village-overview-top">
                      <div>
                        <div className="commands-item-line">
                          <strong>{village.villageName}</strong>
                          <span>
                            {village.coordX}|{village.coordY}
                          </span>
                        </div>
                        <small>
                          Království: {village.kingdom} · Vlastní {village.totalOwnUnits.toLocaleString('cs-CZ')} ·
                          Podpora {village.totalSupportUnits.toLocaleString('cs-CZ')}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="secondary-action compact multi-village-open-profile"
                        onClick={() => {
                          if (villageId > 0) {
                            onOpenSettlementByVillageId(villageId);
                          }
                        }}
                        disabled={villageId <= 0}
                        title={`Otevřít profil léna ${village.villageName}`}
                        aria-label={`Otevřít profil léna ${village.villageName}`}
                      >
                        <span className="symbol" aria-hidden="true">
                          ⌂
                        </span>
                      </button>
                    </header>
                    <div className="multi-village-overview-intel-row">
                      <span
                        className="multi-village-overview-level-pill"
                        title={`Opevnění: úroveň ${fortificationLevel.toLocaleString('cs-CZ')}`}
                        aria-label={`Opevnění: úroveň ${fortificationLevel.toLocaleString('cs-CZ')}`}
                      >
                        <span className="unit-icon-shell tiny" aria-hidden="true">
                          <img src={BUILDING_ART.fortification.icon} alt="" className="unit-icon-image" loading="lazy" />
                        </span>
                        <strong className="multi-village-overview-level-value tld-type-value">
                          {fortificationLevel.toLocaleString('cs-CZ')}
                        </strong>
                      </span>
                      <span
                        className="multi-village-overview-level-pill"
                        title={`Brána: úroveň ${gateLevel.toLocaleString('cs-CZ')}`}
                        aria-label={`Brána: úroveň ${gateLevel.toLocaleString('cs-CZ')}`}
                      >
                        <span className="unit-icon-shell tiny" aria-hidden="true">
                          <img src={BUILDING_ART.gate.icon} alt="" className="unit-icon-image" loading="lazy" />
                        </span>
                        <strong className="multi-village-overview-level-value tld-type-value">
                          {gateLevel.toLocaleString('cs-CZ')}
                        </strong>
                      </span>
                    </div>
                    {villageUnits.length > 0 ? (
                      <div className="multi-village-unit-pill-row">
                        {villageUnits.map(({ unit, ownAmount, supportAmount, totalAmount }) => {
                          const unitMeta = getUnitMetaById(unit.unitId);
                          return (
                            <span
                              key={`multi-village-unit-${village.villageId}-${unit.unitId}`}
                              className="multi-village-unit-pill"
                              title={`${unitMeta.fallbackName}: vlastní ${ownAmount.toLocaleString('cs-CZ')}, podpora ${supportAmount.toLocaleString('cs-CZ')}`}
                              aria-label={`${unitMeta.fallbackName}: vlastní ${ownAmount.toLocaleString('cs-CZ')}, podpora ${supportAmount.toLocaleString('cs-CZ')}`}
                            >
                              <span className="unit-icon-shell tiny" aria-hidden="true">
                                <img src={unitMeta.icon} alt="" className="unit-icon-image" loading="lazy" />
                              </span>
                              <strong className="multi-village-unit-value tld-type-value">
                                {totalAmount.toLocaleString('cs-CZ')}
                              </strong>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="row-help">Léno je bez jednotek.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!armyOverviewLoading && armyOverviewVillages.length <= 0 ? (
            <p>V tomto světě zatím nemáš žádná dostupná léna.</p>
          ) : null}
        </section>
      ) : (
      <>
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
        <p>Fronta běží sekvenčně. Aktivní je vždy první položka, další čekají v pořadí.</p>
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
            {recruitQueueOrders.map((order, index) => {
              const isActiveQueueItem = order.queueIndex <= 0;
              const queueActionPending = cancelRecruitmentPendingId != null || reorderRecruitmentPendingId != null;
              const canMoveWithinQueue = !isActiveQueueItem && !queueActionPending;
              const canMoveUp = canMoveWithinQueue && order.queueIndex > 1;
              const canMoveDown = canMoveWithinQueue && order.queueIndex < recruitQueueOrders.length - 1;
              const isReorderPending = reorderRecruitmentPendingId === order.id;
              const isCancelPending = cancelRecruitmentPendingId === order.id;
              const isDragSource = draggedRecruitQueueOrderId === order.id;
              const isDragTarget =
                draggedRecruitQueueOrderId != null &&
                draggedRecruitQueueOrderId !== order.id &&
                !isActiveQueueItem;

              return (
                <tr
                  key={`rq-${order.id}`}
                  className={`queue-row ${isDragSource ? 'is-drag-source' : ''} ${isDragTarget ? 'is-drag-target' : ''}`}
                  draggable={canMoveWithinQueue}
                  onDragStart={() => setDraggedRecruitQueueOrderId(order.id)}
                  onDragOver={(event) => {
                    if (
                      draggedRecruitQueueOrderId == null ||
                      draggedRecruitQueueOrderId === order.id ||
                      isActiveQueueItem
                    ) {
                      return;
                    }
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (
                      draggedRecruitQueueOrderId == null ||
                      draggedRecruitQueueOrderId === order.id ||
                      isActiveQueueItem
                    ) {
                      return;
                    }
                    onReorderRecruitment(draggedRecruitQueueOrderId, order.queueIndex);
                    setDraggedRecruitQueueOrderId(null);
                  }}
                  onDragEnd={() => setDraggedRecruitQueueOrderId(null)}
                >
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
                  <td className="queue-row-actions">
                    <div className="recruit-queue-actions">
                      <button
                        type="button"
                        className="recruit-queue-move-button"
                        onClick={() => onReorderRecruitment(order.id, order.queueIndex - 1)}
                        disabled={!canMoveUp || isReorderPending}
                        title="Posunout položku výš"
                        aria-label="Posunout náborovou položku výš"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="recruit-queue-move-button"
                        onClick={() => onReorderRecruitment(order.id, order.queueIndex + 1)}
                        disabled={!canMoveDown || isReorderPending}
                        title="Posunout položku níž"
                        aria-label="Posunout náborovou položku níž"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="inline-cancel-button"
                        onClick={() => onCancelRecruitment(order)}
                        disabled={isCancelPending || reorderRecruitmentPendingId != null}
                        title="Zrušit tuto položku náboru"
                        aria-label="Zrušit náborovou položku"
                      >
                        {isCancelPending ? '…' : '✕'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recruitQueueOrders.length === 0 ? (
              <tr>
                <td colSpan={5}>Náborová fronta je prázdná.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
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
      </>
      )}
    </div>
  );
});

const MilitaryPanel = ({
  units,
  activeMovements,
  incomingMovements,
  stationedSupports,
  currentVillageName,
  mercenaries,
  resources,
  notice,
  isArmyCommandPending,
  cancelCommandProgressLimit,
  onCancelArmyCommand,
  mercenaryActionPending,
  onHireMercenaries,
}: {
  units: Unit[];
  activeMovements: ArmyMovementState[];
  incomingMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  currentVillageName: string;
  mercenaries: GameStateResponse['mercenaries'] | undefined;
  resources:
    | Pick<GameStateResponse['resources'], 'coins' | 'productionPerHour' | 'protection'>
    | undefined;
  notice: string | null;
  isArmyCommandPending: boolean;
  cancelCommandProgressLimit: number | null | undefined;
  onCancelArmyCommand: (movementId: number) => void;
  mercenaryActionPending: boolean;
  onHireMercenaries: (villageId: number) => void;
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
        const unitPower = resolveAttackPowerByUnitId(String(unit.id));
        return sum + Number(unit.amount ?? 0) * unitPower;
      }, 0),
    [orderedUnits],
  );
  const totalDefensePower = useMemo(
    () =>
      orderedUnits.reduce((sum, unit) => {
        const unitPower = resolveDefensePowerByUnitId(String(unit.id));
        return sum + Number(unit.amount ?? 0) * unitPower;
      }, 0),
    [orderedUnits],
  );
  const totalLootCapacity = useMemo(
    () =>
      orderedUnits.reduce((sum, unit) => {
        const unitCapacity = resolveLootCapacityByUnitId(String(unit.id));
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
  const resolvedCancelCommandProgressLimit = resolveCancelCommandProgressLimit(cancelCommandProgressLimit);
  const [hoveredMovementId, setHoveredMovementId] = useState<number | null>(null);
  const [tooltipCursorPosition, setTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const [selectedMercenaryVillageId, setSelectedMercenaryVillageId] = useState<number | null>(null);

  const mercenaryCooldownRemainingSec = Math.max(0, Math.floor(Number(mercenaries?.cooldownRemainingSec ?? 0)));
  const mercenaryCooldownSec = Math.max(0, Math.floor(Number(mercenaries?.cooldownSec ?? 0)));
  const mercenaryDeliveryDelaySec = Math.max(0, Math.floor(Number(mercenaries?.deliveryDelaySec ?? 0)));
  const mercenaryDurationSec = Math.max(0, Math.floor(Number(mercenaries?.durationSec ?? 0)));
  const mercenaryContractCoinCost = Math.max(
    0,
    Math.floor(Number(mercenaries?.contractCoinCost ?? MERCENARY_CONTRACT_COIN_COST)),
  );
  const mercenaryContractUnitAmount = Math.max(
    0,
    Math.floor(Number(mercenaries?.contractUnitAmount ?? 0)),
  );
  const mercenaryUnlocked = Boolean(mercenaries?.unlocked);
  const mercenaryContracts = useMemo(() => {
    const statusPriority: Record<string, number> = {
      active: 0,
      en_route: 1,
      ordered: 2,
      in_transit: 3,
      completed: 4,
      expired: 5,
      canceled: 6,
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
  }, [mercenaries?.contracts]);
  const activeMercenaryContract = useMemo(
    () =>
      mercenaryContracts.find((contract) => {
        const status = String(contract.status ?? '').toLocaleLowerCase('cs-CZ');
        return status === 'active' || status === 'en_route';
      }) ?? null,
    [mercenaryContracts],
  );
  const mercenaryNowMs = useSecondClock(activeMercenaryContract != null);
  type MercenaryDeploymentState = {
    status: 'en_route' | 'active';
    remainingSec: number;
    overlayPercent: number;
    summaryLabel: string;
    hoverLabel: string;
  };
  let mercenaryDeployment: MercenaryDeploymentState | null = null;
  if (activeMercenaryContract) {
    const nowMs = mercenaryNowMs;
    const status = String(activeMercenaryContract.status ?? '').toLocaleLowerCase('cs-CZ');
    if (status === 'en_route') {
      const orderedAtMs = Date.parse(String(activeMercenaryContract.orderedAt));
      const arriveAtMs = Date.parse(String(activeMercenaryContract.arriveAt));
      if (Number.isFinite(arriveAtMs)) {
        const fallbackDeliverySec =
          Number.isFinite(orderedAtMs) && Number.isFinite(arriveAtMs)
            ? Math.max(1, Math.floor((arriveAtMs - orderedAtMs) / 1000))
            : 1;
        const totalDeliverySec = mercenaryDeliveryDelaySec > 0 ? mercenaryDeliveryDelaySec : fallbackDeliverySec;
        const remainingDeliverySec = Math.max(0, Math.ceil((arriveAtMs - nowMs) / 1000));
        const overlayPercent = Math.max(
          0,
          Math.min(100, Math.round((remainingDeliverySec / Math.max(1, totalDeliverySec)) * 100)),
        );
        mercenaryDeployment = {
          status: 'en_route',
          remainingSec: remainingDeliverySec,
          overlayPercent,
          summaryLabel: `Spawn za ${formatDurationLabel(remainingDeliverySec)} · ${formatDateTimeLabel(
            activeMercenaryContract.arriveAt,
          )}`,
          hoverLabel: `Žoldáci dorazí ${formatDateTimeLabel(activeMercenaryContract.arriveAt)} (za ${formatDurationLabel(
            remainingDeliverySec,
          )}).`,
        };
      }
    } else if (status === 'active') {
      const arriveAtMs = Date.parse(String(activeMercenaryContract.arriveAt));
      const expiresAtMs = Date.parse(String(activeMercenaryContract.expiresAt));
      if (Number.isFinite(expiresAtMs)) {
        const fallbackDurationSec =
          Number.isFinite(arriveAtMs) && Number.isFinite(expiresAtMs)
            ? Math.max(1, Math.floor((expiresAtMs - arriveAtMs) / 1000))
            : 1;
        const totalDurationSec = mercenaryDurationSec > 0 ? mercenaryDurationSec : fallbackDurationSec;
        const remainingDurationSec = Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
        const overlayPercent = Math.max(
          0,
          Math.min(100, Math.round((remainingDurationSec / Math.max(1, totalDurationSec)) * 100)),
        );
        mercenaryDeployment = {
          status: 'active',
          remainingSec: remainingDurationSec,
          overlayPercent,
          summaryLabel: `Nasazení končí za ${formatDurationLabel(remainingDurationSec)} · ${formatDateTimeLabel(
            activeMercenaryContract.expiresAt,
          )}`,
          hoverLabel: `Žoldáci v lénu do ${formatDateTimeLabel(activeMercenaryContract.expiresAt)} (zbývá ${formatDurationLabel(
            remainingDurationSec,
          )}).`,
        };
      }
    }
  }
  const mercenaryHiringOptions = useMemo(
    () =>
      [...(mercenaries?.hiringOptions ?? [])].sort((left, right) => {
        if (left.hasEnoughCoins !== right.hasEnoughCoins) {
          return left.hasEnoughCoins ? -1 : 1;
        }
        if (left.isCurrentVillage !== right.isCurrentVillage) {
          return left.isCurrentVillage ? -1 : 1;
        }
        return compareVillageLabelNatural(
          {
            name: left.villageName,
            coordX: left.coordX,
            coordY: left.coordY,
          },
          {
            name: right.villageName,
            coordX: right.coordX,
            coordY: right.coordY,
          },
        );
      }),
    [mercenaries?.hiringOptions],
  );
  const coinEligibleHiringOptions = useMemo(
    () => mercenaryHiringOptions.filter((option) => option.hasEnoughCoins),
    [mercenaryHiringOptions],
  );
  const displayedHiringOptions = coinEligibleHiringOptions.length > 0 ? coinEligibleHiringOptions : mercenaryHiringOptions;
  const hasCoinEligibleHiringOptions = coinEligibleHiringOptions.length > 0;
  const resolvedSelectedMercenaryVillageId = useMemo(() => {
    if (displayedHiringOptions.length <= 0) {
      return null;
    }
    if (
      selectedMercenaryVillageId != null &&
      displayedHiringOptions.some((option) => option.villageId === selectedMercenaryVillageId)
    ) {
      return selectedMercenaryVillageId;
    }
    const currentVillageOption = displayedHiringOptions.find((option) => option.isCurrentVillage) ?? displayedHiringOptions[0];
    return currentVillageOption?.villageId ?? null;
  }, [displayedHiringOptions, selectedMercenaryVillageId]);
  const selectedMercenaryVillage = useMemo(
    () =>
      displayedHiringOptions.find((option) => option.villageId === resolvedSelectedMercenaryVillageId) ??
      mercenaryHiringOptions.find((option) => option.villageId === resolvedSelectedMercenaryVillageId) ??
      null,
    [displayedHiringOptions, mercenaryHiringOptions, resolvedSelectedMercenaryVillageId],
  );
  const canHireMercenaries = Boolean(selectedMercenaryVillage?.canHire) && !mercenaryActionPending;
  const resolveMercenaryContractStatusLabel = (statusRaw: string): string => {
    switch (String(statusRaw ?? '').toLocaleLowerCase('cs-CZ')) {
      case 'ordered':
        return 'Objednáno';
      case 'en_route':
        return 'Na cestě';
      case 'in_transit':
        return 'Na cestě';
      case 'active':
        return 'Aktivní';
      case 'completed':
        return 'Dokončeno';
      case 'expired':
        return 'Vypršelo';
      case 'canceled':
        return 'Zrušeno';
      default:
        return statusRaw;
    }
  };

  return (
    <div className="panel-stack military-panel">
      <section>
        <h3>Válečný štáb · {currentVillageName}</h3>
        <div className="commands-kpi-strip">
          <article className="military-summary-card military-summary-card--units">
            <span>🪖 Celkem jednotek</span>
            <strong className="commands-kpi-value tld-type-value">{totalUnits.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className="military-summary-card military-summary-card--attack">
            <span>⚔ Souhrnná síla útoku</span>
            <strong className="commands-kpi-value tld-type-value">{totalAttackPower.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className="military-summary-card military-summary-card--defense">
            <span>🛡 Souhrnná síla obrany</span>
            <strong className="commands-kpi-value tld-type-value">{totalDefensePower.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className="military-summary-card military-summary-card--loot">
            <span>📦 Kapacita kořisti</span>
            <strong className="commands-kpi-value tld-type-value">{totalLootCapacity.toLocaleString('cs-CZ')}</strong>
          </article>
        </div>
      </section>

      <section>
        <h3>Armáda ve vybraném lénu</h3>
        <div className="military-unit-grid">
          {orderedUnits.map((unit) => {
            const unitId = String(unit.id);
            const attackPower = resolveAttackPowerByUnitId(unitId);
            const defensePower = resolveDefensePowerByUnitId(unitId);
            const lootCapacity = resolveLootCapacityByUnitId(unitId);
            const attackContribution = Number(unit.amount ?? 0) * attackPower;
            const defenseContribution = Number(unit.amount ?? 0) * defensePower;
            const isMercenaryUnitCard = unitId === MERCENARY_UNIT_ID;
            const mercenaryProgressPercent = isMercenaryUnitCard ? (mercenaryDeployment?.overlayPercent ?? 0) : 0;

            return (
              <article
                key={`military-unit-${unit.id}`}
                className={`military-unit-card${isMercenaryUnitCard ? ' is-mercenary-card' : ''}`}
                title={isMercenaryUnitCard && mercenaryDeployment ? mercenaryDeployment.hoverLabel : undefined}
              >
                {isMercenaryUnitCard ? (
                  <span className="military-unit-mercenary-progress" aria-hidden="true">
                    <span style={{ width: `${mercenaryProgressPercent}%` }} />
                  </span>
                ) : null}
                <header>
                  <span className="unit-icon-shell" aria-hidden="true">
                    <img src={getUnitMetaById(unit.id).icon} alt="" className="unit-icon-image" loading="lazy" />
                  </span>
                  <div>
                    <strong className="unit-name-large">{unit.name}</strong>
                  </div>
                </header>
                <p className="military-unit-amount unit-count-large tld-type-value">
                  {Number(unit.amount ?? 0).toLocaleString('cs-CZ')}
                </p>
                <div className="military-unit-stats">
                  <small className="military-unit-stat military-unit-stat--attack">Útok: {attackContribution.toLocaleString('cs-CZ')}</small>
                  <small className="military-unit-stat military-unit-stat--defense">Obrana: {defenseContribution.toLocaleString('cs-CZ')}</small>
                  <small className="military-unit-stat military-unit-stat--loot">Kořist: {(Number(unit.amount ?? 0) * lootCapacity).toLocaleString('cs-CZ')}</small>
                </div>
                {isMercenaryUnitCard && mercenaryDeployment ? (
                  <small className="row-help military-unit-mercenary-timing">{mercenaryDeployment.summaryLabel}</small>
                ) : null}
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
              {activeOutgoingForVillage.map((movement) => {
                const cancelMeta = resolveMovementCancelMeta(movement, resolvedCancelCommandProgressLimit);
                const cancelLimitLabel = cancelMeta.limitPct.toLocaleString('cs-CZ');
                const cancelProgressLabel = cancelMeta.progressPct.toLocaleString('cs-CZ');
                const isCancelDisabled = isArmyCommandPending || !cancelMeta.canCancel;
                return (
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
                    <small>
                      ETA {formatDurationLabel(movement.remainingSec)} · Postup {cancelProgressLabel} % / limit {cancelLimitLabel} %
                    </small>
                    <div className="activity-item-actions">
                      <CommandCancelAction
                        disabled={isCancelDisabled}
                        pending={isArmyCommandPending}
                        actionLabel={`Zrušit tento rozkaz (do ${cancelLimitLabel} % cesty)`}
                        disabledReason={`Limit zrušení ${cancelLimitLabel} % byl překročen (${cancelProgressLabel} %).`}
                        onClick={() => onCancelArmyCommand(movement.id)}
                      />
                    </div>
                    {hoveredMovementId === movement.id ? (
                      <MovementArmyTooltip movement={movement} cursorPosition={tooltipCursorPosition} />
                    ) : null}
                  </li>
                );
              })}
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

      <section className="military-mercenary-section">
        <h3>Mincovna a žoldáci</h3>
        <div className="commands-kpi-strip">
          <article>
            <span>Mince ve vybraném lénu</span>
            <strong className="commands-kpi-value tld-type-value">
              {Math.max(0, Math.floor(Number(resources?.coins ?? 0))).toLocaleString('cs-CZ')}
            </strong>
          </article>
          <article>
            <span>Chráněné mince</span>
            <strong className="commands-kpi-value tld-type-value">
              {Math.max(0, Math.floor(Number(resources?.protection.coins ?? 0))).toLocaleString('cs-CZ')}
            </strong>
          </article>
          <article>
            <span>Ražba / h</span>
            <strong className="commands-kpi-value tld-type-value">
              {Math.max(0, Number(resources?.productionPerHour.mintCoins ?? 0)).toLocaleString('cs-CZ')}
            </strong>
          </article>
          <article>
            <span>Cooldown žoldáků</span>
            <strong className="commands-kpi-value tld-type-value">
              {mercenaryCooldownRemainingSec > 0 ? formatDurationLabel(mercenaryCooldownRemainingSec) : 'Připraveno'}
            </strong>
          </article>
          <article className={mercenaryUnlocked ? '' : 'is-danger'}>
            <span>Výzkum banky</span>
            <strong className="commands-kpi-value tld-type-value">{mercenaryUnlocked ? 'Odemčeno' : 'Zamčeno'}</strong>
          </article>
        </div>

        <div className="research-panel-inline-actions military-mercenary-actions">
          <label>
            Léno pro nábor
            <select
              value={resolvedSelectedMercenaryVillageId ?? ''}
              onChange={(event) => setSelectedMercenaryVillageId(Number(event.target.value) || null)}
              disabled={mercenaryActionPending || displayedHiringOptions.length <= 0}
            >
              {displayedHiringOptions.map((option) => (
                <option key={`mercenary-hire-option-${option.villageId}`} value={option.villageId}>
                  {option.villageName} ({option.coordX}|{option.coordY}) · {option.coins.toLocaleString('cs-CZ')} mincí
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              if (resolvedSelectedMercenaryVillageId == null) {
                return;
              }
              onHireMercenaries(resolvedSelectedMercenaryVillageId);
            }}
            disabled={!canHireMercenaries}
          >
            {mercenaryActionPending
              ? 'Najímám žoldáky...'
              : `Najmout žoldáky (${mercenaryContractCoinCost.toLocaleString('cs-CZ')} mincí)`}
          </button>
        </div>
        {!hasCoinEligibleHiringOptions && mercenaryHiringOptions.length > 0 ? (
          <small className="row-help">Žádné léno aktuálně nemá dost mincí pro nábor.</small>
        ) : null}
        {selectedMercenaryVillage ? (
          <small className="row-help">
            Vybrané léno {selectedMercenaryVillage.villageName} ({selectedMercenaryVillage.coordX}|
            {selectedMercenaryVillage.coordY}) · mince {selectedMercenaryVillage.coins.toLocaleString('cs-CZ')} ·{' '}
            {selectedMercenaryVillage.blockedReason ?? 'Nábor je připraven.'}
          </small>
        ) : (
          <small className="row-help">Vyber léno pro nábor žoldáků.</small>
        )}

        <ul className="commands-list military-mercenary-timeline">
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Doba spawnu</strong>
              <span>{formatDurationLabel(Math.max(1, mercenaryDeliveryDelaySec))}</span>
            </div>
            <small>
              {mercenaryDeployment?.status === 'en_route'
                ? `Aktuální kontrakt dorazí ${formatDateTimeLabel(activeMercenaryContract?.arriveAt)} (za ${formatDurationLabel(mercenaryDeployment.remainingSec)}).`
                : `Po náboru dorazí žoldáci za ${formatDurationLabel(Math.max(1, mercenaryDeliveryDelaySec))}.`}
            </small>
          </li>
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Doba nasazení</strong>
              <span>{formatDurationLabel(Math.max(1, mercenaryDurationSec))}</span>
            </div>
            <small>
              {mercenaryDeployment?.status === 'active'
                ? `Aktivní jednotka (+${Math.max(0, Math.floor(Number(activeMercenaryContract?.unitAmount ?? mercenaryContractUnitAmount))).toLocaleString('cs-CZ')}) vyprší ${formatDateTimeLabel(activeMercenaryContract?.expiresAt)}.`
                : 'Žoldáci brání pouze domovské léno a po vypršení kontraktu automaticky zmizí.'}
            </small>
          </li>
          <li className="commands-item">
            <div className="commands-item-line">
              <strong>Blokace náboru</strong>
              <span>{formatDurationLabel(Math.max(1, mercenaryCooldownSec))}</span>
            </div>
            <small>
              {mercenaryCooldownRemainingSec > 0
                ? `Další nábor možný za ${formatDurationLabel(mercenaryCooldownRemainingSec)} (${formatDateTimeLabel(mercenaries?.cooldownEndsAt)}).`
                : 'Cooldown je volný, nábor můžeš spustit ihned.'}
            </small>
          </li>
        </ul>

        {mercenaryContracts.length > 0 ? (
          <ul className="commands-list">
            {mercenaryContracts.map((contract) => (
              <li key={`mercenary-contract-${contract.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>
                    Kontrakt #{contract.id}
                    {contract.villageName ? ` · ${contract.villageName}` : ''}
                  </strong>
                  <span>
                    {resolveMercenaryContractStatusLabel(contract.status)} · +
                    {Math.max(0, Math.floor(Number(contract.unitAmount ?? 0))).toLocaleString('cs-CZ')} žoldáků
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
        {notice ? <p className="panel-feedback">{notice}</p> : null}
      </section>
    </div>
  );
};

const ResearchTreasuryTransferSection = ({
  market,
  resources,
  settlements,
  currentVillageId,
  currentUsername,
  logisticsActionPending,
  cancelLogisticsPendingId,
  notice,
  onSendMarketLogistics,
  onCancelMarketLogistics,
}: {
  market: GameStateResponse['market'] | undefined;
  resources: Pick<GameStateResponse['resources'], 'gold' | 'coins'> | undefined;
  settlements: RegionSettlement[];
  currentVillageId: number | null;
  currentUsername: string;
  logisticsActionPending: boolean;
  cancelLogisticsPendingId: number | null;
  notice: string | null;
  onSendMarketLogistics: (payload: {
    targetVillageId: number;
    wood: number;
    stone: number;
    iron: number;
    gold: number;
    coins: number;
  }) => void;
  onCancelMarketLogistics: (routeId: number) => void;
}) => {
  const [targetVillageId, setTargetVillageId] = useState<number | null>(null);
  const [transferDraft, setTransferDraft] = useState<{ gold: string; coins: string }>({
    gold: '',
    coins: '',
  });
  const marketLevel = Math.max(0, Math.floor(Number(market?.level ?? 0)));
  const marketCapacity = Math.max(0, Math.floor(Number(market?.capacity ?? 0)));
  const marketMaxDistance = Math.max(0, Math.floor(Number(market?.maxDistance ?? 0)));
  const treasuryRoutes = useMemo(
    () =>
      [...(market?.logisticsRoutes ?? [])]
        .filter(
          (route) =>
            Math.max(0, Math.floor(Number(route.gold ?? 0))) > 0 ||
            Math.max(0, Math.floor(Number(route.coins ?? 0))) > 0,
        )
        .sort((left, right) => left.remainingSec - right.remainingSec || left.id - right.id),
    [market?.logisticsRoutes],
  );
  const currentUsernameComparable = useMemo(
    () => String(currentUsername ?? '').toLocaleLowerCase('cs-CZ'),
    [currentUsername],
  );
  const logisticsTargets = useMemo(
    () =>
      settlements
        .filter((settlement) => {
          const villageId = Number(settlement.villageId ?? 0);
          if (!Number.isFinite(villageId) || villageId <= 0) {
            return false;
          }
          const ownerComparable = String(settlement.owner ?? '').toLocaleLowerCase('cs-CZ');
          const isOwnedSettlement =
            settlement.kind === 'own' ||
            settlement.relation === 'self' ||
            (currentUsernameComparable.length > 0 && ownerComparable === currentUsernameComparable);
          if (!isOwnedSettlement) {
            return false;
          }
          return currentVillageId == null || villageId !== Number(currentVillageId);
        })
        .sort((left, right) =>
          compareVillageLabelNatural(
            { name: left.name, coordX: left.globalX, coordY: left.globalY },
            { name: right.name, coordX: right.globalX, coordY: right.globalY },
          ),
        ),
    [currentUsernameComparable, currentVillageId, settlements],
  );
  const effectiveTargetVillageId = useMemo(() => {
    if (
      targetVillageId != null &&
      logisticsTargets.some((settlement) => Number(settlement.villageId) === Number(targetVillageId))
    ) {
      return Number(targetVillageId);
    }
    const fallbackVillageId = Number(logisticsTargets[0]?.villageId ?? 0);
    return Number.isFinite(fallbackVillageId) && fallbackVillageId > 0 ? fallbackVillageId : null;
  }, [targetVillageId, logisticsTargets]);
  const parseTransferAmount = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  };
  const transferGold = parseTransferAmount(transferDraft.gold);
  const transferCoins = parseTransferAmount(transferDraft.coins);
  const transferTotal = transferGold + transferCoins;
  const resolveTreasuryRouteStatusLabel = (statusRaw: string): string => {
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
    if (status === 'canceled') {
      return 'Zrušeno';
    }
    if (status === 'in_progress') {
      return 'Na cestě';
    }
    if (status === 'completed') {
      return 'Doručeno';
    }
    return statusRaw;
  };
  const resolveTreasuryRouteModeLabel = (modeRaw: string): string => {
    const mode = String(modeRaw ?? '').toLocaleLowerCase('cs-CZ');
    if (mode === 'guild-auto') {
      return 'Cech';
    }
    if (mode === 'manual') {
      return 'Ručně';
    }
    return modeRaw;
  };
  const selectedTargetSettlement =
    effectiveTargetVillageId == null
      ? null
      : logisticsTargets.find((settlement) => Number(settlement.villageId) === Number(effectiveTargetVillageId)) ?? null;
  const distanceTiles = useMemo(() => {
    if (!selectedTargetSettlement) {
      return null;
    }
    const originSettlement =
      currentVillageId == null
        ? null
        : settlements.find((settlement) => Number(settlement.villageId) === Number(currentVillageId)) ?? null;
    if (!originSettlement) {
      return null;
    }
    return Math.max(
      Math.abs(Number(originSettlement.globalX) - Number(selectedTargetSettlement.globalX)),
      Math.abs(Number(originSettlement.globalY) - Number(selectedTargetSettlement.globalY)),
    );
  }, [currentVillageId, selectedTargetSettlement, settlements]);
  const transferEtaSec =
    distanceTiles == null ? null : Math.max(60, Math.floor((10 + distanceTiles * 2) * 60));
  const transferWarnings: string[] = [];
  if (marketLevel > 0 && logisticsTargets.length <= 0) {
    transferWarnings.push('Pro převod nejsou dostupná žádná další vlastní léna.');
  }
  if (transferTotal > marketCapacity && marketLevel > 0) {
    transferWarnings.push(`Součet převodu překračuje kapacitu trhu (${marketCapacity.toLocaleString('cs-CZ')}).`);
  }
  if (transferGold > Number(resources?.gold ?? 0)) {
    transferWarnings.push('Nedostatek zlata.');
  }
  if (transferCoins > Number(resources?.coins ?? 0)) {
    transferWarnings.push('Nedostatek mincí.');
  }
  if (distanceTiles != null && marketMaxDistance > 0 && distanceTiles > marketMaxDistance) {
    transferWarnings.push(`Cíl je mimo dosah trhu (${marketMaxDistance} polí).`);
  }
  const canSendTransfer =
    marketLevel > 0 &&
    selectedTargetSettlement != null &&
    transferTotal > 0 &&
    transferWarnings.length === 0 &&
    !logisticsActionPending;

  return (
    <section>
      <h3>Pokladnice mezi lény</h3>
      <p className="row-help">
        Přesunuje zlato a mince z aktivního léna do jiného tvého léna přes stávající logistiku trhu.
      </p>
      <div className="commands-kpi-strip">
        <article>
          <span>Úroveň trhu</span>
          <strong className="commands-kpi-value tld-type-value">{marketLevel.toLocaleString('cs-CZ')}</strong>
        </article>
        <article>
          <span>Kapacita převodu</span>
          <strong className="commands-kpi-value tld-type-value">{marketCapacity.toLocaleString('cs-CZ')}</strong>
        </article>
        <article>
          <span>Zlato v lénu</span>
          <strong className="commands-kpi-value tld-type-value">
            {Math.max(0, Math.floor(Number(resources?.gold ?? 0))).toLocaleString('cs-CZ')}
          </strong>
        </article>
        <article>
          <span>Mince v lénu</span>
          <strong className="commands-kpi-value tld-type-value">
            {Math.max(0, Math.floor(Number(resources?.coins ?? 0))).toLocaleString('cs-CZ')}
          </strong>
        </article>
      </div>
      {marketLevel > 0 ? (
        <div className="research-logistics-form">
          <label>
            Cílové léno
            <select
              value={effectiveTargetVillageId == null ? '' : String(effectiveTargetVillageId)}
              onChange={(event) => {
                const value = String(event.target.value ?? '').trim();
                setTargetVillageId(value ? Number(value) : null);
              }}
              disabled={logisticsActionPending || logisticsTargets.length === 0}
            >
              <option value="">-</option>
              {logisticsTargets.map((settlement) => (
                <option key={`research-treasury-target-${settlement.id}`} value={settlement.villageId}>
                  {settlement.name} ({settlement.globalX}|{settlement.globalY})
                </option>
              ))}
            </select>
          </label>
          <div className="research-logistics-grid">
            <label>
              🪙 Zlato
              <input
                type="number"
                min={0}
                step={100}
                value={transferDraft.gold}
                onChange={(event) =>
                  setTransferDraft((previous) => ({
                    ...previous,
                    gold: event.target.value,
                  }))
                }
                disabled={logisticsActionPending}
              />
            </label>
            <label>
              💰 Mince
              <input
                type="number"
                min={0}
                step={100}
                value={transferDraft.coins}
                onChange={(event) =>
                  setTransferDraft((previous) => ({
                    ...previous,
                    coins: event.target.value,
                  }))
                }
                disabled={logisticsActionPending}
              />
            </label>
          </div>
          <div className="army-command-preview">
            <p className="army-command-preview-target">
              Cíl:{' '}
              <strong className="army-command-inline-value tld-type-value">
                {selectedTargetSettlement
                  ? `${selectedTargetSettlement.name} (${selectedTargetSettlement.globalX}|${selectedTargetSettlement.globalY})`
                  : '-'}
              </strong>{' '}
              · ETA:{' '}
              <strong className="army-command-inline-value tld-type-value">
                {transferEtaSec == null ? '-' : formatDurationLabel(transferEtaSec)}
              </strong>
            </p>
            <p>
              Součet převodu:{' '}
              <strong className="army-command-inline-value tld-type-value">{transferTotal.toLocaleString('cs-CZ')}</strong> /{' '}
              <strong className="army-command-inline-value tld-type-value">{marketCapacity.toLocaleString('cs-CZ')}</strong>
            </p>
          </div>
          {transferWarnings.map((warning) => (
            <p key={`research-treasury-warning-${warning}`} className="panel-feedback is-danger">
              {warning}
            </p>
          ))}
          <div className="research-panel-inline-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                if (selectedTargetSettlement == null) {
                  return;
                }
                onSendMarketLogistics({
                  targetVillageId: Number(selectedTargetSettlement.villageId ?? 0),
                  wood: 0,
                  stone: 0,
                  iron: 0,
                  gold: transferGold,
                  coins: transferCoins,
                });
              }}
              disabled={!canSendTransfer}
            >
              {logisticsActionPending ? 'Odesílám převod...' : 'Poslat zlato a mince'}
            </button>
          </div>
        </div>
      ) : (
        <p>Postav Městský trh alespoň na úroveň 1, potom lze převádět zlato a mince mezi lény.</p>
      )}
      {treasuryRoutes.length > 0 ? (
        <ul className="commands-list">
          {treasuryRoutes.map((route) => {
            const isCancelPending = cancelLogisticsPendingId === Number(route.id);
            return (
              <li key={`research-treasury-route-${route.id}`} className="commands-item">
                <div className="commands-item-line">
                  <strong>
                    {route.sourceVillageName} → {route.targetVillageName}
                  </strong>
                  <span>
                    {resolveTreasuryRouteStatusLabel(route.status)} · {resolveTreasuryRouteModeLabel(route.mode)}
                  </span>
                </div>
                <small>
                  ETA {formatDurationLabel(Math.max(0, Math.floor(Number(route.remainingSec ?? 0)) ?? 0))} · dorazí{' '}
                  {formatDateTimeLabel(route.arriveAt)} · 🪙{' '}
                  {Math.max(0, Math.floor(Number(route.gold ?? 0))).toLocaleString('cs-CZ')} · 💰{' '}
                  {Math.max(0, Math.floor(Number(route.coins ?? 0))).toLocaleString('cs-CZ')}
                </small>
                {String(route.status ?? '').toLocaleLowerCase('cs-CZ') === 'in_progress' ? (
                  <div className="research-panel-inline-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onCancelMarketLogistics(route.id)}
                      disabled={isCancelPending || logisticsActionPending}
                    >
                      {isCancelPending ? 'Ruším převod...' : 'Zrušit převod'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="row-help">Žádné aktivní převody zlata nebo mincí z tohoto trhu.</p>
      )}
      {notice ? <p className="panel-feedback">{notice}</p> : null}
    </section>
  );
};

const ResearchPanel = ({
  research,
  rules,
  market,
  resources,
  settlements,
  currentVillageId,
  currentUsername,
  notice,
  logisticsNotice,
  researchActionPending,
  logisticsActionPending,
  cancelLogisticsPendingId,
  onHireAcademics,
  onAdjustResearchAcademics,
  onStartResearchProject,
  onSendMarketLogistics,
  onCancelMarketLogistics,
}: {
  research: GameStateResponse['research'] | undefined;
  rules: GameStateResponse['rules'] | undefined;
  market: GameStateResponse['market'] | undefined;
  resources:
    | Pick<GameStateResponse['resources'], 'coins' | 'gold' | 'productionPerHour' | 'protection'>
    | undefined;
  settlements: RegionSettlement[];
  currentVillageId: number | null;
  currentUsername: string;
  notice: string | null;
  logisticsNotice: string | null;
  researchActionPending: boolean;
  logisticsActionPending: boolean;
  cancelLogisticsPendingId: number | null;
  onHireAcademics: (amount: number) => Promise<boolean>;
  onAdjustResearchAcademics: (researchId: string, delta: number) => Promise<boolean>;
  onStartResearchProject: (researchId: string, academics: number) => void;
  onSendMarketLogistics: (payload: {
    targetVillageId: number;
    wood: number;
    stone: number;
    iron: number;
    gold: number;
    coins: number;
  }) => void;
  onCancelMarketLogistics: (routeId: number) => void;
}) => {
  const projects = useMemo(() => research?.projects ?? [], [research?.projects]);
  const [isHireImpactActive, setIsHireImpactActive] = useState(false);
  const [hoveredResearchProjectId, setHoveredResearchProjectId] = useState<string | null>(null);
  const [researchTooltipCursorPosition, setResearchTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const [projectAcademicDrafts, setProjectAcademicDrafts] = useState<Record<string, string>>({});

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'researching'),
    [projects],
  );
  const activeProject = activeProjects[0] ?? null;
  const activeProjectsSummary = useMemo(() => {
    if (activeProjects.length <= 0) {
      return '';
    }
    const visibleNames = activeProjects.slice(0, 2).map((project) => project.name);
    const overflowCount = Math.max(0, activeProjects.length - visibleNames.length);
    return overflowCount > 0 ? `${visibleNames.join(', ')} +${overflowCount}` : visibleNames.join(', ');
  }, [activeProjects]);
  const availableProjects = useMemo(
    () => projects.filter((project) => project.status === 'available'),
    [projects],
  );
  const parseDraftAmount = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  };

  const totalAcademics = Math.max(0, Math.floor(Number(research?.totalAcademics ?? 0)));
  const idleAcademics = Math.max(0, Math.floor(Number(research?.idleAcademics ?? 0)));
  const regionAcademicCapacity = Math.max(
    0,
    Math.floor(Number(research?.regionAcademicCapacity ?? totalAcademics)),
  );
  const regionAcademicAvailableSlots = Math.max(
    0,
    Math.floor(
      Number(
        research?.regionAcademicAvailableSlots ??
          Math.max(0, regionAcademicCapacity - totalAcademics),
      ),
    ),
  );
  const villageAcademics = Math.max(0, Math.floor(Number(research?.villageAcademics ?? 0)));
  const villageAcademicCapacity = Math.max(0, Math.floor(Number(research?.villageAcademicCapacity ?? 0)));
  const canHireSingleAcademic =
    !researchActionPending &&
    regionAcademicAvailableSlots > 0 &&
    Number(resources?.coins ?? 0) >= ACADEMIC_HIRE_COIN_COST;
  const isRegionAcademicLimitReached = regionAcademicCapacity > 0 && regionAcademicAvailableSlots <= 0;
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
          <div className={`research-command-stat ${activeProjects.length > 0 ? 'is-live' : 'is-danger'}`}>
            <span>Aktivní projekty</span>
            <strong>
              {activeProjects.length > 0
                ? `${activeProjects.length.toLocaleString('cs-CZ')} běží`
                : 'Žádný aktivní výzkum'}
            </strong>
            <small>
              {activeProjects.length > 0
                ? `${Math.round(activeProjectProgressPercent).toLocaleString('cs-CZ')} % · ${activeProjectsSummary}`
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
            region {totalAcademics.toLocaleString('cs-CZ')} / {regionAcademicCapacity.toLocaleString('cs-CZ')} ·
            Univerzita: 1 úroveň = 1 akademik (max 3 na léno)
          </small>
          {isRegionAcademicLimitReached ? (
            <p className="research-hire-limit-warning">Regionální kapacita akademiků je vyčerpaná</p>
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
          {projects.length > 0 && availableProjects.length === 0 && activeProjects.length <= 0 ? (
            <p className="row-help">Všechny dostupné projekty jsou hotové nebo uzamčené.</p>
          ) : null}
        </div>
      </section>

      <ResearchTreasuryTransferSection
        market={market}
        resources={resources}
        settlements={settlements}
        currentVillageId={currentVillageId}
        currentUsername={currentUsername}
        logisticsActionPending={logisticsActionPending}
        cancelLogisticsPendingId={cancelLogisticsPendingId}
        notice={logisticsNotice}
        onSendMarketLogistics={onSendMarketLogistics}
        onCancelMarketLogistics={onCancelMarketLogistics}
      />

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
          normalizeBattleAmount(payload.lootTaken.iron) > 0 ||
          normalizeBattleAmount(payload.lootTaken.gold) > 0 ||
          normalizeBattleAmount(payload.lootTaken.coins) > 0)),
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
              Start: <span className="battle-army-kpi-value tld-type-value">{startTotal.toLocaleString('cs-CZ')}</span>
            </span>
            <span>
              Ztráty: <span className="battle-army-kpi-value tld-type-value">{lossesTotal.toLocaleString('cs-CZ')}</span>
            </span>
            <span>
              Přežilo: <span className="battle-army-kpi-value tld-type-value">{survivorsTotal.toLocaleString('cs-CZ')}</span>
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

const BattleReportPanel = ({
  report,
  loading = false,
}: {
  report: BattleReportItem | null;
  loading?: boolean;
}) => {
  if (!report) {
    return (
      <div className="panel-stack battle-report-view">
        <section>
          <h3>{loading ? 'Načítám bitevní hlášení' : 'Bitevní hlášení není dostupné'}</h3>
          <p>
            {loading
              ? 'Report se právě načítá.'
              : 'Report se nenačetl. Otevři panel Zprávy a obnov seznam.'}
          </p>
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
  const lootGold = normalizeBattleAmount(lootTaken?.gold);
  const lootCoins = normalizeBattleAmount(lootTaken?.coins);
  const totalLoot = lootWood + lootStone + lootIron + lootGold + lootCoins;
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
            Čas střetu:{' '}
            <strong className="battle-report-meta-value tld-type-heading">
              {new Date(report.battleAt).toLocaleString('cs-CZ')}
            </strong>
          </span>
          <span>
            Útočník: <strong className="battle-report-meta-value tld-type-heading">{attackerName}</strong>
          </span>
          <span>
            Obránce: <strong className="battle-report-meta-value tld-type-heading">{defenderName}</strong>
          </span>
          <span>
            Trasa:{' '}
            <strong className="battle-report-meta-value tld-type-heading">
              {payload.originVillageName ?? 'Neznámý původ'} → {payload.targetVillageName ?? 'Neznámý cíl'}
            </strong>
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
            <strong className="battle-power-value tld-type-stat">{attackerScoutStart.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Ztráty zvědů</span>
            <strong className="battle-power-value tld-type-stat">{attackerScoutLosses.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Přežilo zvědů</span>
            <strong className="battle-power-value tld-type-stat">{attackerScoutSurvivors.toLocaleString('cs-CZ')}</strong>
              </article>
              <article>
                <span>Obranní zvědi v osadě</span>
            <strong className="battle-power-value tld-type-stat">{defenderScoutCount.toLocaleString('cs-CZ')}</strong>
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
                  Návrat:{' '}
                  <strong className="battle-return-inline-value tld-type-value">
                    {returnMovement.fromVillageName ?? 'Cíl'} → {returnMovement.toVillageName ?? 'Domov'}
                  </strong>{' '}
                  · ETA{' '}
                  <strong className="battle-return-inline-value tld-type-value">
                    {new Date(returnMovement.arriveAt ?? report.createdAt).toLocaleString('cs-CZ')}
                  </strong>{' '}
                  · trvání <strong className="battle-return-inline-value tld-type-value">{formatDurationLabel(returnMovement.durationSec ?? null)}</strong>
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
                  <strong className="battle-power-value tld-type-stat">
                    {formatBattlePower(battle?.baseAttackPower)} / {formatBattlePower(battle?.baseDefensePower)}
                  </strong>
                </article>
                <article>
                  <span>Finální útok/obrana</span>
                  <strong className="battle-power-value tld-type-stat">
                    {formatBattlePower(battle?.finalAttackPower)} / {formatBattlePower(battle?.finalDefensePower)}
                  </strong>
                </article>
                <article>
                  <span>Multiplikátor útok/obrana</span>
                  <strong className="battle-power-value tld-type-stat">
                    {formatBattleMultiplier(battle?.attackMultiplier)} / {formatBattleMultiplier(battle?.defenseMultiplier)}
                  </strong>
                </article>
                <article>
                  <span>Ztráty útok/obrana</span>
                  <strong className="battle-power-value tld-type-stat">
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
                  Návrat:{' '}
                  <strong className="battle-return-inline-value tld-type-value">
                    {returnMovement.fromVillageName ?? 'Cíl'} → {returnMovement.toVillageName ?? 'Domov'}
                  </strong>{' '}
                  · ETA{' '}
                  <strong className="battle-return-inline-value tld-type-value">
                    {new Date(returnMovement.arriveAt ?? report.createdAt).toLocaleString('cs-CZ')}
                  </strong> ·{' '}
                  trvání <strong className="battle-return-inline-value tld-type-value">{formatDurationLabel(returnMovement.durationSec ?? null)}</strong>
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
                Dřevo <span className="battle-loot-value tld-type-value">{lootWood.toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                Kámen <span className="battle-loot-value tld-type-value">{lootStone.toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                Železo <span className="battle-loot-value tld-type-value">{lootIron.toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                Zlato <span className="battle-loot-value tld-type-value">{lootGold.toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                Mince <span className="battle-loot-value tld-type-value">{lootCoins.toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                Celkem <span className="battle-loot-value tld-type-value">{totalLoot.toLocaleString('cs-CZ')}</span>
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
                  <strong className="battle-debug-value tld-type-value">{row.value}</strong>
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
            <strong className="messages-signal-value tld-type-value">{warNoticeCount.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className={`messages-signal-chip ${communicationUnreadCount > 0 ? 'is-active' : 'is-idle'}`}>
            <span className="messages-signal-icon" aria-hidden="true">
              ✉
            </span>
            <div>
              <p>Komunikace</p>
              <small>zprávy od hráčů</small>
            </div>
            <strong className="messages-signal-value tld-type-value">
              {communicationUnreadCount.toLocaleString('cs-CZ')}
            </strong>
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
                    <strong className="messages-report-title tld-type-heading">Pozvánka do království {invite.kingdom}</strong>
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
                  <strong className="messages-report-title tld-type-heading">{report.title}</strong>
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
              Pozvánku poslal hráč <strong className="messages-detail-inline-value tld-type-heading">{selectedInvite.inviterUsername}</strong>.
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
              Útočník:{' '}
              <strong className="messages-detail-inline-value tld-type-heading">{selectedReport.payload.attacker ?? 'Neznámý'}</strong> · Obránce:{' '}
              <strong className="messages-detail-inline-value tld-type-heading">{selectedReport.payload.defender ?? 'Neznámý'}</strong>
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
  onRebaseSupport,
  isArmyCommandPending,
  logisticsActionPending,
  guildActionPending,
  cancelLogisticsPendingId,
  cancelCommandProgressLimit,
  commandNotice,
  onSendMarketLogistics,
  onCancelMarketLogistics,
  onConfigureMarketGuildAutomation,
  onOpenSettlementByVillageId,
}: {
  activeMovements: ArmyMovementState[];
  incomingMovements: ArmyMovementState[];
  stationedSupports: ArmyMovementState[];
  units: Unit[];
  settlements: RegionSettlement[];
  market: GameStateResponse['market'] | undefined;
  resources: Pick<GameStateResponse['resources'], 'wood' | 'stone' | 'iron' | 'gold' | 'coins'> | undefined;
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
  onRebaseSupport: (supportMovementId: number) => void;
  isArmyCommandPending: boolean;
  logisticsActionPending: boolean;
  guildActionPending: boolean;
  cancelLogisticsPendingId: number | null;
  cancelCommandProgressLimit: number | null | undefined;
  commandNotice: string | null;
  onSendMarketLogistics: (payload: {
    targetVillageId: number;
    wood: number;
    stone: number;
    iron: number;
    gold: number;
    coins: number;
  }) => void;
  onCancelMarketLogistics: (routeId: number) => void;
  onConfigureMarketGuildAutomation: (payload: {
    enabled: boolean;
    targetVillageIds: number[];
    pausedTargetVillageIds: number[];
  }) => Promise<boolean>;
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
  const resolvedCancelCommandProgressLimit = resolveCancelCommandProgressLimit(cancelCommandProgressLimit);
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
  const [logisticsDraft, setLogisticsDraft] = useState<{
    wood: string;
    stone: string;
    iron: string;
    gold: string;
    coins: string;
  }>({
    wood: '',
    stone: '',
    iron: '',
    gold: '',
    coins: '',
  });
  const [guildAddVillageIdDraft, setGuildAddVillageIdDraft] = useState('');
  const [draggedGuildTargetVillageId, setDraggedGuildTargetVillageId] = useState<number | null>(null);
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
  const currentUsernameComparable = useMemo(
    () => String(currentUsername ?? '').toLocaleLowerCase('cs-CZ'),
    [currentUsername],
  );
  const logisticsTargets = useMemo(
    () =>
      settlements
        .filter((settlement) => {
          const villageId = Number(settlement.villageId ?? 0);
          if (!Number.isFinite(villageId) || villageId <= 0) {
            return false;
          }
          const ownerComparable = String(settlement.owner ?? '').toLocaleLowerCase('cs-CZ');
          const isOwnedSettlement =
            settlement.kind === 'own' ||
            settlement.relation === 'self' ||
            (currentUsernameComparable.length > 0 && ownerComparable === currentUsernameComparable);
          if (!isOwnedSettlement) {
            return false;
          }
          return currentVillageId == null || villageId !== Number(currentVillageId);
        })
        .sort((left, right) =>
          compareVillageLabelNatural(
            { name: left.name, coordX: left.globalX, coordY: left.globalY },
            { name: right.name, coordX: right.globalX, coordY: right.globalY },
          ),
        ),
    [currentUsernameComparable, currentVillageId, settlements],
  );
  const effectiveLogisticsTargetVillageId = useMemo(() => {
    if (
      logisticsTargetVillageId != null &&
      logisticsTargets.some((settlement) => Number(settlement.villageId) === Number(logisticsTargetVillageId))
    ) {
      return Number(logisticsTargetVillageId);
    }
    const fallbackVillageId = Number(logisticsTargets[0]?.villageId ?? 0);
    return Number.isFinite(fallbackVillageId) && fallbackVillageId > 0 ? fallbackVillageId : null;
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
  const logisticsGold = parseLogisticsAmount(logisticsDraft.gold);
  const logisticsCoins = parseLogisticsAmount(logisticsDraft.coins);
  const logisticsTotal = logisticsWood + logisticsStone + logisticsIron + logisticsGold + logisticsCoins;
  const selectedLogisticsSettlement =
    effectiveLogisticsTargetVillageId == null
      ? null
      : logisticsTargets.find(
          (settlement) => Number(settlement.villageId) === Number(effectiveLogisticsTargetVillageId),
        ) ?? null;
  const manualLogisticsCoordinates = parseCoordinateDraft(manualLogisticsTargetDraft);
  const manualLogisticsSettlement = manualLogisticsCoordinates
    ? logisticsTargets.find(
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
    logisticsWarnings.push('Na zadaných souřadnicích nebylo nalezeno žádné tvoje léno.');
  }
  if (marketLevel > 0 && logisticsTargets.length <= 0) {
    logisticsWarnings.push('Pro logistiku nejsou dostupná žádná další vlastní léna.');
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
  if (logisticsGold > Number(resources?.gold ?? 0)) {
    logisticsWarnings.push('Nedostatek zlata.');
  }
  if (logisticsCoins > Number(resources?.coins ?? 0)) {
    logisticsWarnings.push('Nedostatek mincí.');
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
  const guildAutomation = market?.guildAutomation;
  const guildEnabledDraft = Boolean(guildAutomation?.enabled ?? false);
  const guildTargetVillageIdsDraft = useMemo(
    () => (guildAutomation?.targets ?? []).map((target) => Number(target.targetVillageId)),
    [guildAutomation?.targets],
  );
  const guildPausedTargetVillageIdsDraft = useMemo(
    () =>
      (guildAutomation?.targets ?? [])
        .filter((target) => target.isPaused === true)
        .map((target) => Number(target.targetVillageId)),
    [guildAutomation?.targets],
  );
  const guildPausedTargetVillageIdSet = useMemo(
    () => new Set(guildPausedTargetVillageIdsDraft.map((targetVillageId) => Number(targetVillageId))),
    [guildPausedTargetVillageIdsDraft],
  );
  const guildTargetsByVillageId = useMemo(
    () =>
      new Map(
        (guildAutomation?.targets ?? []).map((target) => [Number(target.targetVillageId), target]),
      ),
    [guildAutomation?.targets],
  );
  const guildTargetRows = useMemo(
    () =>
      guildTargetVillageIdsDraft
        .map((targetVillageId) => guildTargetsByVillageId.get(Number(targetVillageId)) ?? null)
        .filter((target): target is NonNullable<typeof target> => target != null),
    [guildTargetVillageIdsDraft, guildTargetsByVillageId],
  );
  const guildOwnVillageCandidates = useMemo(() => {
    const excluded = new Set(guildTargetVillageIdsDraft.map((targetVillageId) => Number(targetVillageId)));
    const apiCandidates = guildAutomation?.ownVillages ?? [];
    const normalizedUsername = String(currentUsername ?? '').trim().toLocaleLowerCase('cs-CZ');
    const sourceVillageId = Number(currentVillageId ?? 0);

    const fallbackCandidatesByVillageId = new Map<number, MarketGuildVillageEconomyState>();
    for (const settlement of settlements) {
      const villageId = Number(settlement.villageId ?? 0);
      if (!Number.isFinite(villageId) || villageId <= 0) {
        continue;
      }
      if (sourceVillageId > 0 && villageId === sourceVillageId) {
        continue;
      }
      const ownerUsername = String(settlement.owner ?? '').trim().toLocaleLowerCase('cs-CZ');
      const isOwnSettlement =
        settlement.kind === 'own' || settlement.relation === 'self' || (normalizedUsername.length > 0 && ownerUsername === normalizedUsername);
      if (!isOwnSettlement) {
        continue;
      }
      fallbackCandidatesByVillageId.set(villageId, {
        villageId,
        name: String(settlement.name ?? `Léno ${villageId}`),
        coordX: Number(settlement.globalX ?? 0),
        coordY: Number(settlement.globalY ?? 0),
        marketLevel: 0,
        cap: 0,
        resources: {
          wood: 0,
          stone: 0,
          iron: 0,
        },
        totalResources: 0,
        fillPct: 0,
        merchants: {
          total: 0,
          inUse: 0,
          available: 0,
        },
      });
    }

    const baseCandidates =
      apiCandidates.length > 0
        ? apiCandidates
        : [...fallbackCandidatesByVillageId.values()].sort((left, right) =>
            compareVillageLabelNatural(
              { name: String(left.name ?? ''), coordX: Number(left.coordX ?? 0), coordY: Number(left.coordY ?? 0) },
              {
                name: String(right.name ?? ''),
                coordX: Number(right.coordX ?? 0),
                coordY: Number(right.coordY ?? 0),
              },
            ),
          );

    return baseCandidates.filter((village) => !excluded.has(Number(village.villageId)));
  }, [currentUsername, currentVillageId, guildAutomation?.ownVillages, guildTargetVillageIdsDraft, settlements]);
  const guildAuditEntries = useMemo(
    () => (guildAutomation?.auditLog ?? []).slice(0, 12),
    [guildAutomation?.auditLog],
  );
  const resolvedGuildAddVillageIdDraft = guildOwnVillageCandidates.some(
    (candidate) => Number(candidate.villageId) === Number(guildAddVillageIdDraft),
  )
    ? guildAddVillageIdDraft
    : guildOwnVillageCandidates.length > 0
      ? String(guildOwnVillageCandidates[0].villageId)
      : '';
  const guildPausedTargetCount = useMemo(
    () => guildTargetRows.filter((target) => target.isPaused === true).length,
    [guildTargetRows],
  );
  const guildActiveTargetCount = Math.max(0, guildTargetRows.length - guildPausedTargetCount);

  const applyGuildConfiguration = useCallback(
    (
      nextEnabled: boolean,
      nextTargetVillageIds: number[],
      nextPausedTargetVillageIds: number[] = guildPausedTargetVillageIdsDraft,
    ) => {
      const targetIdSet = new Set(nextTargetVillageIds.map((targetVillageId) => Number(targetVillageId)));
      const normalizedPausedTargetVillageIds = nextPausedTargetVillageIds
        .map((targetVillageId) => Number(targetVillageId))
        .filter((targetVillageId, index, array) => {
          if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
            return false;
          }
          if (!targetIdSet.has(targetVillageId)) {
            return false;
          }
          return array.indexOf(targetVillageId) === index;
        });
      void onConfigureMarketGuildAutomation({
        enabled: nextEnabled,
        targetVillageIds: nextTargetVillageIds,
        pausedTargetVillageIds: normalizedPausedTargetVillageIds,
      });
    },
    [guildPausedTargetVillageIdsDraft, onConfigureMarketGuildAutomation],
  );

  const handleGuildAddTarget = () => {
    const targetVillageId = Number(resolvedGuildAddVillageIdDraft);
    if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
      return;
    }
    if (guildTargetVillageIdsDraft.includes(targetVillageId)) {
      return;
    }
    applyGuildConfiguration(
      guildEnabledDraft,
      [...guildTargetVillageIdsDraft, targetVillageId],
      guildPausedTargetVillageIdsDraft,
    );
    setGuildAddVillageIdDraft('');
  };

  const handleGuildRemoveTarget = (targetVillageIdRaw: number) => {
    const targetVillageId = Number(targetVillageIdRaw);
    const nextTargetVillageIds = guildTargetVillageIdsDraft.filter(
      (entry) => Number(entry) !== targetVillageId,
    );
    const nextPausedTargetVillageIds = guildPausedTargetVillageIdsDraft.filter(
      (entry) => Number(entry) !== targetVillageId,
    );
    applyGuildConfiguration(guildEnabledDraft, nextTargetVillageIds, nextPausedTargetVillageIds);
  };

  const handleGuildTogglePauseTarget = (targetVillageIdRaw: number) => {
    const targetVillageId = Number(targetVillageIdRaw);
    if (!Number.isFinite(targetVillageId) || targetVillageId <= 0) {
      return;
    }
    const isPaused = guildPausedTargetVillageIdSet.has(targetVillageId);
    const nextPausedTargetVillageIds = isPaused
      ? guildPausedTargetVillageIdsDraft.filter((entry) => Number(entry) !== targetVillageId)
      : [...guildPausedTargetVillageIdsDraft, targetVillageId];
    applyGuildConfiguration(guildEnabledDraft, guildTargetVillageIdsDraft, nextPausedTargetVillageIds);
  };

  const handleGuildDropTarget = (targetVillageIdRaw: number) => {
    const dropTargetVillageId = Number(targetVillageIdRaw);
    const draggedVillageId = Number(draggedGuildTargetVillageId);
    setDraggedGuildTargetVillageId(null);
    if (!Number.isFinite(dropTargetVillageId) || !Number.isFinite(draggedVillageId)) {
      return;
    }
    if (dropTargetVillageId === draggedVillageId) {
      return;
    }
    const previous = [...guildTargetVillageIdsDraft];
    const draggedIndex = previous.findIndex((entry) => Number(entry) === draggedVillageId);
    const dropIndex = previous.findIndex((entry) => Number(entry) === dropTargetVillageId);
    if (draggedIndex < 0 || dropIndex < 0) {
      return;
    }
    previous.splice(draggedIndex, 1);
    previous.splice(dropIndex, 0, draggedVillageId);
    applyGuildConfiguration(guildEnabledDraft, previous, guildPausedTargetVillageIdsDraft);
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

  const resolveRouteModeLabel = (modeRaw: string): string => {
    const mode = String(modeRaw ?? '').toLocaleLowerCase('cs-CZ');
    if (mode === 'guild-auto') {
      return 'Cech';
    }
    if (mode === 'manual') {
      return 'Ručně';
    }
    return modeRaw;
  };

  return (
    <div className="panel-stack commands-panel">
      <section>
        <h3>Prioritní hrozby</h3>
        <div className="commands-kpi-strip">
          <article className={incomingAttackCount > 0 ? 'is-danger' : ''}>
            <span>Příchozí útoky</span>
            <strong className="commands-kpi-value tld-type-value">{incomingAttackCount.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Příchozí rozkazy celkem</span>
            <strong className="commands-kpi-value tld-type-value">{sortedIncoming.length.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Odchozí rozkazy</span>
            <strong className="commands-kpi-value tld-type-value">{sortedOutgoing.length.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Návraty armád</span>
            <strong className="commands-kpi-value tld-type-value">{sortedReturns.length.toLocaleString('cs-CZ')}</strong>
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
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleApplyHistoryTarget(historyItem);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
            <strong className="army-command-inline-value tld-type-value">
              {effectiveTargetSettlement
                ? `${effectiveTargetSettlement.name} (${effectiveTargetSettlement.globalX}|${effectiveTargetSettlement.globalY})`
                : '-'}
            </strong>
            {' · '}
            ETA: <strong className="army-command-inline-value tld-type-value">{selectedTargetEtaLabel}</strong>
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
              <span className="army-order-preview-metric-value tld-type-value">{selectedCommandUnitCount.toLocaleString('cs-CZ')}</span>
            </article>
            {commandType === 'attack' ? (
              <>
                <article>
                  <span>Síla útoku</span>
                  <span className="army-order-preview-metric-value tld-type-value">{attackPowerWithBonuses.toLocaleString('cs-CZ')}</span>
                  {hasRamAttackBonus ? <small>včetně +10 % bonusu beranidel bez brány</small> : null}
                </article>
                <article>
                  <span>Kapacita kořisti</span>
                  <span className="army-order-preview-metric-value tld-type-value">{lootCapacity.toLocaleString('cs-CZ')} surovin</span>
                  <small>bez zvědů a beranidel</small>
                </article>
              </>
            ) : (
              <article>
                <span>Síla obrany výpravy</span>
                <span className="army-order-preview-metric-value tld-type-value">{baseDefensePower.toLocaleString('cs-CZ')}</span>
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
              const cancelMeta = resolveMovementCancelMeta(movement, resolvedCancelCommandProgressLimit);
              const cancelLimitLabel = cancelMeta.limitPct.toLocaleString('cs-CZ');
              const cancelProgressLabel = cancelMeta.progressPct.toLocaleString('cs-CZ');
              const isCancelDisabled = isArmyCommandPending || !cancelMeta.canCancel;
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
                    Jednotky: {unitsTotal.toLocaleString('cs-CZ')} · ETA {formatDurationLabel(movement.remainingSec)} · Postup{' '}
                    {cancelProgressLabel} % / limit {cancelLimitLabel} %
                  </small>
                  {movement.commandType === 'attack' ||
                  movement.commandType === 'support' ||
                  movement.commandType === 'move' ? (
                    <div className="activity-item-actions">
                      <CommandCancelAction
                        disabled={isCancelDisabled}
                        pending={isArmyCommandPending}
                        actionLabel={`Zrušit tento rozkaz (do ${cancelLimitLabel} % cesty)`}
                        disabledReason={`Limit zrušení ${cancelLimitLabel} % byl překročen (${cancelProgressLabel} %).`}
                        onClick={() => onCancelArmyCommand(movement.id)}
                      />
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
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onRebaseSupport(movement.id)}
                      disabled={isArmyCommandPending}
                      title="Převede stacionovanou podporu na domovské jednotky cílového léna."
                    >
                      Převést na přesun
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
        <p>Přesunuto do panelu Správa lén, aby bylo plánování staveb na jednom místě.</p>
      </section>

      <section>
        <h3>Trh a logistika</h3>
        <div className="commands-kpi-strip">
          <article>
            <span>Úroveň trhu</span>
            <strong className="commands-kpi-value tld-type-value">{marketLevel.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Kapacita zásilky</span>
            <strong className="commands-kpi-value tld-type-value">{marketCapacity.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Max. vzdálenost</span>
            <strong className="commands-kpi-value tld-type-value">{marketMaxDistance.toLocaleString('cs-CZ')} polí</strong>
          </article>
          <article
            className={
              Number(market?.merchants?.total ?? 0) > 0 && Number(market?.merchants?.available ?? 0) <= 0
                ? 'is-danger'
                : ''
            }
          >
            <span>Obchodníci</span>
            <strong className="commands-kpi-value tld-type-value">
              {Math.max(0, Math.floor(Number(market?.merchants?.available ?? 0))).toLocaleString('cs-CZ')} /{' '}
              {Math.max(0, Math.floor(Number(market?.merchants?.total ?? 0))).toLocaleString('cs-CZ')}
            </strong>
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
                value={effectiveLogisticsTargetVillageId == null ? '' : String(effectiveLogisticsTargetVillageId)}
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
              <label>
                🪙 Zlato
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={logisticsDraft.gold}
                  onChange={(event) =>
                    setLogisticsDraft((previous) => ({
                      ...previous,
                      gold: event.target.value,
                    }))
                  }
                  disabled={logisticsActionPending}
                />
              </label>
              <label>
                💰 Mince
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={logisticsDraft.coins}
                  onChange={(event) =>
                    setLogisticsDraft((previous) => ({
                      ...previous,
                      coins: event.target.value,
                    }))
                  }
                  disabled={logisticsActionPending}
                />
              </label>
            </div>
            <div className="army-command-preview">
              <p className="army-command-preview-target">
                Cíl:{' '}
                <strong className="army-command-inline-value tld-type-value">
                  {effectiveLogisticsSettlement
                    ? `${effectiveLogisticsSettlement.name} (${effectiveLogisticsSettlement.globalX}|${effectiveLogisticsSettlement.globalY})`
                    : '-'}
                </strong>{' '}
                · ETA:{' '}
                <strong className="army-command-inline-value tld-type-value">
                  {logisticsEtaSec == null ? '-' : formatDurationLabel(logisticsEtaSec)}
                </strong>
              </p>
              <p>
                Součet zásilky:{' '}
                <strong className="army-command-inline-value tld-type-value">{logisticsTotal.toLocaleString('cs-CZ')}</strong> /{' '}
                <strong className="army-command-inline-value tld-type-value">{marketCapacity.toLocaleString('cs-CZ')}</strong>
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
                    gold: logisticsGold,
                    coins: logisticsCoins,
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
            {logisticsRoutes.map((route) => {
              const routeStatus = String(route.status ?? '').toLocaleLowerCase('cs-CZ');
              const isInProgress = routeStatus === 'in_progress';
              const isCancelPending = cancelLogisticsPendingId === Number(route.id);
              return (
                <li key={`logistics-route-${route.id}`} className="commands-item">
                  <div className="commands-item-line">
                    <strong>
                      {route.sourceVillageName} → {route.targetVillageName}
                    </strong>
                    <span>
                      {resolveRouteStatusLabel(route.status)} · {resolveRouteModeLabel(route.mode)}
                    </span>
                  </div>
                  <small>
                    🌲 {Math.max(0, Math.floor(Number(route.wood))).toLocaleString('cs-CZ')} · 🧱{' '}
                    {Math.max(0, Math.floor(Number(route.stone))).toLocaleString('cs-CZ')} · ⛓{' '}
                    {Math.max(0, Math.floor(Number(route.iron))).toLocaleString('cs-CZ')} · 🪙{' '}
                    {Math.max(0, Math.floor(Number(route.gold ?? 0))).toLocaleString('cs-CZ')} · 💰{' '}
                    {Math.max(0, Math.floor(Number(route.coins ?? 0))).toLocaleString('cs-CZ')}
                  </small>
                  <small>
                    ETA {route.status === 'completed' ? 'doručeno' : formatDurationLabel(route.remainingSec)} · Start{' '}
                    {formatDateTimeLabel(route.startedAt)}
                  </small>
                  {isInProgress ? (
                    <div className="activity-item-actions">
                      <button
                        type="button"
                        className="inline-cancel-button"
                        onClick={() => onCancelMarketLogistics(route.id)}
                        disabled={isCancelPending || logisticsActionPending}
                        title="Zrušit transport (do 1/3 cesty)"
                      >
                        {isCancelPending ? '…' : 'Zrušit transport'}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Žádné aktivní logistické zásilky.</p>
        )}
        <div className="market-guild-panel">
          <div className="market-guild-header">
            <h4>Automatizovaný Cech obchodníků</h4>
            <label className="market-guild-toggle">
              <input
                type="checkbox"
                checked={guildEnabledDraft}
                onChange={(event) => {
                  const nextEnabled = Boolean(event.target.checked);
                  applyGuildConfiguration(nextEnabled, guildTargetVillageIdsDraft);
                }}
                disabled={!market?.guildUnlocked || guildActionPending}
              />
              <span>Zapnout cyklus po 5 hodinách</span>
            </label>
          </div>
          <p className="row-help">
            Režim odesílání: {guildAutomation?.dispatchWindow?.startHourUtc ?? 8}:00-
            {guildAutomation?.dispatchWindow?.endHourUtc ?? 20}:00 UTC · Další cyklus:{' '}
            {guildAutomation?.nextDispatchAt ? formatDateTimeLabel(guildAutomation.nextDispatchAt) : 'čeká na konfiguraci'}
          </p>
          {Number(guildAutomation?.merchants?.total ?? 0) > 0 && Number(guildAutomation?.merchants?.available ?? 0) <= 0 ? (
            <p className="panel-feedback is-danger">Všichni obchodníci jsou na cestě, další auto-zásilka čeká.</p>
          ) : null}
          {market?.guildUnlocked ? (
            <>
              <div className="market-guild-add-row">
                <select
                  value={resolvedGuildAddVillageIdDraft}
                  onChange={(event) => setGuildAddVillageIdDraft(String(event.target.value ?? ''))}
                  disabled={guildActionPending}
                >
                  <option value="">Přidat cílové léno…</option>
                  {guildOwnVillageCandidates.map((candidate) => (
                    <option key={`guild-candidate-${candidate.villageId}`} value={candidate.villageId}>
                      {candidate.name} ({candidate.coordX}|{candidate.coordY}) ·{' '}
                      {Math.max(0, Math.floor(Number(candidate.totalResources ?? 0))).toLocaleString('cs-CZ')} /{' '}
                      {(Math.max(0, Math.floor(Number(candidate.cap ?? 0))) * 3).toLocaleString('cs-CZ')}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleGuildAddTarget}
                  disabled={guildActionPending || !resolvedGuildAddVillageIdDraft}
                >
                  Přidat
                  </button>
              </div>
              {guildOwnVillageCandidates.length <= 0 ? (
                <p className="row-help">Žádné další vlastní léno pro přidání nebylo nalezeno.</p>
              ) : null}
              <p className="row-help">
                Cíle: {guildTargetRows.length.toLocaleString('cs-CZ')} · Aktivní {guildActiveTargetCount.toLocaleString('cs-CZ')} ·
                Pozastavené {guildPausedTargetCount.toLocaleString('cs-CZ')} · Pořadí změníš přetažením.
              </p>
              {guildTargetRows.length > 0 ? (
                <ul className="market-guild-target-list">
                  {guildTargetRows.map((target) => {
                    const targetVillageId = Number(target.targetVillageId);
                    const isInactive = !target.isActive;
                    const isPaused = target.isPaused === true;
                    return (
                      <li
                        key={`market-guild-target-${target.id}`}
                        className={`market-guild-target-item ${isInactive ? 'is-inactive' : ''} ${isPaused ? 'is-paused' : ''}`}
                        draggable={!guildActionPending}
                        onDragStart={() => setDraggedGuildTargetVillageId(targetVillageId)}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleGuildDropTarget(targetVillageId);
                        }}
                        onDragEnd={() => setDraggedGuildTargetVillageId(null)}
                      >
                        <div className="market-guild-target-head">
                          <span className="market-guild-target-drag" title="Přetáhni pro změnu pořadí" aria-hidden="true">
                            ⋮⋮
                          </span>
                          <div className="market-guild-target-title">
                            <strong>
                              {target.name} ({target.coordX}|{target.coordY})
                            </strong>
                            <span>{isInactive ? 'Neaktivní' : isPaused ? 'Pozastavené' : 'Aktivní'}</span>
                          </div>
                          <div className="market-guild-target-actions">
                            <button
                              type="button"
                              className="inline-cancel-button"
                              onClick={() => handleGuildTogglePauseTarget(targetVillageId)}
                              disabled={guildActionPending || isInactive}
                              title={isInactive ? 'Neaktivní léno nelze zapnout.' : isPaused ? 'Obnovit cíl v cyklu.' : 'Pozastavit cíl v cyklu.'}
                            >
                              {isPaused ? 'Obnovit' : 'Pozastavit'}
                            </button>
                            <button
                              type="button"
                              className="inline-cancel-button"
                              onClick={() => handleGuildRemoveTarget(targetVillageId)}
                              disabled={guildActionPending}
                            >
                              Odebrat
                            </button>
                          </div>
                        </div>
                        <small>
                          🌲 {Math.max(0, Math.floor(Number(target.resources?.wood ?? 0))).toLocaleString('cs-CZ')} · 🧱{' '}
                          {Math.max(0, Math.floor(Number(target.resources?.stone ?? 0))).toLocaleString('cs-CZ')} · ⛓{' '}
                          {Math.max(0, Math.floor(Number(target.resources?.iron ?? 0))).toLocaleString('cs-CZ')} · Kapacita{' '}
                          {(Math.max(0, Math.floor(Number(target.cap ?? 0))) * 3).toLocaleString('cs-CZ')}
                        </small>
                        {target.warning ? <p className="panel-feedback is-danger">{target.warning}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>Seznam cílů je prázdný. Přidej vlastní léna, která mají dostávat suroviny.</p>
              )}
              <div className="market-guild-audit">
                <h5>Audit automatizace</h5>
                {guildAuditEntries.length > 0 ? (
                  <ul className="market-guild-audit-list">
                    {guildAuditEntries.map((entry) => (
                      <li
                        key={`market-guild-audit-${entry.id}`}
                        className={`market-guild-audit-item severity-${String(entry.severity ?? 'info').toLocaleLowerCase('cs-CZ')}`}
                      >
                        <div className="market-guild-audit-head">
                          <strong className="market-guild-audit-timestamp tld-type-meta">
                            {formatDateTimeLabel(entry.createdAt)}
                          </strong>
                          <span>{String(entry.reasonCode ?? 'unknown')}</span>
                        </div>
                        <p>{entry.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Zatím nejsou dostupné žádné auditní záznamy.</p>
                )}
              </div>
            </>
          ) : (
            <p>Odemkni Cech obchodníků (Trh L4 + výzkum Vliv cechů), potom lze automatiku zapnout.</p>
          )}
        </div>
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
      'conquer',
      'capture',
      'dobyt',
      'dobyti',
      'obsaz',
      'vojensk',
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
            <strong className="commands-kpi-value tld-type-value">{unreadTotal.toLocaleString('cs-CZ')}</strong>
          </article>
          <article className={attentionTotal > 0 ? 'is-danger' : ''}>
            <span>Vyžaduje pozornost</span>
            <strong className="commands-kpi-value tld-type-value">{attentionTotal.toLocaleString('cs-CZ')}</strong>
          </article>
          <article>
            <span>Celkem položek</span>
            <strong className="commands-kpi-value tld-type-value">{total.toLocaleString('cs-CZ')}</strong>
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
  onSetDiplomacy,
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
  onSetDiplomacy: (targetKingdom: string, relationKind: KingdomDiplomacyRelationKind) => void;
  onOpenPlayerProfile: (username: string) => void;
  onOpenKingdomProfile: (kingdomName: string) => void;
}) => {
  const [createKingdomName, setCreateKingdomName] = useState('');
  const [inviteTargetUsername, setInviteTargetUsername] = useState('');
  const [selectedIncomingInviteId, setSelectedIncomingInviteId] = useState<number | null>(null);
  const [selectedDiplomacyKingdom, setSelectedDiplomacyKingdom] = useState('');
  const [selectedDiplomacyRelationKind, setSelectedDiplomacyRelationKind] = useState<
    Exclude<KingdomDiplomacyRelationKind, 'neutral'>
  >('ally');
  const availableKingdoms: KingdomAvailableSummary[] =
    kingdomHub?.availableKingdoms ?? EMPTY_KINGDOM_AVAILABLE;
  const incomingInvites: KingdomIncomingInvite[] = kingdomHub?.incomingInvites ?? EMPTY_KINGDOM_INVITES;
  const members = kingdomHub?.members ?? EMPTY_KINGDOM_MEMBERS;
  const diplomacyRelations = kingdomHub?.diplomacyRelations ?? EMPTY_KINGDOM_DIPLOMACY_RELATIONS;
  const selectedIncomingInvite =
    incomingInvites.find((invite) => invite.id === selectedIncomingInviteId) ?? incomingInvites[0] ?? null;
  const auditLog = kingdomHub?.auditLog ?? EMPTY_KINGDOM_AUDIT_LOG;
  const currentKingdom = kingdomHub?.isMember ? kingdomHub.kingdom : null;
  const canManageInvites = kingdomHub?.canManageInvites ?? false;
  const canManageDiplomacy = kingdomHub?.canManageDiplomacy ?? false;
  const isKingdomLeader = kingdomHub?.leaderUsername === currentUsername;
  const totalKingdomPrestige = members.reduce((sum, member) => sum + member.prestige, 0);
  const totalKingdomVillages = members.reduce((sum, member) => sum + member.villages, 0);
  const activeDiplomacyRelations = useMemo(
    () =>
      diplomacyRelations
        .filter((entry) => entry.relationKind !== 'neutral')
        .sort((left, right) => left.kingdom.localeCompare(right.kingdom, 'cs')),
    [diplomacyRelations],
  );
  const activeDiplomacyComparableSet = useMemo(
    () => new Set(activeDiplomacyRelations.map((entry) => normalizeKingdomComparable(entry.kingdom))),
    [activeDiplomacyRelations],
  );
  const diplomacyTargets = useMemo(
    () =>
      availableKingdoms.filter((entry) => {
        if (currentKingdom && areSameKingdomComparable(entry.kingdom, currentKingdom)) {
          return false;
        }
        return !activeDiplomacyComparableSet.has(normalizeKingdomComparable(entry.kingdom));
      }),
    [activeDiplomacyComparableSet, availableKingdoms, currentKingdom],
  );
  const diplomacySuggestions = useMemo(() => {
    const searchComparable = normalizeKingdomComparable(selectedDiplomacyKingdom);
    if (!searchComparable) {
      return diplomacyTargets.slice(0, 8);
    }

    const startsWithMatches = diplomacyTargets.filter((entry) =>
      normalizeKingdomComparable(entry.kingdom).startsWith(searchComparable),
    );
    const containsMatches = diplomacyTargets.filter((entry) => {
      const kingdomComparable = normalizeKingdomComparable(entry.kingdom);
      return kingdomComparable.includes(searchComparable) && !kingdomComparable.startsWith(searchComparable);
    });
    return [...startsWithMatches, ...containsMatches].slice(0, 8);
  }, [diplomacyTargets, selectedDiplomacyKingdom]);
  const resolvedSelectedDiplomacyKingdom = useMemo(() => {
    const selectedComparable = normalizeKingdomComparable(selectedDiplomacyKingdom);
    if (!selectedComparable) {
      return '';
    }

    const selectedTarget = diplomacyTargets.find(
      (entry) => normalizeKingdomComparable(entry.kingdom) === selectedComparable,
    );
    return selectedTarget?.kingdom ?? '';
  }, [diplomacyTargets, selectedDiplomacyKingdom]);

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

  const hasDiplomacySearchInput = selectedDiplomacyKingdom.trim().length > 0;
  const isDiplomacySearchSelectionValid = resolvedSelectedDiplomacyKingdom.trim().length > 0;

  const requestDiplomacyChange = (
    targetKingdomRaw: string,
    relationKind: KingdomDiplomacyRelationKind,
  ): boolean => {
    const targetKingdom = targetKingdomRaw.trim();
    if (!targetKingdom) {
      return false;
    }

    const relationLabel = KINGDOM_DIPLOMACY_RELATION_LABELS[relationKind] ?? 'Neutrální';
    const confirmationMessage =
      relationKind === 'neutral'
        ? `Odebrat království ${targetKingdom} z diplomatického seznamu?`
        : `Opravdu chceš nastavit vztah vůči ${targetKingdom} na ${relationLabel}?`;
    if (!window.confirm(confirmationMessage)) {
      return false;
    }

    onSetDiplomacy(targetKingdom, relationKind);
    return true;
  };

  const handleSetDiplomacySubmit = () => {
    if (!isDiplomacySearchSelectionValid) {
      return;
    }

    const changed = requestDiplomacyChange(resolvedSelectedDiplomacyKingdom, selectedDiplomacyRelationKind);
    if (changed) {
      setSelectedDiplomacyKingdom('');
    }
  };

  const handleQuickDiplomacyChange = (
    targetKingdom: string,
    relationKind: Exclude<KingdomDiplomacyRelationKind, 'neutral'>,
  ) => {
    requestDiplomacyChange(targetKingdom, relationKind);
  };

  const handleRemoveDiplomacyEntry = (targetKingdom: string) => {
    requestDiplomacyChange(targetKingdom, 'neutral');
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
                  <span className="kingdom-audit-message tld-type-heading">{entry.message}</span>
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
        <h3>Diplomacie království</h3>
        {activeDiplomacyRelations.length > 0 ? (
          <table className="kingdom-diplomacy-table">
            <thead>
              <tr>
                <th>Království</th>
                <th>Aktuální vztah</th>
                <th>Změnit barvu</th>
                <th>Akce</th>
                <th>Poslední změna</th>
              </tr>
            </thead>
            <tbody>
              {activeDiplomacyRelations.map((entry) => (
                <tr key={`kingdom-diplomacy-${entry.kingdom}`}>
                  <td>
                    <button
                      type="button"
                      className="ranking-link-button"
                      onClick={() => onOpenKingdomProfile(entry.kingdom)}
                    >
                      {entry.kingdom}
                    </button>
                  </td>
                  <td>{KINGDOM_DIPLOMACY_RELATION_LABELS[entry.relationKind] ?? 'Neutrální'}</td>
                  <td>
                    <div className="kingdom-inline-actions kingdom-diplomacy-row-picker">
                      {KINGDOM_DIPLOMACY_ASSIGNABLE_OPTIONS.map((option) => (
                        <button
                          key={`diplomacy-row-option-${entry.kingdom}-${option.value}`}
                          type="button"
                          className={`secondary-action kingdom-action-button ${
                            entry.relationKind === option.value ? 'is-active' : ''
                          }`}
                          onClick={() => handleQuickDiplomacyChange(entry.kingdom, option.value)}
                          disabled={actionPending}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-action kingdom-action-button kingdom-diplomacy-remove-button"
                      onClick={() => handleRemoveDiplomacyEntry(entry.kingdom)}
                      disabled={actionPending}
                    >
                      Odebrat
                    </button>
                  </td>
                  <td>
                    {entry.updatedAt
                      ? `${new Date(entry.updatedAt).toLocaleString('cs-CZ')}${
                          entry.updatedByUsername ? ` · ${entry.updatedByUsername}` : ''
                        }`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Zatím nemáš v diplomacii žádné království.</p>
        )}
        {canManageDiplomacy ? (
          diplomacyTargets.length > 0 ? (
            <div className="kingdom-diplomacy-controls">
              <label>
                Vyhledat království
                <input
                  type="text"
                  value={selectedDiplomacyKingdom}
                  onChange={(event) => setSelectedDiplomacyKingdom(event.target.value)}
                  onKeyDown={(event) =>
                    handleActionOnEnter(event, () => {
                      if (actionPending || !isDiplomacySearchSelectionValid) {
                        return;
                      }
                      handleSetDiplomacySubmit();
                    })
                  }
                  placeholder="Název království"
                  disabled={actionPending}
                />
              </label>
              {diplomacySuggestions.length > 0 ? (
                <ul className="kingdom-diplomacy-suggestion-list" aria-label="Napovídání království">
                  {diplomacySuggestions.map((entry) => (
                    <li key={`diplomacy-suggestion-${entry.kingdom}`}>
                      <button
                        type="button"
                        className={`kingdom-diplomacy-suggestion-option ${
                          areSameKingdomComparable(entry.kingdom, resolvedSelectedDiplomacyKingdom)
                            ? 'is-active'
                            : ''
                        }`}
                        onClick={() => setSelectedDiplomacyKingdom(entry.kingdom)}
                        disabled={actionPending}
                      >
                        <strong>{entry.kingdom}</strong>
                        <span>
                          {entry.prestige.toLocaleString('cs-CZ')} prestiže · {entry.villages} osad · {entry.members}{' '}
                          členů
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hasDiplomacySearchInput && !isDiplomacySearchSelectionValid ? (
                <p className="row-help">
                  Vyber prosím království z napovídání. Po odebrání vztahu se království opět objeví ve vyhledávání.
                </p>
              ) : null}
              <div className="kingdom-inline-actions kingdom-diplomacy-relation-picker">
                {KINGDOM_DIPLOMACY_ASSIGNABLE_OPTIONS.map((option) => (
                  <button
                    key={`diplomacy-option-${option.value}`}
                    type="button"
                    className={`secondary-action kingdom-action-button ${
                      selectedDiplomacyRelationKind === option.value ? 'is-active' : ''
                    }`}
                    onClick={() => setSelectedDiplomacyRelationKind(option.value)}
                    disabled={actionPending}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="upgrade-action kingdom-action-button"
                onClick={handleSetDiplomacySubmit}
                disabled={actionPending || !isDiplomacySearchSelectionValid}
              >
                Přidat do diplomacie
              </button>
            </div>
          ) : (
            <p className="row-help">Není dostupné žádné další aktivní království pro přidání do diplomacie.</p>
          )
        ) : (
          <p className="row-help">Diplomacii může měnit pouze Král tvého království.</p>
        )}
      </section>

      <section>
        <h3>Audit log (debug)</h3>
        {auditLog.length > 0 ? (
          <ul className="kingdom-audit-list">
            {auditLog.map((entry) => (
              <li key={`kingdom-audit-${entry.id}`} className="kingdom-audit-item">
                <span className="kingdom-audit-message tld-type-heading">{entry.message}</span>
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
      loot: buildRows('loot', (entry) => Number(entry.lootScore ?? 0)),
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
            : mode === 'supporter'
              ? combatRowsByMode.supporter
              : combatRowsByMode.loot;
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
          : mode === 'supporter'
            ? combatRowsByMode.supporter
            : combatRowsByMode.loot;
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
    if (mode === 'loot') {
      return combatRowsByMode.loot.find((entry) => entry.username === currentUsername) ?? null;
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
            : mode === 'supporter'
              ? 'Top podporovatel'
              : 'Top lupič';
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
            : mode === 'supporter'
              ? 'v pořadí podporovatelů'
              : 'v pořadí lupičů';
  const summaryNoun =
    mode === 'players'
      ? 'hráčů'
      : mode === 'kingdoms'
        ? 'království'
        : mode === 'attacker'
          ? 'útočníků'
          : mode === 'defender'
            ? 'obránců'
            : mode === 'supporter'
              ? 'podporovatelů'
              : 'lupičů';
  const combatScoreColumnLabel = mode === 'loot' ? 'Uloupených surovin' : 'Padlých jednotek (obě strany)';
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
              <button
                className={mode === 'loot' ? 'is-active' : ''}
                onClick={() => selectPlayerMode('loot')}
              >
                Kořist
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
          <span>Tvé umístění je</span>{' '}
          <span className="ranking-player-position-value tld-type-heading">{currentPlacementLabel}</span>{' '}
          <span>{currentPlacementSuffix}</span>.
        </p>
      </section>
    </div>
  );
};

const KingdomProfilePanel = ({
  kingdomName,
  rows,
  settlements,
  kingdomHub,
  actionPending,
  currentManagedVillage,
  onSetDiplomacy,
  onOpenPlayerProfile,
}: {
  kingdomName: string;
  rows: LeaderboardRow[];
  settlements: RegionSettlement[];
  kingdomHub: KingdomHubState | null;
  actionPending: boolean;
  currentManagedVillage: {
    name: string;
    coordX: number;
    coordY: number;
    region: number;
  } | null;
  onSetDiplomacy: (targetKingdom: string, relationKind: KingdomDiplomacyRelationKind) => void;
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
        villages: [...villages].sort((left, right) =>
          compareVillageLabelNatural(
            { name: left.name, coordX: left.globalX, coordY: left.globalY },
            { name: right.name, coordX: right.globalX, coordY: right.globalY },
          ),
        ),
      }));
  }, [membersByUsername, visibleSettlements]);
  const managedVillageLabel = currentManagedVillage
    ? `${currentManagedVillage.name} (${currentManagedVillage.coordX}|${currentManagedVillage.coordY})`
    : 'Neznámá';
  const canManageDiplomacy = kingdomHub?.canManageDiplomacy ?? false;
  const viewerKingdom = kingdomHub?.isMember ? String(kingdomHub.kingdom ?? '') : '';
  const isOwnKingdomProfile = viewerKingdom ? areSameKingdomComparable(viewerKingdom, kingdomName) : false;
  const profileDiplomacyRelationKind =
    kingdomHub?.diplomacyRelations.find((entry) => areSameKingdomComparable(entry.kingdom, kingdomName))
      ?.relationKind ?? 'neutral';
  const canManageProfileDiplomacy =
    canManageDiplomacy && !isOwnKingdomProfile && !isNeutralKingdom(kingdomName);

  const handleSetProfileDiplomacy = (relationKind: KingdomDiplomacyRelationKind) => {
    if (!canManageProfileDiplomacy || actionPending) {
      return;
    }

    const relationLabel = KINGDOM_DIPLOMACY_RELATION_LABELS[relationKind] ?? 'Neutrální';
    const confirmationMessage =
      relationKind === 'neutral'
        ? `Odebrat království ${kingdomName} z diplomatického seznamu?`
        : `Opravdu chceš nastavit vztah vůči ${kingdomName} na ${relationLabel}?`;
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    onSetDiplomacy(kingdomName, relationKind);
  };

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
        <h3>Diplomacie vůči tomuto království</h3>
        {canManageProfileDiplomacy ? (
          <div className="kingdom-profile-diplomacy-controls">
            <p>
              Aktuální stav:{' '}
              <strong>{KINGDOM_DIPLOMACY_RELATION_LABELS[profileDiplomacyRelationKind] ?? 'Neutrální'}</strong>
            </p>
            <div className="kingdom-inline-actions kingdom-diplomacy-relation-picker">
              {KINGDOM_DIPLOMACY_ASSIGNABLE_OPTIONS.map((option) => (
                <button
                  key={`kingdom-profile-diplomacy-${kingdomName}-${option.value}`}
                  type="button"
                  className={`secondary-action kingdom-action-button ${
                    profileDiplomacyRelationKind === option.value ? 'is-active' : ''
                  }`}
                  onClick={() => handleSetProfileDiplomacy(option.value)}
                  disabled={actionPending}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="secondary-action kingdom-action-button kingdom-diplomacy-remove-button"
              onClick={() => handleSetProfileDiplomacy('neutral')}
              disabled={actionPending || profileDiplomacyRelationKind === 'neutral'}
            >
              Odebrat z diplomacie
            </button>
          </div>
        ) : canManageDiplomacy ? (
          isOwnKingdomProfile ? (
            <p className="row-help">Vlastní království nelze nastavit do diplomacie.</p>
          ) : (
            <p className="row-help">Neutrální království nelze přidat do diplomatického seznamu.</p>
          )
        ) : (
          <p className="row-help">Diplomacii může měnit pouze Král tvého království.</p>
        )}
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
        .sort((left, right) =>
          compareVillageLabelNatural(
            { name: left.name, coordX: left.globalX, coordY: left.globalY },
            { name: right.name, coordX: right.globalX, coordY: right.globalY },
          ),
        ),
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
  const lootScore = Number(playerRow?.lootScore ?? 0);
  const attackerRankLabel = playerRow?.attackerRank ? `#${playerRow.attackerRank}` : 'N/A';
  const defenderRankLabel = playerRow?.defenderRank ? `#${playerRow.defenderRank}` : 'N/A';
  const supporterRankLabel = playerRow?.supporterRank ? `#${playerRow.supporterRank}` : 'N/A';
  const lootRankLabel = playerRow?.lootRank ? `#${playerRow.lootRank}` : 'N/A';

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
          <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--rank">
            <span>Globální pořadí</span>
            <strong className="player-profile-stat-value tld-type-stat">{playerRow ? `#${playerRow.rank}` : 'N/A'}</strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--prestige">
            <span>Prestiž</span>
            <strong className="player-profile-stat-value tld-type-stat">
              {(playerRow?.prestige ?? 0).toLocaleString('cs-CZ')}
            </strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--villages">
            <span>Léna</span>
            <strong className="player-profile-stat-value tld-type-stat">{playerRow?.villages ?? villages.length}</strong>
          </article>
        </div>
        <div className="player-profile-combat-stats">
          <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--attack">
            <span>Útočník</span>
            <strong className="player-profile-stat-value tld-type-stat">
              {`${attackerRankLabel} (${attackerScore.toLocaleString('cs-CZ')} padlých)`}
            </strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--defense">
            <span>Obránce</span>
            <strong className="player-profile-stat-value tld-type-stat">
              {`${defenderRankLabel} (${defenderScore.toLocaleString('cs-CZ')} padlých)`}
            </strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--support">
            <span>Podporovatel</span>
            <strong className="player-profile-stat-value tld-type-stat">
              {`${supporterRankLabel} (${supporterScore.toLocaleString('cs-CZ')} padlých)`}
            </strong>
          </article>
          <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--loot">
            <span>Kořist</span>
            <strong className="player-profile-stat-value tld-type-stat">
              {`${lootRankLabel} (${lootScore.toLocaleString('cs-CZ')} uloupeno)`}
            </strong>
          </article>
        </div>
        {protectedVillages.length > 0 ? (
          <p className="player-profile-protection-strip">
            Nováčkovská ochrana: {`${protectedVillages.length} lén · max ${formatDurationLabel(maxProtectionRemainingSec)}`}
          </p>
        ) : null}
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
  lootRank,
}: {
  username: string;
  kingdom: string;
  prestige: number;
  villageCount: number;
  rank: number | null;
  attackerRank: number | null;
  defenderRank: number | null;
  supporterRank: number | null;
  lootRank: number | null;
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
        <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--commander">
          <span>Velitel</span>
          <strong className="player-profile-stat-value tld-type-stat">{username}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--rank">
          <span>Globální pořadí</span>
          <strong className="player-profile-stat-value tld-type-stat">{rank ? `#${rank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-main player-profile-stat-card--prestige">
          <span>Prestiž</span>
          <strong className="player-profile-stat-value tld-type-stat">{prestige.toLocaleString('cs-CZ')}</strong>
        </article>
      </div>

      <div className="player-profile-combat-stats">
        <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--attack">
          <span>Útočník</span>
          <strong className="player-profile-stat-value tld-type-stat">{attackerRank ? `#${attackerRank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--defense">
          <span>Obránce</span>
          <strong className="player-profile-stat-value tld-type-stat">{defenderRank ? `#${defenderRank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--support">
          <span>Podporovatel</span>
          <strong className="player-profile-stat-value tld-type-stat">{supporterRank ? `#${supporterRank}` : 'N/A'}</strong>
        </article>
        <article className="player-profile-stat-card player-profile-stat-card-compact player-profile-stat-card--loot">
          <span>Kořist</span>
          <strong className="player-profile-stat-value tld-type-stat">{lootRank ? `#${lootRank}` : 'N/A'}</strong>
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
  mapPreviewTravelModifier,
  shortcutNotice,
  isTouchDevice,
  onCaptureShortcut,
  onResetShortcutBinding,
  onResetAllShortcuts,
  onAutoHidePinColumnsChange,
  onMapPreviewTravelModifierChange,
  settlementColorPalette,
  onSettlementColorChange,
  onResetSettlementColors,
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
  mapPreviewTravelModifier: MapPreviewTravelModifierKey;
  shortcutNotice: string | null;
  isTouchDevice: boolean;
  onCaptureShortcut: (actionId: ShortcutActionId, binding: ShortcutBinding) => void;
  onResetShortcutBinding: (actionId: ShortcutActionId) => void;
  onResetAllShortcuts: () => void;
  onAutoHidePinColumnsChange: (enabled: boolean) => void;
  onMapPreviewTravelModifierChange: (modifier: MapPreviewTravelModifierKey) => void;
  settlementColorPalette: SettlementColorPalette;
  onSettlementColorChange: (colorKey: SettlementColorKey, color: string) => void;
  onResetSettlementColors: () => void;
}) => {
  const [settingsTab, setSettingsTab] = useState<'account' | 'interface' | 'shortcuts' | 'world'>('account');
  const [avatarSource, setAvatarSource] = useState<AvatarCropSource | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(AVATAR_ZOOM_MIN);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const holdPinColumnsShortcutLabel = formatShortcutBindingLabel(shortcutBindings.peekPinColumnsWhileHeld);
  const mapPreviewTravelModifierLabel =
    MAP_PREVIEW_TRAVEL_MODIFIER_OPTIONS.find((item) => item.value === mapPreviewTravelModifier)?.label ?? 'Ctrl';

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
              Discordu: <span className="settings-help-emphasis tld-type-heading">Mmykron</span>.
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
          <div className="settings-settlement-colors-section">
            <h4>Barvy rozlišení lén (RPG paleta)</h4>
            <p>
              Přizpůsob si barevné rozlišení lén na mapě. Změna se aplikuje okamžitě a ukládá se pro tvůj účet.
            </p>
            <div className="settings-settlement-colors-grid">
              {SETTLEMENT_COLOR_KEYS.map((colorKey) => (
                <label
                  key={`settlement-color-${colorKey}`}
                  className={`settings-settlement-color-card relation-${colorKey}`}
                >
                  <span>{SETTLEMENT_COLOR_LABELS[colorKey]}</span>
                  <div className="settings-settlement-color-control">
                    <input
                      type="color"
                      value={settlementColorPalette[colorKey]}
                      onChange={(event) => onSettlementColorChange(colorKey, event.target.value)}
                      aria-label={`Nastavit barvu: ${SETTLEMENT_COLOR_LABELS[colorKey]}`}
                    />
                    <code>{settlementColorPalette[colorKey].toUpperCase()}</code>
                  </div>
                </label>
              ))}
            </div>
            <button type="button" className="secondary-action" onClick={onResetSettlementColors}>
              Obnovit výchozí RPG barvy
            </button>
          </div>
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
            Nezávisle na režimu: stisknutím{' '}
            <span className="settings-help-emphasis tld-type-heading">{holdPinColumnsShortcutLabel}</span> přepneš overlay
            pin sloupců (zapnuto/vypnuto).
          </small>
          <label className="settings-toggle-row">
            <span>Náhled časů přesunu na mapě (podržet klávesu)</span>
            <select
              value={mapPreviewTravelModifier}
              onChange={(event) => onMapPreviewTravelModifierChange(normalizeMapPreviewTravelModifier(event.target.value))}
            >
              {MAP_PREVIEW_TRAVEL_MODIFIER_OPTIONS.map((option) => (
                <option key={`map-preview-modifier-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <small className="row-help">
            Na mapě se detail „Časy přesunu jednotek“ zobrazí při najetí na léno a podržení{' '}
            <span className="settings-help-emphasis tld-type-heading">{mapPreviewTravelModifierLabel}</span>.
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

const MapSettlementCanvasLayer = memo(
  ({
    markers,
    cellSize,
    cellGap,
    gridSizePx,
  }: {
    markers: MapSettlementCanvasMarker[];
    cellSize: number;
    cellGap: number;
    gridSizePx: number;
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [imageRevision, setImageRevision] = useState(0);
    const imagePaths = useMemo(
      () => Array.from(new Set(markers.map((marker) => marker.prestigeMeta.imagePath))),
      [markers],
    );
    const imagePathsKey = imagePaths.join('|');

    useEffect(() => {
      const cleanups: Array<() => void> = [];
      for (const imagePath of imagePaths) {
        const image = getSettlementCanvasImage(imagePath);
        if (image.complete) {
          continue;
        }
        const handleReady = () => {
          setImageRevision((previous) => previous + 1);
        };
        image.addEventListener('load', handleReady);
        image.addEventListener('error', handleReady);
        cleanups.push(() => {
          image.removeEventListener('load', handleReady);
          image.removeEventListener('error', handleReady);
        });
      }
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }, [imagePathsKey, imagePaths]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || typeof window === 'undefined') {
        return;
      }

      const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const logicalWidth = Math.max(1, Math.round(gridSizePx));
      const logicalHeight = Math.max(1, Math.round(gridSizePx));
      const physicalWidth = Math.max(1, Math.round(logicalWidth * devicePixelRatio));
      const physicalHeight = Math.max(1, Math.round(logicalHeight * devicePixelRatio));

      if (canvas.width !== physicalWidth) {
        canvas.width = physicalWidth;
      }
      if (canvas.height !== physicalHeight) {
        canvas.height = physicalHeight;
      }
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw passive marker visuals in a single canvas pass; DOM buttons remain only for hit-testing.
      for (const marker of markers) {
        const position = toGridPixelPosition({ x: marker.localX, y: marker.localY }, cellSize, cellGap);
        const centerX = position.left + cellSize / 2;
        const centerY = position.top + cellSize / 2;
        const tierStyle = MAP_SETTLEMENT_CANVAS_TIER_STYLE[marker.prestigeMeta.tier];
        const kindStyle = MAP_SETTLEMENT_CANVAS_KIND_STYLE[marker.mapKind];

        marker.coverageCommandTypes.forEach((commandType, index) => {
          const badgeStyle = MAP_SETTLEMENT_CANVAS_BADGE_STYLE[commandType];
          const radius = Math.max(cellSize * 1.75, cellSize * (1.95 + index * 0.48));
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, badgeStyle.glow.replace('0.32', '0.34').replace('0.3', '0.34').replace('0.28', '0.3'));
          gradient.addColorStop(0.42, badgeStyle.glow);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();
        });

        const haloRadius = Math.max(cellSize * 0.4, cellSize * 0.43 * tierStyle.haloScale);
        const haloGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, haloRadius);
        haloGradient.addColorStop(
          0,
          `rgba(${tierStyle.haloRgb[0]}, ${tierStyle.haloRgb[1]}, ${tierStyle.haloRgb[2]}, ${Math.min(0.68, tierStyle.haloOpacity + 0.08)})`,
        );
        haloGradient.addColorStop(
          0.58,
          `rgba(${tierStyle.haloRgb[0]}, ${tierStyle.haloRgb[1]}, ${tierStyle.haloRgb[2]}, ${tierStyle.haloOpacity})`,
        );
        haloGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = haloGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        const inset = Math.max(1, Math.min(4, cellSize * 0.08));
        const markerSize = Math.max(6, cellSize - inset * 2);
        const markerLeft = position.left + inset;
        const markerTop = position.top + inset;
        const markerRadius = Math.max(2, Math.min(6, markerSize * 0.18));

        traceRoundedRectPath(ctx, markerLeft, markerTop, markerSize, markerSize, markerRadius);
        ctx.fillStyle = kindStyle.fill;
        ctx.fill();
        ctx.lineWidth = Math.max(1, cellSize * 0.05);
        ctx.strokeStyle = kindStyle.border;
        ctx.stroke();

        if (marker.mapKind === 'own' || marker.mapKind === 'active') {
          traceRoundedRectPath(
            ctx,
            markerLeft + 1.25,
            markerTop + 1.25,
            Math.max(2, markerSize - 2.5),
            Math.max(2, markerSize - 2.5),
            Math.max(1.5, markerRadius - 0.75),
          );
          ctx.lineWidth = marker.mapKind === 'active' ? Math.max(1.6, cellSize * 0.09) : Math.max(1.2, cellSize * 0.06);
          ctx.strokeStyle = marker.mapKind === 'active' ? 'rgba(248, 251, 255, 0.96)' : 'rgba(236, 245, 255, 0.92)';
          ctx.stroke();
        }

        if (marker.isFocused) {
          traceRoundedRectPath(
            ctx,
            markerLeft - 1,
            markerTop - 1,
            markerSize + 2,
            markerSize + 2,
            Math.max(2, markerRadius + 0.5),
          );
          ctx.lineWidth = Math.max(1.3, cellSize * 0.07);
          ctx.strokeStyle = 'rgba(149, 205, 247, 0.95)';
          ctx.shadowColor = 'rgba(149, 205, 247, 0.38)';
          ctx.shadowBlur = Math.max(8, cellSize * 0.5);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        const image = getSettlementCanvasImage(marker.prestigeMeta.imagePath);
        const imageSize = clamp(cellSize * 0.72, 10, 34);
        if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.54)';
          ctx.shadowBlur = Math.max(4, cellSize * 0.24);
          ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(${kindStyle.glowRgb[0]}, ${kindStyle.glowRgb[1]}, ${kindStyle.glowRgb[2]}, 0.7)`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(3, imageSize * 0.28), 0, Math.PI * 2);
          ctx.fill();
        }

        if (marker.orderBadges.length > 0) {
          const badgeHeight = Math.max(11, Math.min(16, cellSize * 0.34));
          const badgeGap = Math.max(2, cellSize * 0.08);
          const badgeY = position.top - badgeHeight - Math.max(2, cellSize * 0.08);
          const badgeWidths = marker.orderBadges.map((badge) =>
            Math.max(badgeHeight, badgeHeight + (badge.count > 1 ? badgeHeight * 0.6 : 0)),
          );
          const totalBadgeWidth =
            badgeWidths.reduce((sum, width) => sum + width, 0) +
            badgeGap * Math.max(0, marker.orderBadges.length - 1);
          let badgeX = centerX - totalBadgeWidth / 2;

          marker.orderBadges.forEach((badge, index) => {
            const badgeWidth = badgeWidths[index];
            const badgeStyle = MAP_SETTLEMENT_CANVAS_BADGE_STYLE[badge.kind];
            traceRoundedRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
            ctx.fillStyle = badgeStyle.fill;
            ctx.shadowColor = badgeStyle.glow;
            ctx.shadowBlur = Math.max(3, badgeHeight * 0.5);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
            ctx.strokeStyle = badgeStyle.border;
            ctx.stroke();

            ctx.fillStyle = badgeStyle.text;
            ctx.font = `700 ${Math.max(7, badgeHeight * 0.58)}px "Segoe UI Symbol", serif`;
            ctx.fillText(
              badge.count > 1 ? `${badge.symbol}${badge.count}` : badge.symbol,
              badgeX + badgeWidth / 2,
              badgeY + badgeHeight / 2 + 0.25,
            );
            badgeX += badgeWidth + badgeGap;
          });
        }
      }
    }, [cellGap, cellSize, gridSizePx, imageRevision, markers]);

    return <canvas ref={canvasRef} className="map-settlement-canvas-layer" aria-hidden="true" />;
  },
);

const MapPanel = memo(({
  settlements,
  regionId,
  regionSize,
  regionOriginX,
  regionOriginY,
  focusedSettlementId,
  isInteractionEnabled,
  centerRequest,
  onCenterRequestHandled,
  activeVillageId,
  currentUsername,
  zoomPercent,
  orderMarkersByVillageId,
  onZoomChange,
  onOpenSettlement,
  onPinSettlement,
  onQuickArmyCommand,
}: {
  settlements: RegionSettlement[];
  regionId: number;
  regionSize: number;
  regionOriginX: number;
  regionOriginY: number;
  focusedSettlementId: string | null;
  isInteractionEnabled: boolean;
  centerRequest: { settlementId: string; nonce: number } | null;
  onCenterRequestHandled: (nonce: number) => void;
  activeVillageId: number | null;
  currentUsername: string;
  zoomPercent: number;
  orderMarkersByVillageId: Map<number, SettlementOrderMarkerCounts>;
  onZoomChange: (zoomPercent: number) => void;
  onOpenSettlement: (settlement: RegionSettlement) => void;
  onPinSettlement: (settlement: RegionSettlement, side: PinSide) => void;
  onQuickArmyCommand: (commandType: ArmyCommandSelectableType, settlement: RegionSettlement) => void;
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedSettlementId, setPinnedSettlementId] = useState<string | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
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
    captureNode: HTMLDivElement | null;
  } | null>(null);
  const panTargetScrollRef = useRef<{ left: number; top: number } | null>(null);
  const panAnimationRafRef = useRef<number | null>(null);
  const panAnimationLastTimestampRef = useRef<number | null>(null);
  const miniMapDragPointerIdRef = useRef<number | null>(null);
  const [localZoomPercent, setLocalZoomPercent] = useState(() => normalizeMapZoom(zoomPercent));
  const wheelZoomRafRef = useRef<number | null>(null);
  const wheelZoomTargetRef = useRef<number | null>(null);
  const wheelAnchorRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const zoomPercentRef = useRef(localZoomPercent);
  const zoomCommitTimerRef = useRef<number | null>(null);
  const pendingZoomCommitRef = useRef(localZoomPercent);
  const hasInitialAutoCenterRef = useRef(false);
  const hasRestoredViewportRef = useRef(false);
  const viewportPersistTimerRef = useRef<number | null>(null);
  const dragSuppressClickUntilRef = useRef(0);
  const processedCenterRequestNonceRef = useRef<number | null>(null);
  const hoverClearTimeoutRef = useRef<number | null>(null);
  const copyCoordsFeedbackTimeoutRef = useRef<number | null>(null);
  const [copyCoordsFeedback, setCopyCoordsFeedback] = useState<string | null>(null);
  const [gridViewportState, setGridViewportState] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 0,
    clientHeight: 0,
    wrapLeft: 0,
    wrapTop: 0,
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
  useEffect(
    () => () => {
      if (copyCoordsFeedbackTimeoutRef.current != null) {
        window.clearTimeout(copyCoordsFeedbackTimeoutRef.current);
        copyCoordsFeedbackTimeoutRef.current = null;
      }
    },
    [],
  );

  const resetMapInteractionState = useEffectEvent(() => {
    clearHoverTimeout();
    setHoveredId(null);
    setPinnedSettlementId(null);
  });

  useEffect(() => {
    if (isInteractionEnabled) {
      return;
    }
    resetMapInteractionState();
  }, [isInteractionEnabled]);

  useEffect(() => {
    const normalizedIncoming = clamp(Number(zoomPercent), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    if (normalizedIncoming === zoomPercentRef.current) {
      return;
    }
    if (wheelZoomRafRef.current != null) {
      window.cancelAnimationFrame(wheelZoomRafRef.current);
      wheelZoomRafRef.current = null;
    }
    wheelZoomTargetRef.current = null;
    wheelAnchorRef.current = null;
    zoomPercentRef.current = normalizedIncoming;
    pendingZoomCommitRef.current = normalizedIncoming;
    // Local map zoom stays UI-first; this controlled sync is intentional.
    const syncTimer = window.setTimeout(() => {
      setLocalZoomPercent(normalizedIncoming);
    }, 0);
    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [zoomPercent]);

  const scheduleZoomCommit = useCallback(
    (nextZoomPercent: number) => {
      const normalizedNext = clamp(Number(nextZoomPercent), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      pendingZoomCommitRef.current = normalizedNext;
      if (zoomCommitTimerRef.current != null) {
        window.clearTimeout(zoomCommitTimerRef.current);
      }
      zoomCommitTimerRef.current = window.setTimeout(() => {
        zoomCommitTimerRef.current = null;
        onZoomChange(pendingZoomCommitRef.current);
      }, 120);
    },
    [onZoomChange],
  );

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
      bot: 2,
      royal: 2,
      abandoned: 1,
    };

    const scoreSettlement = (settlement: RegionSettlement): number => {
      let score = 0;
      if (focusedSettlementId && settlement.id === focusedSettlementId) {
        score += 10000;
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
    settlements,
  ]);
  const mapDisplaySettlementById = useMemo(() => {
    const byId = new Map<string, { settlement: RegionSettlement; localX: number; localY: number }>();
    for (const entry of mapDisplaySettlements) {
      byId.set(entry.settlement.id, entry);
    }
    return byId;
  }, [mapDisplaySettlements]);
  const previewSettlement = isInteractionEnabled ? pinnedSettlement ?? hoveredSettlement : null;
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
    previewSettlement != null && getSettlementProtectionRemainingSec(previewSettlement) > 0;
  const isPreviewAbandoned = previewSettlementKind === 'abandoned';
  const isPreviewPlayerSettlement =
    previewSettlementKind === 'allied' ||
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
  const zoomScale = 1 + localZoomPercent / 100;
  const zoomLabelValue = Math.round((100 + localZoomPercent) * 10) / 10;
  const zoomSliderValue = normalizeMapZoom(localZoomPercent);
  const mapCellGapPx = MAP_CELL_GAP_PX;
  const fitCellSize = useMemo(() => {
    const viewportWidth = Math.max(0, Number(gridViewportState.clientWidth ?? 0));
    const viewportHeight = Math.max(0, Number(gridViewportState.clientHeight ?? 0));
    if (viewportWidth <= 1 || viewportHeight <= 1) {
      return REGION_CELL_SIZE;
    }

    const dominantViewportSide = Math.max(viewportWidth, viewportHeight);
    const totalGap = Math.max(0, regionSize - 1) * mapCellGapPx;
    const availablePixels = Math.max(96, dominantViewportSide + 8);
    const nextCellSize = Math.ceil((availablePixels - totalGap) / Math.max(1, regionSize));
    return Math.max(8, nextCellSize);
  }, [gridViewportState.clientHeight, gridViewportState.clientWidth, mapCellGapPx, regionSize]);
  const baseCellSize = fitCellSize;
  const cellSize = Math.max(8, Math.round(baseCellSize * zoomScale));
  const mapGridSizePx = regionSize * cellSize + Math.max(0, regionSize - 1) * mapCellGapPx;
  const renderedCellRange = useMemo(() => {
    const cellSpan = Math.max(1, cellSize + mapCellGapPx);
    const clientWidth = Math.max(0, Number(gridViewportState.clientWidth ?? 0));
    const clientHeight = Math.max(0, Number(gridViewportState.clientHeight ?? 0));
    if (clientWidth <= 1 || clientHeight <= 1) {
      return {
        minX: 1,
        maxX: Math.max(1, regionSize),
        minY: 1,
        maxY: Math.max(1, regionSize),
      };
    }

    const viewportStartX = Math.floor(Math.max(0, gridViewportState.scrollLeft) / cellSpan) + 1;
    const viewportEndX = Math.ceil((Math.max(0, gridViewportState.scrollLeft) + clientWidth) / cellSpan) + 1;
    const viewportStartY = Math.floor(Math.max(0, gridViewportState.scrollTop) / cellSpan) + 1;
    const viewportEndY = Math.ceil((Math.max(0, gridViewportState.scrollTop) + clientHeight) / cellSpan) + 1;

    return {
      minX: clamp(viewportStartX - MAP_RENDER_MARGIN_CELLS, 1, regionSize),
      maxX: clamp(viewportEndX + MAP_RENDER_MARGIN_CELLS, 1, regionSize),
      minY: clamp(viewportStartY - MAP_RENDER_MARGIN_CELLS, 1, regionSize),
      maxY: clamp(viewportEndY + MAP_RENDER_MARGIN_CELLS, 1, regionSize),
    };
  }, [
    cellSize,
    gridViewportState.clientHeight,
    gridViewportState.clientWidth,
    gridViewportState.scrollLeft,
    gridViewportState.scrollTop,
    mapCellGapPx,
    regionSize,
  ]);
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
  const mapRenderSettlements = useMemo(() => {
    // Keep marker DOM scoped to the viewport (+overscan). Hover/pin visuals are rendered separately.
    const alwaysVisibleIds = new Set<string>();
    if (focusedSettlementId) {
      alwaysVisibleIds.add(focusedSettlementId);
    }
    if (distanceOriginSettlement?.id) {
      alwaysVisibleIds.add(distanceOriginSettlement.id);
    }

    return mapDisplaySettlements.filter(({ settlement, localX, localY }) => {
      if (alwaysVisibleIds.has(settlement.id)) {
        return true;
      }
      return (
        localX >= renderedCellRange.minX &&
        localX <= renderedCellRange.maxX &&
        localY >= renderedCellRange.minY &&
        localY <= renderedCellRange.maxY
      );
    });
  }, [
    distanceOriginSettlement,
    focusedSettlementId,
    mapDisplaySettlements,
    renderedCellRange.maxX,
    renderedCellRange.maxY,
    renderedCellRange.minX,
    renderedCellRange.minY,
  ]);
  const resolveStateOverlayCell = useCallback(
    (
      settlementId: string | null,
    ): { id: string; localX: number; localY: number; mapKind: MapSettlementKind } | null => {
      if (!settlementId) {
        return null;
      }
      const settlement = settlementsById.get(settlementId);
      if (!settlement) {
        return null;
      }
      const visibleEntry = mapDisplaySettlementById.get(settlement.id);
      const fallbackGridPosition = visibleEntry ? null : resolveSettlementGridCoords(settlement);
      const localX = visibleEntry?.localX ?? fallbackGridPosition?.x ?? 0;
      const localY = visibleEntry?.localY ?? fallbackGridPosition?.y ?? 0;
      if (localX < 1 || localX > regionSize || localY < 1 || localY > regionSize) {
        return null;
      }
      return {
        id: settlement.id,
        localX,
        localY,
        mapKind: getSettlementMapKind(settlement, activeVillageId),
      };
    },
    [activeVillageId, mapDisplaySettlementById, regionSize, resolveSettlementGridCoords, settlementsById],
  );
  const hoveredOverlayCell = useMemo(
    () => resolveStateOverlayCell(safeHoveredId),
    [resolveStateOverlayCell, safeHoveredId],
  );
  const pinnedOverlayCell = useMemo(
    () => resolveStateOverlayCell(safePinnedSettlementId),
    [resolveStateOverlayCell, safePinnedSettlementId],
  );
  const shouldShowHoveredOverlay = hoveredOverlayCell != null && hoveredOverlayCell.id !== pinnedOverlayCell?.id;

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
  const previewSettlementTypeLabel =
    previewSettlementKind != null ? MAP_SETTLEMENT_KIND_LABELS[previewSettlementKind] : '-';
  const showPreviewTravelDurations = isInteractionEnabled && isCtrlPressed && previewDistanceTiles != null;
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
  const showSettlementBannerCards = isInteractionEnabled && isCtrlPressed;

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
    const wrapRect = wrap.getBoundingClientRect();
    const nextGridViewportState = {
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
      clientWidth,
      clientHeight,
      wrapLeft: wrapRect.left,
      wrapTop: wrapRect.top,
    };
    setGridViewportState((previous) => {
      if (
        Math.abs(previous.scrollLeft - nextGridViewportState.scrollLeft) < 0.5 &&
        Math.abs(previous.scrollTop - nextGridViewportState.scrollTop) < 0.5 &&
        Math.abs(previous.clientWidth - nextGridViewportState.clientWidth) < 0.5 &&
        Math.abs(previous.clientHeight - nextGridViewportState.clientHeight) < 0.5 &&
        Math.abs(previous.wrapLeft - nextGridViewportState.wrapLeft) < 0.5 &&
        Math.abs(previous.wrapTop - nextGridViewportState.wrapTop) < 0.5
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };

    const handleWindowBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const handleCopySettlementCoordinates = useCallback(
    async (settlement: RegionSettlement | null) => {
      if (!settlement) {
        return;
      }
      const coordsText = `${Math.round(Number(settlement.globalX))}|${Math.round(Number(settlement.globalY))}`;
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(coordsText);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (!copied && typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = coordsText;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          copied = document.execCommand('copy');
        } catch {
          copied = false;
        }
        document.body.removeChild(textarea);
      }
      setCopyCoordsFeedback(copied ? `Souřadnice ${coordsText} zkopírovány.` : 'Souřadnice nešlo zkopírovat.');
      if (copyCoordsFeedbackTimeoutRef.current != null) {
        window.clearTimeout(copyCoordsFeedbackTimeoutRef.current);
      }
      copyCoordsFeedbackTimeoutRef.current = window.setTimeout(() => {
        copyCoordsFeedbackTimeoutRef.current = null;
        setCopyCoordsFeedback(null);
      }, 1800);
    },
    [],
  );

  useEffect(
    () => () => {
      if (wheelZoomRafRef.current != null) {
        window.cancelAnimationFrame(wheelZoomRafRef.current);
        wheelZoomRafRef.current = null;
      }
      wheelZoomTargetRef.current = null;
      wheelAnchorRef.current = null;
      if (zoomCommitTimerRef.current != null) {
        window.clearTimeout(zoomCommitTimerRef.current);
        zoomCommitTimerRef.current = null;
        onZoomChange(pendingZoomCommitRef.current);
      }
      if (panAnimationRafRef.current != null) {
        window.cancelAnimationFrame(panAnimationRafRef.current);
        panAnimationRafRef.current = null;
      }
      if (viewportPersistTimerRef.current != null) {
        window.clearTimeout(viewportPersistTimerRef.current);
        viewportPersistTimerRef.current = null;
      }
      panAnimationLastTimestampRef.current = null;
      panTargetScrollRef.current = null;
      miniMapDragPointerIdRef.current = null;
    },
    [onZoomChange],
  );

  const applyZoom = useCallback(
    (nextZoomPercent: number, anchor?: { clientX: number; clientY: number }) => {
      const currentZoom = zoomPercentRef.current;
      const normalizedNext = clamp(Number(nextZoomPercent), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      if (Math.abs(normalizedNext - currentZoom) <= 0.0001) {
        return;
      }

      const wrap = gridWrapRef.current;
      if (!wrap) {
        setLocalZoomPercent(normalizedNext);
        zoomPercentRef.current = normalizedNext;
        scheduleZoomCommit(normalizedNext);
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

      setLocalZoomPercent(normalizedNext);
      zoomPercentRef.current = normalizedNext;
      scheduleZoomCommit(normalizedNext);

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
    [scheduleZoomCommit, updateMiniViewport],
  );

  const clampPanTarget = useCallback((wrap: HTMLDivElement, left: number, top: number) => {
    const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    return {
      left: clamp(left, 0, maxLeft),
      top: clamp(top, 0, maxTop),
    };
  }, []);

  const startSmoothPanAnimation = useCallback(() => {
    if (panAnimationRafRef.current != null) {
      return;
    }

    const step = (timestamp: number) => {
      const wrap = gridWrapRef.current;
      const target = panTargetScrollRef.current;
      if (!wrap || !target) {
        panAnimationRafRef.current = null;
        panAnimationLastTimestampRef.current = null;
        return;
      }

      const deltaLeft = target.left - wrap.scrollLeft;
      const deltaTop = target.top - wrap.scrollTop;
      if (Math.abs(deltaLeft) <= MAP_PAN_TARGET_EPSILON_PX && Math.abs(deltaTop) <= MAP_PAN_TARGET_EPSILON_PX) {
        wrap.scrollLeft = target.left;
        wrap.scrollTop = target.top;
        updateMiniViewport();
        panAnimationRafRef.current = null;
        panAnimationLastTimestampRef.current = null;
        return;
      }

      const previousTimestamp = panAnimationLastTimestampRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.064, Math.max(0.001, (timestamp - previousTimestamp) / 1000));
      panAnimationLastTimestampRef.current = timestamp;
      const interpolation = 1 - Math.exp(-MAP_PAN_TARGET_SMOOTHNESS * deltaSeconds);
      wrap.scrollLeft = wrap.scrollLeft + deltaLeft * interpolation;
      wrap.scrollTop = wrap.scrollTop + deltaTop * interpolation;
      updateMiniViewport();
      panAnimationRafRef.current = window.requestAnimationFrame(step);
    };

    panAnimationLastTimestampRef.current = null;
    panAnimationRafRef.current = window.requestAnimationFrame(step);
  }, [updateMiniViewport]);

  const applyPanTarget = useCallback(
    (left: number, top: number, options?: { immediate?: boolean }) => {
      const wrap = gridWrapRef.current;
      if (!wrap) {
        return;
      }
      const clampedTarget = clampPanTarget(wrap, left, top);
      panTargetScrollRef.current = clampedTarget;
      if (options?.immediate) {
        wrap.scrollLeft = clampedTarget.left;
        wrap.scrollTop = clampedTarget.top;
        updateMiniViewport();
        return;
      }
      startSmoothPanAnimation();
    },
    [clampPanTarget, startSmoothPanAnimation, updateMiniViewport],
  );

  const readWrapContentInset = useCallback((wrap: HTMLDivElement) => {
    const style = window.getComputedStyle(wrap);
    const left = Number.parseFloat(style.paddingLeft);
    const top = Number.parseFloat(style.paddingTop);
    return {
      left: Number.isFinite(left) ? left : 0,
      top: Number.isFinite(top) ? top : 0,
    };
  }, []);

  const centerOnSettlement = useCallback(
    (settlementId: string | null, behavior: ScrollBehavior = 'auto'): boolean => {
      if (!settlementId) {
        return false;
      }

      const wrap = gridWrapRef.current;
      if (!wrap) {
        return false;
      }

      const visibleEntry = mapDisplaySettlementById.get(settlementId) ?? null;
      const targetSettlement = visibleEntry?.settlement ?? settlementsById.get(settlementId) ?? null;
      if (!targetSettlement) {
        return false;
      }
      const localPosition = visibleEntry
        ? { x: visibleEntry.localX, y: visibleEntry.localY }
        : resolveSettlementGridCoords(targetSettlement);
      const pixelPosition = toGridPixelPosition(localPosition, cellSize, mapCellGapPx);
      const contentInset = readWrapContentInset(wrap);
      const targetLeft = contentInset.left + pixelPosition.left + cellSize / 2 - wrap.clientWidth / 2;
      const targetTop = contentInset.top + pixelPosition.top + cellSize / 2 - wrap.clientHeight / 2;

      applyPanTarget(targetLeft, targetTop, { immediate: behavior !== 'smooth' });
      return true;
    },
    [
      applyPanTarget,
      cellSize,
      mapCellGapPx,
      mapDisplaySettlementById,
      readWrapContentInset,
      resolveSettlementGridCoords,
      settlementsById,
    ],
  );

  useEffect(() => {
    if (!centerRequest?.settlementId) {
      return;
    }
    if (processedCenterRequestNonceRef.current === centerRequest.nonce) {
      return;
    }
    const didCenter = centerOnSettlement(centerRequest.settlementId, 'smooth');
    if (!didCenter) {
      return;
    }
    processedCenterRequestNonceRef.current = centerRequest.nonce;
    onCenterRequestHandled(centerRequest.nonce);
  }, [centerOnSettlement, centerRequest?.nonce, centerRequest?.settlementId, onCenterRequestHandled]);

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
    hasInitialAutoCenterRef.current = false;
    hasRestoredViewportRef.current = false;
    processedCenterRequestNonceRef.current = null;
  }, [currentUsername, regionId]);

  useEffect(() => {
    if (hasRestoredViewportRef.current) {
      return;
    }

    const storedViewport = readStoredMapViewport(currentUsername, regionId);
    hasRestoredViewportRef.current = true;
    if (!storedViewport) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const wrap = gridWrapRef.current;
      if (!wrap) {
        return;
      }
      const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      applyPanTarget(maxLeft * storedViewport.leftRatio, maxTop * storedViewport.topRatio, { immediate: true });
      hasInitialAutoCenterRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [applyPanTarget, currentUsername, mapGridSizePx, regionId]);

  useEffect(() => {
    if (gridViewportState.clientWidth <= 1 || gridViewportState.clientHeight <= 1) {
      return;
    }

    if (viewportPersistTimerRef.current != null) {
      window.clearTimeout(viewportPersistTimerRef.current);
    }

    viewportPersistTimerRef.current = window.setTimeout(() => {
      viewportPersistTimerRef.current = null;
      const wrap = gridWrapRef.current;
      if (!wrap) {
        return;
      }
      const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      saveStoredMapViewport(currentUsername, regionId, {
        leftRatio: maxLeft <= 0 ? 0 : clamp(wrap.scrollLeft / maxLeft, 0, 1),
        topRatio: maxTop <= 0 ? 0 : clamp(wrap.scrollTop / maxTop, 0, 1),
      });
    }, 180);

    return () => {
      if (viewportPersistTimerRef.current != null) {
        window.clearTimeout(viewportPersistTimerRef.current);
        viewportPersistTimerRef.current = null;
      }
    };
  }, [
    currentUsername,
    gridViewportState.clientHeight,
    gridViewportState.clientWidth,
    gridViewportState.scrollLeft,
    gridViewportState.scrollTop,
    regionId,
  ]);

  useEffect(() => {
    if (hasInitialAutoCenterRef.current || !focusedSettlementId) {
      return;
    }
    centerOnSettlement(focusedSettlementId, 'auto');
    hasInitialAutoCenterRef.current = true;
  }, [centerOnSettlement, focusedSettlementId, regionId]);

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
      applyPanTarget(panState.startLeft - deltaX, panState.startTop - deltaY, { immediate: true });
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
      if (panState.captureNode && panState.captureNode.hasPointerCapture(event.pointerId)) {
        panState.captureNode.releasePointerCapture(event.pointerId);
      }
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
  }, [applyPanTarget]);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    clearHoverTimeout();

    const target = event.target as HTMLElement;
    const startedFromSettlement = target.closest('.region-cell.settlement') != null;
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
      captureNode: startedFromSettlement ? null : event.currentTarget,
    };
    panTargetScrollRef.current = {
      left: wrap.scrollLeft,
      top: wrap.scrollTop,
    };
    if (!startedFromSettlement) {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  };

  const handleRegionWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY === 0) {
      return;
    }
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
    (clientX: number, clientY: number, options?: { immediate?: boolean }) => {
      const miniMap = miniMapRef.current;
      const wrap = gridWrapRef.current;
      if (!miniMap || !wrap) {
        return;
      }

      const rect = miniMap.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const ratioX = clamp((clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((clientY - rect.top) / rect.height, 0, 1);
      const contentInset = readWrapContentInset(wrap);
      const mapSpanPx = Math.max(cellSize, mapGridSizePx);
      const targetLeft = contentInset.left + ratioX * mapSpanPx - wrap.clientWidth / 2;
      const targetTop = contentInset.top + ratioY * mapSpanPx - wrap.clientHeight / 2;

      applyPanTarget(targetLeft, targetTop, options);
    },
    [applyPanTarget, cellSize, mapGridSizePx, readWrapContentInset],
  );

  const handleMinimapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    miniMapDragPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    jumpToMinimapPoint(event.clientX, event.clientY, { immediate: true });
  };

  const handleMinimapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (miniMapDragPointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    jumpToMinimapPoint(event.clientX, event.clientY, { immediate: true });
  };

  const handleMinimapPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (miniMapDragPointerIdRef.current !== event.pointerId) {
      return;
    }
    miniMapDragPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleMinimapPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (miniMapDragPointerIdRef.current !== event.pointerId) {
      return;
    }
    miniMapDragPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const mapCanvasMarkers = useMemo<MapSettlementCanvasMarker[]>(
    () =>
      mapRenderSettlements.map(({ settlement, localX, localY }) => {
        const mapKind = getSettlementMapKind(settlement, activeVillageId);
        const prestigeMeta = resolveSettlementPrestigeMeta(Number(settlement.prestige ?? 0));
        const markerState =
          settlement.villageId != null
            ? orderMarkersByVillageId.get(Number(settlement.villageId)) ?? null
            : null;
        const coverageCommandTypes = markerState
          ? MAP_ORDER_COMMAND_TYPES.filter((commandType) => Number(markerState[commandType] ?? 0) > 0)
          : [];
        const orderBadges: SettlementCanvasOrderBadge[] = [];
        if (markerState) {
          for (const commandType of MAP_ORDER_COMMAND_TYPES) {
            const count = Number(markerState[commandType] ?? 0);
            if (count > 0) {
              orderBadges.push({
                kind: commandType,
                symbol: getArmyCommandSymbol(commandType),
                count,
              });
            }
          }
          const knightAttackCount = Number(markerState.knightAttack ?? 0);
          if (knightAttackCount > 0) {
            orderBadges.push({
              kind: 'knight-attack',
              symbol: '♞',
              count: knightAttackCount,
            });
          }
        }

        return {
          settlement,
          localX,
          localY,
          mapKind,
          prestigeMeta,
          isFocused: focusedSettlementId === settlement.id,
          coverageCommandTypes,
          orderBadges,
          hasOrderMarker: orderBadges.length > 0,
        };
      }),
    [activeVillageId, focusedSettlementId, mapRenderSettlements, orderMarkersByVillageId],
  );

  const settlementMarkers = useMemo(
    () =>
      mapCanvasMarkers.map((marker) => {
        const { settlement, localX, localY, mapKind, prestigeMeta, isFocused, hasOrderMarker } = marker;
        return (
          <button
            key={settlement.id}
            className={`region-cell settlement map-settlement-hit-target ${mapKind} prestige-tier-${prestigeMeta.tier.toLocaleLowerCase('cs-CZ')} ${isFocused ? 'focused' : ''} ${hasOrderMarker ? 'has-order-marker' : ''}`}
            data-settlement-id={settlement.id}
            aria-label={`${settlement.name} (${settlement.globalX}|${settlement.globalY})`}
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
              onOpenSettlement(settlement);
              setHoveredId(settlement.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (Date.now() < dragSuppressClickUntilRef.current) {
                return;
              }
              clearHoverTimeout();
              setPinnedSettlementId((previous) => (previous === settlement.id ? null : settlement.id));
              setHoveredId(settlement.id);
            }}
            title={`${settlement.name} (${settlement.globalX}|${settlement.globalY}) • ${prestigeMeta.label} (${prestigeMeta.letter})`}
          >
            {showSettlementBannerCards && shouldShowCtrlSettlementBanner(settlement) ? (
              <span
                className={`map-settlement-banner ${mapKind} prestige-tier-${prestigeMeta.tier.toLocaleLowerCase('cs-CZ')} ${isFocused ? 'is-highlighted' : ''}`}
                aria-hidden="true"
              >
                <span className="map-settlement-banner-kicker">
                  <span>{MAP_SETTLEMENT_KIND_LABELS[mapKind]}</span>
                  <span className="map-settlement-banner-divider">✦</span>
                  <span>{prestigeMeta.letter}</span>
                </span>
                <strong className="map-settlement-banner-title">{settlement.name}</strong>
                <span className="map-settlement-banner-meta">
                  <span>{settlement.owner}</span>
                  <span>{Math.max(0, Math.floor(Number(settlement.prestige ?? 0))).toLocaleString('cs-CZ')}</span>
                </span>
              </span>
            ) : null}
          </button>
        );
      }),
    // Marker visuals live on canvas; DOM markers remain only as lightweight interaction targets.
    [
      clearHoverTimeout,
      mapCanvasMarkers,
      onOpenSettlement,
      scheduleHoveredSettlementClear,
      showSettlementBannerCards,
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
  const previewCardPortalStyle = useMemo<CSSProperties | null>(() => {
    if (!previewCardStyle || !previewSettlement || typeof window === 'undefined') {
      return null;
    }
    if (gridViewportState.clientWidth <= 0 || gridViewportState.clientHeight <= 0) {
      return null;
    }
    const rawLeft = Number.parseFloat(String(previewCardStyle.left ?? '0'));
    const rawTop = Number.parseFloat(String(previewCardStyle.top ?? '0'));
    const rawWidth = Number.parseFloat(String(previewCardStyle.width ?? MAP_PREVIEW_CARD_WIDTH_PX));
    if (!Number.isFinite(rawLeft) || !Number.isFinite(rawTop) || !Number.isFinite(rawWidth)) {
      return null;
    }
    const cardHeight = isPreviewPinned ? MAP_PREVIEW_CARD_PINNED_HEIGHT_PX : MAP_PREVIEW_CARD_HOVER_HEIGHT_PX;
    const viewportLeft = gridViewportState.wrapLeft + rawLeft - gridViewportState.scrollLeft;
    const viewportTop = gridViewportState.wrapTop + rawTop - gridViewportState.scrollTop;
    const maxLeft = Math.max(TOOLTIP_VIEWPORT_PADDING, window.innerWidth - rawWidth - TOOLTIP_VIEWPORT_PADDING);
    const maxTop = Math.max(TOOLTIP_VIEWPORT_PADDING, window.innerHeight - cardHeight - TOOLTIP_VIEWPORT_PADDING);
    const safeLeft = clamp(viewportLeft, TOOLTIP_VIEWPORT_PADDING, maxLeft);
    const safeTop = clamp(viewportTop, TOOLTIP_VIEWPORT_PADDING, maxTop);

    return {
      width: `${Math.round(rawWidth)}px`,
      left: `${Math.round(safeLeft)}px`,
      top: `${Math.round(safeTop)}px`,
    };
  }, [
    gridViewportState.clientHeight,
    gridViewportState.clientWidth,
    gridViewportState.wrapLeft,
    gridViewportState.wrapTop,
    gridViewportState.scrollLeft,
    gridViewportState.scrollTop,
    isPreviewPinned,
    previewCardStyle,
    previewSettlement,
  ]);
  const renderPreviewSettlementCard = (cardStyle: CSSProperties, usePortal: boolean) => {
    const ownerLabel = isPreviewAbandoned ? 'opuštěná osada' : (previewSettlement?.owner ?? 'neznámý hráč');
    const settlementPrestige = Math.max(0, Math.floor(Number(previewSettlement?.prestige ?? 0)));
    const playerTotalPrestige = Math.max(
      settlementPrestige,
      Math.floor(Number(previewPlayerTotalPrestige ?? settlementPrestige)),
    );
    const kingdomLabel = String(previewSettlement?.kingdom ?? '').trim() || 'Neutral';
    const coordinatesLabel =
      previewSettlement != null
        ? `${Math.round(Number(previewSettlement.globalX))}|${Math.round(Number(previewSettlement.globalY))}`
        : '-';
    const isPreviewOwnedByPlayer =
      previewSettlementKind === 'active' ||
      previewSettlementKind === 'own' ||
      previewSettlementKind === 'allied' ||
      previewSettlementKind === 'opponent' ||
      previewSettlementKind === 'enemy' ||
      previewSettlementKind === 'nap';
    const shouldShowPlayerTotalPrestige =
      previewPlayerTotalPrestige != null &&
      previewSettlementKind !== 'abandoned' &&
      previewSettlementKind !== 'bot';
    const shouldShowKingdomTotalPrestige =
      previewKingdomTotalPrestige != null &&
      previewSettlementKind !== 'abandoned' &&
      previewSettlementKind !== 'bot' &&
      previewSettlementKind !== 'own' &&
      previewSettlementKind !== 'active';

    return (
      <article
        className={`map-settlement-info-card ${usePortal ? 'is-portal' : ''} ${isPreviewPinned ? 'is-pinned' : 'is-hover'} ${isPreviewPlayerSettlement ? 'is-player' : ''} ${previewPrestigeTier ? `prestige-tier-${previewPrestigeTier.toLocaleLowerCase('cs-CZ')}` : ''}`}
        style={cardStyle}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onWheel={handleRegionWheel}
      >
        <header>
          <h4>{previewSettlement?.name}</h4>
        </header>
        <div className="map-settlement-info-body">
          <div className="map-settlement-overview">
            <p className={`map-settlement-owner ${isPreviewOwnedByPlayer ? 'player-owner' : ''}`}>
              <span className="map-settlement-owner-label">Hráč</span>
              <strong className="map-settlement-owner-value tld-type-heading">{ownerLabel}</strong>
            </p>
            <p className="map-settlement-kingdom">
              Království <strong className="map-settlement-owner-value tld-type-heading">{kingdomLabel}</strong>{' '}
              <em>
                ({previewSettlementTypeLabel}
                {shouldShowKingdomTotalPrestige ? ` · ${previewKingdomTotalPrestige.toLocaleString('cs-CZ')}` : ''})
              </em>
            </p>
            <p className="map-settlement-prestige-total">
              Hráč celkem <strong className="map-settlement-prestige-total-value tld-type-value">{playerTotalPrestige.toLocaleString('cs-CZ')}</strong>
            </p>
            <p className="map-settlement-prestige">
              Prestiž léna <strong className="map-settlement-prestige-value tld-type-value">{settlementPrestige.toLocaleString('cs-CZ')}</strong>{' '}
              {shouldShowPlayerTotalPrestige ? <em>(detail léna)</em> : null}
            </p>
            <div className="map-settlement-copy-row">
              <span>
                Souřadnice <strong className="map-settlement-detail-value tld-type-value">{coordinatesLabel}</strong>
              </span>
              <button
                type="button"
                className="secondary-action map-settlement-copy-button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopySettlementCoordinates(previewSettlement ?? null);
                }}
                title="Kopírovat souřadnice léna"
                aria-label="Kopírovat souřadnice léna"
              >
                Kopírovat
              </button>
            </div>
            {copyCoordsFeedback ? <p className="map-settlement-copy-feedback">{copyCoordsFeedback}</p> : null}
            <p className="map-settlement-distance">
              Vzdálenost od <em>{distanceOriginSettlement?.name ?? 'aktivního léna'}</em>{' '}
              <strong className="map-settlement-detail-value tld-type-value">
                {previewDistanceTiles == null ? '-' : `${previewDistanceTiles} polí`}
              </strong>
            </p>
            {showPreviewTravelDurations ? (
              <div className="map-settlement-travel-times">
                <p>
                  Časy přesunu (<span className="map-settlement-travel-hint-key tld-type-heading">Ctrl</span>)
                </p>
                <ul>
                  {previewTravelRows.map((row) => (
                    <li key={`preview-travel-${row.unitId}`}>
                      <span>{getUnitMetaById(row.unitId).fallbackName}</span>
                      <span>
                        Útok: {formatDurationLabel(row.attackDurationSec)}
                        {row.supportDurationSec != null ? ` · Podpora: ${formatDurationLabel(row.supportDurationSec)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {previewTargetUnderProtection ? (
              <p className="map-settlement-protection">
                Nováčkovská ochrana: {formatDurationLabel(Number(previewSettlement?.protectionRemainingSec ?? 0))}
              </p>
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
                    key={`${previewSettlement?.id}-${commandType}-quick`}
                    type="button"
                    className={`secondary-action map-settlement-action ${commandType}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!previewCommandAvailability[commandType] || !previewSettlement) {
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
                    {commandType === 'attack' ? 'Zaútočit' : commandType === 'support' ? 'Podpořit' : 'Přesunout jednotky'}
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
                  if (previewSettlement) {
                    onPinSettlement(previewSettlement, 'left');
                  }
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
                  if (previewSettlement) {
                    onPinSettlement(previewSettlement, 'right');
                  }
                }}
              >
                →
              </button>
              <span>Zapinovat osadu</span>
            </div>
          </>
        ) : null}
      </article>
    );
  };
  return (
    <div className={`map-panel ${isMapFullscreen ? 'is-fullscreen' : ''}`} ref={mapPanelRef}>
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
            <img
              className="map-background-art"
              src={MAP_BACKGROUND_ART_PATH}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
            />
            <MapSettlementCanvasLayer
              markers={mapCanvasMarkers}
              cellSize={cellSize}
              cellGap={mapCellGapPx}
              gridSizePx={mapGridSizePx}
            />
            {settlementMarkers}
            {shouldShowHoveredOverlay || pinnedOverlayCell ? (
              <div className="map-settlement-state-overlay-layer" aria-hidden="true">
                {shouldShowHoveredOverlay && hoveredOverlayCell ? (
                  <span
                    className={`map-settlement-state-overlay is-hover ${hoveredOverlayCell.mapKind === 'opponent' || hoveredOverlayCell.mapKind === 'enemy' || hoveredOverlayCell.mapKind === 'nap' ? 'is-player-target' : ''}`}
                    style={{
                      gridColumnStart: hoveredOverlayCell.localX,
                      gridRowStart: hoveredOverlayCell.localY,
                    }}
                  />
                ) : null}
                {pinnedOverlayCell ? (
                  <span
                    className={`map-settlement-state-overlay is-pinned ${pinnedOverlayCell.mapKind === 'opponent' || pinnedOverlayCell.mapKind === 'enemy' || pinnedOverlayCell.mapKind === 'nap' ? 'is-player-target' : ''}`}
                    style={{
                      gridColumnStart: pinnedOverlayCell.localX,
                      gridRowStart: pinnedOverlayCell.localY,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {previewSettlement && previewCardStyle && !previewCardPortalStyle
              ? renderPreviewSettlementCard(previewCardStyle, false)
              : null}
          </div>
        </div>
        <div className="map-window-overlays">
          <section className="map-legend map-legend-overlay" aria-label="Legenda barev lén">
            <span className="legend active">Aktivní</span>
            <span className="legend own">Moje</span>
            <span className="legend bot">Bot</span>
            <span className="legend royal">Královská</span>
            <span className="legend allied">Spojenecká</span>
            <span className="legend nap">NAP</span>
            <span className="legend opponent">Protivník</span>
            <span className="legend enemy">Nepřítel</span>
            <span className="legend abandoned">Opuštěná</span>
          </section>
          <section
            className="map-navigation map-navigation-overlay"
            onWheel={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="mini-map-shell">
              <div
                className="mini-map"
                ref={miniMapRef}
                onPointerDown={handleMinimapPointerDown}
                onPointerMove={handleMinimapPointerMove}
                onPointerUp={handleMinimapPointerUp}
                onPointerCancel={handleMinimapPointerCancel}
                onLostPointerCapture={handleMinimapPointerCancel}
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
                  Měřítko: {zoomLabelValue}%
                </label>
                <input
                  id="map-zoom-range"
                  type="range"
                  min={MAP_ZOOM_MIN}
                  max={MAP_ZOOM_MAX}
                  step={MAP_ZOOM_STEP}
                  value={zoomSliderValue}
                  onChange={(event) => applyZoom(Number(event.target.value))}
                />
                <div className="map-zoom-buttons">
                  <button
                    type="button"
                    className="icon-only"
                    onClick={() => applyZoom(0)}
                    title="Nastavit měřítko mapy na 100 %"
                    aria-label="Nastavit měřítko mapy na 100 %"
                  >
                    <span className="symbol" aria-hidden="true">
                      ⊟
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-only"
                    onClick={() => applyZoom(200)}
                    title="Nastavit měřítko mapy na 300 %"
                    aria-label="Nastavit měřítko mapy na 300 %"
                  >
                    <span className="symbol" aria-hidden="true">
                      ⊞
                    </span>
                  </button>
                </div>
                <div className="mini-map-actions">
                  <button
                    type="button"
                    className="mini-map-action-button"
                    onClick={() => centerOnSettlement(distanceOriginSettlement?.id ?? ownSettlement?.id ?? null, 'smooth')}
                    title="Centrovat mapu na aktivní léno"
                    aria-label="Centrovat mapu na aktivní léno"
                  >
                    <span className="symbol" aria-hidden="true">
                      ⌖
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mini-map-action-button map-fullscreen-toggle icon-only"
                    onClick={() => {
                      void toggleMapFullscreen();
                    }}
                    title={isMapFullscreen ? 'Ukončit režim celé obrazovky' : 'Celá obrazovka'}
                    aria-label={isMapFullscreen ? 'Ukončit režim celé obrazovky' : 'Celá obrazovka'}
                  >
                    <span className="symbol" aria-hidden="true">
                      ⛶
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {previewSettlement && previewCardPortalStyle && typeof document !== 'undefined'
        ? createPortal(renderPreviewSettlementCard(previewCardPortalStyle, true), document.body)
        : null}
    </div>
  );
});

const VillagePanel = memo(({
  settlement,
  villageIntelEntry,
  canLoadVillageIntel,
  onLoadVillageIntel,
  showVillageNavigation,
  canNavigateToPreviousVillage,
  canNavigateToNextVillage,
  onNavigateToPreviousVillage,
  onNavigateToNextVillage,
}: {
  settlement: RegionSettlement;
  villageIntelEntry: VillageIntelEntry | null;
  canLoadVillageIntel: boolean;
  onLoadVillageIntel: (options?: { force?: boolean }) => void;
  showVillageNavigation: boolean;
  canNavigateToPreviousVillage: boolean;
  canNavigateToNextVillage: boolean;
  onNavigateToPreviousVillage: () => void;
  onNavigateToNextVillage: () => void;
}) => {
  const targetVillageId =
    settlement.villageId != null && Number.isFinite(settlement.villageId)
      ? Number(settlement.villageId)
      : null;
  const [hoveredIntelTooltipKey, setHoveredIntelTooltipKey] = useState<string | null>(null);
  const [intelTooltipCursorPosition, setIntelTooltipCursorPosition] = useState<TooltipCursorPosition | null>(null);
  const villageIntelStatus: VillageIntelStatus = villageIntelEntry?.status ?? 'idle';
  const villageIntelData = villageIntelEntry?.data ?? null;
  const villageIntelError = villageIntelEntry?.error ?? null;
  const isVillageIntelLoading = villageIntelStatus === 'loading';
  const hasVillageIntel = villageIntelStatus === 'ready' && villageIntelData != null;
  const isVillageIntelUnavailable = !canLoadVillageIntel || targetVillageId == null;
  const buildingQueueTooltipRows = useMemo(
    () =>
      (villageIntelData?.buildingQueue ?? []).map((queueItem, index) => ({
        label: `#${index + 1} · ${queueItem.buildingName} (${queueItem.fromLevel}→${queueItem.toLevel})`,
        value: `${formatDurationLabel(queueItem.remainingSec)} · ${formatDateTimeLabel(queueItem.finishAt)}`,
      })),
    [villageIntelData?.buildingQueue],
  );
  const activeRecruitQueueItem = villageIntelData?.recruitQueue?.[0] ?? null;
  const activeRecruitTooltipRows = useMemo(
    () =>
      activeRecruitQueueItem
        ? [
            {
              label: `${activeRecruitQueueItem.unitName} +${activeRecruitQueueItem.amount.toLocaleString('cs-CZ')}`,
              value: `Dokončení ${formatDateTimeLabel(activeRecruitQueueItem.finishAt)} · zbývá ${formatDurationLabel(
                activeRecruitQueueItem.remainingSec,
              )}`,
            },
          ]
        : [
            {
              label: 'Aktuální rekrut',
              value:
                isVillageIntelLoading ? 'Načítám…' : hasVillageIntel ? 'Bez aktivního náboru' : 'Nedostupné',
            },
          ],
    [activeRecruitQueueItem, hasVillageIntel, isVillageIntelLoading],
  );
  const queueTooltipRows =
    buildingQueueTooltipRows.length > 0
      ? buildingQueueTooltipRows
      : [
          {
            label: 'Fronta výstavby',
            value: isVillageIntelLoading ? 'Načítám…' : 'Bez položek ve frontě.',
          },
        ];
  const garrisonTooltipRows = useMemo(() => {
    if (isVillageIntelLoading) {
      return [
        {
          label: 'Posádka',
          value: 'Načítám detail…',
        },
      ];
    }
    if (!hasVillageIntel || !villageIntelData) {
      return [
        {
          label: 'Posádka',
          value: 'Detail není dostupný.',
        },
      ];
    }
    if (!villageIntelData.garrisonUnlocked) {
      return [
        {
          label: 'Posádka uzamčena',
          value: 'Odemkne se od Radnice 5.',
        },
      ];
    }
    return villageIntelData.garrisonDetails.map((unit) => {
      const amountLabel = `${unit.amount.toLocaleString('cs-CZ')}/${unit.cap.toLocaleString('cs-CZ')}`;
      const missingLabel =
        unit.missing > 0 ? `chybí ${unit.missing.toLocaleString('cs-CZ')}` : 'plný stav';
      const refillLabel = unit.refillSecPerUnit > 0 ? `+1/${formatDurationLabel(unit.refillSecPerUnit)}` : '+1/n/a';
      const nextRefillLabel =
        unit.missing > 0 && unit.nextRefillSec != null
          ? `další za ${formatDurationLabel(unit.nextRefillSec)}`
          : null;
      return {
        label: `${unit.unitName} ${amountLabel}`,
        value: nextRefillLabel == null ? `${missingLabel} · ${refillLabel}` : `${missingLabel} · ${refillLabel} · ${nextRefillLabel}`,
      };
    });
  }, [hasVillageIntel, isVillageIntelLoading, villageIntelData]);
  const compactResourceRows = useMemo(
    () => [
      { key: 'wood', label: 'Dřevo', value: formatCompactResourceAmount(villageIntelData?.resources.wood ?? 0) },
      { key: 'stone', label: 'Kámen', value: formatCompactResourceAmount(villageIntelData?.resources.stone ?? 0) },
      { key: 'iron', label: 'Železo', value: formatCompactResourceAmount(villageIntelData?.resources.iron ?? 0) },
      { key: 'gold', label: 'Zlato', value: formatCompactResourceAmount(villageIntelData?.resources.gold ?? 0) },
      { key: 'coins', label: 'Mince', value: formatCompactResourceAmount(villageIntelData?.resources.coins ?? 0) },
    ],
    [
      villageIntelData?.resources.coins,
      villageIntelData?.resources.gold,
      villageIntelData?.resources.iron,
        villageIntelData?.resources.stone,
        villageIntelData?.resources.wood,
    ],
  );
  const villageUnitSummaryItems = useMemo(
    () => villageIntelData?.unitSummaries ?? [],
    [villageIntelData?.unitSummaries],
  );
  const villageUnitTooltipRowsById = useMemo<Record<string, Array<{ label: string; value: string }>>>(() => {
    const rowsById: Record<string, Array<{ label: string; value: string }>> = {};
    for (const unit of villageUnitSummaryItems) {
      const ownAmount = Math.max(0, Math.floor(Number(unit.ownAmount ?? 0)));
      const supportAmount = Math.max(0, Math.floor(Number(unit.supportAmount ?? 0)));
      const totalAmount = ownAmount + supportAmount;
      const attackPerUnit = resolveAttackPowerByUnitId(unit.unitId);
      const defensePerUnit = resolveDefensePowerByUnitId(unit.unitId);
      const travelSpeed = resolveTravelSpeedByUnitId(unit.unitId);
      const totalAttack = totalAmount * attackPerUnit;
      const totalDefense = totalAmount * defensePerUnit;

      rowsById[unit.unitId] = [
        {
          label: 'Síla na 1 jednotku',
          value: `Útok ${attackPerUnit.toLocaleString('cs-CZ')} · Obrana ${defensePerUnit.toLocaleString('cs-CZ')}`,
        },
        {
          label: `Souhrnná síla (${unit.unitName.toLowerCase()})`,
          value: `Útok ${formatCompactResourceAmount(totalAttack)} · Obrana ${formatCompactResourceAmount(totalDefense)}`,
        },
        {
          label: 'Stav v lénu',
          value: `${formatCompactResourceAmount(ownAmount)} vlastní · ${formatCompactResourceAmount(supportAmount)} podpora`,
        },
        {
          label: 'Rychlost',
          value: travelSpeed > 0 ? `${travelSpeed.toLocaleString('cs-CZ')} polí / hod` : 'Nehybná jednotka',
        },
      ];
    }
    return rowsById;
  }, [villageUnitSummaryItems]);
  const activeVillageUnitTooltip = useMemo(() => {
    if (!hoveredIntelTooltipKey || !hoveredIntelTooltipKey.startsWith('unit-summary-')) {
      return null;
    }
    const unitId = hoveredIntelTooltipKey.slice('unit-summary-'.length);
    const unit = villageUnitSummaryItems.find((candidate) => candidate.unitId === unitId);
    if (!unit) {
      return null;
    }
    return {
      title: unit.unitName,
      rows: villageUnitTooltipRowsById[unitId] ?? [],
    };
  }, [hoveredIntelTooltipKey, villageUnitSummaryItems, villageUnitTooltipRowsById]);
  const villagePanelContentRef = useRef<HTMLDivElement | null>(null);
  const [titlePortalHost, setTitlePortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const panelContentNode = villagePanelContentRef.current;
    if (!panelContentNode) {
      return;
    }
    const villageWindowNode = panelContentNode.closest('.floating-window.village-panel-window');
    setTitlePortalHost(villageWindowNode instanceof HTMLElement ? villageWindowNode : null);
  }, []);

  useEffect(() => {
    if (!canLoadVillageIntel || targetVillageId == null) {
      return;
    }
    if (villageIntelStatus === 'loading' || villageIntelStatus === 'ready') {
      return;
    }
    onLoadVillageIntel();
  }, [canLoadVillageIntel, onLoadVillageIntel, targetVillageId, villageIntelStatus]);

  const handleIntelTooltipEnter = (tooltipKey: string, cursor: TooltipCursorPosition) => {
    setHoveredIntelTooltipKey(tooltipKey);
    setIntelTooltipCursorPosition(cursor);
  };
  const handleIntelTooltipLeave = (tooltipKey: string) => {
    setHoveredIntelTooltipKey((previous) => (previous === tooltipKey ? null : previous));
    setIntelTooltipCursorPosition(null);
  };
  const villageTitleModule = (
    <div className="village-title-module-layer" aria-hidden={false}>
      <div className="village-float-title-block" role="group" aria-label="Hlavička léna">
        {showVillageNavigation ? (
          <div className="village-float-title-nav">
            <button
              type="button"
              className="village-title-nav-button is-prev"
              onClick={onNavigateToPreviousVillage}
              disabled={!canNavigateToPreviousVillage}
              aria-label="Přejít na předchozí léno v seznamu"
              title="Předchozí léno"
            >
              <img src={VILLAGE_NAV_ARROW_ICON_SRC} alt="" loading="lazy" decoding="async" draggable={false} />
            </button>
            <div className="village-title-nav-copy">
              <h3>
                {settlement.name} ({settlement.globalX}|{settlement.globalY})
              </h3>
              <p>
                {settlement.owner} · {settlement.kingdom} · Region {settlement.region}
              </p>
            </div>
            <button
              type="button"
              className="village-title-nav-button is-next"
              onClick={onNavigateToNextVillage}
              disabled={!canNavigateToNextVillage}
              aria-label="Přejít na další léno v seznamu"
              title="Další léno"
            >
              <img src={VILLAGE_NAV_ARROW_ICON_SRC} alt="" loading="lazy" decoding="async" draggable={false} />
            </button>
          </div>
        ) : (
          <>
            <h3>
              {settlement.name} ({settlement.globalX}|{settlement.globalY})
            </h3>
            <p>
              {settlement.owner} · {settlement.kingdom} · Region {settlement.region}
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={villagePanelContentRef} className="panel-stack village-panel village-panel-compact">
      {titlePortalHost ? createPortal(villageTitleModule, titlePortalHost) : null}
      <section className="village-float-overview">
        <header className="village-float-overview-header">
          <div className="village-float-overview-actions">
            <div className="village-float-quick-icons" role="toolbar" aria-label="Rychlé informace léna">
              <button
                type="button"
                className={`village-quick-icon has-army-tooltip${hoveredIntelTooltipKey === 'active-recruit' ? ' is-tooltip-open' : ''}`}
                onMouseEnter={(event) => {
                  handleIntelTooltipEnter('active-recruit', { x: event.clientX, y: event.clientY });
                }}
                onMouseMove={(event) => {
                  if (hoveredIntelTooltipKey !== 'active-recruit') {
                    return;
                  }
                  setIntelTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                }}
                onMouseLeave={() => {
                  handleIntelTooltipLeave('active-recruit');
                }}
                aria-label="Aktuální rekrut"
              >
                ⚔
              </button>
              <button
                type="button"
                className={`village-quick-icon has-army-tooltip${hoveredIntelTooltipKey === 'building-queue' ? ' is-tooltip-open' : ''}`}
                onMouseEnter={(event) => {
                  handleIntelTooltipEnter('building-queue', { x: event.clientX, y: event.clientY });
                }}
                onMouseMove={(event) => {
                  if (hoveredIntelTooltipKey !== 'building-queue') {
                    return;
                  }
                  setIntelTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                }}
                onMouseLeave={() => {
                  handleIntelTooltipLeave('building-queue');
                }}
                aria-label="Stavební fronta"
              >
                🧱
              </button>
              {canLoadVillageIntel ? (
                <button
                  type="button"
                  className="village-quick-icon"
                  onClick={() => onLoadVillageIntel({ force: true })}
                  disabled={isVillageIntelLoading}
                  aria-label="Obnovit detail léna"
                >
                  ↻
                </button>
              ) : null}
            </div>
          </div>

          <div className="village-float-header-resources" aria-label="Suroviny léna">
            {compactResourceRows.map((resource) => {
              const resourceIcon = resolveResourceGlyph(resource.label);
              return (
                <span key={`village-inline-resource-${resource.key}`} className="village-inline-resource-pill">
                  <i aria-hidden="true" className="village-inline-resource-icon">
                    {resourceIcon.startsWith('/') ? (
                      <img src={resourceIcon} alt="" loading="lazy" decoding="async" draggable={false} />
                    ) : (
                      resourceIcon
                    )}
                  </i>
                  <span className="village-inline-resource-value tld-type-value">{resource.value}</span>
                </span>
              );
            })}
          </div>
        </header>

        <div className="village-unit-summary-grid" aria-label="Jednotky v léně">
          {villageUnitSummaryItems.length > 0 ? (
            villageUnitSummaryItems.map((unit) => {
              const unitTooltipKey = `unit-summary-${unit.unitId}`;
              const isUnitTooltipOpen = hoveredIntelTooltipKey === unitTooltipKey;
              const unitMeta = getUnitMetaById(unit.unitId);
              const unitCardImage = VILLAGE_UNIT_CARD_ICON_BY_ID[unit.unitId] ?? unitMeta.icon;
              return (
                <article
                  key={`village-unit-summary-${unit.unitId}`}
                  className={`village-unit-summary-card village-unit-type-card has-army-tooltip${isUnitTooltipOpen ? ' is-tooltip-open' : ''}`}
                  aria-label={`${unit.unitName}: vlastní ${unit.ownAmount.toLocaleString('cs-CZ')}, podpora ${unit.supportAmount.toLocaleString('cs-CZ')}`}
                  style={{ '--unit-card-image': `url("${unitCardImage}")` } as CSSProperties}
                  onMouseEnter={(event) => {
                    handleIntelTooltipEnter(unitTooltipKey, { x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    if (!isUnitTooltipOpen) {
                      return;
                    }
                    setIntelTooltipCursorPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => {
                    handleIntelTooltipLeave(unitTooltipKey);
                  }}
                >
                  <strong className="village-unit-value tld-type-value">{formatCompactResourceAmount(unit.ownAmount)}</strong>
                  <strong className="village-unit-support tld-type-value">
                    ({formatCompactResourceAmount(unit.supportAmount)})
                  </strong>
                  <div className="village-unit-type-header">
                    <span className="unit-icon-shell" aria-hidden="true">
                      <img src={unitMeta.icon} alt="" className="unit-icon-image" loading="lazy" />
                    </span>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="village-unit-summary-empty">
              {hasVillageIntel ? 'Bez jednotek' : isVillageIntelLoading ? 'Načítám...' : 'Bez dat'}
            </p>
          )}
        </div>

        <div className="village-float-intel-grid">
          <article className="village-float-intel-card village-fortification-card">
            <h4>Obrana</h4>
            <div className="village-fortification-levels">
              <span>
                <img src={BUILDING_ART.fortification.icon} alt="" loading="lazy" decoding="async" />
                Opevnění <span className="village-fortification-value tld-type-value">{(villageIntelData?.fortificationLevel ?? 0).toLocaleString('cs-CZ')}</span>
              </span>
              <span>
                <img src={BUILDING_ART.gate.icon} alt="" loading="lazy" decoding="async" />
                Brána <span className="village-fortification-value tld-type-value">{(villageIntelData?.gateLevel ?? 0).toLocaleString('cs-CZ')}</span>
              </span>
            </div>
          </article>

          <article
            className={`village-float-intel-card village-garrison-card has-army-tooltip${hoveredIntelTooltipKey === 'garrison-detail' ? ' is-tooltip-open' : ''}`}
            onMouseEnter={(event) => {
              handleIntelTooltipEnter('garrison-detail', { x: event.clientX, y: event.clientY });
            }}
            onMouseMove={(event) => {
              if (hoveredIntelTooltipKey !== 'garrison-detail') {
                return;
              }
              setIntelTooltipCursorPosition({ x: event.clientX, y: event.clientY });
            }}
            onMouseLeave={() => {
              handleIntelTooltipLeave('garrison-detail');
            }}
            aria-label="Detail posádky"
          >
            <h4>Posádka</h4>
            <span className="village-garrison-value tld-type-value">
              {hasVillageIntel
                ? `${(villageIntelData?.garrisonUnits ?? 0).toLocaleString('cs-CZ')} jednotek`
                : '300 jednotek'}
            </span>
            <span>
              {hasVillageIntel && villageIntelData && !villageIntelData.garrisonUnlocked
                ? 'Posádka se odemyká od Radnice 5. Rezervace 300 populace je aktivní hned.'
                : 'Statická obrana léna (ozbrojenci + lučištníci) s průběžnou obnovou.'}
            </span>
          </article>
        </div>

        {isVillageIntelLoading ? <p className="row-help">Načítám detail front a obrany tohoto léna...</p> : null}
        {isVillageIntelUnavailable ? (
          <p className="row-help">Detail front je dostupný jen pro tvoje vlastní léna.</p>
        ) : null}
        {!isVillageIntelLoading && villageIntelError ? <p className="panel-feedback">{villageIntelError}</p> : null}
      </section>

      {hoveredIntelTooltipKey === 'active-recruit' ? (
        <VillageIntelTooltip
          title="Aktuální rekrut"
          rows={activeRecruitTooltipRows}
          cursorPosition={intelTooltipCursorPosition}
        />
      ) : null}
      {hoveredIntelTooltipKey === 'building-queue' ? (
        <VillageIntelTooltip
          title="Fronta výstavby"
          rows={queueTooltipRows}
          cursorPosition={intelTooltipCursorPosition}
        />
      ) : null}
      {hoveredIntelTooltipKey === 'garrison-detail' ? (
        <VillageIntelTooltip
          title="Posádka"
          rows={garrisonTooltipRows}
          cursorPosition={intelTooltipCursorPosition}
        />
      ) : null}
      {activeVillageUnitTooltip ? (
        <VillageIntelTooltip
          title={activeVillageUnitTooltip.title}
          rows={activeVillageUnitTooltip.rows}
          cursorPosition={intelTooltipCursorPosition}
        />
      ) : null}
    </div>
  );
});

const TownhallDeveloperBoostCallout = memo(({ boost }: { boost: TownhallDeveloperBoostNotice | null }) => {
  const nowMs = useSecondClock(boost != null);
  if (!boost) {
    return null;
  }

  const remainingSec = getRemainingSecondsToIso(boost.endsAt, nowMs);
  const isActive = boost.isActive && remainingSec > 0;

  return (
    <div className={`townhall-dev-boost ${isActive ? 'is-active' : 'is-inactive'}`}>
      <p className="townhall-dev-boost-title">
        {isActive ? `Boost od vývojáře: ${boost.label}` : 'Boost od vývojáře je ukončen'}
      </p>
      <p className="townhall-dev-boost-meta">
        {isActive
          ? `Trvání: ${formatDurationLabel(remainingSec)} (konec ${boost.endsAtLabel})`
          : `Boost skončil ${boost.endsAtLabel}.`}
      </p>
      <p className="townhall-dev-boost-reason">{boost.reason}</p>
    </div>
  );
});

const ActiveVillageProtectionTimer = memo(({ notice }: { notice: ActiveVillageProtectionNotice | null }) => {
  const nowMs = useSecondClock(notice != null);
  if (!notice) {
    return null;
  }

  const remainingSec = getRemainingSecondsToIso(notice.protectionUntil, nowMs);
  if (remainingSec <= 0) {
    return null;
  }

  return (
    <div className="village-protection-timer">
      {`Nováčkovská ochrana: ${formatDurationLabel(remainingSec)} (do ${notice.formattedUntil})`}
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
          Poznámka: 300 populace je systémově rezervováno pro posádku (ozbrojenci + lučištníci), aby se obrana
          obnovovala stabilně a nebylo možné tuto rezervaci obejít rekrutem. Aktivní posádka se odemyká od Radnice 5.
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
              Rytíř v osadě:{' '}
              <strong className="building-knight-value tld-type-value">
                {Math.max(0, Math.floor(knightCount)).toLocaleString('cs-CZ')}
              </strong>
            </p>
            <button
              type="button"
              className="secondary-action"
              onClick={() => onRecallKnight?.()}
              disabled={isRecallKnightPending || knightCount <= 0 || onRecallKnight == null}
            >
              {isRecallKnightPending ? 'Odvolávám rytíře...' : 'Odvolat rytíře (+1000 dřevo/kámen/železo)'}
            </button>
            <TownhallDeveloperBoostCallout boost={developerBoost} />
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
  const villageRenameWrapRef = useRef<HTMLDivElement | null>(null);
  const villageRenameInputRef = useRef<HTMLInputElement | null>(null);
  const worldMenuRef = useRef<HTMLDivElement | null>(null);
  const stateRequestPromiseRef = useRef<Promise<void> | null>(null);
  const worldMapRequestPromiseRef = useRef<Promise<void> | null>(null);
  const reportsRequestPromiseRef = useRef<Promise<void> | null>(null);
  const battleReportDetailRequestByIdRef = useRef<Record<number, Promise<BattleReportItem | null> | null>>({});
  const battleReportScopeKeyRef = useRef('');
  const reportsSummaryRequestPromiseRef = useRef<Promise<void> | null>(null);
  const activityRequestPromiseRef = useRef<Promise<void> | null>(null);
  const activitySummaryRequestPromiseRef = useRef<Promise<void> | null>(null);
  const mutationPendingRef = useRef(false);
  const villageIntelRequestByVillageIdRef = useRef<Record<number, Promise<void> | null>>({});
  const hasStoredPanelLayoutRef = useRef(false);
  const skipPanelLayoutSaveScopeRef = useRef<string | null>(null);
  const skipPanelPlacementSaveScopeRef = useRef<string | null>(null);
  const initialAutoStretchAppliedRef = useRef(false);
  const armyQuickSelectionRequestIdRef = useRef(0);
  const logisticsSendLockRef = useRef(false);
  const username = session?.username ?? 'Hayato';
  const selectedWorldId = session?.selectedWorldId ?? null;
  const selectedSpawnDirection = session?.selectedSpawnDirection ?? null;
  const selectedWorldName = selectedWorldId
    ? WORLD_LABELS[selectedWorldId] ?? selectedWorldId
    : null;
  const selectedWorldFlavor = resolveWorldFlavorById(selectedWorldId);
  const getCanvasViewportSize = useCallback(() => {
    const canvasNode = canvasRef.current;
    const layoutContainer = canvasNode?.closest('.game-layout-container') as HTMLElement | null;
    const bounds = canvasNode?.getBoundingClientRect();
    const layoutBounds = layoutContainer?.getBoundingClientRect();
    const fallbackWidth =
      typeof window !== 'undefined'
        ? window.innerWidth - 16
        : PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH + PANEL_VIEWPORT_MARGIN_X;
    const fallbackHeight =
      typeof window !== 'undefined'
        ? window.innerHeight - 120
        : PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT + PANEL_VIEWPORT_MARGIN_Y;
    const viewportWidth = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH + PANEL_VIEWPORT_MARGIN_X,
      Math.floor(bounds?.width ?? layoutBounds?.width ?? fallbackWidth),
    );
    const viewportHeight = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT + PANEL_VIEWPORT_MARGIN_Y,
      Math.floor(bounds?.height ?? layoutBounds?.height ?? fallbackHeight),
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
  const [storedPanelPlacement, setStoredPanelPlacement] = useState<StoredPanelPlacementByType>(() =>
    readStoredPanelPlacement(username, selectedWorldId),
  );

  const [panels, setPanels] = useState<PanelWindow[]>(() => {
    const restored = readStoredPanelLayout(username, selectedWorldId);
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

    return [createPanelWindow('map', 40, 0, { layoutMode: 'floating' })];
  });
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [activeFullDockPanelId, setActiveFullDockPanelId] = useState<string | null>(null);
  const [activeLeftDockPanelId, setActiveLeftDockPanelId] = useState<string | null>(null);
  const [activeRightDockPanelId, setActiveRightDockPanelId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [worldMapState, setWorldMapState] = useState<GameStateResponse['world'] | null>(null);
  const [villageIntelByVillageId, setVillageIntelByVillageId] = useState<Record<number, VillageIntelEntry>>({});
  const [, setLoadingState] = useState(true);
  const [, setStateError] = useState<string | null>(null);
  const [armyNotice, setArmyNotice] = useState<string | null>(null);
  const [armyNoticeUnitId, setArmyNoticeUnitId] = useState<string | null>(null);
  const [armyCommandNotice, setArmyCommandNotice] = useState<string | null>(null);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);
  const [researchActionPending, setResearchActionPending] = useState(false);
  const [mercenaryActionPending, setMercenaryActionPending] = useState(false);
  const [logisticsActionPending, setLogisticsActionPending] = useState(false);
  const [guildActionPending, setGuildActionPending] = useState(false);
  const [cancelLogisticsPendingId, setCancelLogisticsPendingId] = useState<number | null>(null);
  const [recruitPendingUnitId, setRecruitPendingUnitId] = useState<string | null>(null);
  const [cancelRecruitmentPendingId, setCancelRecruitmentPendingId] = useState<number | null>(null);
  const [reorderRecruitmentPendingId, setReorderRecruitmentPendingId] = useState<number | null>(null);
  const [armyCommandPending, setArmyCommandPending] = useState(false);
  const [upgradePendingBuildingId, setUpgradePendingBuildingId] = useState<string | null>(null);
  const [cancelUpgradePendingOrderId, setCancelUpgradePendingOrderId] = useState<number | null>(null);
  const [reorderUpgradePendingOrderId, setReorderUpgradePendingOrderId] = useState<number | null>(null);
  const [cancelUpgradeQueuePending, setCancelUpgradeQueuePending] = useState(false);
  const [recallKnightPending, setRecallKnightPending] = useState(false);
  const [renameVillagePending, setRenameVillagePending] = useState(false);
  const [buildingNotices, setBuildingNotices] = useState<Record<string, string>>({});
  const [battleReports, setBattleReports] = useState<BattleReportListResponse | null>(null);
  const [battleReportsSummary, setBattleReportsSummary] = useState<BattleReportSummaryResponse | null>(null);
  const [battleReportsLoading, setBattleReportsLoading] = useState(false);
  const [battleReportsError, setBattleReportsError] = useState<string | null>(null);
  const [battleReportsPage, setBattleReportsPage] = useState(1);
  const [selectedBattleReportId, setSelectedBattleReportId] = useState<number | null>(null);
  const [battleReportCacheById, setBattleReportCacheById] = useState<Record<number, BattleReportItem>>({});
  const [battleReportPendingById, setBattleReportPendingById] = useState<Record<number, boolean>>({});
  const [activityEntries, setActivityEntries] = useState<GameActivityListResponse | null>(null);
  const [activitySummary, setActivitySummary] = useState<GameActivitySummaryResponse | null>(null);
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
  const [, setIsCommunicationHubOpen] = useState(false);
  const [availableWorlds, setAvailableWorlds] = useState<WorldPortalItem[]>([]);
  const [isWorldMenuOpen, setIsWorldMenuOpen] = useState(false);
  const [worldMenuError, setWorldMenuError] = useState<string | null>(null);
  useEffect(() => {
    battleReportScopeKeyRef.current = `${username}::${selectedWorldId ?? ''}`;
  }, [selectedWorldId, username]);

  useEffect(() => {
    const storageScope = normalizePanelStorageScope(selectedWorldId);
    skipPanelLayoutSaveScopeRef.current = storageScope;
    skipPanelPlacementSaveScopeRef.current = storageScope;
    setActivePanelId(null);
    setActiveFullDockPanelId(null);
    setActiveLeftDockPanelId(null);
    setActiveRightDockPanelId(null);
    setStoredPanelPlacement(readStoredPanelPlacement(username, selectedWorldId));
    const restored = readStoredPanelLayout(username, selectedWorldId);
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
      setPanels(restored);
      return;
    }

    hasStoredPanelLayoutRef.current = false;
    topZ.current = 40;
    setPanels([createPanelWindow('map', 40, 0, { layoutMode: 'floating' })]);
  }, [selectedWorldId, username]);
  useEffect(() => {
    setVillageIntelByVillageId({});
    villageIntelRequestByVillageIdRef.current = {};
  }, [selectedWorldId, username]);
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
  const [mapPreviewTravelModifier, setMapPreviewTravelModifier] = useState<MapPreviewTravelModifierKey>(
    () => readStoredShortcutSettings(username).mapPreviewTravelModifier,
  );
  const [settlementColorPalette, setSettlementColorPalette] = useState<SettlementColorPalette>(
    () => readStoredShortcutSettings(username).settlementColors,
  );
  const [shortcutNotice, setShortcutNotice] = useState<string | null>(null);
  const [isPinColumnsTemporarilyHidden, setIsPinColumnsTemporarilyHidden] = useState(false);
  const [isPinColumnsOverlayVisible, setIsPinColumnsOverlayVisible] = useState(false);
  const [isPinColumnsHoldVisible, setIsPinColumnsHoldVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => detectTouchDevice());
  const [shortcutSettingsLoadedForUser, setShortcutSettingsLoadedForUser] = useState(username);
  const [isVillageMenuOpen, setVillageMenuOpen] = useState(false);
  const [villageMenuPosition, setVillageMenuPosition] = useState<VillageMenuPosition | null>(null);
  const [isVillageRenameOpen, setIsVillageRenameOpen] = useState(false);
  const [villageRenameDraft, setVillageRenameDraft] = useState('');
  const [villageRenameNotice, setVillageRenameNotice] = useState<string | null>(null);
  const [isVillageHotkeyMode, setIsVillageHotkeyMode] = useState(false);
  const [villageHotkeyIndex, setVillageHotkeyIndex] = useState(0);
  const [armyTargetHistoryByVillageId, setArmyTargetHistoryByVillageId] = useState<ArmyTargetHistoryByVillageId>(
    () => readStoredArmyTargetHistory(username),
  );
  const [armyQuickSelection, setArmyQuickSelection] = useState<ArmyQuickSelection | null>(null);
  const [mapCenterRequest, setMapCenterRequest] = useState<{ settlementId: string; nonce: number } | null>(null);

  useEffect(() => {
    mutationPendingRef.current = Boolean(
      recruitPendingUnitId ||
        cancelRecruitmentPendingId != null ||
        reorderRecruitmentPendingId != null ||
        upgradePendingBuildingId ||
        cancelUpgradePendingOrderId != null ||
        reorderUpgradePendingOrderId != null ||
        cancelUpgradeQueuePending ||
        armyCommandPending ||
        researchActionPending ||
        mercenaryActionPending ||
        logisticsActionPending ||
        guildActionPending ||
        cancelLogisticsPendingId != null ||
        kingdomActionPending ||
        restartVillagePending ||
        renameVillagePending ||
        recallKnightPending ||
        activityActionPending,
    );
  }, [
    activityActionPending,
    armyCommandPending,
    cancelLogisticsPendingId,
    cancelRecruitmentPendingId,
    reorderRecruitmentPendingId,
    cancelUpgradePendingOrderId,
    reorderUpgradePendingOrderId,
    cancelUpgradeQueuePending,
    logisticsActionPending,
    guildActionPending,
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
    setMapPreviewTravelModifier(storedShortcutSettings.mapPreviewTravelModifier);
    setSettlementColorPalette(storedShortcutSettings.settlementColors);
    setShortcutNotice(null);
    setIsPinColumnsTemporarilyHidden(false);
    setIsPinColumnsOverlayVisible(false);
    setIsPinColumnsHoldVisible(false);
    setShortcutSettingsLoadedForUser(username);
    const storedAvatarUrl = readStoredAvatarUrl(username);
    setMyAvatarUrl(storedAvatarUrl);
    setPlayerAvatarByUsername(
      storedAvatarUrl
        ? {
            [username.toLocaleLowerCase('cs-CZ')]: {
              avatarUrl: storedAvatarUrl,
              loaded: true,
            },
          }
        : {},
    );
    setWorldMapState(null);
    latestAppliedWorldMapKeyRef.current = null;
    battleReportDetailRequestByIdRef.current = {};
    setBattleReports(null);
    setBattleReportsError(null);
    setBattleReportsPage(1);
    setSelectedBattleReportId(null);
    setBattleReportCacheById({});
    setBattleReportPendingById({});
    setBattleReportsSummary(null);
    setActivitySummary(null);
  }, [username]);

  useEffect(() => {
    setWorldMapState(null);
    latestAppliedWorldMapKeyRef.current = null;
    battleReportDetailRequestByIdRef.current = {};
    setBattleReports(null);
    setBattleReportsError(null);
    setBattleReportsPage(1);
    setSelectedBattleReportId(null);
    setBattleReportCacheById({});
    setBattleReportPendingById({});
    setBattleReportsSummary(null);
    setActivitySummary(null);
  }, [selectedWorldId]);

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
      mapPreviewTravelModifier,
      settlementColors: settlementColorPalette,
    });
  }, [
    autoHidePinColumns,
    mapPreviewTravelModifier,
    settlementColorPalette,
    shortcutCustomBindings,
    shortcutSettingsLoadedForUser,
    username,
  ]);

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

  const settlementColorCssVariables = useMemo(
    () =>
      ({
        '--settlement-color-active': settlementColorPalette.active,
        '--settlement-color-own': settlementColorPalette.own,
        '--settlement-color-bot': settlementColorPalette.bot,
        '--settlement-color-royal': settlementColorPalette.royal,
        '--settlement-color-allied': settlementColorPalette.allied,
        '--settlement-color-nap': settlementColorPalette.nap,
        '--settlement-color-opponent': settlementColorPalette.opponent,
        '--settlement-color-enemy': settlementColorPalette.enemy,
        '--settlement-color-abandoned': settlementColorPalette.abandoned,
      }) as CSSProperties,
    [settlementColorPalette],
  );

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
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.querySelector('.game-page');
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const stripNativeTitle = (element: HTMLElement) => {
      if (element.hasAttribute('data-keep-native-title')) {
        return;
      }
      const title = element.getAttribute('title');
      if (!title) {
        return;
      }
      if (!element.hasAttribute('data-native-title')) {
        element.setAttribute('data-native-title', title);
      }
      element.removeAttribute('title');
    };

    root.querySelectorAll<HTMLElement>('[title]').forEach((element) => stripNativeTitle(element));

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
          const target = mutation.target;
          if (target instanceof HTMLElement) {
            stripNativeTitle(target);
          }
          continue;
        }

        if (mutation.type !== 'childList' || mutation.addedNodes.length <= 0) {
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          stripNativeTitle(node);
          node.querySelectorAll<HTMLElement>('[title]').forEach((element) => stripNativeTitle(element));
        });
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => {
      observer.disconnect();
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
        saveStoredAvatarUrl(username, avatarUrl);
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
  const latestAppliedStateVersionRef = useRef<string | null>(null);
  const latestAppliedWorldMapKeyRef = useRef<string | null>(null);
  const applyIncomingGameState = useCallback((nextState: GameStateResponse): boolean => {
    const normalizedState = normalizeGameStateForUi(nextState);
    const parsedServerTimeMs = Date.parse(normalizedState.serverTime);
    const nextServerTimeMs = Number.isFinite(parsedServerTimeMs) ? parsedServerTimeMs : Date.now();
    if (nextServerTimeMs < latestAppliedStateServerTimeMsRef.current) {
      return false;
    }

    const nextStateVersion = String(normalizedState.stateVersion ?? '').trim() || null;
    const didStateChange =
      nextStateVersion == null || latestAppliedStateVersionRef.current !== nextStateVersion;
    latestAppliedStateServerTimeMsRef.current = nextServerTimeMs;
    latestAppliedStateVersionRef.current = nextStateVersion;
    if (didStateChange) {
      setGameState(normalizedState);
    }
    if ((normalizedState.world?.settlements?.length ?? 0) > 0) {
      const worldSnapshotKey = getWorldSnapshotVersion(normalizedState.world);
      if (worldSnapshotKey == null || latestAppliedWorldMapKeyRef.current !== worldSnapshotKey) {
        latestAppliedWorldMapKeyRef.current = worldSnapshotKey;
        setWorldMapState(normalizedState.world);
      }
    }
    setActiveVillageId((previous) => (previous === normalizedState.village.id ? previous : normalizedState.village.id));
    setStateError(null);
    return didStateChange;
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
        const byQueueIndex = Number(a.queueIndex ?? Number.MAX_SAFE_INTEGER) - Number(b.queueIndex ?? Number.MAX_SAFE_INTEGER);
        if (byQueueIndex !== 0) {
          return byQueueIndex;
        }
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
        queueIndex: Math.max(0, Math.floor(Number(order.queueIndex ?? 0))),
        status: String(order.status ?? 'queued'),
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
        startedAt: upgrade.startedAt,
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

    return {
      isActive: Boolean(developerBoost.isActive),
      label: String(developerBoost.label),
      reason: String(developerBoost.reason),
      endsAt: new Date(endsAtMs).toISOString(),
      endsAtLabel: formatDateTimeLabel(endsAtMs),
    };
  }, [gameState?.resources?.developerBoost]);

  const researchProjects = useMemo(
    () => (Array.isArray(gameState?.research?.projects) ? gameState.research.projects : []),
    [gameState?.research?.projects],
  );
  const hasResolvedResearchProjects = Array.isArray(gameState?.research?.projects);
  const currentResearchTask = useMemo(() => {
    const researchingProjects = researchProjects.filter((project) => project.status === 'researching');
    const availableProjects = researchProjects.filter((project) => project.status === 'available');
    const candidates = researchingProjects.length > 0 ? researchingProjects : availableProjects;
    if (candidates.length <= 0) {
      return null;
    }

    const sortedCandidates = [...candidates].sort((left, right) => {
      const leftProgress = Math.max(0, Math.min(100, Number(left.progressPercent ?? 0)));
      const rightProgress = Math.max(0, Math.min(100, Number(right.progressPercent ?? 0)));
      const progressDiff = rightProgress - leftProgress;
      if (Math.abs(progressDiff) > RESEARCH_SPOTLIGHT_SIMILAR_PROGRESS_DELTA_PERCENT) {
        return progressDiff;
      }

      const leftCoinCost = Math.max(0, Math.floor(Number(left.coinCost ?? 0)));
      const rightCoinCost = Math.max(0, Math.floor(Number(right.coinCost ?? 0)));
      if (leftCoinCost !== rightCoinCost) {
        return leftCoinCost - rightCoinCost;
      }

      const leftRemainingSec = Math.max(0, Number(left.remainingSec ?? Number.POSITIVE_INFINITY));
      const rightRemainingSec = Math.max(0, Number(right.remainingSec ?? Number.POSITIVE_INFINITY));
      if (leftRemainingSec !== rightRemainingSec) {
        return leftRemainingSec - rightRemainingSec;
      }

      return String(left.id).localeCompare(String(right.id), 'cs');
    });

    return sortedCandidates[0] ?? null;
  }, [researchProjects]);
  const isResearchSpotlightEmpty =
    hasResolvedResearchProjects && researchProjects.length > 0 && currentResearchTask === null;
  const isResearchSpotlightComplete =
    isResearchSpotlightEmpty && researchProjects.every((project) => project.status === 'completed');
  const currentResearchProgressPercent = currentResearchTask
    ? Math.max(0, Math.min(100, Number(currentResearchTask.progressPercent ?? 0)))
    : 0;
  const currentResearchAssignedAcademics = currentResearchTask
    ? Math.max(0, Math.floor(Number(currentResearchTask.assignedAcademics ?? 0)))
    : 0;
  const currentResearchCompletionTimeLabel = currentResearchTask
    ? currentResearchTask.estimatedCompletionAt
      ? formatDateTimeLabel(currentResearchTask.estimatedCompletionAt)
      : currentResearchTask.completedAt
        ? formatDateTimeLabel(currentResearchTask.completedAt)
        : 'Neurčeno'
    : 'Neurčeno';
  const currentResearchTooltipLabel = currentResearchTask
    ? currentResearchTask.status === 'researching'
      ? `Dokončení: ${Math.round(currentResearchProgressPercent)} %\nČas dokončení: ${currentResearchCompletionTimeLabel}\nAkademici: ${currentResearchAssignedAcademics.toLocaleString('cs-CZ')}`
      : `Připravený projekt: ${currentResearchTask.name}\nCena: ${Math.max(0, Math.floor(Number(currentResearchTask.coinCost ?? 0))).toLocaleString('cs-CZ')} mincí\nKlikni pro otevření panelu Výzkum`
    : !hasResolvedResearchProjects
      ? 'Načítám přehled výzkumu.'
      : isResearchSpotlightComplete
        ? 'Výzkum je kompletní. Klikni pro otevření panelu Výzkum.'
        : 'Momentálně není k dispozici žádný další projekt. Klikni pro otevření panelu Výzkum.';
  const currentResearchHeadline = currentResearchTask
    ? currentResearchTask.name
    : !hasResolvedResearchProjects
      ? 'Načítám výzkum...'
      : isResearchSpotlightComplete
        ? 'Výzkum dokončen'
        : 'Žádný projekt k výzkumu';

  const villageLabel = gameState
    ? `${gameState.village.name} (${gameState.village.coordX}|${gameState.village.coordY})`
    : 'Načítám město...';
  const activeVillageBaseName = gameState?.village.name ?? extractVillageBaseName(villageLabel);
  const activeVillageResolvedId = gameState?.village.id ?? activeVillageId ?? null;
  const publicOrder = gameState?.publicOrder ?? null;
  const publicOrderCurrentPct = Math.max(0, Math.min(100, Math.floor(Number(publicOrder?.currentPct ?? 100))));
  const publicOrderBand = String(publicOrder?.band ?? 'stable');
  const publicOrderBadgeTone =
    publicOrderBand === 'critical' ? 'is-critical' : publicOrderBand === 'warning' ? 'is-warning' : 'is-stable';
  const showPublicOrderPct = publicOrder != null && publicOrderCurrentPct < 100;
  const publicOrderTooltipId = 'public-order-tooltip';
  const publicOrderTooltipHeadline =
    publicOrderBand === 'critical'
      ? 'Krize veřejného pořádku'
      : publicOrderBand === 'warning'
        ? 'Napětí v zemi'
        : 'Veřejný pořádek je stabilní';
  const publicOrderTooltipRegen = `${Math.max(0, Number(publicOrder?.regenPctPerHour ?? 0)).toLocaleString('cs-CZ')}% / hod.`;
  const publicOrderTooltipKnightRecruit = publicOrder?.knightRecruitBlocked
    ? 'Blokován pod 50 % veřejného pořádku'
    : 'Bez omezení';
  const publicOrderTooltipDebuff =
    Number(publicOrder?.globalSpeedPenaltyPct ?? 0) > 0
      ? `-${Math.floor(Number(publicOrder?.globalSpeedPenaltyPct ?? 0))}% rychlost náboru, výstavby i produkce.`
      : 'Bez globálních debuffů.';
  const publicOrderTooltipAriaLabel = publicOrder
    ? `${publicOrderTooltipHeadline}. Stav ${publicOrderCurrentPct}% · Obnova ${publicOrderTooltipRegen}. Nábor rytíře ${publicOrderTooltipKnightRecruit}. ${publicOrderTooltipDebuff}`
    : 'Veřejný pořádek se načítá.';
  const currentVillageHistoryKey =
    activeVillageResolvedId != null && Number.isFinite(activeVillageResolvedId)
      ? String(Math.floor(activeVillageResolvedId))
      : null;
  const currentVillageCommandHistory = useMemo<Partial<Record<MapOrderCommandType, number>>>(
    () => (currentVillageHistoryKey ? armyTargetHistoryByVillageId[currentVillageHistoryKey] ?? {} : {}),
    [armyTargetHistoryByVillageId, currentVillageHistoryKey],
  );
  const playerVillages = useMemo(
    () =>
      [...(gameState?.villages ?? [])].sort((left, right) =>
        compareVillageLabelNatural(
          { name: String(left.name ?? ''), coordX: Number(left.coordX ?? 0), coordY: Number(left.coordY ?? 0) },
          { name: String(right.name ?? ''), coordX: Number(right.coordX ?? 0), coordY: Number(right.coordY ?? 0) },
        ),
      ),
    [gameState?.villages],
  );
  const ownedVillageIdSet = useMemo(() => {
    const ids = new Set<number>();
    for (const village of gameState?.villages ?? []) {
      const villageId = Number(village.id);
      if (!Number.isFinite(villageId) || villageId <= 0) {
        continue;
      }
      ids.add(Math.floor(villageId));
    }
    return ids;
  }, [gameState?.villages]);
  useEffect(() => {
    if (!gameState) {
      return;
    }
    const villageId = Number(gameState.village.id);
    if (!Number.isFinite(villageId) || villageId <= 0) {
      return;
    }
    const nextIntelData = toVillageIntelData(gameState);
    setVillageIntelByVillageId((previous) => {
      const existing = previous[villageId];
      const nowMs = Date.now();
      if (existing?.status === 'ready' && existing.fetchedAt != null && nowMs - existing.fetchedAt < 3500) {
        return previous;
      }
      return {
        ...previous,
        [villageId]: {
          status: 'ready',
          data: nextIntelData,
          error: null,
          fetchedAt: nowMs,
        },
      };
    });
  }, [gameState]);
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
  const [canvasViewportRevision, setCanvasViewportRevision] = useState(0);
  useEffect(() => {
    const canvasNode = canvasRef.current;
    let rafId: number | null = null;

    const requestViewportReflow = () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setCanvasViewportRevision((previous) => previous + 1);
      });
    };

    requestViewportReflow();
    window.addEventListener('resize', requestViewportReflow);

    let resizeObserver: ResizeObserver | null = null;
    if (canvasNode && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestViewportReflow();
      });
      resizeObserver.observe(canvasNode);
    }

    return () => {
      window.removeEventListener('resize', requestViewportReflow);
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
    };
  }, [gameCanvasClassName]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applyContainerInsets = () => {
      const layoutContainer = (canvasRef.current?.closest('.game-layout-container') as HTMLElement | null) ?? null;
      const rect = layoutContainer?.getBoundingClientRect();
      const leftGap = Math.max(0, Math.floor(rect?.left ?? 0));
      const rightGap = Math.max(0, Math.floor(window.innerWidth - (rect?.right ?? window.innerWidth)));
      document.documentElement.style.setProperty('--game-layout-left-gap', `${leftGap}px`);
      document.documentElement.style.setProperty('--game-layout-right-gap', `${rightGap}px`);
    };

    applyContainerInsets();
    window.addEventListener('resize', applyContainerInsets);

    return () => {
      window.removeEventListener('resize', applyContainerInsets);
      document.documentElement.style.setProperty('--game-layout-left-gap', '0px');
      document.documentElement.style.setProperty('--game-layout-right-gap', '0px');
    };
  }, [canvasViewportRevision]);
  const activeVillageProtection = useMemo<ActiveVillageProtectionNotice | null>(() => {
    const protectionRuleDays = Math.max(0, Number(gameState?.village.protectionRuleDays ?? 0));
    const protectionUntil = gameState?.village.protectionUntil;
    if (protectionRuleDays <= 0 || !protectionUntil) {
      return null;
    }

    const protectionUntilMs = Date.parse(protectionUntil);
    if (!Number.isFinite(protectionUntilMs)) {
      return null;
    }
    const formattedUntil = new Intl.DateTimeFormat('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(protectionUntilMs));

    return {
      protectionUntil: new Date(protectionUntilMs).toISOString(),
      formattedUntil,
    };
  }, [gameState?.village.protectionRuleDays, gameState?.village.protectionUntil]);
  const currentVillageName = gameState?.village.name ?? 'Neznámé léno';
  useEffect(() => {
    if (isVillageRenameOpen) {
      return;
    }
    setVillageRenameDraft(activeVillageBaseName);
  }, [activeVillageBaseName, isVillageRenameOpen]);

  useEffect(() => {
    if (!isVillageRenameOpen) {
      return;
    }
    const nextFrame = window.requestAnimationFrame(() => {
      const input = villageRenameInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    });
    return () => window.cancelAnimationFrame(nextFrame);
  }, [isVillageRenameOpen]);

  useEffect(() => {
    if (!isVillageRenameOpen) {
      return;
    }

    const cancelRename = () => {
      setIsVillageRenameOpen(false);
      setVillageRenameDraft(activeVillageBaseName);
    };

    const onDocumentPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && villageRenameWrapRef.current?.contains(target)) {
        return;
      }
      cancelRename();
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      cancelRename();
    };

    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('touchstart', onDocumentPointerDown, { passive: true });
    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('touchstart', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [activeVillageBaseName, isVillageRenameOpen]);

  const leaderboardRows = useMemo(() => {
    const rows = gameState?.leaderboard?.length ? gameState.leaderboard : RANKING_FALLBACK;
    return rows.filter((entry) => !entry.username.startsWith('__abandoned_ai__'));
  }, [gameState]);
  const kingdomHub = gameState?.kingdomHub ?? null;
  const playerRankingSummary = useMemo<PlayerRankingSummary | null>(() => {
    const ranking = gameState?.playerRanking;
    if (!ranking) {
      return null;
    }
    return {
      rank: normalizeRankValue(ranking.rank),
      attackerRank: normalizeRankValue(ranking.attackerRank),
      defenderRank: normalizeRankValue(ranking.defenderRank),
      supporterRank: normalizeRankValue(ranking.supporterRank),
      lootRank: normalizeRankValue(ranking.lootRank),
    };
  }, [gameState?.playerRanking]);
  const playerLeaderboardEntry = useMemo(
    () => leaderboardRows.find((entry) => entry.username === username) ?? null,
    [leaderboardRows, username],
  );
  const resolvedPlayerRank = normalizeRankValue(playerLeaderboardEntry?.rank ?? playerRankingSummary?.rank);
  const resolvedPlayerAttackerRank = normalizeRankValue(
    playerLeaderboardEntry?.attackerRank ?? playerRankingSummary?.attackerRank,
  );
  const resolvedPlayerDefenderRank = normalizeRankValue(
    playerLeaderboardEntry?.defenderRank ?? playerRankingSummary?.defenderRank,
  );
  const resolvedPlayerSupporterRank = normalizeRankValue(
    playerLeaderboardEntry?.supporterRank ?? playerRankingSummary?.supporterRank,
  );
  const resolvedPlayerLootRank = normalizeRankValue(
    playerLeaderboardEntry?.lootRank ?? playerRankingSummary?.lootRank,
  );
  const leaderboardMenuBadgeLabel = useMemo(() => {
    if (resolvedPlayerRank == null) {
      return null;
    }
    return `#${resolvedPlayerRank.toLocaleString('cs-CZ')}`;
  }, [resolvedPlayerRank]);
  const incomingAttackAttentionCount = useMemo(
    () => armyIncomingMovements.filter((movement) => movement.commandType === 'attack').length,
    [armyIncomingMovements],
  );
  const battleReportsTotalCount = Math.max(
    0,
    Number(battleReports?.total ?? battleReportsSummary?.total ?? 0),
  );
  const activityUnreadCount = activityEntries?.unreadTotal ?? activitySummary?.unreadTotal ?? 0;
  const activityAttentionCount = activityEntries?.attentionTotal ?? activitySummary?.attentionTotal ?? 0;
  const activityUnreadFeed = useMemo(
    () => activityEntries?.unreadFeed ?? activitySummary?.unreadFeed ?? [],
    [activityEntries?.unreadFeed, activitySummary?.unreadFeed],
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
  const mapRegionSize = worldMapState?.size ?? gameState?.world.size ?? REGION_SIZE;
  const mapRegionOriginX = worldMapState?.originX ?? gameState?.world.originX ?? REGION_ORIGIN_X;
  const mapRegionOriginY = worldMapState?.originY ?? gameState?.world.originY ?? REGION_ORIGIN_Y;
  const mapRegionId = worldMapState?.region ?? gameState?.world.region ?? 1;
  const mapSettlements = useMemo<RegionSettlement[]>(
    () => worldMapState?.settlements ?? gameState?.world.settlements ?? REGION_SETTLEMENTS,
    [gameState?.world.settlements, worldMapState?.settlements],
  );
  const hasExpandedWorldMapConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && WORLD_MAP_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
  );
  const isReportsPanelExpanded = useMemo(
    () => panels.some((panel) => panel.type === 'messages' && panel.expanded),
    [panels],
  );
  const isActivityPanelExpanded = useMemo(
    () => panels.some((panel) => panel.type === 'activity' && panel.expanded),
    [panels],
  );
  const hasExpandedLeaderboardConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && LEADERBOARD_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
  );
  const hasExpandedKingdomHubConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && KINGDOM_HUB_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
  );
  const hasExpandedResearchConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && RESEARCH_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
  );
  const hasExpandedMercenaryConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && MERCENARY_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
  );
  const hasExpandedMarketConsumerPanel = useMemo(
    () => panels.some((panel) => panel.expanded && MARKET_DEPENDENT_PANEL_TYPES.has(panel.type)),
    [panels],
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
  const cityPanelResourceSnapshot = useMemo<CityPanelResourceSnapshot>(
    () => ({
      wood: gameState?.resources.wood ?? 0,
      stone: gameState?.resources.stone ?? 0,
      iron: gameState?.resources.iron ?? 0,
      gold: gameState?.resources.gold ?? 0,
      coins: gameState?.resources.coins ?? 0,
      cap: gameState?.resources.cap ?? 0,
      goldCap: gameState?.resources.goldCap ?? 0,
      coinsCap: gameState?.resources.coinsCap ?? 0,
      populationUsed: gameState?.population.used ?? 0,
      populationCap: gameState?.population.cap ?? 0,
      productionPerHour: {
        wood: gameState?.resources.productionPerHour.wood ?? 0,
        stone: gameState?.resources.productionPerHour.stone ?? 0,
        iron: gameState?.resources.productionPerHour.iron ?? 0,
        gold: gameState?.resources.productionPerHour.gold ?? 0,
        mintCoins: gameState?.resources.productionPerHour.mintCoins ?? 0,
      },
      protection: {
        wood: gameState?.resources.protection.wood ?? 0,
        stone: gameState?.resources.protection.stone ?? 0,
        iron: gameState?.resources.protection.iron ?? 0,
        gold: gameState?.resources.protection.gold ?? 0,
        coins: gameState?.resources.protection.coins ?? 0,
      },
    }),
    [
      gameState?.population.cap,
      gameState?.population.used,
      gameState?.resources.cap,
      gameState?.resources.coins,
      gameState?.resources.coinsCap,
      gameState?.resources.gold,
      gameState?.resources.goldCap,
      gameState?.resources.iron,
      gameState?.resources.productionPerHour.gold,
      gameState?.resources.productionPerHour.iron,
      gameState?.resources.productionPerHour.mintCoins,
      gameState?.resources.productionPerHour.stone,
      gameState?.resources.productionPerHour.wood,
      gameState?.resources.protection.coins,
      gameState?.resources.protection.gold,
      gameState?.resources.protection.iron,
      gameState?.resources.protection.stone,
      gameState?.resources.protection.wood,
      gameState?.resources.stone,
      gameState?.resources.wood,
    ],
  );
  const cityPanelAvailableResources = useMemo<ResourceCost>(
    () => ({
      wood: gameState?.resources.wood ?? 0,
      stone: gameState?.resources.stone ?? 0,
      iron: gameState?.resources.iron ?? 0,
    }),
    [gameState?.resources.iron, gameState?.resources.stone, gameState?.resources.wood],
  );

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
            {
              includeWorldMap: false,
              includeLeaderboard: hasExpandedLeaderboardConsumerPanel,
              includeKingdomHub: hasExpandedKingdomHubConsumerPanel,
              includeResearch: true,
              includeMarket: hasExpandedMarketConsumerPanel,
              includeMercenaries: hasExpandedMercenaryConsumerPanel,
              includeRules: hasExpandedResearchConsumerPanel,
            },
          );
          applyIncomingGameState(nextState);
        } catch (error) {
          const resolvedMessage = getErrorMessage(error);
          setStateError(resolvedMessage);
          if (/nema zalozenou osadu/i.test(resolvedMessage)) {
            navigate('/worlds', { replace: true });
          }
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
    [
      activeVillageId,
      applyIncomingGameState,
      navigate,
      hasExpandedKingdomHubConsumerPanel,
      hasExpandedLeaderboardConsumerPanel,
      hasExpandedMarketConsumerPanel,
      hasExpandedMercenaryConsumerPanel,
      hasExpandedResearchConsumerPanel,
      selectedSpawnDirection,
      selectedWorldId,
      session,
      username,
    ],
  );

  const loadWorldMapSnapshot = useCallback(
    async (silent = true) => {
      if (!session || !selectedWorldId) {
        return;
      }

      if (worldMapRequestPromiseRef.current) {
        return worldMapRequestPromiseRef.current;
      }

      const requestPromise = (async () => {
        try {
          const snapshot = await fetchWorldMapSnapshot(
            username,
            activeVillageId,
            selectedWorldId,
            selectedSpawnDirection,
          );
          if (snapshot?.world) {
            const worldSnapshotKey = getWorldSnapshotVersion(snapshot.world);
            if (worldSnapshotKey == null || latestAppliedWorldMapKeyRef.current !== worldSnapshotKey) {
              latestAppliedWorldMapKeyRef.current = worldSnapshotKey;
              setWorldMapState(snapshot.world);
            }
          }
          setStateError(null);
        } catch (error) {
          if (!silent) {
            setStateError(getErrorMessage(error));
          }
        }
      })();

      worldMapRequestPromiseRef.current = requestPromise;

      try {
        await requestPromise;
      } finally {
        if (worldMapRequestPromiseRef.current === requestPromise) {
          worldMapRequestPromiseRef.current = null;
        }
      }
    },
    [activeVillageId, selectedSpawnDirection, selectedWorldId, session, username],
  );

  const loadBattleReportsSummary = useCallback(async () => {
    if (!session || !selectedWorldId) {
      return;
    }
    if (reportsSummaryRequestPromiseRef.current) {
      return reportsSummaryRequestPromiseRef.current;
    }

    const requestPromise = (async () => {
      try {
        const summary = await fetchBattleReportsSummary(username, selectedWorldId);
        setBattleReportsSummary({
          total: Math.max(0, Number(summary.total ?? 0)),
          updatedAt: String(summary.updatedAt ?? new Date().toISOString()),
        });
      } catch {
        // Keep previous summary value when lightweight refresh fails.
      }
    })();

    reportsSummaryRequestPromiseRef.current = requestPromise;

    try {
      await requestPromise;
    } finally {
      if (reportsSummaryRequestPromiseRef.current === requestPromise) {
        reportsSummaryRequestPromiseRef.current = null;
      }
    }
  }, [selectedWorldId, session, username]);

  const loadActivitySummary = useCallback(async () => {
    if (!session || !selectedWorldId) {
      return;
    }
    if (activitySummaryRequestPromiseRef.current) {
      return activitySummaryRequestPromiseRef.current;
    }

    const requestPromise = (async () => {
      try {
        const summary = await fetchGameActivitySummary(username, selectedWorldId);
        setActivitySummary({
          unreadTotal: Math.max(0, Number(summary.unreadTotal ?? 0)),
          attentionTotal: Math.max(0, Number(summary.attentionTotal ?? 0)),
          unreadFeed: Array.isArray(summary.unreadFeed) ? summary.unreadFeed : [],
          updatedAt: String(summary.updatedAt ?? new Date().toISOString()),
        });
      } catch {
        // Keep previous summary value when lightweight refresh fails.
      }
    })();

    activitySummaryRequestPromiseRef.current = requestPromise;

    try {
      await requestPromise;
    } finally {
      if (activitySummaryRequestPromiseRef.current === requestPromise) {
        activitySummaryRequestPromiseRef.current = null;
      }
    }
  }, [selectedWorldId, session, username]);

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
          setBattleReportsSummary({
            total: Math.max(0, Number(nextReports.total ?? 0)),
            updatedAt: new Date().toISOString(),
          });
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
          setActivitySummary({
            unreadTotal: Math.max(0, Number(nextActivity.unreadTotal ?? 0)),
            attentionTotal: Math.max(0, Number(nextActivity.attentionTotal ?? 0)),
            unreadFeed: Array.isArray(nextActivity.unreadFeed) ? nextActivity.unreadFeed : [],
            updatedAt: new Date().toISOString(),
          });
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
    if (!session || !selectedWorldId || !hasExpandedWorldMapConsumerPanel) {
      return;
    }

    const pollWorldMap = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      void loadWorldMapSnapshot(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadWorldMapSnapshot(true);
      }
    };
    void loadWorldMapSnapshot(true);
    const worldMapTimer = window.setInterval(pollWorldMap, MAP_OPEN_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(worldMapTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasExpandedWorldMapConsumerPanel, loadWorldMapSnapshot, selectedWorldId, session]);

  useEffect(() => {
    if (!session || !selectedWorldId || !isReportsPanelExpanded) {
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
  }, [isReportsPanelExpanded, loadBattleReports, selectedWorldId, session]);

  useEffect(() => {
    if (!session || !selectedWorldId || !isActivityPanelExpanded) {
      return;
    }

    const pollActivity = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      if (activityActionPending) {
        return;
      }
      void loadActivity(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (activityActionPending) {
          return;
        }
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
  }, [
    activityActionPending,
    isActivityPanelExpanded,
    loadActivity,
    selectedWorldId,
    session,
  ]);

  useEffect(() => {
    if (!session || !selectedWorldId || isReportsPanelExpanded) {
      return;
    }

    const pollBattleReportsSummary = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      void loadBattleReportsSummary();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadBattleReportsSummary();
      }
    };

    void loadBattleReportsSummary();
    const reportsSummaryTimer = window.setInterval(pollBattleReportsSummary, REPORTS_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(reportsSummaryTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isReportsPanelExpanded, loadBattleReportsSummary, selectedWorldId, session]);

  useEffect(() => {
    if (!session || !selectedWorldId || isActivityPanelExpanded) {
      return;
    }

    const pollActivitySummary = () => {
      if (document.hidden || mutationPendingRef.current) {
        return;
      }
      if (activityActionPending) {
        return;
      }
      void loadActivitySummary();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (activityActionPending) {
          return;
        }
        void loadActivitySummary();
      }
    };

    void loadActivitySummary();
    const activitySummaryTimer = window.setInterval(pollActivitySummary, REPORTS_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(activitySummaryTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    activityActionPending,
    isActivityPanelExpanded,
    loadActivitySummary,
    selectedWorldId,
    session,
  ]);

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
          nextAlert = !panel.expanded && battleReportsTotalCount > 0;
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
    battleReportsTotalCount,
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
    const storageScope = normalizePanelStorageScope(selectedWorldId);
    if (skipPanelLayoutSaveScopeRef.current === storageScope) {
      skipPanelLayoutSaveScopeRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      savePanelLayout(username, selectedWorldId, panels);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [panels, selectedWorldId, session, username]);

  useEffect(() => {
    setStoredPanelPlacement((previous) => {
      let changed = false;
      const next: StoredPanelPlacementByType = { ...previous };
      for (const panel of panels) {
        if (!isStaticPanelType(panel.type)) {
          continue;
        }
        const resolvedLayoutMode: PanelLayoutMode =
          panel.layoutMode === 'floating' && canPanelUseDockLayout(panel.type)
            ? panel.side === 'right'
              ? 'split-right'
              : 'split-left'
            : panel.layoutMode;
        const current = next[panel.type];
        if (
          !current ||
          current.side !== panel.side ||
          current.layoutMode !== resolvedLayoutMode
        ) {
          next[panel.type] = {
            side: panel.side,
            layoutMode: resolvedLayoutMode,
          };
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [panels]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const storageScope = normalizePanelStorageScope(selectedWorldId);
    if (skipPanelPlacementSaveScopeRef.current === storageScope) {
      skipPanelPlacementSaveScopeRef.current = null;
      return;
    }
    saveStoredPanelPlacement(username, selectedWorldId, storedPanelPlacement);
  }, [selectedWorldId, session, storedPanelPlacement, username]);

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
  const syncOwnSettlementSelection = useCallback(
    (settlement: RegionSettlement | null | undefined) => {
      if (!settlement || !isOwnSettlementForPlayer(settlement)) {
        return;
      }
      setSelectedOwnSettlementId(settlement.id);
      saveLastOwnSettlementId(username, settlement.id);
      if (settlement.villageId != null && Number.isFinite(Number(settlement.villageId))) {
        applyActiveVillageSelection(Math.floor(Number(settlement.villageId)));
      }
    },
    [applyActiveVillageSelection, isOwnSettlementForPlayer, username],
  );
  const syncVillagePanelSelectionById = useCallback(
    (panelId: string) => {
      const panel = panels.find((candidate) => candidate.id === panelId && candidate.type === 'village');
      if (!panel?.settlementId) {
        return;
      }
      syncOwnSettlementSelection(settlementsById.get(panel.settlementId));
    },
    [panels, settlementsById, syncOwnSettlementSelection],
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
    const layoutContainer = (canvasRef.current?.closest('.game-layout-container') as HTMLElement | null) ?? null;
    const layoutRect = layoutContainer?.getBoundingClientRect();
    const layoutLeft = Math.floor(layoutRect?.left ?? 0);
    const viewportWidth = Math.max(320, Math.floor(layoutRect?.width ?? window.innerWidth));
    const baseLeft = Math.floor(rect.left - layoutLeft);
    const width = clamp(Math.max(280, Math.floor(rect.width)), 280, Math.max(280, viewportWidth - 16));
    const leftWithinLayout = clamp(baseLeft, 8, Math.max(8, viewportWidth - width - 8));
    const safeLeft = clamp(layoutLeft + leftWithinLayout, 8, Math.max(8, window.innerWidth - width - 8));
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
    const stageMarginX = 0;
    const stageMarginTop = 0;
    const stageMarginBottom = 0;

    const leftPinEnd = shouldReservePinColumnsSpace && leftPinNode
      ? Math.floor(leftPinNode.offsetLeft + leftPinNode.offsetWidth + pinClearance)
      : stageMarginX;
    const rightPinStart = shouldReservePinColumnsSpace && rightPinNode
      ? Math.floor(rightPinNode.offsetLeft - pinClearance)
      : viewportWidth - stageMarginX;
    const availableLeft = clamp(
      leftPinEnd,
      stageMarginX,
      Math.max(stageMarginX, viewportWidth - PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH),
    );
    const maxRight = Math.max(
      availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
      viewportWidth - stageMarginX,
    );
    const availableRight = clamp(
      rightPinStart,
      availableLeft + PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
      maxRight,
    );

    return {
      x: Math.round(availableLeft),
      y: stageMarginTop,
      width: Math.round(
        clamp(
          availableRight - availableLeft,
          PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
          viewportWidth - stageMarginX,
        ),
      ),
      height: Math.round(
        clamp(
          viewportHeight - stageMarginTop - stageMarginBottom,
          PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT,
          viewportHeight - stageMarginTop - stageMarginBottom,
        ),
      ),
    };
  }, [shouldReservePinColumnsSpace]);

  const openPanel = useCallback((type: StaticPanelType) => {
    setActivePanelId(type);
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const shouldSwitchMainMenuPage = isMainMenuPanelType(type);
    const fallbackMainMenuFrame = shouldSwitchMainMenuPage
      ? getStretchedPanelFrame(viewportWidth, viewportHeight)
      : null;
    const panelVillageName =
      type === 'city' || type === 'map' || type === 'army' || type === 'commands'
        ? currentVillageName
        : undefined;
    let nextMapSize: WindowSize | null = null;

    setPanels((previous) => {
      const mainMenuFrame = shouldSwitchMainMenuPage
        ? (() => {
            const mapPanelFrame = previous.find((panel) => panel.type === 'map');
            if (!mapPanelFrame) {
              return fallbackMainMenuFrame;
            }
            return {
              x: mapPanelFrame.x,
              y: mapPanelFrame.y,
              width: mapPanelFrame.width,
              height: mapPanelFrame.height,
            };
          })()
        : null;
      const existing = previous.find((panel) => panel.type === type);
      const nextZ = ++topZ.current;
      const rememberedPlacement = storedPanelPlacement[type];
      const requestedSide: PinSide = rememberedPlacement?.side ?? PANEL_META[type].side;

      if (existing) {
        const nextPanels = previous.map((panel) => {
          if (panel.type === type) {
            const adjusted = fitPanelToViewport(
              {
                ...panel,
                z: nextZ,
                expanded: true,
                alert: false,
                label: PANEL_META[type].label,
                villageName: panelVillageName ?? panel.villageName,
                side: requestedSide,
                layoutMode: 'floating',
                ...(mainMenuFrame ?? {}),
              },
              viewportWidth,
              viewportHeight,
            );
            if (adjusted.type === 'map') {
              nextMapSize = { width: adjusted.width, height: adjusted.height };
            }
            return adjusted;
          }

          if (shouldSwitchMainMenuPage && isMainMenuPanelType(panel.type)) {
            if (panel.type === 'map') {
              if (panel.expanded) {
                return panel;
              }
              return {
                ...panel,
                expanded: true,
              };
            }
            if (panel.type !== type && panel.expanded) {
              return {
                ...panel,
                expanded: false,
              };
            }
          }
          return panel;
        });
        return nextPanels;
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
          ...(mainMenuFrame ?? {}),
          villageName: panelVillageName,
          side: requestedSide,
          layoutMode: 'floating',
        }),
        viewportWidth,
        viewportHeight,
      );
      const nextCreated = created;
      if (nextCreated.type === 'map') {
        nextMapSize = { width: nextCreated.width, height: nextCreated.height };
      }
      const collapsedPrevious = shouldSwitchMainMenuPage
        ? previous.map((panel) => {
            if (!isMainMenuPanelType(panel.type)) {
              return panel;
            }
            if (panel.type === 'map') {
              if (panel.expanded) {
                return panel;
              }
              return {
                ...panel,
                expanded: true,
              };
            }
            if (!panel.expanded) {
              return panel;
            }
            return {
              ...panel,
              expanded: false,
            };
          })
        : previous;
      return [...collapsedPrevious, nextCreated];
    });

    if (nextMapSize) {
      mapWindowSizeRef.current = nextMapSize;
      saveMapWindowSize(nextMapSize);
    }
  }, [currentVillageName, getCanvasViewportSize, getStretchedPanelFrame, storedPanelPlacement]);

  useEffect(() => {
    const { viewportWidth, viewportHeight } = getCanvasViewportSize();
    const stretchedFrame = getStretchedPanelFrame(viewportWidth, viewportHeight);
    setPanels((previous) => {
      if (previous.some((panel) => panel.type === 'map')) {
        return previous;
      }

      const nextZ = ++topZ.current;
      const createdMap = fitPanelToViewport(
        createPanelWindow('map', nextZ, previous.length, {
          ...stretchedFrame,
          side: 'left',
          layoutMode: 'floating',
          villageName: currentVillageName,
        }),
        viewportWidth,
        viewportHeight,
      );
      mapWindowSizeRef.current = {
        width: createdMap.width,
        height: createdMap.height,
      };
      return [createdMap, ...previous];
    });
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
        if (panel.layoutMode !== 'floating' || !shouldUseStretchedPanelFrame(panel.type)) {
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
        if (!panel.expanded || panel.layoutMode !== 'floating' || !shouldUseStretchedPanelFrame(panel.type)) {
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
  }, [
    arePinColumnsVisible,
    canvasViewportRevision,
    getCanvasViewportSize,
    getStretchedPanelFrame,
    shouldReservePinColumnsSpace,
  ]);

  const loadVillageIntel = useCallback(
    async (villageIdRaw: number, options?: { force?: boolean }) => {
      const villageId = Math.max(0, Math.floor(Number(villageIdRaw)));
      if (!Number.isFinite(villageId) || villageId <= 0) {
        return;
      }

      if (!ownedVillageIdSet.has(villageId)) {
        setVillageIntelByVillageId((previous) => ({
          ...previous,
          [villageId]: {
            status: 'error',
            data: previous[villageId]?.data ?? null,
            error: 'Detail front je dostupný jen pro tvoje vlastní léna.',
            fetchedAt: previous[villageId]?.fetchedAt ?? null,
          },
        }));
        return;
      }

      const cached = villageIntelByVillageId[villageId];
      const nowMs = Date.now();
      if (
        !options?.force &&
        cached?.status === 'ready' &&
        cached.fetchedAt != null &&
        nowMs - cached.fetchedAt < 12_000
      ) {
        return;
      }

      const inFlight = villageIntelRequestByVillageIdRef.current[villageId];
      if (inFlight) {
        await inFlight;
        return;
      }

      setVillageIntelByVillageId((previous) => ({
        ...previous,
        [villageId]: {
          status: 'loading',
          data: previous[villageId]?.data ?? null,
          error: null,
          fetchedAt: previous[villageId]?.fetchedAt ?? null,
        },
      }));

      const request = (async () => {
        try {
          const response = await fetchGameState(
            username,
            villageId,
            selectedWorldId,
            selectedSpawnDirection,
            {
              includeWorldMap: false,
              includeLeaderboard: false,
              includeKingdomHub: false,
              includeResearch: false,
              includeMarket: false,
              includeMercenaries: false,
              includeRules: false,
            },
          );
          const intelData = toVillageIntelData(response);
          setVillageIntelByVillageId((previous) => ({
            ...previous,
            [villageId]: {
              status: 'ready',
              data: intelData,
              error: null,
              fetchedAt: Date.now(),
            },
          }));
        } catch (error) {
          setVillageIntelByVillageId((previous) => ({
            ...previous,
            [villageId]: {
              status: 'error',
              data: previous[villageId]?.data ?? null,
              error: getErrorMessage(error),
              fetchedAt: previous[villageId]?.fetchedAt ?? null,
            },
          }));
        } finally {
          villageIntelRequestByVillageIdRef.current[villageId] = null;
        }
      })();

      villageIntelRequestByVillageIdRef.current[villageId] = request;
      await request;
    },
    [ownedVillageIdSet, selectedSpawnDirection, selectedWorldId, username, villageIntelByVillageId],
  );

  const requestMapCenterOnSettlement = useCallback((settlementId: string | null | undefined) => {
    const normalizedSettlementId = String(settlementId ?? '').trim();
    if (!normalizedSettlementId) {
      return;
    }
    setMapCenterRequest((previous) => ({
      settlementId: normalizedSettlementId,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  }, []);
  const handleMapCenterRequestHandled = useCallback((nonce: number) => {
    setMapCenterRequest((previous) => {
      if (!previous || previous.nonce !== nonce) {
        return previous;
      }
      return null;
    });
  }, []);

  const openSettlementPanel = useCallback(
    (settlement: RegionSettlement, options?: { pinSide?: PinSide; centerOnMap?: boolean }) => {
      const pinSide = options?.pinSide ?? null;
      const shouldPin = pinSide != null;
      const shouldCenterOnMap = options?.centerOnMap !== false;
      const { viewportWidth, viewportHeight } = getCanvasViewportSize();
      const id = `village-${settlement.id}`;
      const label = `${settlement.name} (${settlement.globalX}|${settlement.globalY})`;
      const defaultSide: PinSide = settlement.kind === 'own' ? 'left' : 'right';
      const nextSide = pinSide ?? defaultSide;
      const settlementVillageId =
        settlement.villageId != null && Number.isFinite(Number(settlement.villageId))
          ? Math.floor(Number(settlement.villageId))
          : null;

      syncOwnSettlementSelection(settlement);
      if (shouldCenterOnMap) {
        requestMapCenterOnSettlement(settlement.id);
      }

      if (settlementVillageId != null && ownedVillageIdSet.has(settlementVillageId)) {
        void loadVillageIntel(settlementVillageId);
      }

      if (!shouldPin) {
        setActivePanelId(id);
      }

      setPanels((previous) => {
        const existing = previous.find((panel) => panel.id === id);
        const nextZ = ++topZ.current;

        if (existing) {
          return previous.map((panel) => {
            if (panel.id === id) {
              return fitPanelToViewport(
                {
                  ...panel,
                  z: nextZ,
                  settlementId: settlement.id,
                  label,
                  side: nextSide,
                  width: 920,
                  height: 380,
                  expanded: !shouldPin,
                  alert: false,
                  layoutMode: 'floating',
                },
                viewportWidth,
                viewportHeight,
              );
            }
            if (!shouldPin && panel.type === 'village' && panel.expanded) {
              return {
                ...panel,
                expanded: false,
              };
            }
            return panel;
          });
        }

        const baseCreated = createPanelWindow('village', nextZ, previous.length, {
          id,
          settlementId: settlement.id,
          label,
          side: nextSide,
          width: 920,
          height: 380,
        });

        const created = fitPanelToViewport(
          {
            ...baseCreated,
            side: nextSide,
            expanded: !shouldPin,
            alert: false,
            layoutMode: 'floating',
          },
          viewportWidth,
          viewportHeight,
        );

        const collapsedVillagePanels = shouldPin
          ? previous
          : previous.map((panel) =>
              panel.type === 'village' && panel.expanded
                ? {
                    ...panel,
                    expanded: false,
                  }
                : panel,
            );

        return [...collapsedVillagePanels, created];
      });
    },
    [
      getCanvasViewportSize,
      loadVillageIntel,
      ownedVillageIdSet,
      requestMapCenterOnSettlement,
      syncOwnSettlementSelection,
    ],
  );

  const pinSettlementPanelToSide = useCallback(
    (settlement: RegionSettlement, side: PinSide) => {
      openSettlementPanel(settlement, { pinSide: side, centerOnMap: false });
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
              avatarUrl:
                exact && exact.kind === 'user'
                  ? exact.avatarUrl ?? previous[key]?.avatarUrl ?? null
                  : previous[key]?.avatarUrl ?? null,
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

  const handleResearchSpotlightClick = useCallback(() => {
    openPanel('research');
  }, [openPanel]);

  const focusPanel = (id: string) => {
    setActivePanelId(id);
    syncVillagePanelSelectionById(id);
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
    syncVillagePanelSelectionById(id);

    setPanels((previous) => {
      const target = previous.find((panel) => panel.id === id);
      if (!target) {
        return previous;
      }

      const nextZ = target.expanded ? target.z : ++topZ.current;
      const nextExpandedState = !target.expanded;
      const nextPanels = previous.map((panel) => {
        if (
          target.type === 'village' &&
          nextExpandedState &&
          panel.type === 'village' &&
          panel.id !== id &&
          panel.expanded
        ) {
          return {
            ...panel,
            expanded: false,
          };
        }
        if (panel.id !== id) {
          return panel;
        }

        const toggled: PanelWindow = {
          ...panel,
          expanded: nextExpandedState,
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

      return nextPanels;
    });

    if (nextMapSize) {
      mapWindowSizeRef.current = nextMapSize;
      saveMapWindowSize(nextMapSize);
    }
  };

  const closePanel = useCallback((id: string) => {
    setPanels((previous) => {
      const target = previous.find((panel) => panel.id === id);
      if (!target || target.type === 'map') {
        return previous;
      }

      setActivePanelId((activeId) => (activeId === id ? null : activeId));
      return previous.filter((panel) => panel.id !== id);
    });
  }, []);

  const closePinnedPanelsOnSide = useCallback((side: PinSide) => {
    setPanels((previous) => {
      const removedPanelIds = previous
        .filter((panel) => canPanelUsePinColumns(panel.type) && panel.type !== 'map' && panel.side === side)
        .map((panel) => panel.id);
      if (removedPanelIds.length <= 0) {
        return previous;
      }
      const removedSet = new Set(removedPanelIds);
      setActivePanelId((activeId) => (activeId != null && removedSet.has(activeId) ? null : activeId));
      return previous.filter(
        (panel) => !(canPanelUsePinColumns(panel.type) && panel.type !== 'map' && panel.side === side),
      );
    });
  }, []);

  const togglePinColumnsVisibility = useCallback(() => {
    if (autoHidePinColumns) {
      setIsPinColumnsOverlayVisible((previous) => !previous);
      return;
    }
    setIsPinColumnsTemporarilyHidden((previous) => !previous);
  }, [autoHidePinColumns]);

  const closePanelOnMiddleClick = (
    event: ReactMouseEvent<HTMLElement>,
    panelId: string,
  ): boolean => {
    void event;
    void panelId;
    return false;
  };

  const setPanelDockLayoutMode = useCallback(
    (id: string, nextMode: Extract<PanelLayoutMode, 'full' | 'split-left' | 'split-right'>) => {
      if (nextMode === 'full') {
        setActivePanelId(id);
      }

      setPanels((previous) => {
        const target = previous.find((panel) => panel.id === id);
        if (!target || !target.expanded || !canPanelUseDockLayout(target.type)) {
          return previous;
        }

        if (nextMode === 'full') {
          return moveDockPanelToCenterStage(previous, id);
        }

        const hasChanged = (left: PanelWindow, right: PanelWindow): boolean =>
          left.layoutMode !== right.layoutMode ||
          left.expanded !== right.expanded ||
          left.alert !== right.alert ||
          left.side !== right.side;

        let changed = false;
        const nextPanels = previous.map((panel) => {
          if (panel.id === id) {
            const updated = {
              ...panel,
              layoutMode: nextMode,
              expanded: true,
              alert: false,
              side:
                nextMode === 'split-left'
                  ? ('left' as PinSide)
                  : nextMode === 'split-right'
                    ? ('right' as PinSide)
                    : panel.side,
            };
            changed = changed || hasChanged(panel, updated);
            return updated;
          }

          if (!panel.expanded || !canPanelUseDockLayout(panel.type)) {
            return panel;
          }

          if (panel.layoutMode === 'full') {
            const oppositeMode: Extract<PanelLayoutMode, 'split-left' | 'split-right'> =
              nextMode === 'split-left' ? 'split-right' : 'split-left';
            const updated = {
              ...panel,
              layoutMode: oppositeMode,
              side: oppositeMode === 'split-left' ? ('left' as PinSide) : ('right' as PinSide),
            };
            changed = changed || hasChanged(panel, updated);
            return updated;
          }

          return panel;
        });

        return changed ? nextPanels : previous;
      });
    },
    [],
  );

  const activateDockTab = useCallback((id: string) => {
    setActivePanelId(id);
    setPanels((previous) => {
      const target = previous.find((panel) => panel.id === id);
      if (!target || !target.expanded || !canPanelUseDockLayout(target.type)) {
        return previous;
      }

      if (!target.alert) {
        return previous;
      }

      return previous.map((panel) => (panel.id === id ? { ...panel, alert: false } : panel));
    });
  }, []);

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
        if (!canPanelUsePinColumns(panel.type)) {
          return panel;
        }

        return {
          ...panel,
          side,
          expanded: false,
          alert: false,
          layoutMode: 'floating',
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

      const matchedPanelShortcutActionId = PANEL_SHORTCUT_ACTION_IDS.find((actionId) =>
        doesShortcutMatchEvent(event, shortcutBindings[actionId]),
      );
      if (matchedPanelShortcutActionId) {
        event.preventDefault();
        openPanel(PANEL_SHORTCUT_ACTION_TO_PANEL_TYPE[matchedPanelShortcutActionId]);
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

  const handleCancelRecruitment = useCallback(
    async (order: RecruitQueueOrder) => {
      if (!Number.isFinite(order.id) || order.id <= 0) {
        return;
      }
      if (reorderRecruitmentPendingId != null) {
        setArmyNotice('Fronta se právě upravuje. Zkus to znovu za okamžik.');
        setArmyNoticeUnitId(null);
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
      reorderRecruitmentPendingId,
      selectedWorldId,
      username,
    ],
  );

  const handleReorderRecruitment = useCallback(
    async (recruitmentIdRaw: number, targetIndexRaw: number): Promise<void> => {
      const recruitmentId = Math.max(0, Math.floor(Number(recruitmentIdRaw)));
      const rawTargetIndex = Math.floor(Number(targetIndexRaw));
      if (!Number.isFinite(recruitmentId) || recruitmentId <= 0) {
        setArmyNotice('Neplatná položka náborové fronty.');
        setArmyNoticeUnitId(null);
        return;
      }
      if (!Number.isFinite(rawTargetIndex) || rawTargetIndex <= 0) {
        setArmyNotice('Neplatná cílová pozice náborové fronty.');
        setArmyNoticeUnitId(null);
        return;
      }
      if (cancelRecruitmentPendingId != null || reorderRecruitmentPendingId != null) {
        setArmyNotice('Fronta se právě upravuje. Zkus to znovu za okamžik.');
        setArmyNoticeUnitId(null);
        return;
      }

      const movedRecruitment = (gameState?.activeRecruitments ?? []).find(
        (recruitment) => Number(recruitment.id) === recruitmentId,
      );
      const movedUnitId = movedRecruitment ? String(movedRecruitment.unitId ?? '') : '';
      const targetIndex = Math.max(1, rawTargetIndex);

      setReorderRecruitmentPendingId(recruitmentId);
      setArmyNotice(null);
      setArmyNoticeUnitId(null);

      try {
        const response = await reorderRecruitmentQueueRequest(
          username,
          recruitmentId,
          targetIndex,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        const fromDisplay = Number(response.result.fromIndex ?? 0) + 1;
        const toDisplay = Number(response.result.toIndex ?? 0) + 1;
        const notice =
          response.result.moved === false
            ? 'Pořadí náborové fronty zůstalo beze změny.'
            : `Pořadí náborové fronty upraveno: #${fromDisplay.toLocaleString('cs-CZ')} → #${toDisplay.toLocaleString('cs-CZ')}.`;
        setArmyNotice(notice);
        setArmyNoticeUnitId(movedUnitId || null);
        void loadGameState(true, true);
      } catch (error) {
        setArmyNotice(getErrorMessage(error));
        setArmyNoticeUnitId(null);
      } finally {
        setReorderRecruitmentPendingId(null);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      cancelRecruitmentPendingId,
      gameState?.activeRecruitments,
      gameState?.village.id,
      loadGameState,
      reorderRecruitmentPendingId,
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

  const handleRebaseSupport = useCallback(
    async (supportMovementId: number) => {
      if (!Number.isFinite(supportMovementId) || supportMovementId <= 0) {
        return;
      }
      setArmyCommandPending(true);
      setArmyCommandNotice(null);

      try {
        const response = await rebaseStationedSupportRequest(
          username,
          supportMovementId,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        setArmyCommandNotice(
          `Podpora byla převedena na domovské léno ${String(response.result.targetVillageName ?? '')}.`,
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

  const handleHireMercenaries = useCallback(
    async (targetVillageIdRaw: number) => {
      const targetVillageId = Math.max(0, Math.floor(Number(targetVillageIdRaw ?? 0)));
      if (!targetVillageId) {
        setResearchNotice('Vyber léno, kde chceš žoldáky najmout.');
        return;
      }
      setMercenaryActionPending(true);
      setResearchNotice(null);
      try {
        const response = await hireMercenaryContractRequest(
          username,
          targetVillageId,
          selectedWorldId,
        );
        const activeVillageForView = Number(gameState?.village.id ?? activeVillageId);
        if (targetVillageId === activeVillageForView) {
          applyIncomingGameState(response.data);
        }
        const villageLabel = String(response.result.villageName ?? `Léno #${targetVillageId}`);
        setResearchNotice(
          `Žoldáci najati v lénu ${villageLabel}. Dorazí ${new Date(response.result.arriveAt).toLocaleString('cs-CZ')}.`,
        );
        void loadGameState(true, true);
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
      } finally {
        setMercenaryActionPending(false);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleSendMarketLogistics = useCallback(
    async (payload: {
      targetVillageId: number;
      wood: number;
      stone: number;
      iron: number;
      gold: number;
      coins: number;
    }) => {
      if (logisticsSendLockRef.current) {
        return;
      }
      logisticsSendLockRef.current = true;
      setLogisticsActionPending(true);
      setResearchNotice(null);
      try {
        const response = await sendMarketLogisticsRequest(username, {
          targetVillageId: payload.targetVillageId,
          wood: payload.wood,
          stone: payload.stone,
          iron: payload.iron,
          gold: payload.gold,
          coins: payload.coins,
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
        logisticsSendLockRef.current = false;
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleCancelMarketLogistics = useCallback(
    async (routeIdRaw: number) => {
      const routeId = Math.max(0, Math.floor(Number(routeIdRaw)));
      if (!routeId) {
        return;
      }
      setCancelLogisticsPendingId(routeId);
      setResearchNotice(null);
      try {
        const response = await cancelMarketLogisticsRequest(
          username,
          routeId,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        applyIncomingGameState(response.data);
        setResearchNotice(
          `Transport #${response.result.canceledRouteId} zrušen. Vráceno: ${response.result.refunded.wood.toLocaleString('cs-CZ')} dřeva, ${response.result.refunded.stone.toLocaleString('cs-CZ')} kamene, ${response.result.refunded.iron.toLocaleString('cs-CZ')} železa, ${response.result.refunded.gold.toLocaleString('cs-CZ')} zlata, ${response.result.refunded.coins.toLocaleString('cs-CZ')} mincí.`,
        );
        void loadGameState(true, true);
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
      } finally {
        setCancelLogisticsPendingId(null);
      }
    },
    [activeVillageId, applyIncomingGameState, gameState?.village.id, loadGameState, selectedWorldId, username],
  );

  const handleConfigureMarketGuildAutomation = useCallback(
    async (payload: { enabled: boolean; targetVillageIds: number[]; pausedTargetVillageIds: number[] }): Promise<boolean> => {
      setGuildActionPending(true);
      setResearchNotice(null);
      try {
        const response = await configureMarketGuildAutomationRequest(username, {
          enabled: payload.enabled,
          targetVillageIds: payload.targetVillageIds,
          pausedTargetVillageIds: payload.pausedTargetVillageIds,
          villageId: gameState?.village.id ?? activeVillageId,
          worldId: selectedWorldId,
        });
        applyIncomingGameState(response.data);
        setResearchNotice(
          `Cech obchodníků aktualizován: ${response.result.targetCount.toLocaleString('cs-CZ')} cílů, cyklus ${Math.floor(response.result.cycleIntervalSec / 3600)} h.`,
        );
        void loadGameState(true, true);
        return true;
      } catch (error) {
        setResearchNotice(getErrorMessage(error));
        return false;
      } finally {
        setGuildActionPending(false);
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

  const openVillageRenameInline = useCallback(() => {
    if (renameVillagePending || !gameState) {
      return;
    }
    setVillageRenameDraft(activeVillageBaseName);
    setVillageRenameNotice(null);
    setIsVillageRenameOpen(true);
  }, [activeVillageBaseName, gameState, renameVillagePending]);

  const submitVillageRenameInline = useCallback(async () => {
    if (renameVillagePending) {
      return;
    }
    const notice = await handleRenameVillage(villageRenameDraft);
    setVillageRenameNotice(notice);
    const normalizedNotice = notice.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const isSuccessfulRename =
      normalizedNotice.includes('premenovano') || normalizedNotice.includes('beze zmeny');
    if (!isSuccessfulRename) {
      return;
    }
    setIsVillageRenameOpen(false);
    setVillageRenameDraft(activeVillageBaseName);
  }, [activeVillageBaseName, handleRenameVillage, renameVillagePending, villageRenameDraft]);

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
  }, [
    activeVillageId,
    applyIncomingGameState,
    gameState?.village.id,
    loadGameState,
    selectedWorldId,
    username,
  ]);

  const handleCancelBuildingUpgrade = useCallback(
    async (
      upgradeOrderId: number,
      buildingId: string,
      requestedVillageIdRaw?: number | null,
    ): Promise<string> => {
      if (!Number.isFinite(upgradeOrderId) || upgradeOrderId <= 0) {
        return 'Neplatná položka stavební fronty.';
      }
      if (cancelUpgradeQueuePending || reorderUpgradePendingOrderId != null) {
        return 'Fronta se právě upravuje. Zkus to znovu za okamžik.';
      }
      const currentVillageId = gameState?.village.id ?? activeVillageId;
      const requestedVillageId =
        requestedVillageIdRaw == null || String(requestedVillageIdRaw).trim() === ''
          ? Number(currentVillageId ?? 0)
          : Math.max(0, Math.floor(Number(requestedVillageIdRaw)));
      if (!Number.isFinite(requestedVillageId) || requestedVillageId <= 0) {
        return 'Neplatné léno pro rušení stavby.';
      }
      const isCurrentVillageTarget =
        currentVillageId != null && Number.isFinite(Number(currentVillageId))
          ? Number(currentVillageId) === requestedVillageId
          : false;

      setCancelUpgradePendingOrderId(upgradeOrderId);
      if (isCurrentVillageTarget) {
        setBuildingNotices((previous) => ({
          ...previous,
          [buildingId]: '',
        }));
      }

      try {
        const response = await cancelBuildingUpgradeRequest(
          username,
          upgradeOrderId,
          requestedVillageId,
          selectedWorldId,
        );
        const canceledCount = Number(response.result.canceledCount ?? 1);
        const cancelSuffix =
          canceledCount > 1
            ? ` Z fronty bylo odstraněno ${canceledCount.toLocaleString('cs-CZ')} navazujících upgradu.`
            : '';
        const notice = `Upgrade zrušen, vráceno ${formatResourceBundleLabel(response.result.refunded)}.${cancelSuffix}`;
        if (isCurrentVillageTarget) {
          applyIncomingGameState(response.data);
          setBuildingNotices((previous) => ({
            ...previous,
            [buildingId]: notice,
          }));
          void loadGameState(true, true);
        } else {
          const nextIntelData = toVillageIntelData(response.data);
          setVillageIntelByVillageId((previous) => ({
            ...previous,
            [requestedVillageId]: {
              status: 'ready',
              data: nextIntelData,
              error: null,
              fetchedAt: Date.now(),
            },
          }));
        }
        return notice;
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        if (isCurrentVillageTarget) {
          setBuildingNotices((previous) => ({
            ...previous,
            [buildingId]: errorMessage,
          }));
        }
        return errorMessage;
      } finally {
        setCancelUpgradePendingOrderId(null);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      cancelUpgradeQueuePending,
      gameState?.village.id,
      loadGameState,
      reorderUpgradePendingOrderId,
      selectedWorldId,
      username,
    ],
  );

  const handleCancelAllBuildingUpgrades = useCallback(
    async (requestedVillageIdRaw?: number | null): Promise<string> => {
      if (cancelUpgradePendingOrderId != null || reorderUpgradePendingOrderId != null || cancelUpgradeQueuePending) {
        return 'Fronta se právě upravuje. Zkus to znovu za okamžik.';
      }
      const queuedUpgrades = gameState?.activeUpgrades ?? [];
      if (queuedUpgrades.length <= 0) {
        return 'Stavební fronta je již prázdná.';
      }

      if (typeof window !== 'undefined') {
        const shouldCancelQueue = window.confirm(
          'Opravdu chceš ukončit celou stavební frontu? Zruší se všechny aktivní i čekající upgrady.',
        );
        if (!shouldCancelQueue) {
          return 'Ukončení fronty bylo zrušeno.';
        }
      }

      const currentVillageId = gameState?.village.id ?? activeVillageId;
      const requestedVillageId =
        requestedVillageIdRaw == null || String(requestedVillageIdRaw).trim() === ''
          ? Number(currentVillageId ?? 0)
          : Math.max(0, Math.floor(Number(requestedVillageIdRaw)));
      if (!Number.isFinite(requestedVillageId) || requestedVillageId <= 0) {
        return 'Neplatné léno pro ukončení stavební fronty.';
      }
      const isCurrentVillageTarget =
        currentVillageId != null && Number.isFinite(Number(currentVillageId))
          ? Number(currentVillageId) === requestedVillageId
          : false;
      const queuedBuildingIds = [
        ...new Set(queuedUpgrades.map((upgrade) => String(upgrade.buildingId))),
      ].filter((buildingId) => buildingId.trim() !== '');

      setCancelUpgradeQueuePending(true);
      if (isCurrentVillageTarget) {
        setBuildingNotices((previous) => {
          const next = { ...previous };
          for (const buildingId of queuedBuildingIds) {
            next[buildingId] = '';
          }
          return next;
        });
      }

      try {
        const response = await cancelAllBuildingUpgradesRequest(username, requestedVillageId, selectedWorldId);
        const canceledCount = Math.max(0, Math.floor(Number(response.result.canceledCount ?? 0)));
        const notice =
          canceledCount <= 0
            ? 'Stavební fronta je již prázdná.'
            : `Stavební fronta ukončena. Zrušeno ${canceledCount.toLocaleString('cs-CZ')} položek, vráceno ${formatResourceBundleLabel(response.result.refunded)}.`;

        if (isCurrentVillageTarget) {
          applyIncomingGameState(response.data);
          setBuildingNotices((previous) => {
            const next = { ...previous };
            for (const buildingId of queuedBuildingIds) {
              next[buildingId] = notice;
            }
            return next;
          });
          void loadGameState(true, true);
        } else {
          const nextIntelData = toVillageIntelData(response.data);
          setVillageIntelByVillageId((previous) => ({
            ...previous,
            [requestedVillageId]: {
              status: 'ready',
              data: nextIntelData,
              error: null,
              fetchedAt: Date.now(),
            },
          }));
        }
        return notice;
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        if (isCurrentVillageTarget) {
          setBuildingNotices((previous) => {
            const next = { ...previous };
            for (const buildingId of queuedBuildingIds) {
              next[buildingId] = errorMessage;
            }
            return next;
          });
        }
        return errorMessage;
      } finally {
        setCancelUpgradeQueuePending(false);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      cancelUpgradePendingOrderId,
      cancelUpgradeQueuePending,
      gameState?.activeUpgrades,
      gameState?.village.id,
      loadGameState,
      reorderUpgradePendingOrderId,
      selectedWorldId,
      username,
    ],
  );

  const handleReorderBuildingUpgrade = useCallback(
    async (
      upgradeOrderId: number,
      targetIndexRaw: number,
      requestedVillageIdRaw?: number | null,
    ): Promise<string> => {
      if (!Number.isFinite(upgradeOrderId) || upgradeOrderId <= 0) {
        return 'Neplatná položka stavební fronty.';
      }
      if (!Number.isFinite(targetIndexRaw) || targetIndexRaw <= 0) {
        return 'Neplatná cílová pozice fronty.';
      }
      if (cancelUpgradePendingOrderId != null || cancelUpgradeQueuePending || reorderUpgradePendingOrderId != null) {
        return 'Fronta se právě upravuje. Zkus to znovu za okamžik.';
      }

      const currentVillageId = gameState?.village.id ?? activeVillageId;
      const requestedVillageId =
        requestedVillageIdRaw == null || String(requestedVillageIdRaw).trim() === ''
          ? Number(currentVillageId ?? 0)
          : Math.max(0, Math.floor(Number(requestedVillageIdRaw)));
      if (!Number.isFinite(requestedVillageId) || requestedVillageId <= 0) {
        return 'Neplatné léno pro přesun ve stavební frontě.';
      }
      const isCurrentVillageTarget =
        currentVillageId != null && Number.isFinite(Number(currentVillageId))
          ? Number(currentVillageId) === requestedVillageId
          : false;
      const targetIndex = Math.max(1, Math.floor(targetIndexRaw));
      const movedUpgrade = (gameState?.activeUpgrades ?? []).find(
        (upgrade) => Number(upgrade.id) === Math.floor(upgradeOrderId),
      );
      const movedBuildingId = movedUpgrade ? String(movedUpgrade.buildingId) : null;

      setReorderUpgradePendingOrderId(Math.floor(upgradeOrderId));
      if (isCurrentVillageTarget && movedBuildingId) {
        setBuildingNotices((previous) => ({
          ...previous,
          [movedBuildingId]: '',
        }));
      }

      try {
        const response = await reorderBuildingUpgradeQueueRequest(
          username,
          Math.floor(upgradeOrderId),
          targetIndex,
          requestedVillageId,
          selectedWorldId,
        );
        const fromDisplay = Number(response.result.fromIndex) + 1;
        const toDisplay = Number(response.result.toIndex) + 1;
        const notice =
          response.result.moved === false
            ? 'Pořadí stavební fronty zůstalo beze změny.'
            : `Pořadí fronty upraveno: #${fromDisplay.toLocaleString('cs-CZ')} → #${toDisplay.toLocaleString('cs-CZ')}.`;

        if (isCurrentVillageTarget) {
          applyIncomingGameState(response.data);
          if (movedBuildingId) {
            setBuildingNotices((previous) => ({
              ...previous,
              [movedBuildingId]: notice,
            }));
          }
          void loadGameState(true, true);
        } else {
          const nextIntelData = toVillageIntelData(response.data);
          setVillageIntelByVillageId((previous) => ({
            ...previous,
            [requestedVillageId]: {
              status: 'ready',
              data: nextIntelData,
              error: null,
              fetchedAt: Date.now(),
            },
          }));
        }
        return notice;
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        if (isCurrentVillageTarget && movedBuildingId) {
          setBuildingNotices((previous) => ({
            ...previous,
            [movedBuildingId]: errorMessage,
          }));
        }
        return errorMessage;
      } finally {
        setReorderUpgradePendingOrderId(null);
      }
    },
    [
      activeVillageId,
      applyIncomingGameState,
      cancelUpgradePendingOrderId,
      cancelUpgradeQueuePending,
      gameState?.activeUpgrades,
      gameState?.village.id,
      loadGameState,
      reorderUpgradePendingOrderId,
      selectedWorldId,
      username,
    ],
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
  }, [
    activeVillageId,
    applyIncomingGameState,
    gameState?.village.id,
    loadGameState,
    selectedWorldId,
    username,
  ]);

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

  const handleSetKingdomDiplomacy = useCallback(
    async (targetKingdom: string, relationKind: KingdomDiplomacyRelationKind) => {
      const normalizedTargetKingdom = targetKingdom.trim();
      if (!normalizedTargetKingdom) {
        return;
      }

      setKingdomActionPending(true);
      setKingdomNotice(null);

      try {
        const response = await setKingdomDiplomacyRequest(
          username,
          normalizedTargetKingdom,
          relationKind,
          gameState?.village.id ?? activeVillageId,
          selectedWorldId,
        );
        const nextState = response.data;
        applyIncomingGameState(nextState);
        const relationLabel = KINGDOM_DIPLOMACY_RELATION_LABELS[response.result.relationKind] ?? 'Neutrální';
        if (response.result.changed) {
          setKingdomNotice(`Diplomacie vůči ${response.result.targetKingdom} nastavena na ${relationLabel}.`);
        } else {
          setKingdomNotice(`Diplomacie vůči ${response.result.targetKingdom} už byla nastavena na ${relationLabel}.`);
        }
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
    setMapPreviewTravelModifier(DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER);
    setShortcutNotice('Všechny vlastní zkratky včetně mapového modifikátoru byly vráceny na výchozí nastavení.');
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

  const handleMapPreviewTravelModifierChange = useCallback((modifier: MapPreviewTravelModifierKey) => {
    const normalizedModifier = normalizeMapPreviewTravelModifier(modifier);
    setMapPreviewTravelModifier(normalizedModifier);
    const label =
      MAP_PREVIEW_TRAVEL_MODIFIER_OPTIONS.find((item) => item.value === normalizedModifier)?.label ??
      DEFAULT_MAP_PREVIEW_TRAVEL_MODIFIER.toUpperCase();
    setShortcutNotice(`Mapa: časy přesunu zobrazíš podržením ${label}.`);
  }, []);

  const handleSettlementColorChange = useCallback((colorKey: SettlementColorKey, color: string) => {
    setSettlementColorPalette((previous) => ({
      ...previous,
      [colorKey]: normalizeHexColor(color, previous[colorKey]),
    }));
    setSettingsNotice(null);
  }, []);

  const handleResetSettlementColors = useCallback(() => {
    setSettlementColorPalette({ ...DEFAULT_SETTLEMENT_COLOR_PALETTE });
    setSettingsNotice('Barevná paleta lén byla vrácena na výchozí RPG nastavení.');
  }, []);

  const handleSaveAvatar = useCallback(
    async (nextAvatarUrl: string | null): Promise<string> => {
      setAvatarPending(true);
      setSettingsNotice(null);
      try {
        const response = await setCommunicationAvatarRequest(username, nextAvatarUrl);
        const savedAvatarUrl = response.result.avatarUrl ?? null;
        setMyAvatarUrl(savedAvatarUrl);
        saveStoredAvatarUrl(username, savedAvatarUrl);
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
        selectedSpawnDirection,
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
  }, [
    activeVillageId,
    applyIncomingGameState,
    gameState?.village.id,
    loadGameState,
    selectedSpawnDirection,
    selectedWorldId,
    username,
  ]);

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

  const loadBattleReportById = useCallback(
    async (reportId: number): Promise<BattleReportItem | null> => {
      if (!session || !selectedWorldId) {
        return null;
      }

      const numericReportId = Math.floor(Number(reportId));
      if (!Number.isFinite(numericReportId) || numericReportId <= 0) {
        return null;
      }

      const cachedReport = battleReportsById.get(numericReportId) ?? null;
      if (cachedReport) {
        return cachedReport;
      }

      const pendingRequest = battleReportDetailRequestByIdRef.current[numericReportId];
      if (pendingRequest) {
        return pendingRequest;
      }

      const requestScopeKey = battleReportScopeKeyRef.current;
      const requestState: { promise: Promise<BattleReportItem | null> | null } = { promise: null };
      const requestPromise: Promise<BattleReportItem | null> = (async () => {
        setBattleReportPendingById((previous) => ({
          ...previous,
          [numericReportId]: true,
        }));

        try {
          const report = await fetchBattleReportById(username, numericReportId, selectedWorldId);
          if (battleReportScopeKeyRef.current !== requestScopeKey) {
            return report;
          }
          setBattleReportCacheById((previous) => ({
            ...previous,
            [report.id]: report,
          }));
          setBattleReportsError(null);
          return report;
        } catch (error) {
          if (battleReportScopeKeyRef.current === requestScopeKey) {
            setBattleReportsError(getErrorMessage(error));
          }
          return null;
        } finally {
          if (battleReportDetailRequestByIdRef.current[numericReportId] === requestState.promise) {
            delete battleReportDetailRequestByIdRef.current[numericReportId];
          }
          if (battleReportScopeKeyRef.current === requestScopeKey) {
            setBattleReportPendingById((previous) => {
              if (previous[numericReportId] !== true) {
                return previous;
              }
              const next = { ...previous };
              delete next[numericReportId];
              return next;
            });
          }
        }
      })();

      requestState.promise = requestPromise;
      battleReportDetailRequestByIdRef.current[numericReportId] = requestPromise;
      return requestPromise;
    },
    [battleReportsById, selectedWorldId, session, username],
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

      if (!report) {
        void loadBattleReportById(numericReportId);
      }
    },
    [battleReportsById, getCanvasViewportSize, loadBattleReportById],
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
        if (reportId != null || shareToken) {
          void (async () => {
            if (reportId != null) {
              const report = await loadBattleReportById(reportId);
              if (report) {
                openBattleReportPanel(report.id);
                return;
              }
            }
            if (shareToken) {
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
    loadBattleReportById,
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

  const leftPins = panels.filter(
    (panel) => canPanelUsePinColumns(panel.type) && panel.type !== 'map' && panel.side === 'left',
  );
  const rightPins = panels.filter(
    (panel) => canPanelUsePinColumns(panel.type) && panel.type !== 'map' && panel.side === 'right',
  );
  const activeMainStagePanel =
    panels.find(
      (panel) => panel.id === activePanelId && panel.expanded && isMainMenuPanelType(panel.type),
    ) ??
    panels.find((panel) => panel.expanded && isMainMenuPanelType(panel.type) && panel.type !== 'map') ??
    panels.find((panel) => panel.type === 'map');
  const activeMainStageLabel = activeMainStagePanel?.label ?? PANEL_META.map.label;
  const isMapStageActive = activeMainStagePanel?.type === 'map';

  const renderPanelContent = (panel: PanelWindow) => {
    switch (panel.type) {
      case 'city':
        return (
          <CityPanel
            villageLabel={villageLabel}
            prestige={gameState?.village.prestige ?? 0}
            cityResourceSnapshot={cityPanelResourceSnapshot}
            availableResources={cityPanelAvailableResources}
            buildings={buildings}
            onOpenBuilding={openBuildingPanel}
            onUpgradeBuilding={handleBuildingUpgrade}
            onCancelBuildingUpgrade={handleCancelBuildingUpgrade}
            onCancelAllBuildingUpgrades={() => {
              void handleCancelAllBuildingUpgrades();
            }}
            onReorderBuildingUpgrade={(upgradeOrderId, targetIndex) => {
              void handleReorderBuildingUpgrade(upgradeOrderId, targetIndex);
            }}
            buildingUpgradeQueueByBuilding={buildingUpgradeQueueByBuilding}
            upgradePendingBuildingId={upgradePendingBuildingId}
            cancelUpgradePendingOrderId={cancelUpgradePendingOrderId}
            reorderUpgradePendingOrderId={reorderUpgradePendingOrderId}
            cancelUpgradeQueuePending={cancelUpgradeQueuePending}
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
            isInteractionEnabled={isMapStageActive}
            centerRequest={mapCenterRequest}
            onCenterRequestHandled={handleMapCenterRequestHandled}
            activeVillageId={gameState?.village.id ?? activeVillageId}
            currentUsername={username}
            zoomPercent={mapZoomPercent}
            orderMarkersByVillageId={mapOrderMarkersByVillageId}
            onZoomChange={setMapZoomPercent}
            onOpenSettlement={(settlement) => {
              openSettlementPanel(settlement, { centerOnMap: false });
            }}
            onPinSettlement={pinSettlementPanelToSide}
            onQuickArmyCommand={handleMapQuickArmyCommand}
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
            worldId={selectedWorldId}
            isExpanded={panel.expanded}
            onRecruit={handleRecruit}
            onCancelRecruitment={handleCancelRecruitment}
            onReorderRecruitment={(recruitmentId, targetIndex) => {
              void handleReorderRecruitment(recruitmentId, targetIndex);
            }}
            onUpgradeBuilding={handleBuildingUpgrade}
            onOpenSettlementByVillageId={openSettlementByVillageId}
            recruitPendingUnitId={recruitPendingUnitId}
            cancelRecruitmentPendingId={cancelRecruitmentPendingId}
            reorderRecruitmentPendingId={reorderRecruitmentPendingId}
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
            mercenaries={gameState?.mercenaries}
            resources={gameState?.resources}
            notice={researchNotice}
            isArmyCommandPending={armyCommandPending}
            cancelCommandProgressLimit={gameState?.rules?.cancelCommandProgressLimit}
            onCancelArmyCommand={handleCancelArmyCommand}
            mercenaryActionPending={mercenaryActionPending}
            onHireMercenaries={handleHireMercenaries}
          />
        );
      case 'commands':
        return (
          <CommandsPanel
            activeMovements={armyActiveMovements}
            incomingMovements={armyIncomingMovements}
            stationedSupports={armyStationedSupports}
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
            onRebaseSupport={handleRebaseSupport}
            isArmyCommandPending={armyCommandPending}
            logisticsActionPending={logisticsActionPending}
            guildActionPending={guildActionPending}
            cancelLogisticsPendingId={cancelLogisticsPendingId}
            cancelCommandProgressLimit={gameState?.rules?.cancelCommandProgressLimit}
            commandNotice={armyCommandNotice}
            onSendMarketLogistics={handleSendMarketLogistics}
            onCancelMarketLogistics={handleCancelMarketLogistics}
            onConfigureMarketGuildAutomation={handleConfigureMarketGuildAutomation}
            onOpenSettlementByVillageId={openSettlementByVillageId}
          />
        );
      case 'research':
        return (
          <ResearchPanel
            research={gameState?.research}
            rules={gameState?.rules}
            market={gameState?.market}
            resources={gameState?.resources}
            settlements={mapSettlements}
            currentVillageId={gameState?.village.id ?? activeVillageId}
            currentUsername={username}
            notice={researchNotice}
            logisticsNotice={armyCommandNotice}
            researchActionPending={researchActionPending}
            logisticsActionPending={logisticsActionPending}
            cancelLogisticsPendingId={cancelLogisticsPendingId}
            onHireAcademics={handleHireAcademics}
            onAdjustResearchAcademics={handleAdjustResearchAcademics}
            onStartResearchProject={handleStartResearchProject}
            onSendMarketLogistics={handleSendMarketLogistics}
            onCancelMarketLogistics={handleCancelMarketLogistics}
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
        const reportId =
          panel.battleReportId != null && Number.isFinite(panel.battleReportId)
            ? Math.floor(panel.battleReportId)
            : null;
        const report = reportId != null ? battleReportsById.get(reportId) ?? null : null;
        const loading = reportId != null ? battleReportPendingById[reportId] === true : false;
        return <BattleReportPanel report={report} loading={loading} />;
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
            onSetDiplomacy={handleSetKingdomDiplomacy}
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
            kingdomHub={gameState?.kingdomHub ?? null}
            actionPending={kingdomActionPending}
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
            onSetDiplomacy={handleSetKingdomDiplomacy}
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
            villageCount={playerLeaderboardEntry?.villages ?? gameState?.villages.length ?? 1}
            rank={resolvedPlayerRank}
            attackerRank={resolvedPlayerAttackerRank}
            defenderRank={resolvedPlayerDefenderRank}
            supporterRank={resolvedPlayerSupporterRank}
            lootRank={resolvedPlayerLootRank}
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
            mapPreviewTravelModifier={mapPreviewTravelModifier}
            shortcutNotice={shortcutNotice}
            isTouchDevice={isTouchDevice}
            onCaptureShortcut={handleShortcutCapture}
            onResetShortcutBinding={handleShortcutResetOne}
            onResetAllShortcuts={handleShortcutResetAll}
            onAutoHidePinColumnsChange={handleAutoHidePinColumnsChange}
            onMapPreviewTravelModifierChange={handleMapPreviewTravelModifierChange}
            settlementColorPalette={settlementColorPalette}
            onSettlementColorChange={handleSettlementColorChange}
            onResetSettlementColors={handleResetSettlementColors}
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

        const settlementVillageId =
          settlement.villageId != null && Number.isFinite(Number(settlement.villageId))
            ? Math.floor(Number(settlement.villageId))
            : null;
        const canLoadVillageIntel =
          settlementVillageId != null && ownedVillageIdSet.has(settlementVillageId);
        const villageIntelEntry =
          settlementVillageId != null ? villageIntelByVillageId[settlementVillageId] ?? null : null;
        const villageNavigationIndex =
          settlementVillageId == null
            ? -1
            : playerVillages.findIndex((candidate) => {
                const candidateVillageId = Math.floor(Number(candidate.id));
                return Number.isFinite(candidateVillageId) && candidateVillageId === settlementVillageId;
              });
        const showVillageNavigation = villageNavigationIndex !== -1 && playerVillages.length > 0;
        const canNavigateToPreviousVillage = villageNavigationIndex > 0;
        const canNavigateToNextVillage =
          villageNavigationIndex !== -1 && villageNavigationIndex < playerVillages.length - 1;
        const navigateVillagePanelByOffset = (offset: -1 | 1) => {
          if (villageNavigationIndex === -1) {
            return;
          }

          const nextVillage = playerVillages[villageNavigationIndex + offset];
          if (!nextVillage) {
            return;
          }

          const nextVillageId = Math.floor(Number(nextVillage.id));
          if (!Number.isFinite(nextVillageId) || nextVillageId <= 0) {
            return;
          }

          const nextSettlement = ownSettlements.find(
            (candidate) => candidate.villageId != null && Math.floor(Number(candidate.villageId)) === nextVillageId,
          );
          if (!nextSettlement) {
            applyActiveVillageSelection(nextVillageId);
            return;
          }

          syncOwnSettlementSelection(nextSettlement);
          requestMapCenterOnSettlement(nextSettlement.id);
          if (ownedVillageIdSet.has(nextVillageId)) {
            void loadVillageIntel(nextVillageId);
          }

          setActivePanelId(panel.id);
          setPanels((previous) =>
            previous.map((candidate) =>
              candidate.id === panel.id
                ? {
                    ...candidate,
                    settlementId: nextSettlement.id,
                    label: `${nextSettlement.name} (${nextSettlement.globalX}|${nextSettlement.globalY})`,
                    alert: false,
                  }
                : candidate,
            ),
          );
        };

        return (
          <VillagePanel
            settlement={settlement}
            villageIntelEntry={villageIntelEntry}
            canLoadVillageIntel={canLoadVillageIntel}
            onLoadVillageIntel={(options) => {
              if (settlementVillageId == null) {
                return;
              }
              void loadVillageIntel(settlementVillageId, options);
            }}
            showVillageNavigation={showVillageNavigation}
            canNavigateToPreviousVillage={canNavigateToPreviousVillage}
            canNavigateToNextVillage={canNavigateToNextVillage}
            onNavigateToPreviousVillage={() => {
              navigateVillagePanelByOffset(-1);
            }}
            onNavigateToNextVillage={() => {
              navigateVillagePanelByOffset(1);
            }}
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

  const expandedPanels = useMemo(
    () => panels.filter((panel) => panel.expanded),
    [panels],
  );
  const resolvedDockMode = useCallback(
    (panel: PanelWindow): PanelLayoutMode => resolvePanelDockLayoutMode(panel),
    [],
  );
  const dockPanels = useMemo(
    () =>
      expandedPanels.filter(
        (panel) => canPanelUseDockLayout(panel.type) && isDockLayoutMode(resolvedDockMode(panel)),
      ),
    [expandedPanels, resolvedDockMode],
  );
  const floatingPanels = useMemo(
    () =>
      expandedPanels.filter(
        (panel) => !canPanelUseDockLayout(panel.type),
      ),
    [expandedPanels],
  );

  const fullDockPanels = useMemo(
    () => dockPanels.filter((panel) => resolvedDockMode(panel) === 'full'),
    [dockPanels, resolvedDockMode],
  );
  const leftDockPanels = useMemo(
    () => dockPanels.filter((panel) => resolvedDockMode(panel) === 'split-left'),
    [dockPanels, resolvedDockMode],
  );
  const rightDockPanels = useMemo(
    () => dockPanels.filter((panel) => resolvedDockMode(panel) === 'split-right'),
    [dockPanels, resolvedDockMode],
  );
  useEffect(() => {
    if (!activePanelId) {
      return;
    }
    const activeDockPanel = panels.find(
      (panel) => panel.id === activePanelId && panel.expanded && canPanelUseDockLayout(panel.type),
    );
    if (!activeDockPanel) {
      return;
    }
    const mode = resolvePanelDockLayoutMode(activeDockPanel);
    if (mode === 'full') {
      setActiveFullDockPanelId(activeDockPanel.id);
      return;
    }
    if (mode === 'split-left') {
      setActiveLeftDockPanelId(activeDockPanel.id);
      return;
    }
    if (mode === 'split-right') {
      setActiveRightDockPanelId(activeDockPanel.id);
    }
  }, [activePanelId, panels]);

  useEffect(() => {
    setActiveFullDockPanelId((previous) =>
      previous != null && fullDockPanels.some((panel) => panel.id === previous)
        ? previous
        : fullDockPanels[0]?.id ?? null,
    );
    setActiveLeftDockPanelId((previous) =>
      previous != null && leftDockPanels.some((panel) => panel.id === previous)
        ? previous
        : leftDockPanels[0]?.id ?? null,
    );
    setActiveRightDockPanelId((previous) =>
      previous != null && rightDockPanels.some((panel) => panel.id === previous)
        ? previous
        : rightDockPanels[0]?.id ?? null,
    );
  }, [fullDockPanels, leftDockPanels, rightDockPanels]);

  const fullDockPanel =
    fullDockPanels.find((panel) => panel.id === activeFullDockPanelId) ??
    fullDockPanels.find((panel) => panel.id === activePanelId) ??
    fullDockPanels[0] ??
    null;
  const leftDockPanel =
    leftDockPanels.find((panel) => panel.id === activeLeftDockPanelId) ??
    leftDockPanels.find((panel) => panel.id === activePanelId) ??
    leftDockPanels[0] ??
    null;
  const rightDockPanel =
    rightDockPanels.find((panel) => panel.id === activeRightDockPanelId) ??
    rightDockPanels.find((panel) => panel.id === activePanelId) ??
    rightDockPanels[0] ??
    null;
  const hasDockedPanels =
    fullDockPanels.length > 0 || leftDockPanels.length > 0 || rightDockPanels.length > 0;
  const currentCanvasViewport = getCanvasViewportSize();
  const stretchedMainStageFrame = getStretchedPanelFrame(
    currentCanvasViewport.viewportWidth,
    currentCanvasViewport.viewportHeight,
  );
  const dockFrame = {
    x: stretchedMainStageFrame.x,
    y: stretchedMainStageFrame.y,
    width: stretchedMainStageFrame.width,
    height: stretchedMainStageFrame.height,
  };

  const renderPanelWindow = (panel: PanelWindow, options?: { docked?: boolean }) => {
    const isDocked = options?.docked === true;
    const canDock = canPanelUseDockLayout(panel.type);
    const panelDockMode = resolvedDockMode(panel);
    const isDockedLeft = panelDockMode === 'split-left';
    const isDockedRight = panelDockMode === 'split-right';
    const isDockedFull = panelDockMode === 'full';
    const isMapPanel = panel.type === 'map';
    const isVillagePanel = panel.type === 'village';
    const isMainMenuPanel = isMainMenuPanelType(panel.type);
    const shouldPreferLandscapeFrame = LANDSCAPE_PANEL_TYPES.has(panel.type);
    const shouldAnchorVillageToBottom = !isDocked && isVillagePanel;
    const shouldAutoSizeToContent = !isDocked && !isMapPanel && !isMainMenuPanel && !shouldPreferLandscapeFrame;
    const autoSizeMaxWidthPx = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_WIDTH,
      currentCanvasViewport.viewportWidth - PANEL_VIEWPORT_MARGIN_X * 2,
    );
    const autoSizeMaxHeightPx = Math.max(
      PANEL_VIEWPORT_ABSOLUTE_MIN_HEIGHT,
      currentCanvasViewport.viewportHeight - PANEL_VIEWPORT_MARGIN_Y,
    );
    const shouldAnimateMainMenuContent = isMainMenuPanel && !isMapPanel;
    const shouldRenderHeader = !isMapPanel && !isMainMenuPanel;
    const shouldRenderQuickWindowActions = !isMainMenuPanel;
    const shouldRenderWindowVisibilityActions = !isMainMenuPanel;
    const panelZIndex = isMapPanel
      ? MAP_BACKGROUND_PANEL_Z_INDEX
      : isVillagePanel
        ? VILLAGE_PANEL_BASE_Z_INDEX + panel.z
        : FLOATING_PANEL_BASE_Z_INDEX + panel.z;

    return (
      <article
        key={panel.id}
        className={`floating-window${isMapPanel ? ' map-window map-main-window' : ''}${!shouldRenderHeader ? ' no-window-header' : ''}${panel.type === 'battleReport' ? ' battle-report-window' : ''}${panel.type === 'village' ? ' village-panel-window' : ''}${shouldAutoSizeToContent ? ' auto-size-window' : ''}${isDocked ? ' docked-window' : ''}${shouldAnimateMainMenuContent ? ' main-menu-page-window' : ''}`}
        ref={(node) => {
          panelElementRefs.current[panel.id] = node;
        }}
        style={
          isDocked
            ? undefined
            : isMainMenuPanel
                ? {
                  left: `${stretchedMainStageFrame.x}px`,
                  top: `${stretchedMainStageFrame.y}px`,
                  zIndex: panelZIndex,
                  width: `${stretchedMainStageFrame.width}px`,
                  height: `${stretchedMainStageFrame.height}px`,
                }
            : {
                left: shouldAnchorVillageToBottom ? '50%' : `${panel.x}px`,
                top: shouldAnchorVillageToBottom ? undefined : `${panel.y}px`,
                bottom: shouldAnchorVillageToBottom ? '4.35rem' : undefined,
                transform: shouldAnchorVillageToBottom ? 'translateX(-50%)' : undefined,
                zIndex: panelZIndex,
                width: shouldAutoSizeToContent ? 'fit-content' : `${panel.width}px`,
                height: shouldAutoSizeToContent ? 'fit-content' : `${panel.height}px`,
                maxWidth: shouldAutoSizeToContent
                  ? `${Math.round(autoSizeMaxWidthPx)}px`
                  : undefined,
                maxHeight: shouldAutoSizeToContent
                  ? `${Math.round(autoSizeMaxHeightPx)}px`
                  : undefined,
              }
        }
        onMouseDown={(event) => {
          if (closePanelOnMiddleClick(event, panel.id)) {
            return;
          }
          focusPanel(panel.id);
        }}
      >
        {shouldRenderHeader ? (
          <header
            className={`window-header${isVillagePanel ? ' village-window-header' : ''}`}
            onPointerDown={(event) => {
              if (isDocked || isMainMenuPanel || isVillagePanel) {
                return;
              }
              startDrag(event, panel);
            }}
          >
            <div className="window-title">
              {!isVillagePanel ? <span>{panel.label}</span> : null}
            </div>
            <div className="window-actions" onPointerDown={(event) => event.stopPropagation()}>
              {shouldRenderQuickWindowActions ? (
                <>
                  {canDock ? (
                    <>
                      <button
                        className={`window-action-layout${isDockedLeft ? ' is-active' : ''}`}
                        onClick={() => setPanelDockLayoutMode(panel.id, 'split-left')}
                        title="Ukotvit vlevo"
                        aria-label="Ukotvit vlevo"
                      >
                        ⇤
                      </button>
                      <button
                        className={`window-action-layout${isDockedFull ? ' is-active' : ''}`}
                        onClick={() => setPanelDockLayoutMode(panel.id, 'full')}
                        title="Ukotvit na plnou šířku"
                        aria-label="Ukotvit na plnou šířku"
                      >
                        ▣
                      </button>
                      <button
                        className={`window-action-layout${isDockedRight ? ' is-active' : ''}`}
                        onClick={() => setPanelDockLayoutMode(panel.id, 'split-right')}
                        title="Ukotvit vpravo"
                        aria-label="Ukotvit vpravo"
                      >
                        ⇥
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </>
              ) : null}
              {shouldRenderWindowVisibilityActions ? (
                <>
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
                </>
              ) : null}
            </div>
          </header>
        ) : null}

        <div className="window-body">{renderPanelContent(panel)}</div>
        {!isDocked && !isMapPanel && !isMainMenuPanel ? (
          <div
            className="window-resize-handle"
            onPointerDown={(event) => startResize(event, panel)}
            role="separator"
            aria-label={`Změnit velikost okna ${panel.label}`}
          />
        ) : null}
      </article>
    );
  };

  if (!session || !selectedWorldId) {
    return null;
  }

  const normalizedVillageRenameNotice = (villageRenameNotice ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const isVillageRenameNoticeSuccess =
    normalizedVillageRenameNotice.includes('premenovano') ||
    normalizedVillageRenameNotice.includes('beze zmeny');

  return (
    <div className="game-page" style={settlementColorCssVariables}>
      <div className="game-bg-layer" />
      <div className="game-grid-layer" />

      <div className="app-content-container game-layout-container">
        <div className="game-canvas-hud">
        <header className="top-navigation">
          <nav>
            {TOP_NAV_BUTTONS.map((button) => {
              const isOpen = activeMainStagePanel?.type === button.type;
              const leaderboardBadge = button.type === 'rankings' ? leaderboardMenuBadgeLabel : null;
              const buttonTitle =
                button.type === 'activity'
                  ? `Otevřít panel: ${button.text} (nepřečtené: ${activityUnreadCount.toLocaleString('cs-CZ')})`
                  : button.type === 'rankings' && leaderboardBadge
                    ? `Otevřít panel: ${button.text} (${leaderboardBadge})`
                  : `Otevřít panel: ${button.text}`;
              return (
                <div key={button.type} className="nav-action-stack">
                  <MenuButton
                    className={`nav-action nav-action--${button.type}`}
                    isOpen={isOpen}
                    onClick={() => {
                      if (button.type === 'activity') {
                        setActivityLastOpenedAt(new Date().toISOString());
                      }
                      openPanel(button.type);
                    }}
                    title={buttonTitle}
                    glyph={button.glyph}
                    text={button.text}
                    badgeText={leaderboardBadge}
                  />
                </div>
              );
            })}
          </nav>
          <div className="world-indicator-wrap" ref={worldMenuRef}>
            <button
              type="button"
              className={`world-indicator world-indicator-trigger is-${selectedWorldFlavor}${isWorldMenuOpen ? ' is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={isWorldMenuOpen}
              title="Otevřít nabídku účtu a světa"
              onClick={() => setIsWorldMenuOpen((previous) => !previous)}
            >
              <span>Svět:</span> <span className="world-indicator-value tld-type-heading">{selectedWorldName}</span>
              {selectedWorldFlavor === 'test' ? <em>TEST</em> : null}
              {selectedWorldFlavor === 'prealpha' ? <em>PRE-ALPHA</em> : null}
            </button>
            {isWorldMenuOpen ? (
              <div className="world-switch-menu world-switch-menu-in-world" role="menu" aria-label="Nabídka účtu a světa">
                <header>
                  <h4>Účet a svět</h4>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setIsWorldMenuOpen(false)}
                    aria-label="Zavřít nabídku účtu a světa"
                  >
                    Zavřít
                  </button>
                </header>
                <p className="world-switch-section-title">Změnit svět</p>
                <ul>
                  {worldSwitchOptions.map((world) => {
                    const worldStatus = String(world.status).toLowerCase();
                    const isPlayable = worldStatus === 'online';
                    const isActive = world.id === selectedWorldId;
                    const worldFlavor = resolveWorldFlavorById(world.id);
                    const worldModeLabel =
                      worldFlavor === 'test'
                        ? 'TEST'
                        : worldFlavor === 'prealpha'
                          ? 'PRE-ALPHA'
                          : 'STANDARD';
                    return (
                      <li key={`world-switch-${world.id}`}>
                        <button
                          type="button"
                          className={`world-switch-option ${isActive ? 'is-active' : ''} is-${worldFlavor}`}
                          disabled={!isPlayable}
                          onClick={() => handleSwitchWorld(world.id)}
                        >
                          <span className="world-switch-option-title tld-type-heading">{world.name}</span>
                          <span>{isActive ? `AKTIVNÍ · ${worldModeLabel}` : `${isPlayable ? 'ONLINE' : 'UZAVŘENO'} · ${worldModeLabel}`}</span>
                        </button>
                      </li>
                    );
                  })}
                  {worldSwitchOptions.length === 0 ? <li className="world-switch-empty">Světy se načítají...</li> : null}
                </ul>
                <div className="logout-menu-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setIsWorldMenuOpen(false);
                      handleLeaveWorld();
                    }}
                  >
                    Odejít ze světa
                  </button>
                  <button
                    type="button"
                    className="secondary-action danger-button"
                    onClick={() => {
                      setIsWorldMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    Odhlásit ze hry
                  </button>
                </div>
                {worldMenuError ? <p className="world-switch-error">{worldMenuError}</p> : null}
              </div>
            ) : null}
          </div>
        </header>

        <section className="resource-strip resource-strip-slim">
          <div className="village-card-stack">
            <article className="resource-card village-resource-card" aria-label="Aktivní léno a seznam lén">
              <div className="village-resource-card-layout">
                <button
                  ref={villageMenuTriggerRef}
                  type="button"
                  className="village-menu-trigger village-menu-trigger-compact"
                  onClick={toggleVillageMenu}
                  disabled={playerVillages.length === 0}
                  aria-haspopup="menu"
                  aria-expanded={isVillageMenuOpen}
                >
                  {playerVillages.length === 0 ? 'Načítám léna...' : 'Seznam lén'}
                </button>
                <div className="village-resource-card-info">
                  <div className="village-resource-card-heading">
                    <p>Aktivní léno</p>
                  </div>
                  <div className="village-rename-inline" ref={villageRenameWrapRef}>
                    {isVillageRenameOpen ? (
                      <input
                        ref={villageRenameInputRef}
                        type="text"
                        value={villageRenameDraft}
                        maxLength={14}
                        disabled={renameVillagePending}
                        onChange={(event) => {
                          setVillageRenameDraft(event.target.value);
                          setVillageRenameNotice(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setIsVillageRenameOpen(false);
                            setVillageRenameDraft(activeVillageBaseName);
                            return;
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void submitVillageRenameInline();
                          }
                        }}
                        aria-label="Přejmenovat aktivní léno"
                      />
                    ) : (
                      <strong className="resource-card-title village-resource-card-title tld-type-stat" title={villageLabel}>
                        {villageLabel}
                      </strong>
                    )}
                    <button
                      type="button"
                      className="village-rename-trigger"
                      aria-label={isVillageRenameOpen ? 'Potvrdit přejmenování léna' : 'Přejmenovat aktivní léno'}
                      title={isVillageRenameOpen ? 'Potvrdit přejmenování (Enter)' : 'Přejmenovat aktivní léno'}
                      disabled={renameVillagePending || !gameState}
                      onClick={() => {
                        if (isVillageRenameOpen) {
                          void submitVillageRenameInline();
                          return;
                        }
                        openVillageRenameInline();
                      }}
                    >
                      {renameVillagePending ? '…' : isVillageRenameOpen ? '✔' : '✎'}
                    </button>
                    {publicOrder ? (
                      <span
                        className={`public-order-badge ${publicOrderBadgeTone}`}
                        aria-label={publicOrderTooltipAriaLabel}
                        aria-describedby={publicOrderTooltipId}
                        tabIndex={0}
                      >
                        <span className="public-order-icon" aria-hidden="true">
                          {publicOrderBand === 'critical' ? '⚠' : '⚖'}
                        </span>
                        {showPublicOrderPct ? (
                          <strong className="public-order-badge-value tld-type-value">{publicOrderCurrentPct}%</strong>
                        ) : null}
                        <span className="public-order-tooltip commands-army-tooltip" id={publicOrderTooltipId} role="tooltip">
                          <p>{publicOrderTooltipHeadline}</p>
                          <ul>
                            <li>
                              <span>Stav</span>
                              <strong className="public-order-tooltip-value tld-type-value">{publicOrderCurrentPct}%</strong>
                            </li>
                            <li>
                              <span>Obnova</span>
                              <strong className="public-order-tooltip-value tld-type-value">{publicOrderTooltipRegen}</strong>
                            </li>
                            <li>
                              <span>Nábor rytíře</span>
                              <strong className="public-order-tooltip-value tld-type-value">{publicOrderTooltipKnightRecruit}</strong>
                            </li>
                            <li>
                              <span>Debuff</span>
                              <strong className="public-order-tooltip-value tld-type-value">{publicOrderTooltipDebuff}</strong>
                            </li>
                          </ul>
                        </span>
                      </span>
                    ) : null}
                  </div>
                  {villageRenameNotice ? (
                    <small className={`village-rename-notice ${isVillageRenameNoticeSuccess ? 'success' : 'error'}`}>
                      {villageRenameNotice}
                    </small>
                  ) : null}
                </div>
              </div>
            </article>
            <ActiveVillageProtectionTimer notice={activeVillageProtection} />
          </div>
          <div className="resource-strip-stage-title" aria-live="polite">
            <h2>{activeMainStageLabel}</h2>
            <span className="resource-strip-stage-title-glow" aria-hidden="true" />
          </div>
          <div className="resource-strip-column resource-right-column">
            <button
              type="button"
              className={`resource-card research-spotlight-card ${currentResearchTask?.status === 'researching' ? 'is-researching' : ''} ${isResearchSpotlightEmpty ? 'is-empty' : ''}`}
              onClick={handleResearchSpotlightClick}
              title={currentResearchTooltipLabel}
              aria-label={currentResearchTooltipLabel}
              style={
                currentResearchTask
                  ? ({
                      '--research-spotlight-progress': `${currentResearchProgressPercent}%`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <p>Aktuální výzkum</p>
              <strong className="resource-card-title research-spotlight-title tld-type-stat">
                {currentResearchHeadline}
              </strong>
            </button>
          </div>
        </section>
        </div>
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
                    <span className="village-menu-option-title tld-type-heading">{village.name}</span>
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
              <strong className="activity-share-title tld-type-heading">{activityShareItem.title}</strong>
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
              onClick={() => {
                if (panel.type === 'village' && panel.settlementId) {
                  requestMapCenterOnSettlement(panel.settlementId);
                }
                togglePanelVisibility(panel.id);
              }}
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
              Nové záznamy:{' '}
              <strong className="pin-live-feed-value tld-type-value">{activityNavBadgeCount.toLocaleString('cs-CZ')}</strong>
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
              onClick={() => {
                if (panel.type === 'village' && panel.settlementId) {
                  requestMapCenterOnSettlement(panel.settlementId);
                }
                togglePanelVisibility(panel.id);
              }}
            >
              <span>{getPinnedPanelLabel(panel)}</span>
              {panel.alert ? <i /> : null}
            </button>
          ))}
        </aside>

        {hasDockedPanels ? (
          <section
            className={`central-panel-dock${fullDockPanel ? ' is-full' : ' is-split'}`}
            style={{
              left: `${dockFrame.x}px`,
              top: `${dockFrame.y}px`,
              width: `${dockFrame.width}px`,
              height: `${dockFrame.height}px`,
            }}
          >
            {leftDockPanels.length > 0 ? (
              <div className="dock-tab-strip is-left" role="tablist" aria-label="Levá strana dock panelů">
                {leftDockPanels.map((panel) => (
                  <div key={`dock-tab-left-${panel.id}`} className="dock-tab-item">
                    <button
                      type="button"
                      className={`dock-tab-button${leftDockPanel?.id === panel.id ? ' is-active' : ''}`}
                      role="tab"
                      aria-selected={leftDockPanel?.id === panel.id}
                      onMouseDown={(event) => {
                        closePanelOnMiddleClick(event, panel.id);
                      }}
                      onClick={() => activateDockTab(panel.id)}
                      title={panel.label}
                    >
                      <span>{panel.label}</span>
                      {panel.alert ? <i aria-hidden="true" /> : null}
                    </button>
                    <button
                      type="button"
                      className="dock-tab-move-button"
                      onClick={() => setPanelDockLayoutMode(panel.id, 'split-right')}
                      title="Přesunout panel do pravého docku"
                      aria-label="Přesunout panel do pravého docku"
                    >
                      ⇥
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {rightDockPanels.length > 0 ? (
              <div className="dock-tab-strip is-right" role="tablist" aria-label="Pravá strana dock panelů">
                {rightDockPanels.map((panel) => (
                  <div key={`dock-tab-right-${panel.id}`} className="dock-tab-item">
                    <button
                      type="button"
                      className={`dock-tab-button${rightDockPanel?.id === panel.id ? ' is-active' : ''}`}
                      role="tab"
                      aria-selected={rightDockPanel?.id === panel.id}
                      onMouseDown={(event) => {
                        closePanelOnMiddleClick(event, panel.id);
                      }}
                      onClick={() => activateDockTab(panel.id)}
                      title={panel.label}
                    >
                      <span>{panel.label}</span>
                      {panel.alert ? <i aria-hidden="true" /> : null}
                    </button>
                    <button
                      type="button"
                      className="dock-tab-move-button"
                      onClick={() => setPanelDockLayoutMode(panel.id, 'split-left')}
                      title="Přesunout panel do levého docku"
                      aria-label="Přesunout panel do levého docku"
                    >
                      ⇤
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {fullDockPanel ? (
              <div className="dock-slot dock-slot-full">{renderPanelWindow(fullDockPanel, { docked: true })}</div>
            ) : (
              <>
                <div className="dock-slot dock-slot-left">
                  {leftDockPanel ? renderPanelWindow(leftDockPanel, { docked: true }) : <div className="dock-slot-empty">Prázdný slot</div>}
                </div>
                <div className="dock-slot dock-slot-right">
                  {rightDockPanel ? renderPanelWindow(rightDockPanel, { docked: true }) : <div className="dock-slot-empty">Prázdný slot</div>}
                </div>
              </>
            )}
            <small className="dock-version-note">Verze hry {GAME_VERSION_LABEL}</small>
          </section>
        ) : null}
        {floatingPanels.map((panel) => renderPanelWindow(panel))}
        </div>
        <div className="game-persistent-footer" role="complementary" aria-label="Stálé informace hry">
          <div className="game-persistent-footer-left">
            <FooterActionButton iconSrc={SETTINGS_BUTTON_ICON_SRC} label="Otevřít nastavení hry" onClick={() => openPanel('settings')} />
            <FooterActionButton
              icon="✉︎"
              label="Otevřít komunikaci"
              onClick={() => openPanel('messages')}
              badgeText={communicationBadgeCount.toLocaleString('cs-CZ')}
            />
          </div>
          <div className="game-persistent-footer-right">
            <p className="game-version-footer">Verze hry {GAME_VERSION_LABEL}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
