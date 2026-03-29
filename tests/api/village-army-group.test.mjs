import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '../..');

test('village army group API persists into state and army overview', () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-army-group-'));
  const env = {
    ...process.env,
    TLD_DATA_DIR: tempDataDir,
    NETLIFY: '1',
  };

  const script = `
    import { createSessionForUsername, SESSION_COOKIE_NAME } from './server/sessionService.js';
    const { app } = await import('./server/index.js');

    const session = createSessionForUsername('Hayato');
    const cookie = \`\${SESSION_COOKIE_NAME}=\${session.token}\`;
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? Number(address.port) : 0;
      const stateBeforeResponse = await fetch(\`http://127.0.0.1:\${port}/api/v1/state?worldId=dominion-1\`, {
        headers: { cookie },
      });
      const stateBefore = await stateBeforeResponse.json();
      const villageId = Number(stateBefore?.data?.village?.id ?? 0);

      const updateResponse = await fetch(\`http://127.0.0.1:\${port}/api/v1/villages/group\`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          username: 'Hayato',
          group: 'defensive',
          villageId,
          worldId: 'dominion-1',
        }),
      });
      const updatePayload = await updateResponse.json();

      const stateAfterResponse = await fetch(\`http://127.0.0.1:\${port}/api/v1/state?worldId=dominion-1&villageId=\${villageId}\`, {
        headers: { cookie },
      });
      const stateAfter = await stateAfterResponse.json();

      const overviewResponse = await fetch(\`http://127.0.0.1:\${port}/api/v1/army/overview?username=Hayato&worldId=dominion-1\`, {
        headers: { cookie },
      });
      const overviewPayload = await overviewResponse.json();

      console.log(JSON.stringify({
        stateBeforeStatus: stateBeforeResponse.status,
        updateStatus: updateResponse.status,
        stateAfterStatus: stateAfterResponse.status,
        overviewStatus: overviewResponse.status,
        updateResult: updatePayload?.result ?? null,
        stateVillageArmyGroup: stateAfter?.data?.village?.armyGroup ?? null,
        stateVillageListArmyGroup:
          (stateAfter?.data?.villages ?? []).find((entry) => Number(entry?.id ?? 0) === villageId)?.armyGroup ?? null,
        overviewVillageArmyGroup:
          (overviewPayload?.data?.villages ?? []).find((entry) => Number(entry?.villageId ?? 0) === villageId)?.armyGroup ?? null,
      }));
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  `;

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
          'Village army group API scenario failed.',
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
    assert.equal(payload.stateBeforeStatus, 200);
    assert.equal(payload.updateStatus, 200);
    assert.equal(payload.stateAfterStatus, 200);
    assert.equal(payload.overviewStatus, 200);
    assert.equal(String(payload.updateResult?.previousGroup ?? ''), 'none');
    assert.equal(String(payload.updateResult?.newGroup ?? ''), 'defensive');
    assert.equal(Boolean(payload.updateResult?.changed), true);
    assert.equal(String(payload.stateVillageArmyGroup ?? ''), 'defensive');
    assert.equal(String(payload.stateVillageListArmyGroup ?? ''), 'defensive');
    assert.equal(String(payload.overviewVillageArmyGroup ?? ''), 'defensive');
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});
