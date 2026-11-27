
import { useState } from 'react';

import { useNavigate } from 'react-router';

import { Button } from '../components/ui/Button/Button';

import { useAuth } from '../context/useAuth';

import '../App.css';

// ============================================================
// PANTALLA PROVISIONAL DE ACCESO CORRECTO
// ============================================================

export function AccesoCorrectoPage() {
  const {
    usuario,
    cerrarSesionUsuario,
  } = useAuth();

  const navigate = useNavigate();

  const [cerrando, setCerrando] =
    useState(false);

  const [error, setError] =
    useState('');

  // ==========================================================
  // CERRAR SESIÓN EN NESTJS
  // ==========================================================

  async function salir() {
    setError('');
    setCerrando(true);

    try {
      await cerrarSesionUsuario();

      navigate('/login', {
        replace: true,
      });
    } catch {
      setError(
        'No se pudo confirmar el cierre de sesión ' +
        'en el servidor. Intente nuevamente.',
      );
    } finally {
      setCerrando(false);
    }
  }

  if (!usuario) {
    return null;
  }

  return (
    <main
      className="auth-main"
      style={{
        minHeight: '100vh',
      }}
    >
      <section className="auth-card">
        <header className="auth-card-header">
          <h2>
            ¡Bienvenido, {usuario.nombres}!
          </h2>

          <p>
            Su acceso fue verificado correctamente.
          </p>
        </header>

        <div className="auth-profile">
          <div>
            <span>Trabajador</span>

            <strong>
              {usuario.nombres}{' '}
              {usuario.apellidos}
            </strong>
          </div>

          <div>
            <span>Rol</span>

            <strong>
              {usuario.rol.nombre}
            </strong>
          </div>

          <div>
            <span>Sucursal asignada</span>

            <strong>
              {usuario.sucursal.nombre}
            </strong>
          </div>
        </div>

        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        <Button
          variant="outline"
          fullWidth
          isLoading={cerrando}
          onClick={() => {
            void salir();
          }}
        >
          Cerrar sesión
        </Button>

        <p className="auth-temporary-note">
          Esta pantalla es provisional.
          El panel administrativo se implementará
          con su diseño de Stitch.
        </p>
      </section>
    </main>
  );
}