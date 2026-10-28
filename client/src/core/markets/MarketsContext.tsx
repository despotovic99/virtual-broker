import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/http.ts'
import type { MarketCode, Role } from '../auth/capabilities.ts'
import type { Localized } from '../i18n/I18nContext.tsx'

/** Metapodaci paketa tržišta sa servera (GET /api/markets). */
export interface MarketMeta {
  code: MarketCode
  version: string
  moneyModel: 'ESCROW' | 'GATE'
  locale: { languages: string[]; displayCurrencies: string[]; timeZone: string }
  journey: { code: string; phase: string; title: Localized; ownerRoles: Role[]; requiresLegalOpinion?: boolean; optional?: boolean }[]
  checks: {
    code: string
    subject: 'DEVELOPER' | 'PROJECT'
    title: Localized
    mandatory: boolean
    method: 'AUTOMATIC' | 'DOCUMENT' | 'LAWYER' | 'MANUAL'
    validityDays: number
    inFreeSemaphore: boolean
    hardBlockOnRed?: boolean
  }[]
  paymentConditions: { code: string; title: Localized; appliesTo: 'FIRST' | 'EVERY' | 'PHASE' | 'LAST'; confirmerRoles: Role[] }[]
  constructionPhases: { code: string; title: Localized; defaultSharePercent: number }[]
  documentTypes: { code: string; title: Localized; scopes: ('PURCHASE' | 'PROJECT' | 'DEVELOPER' | 'REPORT')[] }[]
}

interface MarketsValue {
  markets: MarketMeta[]
  get: (code: MarketCode) => MarketMeta | undefined
}

const MarketsContext = createContext<MarketsValue>({ markets: [], get: () => undefined })

/** Učitava metapodatke tržišta jednom, posle prijave. */
export function MarketsProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<MarketMeta[]>([])

  useEffect(() => {
    let active = true
    api<MarketMeta[]>('/markets')
      .then((data) => {
        if (active) setMarkets(data)
      })
      .catch(() => {
        // Bez metapodataka ekrani prikazuju samo kodove; greška se ne prikazuje posebno.
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <MarketsContext.Provider value={{ markets, get: (code) => markets.find((market) => market.code === code) }}>
      {children}
    </MarketsContext.Provider>
  )
}

export function useMarkets(): MarketsValue {
  return useContext(MarketsContext)
}
