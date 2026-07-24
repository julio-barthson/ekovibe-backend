import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddGuestDto {
  @IsUUID()
  eventId: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;
}
