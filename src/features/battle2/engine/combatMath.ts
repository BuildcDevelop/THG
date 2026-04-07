import { clampNumber } from './stateUtils';
import type { ArmyRuntimeState, GeneralPerkId, SlotActionId, SlotRuntimeState, UnitTemplate } from './types';

type AttackMode = 'melee' | 'ranged' | 'charge';

const STANCE_MODIFIERS = {
  aggressive: { attack: 1.12, defense: 0.94, morale: 1.02 },
  balanced: { attack: 1, defense: 1, morale: 1 },
  defensive: { attack: 0.9, defense: 1.12, morale: 1.04 },
} as const;

const PLAN_MODIFIERS = {
  standard: { attack: 1, defense: 1 },
  pressure: { attack: 1.08, defense: 0.95 },
  hold_line: { attack: 0.94, defense: 1.08 },
  full_retreat: { attack: 0.76, defense: 0.88 },
} as const;

export const ACTION_STAMINA_DRAIN: Record<SlotActionId, number> = {
  hold: 4,
  advance: 10,
  brace: 8,
  volley: 12,
  focus_fire: 14,
  charge: 24,
  withdraw: 6,
  re_form: 0,
};

export const getPerkLevel = (army: ArmyRuntimeState, perkId: GeneralPerkId): number =>
  Math.max(0, Math.floor(Number(army.general.perkPoints[perkId] ?? 0)));

const getMoraleMultiplier = (slot: SlotRuntimeState, template: UnitTemplate): number => {
  const moraleCap = Math.max(1, template.morale + template.fortMorale);
  const ratio = clampNumber(slot.currentMorale / moraleCap, 0.1, 1.25);
  return 0.55 + ratio * 0.6;
};

const getStaminaMultiplier = (slot: SlotRuntimeState, template: UnitTemplate): number => {
  const ratio = clampNumber(slot.currentStamina / Math.max(1, template.staminaMax), 0.15, 1);
  return 0.65 + ratio * 0.55;
};

const getAttackProfile = (slot: SlotRuntimeState, template: UnitTemplate, mode: AttackMode): number => {
  const bodies = slot.currentModels / (mode === 'ranged' ? 8 : 6);
  const meleeStat = template.meleeAttack * 7 + template.resilience * 2.5;
  const chargeStat = template.impact * 9 + template.penetrationPct * 0.7 + template.massive * 15;
  const rangedStat = template.rangedAttack * 4 + template.bleed * 10;

  if (mode === 'ranged') {
    return bodies + rangedStat;
  }

  return bodies + meleeStat + (mode === 'charge' ? chargeStat : chargeStat * 0.4);
};

const getDefenseProfile = (slot: SlotRuntimeState, template: UnitTemplate, mode: AttackMode): number => {
  const bodies = slot.currentModels / 8;
  const guard =
    template.meleeDefense * 7 +
    template.resilience * 8 +
    template.flatDamageReduction * 18 +
    template.physicalResistancePct * 1.5;
  const rangedCover = template.rangedReductionPct * 3 + (mode === 'ranged' ? template.flatDamageReduction * 8 : 0);

  return bodies + guard + rangedCover + (slot.flankExposed ? -20 : 0);
};

const getActionBasePct = (action: SlotActionId, mode: AttackMode): number => {
  if (mode === 'ranged') {
    return action === 'focus_fire' ? 0.16 : 0.13;
  }
  if (mode === 'charge') {
    return 0.23;
  }
  if (action === 'advance') {
    return 0.14;
  }
  if (action === 'brace') {
    return 0.11;
  }
  return 0.12;
};

const getAttackMultiplier = (
  attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  attackerArmy: ArmyRuntimeState,
  target: SlotRuntimeState,
  mode: AttackMode,
): number => {
  const stance = STANCE_MODIFIERS[attacker.stance];
  const plan = PLAN_MODIFIERS[attackerArmy.plan];
  let modifier = stance.attack * stance.morale * plan.attack;
  modifier *= getMoraleMultiplier(attacker, attackerTemplate);
  modifier *= getStaminaMultiplier(attacker, attackerTemplate);
  modifier *= attacker.temporaryAdvantage ? 1.12 : 1;
  modifier *= target.flankExposed ? 1.08 : 1;

  if (attackerTemplate.quality === 'levy') {
    modifier *= 1 + getPerkLevel(attackerArmy, 'levy_training') * 0.04;
  }
  if (mode === 'charge' && attacker.archetype === 'cavalry') {
    modifier *= 1 + getPerkLevel(attackerArmy, 'wedge') * 0.08;
  }
  if (mode === 'ranged' && attacker.archetype === 'archer') {
    modifier *= 1 + getPerkLevel(attackerArmy, 'ranger') * 0.06;
  }
  if (mode !== 'ranged' && attacker.archetype === 'infantry') {
    modifier *= 1 + getPerkLevel(attackerArmy, 'sapper') * 0.04;
  }

  return modifier;
};

