import type { JourneyStepDefinition, MarketPack } from '../../markets/market-pack.js';
import type { PurchaseMessageDto, PurchaseSummaryDto, PurchaseTaskDto, PersonDto } from './dto/purchase-response.dto.js';
import type { PurchaseMessage } from './entities/purchase-message.entity.js';
import type { PurchaseStep } from './entities/purchase-step.entity.js';
import type { PurchaseTask } from './entities/purchase-task.entity.js';
import type { Purchase } from './entities/purchase.entity.js';
import type { PersonRow } from './purchases.repository.js';

export function toPerson(row: PersonRow | undefined, includeEmail: boolean): PersonDto | null {
  if (!row) return null;
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, email: includeEmail ? row.email : null };
}

export function stepDefinition(pack: MarketPack, code: string): JourneyStepDefinition | undefined {
  return pack.journey.find((step) => step.code === code);
}

/** Prvi korak koji nije završen ni preskočen. */
export function currentStep(pack: MarketPack, steps: readonly PurchaseStep[]): PurchaseSummaryDto['currentStep'] {
  const pending = [...steps].sort((a, b) => a.position - b.position).find((step) => step.status === 'PENDING');
  if (!pending) return null;
  const definition = stepDefinition(pack, pending.stepCode);
  return { code: pending.stepCode, title: definition?.title ?? { sr: pending.stepCode, en: pending.stepCode } };
}

/** Kupovina mora imati učitan stan i projekat (relacije unit i unit.project). */
export function toPurchaseSummary(purchase: Purchase, pack: MarketPack): PurchaseSummaryDto {
  const unit = purchase.unit;
  const project = unit?.project;
  return {
    id: purchase.id,
    market: purchase.market,
    status: purchase.status,
    unitLabel: unit?.label ?? '',
    projectId: purchase.projectId,
    projectName: project?.name ?? '',
    city: project?.city ?? '',
    price: unit?.price ?? 0,
    currentStep: currentStep(pack, purchase.steps ?? []),
    createdAt: purchase.createdAt.toISOString(),
  };
}

export function toTaskDto(task: PurchaseTask): PurchaseTaskDto {
  return {
    id: task.id,
    purchaseId: task.purchaseId,
    type: task.type,
    title: task.title,
    assigneeUserId: task.assigneeUserId,
    legalTeamId: task.legalTeamId,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    status: task.status,
    waitingReason: task.waitingReason,
    result: task.result,
    documentId: task.documentId,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  };
}

export function toMessageDto(message: PurchaseMessage, author: PersonDto | null): PurchaseMessageDto {
  return {
    id: message.id,
    authorId: message.authorId,
    author,
    body: message.body,
    internal: message.internal,
    createdAt: message.createdAt.toISOString(),
  };
}
