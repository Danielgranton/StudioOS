import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  constructor(private readonly prisma: PrismaService) {}

  async sendArtistConfirmation(phone: string, title: string ) {
    this.logger.log(  `[SMS/WhatsApp MOCK] Artist notified: "${title}" ready in 7 days → ${phone}`,);
  }

  async sendProducerReminder(email: string, title: string){
    this.logger.log(`[REMINDER MOCK] Producer reminder for "${title}" → ${email}`,);
  }

  async createNotification(
    userId: number,
    type: NotificationType,
    message: string,
    data?: Prisma.InputJsonValue,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        message,
        data,
      },
    });
    await this.dispatchNotificationChannels(userId, notification.message);
    return notification;
  }

  async createBulkNotifications(
    userIds: number[],
    type: NotificationType,
    message: string,
    data?: Prisma.InputJsonValue,
  ) {
    if (!userIds.length) return { count: 0 };
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        message,
        data,
      })),
    });
    await Promise.all(userIds.map((userId) => this.dispatchNotificationChannels(userId, message)));
    return { count: userIds.length };
  }

  async listUserNotifications(userId: number, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: number, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  private async dispatchNotificationChannels(userId: number, message: string) {
    // Placeholder channel fan-out.
    this.logger.log(`[IN-APP] user=${userId} ${message}`);
    await this.dispatchEmail(userId, message);
    await this.dispatchPush(userId, message);
  }

  private async dispatchEmail(userId: number, message: string) {
    this.logger.log(`[EMAIL MOCK] user=${userId} ${message}`);
  }

  private async dispatchPush(userId: number, message: string) {
    this.logger.log(`[PUSH MOCK] user=${userId} ${message}`);
  }
}
