import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../..');

test('market logistics can send by manual coordinates without targetVillageId', () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-market-manual-coords-'));
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
    "const selectTargetVillageStmt = db.prepare('SELECT id, coord_x AS coordX, coord_y AS coordY, player_id AS playerId FROM villages WHERE region = ? AND id <> ? ORDER BY CASE WHEN player_id <> ? THEN 0 ELSE 1 END, id ASC LIMIT 1');",
    "const upsertBuildingStmt = db.prepare('INSERT INTO buildings (village_id, building_id, level) VALUES (?, ?, ?) ON CONFLICT(village_id, building_id) DO UPDATE SET level = excluded.level');",
    "const upsertResourcePocketStmt = db.prepare('INSERT INTO resources (village_id, wood, stone, iron, gold, coins) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(village_id) DO UPDATE SET wood = excluded.wood, stone = excluded.stone, iron = excluded.iron, gold = excluded.gold, coins = excluded.coins');",
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
    '  if (!sourceVillageId || !region || !playerId) {',
    "    throw new Error('Missing source village bootstrap data.');",
    '  }',
    '',
    '  const targetVillage = selectTargetVillageStmt.get(region, sourceVillageId, playerId) ?? null;',
    '  if (!targetVillage) {',
    "    throw new Error('No candidate target village for manual coordinates test.');",
    '  }',
    '',
    '  setVillageBuildings(sourceVillageId, { market: 4, warehouse: 8 });',
    "  setVillageResources(sourceVillageId, { wood: 12000, stone: 12000, iron: 12000, gold: 250, coins: 250 }, '2026-03-29T08:00:00.000Z');",
    '',
    '  const sendResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/market/logistics/send", {',
    "    method: 'POST',",
    '    headers: {',
    "      'content-type': 'application/json',",
    '      cookie,',
    '    },',
    '    body: JSON.stringify({',
    "      username: 'Hayato',",
    "      worldId: 'dominion-1',",
    '      villageId: sourceVillageId,',
    '      manualTargetCoordX: Number(targetVillage.coordX),',
    '      manualTargetCoordY: Number(targetVillage.coordY),',
    '      wood: 1000,',
    '      stone: 500,',
    '      iron: 250,',
    '      gold: 0,',
    '      coins: 0,',
    '    }),',
    '  });',
    '  const sendPayload = await sendResponse.json();',
    '',
    '  const stateAfterResponse = await fetch("http://127.0.0.1:" + port + "/api/v1/state?worldId=dominion-1&villageId=" + sourceVillageId, {',
    '    headers: { cookie },',
    '  });',
    '  const stateAfter = await stateAfterResponse.json();',
    '',
    '  console.log(JSON.stringify({',
    '    sendStatus: sendResponse.status,',
    '    expectedTargetVillageId: Number(targetVillage.id),',
    '    expectedTargetOwnerId: Number(targetVillage.playerId),',
    '    resultTargetVillageId: Number(sendPayload?.result?.targetVillageId ?? 0),',
    '    routeTargetVillageIds: (stateAfter?.data?.market?.logisticsRoutes ?? []).map((route) => Number(route.targetVillageId)),',
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
          'Manual coordinate market logistics scenario failed.',
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
    assert.equal(payload.sendStatus, 201);
    assert.equal(Number(payload.resultTargetVillageId ?? 0), Number(payload.expectedTargetVillageId ?? -1));
    assert.ok(
      Array.isArray(payload.routeTargetVillageIds) &&
        payload.routeTargetVillageIds.includes(Number(payload.expectedTargetVillageId ?? -1)),
      'state should include logistics route to expected target village',
    );
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});
