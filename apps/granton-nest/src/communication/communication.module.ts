import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BeatsModule } from '../beats/beats.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { CommunicationController } from './communication.controller';
import { CommunicationGateway } from './communication.gateway';
import { CommunicationRealtimeService } from './communication-realtime.service';
import { CommunicationService } from './communication.service';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    BeatsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
    }),
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationRealtimeService, CommunicationGateway],
  exports: [CommunicationService],
})
export class CommunicationModule {}
