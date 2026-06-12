import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
    private readonly logger = new Logger('OrdersScheduler');

    constructor(private readonly ordersService: OrdersService) {}

    // Har 30 soniyada 1 daqiqadan eski pending orderlarni bekor qiladi
    @Cron('*/30 * * * * *')
    async cancelStaleOrders() {
        const cancelled = await this.ordersService.cancelStalePendingOrders(1);
        if (cancelled > 0) {
            this.logger.log(`🗑️ Stale orders cancelled: ${cancelled}`);
        }
    }
}
