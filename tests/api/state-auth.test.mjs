import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

test('state endpoint requires authenticated session', async () => {
  const previousNetlifyValue = process.env.NETLIFY;
  process.env.NETLIFY = '1';

  const { app } = await import('../../server/index.js');
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    const port =
      address && typeof address === 'object' && 'port' in address && Number.isFinite(address.port)
        ? Number(address.port)
        : null;
    assert.ok(port && port > 0, 'test server should listen on ephemeral port');

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/state?username=Hayato`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload?.ok, false);
    assert.equal(payload?.errorCode, 'AUTH_REQUIRED');
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

    if (previousNetlifyValue == null) {
      delete process.env.NETLIFY;
    } else {
      process.env.NETLIFY = previousNetlifyValue;
    }
  }
});
