import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
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
import { ClickCallbackDto, InitiateCommissionPaymentDto } from './dto/commission.dto';

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
  getMyUnpaidSummary(@UserData() user: JwtPayload) {
    return this.commissionService.getMyUnpaidSummary(user.id);
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Get('my/history')
  @ApiOperation({ summary: "Haydovchining komisyon to'lov tarixi" })
  getMyPaymentHistory(@UserData() user: JwtPayload) {
    return this.commissionService.getMyPaymentHistory(user.id);
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Get('my/pending-payment')
  @ApiOperation({
    summary: "Joriy pending to'lov (davom ettirish uchun)",
    description: 'Agar 5 daqiqadan yangi pending payment mavjud bo\'lsa, click_url bilan qaytaradi. has_pending: false bo\'lsa, yangi to\'lov boshlash kerak.',
  })
  getPendingPayment(@UserData() user: JwtPayload) {
    return this.commissionService.getPendingPayment(user.id);
  }

  @UseGuards(GuardService, RoleGuardService)
  @Role('driver')
  @ApiBearerAuth()
  @Post('my/pay')
  @ApiOperation({
    summary: "Click orqali komisyon to'lashni boshlash",
    description: "Tanlangan kun(lar) uchun to'lanmagan komisyonlarni Click orqali to'lash. 1 yoki 2 kun tanlash mumkin.",
  })
  @ApiBody({ type: InitiateCommissionPaymentDto })
  initiatePayment(
    @UserData() user: JwtPayload,
    @Body() dto: InitiateCommissionPaymentDto,
  ) {
    return this.commissionService.initiatePayment(user.id, dto);
  }

  // ─── Click callbacks (no auth — verified by sign) ─────────────────────────

  @Post('click/prepare')
  @ApiOperation({ summary: 'Click prepare callback (Click tomonidan chaqiriladi)' })
  handlePrepare(@Body() dto: ClickCallbackDto) {
    return this.commissionService.handlePrepare(dto);
  }

  @Post('click/complete')
  @ApiOperation({ summary: 'Click complete callback (Click tomonidan chaqiriladi)' })
  handleComplete(@Body() dto: ClickCallbackDto) {
    return this.commissionService.handleComplete(dto);
  }

  // ─── Admin routes ─────────────────────────────────────────────────────────

  @UseGuards(GuardService, RoleGuardService)
  @Role('admin', 'superadmin')
  @ApiBearerAuth()
  @Get('admin/drivers')
  @ApiOperation({ summary: 'Admin: barcha haydovchilarning komisyon holati' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['unpaid', 'pending', 'paid', 'cancelled'] })
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
  @ApiOperation({ summary: 'Admin: bitta haydovchining batafsil komisyon tarixi' })
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
