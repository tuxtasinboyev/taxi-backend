import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redis_client: Redis;

    async onModuleInit() {
        this.redis_client = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        });

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
