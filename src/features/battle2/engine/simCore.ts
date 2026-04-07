import { DEFAULT_MAX_BANKED_COMMAND_POINTS } from './constants';
import { canTargetEnemySlot, doesActionUseEnemyTarget } from './commandRules';
import {
  ACTION_STAMINA_DRAIN,
  computeChargeDamage,
  computeMeleeDamage,
  computeMoraleShock,
  computeRangedDamage,
  getStaminaRecovery,
  updateSlotEndState,
} from './combatMath';
import { chooseSlotIntent } from './planning';
import { rollRandom } from './random';
import { createBattleRuntime, getArmyPower } from './runtime';
import { getAdjacentSectors, getMeleeContactSlotIds } from './slotUtils';
import { clampNumber, copySlot, getOpposingSide, isSlotCombatReady, sortSlots } from './stateUtils';
import type { BattleRunResult } from './contracts';
import type {
  ArmyRuntimeState,
  BattleEndReasonId,
  BattleResultId,
  BattleRuntimeState,
  BattleSide,
  BattleSlotId,
  BattleSummary,
  CombatEvent,
  GeneralOutcomeId,
  SlotRuntimeState,
  TurnResolution,
  UnitTemplate,
} from './types';

type PlayerManualOrder = {
  action?: SlotRuntimeState['action'] | null;
  targetSlotId?: BattleSlotId | null;
};

export interface StepBattleOptions {
  playerManualOrders?: Partial<Record<BattleSlotId, PlayerManualOrder>>;
}

type CommandBudgetState = {
  remaining: number;
};

type FinishCheck = {
  finished: boolean;
  winner: BattleSide | 'draw';
  endReason: BattleEndReasonId;
};

const slotKey = (slot: SlotRuntimeState): string => `${slot.side}:${slot.originSlotId}`;

const getArmyState = (battle: BattleRuntimeState, side: BattleSide): ArmyRuntimeState =>
  side === 'player' ? battle.playerArmy : battle.enemyArmy;

const canParticipateInMelee = (slot: SlotRuntimeState): boolean => slot.archetype !== 'archer' && slot.rank === 'front';

const hasValidFrontContact = (slot: SlotRuntimeState, targetSlotId: BattleSlotId): boolean =>
  canParticipateInMelee(slot) && getMeleeContactSlotIds(slot.slotId).includes(targetSlotId);

const getTemplate = (templatesById: Record<string, UnitTemplate>, slot: SlotRuntimeState): UnitTemplate => {
  const template = templatesById[slot.templateId];
  if (!template) {
    throw new Error(`Unknown runtime template "${slot.templateId}".`);
  }
  return template;
};

const findSlotAtPosition = (
  slots: SlotRuntimeState[],
  side: BattleSide,
  slotId: BattleSlotId,
  activeOnly = false,
): SlotRuntimeState | null => {
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    if (slot.side !== side || slot.slotId !== slotId) {
      continue;
    }
    if (activeOnly && !isSlotCombatReady(slot)) {
      continue;
    }
    return slot;
  }
  return null;
};

const createEventWriter = (turn: number) => {
  let eventIndex = 0;
  const events: CombatEvent[] = [];

  const pushEvent = (
    type: CombatEvent['type'],
    side: BattleSide,
    slotId: BattleSlotId | null,
    targetSlotId: BattleSlotId | null,
    message: string,
  ): void => {
    eventIndex += 1;
    events.push({
      id: `turn-${turn}-event-${eventIndex}`,
      turn,
      type,
      side,
      slotId,
      targetSlotId,
      message,
    });
  };

  return {
    events,
    pushEvent,
  };
};

const applyDamage = (
  target: SlotRuntimeState,
  template: UnitTemplate,
  damage: number,
  moraleLoss: number,
  damageTaken: Map<string, number>,
): void => {
  target.currentHp = Math.max(0, target.currentHp - damage);
  target.currentModels = target.currentHp > 0 ? Math.max(1, Math.ceil(target.currentHp / template.hpPerModel)) : 0;
  target.currentMorale = Math.max(0, target.currentMorale - moraleLoss);
  target.currentStamina = Math.max(0, target.currentStamina - Math.round(Math.min(16, moraleLoss * 0.35)));
  damageTaken.set(slotKey(target), (damageTaken.get(slotKey(target)) ?? 0) + damage);
};

