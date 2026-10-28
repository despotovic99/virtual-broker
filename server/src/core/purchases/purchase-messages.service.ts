import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { EmailMessage } from '../../integrations/dummy/dummy-email.sender.js';
import type { AuthUser } from '../access/auth-user.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateMessageDto } from './dto/purchase.dto.js';
import type { PurchaseMessageDto } from './dto/purchase-response.dto.js';
import { PurchaseAccessService, type PurchaseAccess } from './purchase-access.service.js';
import { toMessageDto, toPerson } from './purchases.mapper.js';
import { PurchasesRepository } from './purchases.repository.js';

/** Kupac koji nema drugu vezu sa kupovinom ne vidi interne poruke. */
function isBuyerOnly(access: PurchaseAccess): boolean {
  return [...access.relations].every((relation) => relation === 'BUYER');
}

/** Poruke na kupovini (F-24). Interne poruke vide samo naš tim, advokat i inženjer. */
@Injectable()
export class PurchaseMessagesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly purchases: PurchasesRepository,
    private readonly access: PurchaseAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: AuthUser, purchaseId: string): Promise<PurchaseMessageDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const access = await this.access.get(queryRunner.manager, purchaseId, actor);
      const buyerOnly = isBuyerOnly(access);
      const messages = await this.purchases.listMessages(queryRunner.manager, purchaseId, !buyerOnly);
      const people = await this.purchases.findPeople(
        queryRunner.manager,
        messages.map((message) => message.authorId),
      );
      const byId = new Map(people.map((person) => [person.id, person]));
      return messages.map((message) => toMessageDto(message, toPerson(byId.get(message.authorId), false)));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async create(actor: AuthUser, purchaseId: string, dto: CreateMessageDto): Promise<PurchaseMessageDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseMessageDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.get(manager, purchaseId, actor);
      const internal = dto.internal ?? false;
      if (internal && isBuyerOnly(access)) throw new ApiError(ApiErrorCode.Forbidden);

      const { purchase } = access;
      const message = await this.purchases.insertMessage(manager, {
        purchaseId: purchase.id,
        authorId: actor.id,
        body: dto.body.trim(),
        internal,
      });

      const recipients = new Set(
        [internal ? null : purchase.buyerId, purchase.coordinatorId, purchase.lawyerId, purchase.engineerId].filter(
          (id): id is string => id !== null && id !== actor.id,
        ),
      );
      emails = await this.notifications.notify(
        manager,
        [...recipients].map((userId) => ({
          userId,
          type: 'purchase.message',
          title: 'Nova poruka na kupovini',
          body: 'Imate novu poruku na kupovini. Otvorite predmet da je pročitate.',
          link: `/purchases/${purchase.id}`,
        })),
      );
      const [author] = await this.purchases.findPeople(manager, [actor.id]);
      result = toMessageDto(message, toPerson(author, false));
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }
}
