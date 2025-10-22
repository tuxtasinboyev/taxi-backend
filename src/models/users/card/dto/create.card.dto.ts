import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsBoolean, IsOptional, Length, Max, Min } from 'class-validator';

export class CreateUserCardDto {
    @ApiProperty({
        description: 'Foydalanuvchi ID si',
        example: '2b7a5a8f-9b33-4a8f-9c5c-97e3d94c9e01',
    })
    @IsString()
    user_id: string;

    @ApiProperty({
        description: 'To‘lov provayderi nomi (masalan: click, payme, stripe, yoko pay)',
        example: 'click',
    })
    @IsString()
    provider: string;

    @ApiProperty({
        description: 'Karta tokeni (provayderdan olingan maxfiy identifikator)',
        example: 'tok_1234567890abcdef',
    })
    @IsString()
    token: string;

    @ApiProperty({
        description: 'Kartaning oxirgi 4 ta raqami',
        example: '1234',
    })
    @IsString()
    @Length(4, 4, { message: 'last4 maydoni 4 ta raqamdan iborat bo‘lishi kerak' })
    last4: string;

    @ApiProperty({
        description: 'Karta brendi (masalan: VISA, MasterCard)',
        example: 'VISA',
    })
    @IsString()
    brand: string;

    @ApiProperty({
        description: 'Karta amal qilish oyi',
        example: 12,
    })
    @IsInt()
    @Min(1)
    @Max(12)
    expiry_month: number;

    @ApiProperty({
        description: 'Karta amal qilish yili',
        example: 2030,
    })
    @IsInt()
    expiry_year: number;

    @ApiProperty({
        description: 'Agar bu asosiy (default) karta bo‘lsa true bo‘ladi',
        example: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}
