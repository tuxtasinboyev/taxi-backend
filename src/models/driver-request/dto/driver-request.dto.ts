import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDriverRequestDto {
    @ApiProperty({ example: 'Ali Valiyev' })
    @IsString()
    @IsNotEmpty()
    full_name: string;

    @ApiProperty({ example: '+998901234567' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'Chevrolet Cobalt' })
    @IsString()
    @IsNotEmpty()
    car_model: string;

    @ApiProperty({ example: '01A123BC' })
    @IsString()
    @IsNotEmpty()
    car_number: string;

    @ApiProperty({ example: 'DL-1234567' })
    @IsString()
    @IsNotEmpty()
    license_number: string;
}

export class RejectDriverRequestDto {
    @ApiPropertyOptional({ example: 'Hujjatlar to\'liq emas' })
    @IsString()
    @IsOptional()
    reject_reason?: string;
}
