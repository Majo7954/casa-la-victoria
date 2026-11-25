
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../supabase/supabase.service';

import { ConsultarUsuariosDto } from './dto/consultar-usuarios.dto';

import {
  CodigoRol,
  CrearUsuarioDto,
} from './dto/crear-usuario.dto';

import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';

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

    const { data, count, error } = await this.supabaseService
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
      this.logger.error(
        `Error al listar usuarios: ${error.message}`,
      );

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
  // 2. REGISTRAR USUARIO Y SOLICITAR INVITACIÓN
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

    // 3. Los administradores deben pertenecer a Casa Matriz.
    if (
      dto.codigo_rol === CodigoRol.ADMINISTRADOR &&
      !sucursal.es_matriz
    ) {
      throw new BadRequestException(
        'El administrador debe pertenecer a Casa Matriz',
      );
    }

    // 4. Obtener la URL del frontend.
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL');

    if (!frontendUrl) {
      throw new InternalServerErrorException(
        'No está configurada la URL del frontend',
      );
    }

    const redirectTo =
      `${frontendUrl.replace(/\/$/, '')}/activar-cuenta`;

    // 5. Crear identidad en Supabase Auth
    // y solicitar el envío de invitación.
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
        'No se pudo procesar la invitación',
      );
    }

    if (!invitacion.user) {
      throw new BadGatewayException(
        'Supabase no devolvió el usuario invitado',
      );
    }

    // 6. Completar el perfil generado por
    // el trigger asociado a auth.users.
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
        `No se pudo completar el perfil del usuario ${invitacion.user.id}: ${errorPerfil?.message ?? 'Sin datos devueltos'}`,
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

  // ============================================================
  // 3. MODIFICAR USUARIO
  // ============================================================

  async actualizarUsuario(
    idUsuario: string,
    dto: ActualizarUsuarioDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // 1. Verificar que existan campos para modificar.
    const hayCambios = Object.values(dto).some(
      (valor) => valor !== undefined,
    );

    if (!hayCambios) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para modificar',
      );
    }

    // 2. Consultar el usuario actual.
    const { data: usuarioActual, error: errorUsuario } =
      await supabase
        .from('usuarios')
        .select('id_usuario, id_rol, id_sucursal, activo')
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (errorUsuario) {
      throw new InternalServerErrorException(
        'No se pudo consultar el usuario',
      );
    }

    if (!usuarioActual) {
      throw new NotFoundException(
        'El usuario no existe',
      );
    }

    // 3. Identificar el rol de administrador.
    const { data: rolAdministrador, error: errorAdmin } =
      await supabase
        .from('roles')
        .select('id_rol')
        .eq('codigo', CodigoRol.ADMINISTRADOR)
        .single();

    if (errorAdmin || !rolAdministrador) {
      throw new InternalServerErrorException(
        'No se pudo verificar el rol administrador',
      );
    }

    // 4. Determinar el rol final.
    let idRolFinal: number | null = usuarioActual.id_rol;

    if (dto.codigo_rol !== undefined) {
      const { data: nuevoRol, error: errorRol } =
        await supabase
          .from('roles')
          .select('id_rol')
          .eq('codigo', dto.codigo_rol)
          .maybeSingle();

      if (errorRol) {
        throw new InternalServerErrorException(
          'No se pudo verificar el rol seleccionado',
        );
      }

      if (!nuevoRol) {
        throw new BadRequestException(
          'El rol seleccionado no existe',
        );
      }

      idRolFinal = nuevoRol.id_rol;
    }

    // 5. Evitar cambiar el rol del último
    // administrador activo.
    const pierdeRolAdministrador =
      usuarioActual.activo &&
      usuarioActual.id_rol === rolAdministrador.id_rol &&
      idRolFinal !== rolAdministrador.id_rol;

    if (pierdeRolAdministrador) {
      const { count, error: errorConteo } =
        await supabase
          .from('usuarios')
          .select('id_usuario', {
            count: 'exact',
            head: true,
          })
          .eq('id_rol', rolAdministrador.id_rol)
          .eq('activo', true);

      if (errorConteo) {
        throw new InternalServerErrorException(
          'No se pudo comprobar la cantidad de administradores',
        );
      }

      if (count === null || count <= 1) {
        throw new BadRequestException(
          'No se puede cambiar el rol del último administrador activo',
        );
      }
    }

    // 6. Determinar la sucursal final.
    const idSucursalFinal =
      dto.id_sucursal !== undefined
        ? dto.id_sucursal
        : usuarioActual.id_sucursal;

    const cambiaAsignacion =
      dto.codigo_rol !== undefined ||
      dto.id_sucursal !== undefined;

    // 7. Verificar rol y sucursal cuando
    // se modifica cualquiera de ellos.
    if (cambiaAsignacion) {
      if (idRolFinal === null) {
        throw new BadRequestException(
          'El usuario debe tener un rol asignado',
        );
      }

      if (idSucursalFinal === null) {
        throw new BadRequestException(
          'El usuario debe tener una sucursal asignada',
        );
      }

      const { data: sucursal, error: errorSucursal } =
        await supabase
          .from('sucursales')
          .select('id_sucursal, activo, es_matriz')
          .eq('id_sucursal', idSucursalFinal)
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

      if (
        idRolFinal === rolAdministrador.id_rol &&
        !sucursal.es_matriz
      ) {
        throw new BadRequestException(
          'El administrador debe pertenecer a Casa Matriz',
        );
      }
    }

    // 8. Construir los cambios recibidos.
    const cambios: {
      nombres?: string;
      apellidos?: string;
      id_rol?: number;
      id_sucursal?: number;
    } = {};

    if (dto.nombres !== undefined) {
      cambios.nombres = dto.nombres;
    }

    if (dto.apellidos !== undefined) {
      cambios.apellidos = dto.apellidos;
    }

    if (dto.codigo_rol !== undefined) {
      if (idRolFinal === null) {
        throw new BadRequestException(
          'El rol seleccionado no es válido',
        );
      }

      cambios.id_rol = idRolFinal;
    }

    if (dto.id_sucursal !== undefined) {
      cambios.id_sucursal = dto.id_sucursal;
    }

    // 9. Actualizar el perfil.
    const { data: actualizado, error: errorActualizar } =
      await supabase
        .from('usuarios')
        .update(cambios)
        .eq('id_usuario', idUsuario)
        .select(`
          id_usuario,
          nombres,
          apellidos,
          activo,
          fecha_activacion,
          rol:roles (
            codigo,
            nombre
          ),
          sucursal:sucursales (
            id_sucursal,
            nombre
          )
        `)
        .maybeSingle();

    if (errorActualizar) {
      this.logger.error(
        `Error al actualizar usuario ${idUsuario}: ${errorActualizar.message}`,
      );

      throw new InternalServerErrorException(
        'No se pudo actualizar el usuario',
      );
    }

    if (!actualizado) {
      throw new NotFoundException(
        'El usuario ya no existe',
      );
    }

    // 10. Devolver el resultado actualizado.
    return {
      mensaje: 'Usuario actualizado correctamente',
      usuario: {
        ...actualizado,
        estado: actualizado.activo
          ? 'ACTIVO'
          : actualizado.fecha_activacion
            ? 'INACTIVO'
            : 'PENDIENTE_ACTIVACION',
      },
    };
  }

  // ============================================================
  // 4. DESACTIVAR Y REACTIVAR USUARIOS
  // ============================================================

  async cambiarEstadoUsuario(
    idUsuario: string,
    dto: CambiarEstadoUsuarioDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // 1. Consultar el usuario actual.
    const { data: usuarioActual, error: errorUsuario } =
      await supabase
        .from('usuarios')
        .select(`
          id_usuario,
          activo,
          fecha_activacion,
          id_rol
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (errorUsuario) {
      throw new InternalServerErrorException(
        'No se pudo consultar el usuario',
      );
    }

    if (!usuarioActual) {
      throw new NotFoundException(
        'El usuario no existe',
      );
    }

    // 2. Impedir cambios administrativos de estado
    // en cuentas que aún no completaron su activación.
    if (!usuarioActual.fecha_activacion) {
      throw new ConflictException(
        'La cuenta está pendiente de activación',
      );
    }

    // 3. Evitar aplicar nuevamente el mismo estado.
    if (usuarioActual.activo === dto.activo) {
      throw new ConflictException(
        dto.activo
          ? 'El usuario ya se encuentra activo'
          : 'El usuario ya se encuentra inactivo',
      );
    }

    // 4. Actualizar el estado del usuario.
    // La protección del último administrador
    // se refuerza mediante un trigger en PostgreSQL.
    const { data: actualizado, error: errorActualizar } =
      await supabase
        .from('usuarios')
        .update({
          activo: dto.activo,
        })
        .eq('id_usuario', idUsuario)
        .eq('activo', usuarioActual.activo)
        .select(`
          id_usuario,
          nombres,
          apellidos,
          activo,
          fecha_activacion,
          rol:roles (
            codigo,
            nombre
          ),
          sucursal:sucursales (
            id_sucursal,
            nombre
          )
        `)
        .maybeSingle();

    if (errorActualizar) {
      const esUltimoAdministrador =
        errorActualizar.message.includes(
          'No se puede desactivar o cambiar el rol del último administrador activo',
        );

      if (esUltimoAdministrador) {
        throw new BadRequestException(
          'No se puede desactivar al último administrador activo',
        );
      }

      this.logger.error(
        `Error al cambiar el estado del usuario ${idUsuario}: ${errorActualizar.message}`,
      );

      throw new InternalServerErrorException(
        'No se pudo cambiar el estado del usuario',
      );
    }

    // 5. Detectar cambios concurrentes.
    if (!actualizado) {
      throw new ConflictException(
        'El estado del usuario cambió durante la operación. Intente nuevamente.',
      );
    }

    // 6. Devolver el estado actualizado.
    return {
      mensaje: dto.activo
        ? 'Usuario reactivado correctamente'
        : 'Usuario desactivado correctamente',
      usuario: {
        ...actualizado,
        estado: actualizado.activo
          ? 'ACTIVO'
          : 'INACTIVO',
      },
    };
  }
}
