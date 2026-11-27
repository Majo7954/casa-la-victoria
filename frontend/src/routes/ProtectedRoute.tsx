
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router';

import { useAuth } from '../context/useAuth';

// ============================================================
// PROTECCIÓN DE RUTAS PRIVADAS
// ============================================================

export function ProtectedRoute() {
  const { estaAutenticado } = useAuth();

  const ubicacion = useLocation();

  if (!estaAutenticado) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: ubicacion,
        }}
      />
    );
  }

  return <Outlet />;
}