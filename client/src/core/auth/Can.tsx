import type { ReactNode } from 'react'
import { useAuth } from './AuthContext.tsx'
import type { Capability } from './capabilities.ts'

/** Prikazuje sadržaj samo korisniku sa datom capability. Samo prikaz, zaštitu radi server. */
export function Can({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { can } = useAuth()
  return can(capability) ? <>{children}</> : null
}
