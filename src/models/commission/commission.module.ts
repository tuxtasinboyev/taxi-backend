import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/config/database/database.module';
import { CommissionController } from './commission.controller';
import { CommissionScheduler } from './commission.scheduler';
import { CommissionService } from './commission.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CommissionController],
  providers: [CommissionService, CommissionScheduler],
  exports: [CommissionService],
})
export class CommissionModule {}
