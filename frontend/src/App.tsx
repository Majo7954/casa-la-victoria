
import {
  Navigate,
  Route,
  Routes,
} from 'react-router';

import { useAuth } from './context/useAuth';

import { LoginPage } from './features/auth/pages/LoginPage';

import { AccesoCorrectoPage } from './pages/AccesoCorrectoPage';

import { ProtectedRoute } from './routes/ProtectedRoute';

// ============================================================
// 1. RUTA INICIAL
// ============================================================

function RutaInicial() {
  const { estaAutenticado } = useAuth();

  return (
    <Navigate
      to={estaAutenticado ? '/app' : '/login'}
      replace
    />
  );
}

// ============================================================
// 2. RUTA DE INICIO DE SESIÓN
// ============================================================

function RutaLogin() {
  const { estaAutenticado } = useAuth();

  if (estaAutenticado) {
    return (
      <Navigate
        to="/app"
        replace
      />
    );
  }

  return <LoginPage />;
}

// ============================================================
// 3. DEFINICIÓN DE RUTAS
// ============================================================

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<RutaInicial />}
      />

      <Route
        path="/login"
        element={<RutaLogin />}
      />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/app"
          element={<AccesoCorrectoPage />}
        />
      </Route>

      <Route
        path="*"
        element={<RutaInicial />}
      />
    </Routes>
  );
}