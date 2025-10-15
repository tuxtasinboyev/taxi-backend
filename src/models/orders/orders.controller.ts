import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import { GuardService } from 'src/common/guard/guard.service';
import { OrdersService } from './orders.service';

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
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
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
}
