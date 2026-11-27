
import { useState } from 'react';

import type { FormEvent } from 'react';

import { useNavigate } from 'react-router';

import { Button } from '../../../components/ui/Button/Button';

import { InputField } from '../../../components/ui/InputField/InputField';

import { useAuth } from '../../../context/useAuth';

import { ApiError } from '../../../services/auth.service';

import '../../../App.css';

// ============================================================
// 1. TIPOS DE ALERTA
// ============================================================

type TipoAlerta =
  | 'credenciales'
  | 'acceso'
  | 'general'
  | null;

// ============================================================
// 2. ICONOS MATERIAL SYMBOLS
// ============================================================

function Icono({
  nombre,
}: {
  nombre: string;
}) {
  return (
    <span
      className="material-symbols-outlined"
      aria-hidden="true"
    >
      {nombre}
    </span>
  );
}

// ============================================================
// 3. PÁGINA DE INICIO DE SESIÓN
// ============================================================

export function LoginPage() {
  const navigate = useNavigate();

  const { iniciarSesionUsuario } = useAuth();

  const [correo, setCorreo] = useState('');

  const [contrasena, setContrasena] =
    useState('');

  const [
    mostrarContrasena,
    setMostrarContrasena,
  ] = useState(false);

  const [cargando, setCargando] =
    useState(false);

  const [errorCorreo, setErrorCorreo] =
    useState('');

  const [
    errorContrasena,
    setErrorContrasena,
  ] = useState('');

  const [tipoAlerta, setTipoAlerta] =
    useState<TipoAlerta>(null);

  const [mensajeAlerta, setMensajeAlerta] =
    useState('');

  const [
    avisoRecuperacion,
    setAvisoRecuperacion,
  ] = useState(false);

  // ==========================================================
  // 4. LIMPIAR ALERTAS
  // ==========================================================

  function limpiarAlertas() {
    setTipoAlerta(null);
    setMensajeAlerta('');
    setAvisoRecuperacion(false);
  }

  // ==========================================================
  // 5. VALIDAR FORMULARIO E INICIAR SESIÓN
  // ==========================================================

  async function manejarLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    limpiarAlertas();

    setErrorCorreo('');
    setErrorContrasena('');

    const correoNormalizado = correo.trim();

    let formularioValido = true;

    // Validar correo electrónico.
    if (!correoNormalizado) {
      setErrorCorreo(
        'Ingrese su correo electrónico.',
      );

      formularioValido = false;
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        correoNormalizado,
      )
    ) {
      setErrorCorreo(
        'Formato de correo inválido.',
      );

      formularioValido = false;
    }

    // Validar contraseña.
    if (!contrasena) {
      setErrorContrasena(
        'Ingrese su contraseña.',
      );

      formularioValido = false;
    }

    if (!formularioValido) {
      return;
    }

    setCargando(true);

    try {
      // La autenticación se realiza en NestJS.
      await iniciarSesionUsuario(
        correoNormalizado,
        contrasena,
      );

      setContrasena('');

      // Navegar a la ruta protegida.
      navigate('/app', {
        replace: true,
      });
    } catch (errorDesconocido) {
      if (errorDesconocido instanceof ApiError) {
        const mensaje =
          errorDesconocido.message;

        // Cuenta pendiente, inactiva o sin acceso.
        if (
          errorDesconocido.status === 401 &&
          /cuenta|habilitado|activaci|inactiv|suspendid/i
            .test(mensaje)
        ) {
          setTipoAlerta('acceso');

          setMensajeAlerta(
            'La cuenta no tiene acceso habilitado. ' +
            'Si está pendiente de activación o fue ' +
            'desactivada, comuníquese con el administrador.',
          );
        } else if (
          errorDesconocido.status === 401
        ) {
          // Credenciales incorrectas.
          setTipoAlerta('credenciales');

          setMensajeAlerta(
            'El correo electrónico o la contraseña ' +
            'no son correctos.',
          );
        } else {
          // Otros errores de la API.
          setTipoAlerta('general');

          setMensajeAlerta(mensaje);
        }
      } else {
        setTipoAlerta('general');

        setMensajeAlerta(
          'No se pudo conectar con el servidor. ' +
          'Intente nuevamente.',
        );
      }
    } finally {
      setCargando(false);
    }
  }

  // ==========================================================
  // 6. INTERFAZ VISUAL
  // ==========================================================

  return (
    <div className="auth-layout">
      {/* ================================================
          PANEL INSTITUCIONAL IZQUIERDO
          ================================================ */}

      <aside className="auth-brand-panel">
        <div className="auth-brand-header">
          <img
            src="/logo-casa-la-victoria.png"
            alt="Logotipo de Casa La Victoria"
            className="auth-logo"
          />

          <div>
            <p className="auth-brand-name">
              Casa La Victoria
            </p>

            <p className="auth-brand-subtitle">
              Comercialización textil · Bolivia
            </p>
          </div>
        </div>

        <div className="auth-brand-content">
          <span className="auth-corporate-badge">
            <Icono nombre="verified_user" />
            Acceso corporativo
          </span>

          <h1>
            Sistema web para el seguimiento y
            control de existencias de telas
          </h1>

          <p>
            Gestione el catálogo de telas, el inventario
            por rollos individuales, las recepciones
            de proveedores y las ventas por sucursal
            desde una sola plataforma.
          </p>
        </div>

        <footer className="auth-brand-footer">
          <span>
            Casa Matriz y Sucursales
          </span>

          <span>
            Uso interno autorizado
          </span>
        </footer>
      </aside>

      {/* ================================================
          ÁREA DEL FORMULARIO
          ================================================ */}

      <main className="auth-main">
        <section className="auth-card">
          <header className="auth-card-header">
            <h2>Iniciar sesión</h2>

            <p>
              Ingrese su correo electrónico
              corporativo y contraseña para
              acceder al sistema.
            </p>
          </header>

          {/* ============================================
              ALERTA DE ERROR
              ============================================ */}

          {tipoAlerta && (
            <div
              className={[
                'auth-alert',
                tipoAlerta === 'acceso'
                  ? 'auth-alert--warning'
                  : 'auth-alert--error',
              ].join(' ')}
              role="alert"
            >
              <Icono
                nombre={
                  tipoAlerta === 'acceso'
                    ? 'block'
                    : 'error'
                }
              />

              <div>
                <strong>
                  {tipoAlerta === 'credenciales'
                    ? 'Credenciales incorrectas'
                    : tipoAlerta === 'acceso'
                      ? 'Acceso no habilitado'
                      : 'No se pudo iniciar sesión'}
                </strong>

                <p>
                  {mensajeAlerta}
                </p>
              </div>
            </div>
          )}

          {/* ============================================
              AVISO DE RECUPERACIÓN
              ============================================ */}

          {avisoRecuperacion && (
            <div
              className="auth-alert auth-alert--info"
              role="status"
            >
              <Icono nombre="info" />

              <div>
                <strong>
                  Recuperación de contraseña
                </strong>

                <p>
                  Esta función se integrará
                  con Supabase Auth y el servicio
                  de correo en una siguiente etapa.
                </p>
              </div>
            </div>
          )}

          {/* ============================================
              FORMULARIO DE LOGIN
              ============================================ */}

          <form
            className="auth-form"
            onSubmit={manejarLogin}
            noValidate
          >
            {/* CORREO ELECTRÓNICO */}

            <InputField
              id="correo"
              name="correo"
              label="Correo electrónico"
              type="email"
              placeholder="usuario@casalavictoria.bo"
              autoComplete="email"
              inputMode="email"
              required
              value={correo}
              disabled={cargando}
              leftIcon={
                <Icono nombre="mail" />
              }
              error={errorCorreo}
              onChange={(event) => {
                setCorreo(event.target.value);
                setErrorCorreo('');
                limpiarAlertas();
              }}
            />

            {/* CONTRASEÑA */}

            <InputField
              id="contrasena"
              name="contrasena"
              label="Contraseña"
              type={
                mostrarContrasena
                  ? 'text'
                  : 'password'
              }
              placeholder="Ingrese su contraseña"
              autoComplete="current-password"
              required
              value={contrasena}
              disabled={cargando}
              leftIcon={
                <Icono nombre="lock" />
              }
              error={errorContrasena}
              labelAction={
                <button
                  type="button"
                  className="auth-forgot"
                  disabled={cargando}
                  onClick={() => {
                    limpiarAlertas();
                    setAvisoRecuperacion(true);
                  }}
                >
                  ¿Olvidó su contraseña?
                </button>
              }
              rightAction={
                <button
                  type="button"
                  className="auth-visibility"
                  onClick={() => {
                    setMostrarContrasena(
                      !mostrarContrasena,
                    );
                  }}
                  disabled={cargando}
                  aria-label={
                    mostrarContrasena
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  aria-pressed={
                    mostrarContrasena
                  }
                >
                  <Icono
                    nombre={
                      mostrarContrasena
                        ? 'visibility_off'
                        : 'visibility'
                    }
                  />
                </button>
              }
              onChange={(event) => {
                setContrasena(
                  event.target.value,
                );

                setErrorContrasena('');
                limpiarAlertas();
              }}
            />

            {/* BOTÓN DE INGRESO */}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="md"
              isLoading={cargando}
              loadingLabel="Verificando acceso..."
              leftIcon={
                <Icono nombre="login" />
              }
            >
              Ingresar al sistema
            </Button>
          </form>

          {/* ============================================
              NOTA DE ACCESO
              ============================================ */}

          <footer className="auth-card-footer">
            <Icono nombre="info" />

            <p>
              Su acceso y sucursal asignada
              dependen de su rol en Casa La Victoria.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}