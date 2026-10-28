import type { FeatureRoute, NavItem } from '../../core/layout/nav.ts'
import { AuditPage } from './AuditPage.tsx'
import { CatalogPage } from './CatalogPage.tsx'
import { ConstructionPage } from './ConstructionPage.tsx'
import { DeveloperPage } from './DeveloperPage.tsx'
import { EscrowPage } from './EscrowPage.tsx'
import { LegalTeamsPage } from './LegalTeamsPage.tsx'
import { ProjectPage } from './ProjectPage.tsx'
import { QueuePage } from './QueuePage.tsx'
import { RequestDetailPage } from './RequestDetailPage.tsx'
import { UsersPage } from './UsersPage.tsx'

// Radni prostori našeg tima, pravnog tima (red zahteva), inženjera, escrow partnera i admina.
export const staffNav: NavItem[] = [
  { to: '/queue', label: 'nav.queue', anyOf: ['requests:triage', 'requests:answer-legal'], order: 60 },
  { to: '/catalog', label: 'nav.catalog', anyOf: ['catalog:manage'], order: 70 },
  { to: '/construction', label: 'nav.construction', anyOf: ['construction:report'], order: 75 },
  { to: '/escrow', label: 'nav.escrow', anyOf: ['escrow-instructions:approve', 'escrow:execute'], order: 80 },
  { to: '/admin/users', label: 'nav.users', anyOf: ['users:read'], order: 90 },
  { to: '/admin/legal-teams', label: 'nav.legalTeams', anyOf: ['legal-teams:manage'], order: 95 },
  { to: '/admin/audit', label: 'nav.audit', anyOf: ['audit:read'], order: 98 },
]

export const staffRoutes: FeatureRoute[] = [
  { path: '/queue', element: <QueuePage /> },
  { path: '/queue/:id', element: <RequestDetailPage /> },
  { path: '/catalog', element: <CatalogPage /> },
  { path: '/catalog/developers/:id', element: <DeveloperPage /> },
  { path: '/catalog/projects/:id', element: <ProjectPage /> },
  { path: '/construction', element: <ConstructionPage /> },
  { path: '/escrow', element: <EscrowPage /> },
  { path: '/admin/users', element: <UsersPage /> },
  { path: '/admin/legal-teams', element: <LegalTeamsPage /> },
  { path: '/admin/audit', element: <AuditPage /> },
]
