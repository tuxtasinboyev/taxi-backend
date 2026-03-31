import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from "bcrypt";
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { OtpService } from 'src/config/email-service/otp/otp.service';
import { JwtServices } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { CreateUserDto } from './dto/create.register.dto';
import { RegisterAuthDto, SendOtpDto } from './dto/register.dto';
import { RedisService } from 'src/config/redis/redis.service';
import { SmsService } from 'src/common/services/sms.service';
import { LoginAuthDto } from './dto/login.dto';
@Injectable()
export class AuthService {
    constructor(private prisma: DatabaseService, private jwt: JwtServices, private config: ConfigService, private otpService: OtpService,private redis:RedisService,private sms:SmsService) { }


    async sendOtp(dto: SendOtpDto) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await this.redis.set(`register-otp:${dto.phone}`, otp, 120);

        const messages = {
            uz: `"PROHOME" platformasida ro'yxatdan o'tish uchun kod: ${otp} `,
            // ru: `ProHome: Код подтверждения: ${otp}. Никому не сообщайте код!`,
            // en: `ProHome: Verification code: ${otp}. Never share this code!`,
        };

        await this.sms.sendSMS(messages[dto.lang], dto.phone);

        return { message: 'OTP yuborildi' };
    }

    async register(payload: RegisterAuthDto) {
        await this.verifyOtp(payload.phone, payload.otp);

        const existsUser = await this.prisma.user.findUnique({
            where: { phone: payload.phone },
        });

        if (existsUser) {
            return this.generateTokens(existsUser);
        }

        const user = await this.prisma.user.create({
            data: {
                phone: payload.phone,
                role: UserRole.passenger,
            },
        });

        return this.generateTokens(user);
    }



    private async verifyOtp(phone: string, otp: string) {
        const savedOtp = await this.redis.get(`register-otp:${phone}`);
        if (!savedOtp) {
            throw new NotFoundException('OTP topilmadi yoki muddati tugagan');
        }

        if (savedOtp !== otp) {
            throw new BadRequestException('OTP noto\'g\'ri');
        }

        await this.redis.del(`register-otp:${phone}`);
    }

    private async generateTokens(user: any) {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.generateAccessToken(user),
            this.jwt.generateRefreshToken(user),
        ]);

        return { safeUser: user, accessToken, refreshToken };
    }

    async login(payload: LoginAuthDto) {
        await this.verifyOtp(payload.phone, payload.otp);

        const user = await this.prisma.user.findUnique({
            where: { phone: payload.phone },
        });

        if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

        return this.generateTokens(user);
    }

    async registerUser(data: CreateUserDto, photoUrl?: string) {
        const existsEmail = await this.prisma.user.findUnique({
            where: { email: data.email }
        })
        const existsPhone = await this.prisma.user.findUnique({
            where: { phone: data.phone }
        })
        if (existsEmail || existsPhone) {
            throw new ConflictException('this user already exists')
        }
        let photo;
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl)
        }
        const passwordHash = await bcrypt.hash(data.password, 10)
        if (data.lang === Language.en) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_en: data.name,
                    role: UserRole.passenger,
                    profile_photo: photo,
                    password_hash: passwordHash
                }
            })
            const accessToken = await this.jwt.generateAccessToken(createUser)
            const refreshToken = await this.jwt.generateRefreshToken(createUser)
            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser,
                accessToken,
                refreshToken
            }
        }
        if (data.lang === Language.uz) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_uz: data.name,
                    role: UserRole.passenger,
                    profile_photo: photo,
                    password_hash: passwordHash
                }
            })
            const accessToken = await this.jwt.generateAccessToken(createUser)
            const refreshToken = await this.jwt.generateRefreshToken(createUser)
            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser,
                accessToken,
                refreshToken
            }
        }
        if (data.lang === Language.ru) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_ru: data.name,
                    role: UserRole.passenger,
                    profile_photo: photo,
                    password_hash: passwordHash

                }
            })
            const accessToken = await this.jwt.generateAccessToken(createUser)
            const refreshToken = await this.jwt.generateRefreshToken(createUser)
            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser,
                accessToken,
                refreshToken
            }
        }

    }
    async loginWithEmail(data: { email: string, password: string }) {
        const existsEmail = await this.prisma.user.findUnique({
            where: { email: data.email },
            include: {
                wallet: {
                    select: {

                        balance: true,
                        created_at: true,
                        updated_at: true,
                    }
                },
                cards: true
            }
        })
        if (!existsEmail) throw new NotFoundException('user not found')
        const accessToken = await this.jwt.generateAccessToken(existsEmail)
        const refreshToken = await this.jwt.generateRefreshToken(existsEmail)
        const { password_hash, ...safeUser } = existsEmail
        const isMatch = await bcrypt.compare(data.password, existsEmail.password_hash!)
        if (!isMatch) throw new BadRequestException('password or email xato')
        return {
            user: safeUser,
            accessToken,
            refreshToken
        }
    }
    async loginWithPhone(data: { phone: string, password: string }) {
        const existsPhone = await this.prisma.user.findUnique({
            where: { phone: data.phone },
            include: {
                wallet: {
                    select: {

                        balance: true,
                        created_at: true,
                        updated_at: true,
                    }
                },
                cards: true
            }
        })
        if (!existsPhone) throw new NotFoundException('user not found')
        const accessToken = await this.jwt.generateAccessToken(existsPhone)
        const refreshToken = await this.jwt.generateRefreshToken(existsPhone)
        const isMatch = await bcrypt.compare(data.password, existsPhone.password_hash!)
        if (!isMatch) throw new BadRequestException('password or email xato')

        const { password_hash, ...safeUser } = existsPhone
        return {
            user: safeUser,
            accessToken,
            refreshToken
        }
    }
    async forgotPassword(email: string, lang: 'uz' | 'ru' | 'en') {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new NotFoundException('User with this email not found');
        }

        await this.otpService.sendForgotPasswordOtp(email, lang);

        return { message: `Password reset OTP sent to ${email}` };
    }

    async resetPassword(email: string, otp: string, newPassword: string, lang: 'uz' | 'ru' | 'en') {
        const isValid = await this.otpService.verifyForgotPasswordOtp(email, otp, lang);

        if (!isValid.success) {
            return { success: false, message: isValid.message };
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        
        await this.prisma.user.update({
            where: { email },
            data: { password_hash: passwordHash },
        });

        return { success: true, message: 'Password updated successfully' };
    }
}

