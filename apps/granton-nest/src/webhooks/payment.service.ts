  import { Injectable } from '@nestjs/common';
  import { ProjectStatus } from '@prisma/client';
  import { PrismaService } from '../../prisma/prisma.service';
  import { NotificationService } from 'src/notification/notification.service';

  @Injectable()
  export class PaymentService {
    constructor(
      private prisma: PrismaService,
      private notificationService: NotificationService,
    ) {}

    async processPayment(payload: any) {
      const { bookingRef, isFullPayment, paymentRef } = payload;

      const project = await this.prisma.project.findFirst({
        where: { bookingRef },
        include: { artist: true },
      });

      if (!project) return { status: 'ignored' };

      if (isFullPayment) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            status: ProjectStatus.FULLY_PAID,
            progress: 50,
            paymentRef,
          },
        });

        await this.notificationService.sendArtistConfirmation(
          project.artist.email,
          project.title,
        );
      }

      return { status: 'processed' };
    }
  }
