import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Button, Card, ErrorState, Loading, Page, SemaphoreBadge, StatusBadge, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { ConfirmDialog } from '../../ui/Modal.tsx'
import { statusSignal } from '../../ui/status.ts'
import { Tabs, useUrlTab } from '../../ui/Tabs.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { ChecksPanel } from './ChecksPanel.tsx'
import { ConstructionPlan } from './ConstructionPage.tsx'
import { DocumentsPanel, SemaphoreTable, useStaffT } from './shared.tsx'
import type { Project, Unit, UnitStatus } from './types.ts'

const TABS = ['overview', 'units', 'checks', 'documents', 'construction'] as const

/** Detalj projekta: pregled, stanovi, provere, dokumenta i gradnja (kartice u URL-u). */
export function ProjectPage() {
  const { id = '' } = useParams()
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const detail = useAsync(() => staffApi.project(id), [id])
  const [tab, setTab] = useUrlTab(TABS, 'overview')

  if (detail.loading && !detail.data) return <Loading />
  if (!detail.data) return <ErrorState error={detail.error} onRetry={detail.reload} backTo={{ to: '/catalog?tab=projects', label: st('catalog.title') }} />
  const { project, developer, units, semaphore } = detail.data
  const canManage = can('catalog:manage')

  return (
    <Page
      title={project.name}
      crumbs={[
        { label: st('catalog.title'), to: '/catalog?tab=projects' },
        { label: developer.name, to: `/catalog/developers/${developer.id}` },
        { label: project.name },
      ]}
      meta={
        <>
          <SemaphoreBadge status={semaphore.overall} />
          <StatusBadge text={st(`projStatus.${project.status}`)} {...statusSignal('project', project.status)} />
          <Tag>{t(`market.${project.market}`)}</Tag>
        </>
      }
      actions={
        <>
          <Link className="btn" to="/catalog?tab=projects">
            {t('common.back')}
          </Link>
          {canManage && (
            <Link className="btn btn--primary" to={`/catalog/projects/${project.id}/edit`}>
              <Icon name="edit" size={15} />
              {t('common.edit')}
            </Link>
          )}
        </>
      }
    >
      <div className="layout-aside">
        <div className="layout-aside__main">
          <div>
            <Tabs
              label={project.name}
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: st('tab.overview') },
                { id: 'units', label: st('project.units'), count: units.length },
                { id: 'checks', label: st('checks.title') },
                { id: 'documents', label: st('documents') },
                { id: 'construction', label: st('tab.construction') },
              ]}
            />
            <div role="tabpanel">
              {tab === 'overview' && <ProjectInfo project={project} developerName={developer.name} developerId={developer.id} />}
              {tab === 'units' && <UnitsTable projectId={project.id} units={units} canEdit={canManage} onChanged={detail.reload} />}
              {tab === 'checks' && (
                <>
                  <SemaphoreTable title={st('checks.projectSemaphore')} result={{ ...semaphore.project, disclaimer: semaphore.disclaimer }} />
                  <SemaphoreTable title={st('checks.developerSemaphore')} result={{ ...semaphore.developer, disclaimer: semaphore.disclaimer }} />
                  <ChecksPanel target={{ projectId: project.id }} market={project.market} onChanged={detail.reload} />
                </>
              )}
              {tab === 'documents' && (
                <DocumentsPanel owner={{ scope: 'PROJECT', projectId: project.id }} market={project.market} canUpload={can('documents:upload')} />
              )}
              {tab === 'construction' && <ConstructionPlan projectId={project.id} />}
            </div>
          </div>
        </div>
        {can('audit:read') && (
          <aside className="layout-aside__side">
            <AuditTrail entityId={project.id} />
          </aside>
        )}
      </div>
    </Page>
  )
}

