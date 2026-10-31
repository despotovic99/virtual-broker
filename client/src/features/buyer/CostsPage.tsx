import { useState, type FormEvent } from 'react'
import { api } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Button, Card, ErrorBox, Field, FormSection, Notice, Page } from '../../ui/components.tsx'
import { CostBreakdownView, CostLedger } from './CostBreakdownView.tsx'
import { buyerDictionary } from './i18n.ts'
import type { CostCalculateBody, CostCalculation } from './types.ts'

/** Samostalni kalkulator troškova (F-10). Status kupca server uzima iz profila. */
export function CostsPage() {
  const { t } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const [market, setMarket] = useState<MarketCode>('RS')
  const [price, setPrice] = useState('')
  const [area, setArea] = useState('')
  const [loan, setLoan] = useState('')
  const [result, setResult] = useState<CostCalculation | null>(null)
  // Cena za koju je obračun napravljen (polje može da se promeni posle obračuna).
  const [resultPrice, setResultPrice] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const priceValue = Number.parseInt(price, 10)
  const areaValue = Number.parseFloat(area)
  const valid = Number.isFinite(priceValue) && priceValue > 0 && Number.isFinite(areaValue) && areaValue > 0

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid) return
    setError(null)
    setBusy(true)
    try {
      const body: CostCalculateBody = { market, price: priceValue, area: Math.round(areaValue * 100) / 100 }
      if (loan) body.loanAmount = Number.parseInt(loan, 10)
      setResult(await api<CostCalculation>('/costs/calculate', { method: 'POST', body }))
      setResultPrice(body.price)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={bt('costs.title')} meta={<span className="page-description">{bt('form.costs.description')}</span>}>
      <div className="form-page">
        <form className="card form-page__card" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="form-page__body">
            <FormSection title={bt('form.costs.unitTitle')} description={bt('form.costs.unitHint')}>
              <Field label={t('common.market')} required info={bt('form.costs.marketInfo')}>
                <select value={market} onChange={(event) => setMarket(event.target.value === 'CY' ? 'CY' : 'RS')}>
                  {MARKETS.map((code) => (
                    <option key={code} value={code}>
                      {t(`market.${code}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={bt('form.costs.price')}
                required
                suffix="€"
                info={bt('form.costs.priceInfo')}
                hint={market === 'RS' ? bt('project.priceNoteRS') : bt('project.priceNoteCY')}
              >
                <input
                  className="num"
                  inputMode="numeric"
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </Field>
              <Field label={bt('form.costs.area')} required suffix="m²" info={bt('form.costs.areaInfo')}>
                <input
                  className="num"
                  inputMode="decimal"
                  value={area}
                  onChange={(event) => setArea(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
              <Notice tone="plain">{bt('costs.profileNote')}</Notice>
            </FormSection>

            <FormSection title={bt('form.costs.loanTitle')} description={bt('form.costs.loanHint')}>
              <Field label={bt('form.costs.loan')} info={bt('form.costs.loanInfo')} hint={t('common.optional')} suffix="€">
                <input
                  className="num"
                  inputMode="numeric"
                  value={loan}
                  onChange={(event) => setLoan(event.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </Field>
            </FormSection>

            {Boolean(error) && (
              <div className="form-page__error">
                <ErrorBox error={error} />
              </div>
            )}
          </div>
          <div className="form-page__footer">
            <span className="form-page__footer-note">
              {valid ? (
                <span className="muted small">{t('form.requiredNote')}</span>
              ) : (
                <span className="form-page__reason">{bt('costs.fillRequired')}</span>
              )}
            </span>
            <Button type="submit" variant="primary" busy={busy} disabled={!valid} title={valid ? undefined : bt('costs.fillRequired')}>
              {bt('costs.calculate')}
            </Button>
          </div>
        </form>
      </div>

      {result && (
        <div className="layout-aside">
          <div className="layout-aside__main">
            <Card title={bt('project.costs')} flush>
              <CostBreakdownView result={result} totals={false} />
            </Card>
          </div>
          <div className="layout-aside__side">
            <Card label={bt('costs.totalExtra')} brass>
              <CostLedger result={result} price={resultPrice} />
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}
