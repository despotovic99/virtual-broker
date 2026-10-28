import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { ChecksPanel } from './ChecksPanel.tsx'
import { DocumentsPanel, SemaphoreTable, TextAction, useStaffT } from './shared.tsx'
import type { BankAccount, Developer } from './types.ts'

export function DeveloperPage() {
  const { id = '' } = useParams()
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const developers = useAsync(() => staffApi.developer(id), [id])
  const [edited, setEdited] = useState<Developer | null>(null)
  const developer = edited?.id === id ? edited : developers.data
  const semaphore = useAsync(() => staffApi.developerSemaphore(id), [id])
  const documents = useAsync(() => staffApi.documents({ developerId: id }), [id])
  const projects = useAsync(() => staffApi.projects({ developerId: id, limit: 100 }), [id])

  if (developers.loading && !developer) return <Loading />
  if (!developer) return <ErrorBox error={developers.error ?? semaphore.error} />

  return (
    <Page title={developer.name} actions={<Link to="/catalog">{t('common.back')}</Link>}>
      <DeveloperInfo developer={developer} canEdit={can('catalog:manage')} onSaved={setEdited} />
      <BankAccounts developerId={developer.id} />
      <SemaphoreTable title={st('checks.developerSemaphore')} result={semaphore.data} />
      <ChecksPanel
        target={{ developerId: developer.id }}
        market={developer.market}
        documents={documents.data}
        onChanged={semaphore.reload}
      />
      <DocumentsPanel
        owner={{ scope: 'DEVELOPER', developerId: developer.id }}
        market={developer.market}
        documents={documents.data}
        onUploaded={documents.reload}
        canUpload={can('documents:upload')}
      />
      <Card title={st('catalog.projects')}>
        {!projects.data || projects.data.items.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {projects.data.items.map((project) => (
              <li key={project.id}>
                <Link to={`/catalog/projects/${project.id}`}>{project.name}</Link> <span className="muted">· {project.city}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  )
}

function DeveloperInfo({ developer, canEdit, onSaved }: { developer: Developer; canEdit: boolean; onSaved: (developer: Developer) => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: developer.name,
    taxNumber: developer.taxNumber ?? '',
    address: developer.address ?? '',
    website: developer.website ?? '',
  })
  const [error, setError] = useState<unknown>(null)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      onSaved(
        await staffApi.updateDeveloper(developer.id, {
          name: form.name.trim(),
          taxNumber: form.taxNumber.trim() || undefined,
          address: form.address.trim() || undefined,
          website: form.website.trim() || undefined,
        }),
      )
      setEditing(false)
    } catch (reason) {
      setError(reason)
    }
  }

  if (!editing) {
    return (
      <Card
        title={`${t(`market.${developer.market}`)} · ${developer.registrationNumber}`}
        actions={
          canEdit && (
            <button type="button" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </button>
          )
        }
      >
        <p>
          {st('developer.taxNumber')}: {developer.taxNumber ?? '—'}
          <br />
          {st('developer.address')}: {developer.address ?? '—'}
          <br />
          {st('developer.website')}:{' '}
          {developer.website?.startsWith('https://') ? (
            <a href={developer.website} target="_blank" rel="noopener noreferrer nofollow">
              {developer.website}
            </a>
          ) : (
            '—'
          )}
        </p>
      </Card>
    )
  }

  return (
    <Card title={t('common.edit')}>
      <form onSubmit={(event) => void submit(event)} className="grid">
        <Field label={st('name')}>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} required />
        </Field>
        <Field label={st('developer.taxNumber')}>
          <input value={form.taxNumber} onChange={(event) => set('taxNumber')(event.target.value)} maxLength={32} />
        </Field>
        <Field label={st('developer.address')}>
          <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} />
        </Field>
        <Field label={st('developer.website')}>
          <input type="url" value={form.website} onChange={(event) => set('website')(event.target.value)} maxLength={300} />
        </Field>
        <div className="row">
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={!form.name.trim()}>
            {t('common.save')}
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Računi investitora (F-16). Proveru radi druga osoba, ne ona koja je račun
 * uneo (server vraća BANK_ACCOUNT_SAME_VERIFIER); odgovor servera za sada ne
 * nosi ko je račun uneo, pa klijent dugme ne skriva unapred.
 */
function BankAccounts({ developerId }: { developerId: string }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { can, user } = useAuth()
  const { data, error, reload } = useAsync(() => staffApi.bankAccounts(developerId), [developerId])
  const [form, setForm] = useState({ iban: '', bankName: '', holderName: '' })
  const [formError, setFormError] = useState<unknown>(null)
  const [verifying, setVerifying] = useState<string | null>(null)

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      await staffApi.addBankAccount(developerId, {
        iban: form.iban.replace(/\s+/g, '').toUpperCase(),
        bankName: form.bankName.trim(),
        holderName: form.holderName.trim(),
      })
      setForm({ iban: '', bankName: '', holderName: '' })
      reload()
    } catch (reason) {
      setFormError(reason)
    }
  }

  return (
    <Card title={st('developer.accounts')}>
      <ErrorBox error={error} />
      {!data || data.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{st('account.iban')}</th>
                <th>{st('account.bank')}</th>
                <th>{st('account.holder')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((account: BankAccount) => (
                <tr key={account.id}>
                  <td>{account.iban}</td>
                  <td>{account.bankName}</td>
                  <td>{account.holderName}</td>
                  <td>
                    {account.verified ? (
                      <>
                        <StatusBadge text={st('account.verified')} tone="good" />{' '}
                        <span className="muted">{formatDate(account.verifiedAt)}</span>
                        {account.verificationNote && <div className="muted">{account.verificationNote}</div>}
                      </>
                    ) : (
                      <>
                        <StatusBadge text={st('account.notVerified')} tone="warn" />
                        {can('bank-accounts:verify') && account.createdById !== user?.id && verifying !== account.id && (
                          <button type="button" onClick={() => setVerifying(account.id)}>
                            {st('account.verify')}
                          </button>
                        )}
                        {verifying === account.id && (
                          <TextAction
                            label={st('account.verifyNote')}
                            button={st('account.verify')}
                            minLength={3}
                            maxLength={500}
                            onSubmit={async (note) => {
                              await staffApi.verifyBankAccount(account.id, note)
                              setVerifying(null)
                              reload()
                            }}
                          >
                            <p className="muted">{st('account.fourEyes')}</p>
                          </TextAction>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {can('catalog:manage') && (
        <form onSubmit={(event) => void add(event)} className="grid">
          <Field label={st('account.iban')}>
            <input value={form.iban} onChange={(event) => setForm({ ...form, iban: event.target.value })} maxLength={42} required />
          </Field>
          <Field label={st('account.bank')}>
            <input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} maxLength={120} required />
          </Field>
          <Field label={st('account.holder')}>
            <input value={form.holderName} onChange={(event) => setForm({ ...form, holderName: event.target.value })} maxLength={200} required />
          </Field>
          <div>
            <ErrorBox error={formError} />
            <button type="submit" className="primary" disabled={form.iban.replace(/\s+/g, '').length < 15 || !form.bankName || !form.holderName}>
              {st('developer.addAccount')}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
