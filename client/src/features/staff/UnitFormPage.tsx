import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/http.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Field, FormSection } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { useStaffT } from './shared.tsx'

const EMPTY_UNIT = { label: '', floor: '', rooms: '', area: '', price: '' }

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value.replace(',', '.'))
}

/** Vrednost je uneta i van opsega koji prima server (catalog.dto). */
function outOfRange(value: string, min: number, max: number): boolean {
  const number = toNumber(value)
  return number !== undefined && (Number.isNaN(number) || number < min || number > max)
}

/**
 * Nov stan (`/catalog/projects/:id/units/new`) i izmena
 * (`/catalog/projects/:id/units/:unitId/edit`). Podaci stana dolaze iz detalja projekta.
 */
export function UnitFormPage() {
  const { id = '', unitId } = useParams()
  const editing = unitId !== undefined
  const st = useStaffT()
  const { t } = useI18n()
  const detail = useAsync(() => staffApi.project(id), [id])
  const unit = editing ? detail.data?.units.find((item) => item.id === unitId) : undefined
  const [form, setForm] = useState(EMPTY_UNIT)

  useEffect(() => {
    if (!unit) return
    setForm({
      label: unit.label,
      floor: unit.floor === null ? '' : String(unit.floor),
      rooms: unit.rooms === null ? '' : String(unit.rooms),
      area: String(unit.area),
      price: String(unit.price),
    })
  }, [unit])

  const incomplete = !form.label.trim() || !form.area || !form.price
  const backTo = `/catalog/projects/${id}?tab=units`

  const submit = async () => {
    const body = {
      label: form.label.trim(),
      floor: toNumber(form.floor),
      rooms: toNumber(form.rooms),
      area: toNumber(form.area) ?? 0,
      price: Math.round(toNumber(form.price) ?? 0),
    }
    if (unitId) await staffApi.updateUnit(unitId, body)
    else await staffApi.createUnit(id, body)
    return backTo
  }

  const title = editing ? `${t('common.edit')} · ${unit?.label ?? st('project.units')}` : st('project.addUnit')
  const missingUnit = editing && detail.data && !unit
  const rangeError = st('form.unit.rangeError')
  return (
    <FormPage
      title={title}
      description={editing ? st('form.unit.editDescription') : st('form.unit.newDescription')}
      crumbs={[
        { label: st('catalog.title'), to: '/catalog?tab=projects' },
        ...(detail.data ? [{ label: detail.data.project.name, to: backTo }] : []),
        { label: title },
      ]}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={editing ? t('common.save') : st('project.addUnit')}
      disabledReason={incomplete ? st('requiredFields') : null}
      loading={detail.loading && !detail.data}
      loadError={!detail.data ? detail.error : missingUnit ? new ApiError(404, 'NOT_FOUND', st('unit.notFound')) : null}
      onRetry={detail.reload}
      aside={unitId ? <AuditTrail entityId={unitId} /> : undefined}
    >
      <FormSection title={st('form.unit.basics')} description={st('form.unit.basicsHint')} columns={3}>
        <Field label={st('unit.label')} required info={st('form.unit.labelInfo')} hint={st('form.unit.labelHint')}>
          <input className="mono" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} maxLength={40} autoFocus autoComplete="off" />
        </Field>
        <Field label={st('unit.floor')} hint={st('form.unit.floorHint')} error={outOfRange(form.floor, -5, 200) ? rangeError : null}>
          <input type="number" step="1" min={-5} max={200} value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} />
        </Field>
        <Field
          label={st('unit.rooms')}
          hint={st('form.unit.roomsHint')}
          suffix={st('form.unit.roomsSuffix')}
          error={outOfRange(form.rooms, 0, 20) ? rangeError : null}
        >
          <input type="number" step="0.5" min={0} max={20} value={form.rooms} onChange={(event) => setForm({ ...form, rooms: event.target.value })} />
        </Field>
      </FormSection>

      <FormSection title={st('form.unit.priceSection')} description={st('form.unit.priceSectionHint')}>
        <Field label={st('form.unit.area')} required info={st('form.unit.areaInfo')} suffix="m²" error={outOfRange(form.area, 1, 10_000) ? rangeError : null}>
          <input type="number" step="0.01" min={1} max={10000} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
        </Field>
        <Field
          label={st('form.unit.price')}
          required
          info={st('form.unit.priceInfo')}
          hint={st('form.unit.priceHint')}
          suffix="€"
          error={outOfRange(form.price, 1, 100_000_000) ? rangeError : null}
        >
          <input type="number" step="1" min={1} max={100000000} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
        </Field>
      </FormSection>
    </FormPage>
  )
}
