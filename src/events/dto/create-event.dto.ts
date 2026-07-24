import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventCategory } from 'generated/prisma/client';

export class CreateTicketTierDto {
  @IsString()
  @IsOptional()
  id?: string; // present on updates to match existing tiers

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  price: number; // in kobo

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsString()
  @IsNotEmpty()
  date: string; // ISO date string

  @IsString()
  @IsNotEmpty()
  doorsOpen: string; // e.g. "19:00 WAT"

  @IsString()
  @IsNotEmpty()
  venueName: string;

  @IsString()
  @IsOptional()
  venueAddress?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  dressCode?: string;

  @IsBoolean()
  @IsOptional()
  isMemberOnly?: boolean;

  // Admin-only; ignored on vendor-submitted events
  @IsInt()
  @Min(0)
  @IsOptional()
  serviceFee?: number; // in kobo, per ticket

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketTierDto)
  ticketTiers: CreateTicketTierDto[];
}
