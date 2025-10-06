import {
    BadRequestException,
    Body,
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { registerApiBody } from 'src/common/types/api.body.types';
import { fileStorages } from 'src/common/types/upload_types';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create.register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    @ApiBody(registerApiBody)
    async registerUser(
        @Body() body: CreateUserDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // if(!file)throw new BadRequestException('siz rasm quyishish kerak')
        if(file){

            return this.authService.registerUser(body, file.filename);
        }
        return this.authService.registerUser(body);

    }

    @Post('login/email')
    @ApiOperation({ summary: 'Login with email & password' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                password: { type: 'string', example: '123456' },
            },
            required: ['email', 'password'],
        },
    })
    async loginWithEmail(
        @Body() data: { email: string; password: string },
    ) {
        return this.authService.loginWithEmail(data);
    }

    @Post('login/phone')
    @ApiOperation({ summary: 'Login with phone & password' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                phone: { type: 'string', example: '+998901234567' },
                password: { type: 'string', example: '123456' },
            },
            required: ['phone', 'password'],
        },
    })
    async loginWithPhone(
        @Body() data: { phone: string; password: string },
    ) {
        return this.authService.loginWithPhone(data);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Send password reset OTP to email' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                lang: {
                    type: 'string',
                    enum: ['uz', 'ru', 'en'],
                    example: 'uz',
                    description: 'Language for OTP message'
                },
            },
            required: ['email', 'lang'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Password reset OTP sent successfully',
        schema: {
            example: {
                message: 'Password reset OTP sent to user@example.com'
            }
        }
    })
    @ApiResponse({ status: 404, description: 'User with this email not found' })
    async forgotPassword(
        @Body() data: { email: string; lang: 'uz' | 'ru' | 'en' },
    ) {
        return this.authService.forgotPassword(data.email, data.lang);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password with OTP verification' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                otp: { type: 'string', example: '123456' },
                newPassword: { type: 'string', example: 'newpassword123' },
                lang: {
                    type: 'string',
                    enum: ['uz', 'ru', 'en'],
                    example: 'uz',
                    description: 'Language for response messages'
                },
            },
            required: ['email', 'otp', 'newPassword', 'lang'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Password reset successfully',
        schema: {
            example: {
                success: true,
                message: 'Password updated successfully'
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid OTP',
        schema: {
            example: {
                success: false,
                message: 'Invalid or expired OTP'
            }
        }
    })
    @ApiResponse({ status: 404, description: 'User not found' })
    async resetPassword(
        @Body() data: {
            email: string;
            otp: string;
            newPassword: string;
            lang: 'uz' | 'ru' | 'en'
        },
    ) {
        return this.authService.resetPassword(
            data.email,
            data.otp,
            data.newPassword,
            data.lang
        );
    }

}
