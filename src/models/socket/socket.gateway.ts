import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
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

    private extractRole(client: Socket) {
        return (client.handshake.auth.role || client.handshake.query.role) as string | undefined;
    }

    private isPrivilegedRole(role?: string) {
        return role === 'admin' || role === 'superadmin';
    }

    handleConnection(client: Socket) {
        this.logger.log(`✅ Socket connected: ${client.id}`);
        if (this.isPrivilegedRole(this.extractRole(client))) {
            client.join('admin:orders');
        }
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

    @SubscribeMessage('admin:register')
    handleAdminRegister(@ConnectedSocket() client: Socket) {
        if (!this.isPrivilegedRole(this.extractRole(client))) {
            client.emit('error', {
                event: 'admin:register',
                message: 'Admin yoki superadmin ruxsati talab qilinadi',
            });
            return;
        }

        client.join('admin:orders');
        client.emit('admin:registered', {
            success: true,
            room: 'admin:orders',
        });
    }

    @SubscribeMessage('admin:subscribe_orders')
    handleAdminSubscribeOrders(
        @MessageBody() data: { orderId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        if (!this.isPrivilegedRole(this.extractRole(client))) {
            client.emit('error', {
                event: 'admin:subscribe_orders',
                message: 'Admin yoki superadmin ruxsati talab qilinadi',
            });
            return;
        }

        client.join('admin:orders');
        if (data?.orderId) {
            client.join(`admin:order:${data.orderId}`);
        }

        client.emit('admin:orders_subscribed', {
            success: true,
            order_id: data?.orderId ?? null,
        });
    }

    @SubscribeMessage('admin:unsubscribe_orders')
    handleAdminUnsubscribeOrders(
        @MessageBody() data: { orderId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        if (!this.isPrivilegedRole(this.extractRole(client))) {
            client.emit('error', {
                event: 'admin:unsubscribe_orders',
                message: 'Admin yoki superadmin ruxsati talab qilinadi',
            });
            return;
        }

        if (data?.orderId) {
            client.leave(`admin:order:${data.orderId}`);
        } else {
            client.leave('admin:orders');
        }

        client.emit('admin:orders_unsubscribed', {
            success: true,
            order_id: data?.orderId ?? null,
        });
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

    emitToAdminOrders(event: string, data: any) {
        this.server.to('admin:orders').emit(event, data);
        if (data?.order_id) {
            this.server.to(`admin:order:${data.order_id}`).emit(event, data);
        }
        this.logger.debug(`🛡️ Emit to admin orders: ${event}`);
    }
}
