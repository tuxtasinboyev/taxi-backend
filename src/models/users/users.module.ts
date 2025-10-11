import { Module } from '@nestjs/common';
import { ConfigModules } from 'src/config/config.module';
import { DatabaseModule } from 'src/config/database/database.module';
import { DriverStatusCron } from './driver/driver-status.cron';
import { DriverModule } from './driver/driver.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule, ConfigModules, DriverModule],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule { }
