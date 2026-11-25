
import {
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum TipoActivacion {
  INVITE = 'invite',
  MAGICLINK = 'magiclink',
}

export class ActivarCuentaDto {
  @IsString()
  @MinLength(1)
  token_hash!: string;

  @IsEnum(TipoActivacion)
  tipo!: TipoActivacion;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  contrasena!: string;
}
