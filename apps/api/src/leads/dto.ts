import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, IsDateString, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { Allow } from 'class-validator';

export class SubmitQuestionnaireDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientCity?: string;

  @Allow()
  answers: Record<string, any>;

  @IsOptional()
  @IsString()
  budgetRange?: string;

  @IsOptional()
  @IsBoolean()
  isForGift?: boolean;

  @IsOptional()
  @IsString()
  giftRecipient?: string;
}

export class CreateLeadForCustomerDto {
  @IsString()
  customerId: string;
}

export class UpdateLeadStatusDto {
  @IsString()
  status: string; // SENT | RESPONDED | APPOINTMENT | VISITED | CONVERTED
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  appointmentTime?: string;

  @IsOptional()
  @IsString()
  appointmentLocation?: string;

  @IsOptional()
  @IsString()
  appointmentNotes?: string;
}

export class ConvertLeadDto {
  @IsString()
  orderId: string;
}
