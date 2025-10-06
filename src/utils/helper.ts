
export enum EVeriification {
    REGISTER = 'register',
    RESET_PASSWORD = 'reset_password',
    EDIT_PHONE = 'edit_phone',
}
export interface ICheckOtp {
    type: EVeriification;
    phone: string;
    otp: string;
}
export function generateOtp(): string {
    return String(Math.floor(10000 + Math.random() * 90000));
}
export interface SMSPayload {
    mobile_phone: string;
    message: string;
    from: string;
    callback_url: string;
}
export interface SMSSendResponse {
    id: string;
    status: string;
    message: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetUsersQueryDto {
    @ApiPropertyOptional({ example: 0, description: 'O‘tish soni' })
    skip?: number;

    @ApiPropertyOptional({ example: 50, description: 'Olish soni' })
    take?: number;

    @ApiPropertyOptional({ example: 'createdAt', description: 'Saralash maydoni' })
    orderBy?: string;
}
export enum Language {
    uz = 'uz',
    en = 'en',
    ru = 'ru',
}

