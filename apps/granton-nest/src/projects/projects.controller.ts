import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { AttachProjectDto } from './dto/attach-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

  // called by booking/payment service
  @Post('from-booking')
  createProject(@Body() dto: CreateProjectDto) {
    return this.projectService.createFromBooking(dto);
  }

  // artist dashboard
  @Get('artist/:artistId')
  getArtistProjects(@Param('artistId', ParseIntPipe) artistId: number) {
    return this.projectService.getArtistProjects(artistId);
  }

  // producer dashboard
  @Get('producer/dashboard')
  @Roles('PRODUCER')
  @UseGuards(RolesGuard)
  getProducerDashboard(@Req() req: { user: { userId: number } }) {
    return this.projectService.producerDashboard(req.user.userId);
  }

  @Get()
  list() {
    return this.projectService.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.get(id);
  }

  // producer updates project stage
  @Patch(':id/status')
  @Roles('PRODUCER')
  @UseGuards(RolesGuard)
  updateProjectStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectStatusDto) {
    return this.projectService.updateStatus(id, dto);
  }

  // attach DAW project path
  @Post(':id/attach')
  attachProject(@Param('id', ParseIntPipe) id: number, @Body() dto: AttachProjectDto) {
    return this.projectService.attachProject(id, dto);
  }
}
