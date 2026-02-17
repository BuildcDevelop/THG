import { ConvexHttpClient } from 'convex/browser';

const convexUrl = String(process.env.CONVEX_URL ?? '').trim();
const convexDeployKey = String(process.env.CONVEX_DEPLOY_KEY ?? '').trim();

let cachedClient = null;

const requireClient = () => {
  if (!convexUrl) {
    throw new Error('Convex neni nakonfigurovany. Nastav CONVEX_URL.');
  }

  if (!cachedClient) {
    cachedClient = new ConvexHttpClient(convexUrl);
    if (convexDeployKey) {
      cachedClient.setAdminAuth(convexDeployKey);
    }
  }

  return cachedClient;
};

export const isConvexConfigured = () => Boolean(convexUrl);

export const authenticatePlayerConvex = async (username, password) => {
  const client = requireClient();
  return client.query('game_reads.js:authenticatePlayer', {
    username,
    password,
  });
};

export const getVillageSnapshotConvex = async (username, villageId = null) => {
  const client = requireClient();
  return client.query('game_reads.js:getVillageSnapshot', {
    username,
    villageId: villageId == null ? undefined : Number(villageId),
  });
};

export const getEngineSnapshotConvex = async () => {
  const client = requireClient();
  return client.query('engine.js:getSnapshot', {});
};

export const replaceEngineSnapshotConvex = async (snapshot, expectedRevision) => {
  const client = requireClient();
  return client.mutation('engine.js:replaceSnapshotIfRevision', {
    snapshot,
    expectedRevision: Number(expectedRevision),
  });
};

export const applyEngineSnapshotPatchConvex = async (patch, expectedRevision) => {
  const client = requireClient();
  return client.mutation('engine.js:applySnapshotPatchIfRevision', {
    patch,
    expectedRevision: Number(expectedRevision),
  });
};
