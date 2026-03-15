import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyLocalRuntimeEnv, resolveLocalRuntimeProfile } from '../../server/runtimeProfile.js';

test('resolveLocalRuntimeProfile uses dedicated defaults for develop and main', () => {
  const developProfile = resolveLocalRuntimeProfile({
    cwd: 'D:/repo',
    env: {},
    branchName: 'develop',
  });
  const mainProfile = resolveLocalRuntimeProfile({
    cwd: 'D:/repo',
    env: {},
    branchName: 'main',
  });

  assert.equal(developProfile.serverPort, 3001);
  assert.equal(developProfile.clientPort, 5173);
  assert.match(developProfile.dataDir, /server[\\/]data[\\/]branches[\\/]develop$/);

  assert.equal(mainProfile.serverPort, 3002);
  assert.equal(mainProfile.clientPort, 5174);
  assert.match(mainProfile.dataDir, /server[\\/]data[\\/]branches[\\/]main$/);
});

test('shared .env.local does not force branch-sensitive ports or data dirs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-runtime-profile-'));
  const env = {};

  try {
    fs.writeFileSync(
      path.join(tempRoot, '.env.local'),
      ['VITE_API_BASE=http://localhost:3999', 'PORT=3999', 'SHARED_TOKEN=shared-value'].join('\n'),
    );

    const runtime = applyLocalRuntimeEnv({
      cwd: tempRoot,
      env,
      branchName: 'main',
    });

    assert.equal(runtime.serverPort, 3002);
    assert.equal(runtime.clientPort, 5174);
    assert.equal(env.PORT, '3002');
    assert.equal(env.VITE_API_BASE, 'http://localhost:3002');
    assert.equal(env.SHARED_TOKEN, 'shared-value');
    assert.match(env.TLD_DATA_DIR, /server[\\/]data[\\/]branches[\\/]main$/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('branch-specific env overrides branch defaults', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-runtime-profile-'));
  const env = {};

  try {
    fs.writeFileSync(path.join(tempRoot, '.env.local'), 'SHARED_TOKEN=shared-value\n');
    fs.writeFileSync(
      path.join(tempRoot, '.env.develop.local'),
      [
        'PORT=3201',
        'VITE_DEV_PORT=5201',
        'VITE_API_BASE=http://localhost:3201',
        'TLD_DATA_DIR=server/data/custom-develop',
      ].join('\n'),
    );

    const runtime = applyLocalRuntimeEnv({
      cwd: tempRoot,
      env,
      branchName: 'develop',
    });

    assert.equal(runtime.serverPort, 3201);
    assert.equal(runtime.clientPort, 5201);
    assert.equal(env.PORT, '3201');
    assert.equal(env.VITE_DEV_PORT, '5201');
    assert.equal(env.VITE_API_BASE, 'http://localhost:3201');
    assert.equal(env.TLD_DATA_DIR, 'server/data/custom-develop');
    assert.equal(env.SHARED_TOKEN, 'shared-value');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
