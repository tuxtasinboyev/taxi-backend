import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from "bcrypt";
import { DatabaseService } from 'src/config/database/database.service';
import { JwtServices } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { CreateUserDto } from './dto/create.register.dto';
import { RegisterAuthDto, SendOtpDto } from './dto/register.dto';
import { RedisService } from 'src/config/redis/redis.service';
import { SmsService } from 'src/common/services/sms.service';
import { LoginAuthDto } from './dto/login.dto';
@Injectable()
export class AuthService {
    private readonly approvedRegisterSms = (otp: string) =>
        `"PROHOME" platformasida ro'yxatdan o'tish uchun kod: ${otp}`;
    private readonly approvedResetSms = (otp: string) =>
        `"PROHOME" platformasi: parolni tiklash uchun tasdiqlash kodi ${otp}. Kodni hech kimga bermang.`;
    private readonly otpCooldownSeconds = 60;
    private readonly otpExpirySeconds = 120;

    constructor(
        private prisma: DatabaseService,
        private jwt: JwtServices,
        private redis: RedisService,
        private sms: SmsService,
    ) { }

    private async ensureOtpCooldown(key: string) {
        const cooldown = await this.redis.get(key);
        if (cooldown) {
            throw new BadRequestException('OTP yuborilgan. Qayta yuborish uchun 1 daqiqa kuting');
        }
    }

    async sendOtp(dto: SendOtpDto) {
        await this.ensureOtpCooldown(`register-otp-cooldown:${dto.phone}`);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await this.redis.set(`register-otp:${dto.phone}`, otp, this.otpExpirySeconds);
        await this.redis.set(`register-otp-cooldown:${dto.phone}`, 'true', this.otpCooldownSeconds);
        await this.sms.sendSMS(this.approvedRegisterSms(otp), dto.phone);

        return {
            message: 'OTP yuborildi',
            phone: dto.phone,
            provider: 'eskiz',
            expires_in_seconds: this.otpExpirySeconds,
            resend_after_seconds: this.otpCooldownSeconds,
        };
    }

    async verifyOtp(payload: RegisterAuthDto) {
        const savedOtp = await this.redis.get(`register-otp:${payload.phone}`);
        if (!savedOtp) {
            throw new NotFoundException('OTP topilmadi yoki muddati tugagan');
        }

        if (savedOtp !== payload.otp) {
            throw new BadRequestException('OTP noto\'g\'ri');
        }

        await this.redis.del(`register-otp:${payload.phone}`);
        await this.redis.set(`verified-phone:${payload.phone}`, 'true', 600);

        return {
            success: true,
            phone: payload.phone,
            message: 'Telefon raqami tasdiqlandi',
        };
    }

    async sendResetOtp(dto: SendOtpDto) {
        const user = await this.prisma.user.findUnique({
            where: { phone: dto.phone },
        });

        if (!user) {
            throw new NotFoundException('Foydalanuvchi topilmadi');
        }

        await this.ensureOtpCooldown(`reset-otp-cooldown:${dto.phone}`);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redis.set(`reset-otp:${dto.phone}`, otp, this.otpExpirySeconds);
        await this.redis.set(`reset-otp-cooldown:${dto.phone}`, 'true', this.otpCooldownSeconds);
        await this.sms.sendSMS(this.approvedResetSms(otp), dto.phone);

        return {
            success: true,
            phone: dto.phone,
            provider: 'eskiz',
            message: 'Parolni tiklash OTP yuborildi',
            expires_in_seconds: this.otpExpirySeconds,
            resend_after_seconds: this.otpCooldownSeconds,
        };
    }

    async verifyResetOtp(payload: RegisterAuthDto) {
        const savedOtp = await this.redis.get(`reset-otp:${payload.phone}`);
        if (!savedOtp) {
            throw new NotFoundException('OTP topilmadi yoki muddati tugagan');
        }

        if (savedOtp !== payload.otp) {
            throw new BadRequestException('OTP noto\'g\'ri');
        }

        await this.redis.del(`reset-otp:${payload.phone}`);
        await this.redis.set(`verified-reset-phone:${payload.phone}`, 'true', 600);

        return {
            success: true,
            phone: payload.phone,
            message: 'Parolni tiklash uchun telefon tasdiqlandi',
        };
    }

    async register(data: CreateUserDto) {
        const isVerified = await this.redis.get(`verified-phone:${data.phone}`);
        if (!isVerified) {
            throw new BadRequestException('Avval OTP ni tasdiqlang');
        }

        const existsUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { phone: data.phone },
                    ...(data.email ? [{ email: data.email }] : []),
                ],
            },
        });
        if (existsUser) {
            throw new ConflictException('this user already exists');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const userData: {
            phone: string;
            email?: string;
            role: UserRole;
            password_hash: string;
            name_uz?: string;
            name_ru?: string;
            name_en?: string;
        } = {
            phone: data.phone,
            role: UserRole.passenger,
            password_hash: passwordHash,
        };

        if (data.email) {
            userData.email = data.email;
        }

        if (data.lang === Language.en) userData.name_en = data.name;
        if (data.lang === Language.uz) userData.name_uz = data.name;
        if (data.lang === Language.ru) userData.name_ru = data.name;

        const user = await this.prisma.user.create({
            data: userData,
        });

        await this.redis.del(`verified-phone:${data.phone}`);

        return this.generateTokens(user);
    }

    private async generateTokens(user: any) {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.generateAccessToken(user),
            this.jwt.generateRefreshToken(user),
        ]);

        const { password_hash, ...safeUser } = user;

        return { user: safeUser, accessToken, refreshToken };
    }

    async login(payload: LoginAuthDto) {
        const user = await this.prisma.user.findUnique({
            where: { phone: payload.phone },
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
        });

        if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
        if (!user.password_hash) throw new BadRequestException('Parol o‘rnatilmagan');

        const isMatch = await bcrypt.compare(payload.password, user.password_hash);
        if (!isMatch) throw new BadRequestException('phone or password xato');

        return this.generateTokens(user);
    }

    async refreshAccessToken(refreshToken: string) {
        let payload: { id: string };
        try {
            payload = await this.jwt.verifyRefreshToken(refreshToken);
        } catch {
            throw new UnauthorizedException('Refresh token yaroqsiz yoki muddati tugagan');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: payload.id },
            include: {
                wallet: { select: { balance: true } },
                cards: true,
            },
        });

        if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

        const [accessToken, newRefreshToken] = await Promise.all([
            this.jwt.generateAccessToken(user),
            this.jwt.generateRefreshToken(user),
        ]);

        const { password_hash, ...safeUser } = user;

        return {
            success: true,
            user: safeUser,
            accessToken,
            refreshToken: newRefreshToken,
        };
    }

    async resetPassword(payload: { phone: string; password: string }) {
        const isVerified = await this.redis.get(`verified-reset-phone:${payload.phone}`);
        if (!isVerified) {
            throw new BadRequestException('Avval reset OTP ni tasdiqlang');
        }

        const user = await this.prisma.user.findUnique({
            where: { phone: payload.phone },
        });

        if (!user) {
            throw new NotFoundException('Foydalanuvchi topilmadi');
        }

        const passwordHash = await bcrypt.hash(payload.password, 10);
        await this.prisma.user.update({
            where: { phone: payload.phone },
            data: { password_hash: passwordHash },
        });

        await this.redis.del(`verified-reset-phone:${payload.phone}`);

        return {
            success: true,
            phone: payload.phone,
            message: 'Parol muvaffaqiyatli yangilandi',
        };
    }
}
