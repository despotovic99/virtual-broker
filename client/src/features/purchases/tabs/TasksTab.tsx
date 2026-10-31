import { useState } from 'react'
import { Button } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { usePagedQuery } from '../../../ui/usePagination.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, isAdmin, isManager, personName, usePurchaseT } from '../shared.tsx'
import { NewTaskModal, TasksTable, type Assignee } from '../tasks.tsx'

/** Zadaci kupovine: tabela sa paginacijom, nov zadatak i promena statusa u modalu. */
export function TasksTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const list = usePagedQuery((page) => purchasesApi.tasks(purchase.id, page), [purchase.id])
  const isLawyer = hasRelation(purchase, 'LAWYER')
  const teams = useAsync(() => (isLawyer ? purchasesApi.myLegalTeams() : Promise.resolve([])), [isLawyer])
  const isLead = teams.data?.some((team) => team.id === purchase.legalTeam?.id && team.myRole === 'LEAD') ?? false
  const mayCreate = isManager(purchase) || isLead
  const [creating, setCreating] = useState(false)

  const assignees: Assignee[] = [purchase.lawyer, purchase.engineer].filter((person) => person !== null)
  const people = new Map(
    [purchase.lawyer, purchase.engineer, purchase.coordinator].filter((person) => person !== null).map((person) => [person.id, person]),
  )
  const createReason =
    purchase.status !== 'ACTIVE' ? tt('tasks.notActive') : assignees.length === 0 ? tt('tasks.noAssignee') : undefined
  const total = list.data?.total ?? 0

  return (
    <>
      <TasksTable
        title={tt('tasks.title')}
        badge={total > 0 ? <span className="count">{total}</span> : undefined}
        actions={
          mayCreate && (
            <Button variant="primary" size="sm" icon="plus" disabled={Boolean(createReason)} title={createReason} onClick={() => setCreating(true)}>
              {tt('tasks.new')}
            </Button>
          )
        }
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        onChanged={list.reload}
        assigneeName={(task) => personName(people.get(task.assigneeUserId ?? ''))}
        canManage={isAdmin(purchase) || isLead}
      />
      {mayCreate && (
        <NewTaskModal
          open={creating}
          onClose={() => setCreating(false)}
          purchaseId={purchase.id}
          assignees={assignees}
          onCreated={list.reload}
        />
      )}
    </>
  )
}
