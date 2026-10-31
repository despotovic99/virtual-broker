import { useRef, useState, type ReactNode } from 'react'
import { download } from '../../core/api/http.ts'
import type { Role } from '../../core/auth/capabilities.ts'
import { useLocalT, useI18n } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Button, ErrorBox, Field } from '../../ui/components.tsx'
import { Icon } from '../../ui/icons.tsx'
import { purchasesApi } from './api.ts'
import { purchasesDictionary } from './i18n.ts'
import type { DocumentItem, Person, PurchaseDetail, PurchaseRelation } from './types.ts'

export function usePurchaseT() {
  return useLocalT(purchasesDictionary)
}

export function personName(person: Person | null | undefined): string {
  return person ? `${person.firstName} ${person.lastName}` : ''
}

/** Veze prijavljenog korisnika sa kupovinom (iz odgovora servera). */
export function hasRelation(purchase: PurchaseDetail, ...relations: PurchaseRelation[]): boolean {
  return relations.some((relation) => purchase.myRelations.includes(relation))
}

/** Koordinator kupovine ili naš tim na tržištu. */
export function isManager(purchase: PurchaseDetail): boolean {
  return hasRelation(purchase, 'COORDINATOR', 'INTERNAL')
}

/** Admin na tržištu kupovine: sme svaku radnju (server isto proverava). */
export function isAdmin(purchase: PurchaseDetail): boolean {
  return hasRelation(purchase, 'ADMIN')
}

/** Da li je korisnik samo kupac na ovoj kupovini (bez drugih veza). */
export function isOnlyBuyer(purchase: PurchaseDetail): boolean {
  return purchase.myRelations.length > 0 && purchase.myRelations.every((relation) => relation === 'BUYER')
}

const RELATION_FOR_ROLE: Partial<Record<Role, PurchaseRelation>> = {
  BUYER: 'BUYER',
  LAWYER: 'LAWYER',
  ENGINEER: 'ENGINEER',
}

/** Da li korisnik po vezi sa kupovinom odgovara nekoj od uloga (vlasnik koraka, potvrđivač uslova). */
export function matchesRoles(purchase: PurchaseDetail, roles: readonly Role[], userRoles: readonly Role[]): boolean {
  if (isAdmin(purchase)) return true
  return roles.some((role) => {
    if (role === 'ANALYST') return userRoles.includes('ANALYST') && hasRelation(purchase, 'INTERNAL')
    const relation = RELATION_FOR_ROLE[role]
    return relation !== undefined && hasRelation(purchase, relation)
  })
}

export function DownloadButton({ document }: { document: Pick<DocumentItem, 'id' | 'fileName'> }) {
  const { t } = useI18n()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await download(`/documents/${document.id}/content`, document.fileName)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" icon="download" busy={busy} onClick={() => void run()}>
        {t('common.download')}
      </Button>
      <ErrorBox error={error} />
    </>
  )
}

