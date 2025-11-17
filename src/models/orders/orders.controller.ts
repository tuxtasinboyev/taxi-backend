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
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import { GuardService } from 'src/common/guard/guard.service';
import { Language } from 'src/utils/helper';
import { OrdersService } from './orders.service';
import { Role } from 'src/common/decorators/role.decorator';

// 🟢 DTO’lar
class CreateOrderDto {
    @ApiProperty({ example: 41.311081 })
    start_lat: number;

    @ApiProperty({ example: 69.240562 })
    start_lng: number;

    @ApiProperty({ example: 41.327 })
    end_lat: number;

    @ApiProperty({ example: 69.281 })
    end_lng: number;

    @ApiProperty({ example: 'eco', required: false })
    taxiCategoryId?: string;

    @ApiProperty({ example: 'WELCOME50', required: false })
    promoCode?: string;

    @ApiProperty({ enum: ['cash', 'card'], example: 'card', required: false })
    payment_method?: 'cash' | 'card';
}
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
    status: OrderStatus;
}


@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // 🟢 1. Order yaratish
    @UseGuards(GuardService)
    @Post('create')
    @ApiOperation({ summary: 'Yangi order yaratish (zakaz berish)' })
    @ApiBody({ type: CreateOrderDto })
    @ApiResponse({ status: 201, description: 'Order yaratildi' })
    async createOrder(@Body() dto: CreateOrderDto, @Req() req: Request) {
        try {
            const user = req['user'] as { id: string };
            const result = await this.ordersService.createOrder({
                user_id: user.id,
                ...dto,
            });
            return {
                success: true,
                message: 'Order yaratildi',
                data: result,
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    // 🟡 2. Haydovchi zakasni qabul qiladi
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

    @UseGuards(GuardService)
    @Role('admin')
    @Get('get-all-orders')
    @ApiOperation({ summary: 'Barcha zakaslarni olish (admin uchun)' })
    @ApiQuery({ name: 'language', required: true, enum: ['uz', 'ru', 'en'], description: 'Language for names' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search text' })
    @ApiQuery({ name: 'driver_id', required: false, type: String, description: 'Driver ID filter' })
    @ApiQuery({ name: 'user_id', required: false, type: String, description: 'User ID filter' })
    @ApiQuery({ name: 'price_min', required: false, type: Number, description: 'Minimum price filter' })
    @ApiQuery({ name: 'price_max', required: false, type: Number, description: 'Maximum price filter' })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Order status filter' })
    async getAllOrders(
        @Query('language') language: Language,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('driver_id') driver_id?: string,
        @Query('user_id') user_id?: string,
        @Query('price_min') price_min?: string,
        @Query('price_max') price_max?: string,
        @Query('status') status?: OrderStatus,

    ) {
        if (!language) {
            throw new BadRequestException('Language query parameter is required');
        }

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

    @UseGuards(GuardService)
    @Role('admin')
    @Get(':id')
    @ApiOperation({ summary: 'id buyicha zakaslarni olish (admin uchun)' })
    @ApiParam({ name: 'id', required: true, description: 'Order ID' })
    @ApiQuery({ name: 'language', required: true, enum: ['uz', 'ru', 'en'], description: 'Language for names' })
    async getOrderById(
        @Query('language') language: Language,
        @Param('id') orderId: string,
    ) {
        if (!language) {
            throw new BadRequestException('Language query parameter is required');
        }

        return this.ordersService.getOrderById(orderId, language);
    }

    // 🟢 3. Order yakunlash
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


    // 🟢 4. Foydalanuvchining o‘z zakaslari
    @UseGuards(GuardService)
    @Get('my')
    @ApiOperation({ summary: 'Foydalanuvchining o‘z zakaslarini olish' })
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

    // 🟡 5. Order statusini yangilash
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

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing order' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiBody({ type: UpdateOrderDto })
    @ApiResponse({ status: 200, description: 'Order updated successfully' })
    async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
        return this.ordersService.updateOrder(id, dto);
    }
}
