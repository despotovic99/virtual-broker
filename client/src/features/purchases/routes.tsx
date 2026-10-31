import type { FeatureRoute, NavItem } from '../../core/layout/nav.ts'
import { MyTasksPage } from './MyTasksPage.tsx'
import { NewPurchasePage } from './NewPurchasePage.tsx'
import { OpinionFormPage } from './OpinionFormPage.tsx'
import { PlanFormPage } from './PlanFormPage.tsx'
import { PurchaseDetailPage } from './PurchaseDetailPage.tsx'
import { PurchasesListPage } from './PurchasesListPage.tsx'

// Kupovina (predmet) za sve uloge: lista, radni prostor sa karticama, moji zadaci.
export const purchasesNav: NavItem[] = [
  { to: '/purchases', label: 'nav.purchases', anyOf: ['purchases:read'], order: 30, icon: 'folder', group: 'purchases' },
  { to: '/tasks', label: 'nav.tasks', anyOf: ['tasks:work'], order: 35, icon: 'tasks', group: 'purchases' },
]

export const purchasesRoutes: FeatureRoute[] = [
  { path: '/purchases', element: <PurchasesListPage /> },
  { path: '/purchases/new', element: <NewPurchasePage /> },
  { path: '/purchases/:id', element: <PurchaseDetailPage /> },
  { path: '/purchases/:id/plan', element: <PlanFormPage /> },
  { path: '/purchases/:id/opinions/new', element: <OpinionFormPage /> },
  { path: '/tasks', element: <MyTasksPage /> },
]