const refreshFlankExposure = (
  slots: SlotRuntimeState[],
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  for (const slot of slots) {
    if (!isSlotCombatReady(slot) || slot.rank !== 'front') {
      slot.flankExposed = false;
      continue;
    }

    const adjacentSectors = getAdjacentSectors(slot.sector);
    const enemyPressure = adjacentSectors.some((sector) =>
      slots.some(
        (candidate) =>
          candidate.side !== slot.side &&
          candidate.sector === sector &&
          candidate.rank === 'front' &&
          isSlotCombatReady(candidate),
      ),
    );
    const friendlySupport = adjacentSectors.some((sector) =>
      slots.some(
        (candidate) =>
          candidate.side === slot.side &&
          candidate.sector === sector &&
          candidate.rank === 'front' &&
          isSlotCombatReady(candidate),
      ),
    );
    const previousValue = slot.flankExposed;
    slot.flankExposed = enemyPressure && !friendlySupport;

    if (!previousValue && slot.flankExposed) {
      pushEvent('flank_exposed', slot.side, slot.slotId, null, `${slot.templateName} lost flank support in ${slot.sector}.`);
    }
  }
};

const applyIntentSelection = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  warnings: string[],
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
  playerCommandBudget: CommandBudgetState,
  stepOptions?: StepBattleOptions,
): void => {
  const playerManualOrders = stepOptions?.playerManualOrders ?? {};

  const canUseManualAction = (slot: SlotRuntimeState, action: SlotRuntimeState['action']): boolean => {
    if (action === 'charge') {
      return slot.archetype === 'cavalry';
    }
    if (action === 'volley' || action === 'focus_fire') {
      return slot.archetype === 'archer';
    }
    return true;
  };

  for (const slot of sortSlots(slots.filter(isSlotCombatReady))) {
    const intent = chooseSlotIntent(slot, battle, slots, templatesById);
    slot.action = intent.action;
    slot.targetSlotId = intent.targetSlotId;

    if (intent.warning) {
      warnings.push(`${slot.templateName}: ${intent.warning}`);
      pushEvent('no_ranged_target', slot.side, slot.slotId, null, `${slot.templateName}: ${intent.warning}`);
    }

    if (slot.side !== 'player') {
      continue;
    }

    const manualOrder = playerManualOrders[slot.slotId];
    if (!manualOrder) {
      continue;
    }

    if (playerCommandBudget.remaining <= 0) {
      warnings.push(`${slot.templateName}: command points exhausted, manual order ignored.`);
      continue;
    }

    playerCommandBudget.remaining -= 1;

    if (typeof manualOrder.action !== 'undefined' && manualOrder.action !== null) {
      if (canUseManualAction(slot, manualOrder.action)) {
        slot.action = manualOrder.action;
        if (!doesActionUseEnemyTarget(slot.action)) {
          slot.targetSlotId = null;
        }
      } else {
        warnings.push(`${slot.templateName}: action "${manualOrder.action}" is not valid for ${slot.archetype}.`);
      }
    }

    if (typeof manualOrder.targetSlotId !== 'undefined') {
      if (manualOrder.targetSlotId === null) {
        slot.targetSlotId = null;
      } else {
        const hasEnemyTarget = slots.some(
          (candidate) =>
            candidate.side === 'enemy' &&
            candidate.slotId === manualOrder.targetSlotId &&
            isSlotCombatReady(candidate),
        );
        if (hasEnemyTarget && canTargetEnemySlot(slot, manualOrder.targetSlotId, slot.action)) {
          slot.targetSlotId = manualOrder.targetSlotId;
        } else {
          warnings.push(`${slot.templateName}: manual target "${manualOrder.targetSlotId}" is not currently valid.`);
        }
      }
    }
  }
};

