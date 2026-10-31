import { Injectable } from '@nestjs/common';
import { Brackets, In, type EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import type { Role } from '../access/role.enum.js';
import { UserMarket } from './entities/user-market.entity.js';
import { UserRole } from './entities/user-role.entity.js';
import { User } from './entities/user.entity.js';

export interface NewUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdById: string | null;
  language?: string;
}

export interface UserSearchFilter {
  role?: Role;
  market?: MarketCode;
  search?: string;
  /**
   * Vidljivost za admina: korisnici sa bar jednim od ovih tržišta, plus
   * korisnici bez tržišta (npr. kupci). null: bez ograničenja (super admin).
   */
  visibleMarkets: readonly MarketCode[] | null;
}

/** LIKE šablon sa escape-ovanim % i _ (vrednost ide kao parametar). */
function likePattern(value: string): string {
  return `%${value.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Jedini sloj koji priča sa bazom za korisnike. Svaki metod prima EntityManager. */
@Injectable()
export class UsersRepository {
  findByEmailWithRoles(manager: EntityManager, email: string): Promise<User | null> {
    return manager.getRepository(User).findOne({ where: { email }, relations: { roles: true, markets: true } });
  }

  findActiveByIdWithRoles(manager: EntityManager, id: string): Promise<User | null> {
    return manager
      .getRepository(User)
      .findOne({ where: { id, isActive: true }, relations: { roles: true, markets: true } });
  }

  /** Korisnik bez obzira na to da li je aktivan (administracija). */
  findByIdWithRoles(manager: EntityManager, id: string): Promise<User | null> {
    return manager.getRepository(User).findOne({ where: { id }, relations: { roles: true, markets: true } });
  }

  /** Zaključava red korisnika do kraja transakcije (bez join-ova, zbog FOR UPDATE). */
  lockById(manager: EntityManager, id: string): Promise<User | null> {
    return manager.getRepository(User).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async insertUser(manager: EntityManager, data: NewUser): Promise<string> {
    const result = await manager.getRepository(User).insert(data);
    return (result.identifiers[0] as { id: string }).id;
  }

  async insertRoles(manager: EntityManager, userId: string, roles: readonly Role[], assignedById: string | null): Promise<void> {
    await manager.getRepository(UserRole).insert(roles.map((role) => ({ userId, role, assignedById })));
  }

  async insertMarkets(manager: EntityManager, userId: string, markets: readonly MarketCode[]): Promise<void> {
    if (markets.length === 0) return;
    await manager.getRepository(UserMarket).insert(markets.map((market) => ({ userId, market })));
  }

  async replaceRoles(manager: EntityManager, userId: string, roles: readonly Role[], assignedById: string): Promise<void> {
    await manager.getRepository(UserRole).delete({ userId });
    await this.insertRoles(manager, userId, roles, assignedById);
  }

  async replaceMarkets(manager: EntityManager, userId: string, markets: readonly MarketCode[]): Promise<void> {
    await manager.getRepository(UserMarket).delete({ userId });
    await this.insertMarkets(manager, userId, markets);
  }

  async updateProfile(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<User, 'firstName' | 'lastName' | 'isActive'>>,
  ): Promise<void> {
    if (Object.keys(data).length === 0) return;
    await manager.getRepository(User).update({ id }, data);
  }

  async updateLastLogin(manager: EntityManager, id: string, at: Date): Promise<void> {
    await manager.getRepository(User).update({ id }, { lastLoginAt: at });
  }

  async search(manager: EntityManager, filter: UserSearchFilter, limit: number, offset: number): Promise<[User[], number]> {
    const query = manager
      .getRepository(User)
      .createQueryBuilder('u')
      .select('u.id')
      .orderBy('u.createdAt', 'DESC')
      .addOrderBy('u.id', 'ASC')
      .take(limit)
      .skip(offset);

    if (filter.visibleMarkets !== null) {
      const visible = [...filter.visibleMarkets];
      query.andWhere(
        new Brackets((where) => {
          where.where('NOT EXISTS (SELECT 1 FROM user_markets um0 WHERE um0.user_id = u.id)');
          if (visible.length > 0) {
            where.orWhere('EXISTS (SELECT 1 FROM user_markets um1 WHERE um1.user_id = u.id AND um1.market IN (:...visible))', {
              visible,
            });
          }
        }),
      );
    }
    if (filter.role) {
      query.andWhere('EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = :role)', { role: filter.role });
    }
    if (filter.market) {
      query.andWhere('EXISTS (SELECT 1 FROM user_markets um2 WHERE um2.user_id = u.id AND um2.market = :market)', {
        market: filter.market,
      });
    }
    if (filter.search?.trim()) {
      query.andWhere(
        new Brackets((where) => {
          const pattern = likePattern(filter.search!.trim());
          where
            .where("LOWER(u.email) LIKE :pattern ESCAPE '\\'", { pattern })
            .orWhere("LOWER(u.firstName) LIKE :pattern ESCAPE '\\'", { pattern })
            .orWhere("LOWER(u.lastName) LIKE :pattern ESCAPE '\\'", { pattern });
        }),
      );
    }

    const [page, total] = await query.getManyAndCount();
    if (page.length === 0) return [[], total];
    const users = await manager.getRepository(User).find({
      where: { id: In(page.map((row) => row.id)) },
      relations: { roles: true, markets: true },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return [users, total];
  }

  /** Aktivni korisnici sa ulogom na tržištu (za dodelu na kupovini). */
  findStaff(manager: EntityManager, role: Role, market: MarketCode): Promise<User[]> {
    return manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere('EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = :role)', { role })
      .andWhere('EXISTS (SELECT 1 FROM user_markets um WHERE um.user_id = u.id AND um.market = :market)', { market })
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('u.firstName', 'ASC')
      .take(200)
      .getMany();
  }

  /** Aktivni kupci za izbor pri otvaranju kupovine; pretraga po imenu, prezimenu ili email-u. */
  findBuyers(manager: EntityManager, buyerRole: Role, search: string | undefined, limit: number, offset: number): Promise<[User[], number]> {
    const query = manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere('EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = :role)', { role: buyerRole })
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('u.firstName', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .take(limit)
      .skip(offset);
    const term = search?.trim();
    if (term) {
      const pattern = likePattern(term);
      query.andWhere(
        new Brackets((where) => {
          where
            .where("LOWER(u.email) LIKE :pattern ESCAPE '\\'", { pattern })
            .orWhere("LOWER(u.firstName) LIKE :pattern ESCAPE '\\'", { pattern })
            .orWhere("LOWER(u.lastName) LIKE :pattern ESCAPE '\\'", { pattern })
            .orWhere("LOWER(u.firstName || ' ' || u.lastName) LIKE :pattern ESCAPE '\\'", { pattern });
        }),
      );
    }
    return query.getManyAndCount();
  }
}
