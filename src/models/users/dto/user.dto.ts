import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateUserForAdminDto {
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

    @ApiProperty({ example: 'passenger', enum: UserRole, required: false, default: UserRole.passenger })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
}
