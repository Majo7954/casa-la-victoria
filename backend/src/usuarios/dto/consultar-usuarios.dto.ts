import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ConsultarUsuariosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 10;
}
