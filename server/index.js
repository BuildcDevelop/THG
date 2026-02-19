import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import {
  acceptKingdomInvite,
  cancelBuildingUpgrade,
  cancelRecruitment,
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
  listPlayerLeaderboard,
  rejectKingdomInvite,
  recallKnight,
  recruitUnits,
  restartVillageProgress,
  runGameTick,
  startBuildingUpgrade,
} from './gameService.js';
import {
  authenticatePlayerConvex,
  getVillageSnapshotConvex,
  isConvexConfigured,
} from './convexService.js';
import {
  runWithConvexSnapshotPersistence,
  runWithConvexSnapshotRead,
} from './convexSnapshotRuntime.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const tickSchedule = process.env.GAME_TICK_SCHEDULE ?? '*/5 * * * * *';
const useConvexAuth = String(process.env.USE_CONVEX_AUTH ?? '').trim().toLowerCase() === 'true';
const useConvexState = String(process.env.USE_CONVEX_STATE ?? '').trim().toLowerCase() === 'true';
const useConvexFull = String(process.env.USE_CONVEX_FULL ?? '').trim().toLowerCase() === 'true';
const isServerlessRuntime = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
);

const executeWithConvexRead = async (operation) => {
  if (!useConvexFull) {
    return operation();
  }
  return runWithConvexSnapshotRead(operation);
};

const executeWithConvexPersistence = async (operation) => {
  if (!useConvexFull) {
    return operation();
  }
  return runWithConvexSnapshotPersistence(operation);
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

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'thg-backend',
    serverTime: new Date().toISOString(),
    features: {
      useConvexAuth,
      useConvexState,
      useConvexFull,
      convexConfigured: isConvexConfigured(),
    },
  });
});

app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    const data = useConvexFull
      ? await executeWithConvexRead(() => authenticatePlayer(username, password))
      : useConvexAuth
        ? await authenticatePlayerConvex(username, password)
        : authenticatePlayer(username, password);

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
    const data = useConvexFull
      ? await executeWithConvexRead(() => listAdminPlayers())
      : await executeWithConvexPersistence(() => {
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
    const villageIdRaw = req.query.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const resolvedState = useConvexFull
      ? await executeWithConvexRead(() => getVillageSnapshot(username, normalizedVillageId))
      : useConvexState
        ? await getVillageSnapshotConvex(username, normalizedVillageId)
        : (() => {
            runGameTick();
            return getVillageSnapshot(username, normalizedVillageId);
          })();

    res.json({
      ok: true,
      data: resolvedState,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/ranking', async (_req, res, next) => {
  try {
    const data = useConvexFull
      ? await executeWithConvexRead(() => listPlayerLeaderboard())
      : await executeWithConvexPersistence(() => {
          runGameTick();
          return listPlayerLeaderboard();
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
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const data = useConvexFull
      ? await executeWithConvexRead(() =>
          listBattleReports(username, {
            page: Number.isFinite(page) ? page : 1,
            pageSize: Number.isFinite(pageSize) ? pageSize : 20,
          }),
        )
      : await executeWithConvexPersistence(() => {
          runGameTick();
          return listBattleReports(username, {
            page: Number.isFinite(page) ? page : 1,
            pageSize: Number.isFinite(pageSize) ? pageSize : 20,
          });
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = startBuildingUpgrade(username, buildingId, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = cancelBuildingUpgrade(username, upgradeId, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = recruitUnits(username, unitId, amount, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = cancelRecruitment(username, recruitmentId, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = recallKnight(username, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = conquerVillage(username, villageId);
      const state = getVillageSnapshot(username, Number.isFinite(villageId) ? villageId : null);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = restartVillageProgress(username);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const result = await executeWithConvexPersistence(() => {
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = issueArmyCommand(username, req.body ?? {}, normalizedVillageId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = createKingdom(username, kingdomName);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = invitePlayerToKingdom(username, targetUsername);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = acceptKingdomInvite(username, inviteId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = rejectKingdomInvite(username, inviteId);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = leaveKingdom(username);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithConvexPersistence(() => {
      runGameTick();
      const result = kickKingdomMember(username, targetUsername);
      const state = getVillageSnapshot(username, normalizedVillageId);
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
    const tick = await executeWithConvexPersistence(() => runGameTick());
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
  if (!useConvexFull) {
    cronTask = cron.schedule(tickSchedule, () => {
      try {
        runGameTick();
      } catch (error) {
        console.error('[backend] Tick failure:', error);
      }
    });
  }

  app.listen(port, () => {
    console.log(`[backend] Listening on http://localhost:${port}`);
    console.log(`[backend] Tick schedule: ${tickSchedule}`);
    console.log(`[backend] USE_CONVEX_AUTH=${useConvexAuth}`);
    console.log(`[backend] USE_CONVEX_STATE=${useConvexState}`);
    console.log(`[backend] USE_CONVEX_FULL=${useConvexFull}`);
    if ((useConvexAuth || useConvexState || useConvexFull) && !isConvexConfigured()) {
      console.warn('[backend] Convex flags are enabled but CONVEX_URL is not set.');
    }
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
