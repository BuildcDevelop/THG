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
  status: ProjectUpdateStatus;
  href?: string;
  hrefLabel?: string;
};

const PROJECT_UPDATES_FALLBACK: ProjectUpdate[] = [
  {
    id: 'v0-1-13',
    date: '2026-03-15',
    title: 'Verze 0.1.13: UI shell, village panel a minimapa',
    summary:
      'Lepší ukotvení hlavního UI na herní kontejner, výrazný redesign panelu léna (posádka + podpora) a přesnější centrování mapy/minimapy pro rychlou orientaci během hry.',
    status: 'live',
  },
  {
    id: 'v0-1-12',
    date: '2026-03-14',
    title: 'Verze 0.1.12: Planner flow, armáda a reporty',
    summary:
      'Stabilizace Planneru, lepší práce s žoldáky v Armádě, opravy detailu battle reportů a panel-scoped optimalizace datového načítání v klientu.',
    status: 'live',
  },
  {
    id: 'v0-1-11',
    date: '2026-03-13',
    title: 'Verze 0.1.11: Planovač v1 a koordinace útoků',
    summary:
      'Do hry přibyl Planovač v1 (DB + API + UI), validace více vln útoků a příprava koordinovaných armádních akcí z více lén na jeden cíl.',
    status: 'live',
  },
  {
    id: 'v0-1-09',
    date: '2026-03-06',
    title: 'Verze 0.1.09: Prestižní balanc boje a nová ekonomika',
    summary:
      'Prestige anti-snowball systém, nové ekonomické budovy (zlato/mince) a regionální výzkumný progres rozšířily strategické možnosti střední hry.',
    status: 'live',
  },
  {
    id: 'discord-channel',
    date: '2026-03-01',
    title: 'Komunitní komunikace přes Discord',
    summary: 'Všechny novinky, patch notes a koordinace jsou centralizované na Discordu.',
    status: 'live',
    href: 'https://discord.com/channels/1358102394180730944/1473961374949441628',
    hrefLabel: 'Přejít na Discord',
  },
  {
    id: 'v0-1-14-track',
    date: '2026-03-20',
    title: 'Verze 0.1.14: Balanc, výkon a quality-of-life',
    summary:
      'Dolaďování ekonomiky a boje podle reálného hraní, redukce zbytečné zátěže UI a další UX zlepšení pro mapu, armádu a správu lén.',
    status: 'in-progress',
  },
  {
    id: 'ruleset-track',
    date: '2026-04-01',
    title: 'Směr: svět podle plných pravidel',
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
  const session = getSession();
  const authenticated = isAuthenticated();
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
          <h1>Dominion roste. Každý týden je vidět posun.</h1>
          <p className="intro-text">
            Poslední týdny přinesly tři velké update bloky (0.1.11 až 0.1.13): Planovač v1,
            posádky a žoldáky, ranking UX i výrazný polish mapy a panelů. Přidej se do světa,
            který se aktivně vyvíjí.
          </p>
          <div className="intro-tags">
            <span>3 velké updaty za poslední dny</span>
            <span>Planovač v1 je LIVE</span>
            <span>Posádky, žoldáci, ranking a minimapa</span>
            <span>Patch notes průběžně na Discordu</span>
          </div>

          <section className="intro-updates-card">
            <article className="release-highlight" aria-live="polite">
              <p className="release-highlight-top">
                <span className="release-highlight-badge">0.1.13 LIVE</span>
                <time dateTime="2026-03-15">15. 3. 2026</time>
              </p>
              <h4>Viditelný progres za poslední týdny</h4>
              <p>
                Planner v1, armádní vrstva s posádkami a žoldáky, redesign shellu hry i
                přehlednější village panel. Hra se posouvá v krátkých release iteracích.
              </p>
              <div className="release-highlight-pills" aria-label="Souhrn posledního releasu">
                <span>Planner v1</span>
                <span>Posádky + žoldáci</span>
                <span>Mapa + minimapa UX</span>
              </div>
            </article>
            <h3>Progress & patch notes</h3>
            <p>
              Poslední dodané kroky vývoje a plán dalších iterací. Detailní changelogy a komunitní
              koordinaci najdeš na oficiálním Discord kanálu.
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
              Roadmapa TLD: co je hotovo a co následuje
            </button>
            {isTimelineOpen ? (
              <div className="timeline-card">
                <p>
                  Vývoj jde po krátkých iteracích: nejdřív stabilní základ, potom strategické
                  vrstvy a průběžný UX polish podle reálného hraní.
                </p>
                <ol>
                  <li>
                    <span className="timeline-dot done" aria-hidden="true" />
                    <div>
                      <strong>Herní jádro + multi-world základ</strong>
                      <small>Dokončeno</small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot current" aria-hidden="true" />
                    <div>
                      <strong>Strategická vrstva: Planner, posádka, žoldáci, UI polish</strong>
                      <small>Aktuálně LIVE a průběžně laděno</small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot next" aria-hidden="true" />
                    <div>
                      <strong>0.1.14+: balanc, výkon a svět podle plných pravidel</strong>
                      <small>Následující milník</small>
                    </div>
                  </li>
                </ol>
              </div>
            ) : null}
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


