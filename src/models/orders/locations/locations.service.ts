
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import { LocationGateway } from './location.chatgetaway';
import { RedisGeoService } from './redis-geo.service';

@Injectable()
export class LocationService {
    private logger = new Logger('LocationService');
    private saveInterval = {}; // Batch saving uchun

    constructor(
        private prisma: DatabaseService,
        private locationGateway: LocationGateway,
        private redisGeo:RedisGeoService
    ) { }

    async saveDriverLocation(
        driverId: string,
        orderId: string | null, // 🟢 null bo‘lishi mumkin
        lat: number,
        lng: number,
        speed?: number,
        bearing?: number,
    ) {
        try {
            // 🟢 Haydovchini tekshirish
            const existsDriver = await this.prisma.user.findUnique({ where: { id: driverId } });
            if (!existsDriver || existsDriver.role !== UserRole.driver) {
                throw new NotFoundException(`Driver with ID ${driverId} not found`);
            }

            // 🟡 Agar order bo‘lsa, shundagina tekshiramiz
            if (orderId) {
                const existsOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
                if (!existsOrder) {
                    throw new NotFoundException(`Order with ID ${orderId} not found for driver ${driverId}`);
                }
            }

            // ✅ 1. Driver joylashuvini DB ga yozish
            await this.prisma.driverLocation.create({
                data: {
                    driver_id: driverId,
                    order_id: orderId, // null bo‘lishi mumkin
                    lat: lat.toString(),
                    lng: lng.toString(),
                    speed: speed ? speed.toString() : null,
                    bearing: bearing ? bearing.toString() : null,
                },
            });

            // ✅ 2. Redis GEO ga yozish (har safar yangilab turadi)
            await this.redisGeo.updateDriverLocation(driverId, lat, lng);

            // ✅ 3. Driver statusini yangilash
            await this.prisma.driver.update({
                where: { id: driverId },
                data: { last_seen_at: new Date() },
            });

            // 🟢 4. Real-time update — faqat tegishli order roomiga
            this.locationGateway.broadcastDriverLocation({
                driverId,
                orderId,
                lat,
                lng,
                speed,
                bearing,
            });

            this.logger.log(`📍 Driver ${driverId} location updated (Redis + DB)`);
        } catch (error) {
            this.logger.error(`❌ Error saving driver location: ${error.message}`);
            throw error; // ✅ mavjud xatoni tashqariga uzatadi
        }

    }

    // Yo'lovchining locatsiyasini saqlash (batch - har 1 minutda)
    async savePassengerLocation(
        userId: string,
        orderId: string | null,
        lat: number,
        lng: number,
        accuracy?: number,
    ) {
        try {
            const existsUser = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!existsUser) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }
            if (orderId) {
                const existsOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
                if (!existsOrder) {
                    throw new NotFoundException(`Order with ID ${orderId} not found for user ${userId}`);
                }
            }
            const location = await this.prisma.userLocation.create({
                data: {
                    user_id: userId,
                    order_id: orderId,
                    lat,
                    lng,
                    accuracy: accuracy || null,
                },
            });

