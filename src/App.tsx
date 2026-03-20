import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { hasSelectedWorld, isAdminAuthenticated, isAuthenticated, logout } from './auth';
import { AUTH_REQUIRED_EVENT, fetchHealthStatus } from './api/gameApi';
import { CommunicationHub } from './components/CommunicationHub';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { LoginPage } from './pages/LoginPage';
import { WorldsPage } from './pages/WorldsPage';
import { GAME_VERSION_LABEL } from './version';
import './App.css';

const CLIENT_BUILD_ID = (import.meta.env.VITE_BUILD_ID as string | undefined)?.trim() || null;
const HEALTH_POLL_INTERVAL_MS = 15000;
const ACTIVE_DEPLOYMENT_STATUSES = new Set(['building', 'deploying', 'updating', 'maintenance']);

type DeploymentNoticeState = {
  mode: 'updating' | 'new-build';
  serverVersion: string | null;
  serverBuildId: string | null;
};

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const SelectedWorldRoute = ({ children }: { children: ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!hasSelectedWorld()) {
    return <Navigate to="/worlds" replace />;
  }

  return children;
};

const AdminRoute = ({ children }: { children: ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminAuthenticated()) {
    return <Navigate to="/worlds" replace />;
  }

  return children;
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [deploymentNotice, setDeploymentNotice] = useState<DeploymentNoticeState | null>(null);
  const isGameRoute = location.pathname.startsWith('/game');
  const shouldPollDeployment = isAuthenticated() && isGameRoute;

  useEffect(() => {
    const handleAuthRequired = () => {
      logout();
      setDeploymentNotice(null);
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!shouldPollDeployment) {
      setDeploymentNotice(null);
      return;
    }
    let disposed = false;

    const pollDeploymentStatus = async () => {
      try {
        const health = await fetchHealthStatus();
        if (disposed) {
          return;
        }

        const serverBuildIdRaw = String(health.deployment?.buildId ?? '').trim();
        const serverVersionRaw = String(health.deployment?.versionLabel ?? '').trim();
        const deploymentStatus = String(health.deployment?.status ?? '').trim().toLowerCase();
        const isUpdating = Boolean(health.deployment?.isUpdating) && ACTIVE_DEPLOYMENT_STATUSES.has(deploymentStatus);
        const serverBuildId = serverBuildIdRaw.length > 0 ? serverBuildIdRaw : null;
        const serverVersion = serverVersionRaw.length > 0 ? serverVersionRaw : null;

        if (isUpdating) {
          setDeploymentNotice({
            mode: 'updating',
            serverVersion,
            serverBuildId,
          });
          return;
        }

        if (CLIENT_BUILD_ID && serverBuildId && serverBuildId !== CLIENT_BUILD_ID) {
          setDeploymentNotice({
            mode: 'new-build',
            serverVersion,
            serverBuildId,
          });
          return;
        }

        setDeploymentNotice(null);
      } catch {
        // Keep existing state when health endpoint is temporarily unavailable.
      }
    };

    void pollDeploymentStatus();
    const interval = window.setInterval(() => {
      void pollDeploymentStatus();
    }, HEALTH_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [shouldPollDeployment]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated() ? '/worlds' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/worlds"
          element={
            <ProtectedRoute>
              <WorldsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game"
          element={
            <SelectedWorldRoute>
              <GamePage />
            </SelectedWorldRoute>
          }
        />
        <Route path="*" element={<Navigate to={isAuthenticated() ? '/worlds' : '/login'} replace />} />
      </Routes>
      {isAuthenticated() && isGameRoute ? <CommunicationHub /> : null}
      {deploymentNotice ? (
        <div className="deployment-overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
          <section className="deployment-dialog">
            <h3>Nahráváme novou verzi hry</h3>
            <p>
              {deploymentNotice.mode === 'updating'
                ? 'Probíhá nasazení nové verze. Prosím vyčkej a během této chvíle neprováděj důležité akce.'
                : 'Byla zjištěna nová verze hry. Pro jistotu obnov stránku, aby ses připojil na aktuální build.'}
            </p>
            <p className="deployment-meta">
              Klient: {GAME_VERSION_LABEL} ({CLIENT_BUILD_ID ?? 'bez ID'})
            </p>
            <p className="deployment-meta">
              Server: {deploymentNotice.serverVersion ?? 'neznámá verze'} ({deploymentNotice.serverBuildId ?? 'bez ID'})
            </p>
            <div className="deployment-actions">
              <button type="button" className="secondary-action" onClick={() => window.location.reload()}>
                Obnovit stránku
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default App;
