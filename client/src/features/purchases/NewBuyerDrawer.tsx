import { useEffect, useState } from 'react'
import { ApiError } from '../../core/api/http.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Field, FormSection, InfoTip } from '../../ui/components.tsx'
import { Icon } from '../../ui/icons.tsx'
import { FormModal } from '../../ui/Modal.tsx'
import { purchasesApi } from './api.ts'
import { usePurchaseT } from './shared.tsx'
import type { StaffMember } from './types.ts'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Početna lozinka od 16 znakova (bez sličnih znakova kao 0/O i l/1). */
function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(bytes, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('')
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  language: 'sr' | 'en'
  password: string
  withProfile: boolean
  isFirstHome: boolean
  isEuCitizen: boolean
  primaryResidence: boolean
  financing: 'CASH' | 'MORTGAGE'
  age: string
  householdMembers: string
  budget: string
}

/** Tekst pretrage popunjava email (ako ima @) ili ime i prezime. */
function initialForm(search: string): FormState {
  const text = search.trim()
  const [first = '', ...rest] = text.includes('@') ? [] : text.split(/\s+/)
  return {
    firstName: first,
    lastName: rest.join(' '),
    email: text.includes('@') ? text : '',
    language: 'sr',
    password: generatePassword(),
    withProfile: false,
    isFirstHome: false,
    isEuCitizen: false,
    primaryResidence: false,
    financing: 'CASH',
    age: '',
    householdMembers: '1',
    budget: '',
  }
}

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

/**
 * Bočni panel „Nov kupac” sa ekrana nove kupovine. Pravi nalog sa ulogom
 * kupca (POST /users/buyers) i opciono profil; posle čuvanja kupac je izabran.
 */
