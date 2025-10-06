import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { EmailServiceModule } from '../email-service.module';
import { RedisModule } from 'src/config/redis/redis.module';

@Module({
  imports: [EmailServiceModule,RedisModule],
  providers: [OtpService],
  controllers: [OtpController],
  exports:[OtpService]
})
export class OtpModule {}
