
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ============================================================
  // 1. CREAR CLIENTE INDEPENDIENTE DE SUPABASE AUTH
  // ============================================================

  private crearClienteAuth() {
    const url =
      this.configService.get<string>('SUPABASE_URL');

    const publishableKey =
      this.configService.get<string>(
        'SUPABASE_PUBLISHABLE_KEY',
      );

    if (!url || !publishableKey) {
      throw new InternalServerErrorException(
        'La autenticación no está configurada',
      );
    }

    return createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  // ============================================================
  // 2. NORMALIZAR RELACIONES DE SUPABASE
  // ============================================================

  private obtenerRelacionUnica<T>(
    valor: T | T[] | null,
  ): T | null {
    if (valor === null) {
      return null;
    }

    if (Array.isArray(valor)) {
      return valor.length === 1
        ? valor[0]
        : null;
    }

    return valor;
  }

  // ============================================================
  // 3. CONSULTAR PERFIL HABILITADO
  // ============================================================

  private async consultarPerfilHabilitado(
    idUsuario: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from('usuarios')
        .select(`
          id_usuario,
          nombres,
          apellidos,
          activo,
          fecha_activacion,
          roles (
            codigo,
            nombre
          ),
          sucursales (
            id_sucursal,
            nombre,
            activo
          )
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (errorPerfil) {
      throw new InternalServerErrorException(
        'No se pudo verificar el perfil',
      );
    }

    if (!perfil) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso habilitado',
      );
    }

    // Supabase puede tipar las relaciones
    // como arreglos de objetos.
    const rol = this.obtenerRelacionUnica(
      perfil.roles,
    );

    const sucursal = this.obtenerRelacionUnica(
      perfil.sucursales,
    );

    if (
      !perfil.activo ||
      !perfil.fecha_activacion ||
      !rol ||
      !sucursal
    ) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso habilitado',
      );
    }

    if (!sucursal.activo) {
      throw new UnauthorizedException(
        'La sucursal asignada no está habilitada',
      );
    }

    // Devolvemos el perfil con relaciones
    // normalizadas como objetos individuales.
    return {
      id_usuario: perfil.id_usuario,
      nombres: perfil.nombres,
      apellidos: perfil.apellidos,
      roles: rol,
      sucursales: sucursal,
    };
  }

  // ============================================================
  // 4. INICIAR SESIÓN
  // ============================================================

  async login(dto: LoginDto) {
    const authClient = this.crearClienteAuth();

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email: dto.correo,
        password: dto.contrasena,
      });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    const perfil = await this.consultarPerfilHabilitado(
      data.user.id,
    );

    return {
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: perfil.id_usuario,
        correo: data.user.email,
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        rol: perfil.roles,
        sucursal: {
          id_sucursal: perfil.sucursales.id_sucursal,
          nombre: perfil.sucursales.nombre,
        },
      },
      sesion: {
        access_token: data.session.access_token,
        expires_in: data.session.expires_in,
      },

      // Uso interno: el controlador coloca este
      // valor en una cookie HttpOnly.
      refreshToken: data.session.refresh_token,
    };
  }

  // ============================================================
  // 5. RENOVAR SESIÓN
  // ============================================================

  async renovarSesion(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'No existe una sesión para renovar',
      );
    }

    const authClient = this.crearClienteAuth();

    const { data, error } =
      await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException(
        'La sesión expiró o no es válida',
      );
    }

    let perfil: Awaited<
      ReturnType<
        AuthService['consultarPerfilHabilitado']
      >
    >;

    try {
      perfil = await this.consultarPerfilHabilitado(
        data.user.id,
      );
    } catch (errorDesconocido: unknown) {
      if (
        errorDesconocido instanceof UnauthorizedException
      ) {
        // Intentar revocar la sesión renovada.
        // Una falla de revocación requiere
        // revisar los registros del backend.
        const { error: errorRevocacion } =
          await authClient.auth.signOut({
            scope: 'local',
          });

        if (errorRevocacion) {
          throw new InternalServerErrorException(
            'No se pudo revocar la sesión no autorizada',
          );
        }
      }

      throw errorDesconocido;
    }

    return {
      mensaje: 'Sesión renovada correctamente',
      usuario: {
        id: perfil.id_usuario,
        correo: data.user.email,
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        rol: perfil.roles,
        sucursal: {
          id_sucursal: perfil.sucursales.id_sucursal,
          nombre: perfil.sucursales.nombre,
        },
      },
      sesion: {
        access_token: data.session.access_token,
        expires_in: data.session.expires_in,
      },

      // El controlador actualiza la cookie.
      refreshToken: data.session.refresh_token,
    };
  }

  // ============================================================
  // 6. CERRAR SESIÓN ACTUAL
  // ============================================================

  async cerrarSesion(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'No existe una sesión para cerrar',
      );
    }

    const authClient = this.crearClienteAuth();

    const { data, error } =
      await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (error || !data.session) {
      throw new UnauthorizedException(
        'La sesión ya no es válida',
      );
    }

    const { error: errorLogout } =
      await authClient.auth.signOut({
        scope: 'local',
      });

    if (errorLogout) {
      throw new InternalServerErrorException(
        'No se pudo cerrar la sesión en el servidor',
      );
    }

    return {
      mensaje: 'Sesión cerrada correctamente',
    };
  }

  // ============================================================
  // 7. ACTIVACIÓN INICIAL DE CUENTA
  // ============================================================

  async activarCuenta(dto: ActivarCuentaDto) {
    const authClient = this.crearClienteAuth();

    const { data: verificacion, error: errorToken } =
      await authClient.auth.verifyOtp({
        token_hash: dto.token_hash,
        type: dto.tipo,
      });

    if (
      errorToken ||
      !verificacion.user ||
      !verificacion.session
    ) {
      throw new UnauthorizedException(
        'El enlace de activación es inválido, expiró o ya fue utilizado',
      );
    }

    const idUsuario = verificacion.user.id;
    const supabase = this.supabaseService.getClient();

    const { data: perfil, error: errorPerfil } =
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
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (errorPerfil) {
      throw new InternalServerErrorException(
        'No se pudo verificar el perfil del usuario',
      );
    }

    if (!perfil) {
      throw new UnauthorizedException(
        'El usuario no tiene un perfil registrado',
      );
    }

    if (perfil.activo || perfil.fecha_activacion) {
      throw new ConflictException(
        'La cuenta no está pendiente de activación',
      );
    }

    if (
      !perfil.nombres?.trim() ||
      !perfil.apellidos?.trim() ||
      !perfil.id_rol ||
      !perfil.id_sucursal
    ) {
      throw new ConflictException(
        'El perfil del usuario está incompleto',
      );
    }

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
      throw new ConflictException(
        'La sucursal asignada no está habilitada',
      );
    }

    const { error: errorContrasena } =
      await authClient.auth.updateUser({
        password: dto.contrasena,
      });

    if (errorContrasena) {
      throw new ConflictException(
        'No se pudo establecer la contraseña. Verifique los requisitos de seguridad',
      );
    }

    const { data: activado, error: errorActivacion } =
      await supabase
        .from('usuarios')
        .update({
          activo: true,
          fecha_activacion: new Date().toISOString(),
        })
        .eq('id_usuario', idUsuario)
        .eq('activo', false)
        .is('fecha_activacion', null)
        .select('id_usuario, nombres, apellidos')
        .maybeSingle();

    if (errorActivacion) {
      throw new InternalServerErrorException(
        'La contraseña se configuró, pero no se pudo completar la activación. Contacte al administrador',
      );
    }

    if (!activado) {
      throw new ConflictException(
        'La cuenta ya fue activada o cambió de estado',
      );
    }

    return {
      mensaje: 'Cuenta activada correctamente',
      usuario: {
        id_usuario: activado.id_usuario,
        nombres: activado.nombres,
        apellidos: activado.apellidos,
        estado: 'ACTIVO',
      },
    };
  }
}