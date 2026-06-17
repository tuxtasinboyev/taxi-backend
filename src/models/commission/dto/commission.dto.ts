import { IsArray, IsDateString, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  merchant_prepare_id?: number;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}
