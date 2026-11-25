
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { CodigoRol } from './crear-usuario.dto';

export class ActualizarUsuarioDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(CodigoRol)
  codigo_rol?: CodigoRol;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  id_sucursal?: number;
}
