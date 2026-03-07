import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWorlds, type WorldPortalItem, type WorldsPortalResponse } from '../api/gameApi';
import { getSession, logout, setSelectedWorld } from '../auth';

const isWorldPlayable = (world: WorldPortalItem): boolean => String(world.status).toLowerCase() === 'online';
const resolveWorldFlavorById = (worldIdRaw: string): 'test' | 'prealpha' | 'default' => {
  const worldId = String(worldIdRaw ?? '').trim();
  if (worldId === 'dominion-1') {
    return 'test';
  }
  if (worldId === 'dominion-1-fire') {
    return 'prealpha';
  }
  return 'default';
};
const SPAWN_DIRECTION_OPTIONS = [
  {
    id: 'center',
    label: 'Střed',
    glyph: '✦',
  },
  {
    id: 'north',
    label: 'Sever',
    glyph: '▲',
  },
  {
    id: 'east',
    label: 'Východ',
    glyph: '▶',
  },
  {
    id: 'south',
    label: 'Jih',
    glyph: '▼',
  },
  {
    id: 'west',
    label: 'Západ',
    glyph: '◀',
  },
] as const;

export const WorldsPage = () => {
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);
  const [portalData, setPortalData] = useState<WorldsPortalResponse | null>(null);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(session?.selectedWorldId ?? null);
  const [selectedSpawnDirection, setSelectedSpawnDirection] = useState<string>(
    String(session?.selectedSpawnDirection ?? 'center'),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isEntering, setIsEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWorlds(session.username);
      setPortalData(data);

      setSelectedWorldId((previous) => {
        const candidateId = previous ?? session.selectedWorldId ?? data.defaultWorldId;
        if (!candidateId) {
          return data.worlds[0]?.id ?? null;
        }
        const exists = data.worlds.some((world) => world.id === candidateId);
        return exists ? candidateId : data.worlds[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Načtení světů se nepodařilo.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, session]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const selectedWorld = useMemo(
    () => portalData?.worlds.find((world) => world.id === selectedWorldId) ?? null,
    [portalData, selectedWorldId],
  );

  const hasFounderBadge = useMemo(() => {
    return Boolean(portalData?.worlds.some((world) => world.player.hasPresence));
  }, [portalData]);
  const shouldShowSpawnPortal = useMemo(
    () => Boolean(selectedWorld && !selectedWorld.player.hasPresence),
    [selectedWorld],
  );

  const handleEnterWorld = async (worldOverride?: WorldPortalItem | null) => {
    const targetWorld = worldOverride ?? selectedWorld;
    if (!targetWorld || !isWorldPlayable(targetWorld)) {
      return;
    }

    setIsEntering(true);
    setSelectedWorld(targetWorld.id, selectedSpawnDirection);
    navigate('/game', { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!session) {
    return null;
  }

  return (
    <div className="login-page worlds-page">
      <div className="login-bg-layer worlds-bg-layer" />
      <div className="login-noise-layer" />

      <main className="worlds-shell">
        <header className="worlds-header">
          <div>
            <p className="intro-eyebrow">Portál do světů TLD</p>
            <h1>Vyber bojiště pro svůj globální účet</h1>
            <p>
              Účet je sdílený napříč celou hrou. Zvol svět, kde chceš hrát, a vstup do strategie
              o dominanci.
            </p>
          </div>

          <button className="secondary-action" onClick={handleLogout}>
            Odhlásit se
          </button>
        </header>

        <section className="worlds-achievements-card">
          <h2>Hráčská ocenění</h2>
          <p>
            Aktivní velitel: <strong>{portalData?.profile.username ?? session.username}</strong>
          </p>
          <div className="worlds-achievements-grid">
            {hasFounderBadge ? (
              <article
                className="achievement-badge founder"
                title="Byl jsi u zrodu hry!"
                aria-label="Odznak Zakladatele. Byl jsi u zrodu hry!"
              >
                <div className="achievement-medallion">
                  <img src="/assets/ui/founder-badge.svg" alt="" aria-hidden="true" />
                </div>
                <div className="achievement-body">
                  <span className="achievement-emblem">Zakladatel</span>
                  <strong>The Last Dominion</strong>
                  <small>Limitovaná odměna za zakladatelskou účast ve světě</small>
                </div>
                <p className="achievement-tooltip" role="tooltip">
                  Byl jsi u zrodu hry!
                </p>
              </article>
            ) : (
              <article className="achievement-badge muted">
                <div className="achievement-medallion achievement-medallion-empty" aria-hidden="true">
                  <span>?</span>
                </div>
                <div className="achievement-body">
                  <span className="achievement-emblem">Bez odznaku</span>
                  <strong>Zatím nemá žádné ocenění</strong>
                  <small>Hraj ve světech a získej unikátní odznaky</small>
                </div>
              </article>
            )}
          </div>
        </section>

        {isLoading ? <p className="worlds-loading">Načítám herní světy...</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        {!isLoading && !error ? (
          <section className="worlds-grid">
            {(portalData?.worlds ?? []).map((world) => {
              const isSelected = world.id === selectedWorldId;
              const playable = isWorldPlayable(world);
              const worldFlavor = resolveWorldFlavorById(world.id);
              const worldFlavorLabel =
                worldFlavor === 'test' ? 'Testovací svět' : worldFlavor === 'prealpha' ? 'Pre-alpha' : 'Standard';
              const worldRank = world.player?.rank ?? null;
              const worldKingdom = world.player?.kingdom ?? 'Bez kralovstvi';
              const worldPlayerAccounts = world.stats?.playerAccounts ?? 0;
              const worldHeading =
                world.id === 'dominion-1'
                  ? `${world.name} · Testovací svět`
                  : world.id === 'dominion-1-fire'
                    ? `${world.name} · Pre-alpha`
                    : world.name;
              return (
                <article
                  key={world.id}
                  className={`world-card ${isSelected ? 'is-selected' : ''} ${playable ? 'is-playable' : 'is-locked'} ${worldFlavor === 'test' ? 'is-test-world' : ''} ${worldFlavor === 'prealpha' ? 'is-prealpha-world' : ''}`}
                >
                  <button
                    type="button"
                    className="world-select"
                    onClick={() => setSelectedWorldId(world.id)}
                    onDoubleClick={() => {
                      setSelectedWorldId(world.id);
                      if (playable) {
                        void handleEnterWorld(world);
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <p className="world-status">
                      {playable ? 'ONLINE' : 'UZAVŘENO'} · {worldFlavorLabel.toUpperCase()}
                    </p>
                    <h3>{worldHeading}</h3>
                    <p className="world-subtitle">{world.subtitle}</p>
                    <p className="world-description">{world.description}</p>
                    <dl>
                      <div>
                        <dt>Region</dt>
                        <dd>
                          {world.region} - {world.regionSize}x{world.regionSize}
                        </dd>
                      </div>
                      <div>
                        <dt>Sezona</dt>
                        <dd>{world.seasonLabel}</dd>
                      </div>
                      <div>
                        <dt>Tvé osady</dt>
                        <dd>{world.player.villages.toLocaleString('cs-CZ')}</dd>
                      </div>
                      <div>
                        <dt>Tvoje prestiž</dt>
                        <dd>{world.player.prestige.toLocaleString('cs-CZ')}</dd>
                      </div>
                      <div>
                        <dt>Umístění v žebříčku</dt>
                        <dd>{worldRank != null ? `#${worldRank}` : 'Bez umístění'}</dd>
                      </div>
                      <div>
                        <dt>Království</dt>
                        <dd>{worldKingdom}</dd>
                      </div>
                      <div>
                        <dt>Počet hráčských účtů</dt>
                        <dd>{worldPlayerAccounts.toLocaleString('cs-CZ')}</dd>
                      </div>
                    </dl>
                  </button>
                </article>
              );
            })}
          </section>
        ) : null}

        <footer className="worlds-footer">
          {shouldShowSpawnPortal ? (
            <section className="worlds-spawn-portal" aria-label="Preferovaná strana prvního spawnu">
              <p className="worlds-spawn-title">Portál prvního spawnu</p>
              <div className="worlds-spawn-grid">
                {SPAWN_DIRECTION_OPTIONS.map((option) => {
                  const isActive = selectedSpawnDirection === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`worlds-spawn-option ${isActive ? 'is-active' : ''}`}
                      onClick={() => setSelectedSpawnDirection(option.id)}
                      disabled={isEntering}
                    >
                      <span className="worlds-spawn-glyph" aria-hidden="true">
                        {option.glyph}
                      </span>
                      <strong>{option.label}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          <button
            className="auth-submit worlds-enter"
            onClick={() => {
              void handleEnterWorld();
            }}
            disabled={!selectedWorld || !isWorldPlayable(selectedWorld) || isEntering}
          >
            {isEntering ? 'Vstupuji do světa...' : `Vstoupit: ${selectedWorld?.name ?? 'Vyber svět'}`}
          </button>
        </footer>
      </main>
    </div>
  );
};
