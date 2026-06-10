import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { DriverRequestService } from './driver-request.service';
import { CreateDriverRequestDto, RejectDriverRequestDto } from './dto/driver-request.dto';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import { Role } from 'src/common/decorators/role.decorator';
import { UserData } from 'src/common/decorators/auth.decorators';
import type { JwtPayload } from 'src/config/jwt/jwt.service';

@ApiTags('Driver Requests')
@ApiBearerAuth()
@UseGuards(GuardService)
@Controller('driver-requests')
export class DriverRequestController {
    constructor(private readonly driverRequestService: DriverRequestService) {}

    @Post()
    @UseGuards(RoleGuardService)
    @Role('passenger')
    @ApiOperation({ summary: 'Haydovchi bo\'lish uchun so\'rov yuborish (passenger)' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'So\'rov yuborildi' })
    async createRequest(@Body() dto: CreateDriverRequestDto, @UserData() user: JwtPayload) {
        return this.driverRequestService.createRequest(user.id, dto);
    }

    @Get()
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'Barcha so\'rovlarni olish (admin)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'rejected'] })
    async getAllRequests(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: string,
    ) {
        return this.driverRequestService.getAllRequests(page, limit, status);
    }

    @Get(':id')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'Bitta so\'rovni olish (admin)' })
    @ApiParam({ name: 'id', description: 'DriverRequest ID' })
    async getRequestById(@Param('id') id: string) {
        return this.driverRequestService.getRequestById(id);
    }

    @Patch(':id/accept')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'So\'rovni qabul qilish — foydalanuvchi haydovchiga aylanadi (admin)' })
    @ApiParam({ name: 'id', description: 'DriverRequest ID' })
    async acceptRequest(@Param('id') id: string) {
        return this.driverRequestService.acceptRequest(id);
    }

    @Patch(':id/reject')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'So\'rovni rad etish (admin)' })
    @ApiParam({ name: 'id', description: 'DriverRequest ID' })
    async rejectRequest(@Param('id') id: string, @Body() dto: RejectDriverRequestDto) {
        return this.driverRequestService.rejectRequest(id, dto);
    }
}
