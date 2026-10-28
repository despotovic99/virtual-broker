import { Inject, Injectable } from '@nestjs/common';
import { MARKET_CODES, type MarketCode } from './market-code.js';
import { MARKET_PACKS, type MarketPack } from './market-pack.js';

@Injectable()
export class MarketRegistry {
  private readonly packs: ReadonlyMap<MarketCode, MarketPack>;

  constructor(@Inject(MARKET_PACKS) packs: readonly MarketPack[]) {
    const byCode = new Map<MarketCode, MarketPack>();
    for (const pack of packs) {
      if (byCode.has(pack.code)) throw new Error(`Paket tržišta ${pack.code} je registrovan dva puta.`);
      byCode.set(pack.code, pack);
    }
    for (const code of MARKET_CODES) {
      if (!byCode.has(code)) throw new Error(`Nedostaje paket tržišta ${code}.`);
    }
    this.packs = byCode;
  }

  get(code: MarketCode): MarketPack {
    const pack = this.packs.get(code);
    if (!pack) throw new Error(`Nepoznato tržište ${code}.`);
    return pack;
  }

  list(): readonly MarketPack[] {
    return [...this.packs.values()];
  }
}
