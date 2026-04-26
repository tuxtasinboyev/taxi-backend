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
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { AddCardDto, CardService } from './card.service';

@ApiTags('Cards')
@ApiBearerAuth()
@UseGuards(GuardService)
@Controller('cards')
export class CardController {
    constructor(private readonly cardService: CardService) {}

    @Post()
    @ApiOperation({ summary: 'Karta qo\'shish (foydalanuvchi)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['provider', 'token', 'last4', 'brand', 'expiry_month', 'expiry_year'],
            properties: {
                provider: { type: 'string', example: 'payme' },
                token: { type: 'string', example: 'card_token_xyz' },
                last4: { type: 'string', example: '4242' },
                brand: { type: 'string', example: 'Visa' },
                expiry_month: { type: 'number', example: 12 },
                expiry_year: { type: 'number', example: 2027 },
                is_default: { type: 'boolean', example: true },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Karta qo\'shildi' })
    @ApiResponse({ status: 409, description: 'Karta allaqachon mavjud' })
    async addCard(@Body() dto: AddCardDto, @UserData() user: JwtPayload) {
        return this.cardService.addCard(user.id, dto);
    }

    @Get('my')
    @ApiOperation({ summary: 'Mening kartalarim' })
    @ApiResponse({ status: 200, description: 'Kartalar ro\'yxati' })
    async getMyCards(@UserData() user: JwtPayload) {
        return this.cardService.getMyCards(user.id);
    }

    @Patch(':id/default')
    @ApiOperation({ summary: 'Asosiy kartani o\'zgartirish' })
    @ApiParam({ name: 'id', description: 'Card UUID' })
    @ApiResponse({ status: 200, description: 'Asosiy karta o\'rnatildi' })
    @ApiResponse({ status: 404, description: 'Karta topilmadi' })
    async setDefault(@Param('id') id: string, @UserData() user: JwtPayload) {
        return this.cardService.setDefault(user.id, id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Kartani o\'chirish (foydalanuvchi)' })
    @ApiParam({ name: 'id', description: 'Card UUID' })
    @ApiResponse({ status: 200, description: 'Karta o\'chirildi' })
    @ApiResponse({ status: 404, description: 'Karta topilmadi' })
    async deleteCard(@Param('id') id: string, @UserData() user: JwtPayload) {
        return this.cardService.deleteCard(user.id, id);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @Get()
    @ApiOperation({ summary: 'Barcha kartalar (admin)' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'user_id', required: false, type: String, description: 'Filter by user' })
    @ApiResponse({ status: 200, description: 'Kartalar ro\'yxati pagination bilan' })
    async getAllCards(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('user_id') user_id?: string,
    ) {
        return this.cardService.getAllCards(parseInt(page, 10), parseInt(limit, 10), user_id);
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @Delete('admin/:id')
    @ApiOperation({ summary: 'Kartani o\'chirish (admin)' })
    @ApiParam({ name: 'id', description: 'Card UUID' })
    @ApiResponse({ status: 200, description: 'Karta o\'chirildi' })
    @ApiResponse({ status: 404, description: 'Karta topilmadi' })
    async adminDeleteCard(@Param('id') id: string) {
        return this.cardService.adminDeleteCard(id);
    }
}
