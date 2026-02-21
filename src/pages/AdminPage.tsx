import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminPlayers, type AdminPlayerRow } from '../api/gameApi';
import { setSession } from '../auth';

export const AdminPage = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<AdminPlayerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchAdminPlayers();
        setPlayers(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Nacteni seznamu hracu se nepodarilo.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredPlayers = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) {
      return players;
    }

    return players.filter((player) => {
      return (
        player.username.toLowerCase().includes(normalizedFilter) ||
        player.kingdom.toLowerCase().includes(normalizedFilter) ||
        player.villageName.toLowerCase().includes(normalizedFilter)
      );
    });
  }, [filter, players]);

  const handlePlayAs = (username: string) => {
    setSession(username, { selectedWorldId: 'dominion-1' });
    navigate('/game', { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-bg-layer" />
      <div className="login-noise-layer" />

      <main className="admin-shell">
        <header>
          <p className="intro-eyebrow">Admin panel</p>
          <h1>Prepnuti mezi ucty pro interni spravu</h1>
          <p>
            Klikni na hrace a okamzite se prepnes do hry pod jeho uctem. Panel je urceny jen pro
            interni testovani mapy, ekonomiky a bojovych flow.
          </p>
        </header>

        <section className="admin-card">
          <div className="admin-tools">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtruj podle jmena, kralovstvi nebo lena"
            />
            <button className="secondary-action" onClick={() => navigate('/worlds')}>
              Zpet na portal svetu
            </button>
          </div>

          {isLoading ? <p>Nacitam seznam hracu...</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}

          {!isLoading && !error ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ucet</th>
                    <th>Vesnice</th>
                    <th>Pocet len</th>
                    <th>Kralovstvi</th>
                    <th>Prestiz</th>
                    <th>Poloha</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr key={player.username}>
                      <td>{player.username}</td>
                      <td>{player.villageName}</td>
                      <td>{player.villageCount}</td>
                      <td>{player.kingdom}</td>
                      <td>{player.prestige.toLocaleString('cs-CZ')}</td>
                      <td>
                        {player.coordX}|{player.coordY}
                      </td>
                      <td>
                        <button className="secondary-action" onClick={() => handlePlayAs(player.username)}>
                          Hrat jako
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};
