import type {
  ArmyDefinition,
  ArmySlotLoadout,
  BattleRuntimeState,
  BattleScenarioSeed,
  BattleSummary,
  CombatEvent,
  TurnResolution,
  UnitTemplate,
} from './types';

export interface EnemyTemplateDefinition {
  id: string;
  label: string;
  description: string;
  preferredQualities: string[];
  preferredArchetypes: string[];
}

export interface BattleSetupInput {
  playerArmy: ArmyDefinition;
  enemySeed: BattleScenarioSeed;
  availableUnitTemplates: UnitTemplate[];
}

export interface BattleSetupOutput {
  playerArmy: ArmyDefinition;
  enemyArmy: ArmyDefinition;
  seed: string;
}

export interface BattleResetSnapshot {
  setup: BattleSetupOutput;
  initialTurn: number;
}

export interface BattleEngineFrame {
  turn: number;
  events: CombatEvent[];
  warnings: string[];
}

export interface BattleRunResult {
  finalState: BattleRuntimeState;
  turns: TurnResolution[];
  summary: BattleSummary;
}

export interface BattleSimulatorStateShape {
  seed: string | null;
  availableTemplates: UnitTemplate[];
  playerSlots: ArmySlotLoadout[];
  enemySlots: ArmySlotLoadout[];
  battleStarted: boolean;
  battleFinished: boolean;
  paused: boolean;
  currentTurn: number;
  frames: BattleEngineFrame[];
  summary: BattleSummary | null;
}
