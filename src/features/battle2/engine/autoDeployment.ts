import { createEmptyArmySlots } from './armyUtils';
import { BATTLE_SLOT_ORDER } from './constants';
import type { ArmySlotLoadout, BattleSlotId, UnitArchetype, UnitTemplate } from './types';

const AUTO_DEPLOYMENT_PRIORITY: Record<UnitArchetype, BattleSlotId[]> = {
  infantry: [
    'center_front',
    'left_front',
    'right_front',
    'center_main',
    'left_main',
    'right_main',
    'center_reserve',
    'left_reserve',
    'right_reserve',
  ],
  cavalry: [
    'left_reserve',
    'right_reserve',
    'left_front',
    'right_front',
    'center_reserve',
    'left_main',
    'right_main',
    'center_main',
    'center_front',
  ],
  archer: [
    'left_main',
    'right_main',
    'center_main',
    'left_reserve',
    'right_reserve',
    'center_reserve',
    'left_front',
    'right_front',
    'center_front',
  ],
};

interface DeployableUnit {
  sourceIndex: number;
  slot: ArmySlotLoadout;
  template: UnitTemplate;
}

const calculateDeploymentScore = (unit: DeployableUnit): number => {
  const { template } = unit;
  const durabilityScore = template.modelCount * template.hpPerModel * 0.03;

  switch (template.archetype) {
    case 'archer':
      return (
        template.rangedAttack * 6 +
        template.ammunition * 2 +
        template.morale * 1.2 +
        template.discipline +
        template.bleed * 3 +
        durabilityScore
      );
    case 'cavalry':
      return (
        template.impact * 6 +
        template.penetrationPct * 1.5 +
        template.meleeAttack * 3 +
        template.morale * 1.3 +
        template.discipline +
        template.massive * 4 +
        template.staminaRecovery * 3 +
        durabilityScore
      );
    default:
      return (
        template.meleeAttack * 3 +
        template.meleeDefense * 3 +
        template.resilience * 4 +
        template.morale * 1.4 +
        template.discipline +
        template.impact * 2 +
        template.antiCavalry * 2 +
        template.physicalResistancePct +
        durabilityScore
      );
  }
};

const sortDeployableUnits = (units: DeployableUnit[]): DeployableUnit[] =>
  [...units].sort((left, right) => {
    const scoreDifference = calculateDeploymentScore(right) - calculateDeploymentScore(left);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }
    return left.sourceIndex - right.sourceIndex;
  });

const getSlotById = (slots: ArmySlotLoadout[], slotId: BattleSlotId): ArmySlotLoadout | undefined =>
  slots.find((slot) => slot.slotId === slotId);

export const createAutoDeploymentSlots = (
  slots: ArmySlotLoadout[],
  templatesById: Record<string, UnitTemplate>,
): ArmySlotLoadout[] => {
  const deployedSlots = createEmptyArmySlots();
  const occupiedSlotIds = new Set<BattleSlotId>();
  const units = slots.flatMap<DeployableUnit>((slot, sourceIndex) => {
    if (!slot.templateId) {
      return [];
    }

    const template = templatesById[slot.templateId];
    if (!template) {
      return [];
    }

    return [{ sourceIndex, slot, template }];
  });

  for (const archetype of ['infantry', 'cavalry', 'archer'] as const) {
    const groupedUnits = sortDeployableUnits(units.filter((unit) => unit.template.archetype === archetype));
    for (const unit of groupedUnits) {
      const nextSlotId = AUTO_DEPLOYMENT_PRIORITY[archetype].find((slotId) => !occupiedSlotIds.has(slotId));
      if (!nextSlotId) {
        continue;
      }

      const targetSlot = getSlotById(deployedSlots, nextSlotId);
      if (!targetSlot) {
        continue;
      }

      targetSlot.templateId = unit.slot.templateId;
      targetSlot.stance = unit.slot.stance;
      targetSlot.rangedDoctrine = unit.slot.rangedDoctrine;
      occupiedSlotIds.add(nextSlotId);
    }
  }

  return deployedSlots;
};

export const countDeploymentDifferences = (current: ArmySlotLoadout[], next: ArmySlotLoadout[]): number =>
  BATTLE_SLOT_ORDER.reduce((differenceCount, slotId) => {
    const currentSlot = getSlotById(current, slotId);
    const nextSlot = getSlotById(next, slotId);

    if (
      currentSlot?.templateId !== nextSlot?.templateId ||
      currentSlot?.stance !== nextSlot?.stance ||
      currentSlot?.rangedDoctrine !== nextSlot?.rangedDoctrine
    ) {
      return differenceCount + 1;
    }

    return differenceCount;
  }, 0);

export const countFrontlineArchers = (
  slots: ArmySlotLoadout[],
  templatesById: Record<string, UnitTemplate>,
): number =>
  slots.reduce((archerCount, slot) => {
    if (!slot.slotId.endsWith('_front') || !slot.templateId) {
      return archerCount;
    }

    return templatesById[slot.templateId]?.archetype === 'archer' ? archerCount + 1 : archerCount;
  }, 0);
