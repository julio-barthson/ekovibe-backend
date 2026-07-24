import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsDateString()
  rsvpDeadline?: string;

  @IsOptional()
  @IsString()
  customMessage?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  photoGalleryUrl?: string;

  @IsOptional()
  @IsString()
  followUpMessage?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  inviteHeaderImageUrl?: string;

  @IsOptional()
  @IsString()
  inviteFromName?: string;

  @IsOptional()
  @IsBoolean()
  allowRequests?: boolean;
}
