
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
import {
  ActivarCuentaDto,
} from './dto/activar-cuenta.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ============================================================
  // 1. CREAR CLIENTE DE SUPABASE AUTH
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
  // 2. INICIAR SESIÓN
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

    const { data: perfil, error: errorPerfil } =
      await this.supabaseService
        .getClient()
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
            nombre
          )
        `)
        .eq('id_usuario', data.user.id)
        .maybeSingle();

    if (errorPerfil) {
      throw new InternalServerErrorException(
        'No se pudo verificar el perfil',
      );
    }

    if (
      !perfil ||
      !perfil.activo ||
      !perfil.fecha_activacion ||
      !perfil.roles ||
      !perfil.sucursales
    ) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso habilitado',
      );
    }

    return {
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: perfil.id_usuario,
        correo: data.user.email,
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        rol: perfil.roles,
        sucursal: perfil.sucursales,
      },
      sesion: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  // ============================================================
  // 3. ACTIVACIÓN INICIAL DE CUENTA
  // ============================================================

  async activarCuenta(dto: ActivarCuentaDto) {
    const authClient = this.crearClienteAuth();

    // 1. Verificar el código con Supabase Auth.
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

    // 2. Consultar el perfil correspondiente.
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

    // 3. Impedir reactivar cuentas mediante invitaciones.
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

    // 4. Verificar que la sucursal siga habilitada.
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

    // 5. Establecer la contraseña mediante la sesión
    // obtenida al verificar el código.
    const { error: errorContrasena } =
      await authClient.auth.updateUser({
        password: dto.contrasena,
      });

    if (errorContrasena) {
      throw new ConflictException(
        'No se pudo establecer la contraseña. Verifique los requisitos de seguridad',
      );
    }

    // 6. Habilitar el perfil en PostgreSQL.
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

    // 7. No devolver tokens ni contraseñas.
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
