import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreatePaymentDto } from './dto/create.payment.dto';
import { Language } from 'src/utils/helper';

@Injectable()
export class PaymentService {
    constructor(private prisma: DatabaseService) { }
    async createPayment(data: CreatePaymentDto) {
        const existsOrder = await this.prisma.order.findUnique({
            where: { id: data.order_id }
        })
        if (!existsOrder) throw new NotFoundException('this order not found')
        const existsOrderByPay = await this.prisma.payment.findUnique({
            where: { order_id: data.order_id }
        })
        if (existsOrderByPay) throw new ConflictException('this payment already exists')

        const createPayment = await this.prisma.payment.create({
            data: {
                amount: data.amount,
                method: data.method,
                order_id: data.order_id,
                status: data.status,
            },
            include: {
                order: {
                    include: {
                        driver: {
                            include: {
                                taxiCategory: true
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                name_en: true,
                                name_ru: true,
                                name_uz: true,
                                email: true,
                                role: true,
                                profile_photo: true,
                                phone: true,
                            }
                        },
                        userLocations: true
                    }
                }
            }
        })
        return {
            data: createPayment
        }

    }
    async getAllPayment() {
        const data = await this.prisma.payment.findMany({
            include: {
                order: {
                    include: {
                        driver: {
                            include: {
                                taxiCategory: true
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                name_en: true,
                                name_ru: true,
                                name_uz: true,
                                email: true,
                                role: true,
                                profile_photo: true,
                                phone: true,
                            }
                        },
                        userLocations: true
                    }
                }
            }
        })
        return data
    }
    async getPaymentbyOrderId(order_id: string) {
        const existsOrder = await this.prisma.order.findUnique({
            where: { id: order_id }
        })
        if (!existsOrder) throw new NotFoundException('order not found')
        const data = await this.prisma.payment.findMany({
            where: { order_id: order_id },
            include: {
                order: {
                    include: {
                        driver: {
                            include: {
                                taxiCategory: true
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                name_en: true,
                                name_ru: true,
                                name_uz: true,
                                email: true,
                                role: true,
                                profile_photo: true,
                                phone: true,
                            }
                        },
                        userLocations: true
                    }
                }
            }
        })
        return data

    }

