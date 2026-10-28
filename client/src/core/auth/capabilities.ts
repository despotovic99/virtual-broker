// Iste vrednosti kao na serveru (server/src/core/access/role.enum.ts i
// capability.enum.ts). Kada se tamo doda uloga ili capability, dodati je i ovde.

export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'ANALYST',
  'COORDINATOR',
  'LAWYER',
  'ENGINEER',
  'ESCROW_AGENT',
  'BUYER',
  'INVESTOR',
] as const
export type Role = (typeof ROLES)[number]

export const CAPABILITIES = [
  'users:read',
  'users:create',
  'users:update',
  'legal-teams:manage',
  'audit:read',
  'catalog:read',
  'catalog:manage',
  'bank-accounts:verify',
  'checks:read',
  'checks:manage',
  'requests:create',
  'requests:triage',
  'requests:answer-legal',
  'buyer-profile:manage',
  'costs:calculate',
  'purchases:read',
  'purchases:manage',
  'purchases:assign-lawyer',
  'purchase-steps:complete',
  'tasks:work',
  'messages:write',
  'documents:upload',
  'power-of-attorney:manage',
  'legal-opinions:sign',
  'payments:read',
  'payments:plan',
  'payment-conditions:confirm',
  'payments:record',
  'escrow-instructions:approve',
  'escrow:execute',
  'construction:read',
  'construction:report',
  'handover:manage',
  'defects:manage',
] as const
export type Capability = (typeof CAPABILITIES)[number]

export const MARKETS = ['RS', 'CY'] as const
export type MarketCode = (typeof MARKETS)[number]
