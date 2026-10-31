import { useEffect, useState, type FormEvent } from 'react'
import { api, query } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Button, Card, Chip, Empty, ErrorBox, ErrorState, Field, FormSection, InfoTip, Loading, Notice, Page, Segmented } from '../../ui/components.tsx'
import { Icon, type IconName } from '../../ui/icons.tsx'
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

const FINDING_ICON: Record<LegalFinding['level'], IconName> = {
  INFO: 'info',
  WARNING: 'warn',
  BLOCKER: 'critical',
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
        <Segmented
          label={t('common.market')}
          value={market}
          onChange={setMarket}
          options={MARKETS.map((code) => ({ value: code, label: t(`market.${code}`) }))}
        />
      }
    >
      <div className="stack">
        <ErrorBox error={findings.error} onRetry={findings.reload} />
        {findings.loading && !findings.data && <Loading inline rows={2} />}
        {findings.data && findings.data.length === 0 && <Empty text={bt('profile.findingsEmpty')} />}
        {findings.data && findings.data.length > 0 && (
          <div>
            {findings.data.map((finding) => (
              <div key={finding.code} className={`finding finding--${finding.level}`}>
                <span className="finding__icon">
                  <Icon name={FINDING_ICON[finding.level]} size={15} />
                </span>
                <div className="finding__body">
                  <strong className="finding__title">{l(finding.title)}</strong>
                  <span>{l(finding.text)}</span>
                  <span className="meta">{bt(`profile.level${finding.level}`)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Notice tone="plain">{bt('profile.findingsNote')}</Notice>
      </div>
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
    <Page title={bt('profile.title')} meta={<span className="page-description">{bt('form.profile.description')}</span>}>
      <div className="layout-aside">
        <div className="layout-aside__main">
          {profile.error && !form ? (
            <ErrorState error={profile.error} onRetry={profile.reload} />
          ) : !form ? (
            <Card>
              <Loading inline />
            </Card>
          ) : (
            <form className="card form-page__card" onSubmit={(event) => void onSubmit(event)} noValidate>
              <div className="form-page__body">
                <FormSection title={bt('form.profile.statusTitle')} description={bt('form.profile.statusHint')} columns={1}>
                  <div className="checks">
                    <label className="check">
                      <input type="checkbox" checked={form.isFirstHome} onChange={(event) => update({ isFirstHome: event.target.checked })} />
                      {bt('profile.isFirstHome')}
                      <InfoTip text={bt('form.profile.firstHomeInfo')} />
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={form.isEuCitizen} onChange={(event) => update({ isEuCitizen: event.target.checked })} />
                      {bt('profile.isEuCitizen')}
                      <InfoTip text={bt('form.profile.euInfo')} />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={form.primaryResidence}
                        onChange={(event) => update({ primaryResidence: event.target.checked })}
                      />
                      {bt('profile.primaryResidence')}
                      <InfoTip text={bt('form.profile.residenceInfo')} />
                    </label>
                  </div>
                </FormSection>

                <FormSection title={bt('form.profile.financingTitle')} description={bt('form.profile.financingHint')}>
                  <fieldset>
                    <legend>
                      <span className="row">
                        {bt('profile.financing')}
                        <InfoTip text={bt('form.profile.financingInfo')} />
                      </span>
                    </legend>
                    <div className="checks checks--inline">
                      <label className="check">
                        <input
                          type="radio"
                          name="financing"
                          value="CASH"
                          checked={form.financing === 'CASH'}
                          onChange={() => update({ financing: 'CASH' })}
                        />
                        {bt('profile.cash')}
                      </label>
                      <label className="check">
                        <input
                          type="radio"
                          name="financing"
                          value="MORTGAGE"
                          checked={form.financing === 'MORTGAGE'}
                          onChange={() => update({ financing: 'MORTGAGE' })}
                        />
                        {bt('profile.mortgage')}
                      </label>
                    </div>
                  </fieldset>
                  <Field label={bt('profile.age')} info={bt('form.profile.ageInfo')} hint={t('common.optional')} suffix={bt('form.profile.ageSuffix')}>
                    <input
                      className="num"
                      inputMode="numeric"
                      value={form.age}
                      onChange={(event) => update({ age: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                    />
                  </Field>
                </FormSection>

                <FormSection title={bt('form.profile.householdTitle')} description={bt('form.profile.householdHint')}>
                  <Field label={bt('profile.householdMembers')} required info={bt('form.profile.householdInfo')}>
                    <input
                      className="num"
                      inputMode="numeric"
                      value={form.householdMembers}
                      onChange={(event) => update({ householdMembers: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                    />
                  </Field>
                  <Field label={bt('form.profile.budget')} info={bt('form.profile.budgetInfo')} hint={t('common.optional')} suffix="€">
                    <input
                      className="num"
                      inputMode="numeric"
                      value={form.budget}
                      onChange={(event) => update({ budget: event.target.value.replace(/\D/g, '').slice(0, 9) })}
                    />
                  </Field>
                </FormSection>

                {Boolean(error) && (
                  <div className="form-page__error">
                    <ErrorBox error={error} />
                  </div>
                )}
              </div>
              <div className="form-page__footer">
                <span className="form-page__footer-note">
                  {saved ? (
                    <Chip tone="ok" icon="check">
                      {bt('profile.saved')}
                    </Chip>
                  ) : (
                    <span className="muted small">{t('form.requiredNote')}</span>
                  )}
                </span>
                <Button type="submit" variant="primary" busy={saving}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          )}
        </div>
        <div className="layout-aside__side">
          <LegalFindings version={version} />
        </div>
      </div>
    </Page>
  )
}
