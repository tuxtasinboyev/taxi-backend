import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class ReferralService {
    constructor(private readonly prisma: DatabaseService) {}

    private nameField(lang?: Language): 'name_uz' | 'name_ru' | 'name_en' {
        return lang === Language.ru ? 'name_ru' : lang === Language.en ? 'name_en' : 'name_uz';
    }

    private generateCode(): string {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        return `YL-${code}`;
    }

    async getSettings() {
        let settings = await this.prisma.referralSettings.findFirst();
        if (!settings) {
            settings = await this.prisma.referralSettings.create({ data: {} });
        }
        return {
            success: true,
            data: {
                id: settings.id,
                percent: Number(settings.percent),
                duration_days: settings.duration_days,
                is_active: settings.is_active,
                updated_at: settings.updated_at,
            },
        };
    }

    async updateSettings(dto: UpdateReferralSettingsDto) {
        const current = await this.prisma.referralSettings.findFirst();
        const base = current ?? (await this.prisma.referralSettings.create({ data: {} }));

        const updated = await this.prisma.referralSettings.update({
            where: { id: base.id },
            data: {
                ...(dto.percent !== undefined ? { percent: dto.percent } : {}),
                ...(dto.duration_days !== undefined ? { duration_days: dto.duration_days } : {}),
                ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
            },
        });

        return {
            success: true,
            message: 'Referal sozlamalari yangilandi',
            data: {
                id: updated.id,
                percent: Number(updated.percent),
                duration_days: updated.duration_days,
                is_active: updated.is_active,
                updated_at: updated.updated_at,
            },
        };
    }

    async getOrCreateReferralCode(driverId: string) {
        const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
        if (!driver) throw new NotFoundException('Driver not found');

        if (driver.referral_code) {
            return { success: true, data: { referral_code: driver.referral_code } };
        }

        let code: string;
        let exists: boolean;
        do {
            code = this.generateCode();
            exists = !!(await this.prisma.driver.findUnique({ where: { referral_code: code } }));
        } while (exists);

        const updated = await this.prisma.driver.update({
            where: { id: driverId },
            data: { referral_code: code },
        });

        return { success: true, data: { referral_code: updated.referral_code } };
    }

    async validateReferralCode(code: string): Promise<string | null> {
        const driver = await this.prisma.driver.findUnique({ where: { referral_code: code } });
        return driver?.id ?? null;
    }

    async linkReferral(newDriverId: string, referrerDriverId: string): Promise<void> {
        if (newDriverId === referrerDriverId) return;
        await this.prisma.driver.update({
            where: { id: newDriverId },
            data: { referred_by_id: referrerDriverId },
        });
    }

    /**
     * Admin/xodim tomonidan qo'lda referal bog'lash — haydovchi ariza orqali kod
     * kiritmagan yoki keyinchalik tuzatish kerak bo'lgan holatlar uchun.
     */
    async adminLinkReferral(phone: string, referralCode: string) {
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) throw new NotFoundException("Bu telefon raqamli foydalanuvchi topilmadi");

        const driver = await this.prisma.driver.findUnique({ where: { id: user.id } });
        if (!driver) throw new NotFoundException('Bu foydalanuvchi haydovchi emas');

        const referrerId = await this.validateReferralCode(referralCode);
        if (!referrerId) throw new BadRequestException("Referal kodi noto'g'ri");

        if (referrerId === driver.id) {
            throw new BadRequestException("Haydovchi o'zini-o'zi referal qila olmaydi");
        }

        await this.linkReferral(driver.id, referrerId);

        return { success: true, message: "Referal bog'lanishi o'rnatildi" };
    }

    /**
     * Buyurtma yakunlanganda chaqiriladi. Narx/komissiya hisob-kitobiga tegmaydi —
     * faqat platforma komissiyasining bir qismini alohida ReferralEarning sifatida yozib qo'yadi.
     */
    async awardReferralEarning(params: {
        referredDriverId: string;
        orderId: string;
        commissionId: string;
        commissionAmount: number;
    }): Promise<void> {
        const { referredDriverId, orderId, commissionId, commissionAmount } = params;

        const driver = await this.prisma.driver.findUnique({ where: { id: referredDriverId } });
        if (!driver?.referred_by_id) return;

        const settings = await this.prisma.referralSettings.findFirst();
        if (!settings || !settings.is_active) return;

        if (settings.duration_days) {
            const deadline = new Date(driver.created_at);
            deadline.setDate(deadline.getDate() + settings.duration_days);
            if (new Date() > deadline) return;
        }

        const percent = Number(settings.percent);
        const amount = (commissionAmount * percent) / 100;
        if (amount <= 0) return;

        await this.prisma.referralEarning.upsert({
            where: { order_id: orderId },
            update: {},
            create: {
                referrer_driver_id: driver.referred_by_id,
                referred_driver_id: referredDriverId,
                order_id: orderId,
                commission_id: commissionId,
                amount,
                percent_applied: percent,
            },
        });
    }

    async getMyReferrals(driverId: string, language?: Language) {
        const referrals = await this.prisma.driver.findMany({
            where: { referred_by_id: driverId },
            include: {
                user: {
                    select: { name_uz: true, name_ru: true, name_en: true, profile_photo: true, phone: true },
                },
                orders: { where: { status: 'completed' }, select: { id: true } },
            },
            orderBy: { created_at: 'desc' },
        });

        const earnings = await this.prisma.referralEarning.groupBy({
            by: ['referred_driver_id'],
            where: { referrer_driver_id: driverId },
            _sum: { amount: true },
        });
        const earningsMap = new Map(earnings.map((e) => [e.referred_driver_id, Number(e._sum.amount ?? 0)]));

        const nf = this.nameField(language);

        return {
            success: true,
            data: referrals.map((d) => ({
                id: d.id,
                name: d.user[nf],
                phone: d.user.phone,
                photo: d.user.profile_photo,
                status: d.status,
                rating: d.rating ? Number(d.rating) : 0,
                joined_at: d.created_at,
                completed_orders: d.orders.length,
                total_earned_from: earningsMap.get(d.id) ?? 0,
            })),
        };
    }

    async getMyEarnings(driverId: string, page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);

        const [totalItems, items, totalSum] = await Promise.all([
            this.prisma.referralEarning.count({ where: { referrer_driver_id: driverId } }),
            this.prisma.referralEarning.findMany({
                where: { referrer_driver_id: driverId },
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
                orderBy: { created_at: 'desc' },
                include: {
                    referred: {
                        include: { user: { select: { name_uz: true, name_ru: true, name_en: true } } },
                    },
                    order: { select: { id: true, order_number: true, price: true } },
                },
            }),
            this.prisma.referralEarning.aggregate({
                where: { referrer_driver_id: driverId },
                _sum: { amount: true },
            }),
        ]);

        return {
            success: true,
            data: {
                total_earned: Number(totalSum._sum.amount ?? 0),
                earnings: items.map((e) => ({
                    id: e.id,
                    amount: Number(e.amount),
                    percent_applied: Number(e.percent_applied),
                    referred_driver_name:
                        e.referred.user.name_uz ?? e.referred.user.name_ru ?? e.referred.user.name_en,
                    order_id: e.order.id,
                    order_number: e.order.order_number,
                    order_price: Number(e.order.price),
                    created_at: e.created_at,
                })),
                pagination: {
                    totalItems,
                    totalPages: Math.ceil(totalItems / safeLimit),
                    currentPage: safePage,
                    itemsPerPage: safeLimit,
                },
            },
        };
    }

    async getAdminStats(page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);

        const referrers = await this.prisma.driver.findMany({
            where: { referrals: { some: {} } },
            include: {
                user: { select: { name_uz: true, name_ru: true, name_en: true, phone: true } },
                referrals: {
                    include: {
                        user: { select: { name_uz: true, name_ru: true, name_en: true, phone: true } },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const earningsSums = await this.prisma.referralEarning.groupBy({
            by: ['referrer_driver_id'],
            _sum: { amount: true },
            _count: { _all: true },
        });
        const sumMap = new Map(
            earningsSums.map((e) => [e.referrer_driver_id, { total: Number(e._sum.amount ?? 0), count: e._count._all }]),
        );

        const totalItems = referrers.length;
        const totalPages = Math.ceil(totalItems / safeLimit);
        const offset = (safePage - 1) * safeLimit;
        const pageItems = referrers.slice(offset, offset + safeLimit);

        return {
            success: true,
            data: {
                referrers: pageItems.map((r) => ({
                    id: r.id,
                    name: r.user.name_uz ?? r.user.name_ru ?? r.user.name_en,
                    phone: r.user.phone,
                    referred_count: r.referrals.length,
                    total_paid: sumMap.get(r.id)?.total ?? 0,
                    total_earning_events: sumMap.get(r.id)?.count ?? 0,
                    referrals: r.referrals.map((rd) => ({
                        id: rd.id,
                        name: rd.user.name_uz ?? rd.user.name_ru ?? rd.user.name_en,
                        phone: rd.user.phone,
                        rating: rd.rating ? Number(rd.rating) : 0,
                        joined_at: rd.created_at,
                    })),
                })),
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: safePage,
                    itemsPerPage: safeLimit,
                },
            },
        };
    }
}
