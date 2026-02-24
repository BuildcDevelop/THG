import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasSelectedWorld, isAuthenticated, login, register } from '../auth';

type AuthMode = 'login' | 'register';
type ProjectUpdateStatus = 'live' | 'in-progress' | 'planned';
const REGISTRATION_USERNAME_MAX_LENGTH = 20;

type ProjectUpdate = {
  id: string;
  date: string;
  title: string;
  summary: string;
  status: ProjectUpdateStatus;
  href?: string;
  hrefLabel?: string;
};

const PROJECT_UPDATES_FALLBACK: ProjectUpdate[] = [
  {
    id: 'v0-1-0-05',
    date: '2026-02-23',
    title: 'Verze 0.1.0.05: Izolace herních dat podle světa',
    summary:
      'Království, pozvánky, audity a reset postupu jsou striktně oddělené po světech. Účet hráče zůstává univerzální napříč platformou.',
    status: 'live',
  },
  {
    id: 'spawn-random-1-3',
    date: '2026-02-21',
    title: 'Náhodný rozestup spawnu 1-3',
    summary: 'Nové osady i opuštěné osady kolem spawnu se rozmisťují v náhodném rozestupu 1-3 políčka.',
    status: 'live',
  },
  {
    id: 'scout-intel',
    date: '2026-02-21',
    title: 'Nová jednotka Zvěd',
    summary: 'Zvěd přináší špionážní hlášení o budovách a jednotkách, při ztrátách mohou být data přibližná.',
    status: 'live',
  },
  {
    id: 'discord-channel',
    date: '2026-02-17',
    title: 'Komunitní komunikace přes Discord',
    summary: 'Všechny novinky, patch notes a koordinace jsou centralizované na Discordu.',
    status: 'live',
    href: 'https://discord.com/channels/1358102394180730944/1473961374949441628',
    hrefLabel: 'Přejít na Discord',
  },
  {
    id: 'ruleset-plan',
    date: '2026-03-10',
    title: 'Plný svět podle pravidel',
    summary: 'Další krok je dotažení ekonomiky, boje a mapové dominance podle kompletních pravidel.',
    status: 'planned',
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
  const [mode, setMode] = useState<AuthMode>('login');
  const [isTimelineOpen, setTimelineOpen] = useState(false);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>(PROJECT_UPDATES_FALLBACK);
  const [isUpdatesLoading, setUpdatesLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    navigate(hasSelectedWorld() ? '/game' : '/worlds', { replace: true });
  }, [navigate]);

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

      <main className="login-shell">
        <section className="intro-panel">
          <p className="intro-eyebrow">TLD Portál</p>
          <h1>Dominion čeká na dalšího velitele.</h1>
          <p className="intro-text">
            Globální herní účet, volba světa po přihlášení a strategické jádro inspirované
            legendou Divokých Kmenů. Buduj, koordinuj aliance a postupně ovládni mapu.
          </p>
          <div className="intro-tags">
            <span>Globální účet napříč světy</span>
            <span>Case-insensitive herní nick</span>
            <span>Inspirace: Divoké Kmeny</span>
          </div>

          <section className="intro-updates-card">
            <h3>Herní updaty</h3>
            <p>
              Novinky k TLD, patch notes a komunitní koordinace najdeš na oficiálním Discord
              kanálu.
            </p>
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
              {projectUpdates.map((update) => (
                <article className="intro-update-item" key={update.id}>
                  <p className="intro-update-meta">
                    <span className={`intro-update-status status-${update.status}`}>
                      {UPDATE_STATUS_LABEL[update.status]}
                    </span>
                    <time dateTime={update.date}>{formatUpdateDate(update.date)}</time>
                  </p>
                  <strong>{update.title}</strong>
                  <p>{update.summary}</p>
                  {update.href ? (
                    <a href={update.href} target="_blank" rel="noreferrer">
                      {update.hrefLabel ?? 'Zjistit více'}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
            <button
              type="button"
              className="intro-timeline-toggle"
              onClick={() => setTimelineOpen((previous) => !previous)}
              aria-expanded={isTimelineOpen}
            >
              Časová osa pro projekt TLD
            </button>
            {isTimelineOpen ? (
              <div className="timeline-card">
                <p>
                  Připravuji projekt pro první funkční prototyp s následným plánem udělat hrající
                  svět dle skutečných pravidel.
                </p>
                <ol>
                  <li>
                    <span className="timeline-dot done" aria-hidden="true" />
                    <div>
                      <strong>Architektura a herní jádro</strong>
                      <small>Dokončeno</small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot current" aria-hidden="true" />
                    <div>
                      <strong>První funkční prototyp</strong>
                      <small>Aktuální fáze</small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot next" aria-hidden="true" />
                    <div>
                      <strong>Svět podle plných pravidel</strong>
                      <small>Směr dalšího vývoje</small>
                    </div>
                  </li>
                </ol>
              </div>
            ) : null}
          </section>
        </section>

        <section className="auth-panel">
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


