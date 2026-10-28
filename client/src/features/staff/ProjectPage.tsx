import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, SemaphoreBadge, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { ChecksPanel } from './ChecksPanel.tsx'
import { ConstructionPlan } from './ConstructionPage.tsx'
import { DocumentsPanel, SemaphoreTable, useStaffT } from './shared.tsx'
import type { Project, ProjectStatus, Unit, UnitStatus } from './types.ts'

const PROJECT_STATUSES: ProjectStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

export function ProjectPage() {
  const { id = '' } = useParams()
  const st = useStaffT()
  const { t } = useI18n()
  const { can } = useAuth()
  const detail = useAsync(() => staffApi.project(id), [id])
  const documents = useAsync(() => staffApi.documents({ projectId: id }), [id])

  if (detail.loading && !detail.data) return <Loading />
  if (!detail.data) return <ErrorBox error={detail.error} />
  const { project, developer, units, semaphore } = detail.data

  return (
    <Page
      title={project.name}
      actions={
        <span className="row">
          <SemaphoreBadge status={semaphore.overall} />
          <Link to="/catalog">{t('common.back')}</Link>
        </span>
      }
    >
      <ProjectInfo
        project={project}
        developerName={developer.name}
        developerId={developer.id}
        canEdit={can('catalog:manage')}
        onSaved={detail.reload}
      />
      <UnitsCard projectId={project.id} units={units} canEdit={can('catalog:manage')} onChanged={detail.reload} />
      <SemaphoreTable title={st('checks.projectSemaphore')} result={{ ...semaphore.project, disclaimer: semaphore.disclaimer }} />
      <SemaphoreTable title={st('checks.developerSemaphore')} result={{ ...semaphore.developer, disclaimer: semaphore.disclaimer }} />
      <ChecksPanel target={{ projectId: project.id }} market={project.market} documents={documents.data} onChanged={detail.reload} />
      <DocumentsPanel
        owner={{ scope: 'PROJECT', projectId: project.id }}
        market={project.market}
        documents={documents.data}
        onUploaded={documents.reload}
        canUpload={can('documents:upload')}
      />
      <ConstructionPlan projectId={project.id} />
    </Page>
  )
}

function ProjectInfo({
  project,
  developerName,
  developerId,
  canEdit,
  onSaved,
}: {
  project: Project
  developerName: string
  developerId: string
  canEdit: boolean
  onSaved: () => void
}) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: project.name,
    city: project.city,
    address: project.address,
    parcelReference: project.parcelReference ?? '',
    description: project.description ?? '',
    expectedCompletion: project.expectedCompletion ?? '',
    status: project.status,
  })
  const [error, setError] = useState<unknown>(null)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await staffApi.updateProject(project.id, {
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        parcelReference: form.parcelReference.trim() || undefined,
        description: form.description.trim() || undefined,
        expectedCompletion: form.expectedCompletion || undefined,
        status: form.status,
      })
      setEditing(false)
      onSaved()
    } catch (reason) {
      setError(reason)
    }
  }

  if (!editing) {
    return (
      <Card
        title={`${t(`market.${project.market}`)} · ${project.city}`}
        actions={
          <span className="row">
            <StatusBadge
              text={st(`projStatus.${project.status}`)}
              tone={project.status === 'PUBLISHED' ? 'good' : project.status === 'DRAFT' ? 'warn' : 'neutral'}
            />
            {canEdit && (
              <button type="button" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </button>
            )}
          </span>
        }
      >
        <p>
          {st('project.developer')}: <Link to={`/catalog/developers/${developerId}`}>{developerName}</Link>
          <br />
          {st('project.address')}: {project.address}
          <br />
          {st('project.parcel')}: {project.parcelReference ?? '—'}
          <br />
          {st('project.expectedCompletion')}: {formatDate(project.expectedCompletion)}
        </p>
        {project.description && <p style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>}
      </Card>
    )
  }

  return (
    <Card title={t('common.edit')}>
      <form onSubmit={(event) => void submit(event)} className="grid">
        <Field label={st('name')}>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} required />
        </Field>
        <Field label={t('common.status')}>
          <select value={form.status} onChange={(event) => set('status')(event.target.value)}>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {st(`projStatus.${status}`)}
              </option>
            ))}
          </select>
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
        <div className="row">
          <ErrorBox error={error} />
          <button type="submit" className="primary">
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

