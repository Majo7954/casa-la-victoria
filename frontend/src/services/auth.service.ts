
const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000';

// ============================================================
// 1. TIPOS DE DATOS
// ============================================================

export interface RolUsuario {
  codigo: 'ADMINISTRADOR' | 'ENCARGADO' | 'VENDEDOR';
  nombre: string;
}

export interface SucursalUsuario {
  id_sucursal: number;
  nombre: string;
}

export interface UsuarioSesion {
  id: string;
  correo: string;
  nombres: string;
  apellidos: string;
  rol: RolUsuario;
  sucursal: SucursalUsuario;
}

export interface RespuestaLogin {
  mensaje: string;
  usuario: UsuarioSesion;
  sesion: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export interface PerfilAutenticado {
  id_usuario: string;
  nombres: string;
  apellidos: string;
  id_rol: number;
  id_sucursal: number;
}

interface RespuestaPerfil {
  mensaje: string;
  usuario: PerfilAutenticado;
}

// ============================================================
// 2. MANEJO DE ERRORES HTTP
// ============================================================

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
  }
}

// ============================================================
// 3. PROCESAMIENTO DE RESPUESTAS
// ============================================================

async function procesarRespuesta<T>(
  respuesta: Response,
): Promise<T> {
  const contenido: unknown = await respuesta.json();

  if (!respuesta.ok) {
    let mensaje = 'Ocurrió un error inesperado.';

    if (
      typeof contenido === 'object' &&
      contenido !== null &&
      'message' in contenido
    ) {
      const detalle = contenido.message;

      if (typeof detalle === 'string') {
        mensaje = detalle;
      } else if (Array.isArray(detalle)) {
        mensaje = detalle.join('. ');
      }
    }

    throw new ApiError(mensaje, respuesta.status);
  }

  return contenido as T;
}

// ============================================================
// 4. INICIO DE SESIÓN
// ============================================================

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<RespuestaLogin> {
  const respuesta = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      correo,
      contrasena,
    }),
  });

  return procesarRespuesta<RespuestaLogin>(respuesta);
}

// ============================================================
// 5. CONSULTAR PERFIL AUTENTICADO
// ============================================================

export async function consultarPerfil(
  accessToken: string,
): Promise<RespuestaPerfil> {
  const respuesta = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return procesarRespuesta<RespuestaPerfil>(respuesta);
}
