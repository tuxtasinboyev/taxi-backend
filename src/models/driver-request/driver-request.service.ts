import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { SocketGateway } from 'src/models/socket/socket.gateway';
import { ReferralService } from 'src/models/referral/referral.service';
import { CreateDriverRequestDto, RejectDriverRequestDto } from './dto/driver-request.dto';

@Injectable()
export class DriverRequestService {
    constructor(
        private readonly prisma: DatabaseService,
        private readonly socketGateway: SocketGateway,
        private readonly referralService: ReferralService,
    ) {}

    async createRequest(userId: string, dto: CreateDriverRequestDto) {
        const existing = await this.prisma.driverRequest.findFirst({
            where: { user_id: userId, status: 'pending' },
        });
        if (existing) {
            throw new BadRequestException('Sizda allaqachon kutilayotgan so\'rov mavjud');
        }

        if (dto.referral_code) {
            const referrerId = await this.referralService.validateReferralCode(dto.referral_code);
            if (!referrerId) {
                throw new BadRequestException("Referal kodi noto'g'ri");
            }
        }

        const request = await this.prisma.driverRequest.create({
            data: {
                user_id: userId,
                full_name: dto.full_name,
                phone: dto.phone,
                car_model: dto.car_model,
                car_number: dto.car_number,
                license_number: dto.license_number,
                referral_code: dto.referral_code,
            },
            include: {
                user: {
                    select: { id: true, name_uz: true, name_ru: true, name_en: true, phone: true, profile_photo: true },
                },
            },
        });

        this.socketGateway.emitToAdminOrders('admin:driver_request', {
            type: 'new_driver_request',
            request,
        });

        return { success: true, message: 'So\'rovingiz yuborildi', data: request };
    }

    async getAllRequests(page = 1, limit = 20, status?: string) {
        const where: any = {};
        if (status) where.status = status;

        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);

        const [total, items] = await Promise.all([
            this.prisma.driverRequest.count({ where }),
            this.prisma.driverRequest.findMany({
                where,
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: { id: true, name_uz: true, name_ru: true, name_en: true, phone: true, profile_photo: true },
                    },
                },
            }),
        ]);

        return {
            success: true,
            data: items,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / safeLimit),
                currentPage: safePage,
                itemsPerPage: safeLimit,
            },
        };
    }

    async getRequestById(id: string) {
        const req = await this.prisma.driverRequest.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name_uz: true, name_ru: true, name_en: true, phone: true, profile_photo: true },
                },
            },
        });
        if (!req) throw new NotFoundException('So\'rov topilmadi');
        return { success: true, data: req };
    }

    async acceptRequest(id: string) {
        const req = await this.prisma.driverRequest.findUnique({ where: { id } });
        if (!req) throw new NotFoundException('So\'rov topilmadi');
        if (req.status !== 'pending') throw new BadRequestException('Bu so\'rov allaqachon ko\'rib chiqilgan');

        // Check if already a driver
        const existingDriver = await this.prisma.driver.findUnique({ where: { id: req.user_id } });

        await this.prisma.$transaction(async (tx) => {
            await tx.driverRequest.update({
                where: { id },
                data: { status: 'accepted' },
            });

            await tx.user.update({
                where: { id: req.user_id },
                data: { role: 'driver' },
            });

            if (!existingDriver) {
                await tx.driver.create({
                    data: {
                        id: req.user_id,
                        car_model_uz: req.car_model,
                        car_model_ru: req.car_model,
                        car_model_en: req.car_model,
                        car_number: req.car_number,
                    },
                });
            }
        });

        if (!existingDriver && req.referral_code) {
            const referrerId = await this.referralService.validateReferralCode(req.referral_code);
            if (referrerId) {
                await this.referralService.linkReferral(req.user_id, referrerId);
            }
        }

        this.socketGateway.emitToUser(req.user_id, 'driver_request:accepted', {
            message: 'Tabriklaymiz! Siz haydovchi sifatida qabul qilindingiz.',
        });

        return { success: true, message: 'Haydovchi muvaffaqiyatli qabul qilindi' };
    }

    async rejectRequest(id: string, dto: RejectDriverRequestDto) {
        const req = await this.prisma.driverRequest.findUnique({ where: { id } });
        if (!req) throw new NotFoundException('So\'rov topilmadi');
        if (req.status !== 'pending') throw new BadRequestException('Bu so\'rov allaqachon ko\'rib chiqilgan');

        await this.prisma.driverRequest.update({
            where: { id },
            data: { status: 'rejected', reject_reason: dto.reject_reason ?? null },
        });

        this.socketGateway.emitToUser(req.user_id, 'driver_request:rejected', {
            message: dto.reject_reason ?? 'So\'rovingiz rad etildi.',
        });

        return { success: true, message: 'So\'rov rad etildi' };
    }
}
