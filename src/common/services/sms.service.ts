import { HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly username: string;
  private readonly password: string;
  private readonly from: string;
  private readonly callbackUrl?: string;
  private readonly axiosInstance: AxiosInstance;
  private token?: string;

  constructor(private readonly configService: ConfigService) {
    this.username = this.configService.get<string>('SMS_USERNAME', '');
    this.password = this.configService.get<string>('SMS_PASSWORD', '');
    this.from = this.configService.get<string>('SMS_FROM', '4546');
    this.callbackUrl = this.configService.get<string>('SMS_CALLBACK_URL') || undefined;

    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('SMS_API_URL', 'https://notify.eskiz.uz/api'),
    });
  }

  private async getToken() {
    if (this.token) {
      return this.token;
    }

    if (!this.username || !this.password) {
      throw new InternalServerErrorException('Eskiz SMS sozlamalari toliq kiritilmagan');
    }

    const { data } = await this.axiosInstance.post('/auth/login', {
      email: this.username,
      password: this.password,
    });

    this.token = data?.data?.token;

    if (!this.token) {
      throw new InternalServerErrorException('Eskiz token olinmadi');
    }

    return this.token;
  }

  public async sendSMS(message: string, phone: string) {
    try {
      const token = await this.getToken();
      const cleanPhone = phone.replace(/[^\d]/g, '');

      const payload: Record<string, string> = {
        mobile_phone: cleanPhone,
        message,
        from: this.from,
      };

      if (this.callbackUrl) {
        payload.callback_url = this.callbackUrl;
      }

      await this.axiosInstance.post(
        '/message/sms/send',
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return { success: true };
    } catch (error) {
      const responseData = axios.isAxiosError(error) ? error.response?.data : undefined;
      this.logger.error(`SMS xatolik: ${JSON.stringify(responseData || error.message)}`);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.token = undefined;
      }

      throw new HttpException('SMS yuborishda xatolik yuz berdi', 400);
    }
  }
}
