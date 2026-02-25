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
