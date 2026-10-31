import type { FeatureRoute, NavItem } from '../../core/layout/nav.ts'
import { CostsPage } from './CostsPage.tsx'
import { NewRequestPage } from './NewRequestPage.tsx'
import { ProfilePage } from './ProfilePage.tsx'
import { ProjectDetailPage } from './ProjectDetailPage.tsx'
import { ProjectsPage } from './ProjectsPage.tsx'
import { RequestDetailPage } from './RequestDetailPage.tsx'
import { RequestsPage } from './RequestsPage.tsx'

// Ekrani kupca: zahtevi i besplatni semafor (F-35), projekti (F-04), profil (F-03, F-11) i troškovi (F-09, F-10).
// Meni „Projekti” se vezuje za requests:create, da ga vide samo kupci (tim ima svoj katalog).
export const buyerNav: NavItem[] = [
  { to: '/requests', label: 'nav.requests', anyOf: ['requests:create'], order: 10, icon: 'doc', group: 'buyer' },
  { to: '/projects', label: 'nav.projects', anyOf: ['requests:create'], order: 20, icon: 'building', group: 'buyer' },
  { to: '/profile', label: 'nav.profile', anyOf: ['buyer-profile:manage'], order: 40, icon: 'user', group: 'buyer' },
  { to: '/costs', label: 'nav.costs', anyOf: ['buyer-profile:manage'], order: 50, icon: 'calculator', group: 'buyer' },
]

export const buyerRoutes: FeatureRoute[] = [
  { path: '/requests', element: <RequestsPage /> },
  { path: '/requests/new', element: <NewRequestPage /> },
  { path: '/requests/:id', element: <RequestDetailPage /> },
  { path: '/projects', element: <ProjectsPage /> },
  { path: '/projects/:id', element: <ProjectDetailPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/costs', element: <CostsPage /> },
]
