import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../../core/markets/MarketsContext.tsx'
import { Card, Empty, ErrorBox, Loading } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentUpload, DownloadButton, usePurchaseT } from '../shared.tsx'

export function DocumentsTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { l, formatDate, formatNumber } = useI18n()
  const { can } = useAuth()
  const { get } = useMarkets()
  const documents = useAsync(() => purchasesApi.documents(purchase.id), [purchase.id])
  const typeTitle = (code: string) => {
    const type = get(purchase.market)?.documentTypes.find((definition) => definition.code === code)
    return type ? l(type.title) : code
  }

  return (
    <Card title={tt('docs.title')}>
      {can('documents:upload') && <DocumentUpload purchase={purchase} onUploaded={() => documents.reload()} />}
      <ErrorBox error={documents.error} />
      {documents.loading && !documents.data && <Loading />}
      {documents.data && documents.data.length === 0 && <Empty />}
      {documents.data && documents.data.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table>
            <tbody>
              {documents.data.map((document) => (
                <tr key={document.id}>
                  <td>
                    <strong>{typeTitle(document.typeCode)}</strong>
                    <div className="muted">{document.fileName}</div>
                  </td>
                  <td className="muted">
                    {tt('docs.uploaded', { date: formatDate(document.createdAt) })} ·{' '}
                    {tt('docs.size', { size: formatNumber(Math.ceil(document.sizeBytes / 1024)) })}
                  </td>
                  <td>
                    <DownloadButton document={document} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
