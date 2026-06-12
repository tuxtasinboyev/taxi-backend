import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiQuery,
    ApiResponse,
    ApiTags,
    PartialType,
} from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { CreateOrderDto } from './dto/create.orders.dto';
import { OrdersService } from './orders.service';

export class UpdateOrderDto extends PartialType(CreateOrderDto) { }

class UpdateStatusDto {
    @ApiProperty({
        enum: [
            OrderStatus.pending,
            OrderStatus.accepted,
            OrderStatus.on_the_way,
            OrderStatus.completed,
            OrderStatus.cancelled,
        ],
        example: OrderStatus.on_the_way,
    })
    @IsNotEmpty()
    @IsEnum(OrderStatus)
    status: OrderStatus;
}


@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // Narx hisoblash (order yaratmasdan oldin)
    @UseGuards(GuardService)
    @Post('price-preview')
    @ApiOperation({ summary: 'Order narxini oldindan hisoblash (order yaratilmaydi)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['start_lat', 'start_lng', 'end_lat', 'end_lng'],
            properties: {
                start_lat: { type: 'number', example: 41.2995 },
                start_lng: { type: 'number', example: 69.2401 },
                end_lat: { type: 'number', example: 41.3110 },
                end_lng: { type: 'number', example: 69.2790 },
                taxiCategoryId: { type: 'string', example: 'uuid-category' },
                promoCode: { type: 'string', example: 'DISCOUNT20' },
            },
        },
    })
    async pricePreview(@Body() dto: CreateOrderDto) {
        return this.ordersService.pricePreview(dto);
    }

    // Admin: order yaratish (istalgan user uchun, haydovchi biriktirib ham bo'ladi)
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Post('admin-create')
    @ApiOperation({ summary: 'Admin: istalgan user uchun order yaratish' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['user_id', 'start_lat', 'start_lng', 'end_lat', 'end_lng'],
            properties: {
                user_id: { type: 'string', example: 'uuid-user', description: 'user_id yoki client_phone biridan biri kerak' },
                client_phone: { type: 'string', example: '+998901234567', description: 'Telefon raqami orqali foydalanuvchi topiladi' },
                start_lat: { type: 'number', example: 41.2995 },
                start_lng: { type: 'number', example: 69.2401 },
                end_lat: { type: 'number', example: 41.3110 },
                end_lng: { type: 'number', example: 69.2790 },
                taxiCategoryId: { type: 'string', example: 'uuid-category' },
                promoCode: { type: 'string', example: 'DISCOUNT20' },
                payment_method: { type: 'string', enum: ['cash', 'card'], example: 'cash' },
                driver_id: { type: 'string', example: 'uuid-driver', description: 'Darhol biriktiriladi (ixtiyoriy)' },
            },
        },
    })
    async adminCreateOrder(@Body() dto: CreateOrderDto & { driver_id?: string; client_phone?: string }) {
        const result = await this.ordersService.adminCreateOrder(dto);
        return { success: true, message: 'Admin tomonidan order yaratildi', data: result };
    }

    // Admin: order ga haydovchi biriktirish
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Patch(':id/assign-driver/:driverId')
    @ApiOperation({ summary: 'Admin: orderga haydovchi biriktirish' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiParam({ name: 'driverId', description: 'Driver ID' })
    async assignDriver(@Param('id') orderId: string, @Param('driverId') driverId: string) {
        const result = await this.ordersService.assignDriver(orderId, driverId);
        return { success: true, message: 'Haydovchi biriktirildi', data: result };
    }

    // Admin: order uchun yaqin haydovchilar
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Get(':id/nearby-drivers')
    @ApiOperation({ summary: 'Admin: order start nuqtasiga yaqin haydovchilar' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiQuery({ name: 'radiusKm', required: false, type: Number, example: 5 })
    async getNearbyDriversForOrder(
        @Param('id') orderId: string,
        @Query('radiusKm') radiusKm?: string,
    ) {
        const radius = radiusKm ? parseFloat(radiusKm) : 5;
        const drivers = await this.ordersService.getNearbyDriversForOrder(orderId, radius);
        return { success: true, data: drivers };
    }

    // 🟢 1. Order yaratish
    @UseGuards(GuardService)
    @Post('create')
    @ApiOperation({ summary: 'Yangi order yaratish (zakaz berish)' })
    @ApiBody({ type: CreateOrderDto })
    @ApiResponse({ status: 201, description: 'Order yaratildi' })
    async createOrder(@Body() dto: CreateOrderDto, @Req() req: Request) {
        try {
            const user = req['user'] as { id: string };

            // Debug uchun terminalga chiqaring, dto kelayotganini ko'rasiz
            console.log('Kelgan DTO:', dto);

            const result = await this.ordersService.createOrder({
                user_id: user.id,
                start_lat: dto.start_lat,
                start_lng: dto.start_lng,
                end_lat: dto.end_lat,
                end_lng: dto.end_lng,
                from_address: dto.from_address,
                to_address: dto.to_address,
                taxiCategoryId: dto.taxiCategoryId,
                promoCode: dto.promoCode,
                payment_method: dto.payment_method,
            });

            return { success: true, message: 'Order yaratildi', data: result };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }
    // 🟡 2. Haydovchi zakasni qabul qiladi
    @UseGuards(GuardService)
    @Post('accept/:orderId/:driverId')
    @ApiOperation({ summary: 'Haydovchi zakasni qabul qiladi' })
    @ApiParam({ name: 'orderId', description: 'Zakaz ID (UUID)', type: String })
    @ApiParam({ name: 'driverId', description: 'Haydovchi ID (UUID)', type: String })
    async acceptOrder(@Param('orderId') orderId: string, @Param('driverId') driverId: string) {
        try {
            const order = await this.ordersService.acceptOrder(driverId, orderId);
            return {
                success: true,
                message: 'Order haydovchi tomonidan qabul qilindi',
                data: order,
            };
        } catch (error) {
            console.log(error);

            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    // Haydovchi zakasni rad etadi
    @UseGuards(GuardService)
    @Post('reject/:orderId')
    @ApiOperation({ summary: 'Haydovchi zakasni rad etadi' })
    @ApiParam({ name: 'orderId', description: 'Zakaz ID (UUID)', type: String })
    @ApiResponse({ status: 200, description: 'Buyurtma rad etildi' })
    @ApiResponse({ status: 409, description: 'Bu buyurtmani rad etib bo\'lmaydi' })
    async rejectOrder(
        @Param('orderId') orderId: string,
        @UserData() user: JwtPayload,
    ) {
        return this.ordersService.rejectOrder(user.id, orderId);
    }

    // 🟢 4. Foydalanuvchining o'z zakaslari
    @UseGuards(GuardService)
    @Get('my')
    @ApiOperation({ summary: "Foydalanuvchining o'z zakaslarini olish" })
    async getMyOrders(@Req() req: Request) {
        try {
            const user = req['user'] as { id: string };
            const orders = await this.ordersService.getMyOrders(user.id);
            return {
                success: true,
                message: 'Sizning zakaslaringiz',
                data: orders,
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    @UseGuards(GuardService)
    @Get('active')
    @ApiOperation({ summary: "Foydalanuvchining joriy faol zakazini olish" })
    async getActiveOrder(@Req() req: Request) {
        try {
            const user = req['user'] as { id: string };
            const order = await this.ordersService.getActiveOrder(user.id);
            return {
                success: true,
                message: order == null ? 'Faol zakaz topilmadi' : 'Faol zakaz topildi',
                data: order,
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('driver')
    @Get('driver/history')
    @ApiOperation({ summary: 'Haydovchi uchun buyurtmalar tarixi' })
    @ApiQuery({ name: 'language', required: false, enum: ['uz', 'ru', 'en'], description: 'Language for names (optional, returns all if omitted)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
    @ApiQuery({ name: 'date_from', required: false, type: String, description: 'ISO start date' })
    @ApiQuery({ name: 'date_to', required: false, type: String, description: 'ISO end date' })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Order status filter' })
    async getDriverHistory(
        @UserData() user: JwtPayload,
        @Query('language') language?: Language,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
        @Query('status') status?: OrderStatus,
    ) {
        return this.ordersService.getDriverOrderHistory(
            user.id,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
            language,
            dateFrom,
            dateTo,
            status,
        );
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('driver')
    @Get('driver/pending-nearby')
    @ApiOperation({ summary: 'Driver online bo`lganda yaqin pending orderlarni olish' })
    @ApiQuery({ name: 'lat', required: true, type: Number })
    @ApiQuery({ name: 'lng', required: true, type: Number })
    @ApiQuery({ name: 'radiusKm', required: false, type: Number })
    async getDriverPendingNearbyOrders(
        @UserData() user: JwtPayload,
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radiusKm') radiusKm?: string,
    ) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radius = radiusKm ? parseFloat(radiusKm) : 5;

        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            throw new BadRequestException('lat va lng majburiy va son bo`lishi kerak');
        }

        const data = await this.ordersService.getPendingNearbyOrdersForDriver(
            user.id,
            latitude,
            longitude,
            radius,
        );
        return { success: true, data };
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Get('get-all-orders')
    @ApiOperation({ summary: 'Barcha zakaslarni olish (admin uchun)' })
    @ApiQuery({ name: 'language', required: false, enum: ['uz', 'ru', 'en'], description: 'Language for names (optional, returns all if omitted)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search text' })
    @ApiQuery({ name: 'driver_id', required: false, type: String, description: 'Driver ID filter' })
    @ApiQuery({ name: 'user_id', required: false, type: String, description: 'User ID filter' })
    @ApiQuery({ name: 'price_min', required: false, type: Number, description: 'Minimum price filter' })
    @ApiQuery({ name: 'price_max', required: false, type: Number, description: 'Maximum price filter' })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Order status filter' })
    async getAllOrders(
        @Query('language') language?: Language,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('driver_id') driver_id?: string,
        @Query('user_id') user_id?: string,
        @Query('price_min') price_min?: string,
        @Query('price_max') price_max?: string,
        @Query('status') status?: OrderStatus,

    ) {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const limitNumber = limit ? parseInt(limit, 10) : 10;
        const priceMinNumber = price_min ? parseFloat(price_min) : undefined;
        const priceMaxNumber = price_max ? parseFloat(price_max) : undefined;

        return await this.ordersService.getAllOrders(
            pageNumber,
            limitNumber,
            language,
            search,
            driver_id,
            user_id,
            priceMinNumber,
            priceMaxNumber,
            status,
        );
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Get(':id')
    @ApiOperation({ summary: 'id buyicha zakaslarni olish (admin uchun)' })
    @ApiParam({ name: 'id', required: true, description: 'Order ID' })
    @ApiQuery({ name: 'language', required: false, enum: ['uz', 'ru', 'en'], description: 'Language for names (optional, returns all if omitted)' })
    async getOrderById(
        @Param('id') orderId: string,
        @Query('language') language?: Language,
    ) {
        return this.ordersService.getOrderById(orderId, language);
    }

    // 🟢 3. Order yakunlash
    @UseGuards(GuardService)
    @Post('complete/:orderId')
    @ApiOperation({ summary: 'Orderni yakunlash (tugatish)' })
    @ApiParam({ name: 'orderId', description: 'Order ID (UUID)', type: String })
    async completeOrder(@Param('orderId') orderId: string) {
        try {
            const result = await this.ordersService.completeOrder(orderId);
            return {
                success: true,
                message: 'Order muvaffaqiyatli yakunlandi',
                data: result,
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }


   

    // 🟡 5. Order statusini yangilash
    @UseGuards(GuardService)
    @Patch('update-status/:orderId')
    @ApiOperation({ summary: 'Order statusini yangilash (on_way, arrived, completed, cancelled va h.k.)' })
    @ApiParam({ name: 'orderId', description: 'Order ID', type: String })
    @ApiBody({ type: UpdateStatusDto })
    async updateStatus(@Param('orderId') orderId: string, @Body() body: UpdateStatusDto) {
        try {
            const order = await this.ordersService.updateOrderStatus(orderId, body.status);
            return {
                success: true,
                message: 'Order status yangilandi',
                data: order,
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin', 'passenger','superadmin')
    @ApiBearerAuth()
    @Patch(':id')
    @ApiOperation({ summary: `Update an existing order ${UserRole.admin} , ${UserRole.passenger}` })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiBody({ type: UpdateOrderDto })
    @ApiResponse({ status: 200, description: 'Order updated successfully' })
    async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto, @UserData() user: JwtPayload) {
        return this.ordersService.updateOrder(id, dto, user);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('user/today-stats')
    @ApiOperation({ summary: "Foydalanuvchining bugungi xarajati statistikasi" })
    async getUserTodayStats(@UserData() user: JwtPayload) {
        return this.ordersService.getUserTodayStats(user.id);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('user/stats')
    @ApiOperation({ summary: "Foydalanuvchining buyurtmalar statistikasi (today/weekly/monthly/all)" })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'weekly', 'monthly', 'all'] })
    async getUserOrderStats(
        @UserData() user: JwtPayload,
        @Query('period') period: 'today' | 'weekly' | 'monthly' | 'all' = 'today',
    ) {
        return this.ordersService.getUserOrderStats(user.id, period);
    }
}
