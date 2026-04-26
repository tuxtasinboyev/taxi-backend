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
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('LocationGateway');

  private activeOrders = new Map<
    string,
    { driverId: string | null; passengerId: string | null }
  >();

  private lastLocations = new Map<string, LocationData>();

  constructor(private readonly redisGeoService: RedisGeoService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // Haydovchi order roomga qo'shiladi
  @SubscribeMessage('driver:register')
  handleDriverRegister(
    client: Socket,
    data: { driverId: string; orderId: string },
  ) {
    client.join(`order:${data.orderId}`);
    client.join(`driver:${data.driverId}`);

    const order = this.activeOrders.get(data.orderId) ?? {
      passengerId: null,
      driverId: null,
    };
    this.activeOrders.set(data.orderId, { ...order, driverId: data.driverId });

    this.logger.debug(
      `Driver registered: ${data.driverId} -> Order: ${data.orderId}`,
    );

    this.server.to(`order:${data.orderId}`).emit('driver:accepted', {
      driverId: data.driverId,
      message: 'Haydovchi yolingizga chiqdi',
    });
  }

  // Yo'lovchi order roomga qo'shiladi
  @SubscribeMessage('passenger:register')
  handlePassengerRegister(
    client: Socket,
    data: { userId: string; orderId: string },
  ) {
    client.join(`order:${data.orderId}`);
    client.join(`user:${data.userId}`);

    const order = this.activeOrders.get(data.orderId) ?? {
      driverId: null,
      passengerId: null,
    };
    this.activeOrders.set(data.orderId, { ...order, passengerId: data.userId });

    this.logger.debug(
      `Passenger registered: ${data.userId} -> Order: ${data.orderId}`,
    );
  }

  // Haydovchi joylashuvini yuboradi — WebSocket orqali (har 2-5 sek)
  @SubscribeMessage('location:driver-update')
  async handleDriverLocationUpdate(
    _client: Socket,
    data: {
      driverId: string;
      orderId: string;
      lat: number;
      lng: number;
      speed: number;
      bearing: number;
    },
  ) {
    const payload: LocationData = {
      type: 'driver',
      id: data.driverId,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed,
      bearing: data.bearing,
      timestamp: new Date(),
    };

    this.lastLocations.set(`driver:${data.driverId}`, payload);
    await this.redisGeoService.updateDriverLocation(
      data.driverId,
      data.lat,
      data.lng,
    );

    this.server
      .to(`order:${data.orderId}`)
      .emit('location:driver-updated', payload);
    // Admin xaritasiga ham yuborish
    this.server.to('admin:map').emit('admin:driver-updated', payload);
    this.logger.debug(`Driver ${data.driverId} -> ${data.lat}, ${data.lng}`);
  }

  // Yo'lovchi joylashuvini yuboradi — WebSocket orqali (har 10-30 sek)
  @SubscribeMessage('location:passenger-update')
  async handlePassengerLocationUpdate(
    _client: Socket,
    data: {
      userId: string;
      orderId: string;
      lat: number;
      lng: number;
      accuracy: number;
    },
  ) {
    const payload: LocationData = {
      type: 'passenger',
      id: data.userId,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      timestamp: new Date(),
    };

    this.lastLocations.set(`passenger:${data.userId}`, payload);

    // Faqat shu order roomiga yuborish
    this.server
      .to(`order:${data.orderId}`)
      .emit('location:passenger-updated', payload);
    this.logger.debug(`Passenger ${data.userId} -> ${data.lat}, ${data.lng}`);
  }

  // Yangi ulanib kelgan client uchun oxirgi pozitsiyalarni yuborish
  @SubscribeMessage('location:get-current')
  handleGetCurrentLocations(client: Socket, data: { orderId: string }) {
    const order = this.activeOrders.get(data.orderId);
    if (!order) return;

    const locations = {
      driver: order.driverId
        ? (this.lastLocations.get(`driver:${order.driverId}`) ?? null)
        : null,
      passenger: order.passengerId
        ? (this.lastLocations.get(`passenger:${order.passengerId}`) ?? null)
        : null,
    };

    client.emit('location:current', locations);
  }

  // Yaqin haydovchilarni topish — order yaratishdan oldin
  @SubscribeMessage('location:nearby-drivers')
  async handleNearbyDrivers(
    client: Socket,
    data: { lat: number; lng: number; radiusKm: number },
  ) {
    const nearby = await this.redisGeoService.getNearbyDrivers(
      data.lat,
      data.lng,
      data.radiusKm || 3,
    );
    client.emit('location:nearby-drivers', nearby);
  }

  // Order yakunlanganda roomni tozalash
  @SubscribeMessage('order:finished')
  async handleOrderFinished(client: Socket, data: { orderId: string }) {
    const order = this.activeOrders.get(data.orderId);
    if (order?.driverId) {
      await this.redisGeoService.removeDriver(order.driverId);
      this.lastLocations.delete(`driver:${order.driverId}`);
    }
    if (order?.passengerId) {
      this.lastLocations.delete(`passenger:${order.passengerId}`);
    }

    this.server.to(`order:${data.orderId}`).emit('order:finished', {
      message: 'Zakas yakunlandi',
    });

    this.activeOrders.delete(data.orderId);
    this.logger.debug(`Order finished: ${data.orderId}`);
  }

  // HTTP endpoint chaqirganda — faqat tegishli order roomiga broadcast
  broadcastDriverLocation(data: {
    driverId: string;
    orderId?: string | null;
    lat: number;
    lng: number;
    speed?: number;
    bearing?: number;
  }) {
    const payload: LocationData = {
      type: 'driver',
      id: data.driverId,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed,
      bearing: data.bearing,
      timestamp: new Date(),
    };

    this.lastLocations.set(`driver:${data.driverId}`, payload);

    if (data.orderId) {
      this.server
        .to(`order:${data.orderId}`)
        .emit('location:driver-updated', payload);
    } else {
      this.server
        .to(`driver:${data.driverId}`)
        .emit('location:driver-updated', payload);
    }
    this.server.to('admin:map').emit('admin:driver-updated', payload);
  }

  // Admin xarita roomga qo'shiladi
  @SubscribeMessage('admin:subscribe')
  handleAdminSubscribe(client: Socket) {
    client.join('admin:map');
    this.logger.debug(`Admin subscribed to map: ${client.id}`);

    // Hozirgi barcha haydovchi pozitsiyalarini yuborish
    const drivers: LocationData[] = [];
    this.lastLocations.forEach((data, key) => {
      if (key.startsWith('driver:')) {
        drivers.push(data);
      }
    });
    client.emit('admin:all-drivers', drivers);
  }

  // Admin barcha haydovchilarni so'raganda
  @SubscribeMessage('admin:get-all-drivers')
  handleAdminGetAllDrivers(client: Socket) {
    const drivers: LocationData[] = [];
    this.lastLocations.forEach((data, key) => {
      if (key.startsWith('driver:')) {
        drivers.push(data);
      }
    });
    client.emit('admin:all-drivers', drivers);
  }

  // Admin uchun — barcha joylashuvlar
  broadcastAllLocations(locations: unknown) {
    this.server.to('admin:map').emit('locations-update', locations);
  }
}
