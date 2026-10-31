import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Button, Chip, Field, FormSection, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { FormModal } from '../../ui/Modal.tsx'
import { statusSignal } from '../../ui/status.ts'
import type { PaginationState } from '../../ui/usePagination.ts'
import { purchasesApi } from './api.ts'
import { shorten, usePurchaseT } from './shared.tsx'
import type { PurchaseTask, TaskStatus } from './types.ts'

export const TASK_TYPES = ['LEGAL_REVIEW', 'CONTRACT_REVIEW', 'CADASTRE_SEARCH', 'CONTRACT_DEPOSIT', 'SITE_VISIT', 'OTHER'] as const
type TaskType = (typeof TASK_TYPES)[number]
const NEXT_STATUSES: TaskStatus[] = ['IN_PROGRESS', 'WAITING', 'DONE', 'REJECTED']

function isOpen(task: PurchaseTask): boolean {
  return task.status !== 'DONE' && task.status !== 'REJECTED'
}

function isOverdue(task: PurchaseTask): boolean {
  return isOpen(task) && task.dueAt !== null && new Date(task.dueAt).getTime() < Date.now()
}

export interface Assignee {
  id: string
  firstName: string
  lastName: string
}

/**
 * Tabela zadataka sa paginacijom. Status menja izvršilac, vođa pravnog tima ili
 * admin (`canManage`), u modalu; WAITING traži razlog.
 */
