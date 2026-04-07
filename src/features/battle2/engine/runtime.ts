import { countPerkPoints, indexUnitTemplates } from './armyUtils';
import {
  DEFAULT_BATTLE_HARD_TURN_LIMIT,
  DEFAULT_BATTLE_SOFT_END_START_TURN,
  DEFAULT_COMMAND_POINTS_PER_TURN,
} from './constants';
import { hashSeed } from './random';
import { getSlotMeta } from './slotUtils';
import type { BattleSetupOutput } from './contracts';
import type {
  ArmyDefinition,
  ArmyRuntimeState,
  BattleRuntimeState,
  SlotRuntimeState,
  UnitTemplate,
} from './types';

const MAX_GENERAL_PERK_POINTS = 3;

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const calculateTemplateBasePower = (template: UnitTemplate): number => {
  const durability = template.modelCount * template.hpPerModel * 0.1;
  const melee = (template.meleeAttack + template.meleeDefense + template.resilience) * 6;
  const ranged = template.rangedAttack > 0 ? template.rangedAttack * (4 + template.ammunition * 0.35) : 0;
  const shock = template.impact * 10 + template.penetrationPct * 0.9 + template.massive * 12;
  const morale = template.morale * 3 + template.discipline * 1.25;
  const defense =
    template.rangedReductionPct * 1.1 +
    template.flatDamageReduction * 10 +
    template.physicalResistancePct * 0.9 +
    template.antiCavalry * 5;

  return durability + melee + ranged + shock + morale + defense;
};

export const calculateCurrentSlotPower = (slot: SlotRuntimeState, template: UnitTemplate): number => {
  if (slot.status === 'destroyed' || slot.status === 'withdrawn' || slot.currentHp <= 0) {
    return 0;
  }

  const healthRatio = clampNumber(slot.currentHp / Math.max(1, slot.maxHp), 0, 1);
  const moraleRatio = clampNumber(slot.currentMorale / Math.max(1, template.morale), 0, 1.2);
  const staminaRatio = clampNumber(slot.currentStamina / Math.max(1, template.staminaMax), 0.2, 1);
  const cohesion =
    slot.status === 'routing' ? 0.08 : slot.status === 'broken' ? 0.35 : slot.status === 'shaken' ? 0.7 : 1;

  return calculateTemplateBasePower(template) * healthRatio * moraleRatio * staminaRatio * cohesion;
};

const calculateArmyStartingPower = (army: ArmyDefinition, templatesById: Record<string, UnitTemplate>): number =>
  army.slots.reduce((sum, slot) => {
    if (!slot.templateId) {
      return sum;
    }
    const template = templatesById[slot.templateId];
    return template ? sum + calculateTemplateBasePower(template) : sum;
  }, 0);

const createRuntimeArmy = (army: ArmyDefinition, templatesById: Record<string, UnitTemplate>): ArmyRuntimeState => ({
  side: army.side,
  general: army.general,
  plan: army.plan,
  retreatIssued: false,
  retreatTurnsRemaining: 0,
  commandPoints: DEFAULT_COMMAND_POINTS_PER_TURN,
  bankedCommandPoints: 0,
  startingPower: calculateArmyStartingPower(army, templatesById),
});

const createRuntimeSlot = (
  side: ArmyDefinition['side'],
  slot: ArmyDefinition['slots'][number],
  template: UnitTemplate,
): SlotRuntimeState => {
  const meta = getSlotMeta(slot.slotId);
  const maxHp = template.modelCount * template.hpPerModel;
  return {
    side,
    originSlotId: slot.slotId,
    slotId: slot.slotId,
    templateId: template.id,
    templateName: template.name,
    archetype: template.archetype,
    quality: template.quality,
    sector: meta.sector,
    rank: meta.rank,
    stance: slot.stance,
    rangedDoctrine: slot.rangedDoctrine,
    maxHp,
    currentModels: template.modelCount,
    currentHp: maxHp,
    currentMorale: template.morale + template.fortMorale,
    currentStamina: template.staminaMax,
    currentAmmo: template.ammunition,
    status: 'ready',
    action: 'hold',
    targetSlotId: null,
    flankExposed: false,
    temporaryAdvantage: false,
    chargeCooldown: 0,
  };
};

const validateArmyDefinition = (
  army: ArmyDefinition,
  templatesById: Record<string, UnitTemplate>,
  sideLabel: string,
): void => {
  const spentPoints = countPerkPoints(army.general);
  if (spentPoints > MAX_GENERAL_PERK_POINTS) {
    throw new Error(`${sideLabel} general exceeds ${MAX_GENERAL_PERK_POINTS} perk points.`);
  }

  for (const slot of army.slots) {
    if (!slot.templateId) {
      continue;
    }
    if (!templatesById[slot.templateId]) {
      throw new Error(`${sideLabel} slot ${slot.slotId} references unknown template "${slot.templateId}".`);
    }
  }
};

const estimateBattlePacing = (
  setup: BattleSetupOutput,
  templatesById: Record<string, UnitTemplate>,
): Pick<BattleRuntimeState, 'softEndTurn' | 'hardEndTurn'> => {
  const allSlots = [...setup.playerArmy.slots, ...setup.enemyArmy.slots].filter((slot) => slot.templateId);
  const occupiedSlotCount = allSlots.length;
  const totalPower = allSlots.reduce((sum, slot) => {
    if (!slot.templateId) {
      return sum;
    }
    return sum + calculateTemplateBasePower(templatesById[slot.templateId]);
  }, 0);
  const averagePowerPerSide = totalPower / 2;
  const sizeBias = Math.round(occupiedSlotCount / 4);
  const powerBias = averagePowerPerSide >= 2600 ? 2 : averagePowerPerSide >= 1800 ? 1 : 0;
  const softEndTurn = clampNumber(DEFAULT_BATTLE_SOFT_END_START_TURN + sizeBias + powerBias, 4, 8);
  const hardEndTurn = clampNumber(softEndTurn + 5 + powerBias, 9, DEFAULT_BATTLE_HARD_TURN_LIMIT);

  return { softEndTurn, hardEndTurn };
};

export const createBattleRuntime = (
  setup: BattleSetupOutput,
  availableUnitTemplates: UnitTemplate[],
): BattleRuntimeState => {
  const templatesById = indexUnitTemplates(availableUnitTemplates);
  validateArmyDefinition(setup.playerArmy, templatesById, 'Player');
  validateArmyDefinition(setup.enemyArmy, templatesById, 'Enemy');

  const slots: SlotRuntimeState[] = [];
  for (const army of [setup.playerArmy, setup.enemyArmy]) {
    for (const slot of army.slots) {
      if (!slot.templateId) {
        continue;
      }
      const template = templatesById[slot.templateId];
      slots.push(createRuntimeSlot(army.side, slot, template));
    }
  }

  const pacing = estimateBattlePacing(setup, templatesById);

  return {
    seed: setup.seed,
    turn: 0,
    randomState: hashSeed(setup.seed),
    softEndTurn: pacing.softEndTurn,
    hardEndTurn: pacing.hardEndTurn,
    finished: false,
    playerArmy: createRuntimeArmy(setup.playerArmy, templatesById),
    enemyArmy: createRuntimeArmy(setup.enemyArmy, templatesById),
    slots,
    history: [],
    summary: null,
  };
};

export const getArmyPower = (
  army: ArmyRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
): number =>
  slots.reduce((sum, slot) => {
    if (slot.side !== army.side) {
      return sum;
    }
    const template = templatesById[slot.templateId];
    return template ? sum + calculateCurrentSlotPower(slot, template) : sum;
  }, 0);
