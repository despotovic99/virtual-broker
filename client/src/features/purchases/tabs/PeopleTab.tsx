import { Fragment, useEffect, useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { Button, Card, ErrorBox, Field, FormSection, InfoTip, Notice, Tag } from '../../../ui/components.tsx'
import { ConfirmDialog, FormModal } from '../../../ui/Modal.tsx'
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

  const showEmail = (person: Person) => Boolean(person.email) && (!isOnlyBuyer(purchase) || person === purchase.coordinator)
  const [assigning, setAssigning] = useState(false)

  return (
    <>
      <Card
        label={tt('people.participants')}
        actions={
          canAssign && (
            <Button size="sm" icon="edit" onClick={() => setAssigning(true)}>
              {tt('people.editAssign')}
            </Button>
          )
        }
      >
        <dl className="dl">
          <dt>{tt('people.legalTeam')}</dt>
          <dd>
            {purchase.legalTeam ? (
              purchase.legalTeam.name
            ) : purchase.proposedLegalTeam ? (
              <span className="row">
                {purchase.proposedLegalTeam.name}
                <Tag tone="info">{tt('people.proposedTag')}</Tag>
              </span>
            ) : (
              <span className="muted">{tt('people.none')}</span>
            )}
          </dd>
          {rows.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.person ? personName(row.person) : <span className="muted">{tt('people.none')}</span>}
                {row.person && showEmail(row.person) && <div className="meta">{row.person.email}</div>}
              </dd>
            </Fragment>
          ))}
        </dl>
      </Card>
      {canAssign && <AssignmentsModal purchase={purchase} onChange={onChange} open={assigning} onClose={() => setAssigning(false)} />}
      {canManage && <ManageCard {...{ purchase, onChange }} />}
    </>
  )
}

function StaffSelect({
  label,
  info,
  options,
  value,
  onChange,
}: {
  label: string
  info?: string
  options: StaffMember[]
  value: string
  onChange: (value: string) => void
}) {
  const tt = usePurchaseT()
  return (
    <Field label={label} info={info}>
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

/** Dodele na kupovini (pravni tim, advokat, inženjer, koordinator, escrow) u modalu. */
function AssignmentsModal({
  purchase,
  onChange,
  open,
  onClose,
}: Pick<TabProps, 'purchase' | 'onChange'> & { open: boolean; onClose: () => void }) {
  const tt = usePurchaseT()
  const market = purchase.market
  const escrow = purchase.moneyModel === 'ESCROW'
  // Spiskovi se učitavaju tek kada se modal otvori.
  const staff = useAsync(async () => {
    if (!open) return null
    const [coordinators, lawyers, engineers, escrowAgents, teams] = await Promise.all([
      purchasesApi.staff('COORDINATOR', market),
      purchasesApi.staff('LAWYER', market),
      purchasesApi.staff('ENGINEER', market),
      escrow ? purchasesApi.staff('ESCROW_AGENT', market) : Promise.resolve([] as StaffMember[]),
      purchasesApi.availableTeams(market, purchase.developer.id),
    ])
    return { coordinators, lawyers, engineers, escrowAgents, teams }
  }, [open, market, escrow, purchase.developer.id])

  const [legalTeamId, setLegalTeamId] = useState('')
  const [lawyerId, setLawyerId] = useState(KEEP)
  const [engineerId, setEngineerId] = useState(KEEP)
  const [escrowAgentId, setEscrowAgentId] = useState(KEEP)
  const [coordinatorId, setCoordinatorId] = useState(KEEP)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<unknown>(null)

  useEffect(() => {
    if (!open) return
    setLegalTeamId('')
    setLawyerId(KEEP)
    setEngineerId(KEEP)
    setEscrowAgentId(KEEP)
    setCoordinatorId(KEEP)
    setAcceptError(null)
  }, [open])

  const dirty =
    legalTeamId !== '' || lawyerId !== KEEP || engineerId !== KEEP || coordinatorId !== KEEP || (escrow && escrowAgentId !== KEEP)

  const save = async () => {
    const body: AssignmentsInput = {
      ...(legalTeamId.trim() ? { legalTeamId: legalTeamId.trim() } : {}),
      lawyerId: toAssignment(lawyerId),
      engineerId: toAssignment(engineerId),
      coordinatorId: toAssignment(coordinatorId),
      ...(escrow ? { escrowAgentId: toAssignment(escrowAgentId) } : {}),
    }
    for (const key of Object.keys(body) as (keyof AssignmentsInput)[]) if (body[key] === undefined) delete body[key]
    onChange(await purchasesApi.assign(purchase.id, body))
  }

  // Prihvatanje predloga sistema je posebna radnja: snima odmah i zatvara modal.
  const acceptProposal = async () => {
    if (!purchase.proposedLegalTeam) return
    setAccepting(true)
    setAcceptError(null)
    try {
      onChange(await purchasesApi.assign(purchase.id, { legalTeamId: purchase.proposedLegalTeam.id }))
      onClose()
    } catch (reason) {
      setAcceptError(reason)
    } finally {
      setAccepting(false)
    }
  }

  const options = staff.data
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tt('people.assign')}
      description={tt('form.assign.description')}
      submitLabel={tt('people.saveAssign')}
      onSubmit={save}
      disabledReason={dirty ? null : tt('people.noChanges')}
      dirty={dirty}
      size="lg"
    >
      <ErrorBox error={staff.error} onRetry={staff.reload} />
      <FormSection title={tt('form.assign.legalTitle')} description={tt('form.assign.legalHint')} columns={2}>
        {!purchase.legalTeam && purchase.proposedLegalTeam && (
          <Notice
            tone="info"
            title={
              <span className="row">
                {purchase.proposedLegalTeam.name}
                <Tag tone="info">{tt('people.proposedTag')}</Tag>
                <InfoTip text={tt('form.assign.proposalInfo')} />
              </span>
            }
            actions={
              <Button busy={accepting} onClick={() => void acceptProposal()}>
                {tt('people.acceptProposal')}
              </Button>
            }
          >
            {tt('people.proposalHint')}
            <ErrorBox error={acceptError} />
          </Notice>
        )}
        <Field label={tt('people.legalTeam')} info={tt('form.assign.teamInfo')} hint={tt('people.teamIdHint')}>
          <select value={legalTeamId} onChange={(event) => setLegalTeamId(event.target.value)}>
            <option value="">{tt('people.keep')}</option>
            {(options?.teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.languages.join(', ')})
              </option>
            ))}
          </select>
        </Field>
        <StaffSelect
          label={tt('people.lawyer')}
          info={tt('form.assign.lawyerInfo')}
          options={options?.lawyers ?? []}
          value={lawyerId}
          onChange={setLawyerId}
        />
      </FormSection>
      <FormSection title={tt('form.assign.staffTitle')} description={tt('form.assign.staffHint')} columns={2}>
        <StaffSelect
          label={tt('people.coordinator')}
          info={tt('form.assign.coordinatorInfo')}
          options={options?.coordinators ?? []}
          value={coordinatorId}
          onChange={setCoordinatorId}
        />
        <StaffSelect
          label={tt('people.engineer')}
          info={tt('form.assign.engineerInfo')}
          options={options?.engineers ?? []}
          value={engineerId}
          onChange={setEngineerId}
        />
        {escrow ? (
          <StaffSelect
            label={tt('people.escrow')}
            info={tt('form.assign.escrowInfo')}
            options={options?.escrowAgents ?? []}
            value={escrowAgentId}
            onChange={setEscrowAgentId}
          />
        ) : (
          <Notice tone="plain">{tt('people.escrowNotUsed')}</Notice>
        )}
      </FormSection>
    </FormModal>
  )
}