function ProjectInfo({ project, developerName, developerId }: { project: Project; developerName: string; developerId: string }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  return (
    <Card title={t('common.details')}>
      <div className="stack">
        <dl className="dl">
          <dt>{st('project.developer')}</dt>
          <dd>
            <Link to={`/catalog/developers/${developerId}`}>{developerName}</Link>
          </dd>
          <dt>{st('project.city')}</dt>
          <dd>{project.city}</dd>
          <dt>{st('project.address')}</dt>
          <dd>{project.address}</dd>
          <dt>{st('project.parcel')}</dt>
          <dd className={project.parcelReference ? 'mono' : undefined}>{project.parcelReference ?? '—'}</dd>
          <dt>{st('project.expectedCompletion')}</dt>
          <dd className="mono">{formatDate(project.expectedCompletion)}</dd>
        </dl>
        {project.description && <p className="pre">{project.description}</p>}
      </div>
    </Card>
  )
}

/** Stanovi projekta: tabela; nov stan i izmena su posebne strane, promena statusa traži potvrdu. */
function UnitsTable({ projectId, units, canEdit, onChanged }: { projectId: string; units: Unit[]; canEdit: boolean; onChanged: () => void }) {
  const st = useStaffT()
  const { t, formatMoney, formatNumber } = useI18n()
  const { rows, pagination } = useClientPagination(units)
  const [change, setChange] = useState<{ unit: Unit; status: UnitStatus } | null>(null)

  const columns: Column<Unit>[] = [
    { key: 'label', header: st('unit.label'), cell: (unit) => <strong>{unit.label}</strong> },
    { key: 'floor', header: st('unit.floor'), align: 'end', cell: (unit) => unit.floor ?? '—' },
    { key: 'rooms', header: st('unit.rooms'), align: 'end', cell: (unit) => unit.rooms ?? '—' },
    { key: 'area', header: st('unit.area'), align: 'end', cell: (unit) => formatNumber(unit.area, 2) },
    { key: 'price', header: st('unit.price'), align: 'end', cell: (unit) => formatMoney(unit.price) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (unit) => <StatusBadge text={st(`unitStatus.${unit.status}`)} {...statusSignal('unit', unit.status)} />,
    },
  ]

  return (
    <>
      <DataTable
        title={st('project.units')}
        caption={st('project.units')}
        columns={columns}
        rows={rows}
        rowKey={(unit) => unit.id}
        pagination={pagination}
        empty={st('unit.none')}
        actions={
          canEdit && (
            <Link className="btn btn--primary btn--sm" to={`/catalog/projects/${projectId}/units/new`}>
              <Icon name="plus" size={13} />
              {st('project.addUnit')}
            </Link>
          )
        }
        rowActions={
          canEdit
            ? (unit) => (
                <span className="row-actions">
                  <Link className="btn btn--quiet btn--sm" to={`/catalog/projects/${projectId}/units/${unit.id}/edit`}>
                    <Icon name="edit" size={13} />
                    {t('common.edit')}
                  </Link>
                  {unit.status === 'SOLD' && (
                    <Button size="sm" onClick={() => setChange({ unit, status: 'AVAILABLE' })}>
                      {st('unitStatus.AVAILABLE')}
                    </Button>
                  )}
                  {unit.status === 'AVAILABLE' && (
                    <Button size="sm" onClick={() => setChange({ unit, status: 'SOLD' })}>
                      {st('unitStatus.SOLD')}
                    </Button>
                  )}
                </span>
              )
            : undefined
        }
      />
      <ConfirmDialog
        open={change !== null}
        onClose={() => setChange(null)}
        title={change ? `${change.unit.label} · ${st(`unitStatus.${change.status}`)}` : ''}
        text={change ? st('unit.statusConfirm', { label: change.unit.label, status: st(`unitStatus.${change.status}`) }) : undefined}
        confirmLabel={t('common.confirm')}
        onConfirm={async () => {
          if (!change) return
          await staffApi.updateUnit(change.unit.id, { status: change.status })
          onChanged()
        }}
      />
    </>
  )
}
