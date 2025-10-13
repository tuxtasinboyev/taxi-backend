import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    UploadedFile,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { fileStorages } from 'src/common/types/upload_types';
import { Language } from 'src/utils/helper';
import { CategoryService } from './category.service';
import { CreateTaxiCategoryDto } from './dto/create.driver.dto';

@ApiTags('Taxi Categories')
@Controller('taxi-categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new taxi category' })
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
            },
            required: ['name', 'language', 'icon'],
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

        if (!icon) throw new Error('Icon file is required');
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

    @Put(':id')
    @ApiOperation({ summary: 'Update taxi category' })
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

    @Delete(':id')
    @ApiOperation({ summary: 'Delete taxi category' })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @ApiResponse({ status: 200, description: 'Category deleted' })
    async deleteTaxiCategory(@Param('id') id: string) {
        return this.categoryService.deleteTaxiCategory(id);
    }
}
