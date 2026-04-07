import { BATTLE_RANK_ORDER, BATTLE_SECTOR_ORDER, BATTLE_SLOT_ORDER } from '../engine/constants';
import type {
  ArmySlotLoadout,
  ArmyPlanId,
  BattleSector,
  BattleSide,
  BattleSlotId,
  BattleEndReasonId,
  BattleResultId,
  CombatEventType,
  GeneralOutcomeId,
  GeneralPerkId,
  RangedDoctrineId,
  SlotActionId,
  SlotStance,
  SlotStatusId,
  UnitArchetype,
  UnitQuality,
  UnitTemplate,
} from '../engine/types';

const ARCHETYPE_ORDER: UnitArchetype[] = ['infantry', 'archer', 'cavalry'];
const QUALITY_ORDER = ['levy', 'retainer', 'garrison', 'mercenary'];

const LABELS: Record<BattleSector | string, string> = {
  left: 'Leve',
  center: 'Stred',
  right: 'Pravy',
  front: 'Predni',
  main: 'Hlavni',
  reserve: 'Zaloha',
};

export const getSectorLabel = (sector: BattleSector): string => LABELS[sector] ?? sector;

export const getRankLabel = (rank: string): string => LABELS[rank] ?? rank;

export const getSlotLabel = (slotId: BattleSlotId): string => {
  const [sector, rank] = slotId.split('_') as [BattleSector, 'front' | 'main' | 'reserve'];
  return `${getSectorLabel(sector)} ${getRankLabel(rank)}`;
};

export const getShortSlotLabel = (slotId: BattleSlotId): string => {
  const [sector, rank] = slotId.split('_') as [BattleSector, 'front' | 'main' | 'reserve'];
  return `${sector[0].toUpperCase()}-${rank[0].toUpperCase()}`;
};

export const formatArchetypeLabel = (archetype: UnitArchetype): string => {
  switch (archetype) {
    case 'infantry':
      return 'Pechota';
    case 'archer':
      return 'Strelci';
    case 'cavalry':
      return 'Jizda';
    default:
      return archetype;
  }
};

export const formatQualityLabel = (quality: UnitQuality): string => {
  switch (quality) {
    case 'levy':
      return 'Odvedenci';
    case 'retainer':
      return 'Druzinici';
    case 'garrison':
      return 'Hradni';
    case 'mercenary':
      return 'Zoldneri';
    default:
      return quality;
  }
};

export const formatStanceLabel = (stance: SlotStance): string => {
  switch (stance) {
    case 'aggressive':
      return 'Utocny';
    case 'balanced':
      return 'Vyvazeny';
    case 'defensive':
      return 'Obranny';
    default:
      return stance;
  }
};

export const formatPlanLabel = (plan: ArmyPlanId): string => {
  switch (plan) {
    case 'standard':
      return 'Standardni';
    case 'pressure':
      return 'Tlak';
    case 'hold_line':
      return 'Drzet linii';
    case 'full_retreat':
      return 'Organizovany ustup';
    default:
      return plan;
  }
};

export const formatGeneralPerkLabel = (perk: GeneralPerkId): string => {
  switch (perk) {
    case 'sapper':
      return 'Zenista';
    case 'pavise':
      return 'Paveza';
    case 'wedge':
      return 'Klin';
    case 'ranger':
      return 'Hranicar';
    case 'levy_training':
      return 'Vycvik odvedencu';
    default:
      return perk;
  }
};

export const formatSideLabel = (side: BattleSide | 'draw'): string => {
  switch (side) {
    case 'player':
      return 'Hrac';
    case 'enemy':
      return 'Nepritel';
    case 'draw':
      return 'Remiza';
    default:
      return side;
  }
};

export const formatBattleResultLabel = (result: BattleResultId): string => {
  switch (result) {
    case 'decisive_victory':
      return 'Drtive vitezstvi';
    case 'victory':
      return 'Vitezstvi';
    case 'pyrrhic_victory':
      return 'Pyrrhovo vitezstvi';
    case 'organized_retreat':
      return 'Organizovany ustup';
    case 'defeat':
      return 'Porazka';
    case 'annihilation':
      return 'Annihilace';
    case 'stalemate':
      return 'Pat';
    default:
      return result;
  }
};

export const formatBattleEndReasonLabel = (endReason: BattleEndReasonId): string => {
  switch (endReason) {
    case 'army_collapse':
      return 'Kolaps armady';
    case 'organized_retreat':
      return 'Organizovany ustup';
    case 'annihilation':
      return 'Annihilace';
    case 'turn_limit':
      return 'Limit kol';
    case 'mutual_exhaustion':
      return 'Vzajemne vycerpani';
    default:
      return endReason;
  }
};

export const formatGeneralOutcomeLabel = (outcome: GeneralOutcomeId): string => {
  switch (outcome) {
    case 'safe':
      return 'Bezpecny';
    case 'wounded':
      return 'Zraneny';
    case 'captured':
      return 'Zajaty';
    case 'dead':
      return 'Mrtvy';
    case 'escaped':
      return 'Uprchl';
    default:
      return outcome;
  }
};

