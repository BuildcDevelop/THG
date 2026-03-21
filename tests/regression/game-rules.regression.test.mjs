import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  calculateMintThroughputPerHour,
  calculatePopulationCap,
  calculateProductionPerHour,
  calculateRecruitmentTimeReductionPct,
  calculateResourceCap,
  calculateTownhallBuildTimeReductionPct,
  convertLegacyBuildingLevelToCurrent,
  convertLegacyResourceBuildingLevelToCurrent,
  getMaxBuildingLevel,
} from '../../server/gameConfig.js';

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
  const lootModifier = Math.max(0, Number(result.lootModifier ?? 1));
  const expectedLoot = Math.floor(20 * lootModifier);
  assert.equal(Number(result.attackerStart?.militia ?? 0), 1);
  assert.equal(Number(result.attackerStart?.scout ?? 0), 5);
  assert.equal(Number(result.attackerSurvivors?.scout ?? 0), 5);
  assert.equal(Number(result.totalLoot ?? 0), expectedLoot);
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
  const lootModifier = Math.max(0, Number(result.lootModifier ?? 1));
  const expectedLoot = Math.floor((20 + 16 + 80 + 250) * lootModifier);
  assert.equal(Number(result.totalLoot ?? 0), expectedLoot);
});

test('attack defaults to balanced loot priority', () => {
  const result = runScenario('default-balanced-loot-priority');
  const lootModifier = Math.max(0, Number(result.lootModifier ?? 1));
  const expectedLoot = Math.floor(40 * lootModifier);
  assert.equal(String(result.reportedLootPriority ?? ''), 'balanced');
  assert.equal(Number(result.totalLoot ?? 0), expectedLoot);
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

test('village conquest has no hard cap per world', () => {
  const result = runScenario('world-village-limit');
  assert.ok(Number(result.primaryCount ?? 0) >= 6);
  assert.equal(String(result.firstConquest?.newOwner ?? ''), 'Hayato');
  assert.equal(Number(result.fireCountAfterSuccess ?? 0), 2);
  assert.equal(Number(result.fireCountBeforeBlockedAttempt ?? 0), 6);
  assert.equal(String(result.secondConquest?.newOwner ?? ''), 'Hayato');
  assert.equal(Number(result.fireCountAfterSecondAttempt ?? 0), 7);
  assert.equal(result.blockedError, null);
});

test('large attacking army is not excessively punished', () => {
  const result = runScenario('large-army-balance');
  assert.equal(result.attackerWins, true);
  assert.ok(Number(result.attackerLossRatio ?? 1) < 0.2);
  assert.ok(Number(result.defenderLossRatio ?? 0) >= 0.8);
});

test('prestige protection unlocks retaliation after smaller attack', () => {
  const result = runScenario('prestige-retaliation-unlock');
  assert.match(String(result.blockedBeforeRetaliation ?? ''), /balanc prestize blokuje utok/i);
  assert.ok(Number(result.smallerAttackOrderId ?? 0) > 0);
  assert.ok(Number(result.retaliationAttackOrderId ?? 0) > 0);
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

test('stage6: summary endpoints stay consistent and payload is materially smaller', () => {
  const result = runScenario('summary-polling-consistency');
  const reports = result?.reports ?? {};
  const activity = result?.activity ?? {};

  assert.ok(Number(reports.fullTotal ?? 0) >= 1);
  assert.equal(Number(reports.summaryTotal ?? -1), Number(reports.fullTotal ?? -2));
  assert.ok(Number(reports.summaryPayloadBytes ?? Infinity) < Number(reports.fullPayloadBytes ?? 0));
  assert.ok(
    Number(reports.summaryPayloadBytes ?? Infinity) <= Number(reports.fullPayloadBytes ?? 0) * 0.25,
    'reports summary payload should stay under 25% of full payload',
  );

  assert.equal(Number(activity.summaryUnreadTotal ?? -1), Number(activity.fullUnreadTotal ?? -2));
  assert.equal(Number(activity.summaryAttentionTotal ?? -1), Number(activity.fullAttentionTotal ?? -2));
  assert.ok(Number(activity.summaryUnreadFeedSize ?? 0) <= Number(activity.fullUnreadFeedSize ?? 0));
  assert.ok(Number(activity.summaryPayloadBytes ?? Infinity) < Number(activity.fullPayloadBytes ?? 0));
  assert.ok(
    Number(activity.summaryPayloadBytes ?? Infinity) <= Number(activity.fullPayloadBytes ?? 0) * 0.5,
    'activity summary payload should stay under 50% of full payload',
  );
});

test('battle report detail lookup returns the same report and respects world scoping', () => {
  const result = runScenario('battle-report-detail-lookup');

  assert.ok(Number(result.listedTotal ?? 0) >= 1);
  assert.ok(Number(result.listedReportId ?? 0) > 0);
  assert.equal(Number(result.detailReportId ?? -1), Number(result.listedReportId ?? -2));
  assert.equal(String(result.detailOutcome ?? ''), String(result.attackOutcome ?? ''));
  assert.match(String(result.foreignWorldMessage ?? ''), /report nebyl nalezen/i);
});

test('stage6: read models do not progress queued work without explicit tick', () => {
  const result = runScenario('read-models-no-tick-side-effects');
  const beforeRead = result?.beforeRead ?? {};
  const afterRead = result?.afterRead ?? {};
  const afterTick = result?.afterTick ?? {};

  assert.ok(Number(result?.recruitmentOrderId ?? 0) > 0);
  assert.equal(Number(beforeRead.militia ?? -1), 0);
  assert.equal(Number(beforeRead.inProgressRecruitments ?? -1), 1);
  assert.equal(Number(afterRead.militia ?? -1), Number(beforeRead.militia ?? -2));
  assert.equal(
    Number(afterRead.inProgressRecruitments ?? -1),
    Number(beforeRead.inProgressRecruitments ?? -2),
  );
  assert.equal(Number(afterTick.militia ?? -1), 1);
  assert.equal(Number(afterTick.inProgressRecruitments ?? -1), 0);
});

test('stage6: mint coins accumulate across short tick intervals', () => {
  const result = runScenario('mint-coins-accumulate-short-ticks');
  const before = result?.before ?? {};
  const storedAfterRead = result?.storedAfterRead ?? {};
  const snapshot = result?.snapshot ?? {};

  assert.ok(Number(snapshot.mintCoinsPerHour ?? 0) > 0, 'mint throughput should be active');
  assert.ok(Number(snapshot.coins ?? 0) > Number(before.coins ?? 0), 'visible coins should increase over repeated short ticks');
  assert.ok(Number(snapshot.gold ?? 0) < Number(before.gold ?? Infinity), 'visible gold should be converted into coins');
  assert.ok(Number(snapshot.coins ?? 0) >= 1, 'visible coin balance should eventually rise above zero');
  assert.equal(
    Number(storedAfterRead.coins ?? -1),
    Number(before.coins ?? -2),
    'read-only snapshot should not persist coins back into storage',
  );
});

test('economy: resource production curves use integer hourly values on 10 levels', () => {
  assert.equal(getMaxBuildingLevel('woodcutter'), 10);
  assert.equal(getMaxBuildingLevel('quarry'), 10);
  assert.equal(getMaxBuildingLevel('iron-mine'), 10);

  const expectedWood = [50, 80, 127, 204, 326, 522, 834, 1336, 2139, 3424];
  const expectedStone = [38, 60, 96, 154, 246, 394, 631, 1009, 1615, 2587];
  const expectedIron = [31, 50, 80, 127, 203, 325, 520, 831, 1330, 2130];
  const expectedGold = [1, 2, 4, 7, 11, 15, 21, 27, 34, 42];

  for (let level = 1; level <= 10; level += 1) {
    assert.equal(
      Number(calculateProductionPerHour({ woodcutter: level }, 0, 999999).wood ?? -1),
      expectedWood[level - 1],
      `woodcutter L${level} production mismatch`,
    );
    assert.equal(
      Number(calculateProductionPerHour({ quarry: level }, 0, 999999).stone ?? -1),
      expectedStone[level - 1],
      `quarry L${level} production mismatch`,
    );
    assert.equal(
      Number(calculateProductionPerHour({ 'iron-mine': level }, 0, 999999).iron ?? -1),
      expectedIron[level - 1],
      `iron-mine L${level} production mismatch`,
    );
    assert.equal(
      Number(calculateProductionPerHour({ 'gold-mine': level }, 0, 999999).gold ?? -1),
      expectedGold[level - 1],
      `gold-mine L${level} production mismatch`,
    );
  }
});

test('economy: rebalance max levels and cap curves match the compressed design', () => {
  assert.equal(getMaxBuildingLevel('warehouse'), 10);
  assert.equal(getMaxBuildingLevel('townhall'), 10);
  assert.equal(getMaxBuildingLevel('residential-quarter'), 10);
  assert.equal(getMaxBuildingLevel('barracks'), 10);
  assert.equal(getMaxBuildingLevel('stable'), 10);
  assert.equal(getMaxBuildingLevel('workshop'), 5);

  const expectedWarehouseCaps = [3000, 8000, 18000, 35000, 60000, 95000, 140000, 195000, 245000, 300000];
  const expectedPopulationCaps = [500, 900, 1450, 2150, 3050, 4200, 5600, 7200, 8900, 10000];
  for (let level = 1; level <= 10; level += 1) {
    assert.equal(calculateResourceCap(level), expectedWarehouseCaps[level - 1], `warehouse L${level} cap mismatch`);
    assert.equal(
      calculatePopulationCap(level),
      expectedPopulationCaps[level - 1],
      `residential-quarter L${level} population mismatch`,
    );
  }
});

test('economy: integer speed and mint throughput curves match rebalance targets', () => {
  const expectedTownhall = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const expectedBarracks = [5, 10, 16, 22, 28, 33, 38, 42, 46, 50];
  const expectedStable = [4, 8, 13, 18, 23, 28, 33, 37, 41, 45];
  const expectedWorkshop = [6, 12, 18, 24, 30];

  for (let level = 1; level <= 10; level += 1) {
    assert.equal(
      calculateTownhallBuildTimeReductionPct(level),
      expectedTownhall[level - 1],
      `townhall L${level} reduction mismatch`,
    );
    assert.equal(
      calculateRecruitmentTimeReductionPct('barracks', level),
      expectedBarracks[level - 1],
      `barracks L${level} reduction mismatch`,
    );
    assert.equal(
      calculateRecruitmentTimeReductionPct('stable', level),
      expectedStable[level - 1],
      `stable L${level} reduction mismatch`,
    );
    if (level <= 5) {
      assert.equal(
        calculateRecruitmentTimeReductionPct('workshop', level),
        expectedWorkshop[level - 1],
        `workshop L${level} reduction mismatch`,
      );
    }
  }

  assert.equal(calculateMintThroughputPerHour(1), 6);
  assert.equal(calculateMintThroughputPerHour(2), 11);
  assert.equal(calculateMintThroughputPerHour(3), 21);
});

test('economy: legacy resource levels remap onto the 10-level scale without dropping endpoints', () => {
  assert.equal(convertLegacyResourceBuildingLevelToCurrent('woodcutter', 0), 0);
  assert.equal(convertLegacyResourceBuildingLevelToCurrent('woodcutter', 1), 1);
  assert.equal(convertLegacyResourceBuildingLevelToCurrent('woodcutter', 5), 5);
  assert.equal(convertLegacyResourceBuildingLevelToCurrent('woodcutter', 10), 7);
  assert.equal(convertLegacyResourceBuildingLevelToCurrent('woodcutter', 30), 10);
});

test('economy: legacy non-resource building ladders remap to compressed levels', () => {
  assert.equal(convertLegacyBuildingLevelToCurrent('warehouse', 1), 1);
  assert.equal(convertLegacyBuildingLevelToCurrent('warehouse', 25), 10);
  assert.equal(convertLegacyBuildingLevelToCurrent('townhall', 12), 10);
  assert.equal(convertLegacyBuildingLevelToCurrent('barracks', 16), 10);
  assert.equal(convertLegacyBuildingLevelToCurrent('stable', 14), 10);
  assert.equal(convertLegacyBuildingLevelToCurrent('workshop', 7), 5);
  assert.equal(convertLegacyBuildingLevelToCurrent('residential-quarter', 20), 6);
});

test('economy: level 1 gold mine yields visible integer income after hourly sync', () => {
  const result = runScenario('gold-mine-integer-production-tick');
  assert.equal(Number(result.productionPerHour ?? -1), 1);
  assert.ok(Number(result.visibleGold ?? 0) >= Number(result.beforeGold ?? 0) + 1);
});

test('economy: over-cap resources are preserved and passive production pauses', () => {
  const result = runScenario('resource-overflow-preserved-on-tick');
  assert.ok(Number(result.cap ?? 0) > 0);
  assert.ok(Number(result.beforeWood ?? 0) > Number(result.cap ?? 0), 'scenario must start above resource cap');
  assert.equal(
    Number(result.storedWood ?? -1),
    Number(result.beforeWood ?? -2),
    'overflow wood should be preserved without clamp-down',
  );
  assert.equal(Boolean(result.overflowAny), true);
  assert.equal(Boolean(result.overflowWood), true);
});

test('economy: population overflow does not dissolve units during sync', () => {
  const result = runScenario('population-overflow-no-unit-cleanup');
  assert.ok(Number(result.populationCap ?? 0) > 0);
  assert.ok(Number(result.beforeMilitia ?? 0) > 0);
  assert.equal(
    Number(result.afterMilitia ?? -1),
    Number(result.beforeMilitia ?? -2),
    'sync must not dissolve militia due to temporary overflow state',
  );
  assert.equal(Boolean(result.populationOverflowAny), true);
  assert.ok(Number(result.populationOverflowAmount ?? 0) > 0);
});

test('economy: research pays from selected active village and rejects invalid villageId', () => {
  const result = runScenario('research-active-village-payment');

  assert.match(
    String(result.invalidVillageError ?? ''),
    /(aktivni leno nebylo nalezeno|villageid musi byt kladne cislo)/i,
  );
  assert.equal(
    Number(result.primaryCoinsAfter ?? -1),
    Number(result.primaryCoinsBefore ?? -2),
    'primary village coins should stay unchanged when research runs from a different active village',
  );
  assert.ok(
    Number(result.secondaryCoinsAfter ?? Infinity) < Number(result.secondaryCoinsBefore ?? 0),
    'selected active village should pay both academics and research coin costs',
  );
  assert.equal(
    Number(result.secondaryCoinsBefore ?? 0) - Number(result.secondaryCoinsAfter ?? 0),
    Number(result.hiredCoinCost ?? 0) + Number(result.researchCoinCostPaid ?? 0),
  );
  assert.equal(Number(result.researchCoinCostPaid ?? -1), 100);
});

test('economy: market logistics supports gold/coins for send, cancel refund and delivery', () => {
  const result = runScenario('market-logistics-gold-coins-flow');
  const shipment = result?.shipment ?? {};
  const sourceBefore = result?.sourceBefore ?? {};
  const sourceAfterSend = result?.sourceAfterSend ?? {};
  const sourceAfterCancel = result?.sourceAfterCancel ?? {};
  const targetAfterDelivery = result?.targetAfterDelivery ?? {};
  const canceledRefunded = result?.canceledRefunded ?? {};
  const deliveredRoute = result?.deliveredRoute ?? {};

  assert.match(
    String(result.invalidVillageError ?? ''),
    /(aktivni leno nebylo nalezeno|villageid musi byt kladne cislo)/i,
  );
  for (const resourceId of ['wood', 'stone', 'iron', 'gold', 'coins']) {
    assert.equal(
      Number(sourceBefore?.[resourceId] ?? 0) - Number(sourceAfterSend?.[resourceId] ?? 0),
      Number(shipment?.[resourceId] ?? -1),
      `source spend mismatch for ${resourceId}`,
    );
    assert.ok(
      Math.abs(Number(sourceAfterCancel?.[resourceId] ?? 0) - Number(sourceBefore?.[resourceId] ?? 0)) <= 0.01,
      `cancel refund should fully restore ${resourceId}`,
    );
    assert.equal(
      Number(canceledRefunded?.[resourceId] ?? -1),
      Number(shipment?.[resourceId] ?? -2),
      `cancel API refunded mismatch for ${resourceId}`,
    );
    assert.ok(
      Math.abs(Number(targetAfterDelivery?.[resourceId] ?? 0) - Number(shipment?.[resourceId] ?? 0)) <= 0.1,
      `delivery mismatch for ${resourceId}`,
    );
    assert.equal(
      Number(deliveredRoute?.[resourceId] ?? -1),
      Number(shipment?.[resourceId] ?? -2),
      `recent logistics route payload mismatch for ${resourceId}`,
    );
  }
});

test('combat: attacker/defender/supporter formulas and loot leaderboard aggregation stay consistent', () => {
  const result = runScenario('combat-loot-leaderboard-aggregation');
  const battle = result?.battle ?? {};
  const leaderboard = result?.leaderboard ?? {};

  const expectedAttackerScore = Number(battle.attackerLosses ?? 0) + Number(battle.defenderLosses ?? 0);
  const expectedDefenderScore = Number(battle.attackerLosses ?? 0) + Number(battle.defenderLosses ?? 0);
  const expectedSupporterScore = Number(battle.attackerLosses ?? 0) + Number(battle.supportLosses ?? 0);

  assert.equal(Boolean(battle.attackerWins), true);
  assert.equal(Number(leaderboard?.attacker?.attackerScore ?? -1), expectedAttackerScore);
  assert.equal(Number(leaderboard?.defender?.defenderScore ?? -1), expectedDefenderScore);
  assert.equal(Number(leaderboard?.supporter?.supporterScore ?? -1), expectedSupporterScore);
  assert.equal(Number(leaderboard?.attacker?.lootScore ?? -1), Number(result?.lootTotal ?? -2));
  assert.ok(Number(result?.lootTaken?.gold ?? 0) + Number(result?.lootTaken?.coins ?? 0) > 0);
  assert.ok(Number(leaderboard?.attacker?.lootRank ?? 0) >= 1);
});

test('stage6: map stress culls render scope in dense settlements', () => {
  const result = runScenario('map-render-scope-stress');
  const totalSettlements = Number(result?.totalSettlements ?? 0);
  const renderedSettlements = Number(result?.renderedSettlements ?? 0);
  const renderedRatio = Number(result?.renderedRatio ?? 1);

  assert.ok(totalSettlements >= 120, 'stress scenario should have dense settlement count');
  assert.ok(renderedSettlements > 0);
  assert.ok(renderedSettlements < totalSettlements);
  assert.ok(renderedRatio <= 0.65, 'viewport culling should cap rendered scope to 65% or less');
  assert.ok(Number(result?.mapPayloadBytes ?? 0) > 0);
});
