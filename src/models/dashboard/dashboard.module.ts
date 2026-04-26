import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/config/database/database.module';
import { ConfigModules } from 'src/config/config.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
    imports: [DatabaseModule, ConfigModules],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}
