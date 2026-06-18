import { IsArray, IsDateString, ArrayMinSize, ArrayMaxSize, IsString, IsOptional } from 'class-validator';
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

// Click barcha fieldlarni string yuboradi (form-urlencoded yoki JSON)
// Sign hisoblashda raw string ishlatiladi — Number()ga o'tkazmaslik kerak
export class ClickCallbackDto {
  @IsString()
  click_trans_id: string;

  @IsString()
  service_id: string;

  @IsString()
  click_paydoc_id: string;

  @IsString()
  merchant_trans_id: string;

  @IsOptional()
  @IsString()
  merchant_prepare_id?: string;

  @IsString()
  amount: string;

  @IsString()
  action: string;

  @IsString()
  error: string;

  @IsOptional()
  @IsString()
  error_note?: string;

  @IsString()
  sign_time: string;

  @IsString()
  sign_string: string;
}
