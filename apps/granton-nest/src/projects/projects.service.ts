import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.producerId) {
      const producer = await this.prisma.user.findUnique({
        where: { id: dto.producerId },
      });
      if (!producer) {
        throw new BadRequestException('producerId does not exist');
      }
      if (producer.role !== 'PRODUCER') {
        throw new BadRequestException('producerId must be a PRODUCER');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        artistId: dto.artistId,
        producerId: dto.producerId,
        status: dto.status,
        progress: dto.progress,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: { artist: true, producer: true },
    });
    return project;
  }

  async list() {
    return this.prisma.project.findMany({
      include: { artist: true, producer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { artist: true, producer: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async updateStatus(id: number, dto: UpdateProjectStatusDto) {
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        status: dto.status,
        progress: dto.progress,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
    return project;
  }
}
