import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePromoCodeDto {
    @ApiProperty({
        example: 'SUMMER2025',
        description: 'Promokod matni (yagona bo‘lishi kerak)',
    })
    @IsString()
    code: string;

    @ApiProperty({
        example: 20,
        description: 'Chegirma foizi (0 dan 100 gacha)',
    })
    @IsInt()
    @Min(0)
    @Max(100)
    discount_percent: number;

    @ApiProperty({
        example: '2025-10-20T00:00:00Z',
        description: 'Promokod qachondan boshlab amal qiladi',
    })
    @IsDateString()
    valid_from: string;

    @ApiProperty({
        example: '2025-12-31T23:59:59Z',
        description: 'Promokodning amal qilish muddati (ixtiyoriy)',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    valid_to?: string;

    @ApiProperty({
        example: true,
        description: 'Promokod faolmi yoki yo‘qmi (ixtiyoriy)',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
