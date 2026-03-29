import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, hasSelectedWorld, isAuthenticated, login, logout, register } from '../auth';

type AuthMode = 'login' | 'register';
type ProjectUpdateStatus = 'live' | 'in-progress' | 'planned';
const REGISTRATION_USERNAME_MAX_LENGTH = 20;

type ProjectUpdate = {
  id: string;
  date: string;
  title: string;
  summary: string;
  details?: string[];
  status: ProjectUpdateStatus;
  href?: string;
  hrefLabel?: string;
};

const PROJECT_UPDATES_FALLBACK: ProjectUpdate[] = [
  {
    id: 'v0-1-17',
    date: '2026-03-29',
    title: 'Verze 0.1.17: Trh, logistika a skupiny lén',
    summary:
      'Rychlejší posílání surovin, ruční souřadnice cíle a čistší správa skupin lén.',
    details: [
      'Automatické posílání surovin umí obsloužit více cílů v jednom cyklu.',
      'Ze seznamu automatizace lze cíle přímo odebrat.',
      'Suroviny lze poslat i ručně na zadané souřadnice.',
      'Na mapě přibyla volba Poslat suroviny v pravém menu.',
      'Přehled skupin lén má čistší zobrazení a lepší čitelnost.',
      'Správa lépe ukazuje obranné ukazatele: opevnění, brána a rytíř.',
    ],
    status: 'live',
  },
];

const UPDATE_STATUS_LABEL: Record<ProjectUpdateStatus, string> = {
  live: 'LIVE',
  'in-progress': 'Ve vývoji',
  planned: 'Plán',
};

const UPDATE_STATUS_VALUES: ProjectUpdateStatus[] = ['live', 'in-progress', 'planned'];

const isProjectUpdateStatus = (value: unknown): value is ProjectUpdateStatus =>
  typeof value === 'string' && UPDATE_STATUS_VALUES.includes(value as ProjectUpdateStatus);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeUpdateDetails = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => isNonEmptyString(entry))
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
};

const normalizeProjectUpdates = (value: unknown): ProjectUpdate[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const updates: ProjectUpdate[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const candidate = item as Partial<ProjectUpdate>;

    if (
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.date) ||
      !isNonEmptyString(candidate.title) ||
      !isNonEmptyString(candidate.summary) ||
      !isProjectUpdateStatus(candidate.status)
    ) {
      return;
    }

    const parsedUpdate: ProjectUpdate = {
      id: candidate.id || `update-${index}`,
      date: candidate.date,
      title: candidate.title,
      summary: candidate.summary,
      details: normalizeUpdateDetails((candidate as { details?: unknown }).details),
      status: candidate.status,
    };

    if (isNonEmptyString(candidate.href)) {
      parsedUpdate.href = candidate.href;
    }

    if (isNonEmptyString(candidate.hrefLabel)) {
      parsedUpdate.hrefLabel = candidate.hrefLabel;
    }

    updates.push(parsedUpdate);
  });

  return updates;
};

