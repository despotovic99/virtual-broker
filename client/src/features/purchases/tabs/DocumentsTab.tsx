import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../../core/markets/MarketsContext.tsx'
import { Button } from '../../../ui/components.tsx'
import { DataTable, type Column } from '../../../ui/DataTable.tsx'
import { FormModal } from '../../../ui/Modal.tsx'
import { usePagedQuery } from '../../../ui/usePagination.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentFileFields, DownloadButton, usePurchaseT } from '../shared.tsx'
import type { DocumentItem, PurchaseDetail } from '../types.ts'

/** Dokumenta kupovine: tabela sa paginacijom, otpremanje u modalu. */
export function DocumentsTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { l, formatDate, formatNumber } = useI18n()
  const { can } = useAuth()
  const { get } = useMarkets()
  const list = usePagedQuery((page) => purchasesApi.documents(purchase.id, page), [purchase.id])
  const [uploading, setUploading] = useState(false)
  const typeTitle = (code: string) => {
    const type = get(purchase.market)?.documentTypes.find((definition) => definition.code === code)
    return type ? l(type.title) : code
  }
  const total = list.data?.total ?? 0

  const columns: Column<DocumentItem>[] = [
    {
      key: 'name',
      header: tt('docs.name'),
      cell: (document) => (
        <span className="cell-title">
          <strong>{document.fileName}</strong>
        </span>
      ),
    },
    { key: 'type', header: tt('docs.type'), cell: (document) => typeTitle(document.typeCode) },
    { key: 'date', header: tt('docs.date'), mono: true, cell: (document) => formatDate(document.createdAt) },
    {
      key: 'size',
      header: tt('docs.sizeLabel'),
      align: 'end',
      hideOnMobile: true,
      cell: (document) => tt('docs.size', { size: formatNumber(Math.ceil(document.sizeBytes / 1024)) }),
    },
  ]

  return (
    <>
      <DataTable
        title={tt('docs.title')}
        badge={total > 0 ? <span className="count">{total}</span> : undefined}
        actions={
          can('documents:upload') && (
            <Button variant="primary" size="sm" icon="upload" onClick={() => setUploading(true)}>
              {tt('docs.uploadTitle')}
            </Button>
          )
        }
        caption={tt('docs.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(document) => document.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={tt('docs.none')}
        rowActions={(document) => <DownloadButton document={document} />}
      />
      {can('documents:upload') && (
        <UploadDocumentModal purchase={purchase} open={uploading} onClose={() => setUploading(false)} onUploaded={list.reload} />
      )}
    </>
  )
}

/** Otpremanje dokumenta kupovine (vrsta + fajl). */
function UploadDocumentModal({
  purchase,
  open,
  onClose,
  onUploaded,
}: {
  purchase: PurchaseDetail
  open: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const tt = usePurchaseT()
  const { t } = useI18n()
  const [type, setType] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const close = () => {
    setType('')
    setFile(null)
    onClose()
  }

  const submit = async () => {
    if (!file || !type) return
    await purchasesApi.uploadDocument(purchase.id, type, file)
    setType('')
    setFile(null)
    onUploaded()
  }

  return (
    <FormModal
      open={open}
      onClose={close}
      title={tt('docs.uploadTitle')}
      description={tt('form.doc.uploadDescription')}
      submitLabel={t('common.upload')}
      onSubmit={submit}
      disabledReason={file && type ? null : tt('docs.chooseFile')}
      dirty={Boolean(file)}
    >
      {open && <DocumentFileFields purchase={purchase} type={type} onType={setType} onFile={setFile} required />}
    </FormModal>
  )
}
