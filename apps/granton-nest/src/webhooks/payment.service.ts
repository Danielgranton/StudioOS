  import { Injectable } from '@nestjs/common';
  import { ProjectStatus } from '@prisma/client';
  import { PrismaService } from '../../prisma/prisma.service';
  import { NotificationService } from '../notification/notification.service';
  import { BeatsService } from '../beats/beats.service';

  @Injectable()
  export class PaymentService {
    constructor(
      private prisma: PrismaService,
      private notificationService: NotificationService,
      private beatsService: BeatsService,
    ) {}

    async processPayment(payload: any) {
      const { type, bookingRef, isFullPayment, paymentRef, totalAmount, phase } = payload;

      if (type === 'beat_purchase') {
        if (!paymentRef) return { status: 'ignored' };
        return this.beatsService.confirmPurchasePaid(paymentRef);
      }

      if (type === 'session_booking') {
        if (!bookingRef || !paymentRef) return { status: 'ignored' };

        const booking = await this.prisma.sessionBooking.findFirst({
          where: { bookingRef },
        });
        if (!booking) return { status: 'ignored' };

        const normalizedTotal = Number(totalAmount ?? 0);
        const safeTotal = Number.isFinite(normalizedTotal) && normalizedTotal > 0 ? normalizedTotal : booking.totalAmount;
        const deposit = Math.ceil(safeTotal / 2);
        const balance = Math.max(safeTotal - deposit, 0);

        if (phase === 'deposit' || !isFullPayment) {
          await this.prisma.sessionBooking.update({
            where: { id: booking.id },
            data: {
              paymentRef,
              paymentStatus: 'BOOKED',
              totalAmount: safeTotal,
              depositAmount: deposit,
              balanceAmount: balance,
            },
          });
          return {
            status: 'processed',
            paymentStage: 'deposit',
            amountPaidNow: deposit,
            amountRemaining: balance,
          };
        }

        await this.prisma.sessionBooking.update({
          where: { id: booking.id },
          data: {
            paymentRef,
            paymentStatus: 'FULLY_PAID',
            totalAmount: safeTotal,
            depositAmount: deposit,
            balanceAmount: 0,
          },
        });

        return {
          status: 'processed',
          paymentStage: 'balance',
          amountPaidNow: balance,
          amountRemaining: 0,
        };
      }

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
