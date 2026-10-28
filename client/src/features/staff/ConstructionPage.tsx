import { useState, type FormEvent } from 'react'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { today, useStaffT } from './shared.tsx'
import type { ConstructionPhase, EngineerReport, PhaseStatus, ReportVerdict } from './types.ts'

const VERDICTS: ReportVerdict[] = ['PROGRESS', 'PHASE_CONFIRMED', 'PHASE_REJECTED', 'ISSUE']

function phaseTone(status: PhaseStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'CONFIRMED') return 'good'
  if (status === 'REJECTED') return 'bad'
  if (status === 'IN_PROGRESS') return 'warn'
  return 'neutral'
}

/** Gradnja za inženjera (F-17, F-18): izbor projekta, faze i izveštaji sa prilozima. */
export function ConstructionPage() {
  const st = useStaffT()
  const projects = useAsync(() => staffApi.projects({ limit: 100 }), [])
  const [projectId, setProjectId] = useState('')

  return (
    <Page title={st('construction.title')}>
      <Card>
        <ErrorBox error={projects.error} />
        <Field label={st('construction.project')}>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">{st('construction.chooseProject')}</option>
            {(projects.data?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.city} ({project.market})
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {projectId && (
        <>
          <ConstructionPlan projectId={projectId} />
          <Reports projectId={projectId} />
        </>
      )}
    </Page>
  )
}

/**
 * Faze projekta: plan i stvarno stanje. Plan menja naš tim (payments:plan),
 * fazu potvrđuje samo inženjer kroz izveštaj.
 */
export function ConstructionPlan({ projectId }: { projectId: string }) {
  const st = useStaffT()
  const { t, l, formatDate } = useI18n()
  const { can } = useAuth()
  const { data, error, loading, reload } = useAsync(() => staffApi.construction(projectId), [projectId])
  const [plan, setPlan] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<unknown>(null)
  const canPlan = can('payments:plan')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!data) return
    setSaveError(null)
    try {
      await staffApi.updatePlan(
        projectId,
        data.phases.map((phase) => ({
          phaseCode: phase.phaseCode,
          plannedDate: (plan[phase.phaseCode] ?? phase.plannedDate ?? '') || null,
        })),
      )
      setPlan({})
      reload()
    } catch (reason) {
      setSaveError(reason)
    }
  }

  if (loading && !data) return <Loading />
  return (
    <Card title={st('project.construction')}>
      <ErrorBox error={error ?? saveError} />
      {!data || data.phases.length === 0 ? (
        <Empty />
      ) : (
        <form onSubmit={(event) => void save(event)}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{st('construction.phase')}</th>
                  <th>{st('construction.planned')}</th>
                  <th>{st('construction.actual')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.phases.map((phase: ConstructionPhase) => (
                  <tr key={phase.phaseCode}>
                    <td>
                      {l(phase.title)} <span className="muted">· {phase.defaultSharePercent}%</span>
                    </td>
                    <td>
                      {canPlan ? (
                        <input
                          type="date"
                          value={plan[phase.phaseCode] ?? phase.plannedDate ?? ''}
                          onChange={(event) => setPlan({ ...plan, [phase.phaseCode]: event.target.value })}
                          aria-label={st('construction.planned')}
                        />
                      ) : (
                        formatDate(phase.plannedDate)
                      )}
                    </td>
                    <td>{formatDate(phase.actualDate)}</td>
                    <td>
                      <StatusBadge text={st(`phaseStatus.${phase.status}`)} tone={phaseTone(phase.status)} />{' '}
                      {phase.late && <StatusBadge text={st('construction.late')} tone="bad" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canPlan && (
            <button type="submit" className="primary" disabled={Object.keys(plan).length === 0}>
              {st('construction.savePlan')}
            </button>
          )}
        </form>
      )}
    </Card>
  )
}

function Reports({ projectId }: { projectId: string }) {
  const st = useStaffT()
  const { formatDate } = useI18n()
  const { can } = useAuth()
  const reports = useAsync(() => staffApi.reports(projectId), [projectId])
  const construction = useAsync(() => staffApi.construction(projectId), [projectId])
  const phases = construction.data?.phases ?? []

  return (
    <Card title={st('construction.reports')}>
      <ErrorBox error={reports.error} />
      {can('construction:report') && (
        <NewReportForm
          projectId={projectId}
          phases={phases}
          onCreated={() => {
            reports.reload()
            construction.reload()
          }}
        />
      )}
      {!reports.data || reports.data.length === 0 ? (
        <Empty />
      ) : (
        reports.data.map((report) => (
          <ReportItem key={report.id} report={report} projectId={projectId} phases={phases} formatDate={formatDate} />
        ))
      )}
    </Card>
  )
}

function ReportItem({
  report,
  projectId,
  phases,
  formatDate,
}: {
  report: EngineerReport
  projectId: string
  phases: ConstructionPhase[]
  formatDate: (iso: string | null | undefined) => string
}) {
  const st = useStaffT()
  const { l } = useI18n()
  const { user, can } = useAuth()
  const files = useAsync(() => staffApi.documents({ projectId, reportId: report.id }), [projectId, report.id])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<unknown>(null)
  const phase = phases.find((item) => item.phaseCode === report.phaseCode)
  const isAuthor = user?.id === report.engineerId

  const addFile = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    setError(null)
    try {
      await staffApi.addReportFile(report.id, file)
      setFile(null)
      files.reload()
    } catch (reason) {
      setError(reason)
    }
  }

  const tone = report.verdict === 'PHASE_CONFIRMED' ? 'good' : report.verdict === 'PROGRESS' ? 'neutral' : 'bad'
  return (
    <div className="card">
      <p>
        <strong>{formatDate(report.visitDate)}</strong> · <StatusBadge text={st(`verdict.${report.verdict}`)} tone={tone} />
        {phase && <span className="muted"> · {l(phase.title)}</span>}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{report.summary}</p>
      <ErrorBox error={error ?? files.error} />
      {files.data && files.data.length > 0 && (
        <p>
          {st('construction.files')}:{' '}
          {files.data.map((document) => (
            <button key={document.id} type="button" onClick={() => void staffApi.downloadDocument(document).catch(setError)}>
              {document.fileName}
            </button>
          ))}
        </p>
      )}
      {isAuthor && can('construction:report') && (
        <form onSubmit={(event) => void addFile(event)} className="row">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-label={st('construction.addFile')}
          />
          <button type="submit" disabled={!file}>
            {st('construction.addFile')}
          </button>
        </form>
      )}
    </div>
  )
}

function NewReportForm({ projectId, phases, onCreated }: { projectId: string; phases: ConstructionPhase[]; onCreated: () => void }) {
  const st = useStaffT()
  const { l } = useI18n()
  const [phaseCode, setPhaseCode] = useState('')
  const [visitDate, setVisitDate] = useState(today())
  const [summary, setSummary] = useState('')
  const [verdict, setVerdict] = useState<ReportVerdict>('PROGRESS')
  const [error, setError] = useState<unknown>(null)
  const needsPhase = verdict === 'PHASE_CONFIRMED' || verdict === 'PHASE_REJECTED'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await staffApi.createReport(projectId, { phaseCode: phaseCode || undefined, visitDate, summary: summary.trim(), verdict })
      setSummary('')
      setPhaseCode('')
      setVerdict('PROGRESS')
      onCreated()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <h3>{st('construction.newReport')}</h3>
      <div className="grid">
        <Field label={st('construction.verdict')}>
          <select value={verdict} onChange={(event) => setVerdict(event.target.value as ReportVerdict)}>
            {VERDICTS.map((value) => (
              <option key={value} value={value}>
                {st(`verdict.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('construction.phase')}>
          <select value={phaseCode} onChange={(event) => setPhaseCode(event.target.value)} required={needsPhase}>
            <option value="">{st('construction.noPhase')}</option>
            {phases.map((phase) => (
              <option key={phase.phaseCode} value={phase.phaseCode}>
                {l(phase.title)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('construction.visitDate')}>
          <input type="date" value={visitDate} max={today()} onChange={(event) => setVisitDate(event.target.value)} required />
        </Field>
      </div>
      <Field label={st('construction.summary')}>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={5000} />
      </Field>
      <ErrorBox error={error} />
      <button type="submit" className="primary" disabled={summary.trim().length < 10 || !visitDate || (needsPhase && !phaseCode)}>
        {st('construction.newReport')}
      </button>
    </form>
  )
}
