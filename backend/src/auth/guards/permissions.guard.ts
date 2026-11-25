import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SupabaseService } from '../../supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISOS_KEY } from '../decorators/permisos.decorator';
import { SOLO_AUTENTICADO_KEY } from '../decorators/solo-autenticado.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [
      context.getHandler(),
      context.getClass(),
    ];

    // 1. Respetar las rutas públicas.
    const esPublica = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );

    if (esPublica) {
      return true;
    }

    // 2. Recuperar el perfil verificado por AuthGuard.
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const usuario = request.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'Se requiere autenticación',
      );
    }

    // 3. Leer los permisos requeridos por la ruta.
    const permisosRequeridos =
      this.reflector.getAllAndOverride<string[]>(
        PERMISOS_KEY,
        targets,
      );

    // 4. Permitir las rutas solo autenticadas.
    const soloAutenticado =
      this.reflector.getAllAndOverride<boolean>(
        SOLO_AUTENTICADO_KEY,
        targets,
      );

    if (permisosRequeridos === undefined) {
      if (soloAutenticado) {
        return true;
      }

      throw new ForbiddenException(
        'La ruta no tiene una política de acceso definida',
      );
    }

    // 5. Evitar una declaración de permisos vacía.
    if (permisosRequeridos.length === 0) {
      throw new ForbiddenException(
        'La ruta no tiene permisos configurados',
      );
    }

    const supabase = this.supabaseService.getClient();

    // 6. Comprobar cada permiso requerido.
    // Todos deben pertenecer al rol del usuario.
    for (const codigo of permisosRequeridos) {
      const { data: permiso, error: errorPermiso } =
        await supabase
          .from('permisos')
          .select('id_permiso')
          .eq('codigo', codigo)
          .maybeSingle();

      if (errorPermiso) {
        throw new InternalServerErrorException(
          'No se pudieron verificar los permisos',
        );
      }

      if (!permiso) {
        throw new ForbiddenException(
          'No tiene autorización para realizar esta operación',
        );
      }

      const { data: asignacion, error: errorAsignacion } =
        await supabase
          .from('roles_permisos')
          .select('id_permiso')
          .eq('id_rol', usuario.id_rol)
          .eq('id_permiso', permiso.id_permiso)
          .maybeSingle();

      if (errorAsignacion) {
        throw new InternalServerErrorException(
          'No se pudieron verificar los permisos',
        );
      }

      if (!asignacion) {
        throw new ForbiddenException(
          'No tiene autorización para realizar esta operación',
        );
      }
    }

    return true;
  }
}
