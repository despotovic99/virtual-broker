import { useEffect, useState } from 'react'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Button, DummyTag, ErrorBox, Field, FormSection, Notice, SemaphoreBadge, type SemaphoreStatus } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { FormModal } from '../../ui/Modal.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { ExpiredChip, isDummySource, PICK_PAGE, useStaffT } from './shared.tsx'
import type { CheckHistoryItem } from './types.ts'

const STATUSES: SemaphoreStatus[] = ['GREEN', 'YELLOW', 'RED', 'GRAY']

type Target = { developerId: string } | { projectId: string }

/**
 * Provere za investitora ili projekat (F-05, F-06): pokretanje automatskih
 * (DUMMY) izvora, ručni unos u modalu i istorija kao tabela sa paginacijom.
 * Trenutno stanje (semafor) prikazuje `SemaphoreTable`.
 */
export function ChecksPanel({ target, market, onChanged }: { target: Target; market: MarketCode; onChanged: () => void }) {
  const st = useStaffT()
  const { t, l, formatDate } = useI18n()
  const { user, can } = useAuth()
  const { get } = useMarkets()
  const subject = 'developerId' in target ? 'DEVELOPER' : 'PROJECT'
  const targetId = 'developerId' in target ? target.developerId : target.projectId
  const definitions = (get(market)?.checks ?? []).filter((check) => check.subject === subject)
  const roles = user?.roles ?? []
  const isLawyer = roles.includes('LAWYER')
  const isAnalyst = roles.includes('ANALYST')
  const isAdmin = roles.includes('ADMIN')
  // Analitičar: MANUAL i DOCUMENT. Advokat: LAWYER i DOCUMENT. Admin: sve ručne.
  // Automatske se pokreću dugmetom. Isto proverava server (checks-admin.service).
  const manualDefinitions = definitions.filter(
    (check) =>
      (isAdmin && check.method !== 'AUTOMATIC') ||
      (isAnalyst && (check.method === 'MANUAL' || check.method === 'DOCUMENT')) ||
      (isLawyer && (check.method === 'LAWYER' || check.method === 'DOCUMENT')),
  )
  const history = usePagedQuery((page) => staffApi.checkHistory(target, page), [subject, targetId], { prefix: 'checks' })
  const [running, setRunning] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const titleOf = (code: string) => {
    const definition = definitions.find((check) => check.code === code)
    return definition ? l(definition.title) : code
  }

  const runAutomatic = async () => {
    setRunning(true)
    setError(null)
    try {
      await staffApi.runChecks(target)
      history.reload()
      onChanged()
    } catch (reason) {
      setError(reason)
    } finally {
      setRunning(false)
    }
  }

  const now = Date.now()
  const isExpired = (item: CheckHistoryItem) => new Date(item.validUntil).getTime() < now
  const canManage = can('checks:manage')
  const hasAutomatic = definitions.some((check) => check.method === 'AUTOMATIC')

  const columns: Column<CheckHistoryItem>[] = [
    { key: 'status', header: t('common.status'), cell: (item) => <SemaphoreBadge status={item.status} /> },
    {
      key: 'check',
      header: st('checks.definition'),
      cell: (item) => (
        <span className="cell-title">
          <strong>{titleOf(item.definitionCode)}</strong>
          {item.summary && <span className="meta">{item.summary}</span>}
        </span>
      ),
    },
    { key: 'method', header: st('method'), hideOnMobile: true, cell: (item) => st(`method.${item.method}`) },
    {
      key: 'source',
      header: st('source'),
      hideOnMobile: true,
      cell: (item) => (
        <span className="row">
          <span>{item.source || '—'}</span>
          {isDummySource(item) && <DummyTag />}
        </span>
      ),
    },
    { key: 'checkedAt', header: st('checkedAt'), mono: true, cell: (item) => formatDate(item.checkedAt) },
    {
      key: 'validUntil',
      header: st('validUntil'),
      cell: (item) => (
        <span className="row">
          <span className="mono">{formatDate(item.validUntil)}</span>
          {isExpired(item) && <ExpiredChip />}
        </span>
      ),
    },
  ]

  return (
    <div className="stack">
      {canManage && hasAutomatic && <Notice tone="test">{st('checks.runHint')}</Notice>}
      <ErrorBox error={error} />
      <DataTable
        title={st('checks.history')}
        caption={st('checks.history')}
        columns={columns}
        rows={history.rows}
        rowKey={(item) => item.id}
        loading={history.loading}
        error={history.error}
        onRetry={history.reload}
        pagination={history.pagination}
        empty={st('checks.none')}
        rowClassName={(item) => (isExpired(item) ? 'row--warn' : undefined)}
        actions={
          canManage && (
            <>
              {manualDefinitions.length > 0 && (
                <Button size="sm" icon="plus" onClick={() => setRecording(true)}>
                  {st('checks.manual')}
                </Button>
              )}
              {hasAutomatic && (
                <>
                  <DummyTag />
                  <Button size="sm" variant="primary" busy={running} onClick={() => void runAutomatic()}>
                    {st('checks.run')}
                  </Button>
                </>
              )}
            </>
          )
        }
      />
      {canManage && manualDefinitions.length > 0 && (
        <ManualCheckModal
          open={recording}
          onClose={() => setRecording(false)}
          target={target}
          definitions={manualDefinitions.map((check) => ({
            code: check.code,
            title: l(check.title),
            method: check.method,
            mandatory: check.mandatory,
            validityDays: check.validityDays,
          }))}
          onSaved={() => {
            history.reload()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/** Ručni unos provere (do 4 polja): provera, status, dokument i kratko objašnjenje. */
function ManualCheckModal({
  open,
  onClose,
  target,
  definitions,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  target: Target
  definitions: { code: string; title: string; method: string; mandatory: boolean; validityDays: number }[]
  onSaved: () => void
}) {
  const st = useStaffT()
  const { t } = useI18n()
  const targetId = 'developerId' in target ? target.developerId : target.projectId
  // Dokumenti za izbor: prvih 100 (server: limit najviše 100), samo dok je modal otvoren.
  const documents = useAsync(() => (open ? staffApi.documents(target, PICK_PAGE) : Promise.resolve(null)), [open, targetId])
  const firstCode = definitions[0]?.code ?? ''
  const [definitionCode, setDefinitionCode] = useState(firstCode)
  const [status, setStatus] = useState<SemaphoreStatus>('GREEN')
  const [summary, setSummary] = useState('')
  const [documentId, setDocumentId] = useState('')

  useEffect(() => {
    if (!open) return
    setDefinitionCode(firstCode)
    setStatus('GREEN')
    setSummary('')
    setDocumentId('')
  }, [open, firstCode])

  const definition = definitions.find((item) => item.code === definitionCode)
  const needsDocument = definition?.method === 'DOCUMENT' && status !== 'GRAY'
  const missingDocument = needsDocument && !documentId
  const blockedReason = !definitionCode
    ? st('requiredFields')
    : missingDocument
      ? st('checks.documentRequired')
      : summary.trim().length < 3
        ? st('checks.summaryShort')
        : null

  const validity = definition
    ? st(definition.mandatory ? 'form.check.validityMandatory' : 'form.check.validity', { n: definition.validityDays })
    : undefined

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('checks.manual')}
      description={st('form.check.description')}
      size="lg"
      submitLabel={st('checks.save')}
      dirty={summary.length > 0}
      disabledReason={blockedReason}
      onSubmit={async () => {
        await staffApi.recordCheck({ ...target, definitionCode, status, summary: summary.trim(), documentId: documentId || undefined })
        onSaved()
      }}
    >
      <FormSection title={st('form.check.what')} columns={2}>
        <Field label={st('checks.definition')} required info={st('form.check.definitionInfo')} hint={validity}>
          <select value={definitionCode} onChange={(event) => setDefinitionCode(event.target.value)}>
            {definitions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.title} · {st(`method.${item.method as 'MANUAL'}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.status')} required info={st('form.check.statusInfo')}>
          <select value={status} onChange={(event) => setStatus(event.target.value as SemaphoreStatus)}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`semaphore.${value}`)}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <FormSection title={st('form.check.evidence')} columns={1}>
        <Field
          label={st('checks.document')}
          required={needsDocument}
          info={st('form.check.documentInfo')}
          hint={needsDocument ? st('checks.documentRequired') : undefined}
          error={missingDocument && summary.length > 0 ? st('checks.documentRequired') : null}
        >
          <select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
            <option value="">{st('checks.noDocument')}</option>
            {(documents.data?.items ?? []).map((document) => (
              <option key={document.id} value={document.id}>
                {document.fileName}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={st('checks.summary')}
          required
          info={st('form.check.summaryInfo')}
          hint={`${summary.length} / 500`}
          error={summary.length > 0 && summary.trim().length < 3 ? st('checks.summaryShort') : null}
        >
          <textarea value={summary} rows={4} onChange={(event) => setSummary(event.target.value)} maxLength={500} />
        </Field>
        <ErrorBox error={documents.error} onRetry={documents.reload} />
      </FormSection>
    </FormModal>
  )
}
