import {
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsUUID,
  IsIn,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderBodyDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  addressId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsIn(['ONLINE', 'CASH'])
  @IsOptional()
  paymentMethod?: 'ONLINE' | 'CASH';
}

export class UpdateOrderAddressDto {
  @IsUUID()
  addressId: string;
}
