import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Authenticated } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { NotificationsService, type NotificationResponse } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Authenticated()
  list(@CurrentUser() user: AuthUser): Promise<{ items: NotificationResponse[]; unread: number }> {
    return this.notifications.listMine(user.id, 50);
  }

  @Post('read-all')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  readAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markRead(user.id, null);
  }

  @Post(':id/read')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
}
