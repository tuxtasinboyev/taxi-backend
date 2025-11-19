import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import { createUser, putApiBody } from 'src/common/types/api.body.types';
import { getAllUser, getMeResponse, putRessponse } from 'src/common/types/api.response';
import { fileStorages } from 'src/common/types/upload_types';
import { CreateUserForAdminDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Post()
    @ApiOperation({ summary: 'Create new user (Admin only)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody(createUser)
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    async createUser(
        @Body() data: CreateUserForAdminDto,
        @UploadedFile() photo: Express.Multer.File,
    ) {
        return this.usersService.createUser(data, photo.filename);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse(getMeResponse)
    @ApiResponse({ status: 404, description: 'User not found' })
    async getMe(@Req() req: any) {
        const userId = req.user.id;
        return this.usersService.Getme(userId);
    }
    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get()
    @ApiOperation({ summary: 'Get all users with pagination and filtering' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number' })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Items per page' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
    @ApiQuery({
        name: 'role',
        required: false,
        enum: ['passenger', 'driver', 'admin'],
        description: 'Filter by role'
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        enum: ['name_uz', 'name_ru', 'name_en', 'created_at', 'updated_at'],
        description: 'Sort field'
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        enum: ['asc', 'desc'],
        description: 'Sort order'
    })
    @ApiQuery({
        name: 'includeDriver',
        required: false,
        type: Boolean,
        example: true,
        description: 'Include driver details'
    })
    @ApiQuery({
        name: 'includeWallet',
        required: false,
        type: Boolean,
        example: true,
        description: 'Include wallet details'
    })
    @ApiQuery({
        name: 'includeStats',
        required: false,
        type: Boolean,
        example: true,
        description: 'Include statistics'
    })
    @ApiQuery({ name: 'phone', required: false, type: String, description: 'Filter by phone' })
    @ApiQuery({ name: 'email', required: false, type: String, description: 'Filter by email' })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for filtering' })
    @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for filtering' })
    @ApiResponse(getAllUser)
    async getAllUsers(@Query() query: any) {
        return this.usersService.getUserAll(query);
    }

    @UseGuards(GuardService)
    @ApiBearerAuth()
    @Put('me')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiConsumes('multipart/form-data')
    @ApiBody(putApiBody)
    @ApiResponse(putRessponse)
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    @UseInterceptors(FileInterceptor('photo', fileStorages(['image'])))
    async updateMe(
        @Req() req: any,
        @Body() data: Partial<CreateUserForAdminDto>,
        @UploadedFile() photo?: Express.Multer.File,
    ) {
        const userId = req.user.id;
        if (photo) {
            return this.usersService.updateMe(userId, data, photo.filename);
        }
        return this.usersService.updateMe(userId, data);
    }

    @UseGuards(GuardService, RoleGuardService)
    @ApiBearerAuth()
    @Role('admin')
    @Delete(':id')
    @ApiOperation({ summary: 'Delete user by id' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deleteUser(@Param('id') id: string) {
        return this.usersService.deleteUser(id);
    }
}
