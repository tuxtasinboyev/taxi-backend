import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsString, IsNotEmpty, IsNumberString, IsBoolean } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateTaxiCategoryDto {
    @ApiProperty({ example: 'Comfort' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: Language, example: 'uz' })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ example: 'true', default: 'true' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({
        example: '5500',
        description: 'category narxi',
    })
    @IsNotEmpty()
    @IsNumberString() 
    price: string;
}