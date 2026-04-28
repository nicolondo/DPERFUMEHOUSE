import { IsUUID, IsNotEmpty, IsString, IsInt, Min, IsOptional, IsEmail, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateLinkDto {
  @IsUUID()
  variantId: string;
}

export class PurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  // Address fields
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsString()
  addressPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  legalIdType?: string;

  @IsOptional()
  @IsString()
  legalId?: string;
}
export class CatalogPurchaseItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CatalogPurchaseDto extends PurchaseDto {
  @IsOptional()
  items?: CatalogPurchaseItemDto[];
}
