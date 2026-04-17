import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CommissionScaleTierDto {
  @ApiProperty({ example: 0, description: 'Minimum monthly sales in COP' })
  @IsNumber()
  @Min(0)
  minSales: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Maximum monthly sales in COP' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSales?: number;

  @ApiProperty({ example: 20, description: 'Commission percentage for this tier (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent: number;
}

export class CreateUserDto {
  @ApiProperty({ example: 'seller@dperfumehouse.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Password (deprecated — invite link is sent if omitted)' })
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'La contrasena debe tener minimo 8 caracteres' })
  password?: string;

  @ApiProperty({ example: 'Maria Lopez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '+57' })
  @IsString()
  @IsOptional()
  phoneCode?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER_L1 })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'UUID of the parent seller for hierarchy' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 0.1, description: 'Commission rate L1 between 0 and 1' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 0.05, description: 'Commission rate L2 between 0 and 1' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionRateL2?: number;

  @ApiPropertyOptional({ description: 'Allow this user to manage sub-sellers' })
  @IsBoolean()
  @IsOptional()
  canManageSellers?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Allowed product categories for this user. Empty means no category access.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedCategories?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  odooCompanyId?: number;

  @ApiPropertyOptional({ description: 'Enable monthly commission scale for this seller' })
  @IsBoolean()
  @IsOptional()
  commissionScaleEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Use global commission scale settings' })
  @IsBoolean()
  @IsOptional()
  commissionScaleUseGlobal?: boolean;

  @ApiPropertyOptional({ type: [CommissionScaleTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionScaleTierDto)
  @IsOptional()
  commissionScaleOverride?: CommissionScaleTierDto[];
}

export class CreateSubSellerDto {
  @ApiProperty({ example: 'Sub Seller Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'subseller@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '3001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: '+57' })
  @IsString()
  @IsOptional()
  phoneCode?: string;
}
