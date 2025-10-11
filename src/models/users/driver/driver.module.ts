import { Module } from '@nestjs/common';
import { DriverStatusCron } from './driver-status.cron';
import { DriverController } from './driver.controller';
import { DriverGateway } from './driver.gateway';
import { DriverService } from './driver.service';
import { DatabaseModule } from 'src/config/database/database.module';
import { ConfigModules } from 'src/config/config.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports:[DatabaseModule,ConfigModules,JwtModule],
  providers: [DriverService, DriverGateway, DriverStatusCron],
  controllers: [DriverController]
})
export class DriverModule { }
