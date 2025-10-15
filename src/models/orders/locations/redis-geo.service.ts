import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/config/redis/redis.service';

@Injectable()
export class RedisGeoService {
    private readonly GEO_KEY = 'drivers:geo';

    constructor(private readonly redisService: RedisService) { }

    async updateDriverLocation(driverId: string, lat: number, lng: number) {
        const redis = this.redisService['redis_client'];
        await redis.geoadd(this.GEO_KEY, lng, lat, driverId);
    }

    async removeDriver(driverId: string) {
        const redis = this.redisService['redis_client'];
        await redis.zrem(this.GEO_KEY, driverId);
    }

    async getNearbyDrivers(lat: number, lng: number, radiusKm = 3) {
        const redis = this.redisService['redis_client'];
        const result = (await redis.georadius(
            this.GEO_KEY,
            lng,
            lat,
            radiusKm,
            'km',
            'WITHDIST'
        )) as [string, string][]; // ✅ <-- shu joy to‘g‘rilandi

        return result.map(([id, distance]) => ({
            driverId: id,
            distanceKm: parseFloat(distance),
        }));
    }
}
