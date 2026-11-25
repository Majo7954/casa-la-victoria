
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum CodigoRol {
  ADMINISTRADOR = 'ADMINISTRADOR',
  ENCARGADO = 'ENCARGADO',
  VENDEDOR = 'VENDEDOR',
}

export class CrearUsuarioDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsEmail()
  correo!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos!: string;

  @IsEnum(CodigoRol)
  codigo_rol!: CodigoRol;

  @IsInt()
  @Min(1)
  id_sucursal!: number;
}
