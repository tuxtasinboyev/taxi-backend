import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { ReferralService } from '../../referral/referral.service';
import { CreateDriverDto } from './dto/create.driver.dto';

@Injectable()
export class DriverService {
    constructor(
        private prisma: DatabaseService,
        private config: ConfigService,
        private referralService: ReferralService,
    ) { }
    async createDriver(data: CreateDriverDto, photoUrl?: string) {
        // Bo'sh string ni undefined ga aylantirish
        if (!data.taxi_category_id) data.taxi_category_id = undefined;
        if (!data.email) data.email = undefined;

        const existsEmail = data.email
            ? await this.prisma.user.findUnique({ where: { email: data.email } })
            : null;

        const existsPhone = await this.prisma.user.findUnique({
            where: { phone: data.phone },
        });

        if (existsEmail || existsPhone) {
            throw new ConflictException('this driver already exists');
        }
        if (data.taxi_category_id) {
            const existsCategory = await this.prisma.taxiCategory.findUnique({
                where: { id: data.taxi_category_id },
            });
            if (!existsCategory) {
                throw new ConflictException('this category not found');
            }
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        let photo
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl);
        }

        let nameField: string;
        let carModelField: string;
        let carColorField: string;

        switch (data.language) {
            case Language.uz:
                nameField = 'name_uz';
                carModelField = 'car_model_uz';
                carColorField = 'car_color_uz';
                break;
            case Language.ru:
                nameField = 'name_ru';
                carModelField = 'car_model_ru';
                carColorField = 'car_color_ru';
                break;
            case Language.en:
                nameField = 'name_en';
                carModelField = 'car_model_en';
                carColorField = 'car_color_en';
                break;
            default:
                throw new ConflictException('Invalid language');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    [nameField]: data.name,
                    phone: data.phone,
                    email: data.email,
                    role: UserRole.driver,
                    profile_photo: photo,
                    password_hash: passwordHash,
                },
            });

            const driver = await tx.driver.create({
                data: {
                    id: user.id,
                    [carModelField]: data.car_model,
                    [carColorField]: data.car_color,
                    car_number: data.car_number,
                    status: 'offline',
                    ...(data.taxi_category_id ? { taxiCategoryId: data.taxi_category_id } : {}),
                },
            });

            return { user, driver };
        });

        if (data.referral_code) {
            const referrerId = await this.referralService.validateReferralCode(data.referral_code);
            if (referrerId) {
                await this.referralService.linkReferral(result.user.id, referrerId);
            }
        }

        const { password_hash, ...safeUser } = result.user;

        return {
            success: true,
            message: 'Driver successfully created',
            data: {
                user: safeUser,
                driver: result.driver,
            },
        };
    }
    async getAllDriver({
        page,
        limit,
        search,
        language,
    }: {
        page?: string;
        limit?: string;
        search?: string;
        curdNumber?: number;
        language?: Language;
    } = {}) {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const limitNumber = limit ? parseInt(limit, 10) : 10;
        const offset = (pageNumber - 1) * limitNumber;

        const whereClause: Prisma.UserWhereInput = {
            role: UserRole.driver,
            ...(search
                ? {
                    OR: [
                        { name_uz: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { name_ru: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { name_en: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        {
                            driver: {
                                car_number: { contains: search, mode: Prisma.QueryMode.insensitive },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [totalCount, drivers] = await this.prisma.$transaction([
            this.prisma.user.count({ where: whereClause }),
            this.prisma.user.findMany({
                where: whereClause,
                include: {
                    driver: true,
                },
                skip: offset,
                take: limitNumber,
                orderBy: { created_at: 'desc' },
            }),
        ]);

        const totalPages = Math.ceil(totalCount / limitNumber);

        const safeDrivers = drivers.map(({ password_hash, ...user }) => user);
        return {    
            success: true,
            message: 'Drivers retrieved successfully',
            data: {
                drivers: safeDrivers,
                pagination: {
                    totalItems: totalCount,
                    totalPages,
                    currentPage: pageNumber,
                    itemsPerPage: limitNumber,
                },
            },
        };
    }


    async getDriverById(id: string) {
        const driver = await this.prisma.user.findUnique({
            where: { id, role: UserRole.driver },
            include: { driver: true },
        });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        const { password_hash, ...safeUser } = driver;

        return {
            success: true,
            message: 'Driver retrieved successfully',
            data: safeUser,
        };
    }
    async getMe(id: string) {
        const driver = await this.prisma.user.findUnique({
            where: { id, role: UserRole.driver },
            include: { driver: true },
        });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        const { password_hash, ...safeUser } = driver;

        return {
            success: true,
            message: 'Driver retrieved successfully',
            data: safeUser,
        };
    }
    async updatateDriver(
        id: string,
        data: Partial<CreateDriverDto>,
        photoUrl?: string
    ) {
        if (!data.taxi_category_id) data.taxi_category_id = undefined;
        if (!data.email) data.email = undefined;

        const driver = await this.prisma.user.findUnique({
            where: { id, role: UserRole.driver },
        });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        if (data.taxi_category_id) {
            const existsCategory = await this.prisma.taxiCategory.findUnique({
                where: { id: data.taxi_category_id },
            });
            if (!existsCategory) {
                throw new ConflictException('This category not found');
            }
        }

        if (data.email && data.email !== driver.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (emailExists) throw new ConflictException('Email already in use');
        }

        if (data.phone && data.phone !== driver.phone) {
            const phoneExists = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (phoneExists) throw new ConflictException('Phone number already in use');
        }

        const passwordHash = data.password
            ? await bcrypt.hash(data.password, 10)
            : undefined;

        const photo = photoUrl ? urlGenerator(this.config, photoUrl) : undefined;

        let nameField: string | undefined;
        let carModelField: string | undefined;
        let carColorField: string | undefined;

        if (data.language) {
            switch (data.language) {
                case Language.uz:
                    nameField = 'name_uz';
                    carModelField = 'car_model_uz';
                    carColorField = 'car_color_uz';
                    break;
                case Language.ru:
                    nameField = 'name_ru';
                    carModelField = 'car_model_ru';
                    carColorField = 'car_color_ru';
                    break;
                case Language.en:
                    nameField = 'name_en';
                    carModelField = 'car_model_en';
                    carColorField = 'car_color_en';
                    break;
                default:
                    throw new ConflictException('Invalid language');
            }
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...(nameField && data.name ? { [nameField]: data.name } : {}),
                    ...(data.phone ? { phone: data.phone } : {}),
                    ...(data.email ? { email: data.email } : {}),
                    ...(photo ? { profile_photo: photo } : {}),
                    ...(passwordHash ? { password_hash: passwordHash } : {}),
                },
            });

            const updatedDriver = await tx.driver.update({
                where: { id },
                data: {
                    ...(carModelField && data.car_model
                        ? { [carModelField]: data.car_model }
                        : {}),
                    ...(carColorField && data.car_color
                        ? { [carColorField]: data.car_color }
                        : {}),
                    ...(data.car_number ? { car_number: data.car_number } : {}),
                    ...(data.taxi_category_id
                        ? { taxiCategoryId: data.taxi_category_id }
                        : {}),
                },
            });

            return { updatedUser, updatedDriver };
        });

        const { password_hash, ...safeUser } = result.updatedUser;

        return {
            success: true,
            message: 'Driver successfully updated',
            data: {
                user: safeUser,
                driver: result.updatedDriver,
            },
        };
    }

    async updateMe(id: string, data: Partial<CreateDriverDto>, photoUrl?: string) {
        const driver = await this.prisma.user.findUnique({ where: { id, role: UserRole.driver } });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }
        const existsCategory = data.taxi_category_id ? await this.prisma.taxiCategory.findUnique({
            where: { id: data.taxi_category_id },
        }) : null;
        if (data.taxi_category_id && !existsCategory) {
            throw new ConflictException('this category not found');
        }

        if (data.email && data.email !== driver.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (emailExists) {
                throw new ConflictException('Email already in use');
            }
        }

        if (data.phone && data.phone !== driver.phone) {
            const phoneExists = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (phoneExists) {
                throw new ConflictException('Phone number already in use');
            }
        }

        let passwordHash: string | undefined;
        if (data.password) {
            passwordHash = await bcrypt.hash(data.password, 10);
        }
        let photo
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl);
        }

        let nameField: string | undefined;
        let carModelField: string | undefined;
        let carColorField: string | undefined;

        if (data.language) {
            switch (data.language) {
                case Language.uz:
                    nameField = 'name_uz';
                    carModelField = 'car_model_uz';
                    carColorField = 'car_color_uz';
                    break;
                case Language.ru:
                    nameField = 'name_ru';
                    carModelField = 'car_model_ru';
                    carColorField = 'car_color_ru';
                    break;
                case Language.en:
                    nameField = 'name_en';
                    carModelField = 'car_model_en';
                    carColorField = 'car_color_en';
                    break;
                default:
                    throw new ConflictException('Invalid language');
            }
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...(nameField && data.name ? { [nameField]: data.name } : {}),
                    phone: data.phone,
                    email: data.email,
                    profile_photo: photo,
                    ...(passwordHash ? { password_hash: passwordHash } : {}),
                },
            });
            const updatedDriver = await tx.driver.update({
                where: { id },
                data: {
                    ...(carModelField && data.car_model ? { [carModelField]: data.car_model } : {}),
                    ...(carColorField && data.car_color ? { [carColorField]: data.car_color } : {}),
                    car_number: data.car_number,
                    taxiCategoryId: data.taxi_category_id,
                },
            });

            return { updatedUser, updatedDriver };
        });

        const { password_hash, ...safeUser } = result.updatedUser;

        return {
            success: true,
            message: 'Driver successfully updated',
            data: {
                user: safeUser,
                driver: result.updatedDriver,
            },
        };
    }
    async updateStatus(driverId: string, status: 'online' | 'offline' | 'busy') {
        const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
        if (!driver) {
            return { success: false, message: 'Driver not found' };
        }

        const updated = await this.prisma.driver.update({
            where: { id: driverId },
            data: { status, last_seen_at: new Date() },
        });

        return {
            success: true,
            message: 'Status yangilandi',
            data: { id: updated.id, status: updated.status },
        };
    }

    async deleteDriver(id: string) {
        const driver = await this.prisma.user.findUnique({ where: { id, role: UserRole.driver } });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.driver.delete({ where: { id } });
            await tx.user.delete({ where: { id } });
        });

        return {
            success: true,
            message: 'Driver successfully deleted',
        };
    }

    async getDriverRanking({
        page,
        limit,
        language,
    }: { page?: string; limit?: string; language?: Language } = {}) {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const limitNumber = limit ? parseInt(limit, 10) : 10;

        const [allDrivers, reviewCounts] = await Promise.all([
            this.prisma.driver.findMany({
                include: {
                    user: {
                        select: { name_uz: true, name_ru: true, name_en: true, profile_photo: true, phone: true },
                    },
                },
            }),
            this.prisma.review.groupBy({ by: ['to_user_id'], _count: { _all: true } }),
        ]);

        const countMap = new Map(reviewCounts.map((r) => [r.to_user_id, r._count._all]));

        allDrivers.sort((a, b) => {
            const ar = a.rating ? Number(a.rating) : -1;
            const br = b.rating ? Number(b.rating) : -1;
            return br - ar;
        });

        const nameField =
            language === Language.ru ? 'name_ru' : language === Language.en ? 'name_en' : 'name_uz';

        const ranked = allDrivers.map((d, index) => ({
            rank: index + 1,
            id: d.id,
            name: d.user[nameField],
            phone: d.user.phone,
            photo: d.user.profile_photo,
            car_number: d.car_number,
            status: d.status,
            rating: d.rating ? Number(d.rating) : 0,
            review_count: countMap.get(d.id) ?? 0,
        }));

        const totalItems = ranked.length;
        const totalPages = Math.ceil(totalItems / limitNumber);
        const offset = (pageNumber - 1) * limitNumber;
        const pageItems = ranked.slice(offset, offset + limitNumber);

        return {
            success: true,
            message: 'Driver ranking retrieved successfully',
            data: {
                drivers: pageItems,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: pageNumber,
                    itemsPerPage: limitNumber,
                },
            },
        };
    }

    async getMyRanking(driverId: string, around: number = 3) {
        const allDrivers = await this.prisma.driver.findMany({
            include: {
                user: { select: { name_uz: true, name_ru: true, name_en: true, profile_photo: true } },
            },
        });

        allDrivers.sort((a, b) => {
            const ar = a.rating ? Number(a.rating) : -1;
            const br = b.rating ? Number(b.rating) : -1;
            return br - ar;
        });

        const myIndex = allDrivers.findIndex((d) => d.id === driverId);
        if (myIndex === -1) {
            return { success: false, message: 'Driver not found' };
        }

        const start = Math.max(0, myIndex - around);
        const end = Math.min(allDrivers.length, myIndex + around + 1);

        const neighbors = allDrivers.slice(start, end).map((d, i) => ({
            rank: start + i + 1,
            id: d.id,
            name: d.user.name_uz ?? d.user.name_ru ?? d.user.name_en,
            photo: d.user.profile_photo,
            rating: d.rating ? Number(d.rating) : 0,
            is_me: d.id === driverId,
        }));

        return {
            success: true,
            message: 'Ranking retrieved successfully',
            data: {
                my_rank: myIndex + 1,
                total_drivers: allDrivers.length,
                my_rating: allDrivers[myIndex].rating ? Number(allDrivers[myIndex].rating) : 0,
                neighbors,
            },
        };
    }

    async getDriverEarnings(userId: string, period: 'today' | 'weekly' | 'monthly' | 'all' = 'today') {
        const driver = await this.prisma.driver.findFirst({ where: { id: userId } });
        if (!driver) {
            const byUser = await this.prisma.driver.findFirst({ where: { user: { id: userId } } });
            if (!byUser) throw new Error('Driver not found');
        }

        const now = new Date();
        let from: Date | undefined;
        if (period === 'today') {
            from = new Date(now); from.setHours(0, 0, 0, 0);
        } else if (period === 'weekly') {
            from = new Date(now); from.setDate(now.getDate() - 7);
        } else if (period === 'monthly') {
            from = new Date(now); from.setMonth(now.getMonth() - 1);
        }

        const payments = await this.prisma.payment.findMany({
            where: {
                order: { driver_id: userId },
                status: 'success',
                ...(from ? { paid_at: { gte: from } } : {}),
            },
            include: {
                order: { select: { created_at: true, price: true, distance_km: true } },
            },
            orderBy: { paid_at: 'desc' },
        });

        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalCommission = payments.reduce((sum, p) => sum + Number(p.commission_amount ?? 0), 0);
        const totalNet = payments.reduce((sum, p) => sum + Number(p.net_amount ?? 0), 0);

        return {
            period,
            total_earned: total,
            commission_paid: totalCommission,
            net_received: totalNet,
            order_count: payments.length,
            payments: payments.map(p => ({
                id: p.id,
                amount: Number(p.amount),
                commission_amount: Number(p.commission_amount ?? 0),
                net_amount: Number(p.net_amount ?? 0),
                method: p.method,
                paid_at: p.paid_at,
                order_price: p.order?.price,
                distance_km: p.order?.distance_km,
            })),
        };
    }
}
