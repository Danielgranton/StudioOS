import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ProjectsController } from './projects.controller';
import { ProjectCronService } from './project-cron.service';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectCronService],
})
export class ProjectsModule {}
