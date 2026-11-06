import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export type RebalancePath = 'trade' | 'contribution' | 'withdrawal';
export type RebalanceRule = 'calendar' | 'threshold' | 'combined';
export interface RebalanceInput {
  stock: number;
  bonds: number;
  stockReturn: number;
  bondReturn: number;
  targetStock: number;
}
export interface RebalanceResult {
  stock: number;
  bonds: number;
  total: number;
  stockWeight: number;
  drift: number;
  targetStockValue: number;
  targetBondValue: number;
  stockTrade: number;
  bondTrade: number;
  bothLegNotional: number;
  oneWayTurnover: number;
  contribution: { stock: number; bonds: number; total: number; outsideFlow: number };
  withdrawal: { stock: number; bonds: number; total: number; outsideFlow: number };
}

/** Two long-only assets, divisible holdings, unchanged prices during execution, no costs. */
export function calculateRebalance(input: RebalanceInput): RebalanceResult {
  for (const field of ['stock', 'bonds'] as const) {
    if (!Number.isFinite(input[field]) || input[field] < 0.01 || input[field] > 1e12)
      throw new Error(`RebalanceDrift: ${field} must be finite and between 0.01 and 1e12.`);
  }
  for (const field of ['stockReturn', 'bondReturn'] as const) {
    if (!Number.isFinite(input[field]) || input[field] < -0.5 || input[field] > 1)
      throw new Error(`RebalanceDrift: ${field} must be finite and between -0.5 and 1.`);
  }
  if (!Number.isFinite(input.targetStock) || input.targetStock < 0.1 || input.targetStock > 0.9)
    throw new Error('RebalanceDrift: targetStock must be finite and between 0.1 and 0.9.');
  const stock = input.stock * (1 + input.stockReturn);
  const bonds = input.bonds * (1 + input.bondReturn);
  const total = stock + bonds;
  const w = input.targetStock;
  const targetStockValue = w * total;
  const targetBondValue = (1 - w) * total;
  const excess = stock - targetStockValue;
  const contributionAmount = excess >= 0 ? excess / w : -excess / (1 - w);
  const withdrawalAmount = excess >= 0 ? excess / (1 - w) : -excess / w;
  return {
    stock, bonds, total, stockWeight: stock / total, drift: stock / total - w,
    targetStockValue, targetBondValue, stockTrade: -excess, bondTrade: excess,
    bothLegNotional: 2 * Math.abs(excess), oneWayTurnover: Math.abs(excess) / total,
    contribution: {
      stock: excess >= 0 ? stock : stock + contributionAmount,
      bonds: excess >= 0 ? bonds + contributionAmount : bonds,
      total: total + contributionAmount, outsideFlow: contributionAmount,
    },
    withdrawal: {
      stock: excess >= 0 ? stock - withdrawalAmount : stock,
      bonds: excess >= 0 ? bonds : bonds - withdrawalAmount,
      total: total - withdrawalAmount, outsideFlow: -withdrawalAmount,
    },
  };
}

/** Equality triggers the threshold; a combined rule tests only on review dates. */
export function isRebalanceDue(rule: RebalanceRule, reviewNow: boolean, drift: number, band: number): boolean {
  if (!['calendar', 'threshold', 'combined'].includes(rule)) throw new Error('RebalanceDrift: invalid rule.');
  if (typeof reviewNow !== 'boolean') throw new Error('RebalanceDrift: reviewNow must be boolean.');
  if (!Number.isFinite(drift) || !Number.isFinite(band) || band < 0 || band > 0.2)
    throw new Error('RebalanceDrift: drift must be finite and band must be from 0 to 0.2.');
  const threshold = Math.abs(drift) + 1e-12 >= band;
  return rule === 'calendar' ? reviewNow : rule === 'threshold' ? threshold : reviewNow && threshold;
}

/** Reusable comparison of cost-free restoration routes and optional policy triggers.
 * All visible and assistive text is supplied through the label/message props. */
export interface RebalanceDriftProps extends Partial<RebalanceInput> {
  title?: string;
  locale?: string;
  currency?: string;
  /** Initial route; every route returns the same target with a different funding budget. */
  path?: RebalancePath;
  rule?: RebalanceRule;
  reviewNow?: boolean;
  band?: number;
  /** Show policy controls; these annotate rather than execute the previewed route. */
  showRules?: boolean;
  titleStock?: string;
  titleBonds?: string;
  stockReturnLabel?: string;
  bondReturnLabel?: string;
  targetLabel?: string;
  pathLabel?: string;
  tradeLabel?: string;
  contributionLabel?: string;
  withdrawalLabel?: string;
  initialLabel?: string;
  currentLabel?: string;
  restoredLabel?: string;
  targetMarkerLabel?: string;
  totalLabel?: string;
  stockWeightLabel?: string;
  driftLabel?: string;
  driftUnit?: string;
  outsideFlowLabel?: string;
  stockTradeLabel?: string;
  bondTradeLabel?: string;
  bothLegLabel?: string;
  oneWayLabel?: string;
  ruleLabel?: string;
  calendarLabel?: string;
  thresholdLabel?: string;
  combinedLabel?: string;
  reviewLabel?: string;
  bandLabel?: string;
  dueLabel?: string;
  notDueLabel?: string;
  /** Explains that the restored stage previews the route even when the rule waits. */
  previewMessage?: string;
  detailsLabel?: string;
  tableRegionLabel?: string;
  stageLabel?: string;
  caption?: string;
  className?: string;
}

