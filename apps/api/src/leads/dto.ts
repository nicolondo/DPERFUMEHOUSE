import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, IsDateString, ValidateNested, IsObject, Allow } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCategories?: string[];
}

export class CreateLeadForCustomerDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCategories?: string[];
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
