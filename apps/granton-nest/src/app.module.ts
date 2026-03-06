import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StudiosModule } from './studios/studios.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BeatsModule } from './beats/beats.module';
import { CommunicationModule } from './communication/communication.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProjectsModule,
    StudiosModule,
    WebhooksModule,
    BeatsModule,
    CommunicationModule,
    NotificationModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
 
})
export class AppModule {}