export function TasksTable({
  rows,
  loading,
  error,
  onRetry,
  pagination,
  onChanged,
  assigneeName,
  canManage = false,
  showPurchase = false,
  title,
  badge,
  actions,
}: {
  rows: readonly PurchaseTask[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  pagination: PaginationState
  onChanged: () => void
  assigneeName: (task: PurchaseTask) => string
  /** Može da menja i tuđ zadatak (vođa pravnog tima ili admin). */
  canManage?: boolean
  showPurchase?: boolean
  title?: string
  badge?: ReactNode
  actions?: ReactNode
}) {
  const tt = usePurchaseT()
  const { t, formatDate } = useI18n()
  const { user, can } = useAuth()
  const [editing, setEditing] = useState<PurchaseTask | null>(null)

  const typeLabel = (task: PurchaseTask) =>
    (TASK_TYPES as readonly string[]).includes(task.type) ? tt(`taskType.${task.type as TaskType}`) : task.type
  const mayEdit = (task: PurchaseTask) => (task.assigneeUserId === user?.id && can('tasks:work')) || canManage

  const columns: Column<PurchaseTask>[] = [
    {
      key: 'title',
      header: tt('tasks.taskTitle'),
      cell: (task) => (
        <span className="cell-title">
          <strong>{task.title}</strong>
          <span className="meta">{typeLabel(task)}</span>
          {task.status === 'WAITING' && task.waitingReason && (
            <span className="muted">{tt('tasks.waitingFor', { reason: task.waitingReason })}</span>
          )}
          {task.result && (
            <span className="muted" title={task.result}>
              {tt('tasks.resultShort', { result: shorten(task.result, 100) })}
            </span>
          )}
        </span>
      ),
    },
    ...(showPurchase
      ? [
          {
            key: 'purchase',
            header: tt('tasks.purchase'),
            cell: (task: PurchaseTask) => <Link to={`/purchases/${task.purchaseId}?tab=tasks`}>{tt('tasks.open')}</Link>,
          },
        ]
      : []),
    { key: 'assignee', header: tt('tasks.assignee'), hideOnMobile: true, cell: (task) => assigneeName(task) || '—' },
    {
      key: 'due',
      header: tt('tasks.due'),
      cell: (task) =>
        task.dueAt ? (
          <span className="cell-title">
            <span className="mono">{formatDate(task.dueAt)}</span>
            {isOverdue(task) && (
              <Chip tone="risk" icon="clock">
                {tt('tasks.overdue')}
              </Chip>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (task) => <StatusBadge text={tt(`taskStatus.${task.status}`)} {...statusSignal('task', task.status)} />,
    },
  ]

  return (
    <>
      <DataTable
        title={title}
        badge={badge}
        actions={actions}
        caption={title ?? tt('tasks.title')}
        columns={columns}
        rows={rows}
        rowKey={(task) => task.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        pagination={pagination}
        empty={tt('tasks.none')}
        rowClassName={(task) => (isOverdue(task) ? 'row--risk' : task.status === 'WAITING' ? 'row--warn' : undefined)}
        rowActions={(task) =>
          isOpen(task) && mayEdit(task) ? (
            <Button size="sm" variant="quiet" icon="edit" onClick={() => setEditing(task)}>
              {tt('tasks.setStatus')}
            </Button>
          ) : null
        }
      />
      <TaskStatusModal task={editing} onClose={() => setEditing(null)} onChanged={onChanged} />
    </>
  )
}

/** Promena statusa zadatka: status, razlog čekanja (obavezan za WAITING) i rezultat. */
function TaskStatusModal({ task, onClose, onChanged }: { task: PurchaseTask | null; onClose: () => void; onChanged: () => void }) {
  const tt = usePurchaseT()
  const { t } = useI18n()
  const [status, setStatus] = useState<TaskStatus>('IN_PROGRESS')
  const [waitingReason, setWaitingReason] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    if (!task) return
    setStatus(task.status === 'NEW' ? 'IN_PROGRESS' : task.status)
    setWaitingReason(task.waitingReason ?? '')
    setResult('')
  }, [task])

  const waitingMissing = status === 'WAITING' && waitingReason.trim().length < 3

  const submit = async () => {
    if (!task) return
    await purchasesApi.updateTask(task.id, {
      status,
      ...(status === 'WAITING' ? { waitingReason: waitingReason.trim() } : {}),
      ...(result.trim() ? { result: result.trim() } : {}),
    })
    onChanged()
  }

  return (
    <FormModal
      open={task !== null}
      onClose={onClose}
      title={tt('tasks.setStatus')}
      description={task?.title}
      submitLabel={tt('tasks.setStatus')}
      onSubmit={submit}
      disabledReason={waitingMissing ? tt('tasks.waitingRequired') : null}
      dirty={result.length > 0}
    >
      <Field label={t('common.status')} required info={tt('form.task.statusInfo')}>
        <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
          {NEXT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {tt(`taskStatus.${value}`)}
            </option>
          ))}
        </select>
      </Field>
      {status === 'WAITING' && (
        <Field
          label={tt('tasks.waitingReason')}
          required
          info={tt('form.task.waitingInfo')}
          hint={tt('tasks.waitingHint')}
          error={waitingMissing && waitingReason !== '' ? tt('tasks.waitingRequired') : null}
        >
          <input value={waitingReason} maxLength={300} onChange={(event) => setWaitingReason(event.target.value)} />
        </Field>
      )}
      <Field label={tt('tasks.result')} info={tt('form.task.resultInfo')}>
        <textarea value={result} rows={4} maxLength={10_000} onChange={(event) => setResult(event.target.value)} />
      </Field>
    </FormModal>
  )
}

/** Nov zadatak na kupovini (vrsta, izvršilac, rok, opis). */
export function NewTaskModal({
  open,
  onClose,
  purchaseId,
  assignees,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  purchaseId: string
  assignees: Assignee[]
  onCreated: () => void
}) {
  const tt = usePurchaseT()
  const [type, setType] = useState<TaskType>('LEGAL_REVIEW')
  const [title, setTitle] = useState('')
  const [assigneeUserId, setAssignee] = useState('')
  const [dueAt, setDueAt] = useState('')

  useEffect(() => {
    if (!open) return
    setType('LEGAL_REVIEW')
    setTitle('')
    setAssignee('')
    setDueAt('')
  }, [open])

  const ready = Boolean(title.trim() && assigneeUserId)

  const submit = async () => {
    await purchasesApi.createTask(purchaseId, {
      type,
      title: title.trim(),
      assigneeUserId,
      ...(dueAt ? { dueAt: new Date(`${dueAt}T17:00:00`).toISOString() } : {}),
    })
    onCreated()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tt('tasks.new')}
      description={tt('form.task.newDescription')}
      size="lg"
      submitLabel={tt('tasks.create')}
      onSubmit={submit}
      disabledReason={ready ? null : tt('tasks.required')}
      dirty={title.length > 0}
    >
      <FormSection title={tt('form.task.section')} columns={2}>
        <Field label={tt('tasks.type')} required info={tt('form.task.typeInfo')}>
          <select value={type} onChange={(event) => setType(event.target.value as TaskType)}>
            {TASK_TYPES.map((value) => (
              <option key={value} value={value}>
                {tt(`taskType.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tt('tasks.assignee')} required info={tt('form.task.assigneeInfo')}>
          <select value={assigneeUserId} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">—</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tt('tasks.taskTitle')} required hint={tt('form.task.titleHint')} wide>
          <input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={tt('tasks.due')} info={tt('form.task.dueInfo')}>
          <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
      </FormSection>
    </FormModal>
  )
}
