import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { hasSelectedWorld, isAdminAuthenticated, isAuthenticated } from './auth';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { LoginPage } from './pages/LoginPage';
import { WorldsPage } from './pages/WorldsPage';
import './App.css';

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
  return (
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
  );
}

export default App;
