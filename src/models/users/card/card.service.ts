
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';

export class AddCardDto {
    provider: string;
    token: string;
    last4: string;
    brand: string;
    expiry_month: number;
    expiry_year: number;
    is_default?: boolean;
}

@Injectable()
export class CardService {
    constructor(private readonly prisma: DatabaseService) {}

    async addCard(userId: string, dto: AddCardDto) {
        const existing = await this.prisma.userCard.findFirst({
            where: { user_id: userId, token: dto.token },
        });
        if (existing) throw new ConflictException('Bu karta allaqachon qo\'shilgan');

        if (dto.is_default) {
            await this.prisma.userCard.updateMany({
                where: { user_id: userId },
                data: { is_default: false },
            });
        }

        const card = await this.prisma.userCard.create({
            data: {
                user_id: userId,
                provider: dto.provider,
                token: dto.token,
                last4: dto.last4,
                brand: dto.brand,
                expiry_month: dto.expiry_month,
                expiry_year: dto.expiry_year,
                is_default: dto.is_default ?? false,
            },
        });

        return { success: true, message: 'Karta muvaffaqiyatli qo\'shildi', data: card };
    }

    async getMyCards(userId: string) {
        const cards = await this.prisma.userCard.findMany({
            where: { user_id: userId },
            orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
        });

        return { success: true, data: cards };
    }

    async setDefault(userId: string, cardId: string) {
        const card = await this.prisma.userCard.findFirst({
            where: { id: cardId, user_id: userId },
        });
        if (!card) throw new NotFoundException('Karta topilmadi');

        await this.prisma.userCard.updateMany({
            where: { user_id: userId },
            data: { is_default: false },
        });

        const updated = await this.prisma.userCard.update({
            where: { id: cardId },
            data: { is_default: true },
        });

        return { success: true, message: 'Asosiy karta o\'rnatildi', data: updated };
    }

    async deleteCard(userId: string, cardId: string) {
        const card = await this.prisma.userCard.findFirst({
            where: { id: cardId, user_id: userId },
        });
        if (!card) throw new NotFoundException('Karta topilmadi');

        await this.prisma.userCard.delete({ where: { id: cardId } });

        return { success: true, message: 'Karta o\'chirildi' };
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    async getAllCards(page: number = 1, limit: number = 10, user_id?: string) {
        const where: Record<string, unknown> = {};
        if (user_id) where.user_id = user_id;

        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);

        const [totalItems, cards] = await Promise.all([
            this.prisma.userCard.count({ where }),
            this.prisma.userCard.findMany({
                where,
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name_uz: true,
                            name_ru: true,
                            name_en: true,
                            phone: true,
                        },
                    },
                },
            }),
        ]);

        return {
            success: true,
            data: cards,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / safeLimit),
                currentPage: safePage,
                itemsPerPage: safeLimit,
            },
        };
    }

    async adminDeleteCard(cardId: string) {
        const card = await this.prisma.userCard.findUnique({ where: { id: cardId } });
        if (!card) throw new NotFoundException('Karta topilmadi');

        await this.prisma.userCard.delete({ where: { id: cardId } });

        return { success: true, message: 'Karta o\'chirildi' };
    }
}
