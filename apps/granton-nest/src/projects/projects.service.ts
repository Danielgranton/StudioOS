  import { Injectable } from "@nestjs/common";
  import { PrismaService } from "../../prisma/prisma.service";
  import { CreateProjectDto } from "./dto/create-project.dto";
  import { UpdateProjectStatusDto } from "./dto/update-project-status.dto";
  import { AttachProjectDto } from "./dto/attach-project.dto";
  import { ProjectStatus } from "@prisma/client";

  @Injectable()
  export class ProjectsService {
    constructor(private prisma: PrismaService) {}

    private readonly progressMap: Record<ProjectStatus, number> = {
      BOOKED: 20,
      FULLY_PAID: 50,
      RECORDING: 60,
      MIXING: 80,
      MASTERING: 90,
      READY: 100,
    };

    private addDays(date: Date, days: number): Date {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }

    async createFromBooking(dto: CreateProjectDto) {
      const status =
        dto.paymentStatus === "FULLY_PAID"
          ? ProjectStatus.FULLY_PAID
          : ProjectStatus.BOOKED;

      return this.prisma.project.create({
        data: {
          title: dto.title,
          artistId: dto.artistId,
          producerId: dto.producerId,
          studioId: dto.studioId,
          bookingRef: dto.bookingRef,
          paymentRef: dto.paymentRef,
          status,
          progress: this.progressMap[status],
          startedAt: new Date(),
          dueAt: this.addDays(new Date(), 7),
        },
      });
    }

    async updateStatus(projectId: number, dto: UpdateProjectStatusDto) {
      return this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: dto.status,
          progress: this.progressMap[dto.status],
          completedAt: dto.status === ProjectStatus.MASTERING ? new Date() : null,
        },
      });
    }

    async attachProject(projectId: number, dto: AttachProjectDto) {
      return this.prisma.projectFile.create({
        data: {
          projectId,
          software: dto.software,
          projectPath: dto.projectPath,
          stage: dto.stage,
        },
      });
    }

    async getArtistProjects(artistId: number) {
      return this.prisma.project.findMany({
        where: { artistId },
        orderBy: { startedAt: "asc" },
        include: { files: true },
      });
    }


    async producerDashboard(producerId: number) {
      return this.prisma.project.findMany({
        where: {
          producerId,
          status: {
            in: ['RECORDING', 'MIXING', 'MASTERING', 'READY'],
          },
        },
        orderBy: { startedAt: "asc" },
        include: { 
          artist: true,
          studio: true,
          files: true,
        }
      })
    }
  }