type ManageAction = 'block' | 'unblock' | 'cancel'

/**
 * Blokada (obavezan razlog), skidanje blokade i otkazivanje, svaka uz potvrdu.
 * Zatvorena kupovina: radnje ostaju na mestu, onesposobljene uz razlog.
 */
function ManageCard({ purchase, onChange }: Pick<TabProps, 'purchase' | 'onChange'>) {
  const tt = usePurchaseT()
  const [action, setAction] = useState<ManageAction | null>(null)

  const closed = purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED'
  const closedReason = closed ? tt('people.closed') : undefined

  return (
    <Card title={tt('people.manage')}>
      <div className="stack">
        {closed && <Notice tone="plain">{tt('people.closed')}</Notice>}
        <div className="row">
          {(purchase.status === 'ACTIVE' || closed) && (
            <Button variant="danger" icon="lock" disabled={closed} title={closedReason} onClick={() => setAction('block')}>
              {tt('people.block')}
            </Button>
          )}
          {purchase.status === 'BLOCKED' && (
            <Button onClick={() => setAction('unblock')}>{tt('people.unblock')}</Button>
          )}
          <Button variant="danger" icon="cancel" disabled={closed} title={closedReason} onClick={() => setAction('cancel')}>
            {tt('people.cancel')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={action === 'block'}
        onClose={() => setAction(null)}
        title={tt('people.blockTitle')}
        text={tt('form.people.blockText')}
        confirmLabel={tt('people.block')}
        danger
        reason={{ label: tt('people.blockReason'), minLength: 3, hint: tt('form.people.blockReasonHint') }}
        onConfirm={async (reason) => onChange(await purchasesApi.block(purchase.id, reason))}
      />
      <ConfirmDialog
        open={action === 'unblock'}
        onClose={() => setAction(null)}
        title={tt('people.unblockTitle')}
        text={
          <>
            {purchase.blockReason && (
              <>
                {tt('people.unblockText', { reason: purchase.blockReason })}
                <br />
              </>
            )}
            {tt('form.people.unblockText')}
          </>
        }
        confirmLabel={tt('people.unblock')}
        onConfirm={async () => onChange(await purchasesApi.unblock(purchase.id))}
      />
      <ConfirmDialog
        open={action === 'cancel'}
        onClose={() => setAction(null)}
        title={tt('people.cancelTitle')}
        text={tt('form.people.cancelText')}
        confirmLabel={tt('people.cancel')}
        danger
        onConfirm={async () => onChange(await purchasesApi.cancel(purchase.id))}
      />
    </Card>
  )
}
