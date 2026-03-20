#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const API_BASE_DEFAULT = 'https://thelastdominion.netlify.app';
const WORLD_ID_DEFAULT = 'dominion-1';
const USERNAME_DEFAULT = 'Hayato';
const PASSWORD_DEFAULT = '123';
const MANAGED_AVATAR_PUBLIC_PREFIX = '/api/v1/public/avatars/';

const args = process.argv.slice(2);
const options = {
  baseUrl: readArgValue('--base-url') ?? '',
  worldId: readArgValue('--world-id') ?? WORLD_ID_DEFAULT,
  username: readArgValue('--username') ?? USERNAME_DEFAULT,
  password: readArgValue('--password') ?? PASSWORD_DEFAULT,
  expectVersion: readArgValue('--expect-version') ?? null,
  skipSmoke: hasFlag('--skip-smoke'),
  skipAvatarCheck: hasFlag('--skip-avatar-check'),
  mutateAvatarUpload: hasFlag('--mutate-avatar-upload'),
  forceAvatarMutation: hasFlag('--force-avatar-mutation'),
  allowDualApi: hasFlag('--allow-dual-api'),
  checkNetlifyEnv: hasFlag('--check-netlify-env'),
};

const report = {
  pass: [],
  warn: [],
  fail: [],
};

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a2kAAAAASUVORK5CYII=';

main().catch((error) => {
  addFail(`Unhandled error: ${formatUnknownError(error)}`);
  printReportAndExit();
});

async function main() {
  const packageVersion = checkVersionContract();
  checkApiPathContract();
  if (options.checkNetlifyEnv) {
    checkNetlifyProductionApiEnv();
  }

  if (!options.skipSmoke) {
    const baseUrl = normalizeBaseUrl(options.baseUrl || API_BASE_DEFAULT);
    const expectedVersion = options.expectVersion ?? packageVersion;
    await runSmokeChecks(baseUrl, expectedVersion);
  } else {
    addWarn('Smoke checks skipped (--skip-smoke).');
  }

  printReportAndExit();
}

function hasFlag(flag) {
  return args.includes(flag);
}

function readArgValue(flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return String(value).trim();
}

function readUtf8(relativePath) {
  return fs.readFileSync(path.resolve(ROOT_DIR, relativePath), 'utf8');
}

function checkVersionContract() {
  const packageJson = JSON.parse(readUtf8('package.json'));
  const packageVersion = String(packageJson?.version ?? '').trim();
  if (!packageVersion) {
    addFail('package.json is missing version.');
    return '';
  }
  addPass(`package.json version detected: ${packageVersion}`);

  const frontendVersionSource = readUtf8('src/version.ts');
  const frontendFallbackMatch = frontendVersionSource.match(/\|\|\s*'([^']+)'/);
  const frontendFallback = frontendFallbackMatch ? String(frontendFallbackMatch[1]).trim() : '';
  if (!frontendFallback) {
    addFail('src/version.ts fallback label was not detected.');
  } else if (frontendFallback !== packageVersion) {
    addFail(
      `Version mismatch: frontend fallback is '${frontendFallback}', package version is '${packageVersion}'.`,
    );
  } else {
    addPass(`Frontend fallback version matches package: ${frontendFallback}`);
  }

  const backendVersionSource = readUtf8('server/index.js');
  const backendFallbackMatch = backendVersionSource.match(/build-(\d+\.\d+\.\d+)/);
  const backendFallbackVersion = backendFallbackMatch ? String(backendFallbackMatch[1]).trim() : '';
  if (!backendFallbackVersion) {
    addFail('server/index.js fallback build label was not detected.');
  } else if (backendFallbackVersion !== packageVersion) {
    addFail(
      `Version mismatch: backend fallback is 'build-${backendFallbackVersion}', package version is '${packageVersion}'.`,
    );
  } else {
    addPass(`Backend fallback build label matches package: build-${backendFallbackVersion}`);
  }

  return packageVersion;
}

