import { ENEMY_TEMPLATE_DEFINITIONS } from '../data/enemyTemplates';
import { BATTLE_SLOT_ORDER } from './constants';
import { createArmyDefinition, createEmptyArmySlots, indexUnitTemplates } from './armyUtils';
import { hashSeed, randomInt } from './random';
import type { BattleSetupOutput, EnemyTemplateDefinition } from './contracts';
import type {
  ArmyDefinition,
  ArmyPlanId,
  BattleScenarioSeed,
  BattleSlotId,
  GeneralLoadout,
  RangedDoctrineId,
  SlotStance,
  UnitArchetype,
  UnitQuality,
  UnitTemplate,
} from './types';

type SlotTemplateRule = {
  archetypes: UnitArchetype[];
  qualities: UnitQuality[];
  stance: SlotStance;
  doctrine: RangedDoctrineId;
};

const ENEMY_GENERAL_NAMES = [
  'Bretislav',
  'Hostan',
  'Jaromir',
  'Nedamir',
  'Radobor',
  'Svatobor',
  'Tvrdomir',
  'Velen',
];

const TEMPLATE_PLAN_MAP: Record<string, ArmyPlanId> = {
  balanced: 'standard',
  pressure: 'pressure',
  bowline: 'hold_line',
  cavalry_wing: 'pressure',
};

const TEMPLATE_PERKS: Record<string, GeneralLoadout['perkPoints']> = {
  balanced: {
    pavise: 1,
    wedge: 1,
    ranger: 1,
  },
  pressure: {
    wedge: 2,
    sapper: 1,
  },
  bowline: {
    pavise: 2,
    ranger: 1,
  },
  cavalry_wing: {
    wedge: 2,
    ranger: 1,
  },
};

