import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import {
  acceptKingdomInvite,
  cancelBuildingUpgrade,
  cancelRecruitment,
  createPlayerAccount,
  createKingdom,
  GameRuleError,
  authenticatePlayer,
  createAbandonedVillages,
  conquerVillage,
  getVillageSnapshot,
  invitePlayerToKingdom,
  issueArmyCommand,
  kickKingdomMember,
  leaveKingdom,
  listAdminPlayers,
  listBattleReports,
  listPlayerWorlds,
  listPlayerLeaderboard,
  rejectKingdomInvite,
  recallKnight,
  recruitUnits,
  restartVillageProgress,
  runGameTick,
  startBuildingUpgrade,
} from './gameService.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const tickSchedule = process.env.GAME_TICK_SCHEDULE ?? '*/5 * * * * *';
const versionLabel = String(process.env.TLD_VERSION_LABEL ?? process.env.VITE_GAME_VERSION ?? 'build-0.1.05').trim() || 'build-0.1.05';
const buildId =
  String(process.env.TLD_BUILD_ID ?? process.env.NETLIFY_COMMIT_REF ?? process.env.COMMIT_REF ?? versionLabel).trim() ||
  versionLabel;
const updateStatusRaw = String(process.env.TLD_UPDATE_STATUS ?? process.env.TLD_UPDATE_IN_PROGRESS ?? '')
  .trim()
  .toLowerCase();
const isUpdateInProgress = ['1', 'true', 'yes', 'on', 'building', 'deploying', 'updating', 'maintenance'].includes(
  updateStatusRaw,
);
const isServerlessRuntime = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
);
const corsOriginRaw = String(process.env.CORS_ORIGIN ?? '').trim();
const resolvedCorsOrigin =
  corsOriginRaw && corsOriginRaw !== '*'
    ? corsOriginRaw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : null;

const executeWithReadOperation = async (operation) => operation();
const executeWithWriteOperation = async (operation) => operation();

const parseOptionalWorldId = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
};
const parseOptionalSpawnDirection = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return 'center';
  }
  return ['center', 'north', 'east', 'south', 'west'].includes(normalized) ? normalized : 'center';
};

const toGameRuleError = (error) => {
  if (error instanceof GameRuleError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error ?? 'Interni chyba serveru.');
  if (message.includes('Neplatne prihlasovaci udaje')) {
    return new GameRuleError('Neplatne prihlasovaci udaje.', 401);
  }
  if (message.includes('Tento ucet nema zalozene leno')) {
    return new GameRuleError('Tento ucet nema zalozene leno.', 404);
  }
  if (message.includes("Hrac '") && message.includes('neexistuje')) {
    return new GameRuleError(message, 404);
  }
  if (message.includes("Hrac '") && message.includes('nema zalozenou osadu')) {
    return new GameRuleError(message, 404);
  }
  if (message.includes('Pro osadu chybi zaznam surovin')) {
    return new GameRuleError('Pro osadu chybi zaznam surovin.', 500);
  }
  return new GameRuleError(message, 500);
};

app.use(
  cors(
    resolvedCorsOrigin
      ? {
          origin: (origin, callback) => {
            if (!origin) {
              callback(null, true);
              return;
            }

            callback(null, resolvedCorsOrigin.includes(origin));
          },
        }
      : undefined,
  ),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'tld-backend',
    serverTime: new Date().toISOString(),
    deployment: {
      provider: process.env.NETLIFY ? 'netlify' : 'node',
      versionLabel,
      buildId,
      isUpdating: isUpdateInProgress,
      status: updateStatusRaw || 'idle',
    },
    features: {
      storage: 'sqlite',
      backendMode: 'self-hosted',
    },
  });
});

