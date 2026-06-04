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
    @WebSocketServer() server!: Server;
    private logger = new Logger('SocketGateway');

    private clients = new Map<string, ConnectedClient>();

    private extractRole(client: Socket) {
        return (client.handshake.auth.role || client.handshake.query.role) as string | undefined;
    }

    private isPrivilegedRole(role?: string) {
        return role === 'admin' || role === 'superadmin';
    }

    handleConnection(client: Socket) {
        this.logger.log(`✅ Socket connected: ${client.id}, role=${this.extractRole(client) ?? 'unknown'}`);
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

    @SubscribeMessage('register')
    handleRegister(
        @MessageBody() data: { userId?: string; driverId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        this.logger.debug(
            `🆔 Incoming register on /ws: socket=${client.id}, userId=${data?.userId}, driverId=${data?.driverId}`,
        );
        this.registerUser(client, data ?? {});
        client.emit('registered', {
            success: true,
            socketId: client.id,
            userId: data?.userId ?? null,
            driverId: data?.driverId ?? null,
        });
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
        let delivered = 0;
        for (const client of this.clients.values()) {
            if (client.driverId === driverId) {
                this.server.to(client.socketId).emit(event, data);
                delivered += 1;
                this.logger.debug(`📤 Emit to driver ${driverId}: ${event} -> socket ${client.socketId}`);
            }
        }
        if (delivered === 0) {
            this.logger.warn(`⚠️ No registered driver sockets found for driverId=${driverId} while emitting ${event}`);
        }
    }

    emitToUser(userId: string, event: string, data: any) {
        let delivered = 0;
        for (const client of this.clients.values()) {
            if (client.userId === userId) {
                this.server.to(client.socketId).emit(event, data);
                delivered += 1;
                this.logger.debug(`📤 Emit to user ${userId}: ${event} -> socket ${client.socketId}`);
            }
        }
        if (delivered === 0) {
            this.logger.warn(`⚠️ No registered user sockets found for userId=${userId} while emitting ${event}`);
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
