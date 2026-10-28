import type { MarketCode } from '../../../markets/market-code.js';
import type { JourneyPhase, Localized, MoneyModel } from '../../../markets/market-pack.js';
import type { Role } from '../../access/role.enum.js';
import type { PurchaseRelation } from '../purchase-access.service.js';
import type { StepStatus } from '../entities/purchase-step.entity.js';
import type { TaskStatus } from '../entities/purchase-task.entity.js';
import type { PurchaseStatus } from '../entities/purchase.entity.js';

export interface PersonDto {
  id: string;
  firstName: string;
  lastName: string;
  /** Email se ne prikazuje kupcu za druge učesnike, osim koordinatora. */
  email: string | null;
}

export interface PurchaseStepDto {
  code: string;
  phase: JourneyPhase;
  title: Localized;
  ownerRoles: Role[];
  optional: boolean;
  requiresLegalOpinion: boolean;
  status: StepStatus;
  completedAt: string | null;
  completedBy: PersonDto | null;
  note: string | null;
}

export interface PurchaseSummaryDto {
  id: string;
  market: MarketCode;
  status: PurchaseStatus;
  unitLabel: string;
  projectId: string;
  projectName: string;
  city: string;
  price: number;
  /** Prvi korak koji nije završen ni preskočen. */
  currentStep: { code: string; title: Localized } | null;
  createdAt: string;
}

export interface PurchaseDetailDto extends PurchaseSummaryDto {
  packVersion: string;
  moneyModel: MoneyModel;
  blockReason: string | null;
  closedAt: string | null;
  unit: { id: string; label: string; floor: number | null; rooms: number | null; area: number; price: number };
  project: { id: string; name: string; city: string; address: string };
  developer: { id: string; name: string };
  buyer: PersonDto | null;
  coordinator: PersonDto | null;
  lawyer: PersonDto | null;
  engineer: PersonDto | null;
  escrowAgent: PersonDto | null;
  legalTeam: { id: string; name: string } | null;
  /** Predlog pravnog tima dok tim nije dodeljen (koordinator potvrđuje). */
  proposedLegalTeam: { id: string; name: string } | null;
  steps: PurchaseStepDto[];
  /** Kako je prijavljeni korisnik vezan za kupovinu. */
  myRelations: PurchaseRelation[];
}

export interface PurchaseListDto {
  items: PurchaseSummaryDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface PurchaseTaskDto {
  id: string;
  purchaseId: string;
  type: string;
  title: string;
  assigneeUserId: string | null;
  legalTeamId: string | null;
  dueAt: string | null;
  status: TaskStatus;
  waitingReason: string | null;
  result: string | null;
  documentId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PurchaseMessageDto {
  id: string;
  authorId: string;
  author: PersonDto | null;
  body: string;
  internal: boolean;
  createdAt: string;
}
