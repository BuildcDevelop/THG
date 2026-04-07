export type BattleSide = 'player' | 'enemy';

export type BattleSector = 'left' | 'center' | 'right';
export type BattleRank = 'front' | 'main' | 'reserve';

export type BattleSlotId =
  | 'left_front'
  | 'center_front'
  | 'right_front'
  | 'left_main'
  | 'center_main'
  | 'right_main'
  | 'left_reserve'
  | 'center_reserve'
  | 'right_reserve';

export type UnitArchetype = 'infantry' | 'archer' | 'cavalry';
export type UnitQuality = 'levy' | 'retainer' | 'garrison' | 'mercenary';

export type SlotStance = 'aggressive' | 'balanced' | 'defensive';

export type ArmyPlanId = 'standard' | 'pressure' | 'hold_line' | 'full_retreat';

export type RangedDoctrineId = 'counter_archers' | 'support_center' | 'finish_broken' | 'auto';

export type SlotActionId =
  | 'hold'
  | 'advance'
  | 'brace'
  | 'volley'
  | 'focus_fire'
  | 'charge'
  | 'withdraw'
  | 're_form';

export type SlotStatusId =
  | 'ready'
  | 'engaged'
  | 'shaken'
  | 'broken'
  | 'routing'
  | 'withdrawn'
  | 'destroyed';

export type GeneralPerkId = 'sapper' | 'pavise' | 'wedge' | 'ranger' | 'levy_training';

export type CombatEventType =
  | 'engage'
  | 'volley'
  | 'focus_fire'
  | 'charge'
  | 'brace'
  | 'line_break'
  | 'flank_exposed'
  | 'temporary_advantage'
  | 'withdraw'
  | 're_form'
  | 'rout'
  | 'retreat_called'
  | 'no_ranged_target';

export type BattleResultId =
  | 'decisive_victory'
  | 'victory'
  | 'pyrrhic_victory'
  | 'organized_retreat'
  | 'defeat'
  | 'annihilation'
  | 'stalemate';

export type GeneralOutcomeId = 'safe' | 'wounded' | 'captured' | 'dead' | 'escaped';

export type BattleEndReasonId =
  | 'army_collapse'
  | 'organized_retreat'
  | 'annihilation'
  | 'turn_limit'
  | 'mutual_exhaustion';

export interface GeneralLoadout {
  name: string;
  perkPoints: Partial<Record<GeneralPerkId, number>>;
}

export interface UnitTemplate {
  id: string;
  name: string;
  archetype: UnitArchetype;
  quality: UnitQuality;
  modelCount: number;
  hpPerModel: number;
  meleeAttack: number;
  meleeDefense: number;
  resilience: number;
  impact: number;
  penetrationPct: number;
  rangedAttack: number;
  ammunition: number;
  morale: number;
  discipline: number;
  staminaMax: number;
  staminaRecovery: number;
  rangedReductionPct: number;
  flatDamageReduction: number;
  antiCavalry: number;
  massive: number;
  bleed: number;
  physicalResistancePct: number;
  recruitCost: number;
  upkeepCost: number;
  fortDefense: number;
  fortEndurance: number;
  fortMorale: number;
  note: string;
}

export interface ArmySlotLoadout {
  slotId: BattleSlotId;
  templateId: string | null;
  stance: SlotStance;
  rangedDoctrine: RangedDoctrineId;
}

export interface ArmyDefinition {
  side: BattleSide;
  general: GeneralLoadout;
  plan: ArmyPlanId;
  slots: ArmySlotLoadout[];
}

export interface BattleScenarioSeed {
  enemyTemplateId: string;
  seed: string;
}

export interface SlotRuntimeState {
  side: BattleSide;
  originSlotId: BattleSlotId;
  slotId: BattleSlotId;
  templateId: string;
  templateName: string;
  archetype: UnitArchetype;
  quality: UnitQuality;
  sector: BattleSector;
  rank: BattleRank;
  stance: SlotStance;
  rangedDoctrine: RangedDoctrineId;
  maxHp: number;
  currentModels: number;
  currentHp: number;
  currentMorale: number;
  currentStamina: number;
  currentAmmo: number;
  status: SlotStatusId;
  action: SlotActionId;
  targetSlotId: BattleSlotId | null;
  flankExposed: boolean;
  temporaryAdvantage: boolean;
  chargeCooldown: number;
}

export interface ArmyRuntimeState {
  side: BattleSide;
  general: GeneralLoadout;
  plan: ArmyPlanId;
  retreatIssued: boolean;
  retreatTurnsRemaining: number;
  commandPoints: number;
  bankedCommandPoints: number;
  startingPower: number;
}

export interface CombatEvent {
  id: string;
  turn: number;
  type: CombatEventType;
  side: BattleSide;
  slotId: BattleSlotId | null;
  targetSlotId: BattleSlotId | null;
  message: string;
}

export interface TurnResolution {
  turn: number;
  events: CombatEvent[];
  warnings: string[];
  slots: SlotRuntimeState[];
}

export interface BattleSummary {
  result: BattleResultId;
  endReason: BattleEndReasonId;
  totalTurns: number;
  winner: BattleSide | 'draw';
  playerGeneralOutcome: GeneralOutcomeId;
  enemyGeneralOutcome: GeneralOutcomeId;
  playerRemainingPower: number;
  enemyRemainingPower: number;
}

export interface BattleRuntimeState {
  seed: string;
  turn: number;
  randomState: number;
  softEndTurn: number;
  hardEndTurn: number;
  finished: boolean;
  playerArmy: ArmyRuntimeState;
  enemyArmy: ArmyRuntimeState;
  slots: SlotRuntimeState[];
  history: TurnResolution[];
  summary: BattleSummary | null;
}
