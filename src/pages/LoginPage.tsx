import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, login } from '../auth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/game', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(username.trim(), password.trim());

    if (result.ok) {
      navigate('/game', { replace: true });
      return;
    }

    setIsSubmitting(false);
    setError(result.error || 'Neplatne prihlaseni.');
  };

  return (
    <div className="login-page">
      <div className="login-bg-layer" />
      <div className="login-noise-layer" />

      <main className="login-shell">
        <section className="intro-panel">
          <p className="intro-eyebrow">THG Prototyp</p>
          <h1>Temne pohranici ceka na tvuj prvni prikaz.</h1>
          <p className="intro-text">
            Tahova strategie inspirovana Divokymi Kmeny, Eco a Civilizaci. Buduj mesto,
            ved jednotky, koordinuj kralovstvi a ovladni region pomoci ekonomiky i valky.
          </p>
          <div className="intro-tags">
            <span>50x50 region</span>
            <span>Realne casovani akci</span>
            <span>Plovouci herni okna</span>
          </div>
        </section>

        <section className="auth-panel">
          <h2>Prihlaseni do hry</h2>
          <p className="auth-help">
            Pouzij realny ucet (napr. Hayato / 123). Vsechny testovaci ucty maji heslo 123.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Uzivatelske jmeno
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Hayato"
                required
              />
            </label>

            <label>
              Heslo
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="123"
                required
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Prihlasuji...' : 'Vstoupit do sveta'}
            </button>
          </form>

          <button className="secondary-action admin-entry" onClick={() => navigate('/admin')}>
            Otevrít admin panel (bez loginu)
          </button>
        </section>
      </main>
    </div>
  );
};
