import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { CreateUserForAdminDto } from './dto/user.dto';
@Injectable()
export class UsersService {
    constructor(private prisma: DatabaseService, private config: ConfigService) { }
    async createUser(data: CreateUserForAdminDto, photoUrl: string) {
        const existsEmail = await this.prisma.user.findUnique({
            where: { email: data.email }
        })
        const existsPhone = await this.prisma.user.findUnique({
            where: { phone: data.phone }
        })
        if (existsEmail || existsPhone) {
            throw new ConflictException('this user already exists')
        }
        const photo = urlGenerator(this.config, photoUrl)
        const passwordHash = await bcrypt.hash(data.password, 10)
        if (data.lang === Language.en) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_en: data.name,
                    role: data.role,
                    profile_photo: photo,
                    password_hash: passwordHash
                }
            })

            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser
            }
        }
        if (data.lang === Language.uz) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_uz: data.name,
                    role: data.role,
                    profile_photo: photo,
                    password_hash: passwordHash
                }
            })
            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser
            }
        }
        if (data.lang === Language.ru) {
            const createUser = await this.prisma.user.create({
                data: {
                    phone: data.phone,
                    email: data.email,
                    name_ru: data.name,
                    role: data.role,
                    profile_photo: photo,
                    password_hash: passwordHash

                }
            })
            const { password_hash, ...safeUser } = createUser
            return {
                user: safeUser
            }
        }
    }


    async getUserAll(query) {
        try {
            const {
                page = 1,
                limit = 10,
                search = '',
                role,
                sortBy = 'created_at',
                sortOrder = 'desc',
                includeDriver = 'false',
                includeWallet = 'false',
                includeStats = 'false',
                phone,
                email,
                startDate,
                endDate
            } = query;

            const includeDriverBool = includeDriver === 'true';
            const includeWalletBool = includeWallet === 'true';
            const includeStatsBool = includeStats === 'true';

            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1) {
                throw new Error('Page must be greater than 0');
            }
            if (limitNum < 1 || limitNum > 100) {
                throw new Error('Limit must be between 1 and 100');
            }

            const skip = (pageNum - 1) * limitNum;

            const where: any = {};

            if (role) {
                where.role = role;
            }

            if (phone) {
                where.phone = { contains: phone, mode: 'insensitive' };
            }

            if (email) {
                where.email = { contains: email, mode: 'insensitive' };
            }

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            if (search) {
                where.OR = [
                    { name_uz: { contains: search, mode: 'insensitive' } },
                    { name_ru: { contains: search, mode: 'insensitive' } },
                    { name_en: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ];
            }

            const include = {
                driver: includeDriverBool,
                wallet: includeWalletBool,
                ...(includeStatsBool && {
                    _count: {
                        select: {
                            orders: true,
                            reviewsFrom: true,
                            reviewsTo: true,
                            cards: true,
                            notifications: true
                        }
                    }
                })
            };

            const [users, totalUsers] = await Promise.all([
                this.prisma.user.findMany({
                    where,
                    include,
                    skip,
                    take: limitNum,
                    orderBy: { [sortBy]: sortOrder }
                }),
                this.prisma.user.count({ where })
            ]);

            let usersWithStats = users;
            if (includeStatsBool) {
                usersWithStats = await Promise.all(
                    users.map(async (user) => {
                        let driverRating: number | null = null;
                        let totalEarnings = 0;

                        if (user.role === 'driver' && user.driver) {
                            const ratingResult = await this.prisma.review.aggregate({
                                where: { to_user_id: user.id },
                                _avg: { rating: true }
                            });

                            const earningsResult = await this.prisma.order.aggregate({
                                where: {
                                    driver_id: user.id,
                                    status: 'completed'
                                },
                                _sum: { price: true }
                            });

                            driverRating = ratingResult._avg.rating;
                            totalEarnings = earningsResult._sum.price ? Number(earningsResult._sum.price) : 0;
                        }

                        let totalSpent = 0;
                        if (user.role === 'passenger') {
                            const spentResult = await this.prisma.order.aggregate({
                                where: {
                                    user_id: user.id,
                                    status: 'completed'
                                },
                                _sum: { price: true }
                            });
                            totalSpent = spentResult._sum.price ? Number(spentResult._sum.price) : 0;
                        }

                        return {
                            ...user,
                            driver_rating: driverRating,
                            total_earnings: totalEarnings,
                            total_spent: totalSpent,
                            wallet_balance: user.wallet ? Number(user.wallet.balance) : 0
                        };
                    })
                );
            }

            const totalPages = Math.ceil(totalUsers / limitNum);

            return {
                success: true,
                data: {
                    users: usersWithStats,
                    pagination: {
                        current_page: pageNum,
                        total_pages: totalPages,
                        total_users: totalUsers,
                        has_next: pageNum < totalPages,
                        has_prev: pageNum > 1,
                        per_page: limitNum
                    }
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in getUserAll:', error);
            return {
                success: false,
                error: error.message,
                data: null,
                timestamp: new Date().toISOString()
            };
        }
    }
    async Getme(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                driver: true,
                wallet: true,
                cards: {
                    where: { is_default: true },
                    take: 1
                },
                _count: {
                    select: {
                        orders: true,
                        reviewsFrom: true,
                        reviewsTo: true
                    }
                }
            }
        });

        if (!user) throw new NotFoundException('User not found');

        if (user.role === 'driver' && user.driver) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            if (user.driver.last_seen_at && user.driver.last_seen_at < fiveMinutesAgo && user.driver.status === 'online') {
                await this.prisma.driver.update({
                    where: { id: user.id },
                    data: { status: 'offline' },
                });
                user.driver.status = 'offline';
            }
        }

        let driverStats: object | null = null;
        if (user.role === 'driver' && user.driver) {
            const [ratingAgg, completedOrders, totalEarnings] = await Promise.all([
                this.prisma.review.aggregate({
                    where: { to_user_id: user.id },
                    _avg: { rating: true },
                    _count: { rating: true }
                }),
                this.prisma.order.count({
                    where: {
                        driver_id: user.id,
                        status: 'completed'
                    }
                }),
                this.prisma.order.aggregate({
                    where: {
                        driver_id: user.id,
                        status: 'completed'
                    },
                    _sum: { price: true }
                })
            ]);

            driverStats = {
                rating: ratingAgg._avg.rating || 0,
                total_reviews: ratingAgg._count.rating,
                completed_orders: completedOrders,
                total_earnings: totalEarnings._sum.price ? Number(totalEarnings._sum.price) : 0,
                car_model: user.driver.car_model_uz || user.driver.car_model_ru || user.driver.car_model_en,
                car_color: user.driver.car_color_uz || user.driver.car_color_ru || user.driver.car_color_en,
                car_number: user.driver.car_number,
                status: user.driver.status,
                last_seen_at: user.driver.last_seen_at,
            };
        }

        let passengerStats: object | null = null;
        if (user.role === 'passenger') {
            const [completedOrders, totalSpent, avgRating] = await Promise.all([
                this.prisma.order.count({
                    where: {
                        user_id: user.id,
                        status: 'completed'
                    }
                }),
                this.prisma.order.aggregate({
                    where: {
                        user_id: user.id,
                        status: 'completed'
                    },
                    _sum: { price: true }
                }),
                this.prisma.review.aggregate({
                    where: { from_user_id: user.id },
                    _avg: { rating: true }
                })
            ]);

            passengerStats = {
                completed_rides: completedOrders,
                total_spent: totalSpent._sum.price ? Number(totalSpent._sum.price) : 0,
                average_rating_given: avgRating._avg.rating || 0
            };
        }

        const response = {
            user: {
                id: user.id,
                name_uz: user.name_uz,
                name_ru: user.name_ru,
                name_en: user.name_en,
                phone: user.phone,
                email: user.email,
                profile_photo: user.profile_photo,
                role: user.role,
                created_at: user.created_at,
                updated_at: user.updated_at
            },
            wallet: user.wallet ? {
                balance: Number(user.wallet.balance),
                currency: 'UZS'
            } : null,
            default_card: user.cards.length > 0 ? {
                id: user.cards[0].id,
                brand: user.cards[0].brand,
                last4: user.cards[0].last4,
                expiry: `${user.cards[0].expiry_month}/${user.cards[0].expiry_year}`
            } : null,
            stats: {
                total_orders: user._count.orders,
                reviews_given: user._count.reviewsFrom,
                reviews_received: user._count.reviewsTo,
                ...(driverStats ? { driver: driverStats } : {}),
                ...(passengerStats ? { passenger: passengerStats } : {})
            }
        };

        return {
            success: true,
            message: 'User data retrieved successfully',
            data: response
        };
    }

    async updateMe(
        userId: string,
        data: Partial<CreateUserForAdminDto>,
        photoUrl?: string,
    ) {
        const existsUser = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existsUser) throw new NotFoundException('User not found');

        // 🔹 Email tekshirish (agar o‘zgargan bo‘lsa)
        if (data.email && data.email !== existsUser.email) {
            const existingUserByEmail = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (existingUserByEmail)
                throw new ConflictException('Email already in use');
        }

        // 🔹 Telefon tekshirish (agar o‘zgargan bo‘lsa)
        if (data.phone && data.phone !== existsUser.phone) {
            const existingUserByPhone = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (existingUserByPhone)
                throw new ConflictException('Phone number already in use');
        }

        // 🔹 Faqat berilgan maydonlarni olish
        const updateData: any = {};

        // 🔹 Tilga qarab ismni yangilash
        if (data.name) {
            if (data.lang === 'uz') updateData.name_uz = data.name;
            else if (data.lang === 'ru') updateData.name_ru = data.name;
            else if (data.lang === 'en') updateData.name_en = data.name;
            else {
                // Agar til berilmagan bo‘lsa, hammasiga yozamiz
                updateData.name_uz = data.name;
                updateData.name_ru = data.name;
                updateData.name_en = data.name;
            }
        }

        if (data.email) updateData.email = data.email;
        if (data.phone) updateData.phone = data.phone;

        if (photoUrl)
            updateData.profile_photo = urlGenerator(this.config, photoUrl);

        if (data.password)
            updateData.password_hash = await bcrypt.hash(data.password, 10);

        // 🔹 Yangilash
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: { wallet: true },
        });

        // 🔹 Foydalanuvchiga toza javob
        const response = {
            id: updatedUser.id,
            name_uz: updatedUser.name_uz,
            name_ru: updatedUser.name_ru,
            name_en: updatedUser.name_en,
            phone: updatedUser.phone,
            email: updatedUser.email,
            profile_photo: updatedUser.profile_photo,
            role: updatedUser.role,
            created_at: updatedUser.created_at,
            updated_at: updatedUser.updated_at,
            wallet: updatedUser.wallet
                ? { balance: Number(updatedUser.wallet.balance), currency: 'UZS' }
                : null,
        };

        return {
            success: true,
            message: 'Profile updated successfully',
            data: response,
        };
    }


    async deleteUser(userId: string) {
        const existsUser = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        })
        if (!existsUser) throw new NotFoundException('user not found')
        await this.prisma.user.delete({
            where: { id: userId }
        })
        return {
            success: true,
            message: 'user deleted successfully'
        }
    }
}