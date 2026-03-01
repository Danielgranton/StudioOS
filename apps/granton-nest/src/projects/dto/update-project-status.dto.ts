import { ProjectStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, Max, Min } from 'class-validator';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;

  @IsOptional()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
