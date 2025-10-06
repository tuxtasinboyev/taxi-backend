import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateUserDto {
    @ApiProperty({ example: 'uz', enum: Language })
    @IsNotEmpty()
    @IsEnum(Language)
    lang: Language;

    @ApiProperty({ example: 'Otabek' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: '+998901234567' })
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'maxfiy so\'z' })
    @IsNotEmpty()
    password: string;

    @ApiProperty({ example: 'user@example.com', required: false })
    @IsEmail()
    email: string;
}
