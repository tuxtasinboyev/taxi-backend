import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { GuardService } from 'src/common/guard/guard.service';
import { getMeResponseDriver, putMeResponseDriver } from 'src/common/types/api.response';
import { fileStorages } from 'src/common/types/upload_types';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create.driver.dto';

@ApiTags('Drivers')
@Controller('drivers')
export class DriverController {
    constructor(private readonly driverService: DriverService) { }

    @Post()
    @ApiOperation({ summary: 'Create new driver' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    @ApiBody({
        description: 'Driver data with optional photo upload',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Azizbek' },
                phone: { type: 'string', example: '+998901234567' },
                email: { type: 'string', example: 'azizbek@example.com' },
                password: { type: 'string', example: '123456' },
                car_model: { type: 'string', example: 'Cobalt' },
                car_color: { type: 'string', example: 'Oq' },
                car_number: { type: 'string', example: '80A123BC' },
                taxi_category_id: { type: 'string', example: 'b123d-uuid' },
                language: { type: 'string', enum: ['uz', 'ru', 'en'], example: 'uz' },
                photo: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Driver successfully created' })
    async createDriver(
        @Body() data: CreateDriverDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const photoUrl = file?.filename;
        return this.driverService.createDriver(data, photoUrl);
    }

    @Get()
    @ApiOperation({ summary: 'Get all drivers (with pagination and search)' })
    @ApiQuery({ name: 'page', required: false, example: '1' })
    @ApiQuery({ name: 'limit', required: false, example: '10' })
    @ApiQuery({ name: 'search', required: false, example: 'Azizbek' })
    @ApiQuery({ name: 'language', required: false, enum: ['uz', 'ru', 'en'] })
    async getAllDrivers(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('curdNumber') curdNumber?: number,
        @Query('language') language?: Language,
    ) {
        return this.driverService.getAllDriver({
            page,
            limit,
            search,
            curdNumber,
            language,
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get driver by ID' })
    @ApiParam({ name: 'id', description: 'Driver ID', example: 'b123d-uuid' })
    async getDriverById(@Param('id') id: string) {
        return this.driverService.getDriverById(id);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('me')
    @ApiOperation({ summary: 'Get driver personal profile by ID' })
    @ApiResponse(getMeResponseDriver)
    @ApiResponse({ status: 404, description: 'Driver not found' })
    async getMe(@UserData() user: JwtPayload) {
        return this.driverService.getMe(user.id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update existing driver' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    @ApiParam({ name: 'id', description: 'Driver ID', example: 'b123d-uuid' })
    @ApiBody({
        description: 'Driver update data (partial)',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Azizbek' },
                phone: { type: 'string', example: '+998901234567' },
                email: { type: 'string', example: 'azizbek@example.com' },
                password: { type: 'string', example: 'newPassword' },
                car_model: { type: 'string', example: 'Malibu' },
                car_color: { type: 'string', example: 'Qora' },
                car_number: { type: 'string', example: '80A777AA' },
                language: { type: 'string', enum: ['uz', 'ru', 'en'] },
                photo: { type: 'string', format: 'binary' },
            },
        },
    })
    async updateDriver(
        @Param('id') id: string,
        @Body() data: Partial<CreateDriverDto>,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const photoUrl = file?.filename;
        return this.driverService.updatateDriver(id, data, photoUrl);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Patch('me')
    @ApiOperation({ summary: 'Update driver personal profile (self update)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    @ApiBody({
        description: 'Driver self-update data (partial)',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Azizbek' },
                phone: { type: 'string', example: '+998901234567' },
                email: { type: 'string', example: 'azizbek@example.com' },
                password: { type: 'string', example: 'newPassword123' },
                car_model: { type: 'string', example: 'Malibu' },
                car_color: { type: 'string', example: 'Qora' },
                car_number: { type: 'string', example: '80A777AA' },
                language: { type: 'string', enum: ['uz', 'ru', 'en'], example: 'uz' },
                photo: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiResponse(putMeResponseDriver)
    @ApiResponse({ status: 404, description: 'Driver not found' })
    async updateMe(
        @UserData() user: JwtPayload,
        @Body() data: Partial<CreateDriverDto>,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const photoUrl = file?.filename;
        return this.driverService.updateMe(user.id, data, photoUrl);
    }


    @Delete(':id')
    @ApiOperation({ summary: 'Delete driver by ID' })
    @ApiParam({ name: 'id', description: 'Driver ID', example: 'b123d-uuid' })
    async deleteDriver(@Param('id') id: string) {
        return this.driverService.deleteDriver(id);
    }
}
