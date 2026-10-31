import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Tag } from '../../ui/components.tsx'
import { buyerDictionary } from './i18n.ts'
import type { CostCalculation } from './types.ts'

/**
 * Linije obračuna troškova: trošak, povraćaj i ono što je uračunato u cenu, uz oznaku procene.
 * Ide u karticu sa `flush`; `totals` dodaje zbirne redove na dno tabele.
 */
export function CostBreakdownView({ result, totals = true }: { result: CostCalculation; totals?: boolean }) {
  const { l, formatMoney } = useI18n()
  const bt = useLocalT(buyerDictionary)

  const kindLabel = (kind: 'COST' | 'REFUND' | 'INCLUDED') =>
    kind === 'COST' ? bt('costs.extra') : kind === 'REFUND' ? bt('costs.refund') : bt('costs.included')

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{bt('costs.line')}</th>
            <th>{bt('costs.kind')}</th>
            <th className="num">{bt('costs.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((line) => (
            <tr key={line.code}>
              <td>
                <div>{l(line.label)}</div>
                {line.note && <div className="muted">{l(line.note)}</div>}
              </td>
              <td>
                <div className="row">
                  <span className="muted">{kindLabel(line.kind)}</span>
                  {line.estimate && <Tag dashed>{bt('costs.estimate')}</Tag>}
                </div>
              </td>
              <td className={line.kind === 'INCLUDED' ? 'num subtle' : 'num'}>
                {line.kind === 'REFUND' ? '−' : ''}
                {formatMoney(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="cost-total">
              <th scope="row" colSpan={2}>
                {bt('costs.totalExtra')}
              </th>
              <td className="num">{formatMoney(result.totalExtra)}</td>
            </tr>
            {result.totalRefund > 0 && (
              <tr className="cost-total">
                <th scope="row" colSpan={2}>
                  {bt('costs.totalRefund')}
                </th>
                <td className="num">−{formatMoney(result.totalRefund)}</td>
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Zbir obračuna za karticu sa linijom mesinga: ukupno dodatno, cena i povraćaj, uz odricanje. */
export function CostLedger({ result, price }: { result: CostCalculation; price?: number }) {
  const { l, formatMoney } = useI18n()
  const bt = useLocalT(buyerDictionary)
  return (
    <div className="ledger">
      <span className="ledger__total">{formatMoney(result.totalExtra)}</span>
      <div className="ledger__rows">
        {price !== undefined && (
          <div className="ledger__row">
            <span>{bt('costs.unitPrice')}</span>
            <span>{formatMoney(price)}</span>
          </div>
        )}
        {result.totalRefund > 0 && (
          <div className="ledger__row">
            <span>{bt('costs.totalRefund')}</span>
            <span>−{formatMoney(result.totalRefund)}</span>
          </div>
        )}
      </div>
      <span className="ledger__note">{l(result.disclaimer)}</span>
    </div>
  )
}
