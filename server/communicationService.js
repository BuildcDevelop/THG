import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db.js';
import { GameRuleError } from './gameService.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 800;
const MAX_THREAD_MESSAGES = 80;
const MAX_THREAD_COUNT = 80;
const MAX_FRIEND_REQUESTS_PER_DAY = 40;
const MAX_MESSAGES_PER_15_SEC = 12;
const MAX_MESSAGES_PER_HOUR = 240;
const MAX_MESSAGES_PER_TARGET_PER_HOUR = 60;
const MAX_NEW_THREADS_PER_HOUR = 20;
const MAX_SEARCH_RESULTS = 25;
const MAX_UI_STATE_BYTES = 12000;
const MAX_PAYLOAD_BYTES = 1800;
const MAX_TOKEN_SUGGESTIONS = 20;
const MESSAGE_RETENTION_DAYS = 30;
const RETENTION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PRESENCE_TOUCH_INTERVAL_MS = 45 * 1000;
const ALLOWED_AVATAR_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_AVATAR_DATA_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_AVATAR_DATA_URL_BYTES = 1_200_000;
const AVATAR_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=]+)$/i;
const COMMUNICATION_AVATAR_PUBLIC_PATH = '/api/v1/public/avatars';
const LEGACY_MANAGED_AVATAR_PATH_PREFIXES = Object.freeze([
  '/api/public/avatars/',
  '/public/avatars/',
  '/avatars/',
  'api/v1/public/avatars/',
  'api/public/avatars/',
  'public/avatars/',
  'avatars/',
]);
const COMMUNICATION_AVATAR_STORAGE_DIR = path.resolve(
  String(process.env.AVATAR_STORAGE_DIR ?? path.join(process.cwd(), 'server', 'storage', 'avatars')).trim(),
);
const WORLD_REGION_BY_WORLD_ID = Object.freeze({
  'dominion-1': 1,
  'dominion-1-fire': 2,
});

const nowIso = () => new Date().toISOString();

const parseJsonSafe = (value, fallback = null) => {
  if (value == null || value === '') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(String(value));
    if (parsed == null || typeof parsed !== 'object') {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
};

const normalizeLowerPlayerId = (leftPlayerIdRaw, rightPlayerIdRaw) => {
  const leftPlayerId = Number(leftPlayerIdRaw);
  const rightPlayerId = Number(rightPlayerIdRaw);
  return leftPlayerId < rightPlayerId
    ? { lowPlayerId: leftPlayerId, highPlayerId: rightPlayerId }
    : { lowPlayerId: rightPlayerId, highPlayerId: leftPlayerId };
};

const requireNonEmptyText = (value, fieldName, maxLength = 120) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new GameRuleError(`Pole '${fieldName}' je povinne.`, 400);
  }
  if (normalized.length > maxLength) {
    throw new GameRuleError(`Pole '${fieldName}' muze mit maximalne ${maxLength} znaku.`, 400);
  }
  return normalized;
};

const normalizeMessageBody = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new GameRuleError(`Zprava muze mit maximalne ${MAX_MESSAGE_LENGTH} znaku.`, 400);
  }
  return normalized;
};

const normalizeMessagePayload = (value) => {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new GameRuleError('Neplatny format sdileneho obsahu.', 400);
  }

  const payload = value;
  const kind = String(payload.kind ?? '').trim().toLowerCase();
  const createdAt = payload.createdAt == null ? null : String(payload.createdAt).trim();

  if (kind === 'internal-link') {
    const worldId = String(payload.worldId ?? '').trim();
    const path = String(payload.path ?? '').trim();
    const label = String(payload.label ?? 'Sdileny odkaz').trim();
    if (!worldId || worldId.length > 64) {
      throw new GameRuleError('Neplatne worldId ve sdilenem odkazu.', 400);
    }
    if (!path || path.length > 180 || !path.startsWith('/')) {
      throw new GameRuleError('Neplatna cesta ve sdilenem odkazu.', 400);
    }
    if (!label || label.length > 80) {
      throw new GameRuleError('Neplatny popis sdileneho odkazu.', 400);
    }

    const normalized = {
      kind: 'internal-link',
      worldId,
      path,
      label,
      createdAt: createdAt || nowIso(),
    };
    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      throw new GameRuleError('Sdileny obsah je prilis velky.', 400);
    }
    return normalized;
  }

  if (kind === 'notification-share') {
    const shareToken = String(payload.shareToken ?? '').trim();
    const label = String(payload.label ?? 'Sdilene oznameni').trim();
    const notificationId = Number(payload.notificationId ?? 0);
    const reportIdRaw = Number(payload.reportId ?? 0);
    const reportId =
      Number.isFinite(reportIdRaw) && reportIdRaw > 0 ? Math.floor(reportIdRaw) : null;
    if (!shareToken || shareToken.length < 10 || shareToken.length > 128) {
      throw new GameRuleError('Neplatny share token oznameni.', 400);
    }
    if (!label || label.length > 120) {
      throw new GameRuleError('Neplatny popis sdileneho oznameni.', 400);
    }
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      throw new GameRuleError('Neplatne ID sdileneho oznameni.', 400);
    }
    const normalized = {
      kind: 'notification-share',
      shareToken,
      notificationId: Math.floor(notificationId),
      label,
      reportId,
      createdAt: createdAt || nowIso(),
    };
    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      throw new GameRuleError('Sdileny obsah je prilis velky.', 400);
    }
    return normalized;
  }

  throw new GameRuleError('Neplatny typ sdileneho obsahu.', 400);
};

const normalizeAvatarUrl = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith('data:image/')) {
    if (normalized.length > MAX_AVATAR_DATA_URL_BYTES) {
      throw new GameRuleError('Avatar je prilis velky. Maximalni velikost je 300x300.', 400);
    }
    const match = AVATAR_DATA_URL_PATTERN.exec(normalized);
    if (!match) {
      throw new GameRuleError('Avatar ma neplatny datovy format.', 400);
    }
    const mimeType = String(match[1] ?? '').toLowerCase();
    if (!ALLOWED_AVATAR_DATA_MIME_TYPES.includes(mimeType)) {
      throw new GameRuleError('Avatar musi byt png/jpg/jpeg/webp.', 400);
    }
    return normalized;
  }
  const lowerValue = normalized.toLowerCase();
  const hasAllowedExtension = ALLOWED_AVATAR_EXTENSIONS.some((extension) => lowerValue.endsWith(extension));
  if (!hasAllowedExtension) {
    throw new GameRuleError('Avatar musi byt URL na png/jpg/jpeg/webp obrazek.', 400);
  }
  if (!(normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/'))) {
    throw new GameRuleError('Avatar URL musi zacinat na http(s):// nebo /.', 400);
  }
  return normalizeManagedAvatarPath(normalized) ?? normalized;
};

const normalizeManagedAvatarPath = (avatarUrlRaw) => {
  const avatarUrl = String(avatarUrlRaw ?? '').trim();
  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith(`${COMMUNICATION_AVATAR_PUBLIC_PATH}/`)) {
    return avatarUrl;
  }

  const normalizedPath = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  for (const prefix of LEGACY_MANAGED_AVATAR_PATH_PREFIXES) {
    if (!normalizedPath.startsWith(prefix)) {
      continue;
    }
    const fileName = path.basename(normalizedPath);
    if (!/^[a-z0-9._-]+$/i.test(fileName)) {
      return null;
    }
    return `${COMMUNICATION_AVATAR_PUBLIC_PATH}/${fileName}`;
  }

  return normalizedPath;
};

const ensureAvatarStorageDir = () => {
  fs.mkdirSync(COMMUNICATION_AVATAR_STORAGE_DIR, { recursive: true });
};

const detectAvatarMimeFromBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

const resolveAvatarExtensionByMime = (mimeType) => {
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return '.jpg';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }
  return null;
};

const decodeAvatarDataUrl = (value) => {
  const normalized = normalizeAvatarUrl(value);
  if (!normalized || !normalized.startsWith('data:image/')) {
    throw new GameRuleError('Avatar musi byt nahrany jako obrazek.', 400);
  }
  const match = AVATAR_DATA_URL_PATTERN.exec(normalized);
  if (!match) {
    throw new GameRuleError('Avatar ma neplatny datovy format.', 400);
  }
  const mimeType = String(match[1] ?? '').toLowerCase();
  const base64Payload = String(match[2] ?? '');
  const buffer = Buffer.from(base64Payload, 'base64');
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    throw new GameRuleError('Avatar je prazdny nebo neplatny.', 400);
  }
  if (buffer.length > MAX_AVATAR_DATA_URL_BYTES) {
    throw new GameRuleError('Avatar je prilis velky. Maximalni velikost je 300x300.', 400);
  }
  const detectedMime = detectAvatarMimeFromBuffer(buffer);
  if (!detectedMime) {
    throw new GameRuleError('Avatar ma nepodporovany format.', 400);
  }
  if (mimeType === 'image/jpg' && detectedMime !== 'image/jpeg') {
    throw new GameRuleError('Avatar data neodpovidaji typu souboru.', 400);
  }
  if (mimeType !== 'image/jpg' && detectedMime !== mimeType) {
    throw new GameRuleError('Avatar data neodpovidaji typu souboru.', 400);
  }
  const extension = resolveAvatarExtensionByMime(detectedMime);
  if (!extension) {
    throw new GameRuleError('Avatar ma nepodporovany format.', 400);
  }
  return {
    buffer,
    mimeType: detectedMime,
    extension,
  };
};

const buildStoredAvatarPublicUrl = (fileName) => `${COMMUNICATION_AVATAR_PUBLIC_PATH}/${fileName}`;

