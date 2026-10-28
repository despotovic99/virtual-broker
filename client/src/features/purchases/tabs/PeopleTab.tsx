import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { Card, ErrorBox, Field } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi, type AssignmentsInput } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { isManager, isOnlyBuyer, personName, usePurchaseT } from '../shared.tsx'
import type { Person, StaffMember } from '../types.ts'

const KEEP = '__keep__'
const REMOVE = '__remove__'

export function PeopleTab({ purchase, onChange }: TabProps) {
  const tt = usePurchaseT()
  const { can } = useAuth()
  const manager = isManager(purchase)
  const canAssign = manager && can('purchases:assign-lawyer')
  const canManage = manager && can('purchases:manage')

  const rows: { label: string; person: Person | null }[] = [
    { label: tt('people.buyer'), person: purchase.buyer },
    { label: tt('people.coordinator'), person: purchase.coordinator },
    { label: tt('people.lawyer'), person: purchase.lawyer },
    { label: tt('people.engineer'), person: purchase.engineer },
  ]
  if (purchase.moneyModel === 'ESCROW') rows.push({ label: tt('people.escrow'), person: purchase.escrowAgent })

  return (
    <>
      <Card>
        <table>
          <tbody>
            <tr>
              <th>{tt('people.legalTeam')}</th>
              <td>{purchase.legalTeam?.name ?? tt('people.none')}</td>
            </tr>
            {rows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                <td>
                  {row.person ? personName(row.person) : tt('people.none')}
                  {row.person?.email && !isOnlyBuyer(purchase) && <div className="muted">{row.person.email}</div>}
                  {row.person?.email && isOnlyBuyer(purchase) && row.person === purchase.coordinator && (
                    <div className="muted">{row.person.email}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!purchase.legalTeam && purchase.proposedLegalTeam && (
          <p className="muted">{tt('people.proposed', { name: purchase.proposedLegalTeam.name })}</p>
        )}
      </Card>
      {canAssign && <AssignmentsForm {...{ purchase, onChange }} />}
      {canManage && <ManageCard {...{ purchase, onChange }} />}
    </>
  )
}

function StaffSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: StaffMember[]
  value: string
  onChange: (value: string) => void
}) {
  const tt = usePurchaseT()
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={KEEP}>{tt('people.keep')}</option>
        <option value={REMOVE}>{tt('people.remove')}</option>
        {options.map((member) => (
          <option key={member.id} value={member.id}>
            {member.firstName} {member.lastName} ({member.email})
          </option>
        ))}
      </select>
    </Field>
  )
}

function toAssignment(value: string): string | null | undefined {
  if (value === KEEP) return undefined
  if (value === REMOVE) return null
  return value
}

function AssignmentsForm({ purchase, onChange }: Pick<TabProps, 'purchase' | 'onChange'>) {
  const tt = usePurchaseT()
  const market = purchase.market
  const escrow = purchase.moneyModel === 'ESCROW'
  const staff = useAsync(async () => {
    const [coordinators, lawyers, engineers, escrowAgents, teams] = await Promise.all([
      purchasesApi.staff('COORDINATOR', market),
      purchasesApi.staff('LAWYER', market),
      purchasesApi.staff('ENGINEER', market),
      escrow ? purchasesApi.staff('ESCROW_AGENT', market) : Promise.resolve([] as StaffMember[]),
      purchasesApi.availableTeams(market, purchase.developer.id),
    ])
    return { coordinators, lawyers, engineers, escrowAgents, teams }
  }, [market, escrow, purchase.developer.id])

  const [legalTeamId, setLegalTeamId] = useState('')
  const [lawyerId, setLawyerId] = useState(KEEP)
  const [engineerId, setEngineerId] = useState(KEEP)
  const [escrowAgentId, setEscrowAgentId] = useState(KEEP)
  const [coordinatorId, setCoordinatorId] = useState(KEEP)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const save = async (override?: AssignmentsInput) => {
    const body: AssignmentsInput = override ?? {
      ...(legalTeamId.trim() ? { legalTeamId: legalTeamId.trim() } : {}),
      lawyerId: toAssignment(lawyerId),
      engineerId: toAssignment(engineerId),
      coordinatorId: toAssignment(coordinatorId),
      ...(escrow ? { escrowAgentId: toAssignment(escrowAgentId) } : {}),
    }
    for (const key of Object.keys(body) as (keyof AssignmentsInput)[]) if (body[key] === undefined) delete body[key]
    setBusy(true)
    setError(null)
    try {
      onChange(await purchasesApi.assign(purchase.id, body))
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const options = staff.data
  return (
    <Card title={tt('people.assign')}>
      {!purchase.legalTeam && purchase.proposedLegalTeam && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span>{tt('people.proposed', { name: purchase.proposedLegalTeam.name })}</span>
          <button type="button" disabled={busy} onClick={() => void save({ legalTeamId: purchase.proposedLegalTeam?.id })}>
            {tt('people.acceptProposal')}
          </button>
        </div>
      )}
      <ErrorBox error={staff.error} />
      <div className="grid">
        <Field label={tt('people.legalTeam')} hint={tt('people.teamIdHint')}>
          <select value={legalTeamId} onChange={(event) => setLegalTeamId(event.target.value)}>
            <option value="">—</option>
            {(options?.teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.languages.join(', ')})
              </option>
            ))}
          </select>
        </Field>
        <StaffSelect label={tt('people.lawyer')} options={options?.lawyers ?? []} value={lawyerId} onChange={setLawyerId} />
        <StaffSelect label={tt('people.engineer')} options={options?.engineers ?? []} value={engineerId} onChange={setEngineerId} />
        <StaffSelect label={tt('people.coordinator')} options={options?.coordinators ?? []} value={coordinatorId} onChange={setCoordinatorId} />
        {escrow ? (
          <StaffSelect label={tt('people.escrow')} options={options?.escrowAgents ?? []} value={escrowAgentId} onChange={setEscrowAgentId} />
        ) : (
          <p className="muted">{tt('people.escrowNotUsed')}</p>
        )}
      </div>
      <ErrorBox error={error} />
      <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
        {tt('people.saveAssign')}
      </button>
    </Card>
  )
}

function ManageCard({ purchase, onChange }: Pick<TabProps, 'purchase' | 'onChange'>) {
  const tt = usePurchaseT()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<typeof purchase>) => {
    setBusy(true)
    setError(null)
    try {
      onChange(await action())
      setReason('')
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  if (purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED') return null

  return (
    <Card title={tt('people.manage')}>
      {purchase.status === 'ACTIVE' && (
        <div className="row">
          <input
            aria-label={tt('people.blockReason')}
            placeholder={tt('people.blockReason')}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => purchasesApi.block(purchase.id, reason.trim()))}>
            {tt('people.block')}
          </button>
        </div>
      )}
      {purchase.status === 'BLOCKED' && (
        <button type="button" disabled={busy} onClick={() => void run(() => purchasesApi.unblock(purchase.id))}>
          {tt('people.unblock')}
        </button>
      )}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(tt('people.cancelConfirm'))) void run(() => purchasesApi.cancel(purchase.id))
          }}
        >
          {tt('people.cancel')}
        </button>
      </div>
      <ErrorBox error={error} />
    </Card>
  )
}
