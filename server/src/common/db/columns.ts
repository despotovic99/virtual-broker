import { Column, type ValueTransformer } from 'typeorm';
import { MARKET_CODES } from '../../markets/market-code.js';

/** Tržište zapisa (F-34, P1). Postgres enum `market`. */
export const MarketColumn = (): PropertyDecorator =>
  Column({ type: 'enum', enum: [...MARKET_CODES], enumName: 'market' });

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
