import { IsUUID, IsNotEmpty, IsString, IsInt, Min, IsOptional, IsEmail, MinLength } from 'class-validator';

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
