
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  // ============================================================
  // 1. CREAR APLICACIÓN NESTJS
  // ============================================================

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // ============================================================
  // 2. CONFIGURAR COOKIES
  // ============================================================

  // Permite leer las cookies HTTP mediante request.cookies.
  app.use(cookieParser());

  // ============================================================
  // 3. CONFIGURAR CORS
  // ============================================================

  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ??
    'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  });

  // ============================================================
  // 4. VALIDACIÓN GLOBAL DE SOLICITUDES
  // ============================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ============================================================
  // 5. INICIAR SERVIDOR
  // ============================================================

  const port =
    configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
}

void bootstrap();
