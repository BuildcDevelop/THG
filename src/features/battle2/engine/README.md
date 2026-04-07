`battle2/engine` is the isolated simulation layer for the battlefield prototype.

Rules:
- `simCore.ts` is the public orchestration entrypoint.
- UI may call `createBattleRuntime`, `stepBattle`, and `runBattle`, but should not embed combat math.
- `enemyGenerator.ts` creates valid enemy setups and stays independent from React.
- `runtime.ts`, `planning.ts`, and `combatMath.ts` stay pure and deterministic from `(setup, seed)`.
- Do not import current game runtime, polling, `gameApi`, or `GamePage` here.

Current public flow:
1. Build player army definition.
2. Generate enemy army through `createBattleSetup`.
3. Start runtime through `createBattleRuntime`.
4. Advance with `stepBattle` or auto-resolve with `runBattle`.
