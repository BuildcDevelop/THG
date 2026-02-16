import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isAuthenticated } from './auth';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { LoginPage } from './pages/LoginPage';
import './App.css';

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated() ? '/game' : '/'} replace />} />
    </Routes>
  );
}

export default App;
