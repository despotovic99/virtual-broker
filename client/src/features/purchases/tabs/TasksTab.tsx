import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, StatusBadge } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, isManager, personName, usePurchaseT } from '../shared.tsx'
import type { PurchaseTask, TaskStatus } from '../types.ts'

const TASK_TYPES = ['LEGAL_REVIEW', 'CONTRACT_REVIEW', 'CADASTRE_SEARCH', 'CONTRACT_DEPOSIT', 'SITE_VISIT', 'OTHER'] as const
type TaskType = (typeof TASK_TYPES)[number]
const NEXT_STATUSES: TaskStatus[] = ['IN_PROGRESS', 'WAITING', 'DONE', 'REJECTED']

export function taskTone(status: TaskStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'DONE') return 'good'
  if (status === 'WAITING') return 'warn'
  if (status === 'REJECTED') return 'bad'
  return 'neutral'
}

export function TasksTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const tasks = useAsync(() => purchasesApi.tasks(purchase.id), [purchase.id])
  const isLawyer = hasRelation(purchase, 'LAWYER')
  const teams = useAsync(() => (isLawyer ? purchasesApi.myLegalTeams() : Promise.resolve([])), [isLawyer])
  const isLead = teams.data?.some((team) => team.id === purchase.legalTeam?.id && team.myRole === 'LEAD') ?? false
  const canCreate = (isManager(purchase) || isLead) && purchase.status === 'ACTIVE'

  const people = new Map(
    [purchase.lawyer, purchase.engineer, purchase.coordinator].filter((person) => person !== null).map((person) => [person.id, person]),
  )

  return (
    <>
      {canCreate && <NewTaskForm purchaseId={purchase.id} assignees={[purchase.lawyer, purchase.engineer]} onCreated={tasks.reload} />}
      <Card title={tt('tasks.title')}>
        <ErrorBox error={tasks.error} />
        {tasks.loading && !tasks.data && <Loading />}
        {tasks.data && tasks.data.length === 0 && <Empty />}
        {tasks.data?.map((task) => (
          <TaskRow key={task.id} task={task} assigneeName={personName(people.get(task.assigneeUserId ?? ''))} onChanged={tasks.reload} />
        ))}
      </Card>
    </>
  )
}

function NewTaskForm({
  purchaseId,
  assignees,
  onCreated,
}: {
  purchaseId: string
  assignees: ({ id: string; firstName: string; lastName: string } | null)[]
  onCreated: () => void
}) {
  const tt = usePurchaseT()
  const options = assignees.filter((person) => person !== null)
  const [type, setType] = useState<TaskType>('LEGAL_REVIEW')
  const [title, setTitle] = useState('')
  const [assigneeUserId, setAssignee] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.createTask(purchaseId, {
        type,
        title: title.trim(),
        assigneeUserId,
        ...(dueAt ? { dueAt: new Date(`${dueAt}T17:00:00`).toISOString() } : {}),
      })
      setTitle('')
      setDueAt('')
      onCreated()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tt('tasks.new')}>
      {options.length === 0 ? (
        <p className="muted">{tt('tasks.noAssignee')}</p>
      ) : (
        <>
          <div className="grid">
            <Field label={tt('tasks.type')}>
              <select value={type} onChange={(event) => setType(event.target.value as TaskType)}>
                {TASK_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {tt(`taskType.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tt('tasks.assignee')}>
              <select value={assigneeUserId} onChange={(event) => setAssignee(event.target.value)}>
                <option value="" />
                {options.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tt('tasks.due')}>
              <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </Field>
          </div>
          <Field label={tt('tasks.taskTitle')}>
            <input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <button type="button" className="primary" disabled={!title.trim() || !assigneeUserId || busy} onClick={() => void submit()}>
            {tt('tasks.create')}
          </button>
        </>
      )}
      <ErrorBox error={error} />
    </Card>
  )
}

/** Jedan zadatak; izvršilac menja status (WAITING traži razlog). */
export function TaskRow({
  task,
  assigneeName,
  onChanged,
  showPurchaseLink,
}: {
  task: PurchaseTask
  assigneeName?: string
  onChanged: () => void
  showPurchaseLink?: boolean
}) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const { user, can } = useAuth()
  const [status, setStatus] = useState<TaskStatus>('IN_PROGRESS')
  const [waitingReason, setWaitingReason] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const isAssignee = task.assigneeUserId === user?.id && can('tasks:work')
  const open = task.status !== 'DONE' && task.status !== 'REJECTED'
  const overdue = open && task.dueAt !== null && new Date(task.dueAt).getTime() < Date.now()
  const knownType = (TASK_TYPES as readonly string[]).includes(task.type)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.updateTask(task.id, {
        status,
        ...(status === 'WAITING' ? { waitingReason: waitingReason.trim() } : {}),
        ...(result.trim() ? { result: result.trim() } : {}),
      })
      setWaitingReason('')
      setResult('')
      onChanged()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <div className="row">
        <strong>{task.title}</strong>
        <StatusBadge text={tt(`taskStatus.${task.status}`)} tone={taskTone(task.status)} />
        {overdue && <StatusBadge text={tt('tasks.overdue')} tone="bad" />}
      </div>
      <div className="muted">
        {knownType ? tt(`taskType.${task.type as TaskType}`) : task.type}
        {assigneeName ? ` · ${assigneeName}` : ''}
        {task.dueAt ? ` · ${tt('tasks.due')}: ${formatDate(task.dueAt)}` : ''}
      </div>
      {task.waitingReason && task.status === 'WAITING' && <p className="muted">{task.waitingReason}</p>}
      {task.result && <p style={{ whiteSpace: 'pre-wrap' }}>{task.result}</p>}
      {showPurchaseLink && <Link to={`/purchases/${task.purchaseId}`}>{tt('tasks.open')}</Link>}
      {isAssignee && open && (
        <div style={{ marginTop: 6 }}>
          <div className="row">
            <select aria-label={tt('tasks.setStatus')} value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} style={{ maxWidth: 200 }}>
              {NEXT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {tt(`taskStatus.${value}`)}
                </option>
              ))}
            </select>
            {status === 'WAITING' && (
              <input
                aria-label={tt('tasks.waitingReason')}
                placeholder={tt('tasks.waitingReason')}
                value={waitingReason}
                maxLength={300}
                onChange={(event) => setWaitingReason(event.target.value)}
                style={{ maxWidth: 320 }}
              />
            )}
          </div>
          <textarea
            aria-label={tt('tasks.result')}
            placeholder={tt('tasks.result')}
            value={result}
            maxLength={10_000}
            onChange={(event) => setResult(event.target.value)}
            style={{ marginTop: 6, minHeight: 60 }}
          />
          <button
            type="button"
            disabled={busy || (status === 'WAITING' && waitingReason.trim().length < 3)}
            onClick={() => void submit()}
          >
            {tt('tasks.setStatus')}
          </button>
        </div>
      )}
      <ErrorBox error={error} />
    </div>
  )
}
