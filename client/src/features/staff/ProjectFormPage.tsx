import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { ErrorBox, Field, FormSection, Notice } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { PICK_PAGE, useStaffT } from './shared.tsx'
import type { ProjectStatus } from './types.ts'

const PROJECT_STATUSES: ProjectStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

/**
 * Nov projekat (`/catalog/projects/new`, opciono `?developerId=`) i izmena
 * (`/catalog/projects/:id/edit`). Investitor se posle unosa ne menja.
 */
export function ProjectFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const editing = id !== undefined
  const st = useStaffT()
  const { t } = useI18n()
  const existing = useAsync(() => (id ? staffApi.project(id) : Promise.resolve(null)), [id])
  const developers = useAsync(() => (editing ? Promise.resolve(null) : staffApi.developers(PICK_PAGE)), [editing])
  const [form, setForm] = useState({
    developerId: params.get('developerId') ?? '',
    name: '',
    city: '',
    address: '',
    parcelReference: '',
    description: '',
    expectedCompletion: '',
    status: 'DRAFT' as ProjectStatus,
  })
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const detail = existing.data
    if (!detail) return
    const { project } = detail
    setForm({
      developerId: project.developerId,
      name: project.name,
      city: project.city,
      address: project.address,
      parcelReference: project.parcelReference ?? '',
      description: project.description ?? '',
      expectedCompletion: project.expectedCompletion?.slice(0, 10) ?? '',
      status: project.status,
    })
  }, [existing.data])

  const incomplete = !form.developerId || !form.name.trim() || !form.city.trim() || !form.address.trim()

  const submit = async () => {
    const body = {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      parcelReference: form.parcelReference.trim() || undefined,
      description: form.description.trim() || undefined,
      expectedCompletion: form.expectedCompletion || undefined,
    }
    if (id) {
      await staffApi.updateProject(id, { ...body, status: form.status })
      return `/catalog/projects/${id}`
    }
    const project = await staffApi.createProject({ developerId: form.developerId, ...body })
    return `/catalog/projects/${project.id}`
  }

  const title = editing ? st('project.edit') : st('catalog.newProject')
  const fromDeveloper = params.get('developerId')
  const backTo = id ? `/catalog/projects/${id}` : fromDeveloper ? `/catalog/developers/${fromDeveloper}?tab=projects` : '/catalog?tab=projects'
  const detail = existing.data
  return (
    <FormPage
      title={title}
      description={editing ? st('form.project.editDescription') : st('form.project.newDescription')}
      crumbs={[
        { label: st('catalog.title'), to: '/catalog?tab=projects' },
        ...(detail ? [{ label: detail.project.name, to: `/catalog/projects/${detail.project.id}` }] : []),
        { label: title },
      ]}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={editing ? t('common.save') : t('common.add')}
      disabledReason={incomplete ? st('requiredFields') : null}
      loading={editing && existing.loading && !existing.data}
      loadError={editing && !existing.data ? existing.error : null}
      onRetry={existing.reload}
      aside={id ? <AuditTrail entityId={id} /> : undefined}
    >
      <FormSection title={st('form.project.basics')} description={st('form.project.basicsHint')}>
        <Field
          label={st('project.developer')}
          required={!editing}
          info={st('form.project.developerInfo')}
          hint={editing ? st('project.developerFixed') : undefined}
        >
          {editing ? (
            <input value={detail?.developer.name ?? ''} readOnly />
          ) : (
            <select value={form.developerId} onChange={(event) => set('developerId')(event.target.value)}>
              <option value="">—</option>
              {(developers.data?.items ?? []).map((developer) => (
                <option key={developer.id} value={developer.id}>
                  {developer.name} ({developer.market})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={st('name')} required>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} autoComplete="off" />
        </Field>
        <ErrorBox error={developers.error} onRetry={developers.reload} />
      </FormSection>

      <FormSection title={st('form.project.location')} description={st('form.project.locationHint')}>
        <Field label={st('project.city')} required>
          <input value={form.city} onChange={(event) => set('city')(event.target.value)} maxLength={120} />
        </Field>
        <Field label={st('project.address')} required>
          <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} />
        </Field>
        <Field label={st('project.parcel')} info={st('form.project.parcelInfo')} hint={st('form.project.parcelHint')} wide>
          <input className="mono" value={form.parcelReference} onChange={(event) => set('parcelReference')(event.target.value)} maxLength={120} />
        </Field>
      </FormSection>

      <FormSection title={st('form.project.timeline')} description={st('form.project.timelineHint')}>
        <Field label={st('project.expectedCompletion')} info={st('form.project.completionInfo')} hint={t('common.optional')}>
          <input type="date" value={form.expectedCompletion} onChange={(event) => set('expectedCompletion')(event.target.value)} />
        </Field>
        <Field label={st('project.description')} hint={`${st('form.project.descriptionHint')} ${form.description.length} / 5000`} wide>
          <textarea value={form.description} onChange={(event) => set('description')(event.target.value)} maxLength={5000} rows={5} />
        </Field>
      </FormSection>

      <FormSection title={st('form.project.publishing')} description={st('form.project.publishingHint')}>
        {editing ? (
          <Field label={t('common.status')} required info={st('form.project.statusInfo')} hint={st(`form.project.statusHint.${form.status}`)}>
            <select value={form.status} onChange={(event) => set('status')(event.target.value)}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {st(`projStatus.${status}`)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Notice tone="plain" icon="info">
            {st('form.project.draftNote')}
          </Notice>
        )}
      </FormSection>
    </FormPage>
  )
}
