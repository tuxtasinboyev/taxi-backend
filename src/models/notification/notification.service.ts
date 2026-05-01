import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { FirebaseService } from 'src/config/firebase/firebase.service';

export interface NotificationPayload {
    title_uz: string;
    title_ru: string;
    title_en: string;
    message_uz: string;
    message_ru: string;
    message_en: string;
    type: string;
    data?: Record<string, string>;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger('NotificationService');

    constructor(
        private readonly prisma: DatabaseService,
        private readonly firebase: FirebaseService,
    ) {}

    private pickLang<T extends { uz?: string | null; ru?: string | null; en?: string | null }>(
        obj: T,
        lang: string,
    ): string {
        if (lang === 'ru') return obj.ru || obj.uz || obj.en || '';
        if (lang === 'en') return obj.en || obj.uz || obj.ru || '';
        return obj.uz || obj.ru || obj.en || '';
    }

    // Bir foydalanuvchiga notification yuborish (DB + FCM)
    async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
        await this.prisma.notification.create({
            data: {
                user_id: userId,
                title_uz: payload.title_uz,
                title_ru: payload.title_ru,
                title_en: payload.title_en,
                message_uz: payload.message_uz,
                message_ru: payload.message_ru,
                message_en: payload.message_en,
                type: payload.type,
                data: payload.data ?? {},
            },
        });

        const devices = await this.prisma.deviceToken.findMany({
            where: { user_id: userId },
        });

        if (!devices.length) return;

        const sends = devices.map((device) => {
            const title = this.pickLang(
                { uz: payload.title_uz, ru: payload.title_ru, en: payload.title_en },
                device.lang,
            );
            const body = this.pickLang(
                { uz: payload.message_uz, ru: payload.message_ru, en: payload.message_en },
                device.lang,
            );
            return this.firebase.sendToToken(device.token, title, body, {
                type: payload.type,
                ...(payload.data ?? {}),
            });
        });

        await Promise.allSettled(sends);
    }

    // Barcha foydalanuvchilarga (role bo'yicha filtrlash mumkin)
    async sendToAll(
        payload: NotificationPayload,
        role?: 'passenger' | 'driver' | 'all',
    ): Promise<{ notified: number }> {
        const whereRole = role && role !== 'all' ? { role } : {};

        const users = await this.prisma.user.findMany({
            where: whereRole,
            select: { id: true },
        });

        for (const user of users) {
            await this.prisma.notification.create({
                data: {
                    user_id: user.id,
                    title_uz: payload.title_uz,
                    title_ru: payload.title_ru,
                    title_en: payload.title_en,
                    message_uz: payload.message_uz,
                    message_ru: payload.message_ru,
                    message_en: payload.message_en,
                    type: payload.type,
                    data: payload.data ?? {},
                },
            });
        }

        // Barcha device tokenlarni bir martalik yuklab, batch yuborish
        const devices = await this.prisma.deviceToken.findMany({
            where: role && role !== 'all' ? { user: { role } } : {},
            select: { token: true, lang: true },
        });

        const byLang: Record<string, string[]> = { uz: [], ru: [], en: [] };
        for (const d of devices) {
            const l = d.lang in byLang ? d.lang : 'uz';
            byLang[l].push(d.token);
        }

        for (const lang of ['uz', 'ru', 'en']) {
            if (!byLang[lang].length) continue;
            const title = this.pickLang(
                { uz: payload.title_uz, ru: payload.title_ru, en: payload.title_en },
                lang,
            );
            const body = this.pickLang(
                { uz: payload.message_uz, ru: payload.message_ru, en: payload.message_en },
                lang,
            );
            const chunks = this.chunkArray(byLang[lang], 500);
            for (const chunk of chunks) {
                await this.firebase.sendToMultipleTokens(chunk, title, body, {
                    type: payload.type,
                    ...(payload.data ?? {}),
                });
            }
        }

        return { notified: users.length };
    }

    // Bitta device tokeniga FCM yuborish (admin)
    async sendToDevice(
        deviceToken: string,
        title: string,
        message: string,
        data?: Record<string, string>,
    ): Promise<boolean> {
        return this.firebase.sendToToken(deviceToken, title, message, data);
    }

    // Foydalanuvchining barcha notificationlarini olish
    async getMyNotifications(
        userId: string,
        page = 1,
        limit = 20,
        lang = 'uz',
    ) {
        const offset = (Math.max(page, 1) - 1) * limit;
        const total = await this.prisma.notification.count({ where: { user_id: userId } });
        const unread = await this.prisma.notification.count({
            where: { user_id: userId, is_read: false },
        });

        const rows = await this.prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            skip: offset,
            take: limit,
        });

        const data = rows.map((n) => ({
            id: n.id,
            title: this.pickLang({ uz: n.title_uz, ru: n.title_ru, en: n.title_en }, lang),
            message: this.pickLang({ uz: n.message_uz, ru: n.message_ru, en: n.message_en }, lang),
            type: n.type,
            is_read: n.is_read,
            data: n.data,
            created_at: n.created_at,
        }));

        return {
            success: true,
            data,
            unread_count: unread,
            pagination: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit),
            },
        };
    }

    async markAsRead(id: string, userId: string) {
        const notif = await this.prisma.notification.findFirst({
            where: { id, user_id: userId },
        });
        if (!notif) throw new NotFoundException('Notification topilmadi');

        await this.prisma.notification.update({
            where: { id },
            data: { is_read: true },
        });
        return { success: true };
    }

    async markAllAsRead(userId: string) {
        await this.prisma.notification.updateMany({
            where: { user_id: userId, is_read: false },
            data: { is_read: true },
        });
        return { success: true };
    }

    async deleteNotification(id: string, userId: string) {
        const notif = await this.prisma.notification.findFirst({
            where: { id, user_id: userId },
        });
        if (!notif) throw new NotFoundException('Notification topilmadi');
        await this.prisma.notification.delete({ where: { id } });
        return { success: true };
    }

    // Admin: barcha notificationlar
    async adminGetAll(page = 1, limit = 20, userId?: string) {
        const where = userId ? { user_id: userId } : {};
        const offset = (Math.max(page, 1) - 1) * limit;
        const total = await this.prisma.notification.count({ where });
        const rows = await this.prisma.notification.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: offset,
            take: limit,
            include: { user: { select: { id: true, phone: true, name_uz: true, role: true } } },
        });
        return {
            success: true,
            data: rows,
            pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
        };
    }

    // Device token ro'yxatdan o'tkazish / yangilash
    async registerDeviceToken(
        userId: string,
        token: string,
        platform = 'android',
        lang = 'uz',
    ) {
        await this.prisma.deviceToken.upsert({
            where: { token },
            update: { user_id: userId, platform, lang, updated_at: new Date() },
            create: { user_id: userId, token, platform, lang },
        });
        return { success: true };
    }

    // Device tokenni o'chirish (logout)
    async removeDeviceToken(userId: string, token: string) {
        await this.prisma.deviceToken.deleteMany({
            where: { user_id: userId, token },
        });
        return { success: true };
    }

    private chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    }
}
