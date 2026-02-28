import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectStatusDto } from "./dto/update-project-status.dto";
import { AttachProjectDto } from "./dto/attach-project.dto";
import { Roles } from "../roles/roles.decorator";

import { RolesGuard } from "../roles/roles.guard";

@Controller("projects")
export class ProjectsController {
  constructor(private projectService : ProjectsService) {}


  //called by booking/payment service
  @Post('from-booking')
  createProject(@Body() dto: CreateProjectDto) {
    return this.projectService.createFromBooking(dto);
  }

  //producer updates project stage
  @Patch(':id/status')
  @Roles('PRODUCER')
  updateProjectStatus(@Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectService.updateStatus(+id,dto);
  }

  //Attach DAW project path 
  @Post(':id/attach')
  attachProject(@Param('id') id: string, @Body() dto: AttachProjectDto) {
    return this.projectService.attachProject(+id, dto);
  }

  //Artist dashboard 
  @Get('artist/:artistId')
  getArtistProjects(@Param('artistId') artistId: string) {
    return this.projectService.getArtistProjects(+artistId);
  }

  //Producer dashboard
  @Get('producer/:dashboard')
  @Roles('PRODUCER')
  @UseGuards( RolesGuard)
  getProducerDashboard(@Req() req) {
    return this.projectService.producerDashboard(req.user.id);
  }
}