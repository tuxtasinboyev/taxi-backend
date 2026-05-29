import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { SocketGateway } from '../socket/socket.gateway';
import { RedisGeoService } from './locations/redis-geo.service';
import { UpdateOrderDto } from './orders.controller';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger('OrdersService');

    constructor(
        private readonly prisma: DatabaseService,
        private readonly redisGeo: RedisGeoService,
        private readonly socketGateway: SocketGateway,
        private readonly notificationService: NotificationService,
    ) { }

    async createOrder(dto: {
        user_id: string;
        start_lat: number;
        start_lng: number;
        end_lat: number;
        end_lng: number;
        taxiCategoryId?: string;
        promoCode?: string;
        payment_method?: PaymentMethod
    }) {
        const user = await this.prisma.user.findUnique({ where: { id: dto.user_id } });
        if (!user) throw new NotFoundException('User not found');

        const allNearby = await this.redisGeo.getNearbyDrivers(
            Number(dto.start_lat),
            Number(dto.start_lng),
            5
        );

        // Faqat online (bo'sh) haydovchilarni filterlash — busy va offline o'tkazilmaydi
        const onlineNearbyIds = allNearby.map(d => d.driverId);
        const onlineDriversInDb = onlineNearbyIds.length
            ? await this.prisma.driver.findMany({
                where: { id: { in: onlineNearbyIds }, status: 'online' },
                select: { id: true },
              })
            : [];
        const onlineSet = new Set(onlineDriversInDb.map(d => d.id));
        const nearbyDrivers = allNearby.filter(d => onlineSet.has(d.driverId));
        const rule = await this.prisma.pricingRule.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' },
        });
        if (!rule) throw new NotFoundException('No pricing rules found');

        const sLat = Number(dto.start_lat);
        const sLng = Number(dto.start_lng);
        const eLat = Number(dto.end_lat);
        const eLng = Number(dto.end_lng);

        if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
            throw new BadRequestException("Koordinatalar noto'g'ri formatda!");
        }

        const distanceKm = this.calcDistanceKm(sLat, sLng, eLat, eLng);
        const estimatedTime = distanceKm * 2; 
        const basePrice = Number(rule.base_fare);

        let categoryPrice = 0;
        if (dto.taxiCategoryId) {
            const category = await this.prisma.taxiCategory.findUnique({
                where: { id: dto.taxiCategoryId, is_active: true },
            });
            if (!category) throw new NotFoundException('Taxi category not found or inactive');
            categoryPrice = Number(category.price) || 0;
        }

        const price =
            basePrice +
            Number(rule.per_km) * distanceKm +
            Number(rule.per_min) * estimatedTime +
            categoryPrice;

        let finalPrice = price * Number(rule.surge_multiplier);

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

        await this.prisma.payment.create({
            data: {
                order_id: order.id,
                amount: finalPrice,
                method: dto.payment_method ?? 'cash',
                status: 'pending',
            },
        });

        for (const driver of nearbyDrivers) {
            this.socketGateway.emitToDriver(driver.driverId, 'order:request', {
                order_id: order.id,
                distance_km: driver.distanceKm,
                price: finalPrice,
                promo_applied: promoApplied,
            });
        }

        const nearbyDriverIds = nearbyDrivers.map(d => d.driverId);
        const notifPayload = {
            title_uz: 'Yangi buyurtma!',
            title_ru: 'Новый заказ!',
            title_en: 'New order!',
            message_uz: `Narx: ${finalPrice.toFixed(0)} so'm — Qabul qilasizmi?`,
            message_ru: `Цена: ${finalPrice.toFixed(0)} сум — Принять?`,
            message_en: `Price: ${finalPrice.toFixed(0)} sum — Accept?`,
            type: 'order_request',
            data: { order_id: order.id },
        };

        if (nearbyDriverIds.length > 0) {
            this.notificationService.sendToSpecificDrivers(nearbyDriverIds, notifPayload).catch(() => null);
        } else {
            // Yaqin haydovchi topilmasa — barcha online haydovchilarga yuboriladi
            this.notificationService.sendToAllOnlineDrivers(notifPayload).catch(() => null);
        }

        this.socketGateway.emitToAdminOrders('admin:order:created', {
            order_id: order.id,
            user_id: order.user_id,
            driver_id: order.driver_id,
            status: order.status,
            price: Number(order.price),
            distance_km: Number(order.distance_km),
            duration_min: Number(order.duration_min),
            created_at: order.created_at,
            promo_applied: promoApplied,
            nearby_drivers_count: nearbyDrivers.length,
        });

        return { order, drivers: nearbyDrivers, promoApplied, appliedPromo };
    }

    // Narx hisoblash — order yaratmasdan oldin preview
    async pricePreview(dto: {
        start_lat: number;
        start_lng: number;
        end_lat: number;
        end_lng: number;
        taxiCategoryId?: string;
        promoCode?: string;
    }) {
        const rule = await this.prisma.pricingRule.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' },
        });
        if (!rule) throw new NotFoundException('No active pricing rule found');

        const distanceKm = this.calcDistanceKm(dto.start_lat, dto.start_lng, dto.end_lat, dto.end_lng);
        const estimatedTime = distanceKm * 2;

        let categoryPrice = 0;
        let categoryName: string | null = null;
        if (dto.taxiCategoryId) {
            const category = await this.prisma.taxiCategory.findUnique({
                where: { id: dto.taxiCategoryId, is_active: true },
            });
            if (!category) throw new NotFoundException('Taxi category not found or inactive');
            categoryPrice = Number(category.price) || 0;
            categoryName = category.name_uz || category.name_ru || null;
        }

        const baseTotal =
            Number(rule.base_fare) +
            Number(rule.per_km) * distanceKm +
            Number(rule.per_min) * estimatedTime +
            categoryPrice;

        let finalPrice = baseTotal * Number(rule.surge_multiplier);
        let discountAmount = 0;
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
                discountAmount = (finalPrice * promo.discount_percent) / 100;
                finalPrice = Math.max(0, finalPrice - discountAmount);
                promoApplied = true;
            }
        }

        return {
            distanceKm: +distanceKm.toFixed(2),
            estimatedMinutes: +estimatedTime.toFixed(0),
            breakdown: {
                baseFare: Number(rule.base_fare),
                perKmCharge: +(Number(rule.per_km) * distanceKm).toFixed(0),
                perMinCharge: +(Number(rule.per_min) * estimatedTime).toFixed(0),
                categoryCharge: categoryPrice,
                surgeMultiplier: Number(rule.surge_multiplier),
                discount: +discountAmount.toFixed(0),
            },
            categoryName,
            promoApplied,
            finalPrice: +finalPrice.toFixed(0),
            currency: rule.currency,
        };
    }

    // Admin tomonidan order yaratish (istalgan user uchun)
    async adminCreateOrder(dto: {
        user_id: string;
        start_lat: number;
        start_lng: number;
        end_lat: number;
        end_lng: number;
        taxiCategoryId?: string;
        promoCode?: string;
        payment_method?: PaymentMethod;
        driver_id?: string;
    }) {
        const result = await this.createOrder(dto);

        if (dto.driver_id) {
            await this.assignDriver(result.order.id, dto.driver_id);
        }

        return result;
    }

    // Admin haydovchini order ga biriktiradi
    async assignDriver(orderId: string, driverId: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        if (!['pending', 'accepted'].includes(order.status)) {
            throw new BadRequestException('Faqat pending yoki accepted orderlarga haydovchi biriktiriladi');
        }

        const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
        if (!driver) throw new NotFoundException('Driver not found');

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { driver_id: driverId, status: 'accepted' },
            include: {
                user: { select: { id: true, name_uz: true, phone: true } },
                driver: {
                    include: { user: { select: { id: true, name_uz: true, phone: true } } },
                },
            },
        });

        // Haydovchiga xabar yuborish
        this.socketGateway.emitToDriver(driverId, 'order:assigned', {
            order_id: orderId,
            message: 'Admin sizga buyurtma biriktirdi',
            price: Number(updatedOrder.price),
        });

        // Yo'lovchiga xabar yuborish
        this.socketGateway.emitToUser(order.user_id, 'order:accepted', {
            order_id: orderId,
            driver_id: driverId,
            message: 'Haydovchi tayinlandi',
        });

        // Boshqa haydovchilarga bekor xabari
        this.socketGateway.broadcastExceptDriver(driverId, 'order:cancelled', { order_id: orderId });

        // Yo'lovchiga push notification
        this.notificationService.sendToUser(order.user_id, {
            title_uz: 'Haydovchi tayinlandi',
            title_ru: 'Водитель назначен',
            title_en: 'Driver assigned',
            message_uz: 'Admin buyurtmangizga haydovchi biriktirdi',
            message_ru: 'Администратор назначил водителя для вашего заказа',
            message_en: 'Admin assigned a driver to your order',
            type: 'order_assigned',
            data: { order_id: orderId, driver_id: driverId },
        }).catch(() => null);

        // Haydovchiga push notification
        this.notificationService.sendToUser(driverId, {
            title_uz: 'Yangi buyurtma',
            title_ru: 'Новый заказ',
            title_en: 'New order',
            message_uz: 'Admin sizga yangi buyurtma biriktirdi',
            message_ru: 'Администратор назначил вам новый заказ',
            message_en: 'Admin assigned you a new order',
            type: 'order_assigned',
            data: { order_id: orderId },
        }).catch(() => null);

        this.socketGateway.emitToAdminOrders('admin:order:assigned', {
            order_id: updatedOrder.id,
            user_id: updatedOrder.user_id,
            driver_id: updatedOrder.driver_id,
            status: updatedOrder.status,
            price: Number(updatedOrder.price),
            assigned_at: new Date(),
        });

        this.logger.log(`Admin assigned driver ${driverId} to order ${orderId}`);
        return updatedOrder;
    }

    // Order uchun yaqin haydovchilarni topish (admin panelda)
    async getNearbyDriversForOrder(orderId: string, radiusKm = 5) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        const nearby = await this.redisGeo.getNearbyDrivers(
            Number(order.start_lat),
            Number(order.start_lng),
            radiusKm,
        );

        if (!nearby.length) return [];

        const driverIds = nearby.map(d => d.driverId);
        const drivers = await this.prisma.driver.findMany({
            where: { id: { in: driverIds } },
            select: {
                id: true,
                status: true,
                car_model_uz: true,
                car_number: true,
                rating: true,
                user: { select: { name_uz: true, name_ru: true, phone: true } },
            },
        });

        const driverMap = new Map(drivers.map(d => [d.id, d]));

        return nearby.map(n => {
            const info = driverMap.get(n.driverId);
            return {
                driverId: n.driverId,
                distanceKm: n.distanceKm,
                name: info?.user?.name_uz || info?.user?.name_ru || null,
                phone: info?.user?.phone || null,
                carModel: info?.car_model_uz || null,
                carNumber: info?.car_number || null,
                rating: info?.rating ? Number(info.rating) : null,
                status: info?.status || null,
            };
        });
    }

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

        // Haydovchi band bo'ldi
        await this.prisma.driver.update({
            where: { id: driverId },
            data: { status: 'busy' },
        });

        this.socketGateway.broadcastExceptDriver(driverId, 'order:cancelled', { order_id: orderId });

        // Yo'lovchiga push notification
        this.notificationService.sendToUser(order.user_id, {
            title_uz: 'Buyurtma qabul qilindi',
            title_ru: 'Заказ принят',
            title_en: 'Order accepted',
            message_uz: 'Haydovchi buyurtmangizni qabul qildi, yo\'lingizda',
            message_ru: 'Водитель принял ваш заказ и едет к вам',
            message_en: 'Driver accepted your order and is on the way',
            type: 'order_accepted',
            data: { order_id: orderId, driver_id: driverId },
        }).catch(() => null);

        this.socketGateway.emitToAdminOrders('admin:order:accepted', {
            order_id: updatedOrder.id,
            user_id: updatedOrder.user_id,
            driver_id: updatedOrder.driver_id,
            status: updatedOrder.status,
            accepted_at: new Date(),
        });

        return updatedOrder;
    }

    async rejectOrder(driverId: string, orderId: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        if (order.status !== 'pending')
            throw new ConflictException('Bu buyurtmani rad etib bo\'lmaydi');

        // Haydovchiga socket orqali xabar (rad etildi)
        this.socketGateway.emitToDriver(driverId, 'order:rejected_by_you', { order_id: orderId });

        // Yo'lovchiga push: haydovchi rad etdi, boshqa qidirilmoqda
        this.notificationService.sendToUser(order.user_id, {
            title_uz: 'Haydovchi rad etdi',
            title_ru: 'Водитель отказался',
            title_en: 'Driver rejected',
            message_uz: 'Haydovchi buyurtmangizni rad etdi, boshqa haydovchi qidirilmoqda',
            message_ru: 'Водитель отказался от заказа, ищем другого водителя',
            message_en: 'Driver rejected your order, searching for another driver',
            type: 'order_rejected',
            data: { order_id: orderId },
        }).catch(() => null);

        this.socketGateway.emitToAdminOrders('admin:order:rejected', {
            order_id: orderId,
            driver_id: driverId,
            status: order.status,
            rejected_at: new Date(),
        });

        return { success: true, message: 'Buyurtma rad etildi' };
    }

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

        const paymentMethod = order.payment?.method
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

        // Haydovchi yana bo'sh
        await this.prisma.driver.update({
            where: { id: order.driver_id },
            data: { status: 'online' },
        });

        await this.prisma.payment.updateMany({
            where: { order_id: orderId },
            data: { status: 'success', paid_at: new Date() },
        });

        this.socketGateway.emitToDriver(order.driver_id, 'order:completed', {
            order_id: order.id,
            amount: driverEarn,
        });

        this.socketGateway.emitToAdminOrders('admin:order:completed', {
            order_id: updatedOrder.id,
            user_id: updatedOrder.user_id,
            driver_id: updatedOrder.driver_id,
            status: updatedOrder.status,
            amount: driverEarn,
            completed_at: updatedOrder.finished_at,
        });

        // Yo'lovchiga push notification
        this.notificationService.sendToUser(order.user_id, {
            title_uz: 'Sayohat yakunlandi',
            title_ru: 'Поездка завершена',
            title_en: 'Trip completed',
            message_uz: `Sayohatingiz muvaffaqiyatli yakunlandi. Narx: ${Number(order.price).toFixed(0)} so'm`,
            message_ru: `Ваша поездка успешно завершена. Цена: ${Number(order.price).toFixed(0)} сум`,
            message_en: `Your trip completed successfully. Price: ${Number(order.price).toFixed(0)} sum`,
            type: 'order_completed',
            data: { order_id: orderId },
        }).catch(() => null);

        // Haydovchiga push notification
        this.notificationService.sendToUser(order.driver_id, {
            title_uz: 'Buyurtma yakunlandi',
            title_ru: 'Заказ завершён',
            title_en: 'Order completed',
            message_uz: `Buyurtma yakunlandi. Daromadingiz: ${driverEarn.toFixed(0)} so'm`,
            message_ru: `Заказ завершён. Ваш заработок: ${driverEarn.toFixed(0)} сум`,
            message_en: `Order completed. Your earnings: ${driverEarn.toFixed(0)} sum`,
            type: 'order_completed',
            data: { order_id: orderId, earned: String(driverEarn) },
        }).catch(() => null);

        this.logger.log(`✅ Order ${orderId} completed: driver ${order.driver_id} earned ${driverEarn}`);
        return updatedOrder;
    }

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
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        const validStatuses: OrderStatus[] = [
            'pending',
            'accepted',
            'on_the_way',
            'completed',
            'cancelled',
        ];

        if (!status || !validStatuses.includes(status))
            throw new BadRequestException(`Invalid status: ${status}`);

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status },
        });

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

        this.socketGateway.emitToAdminOrders('admin:order:status_updated', {
            order_id: updated.id,
            user_id: updated.user_id,
            driver_id: updated.driver_id,
            status: updated.status,
            updated_at: updated.updated_at,
        });

        if (status === 'completed') {
            await this.completeOrder(orderId);
        }

        if (status === 'on_the_way') {
            this.notificationService.sendToUser(updated.user_id, {
                title_uz: 'Haydovchi yo\'lda',
                title_ru: 'Водитель в пути',
                title_en: 'Driver on the way',
                message_uz: 'Haydovchi sizning manzilingizga yo\'lda',
                message_ru: 'Водитель направляется к вашему адресу',
                message_en: 'Driver is heading to your location',
                type: 'order_on_the_way',
                data: { order_id: orderId },
            }).catch(() => null);
        }

        if (status === 'cancelled') {
            // Haydovchi band bo'lgan bo'lsa, uni yana online qilamiz
            if (updated.driver_id) {
                await this.prisma.driver.update({
                    where: { id: updated.driver_id },
                    data: { status: 'online' },
                });
            }

            this.notificationService.sendToUser(updated.user_id, {
                title_uz: 'Buyurtma bekor qilindi',
                title_ru: 'Заказ отменён',
                title_en: 'Order cancelled',
                message_uz: 'Sizning buyurtmangiz bekor qilindi',
                message_ru: 'Ваш заказ был отменён',
                message_en: 'Your order has been cancelled',
                type: 'order_cancelled',
                data: { order_id: orderId },
            }).catch(() => null);

            if (updated.driver_id) {
                this.notificationService.sendToUser(updated.driver_id, {
                    title_uz: 'Buyurtma bekor qilindi',
                    title_ru: 'Заказ отменён',
                    title_en: 'Order cancelled',
                    message_uz: 'Buyurtma bekor qilindi',
                    message_ru: 'Заказ был отменён',
                    message_en: 'The order has been cancelled',
                    type: 'order_cancelled',
                    data: { order_id: orderId },
                }).catch(() => null);
            }
        }

        this.logger.log(`🚖 Order ${orderId} status changed to: ${status}`);

        return updated;
    }

    async getMyOrders(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.order.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: { payment: true },
        });
    }

    async updateOrder(orderId: string, dto: UpdateOrderDto, reqUser: { id: string, role: string }) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
        });

        if (!order) throw new NotFoundException('Order not found');

    
        if (reqUser.role !== 'admin') {
            if (order.user_id !== reqUser.id) {
                throw new ForbiddenException('Siz faqat oʻzingizga tegishli buyurtmani yangilay olasiz');
            }
        }

        if (!['pending', 'accepted'].includes(order.status)) {
            throw new BadRequestException('Ushbu holatdagi buyurtmani oʻzgartirib boʻlmaydi');
        }

        let finalPrice = Number(order.price);
        let distanceKm = Number(order.distance_km);
        let estimatedTime = Number(order.duration_min);

        if (
            dto.start_lat !== undefined && dto.start_lng !== undefined &&
            dto.end_lat !== undefined && dto.end_lng !== undefined
        ) {
            distanceKm = this.calcDistanceKm(dto.start_lat, dto.start_lng, dto.end_lat, dto.end_lng);
            estimatedTime = distanceKm * 2; 

            const rule = await this.prisma.pricingRule.findFirst({
                where: { is_active: true },
                orderBy: { updated_at: 'desc' },
            });
            if (!rule) throw new NotFoundException('Pricing rules topilmadi');

            let categoryPrice = 0;
            const categoryId = dto.taxiCategoryId ?? order.taxiCategoryId;
            if (categoryId) {
                const category = await this.prisma.taxiCategory.findUnique({
                    where: { id: categoryId, is_active: true },
                });
                if (category) categoryPrice = Number(category.price);
            }

            const price = Number(rule.base_fare) +
                (Number(rule.per_km) * distanceKm) +
                (Number(rule.per_min) * estimatedTime) +
                categoryPrice;

            finalPrice = price * Number(rule.surge_multiplier);
        }

        let promoApplied = false;
        let appliedPromo: { code: string; discount_amount: number } | null = null;
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
                const discountAmount = (finalPrice * promo.discount_percent) / 100;
                finalPrice = Math.max(0, finalPrice - discountAmount);
                promoApplied = true;
                appliedPromo = { code: promo.code, discount_amount: discountAmount };
            }
        }

        const updateData: any = {};
        const allowedFields = ['start_lat', 'start_lng', 'end_lat', 'end_lng', 'start_address', 'end_address', 'taxiCategoryId'];

        allowedFields.forEach(field => {
            if (dto[field] !== undefined) {
                if (['start_lat', 'start_lng', 'end_lat', 'end_lng'].includes(field)) {
                    updateData[field] = new Prisma.Decimal(dto[field]);
                } else {
                    updateData[field] = dto[field];
                }
            }
        });

        updateData.price = new Prisma.Decimal(finalPrice);
        updateData.distance_km = new Prisma.Decimal(distanceKm);
        updateData.duration_min = new Prisma.Decimal(estimatedTime);
        updateData.updated_at = new Date();

        // 🟢 6. Bazada yangilash
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: updateData,
        });

        // To'lov ma'lumotlarini ham yangilash
        await this.prisma.payment.updateMany({
            where: { order_id: orderId },
            data: {
                amount: new Prisma.Decimal(finalPrice),
                method: dto.payment_method ?? (order.payment as any)?.method ?? 'cash',
                status: 'pending',
            },
        });

        // Haydovchiga socket orqali xabar yuborish
        if (updatedOrder.driver_id) {
            this.socketGateway.emitToDriver(updatedOrder.driver_id, 'order:updated', {
                order_id: orderId,
                new_price: finalPrice,
            });
        }

        this.socketGateway.emitToAdminOrders('admin:order:updated', {
            order_id: updatedOrder.id,
            user_id: updatedOrder.user_id,
            driver_id: updatedOrder.driver_id,
            status: updatedOrder.status,
            new_price: finalPrice,
            promo_applied: promoApplied,
            applied_promo: appliedPromo,
            updated_at: updatedOrder.updated_at,
        });

        return { updatedOrder, promoApplied, appliedPromo };
    }

    async getAllOrders(
        page: number = 1,
        limit: number = 10,
        language: Language,
        search?: string,
        driver_id?: string,
        user_id?: string,
        price_min?: number,
        price_max?: number,
        status?: OrderStatus
    ) {
        const whereClause: any = {};

        if (search) {
            const nameField = language === 'uz' ? 'name_uz' :
                language === 'ru' ? 'name_ru' :
                    language === 'en' ? 'name_en' : 'name_uz';

            whereClause.OR = [
                { user: { [nameField]: { contains: search, mode: 'insensitive' } } },
            ];
            if (await this.prisma.user.count({ where: { id: driver_id } }) > 0) {
                whereClause.OR.push({
                    driver: {
                        user: { [nameField]: { contains: search, mode: 'insensitive' } }
                    }
                });
            }
        }


        if (driver_id !== undefined && driver_id !== '') {
            const existsDriver = await this.prisma.user.findUnique({ where: { id: driver_id } });
            if (!existsDriver) {
                throw new NotFoundException('Driver not found');
            }
            whereClause.driver_id = driver_id;
        }
        if (user_id !== undefined && user_id !== '') {
            const existsUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!existsUser) {
                throw new NotFoundException('User not found');
            }
            whereClause.user_id = user_id;
        }

        if (price_min !== undefined || price_max !== undefined) {
            whereClause.price = {};
            if (price_min !== undefined) whereClause.price.gte = new Prisma.Decimal(price_min);
            if (price_max !== undefined) whereClause.price.lte = new Prisma.Decimal(price_max);
        }

        if (status) whereClause.status = status;

        const totalItems = await this.prisma.order.count({ where: whereClause });

        const pageNumber = Math.max(page, 1);
        const limitNumber = Math.min(Math.max(limit, 1), 100);
        const offset = (pageNumber - 1) * limitNumber;
        const totalPages = Math.ceil(totalItems / limitNumber);

        const orders = await this.prisma.order.findMany({
            where: whereClause,
            skip: offset,
            take: limitNumber,
            orderBy: { created_at: 'desc' },
            include: {
                user: true,
                driver: {
                    include: { user: true },
                },
                taxiCategory: true,
                payment: true,
                fare: true,
                reviews: { include: { from: true, to: true } },
                driverLocations: true,
                userLocations: true,
                chats: {
                    include: {
                        participants: true,
                        messages: true
                    }
                }
            }
        });

        const mapped = orders.map(order => {
            const lang = language;

            const userName =
                lang === 'uz' ? order.user.name_uz :
                    lang === 'ru' ? order.user.name_ru :
                        lang === 'en' ? order.user.name_en :
                            order.user.name_uz;

            let driverName: string | null = null;
            let carModel: string | null = null;
            let carColor: string | null = null;

            if (order.driver && order.driver.user) {
                driverName =
                    lang === 'uz' ? order.driver.user.name_uz :
                        lang === 'ru' ? order.driver.user.name_ru :
                            lang === 'en' ? order.driver.user.name_en :
                                order.driver.user.name_uz;

                carModel =
                    lang === 'uz' ? order.driver.car_model_uz :
                        lang === 'ru' ? order.driver.car_model_ru :
                            lang === 'en' ? order.driver.car_model_en :
                                order.driver.car_model_uz;

                carColor =
                    lang === 'uz' ? order.driver.car_color_uz :
                        lang === 'ru' ? order.driver.car_color_ru :
                            lang === 'en' ? order.driver.car_color_en :
                                order.driver.car_color_uz;
            }

            let categoryName: string | null = null;
            if (order.taxiCategory) {
                categoryName =
                    lang === 'uz' ? order.taxiCategory.name_uz :
                        lang === 'ru' ? order.taxiCategory.name_ru :
                            lang === 'en' ? order.taxiCategory.name_en :
                                order.taxiCategory.name_uz;
            }


            const reviews = order.reviews.map(r => {
                const comment =
                    lang === 'uz' ? r.comment_uz :
                        lang === 'ru' ? r.comment_ru :
                            lang === 'en' ? r.comment_en :
                                r.comment_uz;

                return {
                    ...r,
                    comment,
                    from_name:
                        lang === 'uz' ? r.from.name_uz :
                            lang === 'ru' ? r.from.name_ru :
                                lang === 'en' ? r.from.name_en :
                                    r.from.name_uz,
                    to_name:
                        lang === 'uz' ? r.to.name_uz :
                            lang === 'ru' ? r.to.name_ru :
                                lang === 'en' ? r.to.name_en :
                                    r.to.name_uz
                };
            });

            return {
                ...order,
                user: {
                    ...order.user,
                    name: userName,
                },
                driver: order.driver
                    ? {
                        ...order.driver,
                        user: {
                            ...order.driver.user,
                            name: driverName,
                        },
                        car_model: carModel,
                        car_color: carColor,
                    }
                    : null,
                taxiCategory: order.taxiCategory
                    ? {
                        ...order.taxiCategory,
                        name: categoryName,
                    }
                    : null,
                reviews,
            };
        });

        return {
            success: true,
            message: "Orders retrieved successfully",
            data: mapped,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNumber,
                itemsPerPage: limitNumber,
            },
        };
    }
    async getOrderById(orderId: string, language: Language) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: true,
                driver: { include: { user: true } },
                taxiCategory: true,
                payment: true,
                fare: true,
                reviews: { include: { from: true, to: true } },
                driverLocations: true,
                userLocations: true,
                chats: { include: { participants: true, messages: true } },
            },
        });

        if (!order) {
            return { success: false, message: 'Order not found', data: null };
        }

        const lang = language;

        const userName =
            lang === 'uz' ? order.user.name_uz :
                lang === 'ru' ? order.user.name_ru :
                    lang === 'en' ? order.user.name_en :
                        order.user.name_uz;

        let driverName: string | null = null;
        let carModel: string | null = null;
        let carColor: string | null = null;

        if (order.driver) {
            driverName =
                lang === 'uz' ? order.driver.user.name_uz :
                    lang === 'ru' ? order.driver.user.name_ru :
                        lang === 'en' ? order.driver.user.name_en :
                            order.driver.user.name_uz;

            carModel =
                lang === 'uz' ? order.driver.car_model_uz :
                    lang === 'ru' ? order.driver.car_model_ru :
                        lang === 'en' ? order.driver.car_model_en :
                            order.driver.car_model_uz;

            carColor =
                lang === 'uz' ? order.driver.car_color_uz :
                    lang === 'ru' ? order.driver.car_color_ru :
                        lang === 'en' ? order.driver.car_color_en :
                            order.driver.car_color_uz;
        }

        let categoryName: string | null = null;
        if (order.taxiCategory) {
            categoryName =
                lang === 'uz' ? order.taxiCategory.name_uz :
                    lang === 'ru' ? order.taxiCategory.name_ru :
                        lang === 'en' ? order.taxiCategory.name_en :
                            order.taxiCategory.name_uz;
        }

        const reviews = order.reviews.map(r => {
            const comment =
                lang === 'uz' ? r.comment_uz :
                    lang === 'ru' ? r.comment_ru :
                        lang === 'en' ? r.comment_en :
                            r.comment_uz;

            return {
                ...r,
                comment,
                from_name:
                    r.from
                        ? lang === 'uz' ? r.from.name_uz :
                            lang === 'ru' ? r.from.name_ru :
                                lang === 'en' ? r.from.name_en :
                                    r.from.name_uz
                        : null,
                to_name:
                    r.to
                        ? lang === 'uz' ? r.to.name_uz :
                            lang === 'ru' ? r.to.name_ru :
                                lang === 'en' ? r.to.name_en :
                                    r.to.name_uz
                        : null,
            };
        });

        return {
            success: true,
            message: 'Order retrieved successfully',
            data: {
                ...order,
                user: { ...order.user, name: userName },
                driver: order.driver
                    ? {
                        ...order.driver,
                        user: { ...order.driver.user, name: driverName },
                        car_model: carModel,
                        car_color: carColor,
                    }
                    : null,
                taxiCategory: order.taxiCategory
                    ? { ...order.taxiCategory, name: categoryName }
                    : null,
                reviews,
            },
        };
    }
}
