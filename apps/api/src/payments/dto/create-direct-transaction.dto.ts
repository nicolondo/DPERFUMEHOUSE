import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

export type PaymentMethodType =
  | 'CARD'
  | 'PSE'
  | 'NEQUI'
  | 'BANCOLOMBIA_TRANSFER'
  | 'BANCOLOMBIA_COLLECT'
  | 'DAVIPLATA';

export class CreateDirectTransactionDto {
  @IsEnum(['CARD', 'PSE', 'NEQUI', 'BANCOLOMBIA_TRANSFER', 'BANCOLOMBIA_COLLECT', 'DAVIPLATA'])
  paymentMethodType: PaymentMethodType;

  @IsString()
  @IsNotEmpty()
  acceptanceToken: string;

  // --- CARD ---
  @ValidateIf((o) => o.paymentMethodType === 'CARD')
  @IsString()
  @IsNotEmpty()
  cardToken?: string;

  @ValidateIf((o) => o.paymentMethodType === 'CARD')
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  installments?: number;

  // --- PSE ---
  @ValidateIf((o) => o.paymentMethodType === 'PSE')
  @IsString()
  @IsNotEmpty()
  bankCode?: string;

  @ValidateIf((o) => o.paymentMethodType === 'PSE')
  @IsInt()
  @Min(0)
  @Max(1)
  userType?: number; // 0 = Natural, 1 = Jurídica

  // --- PSE + DAVIPLATA (shared) ---
  @ValidateIf((o) => o.paymentMethodType === 'PSE' || o.paymentMethodType === 'DAVIPLATA')
  @IsString()
  @IsNotEmpty()
  legalIdType?: string;

  @ValidateIf((o) => o.paymentMethodType === 'PSE' || o.paymentMethodType === 'DAVIPLATA')
  @IsString()
  @IsNotEmpty()
  legalId?: string;

  // --- NEQUI ---
  @ValidateIf((o) => o.paymentMethodType === 'NEQUI')
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;
}
