import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Button, Card, ErrorState, Field, FormSection, Loading, Notice, Page, StatusBadge, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { ConfirmDialog, FormModal } from '../../ui/Modal.tsx'
import { Tabs, useUrlTab } from '../../ui/Tabs.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination, usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { useProjectColumns } from './CatalogPage.tsx'
import { ChecksPanel } from './ChecksPanel.tsx'
import { DocumentsPanel, SemaphoreTable, useStaffT } from './shared.tsx'
import type { BankAccount, Developer } from './types.ts'

const TABS = ['overview', 'accounts', 'checks', 'documents', 'projects'] as const

/** Detalj investitora: pregled, računi, provere, dokumenta i projekti (kartice u URL-u). */
export function DeveloperPage() {
  const { id = '' } = useParams()
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const developer = useAsync(() => staffApi.developer(id), [id])
  const accounts = useAsync(() => staffApi.bankAccounts(id), [id])
  const [tab, setTab] = useUrlTab(TABS, 'overview')

  if (developer.loading && !developer.data) return <Loading />
  if (!developer.data)
    return <ErrorState error={developer.error} onRetry={developer.reload} backTo={{ to: '/catalog', label: st('catalog.title') }} />
  const item = developer.data

  return (
    <Page
      title={item.name}
      crumbs={[{ label: st('catalog.title'), to: '/catalog' }, { label: st('catalog.developers'), to: '/catalog' }, { label: item.name }]}
      meta={
        <>
          <Tag>{t(`market.${item.market}`)}</Tag>
          <span className="meta">{item.registrationNumber}</span>
        </>
      }
      actions={
        <>
          <Link className="btn" to="/catalog">
            {t('common.back')}
          </Link>
          {can('catalog:manage') && (
            <Link className="btn btn--primary" to={`/catalog/developers/${item.id}/edit`}>
              <Icon name="edit" size={15} />
              {t('common.edit')}
            </Link>
          )}
        </>
      }
    >
      <div className="layout-aside">
        <div className="layout-aside__main">
          <div>
            <Tabs
              label={item.name}
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: st('tab.overview') },
                { id: 'accounts', label: st('tab.accounts'), count: accounts.data?.length },
                { id: 'checks', label: st('checks.title') },
                { id: 'documents', label: st('documents') },
                { id: 'projects', label: st('catalog.projects') },
              ]}
            />
            <div role="tabpanel">
              {tab === 'overview' && <DeveloperInfo developer={item} />}
              {tab === 'accounts' && (
                <BankAccounts developerId={item.id} accounts={accounts.data} loading={accounts.loading} error={accounts.error} reload={accounts.reload} />
              )}
              {tab === 'checks' && <DeveloperChecks developer={item} />}
              {tab === 'documents' && (
                <DocumentsPanel owner={{ scope: 'DEVELOPER', developerId: item.id }} market={item.market} canUpload={can('documents:upload')} />
              )}
              {tab === 'projects' && <DeveloperProjects developerId={item.id} canManage={can('catalog:manage')} />}
            </div>
          </div>
        </div>
        {can('audit:read') && (
          <aside className="layout-aside__side">
            <AuditTrail entityId={item.id} />
          </aside>
        )}
      </div>
    </Page>
  )
}

function DeveloperInfo({ developer }: { developer: Developer }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  return (
    <Card title={t('common.details')}>
      <dl className="dl">
        <dt>{t('common.market')}</dt>
        <dd>{t(`market.${developer.market}`)}</dd>
        <dt>{st('developer.registrationNumber')}</dt>
        <dd className="mono">{developer.registrationNumber}</dd>
        <dt>{st('developer.taxNumber')}</dt>
        <dd className={developer.taxNumber ? 'mono' : undefined}>{developer.taxNumber ?? '—'}</dd>
        <dt>{st('developer.address')}</dt>
        <dd>{developer.address ?? '—'}</dd>
        <dt>{st('developer.website')}</dt>
        <dd>
          {developer.website?.startsWith('https://') ? (
            <a href={developer.website} target="_blank" rel="noopener noreferrer nofollow">
              {developer.website}
            </a>
          ) : (
            '—'
          )}
        </dd>
        <dt>{st('created')}</dt>
        <dd className="mono">{formatDate(developer.createdAt)}</dd>
      </dl>
    </Card>
  )
}

