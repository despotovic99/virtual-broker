import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Format heša: scrypt$N$r$p$<salt base64>$<heš base64>
// Isti parametri su i u tools/hash-password.mjs (ručni upis super admina).
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// Gornje granice parametara iz heša, da loš zapis u bazi ne pojede memoriju i CPU.
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function maxmem(n: number, r: number): number {
  return 256 * n * r;
}

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | null = null;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: maxmem(N, R) });
    return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = this.parse(stored);
    if (!parsed) {
      // Isto vreme kao prava provera, da se iz trajanja ne vidi da je zapis loš.
      await this.verifyDummy(password);
      return false;
    }
    const { n, r, p, salt, key } = parsed;
    const candidate = await derive(password, salt, key.length, { N: n, r, p, maxmem: maxmem(n, r) });
    return timingSafeEqual(candidate, key);
  }

  /** Za nepostojećeg korisnika: troši isto vreme kao prava provera (nema enumeracije korisnika). */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('base64'));
    await this.verify(password, await this.dummyHash);
    return false;
  }

  private parse(stored: string): { n: number; r: number; p: number; salt: Buffer; key: Buffer } | null {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
    const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    const valid =
      Number.isInteger(n) && n > 1 && n <= MAX_N && (n & (n - 1)) === 0 &&
      Number.isInteger(r) && r >= 1 && r <= MAX_R &&
      Number.isInteger(p) && p >= 1 && p <= MAX_P;
    if (!valid) return null;
    const salt = Buffer.from(parts[4], 'base64');
    const key = Buffer.from(parts[5], 'base64');
    if (salt.length < 16 || key.length < 32) return null;
    return { n, r, p, salt, key };
  }
}
