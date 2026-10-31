import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Button, ErrorBox, Field, FormSection, Page, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { FormModal, Modal } from '../../ui/Modal.tsx'
import { statusSignal } from '../../ui/status.ts'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination, usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { FileField, formatSize, LateChip, MAX_UPLOAD_BYTES, PICK_PAGE, useStaffT } from './shared.tsx'
import type { ConstructionPhase, DocumentItem, EngineerReport } from './types.ts'

/**
 * Gradnja za inženjera (F-17, F-18): izbor projekta (u URL-u, `?projectId=`),
 * faze i izveštaji sa prilozima. Nov izveštaj je posebna strana.
 */
export function ConstructionPage() {
  const st = useStaffT()
  const [params, setParams] = useSearchParams()
  const projectId = params.get('projectId') ?? ''
  const projects = useAsync(() => staffApi.projects(PICK_PAGE), [])

  const chooseProject = (value: string) =>
    setParams(
      () => {
        // Nov projekat počinje od prve strane svake tabele.
        const next = new URLSearchParams()
        if (value) next.set('projectId', value)
        return next
      },
      { replace: true },
    )

  const select = (
    <Field label={st('construction.project')}>
      <select value={projectId} onChange={(event) => chooseProject(event.target.value)} disabled={projects.loading && !projects.data}>
        <option value="">{st('construction.chooseProject')}</option>
        {(projects.data?.items ?? []).map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} · {project.city} ({project.market})
          </option>
        ))}
      </select>
    </Field>
  )

  return (
    <Page title={st('construction.title')}>
      <ErrorBox error={projects.error} onRetry={projects.reload} />
      <ConstructionPlan projectId={projectId} toolbar={select} />
      {projectId && <Reports projectId={projectId} />}
    </Page>
  )
}

/**
 * Faze projekta: plan i stvarno stanje (tabela samo za čitanje). Plan menja
 * naš tim (payments:plan) u modalu „Uredi plan”; fazu potvrđuje samo inženjer kroz izveštaj.
 */
export function ConstructionPlan({ projectId, toolbar }: { projectId: string; toolbar?: ReactNode }) {
  const st = useStaffT()
  const { t, l, formatDate } = useI18n()
  const { can } = useAuth()
  const { data, error, loading, reload } = useAsync(() => (projectId ? staffApi.construction(projectId) : Promise.resolve(null)), [projectId])
  const phases = projectId ? data?.phases : []
  const { rows, pagination } = useClientPagination(phases)
  const [editing, setEditing] = useState(false)
  const canPlan = can('payments:plan')

  const columns: Column<ConstructionPhase>[] = [
    { key: 'phase', header: st('construction.phase'), cell: (phase) => <strong>{l(phase.title)}</strong> },
    { key: 'share', header: '%', align: 'end', cell: (phase) => `${phase.defaultSharePercent}%` },
    { key: 'planned', header: st('construction.planned'), mono: true, cell: (phase) => formatDate(phase.plannedDate) },
    { key: 'actual', header: st('construction.actual'), mono: true, cell: (phase) => formatDate(phase.actualDate) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (phase) => (
        <span className="row">
          <StatusBadge text={st(`phaseStatus.${phase.status}`)} {...statusSignal('phase', phase.status)} />
          {phase.late && <LateChip text={st('construction.late')} />}
        </span>
      ),
    },
  ]

  return (
    <>
      <DataTable
        title={st('project.construction')}
        caption={st('project.construction')}
        columns={columns}
        rows={rows}
        rowKey={(phase) => phase.phaseCode}
        loading={loading && Boolean(projectId)}
        error={error}
        onRetry={reload}
        pagination={pagination}
        toolbar={toolbar}
        rowClassName={(phase) => (phase.late ? 'row--risk' : undefined)}
        empty={projectId ? st('construction.noPhases') : { icon: 'home', title: st('construction.chooseProject'), text: st('construction.noProject') }}
        actions={
          canPlan &&
          projectId &&
          data &&
          data.phases.length > 0 && (
            <Button size="sm" icon="edit" onClick={() => setEditing(true)}>
              {st('construction.editPlan')}
            </Button>
          )
        }
      />
      {canPlan && data && (
        <PlanModal open={editing} onClose={() => setEditing(false)} projectId={projectId} phases={data.phases} onSaved={reload} />
      )}
    </>
  )
}

/** Planirani datumi faza; čuva se ceo plan odjednom. */
function PlanModal({
  open,
  onClose,
  projectId,
  phases,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  phases: ConstructionPhase[]
  onSaved: () => void
}) {
  const st = useStaffT()
  const { l } = useI18n()
  const [plan, setPlan] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) setPlan({})
  }, [open])

  const unchanged = Object.keys(plan).length === 0
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('construction.editPlan')}
      description={st('form.plan.description')}
      submitLabel={st('construction.savePlan')}
      size="lg"
      dirty={!unchanged}
      disabledReason={unchanged ? st('construction.noChanges') : null}
      onSubmit={async () => {
        await staffApi.updatePlan(
          projectId,
          phases.map((phase) => ({
            phaseCode: phase.phaseCode,
            plannedDate: (plan[phase.phaseCode] ?? phase.plannedDate ?? '') || null,
          })),
        )
        onSaved()
      }}
    >
      <FormSection title={st('form.plan.section')} description={st('form.plan.sectionHint')} columns={2}>
        {phases.map((phase) => (
          <Field
            key={phase.phaseCode}
            label={`${l(phase.title)} · ${phase.defaultSharePercent}%`}
            hint={phase.status === 'CONFIRMED' ? st('phaseStatus.CONFIRMED') : undefined}
          >
            <input
              type="date"
              value={plan[phase.phaseCode] ?? phase.plannedDate?.slice(0, 10) ?? ''}
              onChange={(event) => setPlan({ ...plan, [phase.phaseCode]: event.target.value })}
            />
          </Field>
        ))}
      </FormSection>
    </FormModal>
  )
}

