
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { LocationGateway } from './location.chatgetaway';

@Injectable()
export class LocationService {
    private logger = new Logger('LocationService');
    private saveInterval = {}; // Batch saving uchun

    constructor(
        private prisma: DatabaseService,
        private locationGateway: LocationGateway,
    ) {}

    // Haydovchining locatsiyasini saqlash (batch - har 30 sekundda)
    async saveDriverLocation(
        driverId: string,
        orderId: string ,
        lat: number,
        lng: number,
        speed?: number,
        bearing?: number,
    ) {
        try {
            const existsOrder =await this.prisma.order.findUnique({ where: { id: orderId } });
            if(!existsOrder) {
                this.logger.warn(`Order with ID ${orderId} not found for driver ${driverId}`);
                return;
            }
            const existsDriver = await this.prisma.driver.findUnique({ where: { id: driverId } });
            if(!existsDriver) {
                this.logger.warn(`Driver with ID ${driverId} not found`);
                return;
            }
            await this.prisma.driverLocation.create({
                data: {
                    driver_id: driverId,
                    order_id: orderId,
                    lat: lat.toString(),
                    lng: lng.toString(),
                    speed: speed ? speed.toString() : null,
                    bearing: bearing ? bearing.toString() : null,
                },
            });


            // Driver statusini update
            await this.prisma.driver.update({
                where: { id: driverId },
                data: { last_seen_at: new Date() },
            });

            return location;
        } catch (error) {
            this.logger.error(`Error saving driver location: ${error.message}`);
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
            if(!existsUser) {
                this.logger.warn(`User with ID ${userId} not found`);
                return;
            }
            if(orderId) {
                const existsOrder =await this.prisma.order.findUnique({ where: { id: orderId } });
                if(!existsOrder) {
                    this.logger.warn(`Order with ID ${orderId} not found for user ${userId}`);
                    return;
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

