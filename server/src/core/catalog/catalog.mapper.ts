import type { MarketCode } from '../../markets/market-code.js';
import type { DeveloperBankAccount } from './entities/developer-bank-account.entity.js';
import type { Developer } from './entities/developer.entity.js';
import type { Project, ProjectStatus } from './entities/project.entity.js';
import type { Unit, UnitStatus } from './entities/unit.entity.js';

export interface DeveloperResponse {
  id: string;
  market: MarketCode;
  name: string;
  registrationNumber: string;
  taxNumber: string | null;
  address: string | null;
  website: string | null;
  createdAt: string;
}

export interface BankAccountResponse {
  id: string;
  developerId: string;
  /** Prikazuju se samo poslednje 4 cifre; ceo IBAN vidi samo naš tim (F-16). */
  iban: string;
  bankName: string;
  holderName: string;
  verified: boolean;
  verifiedAt: string | null;
  verificationNote: string | null;
  /** Ko je uneo račun (samo za naš tim; za četiri oka pri proveri). */
  createdById: string | null;
  createdAt: string;
}

export interface UnitResponse {
  id: string;
  projectId: string;
  label: string;
  floor: number | null;
  rooms: number | null;
  area: number;
  price: number;
  status: UnitStatus;
}

export interface ProjectResponse {
  id: string;
  market: MarketCode;
  developerId: string;
  developerName: string | null;
  name: string;
  city: string;
  address: string;
  parcelReference: string | null;
  description: string | null;
  status: ProjectStatus;
  expectedCompletion: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toDeveloperResponse(developer: Developer): DeveloperResponse {
  return {
    id: developer.id,
    market: developer.market,
    name: developer.name,
    registrationNumber: developer.registrationNumber,
    taxNumber: developer.taxNumber,
    address: developer.address,
    website: developer.website,
    createdAt: developer.createdAt.toISOString(),
  };
}

export function toBankAccountResponse(account: DeveloperBankAccount, showFullIban: boolean): BankAccountResponse {
  return {
    id: account.id,
    developerId: account.developerId,
    iban: showFullIban ? account.iban : `•••• ${account.iban.slice(-4)}`,
    bankName: account.bankName,
    holderName: account.holderName,
    verified: account.verifiedAt !== null,
    verifiedAt: account.verifiedAt ? account.verifiedAt.toISOString() : null,
    verificationNote: showFullIban ? account.verificationNote : null,
    createdById: showFullIban ? account.createdById : null,
    createdAt: account.createdAt.toISOString(),
  };
}

export function toUnitResponse(unit: Unit): UnitResponse {
  return {
    id: unit.id,
    projectId: unit.projectId,
    label: unit.label,
    floor: unit.floor,
    rooms: unit.rooms,
    area: unit.area,
    price: unit.price,
    status: unit.status,
  };
}

export function toProjectResponse(project: Project, developerName: string | null = null): ProjectResponse {
  return {
    id: project.id,
    market: project.market,
    developerId: project.developerId,
    developerName: developerName ?? project.developer?.name ?? null,
    name: project.name,
    city: project.city,
    address: project.address,
    parcelReference: project.parcelReference,
    description: project.description,
    status: project.status,
    expectedCompletion: project.expectedCompletion,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
