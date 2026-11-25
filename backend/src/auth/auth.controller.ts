import {
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { Permisos } from './decorators/permisos.decorator';
import { SoloAutenticado } from './decorators/solo-autenticado.decorator';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @SoloAutenticado()
  @Get('me')
  obtenerPerfil(@Req() request: AuthenticatedRequest) {
    return {
      mensaje: 'Acceso autorizado',
      usuario: request.usuario,
    };
  }
}
