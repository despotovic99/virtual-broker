import { Check, Column, PrimaryColumn, type ValueTransformer } from 'typeorm';
import { MARKET_CODES } from '../../markets/market-code.js';

/**
 * Tržište zapisa (F-34, P1): varchar(2) sa CHECK ograničenjem na MARKET_CODES.
 * Nije Postgres enum, jer se kolona ponavlja u mnogo tabela, a novo tržište
 * treba da bude samo nova vrednost u MARKET_CODES (migracija menja CHECK).
 * Kolona se uvek zove `market`.
 */
export const MarketColumn =
  (options: { nullable?: boolean; primary?: boolean } = {}): PropertyDecorator =>
  (target, propertyKey) => {
    const column = { name: 'market', type: 'varchar', length: 2 } as const;
    if (options.primary) PrimaryColumn(column)(target, propertyKey);
    else Column({ ...column, nullable: options.nullable ?? false })(target, propertyKey);
    Check(`"market" IN (${MARKET_CODES.map((code) => `'${code}'`).join(', ')})`)(target, propertyKey);
  };

export const SEMAPHORE_STATUSES = ['GREEN', 'YELLOW', 'RED', 'GRAY'] as const;
export type Semaphore = (typeof SEMAPHORE_STATUSES)[number];

/** Stanje semafora. Postgres enum `semaphore`. */
export const SemaphoreColumn = (): PropertyDecorator =>
  Column({ type: 'enum', enum: [...SEMAPHORE_STATUSES], enumName: 'semaphore' });

/** numeric iz Postgres-a stiže kao string; u kodu je broj. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** Površina u m² (numeric(8,2)). */
export const AreaColumn = (options: { name: string; nullable?: boolean }): PropertyDecorator =>
  Column({ name: options.name, type: 'numeric', precision: 8, scale: 2, nullable: options.nullable ?? false, transformer: numericTransformer });
