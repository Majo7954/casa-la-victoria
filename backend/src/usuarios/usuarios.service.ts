
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../supabase/supabase.service';
import { ConsultarUsuariosDto } from './dto/consultar-usuarios.dto';
import {
  CrearUsuarioDto,
  CodigoRol,
} from './dto/crear-usuario.dto';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================
  // 1. LISTAR USUARIOS
  // ============================================================

  async listarUsuarios(filtros: ConsultarUsuariosDto) {
    const { pagina, limite } = filtros;

    const desde = (pagina - 1) * limite;
    const hasta = desde + limite - 1;

    const { data, count, error } =
      await this.supabaseService
        .getClient()
        .from('usuarios')
        .select(
          `
          id_usuario,
          nombres,
          apellidos,
          activo,
          fecha_activacion,
          fecha_creacion,
          rol:roles (
            codigo,
            nombre
          ),
          sucursal:sucursales (
            id_sucursal,
            nombre
          )
          `,
          { count: 'exact' },
        )
        .order('fecha_creacion', {
          ascending: false,
        })
        .range(desde, hasta);

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo consultar la lista de usuarios',
      );
    }

    const usuarios = (data ?? []).map((usuario) => ({
      ...usuario,
      estado: usuario.activo
        ? 'ACTIVO'
        : usuario.fecha_activacion
          ? 'INACTIVO'
          : 'PENDIENTE_ACTIVACION',
    }));

    return {
      usuarios,
      paginacion: {
        pagina,
        limite,
        total: count ?? 0,
        total_paginas: Math.ceil((count ?? 0) / limite),
      },
    };
  }

  // ============================================================
  // 2. REGISTRAR USUARIO Y ENVIAR INVITACIÓN
  // ============================================================

  async crearUsuario(dto: CrearUsuarioDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Verificar que el rol exista.
    const { data: rol, error: errorRol } = await supabase
      .from('roles')
      .select('id_rol, codigo')
      .eq('codigo', dto.codigo_rol)
      .maybeSingle();

    if (errorRol) {
      throw new InternalServerErrorException(
        'No se pudo verificar el rol',
      );
    }

    if (!rol) {
      throw new BadRequestException(
        'El rol seleccionado no existe',
      );
    }

    // 2. Verificar que la sucursal exista y esté activa.
    const { data: sucursal, error: errorSucursal } =
      await supabase
        .from('sucursales')
        .select('id_sucursal, nombre, activo, es_matriz')
        .eq('id_sucursal', dto.id_sucursal)
        .maybeSingle();

    if (errorSucursal) {
      throw new InternalServerErrorException(
        'No se pudo verificar la sucursal',
      );
    }

    if (!sucursal || !sucursal.activo) {
      throw new BadRequestException(
        'La sucursal seleccionada no está disponible',
      );
    }

    // 3. Un administrador debe pertenecer a Casa Matriz.
    if (
      dto.codigo_rol === CodigoRol.ADMINISTRADOR &&
      !sucursal.es_matriz
    ) {
      throw new BadRequestException(
        'El administrador debe pertenecer a Casa Matriz',
      );
    }

    // 4. Obtener la URL de redirección.
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL');

    if (!frontendUrl) {
      throw new InternalServerErrorException(
        'No está configurada la URL del frontend',
      );
    }

    const redirectTo =
      `${frontendUrl.replace(/\/$/, '')}/activar-cuenta`;

    // 5. Crear la identidad y enviar la invitación.
    const { data: invitacion, error: errorInvitacion } =
      await supabase.auth.admin.inviteUserByEmail(
        dto.correo,
        { redirectTo },
      );

    if (errorInvitacion) {
      if (
        /already|registered|exists|duplicate/i.test(
          errorInvitacion.message,
        )
      ) {
        throw new ConflictException(
          'El correo ya está registrado',
        );
      }

      this.logger.error(
        `Error al invitar usuario: ${errorInvitacion.message}`,
      );

      throw new BadGatewayException(
        'No se pudo enviar la invitación',
      );
    }

    if (!invitacion.user) {
      throw new BadGatewayException(
        'Supabase no devolvió el usuario invitado',
      );
    }

    // 6. Actualizar el perfil creado automáticamente
    // por el trigger de auth.users.
    const { data: perfil, error: errorPerfil } =
      await supabase
        .from('usuarios')
        .update({
          nombres: dto.nombres,
          apellidos: dto.apellidos,
          id_rol: rol.id_rol,
          id_sucursal: sucursal.id_sucursal,
          activo: false,
          fecha_activacion: null,
        })
        .eq('id_usuario', invitacion.user.id)
        .select('id_usuario')
        .single();

    if (errorPerfil || !perfil) {
      this.logger.error(
        `Invitación creada, pero el perfil quedó incompleto para el usuario ${invitacion.user.id}`,
      );

      throw new InternalServerErrorException(
        'La invitación se generó, pero no se pudo completar el perfil. Requiere revisión administrativa.',
      );
    }

    // 7. Devolver el resultado sin credenciales.
    return {
      mensaje: 'Usuario registrado e invitación solicitada',
      usuario: {
        id_usuario: perfil.id_usuario,
        correo: dto.correo,
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        rol: dto.codigo_rol,
        sucursal: sucursal.nombre,
        estado: 'PENDIENTE_ACTIVACION',
      },
    };
  }
}
