import type { ReactNode } from 'react'
import { Icon } from '../../ui/icons.tsx'
import { useI18n, type Language } from '../i18n/I18nContext.tsx'

const LANGUAGES: Language[] = ['sr', 'en']

/** Okvir ekrana prijave i registracije: znak, izbor jezika i kartica sa obrascem. */
export function AuthFrame({ title, lead, footer, children }: { title: string; lead?: string; footer?: ReactNode; children: ReactNode }) {
  const { t, language, setLanguage } = useI18n()
  return (
    <main className="auth">
      <div className="row row--between">
        <span className="brand">
          <span className="brand__mark">
            <Icon name="home" size={15} />
          </span>
          <span className="brand__name">{t('app.name')}</span>
        </span>
        <div className="lang" role="group" aria-label="Language">
          {LANGUAGES.map((code) => (
            <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="auth__card">
        <h1>{title}</h1>
        {lead && <p className="auth__lead">{lead}</p>}
        {children}
      </div>
      {footer && <p className="auth__switch">{footer}</p>}
    </main>
  )
}
