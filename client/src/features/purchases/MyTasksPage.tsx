import { Card, Empty, ErrorBox, Loading, Page } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi } from './api.ts'
import { usePurchaseT } from './shared.tsx'
import { TaskRow } from './tabs/TasksTab.tsx'

/** Moji otvoreni zadaci na svim kupovinama, sortirano po roku (server). */
export function MyTasksPage() {
  const tt = usePurchaseT()
  const tasks = useAsync(() => purchasesApi.myTasks(), [])

  return (
    <Page title={tt('tasks.mineTitle')}>
      <ErrorBox error={tasks.error} />
      {tasks.loading && !tasks.data && <Loading />}
      {tasks.data && tasks.data.length === 0 && <Empty />}
      {tasks.data && tasks.data.length > 0 && (
        <Card>
          {tasks.data.map((task) => (
            <TaskRow key={task.id} task={task} onChanged={tasks.reload} showPurchaseLink />
          ))}
        </Card>
      )}
    </Page>
  )
}
