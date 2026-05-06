import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(GuardService, RoleGuardService)
@Role('admin','superadmin')
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('summary')
    @ApiOperation({
        summary: 'Summary cards (Admin only)',
        description: 'Bugungi va oylik buyurtmalar, daromad, foydalanuvchi osishi va haydovchi statistikasi.',
    })
    @ApiResponse({ status: 200, description: 'Summary cards retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
    async getSummaryCards() {
        return this.dashboardService.getSummaryCards();
    }

    @Get('overview')
    @ApiOperation({
        summary: 'Overall statistics (Admin only)',
        description: 'Jami foydalanuvchilar, haydovchilar, buyurtmalar va daromad boyicha umumiy statistika.',
    })
    @ApiResponse({ status: 200, description: 'Overview stats retrieved successfully' })
    async getOverview() {
        return this.dashboardService.getOverviewStats();
    }

    @Get('orders/stats')
    @ApiOperation({
        summary: 'Order statistics by period (Admin only)',
        description: 'Tanlangan davr buyicha buyurtmalar: status boyicha, kategoriya boyicha, kunlik grafik.',
    })
    @ApiQuery({
        name: 'period',
        required: false,
        enum: ['day', 'week', 'month', 'year'],
        description: 'Statistika davri (default: month)',
        example: 'month',
    })
    @ApiResponse({ status: 200, description: 'Order stats retrieved successfully' })
    async getOrderStats(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
        return this.dashboardService.getOrderStats(period);
    }

    @Get('revenue/stats')
    @ApiOperation({
        summary: 'Revenue statistics by period (Admin only)',
        description: 'Tanlangan davr boyicha tolovlar: tolov usuli boyicha, muvaffaqiyatli/muammoli tolovlar, kunlik grafik.',
    })
    @ApiQuery({
        name: 'period',
        required: false,
        enum: ['day', 'week', 'month', 'year'],
        description: 'Statistika davri (default: month)',
        example: 'month',
    })
    @ApiResponse({ status: 200, description: 'Revenue stats retrieved successfully' })
    async getRevenueStats(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
        return this.dashboardService.getRevenueStats(period);
    }

    @Get('drivers/stats')
    @ApiOperation({
        summary: 'Driver statistics (Admin only)',
        description: 'Haydovchilar boyicha statistika: online/offline/band, top haydovchilar reyting boyicha.',
    })
    @ApiResponse({ status: 200, description: 'Driver stats retrieved successfully' })
    async getDriverStats() {
        return this.dashboardService.getDriverStats();
    }

    @Get('users/stats')
    @ApiOperation({
        summary: 'User statistics by period (Admin only)',
        description: 'Foydalanuvchilar boyicha statistika: yangi royxatdan otganlar, eng faol yolovchilar, kunlik grafik.',
    })
    @ApiQuery({
        name: 'period',
        required: false,
        enum: ['day', 'week', 'month', 'year'],
        description: 'Statistika davri (default: month)',
        example: 'month',
    })
    @ApiResponse({ status: 200, description: 'User stats retrieved successfully' })
    async getUserStats(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
        return this.dashboardService.getUserStats(period);
    }

    @Get('recent-activity')
    @ApiOperation({
        summary: 'Recent activity (Admin only)',
        description: 'Oxirgi buyurtmalar, tolovlar va royxatdan otgan foydalanuvchilar royxati.',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Har bir bolim uchun nechta yozuv (default: 10, max: 50)',
        example: 10,
    })
    @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
    async getRecentActivity(@Query('limit') limit: number = 10) {
        const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
        return this.dashboardService.getRecentActivity(safeLimit);
    }
}