const formatUpdateDate = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) {
    return dateValue;
  }

  const localDate = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(localDate);
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const session = getSession();
  const authenticated = isAuthenticated();
  const [mode, setMode] = useState<AuthMode>('login');
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>(PROJECT_UPDATES_FALLBACK);
  const [isUpdatesLoading, setUpdatesLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCanceled = false;

    const loadUpdates = async () => {
      try {
        const response = await fetch('/data/project-updates.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as { updates?: unknown };
        const normalizedUpdates = normalizeProjectUpdates(payload?.updates);

        if (isCanceled) {
          return;
        }

        if (normalizedUpdates.length > 0) {
          setProjectUpdates(normalizedUpdates);
        } else {
          setProjectUpdates(PROJECT_UPDATES_FALLBACK);
        }
      } catch {
        if (!isCanceled) {
          setProjectUpdates(PROJECT_UPDATES_FALLBACK);
        }
      } finally {
        if (!isCanceled) {
          setUpdatesLoading(false);
        }
      }
    };

    void loadUpdates();

    return () => {
      isCanceled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setError('Vyplň herní nick i heslo.');
      return;
    }

    if (mode === 'register' && normalizedUsername.length > REGISTRATION_USERNAME_MAX_LENGTH) {
      setError(`Herní nick může mít maximálně ${REGISTRATION_USERNAME_MAX_LENGTH} znaků.`);
      return;
    }

    if (mode === 'register' && normalizedPassword !== confirmPassword.trim()) {
      setError('Potvrzení hesla se neshoduje.');
      return;
    }

    setIsSubmitting(true);
    const action = mode === 'register' ? register : login;
    const result = await action(normalizedUsername, normalizedPassword);

    if (result.ok) {
      navigate('/worlds', { replace: true });
      return;
    }

    setIsSubmitting(false);
    setError(result.error || 'Autentizace selhala.');
  };

  return (
    <div className="login-page">
      <div className="login-bg-layer" />
      <div className="login-noise-layer" />

      <main className="login-shell app-content-container">
        <section className="intro-panel">
          <p className="intro-eyebrow">TLD Portál</p>
          <h1>Verze 0.1.17 je live.</h1>
          <p className="intro-text">Krátký přehled novinek najdeš níže. Kliknutím otevřeš detail update.</p>
          <div className="intro-tags">
            <span>Trh a logistika</span>
            <span>Skupiny lén</span>
            <span>UI polish</span>
          </div>

          <section className="intro-updates-card">
            <h3>Aktuální update</h3>
            <p>Minimal přehled změn. Pro detail otevři kartu update.</p>
            <a
              className="intro-discord-link"
              href="https://discord.com/channels/1358102394180730944/1473961374949441628"
              target="_blank"
              rel="noreferrer"
            >
              Otevřít Discord kanál
            </a>
            <div className="intro-updates-feed" aria-live="polite">
              {isUpdatesLoading ? <p className="intro-updates-loading">Načítám poslední updaty...</p> : null}
              {projectUpdates.map((update) => {
                const isOpen = expandedUpdateId === update.id;
                const detailsSectionId = `intro-update-details-${update.id}`;
                const hasDetails = Boolean((update.details?.length ?? 0) > 0 || update.href);

                return (
                  <article className={`intro-update-item ${isOpen ? 'is-open' : ''}`} key={update.id}>
                    <div className="intro-update-head">
                      <p className="intro-update-meta">
                        <span className={`intro-update-status status-${update.status}`}>
                          {UPDATE_STATUS_LABEL[update.status]}
                        </span>
                        <time dateTime={update.date}>{formatUpdateDate(update.date)}</time>
                      </p>
                      {hasDetails ? (
                        <button
                          type="button"
                          className="intro-update-toggle"
                          onClick={() => setExpandedUpdateId((previous) => (previous === update.id ? null : update.id))}
                          aria-expanded={isOpen}
                          aria-controls={detailsSectionId}
                        >
                          {isOpen ? 'Skrýt detail' : 'Detail'}
                        </button>
                      ) : null}
                    </div>
                    <strong>{update.title}</strong>
                    <p className="intro-update-summary">{update.summary}</p>
                    <div
                      id={detailsSectionId}
                      className={`intro-update-details ${isOpen ? 'is-open' : ''}`}
                      aria-hidden={!isOpen}
                    >
                      {update.details && update.details.length > 0 ? (
                        <ul>
                          {update.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                      {update.href ? (
                        <a href={update.href} target="_blank" rel="noreferrer">
                          {update.hrefLabel ?? 'Zjistit více'}
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>

        <section className="auth-panel">
          {authenticated ? (
            <section className="auth-quick-entry">
              <h3>Jsi přihlášen jako {session?.username ?? 'hráč'}</h3>
              <div className="auth-quick-entry-actions">
                {hasSelectedWorld() ? (
                  <button type="button" className="auth-submit" onClick={() => navigate('/game', { replace: true })}>
                    Pokračovat do hraného světa
                  </button>
                ) : null}
                <button type="button" className="secondary-action" onClick={() => navigate('/worlds', { replace: true })}>
                  Přesunout se do Portálu světů
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  Odhlásit
                </button>
              </div>
            </section>
          ) : null}
          <div className="auth-mode-switch" role="tablist" aria-label="Režim autentizace">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-mode-btn ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Přihlášení
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-mode-btn ${mode === 'register' ? 'is-active' : ''}`}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Registrace
            </button>
          </div>

          <h2>{mode === 'register' ? 'Vytvoř nový účet' : 'Přihlas se do hry'}</h2>
          <p className="auth-help">
            Herní nick je univerzální a nerozlišuje velikost písmen. Např. Sentryn = sentryn =
            sENtryn. Při registraci je limit 20 znaků.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Herní nick
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Sentryn"
                maxLength={mode === 'register' ? REGISTRATION_USERNAME_MAX_LENGTH : undefined}
                required
              />
            </label>

            <label>
              Heslo
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder="Zadej heslo"
                required
              />
            </label>

            {mode === 'register' ? (
              <label>
                Potvrzení hesla
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Zopakuj heslo"
                  required
                />
              </label>
            ) : null}

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'register'
                  ? 'Zakládám účet...'
                  : 'Přihlašuji...'
                : mode === 'register'
                  ? 'Vytvořit účet a pokračovat'
                  : 'Pokračovat do portálu světů'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};


