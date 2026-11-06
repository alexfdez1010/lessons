import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ReturnMeasurementResult {
  arithmetic: number; geometric: number; totalReturn: number; moneyWeighted: number;
  rawBalanceGrowth: number; beforeContribution: number; afterContribution: number;
  unitEnding: number; accountEnding: number; gap: number;
}
/** Two equal one-year periods. Contribution is made after the first return,
 * before the second. The account is fully liquidated after year two. */
export function calculateReturnMeasurement(first: number, second: number, contribution: number, principal = 100): ReturnMeasurementResult {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 1e9) throw new Error('ReturnMeasurementPaths: principal must be positive and at most 1e9.');
  if (![first, second].every(r => Number.isFinite(r) && r >= -.8 && r <= .8)) throw new Error('ReturnMeasurementPaths: annual returns must be finite from -0.8 to 0.8.');
  if (!Number.isFinite(contribution) || contribution < 0 || contribution > 2 * principal) throw new Error('ReturnMeasurementPaths: contribution must be from zero to twice principal.');
  const beforeContribution = principal * (1 + first);
  const afterContribution = beforeContribution + contribution;
  const unitEnding = principal * (1 + first) * (1 + second);
  const accountEnding = afterContribution * (1 + second);
  const arithmetic = (first + second) / 2;
  const geometric = Math.sqrt((1 + first) * (1 + second)) - 1;
  // Normalize P*x² + C*x - ending = 0 by P before solving for x=1+IRR.
  // The dimensionless coefficients stay bounded across currency scales, avoiding
  // underflow from multiplying two tiny balances. Build growth factors directly
  // so rate outputs do not depend on rounded/subnormal monetary balances.
  const contributionRatio = contribution / principal;
  const unitFactor = (1 + first) * (1 + second);
  const endingFactor = (1 + first + contributionRatio) * (1 + second);
  const x = 2 * endingFactor / (contributionRatio + Math.sqrt(contributionRatio ** 2 + 4 * endingFactor));
  return { arithmetic, geometric, totalReturn: unitFactor - 1, moneyWeighted: x - 1,
    rawBalanceGrowth: Math.sqrt(endingFactor) - 1, beforeContribution,
    afterContribution, unitEnding, accountEnding, gap: arithmetic - geometric };
}
export interface ReturnMeasurementPathsProps {
  firstReturn?: number; secondReturn?: number; contribution?: number; principal?: number;
  locale?: string; currency?: string; title?: string; firstLabel?: string; secondLabel?: string;
  contributionLabel?: string; reverseLabel?: string; accountLabel?: string; unitLabel?: string;
  arithmeticLabel?: string; geometricLabel?: string; moneyWeightedLabel?: string;
  rawBalanceLabel?: string; startLabel?: string; beforeLabel?: string; afterLabel?: string;
  finishLabel?: string; timeLabel?: string; investorFlowLabel?: string; tableLabel?: string;
  chartLabel?: string; axisLabel?: string; caption?: string; className?: string;
}
export function ReturnMeasurementPaths({ firstReturn = .5, secondReturn = -.5, contribution = 0, principal = 100,
  locale = 'en-US', currency = 'EUR', title = 'Separate investment returns from added money',
  firstLabel = 'First annual return', secondLabel = 'Second annual return', contributionLabel = 'Contribution at year one, after its return',
  reverseLabel = 'Reverse the two annual returns', accountLabel = 'Account balance, including contribution',
  unitLabel = 'Same initial investment, without external flows', arithmeticLabel = 'Arithmetic mean per year',
  geometricLabel = 'Geometrically linked annual return', moneyWeightedLabel = 'Money-weighted annual IRR',
  rawBalanceLabel = 'Unadjusted balance-growth rate, not cash-flow-adjusted performance',
  startLabel = 'Year zero, initial investment', beforeLabel = 'Year one, before contribution',
  afterLabel = 'Year one, after contribution', finishLabel = 'Year two, before liquidation', timeLabel = 'Valuation time',
  investorFlowLabel = 'Investor cash flow', tableLabel = 'Dated balances and investor cash flows, scroll horizontally if needed',
  axisLabel = 'Years since the initial investment',
  chartLabel = 'First return {first}; second return {second}; contribution {contribution} at year one. Final account {ending}. Annual time-weighted return {geometric}; money-weighted IRR {mwr}.',
  caption = 'Invented two-year total-return model. The contribution enters immediately after the first annual return; the full ending balance is then withdrawn at year two. No fees or tax. Both annual return factors stay positive. The solid account path jumps when outside money enters; the dashed no-flow path isolates the same investment returns. The unadjusted balance growth rate includes contributed money; with a nonzero contribution it does not measure investment performance.', className,
}: ReturnMeasurementPathsProps) {
  calculateReturnMeasurement(firstReturn, secondReturn, contribution, principal);
  const labels = { title, firstLabel, secondLabel, contributionLabel, reverseLabel, accountLabel, unitLabel,
    arithmeticLabel, geometricLabel, moneyWeightedLabel, rawBalanceLabel, startLabel, beforeLabel, afterLabel,
    finishLabel, timeLabel, investorFlowLabel, tableLabel, chartLabel, axisLabel, caption };
  for (const [name, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`ReturnMeasurementPaths: ${name} must be nonempty.`);
  const id = useId(); const [first, setFirst] = useState(firstReturn); const [second, setSecond] = useState(secondReturn); const [cash, setCash] = useState(contribution);
  const m = calculateReturnMeasurement(first, second, cash, principal);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const account = [principal, m.beforeContribution, m.afterContribution, m.accountEnding];
  const unit = [principal, m.beforeContribution, m.beforeContribution, m.unitEnding];
  const times = [0, 1, 1, 2]; const names = [startLabel, beforeLabel, afterLabel, finishLabel];
  const flows = [-principal, 0, cash === 0 ? 0 : -cash, m.accountEnding];
  const max = Math.max(...account, ...unit) * 1.1; const W = 640, H = 300;
  const x = (t: number) => 52 + t * 268; const y = (v: number) => 245 - v / max * 215;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'} ${x(times[i]!)} ${y(v)}`).join(' ');
  const substitutions = { first: percent.format(first), second: percent.format(second), contribution: money.format(cash), ending: money.format(m.accountEnding), geometric: percent.format(m.geometric), mwr: percent.format(m.moneyWeighted) };
  const alt = chartLabel.replace(/\{(first|second|contribution|ending|geometric|mwr)\}/g, (_, key: keyof typeof substitutions) => substitutions[key]);
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {[{ label: firstLabel, value: first, set: setFirst, key: 'first' }, { label: secondLabel, value: second, set: setSecond, key: 'second' }].map(c => <label key={c.key} htmlFor={`${id}-${c.key}`} className="min-w-0 text-sm font-medium">{c.label}: <output className="font-mono">{percent.format(c.value)}</output><input id={`${id}-${c.key}`} type="range" min={-.8} max={.8} step={.01} value={c.value} onChange={e => c.set(Number(e.target.value))} className="mt-3 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>)}
      <label htmlFor={`${id}-cash`} className="min-w-0 text-sm font-medium sm:col-span-2">{contributionLabel}: <output className="font-mono">{money.format(cash)}</output><input id={`${id}-cash`} type="range" min={0} max={2 * principal} step={principal / 20} value={cash} onChange={e => setCash(Number(e.target.value))} className="mt-3 h-8 w-full accent-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
    </div>
    <button type="button" onClick={() => { setFirst(second); setSecond(first); }} className="mt-4 rounded-pill border border-brand-600 bg-surface px-4 py-2 text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{reverseLabel}</button>
    <div className="mt-5 flex flex-wrap gap-3 text-sm"><span className="inline-flex items-center gap-2"><span className="h-1 w-6 bg-brand-600" aria-hidden="true"/>{accountLabel}</span><span className="inline-flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-accent-600" aria-hidden="true"/>{unitLabel}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="mt-3 w-full overflow-visible">
      <line x1={52} x2={588} y1={245} y2={245} stroke="var(--color-ink-300)"/>
      {[0, 1, 2].map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={245} y2={252} stroke="var(--color-ink-400)"/><text x={x(t)} y={280} textAnchor="middle" fill="var(--color-ink-700)" className="text-[28px] sm:text-[15px]">{t}</text></g>)}
      <path d={path(account)} stroke="var(--color-brand-600)" strokeWidth={4} fill="none"/>
      <path d={path(unit)} stroke="var(--color-accent-600)" strokeWidth={3} strokeDasharray="9 7" fill="none"/>
      {account.map((v, i) => <circle key={i} cx={x(times[i]!)} cy={y(v)} r={5} fill="var(--color-brand-600)"/>)}
    </svg>
    <p className="text-center text-xs text-ink-600">{axisLabel}</p>
    <dl className="mt-2 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[arithmeticLabel, m.arithmetic], [geometricLabel, m.geometric], [moneyWeightedLabel, m.moneyWeighted], [rawBalanceLabel, m.rawBalanceGrowth]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono text-lg font-semibold">{percent.format(Number(value))}</dd></div>)}</dl>
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableLabel}</caption><thead><tr>{[timeLabel, unitLabel, accountLabel, investorFlowLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{names.map((name, i) => <tr key={name} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{name}</th><td className="whitespace-nowrap p-2 font-mono">{money.format(unit[i]!)}</td><td className="whitespace-nowrap p-2 font-mono">{money.format(account[i]!)}</td><td className="whitespace-nowrap p-2 font-mono">{money.format(flows[i]!)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default ReturnMeasurementPaths;
