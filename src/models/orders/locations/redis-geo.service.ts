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

        // 🛡️ Agresiv tekshiruv va Numberga o'girish
        const longitude = Number(lng);
        const latitude = Number(lat);
        const radius = Number(radiusKm);

        // Terminalda tekshirib olamiz
        console.log('--- REDIS DEBUG START ---');
        console.log('Lng:', longitude, typeof longitude);
        console.log('Lat:', latitude, typeof latitude);
        console.log('Radius:', radius, typeof radius);
        console.log('--- REDIS DEBUG END ---');

        // Agar bulardan biri NaN bo'lsa, Redis xato beradi. Shuning uchun oldini olamiz:
        if (isNaN(longitude) || isNaN(latitude) || isNaN(radius)) {
            console.error('XATO: Redisga yuborilayotgan qiymat float emas!');
            return [];
        }

        try {
            const result = (await redis.georadius(
                this.GEO_KEY,
                longitude, // 1. Longitude
                latitude,  // 2. Latitude
                radius,    // 3. Radius
                'km',
                'WITHDIST'
            )) as [string, string][];

            return result ? result.map(([id, distance]) => ({
                driverId: id,
                distanceKm: parseFloat(distance),
            })) : [];
        } catch (error) {
            console.error('Redis Georadius Error:', error.message);
            throw error;
        }
    }
}