/** Skraćen tekst za ćeliju tabele; ceo tekst ide u `title` ili u modal „Detalji”. */
export function shorten(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** Vrste dokumenata za kupovinu iz paketa tržišta. */
function usePurchaseDocumentTypes(purchase: Pick<PurchaseDetail, 'market'>) {
  const { get } = useMarkets()
  return (get(purchase.market)?.documentTypes ?? []).filter((type) => type.scopes.includes('PURCHASE'))
}

/**
 * Polja za izbor dokumenta (vrsta + fajl), bez dugmeta: koristi ih obrazac u
 * modalu ili na strani, a otpremanje radi njegov `onSubmit` (`useUploadOnce`).
 * Kada je `typeCode` zadat, vrsta je fiksna.
 */
export function DocumentFileFields({
  purchase,
  typeCode,
  type,
  onType,
  onFile,
  label,
  required = false,
  info,
  hint,
}: {
  purchase: Pick<PurchaseDetail, 'market'>
  typeCode?: string
  type?: string
  onType?: (code: string) => void
  onFile: (file: File | null) => void
  label?: string
  /** Fajl (i vrsta, kad se bira) je obavezan: zvezdica uz naziv. */
  required?: boolean
  /** Objašnjenje na ikonici „i” uz polje za fajl (šta se prilaže i zašto). */
  info?: ReactNode
  /** Dodatni savet ispod polja, ispred dozvoljenih oblika. */
  hint?: string
}) {
  const tt = usePurchaseT()
  const { l } = useI18n()
  const types = usePurchaseDocumentTypes(purchase)
  return (
    <>
      {!typeCode && (
        <Field label={tt('docs.type')} required={required} info={tt('form.doc.typeInfo')}>
          <select value={type ?? ''} onChange={(event) => onType?.(event.target.value)}>
            <option value="">—</option>
            {types.map((definition) => (
              <option key={definition.code} value={definition.code}>
                {l(definition.title)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={label ?? tt('docs.file')} required={required} info={info} hint={hint ? `${hint} ${tt('docs.allowed')}` : tt('docs.allowed')} wide>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      </Field>
    </>
  )
}

/**
 * Otpremanje u okviru obrasca: isti fajl se ne šalje dvaput kada drugi korak
 * (npr. upis punomoćja) ne uspe, pa korisnik pokuša ponovo.
 */
export function useUploadOnce(purchaseId: string) {
  const last = useRef<{ file: File; typeCode: string; document: DocumentItem } | null>(null)
  return async (typeCode: string, file: File): Promise<DocumentItem> => {
    if (last.current && last.current.file === file && last.current.typeCode === typeCode) return last.current.document
    const document = await purchasesApi.uploadDocument(purchaseId, typeCode, file)
    last.current = { file, typeCode, document }
    return document
  }
}

/**
 * Otpremanje jednog dokumenta kupovine na licu mesta (polja + dugme). Kada je
 * `typeCode` zadat, vrsta je fiksna; inače korisnik bira među vrstama za
 * PURCHASE iz paketa tržišta. Obrasci u modalu koriste `DocumentFileFields`.
 */
export function DocumentUpload({
  purchase,
  typeCode,
  label,
  onUploaded,
}: {
  purchase: PurchaseDetail
  typeCode?: string
  label?: string
  onUploaded: (document: DocumentItem) => void
}) {
  const tt = usePurchaseT()
  const { t, l } = useI18n()
  const types = usePurchaseDocumentTypes(purchase)
  const [selectedType, setSelectedType] = useState(typeCode ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!file || !selectedType) return
    setBusy(true)
    setError(null)
    try {
      const document = await purchasesApi.uploadDocument(purchase.id, selectedType, file)
      setFile(null)
      onUploaded(document)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(file && selectedType)

  return (
    <div className="stack stack--sm">
      <div className="dropzone">
        <span className="dropzone__icon">
          <Icon name="upload" size={17} />
        </span>
        {!typeCode && (
          <select aria-label={tt('docs.type')} value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="">{tt('docs.type')}</option>
            {types.map((type) => (
              <option key={type.code} value={type.code}>
                {l(type.title)}
              </option>
            ))}
          </select>
        )}
        <input
          type="file"
          aria-label={label ?? tt('docs.file')}
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <Button icon="upload" busy={busy} disabled={!ready} title={ready ? undefined : tt('docs.chooseFile')} onClick={() => void submit()}>
          {t('common.upload')}
        </Button>
      </div>
      <span className="field-hint">{tt('docs.allowed')}</span>
      <ErrorBox error={error} />
    </div>
  )
}

/** Izbor jednog već otpremljenog dokumenta kupovine (npr. dokaz uz uslov). */
export function DocumentSelect({
  documents,
  value,
  onChange,
  typeCodes,
  label,
}: {
  documents: DocumentItem[]
  value: string
  onChange: (id: string) => void
  typeCodes?: string[]
  label: string
}) {
  const filtered = typeCodes ? documents.filter((document) => typeCodes.includes(document.typeCode)) : documents
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {filtered.map((document) => (
        <option key={document.id} value={document.id}>
          {document.fileName}
        </option>
      ))}
    </select>
  )
}
