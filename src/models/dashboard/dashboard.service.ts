import { Injectable } from '@nestjs/common';
import { DriverStatus, OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';

type Period = 'day' | 'week' | 'month' | 'year';

// ── Response types ──────────────────────────────────────────────────────────

export interface OverviewStatsResponse {
    success: boolean;
    data: {
        users: { total: number; drivers: number };
        orders: {
            total: number;
            completed: number;
            cancelled: number;
            pending: number;
            active: number;
        };
        revenue: { total: number };
        other: { active_promo_codes: number; active_categories: number };
    };
}

export interface SummaryCardsResponse {
    success: boolean;
    data: {
        today_orders: number;
        month_orders: number;
        order_growth_percent: number | null;
        today_revenue: number;
        month_revenue: number;
        revenue_growth_percent: number | null;
        new_users_this_month: number;
        user_growth_percent: number | null;
        online_drivers: number;
        total_drivers: number;
        driver_online_percent: number;
    };
}

export interface OrderStatsByStatus {
    status: OrderStatus;
    count: number;
}

export interface OrderStatsByCategory {
    category_id: string | null;
    category_name: string;
    count: number;
    total_revenue: number;
}

export interface DailyOrderChart {
    date: string;
    count: number;
    revenue: number;
}

export interface OrderStatsResponse {
    success: boolean;
    data: {
        period: Period;
        total_in_period: number;
        by_status: OrderStatsByStatus[];
        by_category: OrderStatsByCategory[];
        daily_chart: DailyOrderChart[];
    };
}

export interface RevenueByMethod {
    method: PaymentMethod;
    count: number;
    total: number;
}

export interface DailyRevenueChart {
    date: string;
    revenue: number;
}

export interface RevenueStatsResponse {
    success: boolean;
    data: {
        period: Period;
        total_revenue: number;
        total_transactions: number;
        failed_amount: number;
        pending_amount: number;
        by_method: RevenueByMethod[];
        daily_chart: DailyRevenueChart[];
    };
}

export interface TopDriver {
    id: string;
    name: string | null;
    phone: string;
    photo: string | null;
    car_model: string | null;
    car_number: string;
    status: DriverStatus;
    rating: number;
    completed_orders: number;
    category: string | null;
}

export interface DriverStatsResponse {
    success: boolean;
    data: {
        total: number;
        online: number;
        offline: number;
        busy: number;
        average_rating: number;
        top_drivers: TopDriver[];
    };
}

export interface TopPassenger {
    id: string;
    name: string | null;
    phone: string;
    photo: string | null;
    total_orders: number;
}

export interface DailyRegistrationChart {
    date: string;
    count: number;
}

export interface UserStatsResponse {
    success: boolean;
    data: {
        period: Period;
        total: number;
        new_in_period: number;
        by_role: { role: UserRole; count: number }[];
        top_passengers: TopPassenger[];
        registration_chart: DailyRegistrationChart[];
    };
}

export interface RecentOrder {
    id: string;
    status: OrderStatus;
    price: number;
    distance_km: number;
    created_at: Date;
    user_name: string | null;
    user_phone: string;
    driver_name: string | null;
    driver_phone: string | null;
    category: string | null;
    payment_method: PaymentMethod | null;
    payment_status: PaymentStatus | null;
}

export interface RecentPayment {
    id: string;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    paid_at: Date | null;
    created_at: Date;
    order_id: string;
    user_name: string | null;
    user_phone: string | null;
}

export interface RecentUser {
    id: string;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
    phone: string;
    role: UserRole;
    created_at: Date;
    profile_photo: string | null;
}

export interface RecentActivityResponse {
    success: boolean;
    data: {
        recent_orders: RecentOrder[];
        recent_payments: RecentPayment[];
        recent_users: RecentUser[];
    };
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: DatabaseService) {}

    private getPeriodStart(period: Period): Date {
        const now = new Date();
        switch (period) {
            case 'day':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case 'week': {
                const d = new Date(now);
                d.setDate(now.getDate() - 7);
                return d;
            }
            case 'month':
                return new Date(now.getFullYear(), now.getMonth(), 1);
            case 'year':
                return new Date(now.getFullYear(), 0, 1);
        }
    }

    async getOverviewStats(): Promise<OverviewStatsResponse> {
        const [
            totalUsers,
            totalDrivers,
            totalOrders,
            completedOrders,
            cancelledOrders,
            pendingOrders,
            totalRevenue,
            activePromoCodes,
            totalCategories,
        ] = await Promise.all([
            this.prisma.user.count({ where: { role: UserRole.passenger } }),
            this.prisma.user.count({ where: { role: UserRole.driver } }),
            this.prisma.order.count(),
            this.prisma.order.count({ where: { status: OrderStatus.completed } }),
            this.prisma.order.count({ where: { status: OrderStatus.cancelled } }),
            this.prisma.order.count({ where: { status: OrderStatus.pending } }),
            this.prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: PaymentStatus.success },
            }),
            this.prisma.promoCode.count({ where: { is_active: true } }),
            this.prisma.taxiCategory.count({ where: { is_active: true } }),
        ]);

        return {
            success: true,
            data: {
                users: { total: totalUsers, drivers: totalDrivers },
                orders: {
                    total: totalOrders,
                    completed: completedOrders,
                    cancelled: cancelledOrders,
                    pending: pendingOrders,
                    active: totalOrders - completedOrders - cancelledOrders,
                },
                revenue: { total: Number(totalRevenue._sum.amount ?? 0) },
                other: {
                    active_promo_codes: activePromoCodes,
                    active_categories: totalCategories,
                },
            },
        };
    }

    async getOrderStats(period: Period = 'month'): Promise<OrderStatsResponse> {
        const startDate = this.getPeriodStart(period);

        const [byStatus, ordersInPeriod, byCategory] = await Promise.all([
            this.prisma.order.groupBy({
                by: ['status'],
                _count: { id: true },
            }),
            this.prisma.order.findMany({
                where: { created_at: { gte: startDate } },
                select: {
                    id: true,
                    status: true,
                    price: true,
                    created_at: true,
                },
                orderBy: { created_at: 'asc' },
            }),
            this.prisma.order.groupBy({
                by: ['taxiCategoryId'],
                _count: { id: true },
                _sum: { price: true },
                where: { created_at: { gte: startDate } },
            }),
        ]);

        const categoryIds = byCategory
            .filter((c) => c.taxiCategoryId !== null)
            .map((c) => c.taxiCategoryId as string);

        const categories = await this.prisma.taxiCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name_uz: true },
        });

        const categoryMap = new Map<string, string>(
            categories.map((c) => [c.id, c.name_uz ?? 'Nomalum']),
        );

        const byCategoryMapped: OrderStatsByCategory[] = byCategory.map((c) => ({
            category_id: c.taxiCategoryId,
            category_name: c.taxiCategoryId
                ? (categoryMap.get(c.taxiCategoryId) ?? 'Nomalum')
                : 'Kategoriyasiz',
            count: c._count.id,
            total_revenue: Number(c._sum.price ?? 0),
        }));

        const ordersByDate = new Map<string, { count: number; revenue: number }>();
        for (const order of ordersInPeriod) {
            const key = order.created_at.toISOString().split('T')[0];
            const existing = ordersByDate.get(key) ?? { count: 0, revenue: 0 };
            existing.count++;
            existing.revenue += Number(order.price ?? 0);
            ordersByDate.set(key, existing);
        }

        const dailyChart: DailyOrderChart[] = Array.from(ordersByDate.entries()).map(
            ([date, val]) => ({ date, count: val.count, revenue: val.revenue }),
        );

        return {
            success: true,
            data: {
                period,
                total_in_period: ordersInPeriod.length,
                by_status: byStatus.map((s) => ({
                    status: s.status,
                    count: s._count.id,
                })),
                by_category: byCategoryMapped,
                daily_chart: dailyChart,
            },
        };
    }

    async getRevenueStats(period: Period = 'month'): Promise<RevenueStatsResponse> {
        const startDate = this.getPeriodStart(period);

        const [byMethod, totalSuccess, totalFailed, totalPending, paymentsInPeriod] =
            await Promise.all([
                this.prisma.payment.groupBy({
                    by: ['method'],
                    _count: { id: true },
                    _sum: { amount: true },
                    where: { status: PaymentStatus.success, paid_at: { gte: startDate } },
                }),
                this.prisma.payment.aggregate({
                    _sum: { amount: true },
                    _count: { id: true },
                    where: { status: PaymentStatus.success, paid_at: { gte: startDate } },
                }),
                this.prisma.payment.aggregate({
                    _sum: { amount: true },
                    _count: { id: true },
                    where: { status: PaymentStatus.failed, paid_at: { gte: startDate } },
                }),
                this.prisma.payment.aggregate({
                    _sum: { amount: true },
                    _count: { id: true },
                    where: { status: PaymentStatus.pending, created_at: { gte: startDate } },
                }),
                this.prisma.payment.findMany({
                    where: { status: PaymentStatus.success, paid_at: { gte: startDate } },
                    select: { amount: true, paid_at: true },
                    orderBy: { paid_at: 'asc' },
                }),
            ]);

        const revenueByDate = new Map<string, number>();
        for (const p of paymentsInPeriod) {
            if (!p.paid_at) continue;
            const key = p.paid_at.toISOString().split('T')[0];
            revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(p.amount ?? 0));
        }

        const dailyChart: DailyRevenueChart[] = Array.from(revenueByDate.entries()).map(
            ([date, revenue]) => ({ date, revenue }),
        );

        return {
            success: true,
            data: {
                period,
                total_revenue: Number(totalSuccess._sum.amount ?? 0),
                total_transactions: totalSuccess._count.id,
                failed_amount: Number(totalFailed._sum.amount ?? 0),
                pending_amount: Number(totalPending._sum.amount ?? 0),
                by_method: byMethod.map((m) => ({
                    method: m.method,
                    count: m._count.id,
                    total: Number(m._sum.amount ?? 0),
                })),
                daily_chart: dailyChart,
            },
        };
    }

    async getDriverStats(): Promise<DriverStatsResponse> {
        const [total, online, offline, busy, topDrivers, avgRating] = await Promise.all([
            this.prisma.driver.count(),
            this.prisma.driver.count({ where: { status: DriverStatus.online } }),
            this.prisma.driver.count({ where: { status: DriverStatus.offline } }),
            this.prisma.driver.count({ where: { status: DriverStatus.busy } }),
            this.prisma.driver.findMany({
                take: 10,
                orderBy: { rating: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name_uz: true,
                            phone: true,
                            profile_photo: true,
                        },
                    },
                    taxiCategory: { select: { name_uz: true } },
                },
            }),
            this.prisma.driver.aggregate({ _avg: { rating: true } }),
        ]);

        const topDriversMapped: TopDriver[] = await Promise.all(
            topDrivers.map(async (driver) => {
                const completedOrders = await this.prisma.order.count({
                    where: { driver_id: driver.id, status: OrderStatus.completed },
                });
                return {
                    id: driver.id,
                    name: driver.user.name_uz,
                    phone: driver.user.phone,
                    photo: driver.user.profile_photo,
                    car_model: driver.car_model_uz,
                    car_number: driver.car_number,
                    status: driver.status,
                    rating: Number(driver.rating ?? 0),
                    completed_orders: completedOrders,
                    category: driver.taxiCategory?.name_uz ?? null,
                };
            }),
        );

        return {
            success: true,
            data: {
                total,
                online,
                offline,
                busy,
                average_rating: Number(avgRating._avg.rating ?? 0),
                top_drivers: topDriversMapped,
            },
        };
    }

    async getUserStats(period: Period = 'month'): Promise<UserStatsResponse> {
        const startDate = this.getPeriodStart(period);

        const [total, newInPeriod, byRole, topPassengers, newUsersInPeriod] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { created_at: { gte: startDate } } }),
            this.prisma.user.groupBy({
                by: ['role'],
                _count: { id: true },
            }),
            this.prisma.user.findMany({
                where: { role: UserRole.passenger },
                take: 10,
                orderBy: { orders: { _count: 'desc' } },
                select: {
                    id: true,
                    name_uz: true,
                    phone: true,
                    profile_photo: true,
                    _count: { select: { orders: true } },
                },
            }),
            this.prisma.user.findMany({
                where: { created_at: { gte: startDate } },
                select: { created_at: true },
                orderBy: { created_at: 'asc' },
            }),
        ]);

        const registrationByDate = new Map<string, number>();
        for (const user of newUsersInPeriod) {
            const key = user.created_at.toISOString().split('T')[0];
            registrationByDate.set(key, (registrationByDate.get(key) ?? 0) + 1);
        }

        const registrationChart: DailyRegistrationChart[] = Array.from(
            registrationByDate.entries(),
        ).map(([date, count]) => ({ date, count }));

        return {
            success: true,
            data: {
                period,
                total,
                new_in_period: newInPeriod,
                by_role: byRole.map((r) => ({ role: r.role, count: r._count.id })),
                top_passengers: topPassengers.map((u) => ({
                    id: u.id,
                    name: u.name_uz,
                    phone: u.phone,
                    photo: u.profile_photo,
                    total_orders: u._count.orders,
                })),
                registration_chart: registrationChart,
            },
        };
    }

    async getRecentActivity(limit: number = 10): Promise<RecentActivityResponse> {
        const [recentOrders, recentPayments, recentUsers] = await Promise.all([
            this.prisma.order.findMany({
                take: limit,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    status: true,
                    price: true,
                    distance_km: true,
                    created_at: true,
                    user: { select: { name_uz: true, phone: true } },
                    driver: { select: { user: { select: { name_uz: true, phone: true } } } },
                    taxiCategory: { select: { name_uz: true } },
                    payment: { select: { method: true, status: true } },
                },
            }),
            this.prisma.payment.findMany({
                take: limit,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    amount: true,
                    method: true,
                    status: true,
                    paid_at: true,
                    created_at: true,
                    order_id: true,
                    order: { select: { user: { select: { name_uz: true, phone: true } } } },
                },
            }),
            this.prisma.user.findMany({
                take: limit,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    name_uz: true,
                    name_ru: true,
                    name_en: true,
                    phone: true,
                    role: true,
                    created_at: true,
                    profile_photo: true,
                },
            }),
        ]);

        return {
            success: true,
            data: {
                recent_orders: recentOrders.map(
                    (o): RecentOrder => ({
                        id: o.id,
                        status: o.status,
                        price: Number(o.price),
                        distance_km: Number(o.distance_km),
                        created_at: o.created_at,
                        user_name: o.user.name_uz,
                        user_phone: o.user.phone,
                        driver_name: o.driver?.user?.name_uz ?? null,
                        driver_phone: o.driver?.user?.phone ?? null,
                        category: o.taxiCategory?.name_uz ?? null,
                        payment_method: o.payment?.method ?? null,
                        payment_status: o.payment?.status ?? null,
                    }),
                ),
                recent_payments: recentPayments.map(
                    (p): RecentPayment => ({
                        id: p.id,
                        amount: Number(p.amount),
                        method: p.method,
                        status: p.status,
                        paid_at: p.paid_at,
                        created_at: p.created_at,
                        order_id: p.order_id,
                        user_name: p.order?.user?.name_uz ?? null,
                        user_phone: p.order?.user?.phone ?? null,
                    }),
                ),
                recent_users: recentUsers,
            },
        };
    }

    async getSummaryCards(): Promise<SummaryCardsResponse> {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const [
            todayOrders,
            monthOrders,
            lastMonthOrders,
            todayRevenue,
            monthRevenue,
            lastMonthRevenue,
            newUsersMonth,
            newUsersLastMonth,
            onlineDrivers,
            totalDrivers,
        ] = await Promise.all([
            this.prisma.order.count({ where: { created_at: { gte: todayStart } } }),
            this.prisma.order.count({ where: { created_at: { gte: monthStart } } }),
            this.prisma.order.count({
                where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
            }),
            this.prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: PaymentStatus.success, paid_at: { gte: todayStart } },
            }),
            this.prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: PaymentStatus.success, paid_at: { gte: monthStart } },
            }),
            this.prisma.payment.aggregate({
                _sum: { amount: true },
                where: {
                    status: PaymentStatus.success,
                    paid_at: { gte: lastMonthStart, lte: lastMonthEnd },
                },
            }),
            this.prisma.user.count({ where: { created_at: { gte: monthStart } } }),
            this.prisma.user.count({
                where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
            }),
            this.prisma.driver.count({ where: { status: DriverStatus.online } }),
            this.prisma.driver.count(),
        ]);

        const calcGrowth = (current: number, previous: number): number | null =>
            previous > 0
                ? Number(((( current - previous) / previous) * 100).toFixed(1))
                : null;

        const prevMonthRevenue = Number(lastMonthRevenue._sum.amount ?? 0);
        const currMonthRevenue = Number(monthRevenue._sum.amount ?? 0);

        return {
            success: true,
            data: {
                today_orders: todayOrders,
                month_orders: monthOrders,
                order_growth_percent: calcGrowth(monthOrders, lastMonthOrders),
                today_revenue: Number(todayRevenue._sum.amount ?? 0),
                month_revenue: currMonthRevenue,
                revenue_growth_percent: calcGrowth(currMonthRevenue, prevMonthRevenue),
                new_users_this_month: newUsersMonth,
                user_growth_percent: calcGrowth(newUsersMonth, newUsersLastMonth),
                online_drivers: onlineDrivers,
                total_drivers: totalDrivers,
                driver_online_percent:
                    totalDrivers > 0
                        ? Number(((onlineDrivers / totalDrivers) * 100).toFixed(1))
                        : 0,
            },
        };
    }
}
