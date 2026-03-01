import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../..');
const scenarioRunnerPath = path.join(repoRoot, 'tests', 'regression', 'game-rules.scenario.mjs');

const runScenario = (scenarioName) => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-regression-'));
  const env = {
    ...process.env,
    TLD_DATA_DIR: tempDataDir,
  };

  try {
    const run = spawnSync(process.execPath, [scenarioRunnerPath, String(scenarioName)], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
    });

    if (run.status !== 0) {
      const details = [
        `Scenario '${scenarioName}' failed.`,
        `Exit code: ${run.status ?? 'null'}`,
        `stdout:\n${run.stdout ?? ''}`,
        `stderr:\n${run.stderr ?? ''}`,
      ].join('\n');
      throw new Error(details);
    }

    const stdout = String(run.stdout ?? '').trim();
    const outputLine = stdout.split(/\r?\n/).filter(Boolean).at(-1);
    if (!outputLine) {
      throw new Error(`Scenario '${scenarioName}' produced no JSON output.`);
    }

    return JSON.parse(outputLine);
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
};

test('empty fortified village has no attacker losses', () => {
  const result = runScenario('empty-fortified-no-loss');
  assert.equal(result.blockedByGate, true);
  assert.equal(result.attackerLossesTotal, 0);
  assert.equal(Number(result.returnUnits?.militia ?? 0), 30);
  assert.equal(Number(result.returnUnits?.caravan ?? 0), 2);
});

test('ram destroys one gate level and is consumed', () => {
  const result = runScenario('ram-breaks-gate');
  assert.equal(result.attackerWins, true);
  assert.equal(Number(result.gate?.damagedLevels ?? 0), 1);
  assert.equal(Number(result.gate?.ramsConsumed ?? 0), 1);
  assert.equal(Number(result.gateLevelAfter ?? -1), 0);
  assert.equal(Number(result.attackerSurvivors?.ram ?? -1), 0);
  assert.equal(Number(result.returnUnits?.ram ?? -1), 0);
});

test('mixed scout attacks are allowed and scout does not loot', () => {
  const result = runScenario('mixed-scout-attack-loot');
  assert.equal(Number(result.attackerStart?.militia ?? 0), 1);
  assert.equal(Number(result.attackerStart?.scout ?? 0), 5);
  assert.equal(Number(result.attackerSurvivors?.scout ?? 0), 5);
  assert.equal(Number(result.totalLoot ?? 0), 20);
});

test('scouts can be combined with every unit in attack command', () => {
  const result = runScenario('scout-combo-attack-matrix');
  const combos = Array.isArray(result.combos) ? result.combos : [];
  assert.equal(combos.length, 6);

  for (const combo of combos) {
    assert.equal(Boolean(combo.orderAccepted), true, `scout + ${combo.unitId} should be accepted`);
    assert.equal(Number(combo.sentScout ?? 0), 5, `scout + ${combo.unitId} should send scouts`);
    assert.equal(Number(combo.sentPartner ?? 0), 3, `scout + ${combo.unitId} should send partner unit`);
  }

  assert.equal(Boolean(result.scoutOnly?.isSpy), true);
  assert.equal(Number(result.scoutOnly?.sentScout ?? 0), 7);
});

test('loot capacity includes non-scout non-ram units', () => {
  const result = runScenario('loot-capacity-all-units');
  assert.equal(Number(result.totalLoot ?? 0), 366);
});

test('attack defaults to balanced loot priority', () => {
  const result = runScenario('default-balanced-loot-priority');
  assert.equal(String(result.reportedLootPriority ?? ''), 'balanced');
  assert.equal(Number(result.totalLoot ?? 0), 40);
  assert.ok(Number(result.lootSpread ?? 999) <= 1);
});

test('caravans follow binary casualty rule based on combat survivors', () => {
  const result = runScenario('caravan-binary-casualties');
  const survivorCase = result.survivorCase ?? {};
  const wipedCase = result.wipedCase ?? {};

  assert.equal(Boolean(survivorCase.attackerWins), true);
  assert.ok(Number(survivorCase.survivingCombatUnits ?? 0) > 0);
  assert.equal(
    Number(survivorCase.survivingCaravans ?? -1),
    Number(survivorCase.sentCaravans ?? -2),
  );

  assert.ok(Number(wipedCase.survivingCombatUnits ?? 1) === 0);
  assert.equal(Number(wipedCase.survivingCaravans ?? -1), 0);
});

test('scout-only attack vs defender without scouts has zero scout losses', () => {
  const result = runScenario('scout-only-no-defender-scouts');
  assert.equal(Boolean(result.isSpyReport), true);
  assert.equal(Number(result.defenderScouts ?? -1), 0);
  assert.equal(Number(result.scoutLosses ?? -1), 0);
  assert.equal(Number(result.scoutSurvivors ?? -1), Number(result.scoutStart ?? -2));
  assert.equal(Boolean(result.success), true);
});

test('loot capacity uses units that actually return after conquest', () => {
  const result = runScenario('conquest-knight-loot-capacity');
  assert.equal(Boolean(result.conquest?.conquered), true);
  assert.equal(Boolean(result.conquest?.knightConsumed), true);
  assert.equal(result.returnMovement, null);
  assert.equal(Number(result.totalLoot ?? -1), 0);
});

test('village limit is enforced per world with cap 6', () => {
  const result = runScenario('world-village-limit');
  assert.equal(Number(result.maxPlayerVillages ?? 0), 6);
  assert.ok(Number(result.primaryCount ?? 0) >= 6);
  assert.equal(String(result.firstConquest?.newOwner ?? ''), 'Hayato');
  assert.equal(Number(result.fireCountAfterSuccess ?? 0), 2);
  assert.equal(Number(result.fireCountBeforeBlockedAttempt ?? 0), 6);
  assert.match(String(result.blockedError ?? ''), /limit 6 osad/i);
});

test('large attacking army is not excessively punished', () => {
  const result = runScenario('large-army-balance');
  assert.equal(result.attackerWins, true);
  assert.ok(Number(result.attackerLossRatio ?? 1) < 0.2);
  assert.ok(Number(result.defenderLossRatio ?? 0) >= 0.8);
});

test('defender knight is removed from village when attacker wins battle', () => {
  const result = runScenario('knight-defender-eliminated-on-victory');
  assert.equal(Boolean(result.attackerWins), true);
  assert.equal(Number(result.reportDefenderKnightStart ?? -1), 1);
  assert.equal(Number(result.reportDefenderKnightLosses ?? -1), 1);
  assert.equal(Number(result.reportDefenderKnightSurvivors ?? -1), 0);
  assert.equal(Number(result.defenderKnightAfter ?? -1), 0);
});

test('communication inbox only exposes own direct threads', () => {
  const result = runScenario('communication-thread-isolation');
  assert.equal(Number(result.foreignThreadId ?? 0) > 0, true);
  assert.deepEqual(Array.isArray(result.leakedUsernames) ? result.leakedUsernames : [], []);
  assert.equal(Boolean(result.blockedForeignThreadAccess), true);
  assert.match(String(result.blockedMessage ?? ''), /konverzace nebyla nalezena/i);
});

test('only one knight can exist or be queued per village at once', () => {
  const result = runScenario('knight-single-slot-per-village');
  assert.ok(Number(result.firstRecruitmentOrderId ?? 0) > 0);
  assert.match(String(result.blockedWithExistingKnight ?? ''), /rytir.*ve vycviku|ryt[ií]r.*osad[ěe]/i);
  assert.match(String(result.blockedWithQueuedKnight ?? ''), /rytir.*ve vycviku|ryt[ií]r.*osad[ěe]/i);
});
