import { db } from './db.js';
import {
  extractSqliteSnapshot,
  applySqliteSnapshot,
  createSnapshotPatch,
  isSnapshotPatchEmpty,
} from './sqliteSnapshot.js';
import {
  getEngineSnapshotConvex,
  applyEngineSnapshotPatchConvex,
  replaceEngineSnapshotConvex,
  isConvexConfigured,
} from './convexService.js';

const SNAPSHOT_CONFLICT_TOKEN = 'SNAPSHOT_CONFLICT';
const DEFAULT_MAX_RETRIES = 5;

const isSnapshotConflictError = (error) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes(SNAPSHOT_CONFLICT_TOKEN);
};

const requireConvexConfigured = () => {
  if (!isConvexConfigured()) {
    throw new Error('Convex neni nakonfigurovany pro full public rezim.');
  }
};

export const runWithConvexSnapshotRead = async (operation) => {
  requireConvexConfigured();
  const engine = await getEngineSnapshotConvex();
  applySqliteSnapshot(db, engine.snapshot);
  return operation();
};

export const runWithConvexSnapshotPersistence = async (
  operation,
  options = {},
) => {
  requireConvexConfigured();
  const maxRetries = Number.isInteger(options.maxRetries)
    ? Math.max(1, Number(options.maxRetries))
    : DEFAULT_MAX_RETRIES;

  let lastConflictError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const engine = await getEngineSnapshotConvex();
    applySqliteSnapshot(db, engine.snapshot);

    let result;
    try {
      result = await operation();
    } catch (error) {
      throw error;
    }

    const nextSnapshot = extractSqliteSnapshot(db);
    const snapshotPatch = createSnapshotPatch(engine.snapshot, nextSnapshot);

    if (isSnapshotPatchEmpty(snapshotPatch)) {
      return result;
    }

    try {
      await applyEngineSnapshotPatchConvex(snapshotPatch, Number(engine.revision));
      return result;
    } catch (error) {
      if (!isSnapshotConflictError(error)) {
        try {
          await replaceEngineSnapshotConvex(nextSnapshot, Number(engine.revision));
          return result;
        } catch (fallbackError) {
          if (isSnapshotConflictError(fallbackError) && attempt < maxRetries) {
            lastConflictError = fallbackError;
            continue;
          }
          throw fallbackError;
        }
      }
      if (isSnapshotConflictError(error) && attempt < maxRetries) {
        lastConflictError = error;
        continue;
      }
      throw error;
    }
  }

  throw (
    lastConflictError ??
    new Error('Nepodarilo se commitnout snapshot do Convex po vycerpani retry.')
  );
};
