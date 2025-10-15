import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { SocketGateway } from '../socket/socket.gateway';
import { RedisGeoService } from './locations/redis-geo.service';
import { Order, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger('OrdersService');

    constructor(
        private readonly prisma: DatabaseService,
        private readonly redisGeo: RedisGeoService,
        private readonly socketGateway: SocketGateway,
    ) { }

    // 🟢 1. Order yaratish
    async createOrder(dto: {
        user_id: string;
        start_lat: number;
        start_lng: number;
        end_lat: number;
        end_lng: number;
        taxiCategoryId?: string;
        promoCode?: string;
        payment_method?: 'cash' | 'card';
    }) {
        // 🧩 User mavjudligini tekshirish
        const user = await this.prisma.user.findUnique({ where: { id: dto.user_id } });
        if (!user) throw new NotFoundException('User not found');

        // 1️⃣ Eng yaqin haydovchilarni topish
        const nearbyDrivers = await this.redisGeo.getNearbyDrivers(dto.start_lat, dto.start_lng, 5);
        // if (!nearbyDrivers.length) throw new NotFoundException('No drivers available nearby');

        // 2️⃣ Narxni hisoblash (PricingRule)
        const rule = await this.prisma.pricingRule.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' },
        });
        if (!rule) throw new NotFoundException('No pricing rules found');

        const distanceKm = this.calcDistanceKm(dto.start_lat, dto.start_lng, dto.end_lat, dto.end_lng);
        const estimatedTime = distanceKm * 2; // 2 daqiqa / km
        const basePrice = Number(rule.base_fare);
        const price =
            basePrice +
            Number(rule.per_km) * distanceKm +
            Number(rule.per_min) * estimatedTime;
        let finalPrice = price * Number(rule.surge_multiplier);

        // 3️⃣ PromoCode tekshirish
        let promoApplied = false;
        if (dto.promoCode) {
            const promo = await this.prisma.promoCode.findFirst({
                where: {
                    code: dto.promoCode,
                    is_active: true,
                    valid_from: { lte: new Date() },
                    OR: [{ valid_to: null }, { valid_to: { gte: new Date() } }],
                },
            });
            if (promo) {
                finalPrice = finalPrice * (1 - promo.discount_percent / 100);
                promoApplied = true;
            }
        }

        // 4️⃣ Order yaratish
        const order = await this.prisma.order.create({
            data: {
                user_id: dto.user_id,
                start_lat: dto.start_lat,
                start_lng: dto.start_lng,
                end_lat: dto.end_lat,
                end_lng: dto.end_lng,
                price: finalPrice,
                distance_km: distanceKm,
                duration_min: estimatedTime,
                taxiCategoryId: dto.taxiCategoryId || null,
            },
        });

        // 5️⃣ Payment (simulyatsiya)
        await this.prisma.payment.create({
            data: {
                order_id: order.id,
                amount: finalPrice,
                method: dto.payment_method || 'cash',
                status: 'pending',
            },
        });

        // 6️⃣ Haydovchilarga real-time jo‘natish
        for (const driver of nearbyDrivers) {
            this.socketGateway.emitToDriver(driver.driverId, 'order:request', {
                order_id: order.id,
                distance_km: driver.distanceKm,
                price: finalPrice,
                promo_applied: promoApplied,
            });
        }

        return { order, drivers: nearbyDrivers, promoApplied };
    }

    // 🟡 2. Haydovchi zakasni qabul qiladi
    async acceptOrder(driverId: string, orderId: string) {
        const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
        if (!driver) throw new NotFoundException('Driver not found');

        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        if (order.status !== 'pending')
            throw new ConflictException('Order already accepted or processed');

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { driver_id: driverId, status: 'accepted' },
        });

        // 🔄 boshqa haydovchilarga cancel event
        this.socketGateway.broadcastExceptDriver(driverId, 'order:cancelled', { order_id: orderId });

        return updatedOrder;
    }

    // 🟢 3. Order yakunlash
    async completeOrder(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (!order.driver_id) throw new NotFoundException('Driver not found for this order');

        const passenger = await this.prisma.user.findUnique({ where: { id: order.user_id } });
        const driver = await this.prisma.user.findUnique({ where: { id: order.driver_id } });
        if (!passenger || !driver) throw new NotFoundException('Passenger or Driver not found');

        const paymentMethod = order.payment?.method || 'cash';
        const commissionDriver = Number(order.price) * 0.05; // 5%
        const commissionPassenger = Number(order.price) * 0.1; // 10%

        // 💳 Balansdan yechish (simulyatsiya)
        if (paymentMethod === 'cash') {
            await this.prisma.wallet.updateMany({
                where: { user_id: driver.id },
                data: { balance: { decrement: commissionDriver } },
            });
        } else {
            await this.prisma.wallet.updateMany({
                where: { user_id: passenger.id },
                data: { balance: { decrement: commissionPassenger } },
            });
        }

        // 🟢 Haydovchiga to‘lov (foizdan keyin)
        const driverEarn =
            paymentMethod === 'cash'
                ? Number(order.price) - commissionDriver
                : Number(order.price) - commissionPassenger;

        await this.prisma.wallet.updateMany({
            where: { user_id: driver.id },
            data: { balance: { increment: driverEarn } },
        });

        // 🔄 Orderni update
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'completed', finished_at: new Date() },
        });

        // 💰 Paymentni yangilash
        await this.prisma.payment.updateMany({
            where: { order_id: orderId },
            data: { status: 'success', paid_at: new Date() },
        });

        // 🔔 Socket orqali haydovchiga xabar
        this.socketGateway.emitToDriver(order.driver_id, 'order:completed', {
            order_id: order.id,
            amount: driverEarn,
        });

        this.logger.log(`✅ Order ${orderId} completed: driver ${order.driver_id} earned ${driverEarn}`);
        return updatedOrder;
    }

    // 🧮 Masofani hisoblash
    private calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // 🟢 4. Foydalanuvchining o‘z zakaslari
    async getMyOrders(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.order.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: { payment: true },
        });
    }

    // 🟡 5. Order statusini yangilash
    async updateOrderStatus(orderId: string, status: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        const validStatuses: OrderStatus[] = [
            'pending',
            'accepted',
            'on_the_way',
            'completed',
            'cancelled',
        ];
        if (!validStatuses.includes(status as OrderStatus)) {
            throw new BadRequestException(`Invalid status: ${status}`);
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: status as OrderStatus },
        });

        if (updated.driver_id) {
            this.socketGateway.emitToDriver(updated.driver_id, 'order:status-updated', {
                order_id: orderId,
                status,
            });
        }

        return updated;
    }
}
