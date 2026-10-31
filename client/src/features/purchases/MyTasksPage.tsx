import { useAuth } from '../../core/auth/AuthContext.tsx'
import { Page } from '../../ui/components.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { purchasesApi } from './api.ts'
import { usePurchaseT } from './shared.tsx'
import { TasksTable } from './tasks.tsx'

/** Moji otvoreni zadaci na svim kupovinama, sortirano po roku (server), sa paginacijom. */
export function MyTasksPage() {
  const tt = usePurchaseT()
  const { user } = useAuth()
  const list = usePagedQuery((page) => purchasesApi.myTasks(page), [])
  const myName = user ? `${user.firstName} ${user.lastName}` : ''

  return (
    <Page title={tt('tasks.mineTitle')}>
      <TasksTable
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        onChanged={list.reload}
        assigneeName={(task) => (task.assigneeUserId && task.assigneeUserId === user?.id ? myName : '')}
        showPurchase
      />
    </Page>
  )
}