const isManagedAvatarUrl = (avatarUrlRaw) => {
  const avatarUrl = normalizeManagedAvatarPath(avatarUrlRaw);
  if (!avatarUrl) {
    return false;
  }
  return avatarUrl.startsWith(`${COMMUNICATION_AVATAR_PUBLIC_PATH}/`);
};

const toPublicAvatarUrl = (avatarUrlRaw) => {
  const normalized = normalizeManagedAvatarPath(avatarUrlRaw);
  if (!normalized) {
    return null;
  }
  if (!isManagedAvatarUrl(normalized)) {
    return normalized;
  }
  const absolutePath = resolveManagedAvatarAbsolutePath(normalized);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }
  return normalized;
};

const resolveManagedAvatarAbsolutePath = (avatarUrlRaw) => {
  if (!isManagedAvatarUrl(avatarUrlRaw)) {
    return null;
  }
  const fileName = path.basename(String(avatarUrlRaw ?? '').trim());
  if (!/^[a-z0-9._-]+$/i.test(fileName)) {
    return null;
  }
  const storageRoot = path.resolve(COMMUNICATION_AVATAR_STORAGE_DIR);
  const absolutePath = path.resolve(storageRoot, fileName);
  if (absolutePath !== path.join(storageRoot, fileName)) {
    return null;
  }
  return absolutePath;
};

const deleteManagedAvatarFileIfExists = (avatarUrlRaw) => {
  const absolutePath = resolveManagedAvatarAbsolutePath(avatarUrlRaw);
  if (!absolutePath) {
    return;
  }
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch {
    // non-fatal cleanup
  }
};

const storeAvatarDataUrl = (playerIdRaw, avatarDataUrlRaw) => {
  const playerId = Math.floor(Number(playerIdRaw));
  if (!Number.isFinite(playerId) || playerId <= 0) {
    throw new GameRuleError('Neplatne playerId pro avatar.', 400);
  }
  const decoded = decodeAvatarDataUrl(avatarDataUrlRaw);
  ensureAvatarStorageDir();
  const hash = createHash('sha256').update(decoded.buffer).digest('hex').slice(0, 16);
  const fileName = `player-${playerId}-${Date.now()}-${hash}${decoded.extension}`;
  const targetPath = path.join(COMMUNICATION_AVATAR_STORAGE_DIR, fileName);
  fs.writeFileSync(targetPath, decoded.buffer, { mode: 0o600 });
  return buildStoredAvatarPublicUrl(fileName);
};

const normalizeUiStatePayload = (value) => {
  const payload = value && typeof value === 'object' ? value : {};
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_UI_STATE_BYTES) {
    throw new GameRuleError('Ulozeny stav komunikace je prilis velky.', 400);
  }
  return serialized;
};

const isSqliteUniqueConstraintError = (error) => {
  const message = error instanceof Error ? String(error.message ?? '') : String(error ?? '');
  return message.includes('UNIQUE constraint failed');
};

const selectPlayerByUsernameStmt = db.prepare(
  `SELECT
      id,
      username
   FROM players
   WHERE username = ? COLLATE NOCASE
     AND is_bot = 0
   LIMIT 1`,
);

const selectPlayerByIdStmt = db.prepare(
  `SELECT
      id,
      username
   FROM players
   WHERE id = ?
     AND is_bot = 0
   LIMIT 1`,
);

const selectPlayerKingdomLinkStmt = db.prepare(
  `SELECT 1 AS linked
   FROM villages left_v
   INNER JOIN villages right_v
      ON right_v.player_id = ?
     AND right_v.region = left_v.region
     AND right_v.kingdom = left_v.kingdom
   WHERE left_v.player_id = ?
     AND left_v.kingdom <> 'Neutral'
   LIMIT 1`,
);

const upsertPlayerPresenceStmt = db.prepare(
  `INSERT INTO player_presence (player_id, last_active_at)
   VALUES (?, ?)
   ON CONFLICT(player_id) DO UPDATE SET
     last_active_at = excluded.last_active_at`,
);

const selectPlayerProfileStmt = db.prepare(
  `SELECT
      avatar_url AS avatarUrl,
      avatar_updated_at AS avatarUpdatedAt
   FROM player_profiles
   WHERE player_id = ?
   LIMIT 1`,
);

const upsertPlayerProfileStmt = db.prepare(
  `INSERT INTO player_profiles (player_id, avatar_url, avatar_updated_at)
   VALUES (?, ?, ?)
   ON CONFLICT(player_id) DO UPDATE SET
     avatar_url = excluded.avatar_url,
     avatar_updated_at = excluded.avatar_updated_at`,
);
const selectAllPlayerProfileAvatarUrlsStmt = db.prepare(
  `SELECT
      player_id AS playerId,
      avatar_url AS avatarUrl
   FROM player_profiles
   WHERE avatar_url IS NOT NULL
     AND TRIM(avatar_url) <> ''`,
);
const updatePlayerProfileAvatarUrlStmt = db.prepare(
  `UPDATE player_profiles
   SET avatar_url = ?,
       avatar_updated_at = CASE
         WHEN avatar_updated_at IS NULL OR avatar_updated_at = '' THEN ?
         ELSE avatar_updated_at
       END
   WHERE player_id = ?`,
);

const normalizeStoredAvatarUrls = () => {
  const touchedAt = nowIso();
  const rows = selectAllPlayerProfileAvatarUrlsStmt.all();
  for (const row of rows) {
    const normalized = normalizeManagedAvatarPath(row.avatarUrl);
    if (!normalized || normalized === String(row.avatarUrl)) {
      continue;
    }
    updatePlayerProfileAvatarUrlStmt.run(normalized, touchedAt, Number(row.playerId));
  }
};
normalizeStoredAvatarUrls();

const selectPlayerUiStateStmt = db.prepare(
  `SELECT
      communication_json AS communicationJson,
      updated_at AS updatedAt
   FROM player_ui_state
   WHERE player_id = ?
   LIMIT 1`,
);

const upsertPlayerUiStateStmt = db.prepare(
  `INSERT INTO player_ui_state (player_id, communication_json, updated_at)
   VALUES (?, ?, ?)
   ON CONFLICT(player_id) DO UPDATE SET
     communication_json = excluded.communication_json,
     updated_at = excluded.updated_at`,
);

const selectFriendshipByPairStmt = db.prepare(
  `SELECT 1 AS linked
   FROM player_friendships
   WHERE player_low_id = ?
     AND player_high_id = ?
   LIMIT 1`,
);

const insertFriendshipStmt = db.prepare(
  `INSERT OR IGNORE INTO player_friendships (
      player_low_id,
      player_high_id,
      created_at
    ) VALUES (?, ?, ?)`,
);

const deleteFriendshipStmt = db.prepare(
  `DELETE FROM player_friendships
   WHERE player_low_id = ?
     AND player_high_id = ?`,
);

const selectFriendRowsByPlayerStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      profile.avatar_url AS avatarUrl,
      presence.last_active_at AS lastActiveAt
   FROM player_friendships fs
   INNER JOIN players p
      ON p.id = CASE
        WHEN fs.player_low_id = ? THEN fs.player_high_id
        ELSE fs.player_low_id
      END
   LEFT JOIN player_profiles profile ON profile.player_id = p.id
   LEFT JOIN player_presence presence ON presence.player_id = p.id
   WHERE fs.player_low_id = ?
      OR fs.player_high_id = ?
   ORDER BY COALESCE(presence.last_active_at, '') DESC, p.username ASC`,
);

const selectBlockRowsByPlayerStmt = db.prepare(
  `SELECT
      blocked_player_id AS playerId
   FROM player_blocks
   WHERE blocker_player_id = ?`,
);

const selectBlockPairStmt = db.prepare(
  `SELECT 1 AS blocked
   FROM player_blocks
   WHERE blocker_player_id = ?
     AND blocked_player_id = ?
   LIMIT 1`,
);

const insertBlockPairStmt = db.prepare(
  `INSERT OR IGNORE INTO player_blocks (
      blocker_player_id,
      blocked_player_id,
      created_at
    ) VALUES (?, ?, ?)`,
);

const deleteBlockPairStmt = db.prepare(
  `DELETE FROM player_blocks
   WHERE blocker_player_id = ?
     AND blocked_player_id = ?`,
);

const selectPendingIncomingFriendRequestsStmt = db.prepare(
  `SELECT
      req.id,
      req.sender_player_id AS senderPlayerId,
      sender.username AS senderUsername,
      profile.avatar_url AS senderAvatarUrl,
      req.created_at AS createdAt
   FROM player_friend_requests req
   INNER JOIN players sender ON sender.id = req.sender_player_id
   LEFT JOIN player_profiles profile ON profile.player_id = sender.id
   WHERE req.receiver_player_id = ?
     AND req.status = 'pending'
   ORDER BY req.created_at DESC, req.id DESC`,
);

const selectPendingOutgoingFriendRequestsStmt = db.prepare(
  `SELECT
      req.id,
      req.receiver_player_id AS receiverPlayerId,
      receiver.username AS receiverUsername,
      profile.avatar_url AS receiverAvatarUrl,
      req.created_at AS createdAt
   FROM player_friend_requests req
   INNER JOIN players receiver ON receiver.id = req.receiver_player_id
   LEFT JOIN player_profiles profile ON profile.player_id = receiver.id
   WHERE req.sender_player_id = ?
     AND req.status = 'pending'
   ORDER BY req.created_at DESC, req.id DESC`,
);

const selectPendingFriendRequestByPairStmt = db.prepare(
  `SELECT
      id,
      sender_player_id AS senderPlayerId,
      receiver_player_id AS receiverPlayerId,
      status
   FROM player_friend_requests
   WHERE sender_player_id = ?
     AND receiver_player_id = ?
     AND status = 'pending'
   LIMIT 1`,
);

const selectPendingFriendRequestByReceiverStmt = db.prepare(
  `SELECT
      id,
      sender_player_id AS senderPlayerId,
      receiver_player_id AS receiverPlayerId
   FROM player_friend_requests
   WHERE id = ?
     AND receiver_player_id = ?
     AND status = 'pending'
   LIMIT 1`,
);

const insertFriendRequestStmt = db.prepare(
  `INSERT INTO player_friend_requests (
      sender_player_id,
      receiver_player_id,
      status,
      created_at
    ) VALUES (?, ?, 'pending', ?)`,
);

const updateFriendRequestStatusStmt = db.prepare(
  `UPDATE player_friend_requests
   SET status = ?, responded_at = ?
   WHERE id = ?`,
);

const rejectPendingFriendRequestsBetweenPairStmt = db.prepare(
  `UPDATE player_friend_requests
   SET status = 'rejected',
       responded_at = ?
   WHERE status = 'pending'
     AND (
       (sender_player_id = ? AND receiver_player_id = ?)
       OR (sender_player_id = ? AND receiver_player_id = ?)
     )`,
);

const countFriendRequestsFromPlayerSinceStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_friend_requests
   WHERE sender_player_id = ?
     AND created_at >= ?`,
);

const countPendingIncomingFriendRequestsStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM player_friend_requests
   WHERE receiver_player_id = ?
     AND status = 'pending'`,
);

const selectDirectThreadByPairStmt = db.prepare(
  `SELECT
      id,
      created_by_player_id AS createdByPlayerId,
      created_at AS createdAt
   FROM chat_threads
   WHERE kind = 'direct'
     AND direct_low_player_id = ?
     AND direct_high_player_id = ?
   LIMIT 1`,
);

const insertDirectThreadStmt = db.prepare(
  `INSERT INTO chat_threads (
      kind,
      created_by_player_id,
      direct_low_player_id,
      direct_high_player_id,
      created_at
    ) VALUES ('direct', ?, ?, ?, ?)`,
);

const upsertThreadMemberStmt = db.prepare(
  `INSERT INTO chat_thread_members (
      thread_id,
      player_id,
      joined_at,
      archived_at,
      last_opened_at,
      last_read_message_id
    ) VALUES (?, ?, ?, NULL, ?, ?)
   ON CONFLICT(thread_id, player_id) DO UPDATE SET
     archived_at = NULL`,
);

const selectThreadMembershipStmt = db.prepare(
  `SELECT
      thread_id AS threadId,
      player_id AS playerId,
      archived_at AS archivedAt,
      last_opened_at AS lastOpenedAt,
      last_read_message_id AS lastReadMessageId
   FROM chat_thread_members
   WHERE thread_id = ?
     AND player_id = ?
   LIMIT 1`,
);

const selectThreadMetaByIdStmt = db.prepare(
  `SELECT
      id,
      kind,
      direct_low_player_id AS directLowPlayerId,
      direct_high_player_id AS directHighPlayerId
   FROM chat_threads
   WHERE id = ?
   LIMIT 1`,
);

const selectVisibleThreadMembershipsByPlayerStmt = db.prepare(
  `SELECT
      tm.thread_id AS threadId,
      tm.last_opened_at AS lastOpenedAt,
      tm.last_read_message_id AS lastReadMessageId,
      t.kind,
      t.created_by_player_id AS createdByPlayerId,
      t.created_at AS createdAt
   FROM chat_thread_members tm
   INNER JOIN chat_threads t ON t.id = tm.thread_id
   WHERE tm.player_id = ?
     AND tm.archived_at IS NULL
   ORDER BY tm.thread_id DESC
   LIMIT ?`,
);

const selectOtherParticipantInThreadStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      profile.avatar_url AS avatarUrl,
      presence.last_active_at AS lastActiveAt
   FROM chat_thread_members tm
   INNER JOIN players p ON p.id = tm.player_id
   LEFT JOIN player_profiles profile ON profile.player_id = p.id
   LEFT JOIN player_presence presence ON presence.player_id = p.id
   WHERE tm.thread_id = ?
     AND tm.player_id <> ?
   LIMIT 1`,
);

const selectOtherParticipantInDirectThreadStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      profile.avatar_url AS avatarUrl,
      presence.last_active_at AS lastActiveAt
   FROM chat_threads t
   INNER JOIN players p
      ON p.id = CASE
        WHEN t.direct_low_player_id = ? THEN t.direct_high_player_id
        ELSE t.direct_low_player_id
      END
   LEFT JOIN player_profiles profile ON profile.player_id = p.id
   LEFT JOIN player_presence presence ON presence.player_id = p.id
   WHERE t.id = ?
     AND t.kind = 'direct'
     AND (
       t.direct_low_player_id = ?
       OR t.direct_high_player_id = ?
     )
   LIMIT 1`,
);

const selectLastMessageInThreadStmt = db.prepare(
  `SELECT
      m.id,
      m.sender_player_id AS senderPlayerId,
      sender.username AS senderUsername,
      senderProfile.avatar_url AS senderAvatarUrl,
      m.body,
      m.payload_json AS payloadJson,
      m.created_at AS createdAt,
      m.deleted_at AS deletedAt
   FROM chat_messages m
   INNER JOIN players sender ON sender.id = m.sender_player_id
   LEFT JOIN player_profiles senderProfile ON senderProfile.player_id = sender.id
   WHERE m.thread_id = ?
   ORDER BY m.id DESC
   LIMIT 1`,
);

const countUnreadMessagesInThreadStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM chat_messages
   WHERE thread_id = ?
     AND sender_player_id <> ?
     AND id > ?`,
);

const countOwnMessagesInThreadStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM chat_messages
   WHERE thread_id = ?
     AND sender_player_id = ?`,
);

const selectLatestMessageIdInThreadStmt = db.prepare(
  `SELECT MAX(id) AS messageId
   FROM chat_messages
   WHERE thread_id = ?`,
);

const selectThreadMessagesStmt = db.prepare(
  `SELECT
      m.id,
      m.thread_id AS threadId,
      m.sender_player_id AS senderPlayerId,
      sender.username AS senderUsername,
      senderProfile.avatar_url AS senderAvatarUrl,
      m.body,
      m.payload_json AS payloadJson,
      m.created_at AS createdAt,
      m.deleted_at AS deletedAt
   FROM chat_messages m
   INNER JOIN players sender ON sender.id = m.sender_player_id
   LEFT JOIN player_profiles senderProfile ON senderProfile.player_id = sender.id
   WHERE m.thread_id = ?
     AND (? IS NULL OR m.id < ?)
   ORDER BY m.id DESC
   LIMIT ?`,
);

const insertChatMessageStmt = db.prepare(
  `INSERT INTO chat_messages (
      thread_id,
      sender_player_id,
      body,
      payload_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?)`,
);

const updateThreadMemberOpenStateStmt = db.prepare(
  `UPDATE chat_thread_members
   SET last_opened_at = ?,
       last_read_message_id = ?,
       archived_at = NULL
   WHERE thread_id = ?
     AND player_id = ?`,
);

const unarchiveThreadForMemberStmt = db.prepare(
  `UPDATE chat_thread_members
   SET archived_at = NULL
   WHERE thread_id = ?
     AND player_id = ?`,
);

const archiveThreadForMemberStmt = db.prepare(
  `UPDATE chat_thread_members
   SET archived_at = ?
   WHERE thread_id = ?
     AND player_id = ?`,
);

const selectMessageByIdStmt = db.prepare(
  `SELECT
      id,
      thread_id AS threadId,
      sender_player_id AS senderPlayerId,
      deleted_at AS deletedAt
   FROM chat_messages
   WHERE id = ?
   LIMIT 1`,
);

const deleteChatMessageForAllStmt = db.prepare(
  `UPDATE chat_messages
   SET body = '[zprava smazana]',
       payload_json = NULL,
       deleted_at = ?
   WHERE id = ?
     AND sender_player_id = ?
     AND deleted_at IS NULL`,
);

const countMessagesSentByPlayerSinceStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM chat_messages
   WHERE sender_player_id = ?
     AND created_at >= ?`,
);

const countMessagesSentByPlayerToTargetSinceStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM chat_messages m
   INNER JOIN chat_threads t ON t.id = m.thread_id
   WHERE m.sender_player_id = ?
     AND m.created_at >= ?
     AND t.kind = 'direct'
     AND t.direct_low_player_id = ?
     AND t.direct_high_player_id = ?`,
);

const countNewThreadsCreatedByPlayerSinceStmt = db.prepare(
  `SELECT COUNT(*) AS total
   FROM chat_threads
   WHERE kind = 'direct'
     AND created_by_player_id = ?
     AND created_at >= ?`,
);

const searchPlayersStmt = db.prepare(
  `SELECT
      p.id AS playerId,
      p.username,
      profile.avatar_url AS avatarUrl,
      presence.last_active_at AS lastActiveAt
   FROM players p
   LEFT JOIN player_profiles profile ON profile.player_id = p.id
   LEFT JOIN player_presence presence ON presence.player_id = p.id
   WHERE p.is_bot = 0
     AND p.username <> ? COLLATE NOCASE
     AND p.username LIKE ? COLLATE NOCASE
   ORDER BY p.username ASC
  LIMIT ?`,
);

const selectPlayerNotificationForShareStmt = db.prepare(
  `SELECT
      n.id,
      n.player_id AS playerId,
      n.region,
      n.category,
      n.event_type AS eventType,
      n.severity,
      n.title,
      n.summary,
      n.payload_json AS payloadJson,
      n.created_at AS createdAt,
      n.deleted_at AS deletedAt
   FROM player_notifications n
   WHERE n.id = ?
     AND n.player_id = ?
   LIMIT 1`,
);

const insertNotificationShareStmt = db.prepare(
  `INSERT INTO notification_shares (
      share_token,
      source_player_id,
      source_notification_id,
      source_region,
      created_at
    ) VALUES (?, ?, ?, ?, ?)`,
);

const selectNotificationShareByTokenStmt = db.prepare(
  `SELECT
      ns.share_token AS shareToken,
      ns.source_player_id AS sourcePlayerId,
      ns.source_notification_id AS sourceNotificationId,
      ns.source_region AS sourceRegion,
      ns.created_at AS sharedAt,
      p.username AS sourceUsername,
      n.id AS notificationId,
      n.category,
      n.event_type AS eventType,
      n.severity,
      n.title,
      n.summary,
      n.payload_json AS payloadJson,
      n.created_at AS notificationCreatedAt,
      n.read_at AS readAt,
      n.archived_at AS archivedAt,
      n.deleted_at AS deletedAt
   FROM notification_shares ns
   INNER JOIN players p ON p.id = ns.source_player_id
   LEFT JOIN player_notifications n ON n.id = ns.source_notification_id
   WHERE ns.share_token = ?
   LIMIT 1`,
);

const selectBattleReportByIdStmt = db.prepare(
  `SELECT
      id,
      player_id AS playerId,
      origin_village_id AS originVillageId,
      target_village_id AS targetVillageId,
      battle_at AS battleAt,
      created_at AS createdAt,
      title,
      summary,
      payload_json AS payloadJson
   FROM battle_reports
   WHERE id = ?
   LIMIT 1`,
);

const searchKingdomMentionsStmt = db.prepare(
  `SELECT
      v.kingdom AS kingdom,
      COUNT(*) AS villages
   FROM villages v
   WHERE v.kingdom <> 'Neutral'
     AND v.kingdom LIKE ? COLLATE NOCASE
   GROUP BY v.kingdom
   ORDER BY COUNT(*) DESC, v.kingdom ASC
   LIMIT ?`,
);

const searchVillageMentionsByNameStmt = db.prepare(
  `SELECT
      v.id AS villageId,
      v.name,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      owner.username AS ownerUsername,
      v.kingdom
   FROM villages v
   INNER JOIN players owner ON owner.id = v.player_id
   WHERE v.name LIKE ? COLLATE NOCASE
   ORDER BY v.name ASC, v.id ASC
   LIMIT ?`,
);

const searchVillageMentionsByCoordsStmt = db.prepare(
  `SELECT
      v.id AS villageId,
      v.name,
      v.coord_x AS coordX,
      v.coord_y AS coordY,
      owner.username AS ownerUsername,
      v.kingdom
   FROM villages v
   INNER JOIN players owner ON owner.id = v.player_id
   WHERE CAST(v.coord_x AS TEXT) LIKE ?
      OR CAST(v.coord_y AS TEXT) LIKE ?
   ORDER BY v.coord_x ASC, v.coord_y ASC, v.id ASC
   LIMIT ?`,
);

const deleteExpiredChatMessagesStmt = db.prepare(
  `DELETE FROM chat_messages
   WHERE created_at < ?`,
);

const deleteMembersForExpiredEmptyThreadsStmt = db.prepare(
  `DELETE FROM chat_thread_members
   WHERE thread_id IN (
     SELECT t.id
     FROM chat_threads t
     WHERE t.created_at < ?
       AND NOT EXISTS (
         SELECT 1
         FROM chat_messages m
         WHERE m.thread_id = t.id
       )
   )`,
);

const deleteExpiredEmptyThreadsStmt = db.prepare(
  `DELETE FROM chat_threads
   WHERE created_at < ?
     AND NOT EXISTS (
       SELECT 1
       FROM chat_messages m
       WHERE m.thread_id = chat_threads.id
     )`,
);

const lastPresenceTouchByPlayerId = new Map();
const touchPlayerPresence = (playerId, touchedAt = nowIso(), options = {}) => {
  const playerIdNumber = Number(playerId);
  const touchedAtMs = Date.parse(String(touchedAt));
  const nowMs = Number.isFinite(touchedAtMs) ? touchedAtMs : Date.now();
  const lastTouchedMs = Number(lastPresenceTouchByPlayerId.get(playerIdNumber) ?? 0);
  if (!options?.force && nowMs - lastTouchedMs < PRESENCE_TOUCH_INTERVAL_MS) {
    return touchedAt;
  }
  upsertPlayerPresenceStmt.run(playerIdNumber, touchedAt);
  lastPresenceTouchByPlayerId.set(playerIdNumber, nowMs);
  return touchedAt;
};

let lastRetentionCleanupAtMs = 0;
const cleanupCommunicationRetention = (force = false) => {
  const nowMs = Date.now();
  if (!force && nowMs - lastRetentionCleanupAtMs < RETENTION_CLEANUP_INTERVAL_MS) {
    return {
      messagesDeleted: 0,
      threadsDeleted: 0,
    };
  }
  lastRetentionCleanupAtMs = nowMs;
  const cutoffIso = new Date(nowMs - MESSAGE_RETENTION_DAYS * DAY_IN_MS).toISOString();
  const messagesDeleted = Number(deleteExpiredChatMessagesStmt.run(cutoffIso).changes ?? 0);
  deleteMembersForExpiredEmptyThreadsStmt.run(cutoffIso);
  const threadsDeleted = Number(deleteExpiredEmptyThreadsStmt.run(cutoffIso).changes ?? 0);
  return {
    messagesDeleted,
    threadsDeleted,
  };
};

const requirePlayerByUsername = (usernameRaw) => {
  const username = requireNonEmptyText(usernameRaw, 'username', 40);
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new GameRuleError(`Hrac '${username}' neexistuje.`, 404);
  }
  return {
    id: Number(player.id),
    username: String(player.username),
  };
};

const requireAnotherPlayerByUsername = (currentPlayerId, targetUsernameRaw) => {
  const targetUsername = requireNonEmptyText(targetUsernameRaw, 'targetUsername', 40);
  const targetPlayer = selectPlayerByUsernameStmt.get(targetUsername);
  if (!targetPlayer) {
    throw new GameRuleError(`Hrac '${targetUsername}' neexistuje.`, 404);
  }
  const targetPlayerId = Number(targetPlayer.id);
  if (targetPlayerId === Number(currentPlayerId)) {
    throw new GameRuleError('Nemuzes napsat sam sobe.', 400);
  }
  return {
    id: targetPlayerId,
    username: String(targetPlayer.username),
  };
};

const isFriendPair = (leftPlayerId, rightPlayerId) => {
  const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(leftPlayerId, rightPlayerId);
  return Boolean(selectFriendshipByPairStmt.get(lowPlayerId, highPlayerId));
};

const isBlockedPair = (blockerPlayerId, blockedPlayerId) =>
  Boolean(selectBlockPairStmt.get(Number(blockerPlayerId), Number(blockedPlayerId)));

const arePlayersKingdomLinked = (leftPlayerId, rightPlayerId) =>
  Boolean(selectPlayerKingdomLinkStmt.get(Number(rightPlayerId), Number(leftPlayerId)));

const countSinceIso = (nowMs, deltaMs) => new Date(nowMs - deltaMs).toISOString();

const normalizeOptionalWorldRegion = (worldIdRaw) => {
  const worldId = String(worldIdRaw ?? '').trim();
  if (!worldId) {
    return null;
  }
  const region = Number(WORLD_REGION_BY_WORLD_ID[worldId] ?? 0);
  if (!Number.isFinite(region) || region <= 0) {
    throw new GameRuleError('Neplatny worldId.', 400);
  }
  return region;
};

const generateShareToken = () => randomBytes(18).toString('base64url');

const assertMessageRateLimit = (playerId, atMs = Date.now(), options = {}) => {
  const playerIdNumber = Number(playerId);
  const recent15Sec = Number(
    countMessagesSentByPlayerSinceStmt.get(playerIdNumber, countSinceIso(atMs, 15 * 1000))?.total ?? 0,
  );
  if (recent15Sec >= MAX_MESSAGES_PER_15_SEC) {
    throw new GameRuleError('Pises prilis rychle. Pockej chvili.', 429);
  }
  const recentHour = Number(
    countMessagesSentByPlayerSinceStmt.get(playerIdNumber, countSinceIso(atMs, 60 * 60 * 1000))?.total ?? 0,
  );
  if (recentHour >= MAX_MESSAGES_PER_HOUR) {
    throw new GameRuleError('Dosahl jsi hodinoveho limitu zprav. Zkus to pozdeji.', 429);
  }

  const targetPlayerIdRaw = options?.targetPlayerId == null ? null : Number(options.targetPlayerId);
  if (targetPlayerIdRaw != null && Number.isFinite(targetPlayerIdRaw) && targetPlayerIdRaw > 0) {
    const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(playerIdNumber, targetPlayerIdRaw);
    const recentTargetHour = Number(
      countMessagesSentByPlayerToTargetSinceStmt.get(
        playerIdNumber,
        countSinceIso(atMs, 60 * 60 * 1000),
        lowPlayerId,
        highPlayerId,
      )?.total ?? 0,
    );
    if (recentTargetHour >= MAX_MESSAGES_PER_TARGET_PER_HOUR) {
      throw new GameRuleError('Tomuto hraci uz jsi v teto hodine poslal prilis mnoho zprav.', 429);
    }
  }

  if (options?.newThread === true) {
    const newThreadsHour = Number(
      countNewThreadsCreatedByPlayerSinceStmt.get(playerIdNumber, countSinceIso(atMs, 60 * 60 * 1000))?.total ?? 0,
    );
    if (newThreadsHour >= MAX_NEW_THREADS_PER_HOUR) {
      throw new GameRuleError('Dosahl jsi hodinoveho limitu novych konverzaci.', 429);
    }
  }
};

const assertFriendRequestRateLimit = (playerId, atMs = Date.now()) => {
  const playerIdNumber = Number(playerId);
  const sentInLastDay = Number(
    countFriendRequestsFromPlayerSinceStmt.get(playerIdNumber, countSinceIso(atMs, DAY_IN_MS))?.total ?? 0,
  );
  if (sentInLastDay >= MAX_FRIEND_REQUESTS_PER_DAY) {
    throw new GameRuleError('Dosahl jsi denniho limitu pozadosti o pratelstvi.', 429);
  }
};

const ensureDirectThread = (createdByPlayerId, leftPlayerId, rightPlayerId, createdAtIso = nowIso()) => {
  const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(leftPlayerId, rightPlayerId);
  const existing = selectDirectThreadByPairStmt.get(lowPlayerId, highPlayerId);
  if (existing) {
    return {
      threadId: Number(existing.id),
      created: false,
    };
  }
  try {
    const inserted = insertDirectThreadStmt.run(
      Number(createdByPlayerId),
      lowPlayerId,
      highPlayerId,
      createdAtIso,
    );
    const threadId = Number(inserted.lastInsertRowid);
    upsertThreadMemberStmt.run(threadId, lowPlayerId, createdAtIso, null, null);
    upsertThreadMemberStmt.run(threadId, highPlayerId, createdAtIso, null, null);
    return {
      threadId,
      created: true,
    };
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      const reloaded = selectDirectThreadByPairStmt.get(lowPlayerId, highPlayerId);
      if (reloaded) {
        return {
          threadId: Number(reloaded.id),
          created: false,
        };
      }
    }
    throw error;
  }
};

const resolveThreadForPlayer = (playerId, threadIdRaw) => {
  const threadId = Math.floor(Number(threadIdRaw));
  if (!Number.isFinite(threadId) || threadId <= 0) {
    throw new GameRuleError('Neplatne threadId.', 400);
  }
  const member = selectThreadMembershipStmt.get(threadId, Number(playerId));
  if (!member) {
    throw new GameRuleError('Konverzace nebyla nalezena.', 404);
  }
  const threadMeta = selectThreadMetaByIdStmt.get(threadId);
  if (!threadMeta) {
    throw new GameRuleError('Konverzace nebyla nalezena.', 404);
  }
  if (String(threadMeta.kind) === 'direct') {
    const directLowPlayerId = Number(threadMeta.directLowPlayerId ?? 0);
    const directHighPlayerId = Number(threadMeta.directHighPlayerId ?? 0);
    const normalizedPlayerId = Number(playerId);
    if (directLowPlayerId !== normalizedPlayerId && directHighPlayerId !== normalizedPlayerId) {
      throw new GameRuleError('Konverzace nebyla nalezena.', 404);
    }
  }
  return {
    threadId,
    lastReadMessageId: Number(member.lastReadMessageId ?? 0),
  };
};

const toPresence = (lastActiveAtRaw) => {
  const lastActiveAt = lastActiveAtRaw == null ? null : String(lastActiveAtRaw);
  if (!lastActiveAt) {
    return { isOnline: false, lastActiveAt: null };
  }
  const parsedMs = Date.parse(lastActiveAt);
  if (!Number.isFinite(parsedMs)) {
    return { isOnline: false, lastActiveAt: null };
  }
  return {
    isOnline: Date.now() - parsedMs <= ONLINE_WINDOW_MS,
    lastActiveAt,
  };
};

const toFriendRelation = (currentPlayerId, otherPlayerId, friendMap) => {
  const otherId = Number(otherPlayerId);
  if (friendMap.has(otherId)) {
    return 'friend';
  }
  if (arePlayersKingdomLinked(currentPlayerId, otherId)) {
    return 'kingdom';
  }
  return 'stranger';
};

const toMessageItem = (row) => ({
  id: Number(row.id),
  threadId: Number(row.threadId),
  senderPlayerId: Number(row.senderPlayerId),
  senderUsername: String(row.senderUsername),
  senderAvatarUrl: toPublicAvatarUrl(row.senderAvatarUrl),
  body: String(row.body ?? ''),
  payload: parseJsonSafe(row.payloadJson, null),
  createdAt: String(row.createdAt),
  deletedAt: row.deletedAt == null ? null : String(row.deletedAt),
});

const listThreadSummaries = (playerId, threadLimit = MAX_THREAD_COUNT, includeThreads = true) => {
  const memberships = selectVisibleThreadMembershipsByPlayerStmt.all(Number(playerId), Number(threadLimit));
  const friendRows = selectFriendRowsByPlayerStmt.all(Number(playerId), Number(playerId), Number(playerId));
  const friendSet = new Set(friendRows.map((row) => Number(row.playerId)));
  const blockedRows = selectBlockRowsByPlayerStmt.all(Number(playerId));
  const blockedSet = new Set(blockedRows.map((row) => Number(row.playerId)));

  const summaries = [];
  let unreadTotal = 0;
  let requestTotal = 0;

  for (const membership of memberships) {
    const threadId = Number(membership.threadId);
    const isDirectThread = String(membership.kind) === 'direct';
    const other = isDirectThread
      ? selectOtherParticipantInDirectThreadStmt.get(Number(playerId), threadId, Number(playerId), Number(playerId))
      : selectOtherParticipantInThreadStmt.get(threadId, Number(playerId));
    if (!other) {
      continue;
    }
    const otherPlayerId = Number(other.playerId);
    if (blockedSet.has(otherPlayerId)) {
      continue;
    }
    const lastMessageRow = selectLastMessageInThreadStmt.get(threadId);
    const lastMessageId = Number(lastMessageRow?.id ?? 0);
    const unreadCount = Number(
      countUnreadMessagesInThreadStmt.get(
        threadId,
        Number(playerId),
        Number(membership.lastReadMessageId ?? 0),
      )?.total ?? 0,
    );
    const ownMessageCount = Number(countOwnMessagesInThreadStmt.get(threadId, Number(playerId))?.total ?? 0);
    const isFriend = friendSet.has(otherPlayerId);
    const isMessageRequest =
      !isFriend &&
      ownMessageCount <= 0 &&
      unreadCount > 0 &&
      Number(lastMessageRow?.senderPlayerId ?? 0) === otherPlayerId;
    const presence = toPresence(other.lastActiveAt);
    const visiblePresence = isFriend ? presence : { isOnline: false, lastActiveAt: null };
    const relation = toFriendRelation(Number(playerId), otherPlayerId, friendSet);

    unreadTotal += unreadCount;
    if (isMessageRequest) {
      requestTotal += 1;
    }

    if (includeThreads) {
      summaries.push({
        id: threadId,
        kind: String(membership.kind),
        createdByPlayerId: Number(membership.createdByPlayerId),
        createdAt: String(membership.createdAt),
        relation,
        isFriend,
        isMessageRequest,
        unreadCount,
        lastOpenedAt: membership.lastOpenedAt == null ? null : String(membership.lastOpenedAt),
        otherPlayer: {
          id: otherPlayerId,
          username: String(other.username),
          avatarUrl: toPublicAvatarUrl(other.avatarUrl),
          isOnline: visiblePresence.isOnline,
          lastActiveAt: visiblePresence.lastActiveAt,
        },
        lastMessage:
          lastMessageId > 0
            ? {
                id: lastMessageId,
                senderPlayerId: Number(lastMessageRow.senderPlayerId),
                senderUsername: String(lastMessageRow.senderUsername),
                senderAvatarUrl: toPublicAvatarUrl(lastMessageRow.senderAvatarUrl),
                body: String(lastMessageRow.body ?? ''),
                payload: parseJsonSafe(lastMessageRow.payloadJson, null),
                createdAt: String(lastMessageRow.createdAt),
                deletedAt: lastMessageRow.deletedAt == null ? null : String(lastMessageRow.deletedAt),
              }
            : null,
        lastActivityAt:
          lastMessageRow?.createdAt != null ? String(lastMessageRow.createdAt) : String(membership.createdAt),
      });
    }
  }

  if (includeThreads) {
    summaries.sort((left, right) => {
      const byActivity = String(right.lastActivityAt).localeCompare(String(left.lastActivityAt));
      if (byActivity !== 0) {
        return byActivity;
      }
      return Number(right.id) - Number(left.id);
    });
  }

  return {
    threads: summaries,
    unreadTotal,
    messageRequestTotal: requestTotal,
  };
};

const listThreadMessages = (playerId, threadId, beforeMessageIdRaw = null, limitRaw = MAX_THREAD_MESSAGES) => {
  resolveThreadForPlayer(playerId, threadId);
  const beforeMessageId = beforeMessageIdRaw == null ? null : Math.floor(Number(beforeMessageIdRaw));
  const safeBeforeId = Number.isFinite(beforeMessageId) && beforeMessageId > 0 ? beforeMessageId : null;
  const limit = Math.max(1, Math.min(MAX_THREAD_MESSAGES, Math.floor(Number(limitRaw) || MAX_THREAD_MESSAGES)));
  const rows = selectThreadMessagesStmt.all(threadId, safeBeforeId, safeBeforeId, limit);
  const orderedRows = [...rows].reverse();
  return orderedRows.map((row) => toMessageItem(row));
};

const openThreadTransaction = db.transaction((usernameRaw, payload = {}) => {
  cleanupCommunicationRetention();
  const player = requirePlayerByUsername(usernameRaw);
  const touchedAt = touchPlayerPresence(player.id);

  const targetUsernameRaw = payload?.targetUsername;
  const requestedThreadIdRaw = payload?.threadId;
  let threadId;

  if (targetUsernameRaw != null && String(targetUsernameRaw).trim() !== '') {
    const target = requireAnotherPlayerByUsername(player.id, targetUsernameRaw);
    if (isBlockedPair(target.id, player.id) || isBlockedPair(player.id, target.id)) {
      throw new GameRuleError('Komunikace je blokovana mezi temi hraci.', 403);
    }
    threadId = ensureDirectThread(player.id, player.id, target.id, touchedAt).threadId;
  } else {
    threadId = resolveThreadForPlayer(player.id, requestedThreadIdRaw).threadId;
  }

  const latestMessageId = Number(selectLatestMessageIdInThreadStmt.get(threadId)?.messageId ?? 0);
  updateThreadMemberOpenStateStmt.run(touchedAt, latestMessageId > 0 ? latestMessageId : null, threadId, player.id);

  return {
    threadId,
    openedAt: touchedAt,
    latestMessageId: latestMessageId > 0 ? latestMessageId : null,
  };
});

const sendMessageTransaction = db.transaction((usernameRaw, payload = {}) => {
  cleanupCommunicationRetention();
  const player = requirePlayerByUsername(usernameRaw);
  const body = normalizeMessageBody(payload?.body);
  const normalizedPayload = normalizeMessagePayload(payload?.payload ?? null);
  const hasPayloadObject = normalizedPayload != null;
  if (!body && !hasPayloadObject) {
    throw new GameRuleError('Zprava je prazdna.', 400);
  }

  const touchedAt = nowIso();
  touchPlayerPresence(player.id, touchedAt);

  let threadId = Number(payload?.threadId ?? 0);
  let threadWasCreated = false;
  let targetPlayerId = null;
  if (!Number.isFinite(threadId) || threadId <= 0) {
    const target = requireAnotherPlayerByUsername(player.id, payload?.targetUsername);
    targetPlayerId = Number(target.id);
    if (isBlockedPair(target.id, player.id) || isBlockedPair(player.id, target.id)) {
      throw new GameRuleError('Komunikace je blokovana mezi temi hraci.', 403);
    }
    const ensured = ensureDirectThread(player.id, player.id, target.id, touchedAt);
    threadId = ensured.threadId;
    threadWasCreated = ensured.created;
  } else {
    resolveThreadForPlayer(player.id, threadId);
  }

  const threadMeta = selectThreadMetaByIdStmt.get(threadId);
  const isDirectThread = String(threadMeta?.kind ?? '') === 'direct';
  const otherParticipant = isDirectThread
    ? selectOtherParticipantInDirectThreadStmt.get(Number(player.id), threadId, Number(player.id), Number(player.id))
    : selectOtherParticipantInThreadStmt.get(threadId, player.id);
  if (!otherParticipant) {
    throw new GameRuleError('Konverzace nema ciloveho hrace.', 400);
  }
  const otherPlayerId = Number(otherParticipant.playerId);
  targetPlayerId = otherPlayerId;
  if (isBlockedPair(otherPlayerId, player.id) || isBlockedPair(player.id, otherPlayerId)) {
    throw new GameRuleError('Komunikace je blokovana mezi temi hraci.', 403);
  }
  assertMessageRateLimit(player.id, Date.parse(touchedAt), {
    targetPlayerId,
    newThread: threadWasCreated,
  });

  const insertedMessage = insertChatMessageStmt.run(
    threadId,
    player.id,
    body || '[sdileny obsah]',
    hasPayloadObject ? JSON.stringify(normalizedPayload) : null,
    touchedAt,
  );
  const messageId = Number(insertedMessage.lastInsertRowid);

  updateThreadMemberOpenStateStmt.run(touchedAt, messageId, threadId, player.id);
  unarchiveThreadForMemberStmt.run(threadId, otherPlayerId);

  const messageRow = selectLastMessageInThreadStmt.get(threadId);
  return {
    threadId,
    message: {
      id: messageId,
      threadId,
      senderPlayerId: player.id,
      senderUsername: player.username,
      senderAvatarUrl: toPublicAvatarUrl(messageRow?.senderAvatarUrl),
      body: String(messageRow?.body ?? ''),
      payload: parseJsonSafe(messageRow?.payloadJson, null),
      createdAt: touchedAt,
      deletedAt: null,
    },
  };
});

const setThreadArchivedTransaction = db.transaction((usernameRaw, threadIdRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const thread = resolveThreadForPlayer(player.id, threadIdRaw);
  const archivedAt = nowIso();
  archiveThreadForMemberStmt.run(archivedAt, thread.threadId, player.id);
  touchPlayerPresence(player.id, archivedAt);
  return {
    threadId: thread.threadId,
    archivedAt,
  };
});

const deleteMessageTransaction = db.transaction((usernameRaw, messageIdRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const messageId = Math.floor(Number(messageIdRaw));
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new GameRuleError('Neplatne messageId.', 400);
  }
  const messageRow = selectMessageByIdStmt.get(messageId);
  if (!messageRow) {
    throw new GameRuleError('Zprava nebyla nalezena.', 404);
  }
  resolveThreadForPlayer(player.id, Number(messageRow.threadId));
  const deletedAt = nowIso();
  const changed = Number(deleteChatMessageForAllStmt.run(deletedAt, messageId, player.id).changes ?? 0);
  if (changed <= 0) {
    throw new GameRuleError('Zpravu muze smazat pouze jeji autor.', 403);
  }
  touchPlayerPresence(player.id, deletedAt);
  const threadId = Number(messageRow.threadId);
  return {
    messageId,
    threadId,
    deletedAt,
  };
});

const sendFriendRequestTransaction = db.transaction((usernameRaw, targetUsernameRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const target = requireAnotherPlayerByUsername(player.id, targetUsernameRaw);
  const touchedAt = nowIso();
  touchPlayerPresence(player.id, touchedAt);
  assertFriendRequestRateLimit(player.id, Date.parse(touchedAt));

  if (isBlockedPair(target.id, player.id) || isBlockedPair(player.id, target.id)) {
    throw new GameRuleError('Pozadost nelze odeslat kvuli blokaci mezi hraci.', 403);
  }

  if (isFriendPair(player.id, target.id)) {
    throw new GameRuleError('Uz jste pratele.', 400);
  }

  const existingOutgoing = selectPendingFriendRequestByPairStmt.get(player.id, target.id);
  if (existingOutgoing) {
    throw new GameRuleError('Pozadost o pratelstvi uz ceka na schvaleni.', 400);
  }

  const oppositePending = selectPendingFriendRequestByPairStmt.get(target.id, player.id);
  if (oppositePending) {
    const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(player.id, target.id);
    insertFriendshipStmt.run(lowPlayerId, highPlayerId, touchedAt);
    updateFriendRequestStatusStmt.run('accepted', touchedAt, Number(oppositePending.id));
    return {
      acceptedImmediately: true,
      friendPlayerId: target.id,
      friendUsername: target.username,
      actedAt: touchedAt,
    };
  }

  const inserted = insertFriendRequestStmt.run(player.id, target.id, touchedAt);
  return {
    requestId: Number(inserted.lastInsertRowid),
    senderPlayerId: player.id,
    senderUsername: player.username,
    receiverPlayerId: target.id,
    receiverUsername: target.username,
    createdAt: touchedAt,
  };
});

const respondFriendRequestTransaction = db.transaction((usernameRaw, requestIdRaw, actionRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const requestId = Math.floor(Number(requestIdRaw));
  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw new GameRuleError('Neplatne requestId.', 400);
  }
  const action = String(actionRaw ?? '').trim().toLowerCase();
  if (action !== 'accept' && action !== 'reject') {
    throw new GameRuleError("Akce muze byt jen 'accept' nebo 'reject'.", 400);
  }

  const pendingRequest = selectPendingFriendRequestByReceiverStmt.get(requestId, player.id);
  if (!pendingRequest) {
    throw new GameRuleError('Pozadost nebyla nalezena.', 404);
  }

  const actedAt = nowIso();
  updateFriendRequestStatusStmt.run(action === 'accept' ? 'accepted' : 'rejected', actedAt, requestId);
  if (action === 'accept') {
    const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(
      pendingRequest.senderPlayerId,
      pendingRequest.receiverPlayerId,
    );
    insertFriendshipStmt.run(lowPlayerId, highPlayerId, actedAt);
  }
  touchPlayerPresence(player.id, actedAt);
  return {
    requestId,
    action,
    actedAt,
  };
});

const removeFriendTransaction = db.transaction((usernameRaw, targetUsernameRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const target = requireAnotherPlayerByUsername(player.id, targetUsernameRaw);
  const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(player.id, target.id);
  const removed = Number(deleteFriendshipStmt.run(lowPlayerId, highPlayerId).changes ?? 0);
  touchPlayerPresence(player.id, nowIso());
  if (removed <= 0) {
    throw new GameRuleError('Hrac neni ve tvem seznamu pratel.', 404);
  }
  return {
    removedPlayerId: target.id,
    removedUsername: target.username,
  };
});

const blockPlayerTransaction = db.transaction((usernameRaw, targetUsernameRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const target = requireAnotherPlayerByUsername(player.id, targetUsernameRaw);
  const actedAt = nowIso();
  insertBlockPairStmt.run(player.id, target.id, actedAt);
  const { lowPlayerId, highPlayerId } = normalizeLowerPlayerId(player.id, target.id);
  deleteFriendshipStmt.run(lowPlayerId, highPlayerId);
  rejectPendingFriendRequestsBetweenPairStmt.run(actedAt, player.id, target.id, target.id, player.id);
  touchPlayerPresence(player.id, actedAt);
  return {
    blockedPlayerId: target.id,
    blockedUsername: target.username,
    blockedAt: actedAt,
  };
});

const unblockPlayerTransaction = db.transaction((usernameRaw, targetUsernameRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const target = requireAnotherPlayerByUsername(player.id, targetUsernameRaw);
  const actedAt = nowIso();
  const changed = Number(deleteBlockPairStmt.run(player.id, target.id).changes ?? 0);
  touchPlayerPresence(player.id, actedAt);
  if (changed <= 0) {
    throw new GameRuleError('Hrac nebyl blokovan.', 404);
  }
  return {
    unblockedPlayerId: target.id,
    unblockedUsername: target.username,
    unblockedAt: actedAt,
  };
});

const setAvatarTransaction = db.transaction((usernameRaw, avatarUrlRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const profile = selectPlayerProfileStmt.get(player.id);
  const previousAvatarUrl = profile?.avatarUrl == null ? null : String(profile.avatarUrl);
  const avatarUrl = normalizeAvatarUrl(avatarUrlRaw);
  const touchedAt = nowIso();
  upsertPlayerProfileStmt.run(player.id, avatarUrl, touchedAt);
  touchPlayerPresence(player.id, touchedAt);
  return {
    playerId: player.id,
    previousAvatarUrl,
    avatarUrl: toPublicAvatarUrl(avatarUrl),
    updatedAt: touchedAt,
  };
});

const setAvatarFromDataUrlTransaction = db.transaction((usernameRaw, avatarDataUrlRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const profile = selectPlayerProfileStmt.get(player.id);
  const previousAvatarUrl = profile?.avatarUrl == null ? null : String(profile.avatarUrl);
  const avatarUrl = storeAvatarDataUrl(player.id, avatarDataUrlRaw);
  const touchedAt = nowIso();
  upsertPlayerProfileStmt.run(player.id, avatarUrl, touchedAt);
  touchPlayerPresence(player.id, touchedAt);
  return {
    playerId: player.id,
    previousAvatarUrl,
    avatarUrl: toPublicAvatarUrl(avatarUrl),
    updatedAt: touchedAt,
  };
});

const setCommunicationUiStateTransaction = db.transaction((usernameRaw, uiStateRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const serialized = normalizeUiStatePayload(uiStateRaw);
  const updatedAt = nowIso();
  upsertPlayerUiStateStmt.run(player.id, serialized, updatedAt);
  touchPlayerPresence(player.id, updatedAt);
  return {
    updatedAt,
  };
});

const createNotificationShareTransaction = db.transaction((usernameRaw, notificationIdRaw, worldIdRaw = null) => {
  const player = requirePlayerByUsername(usernameRaw);
  const notificationId = Math.floor(Number(notificationIdRaw));
  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    throw new GameRuleError('Neplatne notificationId.', 400);
  }
  const expectedRegion = normalizeOptionalWorldRegion(worldIdRaw);
  const notification = selectPlayerNotificationForShareStmt.get(notificationId, player.id);
  if (!notification) {
    throw new GameRuleError('Oznameni nebylo nalezeno.', 404);
  }
  if (notification.deletedAt != null) {
    throw new GameRuleError('Oznameni bylo smazano a nelze jej sdilet.', 410);
  }
  const notificationRegion = Number(notification.region ?? 0);
  if (expectedRegion != null && expectedRegion !== notificationRegion) {
    throw new GameRuleError('Oznameni nepatri do vybraneho sveta.', 404);
  }

  const sharedAt = nowIso();
  let shareToken = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    shareToken = generateShareToken();
    try {
      insertNotificationShareStmt.run(
        shareToken,
        player.id,
        notificationId,
        notificationRegion,
        sharedAt,
      );
      break;
    } catch (error) {
      if (attempt >= 3 || !isSqliteUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  touchPlayerPresence(player.id, sharedAt);
  return {
    shareToken,
    sharedAt,
    notification: {
      id: notificationId,
      region: notificationRegion,
      category: String(notification.category),
      eventType: String(notification.eventType),
      severity: String(notification.severity),
      title: String(notification.title),
      summary: String(notification.summary),
      payload: parseJsonSafe(notification.payloadJson, {}),
      createdAt: String(notification.createdAt),
    },
  };
});

const resolveNotificationSharePreview = (usernameRaw, shareTokenRaw) => {
  const player = requirePlayerByUsername(usernameRaw);
  const shareToken = String(shareTokenRaw ?? '').trim();
  if (!shareToken || shareToken.length > 128) {
    throw new GameRuleError('Neplatny share token.', 400);
  }
  const share = selectNotificationShareByTokenStmt.get(shareToken);
  if (!share) {
    throw new GameRuleError('Sdilene oznameni nebylo nalezeno.', 404);
  }

  touchPlayerPresence(player.id);
  const sourceNotificationId = Number(share.sourceNotificationId ?? 0);
  const sourcePlayerId = Number(share.sourcePlayerId ?? 0);
  const baseResult = {
    shareToken,
    sharedAt: String(share.sharedAt),
    sourcePlayerId,
    sourceUsername: String(share.sourceUsername ?? 'Neznamy hrac'),
    sourceNotificationId,
    available: false,
    notification: null,
  };

  if (!Number.isFinite(sourceNotificationId) || sourceNotificationId <= 0 || share.deletedAt != null) {
    return {
      ...baseResult,
      deleted: true,
    };
  }

  return {
    ...baseResult,
    available: true,
    deleted: false,
    battleReport: (() => {
      const notificationPayload = parseJsonSafe(share.payloadJson, {});
      const reportIdRaw = Number(notificationPayload?.reportId ?? 0);
      if (!Number.isFinite(reportIdRaw) || reportIdRaw <= 0) {
        return null;
      }
      const battleReport = selectBattleReportByIdStmt.get(Math.floor(reportIdRaw));
      if (!battleReport) {
        return null;
      }
      return {
        id: Number(battleReport.id),
        playerId: Number(battleReport.playerId),
        originVillageId:
          battleReport.originVillageId == null ? null : Number(battleReport.originVillageId),
        targetVillageId:
          battleReport.targetVillageId == null ? null : Number(battleReport.targetVillageId),
        battleAt: String(battleReport.battleAt),
        createdAt: String(battleReport.createdAt),
        title: String(battleReport.title ?? ''),
        summary: String(battleReport.summary ?? ''),
        payload: parseJsonSafe(battleReport.payloadJson, {}),
      };
    })(),
    notification: {
      id: sourceNotificationId,
      category: String(share.category ?? ''),
      eventType: String(share.eventType ?? ''),
      severity: String(share.severity ?? 'info'),
      title: String(share.title ?? ''),
      summary: String(share.summary ?? ''),
      payload: parseJsonSafe(share.payloadJson, {}),
      createdAt: String(share.notificationCreatedAt ?? share.sharedAt),
      readAt: share.readAt == null ? null : String(share.readAt),
      archivedAt: share.archivedAt == null ? null : String(share.archivedAt),
    },
  };
};

const listCommunicationTokenSuggestionsInternal = (
  usernameRaw,
  { tokenType: tokenTypeRaw, query: queryRaw, limit: limitRaw } = {},
) => {
  const player = requirePlayerByUsername(usernameRaw);
  const tokenType = String(tokenTypeRaw ?? '').trim().toLowerCase();
  const query = String(queryRaw ?? '').trim();
  const limit = Math.max(1, Math.min(MAX_TOKEN_SUGGESTIONS, Math.floor(Number(limitRaw) || 8)));
  touchPlayerPresence(player.id);

  if (!query) {
    return {
      tokenType,
      query,
      suggestions: [],
    };
  }

  if (tokenType === 'user') {
    const friendRows = selectFriendRowsByPlayerStmt.all(player.id, player.id, player.id);
    const friendSet = new Set(friendRows.map((row) => Number(row.playerId)));
    const blockedRows = selectBlockRowsByPlayerStmt.all(player.id);
    const blockedSet = new Set(blockedRows.map((row) => Number(row.playerId)));
    const suggestions = searchPlayersStmt
      .all(player.username, `%${query}%`, limit)
      .map((row) => {
        const targetPlayerId = Number(row.playerId);
        if (blockedSet.has(targetPlayerId)) {
          return null;
        }
        const isFriend = friendSet.has(targetPlayerId);
        return {
          kind: 'user',
          label: String(row.username),
          value: `@${String(row.username)}`,
          playerId: targetPlayerId,
          avatarUrl: toPublicAvatarUrl(row.avatarUrl),
          relation: toFriendRelation(player.id, targetPlayerId, friendSet),
          isFriend,
        };
      })
      .filter(Boolean);

    return {
      tokenType,
      query,
      suggestions,
    };
  }

  if (tokenType === 'kingdom') {
    const suggestions = searchKingdomMentionsStmt
      .all(`%${query}%`, limit)
      .map((row) => ({
        kind: 'kingdom',
        label: String(row.kingdom),
        value: `#${String(row.kingdom)}`,
        villages: Number(row.villages ?? 0),
      }));
    return {
      tokenType,
      query,
      suggestions,
    };
  }

  if (tokenType === 'village') {
    const byName = searchVillageMentionsByNameStmt.all(`%${query}%`, limit);
    const byCoords = searchVillageMentionsByCoordsStmt.all(`${query}%`, `${query}%`, limit);
    const dedupe = new Map();
    for (const row of [...byName, ...byCoords]) {
      const villageId = Number(row.villageId);
      if (!Number.isFinite(villageId) || villageId <= 0 || dedupe.has(villageId)) {
        continue;
      }
      dedupe.set(villageId, {
        kind: 'village',
        label: `${String(row.name)} (${Number(row.coordX)}|${Number(row.coordY)})`,
        value: `_${Number(row.coordX)}|${Number(row.coordY)}_`,
        villageId,
        villageName: String(row.name),
        coordX: Number(row.coordX),
        coordY: Number(row.coordY),
        ownerUsername: String(row.ownerUsername ?? ''),
        kingdom: String(row.kingdom ?? 'Neutral'),
      });
      if (dedupe.size >= limit) {
        break;
      }
    }
    return {
      tokenType,
      query,
      suggestions: [...dedupe.values()],
    };
  }

  throw new GameRuleError('Neplatny typ tokenu pro napovidani.', 400);
};

