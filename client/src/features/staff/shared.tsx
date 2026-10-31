import { useEffect, useState } from 'react'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Button, Card, Chip, DummyTag, Empty, ErrorBox, Field, HardBlock, Notice, SemaphoreBadge, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { FormModal } from '../../ui/Modal.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { staffDictionary } from './i18n.ts'
import type { BuyerRequest, DocumentItem, RequestStatus, SemaphoreItem, SemaphoreResult } from './types.ts'

export function useStaffT() {
  return useLocalT(staffDictionary)
}

/** Tržišta na kojima korisnik radi. Super admin vidi sva. */
export function useMyMarkets(): MarketCode[] {
  const { user } = useAuth()
  if (!user) return []
  if (user.roles.includes('SUPER_ADMIN')) return [...MARKETS]
  return user.markets
}

export function MarketSelect({
  value,
  onChange,
  allowAll,
}: {
  value: MarketCode | ''
  onChange: (value: MarketCode | '') => void
  allowAll?: boolean
}) {
  const { t } = useI18n()
  const st = useStaffT()
  const markets = useMyMarkets()
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as MarketCode | '')} aria-label={t('common.market')}>
      {allowAll && <option value="">{st('allMarkets')}</option>}
      {markets.map((market) => (
        <option key={market} value={market}>
          {t(`market.${market}`)}
        </option>
      ))}
    </select>
  )
}

/** Izvor provere je dummy ako tako kaže server ili ako počinje sa „DUMMY:”. */
export function isDummySource(item: { dummy: boolean; source: string | null }): boolean {
  return item.dummy || (item.source?.startsWith('DUMMY:') ?? false)
}

/** Statusi zahteva u kojima rok prvog odgovora još teče. */
const RESPONSE_PENDING: RequestStatus[] = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM']

/** Rok prvog odgovora je probijen, a zahtev još nije odgovoren. */
export function isRequestLate(request: Pick<BuyerRequest, 'firstResponseDueAt' | 'status'>, now = Date.now()): boolean {
  return new Date(request.firstResponseDueAt).getTime() < now && RESPONSE_PENDING.includes(request.status)
}

/** Aktivan ili neaktivan nalog: znak + reč + boja. */
export function ActiveBadge({ active }: { active: boolean }) {
  const st = useStaffT()
  return active ? (
    <StatusBadge text={st('active')} tone="ok" icon="check" />
  ) : (
    <StatusBadge text={st('inactive')} tone="idle" icon="minusCircle" />
  )
}

/** Oznaka „kasni”: rizik + sat. */
export function LateChip({ text }: { text: string }) {
  return (
    <Chip tone="risk" icon="clock" size="sm">
      {text}
    </Chip>
  )
}

/** Oznaka istekle provere: upozorenje + sat. */
export function ExpiredChip() {
  const st = useStaffT()
  return (
    <Chip tone="warn" icon="clock" size="sm">
      {st('expiredValidity')}
    </Chip>
  )
}

/**
 * Semafor (investitor, projekat, parcela) po uzoru na listu provera iz dizajna:
 * status | naslov i opis | metod | izvor, datum i rok. Tvrda blokada je puni fil.
 */
export function SemaphoreTable({ result, title }: { result: SemaphoreResult | null | undefined; title: string }) {
  const { t, l } = useI18n()
  const st = useStaffT()
  if (!result) return null
  return (
    <Card
      title={title}
      badge={
        <>
          <SemaphoreBadge status={result.overall} />
          {result.containsDummyData && <DummyTag />}
        </>
      }
    >
      <div className="stack">
        {result.hardBlocked && <HardBlock title={t('semaphore.hardBlocked')} icon="lock" />}
        {result.items.length === 0 ? (
          <Empty />
        ) : (
          <ul className="sem-list">
            {result.items.map((item: SemaphoreItem) => {
              const blocking = item.hardBlockOnRed && item.status === 'RED'
              return (
                <li
                  key={item.code}
                  className={['sem-item', item.expired && 'sem-item--expired', blocking && 'sem-item--block'].filter(Boolean).join(' ')}
                >
                  <span className="sem-item__status">
                    <SemaphoreBadge status={item.status} />
                  </span>
                  <span className="sem-item__text">
                    <span className="sem-item__title">
                      {l(item.title)}
                      {item.mandatory && <span className="sem-item__note"> · {st('mandatory')}</span>}
                      {blocking && <span className="sem-item__note"> · {st('hardBlock')}</span>}
                    </span>
                    {item.expired && (
                      <span>
                        <ExpiredChip />
                      </span>
                    )}
                    {item.summary && <span className="sem-item__summary">{item.summary}</span>}
                  </span>
                  <span className="sem-item__method">{st(`method.${item.method}`)}</span>
                  <SourceCell
                    source={item.source}
                    dummy={isDummySource(item)}
                    checkedAt={item.checkedAt}
                    validUntil={item.validUntil}
                    expired={item.expired}
                  />
                </li>
              )
            })}
          </ul>
        )}
        <Notice tone="plain">{result.disclaimer ? l(result.disclaimer) : t('common.notLegalAdvice')}</Notice>
      </div>
    </Card>
  )
}

/** Izvor provere, datum i rok važenja (mono). Istekla provera nosi „isteklo” umesto „važi do”. */
export function SourceCell({
  source,
  dummy,
  checkedAt,
  validUntil,
  expired,
}: {
  source: string | null
  dummy: boolean
  checkedAt: string | null
  validUntil: string | null
  expired: boolean
}) {
  const { formatDate } = useI18n()
  const st = useStaffT()
  if (!source && !checkedAt) return <span className="sem-item__source">—</span>
  return (
    <span className="sem-item__source">
      <span>
        {source ?? '—'} {dummy && <DummyTag />}
      </span>
      {checkedAt && <span>{formatDate(checkedAt)}</span>}
      {validUntil && (
        <span>
          {expired ? st('expired') : st('validUntil').toLowerCase()} {formatDate(validUntil)}
        </span>
      )}
    </span>
  )
}