function Reports({ projectId }: { projectId: string }) {
  const st = useStaffT()
  const { l, formatDate } = useI18n()
  const { user, can } = useAuth()
  const list = usePagedQuery((page) => staffApi.reports(projectId, page), [projectId], { prefix: 'reports' })
  const construction = useAsync(() => staffApi.construction(projectId), [projectId])
  const phases = construction.data?.phases ?? []
  const [filesOf, setFilesOf] = useState<EngineerReport | null>(null)
  const [uploadTo, setUploadTo] = useState<EngineerReport | null>(null)
  const canReport = can('construction:report')
  // Fajl uz izveštaj dodaje autor ili admin (server isto proverava).
  const mayAddFiles = (report: EngineerReport) => user?.id === report.engineerId || (user?.roles.includes('ADMIN') ?? false)

  const columns: Column<EngineerReport>[] = [
    { key: 'visit', header: st('construction.visitDate'), mono: true, cell: (report) => formatDate(report.visitDate) },
    {
      key: 'verdict',
      header: st('construction.verdict'),
      cell: (report) => <StatusBadge text={st(`verdict.${report.verdict}`)} {...statusSignal('verdict', report.verdict)} />,
    },
    {
      key: 'phase',
      header: st('construction.phase'),
      hideOnMobile: true,
      cell: (report) => {
        const phase = phases.find((item) => item.phaseCode === report.phaseCode)
        return phase ? l(phase.title) : <span className="muted">{st('construction.noPhase')}</span>
      },
    },
    { key: 'summary', header: st('construction.summaryShort'), cell: (report) => <span className="pre">{report.summary}</span> },
  ]

  return (
    <>
      <DataTable
        title={st('construction.reports')}
        caption={st('construction.reports')}
        columns={columns}
        rows={list.rows}
        rowKey={(report) => report.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={st('construction.noReports')}
        actions={
          canReport && (
            <Link className="btn btn--primary btn--sm" to={`/construction/reports/new?projectId=${projectId}`}>
              <Icon name="plus" size={13} />
              {st('construction.newReport')}
            </Link>
          )
        }
        rowActions={(report) => (
          <span className="row-actions">
            <Button size="sm" variant="quiet" icon="doc" onClick={() => setFilesOf(report)}>
              {st('construction.files')}
            </Button>
            {canReport && (
              <Button
                size="sm"
                variant="quiet"
                icon="upload"
                disabled={!mayAddFiles(report)}
                title={mayAddFiles(report) ? undefined : st('construction.onlyAuthor')}
                onClick={() => setUploadTo(report)}
              >
                {st('construction.addFile')}
              </Button>
            )}
          </span>
        )}
      />
      <ReportFilesModal report={filesOf} projectId={projectId} onClose={() => setFilesOf(null)} />
      <AddReportFileModal report={uploadTo} onClose={() => setUploadTo(null)} />
    </>
  )
}

/** Prilozi jednog izveštaja (do 100, server: limit najviše 100) sa preuzimanjem. */
function ReportFilesModal({ report, projectId, onClose }: { report: EngineerReport | null; projectId: string; onClose: () => void }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const reportId = report?.id
  const files = useAsync(
    () => (reportId ? staffApi.documents({ projectId, reportId }, PICK_PAGE) : Promise.resolve(null)),
    [projectId, reportId],
  )
  const { rows, pagination } = useClientPagination(files.data?.items)
  const [error, setError] = useState<unknown>(null)

  const columns: Column<DocumentItem>[] = [
    { key: 'file', header: st('file'), cell: (document) => <strong>{document.fileName}</strong> },
    { key: 'size', header: st('size'), align: 'end', cell: (document) => formatSize(document.sizeBytes) },
    { key: 'date', header: t('common.date'), mono: true, hideOnMobile: true, cell: (document) => formatDate(document.createdAt) },
  ]

  return (
    <Modal
      open={report !== null}
      onClose={onClose}
      size="lg"
      title={st('construction.files')}
      description={report ? `${formatDate(report.visitDate)} · ${st(`verdict.${report.verdict}`)}` : undefined}
    >
      <div className="stack">
        <ErrorBox error={error} />
        <DataTable
          caption={st('construction.files')}
          columns={columns}
          rows={reportId ? rows : undefined}
          rowKey={(document) => document.id}
          loading={files.loading}
          error={files.error}
          onRetry={files.reload}
          pagination={pagination}
          empty={st('construction.noFiles')}
          rowActions={(document) => (
            <Button
              size="sm"
              variant="quiet"
              icon="download"
              onClick={() => {
                setError(null)
                void staffApi.downloadDocument(document).catch(setError)
              }}
            >
              {t('common.download')}
            </Button>
          )}
        />
      </div>
    </Modal>
  )
}

function AddReportFileModal({ report, onClose }: { report: EngineerReport | null; onClose: () => void }) {
  const st = useStaffT()
  const { formatDate } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const open = report !== null

  useEffect(() => {
    if (open) setFile(null)
  }, [open])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('construction.addFile')}
      description={report ? `${formatDate(report.visitDate)} · ${st(`verdict.${report.verdict}`)}` : undefined}
      submitLabel={st('construction.addFile')}
      dirty={file !== null}
      disabledReason={!file ? st('noFile') : file.size > MAX_UPLOAD_BYTES ? st('form.doc.tooLarge') : null}
      onSubmit={async () => {
        if (!report || !file) return
        await staffApi.addReportFile(report.id, file)
      }}
    >
      <FileField file={file} onChange={setFile} info={st('form.reportFile.fileInfo')} />
    </FormModal>
  )
}