const resolveRangedPhase = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  damageTaken: Map<string, number>,
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  const archers = sortSlots(
    slots.filter((slot) => isSlotCombatReady(slot) && slot.archetype === 'archer' && (slot.action === 'volley' || slot.action === 'focus_fire')),
  );

  for (const attacker of archers) {
    if (!attacker.targetSlotId || attacker.currentAmmo <= 0) {
      continue;
    }

    const defender = findSlotAtPosition(slots, getOpposingSide(attacker.side), attacker.targetSlotId, true);
    if (!defender) {
      continue;
    }

    const attackerArmy = getArmyState(battle, attacker.side);
    const defenderArmy = getArmyState(battle, defender.side);
    const attackerTemplate = getTemplate(templatesById, attacker);
    const defenderTemplate = getTemplate(templatesById, defender);
    const damage = computeRangedDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy);
    const moraleLoss = computeMoraleShock(attacker, attackerTemplate, defender, damage, 'ranged');

    attacker.currentAmmo = Math.max(0, attacker.currentAmmo - 1);
    applyDamage(defender, defenderTemplate, damage, moraleLoss, damageTaken);
    pushEvent(
      attacker.action === 'focus_fire' ? 'focus_fire' : 'volley',
      attacker.side,
      attacker.slotId,
      defender.slotId,
      `${attacker.templateName} hit ${defender.templateName} for ${damage} damage.`,
    );
  }
};

const resolveChargePhase = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  damageTaken: Map<string, number>,
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  const chargers = sortSlots(
    slots.filter(
      (slot) => isSlotCombatReady(slot) && slot.archetype === 'cavalry' && slot.rank === 'front' && slot.action === 'charge',
    ),
  );

  for (const attacker of chargers) {
    if (!attacker.targetSlotId || !hasValidFrontContact(attacker, attacker.targetSlotId)) {
      continue;
    }

    const defender = findSlotAtPosition(slots, getOpposingSide(attacker.side), attacker.targetSlotId, true);
    if (!defender || defender.rank !== 'front') {
      continue;
    }

    const attackerArmy = getArmyState(battle, attacker.side);
    const defenderArmy = getArmyState(battle, defender.side);
    const attackerTemplate = getTemplate(templatesById, attacker);
    const defenderTemplate = getTemplate(templatesById, defender);
    let damage = computeChargeDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy);

    if (defender.action === 'brace') {
      damage = Math.round(damage * 0.86);
      attacker.currentMorale = Math.max(0, attacker.currentMorale - 4 - defenderTemplate.antiCavalry);
      pushEvent('brace', defender.side, defender.slotId, attacker.slotId, `${defender.templateName} braced against the charge.`);
    }

    const moraleLoss = computeMoraleShock(attacker, attackerTemplate, defender, damage, 'charge');
    const recoilDamage = defender.action === 'brace' ? Math.round(damage * 0.16) : Math.round(damage * 0.05);
    const recoilMorale = defender.action === 'brace' ? 8 : 3;

    attacker.chargeCooldown = 2;
    attacker.temporaryAdvantage = damage / Math.max(1, defender.maxHp) >= 0.12;

    applyDamage(defender, defenderTemplate, damage, moraleLoss, damageTaken);
    applyDamage(attacker, attackerTemplate, recoilDamage, recoilMorale, damageTaken);
    pushEvent('charge', attacker.side, attacker.slotId, defender.slotId, `${attacker.templateName} charged ${defender.templateName}.`);
  }
};

