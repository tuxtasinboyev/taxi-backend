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

@Injectable()
export class OrdersService {
    private readonly logger = new Logger('OrdersService');

    constructor(
        private readonly prisma: DatabaseService,
        private readonly redisGeo: RedisGeoService,
        private readonly socketGateway: SocketGateway,
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

        const nearbyDrivers = await this.redisGeo.getNearbyDrivers(
            Number(dto.start_lat),
            Number(dto.start_lng),
            5
        );
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

        return { order, drivers: nearbyDrivers, promoApplied, appliedPromo };
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

        this.socketGateway.broadcastExceptDriver(driverId, 'order:cancelled', { order_id: orderId });

        return updatedOrder;
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

        if (status === 'completed') {
            await this.completeOrder(orderId);
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
