import type { Request } from 'express';

export interface UsuarioAutenticado {
  id_usuario: string;
  nombres: string;
  apellidos: string;
  id_rol: number;
  id_sucursal: number;
}

export interface AuthenticatedRequest extends Request {
  usuario: UsuarioAutenticado;
}