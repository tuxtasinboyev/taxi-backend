import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { DatabaseService } from 'src/config/database/database.service';

@WebSocketGateway({ cors: true })
export class DriverGateway {
    @WebSocketServer() server: Server;

    constructor(private prisma: DatabaseService) { }

    @SubscribeMessage('driver_online')
    async handleDriverOnline(@MessageBody() data: { driverId: string }) {
        await this.prisma.driver.update({
            where: { id: data.driverId },
            data: { status: 'online', last_seen_at: new Date() },
        });

        this.server.emit('driver_status_changed', { driverId: data.driverId, status: 'online' });
    }

    @SubscribeMessage('driver_offline')
    async handleDriverOffline(@MessageBody() data: { driverId: string }) {
        await this.prisma.driver.update({
            where: { id: data.driverId },
            data: { status: 'offline', last_seen_at: new Date() },
        });

        this.server.emit('driver_status_changed', { driverId: data.driverId, status: 'offline' });
    }
}