const resolveMeleePhase = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  damageTaken: Map<string, number>,
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  const attackers = sortSlots(
    slots.filter(
      (slot) =>
        isSlotCombatReady(slot) &&
        slot.rank === 'front' &&
        slot.archetype !== 'archer' &&
        slot.action !== 'charge' &&
        slot.action !== 'withdraw' &&
        slot.action !== 're_form' &&
        !!slot.targetSlotId,
    ),
  );

  for (const attacker of attackers) {
    if (!attacker.targetSlotId || !hasValidFrontContact(attacker, attacker.targetSlotId)) {
      continue;
    }

    const defender = attacker.targetSlotId
      ? findSlotAtPosition(slots, getOpposingSide(attacker.side), attacker.targetSlotId, true)
      : null;
    if (!defender || defender.rank !== 'front') {
      continue;
    }

    const attackerArmy = getArmyState(battle, attacker.side);
    const defenderArmy = getArmyState(battle, defender.side);
    const attackerTemplate = getTemplate(templatesById, attacker);
    const defenderTemplate = getTemplate(templatesById, defender);
    const damage = computeMeleeDamage(attacker, attackerTemplate, attackerArmy, defender, defenderTemplate, defenderArmy);
    const moraleLoss = computeMoraleShock(attacker, attackerTemplate, defender, damage, 'melee');

    applyDamage(defender, defenderTemplate, damage, moraleLoss, damageTaken);
    pushEvent('engage', attacker.side, attacker.slotId, defender.slotId, `${attacker.templateName} engaged ${defender.templateName}.`);
  }
};

const clearNonContactMeleeIntents = (slots: SlotRuntimeState[]): void => {
  for (const slot of slots) {
    if (slot.archetype === 'archer') {
      continue;
    }

    if (!canParticipateInMelee(slot)) {
      slot.targetSlotId = null;
      if (slot.action === 'advance' || slot.action === 'brace' || slot.action === 'charge') {
        slot.action = 'hold';
      }
      continue;
    }

    if (slot.targetSlotId && !hasValidFrontContact(slot, slot.targetSlotId)) {
      slot.targetSlotId = null;
      if (slot.action === 'advance' || slot.action === 'charge') {
        slot.action = 'hold';
      }
    }
  }
};

const resolveWithdrawals = (
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  for (const slot of slots) {
    if (!isSlotCombatReady(slot)) {
      continue;
    }

    if (slot.action === 'withdraw') {
      slot.status = 'withdrawn';
      slot.targetSlotId = null;
      slot.currentMorale = Math.min(slot.currentMorale + 8, getTemplate(templatesById, slot).morale);
      pushEvent('withdraw', slot.side, slot.slotId, null, `${slot.templateName} withdrew from the line.`);
      continue;
    }

    if (slot.action === 're_form') {
      slot.currentMorale = Math.min(
        slot.currentMorale + 10,
        getTemplate(templatesById, slot).morale + getTemplate(templatesById, slot).fortMorale,
      );
      pushEvent('re_form', slot.side, slot.slotId, null, `${slot.templateName} is reforming.`);
    }
  }
};

const resolveRecovery = (
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  damageTaken: Map<string, number>,
): void => {
  for (const slot of slots) {
    const template = templatesById[slot.templateId];
    if (!template || slot.status === 'destroyed' || slot.status === 'withdrawn') {
      continue;
    }

    slot.currentStamina = clampNumber(
      slot.currentStamina - ACTION_STAMINA_DRAIN[slot.action] + getStaminaRecovery(slot, template),
      0,
      template.staminaMax,
    );

    if ((damageTaken.get(slotKey(slot)) ?? 0) === 0 && slot.action !== 'charge') {
      slot.currentMorale = clampNumber(slot.currentMorale + (slot.action === 'hold' ? 5 : 2), 0, template.morale + template.fortMorale);
    }

    if (slot.chargeCooldown > 0 && slot.action !== 'charge') {
      slot.chargeCooldown -= 1;
    }

    slot.status = updateSlotEndState(slot, template);
    slot.temporaryAdvantage = slot.status === 'engaged' && slot.temporaryAdvantage;
  }
};

const updateArmyRetreatCountdown = (army: ArmyRuntimeState): void => {
  if (!army.retreatIssued || army.retreatTurnsRemaining <= 0) {
    return;
  }
  army.retreatTurnsRemaining -= 1;
};

