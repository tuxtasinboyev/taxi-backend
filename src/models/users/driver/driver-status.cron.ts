import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from 'src/config/database/database.service';

@Injectable()
export class DriverStatusCron {
    constructor(private prisma: DatabaseService) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async markInactiveDriversOffline() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        await this.prisma.driver.updateMany({
            where: {
                last_seen_at: { lt: fiveMinutesAgo },
                status: 'online',
            },
            data: { status: 'offline' },
        });

        console.log('⏰ Offline drivers updated');
    }
}
