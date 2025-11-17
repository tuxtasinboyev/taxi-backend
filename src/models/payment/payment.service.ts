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
                                TaxiCategory: true
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
                        UserLocation: true
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
                                TaxiCategory: true
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
                        UserLocation: true
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
                                TaxiCategory: true
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
                        UserLocation: true
                    }
                }
            }
        })
        return data

    }

    async getAllMyPayments(user_id: string, language: Language) {
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
                        TaxiCategory: true, // agar kategoriyani ko'rsatmoqchi bo'lsak
                    },
                },
            },
            orderBy: { paid_at: 'desc' },
        });

        // Tilga qarab ma'lumotlarni map qilish
        const mappedPayments = payments.map(payment => {
            let taxiCategoryName: string | null = null;
            if (payment.order.TaxiCategory) {
                taxiCategoryName =
                    language === 'uz' ? payment.order.TaxiCategory.name_uz :
                        language === 'ru' ? payment.order.TaxiCategory.name_ru :
                            language === 'en' ? payment.order.TaxiCategory.name_en :
                                payment.order.TaxiCategory.name_uz;
            }

            return {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                status: payment.status,
                paid_at: payment.paid_at,
                order_id: payment.order_id,
                taxiCategoryName,
            };
        });

        return {
            success: true,
            message: 'Payments retrieved successfully',
            data: mappedPayments,
        };
    }
    async getMyPaymentById(user_id: string, payment_id: string, language: Language) {
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
                    include: { TaxiCategory: true },
                },
            },
        });

        if (!payment) throw new NotFoundException('Payment not found');

        // Tilga qarab TaxiCategory nomi
        let taxiCategoryName: string | null = null;
        if (payment.order.TaxiCategory) {
            taxiCategoryName =
                language === 'uz' ? payment.order.TaxiCategory.name_uz :
                    language === 'ru' ? payment.order.TaxiCategory.name_ru :
                        language === 'en' ? payment.order.TaxiCategory.name_en :
                            payment.order.TaxiCategory.name_uz;
        }

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


}
