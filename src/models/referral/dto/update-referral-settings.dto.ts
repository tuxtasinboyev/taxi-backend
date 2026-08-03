import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateReferralSettingsDto {
    @ApiPropertyOptional({
        example: 25,
        description: "Referal qilgan haydovchi platforma komissiyasining necha foizini oladi (0-100)",
    })
    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    percent?: number;

    @ApiPropertyOptional({
        example: 30,
        description: "Bonus necha kun davomida beriladi. Kiritilmasa yoki null bo'lsa — muddatsiz",
        nullable: true,
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    duration_days?: number | null;

    @ApiPropertyOptional({ example: true, description: 'Referal tizimi yoqilgan/o\'chirilgan' })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
