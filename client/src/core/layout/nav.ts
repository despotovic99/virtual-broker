import type { ReactNode } from 'react'
import type { Capability } from '../auth/capabilities.ts'
import type { Dictionary } from '../i18n/sr.ts'

/** Stavka menija. Prikazuje se samo korisniku koji ima bar jednu od navedenih capability. */
export interface NavItem {
  to: string
  label: keyof Dictionary
  anyOf: Capability[]
  /** Redosled u meniju (manji ide pre). */
  order: number
}

/** Ruta jedne funkcionalne celine (buyer, staff). */
export interface FeatureRoute {
  path: string
  element: ReactNode
}
