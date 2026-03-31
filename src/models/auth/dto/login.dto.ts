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
  @Length(6, 6)
  otp: string;
}