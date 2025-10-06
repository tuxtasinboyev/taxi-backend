import { Module } from '@nestjs/common';
import { EmailServiceService } from './email-service.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [EmailServiceService],
  exports: [EmailServiceService]
})
export class EmailServiceModule { }