export function RebalanceDrift({
  stock = 600, bonds = 400, stockReturn = 0.2, bondReturn = -0.1, targetStock = 0.6,
  path = 'trade', rule = 'threshold', reviewNow = false, band = 0.05, showRules = false,
  title = 'Follow the weights and the money', locale = 'en-US', currency = 'EUR',
  titleStock = 'Stocks', titleBonds = 'Bonds', stockReturnLabel = 'Stock return',
  bondReturnLabel = 'Bond return', targetLabel = 'Target stock weight', pathLabel = 'Restoration route',
  tradeLabel = 'Trade within the portfolio', contributionLabel = 'Add outside money',
  withdrawalLabel = 'Withdraw money', initialLabel = 'Before returns', currentLabel = 'After returns',
  restoredLabel = 'After restoration', targetMarkerLabel = 'Stock target marker', totalLabel = 'Total',
  stockWeightLabel = 'Stock weight', driftLabel = 'Stock drift', driftUnit = 'percentage points',
  outsideFlowLabel = 'Outside cash flow', stockTradeLabel = 'Stock purchase + / sale −',
  bondTradeLabel = 'Bond purchase + / sale −', bothLegLabel = 'Both-leg traded notional',
  oneWayLabel = 'One-way turnover', ruleLabel = 'Rebalancing rule', calendarLabel = 'Calendar',
  thresholdLabel = 'Threshold', combinedLabel = 'Calendar plus threshold', reviewLabel = 'Scheduled review is today',
  bandLabel = 'Absolute drift threshold', dueLabel = 'Rule triggers restoration',
  notDueLabel = 'Rule does not trigger restoration',
  previewMessage = 'The restored stage previews the chosen route. A waiting rule does not execute that adjustment.',
  detailsLabel = 'Inspect the amounts',
  tableRegionLabel = 'Portfolio amounts by stage, scroll horizontally if needed', stageLabel = 'Stage',
  caption = 'Illustrative two-asset model before costs and taxes. Prices stay fixed while restoring weights, and holdings are divisible. A positive outside flow adds capital; a negative flow removes it. Routes use different amounts of outside capital. Displayed money is rounded to cents; calculations use unrounded values.',
  className,
}: RebalanceDriftProps) {
  calculateRebalance({ stock, bonds, stockReturn, bondReturn, targetStock });
  if (typeof showRules !== 'boolean') throw new Error('RebalanceDrift: showRules must be boolean.');
  if (new Set([initialLabel, currentLabel, restoredLabel]).size !== 3)
    throw new Error('RebalanceDrift: stage labels must be distinct.');
  isRebalanceDue(rule, reviewNow, 0, band);
  if (!['trade', 'contribution', 'withdrawal'].includes(path)) throw new Error('RebalanceDrift: invalid path.');
  const labels = { title, titleStock, titleBonds, stockReturnLabel, bondReturnLabel, targetLabel,
    pathLabel, tradeLabel, contributionLabel, withdrawalLabel, initialLabel, currentLabel, restoredLabel,
    targetMarkerLabel, totalLabel, stockWeightLabel, driftLabel, driftUnit, outsideFlowLabel, stockTradeLabel,
    bondTradeLabel, bothLegLabel, oneWayLabel, ruleLabel, calendarLabel, thresholdLabel, combinedLabel,
    reviewLabel, bandLabel, dueLabel, notDueLabel, previewMessage, detailsLabel, tableRegionLabel, stageLabel, caption };
  for (const [key, value] of Object.entries(labels))
    if (typeof value !== 'string' || !value.trim()) throw new Error(`RebalanceDrift: ${key} must be nonempty.`);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const id = useId();
  const [sr, setSr] = useState(stockReturn);
  const [br, setBr] = useState(bondReturn);
  const [target, setTarget] = useState(targetStock);
  const [route, setRoute] = useState(path);
  const [activeRule, setActiveRule] = useState(rule);
  const [review, setReview] = useState(reviewNow);
  const [threshold, setThreshold] = useState(band);
  const m = calculateRebalance({ stock, bonds, stockReturn: sr, bondReturn: br, targetStock: target });
  const final = route === 'trade'
    ? { stock: m.targetStockValue, bonds: m.targetBondValue, total: m.total, outsideFlow: 0 }
    : m[route];
  const stages = [
    { label: initialLabel, stock, bonds, total: stock + bonds },
    { label: currentLabel, stock: m.stock, bonds: m.bonds, total: m.total },
    { label: restoredLabel, ...final },
  ];
  const controlClass = 'w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600';
  const due = isRebalanceDue(activeRule, review, m.drift, threshold);
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 sm:p-6 text-ink-800', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {[
        { key: 'sr', label: stockReturnLabel, value: sr, set: setSr, min: -0.5, max: 1 },
        { key: 'br', label: bondReturnLabel, value: br, set: setBr, min: -0.5, max: 1 },
        { key: 'target', label: targetLabel, value: target, set: setTarget, min: 0.1, max: 0.9 },
      ].map(c => <label key={c.key} htmlFor={`${id}-${c.key}`} className="block text-sm font-medium">
        <span className="flex justify-between gap-3"><span>{c.label}</span><output>{pct.format(c.value)}</output></span>
        <input id={`${id}-${c.key}`} className={cx(controlClass, 'mt-3')} type="range" min={c.min} max={c.max} step={0.01} value={c.value} onChange={e => c.set(Number(e.target.value))} />
      </label>)}
      <label htmlFor={`${id}-path`} className="block text-sm font-medium">{pathLabel}
        <select id={`${id}-path`} value={route} onChange={e => setRoute(e.target.value as RebalancePath)} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600">
          <option value="trade">{tradeLabel}</option><option value="contribution">{contributionLabel}</option><option value="withdrawal">{withdrawalLabel}</option>
        </select>
      </label>
    </div>
    <div className="mt-6 space-y-5">
      {stages.map(s => <div key={s.label}>
        <div className="mb-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><span className="font-semibold">{s.label}</span><span>{titleStock}: {pct.format(s.stock / s.total)} · {titleBonds}: {pct.format(s.bonds / s.total)}</span></div>
        <div className="relative flex h-5 overflow-visible rounded-pill bg-accent-300" aria-hidden="true">
          <span className="h-5 rounded-l-pill bg-brand-600" style={{ width: `${100 * s.stock / s.total}%` }} />
          <span className="absolute -top-1 h-7 w-0.5 bg-ink-900" style={{ left: `${target * 100}%` }} />
        </div>
      </div>)}
      <p className="text-xs text-ink-600">{targetMarkerLabel}: {pct.format(target)} · <span className="text-brand-700">{titleStock}</span> / {titleBonds}</p>
    </div>
    <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite" aria-atomic="true">
      <p>{driftLabel}: <strong>{num.format(m.drift * 100)} {driftUnit}</strong></p>
      <p>{outsideFlowLabel}: <strong>{money.format(final.outsideFlow)}</strong></p>
      {route === 'trade' && <>
        <p>{stockTradeLabel}: <strong>{money.format(m.stockTrade)}</strong></p>
        <p>{bondTradeLabel}: <strong>{money.format(m.bondTrade)}</strong></p>
        <p>{bothLegLabel}: <strong>{money.format(m.bothLegNotional)}</strong></p>
        <p>{oneWayLabel}: <strong>{pct.format(m.oneWayTurnover)}</strong></p>
      </>}
    </div>
    {showRules && <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-rule`} className="text-sm font-medium">{ruleLabel}
        <select id={`${id}-rule`} value={activeRule} onChange={e => setActiveRule(e.target.value as RebalanceRule)} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-brand-600">
          <option value="calendar">{calendarLabel}</option><option value="threshold">{thresholdLabel}</option><option value="combined">{combinedLabel}</option>
        </select>
      </label>
      <label htmlFor={`${id}-band`} className="text-sm font-medium">{bandLabel}: {num.format(threshold * 100)} {driftUnit}
        <input id={`${id}-band`} type="range" className={cx(controlClass, 'mt-3')} min={0} max={0.2} step={0.01} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
      </label>
      <label className="flex items-center gap-2 text-sm" htmlFor={`${id}-review`}><input id={`${id}-review`} type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} className="accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" />{reviewLabel}</label>
      <p role="status" className="text-sm font-semibold">{due ? dueLabel : notDueLabel}</p>
      <p className="text-xs text-ink-600 sm:col-span-2">{previewMessage}</p>
    </div>}
    <details className="mt-6">
      <summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{detailsLabel}</summary>
      <div className="mt-3">
        <table tabIndex={0} aria-label={tableRegionLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <caption className="sr-only">{tableRegionLabel}</caption>
          <thead><tr>{[stageLabel, titleStock, titleBonds, totalLabel, stockWeightLabel].map(v => <th key={v} scope="col" className="p-2 font-semibold">{v}</th>)}</tr></thead>
          <tbody>{stages.map(s => <tr key={s.label} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{s.label}</th><td className="p-2 font-mono">{money.format(s.stock)}</td><td className="p-2 font-mono">{money.format(s.bonds)}</td><td className="p-2 font-mono">{money.format(s.total)}</td><td className="p-2 font-mono">{pct.format(s.stock / s.total)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default RebalanceDrift;
