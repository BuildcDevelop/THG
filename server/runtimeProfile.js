import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LOCAL_RUNTIME_DEFAULTS = {
  develop: { serverPort: 3001, clientPort: 5173 },
  main: { serverPort: 3002, clientPort: 5174 },
  master: { serverPort: 3002, clientPort: 5174 },
};
const FALLBACK_LOCAL_RUNTIME = { serverPort: 3003, clientPort: 5175 };
const BRANCH_ENV_SOURCE_SHARED = 'shared';
const BRANCH_ENV_SOURCE_BRANCH = 'branch';
const BRANCH_ENV_SOURCE_PROCESS = 'process';
const BRANCH_ENV_SOURCE_DEFAULT = 'default';
const LOCALHOST_API_HOST = 'localhost';
const SHARED_ENV_FILE_NAMES = ['.env.local'];

const parseEnvFile = (rawContent) => {
  const entries = {};
  const lines = String(rawContent ?? '').split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalizedLine = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
};

export const sanitizeRuntimeScope = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'develop';
};

const resolveBranchNameFromEnv = (env) => {
  const candidates = [
    env?.TLD_BRANCH_ENV,
    env?.TLD_RUNTIME_SCOPE,
    env?.GIT_BRANCH,
    env?.BRANCH_NAME,
    env?.HEAD,
  ];

  for (const candidate of candidates) {
    const branchName = String(candidate ?? '').trim();
    if (branchName) {
      return branchName;
    }
  }

  return '';
};

export const resolveGitBranchName = ({ cwd = process.cwd(), env = process.env } = {}) => {
  const branchNameFromEnv = resolveBranchNameFromEnv(env);
  if (branchNameFromEnv) {
    return branchNameFromEnv;
  }

  try {
    return String(
      execFileSync('git', ['branch', '--show-current'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ).trim();
  } catch {
    return '';
  }
};

export const resolveLocalRuntimeProfile = ({
  cwd = process.cwd(),
  env = process.env,
  branchName,
} = {}) => {
  const rawBranchName = String(branchName ?? resolveGitBranchName({ cwd, env }) ?? '').trim() || 'develop';
  const scopeName = sanitizeRuntimeScope(rawBranchName);
  const preset = LOCAL_RUNTIME_DEFAULTS[scopeName] ?? FALLBACK_LOCAL_RUNTIME;
  const dataDir = path.join(cwd, 'server', 'data', 'branches', scopeName);
  const seedDbPath = path.join(cwd, 'server', 'data', 'game.seed.sqlite.backup');

  return {
    branchName: rawBranchName,
    scopeName,
    serverPort: Number(preset.serverPort),
    clientPort: Number(preset.clientPort),
    dataDir,
    seedDbPath,
    apiBase: `http://${LOCALHOST_API_HOST}:${Number(preset.serverPort)}`,
    envFiles: [
      ...SHARED_ENV_FILE_NAMES.map((fileName) => path.join(cwd, fileName)),
      path.join(cwd, `.env.${scopeName}.local`),
    ],
  };
};

const readEnvFileEntries = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(filePath, 'utf8'));
};

const setEnvValue = (env, sources, key, value, source) => {
  env[key] = String(value);
  sources.set(key, source);
};

const applyEnvEntries = (env, sources, entries, source) => {
  for (const [key, value] of Object.entries(entries)) {
    const existingSource = sources.get(key);
    if (existingSource === BRANCH_ENV_SOURCE_PROCESS) {
      continue;
    }

    setEnvValue(env, sources, key, value, source);
  }
};

const shouldApplyBranchDefault = (sources, key) => {
  const source = sources.get(key);
  return (
    !source ||
    source === BRANCH_ENV_SOURCE_SHARED ||
    source === BRANCH_ENV_SOURCE_DEFAULT
  );
};

const ensureMirroredEnvValue = (env, sources, primaryKey, secondaryKey) => {
  const value = String(env[primaryKey] ?? '').trim();
  if (!value) {
    return;
  }

  if (!shouldApplyBranchDefault(sources, secondaryKey)) {
    return;
  }

  setEnvValue(env, sources, secondaryKey, value, sources.get(primaryKey) ?? BRANCH_ENV_SOURCE_DEFAULT);
};

export const applyLocalRuntimeEnv = ({
  cwd = process.cwd(),
  env = process.env,
  branchName,
} = {}) => {
  const profile = resolveLocalRuntimeProfile({ cwd, env, branchName });
  const sources = new Map(Object.keys(env).map((key) => [key, BRANCH_ENV_SOURCE_PROCESS]));
  const sharedEnvFiles = profile.envFiles.slice(0, -1);
  const branchEnvFile = profile.envFiles.at(-1);

  for (const sharedEnvFile of sharedEnvFiles) {
    applyEnvEntries(env, sources, readEnvFileEntries(sharedEnvFile), BRANCH_ENV_SOURCE_SHARED);
  }

  if (branchEnvFile) {
    applyEnvEntries(env, sources, readEnvFileEntries(branchEnvFile), BRANCH_ENV_SOURCE_BRANCH);
  }

  if (shouldApplyBranchDefault(sources, 'TLD_RUNTIME_SCOPE')) {
    setEnvValue(env, sources, 'TLD_RUNTIME_SCOPE', profile.scopeName, BRANCH_ENV_SOURCE_DEFAULT);
  }
  if (shouldApplyBranchDefault(sources, 'TLD_DATA_DIR')) {
    setEnvValue(env, sources, 'TLD_DATA_DIR', profile.dataDir, BRANCH_ENV_SOURCE_DEFAULT);
  }
  if (shouldApplyBranchDefault(sources, 'TLD_SEED_DB_PATH')) {
    setEnvValue(env, sources, 'TLD_SEED_DB_PATH', profile.seedDbPath, BRANCH_ENV_SOURCE_DEFAULT);
  }
  if (shouldApplyBranchDefault(sources, 'PORT')) {
    setEnvValue(env, sources, 'PORT', profile.serverPort, BRANCH_ENV_SOURCE_DEFAULT);
  }
  if (shouldApplyBranchDefault(sources, 'VITE_DEV_PORT')) {
    setEnvValue(env, sources, 'VITE_DEV_PORT', profile.clientPort, BRANCH_ENV_SOURCE_DEFAULT);
  }

  const resolvedPort = Number(env.PORT ?? profile.serverPort) || profile.serverPort;
  if (shouldApplyBranchDefault(sources, 'VITE_API_BASE')) {
    setEnvValue(env, sources, 'VITE_API_BASE', `http://${LOCALHOST_API_HOST}:${resolvedPort}`, BRANCH_ENV_SOURCE_DEFAULT);
  }
  if (!String(env.TLD_ENV ?? '').trim()) {
    setEnvValue(env, sources, 'TLD_ENV', 'development', BRANCH_ENV_SOURCE_DEFAULT);
  }

  ensureMirroredEnvValue(env, sources, 'TLD_DATA_DIR', 'THG_DATA_DIR');
  ensureMirroredEnvValue(env, sources, 'TLD_SEED_DB_PATH', 'THG_SEED_DB_PATH');

  return {
    ...profile,
    serverPort: Number(env.PORT ?? profile.serverPort) || profile.serverPort,
    clientPort: Number(env.VITE_DEV_PORT ?? profile.clientPort) || profile.clientPort,
    dataDir: String(env.TLD_DATA_DIR ?? profile.dataDir),
    seedDbPath: String(env.TLD_SEED_DB_PATH ?? profile.seedDbPath),
    apiBase: String(env.VITE_API_BASE ?? profile.apiBase).replace(/\/+$/, ''),
  };
};
