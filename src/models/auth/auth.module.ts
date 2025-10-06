import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from 'src/config/database/database.module';
import { JwtModules } from 'src/config/jwt/jwt.module';
import { ConfigModules } from 'src/config/config.module';
import { OtpModule } from 'src/config/email-service/otp/otp.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports:[DatabaseModule,JwtModules,ConfigModule,OtpModule],
  providers: [AuthService],
  controllers: [AuthController]
})
export class AuthModule {}
