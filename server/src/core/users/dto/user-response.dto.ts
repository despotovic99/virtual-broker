import type { Page } from '../../../common/pagination/pagination.js';
import type { MarketCode } from '../../../markets/market-code.js';
import type { Role } from '../../access/role.enum.js';

/** Javni oblik korisnika. Nikad ne sadrži heš lozinke ni interna polja. */
export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  markets: MarketCode[];
  language: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type UserListResponseDto = Page<UserResponseDto>;
