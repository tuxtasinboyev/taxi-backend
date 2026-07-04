import {
  All,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { CommissionService } from './commission.service';
import { InitiateCommissionPaymentDto } from './dto/commission.dto';

@ApiTags('Commission')
@Controller('commission')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  // ─── Driver routes ────────────────────────────────────────────────────────

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Get('my/summary')
  @ApiOperation({ summary: "Haydovchining to'lanmagan komisyon xulosasi" })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  @ApiQuery({
    name: 'order_status',
    required: false,
    enum: ['all', 'completed', 'cancelled'],
  })
  getMyUnpaidSummary(
    @UserData() user: JwtPayload,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('order_status') orderStatus?: string,
  ) {
    return this.commissionService.getMyUnpaidSummary(user.id, {
      dateFrom,
      dateTo,
      orderStatus,
    });
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Get('my/history')
  @ApiOperation({ summary: "Haydovchining komisyon to'lov tarixi" })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  @ApiQuery({
    name: 'order_status',
    required: false,
    enum: ['all', 'completed', 'cancelled'],
  })
  getMyPaymentHistory(
    @UserData() user: JwtPayload,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('order_status') orderStatus?: string,
  ) {
    return this.commissionService.getMyPaymentHistory(user.id, {
      dateFrom,
      dateTo,
      orderStatus,
    });
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Get('my/pending-payment')
  @ApiOperation({
    summary: "Joriy pending to'lov (davom ettirish uchun)",
    description:
      "Agar 5 daqiqadan yangi pending payment mavjud bo'lsa, click_url bilan qaytaradi. has_pending: false bo'lsa, yangi to'lov boshlash kerak.",
  })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  @ApiQuery({
    name: 'order_status',
    required: false,
    enum: ['all', 'completed', 'cancelled'],
  })
  getPendingPayment(
    @UserData() user: JwtPayload,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('order_status') orderStatus?: string,
  ) {
    return this.commissionService.getPendingPayment(user.id, {
      dateFrom,
      dateTo,
      orderStatus,
    });
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Post('my/pay')
  @ApiOperation({
    summary: "Click orqali komisyon to'lashni boshlash",
    description:
      "Tanlangan kun(lar) uchun to'lanmagan komisyonlarni Click orqali to'lash. 1 yoki 2 kun tanlash mumkin.",
  })
  @ApiBody({ type: InitiateCommissionPaymentDto })
  initiatePayment(
    @UserData() user: JwtPayload,
    @Body() dto: InitiateCommissionPaymentDto,
  ) {
    return this.commissionService.initiatePayment(user.id, dto);
  }

  // ─── Click callbacks (no auth — verified by sign) ─────────────────────────
  // URL o'zgarmaydi:
  // /api/commission/click/prepare
  // /api/commission/click/complete
  //
  // @All ishlatilgani sababi:
  // Click POST yuborsa ham, GET/query bilan yuborsa ham logga tushadi.

  @All('click/prepare')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: false }))
  @ApiOperation({
    summary: 'Click prepare callback (Click tomonidan chaqiriladi)',
  })
  handlePrepare(
    @Body() body: Record<string, any>,
    @Query() query: Record<string, any>,
    @Req() req: any,
  ) {
    const payload = {
      ...(query || {}),
      ...(body || {}),
    };

    console.log('CLICK PREPARE METHOD:', req.method);
    console.log('CLICK PREPARE URL:', req.originalUrl || req.url);
    console.log('CLICK PREPARE HEADERS:', JSON.stringify(req.headers));
    console.log('CLICK PREPARE RAW QUERY:', JSON.stringify(query));
    console.log('CLICK PREPARE RAW BODY:', JSON.stringify(body));
    console.log('CLICK PREPARE PAYLOAD:', JSON.stringify(payload));

    return this.commissionService.handlePrepare(payload as any);
  }

  @All('click/complete')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: false }))
  @ApiOperation({
    summary: 'Click complete callback (Click tomonidan chaqiriladi)',
  })
  handleComplete(
    @Body() body: Record<string, any>,
    @Query() query: Record<string, any>,
    @Req() req: any,
  ) {
    const payload = {
      ...(query || {}),
      ...(body || {}),
    };

    console.log('CLICK COMPLETE METHOD:', req.method);
    console.log('CLICK COMPLETE URL:', req.originalUrl || req.url);
    console.log('CLICK COMPLETE HEADERS:', JSON.stringify(req.headers));
    console.log('CLICK COMPLETE RAW QUERY:', JSON.stringify(query));
    console.log('CLICK COMPLETE RAW BODY:', JSON.stringify(body));
    console.log('CLICK COMPLETE PAYLOAD:', JSON.stringify(payload));

    return this.commissionService.handleComplete(payload as any);
  }

  // ─── Admin routes ─────────────────────────────────────────────────────────

  @UseGuards(GuardService, RoleGuardService)
  @Role('admin', 'superadmin')
  @ApiBearerAuth()
  @Get('admin/drivers')
  @ApiOperation({ summary: 'Admin: barcha haydovchilarning komisyon holati' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['unpaid', 'pending', 'paid', 'cancelled'],
  })
  getAdminDriversCommissions(@Query() query: any) {
    return this.commissionService.getAdminDriversCommissions({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      status: query.status,
    });
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('admin', 'superadmin')
  @ApiBearerAuth()
  @Get('admin/driver/:driver_id')
  @ApiOperation({
    summary: 'Admin: bitta haydovchining batafsil komisyon tarixi',
  })
  @ApiParam({ name: 'driver_id', type: String })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-01-31' })
  getAdminDriverDetail(
    @Param('driver_id') driver_id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.commissionService.getAdminDriverDetail(driver_id, { from, to });
  }
}
