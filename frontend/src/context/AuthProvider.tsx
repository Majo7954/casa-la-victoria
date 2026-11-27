
import { useEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

import {
  ApiError,
  cerrarSesionRemota,
  iniciarSesion,
  renovarSesion,
} from '../services/auth.service';

import type {
  RespuestaSesion,
  UsuarioSesion,
} from '../services/auth.service';

import { AuthContext } from './auth-context';

// ============================================================
// 1. ESTRUCTURA DE LA SESIÓN EN MEMORIA
// ============================================================

interface SesionLocal {
  usuario: UsuarioSesion;
  accessToken: string;
  expiraEn: number;
}

// Evita duplicar la renovación inicial,
// especialmente durante el desarrollo con StrictMode.
let renovacionEnCurso: Promise<RespuestaSesion> | null =
  null;

function renovarUnaVez(): Promise<RespuestaSesion> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = renovarSesion().finally(() => {
      renovacionEnCurso = null;
    });
  }

  return renovacionEnCurso;
}

// ============================================================
// 2. CONVERTIR RESPUESTA DEL BACKEND EN SESIÓN LOCAL
// ============================================================

function crearSesion(
  resultado: RespuestaSesion,
): SesionLocal {
  const duracion = resultado.sesion.expires_in;

  if (
    !Number.isFinite(duracion) ||
    duracion <= 0
  ) {
    throw new Error(
      'El servidor devolvió una duración de sesión inválida.',
    );
  }

  return {
    usuario: resultado.usuario,
    accessToken: resultado.sesion.access_token,
    expiraEn: Date.now() + duracion * 1000,
  };
}

// ============================================================
// 3. PROVEEDOR DE AUTENTICACIÓN
// ============================================================

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sesion, setSesion] =
    useState<SesionLocal | null>(null);

  const [inicializando, setInicializando] =
    useState(true);

  // Identifica la versión actual de la sesión.
  // Permite descartar resultados de solicitudes antiguas.
  const versionSesion = useRef(0);

  // ==========================================================
  // 4. RESTAURAR SESIÓN AL ABRIR O RECARGAR LA APLICACIÓN
  // ==========================================================

  useEffect(() => {
    let vigente = true;
    const version = versionSesion.current;

    renovarUnaVez()
      .then((resultado) => {
        if (
          vigente &&
          version === versionSesion.current
        ) {
          setSesion(crearSesion(resultado));
        }
      })
      .catch(() => {
        if (
          vigente &&
          version === versionSesion.current
        ) {
          setSesion(null);
        }
      })
      .finally(() => {
        if (vigente) {
          setInicializando(false);
        }
      });

    return () => {
      vigente = false;
    };
  }, []);

  // ==========================================================
  // 5. RENOVAR AUTOMÁTICAMENTE ANTES DEL VENCIMIENTO
  // ==========================================================

  useEffect(() => {
    if (!sesion) {
      return;
    }

    // Renovar aproximadamente un minuto antes de expirar.
    const espera = Math.max(
      1000,
      sesion.expiraEn - Date.now() - 60_000,
    );

    const temporizador = window.setTimeout(() => {
      const version = versionSesion.current;

      void renovarUnaVez()
        .then((resultado) => {
          if (version === versionSesion.current) {
            setSesion(crearSesion(resultado));
          }
        })
        .catch(() => {
          if (version === versionSesion.current) {
            versionSesion.current += 1;
            setSesion(null);
          }
        });
    }, espera);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [sesion]);

  // ==========================================================
  // 6. INICIAR SESIÓN
  // ==========================================================

  async function iniciarSesionUsuario(
    correo: string,
    contrasena: string,
  ): Promise<void> {
    const resultado = await iniciarSesion(
      correo,
      contrasena,
    );

    versionSesion.current += 1;
    setSesion(crearSesion(resultado));
  }

  // ==========================================================
  // 7. CERRAR SESIÓN
  // ==========================================================

  async function cerrarSesionUsuario(): Promise<void> {
    // Una solicitud de renovación pendiente no debe
    // volver a habilitar una sesión que estamos cerrando.
    versionSesion.current += 1;

    try {
      await cerrarSesionRemota();

      setSesion(null);
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof ApiError &&
        errorDesconocido.status === 401
      ) {
        // El backend indica que no existe una sesión
        // renovable; descartamos el estado local.
        setSesion(null);
        return;
      }

      // Un error de red o del servidor NO confirma
      // que Supabase haya revocado la sesión.
      // Mostramos el fallo y conservamos el estado.
      throw errorDesconocido;
    }
  }

  // ==========================================================
  // 8. COMPARTIR SESIÓN ENTRE COMPONENTES
  // ==========================================================

  return (
    <AuthContext.Provider
      value={{
        usuario: sesion?.usuario ?? null,
        accessToken: sesion?.accessToken ?? null,
        estaAutenticado: sesion !== null,
        inicializando,
        iniciarSesionUsuario,
        cerrarSesionUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