            return location;
        } catch (error) {
            this.logger.error(`Error saving passenger location: ${error.message}`);
            throw error
        }
    }

    // Zakas bo'yicha route history
    async getOrderRoute(orderId: string) {

        const existsOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!existsOrder) throw new NotFoundException('Order not found');
        const [driverRoute, passengerRoute] = await Promise.all([
            this.prisma.driverLocation.findMany({
                where: { order_id: orderId },
                orderBy: { timestamp: 'asc' },
                select: {
                    lat: true,
                    lng: true,
                    speed: true,
                    timestamp: true,
                    driver_id: true,
                },
            }),
            this.prisma.userLocation.findMany({
                where: { order_id: orderId },
                orderBy: { timestamp: 'asc' },
                select: {
                    lat: true,
                    lng: true,
                    timestamp: true,
                    user_id: true,
                },
            }),
        ]);

        return { driverRoute, passengerRoute };
    }
    async getAllDriverLocations() {
        const drivers = await this.prisma.driverLocation.findMany({
            orderBy: { timestamp: 'desc' },
            include: { driver: true },
        });
        return drivers.map(d => ({
            driverId: d.driver_id,
            lat: d.lat,
            lng: d.lng,
            speed: d.speed,
            bearing: d.bearing,
            timestamp: d.timestamp,
        }));
    }

    // Hamma yo'lovchilar locatsiyasi
    async getAllPassengerLocations() {
        const users = await this.prisma.userLocation.findMany({
            orderBy: { timestamp: 'desc' },
            include: { user: true },
        });
        return users.map(u => ({
            userId: u.user_id,
            lat: u.lat,
            lng: u.lng,
            accuracy: u.accuracy,
            timestamp: u.timestamp,
        }));
    }

    // Admin uchun hamma locatsiyalar + real-time socket
    async getAllLocations() {
        const [drivers, passengers] = await Promise.all([
            this.getAllDriverLocations(),
            this.getAllPassengerLocations(),
        ]);

        const allLocations = { drivers, passengers };

        // 🔔 Socket orqali barcha clientlarga yuborish
        this.locationGateway.broadcastAllLocations(allLocations);

        return allLocations;
    }

    
    private orderStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Buyurtma kutilmoqda',
            accepted: 'Haydovchi ketmoqda (mijoz manzilga)',
            on_the_way: 'Mijozni olib bormoqda',
            completed: 'Yakunlangan',
            cancelled: 'Bekor qilindi',
        };
        return labels[status] ?? status;
    }

    async getActiveDriversWithLocations() {
        const redisDrivers = await this.redisGeo.getAllDrivers();
        if (!redisDrivers.length) return [];

        const driverIds = redisDrivers.map(d => d.driverId);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [drivers, activeOrders, todayPayments] = await Promise.all([
            this.prisma.driver.findMany({
                where: { id: { in: driverIds } },
                select: {
                    id: true,
                    status: true,
                    car_model_uz: true,
                    car_number: true,
                    last_seen_at: true,
                    user: {
                        select: { name_uz: true, name_ru: true, name_en: true, phone: true },
                    },
                },
            }),
            this.prisma.order.findMany({
                where: {
                    driver_id: { in: driverIds },
                    status: { in: ['accepted', 'on_the_way'] },
                },
                select: {
                    driver_id: true,
                    status: true,
                    start_lat: true,
                    start_lng: true,
                    end_lat: true,
                    end_lng: true,
                    price: true,
                },
            }),
            this.prisma.payment.findMany({
                where: {
                    order: {
                        driver_id: { in: driverIds },
                        status: 'completed',
                        finished_at: { gte: todayStart },
                    },
                    status: 'success',
                },
                select: {
                    amount: true,
                    order: { select: { driver_id: true } },
                },
            }),
        ]);

        const driverMap = new Map(drivers.map(d => [d.id, d]));

        // currentOrder: driver_id -> order
        const activeOrderMap = new Map<string, typeof activeOrders[number]>();
        for (const o of activeOrders) {
            if (o.driver_id) activeOrderMap.set(o.driver_id, o);
        }

        // todayStats: driver_id -> { completedTrips, revenue }
        const statsMap = new Map<string, { completedTrips: number; revenue: number }>();
        for (const p of todayPayments) {
            const dId = p.order.driver_id;
            if (!dId) continue;
            const prev = statsMap.get(dId) ?? { completedTrips: 0, revenue: 0 };
            statsMap.set(dId, {
                completedTrips: prev.completedTrips + 1,
                revenue: prev.revenue + Number(p.amount),
            });
        }

        return redisDrivers.map(d => {
            const info = driverMap.get(d.driverId);
            const order = activeOrderMap.get(d.driverId) ?? null;
            const stats = statsMap.get(d.driverId) ?? null;

            return {
                driverId: d.driverId,
                lat: d.lat,
                lng: d.lng,
                name: info?.user?.name_uz || info?.user?.name_ru || info?.user?.name_en || null,
                phone: info?.user?.phone || null,
                status: info?.status || null,
                carModel: info?.car_model_uz || null,
                carNumber: info?.car_number || null,
                lastSeenAt: info?.last_seen_at || null,
                currentOrder: order
                    ? {
                          startLat: Number(order.start_lat),
                          startLng: Number(order.start_lng),
                          endLat: Number(order.end_lat),
                          endLng: Number(order.end_lng),
                          price: Number(order.price),
                          statusLabel: this.orderStatusLabel(order.status),
                      }
                    : null,
                todayStats: stats
                    ? {
                          completedTrips: stats.completedTrips,
                          revenue: stats.revenue,
                      }
                    : null,
            };
        });
    }

    // Eski locatsiyalarni o'chirish (7 kundan keyin)
    async cleanupOldLocations(daysOld: number = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const [driverDeleted, passengerDeleted] = await Promise.all([
            this.prisma.driverLocation.deleteMany({
                where: { timestamp: { lt: cutoffDate } },
            }),
            this.prisma.userLocation.deleteMany({
                where: { timestamp: { lt: cutoffDate } },
            }),
        ]);

        this.logger.log(
            `🗑️  Cleanup: Driver(${driverDeleted.count}) + Passenger(${passengerDeleted.count}) locations deleted`,
        );

        return {
            driver: driverDeleted.count,
            passenger: passengerDeleted.count,
        };
    }
}

