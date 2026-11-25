
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';

import { Public } from './decorators/public.decorator';
import { SoloAutenticado } from './decorators/solo-autenticado.decorator';

import type {
  AuthenticatedRequest,
} from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // ============================================================
  // 1. INICIAR SESIÓN
  // ============================================================

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ============================================================
  // 2. CONSULTAR PERFIL AUTENTICADO
  // ============================================================

  @SoloAutenticado()
  @Get('me')
  obtenerPerfil(@Req() request: AuthenticatedRequest) {
    return {
      mensaje: 'Acceso autorizado',
      usuario: request.usuario,
    };
  }

  // ============================================================
  // 3. ACTIVAR CUENTA
  // ============================================================

  @Public()
  @Post('activar-cuenta')
  activarCuenta(@Body() dto: ActivarCuentaDto) {
    return this.authService.activarCuenta(dto);
  }
}
