import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PromocodeService } from './promocode.service';
import { CreatePromoCodeDto } from './dto/create.promocode.dto';

@ApiTags('Promo Codes')
@Controller('promocodes')
export class PromocodeController {
    constructor(private readonly promocodeService: PromocodeService) { }

    @Post()
    @ApiOperation({ summary: 'Yangi promo kod yaratish' })
    @ApiResponse({ status: 201, description: 'Promokod muvaffaqiyatli yaratildi.' })
    @ApiResponse({ status: 409, description: 'Bu promokod allaqachon mavjud.' })
    async create(@Body() dto: CreatePromoCodeDto) {
        return this.promocodeService.createPromocode(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Barcha promokodlarni olish' })
    @ApiResponse({ status: 200, description: 'Promokodlar ro‘yxati' })
    async getAll() {
        return this.promocodeService.getAllPromocode();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Bitta promokodni ID orqali olish' })
    @ApiResponse({ status: 200, description: 'Promokod ma’lumoti topildi' })
    @ApiResponse({ status: 404, description: 'Promokod topilmadi' })
    async getOne(@Param('id') id: string) {
        return this.promocodeService.getOnePromocode(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Promokodni yangilash' })
    @ApiResponse({ status: 200, description: 'Promokod yangilandi' })
    @ApiResponse({ status: 404, description: 'Promokod topilmadi' })
    async update(@Param('id') id: string, @Body() dto: Partial<CreatePromoCodeDto>) {
        return this.promocodeService.updatePromocode(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Promokodni o‘chirish' })
    @ApiResponse({ status: 200, description: 'Promokod muvaffaqiyatli o‘chirildi' })
    @ApiResponse({ status: 404, description: 'Promokod topilmadi' })
    async delete(@Param('id') id: string) {
        return this.promocodeService.deletePromocode(id);
    }
}
