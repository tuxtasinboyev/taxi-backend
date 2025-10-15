    import {
        WebSocketGateway,
        SubscribeMessage,
        MessageBody,
        ConnectedSocket,
    } from '@nestjs/websockets';
    import { Socket } from 'socket.io';
    import { OrdersService } from '../orders/orders.service';

    @WebSocketGateway({ cors: true })
    export class OrdersGateway {
        constructor(private readonly ordersService: OrdersService) { }

        // 🚖 Haydovchi zakasni qabul qiladi
        @SubscribeMessage('order:accept')
        async handleAccept(
            @MessageBody() data: { driverId: string; orderId: string },
            @ConnectedSocket() client: Socket,
        ) {
            const order = await this.ordersService.acceptOrder(data.driverId, data.orderId);
            client.emit('order:accepted', order);
        }
    }
