import { Injectable } from '@nestjs/common';
import { In, IsNull, type EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Notification } from './entities/notification.entity.js';
import type { NotificationDraft } from './notifications.service.js';

@Injectable()
export class NotificationsRepository {
  async insertMany(manager: EntityManager, drafts: readonly NotificationDraft[]): Promise<void> {
    if (drafts.length === 0) return;
    await manager.getRepository(Notification).insert(
      drafts.map((draft) => ({
        userId: draft.userId,
        type: draft.type,
        title: draft.title.slice(0, 200),
        body: draft.body.slice(0, 1000),
        link: draft.link ?? null,
      })),
    );
  }

  /** Email adrese aktivnih primalaca (za dummy email posle commit-a). */
  async findActiveEmails(manager: EntityManager, userIds: readonly string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const users = await manager
      .getRepository(User)
      .find({ select: { id: true, email: true }, where: { id: In([...userIds]), isActive: true } });
    return new Map(users.map((user) => [user.id, user.email]));
  }

  listForUser(manager: EntityManager, userId: string, page: { limit: number; offset: number }): Promise<[Notification[], number]> {
    return manager.getRepository(Notification).findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  countUnread(manager: EntityManager, userId: string): Promise<number> {
    return manager.getRepository(Notification).count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(manager: EntityManager, userId: string, id: string, at: Date): Promise<boolean> {
    const result = await manager.getRepository(Notification).update({ id, userId, readAt: IsNull() }, { readAt: at });
    return (result.affected ?? 0) > 0;
  }

  async markAllRead(manager: EntityManager, userId: string, at: Date): Promise<void> {
    await manager.getRepository(Notification).update({ userId, readAt: IsNull() }, { readAt: at });
  }
}
