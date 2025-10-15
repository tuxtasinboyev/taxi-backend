import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { SocketGateway } from './socket/socket.gateway';
import { PriceModule } from './price/price.module';
import { LocationModule } from './orders/locations/locations.module';

@Module({
  imports: [AuthModule, UsersModule, OrdersModule, PriceModule,LocationModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class ModelsModule { }
