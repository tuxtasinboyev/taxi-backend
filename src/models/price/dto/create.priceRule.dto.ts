import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsUUID,
    ValidateIf,
} from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreatePricingRuleDto {
    @ApiProperty({ enum: Language, example: Language.uz, description: 'Til (uz, ru, en)' })
    @IsEnum(Language)
    lang: Language;

    @ApiPropertyOptional({ example: 'Toshkent', description: 'Shahar nomi' })
    @IsString()
    city: string;

    
    @ApiProperty({ example: 8000, description: 'Bazaviy narx (so‘m yoki ko‘rsatilgan valyutada)' })
    @IsNumber()
    base_fare: number;

    @ApiProperty({ example: 2500, description: '1 km uchun narx' })
    @IsNumber()
    per_km: number;

    @ApiProperty({ example: 500, description: '1 daqiqa uchun narx' })
    @IsNumber()
    per_min: number;

    @ApiPropertyOptional({ example: 1.2, description: 'Surge (ko‘paytiruvchi) — tirbandlikda oshirilgan koeffitsient' })
    @IsOptional()
    @IsNumber()
    surge_multiplier?: number;

    @ApiProperty({ example: 'UZS', description: 'Valyuta (UZS, USD, EUR, ...)' })
    @IsString()
    currency: string;

    @ApiPropertyOptional({ example: true, description: 'Qoidaning faol yoki yo‘qligi' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ example: '2025-10-15T00:00:00Z', description: 'Qachondan kuchga kiradi' })
    @IsDateString()
    valid_from: string;

    @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z', description: 'Qachongacha amal qiladi' })
    @IsOptional()
    @IsDateString()
    valid_to?: string;

    @ApiPropertyOptional({
        example: 'f3a5f6c2-8a45-4e83-9ef2-77b4f6f5a876',
        description: 'TaxiCategory ID (agar mavjud bo‘lsa)',
    })
    @IsOptional()
    @IsUUID()
    taxiCategoryId?: string;
}