function checkApiPathContract() {
  const netlifyTomlPath = path.resolve(ROOT_DIR, 'netlify.toml');
  const hasNetlifyToml = fs.existsSync(netlifyTomlPath);
  const netlifyToml = hasNetlifyToml ? fs.readFileSync(netlifyTomlPath, 'utf8') : '';
  const hasApiProxyRedirect =
    /from\s*=\s*"\/api"/.test(netlifyToml) && /from\s*=\s*"\/api\/\*"/.test(netlifyToml);
  const envApiBase = String(process.env.VITE_API_BASE ?? '').trim();

  if (!hasNetlifyToml) {
    addWarn('netlify.toml is missing; API routing contract could not be checked fully.');
    return;
  }

  if (hasApiProxyRedirect) {
    addPass('Netlify /api proxy redirects detected.');
  } else {
    addWarn('Netlify /api proxy redirects were not detected.');
  }

  if (hasApiProxyRedirect && envApiBase && !options.allowDualApi) {
    addFail(
      `Dual API contract detected: netlify.toml proxies /api and VITE_API_BASE is set to '${envApiBase}'.`,
    );
    return;
  }

  if (hasApiProxyRedirect && envApiBase && options.allowDualApi) {
    addWarn(`Dual API mode is allowed by flag (--allow-dual-api). VITE_API_BASE='${envApiBase}'.`);
    return;
  }

  if (!hasApiProxyRedirect && !envApiBase) {
    addFail('No API path contract found (missing /api proxy and VITE_API_BASE is empty).');
    return;
  }

  if (hasApiProxyRedirect && !envApiBase) {
    addPass('API path contract is proxy-only (/api through Netlify).');
    return;
  }

  if (!hasApiProxyRedirect && envApiBase) {
    addPass(`API path contract is direct base URL via VITE_API_BASE='${envApiBase}'.`);
  }
}

function checkNetlifyProductionApiEnv() {
  const command = spawnSync(
    'npx',
    ['netlify', 'env:get', 'VITE_API_BASE', '--context', 'production'],
    { encoding: 'utf8', cwd: ROOT_DIR },
  );
  if (command.error) {
    addWarn(`Netlify env check skipped (${command.error.message}).`);
    return;
  }
  if (command.status !== 0) {
    const stderr = String(command.stderr ?? '').trim();
    addWarn(`Netlify env check failed (exit ${command.status}). ${stderr || 'No stderr output.'}`);
    return;
  }

  const value = String(command.stdout ?? '').trim();
  if (!value) {
    addPass('Netlify production VITE_API_BASE is empty.');
    return;
  }

  if (options.allowDualApi) {
    addWarn(`Netlify production VITE_API_BASE is set to '${value}' (allowed by flag).`);
  } else {
    addFail(`Netlify production VITE_API_BASE is set to '${value}' (dual API path contract).`);
  }
}

