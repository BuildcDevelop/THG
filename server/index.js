import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import {
  GameRuleError,
  authenticatePlayer,
  conquerVillage,
  getVillageSnapshot,
  issueArmyCommand,
  listAdminPlayers,
  listBattleReports,
  listPlayerLeaderboard,
  recruitUnits,
  runGameTick,
  startBuildingUpgrade,
} from './gameService.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const tickSchedule = process.env.GAME_TICK_SCHEDULE ?? '*/5 * * * * *';

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'thg-backend',
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/v1/auth/login', (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    const data = authenticatePlayer(username, password);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/admin/players', (_req, res, next) => {
  try {
    runGameTick();

    res.json({
      ok: true,
      data: listAdminPlayers(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/state', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const villageIdRaw = req.query.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const state = getVillageSnapshot(username, Number.isFinite(villageId) ? villageId : null);

    res.json({
      ok: true,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/ranking', (_req, res, next) => {
  try {
    runGameTick();
    res.json({
      ok: true,
      data: listPlayerLeaderboard(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/reports', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.query.username ?? 'Hayato').trim() || 'Hayato';
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const data = listBattleReports(username, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/buildings/:buildingId/upgrade', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const buildingId = String(req.params.buildingId).trim();
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const result = startBuildingUpgrade(username, buildingId, normalizedVillageId);
    const state = getVillageSnapshot(username, normalizedVillageId);

    res.status(201).json({
      ok: true,
      result,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/units/:unitId/recruit', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const unitId = String(req.params.unitId).trim();
    const amount = Number(req.body?.amount ?? 1);
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const result = recruitUnits(username, unitId, amount, normalizedVillageId);
    const state = getVillageSnapshot(username, normalizedVillageId);

    res.status(201).json({
      ok: true,
      result,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/villages/:villageId/conquer', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const villageId = Number(String(req.params.villageId ?? '').trim());
    const result = conquerVillage(username, villageId);
    const state = getVillageSnapshot(username, Number.isFinite(villageId) ? villageId : null);

    res.status(201).json({
      ok: true,
      result,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/army/command', (req, res, next) => {
  try {
    runGameTick();
    const username = String(req.body?.username ?? 'Hayato').trim() || 'Hayato';
    const villageIdRaw = req.body?.villageId;
    const villageId =
      villageIdRaw == null || String(villageIdRaw).trim() === ''
        ? null
        : Number(String(villageIdRaw).trim());
    const normalizedVillageId = Number.isFinite(villageId) ? villageId : null;
    const result = issueArmyCommand(username, req.body ?? {}, normalizedVillageId);
    const state = getVillageSnapshot(username, normalizedVillageId);

    res.status(201).json({
      ok: true,
      result,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/tick', (_req, res, next) => {
  try {
    const tick = runGameTick();
    res.json({
      ok: true,
      tick,
    });
  } catch (error) {
    next(error);
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

const cronTask = cron.schedule(tickSchedule, () => {
  try {
    runGameTick();
  } catch (error) {
    console.error('[backend] Tick failure:', error);
  }
});

app.listen(port, () => {
  console.log(`[backend] Listening on http://localhost:${port}`);
  console.log(`[backend] Tick schedule: ${tickSchedule}`);
});

process.on('SIGINT', () => {
  cronTask.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cronTask.stop();
  process.exit(0);
});
