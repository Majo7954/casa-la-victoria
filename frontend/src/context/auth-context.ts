
import { createContext } from 'react';

import type {
  UsuarioSesion,
} from '../services/auth.service';

// ============================================================
// CONTRATO DEL CONTEXTO DE AUTENTICACIÓN
// ============================================================

export interface AuthContextType {
  usuario: UsuarioSesion | null;

  accessToken: string | null;

  estaAutenticado: boolean;

  inicializando: boolean;

  iniciarSesionUsuario: (
    correo: string,
    contrasena: string,
  ) => Promise<void>;

  cerrarSesionUsuario: () => Promise<void>;
}

export const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);
