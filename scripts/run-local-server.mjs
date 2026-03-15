import { applyLocalRuntimeEnv } from '../server/runtimeProfile.js';

const runtime = applyLocalRuntimeEnv();

console.log(
  `[local-runtime] server scope=${runtime.scopeName} port=${runtime.serverPort} data=${runtime.dataDir}`,
);

await import('../server/index.js');
