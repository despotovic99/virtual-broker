import type { FeatureRoute, NavItem } from '../../core/layout/nav.ts'
import { AuditPage } from './AuditPage.tsx'
import { CatalogPage } from './CatalogPage.tsx'
import { ConstructionPage } from './ConstructionPage.tsx'
import { DeveloperFormPage } from './DeveloperFormPage.tsx'
import { DeveloperPage } from './DeveloperPage.tsx'
import { EscrowPage } from './EscrowPage.tsx'
import { LegalTeamFormPage } from './LegalTeamFormPage.tsx'
import { LegalTeamPage } from './LegalTeamPage.tsx'
import { LegalTeamsPage } from './LegalTeamsPage.tsx'
import { ProjectFormPage } from './ProjectFormPage.tsx'
import { ProjectPage } from './ProjectPage.tsx'
import { QueuePage } from './QueuePage.tsx'
import { ReportFormPage } from './ReportFormPage.tsx'
import { RequestDetailPage } from './RequestDetailPage.tsx'
import { UnitFormPage } from './UnitFormPage.tsx'
import { UserFormPage } from './UserFormPage.tsx'
import { UsersPage } from './UsersPage.tsx'

// Radni prostori našeg tima, pravnog tima (red zahteva), inženjera, escrow partnera i admina.
export const staffNav: NavItem[] = [
  { to: '/queue', label: 'nav.queue', anyOf: ['requests:triage', 'requests:answer-legal'], order: 60, icon: 'inbox', group: 'team' },
  { to: '/catalog', label: 'nav.catalog', anyOf: ['catalog:manage'], order: 70, icon: 'grid', group: 'team' },
  { to: '/construction', label: 'nav.construction', anyOf: ['construction:report'], order: 75, icon: 'crane', group: 'team' },
  { to: '/escrow', label: 'nav.escrow', anyOf: ['escrow-instructions:approve', 'escrow:execute'], order: 80, icon: 'safe', group: 'team' },
  { to: '/admin/users', label: 'nav.users', anyOf: ['users:read'], order: 90, icon: 'users', group: 'admin' },
  { to: '/admin/legal-teams', label: 'nav.legalTeams', anyOf: ['legal-teams:manage'], order: 95, icon: 'scale', group: 'admin' },
  { to: '/admin/audit', label: 'nav.audit', anyOf: ['audit:read'], order: 98, icon: 'shield', group: 'admin' },
]

export const staffRoutes: FeatureRoute[] = [
  { path: '/queue', element: <QueuePage /> },
  { path: '/queue/:id', element: <RequestDetailPage /> },
  { path: '/catalog', element: <CatalogPage /> },
  { path: '/catalog/developers/new', element: <DeveloperFormPage /> },
  { path: '/catalog/developers/:id', element: <DeveloperPage /> },
  { path: '/catalog/developers/:id/edit', element: <DeveloperFormPage /> },
  { path: '/catalog/projects/new', element: <ProjectFormPage /> },
  { path: '/catalog/projects/:id', element: <ProjectPage /> },
  { path: '/catalog/projects/:id/edit', element: <ProjectFormPage /> },
  { path: '/catalog/projects/:id/units/new', element: <UnitFormPage /> },
  { path: '/catalog/projects/:id/units/:unitId/edit', element: <UnitFormPage /> },
  { path: '/construction', element: <ConstructionPage /> },
  { path: '/construction/reports/new', element: <ReportFormPage /> },
  { path: '/escrow', element: <EscrowPage /> },
  { path: '/admin/users', element: <UsersPage /> },
  { path: '/admin/users/new', element: <UserFormPage /> },
  { path: '/admin/users/:id/edit', element: <UserFormPage /> },
  { path: '/admin/legal-teams', element: <LegalTeamsPage /> },
  { path: '/admin/legal-teams/new', element: <LegalTeamFormPage /> },
  { path: '/admin/legal-teams/:id', element: <LegalTeamPage /> },
  { path: '/admin/legal-teams/:id/edit', element: <LegalTeamFormPage /> },
  { path: '/admin/audit', element: <AuditPage /> },
]
