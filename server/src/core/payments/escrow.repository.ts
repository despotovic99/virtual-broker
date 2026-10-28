import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import { Purchase } from '../purchases/entities/purchase.entity.js';
import { EscrowInstruction } from './entities/escrow-instruction.entity.js';

@Injectable()
export class EscrowRepository {
  async insert(
    manager: EntityManager,
    data: Pick<EscrowInstruction, 'market' | 'installmentId' | 'purchaseId' | 'amount' | 'bankAccountId' | 'createdById'>,
  ): Promise<string> {
    const result = await manager.getRepository(EscrowInstruction).insert({ ...data, status: 'PENDING_APPROVAL' });
    return (result.identifiers[0] as { id: string }).id;
  }

  findForUpdate(manager: EntityManager, id: string): Promise<EscrowInstruction | null> {
    return manager.getRepository(EscrowInstruction).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  findWithAccount(manager: EntityManager, id: string): Promise<EscrowInstruction | null> {
    return manager.getRepository(EscrowInstruction).findOne({ where: { id }, relations: { bankAccount: true } });
  }

  async update(manager: EntityManager, id: string, data: Partial<EscrowInstruction>): Promise<void> {
    await manager.getRepository(EscrowInstruction).update({ id }, data);
  }

  /** Instrukcije na datim tržištima (naš tim) ili samo za kupovine escrow partnera. */
  list(manager: EntityManager, filter: { markets?: readonly MarketCode[]; escrowAgentId?: string }): Promise<EscrowInstruction[]> {
    const query = manager
      .getRepository(EscrowInstruction)
      .createQueryBuilder('instruction')
      .leftJoinAndSelect('instruction.bankAccount', 'account')
      .orderBy('instruction.createdAt', 'DESC')
      .take(200);
    if (filter.escrowAgentId) {
      query.where((where) => {
        const sub = where
          .subQuery()
          .select('purchase.id')
          .from(Purchase, 'purchase')
          .where('purchase.escrowAgentId = :escrowAgentId')
          .getQuery();
        return `instruction.purchaseId IN ${sub}`;
      });
      query.setParameter('escrowAgentId', filter.escrowAgentId);
    } else if (filter.markets && filter.markets.length > 0) {
      query.where('instruction.market IN (:...markets)', { markets: [...filter.markets] });
    } else {
      query.where('1 = 0');
    }
    return query.getMany();
  }
}
