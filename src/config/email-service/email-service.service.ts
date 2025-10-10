import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailServiceService {
    private resend: Resend;

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
    }

    async sendMail(to: string, subject: string, text: string) {
        try {
            const response = await this.resend.emails.send({
                from: `"Yolla taxi xizmati" <${process.env.EMAIL_FROM}>`,
                to,
                subject,
                text,
            });

            console.log('Email sent successfully:', response);
            return response;
        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    }
}
