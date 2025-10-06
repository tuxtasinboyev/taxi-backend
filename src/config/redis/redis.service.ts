import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redis_client: Redis;

    async onModuleInit() {
        this.redis_client = new Redis('rediss://default:AU27AAIncDJiOWFiN2YzMjZjMzc0NGVhOGMwZDFlNjdjNGM3Y2UzZXAyMTk4OTk@driving-finch-19899.upstash.io:6379');

        this.redis_client.on('connect', () => {
            console.log('✅ Redis connected');
        });

        this.redis_client.on('error', (err) => {
            console.error('❌ Redis error:', err);
        });
    }

    async set(key: string, value: string, ttlSeconds?: number) {
        if (ttlSeconds) {
            await this.redis_client.set(key, value, 'EX', ttlSeconds);
        } else {
            await this.redis_client.set(key, value);
        }
    }

    async get(key: string): Promise<string | null> {
        return this.redis_client.get(key);
    }

    async del(key: string) {
        return this.redis_client.del(key);
    }

    async onModuleDestroy() {
        await this.redis_client.quit();
    }
}
