import { IsArray, IsDateString, ArrayMinSize, ArrayMaxSize, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InitiateCommissionPaymentDto {
  @ApiProperty({
    example: ['2025-01-01'],
    description: 'Komisyon to\'lanadigan kun(lar) (YYYY-MM-DD). 1 yoki 2 kun.',
  })
  @IsArray()
  @IsDateString({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  dates: string[];
}

export class ClickCallbackDto {
  @Type(() => Number)
  @IsNumber()
  click_trans_id: number;

  @Type(() => Number)
  @IsNumber()
  service_id: number;

  @Type(() => Number)
  @IsNumber()
  click_paydoc_id: number;

  @IsString()
  merchant_trans_id: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  merchant_prepare_id?: number;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @Type(() => Number)
  @IsNumber()
  action: number;

  @Type(() => Number)
  @IsNumber()
  error: number;

  @IsString()
  error_note: string;

  @IsString()
  sign_time: string;

  @IsString()
  sign_string: string;
}
