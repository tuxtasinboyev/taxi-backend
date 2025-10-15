import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
    @ApiProperty({ example: 'uuid-user', description: 'User ID (yo‘lovchi)' })
    @IsString()
    user_id: string;

    @ApiProperty({ example: 41.311081, description: 'Boshlanish nuqtasi latitude' })
    @IsLatitude()
    start_lat: number;

    @ApiProperty({ example: 69.240562, description: 'Boshlanish nuqtasi longitude' })
    @IsLongitude()
    start_lng: number;

    @ApiProperty({ example: 41.315083, description: 'Manzil nuqtasi latitude' })
    @IsLatitude()
    end_lat: number;

    @ApiProperty({ example: 69.260819, description: 'Manzil nuqtasi longitude' })
    @IsLongitude()
    end_lng: number;

    @ApiPropertyOptional({ example: 'uuid-taxi-category', description: 'Taxi category ID (optional)' })
    @IsOptional()
    @IsString()
    taxiCategoryId?: string;

    @ApiPropertyOptional({ example: 'DISCOUNT50', description: 'Promo code (optional)' })
    @IsOptional()
    @IsString()
    promoCode?: string;

    @ApiPropertyOptional({
        enum: ['cash', 'card'],
        example: 'cash',
        description: 'To‘lov turi (cash yoki card)',
    })
    @IsOptional()
    @IsEnum(['cash', 'card'])
    payment_method?: 'cash' | 'card';
}
