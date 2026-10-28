/*
 * =============================================================================
 *  DUMMY INTEGRACIJA — CENE NISU PRAVI TRŽIŠNI PODACI.
 *  TODO(integracija): RS — RGZ registar cena (profesionalni korisnik);
 *  CY — Landbank Analytics / Ask Wire / DLS Comparable Sales (F-09).
 * =============================================================================
 */
import { Injectable } from '@nestjs/common';
import type { MarketCode } from '../../markets/market-code.js';

export interface PriceIndexResult {
  /** Prosečna cena po m² u evrima. */
  averagePricePerM2: number;
  source: string;
  dummy: boolean;
}

export const PRICE_INDEX = Symbol('PRICE_INDEX');

export interface PriceIndex {
  averageFor(market: MarketCode, city: string): Promise<PriceIndexResult>;
}

/** Brojevi su orijentacioni, iz istraživanja (dokument 5 i 6), i ne smeju se prikazati kao pravi podatak. */
const DUMMY_AVERAGES: Record<MarketCode, Record<string, number>> = {
  RS: { beograd: 3_200, 'novi sad': 2_330, nis: 1_750, kragujevac: 1_640 },
  CY: { limassol: 4_500, paphos: 3_000, larnaca: 2_800, nicosia: 2_600 },
};

@Injectable()
export class DummyPriceIndex implements PriceIndex {
  averageFor(market: MarketCode, city: string): Promise<PriceIndexResult> {
    const key = city
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const table = DUMMY_AVERAGES[market];
    const value = table[key] ?? Math.round(Object.values(table).reduce((sum, v) => sum + v, 0) / Object.keys(table).length);
    return Promise.resolve({ averagePricePerM2: value, source: 'DUMMY: tržišni indeks — integracija nije urađena', dummy: true });
  }
}
