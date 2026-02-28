import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StudiosModule } from './studios/studios.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [AuthModule, PrismaModule, ProjectsModule, StudiosModule, ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
 
})
export class AppModule {}
