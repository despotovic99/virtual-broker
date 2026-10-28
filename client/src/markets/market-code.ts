// Tržišta na kojima platforma radi (specifikacija F-34).
// Komponente koje se razlikuju po tržištu idu u src/markets/cy i src/markets/rs.
export const MARKET_CODES = ['CY', 'RS'] as const

export type MarketCode = (typeof MARKET_CODES)[number]
