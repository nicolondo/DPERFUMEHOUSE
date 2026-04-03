import { IsString, IsOptional, IsInt, IsArray, Min, Max } from 'class-validator';

export class QuoteRatesDto {
  @IsString()
  @IsOptional()
  carrier?: string;
}

export class CreateLabelDto {
  @IsString()
  carrier: string;

  @IsString()
  service: string;
}

export class SchedulePickupDto {
  @IsString()
  date: string;

  @IsInt()
  @Min(0)
  @Max(23)
  timeFrom: number;

  @IsInt()
  @Min(0)
  @Max(23)
  timeTo: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  trackingNumbers?: string[];
}
