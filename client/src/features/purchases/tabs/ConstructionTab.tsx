import { useState } from 'react'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Button, Chip, Empty, ErrorBox, Loading, StatusBadge } from '../../../ui/components.tsx'
import { DataTable, type Column } from '../../../ui/DataTable.tsx'
import { Modal } from '../../../ui/Modal.tsx'
import { statusSignal } from '../../../ui/status.ts'
import { useAsync } from '../../../ui/useAsync.ts'
import { useClientPagination, usePagedQuery } from '../../../ui/usePagination.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DownloadButton, shorten, usePurchaseT } from '../shared.tsx'
import type { ConstructionPhase, EngineerReport } from '../types.ts'

/** Gradnja: faze (fiksni plan, cela lista) i izveštaji inženjera (serverska paginacija). */
export function ConstructionTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { l, formatDate } = useI18n()
  const projectId = purchase.project.id
  const construction = useAsync(() => purchasesApi.construction(projectId), [projectId])
  const phases = useClientPagination(construction.data?.phases)
  const reports = usePagedQuery((page) => purchasesApi.reports(projectId, page), [projectId], { prefix: 'reports' })
  const [viewing, setViewing] = useState<EngineerReport | null>(null)

  const phaseColumns: Column<ConstructionPhase>[] = [
    {
      key: 'title',
      header: tt('construction.phase'),
      cell: (phase) => (
        <span className="cell-title">
          <strong>{l(phase.title)}</strong>
          <span className="meta">{phase.phaseCode}</span>
        </span>
      ),
    },
    { key: 'planned', header: tt('construction.plannedLabel'), mono: true, cell: (phase) => (phase.plannedDate ? formatDate(phase.plannedDate) : '—') },
    {
      key: 'actual',
      header: tt('construction.actualLabel'),
      mono: true,
      hideOnMobile: true,
      cell: (phase) => (phase.actualDate ? formatDate(phase.actualDate) : '—'),
    },
    {
      key: 'status',
      header: tt('construction.statusLabel'),
      cell: (phase) => (
        <span className="row">
          <StatusBadge text={tt(`phaseStatus.${phase.status}`)} {...statusSignal('phase', phase.status)} />
          {phase.late && (
            <Chip tone="risk" icon="clock">
              {tt('construction.late')}
            </Chip>
          )}
        </span>
      ),
    },
  ]

  const reportColumns: Column<EngineerReport>[] = [
    { key: 'date', header: tt('construction.visitDate'), mono: true, cell: (report) => formatDate(report.visitDate) },
    { key: 'phase', header: tt('construction.phase'), mono: true, hideOnMobile: true, cell: (report) => report.phaseCode ?? '—' },
    {
      key: 'verdict',
      header: tt('construction.verdict'),
      cell: (report) => <StatusBadge text={tt(`verdict.${report.verdict}`)} {...statusSignal('verdict', report.verdict)} />,
    },
    {
      key: 'summary',
      header: tt('construction.summary'),
      hideOnMobile: true,
      cell: (report) => <span title={report.summary}>{shorten(report.summary)}</span>,
    },
  ]

  return (
    <div className="stack">
      <DataTable
        title={tt('construction.phases')}
        caption={tt('construction.phases')}
        columns={phaseColumns}
        rows={phases.rows}
        rowKey={(phase) => phase.phaseCode}
        loading={construction.loading}
        error={construction.error}
        onRetry={construction.reload}
        pagination={phases.pagination}
        empty={tt('construction.noPhases')}
        rowClassName={(phase) => (phase.late ? 'row--risk' : undefined)}
      />
      <DataTable
        title={tt('construction.reports')}
        badge={reports.data && reports.data.total > 0 ? <span className="count">{reports.data.total}</span> : undefined}
        caption={tt('construction.reports')}
        columns={reportColumns}
        rows={reports.rows}
        rowKey={(report) => report.id}
        loading={reports.loading}
        error={reports.error}
        onRetry={reports.reload}
        pagination={reports.pagination}
        empty={tt('construction.noReports')}
        rowActions={(report) => (
          <Button size="sm" variant="quiet" icon="eye" onClick={() => setViewing(report)}>
            {tt('construction.details')}
          </Button>
        )}
      />
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={tt('construction.reportTitle')}
        description={viewing ? formatDate(viewing.visitDate) : undefined}
        size="lg"
      >
        {viewing && <ReportDetails report={viewing} projectId={projectId} />}
      </Modal>
    </div>
  )
}

/** Izveštaj u modalu: ceo tekst i prilozi (učitavaju se tek kad se otvori). */
function ReportDetails({ report, projectId }: { report: EngineerReport; projectId: string }) {
  const tt = usePurchaseT()
  const files = useAsync(() => purchasesApi.reportDocuments(projectId, report.id, { limit: 100, offset: 0 }), [projectId, report.id])

  return (
    <div className="stack">
      <span className="row">
        <StatusBadge text={tt(`verdict.${report.verdict}`)} {...statusSignal('verdict', report.verdict)} />
        {report.phaseCode && <span className="meta">{report.phaseCode}</span>}
      </span>
      <p className="pre">{report.summary}</p>
      <div className="stack stack--sm">
        <span className="eyebrow">{tt('construction.photos')}</span>
        <ErrorBox error={files.error} onRetry={files.reload} />
        {files.loading && !files.data && !files.error && <Loading rows={2} />}
        {files.data && files.data.items.length === 0 && <Empty text={tt('construction.noFiles')} />}
        {files.data?.items.map((file) => (
          <div key={file.id} className="row row--between">
            <span className="mono">{file.fileName}</span>
            <DownloadButton document={file} />
          </div>
        ))}
      </div>
    </div>
  )
}
