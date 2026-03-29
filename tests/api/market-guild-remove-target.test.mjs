import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../..');

test('market guild target can be removed from automation list', () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-market-guild-remove-'));
  const env = {
    ...process.env,
    TLD_DATA_DIR: tempDataDir,
    NETLIFY: '1',
  };

  const script = [
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
    'const setResearchCompleted = (playerId, region, researchId, iso) =>',
    '  upsertResearchProgressCompletedStmt.run(Number(playerId), Number(region), String(researchId), String(iso), String(iso), String(iso));',
    '',
    "const session = createSessionForUsername('Hayato');",
    'const cookie = SESSION_COOKIE_NAME + "=" + session.token;',
    'const server = app.listen(0);',
    "await new Promise((resolve) => server.once('listening', resolve));",
    '',
    'try {',
    '  const address = server.address();',
    "  const port = typeof address === 'object' && address ? Number(address.port) : 0;",
    '  const stateResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/state?worldId=dominion-1", {',
    '    headers: { cookie },',
    '  });',
    '  const statePayload = await stateResponse.json();',
    '  const sourceVillageId = Number(statePayload?.data?.village?.id ?? 0);',
    '  const region = Number(statePayload?.data?.village?.region ?? 0);',
    "  const playerId = Number(selectPlayerByUsernameStmt.get('Hayato')?.id ?? 0);",
    '',
    '  const candidateVillageIds = selectVillageIdsByRegionStmt.all(region).map((row) => Number(row.id));',
    '  const targetVillageIds = candidateVillageIds.filter((id) => id !== sourceVillageId).slice(0, 2);',
    '  if (targetVillageIds.length < 2) {',
    "    throw new Error('Not enough candidate villages for market guild removal scenario.');",
    '  }',
    '',
    '  for (const targetVillageId of targetVillageIds) {',
    "    updateVillageOwnerStmt.run(playerId, 'Aurora Pact', Number(targetVillageId));",
    '    setVillageBuildings(Number(targetVillageId), { warehouse: 8 });',
    "    setVillageResources(Number(targetVillageId), { wood: 100, stone: 100, iron: 100, gold: 0, coins: 0 }, '2026-03-29T08:00:00.000Z');",
    '  }',
    '',
    '  setVillageBuildings(sourceVillageId, { market: 4, warehouse: 8 });',
    "  setVillageResources(sourceVillageId, { wood: 25000, stone: 25000, iron: 25000, gold: 300, coins: 300 }, '2026-03-29T08:00:00.000Z');",
    "  setResearchCompleted(playerId, region, 'guild-influence', '2026-03-29T08:00:00.000Z');",
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
    '  const removeResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/market/guild/configure", {',
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
    '      targetVillageIds: [targetVillageIds[1]],',
    '      pausedTargetVillageIds: [],',
    '    }),',
    '  });',
    '  const removed = await removeResponse.json();',
    '',
    '  const stateAfterResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/state?worldId=dominion-1&villageId=" + sourceVillageId, {',
    '    headers: { cookie },',
    '  });',
    '  const stateAfter = await stateAfterResponse.json();',
    '',
    '  console.log(JSON.stringify({',
    '    configureStatus: configureResponse.status,',
    '    removeStatus: removeResponse.status,',
    '    configuredTargetCount: configured?.result?.targetCount ?? null,',
    '    removedTargetCount: removed?.result?.targetCount ?? null,',
    '    targetCount: stateAfter?.data?.market?.guildAutomation?.targets?.length ?? null,',
    '    targetIds: (stateAfter?.data?.market?.guildAutomation?.targets ?? []).map((entry) => Number(entry.targetVillageId)),',
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
          'Market guild removal scenario failed.',
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
    assert.equal(payload.removeStatus, 200);
    assert.equal(Number(payload.configuredTargetCount ?? -1), 2);
    assert.equal(Number(payload.removedTargetCount ?? -1), 1);
    assert.equal(Number(payload.targetCount ?? -1), 1);
    assert.equal(Array.isArray(payload.targetIds) && payload.targetIds.length, 1);
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});
