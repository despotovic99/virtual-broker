export enum Role {
  /** Administracija sistema: korisnici, tržišta, podešavanja. Ne odlučuje o predmetima. */
  SuperAdmin = 'SUPER_ADMIN',
  /** Back-office: partneri, pravni timovi, odobravanje instrukcija za isplatu (četiri oka). */
  Admin = 'ADMIN',
  /** Provere investitora i projekata, semafor, trijaža zahteva. */
  Analyst = 'ANALYST',
  /** Vodi kupca kroz kupovinu. */
  Coordinator = 'COORDINATOR',
  /** Advokat partner (član pravnog tima). */
  Lawyer = 'LAWYER',
  /** Nezavisni inženjer. */
  Engineer = 'ENGINEER',
  /** Escrow partner (samo tržišta sa escrow modelom). */
  EscrowAgent = 'ESCROW_AGENT',
  Buyer = 'BUYER',
  /** Investitor. U MVP-u nema ekrane (faza 2). */
  Investor = 'INVESTOR',
}

export const ALL_ROLES: readonly Role[] = Object.values(Role);

/**
 * Uloge koje se mogu dodeliti kroz API. SUPER_ADMIN namerno nije ovde:
 * super admin se nikad ne pravi niti dodeljuje kroz aplikaciju.
 */
export const ASSIGNABLE_ROLES = [
  Role.Admin,
  Role.Analyst,
  Role.Coordinator,
  Role.Lawyer,
  Role.Engineer,
  Role.EscrowAgent,
  Role.Buyer,
  Role.Investor,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Uloge koje rade samo na tržištima koja su im dodeljena (F-34, P3 i P5).
 * Korisnik sa nekom od ovih uloga mora imati bar jedno tržište.
 */
export const MARKET_SCOPED_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Analyst,
  Role.Coordinator,
  Role.Lawyer,
  Role.Engineer,
  Role.EscrowAgent,
];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
