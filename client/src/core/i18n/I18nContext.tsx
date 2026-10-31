import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { en } from './en.ts'
import { sr, type Dictionary } from './sr.ts'

export type Language = 'sr' | 'en'

/** Tekst na oba jezika, kako ga šalje server (Localized). */
export interface Localized {
  sr: string
  en: string
}

const DICTIONARIES: Record<Language, Dictionary> = { sr, en }
const STORAGE_KEY = 'vb.language'

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'en' ? 'en' : 'sr'
  } catch {
    return 'sr'
  }
}

interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  /** Prevod ključa iz rečnika; {name} se menja vrednošću iz params. */
  t: (key: keyof Dictionary, params?: Record<string, string | number>) => string
  /** Tekst koji je stigao sa servera na oba jezika. */
  l: (text: Localized | null | undefined) => string
  formatMoney: (amount: number, currency?: string) => string
  formatDate: (iso: string | null | undefined) => string
  /** Datum i vreme do sekunde (npr. audit): 31.10.2026. 14:05:09. */
  formatDateTime: (iso: string | null | undefined) => string
  formatNumber: (value: number, fractionDigits?: number) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Skladište nije dostupno; jezik važi do osvežavanja.
    }
    document.documentElement.lang = next === 'sr' ? 'sr-Latn' : 'en'
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dictionary = DICTIONARIES[language]
    const locale = language === 'sr' ? 'sr-Latn-RS' : 'en-GB'
    const numberFormat = new Intl.NumberFormat(locale)
    return {
      language,
      setLanguage,
      t: (key, params) => {
        let text: string = dictionary[key] ?? sr[key] ?? String(key)
        if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
        return text
      },
      l: (text) => (text ? text[language] || text.sr : ''),
      formatMoney: (amount, currency = 'EUR') =>
        new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
      formatDate: (iso) =>
        iso ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '—',
      formatDateTime: (iso) =>
        iso
          ? new Intl.DateTimeFormat(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hourCycle: 'h23',
            }).format(new Date(iso))
          : '—',
      formatNumber: (value, fractionDigits = 0) =>
        fractionDigits === 0
          ? numberFormat.format(value)
          : new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value),
    }
  }, [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Rečnik jedne celine (features/*): isti ključevi na srpskom i engleskom. */
export interface FeatureDictionary<K extends string> {
  sr: Record<K, string>
  en: Record<K, string>
}

/** Prevod iz rečnika celine; {name} se menja vrednošću iz params. */
export function useLocalT<K extends string>(dictionary: FeatureDictionary<K>) {
  const { language } = useI18n()
  return useCallback(
    (key: K, params?: Record<string, string | number>) => {
      let text = dictionary[language][key] ?? dictionary.sr[key] ?? key
      if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
      return text
    },
    [dictionary, language],
  )
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n se koristi samo unutar I18nProvider-a.')
  return context
}
