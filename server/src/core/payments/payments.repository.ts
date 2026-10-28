import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import { Purchase } from '../purchases/entities/purchase.entity.js';
import { InstallmentCondition } from './entities/installment-condition.entity.js';
import { Installment, type InstallmentStatus } from './entities/installment.entity.js';

export interface NewInstallment {
  market: Installment['market'];
  purchaseId: string;
  sequence: number;
  label: string;
  amount: number;
  phaseCode: string | null;
  isFinal: boolean;
  dueDate: string | null;
  status: InstallmentStatus;
}

/** Jedini sloj koji priča sa bazom za rate i uslove pre uplate. */
@Injectable()
export class PaymentsRepository {
  listForPurchase(manager: EntityManager, purchaseId: string): Promise<Installment[]> {
    return manager.getRepository(Installment).find({
      where: { purchaseId },
      relations: { conditions: true },
      order: { sequence: 'ASC' },
    });
  }

  /** Rate kupovine zaključane do kraja transakcije (zamena plana). */
  listForPurchaseForUpdate(manager: EntityManager, purchaseId: string): Promise<Installment[]> {
    return manager
      .getRepository(Installment)
      .find({ where: { purchaseId }, order: { sequence: 'ASC' }, lock: { mode: 'pessimistic_write' } });
  }

  async deleteForPurchase(manager: EntityManager, purchaseId: string): Promise<void> {
    await manager.getRepository(Installment).delete({ purchaseId });
  }

  async insertInstallment(manager: EntityManager, data: NewInstallment): Promise<string> {
    const result = await manager.getRepository(Installment).insert(data);
    return (result.identifiers[0] as { id: string }).id;
  }

  async insertConditions(manager: EntityManager, installmentId: string, codes: readonly string[]): Promise<void> {
    if (codes.length === 0) return;
    await manager
      .getRepository(InstallmentCondition)
      .insert(codes.map((conditionCode) => ({ installmentId, conditionCode, status: 'PENDING' as const })));
  }

  findForUpdate(manager: EntityManager, id: string): Promise<Installment | null> {
    return manager.getRepository(Installment).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  conditionsFor(manager: EntityManager, installmentId: string): Promise<InstallmentCondition[]> {
    return manager.getRepository(InstallmentCondition).find({ where: { installmentId } });
  }

  conditionsForMany(manager: EntityManager, installmentIds: readonly string[]): Promise<InstallmentCondition[]> {
    if (installmentIds.length === 0) return Promise.resolve([]);
    return manager.getRepository(InstallmentCondition).find({ where: { installmentId: In([...installmentIds]) } });
  }

  async markConditionMet(
    manager: EntityManager,
    id: string,
    data: { confirmedById: string; confirmedAt: Date; evidenceDocumentId: string | null; note: string | null },
  ): Promise<void> {
    await manager.getRepository(InstallmentCondition).update({ id }, { status: 'MET', ...data });
  }

  async updateInstallment(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<Installment, 'status' | 'paidAt' | 'paidConfirmedById' | 'proofDocumentId'>>,
  ): Promise<void> {
    await manager.getRepository(Installment).update({ id }, data);
  }

  /**
   * Zaključane rate vezane za fazu gradnje u aktivnim kupovinama projekta
   * (automatsko otključavanje posle potvrde faze, F-17).
   */
  lockedPhaseInstallmentsForUpdate(manager: EntityManager, projectId: string, phaseCode: string): Promise<Installment[]> {
    return manager
      .getRepository(Installment)
      .createQueryBuilder('installment')
      .where('installment.phaseCode = :phaseCode', { phaseCode })
      .andWhere('installment.status = :status', { status: 'LOCKED' })
      .andWhere((query) => {
        const sub = query
          .subQuery()
          .select('purchase.id')
          .from(Purchase, 'purchase')
          .where('purchase.projectId = :projectId')
          .andWhere("purchase.status = 'ACTIVE'")
          .getQuery();
        return `installment.purchaseId IN ${sub}`;
      })
      .setParameter('projectId', projectId)
      .setLock('pessimistic_write')
      .getMany();
  }

  /** Kupci kupovina (za obaveštenja). */
  async buyersOf(manager: EntityManager, purchaseIds: readonly string[]): Promise<Map<string, string>> {
    if (purchaseIds.length === 0) return new Map();
    const purchases = await manager
      .getRepository(Purchase)
      .find({ select: { id: true, buyerId: true }, where: { id: In([...purchaseIds]) } });
    return new Map(purchases.map((purchase) => [purchase.id, purchase.buyerId]));
  }
}