export const formatCombatEventTypeLabel = (eventType: CombatEventType): string => {
  switch (eventType) {
    case 'engage':
      return 'Stret';
    case 'volley':
      return 'Salva';
    case 'focus_fire':
      return 'Soustredena palba';
    case 'charge':
      return 'Naraz';
    case 'brace':
      return 'Zpevneni';
    case 'line_break':
      return 'Prulom linie';
    case 'flank_exposed':
      return 'Obnazeny bok';
    case 'temporary_advantage':
      return 'Docasna prevaha';
    case 'withdraw':
      return 'Ustup';
    case 're_form':
      return 'Preskupeni';
    case 'rout':
      return 'Rozklad';
    case 'retreat_called':
      return 'Rozkaz k ustupu';
    case 'no_ranged_target':
      return 'Bez cile pro strelbu';
    default:
      return eventType;
  }
};

export const getTemplateLabel = (template: UnitTemplate): string =>
  `${template.name} · ${formatArchetypeLabel(template.archetype)} / ${formatQualityLabel(template.quality)}`;

export const formatActionLabel = (action: SlotActionId): string => {
  switch (action) {
    case 'hold':
      return 'Drz pozici';
    case 'advance':
      return 'Postup';
    case 'brace':
      return 'Zapri se';
    case 'volley':
      return 'Salva';
    case 'focus_fire':
      return 'Soustredena palba';
    case 'charge':
      return 'Naraz';
    case 'withdraw':
      return 'Ustup';
    case 're_form':
      return 'Preskupeni';
    default:
      return action;
  }
};

export const formatStatusLabel = (status: SlotStatusId): string => {
  switch (status) {
    case 'ready':
      return 'Pripraven';
    case 'engaged':
      return 'Ve stretu';
    case 'shaken':
      return 'Otresen';
    case 'broken':
      return 'Rozbity';
    case 'routing':
      return 'V rozpadu';
    case 'withdrawn':
      return 'Stazen';
    case 'destroyed':
      return 'Znizen';
    default:
      return status;
  }
};

export const formatDoctrineLabel = (doctrine: RangedDoctrineId): string => {
  switch (doctrine) {
    case 'counter_archers':
      return 'Proti strelcum';
    case 'support_center':
      return 'Podpora stredu';
    case 'finish_broken':
      return 'Dorit rozbite';
    case 'auto':
      return 'Automaticky';
    default:
      return doctrine;
  }
};

export const sortTemplatesForSelection = (templates: UnitTemplate[]): UnitTemplate[] =>
  [...templates].sort((left, right) => {
    const archetypeDiff =
      ARCHETYPE_ORDER.indexOf(left.archetype) - ARCHETYPE_ORDER.indexOf(right.archetype);
    if (archetypeDiff !== 0) {
      return archetypeDiff;
    }

    const qualityDiff = QUALITY_ORDER.indexOf(left.quality) - QUALITY_ORDER.indexOf(right.quality);
    if (qualityDiff !== 0) {
      return qualityDiff;
    }

    return left.name.localeCompare(right.name);
  });

export const groupSlotsBySector = (slots: ArmySlotLoadout[]): Record<BattleSector, ArmySlotLoadout[]> => {
  const grouped: Record<BattleSector, ArmySlotLoadout[]> = {
    left: [],
    center: [],
    right: [],
  };

  for (const slotId of BATTLE_SLOT_ORDER) {
    const slot = slots.find((entry) => entry.slotId === slotId);
    if (!slot) {
      continue;
    }
    const [sector] = slotId.split('_') as [BattleSector, string];
    grouped[sector].push(slot);
  }

  for (const sector of BATTLE_SECTOR_ORDER) {
    grouped[sector].sort((left, right) => BATTLE_RANK_ORDER.indexOf(rankFromSlot(left.slotId)) - BATTLE_RANK_ORDER.indexOf(rankFromSlot(right.slotId)));
  }

  return grouped;
};

export const rankFromSlot = (slotId: BattleSlotId) => slotId.split('_')[1] as 'front' | 'main' | 'reserve';

export const archetypeFromTemplate = (template: UnitTemplate | null | undefined): UnitArchetype | 'empty' =>
  template?.archetype ?? 'empty';

export const formatTemplateStats = (template: UnitTemplate): string =>
  `M${template.modelCount} HP${template.hpPerModel} Mor${template.morale}${template.archetype === 'archer' ? ` Sipy${template.ammunition}` : ''}`;

export const buildSelectionOptions = (templates: UnitTemplate[]) =>
  sortTemplatesForSelection(templates).reduce<Record<UnitArchetype, UnitTemplate[]>>(
    (groups, template) => {
      groups[template.archetype].push(template);
      return groups;
    },
    { infantry: [], archer: [], cavalry: [] },
  );
