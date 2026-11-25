import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos_requeridos';

export const Permisos = (...codigos: string[]) =>
  SetMetadata(PERMISOS_KEY, codigos);