const countActiveLineSlots = (slots: SlotRuntimeState[], side: BattleSide): number =>
  slots.filter((slot) => slot.side === side && slot.rank === 'front' && isSlotCombatReady(slot)).length;

const maybeIssueRetreat = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
  pushEvent: ReturnType<typeof createEventWriter>['pushEvent'],
): void => {
  if (battle.turn < battle.softEndTurn) {
    return;
  }

  for (const side of ['player', 'enemy'] as const) {
    const army = getArmyState(battle, side);
    const opposingArmy = getArmyState(battle, getOpposingSide(side));
    if (army.retreatIssued) {
      continue;
    }

    const armyPower = getArmyPower(army, slots, templatesById);
    const opposingPower = getArmyPower(opposingArmy, slots, templatesById);
    const ownRatio = armyPower / Math.max(1, army.startingPower);
    const relativeRatio = armyPower / Math.max(1, opposingPower);
    const lineSlots = countActiveLineSlots(slots, side);

    const shouldRetreat =
      lineSlots === 0 ||
      (ownRatio <= 0.3 && relativeRatio <= 0.58) ||
      (ownRatio <= 0.45 && relativeRatio <= 0.7 && battle.turn >= battle.softEndTurn + 1);

    if (!shouldRetreat) {
      continue;
    }

    army.retreatIssued = true;
    army.plan = 'full_retreat';
    army.retreatTurnsRemaining = lineSlots === 0 ? 1 : 2;
    pushEvent('retreat_called', side, null, null, `${army.general.name} ordered a retreat.`);
  }
};

const resolveBattleResultId = (
  winner: BattleSide | 'draw',
  endReason: BattleEndReasonId,
  playerArmy: ArmyRuntimeState,
  playerRemainingPower: number,
  enemyRemainingPower: number,
): BattleResultId => {
  if (winner === 'draw') {
    return 'stalemate';
  }

  if (winner === 'player') {
    const playerRatio = playerRemainingPower / Math.max(1, playerArmy.startingPower);
    if (endReason === 'annihilation' || enemyRemainingPower <= playerRemainingPower * 0.12) {
      return 'decisive_victory';
    }
    if (playerRatio <= 0.32) {
      return 'pyrrhic_victory';
    }
    return 'victory';
  }

  if (endReason === 'organized_retreat') {
    return 'organized_retreat';
  }
  if (playerRemainingPower <= playerArmy.startingPower * 0.08) {
    return 'annihilation';
  }
  return 'defeat';
};

const resolveGeneralOutcome = (
  side: BattleSide,
  winner: BattleSide | 'draw',
  endReason: BattleEndReasonId,
  remainingPower: number,
  startingPower: number,
  randomRoll: number,
): GeneralOutcomeId => {
  const remainingRatio = remainingPower / Math.max(1, startingPower);

  if (winner === side) {
    return remainingRatio < 0.28 && randomRoll < 0.24 ? 'wounded' : 'safe';
  }

  if (winner === 'draw') {
    return remainingRatio < 0.18 && randomRoll < 0.35 ? 'wounded' : 'safe';
  }

  if (endReason === 'organized_retreat' && remainingRatio >= 0.2) {
    return randomRoll < 0.2 ? 'wounded' : 'escaped';
  }
  if (endReason === 'annihilation') {
    if (randomRoll < 0.18) {
      return 'dead';
    }
    return randomRoll < 0.48 ? 'captured' : 'wounded';
  }
  return randomRoll < 0.28 ? 'captured' : 'wounded';
};

