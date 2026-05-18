import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { CreateReviewDto } from './dto/create.review';
import { FlagReviewDto } from './dto/flag.review';
import { UpdateReviewDto } from './dto/update.review';

@Injectable()
export class ReviewService {
    constructor(private readonly prisma: DatabaseService) {}

    private nameField(lang: Language): 'name_uz' | 'name_ru' | 'name_en' {
        return lang === Language.ru ? 'name_ru' : lang === Language.en ? 'name_en' : 'name_uz';
    }

    private commentField(lang: Language): 'comment_uz' | 'comment_ru' | 'comment_en' {
        return lang === Language.ru
            ? 'comment_ru'
            : lang === Language.en
              ? 'comment_en'
              : 'comment_uz';
    }

    private async recalcDriverRating(userId: string): Promise<void> {
        const driver = await this.prisma.driver.findUnique({ where: { id: userId } });
        if (!driver) return;
        const avg = await this.prisma.review.aggregate({
            _avg: { rating: true },
            where: { to_user_id: userId },
        });
        await this.prisma.driver.update({
            where: { id: userId },
            data: { rating: avg._avg.rating ?? 0 },
        });
    }

    async createReview(dto: CreateReviewDto, requestUserId: string) {
        const order = await this.prisma.order.findUnique({ where: { id: dto.order_id } });
        if (!order) throw new NotFoundException('Order topilmadi');

        if (order.status !== 'completed')
            throw new ForbiddenException('Faqat yakunlangan buyurtmalarga baho qoldirish mumkin');

        if (dto.from_user_id !== requestUserId)
            throw new ForbiddenException(
                "Siz faqat o'zingiz nomidan baho qoldirishingiz mumkin",
            );

        const toUser = await this.prisma.user.findUnique({ where: { id: dto.to_user_id } });
        if (!toUser) throw new NotFoundException('Baholanuvchi foydalanuvchi topilmadi');

        const lang = dto.language ?? Language.uz;
        const commentData = { [this.commentField(lang)]: dto.comment ?? null };

        const review = await this.prisma.review.create({
            data: {
                order_id: dto.order_id,
                from_user_id: dto.from_user_id,
                to_user_id: dto.to_user_id,
                rating: dto.rating,
                ...commentData,
            },
            include: {
                from: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                to: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
            },
        });

        await this.recalcDriverRating(dto.to_user_id);

        return { success: true, message: 'Baho muvaffaqiyatli qoldirildi', data: review };
    }

    async updateReview(id: string, dto: UpdateReviewDto, requestUserId: string, isAdmin = false) {
        const review = await this.prisma.review.findUnique({ where: { id } });
        if (!review) throw new NotFoundException('Baho topilmadi');

        if (!isAdmin && review.from_user_id !== requestUserId)
            throw new ForbiddenException("Siz faqat o'z bahongizni tahrirlashingiz mumkin");

        const lang = dto.language ?? Language.uz;
        const updateData: Record<string, unknown> = {};

        if (dto.rating !== undefined) updateData.rating = dto.rating;

        if (dto.comment !== undefined) {
            updateData.comment_uz = null;
            updateData.comment_ru = null;
            updateData.comment_en = null;
            updateData[this.commentField(lang)] = dto.comment;
        }

        const updated = await this.prisma.review.update({
            where: { id },
            data: updateData,
            include: {
                from: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                to: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
            },
        });

        if (dto.rating !== undefined) {
            await this.recalcDriverRating(review.to_user_id);
        }

        return { success: true, message: 'Baho yangilandi', data: updated };
    }

    async flagReview(id: string, dto: FlagReviewDto) {
        const review = await this.prisma.review.findUnique({ where: { id } });
        if (!review) throw new NotFoundException('Baho topilmadi');

        const updated = await this.prisma.review.update({
            where: { id },
            data: {
                is_flagged: dto.is_flagged,
                flag_reason: dto.is_flagged ? (dto.flag_reason ?? null) : null,
            },
        });

        const msg = dto.is_flagged ? 'Baho belgilandi (flagged)' : 'Bayroq olib tashlandi';
        return {
            success: true,
            message: msg,
            data: { id: updated.id, is_flagged: updated.is_flagged, flag_reason: updated.flag_reason },
        };
    }

