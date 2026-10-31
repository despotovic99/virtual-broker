import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { ErrorBox, Field, FormSection, Notice } from '../../ui/components.tsx'
import { attachmentProblem, Attachments } from '../../ui/Attachments.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { PICK_PAGE, today, useStaffT } from './shared.tsx'
import type { ReportVerdict } from './types.ts'

const VERDICTS: ReportVerdict[] = ['PROGRESS', 'PHASE_CONFIRMED', 'PHASE_REJECTED', 'ISSUE']

/** Nov izveštaj inženjera (`/construction/reports/new?projectId=`); posle uspeha nazad na gradnju istog projekta. */
export function ReportFormPage() {
  const st = useStaffT()
  const { l, t } = useI18n()
  const [params] = useSearchParams()
  const [projectId, setProjectId] = useState(params.get('projectId') ?? '')
  const projects = useAsync(() => staffApi.projects(PICK_PAGE), [])
  const construction = useAsync(() => (projectId ? staffApi.construction(projectId) : Promise.resolve(null)), [projectId])
  const phases = construction.data?.phases ?? []
  const [phaseCode, setPhaseCode] = useState('')
  const [visitDate, setVisitDate] = useState(today())
  const [summary, setSummary] = useState('')
  const [verdict, setVerdict] = useState<ReportVerdict>('PROGRESS')
  const [files, setFiles] = useState<File[]>([])
  const needsPhase = verdict === 'PHASE_CONFIRMED' || verdict === 'PHASE_REJECTED'

  const disabledReason = !projectId
    ? st('construction.chooseProject')
    : summary.trim().length < 10
      ? st('minChars', { n: 10 })
      : !visitDate || (needsPhase && !phaseCode)
        ? st('requiredFields')
        : files.some((file) => attachmentProblem(file) !== null)
          ? t('attachments.invalid')
          : null

  const backTo = projectId ? `/construction?projectId=${projectId}` : '/construction'
  const submit = async () => {
    await staffApi.createReport(projectId, { phaseCode: phaseCode || undefined, visitDate, summary: summary.trim(), verdict }, files)
    return `/construction?projectId=${projectId}`
  }

  return (
    <FormPage
      title={st('construction.newReport')}
      description={st('form.report.description')}
      crumbs={[{ label: st('construction.title'), to: backTo }, { label: st('construction.newReport') }]}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={st('construction.newReport')}
      disabledReason={disabledReason}
    >
      <FormSection title={st('form.report.site')} description={st('form.report.siteHint')}>
        <Field label={st('construction.project')} required info={st('form.report.projectInfo')}>
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value)
              setPhaseCode('')
            }}
          >
            <option value="">{st('construction.chooseProject')}</option>
            {(projects.data?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.city} ({project.market})
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('construction.visitDate')} required info={st('form.report.visitInfo')}>
          <input type="date" value={visitDate} max={today()} onChange={(event) => setVisitDate(event.target.value)} />
        </Field>
      </FormSection>

      <FormSection title={st('form.report.outcome')} description={st('form.report.outcomeHint')}>
        <Field label={st('construction.verdict')} required info={st('form.report.verdictInfo')}>
          <select value={verdict} onChange={(event) => setVerdict(event.target.value as ReportVerdict)}>
            {VERDICTS.map((value) => (
              <option key={value} value={value}>
                {st(`verdict.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={st('construction.phase')}
          required={needsPhase}
          info={st('form.report.phaseInfo')}
          disabled={!projectId}
          error={needsPhase && !phaseCode && summary.length > 0 ? st('requiredFields') : null}
        >
          <select value={phaseCode} onChange={(event) => setPhaseCode(event.target.value)} disabled={!projectId} title={projectId ? undefined : st('construction.chooseProject')}>
            <option value="">{st('construction.noPhase')}</option>
            {phases.map((phase) => (
              <option key={phase.phaseCode} value={phase.phaseCode} disabled={needsPhase && phase.status === 'CONFIRMED'}>
                {l(phase.title)} · {st(`phaseStatus.${phase.status}`)}
              </option>
            ))}
          </select>
        </Field>
        {verdict === 'PHASE_CONFIRMED' && (
          <Notice tone="warn" icon="warn">
            {st('form.report.confirmNote')}
          </Notice>
        )}
      </FormSection>

      <FormSection title={st('form.report.findings')} description={st('form.report.findingsHint')} columns={1}>
        <Field
          label={st('form.report.summaryLabel')}
          required
          info={st('form.report.summaryInfo')}
          hint={`${summary.length} / 5000`}
          error={summary.length > 0 && summary.trim().length < 10 ? st('minChars', { n: 10 }) : null}
        >
          <textarea value={summary} rows={6} onChange={(event) => setSummary(event.target.value)} maxLength={5000} />
        </Field>
      </FormSection>

      <FormSection title={st('form.report.attachments')} description={st('form.report.attachmentsHint')} columns={1}>
        <Attachments label={st('form.report.attachmentsLabel')} info={st('form.report.attachmentsInfo')} files={files} onChange={setFiles} />
      </FormSection>
      <ErrorBox error={projects.error ?? construction.error} />
    </FormPage>
  )
}
