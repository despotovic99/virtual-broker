import { useState } from 'react'
import { useParams } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Field, FormSection, Notice } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi } from './api.ts'
import { DocumentFileFields, usePurchaseT, useUploadOnce } from './shared.tsx'
import { useOpinionSigning } from './tabs/LegalTab.tsx'
import type { OpinionConclusion } from './types.ts'

const CONCLUSIONS: OpinionConclusion[] = ['SIGN', 'SIGN_WITH_CONDITIONS', 'DO_NOT_SIGN']

/**
 * Novo pravno mišljenje (`/purchases/:id/opinions/new`): zaključak, obrazloženje,
 * uslovi i potpisan PDF. Posle uspeha vraća na karticu „Pravno”.
 */
export function OpinionFormPage() {
  const { id = '' } = useParams()
  const tt = usePurchaseT()
  const { formatNumber } = useI18n()
  const purchase = useAsync(() => purchasesApi.detail(id), [id])
  const signing = useOpinionSigning(purchase.data ?? undefined)
  const upload = useUploadOnce(id)
  const [conclusion, setConclusion] = useState<OpinionConclusion>('SIGN')
  const [reasoning, setReasoning] = useState('')
  const [conditions, setConditions] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const backTo = `/purchases/${id}?tab=legal`
  const counter = (value: string, max: number) => `${formatNumber(value.length)} / ${formatNumber(max)}`
  const notAllowed = purchase.data && !signing.loading && !signing.canSign
  const notAllowedText = signing.isLawyer && signing.myRole === 'ASSOCIATE' ? tt('legal.associateCannotSign') : tt('legal.cannotSign')
  const ready = Boolean(file) && reasoning.trim().length >= 10

  const submit = async () => {
    if (!file) return
    const document = await upload('LEGAL_OPINION', file)
    await purchasesApi.createOpinion(id, {
      conclusion,
      reasoning: reasoning.trim(),
      ...(conditions.trim() ? { conditions: conditions.trim() } : {}),
      documentId: document.id,
    })
    return backTo
  }

  const crumbs = [
    { label: tt('list.title'), to: '/purchases' },
    ...(purchase.data
      ? [{ label: `${purchase.data.project.name} · ${tt('detail.unit', { label: purchase.data.unit.label })}`, to: backTo }]
      : []),
    { label: tt('legal.opinionNew') },
  ]

  const reasoningShort = reasoning.length > 0 && reasoning.trim().length < 10

  return (
    <FormPage
      title={tt('legal.opinionNew')}
      description={tt('form.opinion.description')}
      crumbs={crumbs}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={tt('legal.submitOpinion')}
      disabledReason={notAllowed ? notAllowedText : ready ? null : tt('legal.opinionRequired')}
      loading={purchase.loading && !purchase.data}
      loadError={purchase.data ? null : purchase.error}
      onRetry={purchase.reload}
      intro={
        notAllowed ? (
          <Notice tone="warn" icon="lock">
            {notAllowedText}
          </Notice>
        ) : undefined
      }
    >
      <FormSection title={tt('form.opinion.conclusionTitle')} description={tt('form.opinion.conclusionHint')} columns={1}>
        <Field label={tt('legal.conclusion')} required info={tt('form.opinion.conclusionInfo')}>
          <select value={conclusion} onChange={(event) => setConclusion(event.target.value as OpinionConclusion)}>
            {CONCLUSIONS.map((value) => (
              <option key={value} value={value}>
                {tt(`conclusion.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Notice tone={conclusion === 'DO_NOT_SIGN' ? 'warn' : 'plain'}>{tt(`form.opinion.effect.${conclusion}`)}</Notice>
      </FormSection>

      <FormSection title={tt('form.opinion.textTitle')} description={tt('form.opinion.textHint')} columns={1}>
        <Field
          label={tt('legal.reasoning')}
          required
          info={tt('form.opinion.reasoningInfo')}
          hint={counter(reasoning, 10_000)}
          error={reasoningShort ? tt('form.opinion.reasoningShort') : null}
        >
          <textarea value={reasoning} rows={8} maxLength={10_000} onChange={(event) => setReasoning(event.target.value)} />
        </Field>
        <Field label={tt('legal.conditions')} info={tt('form.opinion.conditionsInfo')} hint={counter(conditions, 5_000)}>
          <textarea value={conditions} rows={4} maxLength={5_000} onChange={(event) => setConditions(event.target.value)} />
        </Field>
      </FormSection>

      <FormSection title={tt('form.opinion.fileTitle')} description={tt('form.opinion.fileHint')} columns={1}>
        {purchase.data && (
          <DocumentFileFields
            purchase={purchase.data}
            typeCode="LEGAL_OPINION"
            label={tt('legal.signedPdf')}
            required
            info={tt('form.opinion.fileInfo')}
            onFile={setFile}
          />
        )}
      </FormSection>
    </FormPage>
  )
}
