import { useState, type FormEvent } from 'react'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useMyMarkets, useStaffT } from './shared.tsx'
import type { LegalTeam, LegalTeamRole } from './types.ts'

const TEAM_ROLES: LegalTeamRole[] = ['LEAD', 'LAWYER', 'ASSOCIATE']

function parseList(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))]
}

/** Pravni timovi (F-13, F-31): timovi po tržištu, sukob interesa i članovi sa ulogom i licencom. */
export function LegalTeamsPage() {
  const st = useStaffT()
  const { data, error, loading, reload } = useAsync(() => staffApi.legalTeams(), [])

  return (
    <Page title={st('teams.title')}>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data || data.length === 0 ? <Empty /> : data.map((team) => <TeamCard key={team.id} team={team} onChanged={reload} />)}
      <NewTeamCard onCreated={reload} />
    </Page>
  )
}

function NewTeamCard({ onCreated }: { onCreated: () => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const markets = useMyMarkets()
  const [market, setMarket] = useState<MarketCode | ''>(markets[0] ?? '')
  const [name, setName] = useState('')
  const [languages, setLanguages] = useState('sr, en')
  const [error, setError] = useState<unknown>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!market) return
    setError(null)
    try {
      await staffApi.createLegalTeam({ market, name: name.trim(), languages: parseList(languages.toLowerCase()), conflictDeveloperIds: [] })
      setName('')
      onCreated()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('teams.new')}>
      <form onSubmit={(event) => void submit(event)} className="grid">
        <Field label={t('common.market')}>
          <MarketSelect value={market} onChange={setMarket} />
        </Field>
        <Field label={st('name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
        </Field>
        <Field label={st('teams.languages')}>
          <input value={languages} onChange={(event) => setLanguages(event.target.value)} maxLength={60} />
        </Field>
        <div>
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={!market || name.trim().length < 2}>
            {t('common.add')}
          </button>
        </div>
      </form>
    </Card>
  )
}

function TeamCard({ team, onChanged }: { team: LegalTeam; onChanged: () => void }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [form, setForm] = useState({
    name: team.name,
    languages: team.languages.join(', '),
    conflicts: team.conflictDeveloperIds.join('\n'),
    active: team.active,
  })

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      onChanged()
    } catch (reason) {
      setError(reason)
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await staffApi.updateLegalTeam(team.id, {
        name: form.name.trim(),
        languages: parseList(form.languages.toLowerCase()),
        conflictDeveloperIds: parseList(form.conflicts),
        active: form.active,
      })
      setEditing(false)
    })
  }

  return (
    <Card
      title={`${team.name} · ${t(`market.${team.market}`)}`}
      actions={
        <span className="row">
          <StatusBadge text={team.active ? st('active') : st('inactive')} tone={team.active ? 'good' : 'neutral'} />
          <button type="button" onClick={() => setEditing((value) => !value)}>
            {t('common.edit')}
          </button>
        </span>
      }
    >
      <ErrorBox error={error} />
      <p className="muted">
        {st('teams.languages')}: {team.languages.join(', ') || '—'} · {st('teams.conflicts')}: {team.conflictDeveloperIds.length}
      </p>
      {editing && (
        <form onSubmit={save}>
          <div className="grid">
            <Field label={st('name')}>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={200} required />
            </Field>
            <Field label={st('teams.languages')}>
              <input value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} maxLength={60} />
            </Field>
          </div>
          <Field label={`${st('teams.conflicts')} (${st('id')})`}>
            <textarea value={form.conflicts} onChange={(event) => setForm({ ...form, conflicts: event.target.value })} />
          </Field>
          <label className="row">
            <input type="checkbox" style={{ width: 'auto' }} checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            {st('active')}
          </label>
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
        </form>
      )}
      <h3>{st('teams.members')}</h3>
      {team.members.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{st('teams.lawyer')}</th>
                <th>{st('teams.teamRole')}</th>
                <th>{st('teams.license')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.userId}>
                  <td>
                    {member.firstName} {member.lastName}
                    <div className="muted">{member.email}</div>
                  </td>
                  <td>
                    <select
                      value={member.teamRole}
                      aria-label={st('teams.teamRole')}
                      onChange={(event) =>
                        void run(() =>
                          staffApi.upsertMember(team.id, member.userId, {
                            teamRole: event.target.value as LegalTeamRole,
                            licenseNumber: member.licenseNumber ?? undefined,
                          }),
                        )
                      }
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {st(`teamRole.${role}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {member.licenseNumber ?? '—'}{' '}
                    {member.licenseVerifiedAt ? (
                      <StatusBadge text={`${st('teams.licenseVerified')} · ${formatDate(member.licenseVerifiedAt)}`} tone="good" />
                    ) : (
                      <>
                        <StatusBadge text={st('teams.licenseNotVerified')} tone="warn" />{' '}
                        <button
                          type="button"
                          onClick={() =>
                            void run(() =>
                              staffApi.upsertMember(team.id, member.userId, {
                                teamRole: member.teamRole,
                                licenseNumber: member.licenseNumber ?? undefined,
                                licenseVerified: true,
                              }),
                            )
                          }
                        >
                          {st('teams.verifyLicense')}
                        </button>
                      </>
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => void run(() => staffApi.removeMember(team.id, member.userId))}>
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddMemberForm team={team} onAdded={onChanged} />
    </Card>
  )
}

/** Dodavanje člana: advokat (aktivan, uloga LAWYER) na tržištu tima. */
function AddMemberForm({ team, onAdded }: { team: LegalTeam; onAdded: () => void }) {
  const st = useStaffT()
  const lawyers = useAsync(() => staffApi.users({ role: 'LAWYER', market: team.market, limit: 100 }), [team.market])
  const [userId, setUserId] = useState('')
  const [teamRole, setTeamRole] = useState<LegalTeamRole>('LAWYER')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [error, setError] = useState<unknown>(null)
  const memberIds = new Set(team.members.map((member) => member.userId))
  const candidates = (lawyers.data?.items ?? []).filter((user) => user.isActive && !memberIds.has(user.id))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await staffApi.upsertMember(team.id, userId, { teamRole, licenseNumber: licenseNumber.trim() || undefined })
      setUserId('')
      setLicenseNumber('')
      onAdded()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid">
      <Field label={st('teams.addMember')}>
        <select value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">—</option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName} · {user.email}
            </option>
          ))}
        </select>
      </Field>
      <Field label={st('teams.teamRole')}>
        <select value={teamRole} onChange={(event) => setTeamRole(event.target.value as LegalTeamRole)}>
          {TEAM_ROLES.map((role) => (
            <option key={role} value={role}>
              {st(`teamRole.${role}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={st('teams.license')}>
        <input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={64} />
      </Field>
      <div>
        <ErrorBox error={error ?? lawyers.error} />
        <button type="submit" className="primary" disabled={!userId}>
          {st('teams.addMember')}
        </button>
      </div>
    </form>
  )
}
