import { createArmyDefinition, createEmptyArmySlots } from '../engine/armyUtils';
import type { ArmyDefinition, ArmyPlanId, BattleScenarioSeed, GeneralLoadout } from '../engine/types';
import { ENEMY_TEMPLATE_DEFINITIONS } from './enemyTemplates';

const DEFAULT_PLAYER_GENERAL: GeneralLoadout = {
  name: 'Player General',
  perkPoints: {
    pavise: 1,
    wedge: 1,
    ranger: 1,
  },
};

const DEFAULT_PLAYER_PLAN: ArmyPlanId = 'standard';

const DEFAULT_PLAYER_LOADOUT: Record<string, string> = {
  left_front: 'DRU_PES',
  center_front: 'HRA_PES',
  right_front: 'DRU_PES',
  left_main: 'DRU_LUK',
  center_main: 'DRU_PES',
  right_main: 'DRU_LUK',
  left_reserve: 'DRU_JEZ',
  center_reserve: 'POH_PES',
  right_reserve: 'DRU_JEZ',
};

export const createDefaultPlayerArmy = (): ArmyDefinition => {
  const slots = createEmptyArmySlots();
  for (const slot of slots) {
    slot.templateId = DEFAULT_PLAYER_LOADOUT[slot.slotId] ?? null;
    if (slot.slotId.endsWith('_reserve')) {
      slot.stance = 'aggressive';
    } else if (slot.slotId === 'center_front') {
      slot.stance = 'defensive';
    }
  }

  return createArmyDefinition('player', DEFAULT_PLAYER_GENERAL, DEFAULT_PLAYER_PLAN, slots);
};

const buildSeedString = (): string => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.floor(Math.random() * 1_000_000).toString(36);
  return `battle2-${timePart}-${randomPart}`;
};

export const createRandomEnemySeed = (): BattleScenarioSeed => {
  const template =
    ENEMY_TEMPLATE_DEFINITIONS[Math.floor(Math.random() * ENEMY_TEMPLATE_DEFINITIONS.length)] ??
    ENEMY_TEMPLATE_DEFINITIONS[0];

  return {
    enemyTemplateId: template.id,
    seed: buildSeedString(),
  };
};
