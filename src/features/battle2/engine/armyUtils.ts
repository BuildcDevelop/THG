import { BATTLE_SLOT_ORDER } from './constants';
import type {
  ArmyDefinition,
  ArmySlotLoadout,
  BattleSide,
  GeneralLoadout,
  SlotStance,
  UnitTemplate,
} from './types';

const DEFAULT_STANCE: SlotStance = 'balanced';

export const createEmptyArmySlots = (): ArmySlotLoadout[] =>
  BATTLE_SLOT_ORDER.map((slotId) => ({
    slotId,
    templateId: null,
    stance: DEFAULT_STANCE,
    rangedDoctrine: 'auto',
  }));

export const normalizeArmySlots = (slots: ArmySlotLoadout[]): ArmySlotLoadout[] => {
  const bySlotId = new Map(slots.map((slot) => [slot.slotId, slot]));
  return BATTLE_SLOT_ORDER.map((slotId) => {
    const existing = bySlotId.get(slotId);
    return (
      existing ?? {
        slotId,
        templateId: null,
        stance: DEFAULT_STANCE,
        rangedDoctrine: 'auto',
      }
    );
  });
};

export const countPerkPoints = (general: GeneralLoadout): number =>
  Object.values(general.perkPoints).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value ?? 0))), 0);

export const createArmyDefinition = (
  side: BattleSide,
  general: GeneralLoadout,
  plan: ArmyDefinition['plan'],
  slots: ArmySlotLoadout[],
): ArmyDefinition => ({
  side,
  general,
  plan,
  slots: normalizeArmySlots(slots),
});

export const indexUnitTemplates = (templates: UnitTemplate[]) =>
  Object.fromEntries(templates.map((template) => [template.id, template])) as Record<string, UnitTemplate>;
