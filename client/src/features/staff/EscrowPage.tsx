import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Button, Chip, DummyTag, InfoTip, Notice, Page, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { ConfirmDialog, Modal } from '../../ui/Modal.tsx'
import { statusSignal } from '../../ui/status.ts'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { useStaffT } from './shared.tsx'
import type { EscrowInstruction } from './types.ts'

type Dialog = { kind: 'approve' | 'execute' | 'return' | 'details'; instruction: EscrowInstruction } | null

function approvalsOf(instruction: EscrowInstruction): number {
  return [instruction.firstApproverId, instruction.secondApproverId].filter(Boolean).length
}

/**
 * Escrow instrukcije (F-15, samo tržišta sa escrow modelom). Admin odobrava
 * (dve različite osobe), escrow partner potvrđuje isplatu ili je vraća uz razlog.
 * Sama isplata je van platforme (DUMMY: bankarska integracija nije urađena).
 */
export function EscrowPage() {
  const st = useStaffT()
  const { t, formatMoney, formatDate } = useI18n()
  const { user, can } = useAuth()
  const list = usePagedQuery((page) => staffApi.escrowInstructions(page), [])
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const approvedByMe = (instruction: EscrowInstruction) =>
    instruction.firstApproverId === user?.id || instruction.secondApproverId === user?.id
  const waitingSecond = (instruction: EscrowInstruction) => instruction.status === 'PENDING_APPROVAL' && approvalsOf(instruction) === 1

  const columns: Column<EscrowInstruction>[] = [
    { key: 'amount', header: st('escrow.amount'), align: 'end', cell: (instruction) => <strong>{formatMoney(instruction.amount)}</strong> },
    {
      key: 'recipient',
      header: st('escrow.recipient'),
      cell: (instruction) => (
        <span className="cell-title">
          <strong>{instruction.recipient?.holderName ?? '—'}</strong>
          {instruction.recipient && <span className="meta">{instruction.recipient.iban}</span>}
        </span>
      ),
    },
    {
      key: 'purchase',
      header: st('escrow.purchase'),
      mono: true,
      hideOnMobile: true,
      cell: (instruction) => <Link to={`/purchases/${instruction.purchaseId}`}>{instruction.purchaseId.slice(0, 8)}</Link>,
    },
    {
      key: 'approvals',
      header: st('escrow.approvals'),
      cell: (instruction) => {
        const count = approvalsOf(instruction)
        return (
          <Chip tone={count === 2 ? 'ok' : count === 1 ? 'warn' : 'idle'} icon={count === 2 ? 'check' : 'clock'} size="sm">
            {count}/2
          </Chip>
        )
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (instruction) => (
        <StatusBadge
          text={waitingSecond(instruction) ? st('escrow.waitingSecond') : st(`escStatus.${instruction.status}`)}
          {...statusSignal('escrow', instruction.status)}
        />
      ),
    },
    { key: 'date', header: t('common.date'), mono: true, hideOnMobile: true, cell: (instruction) => formatDate(instruction.createdAt) },
  ]

  return (
    <Page title={st('escrow.title')}>
      <Notice tone="test" title={<DummyTag />}>
        {st('escrow.dummyNote')}
      </Notice>
      <DataTable
        caption={st('escrow.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(instruction) => instruction.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={st('escrow.none')}
        rowClassName={(instruction) => (instruction.status === 'RETURNED' ? 'row--risk' : undefined)}
        rowActions={(instruction) => (
          <span className="row-actions">
            <Button size="sm" variant="quiet" icon="eye" onClick={() => setDialog({ kind: 'details', instruction })}>
              {t('common.details')}
            </Button>
            {instruction.status === 'PENDING_APPROVAL' && can('escrow-instructions:approve') && (
              <Button
                size="sm"
                variant="primary"
                disabled={approvedByMe(instruction)}
                title={approvedByMe(instruction) ? st('escrow.sameSigner') : undefined}
                onClick={() => setDialog({ kind: 'approve', instruction })}
              >
                {st('escrow.approve')}
              </Button>
            )}
            {instruction.status === 'APPROVED' && can('escrow:execute') && (
              <>
                <Button size="sm" variant="primary" icon="forward" onClick={() => setDialog({ kind: 'execute', instruction })}>
                  {st('escrow.execute')}
                </Button>
                <Button size="sm" variant="danger" icon="back" onClick={() => setDialog({ kind: 'return', instruction })}>
                  {st('escrow.return')}
                </Button>
              </>
            )}
          </span>
        )}
      />

      <ConfirmDialog
        open={dialog?.kind === 'approve'}
        onClose={close}
        title={st('escrow.approve')}
        text={
          dialog ? (
            <>
              {st('escrow.approveConfirm', { amount: formatMoney(dialog.instruction.amount) })}{' '}
              <InfoTip text={st('form.escrow.approveInfo')} />
            </>
          ) : undefined
        }
        confirmLabel={st('escrow.approve')}
        onConfirm={async () => {
          if (!dialog) return
          await staffApi.approveInstruction(dialog.instruction.id)
          list.reload()
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'execute'}
        onClose={close}
        title={st('escrow.execute')}
        text={dialog ? st('escrow.executeConfirm', { amount: formatMoney(dialog.instruction.amount) }) : undefined}
        confirmLabel={st('escrow.execute')}
        onConfirm={async () => {
          if (!dialog) return
          await staffApi.executeInstruction(dialog.instruction.id)
          list.reload()
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'return'}
        onClose={close}
        title={st('escrow.return')}
        danger
        text={
          dialog ? (
            <>
              {st('escrow.returnConfirm', { amount: formatMoney(dialog.instruction.amount) })} {st('form.escrow.returnInfo')}
            </>
          ) : undefined
        }
        confirmLabel={st('escrow.return')}
        reason={{ label: st('reason'), minLength: 3, hint: st('form.escrow.returnHint') }}
        onConfirm={async (reason) => {
          if (!dialog) return
          await staffApi.returnInstruction(dialog.instruction.id, reason)
          list.reload()
        }}
      />
      <InstructionDetails instruction={dialog?.kind === 'details' ? dialog.instruction : null} onClose={close} />
    </Page>
  )
}

/** Detalji naloga: primalac, potpisi (četiri oka) i razlog vraćanja. */
function InstructionDetails({ instruction, onClose }: { instruction: EscrowInstruction | null; onClose: () => void }) {
  const st = useStaffT()
  const { t, formatMoney, formatDate } = useI18n()
  const { user } = useAuth()
  const signer = (id: string | null): ReactNode => (id === user?.id ? st('you') : id ? <span className="mono">{id.slice(0, 8)}</span> : null)

  return (
    <Modal
      open={instruction !== null}
      onClose={onClose}
      title={st('escrow.order')}
      description={
        instruction ? (
          <>
            {formatMoney(instruction.amount)} <InfoTip text={st('form.escrow.approveInfo')} />
          </>
        ) : undefined
      }
    >
      {instruction && (
        <div className="stack">
          <dl className="dl">
            <dt>{t('common.status')}</dt>
            <dd>
              <StatusBadge text={st(`escStatus.${instruction.status}`)} {...statusSignal('escrow', instruction.status)} />
            </dd>
            <dt>{st('escrow.purchase')}</dt>
            <dd>
              <Link to={`/purchases/${instruction.purchaseId}`}>{instruction.purchaseId.slice(0, 8)}</Link>
            </dd>
            {instruction.recipient && (
              <>
                <dt>{st('escrow.recipient')}</dt>
                <dd>
                  {instruction.recipient.holderName}
                  <div className="muted">{instruction.recipient.bankName}</div>
                </dd>
                <dt>{st('account.iban')}</dt>
                <dd className="staff-iban">{instruction.recipient.iban}</dd>
              </>
            )}
            <dt>{t('common.date')}</dt>
            <dd className="mono">{formatDate(instruction.createdAt)}</dd>
            {instruction.executedAt && (
              <>
                <dt>{st('escStatus.EXECUTED')}</dt>
                <dd className="mono">{formatDate(instruction.executedAt)}</dd>
              </>
            )}
          </dl>
          <div className="signatures" aria-label={`${st('escrow.approvals')}: ${approvalsOf(instruction)}/2`}>
            <Signature label={st('escrow.firstSignature')} who={signer(instruction.firstApproverId)} done={Boolean(instruction.firstApproverId)} />
            <Signature label={st('escrow.secondSignature')} who={signer(instruction.secondApproverId)} done={Boolean(instruction.secondApproverId)} />
          </div>
          {instruction.returnReason && (
            <Notice tone="risk" icon="back" title={st('escStatus.RETURNED')}>
              {st('reason')}: {instruction.returnReason}
            </Notice>
          )}
        </div>
      )}
    </Modal>
  )
}

function Signature({ label, who, done }: { label: string; who: ReactNode; done: boolean }) {
  const st = useStaffT()
  return (
    <span className={done ? 'signature signature--done' : 'signature signature--waiting'}>
      <Icon name={done ? 'check' : 'planned'} size={14} />
      <span className="grow">
        {label} · {done ? who : st('escrow.waiting')}
      </span>
    </span>
  )
}
