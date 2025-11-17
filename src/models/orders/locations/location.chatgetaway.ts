import { Logger } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisGeoService } from './redis-geo.service';

interface LocationData {
    type: 'driver' | 'passenger';
    id: string;
    lat: number;
    lng: number;
    speed?: number;
    bearing?: number;
    accuracy?: number;
    timestamp: Date;
}

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/location',
    transports: ['websocket', 'polling'],
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('LocationGateway');

    private activeOrders = new Map<
        string,
        { driverId: string | null; passengerId: string | null }
    >();

    private lastLocations = new Map<string, LocationData>();

    constructor(private readonly redisGeoService: RedisGeoService) { }

    handleConnection(client: Socket) {
        this.logger.debug(`✅ Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.debug(`❌ Client disconnected: ${client.id}`);
    }

    // Haydovchi ro'yxatdan o'tadi
    @SubscribeMessage('driver:register')
    handleDriverRegister(client: Socket, data: { driverId: string; orderId: string }) {
        client.join(`order:${data.orderId}`);
        client.join(`driver:${data.driverId}`);

        const order = this.activeOrders.get(data.orderId) || { passengerId: null, driverId: null };
        this.activeOrders.set(data.orderId, { ...order, driverId: data.driverId });

        this.logger.debug(`🚗 Driver registered: ${data.driverId} -> Order: ${data.orderId}`);

        // Yo'lovchiga xabar
        this.server.to(`order:${data.orderId}`).emit('driver:accepted', {
            driverId: data.driverId,
            message: 'Haydovchi yo‘lingizga chiqdi',
        });
    }

    
    broadcastDriverLocation(data: { driverId: string; lat: number; lng: number; speed?: number; bearing?: number }) {
        const payload: LocationData = {
            type: 'driver',
            id: data.driverId,
            lat: data.lat,
            lng: data.lng,
            speed: data.speed,
            bearing: data.bearing,
            timestamp: new Date(),
        };

        // 1️⃣ Oxirgi locatsiyani cache’ga yozamiz
        this.lastLocations.set(`driver:${data.driverId}`, payload);

        // 2️⃣ Barcha clientlarga yuboramiz
        this.server.emit('location:driver-updated', payload);

        this.logger.debug(`📡 Broadcast driver ${data.driverId} location → ${data.lat}, ${data.lng}`);
    }



    // Yo'lovchi ro'yxatdan o'tadi
    @SubscribeMessage('passenger:register')
    handlePassengerRegister(client: Socket, data: { userId: string; orderId: string }) {
        client.join(`order:${data.orderId}`);
        client.join(`user:${data.userId}`);

        const order = this.activeOrders.get(data.orderId) || { driverId: null, passengerId: null };
        this.activeOrders.set(data.orderId, { ...order, passengerId: data.userId });

        this.logger.debug(`👤 Passenger registered: ${data.userId} -> Order: ${data.orderId}`);
    }

    // Haydovchi joylashuvini yuboradi (2-5 sek)
    @SubscribeMessage('location:driver-update')
    async handleDriverLocationUpdate(
        client: Socket,
        data: { driverId: string; orderId: string; lat: number; lng: number; speed: number; bearing: number },
    ) {
        const locationData: LocationData = {
            type: 'driver',
            id: data.driverId,
            lat: data.lat,
            lng: data.lng,
            speed: data.speed,
            bearing: data.bearing,
            timestamp: new Date(),
        };

        // Cache + RedisGeo yangilash
        this.lastLocations.set(`driver:${data.driverId}`, locationData);
        await this.redisGeoService.updateDriverLocation(data.driverId, data.lat, data.lng); // ✅ Redis geoadd

        // Order room dagi klientlarga yuborish
        this.server.to(`order:${data.orderId}`).emit('location:driver-updated', locationData);
        this.logger.debug(`📍 Driver ${data.driverId} - ${data.lat}, ${data.lng}`);
    }

    // Yo'lovchi joylashuvini yuboradi (10-30 sek)
    @SubscribeMessage('location:passenger-update')
    async handlePassengerLocationUpdate(
        client: Socket,
        data: { userId: string; orderId: string; lat: number; lng: number; accuracy: number },
    ) {
        const locationData: LocationData = {
            type: 'passenger',
            id: data.userId,
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            timestamp: new Date(),
        };

        this.lastLocations.set(`passenger:${data.userId}`, locationData);
        this.server.to(`order:${data.orderId}`).emit('location:passenger-updated', locationData);
        this.logger.debug(`📍 Passenger ${data.userId} - ${data.lat}, ${data.lng}`);
    }

    // Yangi client ulanganda, oxirgi locatsiyalarni yuborish
    @SubscribeMessage('location:get-current')
    handleGetCurrentLocations(client: Socket, data: { orderId: string }) {
        const order = this.activeOrders.get(data.orderId);
        if (!order) return;

        const locations = {
            driver: order.driverId ? this.lastLocations.get(`driver:${order.driverId}`) : null,
            passenger: order.passengerId ? this.lastLocations.get(`passenger:${order.passengerId}`) : null,
        };

        client.emit('location:current', locations);
    }

    // Zakas yakunlanadi
    @SubscribeMessage('order:completed')
    async handleOrderCompleted(client: Socket, data: { orderId: string }) {
        const order = this.activeOrders.get(data.orderId);
        if (order?.driverId) {
            await this.redisGeoService.removeDriver(order.driverId); // ✅ Redisdan haydovchini o‘chirish
        }

        client.leave(`order:${data.orderId}`);
        this.activeOrders.delete(data.orderId);

        this.server.to(`order:${data.orderId}`).emit('order:finished', {
            message: 'Zakas yakunlandi',
        });
        this.logger.debug(`✅ Order completed: ${data.orderId}`);
    }

    // Yaqin haydovchilarni topish (Redis Geo orqali)
    @SubscribeMessage('location:nearby-drivers')
    async handleNearbyDrivers(client: Socket, data: { lat: number; lng: number; radiusKm: number }) {
        const nearby = await this.redisGeoService.getNearbyDrivers(data.lat, data.lng, data.radiusKm || 3);
        client.emit('location:nearby-drivers', nearby);
    }
    
    broadcastAllLocations(locations: any) {
        this.server.emit('locations-update', locations);
    }
}
