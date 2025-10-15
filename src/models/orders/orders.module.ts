import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RedisGeoService } from './locations/redis-geo.service';
import { LocationGateway } from './locations/location.chatgetaway'; // Socket orqali joylashuv uchun
import { DatabaseService } from 'src/config/database/database.service';
import { OrdersGateway } from './order.gataway';
import { DatabaseModule } from 'src/config/database/database.module';
import { RedisModule } from 'src/config/redis/redis.module';
import { SocketGateway } from '../socket/socket.gateway';

@Module({
  imports: [DatabaseModule,RedisModule,], // hozircha boshqa module kerak emas
  controllers: [OrdersController],
  providers: [
    OrdersService,
    RedisGeoService,
    LocationGateway,
    DatabaseService,
    OrdersGateway,
    SocketGateway
  ],
  exports: [OrdersService],
})
export class OrdersModule { }
