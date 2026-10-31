import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Button, Field, FormSection, InfoTip, Notice, StatusBadge } from '../../../ui/components.tsx'
import { DataTable, type Column } from '../../../ui/DataTable.tsx'
import { Icon } from '../../../ui/icons.tsx'
import { ConfirmDialog, FormModal, Modal } from '../../../ui/Modal.tsx'
import { statusSignal } from '../../../ui/status.ts'
import { useAsync } from '../../../ui/useAsync.ts'
import { useClientPagination } from '../../../ui/usePagination.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentFileFields, DownloadButton, hasRelation, isAdmin, shorten, usePurchaseT, useUploadOnce } from '../shared.tsx'
import { POA_SCOPES, type LegalOpinion, type PoaScope, type PowerOfAttorney, type PurchaseDetail } from '../types.ts'

export function LegalTab(props: TabProps) {
  return (
    <div className="stack">
      <PowersOfAttorney {...props} />
      <Opinions {...props} />
    </div>
  )
}

/** Advokat iz tima kupovine (LEAD ili LAWYER) ili admin na tržištu sme da potpiše mišljenje. */
export function useOpinionSigning(purchase: PurchaseDetail | undefined) {
  const { can } = useAuth()
  const mayCreate = can('legal-opinions:sign')
  const isLawyer = purchase !== undefined && hasRelation(purchase, 'LAWYER') && mayCreate
  const teams = useAsync(() => (isLawyer ? purchasesApi.myLegalTeams() : Promise.resolve([])), [isLawyer])
  const myRole = teams.data?.find((team) => team.id === purchase?.legalTeam?.id)?.myRole
  const canSign = purchase !== undefined && ((isLawyer && (myRole === 'LEAD' || myRole === 'LAWYER')) || (isAdmin(purchase) && mayCreate))
  return { isLawyer, myRole, canSign, loading: teams.loading }
}

function scopeLabel(value: string, tt: ReturnType<typeof usePurchaseT>): string {
  return (POA_SCOPES as readonly string[]).includes(value) ? tt(`scope.${value as PoaScope}`) : value
}

