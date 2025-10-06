import { Body, Controller, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) { }

    @Post('send')
    @ApiOperation({ summary: 'Send OTP with language' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                lang: { type: 'string', example: 'uz', enum: ['uz', 'ru', 'en'] },
            },
            required: ['email', 'lang'],
        },
    })
    async sendOtp(
        @Body('email') email: string,
        @Body('lang') lang: 'uz' | 'ru' | 'en',
    ) {
        return this.otpService.sendOtp(email, lang);
    }
    @Post('verify')
    @ApiOperation({ summary: 'Verify OTP with language' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                otp: { type: 'string', example: '123456' },
                lang: { type: 'string', example: 'uz', enum: ['uz', 'ru', 'en'] },
            },
            required: ['email', 'otp', 'lang'],
        },
    })
    async verifyOtp(
        @Body('email') email: string,
        @Body('otp') otp: string,
        @Body('lang') lang: 'uz' | 'ru' | 'en',
    ) {
        return this.otpService.verifyOtp(email, otp, lang);
    }
}
