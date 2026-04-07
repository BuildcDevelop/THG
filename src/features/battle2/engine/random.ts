export const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const nextRandomState = (state: number): number => {
  let next = state >>> 0;
  next = (next + 0x6d2b79f5) >>> 0;
  let temp = Math.imul(next ^ (next >>> 15), 1 | next);
  temp ^= temp + Math.imul(temp ^ (temp >>> 7), 61 | temp);
  return (temp ^ (temp >>> 14)) >>> 0;
};

export const randomFloatFromState = (state: number): number => {
  return (state >>> 0) / 4294967296;
};

export const rollRandom = (state: number) => {
  const nextState = nextRandomState(state);
  return {
    state: nextState,
    value: randomFloatFromState(nextState),
  };
};

export const randomInt = (state: number, maxExclusive: number) => {
  if (maxExclusive <= 1) {
    return {
      state,
      value: 0,
    };
  }

  const rolled = rollRandom(state);
  return {
    state: rolled.state,
    value: Math.min(maxExclusive - 1, Math.floor(rolled.value * maxExclusive)),
  };
};