const TEMPLATE_LAYOUTS: Record<string, Record<BattleSlotId, SlotTemplateRule>> = {
  balanced: {
    left_front: { archetypes: ['infantry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
    center_front: { archetypes: ['infantry'], qualities: ['garrison', 'retainer'], stance: 'defensive', doctrine: 'auto' },
    right_front: { archetypes: ['infantry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
    left_main: { archetypes: ['archer'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'counter_archers' },
    center_main: { archetypes: ['infantry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
    right_main: { archetypes: ['archer'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'counter_archers' },
    left_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    center_reserve: { archetypes: ['infantry'], qualities: ['retainer', 'levy'], stance: 'balanced', doctrine: 'auto' },
    right_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
  },
  pressure: {
    left_front: { archetypes: ['infantry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    center_front: { archetypes: ['infantry'], qualities: ['mercenary', 'retainer'], stance: 'aggressive', doctrine: 'auto' },
    right_front: { archetypes: ['infantry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    left_main: { archetypes: ['infantry', 'cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    center_main: { archetypes: ['infantry'], qualities: ['retainer', 'mercenary'], stance: 'balanced', doctrine: 'auto' },
    right_main: { archetypes: ['infantry', 'cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    left_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    center_reserve: { archetypes: ['archer', 'infantry'], qualities: ['retainer', 'levy'], stance: 'balanced', doctrine: 'finish_broken' },
    right_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
  },
  bowline: {
    left_front: { archetypes: ['infantry'], qualities: ['garrison', 'retainer'], stance: 'defensive', doctrine: 'auto' },
    center_front: { archetypes: ['infantry'], qualities: ['garrison', 'retainer'], stance: 'defensive', doctrine: 'auto' },
    right_front: { archetypes: ['infantry'], qualities: ['garrison', 'retainer'], stance: 'defensive', doctrine: 'auto' },
    left_main: { archetypes: ['archer'], qualities: ['garrison', 'retainer'], stance: 'balanced', doctrine: 'counter_archers' },
    center_main: { archetypes: ['archer'], qualities: ['garrison', 'retainer'], stance: 'balanced', doctrine: 'support_center' },
    right_main: { archetypes: ['archer'], qualities: ['garrison', 'retainer'], stance: 'balanced', doctrine: 'counter_archers' },
    left_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
    center_reserve: { archetypes: ['infantry'], qualities: ['garrison', 'retainer'], stance: 'defensive', doctrine: 'auto' },
    right_reserve: { archetypes: ['cavalry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
  },
  cavalry_wing: {
    left_front: { archetypes: ['infantry'], qualities: ['retainer', 'levy'], stance: 'balanced', doctrine: 'auto' },
    center_front: { archetypes: ['infantry'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'auto' },
    right_front: { archetypes: ['infantry'], qualities: ['retainer', 'levy'], stance: 'balanced', doctrine: 'auto' },
    left_main: { archetypes: ['infantry'], qualities: ['retainer', 'mercenary'], stance: 'balanced', doctrine: 'auto' },
    center_main: { archetypes: ['archer'], qualities: ['retainer', 'garrison'], stance: 'balanced', doctrine: 'support_center' },
    right_main: { archetypes: ['infantry'], qualities: ['retainer', 'mercenary'], stance: 'balanced', doctrine: 'auto' },
    left_reserve: { archetypes: ['cavalry'], qualities: ['mercenary', 'retainer'], stance: 'aggressive', doctrine: 'auto' },
    center_reserve: { archetypes: ['cavalry', 'infantry'], qualities: ['retainer', 'mercenary'], stance: 'aggressive', doctrine: 'auto' },
    right_reserve: { archetypes: ['cavalry'], qualities: ['mercenary', 'retainer'], stance: 'aggressive', doctrine: 'auto' },
  },
};

const resolveEnemyTemplateDefinition = (enemyTemplateId: string): EnemyTemplateDefinition => {
  return (
    ENEMY_TEMPLATE_DEFINITIONS.find((template) => template.id === enemyTemplateId) ??
    ENEMY_TEMPLATE_DEFINITIONS[0]
  );
};

const resolveUnitTemplate = (
  templatesById: Record<string, UnitTemplate>,
  archetypes: UnitArchetype[],
  qualities: UnitQuality[],
  fallbackArchetypes: UnitArchetype[],
  fallbackQualities: UnitQuality[],
): UnitTemplate => {
  const allTemplates = Object.values(templatesById);

  for (const quality of qualities) {
    for (const archetype of archetypes) {
      const found = allTemplates.find((template) => template.archetype === archetype && template.quality === quality);
      if (found) {
        return found;
      }
    }
  }

  for (const quality of fallbackQualities) {
    for (const archetype of fallbackArchetypes) {
      const found = allTemplates.find((template) => template.archetype === archetype && template.quality === quality);
      if (found) {
        return found;
      }
    }
  }

  return allTemplates[0];
};

const maybeMirrorSlotId = (slotId: BattleSlotId, mirror: boolean): BattleSlotId => {
  if (!mirror) {
    return slotId;
  }
  if (slotId.startsWith('left_')) {
    return slotId.replace('left_', 'right_') as BattleSlotId;
  }
  if (slotId.startsWith('right_')) {
    return slotId.replace('right_', 'left_') as BattleSlotId;
  }
  return slotId;
};

const createEnemyGeneral = (enemyTemplateId: string, seed: string): GeneralLoadout => {
  const baseState = hashSeed(`${seed}:${enemyTemplateId}:general`);
  const pickedName = ENEMY_GENERAL_NAMES[randomInt(baseState, ENEMY_GENERAL_NAMES.length).value] ?? ENEMY_GENERAL_NAMES[0];
  return {
    name: pickedName,
    perkPoints: TEMPLATE_PERKS[enemyTemplateId] ?? TEMPLATE_PERKS.balanced,
  };
};

export const createEnemyArmyDefinition = (
  enemySeed: BattleScenarioSeed,
  availableUnitTemplates: UnitTemplate[],
): ArmyDefinition => {
  const resolvedTemplate = resolveEnemyTemplateDefinition(enemySeed.enemyTemplateId);
  const layout = TEMPLATE_LAYOUTS[resolvedTemplate.id] ?? TEMPLATE_LAYOUTS.balanced;
  const templatesById = indexUnitTemplates(availableUnitTemplates);
  const slots = createEmptyArmySlots();
  let state = hashSeed(`${enemySeed.seed}:${resolvedTemplate.id}:layout`);
  const mirrorRoll = randomInt(state, 2);
  const mirror = mirrorRoll.value === 1;
  state = mirrorRoll.state;

  for (const slotId of BATTLE_SLOT_ORDER) {
    const layoutSlotId = maybeMirrorSlotId(slotId, mirror);
    const rule = layout[layoutSlotId] ?? layout[slotId] ?? TEMPLATE_LAYOUTS.balanced[slotId];
    const archetypeRoll = randomInt(state, rule.archetypes.length);
    state = archetypeRoll.state;
    const qualityRoll = randomInt(state, rule.qualities.length);
    state = qualityRoll.state;

    const chosenTemplate = resolveUnitTemplate(
      templatesById,
      [rule.archetypes[archetypeRoll.value] ?? rule.archetypes[0]],
      [rule.qualities[qualityRoll.value] ?? rule.qualities[0]],
      rule.archetypes,
      rule.qualities,
    );

    const slot = slots.find((entry) => entry.slotId === slotId);
    if (!slot) {
      continue;
    }
    slot.templateId = chosenTemplate.id;
    slot.stance = rule.stance;
    slot.rangedDoctrine = chosenTemplate.archetype === 'archer' ? rule.doctrine : 'auto';
  }

  return createArmyDefinition(
    'enemy',
    createEnemyGeneral(resolvedTemplate.id, enemySeed.seed),
    TEMPLATE_PLAN_MAP[resolvedTemplate.id] ?? 'standard',
    slots,
  );
};

export const createBattleSetup = (
  playerArmy: ArmyDefinition,
  enemySeed: BattleScenarioSeed,
  availableUnitTemplates: UnitTemplate[],
): BattleSetupOutput => ({
  playerArmy,
  enemyArmy: createEnemyArmyDefinition(enemySeed, availableUnitTemplates),
  seed: enemySeed.seed,
});