async function runSmokeChecks(baseUrl, expectedVersion) {
  addPass(`Smoke target: ${baseUrl}`);
  const cookieJar = new Map();

  const health = await requestJson(baseUrl, '/api/health', { method: 'GET' }, cookieJar);
  const versionLabel = String(health?.deployment?.versionLabel ?? '').trim();
  const buildId = String(health?.deployment?.buildId ?? '').trim();
  if (!versionLabel) {
    addFail('Smoke: /api/health missing deployment.versionLabel.');
  } else {
    addPass(`Smoke: /api/health versionLabel='${versionLabel}'`);
  }
  if (!buildId) {
    addFail('Smoke: /api/health missing deployment.buildId.');
  } else {
    addPass(`Smoke: /api/health buildId='${buildId}'`);
  }
  if (expectedVersion) {
    const expectedNeedle = String(expectedVersion).trim();
    if (!versionLabel.includes(expectedNeedle) && !buildId.includes(expectedNeedle)) {
      addFail(
        `Smoke: deployment version mismatch. Expected to include '${expectedNeedle}', got versionLabel='${versionLabel}', buildId='${buildId}'.`,
      );
    } else {
      addPass(`Smoke: deployment reports expected version '${expectedNeedle}'.`);
    }
  }

  const loginPayload = await requestJson(
    baseUrl,
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: {
        username: options.username,
        password: options.password,
      },
    },
    cookieJar,
  );
  if (!loginPayload?.data?.username) {
    addFail('Smoke: login response missing data.username.');
  } else {
    addPass(`Smoke: login OK (${loginPayload.data.username}).`);
  }

  const statePath = `/api/v1/state?worldId=${encodeURIComponent(options.worldId)}`;
  const statePayload = await requestJson(baseUrl, statePath, { method: 'GET' }, cookieJar);
  const state = statePayload?.data;
  if (!state || typeof state !== 'object') {
    addFail('Smoke: state payload missing.');
  } else {
    addPass('Smoke: state snapshot loaded.');
  }

  const researchProjects = state?.research?.projects;
  if (!Array.isArray(researchProjects) || researchProjects.length <= 0) {
    addFail('Smoke: research project list missing or empty in state snapshot.');
  } else {
    addPass(`Smoke: research list present (${researchProjects.length} projects).`);
  }

  if (!state?.publicOrder) {
    addFail('Smoke: state snapshot missing publicOrder summary.');
  } else {
    addPass(`Smoke: publicOrder summary present (${Number(state.publicOrder.currentPct ?? 0)}%).`);
  }

  if (options.skipAvatarCheck) {
    addWarn('Smoke: avatar route check skipped (--skip-avatar-check).');
    return;
  }

  const communicationPayload = await requestJson(
    baseUrl,
    `/api/v1/communication?threadLimit=1&messageLimit=1`,
    { method: 'GET' },
    cookieJar,
  );
  const currentAvatarUrl = normalizeNullableString(communicationPayload?.data?.me?.avatarUrl);
  addPass(
    `Smoke: communication inbox loaded (current avatar: ${currentAvatarUrl == null ? 'null' : currentAvatarUrl}).`,
  );

  if (options.mutateAvatarUpload) {
    const hasManagedAvatar = typeof currentAvatarUrl === 'string' && currentAvatarUrl.startsWith(MANAGED_AVATAR_PUBLIC_PREFIX);
    if (hasManagedAvatar && !options.forceAvatarMutation) {
      addFail(
        `Smoke: avatar mutation aborted. Current avatar is managed (${currentAvatarUrl}) and restoring the exact file cannot be guaranteed. Use --force-avatar-mutation to override.`,
      );
      return;
    }

    const uploadPayload = await requestJson(
      baseUrl,
      '/api/v1/communication/avatar',
      {
        method: 'POST',
        body: {
          username: options.username,
          avatarUrl: null,
          avatarDataUrl: tinyPngDataUrl,
        },
      },
      cookieJar,
    );
    const uploadedAvatarUrl = normalizeNullableString(uploadPayload?.result?.avatarUrl);
    if (!uploadedAvatarUrl || !uploadedAvatarUrl.startsWith(MANAGED_AVATAR_PUBLIC_PREFIX)) {
      addFail(
        `Smoke: avatar upload route returned unexpected URL '${uploadedAvatarUrl ?? 'null'}'. Expected '${MANAGED_AVATAR_PUBLIC_PREFIX}...'`,
      );
    } else {
      addPass(`Smoke: avatar upload route OK (${uploadedAvatarUrl}).`);
      await ensureAvatarPathIsReachable(baseUrl, uploadedAvatarUrl, cookieJar);
    }

    await requestJson(
      baseUrl,
      '/api/v1/communication/avatar',
      {
        method: 'POST',
        body: {
          username: options.username,
          avatarUrl: currentAvatarUrl,
          avatarDataUrl: null,
        },
      },
      cookieJar,
    );
    addPass('Smoke: avatar value restored after mutation check.');
    return;
  }

  const avatarRoutePayload = await requestJson(
    baseUrl,
    '/api/v1/communication/avatar',
    {
      method: 'POST',
      body: {
        username: options.username,
        avatarUrl: currentAvatarUrl,
        avatarDataUrl: null,
      },
    },
    cookieJar,
  );
  const reportedAvatarUrl = normalizeNullableString(avatarRoutePayload?.result?.avatarUrl);
  addPass(
    `Smoke: avatar endpoint accepted non-mutating update (avatarUrl: ${reportedAvatarUrl == null ? 'null' : reportedAvatarUrl}).`,
  );

  if (reportedAvatarUrl && reportedAvatarUrl.startsWith(MANAGED_AVATAR_PUBLIC_PREFIX)) {
    await ensureAvatarPathIsReachable(baseUrl, reportedAvatarUrl, cookieJar);
  } else if (reportedAvatarUrl) {
    addWarn(`Smoke: avatar URL is external/custom (${reportedAvatarUrl}); managed static path not asserted.`);
  }
}

