
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type {
  CookieOptions,
  Request,
  Response,
} from 'express';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';

import { Public } from './decorators/public.decorator';
import { SoloAutenticado } from './decorators/solo-autenticado.decorator';

import type {
  AuthenticatedRequest,
} from './interfaces/authenticated-request.interface';

const COOKIE_REFRESH = 'clv_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================
  // 1. OPCIONES DE COOKIE
  // ============================================================

  private opcionesCookie(): CookieOptions {
    const esProduccion =
      this.configService.get<string>('NODE_ENV') ===
      'production';

    return {
      httpOnly: true,
      secure: esProduccion,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }

  private guardarCookie(
    response: Response,
    refreshToken: string,
  ) {
    response.cookie(
      COOKIE_REFRESH,
      refreshToken,
      this.opcionesCookie(),
    );
  }

  private borrarCookie(response: Response) {
    const opciones = this.opcionesCookie();

    response.clearCookie(COOKIE_REFRESH, {
      httpOnly: opciones.httpOnly,
      secure: opciones.secure,
      sameSite: opciones.sameSite,
      path: opciones.path,
    });
  }

  // ============================================================
  // 2. PROTECCIÓN DEL ORIGEN DE LA SOLICITUD
  // ============================================================

  private comprobarOrigen(origin?: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL');

    if (!frontendUrl) {
      throw new ForbiddenException(
        'El origen autorizado no está configurado',
      );
    }

    const origenPermitido =
      new URL(frontendUrl).origin;

    if (origin !== origenPermitido) {
      throw new ForbiddenException(
        'Origen de solicitud no autorizado',
      );
    }
  }

  // ============================================================
  // 3. LEER COOKIE
  // ============================================================

  private obtenerRefreshToken(request: Request): string {
    const valor: unknown =
      request.cookies?.[COOKIE_REFRESH];

    if (
      typeof valor !== 'string' ||
      valor.length === 0
    ) {
      throw new UnauthorizedException(
        'No existe una sesión activa',
      );
    }

    return valor;
  }

  // ============================================================
  // 4. INICIAR SESIÓN
  // ============================================================

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.comprobarOrigen(origin);

    const resultado = await this.authService.login(dto);

    const { refreshToken, ...respuesta } = resultado;

    this.guardarCookie(response, refreshToken);

    return respuesta;
  }

  // ============================================================
  // 5. RENOVAR SESIÓN
  // ============================================================

  @Public()
  @Post('refresh')
  async renovarSesion(
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.comprobarOrigen(origin);

    const refreshToken =
      this.obtenerRefreshToken(request);

    try {
      const resultado =
        await this.authService.renovarSesion(
          refreshToken,
        );

      const {
        refreshToken: nuevoRefreshToken,
        ...respuesta
      } = resultado;

      this.guardarCookie(
        response,
        nuevoRefreshToken,
      );

      return respuesta;
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof
        UnauthorizedException
      ) {
        this.borrarCookie(response);
      }

      throw errorDesconocido;
    }
  }

  // ============================================================
  // 6. CERRAR SESIÓN ACTUAL
  // ============================================================

  @Public()
  @Post('logout')
  async cerrarSesion(
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.comprobarOrigen(origin);

    let refreshToken: string;

    try {
      refreshToken =
        this.obtenerRefreshToken(request);
    } catch (errorDesconocido) {
      this.borrarCookie(response);
      throw errorDesconocido;
    }

    try {
      const resultado =
        await this.authService.cerrarSesion(
          refreshToken,
        );

      this.borrarCookie(response);
      return resultado;
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof
        UnauthorizedException
      ) {
        this.borrarCookie(response);
      }

      throw errorDesconocido;
    }
  }

  // ============================================================
  // 7. CONSULTAR PERFIL AUTENTICADO
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
  // 8. ACTIVAR CUENTA
  // ============================================================

  @Public()
  @Post('activar-cuenta')
  activarCuenta(@Body() dto: ActivarCuentaDto) {
    return this.authService.activarCuenta(dto);
  }
}
