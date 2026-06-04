    import {
        WebSocketGateway,
        SubscribeMessage,
        MessageBody,
        ConnectedSocket,
    } from '@nestjs/websockets';
    import { Socket } from 'socket.io';
    import { OrdersService } from '../orders/orders.service';
import { SocketGateway } from '../socket/socket.gateway';

    @WebSocketGateway({ cors: true })
    export class OrdersGateway {
        constructor(private readonly ordersService: OrdersService,private socketGateway: SocketGateway) { }
        @SubscribeMessage('order:accept')
        async handleAccept(
            @MessageBody() data: { driverId: string; orderId: string },
            @ConnectedSocket() client: Socket,
        ) {
            const order = await this.ordersService.acceptOrder(data.driverId, data.orderId);

            // ✅ Haydovchiga tasdiq (faqat o‘ziga)
            client.emit('order:accepted', {
                order_id: order.id,
                status: order.status,
                message: 'Siz bu zakasni qabul qildingiz ✅',
            });
        }
        @SubscribeMessage('register')
        handleRegister(
            @MessageBody() data: { userId?: string; driverId?: string },
            @ConnectedSocket() client: Socket,
        ) {
            this.socketGateway.registerUser(client, data);
        }


    }
