import {
    Body,
    Controller,
    Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create.register.dto';
import { RegisterAuthDto, SendOtpDto } from './dto/register.dto';
import { LoginAuthDto, ResetPasswordDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }


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
    @ApiOperation({ summary: 'Foydalanuvchini ro‘yxatdan o‘tkazish va parolni saqlash' })
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

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset OTP tasdiqlangandan keyin yangi parol o‘rnatish' })
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