export function NewBuyerDrawer({
  open,
  initialSearch,
  onClose,
  onCreated,
}: {
  open: boolean
  initialSearch: string
  onClose: () => void
  onCreated: (buyer: StaffMember) => void
}) {
  const tt = usePurchaseT()
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>(() => initialForm(initialSearch))
  const [showPassword, setShowPassword] = useState(true)
  const [copied, setCopied] = useState(false)
  const [emailTaken, setEmailTaken] = useState<string | null>(null)

  // Svako otvaranje počinje od teksta pretrage i nove lozinke.
  useEffect(() => {
    if (!open) return
    setForm(initialForm(initialSearch))
    setShowPassword(true)
    setCopied(false)
    setEmailTaken(null)
  }, [open, initialSearch])

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const email = form.email.trim()
  const emailInvalid = email !== '' && !EMAIL.test(email)
  const passwordShort = form.password.length > 0 && form.password.length < 12
  const age = form.age ? Number(form.age) : null
  const household = Number(form.householdMembers || 0)
  const ageInvalid = form.withProfile && age !== null && (age < 18 || age > 120)
  const householdInvalid = form.withProfile && (household < 1 || household > 20)

  const disabledReason =
    !form.firstName.trim() || !form.lastName.trim() || !email || form.password.length === 0
      ? tt('form.buyerNew.required')
      : emailInvalid
        ? tt('form.buyerNew.emailInvalid')
        : passwordShort
          ? tt('form.buyerNew.passwordShort')
          : ageInvalid || householdInvalid
            ? tt('form.buyerNew.profileInvalid')
            : null

  const submit = async () => {
    setEmailTaken(null)
    try {
      const created = await purchasesApi.createBuyer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email,
        language: form.language,
        password: form.password,
        profile: form.withProfile
          ? {
              isFirstHome: form.isFirstHome,
              isEuCitizen: form.isEuCitizen,
              primaryResidence: form.primaryResidence,
              financing: form.financing,
              age: age ?? undefined,
              householdMembers: household,
              budget: form.budget ? Number(form.budget) : undefined,
            }
          : undefined,
      })
      onCreated(created)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USER_EMAIL_TAKEN') setEmailTaken(tt('form.buyerNew.emailTaken'))
      throw error
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(form.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      size="drawer"
      title={tt('form.buyerNew.title')}
      description={tt('form.buyerNew.description')}
      submitLabel={tt('form.buyerNew.submit')}
      onSubmit={submit}
      disabledReason={disabledReason}
      dirty
    >
      <FormSection title={tt('form.buyerNew.identity')} description={tt('form.buyerNew.identityHint')}>
        <Field label={tt('form.buyerNew.firstName')} required>
          <input value={form.firstName} onChange={(event) => update({ firstName: event.target.value })} maxLength={100} autoComplete="off" />
        </Field>
        <Field label={tt('form.buyerNew.lastName')} required>
          <input value={form.lastName} onChange={(event) => update({ lastName: event.target.value })} maxLength={100} autoComplete="off" />
        </Field>
        <Field
          label={tt('form.buyerNew.email')}
          required
          wide
          info={tt('form.buyerNew.emailInfo')}
          error={emailTaken ?? (emailInvalid ? tt('form.buyerNew.emailInvalid') : null)}
        >
          <input
            type="email"
            value={form.email}
            onChange={(event) => {
              update({ email: event.target.value })
              setEmailTaken(null)
            }}
            maxLength={254}
            autoComplete="off"
          />
        </Field>
        <Field label={tt('form.buyerNew.language')} info={tt('form.buyerNew.languageInfo')} wide>
          <select value={form.language} onChange={(event) => update({ language: event.target.value as 'sr' | 'en' })}>
            <option value="sr">{tt('form.buyerNew.languageSr')}</option>
            <option value="en">{tt('form.buyerNew.languageEn')}</option>
          </select>
        </Field>
      </FormSection>

      <FormSection title={tt('form.buyerNew.access')} description={tt('form.buyerNew.accessHint')} columns={1}>
        <Field
          label={tt('form.buyerNew.password')}
          required
          info={tt('form.buyerNew.passwordInfo')}
          hint={copied ? tt('form.buyerNew.copied') : tt('form.buyerNew.passwordHint')}
          error={passwordShort ? tt('form.buyerNew.passwordShort') : null}
        >
          <input
            className="mono"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(event) => {
              update({ password: event.target.value })
              setCopied(false)
            }}
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            spellCheck={false}
          />
        </Field>
        <div className="row">
          <button
            type="button"
            className="sm"
            onClick={() => {
              update({ password: generatePassword() })
              setCopied(false)
            }}
          >
            <Icon name="progress" size={12} />
            {tt('form.buyerNew.generate')}
          </button>
          <button type="button" className="sm" onClick={() => void copy()}>
            <Icon name="check" size={12} />
            {tt('form.buyerNew.copy')}
          </button>
          <button type="button" className="sm quiet" onClick={() => setShowPassword((value) => !value)} aria-pressed={!showPassword}>
            {showPassword ? tt('form.buyerNew.hide') : tt('form.buyerNew.show')}
          </button>
        </div>
      </FormSection>

      <FormSection title={tt('form.buyerNew.profile')} description={tt('form.buyerNew.profileHint')}>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={form.withProfile} onChange={(event) => update({ withProfile: event.target.checked })} />
            {tt('form.buyerNew.withProfile')}
            <InfoTip text={tt('form.buyerNew.withProfileInfo')} />
          </label>
        </div>
        {form.withProfile && (
          <>
            <div className="checks">
              <label className="check">
                <input type="checkbox" checked={form.isFirstHome} onChange={(event) => update({ isFirstHome: event.target.checked })} />
                {tt('form.buyerNew.isFirstHome')}
                <InfoTip text={tt('form.buyerNew.isFirstHomeInfo')} />
              </label>
              <label className="check">
                <input type="checkbox" checked={form.isEuCitizen} onChange={(event) => update({ isEuCitizen: event.target.checked })} />
                {tt('form.buyerNew.isEuCitizen')}
                <InfoTip text={tt('form.buyerNew.isEuCitizenInfo')} />
              </label>
              <label className="check">
                <input type="checkbox" checked={form.primaryResidence} onChange={(event) => update({ primaryResidence: event.target.checked })} />
                {tt('form.buyerNew.primaryResidence')}
                <InfoTip text={tt('form.buyerNew.primaryResidenceInfo')} />
              </label>
            </div>
            <Field label={tt('form.buyerNew.financing')} info={tt('form.buyerNew.financingInfo')}>
              <select value={form.financing} onChange={(event) => update({ financing: event.target.value as 'CASH' | 'MORTGAGE' })}>
                <option value="CASH">{tt('form.buyerNew.cash')}</option>
                <option value="MORTGAGE">{tt('form.buyerNew.mortgage')}</option>
              </select>
            </Field>
            <Field
              label={tt('form.buyerNew.age')}
              hint={t('common.optional')}
              suffix={tt('form.buyerNew.ageSuffix')}
              error={ageInvalid ? tt('form.buyerNew.ageInvalid') : null}
            >
              <input className="num" inputMode="numeric" value={form.age} onChange={(event) => update({ age: digits(event.target.value, 3) })} />
            </Field>
            <Field
              label={tt('form.buyerNew.householdMembers')}
              required
              info={tt('form.buyerNew.householdInfo')}
              error={householdInvalid ? tt('form.buyerNew.householdInvalid') : null}
            >
              <input
                className="num"
                inputMode="numeric"
                value={form.householdMembers}
                onChange={(event) => update({ householdMembers: digits(event.target.value, 2) })}
              />
            </Field>
            <Field label={tt('form.buyerNew.budget')} hint={t('common.optional')} suffix="€" info={tt('form.buyerNew.budgetInfo')}>
              <input className="num" inputMode="numeric" value={form.budget} onChange={(event) => update({ budget: digits(event.target.value, 9) })} />
            </Field>
          </>
        )}
      </FormSection>
    </FormModal>
  )
}