function PowersOfAttorney({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const { can } = useAuth()
  const list = useAsync(() => purchasesApi.powersOfAttorney(purchase.id), [purchase.id])
  const { rows, pagination } = useClientPagination(list.data)
  const isBuyer = hasRelation(purchase, 'BUYER')
  const canAdd = can('power-of-attorney:manage') && (hasRelation(purchase, 'BUYER', 'LAWYER') || isAdmin(purchase))
  const canRevoke = (isBuyer || isAdmin(purchase)) && can('power-of-attorney:manage')
  const [adding, setAdding] = useState(false)
  const [revoking, setRevoking] = useState<PowerOfAttorney | null>(null)

  const poaSignal = (poa: PowerOfAttorney) =>
    poa.valid
      ? { text: tt('legal.poaValid'), tone: 'ok' as const, icon: 'check' as const }
      : poa.revokedAt
        ? { text: tt('legal.revoked'), tone: 'idle' as const, icon: 'cancel' as const }
        : { text: tt('legal.poaInvalid'), tone: 'idle' as const, icon: 'clock' as const }

  const columns: Column<PowerOfAttorney>[] = [
    {
      key: 'scope',
      header: tt('legal.poaScope'),
      cell: (poa) => (
        <span className="cell-title">
          <strong>{poa.scope.map((value) => scopeLabel(value, tt)).join(', ')}</strong>
        </span>
      ),
    },
    { key: 'created', header: tt('docs.date'), mono: true, hideOnMobile: true, cell: (poa) => formatDate(poa.createdAt) },
    { key: 'validUntil', header: tt('legal.validUntilLabel'), mono: true, cell: (poa) => (poa.validUntil ? formatDate(poa.validUntil) : '—') },
    {
      key: 'status',
      header: tt('legal.statusLabel'),
      cell: (poa) => {
        const signal = poaSignal(poa)
        return <StatusBadge text={signal.text} tone={signal.tone} icon={signal.icon} />
      },
    },
  ]

  return (
    <>
      <Notice tone="plain">{tt('legal.poaExplain')}</Notice>
      <DataTable
        title={tt('legal.poaTitle')}
        badge={list.data && list.data.length > 0 ? <span className="count">{list.data.length}</span> : undefined}
        actions={
          canAdd && (
            <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>
              {tt('legal.poaAdd')}
            </Button>
          )
        }
        caption={tt('legal.poaTitle')}
        columns={columns}
        rows={rows}
        rowKey={(poa) => poa.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={pagination}
        empty={tt('legal.poaNone')}
        rowActions={(poa) => (
          <span className="row-actions">
            <DownloadButton document={{ id: poa.documentId, fileName: 'punomocje.pdf' }} />
            {canRevoke && poa.valid && (
              <Button size="sm" variant="danger" onClick={() => setRevoking(poa)}>
                {tt('legal.poaRevoke')}
              </Button>
            )}
          </span>
        )}
      />
      {canAdd && <NewPoaModal purchase={purchase} open={adding} onClose={() => setAdding(false)} onCreated={list.reload} />}
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={tt('legal.poaRevokeTitle')}
        text={tt('legal.poaRevokeConfirm')}
        confirmLabel={tt('legal.poaRevoke')}
        danger
        onConfirm={async () => {
          if (!revoking) return
          await purchasesApi.revokePowerOfAttorney(revoking.id)
          list.reload()
        }}
      />
    </>
  )
}

/** Novo punomoćje: potpisan PDF, obim radnji i rok važenja. */
function NewPoaModal({ purchase, open, onClose, onCreated }: { purchase: PurchaseDetail; open: boolean; onClose: () => void; onCreated: () => void }) {
  const tt = usePurchaseT()
  const { t } = useI18n()
  const upload = useUploadOnce(purchase.id)
  const [file, setFile] = useState<File | null>(null)
  const [scope, setScope] = useState<PoaScope[]>([])
  const [validUntil, setValidUntil] = useState('')

  const close = () => {
    setFile(null)
    setScope([])
    setValidUntil('')
    onClose()
  }

  const toggle = (value: PoaScope) =>
    setScope((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))

  const submit = async () => {
    if (!file) return
    const document = await upload('POWER_OF_ATTORNEY', file)
    await purchasesApi.createPowerOfAttorney(purchase.id, { documentId: document.id, scope, ...(validUntil ? { validUntil } : {}) })
    onCreated()
  }

  const ready = Boolean(file) && scope.length > 0

  return (
    <FormModal
      open={open}
      onClose={close}
      title={tt('legal.poaAdd')}
      description={tt('legal.poaExplain')}
      size="lg"
      submitLabel={tt('legal.poaAdd')}
      onSubmit={submit}
      disabledReason={ready ? null : tt('legal.poaRequired')}
      dirty={Boolean(file) || scope.length > 0}
    >
      <FormSection title={tt('form.poa.fileTitle')} description={tt('form.poa.fileHint')} columns={1}>
        <DocumentFileFields
          purchase={purchase}
          typeCode="POWER_OF_ATTORNEY"
          label={tt('legal.poaDocument')}
          required
          info={tt('form.poa.fileInfo')}
          onFile={setFile}
        />
      </FormSection>
      <FormSection title={tt('form.poa.scopeTitle')} description={tt('form.poa.scopeHint')} columns={2}>
        <fieldset>
          <legend>
            <span className="row">
              <span>
                {tt('legal.poaScope')}
                <span className="field-required" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> ({t('common.required')})</span>
              </span>
              <InfoTip text={tt('form.poa.scopeInfo')} />
            </span>
          </legend>
          <div className="checks">
            {POA_SCOPES.map((value) => (
              <label key={value} className="check">
                <input type="checkbox" checked={scope.includes(value)} onChange={() => toggle(value)} />
                {tt(`scope.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={tt('form.poa.validUntil')} info={tt('form.poa.validUntilInfo')} hint={t('common.optional')}>
          <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
        </Field>
      </FormSection>
    </FormModal>
  )
}

function Opinions({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate } = useI18n()
  const list = useAsync(() => purchasesApi.opinions(purchase.id), [purchase.id])
  const { rows, pagination } = useClientPagination(list.data)
  const { isLawyer, myRole, canSign } = useOpinionSigning(purchase)
  const [viewing, setViewing] = useState<LegalOpinion | null>(null)
  const associate = isLawyer && myRole === 'ASSOCIATE'

  const columns: Column<LegalOpinion>[] = [
    { key: 'date', header: tt('docs.date'), mono: true, cell: (opinion) => formatDate(opinion.createdAt) },
    {
      key: 'conclusion',
      header: tt('legal.conclusion'),
      cell: (opinion) => <StatusBadge text={tt(`conclusion.${opinion.conclusion}`)} {...statusSignal('conclusion', opinion.conclusion)} />,
    },
    {
      key: 'reasoning',
      header: tt('legal.reasoning'),
      hideOnMobile: true,
      cell: (opinion) => (
        <span className="cell-title">
          <span title={opinion.reasoning}>{shorten(opinion.reasoning)}</span>
          {opinion.conditions && <span className="meta">{tt('legal.hasConditions')}</span>}
        </span>
      ),
    },
  ]

  return (
    <>
      <DataTable
        title={tt('legal.opinionsTitle')}
        badge={list.data && list.data.length > 0 ? <span className="count">{list.data.length}</span> : undefined}
        actions={
          canSign ? (
            <Link className="btn btn--primary btn--sm" to={`/purchases/${purchase.id}/opinions/new`}>
              <Icon name="plus" size={13} />
              {tt('legal.opinionNew')}
            </Link>
          ) : associate ? (
            <Button variant="primary" size="sm" icon="plus" disabled title={tt('legal.associateCannotSign')}>
              {tt('legal.opinionNew')}
            </Button>
          ) : undefined
        }
        caption={tt('legal.opinionsTitle')}
        columns={columns}
        rows={rows}
        rowKey={(opinion) => opinion.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={pagination}
        empty={tt('legal.opinionsNone')}
        rowActions={(opinion) => (
          <span className="row-actions">
            <Button size="sm" variant="quiet" icon="eye" onClick={() => setViewing(opinion)}>
              {tt('legal.details')}
            </Button>
            {opinion.documentId && <DownloadButton document={{ id: opinion.documentId, fileName: 'pravno-misljenje.pdf' }} />}
          </span>
        )}
      />
      {associate && <Notice tone="plain">{tt('legal.associateCannotSign')}</Notice>}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={tt('legal.opinionDetails')}
        size="lg"
        description={viewing ? formatDate(viewing.createdAt) : undefined}
      >
        {viewing && (
          <div className="stack">
            <span className="row">
              <StatusBadge text={tt(`conclusion.${viewing.conclusion}`)} {...statusSignal('conclusion', viewing.conclusion)} />
            </span>
            <div className="stack stack--sm">
              <span className="eyebrow">{tt('legal.reasoning')}</span>
              <p className="pre">{viewing.reasoning}</p>
            </div>
            {viewing.conditions && (
              <div className="stack stack--sm">
                <span className="eyebrow">{tt('legal.conditionsLabel')}</span>
                <p className="pre">{viewing.conditions}</p>
              </div>
            )}
            {viewing.documentId && (
              <div className="row">
                <DownloadButton document={{ id: viewing.documentId, fileName: 'pravno-misljenje.pdf' }} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