const EMPTY_UNIT = { label: '', floor: '', rooms: '', area: '', price: '' }

function UnitsCard({ projectId, units, canEdit, onChanged }: { projectId: string; units: Unit[]; canEdit: boolean; onChanged: () => void }) {
  const st = useStaffT()
  const { t, formatMoney, formatNumber } = useI18n()
  const [form, setForm] = useState(EMPTY_UNIT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value.replace(',', '.')))

  const startEdit = (unit: Unit) => {
    setEditingId(unit.id)
    setForm({
      label: unit.label,
      floor: unit.floor === null ? '' : String(unit.floor),
      rooms: unit.rooms === null ? '' : String(unit.rooms),
      area: String(unit.area),
      price: String(unit.price),
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const body = {
      label: form.label.trim(),
      floor: toNumber(form.floor),
      rooms: toNumber(form.rooms),
      area: toNumber(form.area) ?? 0,
      price: Math.round(toNumber(form.price) ?? 0),
    }
    try {
      if (editingId) await staffApi.updateUnit(editingId, body)
      else await staffApi.createUnit(projectId, body)
      setForm(EMPTY_UNIT)
      setEditingId(null)
      onChanged()
    } catch (reason) {
      setError(reason)
    }
  }

  const setStatus = async (unit: Unit, status: UnitStatus) => {
    setError(null)
    try {
      await staffApi.updateUnit(unit.id, { status })
      onChanged()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('project.units')}>
      <ErrorBox error={error} />
      {units.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{st('unit.label')}</th>
                <th>{st('unit.floor')}</th>
                <th>{st('unit.rooms')}</th>
                <th>{st('unit.area')}</th>
                <th>{st('unit.price')}</th>
                <th>{t('common.status')}</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.label}</td>
                  <td>{unit.floor ?? '—'}</td>
                  <td>{unit.rooms ?? '—'}</td>
                  <td>{formatNumber(unit.area, 2)}</td>
                  <td>{formatMoney(unit.price)}</td>
                  <td>
                    <StatusBadge
                      text={st(`unitStatus.${unit.status}`)}
                      tone={unit.status === 'AVAILABLE' ? 'good' : unit.status === 'RESERVED' ? 'warn' : 'neutral'}
                    />
                  </td>
                  {canEdit && (
                    <td className="row">
                      <button type="button" onClick={() => startEdit(unit)}>
                        {t('common.edit')}
                      </button>
                      {unit.status === 'SOLD' && (
                        <button type="button" onClick={() => void setStatus(unit, 'AVAILABLE')}>
                          {st('unitStatus.AVAILABLE')}
                        </button>
                      )}
                      {unit.status === 'AVAILABLE' && (
                        <button type="button" onClick={() => void setStatus(unit, 'SOLD')}>
                          {st('unitStatus.SOLD')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <form onSubmit={(event) => void submit(event)} className="grid">
          <Field label={st('unit.label')}>
            <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} maxLength={40} required />
          </Field>
          <Field label={st('unit.floor')}>
            <input type="number" value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} />
          </Field>
          <Field label={st('unit.rooms')}>
            <input type="number" step="0.5" value={form.rooms} onChange={(event) => setForm({ ...form, rooms: event.target.value })} />
          </Field>
          <Field label={st('unit.area')}>
            <input type="number" step="0.01" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} required />
          </Field>
          <Field label={st('unit.price')}>
            <input type="number" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
          </Field>
          <div className="row">
            <button type="submit" className="primary" disabled={!form.label || !form.area || !form.price}>
              {editingId ? t('common.save') : st('project.addUnit')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setForm(EMPTY_UNIT)
                }}
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>
      )}
    </Card>
  )
}