async function ensureAvatarPathIsReachable(baseUrl, avatarUrl, cookieJar) {
  const response = await requestRaw(baseUrl, avatarUrl, { method: 'GET' }, cookieJar);
  if (response.status >= 200 && response.status < 400) {
    addPass(`Smoke: avatar public path reachable (${avatarUrl}, status ${response.status}).`);
    return;
  }
  addFail(`Smoke: avatar public path not reachable (${avatarUrl}, status ${response.status}).`);
}

async function requestJson(baseUrl, routePath, optionsRaw, cookieJar) {
  const response = await requestRaw(baseUrl, routePath, optionsRaw, cookieJar);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for '${routePath}'. Body: ${text.slice(0, 400) || '<empty>'}`,
    );
  }
  if (payload && typeof payload === 'object' && payload.ok === false) {
    throw new Error(`API error for '${routePath}': ${payload.error || 'unknown error'}`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Non-JSON payload for '${routePath}'. Raw body: ${text.slice(0, 400) || '<empty>'}`);
  }
  return payload;
}

async function requestRaw(baseUrl, routePath, optionsRaw, cookieJar) {
  const targetUrl = new URL(routePath, baseUrl).toString();
  const options = { ...optionsRaw };
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');
  if (options.body != null && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  const cookieHeader = serializeCookieJar(cookieJar);
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }
  options.headers = headers;

  const response = await fetch(targetUrl, options);
  updateCookieJar(cookieJar, response);
  return response;
}

function serializeCookieJar(cookieJar) {
  const entries = Array.from(cookieJar.entries());
  if (entries.length <= 0) {
    return '';
  }
  return entries.map(([name, value]) => `${name}=${value}`).join('; ');
}

function updateCookieJar(cookieJar, response) {
  const setCookieLines =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : normalizeSetCookieFallback(response.headers.get('set-cookie'));
  for (const line of setCookieLines) {
    const token = String(line ?? '').split(';')[0]?.trim();
    if (!token || !token.includes('=')) {
      continue;
    }
    const separatorIndex = token.indexOf('=');
    const name = token.slice(0, separatorIndex).trim();
    const value = token.slice(separatorIndex + 1).trim();
    if (!name) {
      continue;
    }
    cookieJar.set(name, value);
  }
}

function normalizeSetCookieFallback(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? [normalized] : [];
}

function normalizeBaseUrl(value) {
  const normalized = String(value ?? '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('Missing smoke base URL. Pass --base-url <url>.');
  }
  return normalized;
}

function normalizeNullableString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function formatUnknownError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function addPass(message) {
  report.pass.push(message);
}

function addWarn(message) {
  report.warn.push(message);
}

function addFail(message) {
  report.fail.push(message);
}

function printReportAndExit() {
  const printLines = (prefix, list) => {
    for (const item of list) {
      console.log(`${prefix} ${item}`);
    }
  };

  printLines('[PASS]', report.pass);
  printLines('[WARN]', report.warn);
  printLines('[FAIL]', report.fail);

  const summary = `release-doctor summary: ${report.pass.length} pass, ${report.warn.length} warn, ${report.fail.length} fail`;
  if (report.fail.length > 0) {
    console.error(summary);
    process.exitCode = 1;
    return;
  }
  console.log(summary);
}
