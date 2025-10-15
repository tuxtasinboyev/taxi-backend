import { Module, forwardRef } from '@nestjs/common';
import { LocationGateway } from './location.chatgetaway';
import { LocationService } from './locations.service';
import { LocationController } from './locations.controller';
import { LocationScheduler } from './location.scheduler';
import { DatabaseService } from 'src/config/database/database.service';
import { RedisService } from 'src/config/redis/redis.service';
import { RedisGeoService } from './redis-geo.service'; // ✅ shu faylni import qil

@Module({
  controllers: [LocationController],
  providers: [
    LocationGateway,
    LocationService,
    LocationScheduler,
    DatabaseService,
    RedisService,      // ✅ Redis connection
    RedisGeoService,   // ✅ Redis GEO logika
  ],
  exports: [LocationService, RedisGeoService], // eksport qilamiz, kerak bo‘lsa boshqa modullarda ishlatish uchun
})
export class LocationModule { }
