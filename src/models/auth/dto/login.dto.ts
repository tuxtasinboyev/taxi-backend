import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, Length } from "class-validator";

export class LoginAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(9, 13)
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @Length(9, 13)
  phone: string;

  @ApiProperty({ example: 'newStrongPassword123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
