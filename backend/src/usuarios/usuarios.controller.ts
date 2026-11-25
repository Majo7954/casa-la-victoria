import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { Permisos } from '../auth/decorators/permisos.decorator';
import { UsuariosService } from './usuarios.service';
import { ConsultarUsuariosDto } from './dto/consultar-usuarios.dto';
import { Body, Post } from '@nestjs/common';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
  ) {}

  @Permisos('USUARIOS_CONSULTAR')
  @Get()
  listar(@Query() filtros: ConsultarUsuariosDto) {
    return this.usuariosService.listarUsuarios(filtros);
  }


  @Permisos('USUARIOS_CREAR')
  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crearUsuario(dto);
  }

}
