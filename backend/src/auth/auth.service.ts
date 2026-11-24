import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly authClient: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const key = this.configService.getOrThrow<string>(
      'SUPABASE_PUBLISHABLE_KEY',
    );

    this.authClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  async login(dto: LoginDto) {
    // 1. Verificar las credenciales con Supabase Auth.
    const { data, error: authError } =
      await this.authClient.auth.signInWithPassword({
        email: dto.correo,
        password: dto.contrasena,
      });

    if (authError || !data.user || !data.session) {
      throw new UnauthorizedException(
        'Correo electrónico o contraseña incorrectos',
      );
    }

    // 2. Consultar el perfil operativo del trabajador.
    const { data: perfil, error: perfilError } =
      await this.supabaseService
        .getClient()
        .from('usuarios')
        .select(`
          id_usuario,
          nombres,
          apellidos,
          activo,
          fecha_activacion,
          roles ( codigo, nombre ),
          sucursales ( id_sucursal, nombre )
        `)
        .eq('id_usuario', data.user.id)
        .single();

    if (perfilError) {
      throw new InternalServerErrorException(
        'No se pudo verificar el perfil del usuario',
      );
    }

    // 3. Verificar que la cuenta esté habilitada.
    if (!perfil.activo || !perfil.fecha_activacion) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso habilitado',
      );
    }

    // 4. Entregar el resultado de autenticación.
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
}
