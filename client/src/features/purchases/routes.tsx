import type { FeatureRoute, NavItem } from '../../core/layout/nav.ts'
import { MyTasksPage } from './MyTasksPage.tsx'
import { PurchaseDetailPage } from './PurchaseDetailPage.tsx'
import { PurchasesListPage } from './PurchasesListPage.tsx'

// Kupovina (predmet) za sve uloge: lista, radni prostor sa karticama, moji zadaci.
export const purchasesNav: NavItem[] = [
  { to: '/purchases', label: 'nav.purchases', anyOf: ['purchases:read'], order: 30 },
  { to: '/tasks', label: 'nav.tasks', anyOf: ['tasks:work'], order: 35 },
]

export const purchasesRoutes: FeatureRoute[] = [
  { path: '/purchases', element: <PurchasesListPage /> },
  { path: '/purchases/:id', element: <PurchaseDetailPage /> },
  { path: '/tasks', element: <MyTasksPage /> },
]
