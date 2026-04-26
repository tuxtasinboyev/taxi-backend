import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create.register.dto';
import { LoginAuthDto, ResetPasswordDto } from './dto/login.dto';
import { RegisterAuthDto, SendOtpDto } from './dto/register.dto';

class RefreshTokenDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    @IsString()
    @IsNotEmpty()
    refresh_token: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('send-otp')
    @ApiOperation({ summary: 'Eskiz orqali SMS OTP yuborish' })
    @ApiBody({ type: SendOtpDto })
    @ApiResponse({
        status: 201,
        description: 'OTP Eskiz orqali yuborildi',
        schema: {
            example: {
                message: 'OTP yuborildi',
                phone: '+998901234567',
                provider: 'eskiz',
            },
        },
    })
    sendOtp(@Body() dto: SendOtpDto) {
        return this.authService.sendOtp(dto);
    }

    @Post('send-reset-otp')
    @ApiOperation({ summary: 'Parolni tiklash uchun Eskiz orqali OTP yuborish' })
    @ApiBody({ type: SendOtpDto })
    @ApiResponse({
        status: 201,
        description: 'Reset OTP Eskiz orqali yuborildi',
        schema: {
            example: {
                success: true,
                phone: '+998901234567',
                provider: 'eskiz',
                message: 'Parolni tiklash OTP yuborildi',
            },
        },
    })
    sendResetOtp(@Body() dto: SendOtpDto) {
        return this.authService.sendResetOtp(dto);
    }

    @Post('verify-otp')
    @ApiOperation({ summary: 'SMS orqali kelgan OTP ni tasdiqlash' })
    @ApiBody({ type: RegisterAuthDto })
    @ApiResponse({
        status: 200,
        description: 'Telefon raqami tasdiqlandi',
        schema: {
            example: {
                success: true,
                phone: '+998901234567',
                message: 'Telefon raqami tasdiqlandi',
            },
        },
    })
    verifyOtp(@Body() dto: RegisterAuthDto) {
        return this.authService.verifyOtp(dto);
    }

    @Post('verify-reset-otp')
    @ApiOperation({ summary: 'Parolni tiklash uchun kelgan OTP ni tasdiqlash' })
    @ApiBody({ type: RegisterAuthDto })
    @ApiResponse({
        status: 200,
        description: 'Reset OTP tasdiqlandi',
        schema: {
            example: {
                success: true,
                phone: '+998901234567',
                message: 'Parolni tiklash uchun telefon tasdiqlandi',
            },
        },
    })
    verifyResetOtp(@Body() dto: RegisterAuthDto) {
        return this.authService.verifyResetOtp(dto);
    }

    @Post('register')
    @ApiOperation({ summary: 'Foydalanuvchini royxatdan otkazish' })
    @ApiBody({ type: CreateUserDto })
    register(@Body() dto: CreateUserDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Telefon raqami va parol orqali kirish' })
    @ApiBody({ type: LoginAuthDto })
    login(@Body() dto: LoginAuthDto) {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @ApiOperation({
        summary: 'Yangi access token olish',
        description: 'refresh_token yuborilsa, yangi accessToken va refreshToken qaytariladi.',
    })
    @ApiBody({ type: RefreshTokenDto })
    @ApiResponse({
        status: 201,
        description: 'Yangi tokenlar muvaffaqiyatli qaytarildi',
        schema: {
            example: {
                success: true,
                user: { id: 'uuid', phone: '+998901234567', role: 'passenger' },
                accessToken: 'eyJhbGci...',
                refreshToken: 'eyJhbGci...',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Refresh token yaroqsiz yoki muddati tugagan' })
    refreshToken(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshAccessToken(dto.refresh_token);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset OTP tasdiqlangandan keyin yangi parol ornatish' })
    @ApiBody({ type: ResetPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Parol yangilandi',
        schema: {
            example: {
                success: true,
                phone: '+998901234567',
                message: 'Parol muvaffaqiyatli yangilandi',
            },
        },
    })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }
}
