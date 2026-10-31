import { useState } from 'react'
import { useParams } from 'react-router'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, ErrorState, HardBlock, Loading, Notice, Page, Refreshing, StatusBadge, Tag } from '../../ui/components.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { statusSignal } from '../../ui/status.ts'
import { Tabs, useUrlTab } from '../../ui/Tabs.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi } from './api.ts'
import { workspaceDictionary } from './i18n-workspace.ts'
import { personName, usePurchaseT } from './shared.tsx'
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

export function useWorkspaceT() {
  return useLocalT(workspaceDictionary)
}

export function PurchaseDetailPage() {
  const { id = '' } = useParams()
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { t, formatMoney, formatNumber } = useI18n()
  const [tab, setTab] = useUrlTab<Tab>(TABS, 'steps')
  const [override, setOverride] = useState<PurchaseDetail | null>(null)
  const { data, error, loading, reload } = useAsync(() => {
    setOverride(null)
    return purchasesApi.detail(id)
  }, [id])

  const purchase = override ?? data
  if (loading && !purchase) return <Loading rows={4} />
  if (!purchase) return <ErrorState error={error} onRetry={reload} backTo={{ to: '/purchases', label: wt('detail.crumbs') }} />

  const props: TabProps = { purchase, onChange: setOverride, reload }
  const { unit } = purchase
  const signal = statusSignal('purchase', purchase.status)
  const unitFacts = [
    purchase.project.city,
    `${formatNumber(unit.area, 2)} m²`,
    unit.floor !== null ? tt('detail.floor', { floor: unit.floor }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Page
      crumbs={[{ label: wt('detail.crumbs'), to: '/purchases' }, { label: purchase.project.name }, { label: tt('detail.unit', { label: unit.label }) }]}
      title={`${purchase.project.name} · ${tt('detail.unit', { label: unit.label })}`}
      meta={
        <>
          <StatusBadge text={tt(`status.${purchase.status}`)} {...signal} />
          <Tag tone="info">{wt('detail.pack', { market: purchase.market, version: purchase.packVersion })}</Tag>
          <Tag>{wt(`detail.model.${purchase.moneyModel}`)}</Tag>
          <span className="meta">{unitFacts}</span>
        </>
      }
      actions={
        tab !== 'messages' ? (
          <button type="button" onClick={() => setTab('messages')}>
            {wt('detail.sendMessage')}
          </button>
        ) : undefined
      }
      footnote={wt('detail.footnote', { version: `${purchase.market} ${purchase.packVersion}` })}
    >
      {purchase.status === 'BLOCKED' && (
        <div className="page-banner">
          <HardBlock title={wt('detail.blockedTitle')} icon="lock">
            {purchase.blockReason ? `${purchase.blockReason} · ` : ''}
            {wt('detail.blockedHint')}
          </HardBlock>
        </div>
      )}
      {purchase.status === 'CANCELLED' && (
        <div className="page-banner">
          <Notice tone="info" icon="cancel" title={wt('detail.cancelledTitle')} />
        </div>
      )}

      <Refreshing active={loading} />
      <ErrorBox error={error} onRetry={reload} />

      <Tabs label={wt('steps.title')} tabs={TABS.map((name) => ({ id: name, label: tt(`tab.${name}`) }))} value={tab} onChange={setTab} />

      <div className="layout-aside">
        <div className="layout-aside__main" role="tabpanel">
          {tab === 'steps' && <StepsTab {...props} />}
          {tab === 'people' && <PeopleTab {...props} />}
          {tab === 'documents' && <DocumentsTab {...props} />}
          {tab === 'legal' && <LegalTab {...props} />}
          {tab === 'money' && <MoneyTab {...props} />}
          {tab === 'construction' && <ConstructionTab {...props} />}
          {tab === 'handover' && <HandoverTab {...props} />}
          {tab === 'tasks' && <TasksTab {...props} />}
          {tab === 'messages' && <MessagesTab {...props} />}
        </div>

        <aside className="layout-aside__side">
          <Card
            label={wt('detail.participants')}
            footer={
              tab !== 'people' ? (
                <button type="button" className="block" onClick={() => setTab('people')}>
                  {wt('detail.editAssignments')}
                </button>
              ) : undefined
            }
          >
            <dl className="dl">
              <Person label={tt('people.buyer')} value={personName(purchase.buyer)} />
              <Person label={tt('people.coordinator')} value={personName(purchase.coordinator)} />
              <Person label={tt('people.legalTeam')} value={purchase.legalTeam?.name ?? ''} />
              <Person label={tt('people.lawyer')} value={personName(purchase.lawyer)} />
              <Person label={tt('people.engineer')} value={personName(purchase.engineer)} />
              {purchase.moneyModel === 'ESCROW' && <Person label={tt('people.escrow')} value={personName(purchase.escrowAgent)} />}
            </dl>
          </Card>

          <Card label={wt('detail.unitCard')}>
            <dl className="dl">
              <dt>{wt('detail.price')}</dt>
              <dd className="mono">{formatMoney(unit.price)}</dd>
              <dt>{wt('detail.area')}</dt>
              <dd className="mono">{formatNumber(unit.area, 2)} m²</dd>
              {unit.floor !== null && (
                <>
                  <dt>{wt('detail.floor')}</dt>
                  <dd className="mono">{unit.floor}</dd>
                </>
              )}
              {unit.rooms !== null && (
                <>
                  <dt>{wt('detail.rooms')}</dt>
                  <dd className="mono">{formatNumber(unit.rooms, 1)}</dd>
                </>
              )}
              <dt>{wt('detail.address')}</dt>
              <dd>
                {purchase.project.address}, {purchase.project.city}
              </dd>
              <dt>{wt('detail.developer')}</dt>
              <dd>{purchase.developer.name}</dd>
              <dt>{t('common.market')}</dt>
              <dd>{t(`market.${purchase.market}`)}</dd>
            </dl>
          </Card>

          <AuditTrail entityId={purchase.id} />
        </aside>
      </div>
    </Page>
  )
}

/** Red učesnika: prazno mesto se imenuje („Nije dodeljeno”), nikad se ne ostavlja prazno. */
function Person({ label, value }: { label: string; value: string }) {
  const tt = usePurchaseT()
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? undefined : 'subtle'}>{value || tt('people.none')}</dd>
    </>
  )
}
