
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationService } from './locations.service';

@Injectable()
export class LocationScheduler {
    private logger = new Logger('LocationScheduler');

    constructor(private locationService: LocationService) { }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cleanupOldLocations() {
        this.logger.log('🧹 Starting location cleanup...');
        const result = await this.locationService.cleanupOldLocations(7);
        this.logger.log(`✅ Cleanup completed: ${JSON.stringify(result)}`);
    }

    // Har 30 minutda database ga batch save qilish
    @Cron('*/30 * * * *')
    async batchSaveLocations() {
        this.logger.debug('💾 Batch saving locations to database...');
        // Bu location gateway dan real-time data olib database ga saqlaydi
    }
}