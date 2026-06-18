import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommissionService } from './commission.service';

@Injectable()
export class CommissionScheduler {
  constructor(private readonly commissionService: CommissionService) {}

  // Har 5 daqiqada — 5 daqiqadan eski pending paymentlarni bekor qiladi
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelStalePendingPayments() {
    await this.commissionService.cancelStalePendingPayments();
  }
}
