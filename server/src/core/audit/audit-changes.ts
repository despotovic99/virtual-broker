import type { AuditChange, AuditValue } from './entities/audit-event.entity.js';

function normalize(value: unknown): AuditValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  return String(value);
}

function same(a: AuditValue, b: AuditValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => item === b[index]);
  // Brojevi iz baze (numeric) stižu kao string: porede se kao broj.
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
}

/**
 * Izmenjena polja za audit: za svako polje iz `fields` koje se promenilo vraća
 * staru i novu vrednost. Polja koja nisu poslata (undefined u `after`) se
 * preskaču. Vraća undefined kad ništa nije izmenjeno.
 */
export function auditChanges<T extends object>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): Record<string, AuditChange> | undefined {
  const changes: Record<string, AuditChange> = {};
  for (const field of fields) {
    if (after[field] === undefined) continue;
    const from = normalize(before[field]);
    const to = normalize(after[field]);
    if (!same(from, to)) changes[field] = { from, to };
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Početne vrednosti za audit kod kreiranja: svako popunjeno polje iz `fields`
 * kao `{ from: null, to: vrednost }`. Prazna polja (null) se preskaču.
 */
export function auditInitial<T extends object>(created: T, fields: readonly (keyof T & string)[]): Record<string, AuditChange> | undefined {
  return auditChanges({} as T, created, fields);
}
