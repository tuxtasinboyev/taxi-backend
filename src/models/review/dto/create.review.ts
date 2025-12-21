import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateReviewDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    order_id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    from_user_id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    to_user_id: string;

    @ApiProperty()
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty()
    @IsOptional()
    @IsString()
    comment?: string;

    @ApiProperty()
    @IsOptional()
    @IsEnum(Language)
    language?: Language;


}
