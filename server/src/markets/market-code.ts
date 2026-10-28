// Tržišta na kojima platforma radi (specifikacija F-34).
export const MARKET_CODES = ['CY', 'RS'] as const;

export type MarketCode = (typeof MARKET_CODES)[number];

export function isMarketCode(value: unknown): value is MarketCode {
  return typeof value === 'string' && (MARKET_CODES as readonly string[]).includes(value);
}
