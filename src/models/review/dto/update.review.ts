import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Language } from 'src/utils/helper';

export class UpdateReviewDto {
    @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    rating?: number;

    @ApiPropertyOptional({ example: 'Yaxshi haydovchi' })
    @IsOptional()
    @IsString()
    comment?: string;

    @ApiPropertyOptional({ enum: Language, example: Language.uz })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}
