import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLinkReferralDto {
    @ApiProperty({ example: '+998901111111', description: "Haydovchining telefon raqami" })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'YL-4F7K2Q', description: "Uni taklif qilgan haydovchining referal kodi" })
    @IsString()
    @IsNotEmpty()
    referral_code: string;
}
