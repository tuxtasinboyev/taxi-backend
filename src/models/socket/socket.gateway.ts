import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface ConnectedClient {
    userId?: string;
    driverId?: string;
    socketId: string;
}

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/ws', 
    transports: ['websocket', 'polling'],
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('SocketGateway');

    private clients = new Map<string, ConnectedClient>();

    handleConnection(client: Socket) {
        this.logger.log(`✅ Socket connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.warn(`❌ Socket disconnected: ${client.id}`);
        this.clients.delete(client.id);
    }

    registerUser(socket: Socket, payload: { userId?: string; driverId?: string }) {
        this.clients.set(socket.id, {
            socketId: socket.id,
            userId: payload.userId,
            driverId: payload.driverId,
        });

        this.logger.debug(
            `👤 Registered socket ${socket.id} for userId=${payload.userId} / driverId=${payload.driverId}`,
        );
    }

    emitToDriver(driverId: string, event: string, data: any) {
        for (const client of this.clients.values()) {
            if (client.driverId === driverId) {
                this.server.to(client.socketId).emit(event, data);
                this.logger.debug(`📤 Emit to driver ${driverId}: ${event}`);
            }
        }
    }

    emitToUser(userId: string, event: string, data: any) {
        for (const client of this.clients.values()) {
            if (client.userId === userId) {
                this.server.to(client.socketId).emit(event, data);
                this.logger.debug(`📤 Emit to user ${userId}: ${event}`);
            }
        }
    }

    broadcastExceptDriver(exceptDriverId: string, event: string, data: any) {
        for (const client of this.clients.values()) {
            if (client.driverId !== exceptDriverId) {
                this.server.to(client.socketId).emit(event, data);
            }
        }
        this.logger.debug(`📢 Broadcast to all except driver ${exceptDriverId}: ${event}`);
    }

        broadcastAll(event: string, data: any) {
        this.server.emit(event, data);
        this.logger.debug(`🌍 Broadcast all: ${event}`);
    }
}
