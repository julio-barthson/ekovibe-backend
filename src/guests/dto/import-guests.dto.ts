import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class GuestRowDto {
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

export class ImportGuestsDto {
  @IsUUID()
  eventId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestRowDto)
  guests: GuestRowDto[];
}