/** Prva strana do 100 stavki, za padajuće liste (server: limit najviše 100). */
export const PICK_PAGE = { limit: 100, offset: 0 } as const

/**
 * Dokumenta projekta ili investitora: tabela sa paginacijom, preuzimanje i
 * otpremanje u modalu. Vrste dokumenata dolaze iz paketa tržišta (scope PROJECT ili DEVELOPER).
 */
export function DocumentsPanel({
  owner,
  market,
  canUpload,
}: {
  owner: { scope: 'PROJECT'; projectId: string } | { scope: 'DEVELOPER'; developerId: string }
  market: MarketCode
  canUpload: boolean
}) {
  const { t, l, formatDate } = useI18n()
  const st = useStaffT()
  const { get } = useMarkets()
  const [uploading, setUploading] = useState(false)
  const [downloadError, setDownloadError] = useState<unknown>(null)
  const ownerId = owner.scope === 'PROJECT' ? owner.projectId : owner.developerId
  const filter = owner.scope === 'PROJECT' ? { projectId: owner.projectId } : { developerId: owner.developerId }
  const list = usePagedQuery((page) => staffApi.documents(filter, page), [owner.scope, ownerId], { prefix: 'docs' })

  const typeTitle = (code: string) => {
    const type = get(market)?.documentTypes.find((candidate) => candidate.code === code)
    return type ? l(type.title) : code
  }

  const columns: Column<DocumentItem>[] = [
    {
      key: 'file',
      header: st('file'),
      cell: (document) => (
        <span className="cell-title">
          <strong>{document.fileName}</strong>
          <span className="meta">{typeTitle(document.typeCode)}</span>
        </span>
      ),
    },
    { key: 'size', header: st('size'), align: 'end', hideOnMobile: true, cell: (document) => formatSize(document.sizeBytes) },
    { key: 'date', header: t('common.date'), mono: true, cell: (document) => formatDate(document.createdAt) },
  ]

  return (
    <div className="stack">
      <ErrorBox error={downloadError} />
      <DataTable
        title={st('documents')}
        caption={st('documents')}
        columns={columns}
        rows={list.rows}
        rowKey={(document) => document.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={st('documents.none')}
        actions={
          canUpload && (
            <Button size="sm" variant="primary" icon="upload" onClick={() => setUploading(true)}>
              {st('uploadDocument')}
            </Button>
          )
        }
        rowActions={(document) => (
          <Button
            size="sm"
            variant="quiet"
            icon="download"
            onClick={() => {
              setDownloadError(null)
              void staffApi.downloadDocument(document).catch(setDownloadError)
            }}
          >
            {t('common.download')}
          </Button>
        )}
      />
      {canUpload && (
        <UploadDocumentModal
          open={uploading}
          onClose={() => setUploading(false)}
          owner={owner}
          types={(get(market)?.documentTypes ?? []).filter((type) => type.scopes.includes(owner.scope)).map((type) => ({ code: type.code, title: l(type.title) }))}
          onUploaded={list.reload}
        />
      )}
    </div>
  )
}

function UploadDocumentModal({
  open,
  onClose,
  owner,
  types,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  owner: { scope: 'PROJECT'; projectId: string } | { scope: 'DEVELOPER'; developerId: string }
  types: { code: string; title: string }[]
  onUploaded: () => void
}) {
  const st = useStaffT()
  const [typeCode, setTypeCode] = useState('')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) {
      setTypeCode('')
      setFile(null)
    }
  }, [open])

  const tooLarge = file !== null && file.size > MAX_UPLOAD_BYTES

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('uploadDocument')}
      description={st('form.doc.description')}
      submitLabel={st('uploadDocument')}
      dirty={Boolean(file || typeCode)}
      disabledReason={!typeCode || !file ? st('requiredFields') : tooLarge ? st('form.doc.tooLarge') : null}
      onSubmit={async () => {
        if (!file) return
        await staffApi.uploadDocument(owner, typeCode, file)
        onUploaded()
      }}
    >
      <Field label={st('documentType')} required info={st('form.doc.typeInfo')}>
        <select value={typeCode} onChange={(event) => setTypeCode(event.target.value)}>
          <option value="">—</option>
          {types.map((type) => (
            <option key={type.code} value={type.code}>
              {type.title}
            </option>
          ))}
        </select>
      </Field>
      <FileField file={file} onChange={setFile} info={st('form.doc.fileInfo')} />
    </FormModal>
  )
}

/** Najveći fajl koji server prima (documents/file-validation: 20 MB). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/** Izbor fajla (PDF, JPG, PNG do 20 MB): veličina izabranog fajla u napomeni, prevelik fajl kao greška uz polje. */
export function FileField({ file, onChange, info }: { file: File | null; onChange: (file: File | null) => void; info: string }) {
  const st = useStaffT()
  const tooLarge = file !== null && file.size > MAX_UPLOAD_BYTES
  return (
    <Field
      label={st('file')}
      required
      info={info}
      hint={file ? `${file.name} · ${formatSize(file.size)}` : st('form.doc.fileHint')}
      error={tooLarge ? st('form.doc.tooLarge') : null}
    >
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
    </Field>
  )
}

/** Veličina fajla (KB / MB). */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Datum u obliku YYYY-MM-DD za <input type="date">. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