const getDefenseMultiplier = (
  defender: SlotRuntimeState,
  defenderTemplate: UnitTemplate,
  defenderArmy: ArmyRuntimeState,
  mode: AttackMode,
): number => {
  const stance = STANCE_MODIFIERS[defender.stance];
  const plan = PLAN_MODIFIERS[defenderArmy.plan];
  let modifier = stance.defense * plan.defense;
  modifier *= defender.action === 'brace' && mode !== 'ranged' ? 1.12 : 1;
  modifier *= getMoraleMultiplier(defender, defenderTemplate);
  modifier *= 0.82 + clampNumber(defender.currentStamina / Math.max(1, defenderTemplate.staminaMax), 0.1, 1) * 0.28;

  if (mode === 'ranged') {
    modifier *= 1 + getPerkLevel(defenderArmy, 'pavise') * 0.06;
  }

  return modifier;
};

const computeDamage = (
  attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  attackerArmy: ArmyRuntimeState,
  defender: SlotRuntimeState,
  defenderTemplate: UnitTemplate,
  defenderArmy: ArmyRuntimeState,
  mode: AttackMode,
): number => {
  const action = mode === 'ranged' ? attacker.action : mode === 'charge' ? 'charge' : attacker.action;
  const attackProfile = getAttackProfile(attacker, attackerTemplate, mode);
  const defenseProfile = Math.max(20, getDefenseProfile(defender, defenderTemplate, mode));
  const pressure = attackProfile / (attackProfile + defenseProfile + 55);
  const basePct = getActionBasePct(action, mode);
  const rawDamage =
    defender.maxHp *
    basePct *
    pressure *
    getAttackMultiplier(attacker, attackerTemplate, attackerArmy, defender, mode);
  const reducedDamage = rawDamage / getDefenseMultiplier(defender, defenderTemplate, defenderArmy, mode);

  return Math.max(mode === 'charge' ? 32 : 18, Math.round(reducedDamage));
};

export const computeMeleeDamage = (
  attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  attackerArmy: ArmyRuntimeState,
  defender: SlotRuntimeState,
  defenderTemplate: UnitTemplate,
  defenderArmy: ArmyRuntimeState,
): number => computeDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy, 'melee');

export const computeChargeDamage = (
  attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  attackerArmy: ArmyRuntimeState,
  defender: SlotRuntimeState,
  defenderTemplate: UnitTemplate,
  defenderArmy: ArmyRuntimeState,
): number => computeDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy, 'charge');

export const computeRangedDamage = (
  attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  attackerArmy: ArmyRuntimeState,
  defender: SlotRuntimeState,
  defenderTemplate: UnitTemplate,
  defenderArmy: ArmyRuntimeState,
): number => computeDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy, 'ranged');

export const computeMoraleShock = (
  _attacker: SlotRuntimeState,
  attackerTemplate: UnitTemplate,
  defender: SlotRuntimeState,
  damage: number,
  mode: AttackMode,
): number => {
  const damageRatio = damage / Math.max(1, defender.maxHp);
  const baseShock = damageRatio * 90;
  const chargeShock = mode === 'charge' ? 12 + attackerTemplate.impact * 0.8 : 0;
  const rangedShock = mode === 'ranged' ? 4 + attackerTemplate.bleed * 2 : 0;
  const flankShock = defender.flankExposed ? 8 : 0;
  return Math.round(baseShock + chargeShock + rangedShock + flankShock);
};

export const getStaminaRecovery = (slot: SlotRuntimeState, template: UnitTemplate): number => {
  const passiveRecovery = template.staminaRecovery + (slot.action === 're_form' ? 16 : slot.action === 'hold' ? 8 : 0);
  return slot.status === 'broken' ? passiveRecovery + 4 : passiveRecovery;
};

export const updateSlotEndState = (slot: SlotRuntimeState, template: UnitTemplate): SlotRuntimeState['status'] => {
  if (slot.currentHp <= 0 || slot.currentModels <= 0) {
    return 'destroyed';
  }
  if (slot.status === 'withdrawn') {
    return 'withdrawn';
  }

  const moraleCap = Math.max(1, template.morale + template.fortMorale);
  const moraleRatio = clampNumber(slot.currentMorale / moraleCap, 0, 1.25);
  const hpRatio = clampNumber(slot.currentHp / Math.max(1, slot.maxHp), 0, 1);
  const staminaRatio = clampNumber(slot.currentStamina / Math.max(1, template.staminaMax), 0, 1);

  if (moraleRatio <= 0.08 || (hpRatio <= 0.12 && moraleRatio <= 0.24)) {
    return 'routing';
  }
  if (moraleRatio <= 0.22 || hpRatio <= 0.22) {
    return 'broken';
  }
  if (moraleRatio <= 0.5 || staminaRatio <= 0.25) {
    return 'shaken';
  }
  if (slot.targetSlotId && slot.action !== 'hold' && slot.action !== 're_form') {
    return 'engaged';
  }
  return 'ready';
};
