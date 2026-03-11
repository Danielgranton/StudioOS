import { Module } from '@nestjs/common';
import { BeatsModule } from '../beats/beats.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentWebHookController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [PrismaModule, NotificationModule, BeatsModule],
  controllers: [PaymentWebHookController],
  providers: [PaymentService],
})
export class WebhooksModule {}
