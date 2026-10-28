import { useState, type FormEvent } from 'react'
import { api } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, Field, Page } from '../../ui/components.tsx'
import { CostBreakdownView } from './CostBreakdownView.tsx'
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
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={bt('costs.title')}>
      <Card>
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="buyer-filters">
            <Field label={t('common.market')}>
              <select value={market} onChange={(event) => setMarket(event.target.value === 'CY' ? 'CY' : 'RS')}>
                {MARKETS.map((code) => (
                  <option key={code} value={code}>
                    {t(`market.${code}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={bt('costs.price')} hint={market === 'RS' ? bt('project.priceNoteRS') : bt('project.priceNoteCY')}>
              <input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, '').slice(0, 9))} />
            </Field>
            <Field label={bt('costs.area')}>
              <input
                inputMode="decimal"
                value={area}
                onChange={(event) => setArea(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
              />
            </Field>
            <Field label={bt('costs.loanAmount')} hint={t('common.optional')}>
              <input inputMode="numeric" value={loan} onChange={(event) => setLoan(event.target.value.replace(/\D/g, '').slice(0, 9))} />
            </Field>
          </div>
          <p className="muted">{bt('costs.profileNote')}</p>
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={!valid || busy}>
            {bt('costs.calculate')}
          </button>
        </form>
      </Card>
      {result && (
        <Card>
          <CostBreakdownView result={result} />
        </Card>
      )}
    </Page>
  )
}
