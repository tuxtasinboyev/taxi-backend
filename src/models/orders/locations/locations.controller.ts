import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/auth.decorators';
import { GuardService } from 'src/common/guard/guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { LocationService } from './locations.service';
import { Role } from 'src/common/decorators/role.decorator';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';

@ApiTags('Location Service') // 📘 Swaggerda bo‘lim nomi
@Controller('api/location')
export class LocationController {
    constructor(private readonly locationService: LocationService) { }

    // 🛰️ Haydovchi joylashuvini saqlash
    @Post('save-driver-location')
    @UseGuards(GuardService)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Haydovchi locatsiyasini saqlash (har 2–5 soniyada)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                order_id: { type: 'string', example: 'ord_456' },
                lat: { type: 'number', example: 41.311081 },
                lng: { type: 'number', example: 69.240562 },
                speed: { type: 'number', example: 45 },
                bearing: { type: 'number', example: 120 },
            },
            required: ['driver_id', 'lat', 'lng'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Joylashuv muvaffaqiyatli saqlandi',
        schema: {
            example: {
                success: true,
                location: {
                    driver_id: 'drv_123',
                    lat: '41.311081',
                    lng: '69.240562',
                    timestamp: '2025-10-14T12:30:00Z',
                },
            },
        },
    })
    async saveDriverLocation(
        @Body()
        dto: {
            order_id: string;
            lat: number;
            lng: number;
            speed: number;
            bearing: number;
        },
        @UserData() driver: JwtPayload
    ) {
        const location = await this.locationService.saveDriverLocation(
            driver.id,
            dto.order_id,
            dto.lat,
            dto.lng,
            dto.speed,
            dto.bearing,
        );
        return { success: true, location };
    }

    // 👤 Yo‘lovchi joylashuvini saqlash
    @Post('save-passenger-location')
    @UseGuards(GuardService)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Yo‘lovchi locatsiyasini saqlash (har 10–30 soniyada)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                order_id: { type: 'string', example: 'ord_456' },
                lat: { type: 'number', example: 41.322222 },
                lng: { type: 'number', example: 69.255555 },
                accuracy: { type: 'number', example: 5 },
            },
            required: ['user_id', 'lat', 'lng'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Yo‘lovchi joylashuvi saqlandi',
    })
    async savePassengerLocation(
        @Body()
        dto: {
            order_id: string;
            lat: number;
            lng: number;
            accuracy: number;
        },
        @UserData() user: JwtPayload
    ) {
        const location = await this.locationService.savePassengerLocation(
            user.id,
            dto.order_id,
            dto.lat,
            dto.lng,
            dto.accuracy,
        );
        return { success: true, location };
    }

    // 🗺️ Order bo‘yicha yo‘l tarixi
    @Get('route-history/:order_id')
    @ApiOperation({ summary: 'Berilgan order uchun haydovchi va yo‘lovchi yo‘l tarixi' })
    @ApiParam({ name: 'order_id', example: 'ord_456' })
    @ApiResponse({
        status: 200,
        description: 'Zakas uchun marshrutlar qaytarildi',
        schema: {
            example: {
                driverRoute: [
                    { lat: '41.311081', lng: '69.240562', timestamp: '2025-10-14T12:30:00Z' },
                ],
                passengerRoute: [
                    { lat: '41.312000', lng: '69.250000', timestamp: '2025-10-14T12:32:00Z' },
                ],
            },
        },
    })
    async getRouteHistory(@Param('order_id') orderId: string) {
        const route = await this.locationService.getOrderRoute(orderId);
        return route;
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin')
    @ApiBearerAuth()
    @Get('all-locations')
    @ApiOperation({ summary: 'Get all driver and passenger locations' })
    @ApiResponse({
        status: 200,
        description: 'Successfully retrieved all locations',
        schema: {
            example: {
                success: true,
                message: 'All locations retrieved successfully',
                data: {
                    drivers: [
                        {
                            driverId: 'driver-uuid',
                            lat: 41.311081,
                            lng: 69.240562,
                            speed: 50,
                            bearing: 120,
                            timestamp: '2025-11-17T12:00:00.000Z',
                        },
                    ],
                    passengers: [
                        {
                            userId: 'user-uuid',
                            lat: 41.311081,
                            lng: 69.240562,
                            accuracy: 5,
                            timestamp: '2025-11-17T12:00:00.000Z',
                        },
                    ],
                },
            },
        },
    })
    async getAllLocations() {
        const locations = await this.locationService.getAllLocations();
        return {
            success: true,
            message: 'All locations retrieved successfully',
            data: locations,
        };
    }
}
