import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FlagReviewDto {
    @ApiProperty({ example: true, description: 'true = bayroq qo\'yish, false = bayroqni olib tashlash' })
    @IsBoolean()
    is_flagged: boolean;

    @ApiPropertyOptional({ example: 'Noto\'g\'ri kontent' })
    @IsOptional()
    @IsString()
    flag_reason?: string;
}
