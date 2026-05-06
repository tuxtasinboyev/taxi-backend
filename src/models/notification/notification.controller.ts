import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import {
    AdminSendToAllDto,
    AdminSendToDeviceDto,
    AdminSendToUserDto,
    RegisterDeviceTokenDto,
} from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    // ─── Device Token ─────────────────────────────────────────────────────────

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Post('device-token')
    @ApiOperation({ summary: "FCM device token ro'yxatga olish" })
    @ApiBody({ type: RegisterDeviceTokenDto })
    registerDeviceToken(
        @UserData('id') userId: string,
        @Body() dto: RegisterDeviceTokenDto,
    ) {
        return this.notificationService.registerDeviceToken(
            userId,
            dto.token,
            dto.platform ?? 'android',
            dto.lang ?? 'uz',
        );
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Delete('device-token/:token')
    @ApiOperation({ summary: "FCM device tokenni o'chirish (logout)" })
    removeDeviceToken(
        @UserData('id') userId: string,
        @Param('token') token: string,
    ) {
        return this.notificationService.removeDeviceToken(userId, token);
    }

    // ─── User endpoints ────────────────────────────────────────────────────────

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('my')
    @ApiOperation({ summary: 'Mening notificationlarim' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({ name: 'lang', required: false, enum: ['uz', 'ru', 'en'] })
    getMyNotifications(
        @UserData('id') userId: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('lang') lang = 'uz',
    ) {
        return this.notificationService.getMyNotifications(userId, +page, +limit, lang);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Patch(':id/read')
    @ApiOperation({ summary: 'Notificationni o\'qilgan deb belgilash' })
    markAsRead(@UserData('id') userId: string, @Param('id') id: string) {
        return this.notificationService.markAsRead(id, userId);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Patch('read-all')
    @ApiOperation({ summary: 'Barcha notificationlarni o\'qilgan deb belgilash' })
    markAllAsRead(@UserData('id') userId: string) {
        return this.notificationService.markAllAsRead(userId);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Delete(':id')
    @ApiOperation({ summary: 'Notificationni o\'chirish' })
    deleteNotification(@UserData('id') userId: string, @Param('id') id: string) {
        return this.notificationService.deleteNotification(id, userId);
    }

    // ─── Admin endpoints ───────────────────────────────────────────────────────

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get('admin/all')
    @ApiOperation({ summary: 'Admin: barcha notificationlar' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'user_id', required: false })
    adminGetAll(
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('user_id') userId?: string,
    ) {
        return this.notificationService.adminGetAll(+page, +limit, userId);
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @ApiBearerAuth()
    @Post('admin/send-to-user')
    @ApiOperation({ summary: 'Admin: bitta foydalanuvchiga notification yuborish' })
    @ApiBody({ type: AdminSendToUserDto })
    adminSendToUser(@Body() dto: AdminSendToUserDto) {
        return this.notificationService.sendToUser(dto.user_id, {
            title_uz: dto.title_uz,
            title_ru: dto.title_ru,
            title_en: dto.title_en,
            message_uz: dto.message_uz,
            message_ru: dto.message_ru,
            message_en: dto.message_en,
            type: dto.type ?? 'admin',
        });
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @ApiBearerAuth()
    @Post('admin/send-to-all')
    @ApiOperation({ summary: 'Admin: barcha foydalanuvchilarga notification yuborish' })
    @ApiBody({ type: AdminSendToAllDto })
    adminSendToAll(@Body() dto: AdminSendToAllDto) {
        return this.notificationService.sendToAll(
            {
                title_uz: dto.title_uz,
                title_ru: dto.title_ru,
                title_en: dto.title_en,
                message_uz: dto.message_uz,
                message_ru: dto.message_ru,
                message_en: dto.message_en,
                type: dto.type ?? 'admin',
            },
            (dto.role as any) ?? 'all',
        );
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @ApiBearerAuth()
    @Post('admin/send-to-device')
    @ApiOperation({ summary: 'Admin: bitta qurilmaga (FCM token) notification yuborish' })
    @ApiBody({ type: AdminSendToDeviceDto })
    adminSendToDevice(@Body() dto: AdminSendToDeviceDto) {
        return this.notificationService.sendToDevice(
            dto.device_token,
            dto.title,
            dto.message,
        );
    }
}
