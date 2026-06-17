import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/config/database/database.module';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
