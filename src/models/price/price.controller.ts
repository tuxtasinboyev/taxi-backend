import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePricingRuleDto } from './dto/create.priceRule.dto';
import { PriceService } from './price.service';

@ApiTags('Pricing Rules')
@Controller('pricing-rules')
export class PriceController {
    constructor(private readonly priceService: PriceService) { }

    @Post()
    @ApiOperation({ summary: 'Yangi Pricing Rule yaratish' })
    @ApiResponse({ status: 201, description: 'Pricing rule muvaffaqiyatli yaratildi' })
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async create(@Body() dto: CreatePricingRuleDto) {
        return this.priceService.createPriceRule(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Barcha pricing qoidalarini olish' })
    @ApiResponse({ status: 200, description: 'Barcha pricing qoidalar ro‘yxati' })
    async findAll() {
        return this.priceService.getAllPriceRules();
    }

    @Get('active')
    @ApiOperation({ summary: 'Faol pricing qoidani olish' })
    @ApiResponse({ status: 200, description: 'Faol pricing qoida qaytariladi' })
    async getActive() {
        return this.priceService.getActivePriceRule();
    }

    @Get(':id')
    @ApiOperation({ summary: 'ID bo‘yicha pricing qoida olish' })
    @ApiResponse({ status: 200, description: 'Pricing qoida topildi' })
    async findById(@Param('id') id: string) {
        return this.priceService.getPriceRuleById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Pricing qoidani yangilash' })
    @ApiResponse({ status: 200, description: 'Pricing qoida yangilandi' })
    async update(
        @Param('id') id: string,
        @Body() dto: Partial<CreatePricingRuleDto>,
    ) {
        return this.priceService.updatePriceRule(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Pricing qoidani o‘chirish' })
    @ApiResponse({ status: 200, description: 'Pricing qoida o‘chirildi' })
    async remove(@Param('id') id: string) {
        return this.priceService.deletePriceRule(id);
    }
}
