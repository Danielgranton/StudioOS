import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateBeatDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  bpm?: number;

  @IsString()
  @IsOptional()
  musicalKey?: string;

  @IsUrl()
  @IsNotEmpty()
  previewAudioUrl: string;

  @IsUrl()
  @IsNotEmpty()
  fullAudioUrl: string;

  @IsUrl()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
