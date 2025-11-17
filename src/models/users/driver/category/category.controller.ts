import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { fileStorages } from 'src/common/types/upload_types';
import { Language } from 'src/utils/helper';
import { CategoryService } from './category.service';
import { CreateTaxiCategoryDto } from './dto/create.driver.dto';

@ApiTags('Taxi Categories')
@Controller('taxi-categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) { }
    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Post()
    @ApiOperation({ summary: 'Create a new taxi category (admin)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Create Taxi Category',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                language: { type: 'string', enum: Object.values(Language) },
                is_active: { type: 'boolean' },
                icon: {
                    type: 'string',
                    format: 'binary',
                },
                price: {
                    type: 'decimal',
                    format: 'decimal',
                    example: 5.500,
                    description: 'Price per kilometer (Decimal, e.g. 10.255)',
                },
            },
            required: ['name', 'language', 'icon', 'price'],
        },
    })

    @ApiResponse({ status: 201, description: 'Category created successfully' })
    @UseInterceptors(FileInterceptor('icon', fileStorages(['image'])))
    async createTaxiCategory(
        @Body() data: CreateTaxiCategoryDto,
        @UploadedFile() icon: Express.Multer.File,
    ) {
        // is_active ni string dan boolean ga o'zgartirish
        if (typeof data.is_active === 'string') {
            data.is_active = data.is_active === 'true';
        }

        if (!icon) throw new BadRequestException('Icon file is required');
        const iconUrl = icon.filename; // Yoki yuklash logikangizga qarab to'liq URL ham bo'lishi mumkin
        return this.categoryService.createTaxiCategory(data, iconUrl);
    }

    @Get()
    @ApiOperation({ summary: 'Get all active taxi categories' })
    @ApiQuery({ name: 'language', enum: Language, required: false })
    @ApiResponse({ status: 200, description: 'List of categories' })
    async getAllTaxiCategories(@Query('language') language?: Language) {
        return this.categoryService.getAllTaxiCategories(language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get taxi category by ID' })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @ApiResponse({ status: 200, description: 'Category data' })
    async getTaxiCategoryById(@Param('id') id: string) {
        return this.categoryService.getTaxiCategoryById(id);
    }
    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Put(':id')
    @ApiOperation({ summary: 'Update taxi category (admin)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Update Taxi Category',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                language: { type: 'string', enum: Object.values(Language) },
                is_active: { type: 'boolean' },
                icon: {
                    type: 'string',
                    format: 'binary',
                },
                price: {
                    type: 'number',
                    format: 'decimal',
                    example: 5.500,
                    description: 'Price per kilometer (Decimal, e.g. 10.255)',
                },
            },
        },
    })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @UseInterceptors(FileInterceptor('icon', fileStorages(['image'])))
    async updateTaxiCategory(
        @Param('id') id: string,
        @Body() data: Partial<CreateTaxiCategoryDto>,
        @UploadedFile() icon?: Express.Multer.File,
    ) {
        if (data.is_active && typeof data.is_active === 'string') {
            data.is_active = data.is_active === 'true';
        }
        const iconUrl = icon ? icon.filename : undefined;
        return this.categoryService.updateTaxiCategory(id, data, iconUrl);
    }

    @UseGuards(GuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Delete(':id')
    @ApiOperation({ summary: 'Delete taxi category (admin)' })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @ApiResponse({ status: 200, description: 'Category deleted' })
    async deleteTaxiCategory(@Param('id') id: string) {
        return this.categoryService.deleteTaxiCategory(id);
    }
}
