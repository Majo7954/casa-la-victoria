
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

import type {
  AuthenticatedRequest,
} from '../interfaces/authenticated-request.interface';

interface PayloadSesion {
  sub?: unknown;
  session_id?: unknown;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ============================================================
  // 1. EXTRAER IDENTIFICADOR DE SESIÓN DEL JWT
  // ============================================================

  private obtenerIdSesion(
    token: string,
    idUsuarioVerificado: string,
  ): string {
    try {
      const partes = token.split('.');

      if (partes.length !== 3) {
        throw new Error('JWT mal formado');
      }

      // El JWT se valida con Supabase Auth ANTES
      // de llamar a esta función.
      const contenido = Buffer.from(
        partes[1],
        'base64url',
      ).toString('utf8');

      const payload: PayloadSesion =
        JSON.parse(contenido) as PayloadSesion;

      if (payload.sub !== idUsuarioVerificado) {
        throw new Error(
          'El usuario del JWT no coincide',
        );
      }

      const idSesion = payload.session_id;

      const formatoUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (
        typeof idSesion !== 'string' ||
        !formatoUuid.test(idSesion)
      ) {
        throw new Error(
          'Identificador de sesión inválido',
        );
      }

      return idSesion;
    } catch {
      throw new UnauthorizedException(
        'El token no contiene una sesión válida',
      );
    }
  }

  // ============================================================
  // 2. VERIFICAR QUE LA SESIÓN NO FUE REVOCADA
  // ============================================================

  private async verificarSesionVigente(
    idUsuario: string,
    idSesion: string,
  ): Promise<void> {
    const supabase =
      this.supabaseService.getClient();

    const { data, error } = await supabase.rpc(
      'clv_sesion_vigente',
      {
        p_id_usuario: idUsuario,
        p_id_sesion: idSesion,
      },
    );

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo verificar la vigencia de la sesión',
      );
    }

    if (data !== true) {
      throw new UnauthorizedException(
        'La sesión fue cerrada o revocada',
      );
    }
  }

  // ============================================================
  // 3. PROTEGER RUTAS
  // ============================================================

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    // 1. Comprobar si la ruta es pública.
    const esPublica =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (esPublica) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    // 2. Leer el encabezado Authorization.
    const authorization =
      request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Se requiere autenticación',
      );
    }

    const partes =
      authorization.trim().split(/\s+/);

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

    const supabase =
      this.supabaseService.getClient();

    // 3. Validar identidad y token con Supabase Auth.
    const { data, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !data.user) {
      throw new UnauthorizedException(
        'Token inválido o expirado',
      );
    }

    // 4. Extraer el session_id del token ya validado.
    const idSesion = this.obtenerIdSesion(
      token,
      data.user.id,
    );

    // 5. Verificar que la sesión siga existiendo.
    await this.verificarSesionVigente(
      data.user.id,
      idSesion,
    );

    // 6. Consultar perfil del trabajador.
    const { data: perfil, error: perfilError } =
      await supabase
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

    if (
      !perfil.nombres?.trim() ||
      !perfil.apellidos?.trim()
    ) {
      throw new UnauthorizedException(
        'El perfil del usuario está incompleto',
      );
    }

    // 7. Verificar que la sucursal siga habilitada.
    const { data: sucursal, error: errorSucursal } =
      await supabase
        .from('sucursales')
        .select('activo')
        .eq('id_sucursal', perfil.id_sucursal)
        .maybeSingle();

    if (errorSucursal) {
      throw new InternalServerErrorException(
        'No se pudo verificar la sucursal',
      );
    }

    if (!sucursal?.activo) {
      throw new UnauthorizedException(
        'La sucursal asignada no está habilitada',
      );
    }

    // 8. Adjuntar identidad para PermissionsGuard.
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