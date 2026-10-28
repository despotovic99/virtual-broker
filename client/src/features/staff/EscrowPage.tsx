import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, DummyTag, Empty, ErrorBox, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { TextAction, useStaffT } from './shared.tsx'
import type { EscrowInstruction, EscrowStatus } from './types.ts'

function escrowTone(status: EscrowStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'EXECUTED') return 'good'
  if (status === 'RETURNED') return 'bad'
  if (status === 'PENDING_APPROVAL') return 'warn'
  return 'neutral'
}

/**
 * Escrow instrukcije (F-15, samo tržišta sa escrow modelom). Admin odobrava
 * (dve različite osobe), escrow partner potvrđuje isplatu ili je vraća.
 * Sama isplata je van platforme (DUMMY: bankarska integracija nije urađena).
 */
export function EscrowPage() {
  const st = useStaffT()
  const { data, error, loading, reload } = useAsync(() => staffApi.escrowInstructions(), [])

  return (
    <Page title={st('escrow.title')}>
      <Card>
        <p className="row">
          <DummyTag /> {st('escrow.dummyNote')}
        </p>
      </Card>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data || data.length === 0 ? <Empty /> : data.map((item) => <InstructionCard key={item.id} instruction={item} onChanged={reload} />)}
    </Page>
  )
}

function InstructionCard({ instruction, onChanged }: { instruction: EscrowInstruction; onChanged: () => void }) {
  const st = useStaffT()
  const { t, formatMoney, formatDate } = useI18n()
  const { user, can } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [returning, setReturning] = useState(false)
  const approvals = [instruction.firstApproverId, instruction.secondApproverId].filter(Boolean).length
  const alreadyApprovedByMe = instruction.firstApproverId === user?.id || instruction.secondApproverId === user?.id

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      onChanged()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card
      title={`${st('escrow.amount')}: ${formatMoney(instruction.amount)}`}
      actions={<StatusBadge text={st(`escStatus.${instruction.status}`)} tone={escrowTone(instruction.status)} />}
    >
      <p>
        {st('escrow.purchase')}: <Link to={`/purchases/${instruction.purchaseId}`}>{instruction.purchaseId.slice(0, 8)}</Link> ·{' '}
        {t('common.date')}: {formatDate(instruction.createdAt)}
      </p>
      {instruction.recipient && (
        <p>
          {st('escrow.recipient')}: {instruction.recipient.holderName} · {instruction.recipient.bankName} · {instruction.recipient.iban}
        </p>
      )}
      <p className="muted">
        {st('escrow.approvals')}: {approvals}/2
        {instruction.executedAt && ` · ${formatDate(instruction.executedAt)}`}
      </p>
      {instruction.returnReason && (
        <p>
          {st('reason')}: {instruction.returnReason}
        </p>
      )}
      <ErrorBox error={error} />
      <div className="row">
        {instruction.status === 'PENDING_APPROVAL' && can('escrow-instructions:approve') && (
          alreadyApprovedByMe ? (
            <span className="muted">{st('escrow.alreadyApproved')}</span>
          ) : (
            <button type="button" className="primary" onClick={() => void run(() => staffApi.approveInstruction(instruction.id))}>
              {st('escrow.approve')}
            </button>
          )
        )}
        {instruction.status === 'APPROVED' && can('escrow:execute') && (
          <>
            <button type="button" className="primary" onClick={() => void run(() => staffApi.executeInstruction(instruction.id))}>
              {st('escrow.execute')}
            </button>
            <button type="button" onClick={() => setReturning((value) => !value)}>
              {st('escrow.return')}
            </button>
          </>
        )}
      </div>
      {returning && (
        <TextAction
          label={st('reason')}
          button={st('escrow.return')}
          minLength={3}
          maxLength={500}
          onSubmit={async (reason) => {
            await staffApi.returnInstruction(instruction.id, reason)
            setReturning(false)
            onChanged()
          }}
        />
      )}
    </Card>
  )
}
