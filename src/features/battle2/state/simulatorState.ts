import type { BattleSimulatorStateShape } from '../engine/contracts';

export const createInitialBattleSimulatorState = (): BattleSimulatorStateShape => ({
  seed: null,
  availableTemplates: [],
  playerSlots: [],
  enemySlots: [],
  battleStarted: false,
  battleFinished: false,
  paused: false,
  currentTurn: 0,
  frames: [],
  summary: null,
});
