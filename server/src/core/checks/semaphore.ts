import type { Semaphore } from '../../common/db/columns.js';
import type { CheckDefinition, Localized } from '../../markets/market-pack.js';
import type { Check } from './entities/check.entity.js';

/** Jedna stavka semafora: definicija iz paketa tržišta + poslednja provera (ako postoji). */
export interface SemaphoreItem {
  code: string;
  subject: CheckDefinition['subject'];
  title: Localized;
  mandatory: boolean;
  method: CheckDefinition['method'];
  status: Semaphore;
  summary: string | null;
  source: string | null;
  dummy: boolean;
  checkedAt: string | null;
  validUntil: string | null;
  expired: boolean;
  hardBlockOnRed: boolean;
  documentId: string | null;
}

export interface SemaphoreResult {
  /** Najgore stanje obaveznih stavki. Sivo ako neka obavezna nije proverena ili je istekla. */
  overall: Semaphore;
  /** Tvrda blokada: crvena stavka koja blokira kupovinu (README pravilo 8). */
  hardBlocked: boolean;
  items: SemaphoreItem[];
  /** Bar jedna stavka dolazi iz dummy integracije. */
  containsDummyData: boolean;
}

const SEVERITY: Record<Semaphore, number> = { GREEN: 0, YELLOW: 1, GRAY: 2, RED: 3 };

/** Najgore od datih stanja; prazan spisak je sivo. */
export function worstOf(statuses: readonly Semaphore[]): Semaphore {
  if (statuses.length === 0) return 'GRAY';
  return statuses.reduce((worst, status) => (SEVERITY[status] > SEVERITY[worst] ? status : worst), 'GREEN' as Semaphore);
}

/**
 * Semafor (F-08, odluka MVP-a): svaka provera je zelena, žuta, crvena ili
 * siva, a ukupno stanje je najgore stanje obaveznih provera. Istekla provera
 * je siva (README pravilo 2: ako nije provereno, tako i piše).
 */
export function buildSemaphore(definitions: readonly CheckDefinition[], latest: readonly Check[], now: Date): SemaphoreResult {
  const byCode = new Map(latest.map((check) => [check.definitionCode, check]));
  const items: SemaphoreItem[] = definitions.map((definition) => {
    const check = byCode.get(definition.code);
    const expired = check ? check.validUntil.getTime() < now.getTime() : false;
    const status: Semaphore = !check || expired ? 'GRAY' : check.status;
    return {
      code: definition.code,
      subject: definition.subject,
      title: definition.title,
      mandatory: definition.mandatory,
      method: definition.method,
      status,
      summary: check?.summary ?? null,
      source: check?.source ?? null,
      dummy: check?.dummy ?? false,
      checkedAt: check ? check.checkedAt.toISOString() : null,
      validUntil: check ? check.validUntil.toISOString() : null,
      expired,
      hardBlockOnRed: definition.hardBlockOnRed ?? false,
      documentId: check?.documentId ?? null,
    };
  });
  return {
    overall: worstOf(items.filter((item) => item.mandatory).map((item) => item.status)),
    hardBlocked: items.some((item) => item.hardBlockOnRed && item.status === 'RED'),
    items,
    containsDummyData: items.some((item) => item.dummy),
  };
}
