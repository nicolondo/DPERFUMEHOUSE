import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProposalItemDto {
  @IsUUID()
  variantId: string;

  @IsString()
  @IsOptional()
  sellerNote?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateProposalDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalItemDto)
  items: ProposalItemDto[];
}

export class UpdateProposalDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalItemDto)
  @IsOptional()
  items?: ProposalItemDto[];
}
