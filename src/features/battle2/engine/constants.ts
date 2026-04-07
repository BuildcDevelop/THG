import type {
  ArmyPlanId,
  BattleRank,
  BattleSector,
  BattleSlotId,
  GeneralPerkId,
  RangedDoctrineId,
  SlotActionId,
  SlotStatusId,
  SlotStance,
} from './types';

export const BATTLE_SLOT_ORDER: BattleSlotId[] = [
  'left_front',
  'center_front',
  'right_front',
  'left_main',
  'center_main',
  'right_main',
  'left_reserve',
  'center_reserve',
  'right_reserve',
];

export const BATTLE_SECTOR_ORDER: BattleSector[] = ['left', 'center', 'right'];

export const BATTLE_RANK_ORDER: BattleRank[] = ['front', 'main', 'reserve'];

export const SLOT_STANCE_OPTIONS: SlotStance[] = ['aggressive', 'balanced', 'defensive'];

export const SLOT_ACTION_OPTIONS: SlotActionId[] = [
  'hold',
  'advance',
  'brace',
  'volley',
  'focus_fire',
  'charge',
  'withdraw',
  're_form',
];

export const SLOT_STATUS_ORDER: SlotStatusId[] = [
  'ready',
  'engaged',
  'shaken',
  'broken',
  'routing',
  'withdrawn',
  'destroyed',
];

export const ARMY_PLAN_OPTIONS: ArmyPlanId[] = ['standard', 'pressure', 'hold_line', 'full_retreat'];

export const RANGED_DOCTRINE_OPTIONS: RangedDoctrineId[] = [
  'counter_archers',
  'support_center',
  'finish_broken',
  'auto',
];

export const GENERAL_PERK_OPTIONS: GeneralPerkId[] = ['sapper', 'pavise', 'wedge', 'ranger', 'levy_training'];

export const DEFAULT_TURN_DURATION_SEC = 12;
export const DEFAULT_COMMAND_POINTS_PER_TURN = 1;
export const DEFAULT_MAX_BANKED_COMMAND_POINTS = 2;
export const DEFAULT_BATTLE_HARD_TURN_LIMIT = 16;
export const DEFAULT_BATTLE_SOFT_END_START_TURN = 4;
