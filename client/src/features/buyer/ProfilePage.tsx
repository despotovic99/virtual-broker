import { useEffect, useState, type FormEvent } from 'react'
import { api, query } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { buyerDictionary } from './i18n.ts'
import type { BuyerProfile, LegalFinding } from './types.ts'

interface ProfileForm {
  isFirstHome: boolean
  isEuCitizen: boolean
  primaryResidence: boolean
  financing: 'CASH' | 'MORTGAGE'
  age: string
  householdMembers: string
  budget: string
}

function toForm(profile: BuyerProfile): ProfileForm {
  return {
    isFirstHome: profile.isFirstHome,
    isEuCitizen: profile.isEuCitizen,
    primaryResidence: profile.primaryResidence,
    financing: profile.financing,
    age: profile.age === null ? '' : String(profile.age),
    householdMembers: String(profile.householdMembers),
    budget: profile.budget === null ? '' : String(profile.budget),
  }
}

/** Pravne napomene za izabrano tržište, na osnovu sačuvanog upitnika (F-11). */
function LegalFindings({ version }: { version: number }) {
  const { t, l } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const [market, setMarket] = useState<MarketCode>('RS')
  const findings = useAsync(() => api<LegalFinding[]>(`/costs/legal-findings${query({ market })}`), [market, version])

  return (
    <Card
      title={bt('profile.findings')}
      actions={
        <select aria-label={t('common.market')} value={market} onChange={(event) => setMarket(event.target.value === 'CY' ? 'CY' : 'RS')}>
          {MARKETS.map((code) => (
            <option key={code} value={code}>
              {t(`market.${code}`)}
            </option>
          ))}
        </select>
      }
    >
      <ErrorBox error={findings.error} />
      {findings.loading && !findings.data && <Loading />}
      {findings.data && findings.data.length === 0 && <Empty text={bt('profile.findingsEmpty')} />}
      {findings.data?.map((finding) => (
        <div key={finding.code} className={`buyer-finding buyer-finding-${finding.level}`}>
          <div className="row">
            <StatusBadge
              text={bt(`profile.level${finding.level}`)}
              tone={finding.level === 'BLOCKER' ? 'bad' : finding.level === 'WARNING' ? 'warn' : 'neutral'}
            />
            <strong>{l(finding.title)}</strong>
          </div>
          <p>{l(finding.text)}</p>
        </div>
      ))}
      <p className="muted">{bt('profile.findingsNote')}</p>
    </Card>
  )
}

/** Upitnik kupca (F-03). */
export function ProfilePage() {
  const { t } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const profile = useAsync(() => api<BuyerProfile>('/buyer-profile'), [])
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (profile.data) setForm(toForm(profile.data))
  }, [profile.data])

  const update = (patch: Partial<ProfileForm>) => {
    setSaved(false)
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    setError(null)
    setSaving(true)
    try {
      const household = Number.parseInt(form.householdMembers, 10)
      const body = {
        isFirstHome: form.isFirstHome,
        isEuCitizen: form.isEuCitizen,
        primaryResidence: form.primaryResidence,
        financing: form.financing,
        householdMembers: Number.isFinite(household) && household >= 1 ? Math.min(household, 20) : 1,
        ...(form.age ? { age: Number.parseInt(form.age, 10) } : {}),
        ...(form.budget ? { budget: Number.parseInt(form.budget, 10) } : {}),
      }
      const result = await api<BuyerProfile>('/buyer-profile', { method: 'PUT', body })
      setForm(toForm(result))
      setSaved(true)
      setVersion((value) => value + 1)
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title={bt('profile.title')}>
      <Card>
        <p className="muted">{bt('profile.intro')}</p>
        <ErrorBox error={profile.error} />
        {profile.loading && !form && <Loading />}
        {form && (
          <form onSubmit={(event) => void onSubmit(event)} noValidate>
            <div className="buyer-checks">
              <label>
                <input type="checkbox" checked={form.isFirstHome} onChange={(event) => update({ isFirstHome: event.target.checked })} />
                {bt('profile.isFirstHome')}
              </label>
              <label>
                <input type="checkbox" checked={form.isEuCitizen} onChange={(event) => update({ isEuCitizen: event.target.checked })} />
                {bt('profile.isEuCitizen')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.primaryResidence}
                  onChange={(event) => update({ primaryResidence: event.target.checked })}
                />
                {bt('profile.primaryResidence')}
              </label>
            </div>
            <div className="buyer-filters">
              <Field label={bt('profile.financing')}>
                <select
                  value={form.financing}
                  onChange={(event) => update({ financing: event.target.value === 'MORTGAGE' ? 'MORTGAGE' : 'CASH' })}
                >
                  <option value="CASH">{bt('profile.cash')}</option>
                  <option value="MORTGAGE">{bt('profile.mortgage')}</option>
                </select>
              </Field>
              <Field label={bt('profile.age')} hint={t('common.optional')}>
                <input
                  inputMode="numeric"
                  value={form.age}
                  onChange={(event) => update({ age: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                />
              </Field>
              <Field label={bt('profile.householdMembers')}>
                <input
                  inputMode="numeric"
                  value={form.householdMembers}
                  onChange={(event) => update({ householdMembers: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </Field>
              <Field label={bt('profile.budget')} hint={t('common.optional')}>
                <input
                  inputMode="numeric"
                  value={form.budget}
                  onChange={(event) => update({ budget: event.target.value.replace(/\D/g, '').slice(0, 9) })}
                />
              </Field>
            </div>
            <ErrorBox error={error} />
            <div className="row">
              <button type="submit" className="primary" disabled={saving}>
                {t('common.save')}
              </button>
              {saved && <span className="muted">{bt('profile.saved')}</span>}
            </div>
          </form>
        )}
      </Card>
      <LegalFindings version={version} />
    </Page>
  )
}
