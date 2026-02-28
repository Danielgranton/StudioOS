import { ProjectStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class AttachProjectDto {
  @IsString()
  @IsNotEmpty()
  software!: string;

  @IsString()
  @IsNotEmpty()
  projectPath!: string;

  @IsEnum(ProjectStatus)
  stage!: ProjectStatus;
}
