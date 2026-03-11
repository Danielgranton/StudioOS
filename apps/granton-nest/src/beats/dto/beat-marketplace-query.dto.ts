import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BeatMarketplaceQueryDto {
  @IsString()
  @IsOptional()
  genre?: string;

  @IsString()
  @IsOptional()
  musicalKey?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  producerId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minBpm?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxBpm?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @IsString()
  @IsIn(['createdAt', 'bpm', 'title'])
  @IsOptional()
  sortBy?: 'createdAt' | 'bpm' | 'title' = 'createdAt';

  @IsString()
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}
