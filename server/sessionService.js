import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export const SESSION_COOKIE_NAME = String(process.env.TLD_SESSION_COOKIE_NAME ?? 'tld_session').trim() || 'tld_session';

const selectPlayerByUsernameStmt = db.prepare(
  `SELECT
      id,
      username
   FROM players
   WHERE username = ? COLLATE NOCASE
     AND is_bot = 0
   LIMIT 1`,
);

const insertSessionStmt = db.prepare(
  `INSERT INTO player_sessions (
      session_token_hash,
      player_id,
      created_at,
      expires_at,
      last_seen_at,
      user_agent,
      ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const selectSessionStmt = db.prepare(
  `SELECT
      session.session_token_hash AS sessionTokenHash,
      session.player_id AS playerId,
      session.created_at AS createdAt,
      session.expires_at AS expiresAt,
      session.last_seen_at AS lastSeenAt,
      player.username AS username
   FROM player_sessions session
   INNER JOIN players player ON player.id = session.player_id
   WHERE session.session_token_hash = ?
     AND session.expires_at > ?
     AND player.is_bot = 0
   LIMIT 1`,
);

const updateSessionSeenStmt = db.prepare(
  `UPDATE player_sessions
   SET last_seen_at = ?
   WHERE session_token_hash = ?`,
);

const deleteSessionStmt = db.prepare(
  `DELETE FROM player_sessions
   WHERE session_token_hash = ?`,
);

const deleteExpiredSessionsStmt = db.prepare(
  `DELETE FROM player_sessions
   WHERE expires_at <= ?`,
);

const nowIso = () => new Date().toISOString();

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const buildCookieOptions = () => {
  const env = String(process.env.TLD_ENV ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
  const sameSite = String(process.env.TLD_SESSION_SAME_SITE ?? 'lax').trim().toLowerCase();
  const secure = env === 'production';
  return {
    httpOnly: true,
    sameSite: sameSite === 'strict' ? 'strict' : sameSite === 'none' ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
};

const parseCookies = (cookieHeaderRaw) => {
  const cookieHeader = String(cookieHeaderRaw ?? '').trim();
  if (!cookieHeader) {
    return {};
  }
  const parsed = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    parsed[key] = decodeURIComponent(value);
  }
  return parsed;
};

let lastCleanupAtMs = 0;
export const cleanupExpiredSessions = (force = false) => {
  const nowMs = Date.now();
  if (!force && nowMs - lastCleanupAtMs < SESSION_CLEANUP_INTERVAL_MS) {
    return 0;
  }
  lastCleanupAtMs = nowMs;
  return Number(deleteExpiredSessionsStmt.run(new Date(nowMs).toISOString()).changes ?? 0);
};

export const createSessionForUsername = (usernameRaw, context = {}) => {
  cleanupExpiredSessions();
  const username = String(usernameRaw ?? '').trim();
  const player = selectPlayerByUsernameStmt.get(username);
  if (!player) {
    throw new Error(`Hrac '${username}' neexistuje.`);
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  insertSessionStmt.run(
    tokenHash,
    Number(player.id),
    createdAt,
    expiresAt,
    createdAt,
    context.userAgent == null ? null : String(context.userAgent).slice(0, 400),
    context.ipAddress == null ? null : String(context.ipAddress).slice(0, 80),
  );

  return {
    token,
    cookieOptions: buildCookieOptions(),
    expiresAt,
    playerId: Number(player.id),
    username: String(player.username),
  };
};

export const clearSessionByToken = (tokenRaw) => {
  const token = String(tokenRaw ?? '').trim();
  if (!token) {
    return 0;
  }
  return Number(deleteSessionStmt.run(hashToken(token)).changes ?? 0);
};

export const clearSessionFromRequest = (request) => {
  const cookies = parseCookies(request?.headers?.cookie);
  const token = String(cookies[SESSION_COOKIE_NAME] ?? '').trim();
  return clearSessionByToken(token);
};

export const resolveSessionFromRequest = (request) => {
  cleanupExpiredSessions();
  const cookies = parseCookies(request?.headers?.cookie);
  const token = String(cookies[SESSION_COOKIE_NAME] ?? '').trim();
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = nowIso();
  const session = selectSessionStmt.get(tokenHash, now);
  if (!session) {
    return null;
  }

  updateSessionSeenStmt.run(now, tokenHash);
  return {
    token,
    tokenHash,
    playerId: Number(session.playerId),
    username: String(session.username),
    createdAt: String(session.createdAt),
    expiresAt: String(session.expiresAt),
    lastSeenAt: now,
  };
};

