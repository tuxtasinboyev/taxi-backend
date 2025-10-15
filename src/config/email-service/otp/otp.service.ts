import { Injectable } from "@nestjs/common";
import { EmailServiceService } from "../email-service.service";
import { RedisService } from "src/config/redis/redis.service";

@Injectable()
export class OtpService {
    private readonly translations = {
        uz: {
            subject: 'TaxiGo — Tasdiqlash kodi',
            message: (otp: string) =>
                `Hurmatli foydalanuvchi, sizning OTP kodingiz: ${otp}\nBu kod 6 daqiqa amal qiladi.`,
            success: '✅ OTP muvaffaqiyatli tasdiqlandi',
            fail: '❌ OTP noto‘g‘ri yoki muddati tugagan',
        },
        ru: {
            subject: 'TaxiGo — Код подтверждения',
            message: (otp: string) =>
                `Уважаемый пользователь, ваш код OTP: ${otp}\nКод действует 6 минут.`,
            success: '✅ OTP успешно подтвержден',
            fail: '❌ Неверный или просроченный OTP',
        },
        en: {
            subject: 'TaxiGo — Verification Code',
            message: (otp: string) =>
                `Dear user, your OTP code is: ${otp}\nThis code is valid for 6 minutes.`,
            success: '✅ OTP verified successfully',
            fail: '❌ Invalid or expired OTP',
        },
    };

    private readonly forgotPasswordTranslations = {
        uz: {
            subject: 'TaxiGo — Parolni tiklash',
            message: (otp: string) =>
                `Hurmatli foydalanuvchi, parolni tiklash uchun sizning OTP kodingiz: ${otp}\n` +
                `Bu kod 6 daqiqa amal qiladi.\nAgar bu so‘rov sizniki bo‘lmasa, e’tiborsiz qoldiring.`,
            success: '✅ Parolingiz muvaffaqiyatli yangilandi',
            fail: '❌ OTP noto‘g‘ri yoki muddati tugagan',
        },
        ru: {
            subject: 'TaxiGo — Сброс пароля',
            message: (otp: string) =>
                `Уважаемый пользователь, для сброса пароля ваш OTP код: ${otp}\n` +
                `Код действует 6 минут.\nЕсли это были не вы, просто проигнорируйте письмо.`,
            success: '✅ Ваш пароль успешно обновлён',
            fail: '❌ Неверный или просроченный OTP',
        },
        en: {
            subject: 'TaxiGo — Password Reset',
            message: (otp: string) =>
                `Dear user, to reset your password please use this OTP code: ${otp}\n` +
                `This code is valid for 6 minutes.\nIf you did not request this, please ignore this email.`,
            success: '✅ Your password has been successfully updated',
            fail: '❌ Invalid or expired OTP',
        },
    };

    constructor(
        private readonly emailService: EmailServiceService,
        private readonly redisService: RedisService,
    ) { }

    async sendOtp(email: string, lang: 'uz' | 'ru' | 'en') {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(`otp:${email}`, otp, 1800); 

        const { subject, message } = this.translations[lang];
        await this.emailService.sendMail(email, subject, message(otp));

        return { message: `OTP sent to ${email} (${lang})` };
    }

    async verifyOtp(email: string, otp: string, lang: 'uz' | 'ru' | 'en') {
        const storedOtp = await this.redisService.get(`otp:${email}`);

        if (!storedOtp) {
            return { success: false, message: this.translations[lang].fail };
        }

        const isValid = storedOtp === otp;
        if (isValid) {
            await this.redisService.del(`otp:${email}`);
            return { success: true, message: this.translations[lang].success };
        }

        return { success: false, message: this.translations[lang].fail };
    }

    async sendForgotPasswordOtp(email: string, lang: 'uz' | 'ru' | 'en') {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(`forgot:${email}`, otp, 1800); 

        const { subject, message } = this.forgotPasswordTranslations[lang];
        await this.emailService.sendMail(email, subject, message(otp));

        return { message: `Password reset OTP sent to ${email} (${lang})` };
    }

    async verifyForgotPasswordOtp(email: string, otp: string, lang: 'uz' | 'ru' | 'en') {
        const storedOtp = await this.redisService.get(`forgot:${email}`);
        console.log(storedOtp, otp);
        
        if (!storedOtp) {

            return { success: false, message: this.forgotPasswordTranslations[lang].fail };
        }

        const isValid = storedOtp === otp;
        if (isValid) {
            await this.redisService.del(`forgot:${email}`);
            return { success: true, message: this.forgotPasswordTranslations[lang].success };
        }

        return { success: false, message: this.forgotPasswordTranslations[lang].fail };
    }
}