const shouldFinishBattle = (
  battle: BattleRuntimeState,
  slots: SlotRuntimeState[],
  templatesById: Record<string, UnitTemplate>,
): FinishCheck => {
  const playerPower = getArmyPower(battle.playerArmy, slots, templatesById);
  const enemyPower = getArmyPower(battle.enemyArmy, slots, templatesById);
  const playerLine = countActiveLineSlots(slots, 'player');
  const enemyLine = countActiveLineSlots(slots, 'enemy');

  if (playerPower <= 0 || playerLine === 0) {
    return {
      finished: true,
      winner: 'enemy',
      endReason: playerPower <= battle.playerArmy.startingPower * 0.08 ? 'annihilation' : 'army_collapse',
    };
  }

  if (enemyPower <= 0 || enemyLine === 0) {
    return {
      finished: true,
      winner: 'player',
      endReason: enemyPower <= battle.enemyArmy.startingPower * 0.08 ? 'annihilation' : 'army_collapse',
    };
  }

  if (battle.playerArmy.retreatIssued && battle.playerArmy.retreatTurnsRemaining <= 0) {
    return {
      finished: true,
      winner: 'enemy',
      endReason: 'organized_retreat',
    };
  }

  if (battle.enemyArmy.retreatIssued && battle.enemyArmy.retreatTurnsRemaining <= 0) {
    return {
      finished: true,
      winner: 'player',
      endReason: 'organized_retreat',
    };
  }

  if (
    battle.turn >= battle.softEndTurn + 2 &&
    playerPower <= battle.playerArmy.startingPower * 0.18 &&
    enemyPower <= battle.enemyArmy.startingPower * 0.18
  ) {
    return {
      finished: true,
      winner: Math.abs(playerPower - enemyPower) / Math.max(1, Math.max(playerPower, enemyPower)) <= 0.12 ? 'draw' : playerPower > enemyPower ? 'player' : 'enemy',
      endReason: 'mutual_exhaustion',
    };
  }

  if (battle.turn >= battle.hardEndTurn) {
    return {
      finished: true,
      winner: Math.abs(playerPower - enemyPower) / Math.max(1, Math.max(playerPower, enemyPower)) <= 0.1 ? 'draw' : playerPower > enemyPower ? 'player' : 'enemy',
      endReason: 'turn_limit',
    };
  }

  return {
    finished: false,
    winner: 'draw',
    endReason: 'turn_limit',
  };
};

const buildSummary = (
  battle: BattleRuntimeState,
  winner: BattleSide | 'draw',
  endReason: BattleEndReasonId,
  templatesById: Record<string, UnitTemplate>,
): BattleSummary => {
  const playerRemainingPower = getArmyPower(battle.playerArmy, battle.slots, templatesById);
  const enemyRemainingPower = getArmyPower(battle.enemyArmy, battle.slots, templatesById);
  const playerRoll = rollRandom(battle.randomState);
  const enemyRoll = rollRandom(playerRoll.state);
  battle.randomState = enemyRoll.state;

  return {
    result: resolveBattleResultId(winner, endReason, battle.playerArmy, playerRemainingPower, enemyRemainingPower),
    endReason,
    totalTurns: battle.turn,
    winner,
    playerGeneralOutcome: resolveGeneralOutcome(
      'player',
      winner,
      endReason,
      playerRemainingPower,
      battle.playerArmy.startingPower,
      playerRoll.value,
    ),
    enemyGeneralOutcome: resolveGeneralOutcome(
      'enemy',
      winner,
      endReason,
      enemyRemainingPower,
      battle.enemyArmy.startingPower,
      enemyRoll.value,
    ),
    playerRemainingPower,
    enemyRemainingPower,
  };
};

