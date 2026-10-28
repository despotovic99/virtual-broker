import type { IntegrationKey } from './integration-key.js';

export type SemaphoreStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

/** Ulaz za automatsku proveru. */
export interface IntegrationInput {
  /** Matični broj (RS) ili HE broj (CY) firme. */
  registrationNumber?: string | null;
  /** Oznaka parcele (RS: KO + broj parcele; CY: sheet/plan/parcel). */
  parcelReference?: string | null;
}

/** Rezultat jednog spoljnog izvora. */
export interface IntegrationResult {
  status: SemaphoreStatus;
  /** Kratko objašnjenje za prikaz (srpski). */
  summary: string;
  /** Odakle podatak dolazi. Kod dummy izvora počinje sa „DUMMY:”. */
  source: string;
  /** true: podatak NIJE pravi, dolazi iz dummy implementacije. */
  dummy: boolean;
  fetchedAt: Date;
  /** Bezbedni podaci za prikaz (bez ličnih podataka fizičkih lica). */
  data: Record<string, string | number | boolean | null>;
}

/** Spoljni izvor za jednu automatsku proveru. Poziva se pre otvaranja konekcije ka bazi. */
export interface CheckIntegration {
  readonly key: IntegrationKey;
  run(input: IntegrationInput): Promise<IntegrationResult>;
}

export const CHECK_INTEGRATIONS = Symbol('CHECK_INTEGRATIONS');
