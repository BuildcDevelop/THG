import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../..');

test('market guild dispatches to multiple targets in one cycle when resources allow it', () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-market-guild-multi-dispatch-'));
  const env = {
    ...process.env,
    TLD_DATA_DIR: tempDataDir,
    NETLIFY: '1',
  };

  const script = [
    "const RealDate = Date;",
    "const fixedIso = '2026-03-29T10:00:00.000Z';",
    'const fixedMs = RealDate.parse(fixedIso);',
    'class FixedDate extends RealDate {',
    '  constructor(...args) {',
    '    if (args.length <= 0) {',
    '      super(fixedMs);',
    '      return;',
    '    }',
    '    super(...args);',
    '  }',
    '  static now() { return fixedMs; }',
    '  static parse(value) { return RealDate.parse(value); }',
    '  static UTC(...args) { return RealDate.UTC(...args); }',
    '}',
    'globalThis.Date = FixedDate;',
    '',
    "import { createSessionForUsername, SESSION_COOKIE_NAME } from './server/sessionService.js';",
    "const { app } = await import('./server/index.js');",
    "const { db } = await import('./server/db.js');",
    '',
    "const selectPlayerByUsernameStmt = db.prepare('SELECT id FROM players WHERE username = ? COLLATE NOCASE LIMIT 1');",
    "const selectVillageIdsByRegionStmt = db.prepare('SELECT id FROM villages WHERE region = ? ORDER BY id ASC');",
    "const updateVillageOwnerStmt = db.prepare('UPDATE villages SET player_id = ?, kingdom = ?, loyalty = 100 WHERE id = ?');",
    "const upsertBuildingStmt = db.prepare('INSERT INTO buildings (village_id, building_id, level) VALUES (?, ?, ?) ON CONFLICT(village_id, building_id) DO UPDATE SET level = excluded.level');",
    "const upsertResourcePocketStmt = db.prepare('INSERT INTO resources (village_id, wood, stone, iron, gold, coins) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(village_id) DO UPDATE SET wood = excluded.wood, stone = excluded.stone, iron = excluded.iron, gold = excluded.gold, coins = excluded.coins');",
    'const upsertResearchProgressCompletedStmt = db.prepare("INSERT INTO research_progress (player_id, region, research_id, status, progress, assigned_academics, started_at, completed_at, updated_at) VALUES (?, ?, ?, \'completed\', 100, 0, ?, ?, ?) ON CONFLICT(player_id, region, research_id) DO UPDATE SET status = \'completed\', progress = 100, assigned_academics = 0, started_at = excluded.started_at, completed_at = excluded.completed_at, updated_at = excluded.updated_at");',
    "const closeInProgressLogisticsBySourceStmt = db.prepare(\"UPDATE logistics_routes SET status = 'completed', completed_at = ? WHERE source_village_id = ? AND status = 'in_progress'\");",
    "const selectGuildAutoRoutesBySourceStmt = db.prepare(\"SELECT target_village_id AS targetVillageId, wood, stone, iron FROM logistics_routes WHERE source_village_id = ? AND mode = 'guild-auto' AND status = 'in_progress' ORDER BY id ASC\");",
    '',
    'const setVillageBuildings = (villageId, levels) => {',
    '  for (const [buildingId, level] of Object.entries(levels)) {',
    '    upsertBuildingStmt.run(Number(villageId), String(buildingId), Math.max(0, Math.floor(Number(level ?? 0))));',
    '  }',
    '};',
    '',
    'const setVillageResources = (villageId, resources, iso) => {',
    '  upsertResourcePocketStmt.run(',
    '    Number(villageId),',
    '    Number(resources.wood ?? 0),',
    '    Number(resources.stone ?? 0),',
    '    Number(resources.iron ?? 0),',
    '    Number(resources.gold ?? 0),',
    '    Number(resources.coins ?? 0),',
    '  );',
    "  db.prepare('UPDATE resources SET last_sync_at = ? WHERE village_id = ?').run(String(iso), Number(villageId));",
    '};',
    '',
    "const session = createSessionForUsername('Hayato');",
    'const cookie = SESSION_COOKIE_NAME + "=" + session.token;',
    'const server = app.listen(0);',
    "await new Promise((resolve) => server.once('listening', resolve));",
    '',
    'try {',
    '  const address = server.address();',
    "  const port = typeof address === 'object' && address ? Number(address.port) : 0;",
    '',
    '  const stateResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/state?worldId=dominion-1", {',
    '    headers: { cookie },',
    '  });',
    '  const statePayload = await stateResponse.json();',
    '  const sourceVillageId = Number(statePayload?.data?.village?.id ?? 0);',
    '  const region = Number(statePayload?.data?.village?.region ?? 0);',
    "  const playerId = Number(selectPlayerByUsernameStmt.get('Hayato')?.id ?? 0);",
    '',
    '  const candidateVillageIds = selectVillageIdsByRegionStmt.all(region).map((row) => Number(row.id));',
    '  const targetVillageIds = candidateVillageIds.filter((id) => id !== sourceVillageId).slice(0, 3);',
    '  if (targetVillageIds.length < 2) {',
    "    throw new Error('Not enough candidate villages for multi-dispatch scenario.');",
    '  }',
    '',
    '  setVillageBuildings(sourceVillageId, { market: 4, warehouse: 10 });',
    "  setVillageResources(sourceVillageId, { wood: 300000, stone: 300000, iron: 300000, gold: 500, coins: 500 }, fixedIso);",
    '  closeInProgressLogisticsBySourceStmt.run(fixedIso, sourceVillageId);',
    '',
    '  for (const targetVillageId of targetVillageIds) {',
    "    updateVillageOwnerStmt.run(playerId, 'Aurora Pact', Number(targetVillageId));",
    '    setVillageBuildings(Number(targetVillageId), { warehouse: 1 });',
    "    setVillageResources(Number(targetVillageId), { wood: 100, stone: 100, iron: 100, gold: 0, coins: 0 }, fixedIso);",
    '  }',
    '',
    "  upsertResearchProgressCompletedStmt.run(playerId, region, 'guild-influence', fixedIso, fixedIso, fixedIso);",
    '',
    '  const configureResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/market/guild/configure", {',
    "    method: 'POST',",
    '    headers: {',
    "      'content-type': 'application/json',",
    '      cookie,',
    '    },',
    '    body: JSON.stringify({',
    "      username: 'Hayato',",
    '      villageId: sourceVillageId,',
    "      worldId: 'dominion-1',",
    '      enabled: true,',
    '      targetVillageIds,',
    '      pausedTargetVillageIds: [],',
    '    }),',
    '  });',
    '  const configured = await configureResponse.json();',
    '',
    '  const tickResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/tick", { method: "POST", headers: { cookie } });',
    '  const tickPayload = await tickResponse.json();',
    '',
    '  const routes = selectGuildAutoRoutesBySourceStmt.all(sourceVillageId);',
    '  const uniqueTargetVillageIds = [...new Set(routes.map((route) => Number(route.targetVillageId)))];',
    '',
    '  console.log(JSON.stringify({',
    '    configureStatus: configureResponse.status,',
    '    tickStatus: tickResponse.status,',
    '    configuredTargetCount: configured?.result?.targetCount ?? null,',
    '    tickAutoGuildDispatches: Number(tickPayload?.tick?.autoGuildDispatches ?? 0),',
    '    routeCount: routes.length,',
    '    uniqueTargetCount: uniqueTargetVillageIds.length,',
    '    uniqueTargetVillageIds,',
    '  }));',
    '} finally {',
    '  await new Promise((resolve, reject) => {',
    '    server.close((error) => {',
    '      if (error) {',
    '        reject(error);',
    '        return;',
    '      }',
    '      resolve();',
    '    });',
    '  });',
    '}',
  ].join('\n');

  try {
    const run = spawnSync(process.execPath, ['--input-type=module', '-'], {
      cwd: repoRoot,
      env,
      input: script,
      encoding: 'utf8',
    });

    if (run.status !== 0) {
      throw new Error(
        [
          'Market guild multi-dispatch scenario failed.',
          `Exit code: ${run.status ?? 'null'}`,
          `stdout:\n${run.stdout ?? ''}`,
          `stderr:\n${run.stderr ?? ''}`,
        ].join('\n'),
      );
    }

    const stdout = String(run.stdout ?? '').trim();
    const outputLine = stdout.split(/\r?\n/).filter(Boolean).at(-1);
    assert.ok(outputLine, 'scenario should emit JSON output');

    const payload = JSON.parse(outputLine);
    assert.equal(payload.configureStatus, 200);
    assert.equal(payload.tickStatus, 200);
    assert.ok(Number(payload.configuredTargetCount ?? 0) >= 2);
    assert.ok(
      Number(payload.tickAutoGuildDispatches ?? 0) >= 2,
      `expected >=2 auto guild dispatches, got ${String(payload.tickAutoGuildDispatches)}`,
    );
    assert.ok(Number(payload.routeCount ?? 0) >= 2, `expected >=2 routes, got ${String(payload.routeCount)}`);
    assert.ok(
      Number(payload.uniqueTargetCount ?? 0) >= 2,
      `expected >=2 unique targets, got ${String(payload.uniqueTargetCount)}`,
    );
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});
