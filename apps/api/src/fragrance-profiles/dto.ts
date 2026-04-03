import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsJSON, Min, Max } from 'class-validator';

export class CreateFragranceProfileDto {
  @IsString()
  productVariantId: string;

  @IsString()
  familiaOlfativa: string;

  @IsOptional()
  @IsString()
  subfamilia?: string;

  @IsOptional()
  @IsString()
  intensidad?: string;

  @IsOptional()
  @IsString()
  contextoIdeal?: string;

  @IsOptional()
  @IsString()
  climaIdeal?: string;

  @IsOptional()
  @IsString()
  perfilPersonalidad?: string;

  @IsOptional()
  @IsString()
  notasDestacadas?: string;

  @IsOptional()
  @IsString()
  descripcionDetallada?: string;

  @IsOptional()
  @IsString()
  duracionEstimada?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsNegativos?: string[];

  @IsOptional()
  @IsString()
  frasePositionamiento?: string;

  @IsOptional()
  @IsString()
  genero?: string;

  @IsOptional()
  @IsString()
  equivalencia?: string;

  @IsOptional()
  @IsString()
  notasAdicionales?: string;

  @IsOptional()
  presentaciones?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFragranceProfileDto {
  @IsOptional()
  @IsString()
  familiaOlfativa?: string;

  @IsOptional()
  @IsString()
  subfamilia?: string;

  @IsOptional()
  @IsString()
  intensidad?: string;

  @IsOptional()
  @IsString()
  contextoIdeal?: string;

  @IsOptional()
  @IsString()
  climaIdeal?: string;

  @IsOptional()
  @IsString()
  perfilPersonalidad?: string;

  @IsOptional()
  @IsString()
  notasDestacadas?: string;

  @IsOptional()
  @IsString()
  descripcionDetallada?: string;

  @IsOptional()
  @IsString()
  duracionEstimada?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsNegativos?: string[];

  @IsOptional()
  @IsString()
  frasePositionamiento?: string;

  @IsOptional()
  @IsString()
  genero?: string;

  @IsOptional()
  @IsString()
  equivalencia?: string;

  @IsOptional()
  @IsString()
  notasAdicionales?: string;

  @IsOptional()
  presentaciones?: any;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  completionScore?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkImportDto {
  @IsArray()
  profiles: CreateFragranceProfileDto[];
}
