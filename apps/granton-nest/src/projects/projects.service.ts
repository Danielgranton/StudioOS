import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachProjectDto } from './dto/attach-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private readonly progressMap: Record<ProjectStatus, number> = {
    BOOKED: 20,
    FULLY_PAID: 50,
    RECORDING: 60,
    MIXING: 80,
    MASTERING: 100,
    READY: 100,
  };

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  async createFromBooking(dto: CreateProjectDto) {
    return this.create(dto);
  }

  async create(dto: CreateProjectDto) {
    const artist = await this.prisma.user.findUnique({
      where: { id: dto.artistId },
    });
    if (!artist) {
      throw new BadRequestException('artistId does not exist');
    }
    if (artist.role !== 'ARTIST') {
      throw new BadRequestException('artistId must be an ARTIST');
    }

    const producer = await this.prisma.user.findUnique({
      where: { id: dto.producerId },
    });
    if (!producer) {
      throw new BadRequestException('producerId does not exist');
    }
    if (producer.role !== 'PRODUCER') {
      throw new BadRequestException('producerId must be a PRODUCER');
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: dto.studioId },
    });
    if (!studio) {
      throw new BadRequestException('studioId does not exist');
    }

    const status =
      dto.status ??
      (dto.paymentStatus === 'FULLY_PAID' ? ProjectStatus.FULLY_PAID : ProjectStatus.BOOKED);
    const startedAt = new Date();
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : this.addDays(startedAt, 7);

    return this.prisma.project.create({
      data: {
        title: dto.title,
        artistId: dto.artistId,
        producerId: dto.producerId,
        studioId: dto.studioId,
        bookingRef: dto.bookingRef,
        paymentRef: dto.paymentRef,
        status,
        progress: dto.progress ?? this.progressMap[status],
        startedAt,
        dueAt,
      },
      include: { artist: true, producer: true, studio: true, files: true },
    });
  }

  async list() {
    return this.prisma.project.findMany({
      include: { artist: true, producer: true, studio: true, files: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { artist: true, producer: true, studio: true, files: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async updateStatus(id: number, dto: UpdateProjectStatusDto) {
    return this.prisma.project.update({
      where: { id },
      data: {
        status: dto.status,
        progress: dto.progress ?? this.progressMap[dto.status],
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
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
      orderBy: { startedAt: 'asc' },
      include: { files: true, studio: true, producer: true },
    });
  }

  async producerDashboard(producerId: number) {
    return this.prisma.project.findMany({
      where: {
        producerId,
        status: {
          in: [ProjectStatus.RECORDING, ProjectStatus.MIXING, ProjectStatus.MASTERING, ProjectStatus.READY],
        },
      },
      orderBy: { startedAt: 'asc' },
      include: {
        artist: true,
        studio: true,
        files: true,
      },
    });
  }
}
