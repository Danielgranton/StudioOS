import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentWebHookController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PaymentWebHookController],
  providers: [PaymentService],
})
export class WebhooksModule {}
