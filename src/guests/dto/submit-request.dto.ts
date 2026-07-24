import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitRequestDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(7)
  phone: string;

  @IsOptional()
  @IsString()
  message?: string;
}
