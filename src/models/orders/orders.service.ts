import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import { SocketGateway } from '../socket/socket.gateway';
import { RedisGeoService } from './locations/redis-geo.service';
import { UpdateOrderDto } from './orders.controller';

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
        // 🧩 Foydalanuvchini tekshirish
        const user = await this.prisma.user.findUnique({ where: { id: dto.user_id } });
        if (!user) throw new NotFoundException('User not found');

        // 1️⃣ Eng yaqin haydovchilar
        const nearbyDrivers = await this.redisGeo.getNearbyDrivers(dto.start_lat, dto.start_lng, 5);

        // 2️⃣ Narx qoidasini olish
        const rule = await this.prisma.pricingRule.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' },
        });
        if (!rule) throw new NotFoundException('No pricing rules found');

        const distanceKm = this.calcDistanceKm(dto.start_lat, dto.start_lng, dto.end_lat, dto.end_lng);
        const estimatedTime = distanceKm * 2; // taxminan 2 daqiqa / km
        const basePrice = Number(rule.base_fare);

        // 🚕 TaxiCategory narxi (umumiy)
        let categoryPrice = 0;
        if (dto.taxiCategoryId) {
            const category = await this.prisma.taxiCategory.findUnique({
                where: { id: dto.taxiCategoryId, is_active: true },
            });
            if (!category) throw new NotFoundException('Taxi category not found or inactive');
            categoryPrice = Number(category.price) || 0;
        }

        // 💰 Yangi narx formulasi
        const price =
            basePrice +
            Number(rule.per_km) * distanceKm +
            Number(rule.per_min) * estimatedTime +
            categoryPrice;

        let finalPrice = price * Number(rule.surge_multiplier);

        // 3️⃣ PromoCode tekshirish
        let promoApplied = false;
        let appliedPromo: { code: string; discount_percent: number; discount_amount: number } | null = null;

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
                const discountPercent = promo.discount_percent;
                const discountAmount = (finalPrice * discountPercent) / 100;
                finalPrice = Math.max(0, finalPrice - discountAmount);
                promoApplied = true;
                appliedPromo = {
                    code: promo.code,
                    discount_percent: promo.discount_percent,
                    discount_amount: discountAmount,
                };
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

        // 5️⃣ Payment yaratish
        await this.prisma.payment.create({
            data: {
                order_id: order.id,
                amount: finalPrice,
                method: dto.payment_method || 'cash',
                status: 'pending',
            },
        });

        // 6️⃣ Haydovchilarga real-time event
        for (const driver of nearbyDrivers) {
            this.socketGateway.emitToDriver(driver.driverId, 'order:request', {
                order_id: order.id,
                distance_km: driver.distanceKm,
                price: finalPrice,
                promo_applied: promoApplied,
            });
        }

        return { order, drivers: nearbyDrivers, promoApplied, appliedPromo };
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

        // 🔄 boshqa haydovchilarga cancel
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
        const commissionDriver = Number(order.price) * 0.05;
        const commissionPassenger = Number(order.price) * 0.1;

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

        const driverEarn =
            paymentMethod === 'cash'
                ? Number(order.price) - commissionDriver
                : Number(order.price) - commissionPassenger;

        await this.prisma.wallet.updateMany({
            where: { user_id: driver.id },
            data: { balance: { increment: driverEarn } },
        });

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'completed', finished_at: new Date() },
        });

        await this.prisma.payment.updateMany({
            where: { order_id: orderId },
            data: { status: 'success', paid_at: new Date() },
        });

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
    async updateOrderStatus(orderId: string, status: OrderStatus) {
        // 1️⃣ Orderni topamiz
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        // 2️⃣ Status o‘zgarishlariga cheklov qo‘yish (optional)
        const validStatuses: OrderStatus[] = [
            'pending',
            'accepted',
            'on_the_way',
            'completed',
            'cancelled',
        ];

        if (!validStatuses.includes(status))
            throw new BadRequestException(`Invalid status: ${status}`);

        // 3️⃣ Orderni yangilaymiz
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status },
        });

        // 4️⃣ Socket orqali haydovchi va yo‘lovchiga yuboramiz
        if (updated.driver_id) {
            this.socketGateway.emitToDriver(updated.driver_id, 'order:status_updated', {
                order_id: updated.id,
                status: updated.status,
            });
        }

        this.socketGateway.emitToUser(updated.user_id, 'order:status_updated', {
            order_id: updated.id,
            status: updated.status,
        });

        // 5️⃣ Agar status “completed” bo‘lsa — yakunlash logikasini ishlatish (optional)
        if (status === 'completed') {
            await this.completeOrder(orderId);
        }

        this.logger.log(`🚖 Order ${orderId} status changed to: ${status}`);

        return updated;
    }

    // 🟢 4. Foydalanuvchining o'z zakaslari
    async getMyOrders(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.order.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: { payment: true },
        });
    }

    // 🟡 5. Orderni yangilash
    async updateOrder(orderId: string, dto: UpdateOrderDto) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
        });
        if (!order) throw new NotFoundException('Order not found');

        if (!['pending', 'accepted'].includes(order.status))
            throw new BadRequestException('Only pending or accepted orders can be updated');

        let finalPrice = Number(order.price);
        let distanceKm = Number(order.distance_km);
        let estimatedTime = Number(order.duration_min);

        if (dto.start_lat && dto.start_lng && dto.end_lat && dto.end_lng) {
            distanceKm = this.calcDistanceKm(dto.start_lat, dto.start_lng, dto.end_lat, dto.end_lng);
            estimatedTime = distanceKm * 2;

            const rule = await this.prisma.pricingRule.findFirst({
                where: { is_active: true },
                orderBy: { updated_at: 'desc' },
            });
            if (!rule) throw new NotFoundException('No pricing rules found');

            const basePrice = Number(rule.base_fare);

            // 🚕 TaxiCategory narxi (umumiy)
            let categoryPrice = 0;
            const categoryId = dto.taxiCategoryId ?? order.taxiCategoryId;

            if (categoryId) {
                const category = await this.prisma.taxiCategory.findUnique({
                    where: { id: categoryId, is_active: true },
                });
                if (!category) throw new NotFoundException('Taxi category not found or inactive');
                categoryPrice = Number(category.price) || 0;
            }

            const price =
                basePrice +
                Number(rule.per_km) * distanceKm +
                Number(rule.per_min) * estimatedTime +
                categoryPrice;

            finalPrice = price * Number(rule.surge_multiplier);
        }

        // 💸 PromoCode tekshirish
        let promoApplied = false;
        let appliedPromo: { code: string; discount_percent: number; discount_amount: number } | null = null;

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
                const discountPercent = promo.discount_percent;
                const discountAmount = (finalPrice * discountPercent) / 100;
                finalPrice = Math.max(0, finalPrice - discountAmount);
                promoApplied = true;
                appliedPromo = {
                    code: promo.code,
                    discount_percent: promo.discount_percent,
                    discount_amount: discountAmount,
                };
            }
        }

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                start_lat: dto.start_lat ? new Prisma.Decimal(dto.start_lat) : order.start_lat,
                start_lng: dto.start_lng ? new Prisma.Decimal(dto.start_lng) : order.start_lng,
                end_lat: dto.end_lat ? new Prisma.Decimal(dto.end_lat) : order.end_lat,
                end_lng: dto.end_lng ? new Prisma.Decimal(dto.end_lng) : order.end_lng,
                taxiCategoryId: dto.taxiCategoryId ?? order.taxiCategoryId,
                price: new Prisma.Decimal(finalPrice),
                distance_km: new Prisma.Decimal(distanceKm),
                duration_min: new Prisma.Decimal(estimatedTime),
                updated_at: new Date(),
            },
        });

        await this.prisma.payment.updateMany({
            where: { order_id: orderId },
            data: {
                amount: new Prisma.Decimal(finalPrice),
                method: dto.payment_method || order.payment?.method || 'cash',
                status: 'pending',
                paid_at: null,
            },
        });

        if (updatedOrder.driver_id) {
            this.socketGateway.emitToDriver(updatedOrder.driver_id, 'order:updated', {
                order_id: orderId,
                new_price: finalPrice,
                promo_applied: promoApplied,
            });
        }

        this.logger.log(`♻️ Order ${orderId} updated successfully`);

        return { updatedOrder, promoApplied, appliedPromo };
    }
}
