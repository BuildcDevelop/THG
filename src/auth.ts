import { loginRequest, registerRequest } from './api/gameApi';

const AUTH_STORAGE_KEY = 'tld_session';
const LEGACY_AUTH_STORAGE_KEY = 'thg_session';
const configuredAdminUsernames = String(import.meta.env.VITE_ADMIN_USERNAMES ?? '').trim();
const ADMIN_USERNAMES = (
  configuredAdminUsernames
    ? configuredAdminUsernames
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : ['Hayato']
).map((entry) => entry.toLocaleLowerCase('cs-CZ'));

export type Session = {
  username: string;
  loggedAt: string;
  selectedWorldId: string | null;
  selectedSpawnDirection: string | null;
};

type LoginResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export const setSession = (
  username: string,
  options?: {
    selectedWorldId?: string | null;
    selectedSpawnDirection?: string | null;
  },
): void => {
  const session: Session = {
    username,
    loggedAt: new Date().toISOString(),
    selectedWorldId: options?.selectedWorldId ?? null,
    selectedSpawnDirection: options?.selectedSpawnDirection ?? null,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const login = async (username: string, password: string): Promise<LoginResult> => {
  try {
    const response = await loginRequest(username, password);
    setSession(response.username);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: 'Přihlášení se nezdařilo.' };
  }
};

export const register = async (username: string, password: string): Promise<LoginResult> => {
  try {
    const response = await registerRequest(username, password);
    setSession(response.username);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: 'Registrace se nezdařila.' };
  }
};

export const setSelectedWorld = (worldId: string, spawnDirection?: string | null): void => {
  const existing = getSession();
  if (!existing) {
    return;
  }

  setSession(existing.username, {
    selectedWorldId: String(worldId || '').trim() || null,
    selectedSpawnDirection: String(spawnDirection ?? existing.selectedSpawnDirection ?? '').trim() || null,
  });
};

export const logout = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
};

export const getSession = (): Session | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY) ?? localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.username) {
      return null;
    }

    return {
      username: parsed.username,
      loggedAt: parsed.loggedAt ?? new Date(0).toISOString(),
      selectedWorldId: parsed.selectedWorldId ?? null,
      selectedSpawnDirection: parsed.selectedSpawnDirection ?? null,
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => Boolean(getSession());
export const hasSelectedWorld = (): boolean => Boolean(getSession()?.selectedWorldId);
export const isAdminAuthenticated = (): boolean => {
  const session = getSession();
  if (!session) {
    return false;
  }
  return ADMIN_USERNAMES.includes(String(session.username).toLocaleLowerCase('cs-CZ'));
};
