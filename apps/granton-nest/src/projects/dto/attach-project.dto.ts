import { ProjectStatus } from "@prisma/client";

export class AttachProjectDto {
    software: string;
    projectPath: string;
    stage: ProjectStatus;
}