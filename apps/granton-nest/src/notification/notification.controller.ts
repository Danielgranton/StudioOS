import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: number },
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.listUserNotifications(user.userId, unreadOnly === 'true');
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: { userId: number }, @Param('id') id: string) {
    return this.notifications.markAsRead(user.userId, id);
  }
}
