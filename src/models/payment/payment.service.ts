import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreatePaymentDto } from './dto/create.payment.dto';

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
