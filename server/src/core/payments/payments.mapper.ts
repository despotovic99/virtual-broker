import type { Localized, MarketPack } from '../../markets/market-pack.js';
import type { InstallmentCondition } from './entities/installment-condition.entity.js';
import type { Installment } from './entities/installment.entity.js';

export interface InstallmentConditionResponse {
  code: string;
  title: Localized;
  status: InstallmentCondition['status'];
  confirmedById: string | null;
  confirmedAt: string | null;
  evidenceDocumentId: string | null;
  note: string | null;
}

/** Rata za prikaz. Nikad ne sadrži broj računa (F-16). */
export interface InstallmentResponse {
  id: string;
  sequence: number;
  label: string;
  amount: number;
  phaseCode: string | null;
  isFinal: boolean;
  status: Installment['status'];
  dueDate: string | null;
  paidAt: string | null;
  proofDocumentId: string | null;
  conditions: InstallmentConditionResponse[];
}

export interface PaymentPlanResponse {
  moneyModel: MarketPack['moneyModel'];
  installments: InstallmentResponse[];
  total: number;
}

export function toInstallmentResponse(
  installment: Installment,
  conditions: readonly InstallmentCondition[],
  pack: MarketPack,
): InstallmentResponse {
  const definitions = new Map(pack.paymentConditions.map((definition) => [definition.code, definition]));
  return {
    id: installment.id,
    sequence: installment.sequence,
    label: installment.label,
    amount: installment.amount,
    phaseCode: installment.phaseCode,
    isFinal: installment.isFinal,
    status: installment.status,
    dueDate: installment.dueDate,
    paidAt: installment.paidAt ? installment.paidAt.toISOString() : null,
    proofDocumentId: installment.proofDocumentId,
    conditions: conditions.map((condition) => ({
      code: condition.conditionCode,
      title: definitions.get(condition.conditionCode)?.title ?? { sr: condition.conditionCode, en: condition.conditionCode },
      status: condition.status,
      confirmedById: condition.confirmedById,
      confirmedAt: condition.confirmedAt ? condition.confirmedAt.toISOString() : null,
      evidenceDocumentId: condition.evidenceDocumentId,
      note: condition.note,
    })),
  };
}
