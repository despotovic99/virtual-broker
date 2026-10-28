import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { EMAIL_SENDER, type EmailMessage, type EmailSender } from '../../integrations/dummy/dummy-email.sender.js';
import { NotificationsRepository } from './notifications.repository.js';

export interface NotificationDraft {
  userId: string;
  type: string;
  title: string;
  body: string;
  /** Putanja u klijentu. Nikad broj računa ni drugi osetljiv podatak. */
  link?: string | null;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Obaveštenja (F-19). `notify` učestvuje u tuđoj transakciji i vraća emailove
 * koje vlasnik operacije šalje tek posle commit-a (`sendEmails`).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsRepository,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async notify(manager: EntityManager, drafts: readonly NotificationDraft[]): Promise<EmailMessage[]> {
    await this.notifications.insertMany(manager, drafts);
    const emails = await this.notifications.findActiveEmails(manager, [...new Set(drafts.map((draft) => draft.userId))]);
    return drafts.flatMap((draft) => {
      const to = emails.get(draft.userId);
      return to ? [{ to, subject: draft.title, text: draft.body }] : [];
    });
  }

  /** Spoljni efekat: zove se POSLE commit-a. Greška pri slanju ne ruši operaciju. */
  async sendEmails(messages: readonly EmailMessage[]): Promise<void> {
    for (const message of messages) {
      try {
        await this.email.send(message);
      } catch (error) {
        this.logger.warn('Email nije poslat.', error instanceof Error ? error.stack : undefined);
      }
    }
  }

  async listMine(userId: string, limit: number): Promise<{ items: NotificationResponse[]; unread: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const items = await this.notifications.listForUser(queryRunner.manager, userId, limit);
      const unread = await this.notifications.countUnread(queryRunner.manager, userId);
      return {
        unread,
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          link: item.link,
          readAt: item.readAt ? item.readAt.toISOString() : null,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async markRead(userId: string, id: string | null): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const now = new Date();
      if (id) await this.notifications.markRead(queryRunner.manager, userId, id, now);
      else await this.notifications.markAllRead(queryRunner.manager, userId, now);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
