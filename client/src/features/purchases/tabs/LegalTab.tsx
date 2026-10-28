import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, StatusBadge } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentUpload, DownloadButton, hasRelation, usePurchaseT } from '../shared.tsx'
import { POA_SCOPES, type OpinionConclusion, type PoaScope } from '../types.ts'

const CONCLUSIONS: OpinionConclusion[] = ['SIGN', 'SIGN_WITH_CONDITIONS', 'DO_NOT_SIGN']

export function LegalTab(props: TabProps) {
  return (
    <>
      <PowersOfAttorney {...props} />
      <Opinions {...props} />
    </>
  )
}

function PowersOfAttorney({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const { can } = useAuth()
  const list = useAsync(() => purchasesApi.powersOfAttorney(purchase.id), [purchase.id])
  const isBuyer = hasRelation(purchase, 'BUYER')
  const canAdd = can('power-of-attorney:manage') && hasRelation(purchase, 'BUYER', 'LAWYER')

  const [documentId, setDocumentId] = useState<string | null>(null)
  const [scope, setScope] = useState<PoaScope[]>([])
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (value: PoaScope) =>
    setScope((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))

  const submit = async () => {
    if (!documentId) return
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.createPowerOfAttorney(purchase.id, { documentId, scope, ...(validUntil ? { validUntil } : {}) })
      setDocumentId(null)
      setScope([])
      setValidUntil('')
      list.reload()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    if (!window.confirm(tt('legal.poaRevokeConfirm'))) return
    setError(null)
    try {
      await purchasesApi.revokePowerOfAttorney(id)
      list.reload()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={tt('legal.poaTitle')}>
      <p className="muted">{tt('legal.poaExplain')}</p>
      <ErrorBox error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <Empty />}
      {list.data?.map((poa) => (
        <div key={poa.id} className="row" style={{ marginBottom: 8 }}>
          <StatusBadge text={poa.valid ? tt('legal.poaValid') : tt('legal.poaInvalid')} tone={poa.valid ? 'good' : 'neutral'} />
          <span>{poa.scope.map((value) => (POA_SCOPES as readonly string[]).includes(value) ? tt(`scope.${value as PoaScope}`) : value).join(', ')}</span>
          <span className="muted">
            {formatDate(poa.createdAt)}
            {poa.validUntil ? ` → ${formatDate(poa.validUntil)}` : ''}
          </span>
          <DownloadButton document={{ id: poa.documentId, fileName: 'punomocje.pdf' }} />
          {isBuyer && poa.valid && can('power-of-attorney:manage') && (
            <button type="button" onClick={() => void revoke(poa.id)}>
              {tt('legal.poaRevoke')}
            </button>
          )}
        </div>
      ))}

      {canAdd && (
        <div style={{ marginTop: 12 }}>
          <h3>{tt('legal.poaAdd')}</h3>
          <Field label={tt('legal.poaDocument')}>
            {documentId ? (
              <span className="muted">✓</span>
            ) : (
              <DocumentUpload purchase={purchase} typeCode="POWER_OF_ATTORNEY" onUploaded={(document) => setDocumentId(document.id)} />
            )}
          </Field>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="field-label">{tt('legal.poaScope')}</legend>
            {POA_SCOPES.map((value) => (
              <label key={value} className="row">
                <input type="checkbox" style={{ width: 'auto' }} checked={scope.includes(value)} onChange={() => toggle(value)} />
                {tt(`scope.${value}`)}
              </label>
            ))}
          </fieldset>
          <Field label={tt('legal.poaValidUntil')}>
            <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
          <button type="button" className="primary" disabled={!documentId || scope.length === 0 || busy} onClick={() => void submit()}>
            {tt('legal.poaAdd')}
          </button>
        </div>
      )}
      <ErrorBox error={error} />
    </Card>
  )
}

function Opinions({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const { can } = useAuth()
  const list = useAsync(() => purchasesApi.opinions(purchase.id), [purchase.id])
  const isLawyer = hasRelation(purchase, 'LAWYER') && can('legal-opinions:sign')
  const teams = useAsync(() => (isLawyer ? purchasesApi.myLegalTeams() : Promise.resolve([])), [isLawyer])
  const myRole = teams.data?.find((team) => team.id === purchase.legalTeam?.id)?.myRole
  const canSign = isLawyer && (myRole === 'LEAD' || myRole === 'LAWYER')

  const [conclusion, setConclusion] = useState<OpinionConclusion>('SIGN')
  const [reasoning, setReasoning] = useState('')
  const [conditions, setConditions] = useState('')
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!documentId) return
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.createOpinion(purchase.id, {
        conclusion,
        reasoning: reasoning.trim(),
        ...(conditions.trim() ? { conditions: conditions.trim() } : {}),
        documentId,
      })
      setReasoning('')
      setConditions('')
      setDocumentId(null)
      list.reload()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const tone = (value: OpinionConclusion) => (value === 'SIGN' ? 'good' : value === 'SIGN_WITH_CONDITIONS' ? 'warn' : 'bad')

  return (
    <Card title={tt('legal.opinionsTitle')}>
      <ErrorBox error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <Empty />}
      {list.data?.map((opinion) => (
        <div key={opinion.id} style={{ marginBottom: 12 }}>
          <div className="row">
            <StatusBadge text={tt(`conclusion.${opinion.conclusion}`)} tone={tone(opinion.conclusion)} />
            <span className="muted">{formatDate(opinion.createdAt)}</span>
            {opinion.documentId && <DownloadButton document={{ id: opinion.documentId, fileName: 'pravno-misljenje.pdf' }} />}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{opinion.reasoning}</p>
          {opinion.conditions && <p style={{ whiteSpace: 'pre-wrap' }} className="muted">{opinion.conditions}</p>}
        </div>
      ))}

      {isLawyer && myRole === 'ASSOCIATE' && <p className="muted">{tt('legal.associateCannotSign')}</p>}
      {canSign && (
        <div style={{ marginTop: 12 }}>
          <h3>{tt('legal.opinionNew')}</h3>
          <Field label={tt('legal.conclusion')}>
            <select value={conclusion} onChange={(event) => setConclusion(event.target.value as OpinionConclusion)}>
              {CONCLUSIONS.map((value) => (
                <option key={value} value={value}>
                  {tt(`conclusion.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tt('legal.reasoning')}>
            <textarea value={reasoning} maxLength={10_000} onChange={(event) => setReasoning(event.target.value)} />
          </Field>
          <Field label={tt('legal.conditions')}>
            <textarea value={conditions} maxLength={5_000} onChange={(event) => setConditions(event.target.value)} />
          </Field>
          <Field label={tt('legal.signedPdf')}>
            {documentId ? (
              <span className="muted">✓</span>
            ) : (
              <DocumentUpload purchase={purchase} typeCode="LEGAL_OPINION" onUploaded={(document) => setDocumentId(document.id)} />
            )}
          </Field>
          <button type="button" className="primary" disabled={!documentId || reasoning.trim().length < 10 || busy} onClick={() => void submit()}>
            {tt('legal.submitOpinion')}
          </button>
        </div>
      )}
      <ErrorBox error={error} />
    </Card>
  )
}
