import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useMyMarkets, useStaffT } from './shared.tsx'

/** Katalog (F-32): investitori i projekti na tržištima korisnika. Unos radi analitičar (catalog:manage). */
export function CatalogPage() {
  const st = useStaffT()
  const [tab, setTab] = useState<'developers' | 'projects'>('developers')
  return (
    <Page title={st('catalog.title')}>
      <div className="tabs">
        <button type="button" className={tab === 'developers' ? 'active' : undefined} onClick={() => setTab('developers')}>
          {st('catalog.developers')}
        </button>
        <button type="button" className={tab === 'projects' ? 'active' : undefined} onClick={() => setTab('projects')}>
          {st('catalog.projects')}
        </button>
      </div>
      {tab === 'developers' ? <DevelopersTab /> : <ProjectsTab />}
    </Page>
  )
}

function DevelopersTab() {
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [search, setSearch] = useState('')
  const { data, error, loading, reload } = useAsync(
    () => staffApi.developers({ market, search: search.trim() || undefined }),
    [market, search],
  )

  return (
    <>
      <Card
        actions={
          <div className="row">
            <input placeholder={t('common.search')} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </div>
        }
      >
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data || data.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{st('name')}</th>
                  <th>{st('developer.registrationNumber')}</th>
                  <th>{t('common.market')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((developer) => (
                  <tr key={developer.id}>
                    <td>{developer.name}</td>
                    <td>{developer.registrationNumber}</td>
                    <td>{t(`market.${developer.market}`)}</td>
                    <td>
                      <Link to={`/catalog/developers/${developer.id}`}>{st('open')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {can('catalog:manage') && <NewDeveloperCard onCreated={reload} />}
    </>
  )
}

function NewDeveloperCard({ onCreated }: { onCreated: () => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const navigate = useNavigate()
  const markets = useMyMarkets()
  const [form, setForm] = useState({ market: (markets[0] ?? '') as MarketCode | '', name: '', registrationNumber: '', taxNumber: '', address: '', website: '' })
  const [error, setError] = useState<unknown>(null)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.market) return
    setError(null)
    try {
      const developer = await staffApi.createDeveloper({
        market: form.market,
        name: form.name.trim(),
        registrationNumber: form.registrationNumber.trim(),
        taxNumber: form.taxNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
      })
      onCreated()
      void navigate(`/catalog/developers/${developer.id}`)
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('catalog.newDeveloper')}>
      <form onSubmit={(event) => void submit(event)} className="grid">
        <Field label={t('common.market')}>
          <MarketSelect value={form.market} onChange={(value) => set('market')(value)} />
        </Field>
        <Field label={st('name')}>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} required />
        </Field>
        <Field label={st('developer.registrationNumber')}>
          <input value={form.registrationNumber} onChange={(event) => set('registrationNumber')(event.target.value)} maxLength={32} required />
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
        <div>
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={!form.market || !form.name || form.registrationNumber.length < 3}>
            {t('common.add')}
          </button>
        </div>
      </form>
    </Card>
  )
}

function ProjectsTab() {
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [city, setCity] = useState('')
  const { data, error, loading } = useAsync(() => staffApi.projects({ market, city: city.trim() || undefined, limit: 100 }), [market, city])

  return (
    <>
      <Card
        actions={
          <div className="row">
            <input placeholder={st('project.city')} value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} />
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </div>
        }
      >
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{st('name')}</th>
                  <th>{st('project.developer')}</th>
                  <th>{st('project.city')}</th>
                  <th>{t('common.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{project.developerName ?? '—'}</td>
                    <td>
                      {project.city} · {t(`market.${project.market}`)}
                    </td>
                    <td>
                      <StatusBadge
                        text={st(`projStatus.${project.status}`)}
                        tone={project.status === 'PUBLISHED' ? 'good' : project.status === 'DRAFT' ? 'warn' : 'neutral'}
                      />
                    </td>
                    <td>
                      <Link to={`/catalog/projects/${project.id}`}>{st('open')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {can('catalog:manage') && <NewProjectCard />}
    </>
  )
}

function NewProjectCard() {
  const st = useStaffT()
  const { t } = useI18n()
  const navigate = useNavigate()
  const developers = useAsync(() => staffApi.developers({}), [])
  const [form, setForm] = useState({ developerId: '', name: '', city: '', address: '', parcelReference: '', description: '', expectedCompletion: '' })
  const [error, setError] = useState<unknown>(null)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const project = await staffApi.createProject({
        developerId: form.developerId,
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        parcelReference: form.parcelReference.trim() || undefined,
        description: form.description.trim() || undefined,
        expectedCompletion: form.expectedCompletion || undefined,
      })
      void navigate(`/catalog/projects/${project.id}`)
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('catalog.newProject')}>
      <form onSubmit={(event) => void submit(event)} className="grid">
        <Field label={st('project.developer')}>
          <select value={form.developerId} onChange={(event) => set('developerId')(event.target.value)} required>
            <option value="">—</option>
            {(developers.data ?? []).map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name} ({developer.market})
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('name')}>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} required />
        </Field>
        <Field label={st('project.city')}>
          <input value={form.city} onChange={(event) => set('city')(event.target.value)} maxLength={120} required />
        </Field>
        <Field label={st('project.address')}>
          <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} required />
        </Field>
        <Field label={st('project.parcel')}>
          <input value={form.parcelReference} onChange={(event) => set('parcelReference')(event.target.value)} maxLength={120} />
        </Field>
        <Field label={st('project.expectedCompletion')}>
          <input type="date" value={form.expectedCompletion} onChange={(event) => set('expectedCompletion')(event.target.value)} />
        </Field>
        <Field label={st('project.description')}>
          <textarea value={form.description} onChange={(event) => set('description')(event.target.value)} maxLength={5000} />
        </Field>
        <div>
          <ErrorBox error={error ?? developers.error} />
          <button type="submit" className="primary" disabled={!form.developerId || !form.name || !form.city || !form.address}>
            {t('common.add')}
          </button>
        </div>
      </form>
    </Card>
  )
}
