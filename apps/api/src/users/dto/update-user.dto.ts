import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { CommissionScaleTierDto } from './create-user.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Maria Lopez' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'maria@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '+57' })
  @IsString()
  @IsOptional()
  phoneCode?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 0.1 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 0.05 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  commissionRateL2?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  pendingApproval?: boolean;

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

  // Bank info
  @ApiPropertyOptional({ example: 'Bancolombia' })
  @IsString()
  @IsOptional()
  bankName?: string | null;

  @ApiPropertyOptional({ example: 'savings' })
  @IsString()
  @IsOptional()
  bankAccountType?: string | null;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsString()
  @IsOptional()
  bankAccountNumber?: string | null;

  @ApiPropertyOptional({ example: 'Maria Lopez' })
  @IsString()
  @IsOptional()
  bankAccountHolder?: string | null;

  @ApiPropertyOptional({ description: 'URL to bank certificate file' })
  @IsString()
  @IsOptional()
  bankCertificateUrl?: string | null;

  @ApiPropertyOptional({ description: 'USDT TRC20 wallet address' })
  @IsString()
  @IsOptional()
  usdtWalletTrc20?: string | null;

  @ApiPropertyOptional({ description: 'Unique seller code for questionnaire links' })
  @IsString()
  @IsOptional()
  sellerCode?: string | null;

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

export class UpdateBankInfoDto {
  @ApiPropertyOptional({ example: 'Bancolombia' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: 'savings' })
  @IsString()
  @IsOptional()
  bankAccountType?: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'Maria Lopez' })
  @IsString()
  @IsOptional()
  bankAccountHolder?: string;

  @ApiPropertyOptional({ description: 'URL to bank certificate file' })
  @IsString()
  @IsOptional()
  bankCertificateUrl?: string;

  @ApiPropertyOptional({ description: 'USDT TRC20 wallet address' })
  @IsString()
  @IsOptional()
  usdtWalletTrc20?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Maria Lopez' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '+57' })
  @IsString()
  @IsOptional()
  phoneCode?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