    async getAllReviews(
        page: number = 1,
        limit: number = 10,
        language: Language = Language.uz,
        order_id?: string,
        from_user_id?: string,
        to_user_id?: string,
        rating?: number,
        is_flagged?: boolean,
    ) {
        const where: Record<string, unknown> = {};
        if (order_id) where.order_id = order_id;
        if (from_user_id) where.from_user_id = from_user_id;
        if (to_user_id) where.to_user_id = to_user_id;
        if (rating) where.rating = rating;
        if (is_flagged !== undefined) where.is_flagged = is_flagged;

        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);

        const [totalItems, reviews] = await Promise.all([
            this.prisma.review.count({ where }),
            this.prisma.review.findMany({
                where,
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
                orderBy: { created_at: 'desc' },
                include: {
                    from: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                    to: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                    order: { select: { id: true, status: true, price: true } },
                },
            }),
        ]);

        const nf = this.nameField(language);
        const cf = this.commentField(language);

        return {
            success: true,
            data: reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r[cf] ?? null,
                is_flagged: r.is_flagged,
                flag_reason: r.flag_reason,
                created_at: r.created_at,
                updated_at: r.updated_at,
                order: r.order,
                from: { id: r.from.id, name: r.from[nf], photo: r.from.profile_photo },
                to: { id: r.to.id, name: r.to[nf], photo: r.to.profile_photo },
            })),
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / safeLimit),
                currentPage: safePage,
                itemsPerPage: safeLimit,
            },
        };
    }

    async getReviewById(id: string, language: Language = Language.uz) {
        const review = await this.prisma.review.findUnique({
            where: { id },
            include: {
                from: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                to: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                order: { select: { id: true, status: true, price: true, created_at: true } },
            },
        });
        if (!review) throw new NotFoundException('Baho topilmadi');

        const nf = this.nameField(language);
        const cf = this.commentField(language);

        return {
            success: true,
            data: {
                id: review.id,
                rating: review.rating,
                comment: review[cf] ?? null,
                is_flagged: review.is_flagged,
                flag_reason: review.flag_reason,
                created_at: review.created_at,
                updated_at: review.updated_at,
                order: review.order,
                from: { id: review.from.id, name: review.from[nf], photo: review.from.profile_photo },
                to: { id: review.to.id, name: review.to[nf], photo: review.to.profile_photo },
            },
        };
    }

    async getMyReviews(userId: string, language: Language = Language.uz) {
        const reviews = await this.prisma.review.findMany({
            where: { OR: [{ from_user_id: userId }, { to_user_id: userId }] },
            orderBy: { created_at: 'desc' },
            include: {
                from: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                to: { select: { id: true, name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
                order: { select: { id: true, status: true, price: true } },
            },
        });

        const nf = this.nameField(language);
        const cf = this.commentField(language);

        return {
            success: true,
            data: reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r[cf] ?? null,
                is_flagged: r.is_flagged,
                created_at: r.created_at,
                updated_at: r.updated_at,
                direction: r.from_user_id === userId ? 'sent' : 'received',
                order: r.order,
                from: { id: r.from.id, name: r.from[nf], photo: r.from.profile_photo },
                to: { id: r.to.id, name: r.to[nf], photo: r.to.profile_photo },
            })),
        };
    }

    async deleteReview(id: string) {
        const review = await this.prisma.review.findUnique({ where: { id } });
        if (!review) throw new NotFoundException('Baho topilmadi');

        await this.prisma.review.delete({ where: { id } });
        await this.recalcDriverRating(review.to_user_id);

        return { success: true, message: "Baho o'chirildi" };
    }
}
