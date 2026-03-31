import { HttpException, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SmsService {
  private readonly USERNAME = process.env.SMS_USERNAME;
  private readonly PASSWORD = process.env.SMS_PASSWORD; 
  private readonly FROM = process.env.SMS_FROM;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.SMS_API_URL,
    });
  }

  private async getToken() {
    const { data } = await this.axiosInstance.post('/auth/login', {
      email: this.USERNAME,
      password: this.PASSWORD,
    });
    return data.data.token;
  }

  public async sendSMS(message: string, phone: string) {
    try {
      const token = await this.getToken();
      const cleanPhone = phone.replace(/[^\d]/g, ''); 
      await this.axiosInstance.post(
        '/message/sms/send',
        {
          mobile_phone: cleanPhone,
          message: message,
          from: this.FROM,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (error) {
      console.error('SMS xatolik:', error.response?.data || error.message);
      throw new HttpException('SMS yuborishda xatolik yuz berdi', 400);
    }
  }
}