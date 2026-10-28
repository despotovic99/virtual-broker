import { useState } from 'react'
import { useParams } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi } from './api.ts'
import { statusTone } from './PurchasesListPage.tsx'
import { usePurchaseT } from './shared.tsx'
import { ConstructionTab } from './tabs/ConstructionTab.tsx'
import { DocumentsTab } from './tabs/DocumentsTab.tsx'
import { HandoverTab } from './tabs/HandoverTab.tsx'
import { LegalTab } from './tabs/LegalTab.tsx'
import { MessagesTab } from './tabs/MessagesTab.tsx'
import { MoneyTab } from './tabs/MoneyTab.tsx'
import { PeopleTab } from './tabs/PeopleTab.tsx'
import { StepsTab } from './tabs/StepsTab.tsx'
import { TasksTab } from './tabs/TasksTab.tsx'
import type { PurchaseDetail } from './types.ts'

const TABS = ['steps', 'people', 'documents', 'legal', 'money', 'construction', 'handover', 'tasks', 'messages'] as const
type Tab = (typeof TABS)[number]

export interface TabProps {
  purchase: PurchaseDetail
  /** Zamena detalja posle akcije koja vraća nov detalj. */
  onChange: (purchase: PurchaseDetail) => void
  reload: () => void
}

export function PurchaseDetailPage() {
  const { id = '' } = useParams()
  const tt = usePurchaseT()
  const { t, formatMoney, formatNumber } = useI18n()
  const [tab, setTab] = useState<Tab>('steps')
  const [override, setOverride] = useState<PurchaseDetail | null>(null)
  const { data, error, loading, reload } = useAsync(() => {
    setOverride(null)
    return purchasesApi.detail(id)
  }, [id])

  const purchase = override ?? data
  if (loading && !purchase) return <Loading />
  if (!purchase) return <ErrorBox error={error} />

  const props: TabProps = { purchase, onChange: setOverride, reload }
  const { unit } = purchase

  return (
    <Page title={`${purchase.project.name} · ${tt('detail.unit', { label: unit.label })}`}>
      <Card>
        <div className="row">
          <StatusBadge text={tt(`status.${purchase.status}`)} tone={statusTone(purchase.status)} />
          <span>{t(`market.${purchase.market}`)}</span>
          <span className="muted">
            {purchase.project.address}, {purchase.project.city}
          </span>
        </div>
        <p>
          {[
            unit.floor !== null ? tt('detail.floor', { floor: unit.floor }) : null,
            unit.rooms !== null ? tt('detail.rooms', { rooms: formatNumber(unit.rooms, 1) }) : null,
            tt('detail.area', { area: formatNumber(unit.area, 2) }),
            formatMoney(unit.price),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="muted">
          {tt('detail.developer')}: {purchase.developer.name} · {tt('detail.packVersion', { version: purchase.packVersion })}
        </p>
        {purchase.status === 'BLOCKED' && purchase.blockReason && (
          <p role="alert" className="error">
            {tt('detail.blocked', { reason: purchase.blockReason })}
          </p>
        )}
      </Card>

      <ErrorBox error={error} />

      <div className="tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : undefined}
            onClick={() => setTab(name)}
          >
            {tt(`tab.${name}`)}
          </button>
        ))}
      </div>

      {tab === 'steps' && <StepsTab {...props} />}
      {tab === 'people' && <PeopleTab {...props} />}
      {tab === 'documents' && <DocumentsTab {...props} />}
      {tab === 'legal' && <LegalTab {...props} />}
      {tab === 'money' && <MoneyTab {...props} />}
      {tab === 'construction' && <ConstructionTab {...props} />}
      {tab === 'handover' && <HandoverTab {...props} />}
      {tab === 'tasks' && <TasksTab {...props} />}
      {tab === 'messages' && <MessagesTab {...props} />}
    </Page>
  )
}
