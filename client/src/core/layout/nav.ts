import type { ReactNode } from 'react'
import type { Capability } from '../auth/capabilities.ts'
import type { Dictionary } from '../i18n/sr.ts'
import type { IconName } from '../../ui/icons.tsx'

/** Celine levog menija, ovim redom. */
export const NAV_GROUPS = ['buyer', 'purchases', 'team', 'admin'] as const
export type NavGroup = (typeof NAV_GROUPS)[number]

/** Stavka menija. Prikazuje se samo korisniku koji ima bar jednu od navedenih capability. */
export interface NavItem {
  to: string
  label: keyof Dictionary
  anyOf: Capability[]
  /** Redosled u meniju (manji ide pre). */
  order: number
  icon: IconName
  group: NavGroup
}

/** Ruta jedne funkcionalne celine (buyer, staff). */
export interface FeatureRoute {
  path: string
  element: ReactNode
}