app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    const data = await executeWithReadOperation(() => authenticatePlayer(username, password));

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/auth/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    const data = await executeWithWriteOperation(() => createPlayerAccount(username, password));

    res.status(201).json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/worlds', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Query parametr 'username' je povinny.", 400);
    }

    const data = await executeWithWriteOperation(() => {
      runGameTick();
      return listPlayerWorlds(username);
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/admin/players', async (_req, res, next) => {
  try {
    const data = await executeWithWriteOperation(() => {
      runGameTick();
      return listAdminPlayers();
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/state', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.query.worldId);
    const spawnDirection = parseOptionalSpawnDirection(req.query.spawnDirection);
    const villageIdRaw = req.query.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const resolvedState = await executeWithWriteOperation(() => {
      runGameTick();
      return getVillageSnapshot(username, normalizedVillageId, worldId, spawnDirection);
    });

    res.json({
      ok: true,
      data: resolvedState,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/ranking', async (req, res, next) => {
  try {
    const worldId = parseOptionalWorldId(req.query.worldId);
    const data = await executeWithWriteOperation(() => {
      runGameTick();
      return listPlayerLeaderboard(worldId);
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/reports', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.query.worldId);
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const data = await executeWithWriteOperation(() => {
      runGameTick();
      return listBattleReports(username, {
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      }, worldId);
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/buildings/:buildingId/upgrade', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const buildingId = String(req.params.buildingId).trim();
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = startBuildingUpgrade(username, buildingId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/buildings/upgrades/:upgradeId/cancel', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const upgradeId = Number(String(req.params.upgradeId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = cancelBuildingUpgrade(username, upgradeId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/units/:unitId/recruit', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const unitId = String(req.params.unitId).trim();
    const amount = Number(req.body?.amount ?? 1);
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = recruitUnits(username, unitId, amount, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/units/recruitments/:recruitmentId/cancel', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const recruitmentId = Number(String(req.params.recruitmentId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = cancelRecruitment(username, recruitmentId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/townhall/knight/recall', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = recallKnight(username, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/villages/:villageId/conquer', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const villageId = Number(String(req.params.villageId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const requestedVillageIdRaw = req.body?.villageId;
    const requestedVillageId =
      requestedVillageIdRaw == null || String(requestedVillageIdRaw).trim() === ''
        ? null
        : Number(String(requestedVillageIdRaw).trim());
    const normalizedRequestedVillageId = Number.isFinite(requestedVillageId) ? requestedVillageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = conquerVillage(username, villageId, normalizedRequestedVillageId, worldId);
      const state = getVillageSnapshot(
        username,
        normalizedRequestedVillageId ?? (Number.isFinite(villageId) ? villageId : null),
        worldId,
      );
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/villages/restart', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = restartVillageProgress(username, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/admin/abandoned-villages/create', async (req, res, next) => {
  try {
    const count = Number(req.body?.count ?? 1);
    const result = await executeWithWriteOperation(() => {
      runGameTick();
      return createAbandonedVillages(count);
    });

    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/army/command', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = issueArmyCommand(username, req.body ?? {}, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/create', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const kingdomName = String(req.body?.kingdomName ?? '').trim();
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = createKingdom(username, kingdomName, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/invite', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = invitePlayerToKingdom(username, targetUsername, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/invite/:inviteId/accept', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const inviteId = Number(String(req.params.inviteId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = acceptKingdomInvite(username, inviteId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/invite/:inviteId/reject', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const inviteId = Number(String(req.params.inviteId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = rejectKingdomInvite(username, inviteId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/leave', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = leaveKingdom(username, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/kingdom/kick', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = kickKingdomMember(username, targetUsername, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId);
      return { result, state };
    });

    res.status(201).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/tick', async (_req, res, next) => {
  try {
    const tick = await executeWithWriteOperation(() => runGameTick());
    res.json({
      ok: true,
      tick,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof GameRuleError) {
    res.status(error.statusCode ?? 400).json({
      ok: false,
      error: error.message,
    });
    return;
  }

  console.error('[backend] Unhandled error:', error);
  res.status(500).json({
    ok: false,
    error: 'Interni chyba serveru.',
  });
});

let cronTask = null;

if (!isServerlessRuntime) {
  cronTask = cron.schedule(tickSchedule, () => {
    try {
      runGameTick();
    } catch (error) {
      console.error('[backend] Tick failure:', error);
    }
  });

  app.listen(port, () => {
    console.log(`[backend] Listening on http://localhost:${port}`);
    console.log(`[backend] Tick schedule: ${tickSchedule}`);
    console.log('[backend] Storage mode: sqlite');
  });

  process.on('SIGINT', () => {
    cronTask?.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cronTask?.stop();
    process.exit(0);
  });
}

export { app };
export default app;
