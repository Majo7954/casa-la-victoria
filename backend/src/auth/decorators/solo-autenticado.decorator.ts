import { SetMetadata } from '@nestjs/common';

export const SOLO_AUTENTICADO_KEY = 'solo_autenticado';

export const SoloAutenticado = () =>
  SetMetadata(SOLO_AUTENTICADO_KEY, true);
