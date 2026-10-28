import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { StatusBadge } from '../../ui/components.tsx'
import { buyerDictionary } from './i18n.ts'
import type { CostCalculation } from './types.ts'

/** Linije obračuna troškova: trošak, povraćaj i ono što je uračunato u cenu, uz oznaku procene. */
export function CostBreakdownView({ result }: { result: CostCalculation }) {
  const { l, formatMoney } = useI18n()
  const bt = useLocalT(buyerDictionary)

  const kindLabel = (kind: 'COST' | 'REFUND' | 'INCLUDED') =>
    kind === 'COST' ? bt('costs.extra') : kind === 'REFUND' ? bt('costs.refund') : bt('costs.included')

  return (
    <div>
      <div className="buyer-table-wrap">
        <table>
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.code}>
                <td>
                  <div>{l(line.label)}</div>
                  {line.note && <div className="muted">{l(line.note)}</div>}
                </td>
                <td>
                  <span className="muted">{kindLabel(line.kind)}</span>
                  {line.estimate && (
                    <>
                      {' '}
                      <StatusBadge text={bt('costs.estimate')} tone="warn" />
                    </>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {line.kind === 'REFUND' ? '−' : ''}
                  {formatMoney(line.amount)}
                </td>
              </tr>
            ))}
            <tr className="buyer-cost-total">
              <td colSpan={2}>{bt('costs.totalExtra')}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(result.totalExtra)}</td>
            </tr>
            {result.totalRefund > 0 && (
              <tr className="buyer-cost-total">
                <td colSpan={2}>{bt('costs.totalRefund')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(result.totalRefund)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{l(result.disclaimer)}</p>
    </div>
  )
}
