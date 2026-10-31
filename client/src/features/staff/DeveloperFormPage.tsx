import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Field, FormSection } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useMyMarkets, useStaffT } from './shared.tsx'

/** Isto pravilo kao na serveru (catalog.dto): slova, cifre i crtica. */
const CODE = /^[A-Za-z0-9-]+$/

/**
 * Nov investitor (`/catalog/developers/new`) i izmena (`/catalog/developers/:id/edit`).
 * Tržište i matični broj se posle unosa ne menjaju.
 */
export function DeveloperFormPage() {
  const { id } = useParams()
  const editing = id !== undefined
  const st = useStaffT()
  const { t } = useI18n()
  const markets = useMyMarkets()
  const existing = useAsync(() => (id ? staffApi.developer(id) : Promise.resolve(null)), [id])
  const [form, setForm] = useState({
    market: (markets[0] ?? '') as MarketCode | '',
    name: '',
    registrationNumber: '',
    taxNumber: '',
    address: '',
    website: '',
  })
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const developer = existing.data
    if (!developer) return
    setForm({
      market: developer.market,
      name: developer.name,
      registrationNumber: developer.registrationNumber,
      taxNumber: developer.taxNumber ?? '',
      address: developer.address ?? '',
      website: developer.website ?? '',
    })
  }, [existing.data])

  const incomplete = !form.name.trim() || (!editing && (!form.market || form.registrationNumber.trim().length < 3))

  // Greške uz polje (prikaz); server ih isto proverava.
  const registration = form.registrationNumber.trim()
  const registrationError = !editing && registration.length > 0 && (registration.length < 3 || !CODE.test(registration)) ? st('form.developer.registrationInvalid') : null
  const tax = form.taxNumber.trim()
  const taxError = tax.length > 0 && !CODE.test(tax) ? st('form.developer.taxInvalid') : null
  const website = form.website.trim()
  const websiteError = website.length > 0 && !website.startsWith('https://') ? st('form.developer.websiteInvalid') : null

  const submit = async () => {
    const optional = {
      taxNumber: form.taxNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
    }
    if (id) {
      await staffApi.updateDeveloper(id, { name: form.name.trim(), ...optional })
      return `/catalog/developers/${id}`
    }
    if (!form.market) return
    const developer = await staffApi.createDeveloper({
      market: form.market,
      name: form.name.trim(),
      registrationNumber: form.registrationNumber.trim(),
      ...optional,
    })
    return `/catalog/developers/${developer.id}`
  }

  const title = editing ? st('developer.edit') : st('catalog.newDeveloper')
  const backTo = id ? `/catalog/developers/${id}` : '/catalog'
  return (
    <FormPage
      title={title}
      description={editing ? st('form.developer.editDescription') : st('form.developer.newDescription')}
      crumbs={[
        { label: st('catalog.title'), to: '/catalog' },
        ...(id && existing.data ? [{ label: existing.data.name, to: `/catalog/developers/${id}` }] : []),
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
      <FormSection title={st('form.developer.identity')} description={st('form.developer.identityHint')}>
        <Field label={t('common.market')} required={!editing} info={st('form.developer.marketInfo')} hint={editing ? st('developer.fixedHint') : undefined}>
          {editing ? (
            <input value={form.market ? t(`market.${form.market}`) : ''} readOnly />
          ) : (
            <MarketSelect value={form.market} onChange={(value) => set('market')(value)} />
          )}
        </Field>
        <Field
          label={st('developer.registrationNumber')}
          required={!editing}
          info={st('form.developer.registrationInfo')}
          hint={editing ? st('developer.fixedHint') : st('form.developer.registrationHint')}
          error={registrationError}
        >
          <input
            className="mono"
            value={form.registrationNumber}
            readOnly={editing}
            onChange={(event) => set('registrationNumber')(event.target.value)}
            maxLength={32}
            autoComplete="off"
          />
        </Field>
        <Field label={st('name')} required info={st('form.developer.nameInfo')} wide>
          <input value={form.name} onChange={(event) => set('name')(event.target.value)} maxLength={200} autoComplete="off" />
        </Field>
      </FormSection>

      <FormSection title={st('form.developer.contact')} description={st('form.developer.contactHint')}>
        <Field label={st('developer.taxNumber')} info={st('form.developer.taxInfo')} hint={t('common.optional')} error={taxError}>
          <input className="mono" value={form.taxNumber} onChange={(event) => set('taxNumber')(event.target.value)} maxLength={32} autoComplete="off" />
        </Field>
        <Field label={st('developer.website')} hint={st('form.developer.websiteHint')} error={websiteError}>
          <input type="url" value={form.website} onChange={(event) => set('website')(event.target.value)} maxLength={300} placeholder="https://" />
        </Field>
        <Field label={st('developer.address')} hint={t('common.optional')} wide>
          <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} />
        </Field>
      </FormSection>
    </FormPage>
  )
}
