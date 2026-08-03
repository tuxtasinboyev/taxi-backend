import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { AdminLinkReferralDto } from './dto/admin-link-referral.dto';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';
import { ReferralService } from './referral.service';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
    constructor(private readonly referralService: ReferralService) {}

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiBearerAuth()
    @Get('settings')
    @ApiOperation({ summary: "Referal tizimi sozlamalarini olish (foiz, muddat, holat) (admin)" })
    async getSettings() {
        return this.referralService.getSettings();
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiBearerAuth()
    @Patch('settings')
    @ApiOperation({ summary: "Referal foizi va muddatini o'zgartirish (admin)" })
    async updateSettings(@Body() dto: UpdateReferralSettingsDto) {
        return this.referralService.updateSettings(dto);
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiBearerAuth()
    @Get('admin/stats')
    @ApiOperation({ summary: "Barcha referal munosabatlari va daromadlar statistikasi (admin)" })
    @ApiQuery({ name: 'page', required: false, example: '1' })
    @ApiQuery({ name: 'limit', required: false, example: '20' })
    async getAdminStats(@Query('page') page?: string, @Query('limit') limit?: string) {
        return this.referralService.getAdminStats(
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiBearerAuth()
    @Post('admin/link')
    @ApiOperation({ summary: "Haydovchiga qo'lda referal (kim taklif qilgani) biriktirish (admin/xodim)" })
    async adminLink(@Body() dto: AdminLinkReferralDto) {
        return this.referralService.adminLinkReferral(dto.phone, dto.referral_code);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('me/code')
    @ApiOperation({ summary: "Haydovchining o'z referal kodini olish (mavjud bo'lmasa avtomatik yaratiladi)" })
    async getMyCode(@UserData() user: JwtPayload) {
        return this.referralService.getOrCreateReferralCode(user.id);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('me/referrals')
    @ApiOperation({ summary: "Men taklif qilgan haydovchilar ro'yxati (reyting bilan)" })
    @ApiQuery({ name: 'language', required: false, enum: ['uz', 'ru', 'en'] })
    async getMyReferrals(@UserData() user: JwtPayload, @Query('language') language?: Language) {
        return this.referralService.getMyReferrals(user.id, language);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('me/earnings')
    @ApiOperation({ summary: "Referaldan kelgan daromadlarim (alohida hisob, wallet'dan mustaqil)" })
    @ApiQuery({ name: 'page', required: false, example: '1' })
    @ApiQuery({ name: 'limit', required: false, example: '20' })
    async getMyEarnings(
        @UserData() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.referralService.getMyEarnings(
            user.id,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }
}
