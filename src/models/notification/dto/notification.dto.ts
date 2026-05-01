import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsIn,
} from 'class-validator';

export class RegisterDeviceTokenDto {
    @ApiProperty({ example: 'fcm_token_here' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiPropertyOptional({ example: 'android', enum: ['android', 'ios', 'web'] })
    @IsOptional()
    @IsIn(['android', 'ios', 'web'])
    platform?: string;

    @ApiPropertyOptional({ example: 'uz', enum: ['uz', 'ru', 'en'] })
    @IsOptional()
    @IsIn(['uz', 'ru', 'en'])
    lang?: string;
}

export class AdminSendToUserDto {
    @ApiProperty({ example: 'user-uuid' })
    @IsString()
    @IsNotEmpty()
    user_id: string;

    @ApiProperty({ example: "Yangi xabar" })
    @IsString()
    @IsNotEmpty()
    title_uz: string;

    @ApiProperty({ example: "Новое сообщение" })
    @IsString()
    @IsNotEmpty()
    title_ru: string;

    @ApiProperty({ example: 'New message' })
    @IsString()
    @IsNotEmpty()
    title_en: string;

    @ApiProperty({ example: "Buyurtmangiz tasdiqlandi" })
    @IsString()
    @IsNotEmpty()
    message_uz: string;

    @ApiProperty({ example: "Ваш заказ подтверждён" })
    @IsString()
    @IsNotEmpty()
    message_ru: string;

    @ApiProperty({ example: 'Your order is confirmed' })
    @IsString()
    @IsNotEmpty()
    message_en: string;

    @ApiPropertyOptional({ example: 'admin' })
    @IsOptional()
    @IsString()
    type?: string;
}

export class AdminSendToAllDto {
    @ApiProperty({ example: "Yangi xabar" })
    @IsString()
    @IsNotEmpty()
    title_uz: string;

    @ApiProperty({ example: "Новое сообщение" })
    @IsString()
    @IsNotEmpty()
    title_ru: string;

    @ApiProperty({ example: 'New message' })
    @IsString()
    @IsNotEmpty()
    title_en: string;

    @ApiProperty({ example: "Barcha foydalanuvchilar uchun xabar" })
    @IsString()
    @IsNotEmpty()
    message_uz: string;

    @ApiProperty({ example: "Сообщение для всех пользователей" })
    @IsString()
    @IsNotEmpty()
    message_ru: string;

    @ApiProperty({ example: 'Message for all users' })
    @IsString()
    @IsNotEmpty()
    message_en: string;

    @ApiPropertyOptional({ example: 'promo' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ example: 'passenger', enum: ['passenger', 'driver', 'all'] })
    @IsOptional()
    @IsIn(['passenger', 'driver', 'all'])
    role?: string;
}

export class AdminSendToDeviceDto {
    @ApiProperty({ example: 'fcm_device_token' })
    @IsString()
    @IsNotEmpty()
    device_token: string;

    @ApiProperty({ example: "Yangi xabar" })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: "Xabar matni" })
    @IsString()
    @IsNotEmpty()
    message: string;
}
