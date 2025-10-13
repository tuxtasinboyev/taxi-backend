import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsPhoneNumber,
    IsString,
} from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateDriverDto {
    @ApiProperty({
        enum: Language,
        example: Language,
        description: 'Til kodi (uz, ru, en)',
    })
    @IsEnum(Language)
    language: Language;

    @ApiProperty({
        example: 'Ali Haydovchi',
        description: 'Haydovchining ismi (tilga qarab saqlanadi)',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: '+998901234567',
        description: 'Telefon raqam (xalqaro formatda)',
    })
    @IsPhoneNumber('UZ')
    phone: string;

    @ApiPropertyOptional({
        example: 'ali@example.com',
        description: 'Haydovchining elektron pochtasi',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'StrongPassword123!',
        description: 'Foydalanuvchining paroli (hash qilinadi)',
    })
    @IsString()
    password: string;

    @ApiProperty({
        example: 'Cobalt',
        description: 'Mashina modeli (tilga qarab saqlanadi)',
    })
    @IsString()
    @IsNotEmpty()
    car_model: string;

    @ApiProperty({
        example: 'Oq',
        description: 'Mashinaning rangi (tilga qarab saqlanadi)',
    })
    @IsString()
    @IsNotEmpty()
    car_color: string;

    @ApiProperty({
        example: '01A123BC',
        description: 'Mashina raqami (unikal)',
    })
    @IsString()
    @IsNotEmpty()
    car_number: string;

    @ApiProperty({
        example: '63d876fd-a6a5-45b0-859f-6fb9ec01b20c',
        description: 'Taksi kategoriyasi IDsi (TaxiCategory.id)',
    })
    @IsString()
    @IsNotEmpty()
    taxi_category_id: string;
}
