import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create.payment.dto';
import { Language } from 'src/utils/helper';
import { GuardService } from 'src/common/guard/guard.service';
import { UserData } from 'src/common/decorators/auth.decorators';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { Role } from 'src/common/decorators/role.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }
    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Post()
    @ApiOperation({ summary: 'Create new payment' })
    @ApiBody({ type: CreatePaymentDto })
    @ApiResponse({ status: 201, description: 'Payment created successfully' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async createPayment(@Body() body: CreatePaymentDto) {
        return this.paymentService.createPayment(body);
    }
    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get()
    @ApiOperation({ summary: 'Get all payments' })
    @ApiResponse({ status: 200, description: 'List of all payments' })
    async getAllPayments() {
        return this.paymentService.getAllPayment();
    }

    @Get('order/:order_id')
    @ApiOperation({ summary: 'Get payments by order ID' })
    @ApiParam({ name: 'order_id', type: String })
    @ApiResponse({ status: 200, description: 'Payment found' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async getByOrderId(@Param('order_id') order_id: string) {
        return this.paymentService.getPaymentbyOrderId(order_id);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('my')
    @ApiOperation({ summary: 'Get all my payments (user or driver)' })
    @ApiResponse({ status: 200, description: 'List of payments' })
    async getAllMyPayments(
        @UserData() user: JwtPayload,
        @Query('language') language: Language,
    ) {
        return this.paymentService.getAllMyPayments(user.id, language);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('my/:payment_id')
    @ApiOperation({ summary: 'Get a single payment by ID (user or driver)' })
    @ApiResponse({ status: 200, description: 'Payment details' })
    @ApiParam({ name: 'payment_id', required: true })
    @ApiQuery({ name: 'language', required: true, enum: ['uz', 'ru', 'en'] })
    async getMyPaymentById(
        @UserData() user: JwtPayload,
        @Param('payment_id') payment_id: string,
        @Query('language') language: Language,
    ) {
        return this.paymentService.getMyPaymentById(user.id, payment_id, language);
    }
    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Put(':id')
    @ApiOperation({ summary: 'Update payment' })
    @ApiParam({ name: 'id', type: String })
    @ApiBody({ type: CreatePaymentDto, description: 'Partial DTO allowed' })
    @ApiResponse({ status: 200, description: 'Payment updated successfully' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async updatePayment(@Param('id') id: string, @Body() body: Partial<CreatePaymentDto>) {
        return this.paymentService.updatePayment(id, body);
    }

    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Delete(':id')
    @ApiOperation({ summary: 'Delete payment' })
    @ApiParam({ name: 'id', type: String })
    @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async deletePayment(@Param('id') id: string) {
        return this.paymentService.deletePayment(id);
    }

    @Put('active/:id')
    @ApiOperation({ summary: 'Deactivate payment (set active=false)' })
    @ApiParam({ name: 'id', type: String })
    @ApiResponse({ status: 200, description: 'Payment deactivated successfully' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async updateActive(@Param('id') id: string) {
        return this.paymentService.updateActive(id);
    }
}
