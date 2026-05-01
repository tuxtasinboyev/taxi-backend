import { Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from './database/database.module';
import { JwtModules } from './jwt/jwt.module';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from './redis/redis.module';
import { EmailServiceModule } from './email-service/email-service.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
    imports: [
        DatabaseModule,
        JwtModules,
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule,
        RedisModule,
        EmailServiceModule,
        FirebaseModule,
    ],
    exports: [RedisModule, FirebaseModule],
})
export class ConfigModules { }

