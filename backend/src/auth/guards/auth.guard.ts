import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Comprobar si la ruta es pública.
    const esPublica = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (esPublica) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    // 2. Obtener el token del encabezado Authorization.
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Se requiere autenticación',
      );
    }

    const partes = authorization.trim().split(/\s+/);

    if (
      partes.length !== 2 ||
      partes[0].toLowerCase() !== 'bearer' ||
      !partes[1]
    ) {
      throw new UnauthorizedException(
        'Formato de autorización inválido',
      );
    }

    const token = partes[1];

    // 3. Verificar la identidad mediante Supabase Auth.
    const { data, error: authError } =
      await this.supabaseService
        .getClient()
        .auth.getUser(token);

    if (authError || !data.user) {
      throw new UnauthorizedException(
        'Token inválido o expirado',
      );
    }

    // 4. Consultar el perfil del usuario.
    const { data: perfil, error: perfilError } =
      await this.supabaseService
        .getClient()
        .from('usuarios')
        .select(`
          id_usuario,
          nombres,
          apellidos,
          id_rol,
          id_sucursal,
          activo,
          fecha_activacion
        `)
        .eq('id_usuario', data.user.id)
        .maybeSingle();

    if (perfilError) {
      throw new InternalServerErrorException(
        'No se pudo verificar el perfil del usuario',
      );
    }

    if (
      !perfil ||
      !perfil.activo ||
      !perfil.fecha_activacion ||
      !perfil.id_rol ||
      !perfil.id_sucursal
    ) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso habilitado',
      );
    }

    if (!perfil.nombres || !perfil.apellidos) {
      throw new UnauthorizedException(
        'El perfil del usuario está incompleto',
      );
    }

    // 5. Incorporar el usuario autenticado a la solicitud.
    request.usuario = {
      id_usuario: perfil.id_usuario,
      nombres: perfil.nombres,
      apellidos: perfil.apellidos,
      id_rol: perfil.id_rol,
      id_sucursal: perfil.id_sucursal,
    };

    return true;
  }
}