    async getAllMyPayments(user_id: string, language?: Language) {
        // Foydalanuvchi mavjudligini tekshirish
        const existsUser = await this.prisma.user.findUnique({
            where: { id: user_id },
        });
        if (!existsUser) throw new NotFoundException('User not found');

        // Foydalanuvchining barcha to'lovlari
        const payments = await this.prisma.payment.findMany({
            where: { order: { OR: [{ user_id },{driver_id:user_id}]} },
            include: {
                order: {
                    include: {
                        taxiCategory: true,
                    },
                },
            },
            orderBy: { paid_at: 'desc' },
        });

        const mappedPayments = payments.map(payment => {
            const cat = payment.order.taxiCategory;
            const taxiCategoryName = cat
                ? (language === 'ru' ? cat.name_ru : language === 'en' ? cat.name_en : cat.name_uz)
                : null;

            return {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                status: payment.status,
                paid_at: payment.paid_at,
                order_id: payment.order_id,
                taxiCategoryName,
                taxiCategoryName_uz: cat?.name_uz ?? null,
                taxiCategoryName_ru: cat?.name_ru ?? null,
                taxiCategoryName_en: cat?.name_en ?? null,
            };
        });

        return {
            success: true,
            message: 'Payments retrieved successfully',
            data: mappedPayments,
        };
    }
    async getMyPaymentById(user_id: string, payment_id: string, language?: Language) {
        // Foydalanuvchi mavjudligini tekshirish
        const existsUser = await this.prisma.user.findUnique({
            where: { id: user_id },
        });
        if (!existsUser) throw new NotFoundException('User not found');

        // Paymentni olish (user yoki driver bo‘lishi mumkin)
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: payment_id,
                order: { OR: [{ user_id }, { driver_id: user_id }] },
            },
            include: {
                order: {
                    include: { taxiCategory: true },
                },
            },
        });

        if (!payment) throw new NotFoundException('Payment not found');

        const cat = payment.order.taxiCategory;
        const taxiCategoryName = cat
            ? (language === 'ru' ? cat.name_ru : language === 'en' ? cat.name_en : cat.name_uz)
            : null;

        return {
            success: true,
            message: 'Payment retrieved successfully',
            data: {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                status: payment.status,
                paid_at: payment.paid_at,
                order_id: payment.order_id,
                taxiCategoryName,
                taxiCategoryName_uz: cat?.name_uz ?? null,
                taxiCategoryName_ru: cat?.name_ru ?? null,
                taxiCategoryName_en: cat?.name_en ?? null,
            },
        };
    }

    async updatePayment(id: string, data: Partial<CreatePaymentDto>) {
        const existsPayment = await this.prisma.payment.findUnique({
            where: { id },
        });

        if (!existsPayment) {
            throw new NotFoundException('this payment not found');
        }

        if (data.order_id) {
            const existsOrder = await this.prisma.order.findUnique({
                where: { id: data.order_id },
            });
            if (!existsOrder) throw new NotFoundException('order not found');
        }

        const updateData: Record<string, any> = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined),
        );

        if (updateData.status === 'paid' && !updateData.paid_at) {
            updateData.paid_at = new Date();
        }

        const updated = await this.prisma.payment.update({
            where: { id },
            data: { ...updateData, updated_at: new Date() },
        });

        return {
            message: 'Payment updated successfully',
            payment: updated,
        };
    }
    async deletePayment(id: string) {
        const existsPayement = await this.prisma.payment.findUnique({ where: { id: id } })
        if (!existsPayement) throw new NotFoundException('this payment not found')

        await this.prisma.payment.delete({ where: { id: id } })
        return {
            success: 'successfully deleted'
        }
    }
    async updateActive(id: string) {
        const existsPayment = await this.prisma.payment.findUnique({ where: { id: id } })
        if (!existsPayment) throw new NotFoundException('this payment not found')

        await this.prisma.payment.update({
            where: { id },
            data: {
                active: false,
                updated_at: new Date()
            }
        })
        return {
            message: 'successfully updated'
        }
    }

    async getAdminPayments(params: {
        driver_id?: string;
        period?: string;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    }) {
        const { driver_id, period, from, to, page = 1, limit = 20 } = params;

        const where: any = { status: 'success' };

        if (driver_id) {
            where.order = { driver_id };
        }

        const now = new Date();
        if (period === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(start.getTime() + 86400000);
            where.paid_at = { gte: start, lt: end };
        } else if (period === 'tomorrow') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const end = new Date(start.getTime() + 86400000);
            where.paid_at = { gte: start, lt: end };
        } else if (period === 'weekly') {
            const start = new Date(now.getTime() - 7 * 86400000);
            where.paid_at = { gte: start };
        } else if (period === 'range' && from) {
            const start = new Date(from);
            const end = to ? new Date(new Date(to).getTime() + 86400000) : now;
            where.paid_at = { gte: start, lt: end };
        }

        const skip = (page - 1) * limit;

        const [total, payments, stats] = await Promise.all([
            this.prisma.payment.count({ where }),
            this.prisma.payment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { paid_at: 'desc' },
                include: {
                    order: {
                        include: {
                            driver: {
                                include: {
                                    user: { select: { name_uz: true, name_ru: true, phone: true } },
                                    taxiCategory: { select: { name_uz: true } },
                                },
                            },
                            user: { select: { name_uz: true, name_ru: true, phone: true } },
                        },
                    },
                },
            }),
            this.prisma.payment.aggregate({
                where,
                _sum: { amount: true, commission_amount: true, net_amount: true },
                _count: { id: true },
            }),
        ]);

        return {
            success: true,
            data: payments.map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                commission_amount: Number(p.commission_amount ?? 0),
                net_amount: Number(p.net_amount ?? 0),
                method: p.method,
                status: p.status,
                paid_at: p.paid_at,
                created_at: p.created_at,
                order_id: p.order_id,
                order_status: p.order.status,
                order_price: Number(p.order.price),
                driver_name: p.order.driver?.user?.name_uz ?? null,
                driver_phone: p.order.driver?.user?.phone ?? null,
                category: p.order.driver?.taxiCategory?.name_uz ?? null,
                user_name: p.order.user?.name_uz ?? null,
                user_phone: p.order.user?.phone ?? null,
            })),
            stats: {
                total_orders_sum: Number(stats._sum.amount ?? 0),
                total_commission: Number(stats._sum.commission_amount ?? 0),
                total_net: Number(stats._sum.net_amount ?? 0),
                orders_count: stats._count.id,
            },
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getAdminPaymentById(id: string) {
        const p = await this.prisma.payment.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        driver: {
                            include: {
                                user: { select: { name_uz: true, name_ru: true, phone: true } },
                                taxiCategory: { select: { name_uz: true } },
                            },
                        },
                        user: { select: { name_uz: true, name_ru: true, phone: true } },
                    },
                },
            },
        });
        if (!p) throw new NotFoundException('Payment not found');

        return {
            success: true,
            data: {
                id: p.id,
                amount: Number(p.amount),
                commission_amount: Number(p.commission_amount ?? 0),
                net_amount: Number(p.net_amount ?? 0),
                commission_rate: 5,
                method: p.method,
                status: p.status,
                paid_at: p.paid_at,
                created_at: p.created_at,
                order_id: p.order_id,
                order_status: p.order.status,
                order_price: Number(p.order.price),
                order_distance: Number(p.order.distance_km ?? 0),
                driver_name: p.order.driver?.user?.name_uz ?? null,
                driver_phone: p.order.driver?.user?.phone ?? null,
                category: p.order.driver?.taxiCategory?.name_uz ?? null,
                user_name: p.order.user?.name_uz ?? null,
                user_phone: p.order.user?.phone ?? null,
            },
        };
    }
}
