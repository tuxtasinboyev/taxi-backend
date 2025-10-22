import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateTaxiCategoryDto {
    @ApiProperty({
        example: 'Comfort',
        description: 'Kategoriya nomi (kiritilgan til bo‘yicha saqlanadi)',
    })
    @IsString()
    name: string;

    @ApiProperty({
        enum: Language,
        example: 'uz',
        description: 'Til kodi (qaysi til bo‘yicha nomni saqlash kerak)',
    })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({
        example: true,
        description: 'Kategoriya aktiv holatda bo‘lsinmi?',
        default: true,
    })
    @IsOptional()
    is_active?: boolean;

    @ApiProperty({
        example: 2.50,
        description: 'Har bir kilometr uchun narx',
    })
    price_per_km: number;
}