export const stepBattle = (
  runtime: BattleRuntimeState,
  availableUnitTemplates: UnitTemplate[],
  stepOptions?: StepBattleOptions,
): { nextState: BattleRuntimeState; resolution: TurnResolution } => {
  if (runtime.finished && runtime.summary) {
    return {
      nextState: runtime,
      resolution: runtime.history[runtime.history.length - 1] ?? {
        turn: runtime.turn,
        events: [],
        warnings: [],
        slots: runtime.slots.map(copySlot),
      },
    };
  }

  const nextState: BattleRuntimeState = {
    ...runtime,
    turn: runtime.turn + 1,
    playerArmy: { ...runtime.playerArmy },
    enemyArmy: { ...runtime.enemyArmy },
    slots: runtime.slots.map(copySlot),
    history: [...runtime.history],
  };
  const templatesById = Object.fromEntries(availableUnitTemplates.map((template) => [template.id, template])) as Record<
    string,
    UnitTemplate
  >;
  const warnings: string[] = [];
  const damageTaken = new Map<string, number>();
  const { events, pushEvent } = createEventWriter(nextState.turn);

  const playerCommandBudget: CommandBudgetState = {
    remaining: Math.min(DEFAULT_MAX_BANKED_COMMAND_POINTS + 1, 1 + nextState.playerArmy.bankedCommandPoints),
  };
  const enemyCommandBudget: CommandBudgetState = {
    remaining: Math.min(DEFAULT_MAX_BANKED_COMMAND_POINTS + 1, 1 + nextState.enemyArmy.bankedCommandPoints),
  };
  nextState.playerArmy.commandPoints = playerCommandBudget.remaining;
  nextState.enemyArmy.commandPoints = enemyCommandBudget.remaining;
  nextState.playerArmy.bankedCommandPoints = 0;
  nextState.enemyArmy.bankedCommandPoints = 0;

  refreshFlankExposure(nextState.slots, pushEvent);
  applyIntentSelection(nextState, nextState.slots, templatesById, warnings, pushEvent, playerCommandBudget, stepOptions);
  resolveRangedPhase(nextState, nextState.slots, templatesById, damageTaken, pushEvent);
  resolveChargePhase(nextState, nextState.slots, templatesById, damageTaken, pushEvent);
  resolveMeleePhase(nextState, nextState.slots, templatesById, damageTaken, pushEvent);
  resolveWithdrawals(nextState.slots, templatesById, pushEvent);
  clearNonContactMeleeIntents(nextState.slots);
  resolveRecovery(nextState.slots, templatesById, damageTaken);
  maybeIssueRetreat(nextState, nextState.slots, templatesById, pushEvent);
  updateArmyRetreatCountdown(nextState.playerArmy);
  updateArmyRetreatCountdown(nextState.enemyArmy);
  nextState.playerArmy.commandPoints = 0;
  nextState.playerArmy.bankedCommandPoints = Math.min(DEFAULT_MAX_BANKED_COMMAND_POINTS, playerCommandBudget.remaining);
  nextState.enemyArmy.commandPoints = 0;
  nextState.enemyArmy.bankedCommandPoints = Math.min(DEFAULT_MAX_BANKED_COMMAND_POINTS, enemyCommandBudget.remaining);

  for (const slot of nextState.slots) {
    if (slot.status === 'destroyed') {
      pushEvent('line_break', slot.side, slot.slotId, null, `${slot.templateName} was destroyed.`);
    } else if (slot.status === 'routing') {
      pushEvent('rout', slot.side, slot.slotId, null, `${slot.templateName} is routing.`);
    } else if (slot.temporaryAdvantage) {
      pushEvent('temporary_advantage', slot.side, slot.slotId, slot.targetSlotId, `${slot.templateName} seized temporary advantage.`);
    }
  }

  const finishCheck = shouldFinishBattle(nextState, nextState.slots, templatesById);
  if (finishCheck.finished) {
    nextState.finished = true;
    nextState.summary = buildSummary(nextState, finishCheck.winner, finishCheck.endReason, templatesById);
  }

  const resolution: TurnResolution = {
    turn: nextState.turn,
    events,
    warnings,
    slots: nextState.slots.map(copySlot),
  };

  nextState.history.push(resolution);

  return {
    nextState,
    resolution,
  };
};

export const runBattle = (
  setup: Parameters<typeof createBattleRuntime>[0],
  availableUnitTemplates: UnitTemplate[],
): BattleRunResult => {
  let runtime = createBattleRuntime(setup, availableUnitTemplates);

  while (!runtime.finished) {
    runtime = stepBattle(runtime, availableUnitTemplates).nextState;
  }

  if (!runtime.summary) {
    throw new Error('Battle finished without summary.');
  }

  return {
    finalState: runtime,
    turns: runtime.history,
    summary: runtime.summary,
  };
};

export { createBattleRuntime };
