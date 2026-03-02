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
import { AuthGuard } from "@nestjs/passport";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectStatusDto } from "./dto/update-project-status.dto";
import { AttachProjectDto } from "./dto/attach-project.dto";
import { CreateProjectMessageDto } from "./dto/create-project-message.dto";
import { Roles } from "../roles/roles.decorator";

import { RolesGuard } from "../roles/roles.guard";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}


  //called by booking/payment service
  @Post('from-booking')
  createProject(@Body() dto: CreateProjectDto) {
    return this.projectService.createFromBooking(dto);
  }

  //producer updates project stage
  @Patch(':id/status')
  @Roles('PRODUCER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  updateProjectStatus(@Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectService.updateStatus(+id,dto);
  }

  //Attach DAW project path 
  @Post(':id/attach')
  @Roles('PRODUCER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  attachProject(@Param('id') id: string, @Body() dto: AttachProjectDto) {
    return this.projectService.attachProject(+id, dto);
  }

  //Artist dashboard 
  @Get('artist/:artistId')
  getArtistProjects(@Param('artistId') artistId: string) {
    return this.projectService.getArtistProjects(+artistId);
  }

  @Get('artist/progress')
  @Roles('ARTIST')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getArtistProgress(@Req() req) {
    return this.projectService.artisstProgress(req.user.userId);
  }

  //Producer dashboard
  @Get('producer/:dashboard')
  @Roles('PRODUCER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getProducerDashboard(@Req() req) {
    return this.projectService.producerDashboard(req.user.userId);
  }

  @Get('admin/analytics')
  @Roles('SUPER_ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getAnalytics() {
    return {
      studioLoad: this.projectService.studioLoad(),
      delays: this.projectService.delayedProjects(),
    }
  }

  @Post(':id/chat')
  @Roles('ARTIST', 'PRODUCER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  sendMessage(
    @Param('id') id: string,
    @Req() req: { user: { userId: number } },
    @Body() dto: CreateProjectMessageDto,
  ) {
    return this.projectService.createMessage(+id, req.user.userId, dto.message);
  }
}
