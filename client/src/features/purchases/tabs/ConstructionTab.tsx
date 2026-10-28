import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Loading, StatusBadge } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DownloadButton, usePurchaseT } from '../shared.tsx'
import type { EngineerReport, PhaseStatus } from '../types.ts'

function phaseTone(status: PhaseStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'CONFIRMED') return 'good'
  if (status === 'REJECTED') return 'bad'
  if (status === 'IN_PROGRESS') return 'warn'
  return 'neutral'
}

export function ConstructionTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { l, formatDate } = useI18n()
  const projectId = purchase.project.id
  const construction = useAsync(() => purchasesApi.construction(projectId), [projectId])
  const reports = useAsync(() => purchasesApi.reports(projectId), [projectId])

  return (
    <>
      <Card title={tt('construction.phases')}>
        <ErrorBox error={construction.error} />
        {construction.loading && !construction.data && <Loading />}
        {construction.data?.phases.map((phase) => (
          <div key={phase.phaseCode} className="row" style={{ marginBottom: 8 }}>
            <strong>{l(phase.title)}</strong>
            <StatusBadge text={tt(`phaseStatus.${phase.status}`)} tone={phaseTone(phase.status)} />
            {phase.late && <StatusBadge text={tt('construction.late')} tone="bad" />}
            {phase.plannedDate && <span className="muted">{tt('construction.planned', { date: formatDate(phase.plannedDate) })}</span>}
            {phase.actualDate && <span className="muted">{tt('construction.actual', { date: formatDate(phase.actualDate) })}</span>}
          </div>
        ))}
      </Card>
      <Card title={tt('construction.reports')}>
        <ErrorBox error={reports.error} />
        {reports.loading && !reports.data && <Loading />}
        {reports.data && reports.data.length === 0 && <Empty text={tt('construction.noReports')} />}
        {reports.data?.map((report) => (
          <ReportItem key={report.id} report={report} projectId={projectId} />
        ))}
      </Card>
    </>
  )
}

function ReportItem({ report, projectId }: { report: EngineerReport; projectId: string }) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const files = useAsync(() => purchasesApi.reportDocuments(projectId, report.id), [projectId, report.id])
  const tone = report.verdict === 'PHASE_CONFIRMED' ? 'good' : report.verdict === 'PROGRESS' ? 'neutral' : 'bad'

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <div className="row">
        <strong>{formatDate(report.visitDate)}</strong>
        <StatusBadge text={tt(`verdict.${report.verdict}`)} tone={tone} />
        {report.phaseCode && <span className="muted">{report.phaseCode}</span>}
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{report.summary}</p>
      {files.data && files.data.length > 0 && (
        <div>
          <span className="muted">{tt('construction.photos')}:</span>
          {files.data.map((file) => (
            <div key={file.id} className="row">
              <span>{file.fileName}</span>
              <DownloadButton document={file} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
