import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
@Injectable()
export class EmailServiceService {
    private transporter: nodemailer.Transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        })
    }

    async sendMail(to: string, subject: string, text: string) {
        return this.transporter.sendMail({
            from: `"Yolla taxi xizmati" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
        });
    }
}
