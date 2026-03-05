const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const toSafePrestige = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }
  return Math.max(0, normalized);
};

const DEFENSE_BONUS_POINTS = Object.freeze([
  { ratio: 1, bonus: 0 },
  { ratio: 2, bonus: 0.1 },
  { ratio: 4, bonus: 0.2 },
  { ratio: 6, bonus: 0.25 },
]);

const interpolateDefenseBonus = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= DEFENSE_BONUS_POINTS[0].ratio) {
    return DEFENSE_BONUS_POINTS[0].bonus;
  }
  const lastPoint = DEFENSE_BONUS_POINTS[DEFENSE_BONUS_POINTS.length - 1];
  if (ratio >= lastPoint.ratio) {
    return lastPoint.bonus;
  }

  for (let index = 1; index < DEFENSE_BONUS_POINTS.length; index += 1) {
    const previous = DEFENSE_BONUS_POINTS[index - 1];
    const current = DEFENSE_BONUS_POINTS[index];
    if (ratio > current.ratio) {
      continue;
    }
    const segmentSpan = Math.max(0.0001, current.ratio - previous.ratio);
    const segmentProgress = clampNumber((ratio - previous.ratio) / segmentSpan, 0, 1);
    return previous.bonus + (current.bonus - previous.bonus) * segmentProgress;
  }

  return lastPoint.bonus;
};

export const MIN_ATTACKABLE_PRESTIGE_RATIO = 0.1;
export const MIN_LOOT_MODIFIER = 0.1;

export const isAttackAllowed = (attackerPrestigeRaw, defenderPrestigeRaw) => {
  const attackerPrestige = toSafePrestige(attackerPrestigeRaw);
  const defenderPrestige = toSafePrestige(defenderPrestigeRaw);
  if (attackerPrestige <= 0) {
    return true;
  }
  return defenderPrestige >= attackerPrestige * MIN_ATTACKABLE_PRESTIGE_RATIO;
};

export const calculateAttackModifier = (attackerPrestigeRaw, defenderPrestigeRaw) => {
  const attackerPrestige = toSafePrestige(attackerPrestigeRaw);
  const defenderPrestige = toSafePrestige(defenderPrestigeRaw);
  if (attackerPrestige <= 0 || defenderPrestige <= 0 || defenderPrestige >= attackerPrestige) {
    return 1;
  }
  const powerRatio = attackerPrestige / defenderPrestige;
  return clampNumber(1 / Math.sqrt(powerRatio), 0, 1);
};

export const calculateDefenseBonus = (attackerPrestigeRaw, defenderPrestigeRaw) => {
  const attackerPrestige = toSafePrestige(attackerPrestigeRaw);
  const defenderPrestige = toSafePrestige(defenderPrestigeRaw);
  if (attackerPrestige <= 0 || defenderPrestige <= 0 || defenderPrestige >= attackerPrestige) {
    return 0;
  }
  const ratio = attackerPrestige / defenderPrestige;
  return clampNumber(interpolateDefenseBonus(ratio), 0, 0.25);
};

export const calculateLootModifier = (attackerPrestigeRaw, defenderPrestigeRaw) => {
  const attackerPrestige = toSafePrestige(attackerPrestigeRaw);
  const defenderPrestige = toSafePrestige(defenderPrestigeRaw);
  if (attackerPrestige <= 0 || defenderPrestige >= attackerPrestige) {
    return 1;
  }
  return clampNumber(defenderPrestige / attackerPrestige, MIN_LOOT_MODIFIER, 1);
};

export const resolveCombatBalance = (attackerPrestigeRaw, defenderPrestigeRaw) => {
  const attackerPrestige = toSafePrestige(attackerPrestigeRaw);
  const defenderPrestige = toSafePrestige(defenderPrestigeRaw);
  const powerRatio =
    attackerPrestige > 0 && defenderPrestige > 0 ? attackerPrestige / defenderPrestige : attackerPrestige > 0 ? Number.POSITIVE_INFINITY : 1;
  const attackModifier = calculateAttackModifier(attackerPrestige, defenderPrestige);
  const defenseBonus = calculateDefenseBonus(attackerPrestige, defenderPrestige);
  const lootModifier = calculateLootModifier(attackerPrestige, defenderPrestige);

  return {
    attackerPrestige: Math.floor(attackerPrestige),
    defenderPrestige: Math.floor(defenderPrestige),
    powerRatio: Number.isFinite(powerRatio) ? Number(powerRatio.toFixed(4)) : powerRatio,
    attackAllowed: isAttackAllowed(attackerPrestige, defenderPrestige),
    attackModifier: Number(attackModifier.toFixed(4)),
    defenseBonus: Number(defenseBonus.toFixed(4)),
    defenseMultiplier: Number((1 + defenseBonus).toFixed(4)),
    lootModifier: Number(lootModifier.toFixed(4)),
  };
};
