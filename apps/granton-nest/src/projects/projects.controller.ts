import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body() body: CreateProjectDto) {
    return this.projects.create(body);
  }

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.projects.get(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectStatusDto,
  ) {
    return this.projects.updateStatus(id, body);
  }
}
