import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePricingRuleDto } from './dto/create.priceRule.dto';
import { PriceService } from './price.service';
import { GuardService } from 'src/common/guard/guard.service';
import { Role } from 'src/common/decorators/role.decorator';
import { UpdatePricingRuleDto } from './dto/update.priceRule.dto';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';

@ApiTags('Pricing Rules')
@Controller('pricing-rules')
export class PriceController {
    constructor(private readonly priceService: PriceService) { }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Post()
    @ApiOperation({ summary: 'Yangi Pricing Rule yaratish' })
    @ApiResponse({ status: 201, description: 'Pricing rule muvaffaqiyatli yaratildi' })
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async create(@Body() dto: CreatePricingRuleDto) {
        return this.priceService.createPriceRule(dto);
    }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get()
    @ApiOperation({ summary: 'Barcha pricing qoidalarini olish' })
    @ApiResponse({ status: 200, description: 'Barcha pricing qoidalar ro‘yxati' })
    async findAll() {
        return this.priceService.getAllPriceRules();
    }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get('active')
    @ApiOperation({ summary: 'Faol pricing qoidani olish' })
    @ApiResponse({ status: 200, description: 'Faol pricing qoida qaytariladi' })
    async getActive() {
        return this.priceService.getActivePriceRule();
    }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get(':id')
    @ApiOperation({ summary: 'ID bo‘yicha pricing qoida olish' })
    @ApiResponse({ status: 200, description: 'Pricing qoida topildi' })
    async findById(@Param('id') id: string) {
        return this.priceService.getPriceRuleById(id);
    }
    @UseGuards(GuardService,RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Patch(':id')
    @ApiOperation({ summary: 'Pricing qoidani yangilash' })
    @ApiResponse({ status: 200, description: 'Pricing qoida yangilandi' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePricingRuleDto,
    ) {
        return this.priceService.updatePriceRule(id, dto);
    }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Delete(':id')
    @ApiOperation({ summary: 'Pricing qoidani o‘chirish' })
    @ApiResponse({ status: 200, description: 'Pricing qoida o‘chirildi' })
    async remove(@Param('id') id: string) {
        return this.priceService.deletePriceRule(id);
    }
}
