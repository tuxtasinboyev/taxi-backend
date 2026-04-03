import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from 'src/common/common.module';
import { DatabaseModule } from 'src/config/database/database.module';
import { OtpModule } from 'src/config/email-service/otp/otp.module';
import { JwtModules } from 'src/config/jwt/jwt.module';
import { RedisModule } from 'src/config/redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule, JwtModules, ConfigModule, OtpModule, RedisModule, CommonModule],
  providers: [AuthService],
  controllers: [AuthController]
})
export class AuthModule { }
