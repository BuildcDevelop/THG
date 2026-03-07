import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import {
  adjustResearchProjectAcademics,
  acceptKingdomInvite,
  archivePlayerNotification,
  cancelArmyCommand,
  cancelBuildingUpgrade,
  cancelMarketLogistics,
  cancelRecruitment,
  configureMarketGuildAutomation,
  createPlayerAccount,
  createKingdom,
  deletePlayerNotification,
  GameRuleError,
  authenticatePlayer,
  createAbandonedVillages,
  conquerVillage,
  getBattleReportSummary,
  getPlayerNotificationSummary,
  getVillageSnapshot,
  getWorldMapSnapshot,
  invitePlayerToKingdom,
  issueArmyCommand,
  hireAcademics,
  hireMercenaryContract,
  kickKingdomMember,
  leaveKingdom,
  listPlayerNotifications,
  listAdminPlayers,
  listBattleReports,
  listPlayerWorlds,
  listPlayerLeaderboard,
  markAllPlayerNotificationsRead,
  markPlayerNotificationRead,
  rejectKingdomInvite,
  recallKnight,
  renameVillage,
  recruitUnits,
  restartVillageProgress,
  runGameTick,
  sendMarketLogistics,
  startResearchProject,
  startBuildingUpgrade,
  transferKingdomLeadership,
  unarchivePlayerNotification,
} from './gameService.js';
import {
  archiveCommunicationThread,
  blockPlayer,
  COMMUNICATION_AVATAR_PUBLIC_PATH,
  COMMUNICATION_AVATAR_STORAGE_DIR,
  createNotificationShare,
  deleteCommunicationMessage,
  getNotificationSharePreview,
  listCommunicationInbox,
  listCommunicationSummary,
  listCommunicationTokenSuggestions,
  openCommunicationThread,
  removeFriend,
  respondFriendRequest,
  sendCommunicationMessage,
  sendFriendRequest,
  setCommunicationAvatar,
  setCommunicationAvatarFromDataUrl,
  setCommunicationUiState,
  runCommunicationRetentionCleanup,
  unblockPlayer,
} from './communicationService.js';
import {
  SESSION_COOKIE_NAME,
  clearSessionFromRequest,
  createSessionForUsername,
  resolveSessionFromRequest,
} from './sessionService.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const tickSchedule = process.env.GAME_TICK_SCHEDULE ?? '*/5 * * * * *';
const versionLabel = String(process.env.TLD_VERSION_LABEL ?? process.env.VITE_GAME_VERSION ?? 'build-0.1.09').trim() || 'build-0.1.09';
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
const runtimeEnv = String(process.env.TLD_ENV ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
const isProductionRuntime = runtimeEnv === 'production';
const corsOriginRaw = String(process.env.CORS_ORIGIN ?? '').trim();
const resolvedCorsOrigin =
  corsOriginRaw && corsOriginRaw !== '*'
    ? corsOriginRaw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : null;
const localCorsOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
if (isProductionRuntime && !resolvedCorsOrigin) {
  throw new Error("[backend] V produkci musi byt nastavene CORS_ORIGIN.");
}
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/register']);

const resolveRequestIpAddress = (request) => {
  const forwardedForHeader = request?.headers?.['x-forwarded-for'];
  if (typeof forwardedForHeader === 'string' && forwardedForHeader.trim()) {
    return forwardedForHeader.split(',')[0].trim();
  }
  if (Array.isArray(forwardedForHeader) && forwardedForHeader.length > 0) {
    const first = String(forwardedForHeader[0] ?? '').trim();
    if (first) {
      return first;
    }
  }
  return String(request?.ip ?? '').trim() || null;
};

const normalizeComparableUsername = (value) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('cs-CZ');

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
const parseOptionalPositiveNumber = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};
const parseOptionalBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
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
          credentials: true,
        }
      : {
          origin: (origin, callback) => {
            if (!origin) {
              callback(null, true);
              return;
            }
            callback(null, localCorsOrigins.has(origin));
          },
          credentials: true,
        },
  ),
);
app.use(express.json({ limit: '2mb' }));
app.use(
  COMMUNICATION_AVATAR_PUBLIC_PATH,
  express.static(COMMUNICATION_AVATAR_STORAGE_DIR, {
    etag: true,
    immutable: true,
    maxAge: isProductionRuntime ? '30d' : 0,
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', isProductionRuntime ? 'public, max-age=2592000, immutable' : 'no-cache');
    },
  }),
);

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
    const session = await executeWithWriteOperation(() =>
      createSessionForUsername(data.username, {
        userAgent: req.headers['user-agent'],
        ipAddress: resolveRequestIpAddress(req),
      }),
    );
    res.cookie(SESSION_COOKIE_NAME, session.token, session.cookieOptions);

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
    const session = await executeWithWriteOperation(() =>
      createSessionForUsername(data.username, {
        userAgent: req.headers['user-agent'],
        ipAddress: resolveRequestIpAddress(req),
      }),
    );
    res.cookie(SESSION_COOKIE_NAME, session.token, session.cookieOptions);

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

    const data = await executeWithReadOperation(() => listPlayerWorlds(username));

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
    const data = await executeWithReadOperation(() => listAdminPlayers());

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
    const includeWorldMap = parseOptionalBoolean(req.query.includeWorldMap, false);
    const villageIdRaw = req.query.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const resolvedState = await executeWithReadOperation(() =>
      getVillageSnapshot(username, normalizedVillageId, worldId, spawnDirection, { includeWorldMap }),
    );

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
    const data = await executeWithReadOperation(() => listPlayerLeaderboard(worldId));

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
    const data = await executeWithReadOperation(() =>
      listBattleReports(
        username,
        {
          page: Number.isFinite(page) ? page : 1,
          pageSize: Number.isFinite(pageSize) ? pageSize : 20,
        },
        worldId,
      ),
    );

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/auth/logout', async (req, res, next) => {
  try {
    await executeWithWriteOperation(() => clearSessionFromRequest(req));
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.status(201).json({
      ok: true,
      data: {
        loggedOut: true,
      },
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.use('/api/v1', (req, _res, next) => {
  if (PUBLIC_AUTH_PATHS.has(String(req.path ?? '').trim())) {
    next();
    return;
  }

  const session = resolveSessionFromRequest(req);
  if (!session) {
    next(new GameRuleError('Neplatne prihlasovaci udaje.', 401));
    return;
  }

  const bodyUsernameRaw =
    req.body && typeof req.body === 'object' && 'username' in req.body ? req.body.username : null;
  const queryUsernameRaw =
    req.query && typeof req.query === 'object' && 'username' in req.query ? req.query.username : null;

  const bodyUsername = String(bodyUsernameRaw ?? '').trim();
  const queryUsername = String(queryUsernameRaw ?? '').trim();
  const sessionComparable = normalizeComparableUsername(session.username);

  if (bodyUsername && normalizeComparableUsername(bodyUsername) !== sessionComparable) {
    next(new GameRuleError('Ucet v requestu neodpovida prihlasene session.', 403));
    return;
  }

  if (queryUsername && normalizeComparableUsername(queryUsername) !== sessionComparable) {
    next(new GameRuleError('Ucet v requestu neodpovida prihlasene session.', 403));
    return;
  }

  if (req.query && typeof req.query === 'object') {
    req.query.username = session.username;
  }
  if (req.body && typeof req.body === 'object') {
    req.body.username = session.username;
  }

  req.authSession = session;
  next();
});

app.get('/api/v1/activity', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.query.worldId);
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 25);
    const includeArchived = String(req.query.includeArchived ?? '').trim();
    const data = await executeWithWriteOperation(() =>
      listPlayerNotifications(
        username,
        {
          page: Number.isFinite(page) ? page : 1,
          pageSize: Number.isFinite(pageSize) ? pageSize : 25,
          includeArchived,
        },
        worldId,
      ),
    );

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/activity/read-all', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() => markAllPlayerNotificationsRead(username, worldId));
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/activity/:notificationId/read', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const notificationId = Number(String(req.params.notificationId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() =>
      markPlayerNotificationRead(username, notificationId, worldId),
    );
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/activity/:notificationId/archive', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const notificationId = Number(String(req.params.notificationId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() =>
      archivePlayerNotification(username, notificationId, worldId),
    );
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/activity/:notificationId/unarchive', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const notificationId = Number(String(req.params.notificationId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() =>
      unarchivePlayerNotification(username, notificationId, worldId),
    );
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/activity/:notificationId/delete', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const notificationId = Number(String(req.params.notificationId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() =>
      deletePlayerNotification(username, notificationId, worldId),
    );
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/communication', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Query parametr 'username' je povinny.", 400);
    }
    const threadId = parseOptionalPositiveNumber(req.query.threadId);
    const beforeMessageId = parseOptionalPositiveNumber(req.query.beforeMessageId);
    const threadLimit = parseOptionalPositiveNumber(req.query.threadLimit);
    const messageLimit = parseOptionalPositiveNumber(req.query.messageLimit);
    const search = String(req.query.search ?? '').trim();
    const data = await executeWithReadOperation(() =>
      listCommunicationInbox(username, {
        threadId,
        beforeMessageId,
        threadLimit,
        messageLimit,
        search,
      }),
    );

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/communication/summary', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Query parametr 'username' je povinny.", 400);
    }

    const data = await executeWithReadOperation(() => listCommunicationSummary(username));
    res.json({
      ok: true,
      data: {
        serverTime: data.serverTime,
        summary: data.summary,
      },
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/communication/suggestions', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Query parametr 'username' je povinny.", 400);
    }
    const tokenType = String(req.query.tokenType ?? '').trim().toLowerCase();
    const query = String(req.query.query ?? '').trim();
    const limit = parseOptionalPositiveNumber(req.query.limit);
    const data = await executeWithReadOperation(() =>
      listCommunicationTokenSuggestions(username, {
        tokenType,
        query,
        limit,
      }),
    );
    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/notification/share', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const notificationId = Number(req.body?.notificationId ?? 0);
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const result = await executeWithWriteOperation(() =>
      createNotificationShare(username, notificationId, worldId),
    );
    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/communication/notification/share/:shareToken', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Query parametr 'username' je povinny.", 400);
    }
    const shareToken = String(req.params.shareToken ?? '').trim();
    if (!shareToken) {
      throw new GameRuleError("Parametr 'shareToken' je povinny.", 400);
    }
    const data = await executeWithReadOperation(() => getNotificationSharePreview(username, shareToken));
    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/thread/open', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const payload = {
      threadId: parseOptionalPositiveNumber(req.body?.threadId),
      targetUsername: String(req.body?.targetUsername ?? '').trim() || null,
    };
    const result = await executeWithWriteOperation(() => openCommunicationThread(username, payload));
    const data = await executeWithReadOperation(() =>
      listCommunicationInbox(username, {
        threadId: result.threadId,
      }),
    );

    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/thread/message', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const payload = {
      threadId: parseOptionalPositiveNumber(req.body?.threadId),
      targetUsername: String(req.body?.targetUsername ?? '').trim() || null,
      body: String(req.body?.body ?? ''),
      payload: req.body?.payload ?? null,
    };
    const result = await executeWithWriteOperation(() => sendCommunicationMessage(username, payload));
    const data = await executeWithReadOperation(() =>
      listCommunicationInbox(username, {
        threadId: result.threadId,
      }),
    );

    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/thread/:threadId/archive', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const threadId = Number(req.params.threadId);
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => archiveCommunicationThread(username, threadId));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/message/:messageId/delete', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const messageId = Number(req.params.messageId);
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => deleteCommunicationMessage(username, messageId));
    const data = await executeWithReadOperation(() =>
      listCommunicationInbox(username, {
        threadId: result.threadId,
      }),
    );
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/friends/request', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    if (!username || !targetUsername) {
      throw new GameRuleError("Pole 'username' a 'targetUsername' jsou povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => sendFriendRequest(username, targetUsername));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/friends/request/:requestId/respond', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const requestId = Number(req.params.requestId);
    const action = String(req.body?.action ?? '').trim().toLowerCase();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => respondFriendRequest(username, requestId, action));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/friends/remove', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    if (!username || !targetUsername) {
      throw new GameRuleError("Pole 'username' a 'targetUsername' jsou povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => removeFriend(username, targetUsername));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/block', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    if (!username || !targetUsername) {
      throw new GameRuleError("Pole 'username' a 'targetUsername' jsou povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => blockPlayer(username, targetUsername));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/unblock', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const targetUsername = String(req.body?.targetUsername ?? '').trim();
    if (!username || !targetUsername) {
      throw new GameRuleError("Pole 'username' a 'targetUsername' jsou povinne.", 400);
    }
    const result = await executeWithWriteOperation(() => unblockPlayer(username, targetUsername));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/avatar', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const avatarDataUrl = req.body?.avatarDataUrl ?? null;
    const avatarUrl = req.body?.avatarUrl ?? null;
    const result = await executeWithWriteOperation(() => {
      const normalizedAvatarDataUrl = String(avatarDataUrl ?? '').trim();
      if (normalizedAvatarDataUrl) {
        return setCommunicationAvatarFromDataUrl(username, normalizedAvatarDataUrl);
      }
      return setCommunicationAvatar(username, avatarUrl);
    });
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/communication/ui-state', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw new GameRuleError("Pole 'username' je povinne.", 400);
    }
    const state = req.body?.state ?? {};
    const result = await executeWithWriteOperation(() => setCommunicationUiState(username, state));
    const data = await executeWithReadOperation(() => listCommunicationInbox(username));
    res.status(201).json({
      ok: true,
      result,
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
        'center',
        { includeWorldMap: false },
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

const handleVillageRenameRequest = async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const name = String(req.body?.name ?? '').trim();
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId ?? req.params?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = renameVillage(username, name, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
};

app.post('/api/v1/villages/rename', handleVillageRenameRequest);
app.post('/api/v1/village/rename', handleVillageRenameRequest);
app.post('/api/v1/villages/:villageId/rename', handleVillageRenameRequest);
app.post('/api/v1/village/:villageId/rename', handleVillageRenameRequest);

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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/army/command/:movementId/cancel', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const movementId = Number(String(req.params.movementId ?? '').trim());
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = cancelArmyCommand(username, movementId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/research/academics/hire', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
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
      const result = hireAcademics(username, amount, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/research/project/start', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const researchId = String(req.body?.researchId ?? '').trim();
    const academics = Number(req.body?.academics ?? 1);
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = startResearchProject(username, researchId, academics, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/research/project/academics/adjust', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const researchId = String(req.body?.researchId ?? '').trim();
    const delta = Number(req.body?.delta ?? 0);
    const worldId = parseOptionalWorldId(req.body?.worldId);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const payload = await executeWithWriteOperation(() => {
      runGameTick();
      const result = adjustResearchProjectAcademics(
        username,
        researchId,
        delta,
        normalizedVillageId,
        worldId,
      );
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/mercenaries/hire', async (req, res, next) => {
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
      const result = hireMercenaryContract(username, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/market/logistics/send', async (req, res, next) => {
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
      const result = sendMarketLogistics(username, req.body ?? {}, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.get('/api/v1/activity/summary', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.query.worldId);
    const data = await executeWithReadOperation(() => getPlayerNotificationSummary(username, worldId));
    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/reports/summary', async (req, res, next) => {
  try {
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const worldId = parseOptionalWorldId(req.query.worldId);
    const data = await executeWithReadOperation(() => getBattleReportSummary(username, worldId));

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.get('/api/v1/world-map', async (req, res, next) => {
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
    const worldMapSnapshot = await executeWithReadOperation(() =>
      getWorldMapSnapshot(username, normalizedVillageId, worldId, spawnDirection),
    );

    res.json({
      ok: true,
      data: worldMapSnapshot,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/market/logistics/:routeId/cancel', async (req, res, next) => {
  try {
    const routeId = Number(String(req.params.routeId ?? '').trim());
    if (!Number.isFinite(routeId) || routeId <= 0) {
      throw new GameRuleError('Neplatne routeId.', 400);
    }
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
      const result = cancelMarketLogistics(username, routeId, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
      return { result, state };
    });

    res.status(200).json({
      ok: true,
      result: payload.result,
      data: payload.state,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.post('/api/v1/market/guild/configure', async (req, res, next) => {
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
      const result = configureMarketGuildAutomation(username, req.body ?? {}, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
      return { result, state };
    });

    res.status(200).json({
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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

app.post('/api/v1/kingdom/transfer-leadership', async (req, res, next) => {
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
      const result = transferKingdomLeadership(username, targetUsername, normalizedVillageId, worldId);
      const state = getVillageSnapshot(username, normalizedVillageId, worldId, 'center', { includeWorldMap: false });
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
    const tick = await executeWithWriteOperation(() => {
      const nextTick = runGameTick();
      runCommunicationRetentionCleanup();
      return nextTick;
    });
    res.json({
      ok: true,
      tick,
    });
  } catch (error) {
    next(toGameRuleError(error));
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      ok: false,
      error: 'Odeslany payload je prilis velky.',
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      ok: false,
      error: 'Neplatny JSON payload.',
    });
    return;
  }

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
      runCommunicationRetentionCleanup();
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

