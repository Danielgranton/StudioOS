import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  artistId!: number;

  @IsInt()
  producerId!: number;

  @IsUUID()
  studioId!: string;

  @IsString()
  @IsNotEmpty()
  bookingRef!: string;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsIn(['BOOKED', 'FULLY_PAID'])
  paymentStatus?: 'BOOKED' | 'FULLY_PAID';

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
