import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UploadBeatDto {
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

  @IsString()
  @IsOptional()
  description?: string;
}