export const openCommunicationThread = (username, payload = {}) => openThreadTransaction(username, payload);

export const sendCommunicationMessage = (username, payload = {}) => sendMessageTransaction(username, payload);

export const archiveCommunicationThread = (username, threadId) => setThreadArchivedTransaction(username, threadId);

export const deleteCommunicationMessage = (username, messageId) => deleteMessageTransaction(username, messageId);

export const sendFriendRequest = (username, targetUsername) =>
  sendFriendRequestTransaction(username, targetUsername);

export const respondFriendRequest = (username, requestId, action) =>
  respondFriendRequestTransaction(username, requestId, action);

export const removeFriend = (username, targetUsername) => removeFriendTransaction(username, targetUsername);

export const blockPlayer = (username, targetUsername) => blockPlayerTransaction(username, targetUsername);

export const unblockPlayer = (username, targetUsername) => unblockPlayerTransaction(username, targetUsername);

export const setCommunicationAvatar = (username, avatarUrl) => {
  const result = setAvatarTransaction(username, avatarUrl);
  if (result.previousAvatarUrl && result.previousAvatarUrl !== result.avatarUrl) {
    deleteManagedAvatarFileIfExists(result.previousAvatarUrl);
  }
  return {
    playerId: result.playerId,
    avatarUrl: result.avatarUrl,
    updatedAt: result.updatedAt,
  };
};

