import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from 'src/config/database/database.service';
import { ClickCallbackDto, InitiateCommissionPaymentDto } from './dto/commission.dto';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: DatabaseService) {}

  private get clickSecretKey() {
    return process.env.CLICK_SECRET_KEY ?? '';
  }

  private md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  // ─── Driver endpoints ────────────────────────────────────────────────────────

  async getMyUnpaidSummary(driver_id: string) {
    const commissions = await this.prisma.driverCommission.findMany({
      where: { driver_id, status: 'unpaid' },
      include: {
        order: { select: { from_address: true, to_address: true, price: true } },
      },
      orderBy: { work_date: 'asc' },
    });

    const byDate: Record<string, { date: string; total: number; count: number; orders: any[] }> = {};
    for (const c of commissions) {
      const key = c.work_date.toISOString().split('T')[0];
      if (!byDate[key]) byDate[key] = { date: key, total: 0, count: 0, orders: [] };
      byDate[key].total += Number(c.commission_amount);
      byDate[key].count++;
      byDate[key].orders.push({
        order_id: c.order_id,
        order_amount: Number(c.order_amount),
        commission_amount: Number(c.commission_amount),
        from: c.order.from_address,
        to: c.order.to_address,
      });
    }

    const total_unpaid = commissions.reduce(
      (sum, c) => sum + Number(c.commission_amount),
      0,
    );

    return {
      success: true,
      total_unpaid,
      days: Object.values(byDate),
    };
  }

  async getMyPaymentHistory(driver_id: string) {
    const payments = await this.prisma.driverCommissionPayment.findMany({
      where: { driver_id },
      include: {
        commissions: {
          select: { id: true, order_id: true, commission_amount: true, work_date: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        from_date: p.from_date,
        to_date: p.to_date,
        paid_at: p.paid_at,
        created_at: p.created_at,
        orders_count: p.commissions.length,
      })),
    };
  }

  private buildClickUrl(paymentId: string, amount: number): string {
    const serviceId = process.env.CLICK_SERVICE_ID;
    const merchantId = process.env.CLICK_MERCHANT_ID;
    const payUrl = process.env.CLICK_PAY_URL ?? 'https://my.click.uz/services/pay';
    const returnUrl = process.env.CLICK_RETURN_URL ?? '';
    return (
      `${payUrl}?service_id=${serviceId}&merchant_id=${merchantId}` +
      `&amount=${amount}&transaction_param=${paymentId}` +
      (returnUrl ? `&return_url=${encodeURIComponent(returnUrl)}` : '')
    );
  }

  async getPendingPayment(driver_id: string) {
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 daqiqa
    const cutoff = new Date(Date.now() - TIMEOUT_MS);

    const payment = await this.prisma.driverCommissionPayment.findFirst({
      where: { driver_id, status: 'pending', created_at: { gte: cutoff } },
      orderBy: { created_at: 'desc' },
    });

    if (!payment) return { success: true, has_pending: false, data: null };

    return {
      success: true,
      has_pending: true,
      data: {
        payment_id: payment.id,
        amount: Number(payment.amount),
        status: payment.status,
        from_date: payment.from_date,
        to_date: payment.to_date,
        created_at: payment.created_at,
        click_url: this.buildClickUrl(payment.id, Number(payment.amount)),
      },
    };
  }

  async initiatePayment(driver_id: string, dto: InitiateCommissionPaymentDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driver_id } });
    if (!driver) throw new NotFoundException('Driver not found');

    const TIMEOUT_MS = 5 * 60 * 1000; // 5 daqiqa
    const cutoff = new Date(Date.now() - TIMEOUT_MS);

    // Faol pending payment bor bo'lsa (30 daqiqadan yangi) — o'shani qaytaramiz
    const existingPending = await this.prisma.driverCommissionPayment.findFirst({
      where: { driver_id, status: 'pending', created_at: { gte: cutoff } },
      orderBy: { created_at: 'desc' },
    });

    if (existingPending) {
      this.logger.log(`Existing pending payment found: id=${existingPending.id}, returning click_url`);
      return {
        success: true,
        resumed: true,
        payment_id: existingPending.id,
        amount: Number(existingPending.amount),
        click_url: this.buildClickUrl(existingPending.id, Number(existingPending.amount)),
      };
    }

    const sortedDates = [...dto.dates].sort();
    const fromDate = new Date(sortedDates[0] + 'T00:00:00');
    const toDate = new Date(sortedDates[sortedDates.length - 1] + 'T23:59:59');

    // Eskirgan (30 daqiqadan eski) pending paymentlarni bekor qilish
    const stale = await this.prisma.driverCommission.findMany({
      where: { driver_id, status: 'pending' },
      select: { payment_id: true },
    });
    const stalePIds = [...new Set(stale.map((c) => c.payment_id).filter(Boolean))];
    if (stalePIds.length) {
      await this.prisma.driverCommission.updateMany({
        where: { driver_id, status: 'pending' },
        data: { status: 'unpaid', payment_id: null },
      });
      await this.prisma.driverCommissionPayment.updateMany({
        where: { id: { in: stalePIds as string[] }, status: 'pending' },
        data: { status: 'cancelled' },
      });
    }

    const commissions = await this.prisma.driverCommission.findMany({
      where: {
        driver_id,
        status: 'unpaid',
        work_date: { gte: fromDate, lte: toDate },
      },
    });

    if (!commissions.length) {
      throw new BadRequestException('Bu kunlar uchun to\'lanmagan komisyon topilmadi');
    }

    const totalAmount = commissions.reduce(
      (sum, c) => sum + Number(c.commission_amount),
      0,
    );

    const paymentId = crypto.randomUUID();

    const payment = await this.prisma.driverCommissionPayment.create({
      data: {
        id: paymentId,
        driver_id,
        amount: totalAmount,
        status: 'pending',
        merchant_trans_id: paymentId,
        from_date: fromDate,
        to_date: toDate,
      },
    });

    await this.prisma.driverCommission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { status: 'pending', payment_id: payment.id },
    });

    const clickUrl = this.buildClickUrl(payment.id, totalAmount);

    this.logger.log(`Commission payment initiated: driver=${driver_id} amount=${totalAmount} id=${payment.id}`);

    return {
      success: true,
      payment_id: payment.id,
      amount: totalAmount,
      click_url: clickUrl,
    };
  }

  // ─── Click callbacks ─────────────────────────────────────────────────────────

  async handlePrepare(dto: ClickCallbackDto) {
    const expectedSign = this.md5(
      `${dto.click_trans_id}${dto.service_id}${this.clickSecretKey}` +
      `${dto.merchant_trans_id}${dto.amount}${dto.action}${dto.sign_time}`,
    );

    if (expectedSign !== dto.sign_string) {
      return this.clickError(dto, -1, 'Sign validation failed');
    }

    const payment = await this.prisma.driverCommissionPayment.findUnique({
      where: { merchant_trans_id: dto.merchant_trans_id },
    });

    if (!payment) return this.clickError(dto, -5, 'Transaction not found');

    if (payment.status === 'success') return this.clickError(dto, -4, 'Already paid');

    if (payment.status === 'failed' || payment.status === 'cancelled') {
      return this.clickError(dto, -9, 'Transaction cancelled');
    }

    if (Math.abs(Number(payment.amount) - Number(dto.amount)) > 0.01) {
      return this.clickError(dto, -2, 'Incorrect amount');
    }

    await this.prisma.driverCommissionPayment.update({
      where: { id: payment.id },
      data: {
        click_trans_id: BigInt(dto.click_trans_id),
        click_paydoc_id: BigInt(dto.click_paydoc_id),
      },
    });

    return {
      click_trans_id: Number(dto.click_trans_id),
      merchant_trans_id: dto.merchant_trans_id,
      merchant_prepare_id: Number(dto.click_trans_id),
      error: 0,
      error_note: 'Success',
    };
  }

  async handleComplete(dto: ClickCallbackDto) {
    const expectedSign = this.md5(
      `${dto.click_trans_id}${dto.service_id}${this.clickSecretKey}` +
      `${dto.merchant_trans_id}${dto.merchant_prepare_id}${dto.amount}${dto.action}${dto.sign_time}`,
    );

    if (expectedSign !== dto.sign_string) {
      return this.clickError(dto, -1, 'Sign validation failed');
    }

    const payment = await this.prisma.driverCommissionPayment.findUnique({
      where: { merchant_trans_id: dto.merchant_trans_id },
      include: { commissions: { select: { id: true } } },
    });

    if (!payment) return this.clickError(dto, -5, 'Transaction not found');

    if (payment.status === 'success') return this.clickError(dto, -4, 'Already paid');

    if (payment.status === 'cancelled') return this.clickError(dto, -9, 'Transaction cancelled');

    // Verify merchant_prepare_id matches click_trans_id we stored in prepare
    if (Number(payment.click_trans_id) !== Number(dto.merchant_prepare_id)) {
      return this.clickError(dto, -5, 'Transaction not found');
    }

    if (Math.abs(Number(payment.amount) - Number(dto.amount)) > 0.01) {
      return this.clickError(dto, -2, 'Incorrect amount');
    }

    // Click returned an error — cancel payment
    if (Number(dto.error) < 0) {
      await this.prisma.$transaction([
        this.prisma.driverCommissionPayment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        }),
        this.prisma.driverCommission.updateMany({
          where: { payment_id: payment.id },
          data: { status: 'unpaid', payment_id: null },
        }),
      ]);
      return this.clickError(dto, -9, 'Payment cancelled by user');
    }

    await this.prisma.$transaction([
      this.prisma.driverCommissionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'success',
          paid_at: new Date(),
          click_trans_id: BigInt(dto.click_trans_id),
        },
      }),
      this.prisma.driverCommission.updateMany({
        where: { payment_id: payment.id },
        data: { status: 'paid' },
      }),
    ]);

    this.logger.log(`Commission payment success: id=${payment.id} amount=${Number(payment.amount)}`);

    return {
      click_trans_id: Number(dto.click_trans_id),
      merchant_trans_id: dto.merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: 'Success',
    };
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  async getAdminDriversCommissions(params: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = params;
    const where: any = {};
    if (status) where.status = status;

    const [total, drivers] = await Promise.all([
      this.prisma.driverCommissionPayment.groupBy({
        by: ['driver_id'],
        _count: { id: true },
      }).then((r) => r.length),
      this.prisma.driver.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name_uz: true, phone: true } },
          commissions: {
            where: where,
            select: { commission_amount: true, status: true },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: drivers.map((d) => {
        const unpaid = d.commissions
          .filter((c) => c.status === 'unpaid')
          .reduce((s, c) => s + Number(c.commission_amount), 0);
        const paid = d.commissions
          .filter((c) => c.status === 'paid')
          .reduce((s, c) => s + Number(c.commission_amount), 0);
        return {
          driver_id: d.id,
          name: d.user?.name_uz,
          phone: d.user?.phone,
          car_number: d.car_number,
          unpaid_total: unpaid,
          paid_total: paid,
        };
      }),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAdminDriverDetail(driver_id: string, params: { from?: string; to?: string }) {
    const where: any = { driver_id };
    if (params.from) where.work_date = { gte: new Date(params.from) };
    if (params.to) where.work_date = { ...(where.work_date ?? {}), lte: new Date(params.to + 'T23:59:59') };

    const [driver, commissions, payments] = await Promise.all([
      this.prisma.driver.findUnique({
        where: { id: driver_id },
        include: { user: { select: { name_uz: true, phone: true } } },
      }),
      this.prisma.driverCommission.findMany({
        where,
        orderBy: { work_date: 'desc' },
        include: { order: { select: { from_address: true, to_address: true } } },
      }),
      this.prisma.driverCommissionPayment.findMany({
        where: { driver_id },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    if (!driver) throw new NotFoundException('Driver not found');

    return {
      success: true,
      driver: {
        id: driver.id,
        name: driver.user?.name_uz,
        phone: driver.user?.phone,
        car_number: driver.car_number,
      },
      commissions: commissions.map((c) => ({
        id: c.id,
        order_id: c.order_id,
        order_amount: Number(c.order_amount),
        commission_amount: Number(c.commission_amount),
        percent: Number(c.percent),
        work_date: c.work_date,
        status: c.status,
        from: c.order.from_address,
        to: c.order.to_address,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        from_date: p.from_date,
        to_date: p.to_date,
        paid_at: p.paid_at,
        created_at: p.created_at,
      })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // ─── Scheduler: 30 daqiqadan eski pending paymentlarni bekor qilish ─────────

  async cancelStalePendingPayments() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);

    const stalePayments = await this.prisma.driverCommissionPayment.findMany({
      where: { status: 'pending', created_at: { lt: cutoff } },
      select: { id: true },
    });

    if (!stalePayments.length) return;

    const ids = stalePayments.map((p) => p.id);

    await this.prisma.$transaction([
      this.prisma.driverCommissionPayment.updateMany({
        where: { id: { in: ids } },
        data: { status: 'cancelled' },
      }),
      this.prisma.driverCommission.updateMany({
        where: { payment_id: { in: ids }, status: 'pending' },
        data: { status: 'unpaid', payment_id: null },
      }),
    ]);

    this.logger.log(`Cancelled ${ids.length} stale pending payment(s), commissions reset to unpaid`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private clickError(dto: ClickCallbackDto, code: number, note: string) {
    return {
      click_trans_id: Number(dto.click_trans_id),
      merchant_trans_id: dto.merchant_trans_id,
      error: code,
      error_note: note,
    };
  }
}
