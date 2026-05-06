import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
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
import { UserData } from 'src/common/decorators/auth.decorators';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import type { JwtPayload } from 'src/config/jwt/jwt.service';
import { Language } from 'src/utils/helper';
import { CreateReviewDto } from './dto/create.review';
import { ReviewService } from './review.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(GuardService)
@Controller('reviews')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) {}

    @Post()
    @ApiOperation({ summary: 'Baho qoldirish (foydalanuvchi)' })
    @ApiResponse({ status: 201, description: 'Baho muvaffaqiyatli qoldirildi' })
    @ApiResponse({ status: 403, description: 'Ruxsat yo\'q yoki buyurtma yakunlanmagan' })
    @ApiResponse({ status: 404, description: 'Order yoki foydalanuvchi topilmadi' })
    async createReview(@Body() dto: CreateReviewDto, @UserData() user: JwtPayload) {
        return this.reviewService.createReview(dto, user.id);
    }

    @Get('my')
    @ApiOperation({ summary: 'Mening baholarim (yuborgan va qabul qilgan)' })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.uz })
    @ApiResponse({ status: 200, description: 'Baholar ro\'yxati' })
    async getMyReviews(
        @UserData() user: JwtPayload,
        @Query('language') language: Language = Language.uz,
    ) {
        return this.reviewService.getMyReviews(user.id, language);
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Get()
    @ApiOperation({ summary: 'Barcha baholar (admin)' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.uz })
    @ApiQuery({ name: 'order_id', required: false, type: String })
    @ApiQuery({ name: 'from_user_id', required: false, type: String })
    @ApiQuery({ name: 'to_user_id', required: false, type: String })
    @ApiQuery({ name: 'rating', required: false, type: Number, description: '1-5' })
    @ApiResponse({ status: 200, description: 'Baholar ro\'yxati pagination bilan' })
    async getAllReviews(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
        @Query('language') language: Language = Language.uz,
        @Query('order_id') order_id?: string,
        @Query('from_user_id') from_user_id?: string,
        @Query('to_user_id') to_user_id?: string,
        @Query('rating') rating?: string,
    ) {
        return this.reviewService.getAllReviews(
            parseInt(page, 10),
            parseInt(limit, 10),
            language,
            order_id,
            from_user_id,
            to_user_id,
            rating ? parseInt(rating, 10) : undefined,
        );
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Get(':id')
    @ApiOperation({ summary: 'ID bo\'yicha baho olish (admin)' })
    @ApiParam({ name: 'id', description: 'Review UUID' })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.uz })
    @ApiResponse({ status: 200, description: 'Baho ma\'lumotlari' })
    @ApiResponse({ status: 404, description: 'Baho topilmadi' })
    async getReviewById(
        @Param('id') id: string,
        @Query('language') language: Language = Language.uz,
    ) {
        return this.reviewService.getReviewById(id, language);
    }

    @UseGuards(GuardService, RoleGuardService)
    @Role('admin','superadmin')
    @Delete(':id')
    @ApiOperation({ summary: 'Bahoni o\'chirish (admin)' })
    @ApiParam({ name: 'id', description: 'Review UUID' })
    @ApiResponse({ status: 200, description: 'Baho o\'chirildi' })
    @ApiResponse({ status: 404, description: 'Baho topilmadi' })
    async deleteReview(@Param('id') id: string) {
        return this.reviewService.deleteReview(id);
    }
}
