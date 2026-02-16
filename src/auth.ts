import { loginRequest } from './api/gameApi';

const AUTH_STORAGE_KEY = 'thg_session';

export type Session = {
  username: string;
  loggedAt: string;
};

type LoginResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export const setSession = (username: string): void => {
  const session: Session = {
    username,
    loggedAt: new Date().toISOString(),
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

    return { ok: false, error: 'Prihlaseni se nezdarilo.' };
  }
};

export const logout = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getSession = (): Session | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.username) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => Boolean(getSession());
