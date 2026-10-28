import { useState } from 'react'
import { download } from '../../core/api/http.ts'
import type { Role } from '../../core/auth/capabilities.ts'
import { useLocalT, useI18n } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { ErrorBox } from '../../ui/components.tsx'
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
  return roles.some((role) => {
    if (role === 'ANALYST') return userRoles.includes('ANALYST') && hasRelation(purchase, 'INTERNAL')
    const relation = RELATION_FOR_ROLE[role]
    return relation !== undefined && hasRelation(purchase, relation)
  })
}

export function DownloadButton({ document }: { document: Pick<DocumentItem, 'id' | 'fileName'> }) {
  const { t } = useI18n()
  const [error, setError] = useState<unknown>(null)
  return (
    <>
      <button type="button" onClick={() => void download(`/documents/${document.id}/content`, document.fileName).catch(setError)}>
        {t('common.download')}
      </button>
      <ErrorBox error={error} />
    </>
  )
}

/**
 * Otpremanje jednog dokumenta kupovine. Kada je `typeCode` zadat, vrsta je
 * fiksna; inače korisnik bira među vrstama za PURCHASE iz paketa tržišta.
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
  const { get } = useMarkets()
  const types = (get(purchase.market)?.documentTypes ?? []).filter((type) => type.scopes.includes('PURCHASE'))
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

  return (
    <div className="row">
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
      <button type="button" disabled={!file || !selectedType || busy} onClick={() => void submit()}>
        {t('common.upload')}
      </button>
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
