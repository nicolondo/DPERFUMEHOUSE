import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({ example: 'default_commission_rate' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateSettingDto {
  @ApiProperty({ example: 'default_commission_rate' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: '0.10' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;

  @ApiPropertyOptional({ default: 'general' })
  @IsString()
  @IsOptional()
  group?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
