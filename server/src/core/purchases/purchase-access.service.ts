import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole, isInternalOnMarket } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { LegalTeamsService } from '../legal/legal-teams.service.js';
import type { LegalTeamRole } from '../legal/entities/legal-team-member.entity.js';
import type { Purchase } from './entities/purchase.entity.js';
import { PurchaseAccessRepository } from './purchase-access.repository.js';

/** Kako je korisnik vezan za kupovinu. Jedan korisnik može imati više veza. */
export type PurchaseRelation = 'BUYER' | 'COORDINATOR' | 'INTERNAL' | 'LAWYER' | 'ENGINEER' | 'ESCROW';

export interface PurchaseAccess {
  purchase: Purchase;
  relations: ReadonlySet<PurchaseRelation>;
  /** Uloga u pravnom timu, ako je korisnik advokat na ovoj kupovini. */
  legalTeamRole: LegalTeamRole | null;
}

/**
 * Jedino mesto koje odlučuje ko vidi koju kupovinu. Korisnik bez veze sa
 * kupovinom dobija NOT_FOUND (ne FORBIDDEN), da se iz odgovora ne vidi da
 * kupovina postoji. Učestvuje u tuđoj konekciji.
 */
@Injectable()
export class PurchaseAccessService {
  constructor(
    private readonly purchases: PurchaseAccessRepository,
    private readonly legalTeams: LegalTeamsService,
  ) {}

  async get(manager: EntityManager, purchaseId: string, actor: AuthUser): Promise<PurchaseAccess> {
    const purchase = await this.purchases.findById(manager, purchaseId);
    return this.resolve(manager, purchase, actor);
  }

  /** Isto kao `get`, uz pessimistic_write lock na kupovini (za promene stanja). */
  async getForUpdate(manager: EntityManager, purchaseId: string, actor: AuthUser): Promise<PurchaseAccess> {
    const purchase = await this.purchases.findByIdForUpdate(manager, purchaseId);
    return this.resolve(manager, purchase, actor);
  }

  /** Baca FORBIDDEN ako korisnik nema nijednu od traženih veza sa kupovinom. */
  require(access: PurchaseAccess, ...allowed: PurchaseRelation[]): void {
    if (!allowed.some((relation) => access.relations.has(relation))) throw new ApiError(ApiErrorCode.Forbidden);
  }

  /** Da li korisnik sme da vidi podatke o projektu (dokumenta projekta, izveštaji inženjera). */
  async canSeeProject(manager: EntityManager, actor: AuthUser, projectId: string, market: MarketCode): Promise<boolean> {
    if (isInternalOnMarket(actor, market)) return true;
    if (hasRole(actor, Role.Lawyer) && hasMarketAccess(actor, market)) return true;
    if (hasRole(actor, Role.Engineer) && hasMarketAccess(actor, market)) return true;
    if (hasRole(actor, Role.Buyer)) return this.purchases.buyerHasPurchaseInProject(manager, actor.id, projectId);
    return false;
  }

  private async resolve(manager: EntityManager, purchase: Purchase | null, actor: AuthUser): Promise<PurchaseAccess> {
    if (!purchase) throw new ApiError(ApiErrorCode.NotFound);
    const relations = new Set<PurchaseRelation>();
    let legalTeamRole: LegalTeamRole | null = null;

    if (purchase.buyerId === actor.id) relations.add('BUYER');
    if (purchase.coordinatorId === actor.id) relations.add('COORDINATOR');
    if (isInternalOnMarket(actor, purchase.market)) relations.add('INTERNAL');
    if (purchase.engineerId === actor.id && hasMarketAccess(actor, purchase.market)) relations.add('ENGINEER');
    if (purchase.escrowAgentId === actor.id && hasMarketAccess(actor, purchase.market)) relations.add('ESCROW');
    if (purchase.legalTeamId && hasRole(actor, Role.Lawyer) && hasMarketAccess(actor, purchase.market)) {
      legalTeamRole = await this.legalTeams.memberRole(manager, purchase.legalTeamId, actor.id);
      if (legalTeamRole) relations.add('LAWYER');
    }

    if (relations.size === 0) throw new ApiError(ApiErrorCode.NotFound);
    return { purchase, relations, legalTeamRole };
  }
}