export const setCommunicationAvatarFromDataUrl = (username, avatarDataUrl) => {
  const result = setAvatarFromDataUrlTransaction(username, avatarDataUrl);
  if (result.previousAvatarUrl && result.previousAvatarUrl !== result.avatarUrl) {
    deleteManagedAvatarFileIfExists(result.previousAvatarUrl);
  }
  return {
    playerId: result.playerId,
    avatarUrl: result.avatarUrl,
    updatedAt: result.updatedAt,
  };
};

export { COMMUNICATION_AVATAR_PUBLIC_PATH, COMMUNICATION_AVATAR_STORAGE_DIR };

export const setCommunicationUiState = (username, uiState) =>
  setCommunicationUiStateTransaction(username, uiState);

export const createNotificationShare = (username, notificationId, worldId = null) =>
  createNotificationShareTransaction(username, notificationId, worldId);

export const getNotificationSharePreview = (username, shareToken) =>
  resolveNotificationSharePreview(username, shareToken);

export const listCommunicationTokenSuggestions = (username, options = {}) =>
  listCommunicationTokenSuggestionsInternal(username, options);

export const listCommunicationInbox = (usernameRaw, options = {}) => {
  cleanupCommunicationRetention();
  const player = requirePlayerByUsername(usernameRaw);
  const touchedAt = touchPlayerPresence(player.id);
  const summaryOnly = options?.summaryOnly === true;
  const selectedThreadIdRaw = options?.threadId == null ? null : Number(options.threadId);
  const selectedThreadId =
    Number.isFinite(selectedThreadIdRaw) && selectedThreadIdRaw > 0 ? Math.floor(selectedThreadIdRaw) : null;
  const threadLimitRaw = Number(options?.threadLimit ?? MAX_THREAD_COUNT);
  const threadLimit = Math.max(5, Math.min(MAX_THREAD_COUNT, Math.floor(threadLimitRaw) || MAX_THREAD_COUNT));
  const messagesBeforeIdRaw = Number(options?.beforeMessageId ?? 0);
  const messagesBeforeId = Number.isFinite(messagesBeforeIdRaw) && messagesBeforeIdRaw > 0 ? messagesBeforeIdRaw : null;
  const messageLimitRaw = Number(options?.messageLimit ?? MAX_THREAD_MESSAGES);
  const messageLimit = Math.max(10, Math.min(MAX_THREAD_MESSAGES, Math.floor(messageLimitRaw) || MAX_THREAD_MESSAGES));
  const searchTerm = String(options?.search ?? '').trim();

  const profile = selectPlayerProfileStmt.get(player.id);
  const uiStateRow = selectPlayerUiStateStmt.get(player.id);
  const incomingFriendRequests = summaryOnly
    ? []
    : selectPendingIncomingFriendRequestsStmt
        .all(player.id)
        .map((row) => ({
          id: Number(row.id),
          senderPlayerId: Number(row.senderPlayerId),
          senderUsername: String(row.senderUsername),
          senderAvatarUrl: toPublicAvatarUrl(row.senderAvatarUrl),
          createdAt: String(row.createdAt),
        }));
  const incomingFriendRequestCount = summaryOnly
    ? Number(countPendingIncomingFriendRequestsStmt.get(player.id)?.total ?? 0)
    : incomingFriendRequests.length;
  const outgoingFriendRequests = summaryOnly
    ? []
    : selectPendingOutgoingFriendRequestsStmt
        .all(player.id)
        .map((row) => ({
          id: Number(row.id),
          receiverPlayerId: Number(row.receiverPlayerId),
          receiverUsername: String(row.receiverUsername),
          receiverAvatarUrl: toPublicAvatarUrl(row.receiverAvatarUrl),
          createdAt: String(row.createdAt),
        }));
  const friendRows = summaryOnly ? [] : selectFriendRowsByPlayerStmt.all(player.id, player.id, player.id);
  const friends = friendRows.map((row) => {
    const presence = toPresence(row.lastActiveAt);
    return {
      playerId: Number(row.playerId),
      username: String(row.username),
      avatarUrl: toPublicAvatarUrl(row.avatarUrl),
      isOnline: presence.isOnline,
      lastActiveAt: presence.lastActiveAt,
    };
  });
  const friendSet = new Set(friends.map((friend) => Number(friend.playerId)));

  const blockedRows = summaryOnly ? [] : selectBlockRowsByPlayerStmt.all(player.id);
  const blockedSet = new Set(blockedRows.map((row) => Number(row.playerId)));
  const blockedPlayers = blockedRows
    .map((row) => selectPlayerByIdStmt.get(Number(row.playerId)))
    .filter(Boolean)
    .map((row) => ({
      playerId: Number(row.id),
      username: String(row.username),
    }));

  const threadPayload = listThreadSummaries(player.id, threadLimit, !summaryOnly);
  const threads =
    summaryOnly
      ? []
      : searchTerm
          ? threadPayload.threads.filter((thread) =>
              thread.otherPlayer.username.toLocaleLowerCase('cs-CZ').includes(searchTerm.toLocaleLowerCase('cs-CZ')),
            )
          : threadPayload.threads;

  let selectedMessages = [];
  if (!summaryOnly && selectedThreadId != null) {
    selectedMessages = listThreadMessages(player.id, selectedThreadId, messagesBeforeId, messageLimit);
  }

  const suggestions =
    !summaryOnly && searchTerm.length > 0
      ? searchPlayersStmt
          .all(player.username, `%${searchTerm}%`, MAX_SEARCH_RESULTS)
          .map((row) => {
            const targetPlayerId = Number(row.playerId);
            const presence = toPresence(row.lastActiveAt);
            const isFriend = friendSet.has(targetPlayerId);
            const visiblePresence = isFriend ? presence : { isOnline: false, lastActiveAt: null };
            return {
              playerId: targetPlayerId,
              username: String(row.username),
              avatarUrl: toPublicAvatarUrl(row.avatarUrl),
              isOnline: visiblePresence.isOnline,
              lastActiveAt: visiblePresence.lastActiveAt,
              isFriend,
              isBlocked: blockedSet.has(targetPlayerId),
              relation: toFriendRelation(player.id, targetPlayerId, friendSet),
            };
          })
          .filter((row) => !blockedSet.has(Number(row.playerId)))
      : [];

  const response = {
    serverTime: touchedAt,
    me: {
      playerId: player.id,
      username: player.username,
      avatarUrl: toPublicAvatarUrl(profile?.avatarUrl),
      avatarUpdatedAt: profile?.avatarUpdatedAt == null ? null : String(profile.avatarUpdatedAt),
    },
    uiState: {
      communication: parseJsonSafe(uiStateRow?.communicationJson, {}),
      updatedAt: uiStateRow?.updatedAt == null ? null : String(uiStateRow.updatedAt),
    },
    summary: {
      unreadMessages: threadPayload.unreadTotal,
      messageRequests: threadPayload.messageRequestTotal,
      friendRequests: incomingFriendRequestCount,
      totalAttention:
        threadPayload.unreadTotal +
        threadPayload.messageRequestTotal +
        incomingFriendRequestCount,
    },
    threads,
    selectedThreadId,
    selectedMessages,
    friends,
    friendRequests: {
      incoming: incomingFriendRequests,
      outgoing: outgoingFriendRequests,
    },
    blockedPlayers,
    suggestions,
  };
  if (summaryOnly) {
    response.threads = [];
    response.selectedThreadId = null;
    response.selectedMessages = [];
    response.friends = [];
    response.friendRequests = {
      incoming: [],
      outgoing: [],
    };
    response.blockedPlayers = [];
    response.suggestions = [];
  }
  return response;
};

export const runCommunicationRetentionCleanup = (force = false) => cleanupCommunicationRetention(force);

export const listCommunicationSummary = (usernameRaw) =>
  listCommunicationInbox(usernameRaw, {
    summaryOnly: true,
  });