function DeveloperChecks({ developer }: { developer: Developer }) {
  const st = useStaffT()
  const semaphore = useAsync(() => staffApi.developerSemaphore(developer.id), [developer.id])
  return (
    <>
      {semaphore.error && !semaphore.data ? (
        <ErrorState error={semaphore.error} onRetry={semaphore.reload} />
      ) : semaphore.loading && !semaphore.data ? (
        <Loading rows={4} />
      ) : (
        <SemaphoreTable title={st('checks.developerSemaphore')} result={semaphore.data} />
      )}
      <ChecksPanel target={{ developerId: developer.id }} market={developer.market} onChanged={semaphore.reload} />
    </>
  )
}

function DeveloperProjects({ developerId, canManage }: { developerId: string; canManage: boolean }) {
  const st = useStaffT()
  const list = usePagedQuery((page) => staffApi.projects({ developerId, ...page }), [developerId], { prefix: 'projects' })
  const columns = useProjectColumns(false)
  const newLink = `/catalog/projects/new?developerId=${developerId}`
  return (
    <DataTable
      title={st('catalog.projects')}
      caption={st('catalog.projects')}
      columns={columns}
      rows={list.rows}
      rowKey={(project) => project.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      pagination={list.pagination}
      empty={st('catalog.noProjects')}
      actions={
        canManage && (
          <Link className="btn btn--primary btn--sm" to={newLink}>
            <Icon name="plus" size={13} />
            {st('catalog.newProject')}
          </Link>
        )
      }
      rowActions={(project) => (
        <Link className="btn btn--quiet btn--sm" to={`/catalog/projects/${project.id}`}>
          {st('open')}
        </Link>
      )}
    />
  )
}

/**
 * Računi investitora (F-16), pravilo četiri oka: račun proverava druga osoba,
 * ne ona koja ga je unela (server vraća BANK_ACCOUNT_SAME_VERIFIER). Dugme
 * „Potvrdi račun” ostaje na mestu i kod osobe koja je račun unela, ali je
 * onesposobljeno uz razlog.
 */
function BankAccounts({
  developerId,
  accounts,
  loading,
  error,
  reload,
}: {
  developerId: string
  accounts: BankAccount[] | undefined
  loading: boolean
  error: unknown
  reload: () => void
}) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { can, user } = useAuth()
  const { rows, pagination } = useClientPagination(accounts)
  const [adding, setAdding] = useState(false)
  const [verifying, setVerifying] = useState<BankAccount | null>(null)
  const canVerify = can('bank-accounts:verify')
  const enteredByMe = (account: BankAccount) => account.createdById === user?.id

  const columns: Column<BankAccount>[] = [
    { key: 'iban', header: st('account.iban'), mono: true, cell: (account) => <span className="staff-iban">{account.iban}</span> },
    { key: 'bank', header: st('account.bank'), cell: (account) => account.bankName },
    { key: 'holder', header: st('account.holder'), hideOnMobile: true, cell: (account) => account.holderName },
    {
      key: 'entered',
      header: st('account.enteredBy'),
      hideOnMobile: true,
      cell: (account) => (
        <span className="cell-title">
          {enteredByMe(account) ? <strong>{st('you')}</strong> : <span className="mono">{account.createdById ? account.createdById.slice(0, 8) : '—'}</span>}
          <span className="meta">{formatDate(account.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'verified',
      header: t('common.status'),
      cell: (account) =>
        account.verified ? (
          <span className="cell-title">
            <StatusBadge text={st('account.verified')} tone="ok" icon="check" />
            <span className="meta" title={account.verificationNote ?? undefined}>
              {formatDate(account.verifiedAt)}
            </span>
          </span>
        ) : (
          <StatusBadge text={st('account.notVerified')} tone="warn" icon="clock" />
        ),
    },
  ]

  return (
    <>
      {canVerify && <Notice tone="info" icon="info">{st('account.fourEyes')}</Notice>}
      <DataTable
        title={st('developer.accounts')}
        caption={st('developer.accounts')}
        columns={columns}
        rows={rows}
        rowKey={(account) => account.id}
        loading={loading}
        error={error}
        onRetry={reload}
        pagination={pagination}
        empty={st('account.none')}
        rowClassName={(account) => (!account.verified && enteredByMe(account) ? 'row--warn' : undefined)}
        actions={
          can('catalog:manage') && (
            <Button size="sm" variant="primary" icon="plus" onClick={() => setAdding(true)}>
              {st('developer.addAccount')}
            </Button>
          )
        }
        rowActions={
          canVerify
            ? (account) =>
                account.verified ? null : (
                  <Button
                    size="sm"
                    variant={enteredByMe(account) ? 'secondary' : 'primary'}
                    disabled={enteredByMe(account)}
                    title={enteredByMe(account) ? st('account.sameUserReason') : undefined}
                    onClick={() => setVerifying(account)}
                  >
                    {st('account.confirm')}
                  </Button>
                )
            : undefined
        }
      />
      <AddAccountModal open={adding} onClose={() => setAdding(false)} developerId={developerId} onAdded={reload} />
      <ConfirmDialog
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        title={st('account.confirm')}
        text={
          verifying ? (
            <>
              <span className="mono">{verifying.iban}</span> · {verifying.holderName} · {verifying.bankName}
              <br />
              {st('account.fourEyes')}
            </>
          ) : undefined
        }
        confirmLabel={st('account.verify')}
        reason={{ label: st('account.verifyNote'), minLength: 3, hint: st('form.account.verifyHint') }}
        onConfirm={async (note) => {
          if (!verifying) return
          await staffApi.verifyBankAccount(verifying.id, note)
          reload()
        }}
      />
    </>
  )
}

function AddAccountModal({ open, onClose, developerId, onAdded }: { open: boolean; onClose: () => void; developerId: string; onAdded: () => void }) {
  const st = useStaffT()
  const [form, setForm] = useState({ iban: '', bankName: '', holderName: '' })

  useEffect(() => {
    if (open) setForm({ iban: '', bankName: '', holderName: '' })
  }, [open])

  const iban = form.iban.replace(/\s+/g, '').toUpperCase()
  const incomplete = iban.length < 15 || !form.bankName.trim() || !form.holderName.trim()
  // Isto pravilo kao na serveru (catalog.dto): oznaka zemlje, dve cifre, 15–34 znaka.
  const ibanError = iban.length > 0 && (iban.length < 15 || iban.length > 34 || !/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) ? st('form.account.ibanInvalid') : null
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('developer.addAccount')}
      description={st('form.account.description')}
      submitLabel={st('developer.addAccount')}
      size="lg"
      dirty={Boolean(form.iban || form.bankName || form.holderName)}
      disabledReason={incomplete ? st('requiredFields') : null}
      onSubmit={async () => {
        await staffApi.addBankAccount(developerId, {
          iban: form.iban.replace(/\s+/g, '').toUpperCase(),
          bankName: form.bankName.trim(),
          holderName: form.holderName.trim(),
        })
        onAdded()
      }}
    >
      <FormSection title={st('form.account.section')} columns={2}>
        <Field label={st('account.iban')} required info={st('form.account.ibanInfo')} hint={st('form.account.ibanHint')} error={ibanError} wide>
          <input className="mono" value={form.iban} onChange={(event) => setForm({ ...form, iban: event.target.value })} maxLength={42} autoFocus autoComplete="off" />
        </Field>
        <Field label={st('account.bank')} required>
          <input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} maxLength={120} />
        </Field>
        <Field label={st('account.holder')} required info={st('form.account.holderInfo')}>
          <input value={form.holderName} onChange={(event) => setForm({ ...form, holderName: event.target.value })} maxLength={200} />
        </Field>
      </FormSection>
    </FormModal>
  )
}
