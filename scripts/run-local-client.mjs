import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLocalRuntimeEnv } from '../server/runtimeProfile.js';

const runtime = applyLocalRuntimeEnv();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const viteEntryPath = path.join(scriptDir, '..', 'node_modules', 'vite', 'bin', 'vite.js');

console.log(
  `[local-runtime] client scope=${runtime.scopeName} port=${runtime.clientPort} api=${runtime.apiBase}`,
);

const child = spawn(
  process.execPath,
  [viteEntryPath, '--port', String(runtime.clientPort), '--strictPort'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
