import { Type } from 'class-transformer';
import { ConversationType } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  projectId?: number;

  @IsString()
  @IsOptional()
  bookingRef?: string;

  @IsString()
  @IsOptional()
  beatId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  artistId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  producerId?: number;

  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  participantIds: number[];
}
