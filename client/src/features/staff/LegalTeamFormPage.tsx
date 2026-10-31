import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/http.ts'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Field, FormSection, InfoTip } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useMyMarkets, useStaffT } from './shared.tsx'

function parseList(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))]
}

const LANGUAGE = /^[a-z]{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Nov pravni tim (`/admin/legal-teams/new`) i izmena (`/admin/legal-teams/:id/edit`).
 * Server nema GET /legal-teams/:id, pa se tim za izmenu uzima iz spiska.
 */
export function LegalTeamFormPage() {
  const { id } = useParams()
  const editing = id !== undefined
  const st = useStaffT()
  const { t } = useI18n()
  const markets = useMyMarkets()
  const teams = useAsync(() => (id ? staffApi.legalTeams() : Promise.resolve(null)), [id])
  const team = id ? teams.data?.find((item) => item.id === id) : undefined
  const [market, setMarket] = useState<MarketCode | ''>(markets[0] ?? '')
  const [form, setForm] = useState({ name: '', languages: 'sr, en', conflicts: '', active: true })

  useEffect(() => {
    if (!team) return
    setMarket(team.market)
    setForm({ name: team.name, languages: team.languages.join(', '), conflicts: team.conflictDeveloperIds.join('\n'), active: team.active })
  }, [team])

  const incomplete = form.name.trim().length < 2 || (!editing && !market)

  const submit = async () => {
    const languages = parseList(form.languages.toLowerCase())
    if (id) {
      await staffApi.updateLegalTeam(id, {
        name: form.name.trim(),
        languages,
        conflictDeveloperIds: parseList(form.conflicts),
        active: form.active,
      })
      return `/admin/legal-teams/${id}`
    }
    if (!market) return
    const created = await staffApi.createLegalTeam({ market, name: form.name.trim(), languages, conflictDeveloperIds: [] })
    return `/admin/legal-teams/${created.id}`
  }

  const title = editing ? st('teams.edit') : st('teams.new')
  const backTo = id ? `/admin/legal-teams/${id}` : '/admin/legal-teams'
  const missing = editing && teams.data && !team
  // Greške uz polje (prikaz); server proverava isto (legal-team.dto).
  const languageCodes = parseList(form.languages.toLowerCase())
  const languagesError = languageCodes.length > 10 || languageCodes.some((code) => !LANGUAGE.test(code)) ? st('form.team.languagesInvalid') : null
  const badConflicts = parseList(form.conflicts).filter((value) => !UUID.test(value))
  const conflictsError = badConflicts.length > 0 ? st('form.team.conflictsInvalid', { ids: badConflicts.slice(0, 3).join(', ') }) : null
  return (
    <FormPage
      title={title}
      description={editing ? st('form.team.editDescription') : st('form.team.newDescription')}
      crumbs={[
        { label: st('teams.title'), to: '/admin/legal-teams' },
        ...(team ? [{ label: team.name, to: `/admin/legal-teams/${team.id}` }] : []),
        { label: title },
      ]}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={editing ? t('common.save') : t('common.add')}
      disabledReason={incomplete ? st('requiredFields') : null}
      loading={editing && teams.loading && !teams.data}
      loadError={editing && !teams.data ? teams.error : missing ? new ApiError(404, 'NOT_FOUND', st('teams.notFound')) : null}
      onRetry={teams.reload}
      aside={id ? <AuditTrail entityId={id} /> : undefined}
    >
      <FormSection title={st('form.team.basics')} description={st('form.team.basicsHint')}>
        <Field label={t('common.market')} required={!editing} info={st('form.team.marketInfo')} hint={editing ? st('developer.fixedHint') : undefined}>
          {editing ? <input value={market ? t(`market.${market}`) : ''} readOnly /> : <MarketSelect value={market} onChange={setMarket} />}
        </Field>
        <Field label={st('name')} required error={form.name.length > 0 && form.name.trim().length < 2 ? st('minChars', { n: 2 }) : null}>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={200} autoFocus autoComplete="off" />
        </Field>
        <Field label={st('teams.languagesShort')} info={st('form.team.languagesInfo')} hint={st('form.team.languagesHint')} error={languagesError} wide>
          <input className="mono" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} maxLength={60} placeholder="sr, en, ru" />
        </Field>
      </FormSection>
      {editing && (
        <FormSection title={st('form.team.independence')} description={st('form.team.independenceHint')} columns={1}>
          <Field label={`${st('teams.conflicts')} (${st('id')})`} info={st('form.team.conflictsInfo')} hint={st('form.team.conflictsHint')} error={conflictsError}>
            <textarea className="mono" rows={4} value={form.conflicts} onChange={(event) => setForm({ ...form, conflicts: event.target.value })} />
          </Field>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              {st('active')}
              <InfoTip text={st('form.team.activeInfo')} />
            </label>
          </div>
        </FormSection>
      )}
    </FormPage>
  )
}
