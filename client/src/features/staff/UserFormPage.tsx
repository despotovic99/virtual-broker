import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Field, FormSection, InfoTip, Notice, Tag } from '../../ui/components.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { useStaffT } from './shared.tsx'
import { MarketsRequired, needsMarket, RolesAndMarkets, useEditLockReason } from './userForm.tsx'

/**
 * Nov korisnik (`/admin/users/new`) i izmena (`/admin/users/:id/edit`).
 * Niko ne menja sopstvene uloge, tržišta i status (server: CANNOT_CHANGE_OWN_ACCESS).
 */
export function UserFormPage() {
  const { id } = useParams()
  const editing = id !== undefined
  const st = useStaffT()
  const { t } = useI18n()
  const { user: me } = useAuth()
  const lockReason = useEditLockReason()

  const existing = useAsync(() => (id ? staffApi.user(id) : Promise.resolve(null)), [id])
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [roles, setRoles] = useState<Role[]>([])
  const [markets, setMarkets] = useState<MarketCode[]>([])
  const [isActive, setIsActive] = useState(true)

  // Postojeći korisnik puni obrazac jednom, kad stigne.
  useEffect(() => {
    const user = existing.data
    if (!user) return
    setForm({ email: user.email, password: '', firstName: user.firstName, lastName: user.lastName })
    setRoles(user.roles)
    setMarkets(user.markets)
    setIsActive(user.isActive)
  }, [existing.data])

  const isSelf = editing && me?.id === id
  const locked = existing.data ? lockReason(existing.data) : undefined
  const missingMarket = !isSelf && needsMarket(roles, markets)
  const incomplete = !form.firstName.trim() || !form.lastName.trim() || (!isSelf && roles.length === 0) || (!editing && (!form.email || form.password.length < 12))

  const disabledReason = locked ?? (missingMarket ? st('users.marketsRequired') : incomplete ? st('requiredFields') : null)

  const submit = async () => {
    const names = { firstName: form.firstName.trim(), lastName: form.lastName.trim() }
    if (!id) {
      await staffApi.createUser({ ...names, email: form.email.trim(), password: form.password, roles, markets })
      return '/admin/users'
    }
    await staffApi.updateUser(id, isSelf ? names : { ...names, roles, markets, isActive })
    return '/admin/users'
  }

  const title = editing ? st('users.edit') : st('users.new')
  return (
    <FormPage
      title={title}
      crumbs={[{ label: st('users.title'), to: '/admin/users' }, { label: title }]}
      backTo="/admin/users"
      onSubmit={submit}
      submitLabel={editing ? t('common.save') : t('common.add')}
      disabledReason={disabledReason}
      loading={editing && existing.loading && !existing.data}
      loadError={editing && !existing.data ? existing.error : null}
      onRetry={existing.reload}
      description={editing ? st('form.user.editDescription') : st('form.user.newDescription')}
      intro={locked ? <Notice tone="warn" icon="lock">{locked}</Notice> : undefined}
      aside={id ? <AuditTrail entityId={id} /> : undefined}
    >
      <FormSection title={st('form.user.identity')} description={st('form.user.identityHint')}>
        <Field label={st('users.firstName')} required>
          <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} maxLength={100} autoComplete="off" />
        </Field>
        <Field label={st('users.lastName')} required>
          <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} maxLength={100} autoComplete="off" />
        </Field>
        {editing ? (
          <Field label={st('email')} hint={st('users.emailFixed')} wide>
            <input type="email" value={form.email} readOnly />
          </Field>
        ) : (
          <>
            <Field label={st('email')} required info={st('form.user.emailInfo')}>
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} autoComplete="off" />
            </Field>
            <Field
              label={st('users.password')}
              required
              info={st('form.user.passwordInfo')}
              hint={st('users.passwordHint')}
              error={form.password.length > 0 && form.password.length < 12 ? st('users.passwordHint') : null}
            >
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={12}
                maxLength={128}
              />
            </Field>
          </>
        )}
      </FormSection>

      <FormSection title={st('form.user.access')} description={st('form.user.accessHint')} columns={1}>
        {isSelf && existing.data ? (
          <div className="stack stack--sm">
            <span className="row">
              {existing.data.roles.map((value) => (
                <Tag key={value}>{st(`role.${value}`)}</Tag>
              ))}
              {existing.data.markets.map((value) => (
                <Tag key={value}>{value}</Tag>
              ))}
            </span>
            <Notice tone="plain" icon="lock">
              {st('users.ownAccessLocked')}
            </Notice>
          </div>
        ) : (
          <>
            <RolesAndMarkets roles={roles} markets={markets} onRoles={setRoles} onMarkets={setMarkets} />
            {missingMarket && <MarketsRequired />}
            {editing && (
              <div className="checks">
                <label className="check">
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                  {st('active')}
                  <InfoTip text={st('form.user.activeInfo')} />
                </label>
              </div>
            )}
          </>
        )}
      </FormSection>
    </FormPage>
  )
}
