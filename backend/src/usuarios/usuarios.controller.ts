
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Permisos } from '../auth/decorators/permisos.decorator';

import { UsuariosService } from './usuarios.service';

import { ConsultarUsuariosDto } from './dto/consultar-usuarios.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
  ) {}

  // ============================================================
  // 1. CONSULTAR USUARIOS
  // ============================================================

  @Permisos('USUARIOS_CONSULTAR')
  @Get()
  listar(@Query() filtros: ConsultarUsuariosDto) {
    return this.usuariosService.listarUsuarios(filtros);
  }

  // ============================================================
  // 2. REGISTRAR USUARIO
  // ============================================================

  @Permisos('USUARIOS_CREAR')
  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crearUsuario(dto);
  }

  // ============================================================
  // 3. MODIFICAR USUARIO
  // ============================================================

  @Permisos('USUARIOS_MODIFICAR')
  @Patch(':id')
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizarUsuario(
      id,
      dto,
    );
  }

  // ============================================================
  // 4. DESACTIVAR Y REACTIVAR USUARIO
  // ============================================================

  @Permisos('USUARIOS_CAMBIAR_ESTADO')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: CambiarEstadoUsuarioDto,
  ) {
    return this.usuariosService.cambiarEstadoUsuario(
      id,
      dto,
    );
  }
}
