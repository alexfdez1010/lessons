import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface YieldDurationInputs { faceValue: number; couponRate: number; years: number; frequency: number; annualYield: number; shockBp: number; quantity: number; }
export interface DurationCashFlow { period: number; time: number; cashFlow: number; presentValue: number; weight: number; weightedTime: number; }
export interface YieldDurationResult {
  price: number; macaulay: number; modified: number; derivative: number; dv01: number;
  centralDV01: number; upOneBpPrice: number; downOneBpPrice: number;
  exactShockPrice: number; linearShockPrice: number; exactPnl: number; linearPnl: number;
  positionDV01: number; rows: DurationCashFlow[];
}
function validate(i: YieldDurationInputs) {
  if (!Number.isFinite(i.faceValue) || i.faceValue <= 0 || i.faceValue > 1e9) throw new Error('YieldDurationWorkbench: faceValue must be positive and at most 1e9.');
  if (!Number.isFinite(i.couponRate) || i.couponRate < 0 || i.couponRate > .15) throw new Error('YieldDurationWorkbench: couponRate must be from zero to 0.15.');
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 50) throw new Error('YieldDurationWorkbench: years must be an integer from 1 to 50.');
  if (![1, 2, 4].includes(i.frequency)) throw new Error('YieldDurationWorkbench: frequency must be 1, 2 or 4.');
  if (!Number.isFinite(i.annualYield) || i.annualYield < -.02 || i.annualYield > .2) throw new Error('YieldDurationWorkbench: annualYield must be from -0.02 to 0.20.');
  if (!Number.isFinite(i.shockBp) || i.shockBp < -200 || i.shockBp > 200) throw new Error('YieldDurationWorkbench: shockBp must be from -200 to 200.');
  if (!Number.isFinite(i.quantity) || i.quantity <= 0 || i.quantity > 1e6) throw new Error('YieldDurationWorkbench: quantity must be positive and at most 1e6.');
}
/** Regular option-free schedule, settlement immediately after a coupon. The
 * annual nominal YTM is compounded at the same m as the payment frequency.
 * All promised flows are held fixed, no accrued interest/default/fees/taxes. */
export function calculateYieldDuration(i: YieldDurationInputs): YieldDurationResult {
  validate(i);
  const { faceValue: F, couponRate: c, years: T, frequency: m, annualYield: y, shockBp, quantity } = i;
  const n = T * m, coupon = F * c / m, base = 1 + y / m;
  const raw = Array.from({ length: n }, (_, index) => {
    const k = index + 1, time = k / m, cashFlow = coupon + (k === n ? F : 0);
    return { period: k, time, cashFlow, presentValue: cashFlow / base ** k };
  });
  const price = raw.reduce((s, r) => s + r.presentValue, 0);
  const rows = raw.map(r => ({ ...r, weight: r.presentValue / price, weightedTime: r.time * r.presentValue / price }));
  const macaulay = rows.reduce((s, r) => s + r.weightedTime, 0);
  const derivative = raw.reduce((s, r) => s - r.time * r.presentValue / base, 0);
  const modified = -derivative / price, dv01 = -derivative * .0001;
  const reprice = (yieldValue: number) => raw.reduce((s, r) => s + r.cashFlow / (1 + yieldValue / m) ** r.period, 0);
  const upOneBpPrice = reprice(y + .0001), downOneBpPrice = reprice(y - .0001);
  const exactShockPrice = reprice(y + shockBp * .0001);
  const linearShockPrice = price + derivative * shockBp * .0001;
  return { price, rows, macaulay, modified, derivative, dv01, upOneBpPrice, downOneBpPrice,
    centralDV01: (downOneBpPrice - upOneBpPrice) / 2, exactShockPrice, linearShockPrice,
    exactPnl: exactShockPrice - price, linearPnl: linearShockPrice - price, positionDV01: quantity * dv01 };
}
export interface YieldDurationWorkbenchProps extends Partial<YieldDurationInputs> {
  locale?: string; currency?: string; title?: string; couponLabel?: string; yearsLabel?: string; yieldLabel?: string;
  frequencyLabel?: string; annualLabel?: string; semiannualLabel?: string; quarterlyLabel?: string;
  shockLabel?: string; bpUnit?: string; yearsUnit?: string; priceLabel?: string; macaulayLabel?: string;
  modifiedLabel?: string; dv01Label?: string; signedBpLabel?: string; positionLabel?: string;
  exactLabel?: string; tangentLabel?: string; exactPnlLabel?: string; tangentPnlLabel?: string;
  balanceTitle?: string; curveTitle?: string; timeAxisLabel?: string; shockAxisLabel?: string;
  assumptionsMessage?: string; flowDetailsLabel?: string; riskDetailsLabel?: string;
  flowTableLabel?: string; riskTableLabel?: string; periodLabel?: string; timeLabel?: string;
  cashFlowLabel?: string; pvLabel?: string; weightLabel?: string; weightedTimeLabel?: string;
  balanceChartLabel?: string; curveChartLabel?: string; caption?: string; className?: string;
}
export function YieldDurationWorkbench({ faceValue = 1000, couponRate = .06, years = 3, frequency = 1, annualYield = .06, shockBp = 50, quantity = 1,
  locale = 'en-US', currency = 'EUR', title = 'Connect cash-flow timing, yield sensitivity and currency risk',
  couponLabel = 'Annual coupon rate', yearsLabel = 'Maturity in years', yieldLabel = 'Nominal annual YTM, compounded m times', frequencyLabel = 'Payments and yield compounding per year',
  annualLabel = 'Annual, m=1', semiannualLabel = 'Semiannual, m=2', quarterlyLabel = 'Quarterly, m=4', shockLabel = 'Change in the same quoted annual yield', bpUnit = 'bp', yearsUnit = 'years',
  priceLabel = 'Price per bond', macaulayLabel = 'Macaulay duration', modifiedLabel = 'Modified duration, relative sensitivity to decimal annual yield',
  dv01Label = 'Positive long-bond DV01 per basis point', signedBpLabel = 'First-order price change for a +1bp yield move', positionLabel = 'Positive DV01 of the stated long position',
  exactLabel = 'Exact repricing', tangentLabel = 'Duration tangent', exactPnlLabel = 'Exact price change for selected shock', tangentPnlLabel = 'First-order price change for selected shock',
  balanceTitle = 'Present-value weights and their time balance point', curveTitle = 'Exact price versus the tangent at the current yield', timeAxisLabel = 'Years until scheduled payment', shockAxisLabel = 'Annual quoted yield change, in basis points',
  assumptionsMessage = 'Face {face}; long quantity {quantity}; m={frequency}; annual nominal YTM {yield}. Settlement immediately after a coupon. Positive scheduled flows stay fixed; no default, fees or tax.',
  flowDetailsLabel = 'Inspect all discounted cash flows', riskDetailsLabel = 'Inspect repricing data and tangent estimates', flowTableLabel = 'Discounted cash flows, time weights and Macaulay contributions, scroll horizontally if needed', riskTableLabel = 'Exact and duration-approximated prices across yield shocks, scroll horizontally if needed',
  periodLabel = 'Payment number', timeLabel = 'Time in years', cashFlowLabel = 'Scheduled cash flow', pvLabel = 'Present value', weightLabel = 'PV weight', weightedTimeLabel = 'Contribution to duration in years',
  balanceChartLabel = 'Face {face}, coupon {coupon}, maturity {years}, frequency {frequency}. Macaulay duration {macaulay} years; modified duration {modified}; positive DV01 {dv01}.',
  curveChartLabel = 'For a yield change of {shock}, exact price {exact}; duration estimate {tangent}. Both use the same fixed scheduled cash flows and current quoted-yield convention.',
  caption = 'Invented regular option-free bond. The annual quoted yield is a decimal nominal rate compounded m times, not an effective annual rate. Bars show PV weights; the triangle marks their average time. The solid curve reprices every fixed cash flow; the dashed line uses today’s derivative. All chart data are available in the tables. The signed +1bp price change is negative for this long bond, while DV01 is quoted as a positive magnitude. No motion is needed to read the result.', className,
}: YieldDurationWorkbenchProps) {
  const authored = { faceValue, couponRate, years, frequency, annualYield, shockBp, quantity }; calculateYieldDuration(authored);
  const labels = { title, couponLabel, yearsLabel, yieldLabel, frequencyLabel, annualLabel, semiannualLabel, quarterlyLabel, shockLabel, bpUnit, yearsUnit, priceLabel, macaulayLabel, modifiedLabel, dv01Label, signedBpLabel, positionLabel, exactLabel, tangentLabel, exactPnlLabel, tangentPnlLabel, balanceTitle, curveTitle, timeAxisLabel, shockAxisLabel, assumptionsMessage, flowDetailsLabel, riskDetailsLabel, flowTableLabel, riskTableLabel, periodLabel, timeLabel, cashFlowLabel, pvLabel, weightLabel, weightedTimeLabel, balanceChartLabel, curveChartLabel, caption };
  for (const [name, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`YieldDurationWorkbench: ${name} must be nonempty.`);
  const id = useId(), [c, setC] = useState(couponRate), [T, setT] = useState(years), [m, setM] = useState(frequency), [y, setY] = useState(annualYield), [shock, setShock] = useState(shockBp);
  const model = calculateYieldDuration({ ...authored, couponRate: c, years: T, frequency: m, annualYield: y, shockBp: shock });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const riskMoney = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 8 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const substitute = (template: string, values: Record<string, string>) => template.replace(/\{([a-z]+)\}/g, (whole, key: string) => values[key] ?? whole);
  const variables = { face: money.format(faceValue), quantity: number.format(quantity), frequency: number.format(m), yield: percent.format(y), coupon: percent.format(c), years: number.format(T), macaulay: number.format(model.macaulay), modified: number.format(model.modified), dv01: riskMoney.format(model.dv01), shock: `${number.format(shock)} ${bpUnit}`, exact: money.format(model.exactShockPrice), tangent: money.format(model.linearShockPrice) };
  const points = Array.from({ length: 41 }, (_, i) => { const bp = -200 + i * 10; const r = calculateYieldDuration({ ...authored, couponRate: c, years: T, frequency: m, annualYield: y, shockBp: bp }); return { bp, exact: r.exactShockPrice, tangent: r.linearShockPrice }; });
  const W = 640, H = 300, left = 46, right = 594, top = 20, bottom = 240;
  const values = points.flatMap(p => [p.exact, p.tangent]); const lo = Math.min(...values), hi = Math.max(...values); const margin = Math.max(1, (hi - lo) * .08);
  const x = (bp: number) => left + (bp + 200) / 400 * (right - left), priceY = (v: number) => bottom - (v - lo + margin) / (hi - lo + 2 * margin) * (bottom - top);
  const curve = (key: 'exact' | 'tangent') => points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.bp)} ${priceY(p[key])}`).join(' ');
  const timeX = (t: number) => left + t / T * (right - left); const maxWeight = Math.max(...model.rows.map(r => r.weight));
  const curveRows = [...new Set([-200, -100, -25, 0, 25, 100, 200, shock])].sort((a, b) => a - b).map(bp => ({ bp, result: calculateYieldDuration({ ...authored, couponRate: c, years: T, frequency: m, annualYield: y, shockBp: bp }) }));
  const tableClass = 'block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-xs leading-relaxed text-ink-600">{substitute(assumptionsMessage, variables)}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{[{ label: couponLabel, key: 'coupon', value: c, min: 0, max: .15, step: .005, set: setC, output: percent.format(c) }, { label: yearsLabel, key: 'years', value: T, min: 1, max: 50, step: 1, set: setT, output: number.format(T) }, { label: yieldLabel, key: 'yield', value: y, min: -.02, max: .2, step: .005, set: setY, output: percent.format(y) }, { label: shockLabel, key: 'shock', value: shock, min: -200, max: 200, step: 1, set: setShock, output: `${number.format(shock)} ${bpUnit}` }].map(control => <label key={control.key} htmlFor={`${id}-${control.key}`} className="min-w-0 text-sm font-medium">{control.label}: <output className="font-mono">{control.output}</output><input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={e => control.set(Number(e.target.value))} className="mt-3 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>)}<div className="sm:col-span-2"><label htmlFor={`${id}-frequency`} className="text-sm font-medium">{frequencyLabel}</label><select id={`${id}-frequency`} value={m} onChange={e => setM(Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{[[1, annualLabel], [2, semiannualLabel], [4, quarterlyLabel]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    <h3 className="mt-6 font-semibold" style={{marginBottom:0}}>{balanceTitle}</h3><svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={substitute(balanceChartLabel, variables)}><line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--color-ink-400)"/>{model.rows.map(row => { const width = Math.min(18, (right - left) / model.rows.length * .65), height = row.weight / maxWeight * 195; return <rect key={row.period} x={timeX(row.time) - width / 2} y={bottom - height} width={width} height={height} fill="var(--color-brand-600)"/>; })}<path d={`M ${timeX(model.macaulay)} ${bottom} l -9 16 h 18 Z`} fill="var(--color-accent-600)"/><line x1={timeX(model.macaulay)} x2={timeX(model.macaulay)} y1={top} y2={bottom} stroke="var(--color-accent-600)" strokeDasharray="6 5"/>{[0, T].map(t => <text key={t} x={timeX(t)} y={285} textAnchor="middle" fill="var(--color-ink-700)" className="text-[28px] sm:text-[15px]">{number.format(t)}</text>)}</svg><p className="text-center text-xs text-ink-600">{timeAxisLabel}</p>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[priceLabel, money.format(model.price)], [macaulayLabel, `${number.format(model.macaulay)} ${yearsUnit}`], [modifiedLabel, number.format(model.modified)], [dv01Label, riskMoney.format(model.dv01)], [signedBpLabel, riskMoney.format(-model.dv01)], [positionLabel, riskMoney.format(model.positionDV01)], [exactPnlLabel, money.format(model.exactPnl)], [tangentPnlLabel, money.format(model.linearPnl)]].map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
    <h3 className="mt-6 font-semibold" style={{marginBottom:0}}>{curveTitle}</h3><div className="mt-3 flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-2"><span className="h-1 w-6 bg-brand-600" aria-hidden="true"/>{exactLabel}</span><span className="inline-flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-accent-600" aria-hidden="true"/>{tangentLabel}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={substitute(curveChartLabel, variables)}><path d={curve('exact')} fill="none" stroke="var(--color-brand-600)" strokeWidth={4}/><path d={curve('tangent')} fill="none" stroke="var(--color-accent-600)" strokeWidth={3} strokeDasharray="8 6"/><line x1={x(0)} x2={x(0)} y1={top} y2={bottom} stroke="var(--color-ink-300)"/><circle cx={x(shock)} cy={priceY(model.exactShockPrice)} r={6} fill="var(--color-brand-600)"/><rect x={x(shock)-5} y={priceY(model.linearShockPrice)-5} width={10} height={10} fill="var(--color-accent-600)"/>{[-200, 0, 200].map(bp => <text key={bp} x={x(bp)} y={285} textAnchor="middle" fill="var(--color-ink-700)" className="text-[28px] sm:text-[15px]">{number.format(bp)}</text>)}</svg><p className="text-center text-xs text-ink-600">{shockAxisLabel}</p>
    <details className="mt-5"><summary className="cursor-pointer font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{flowDetailsLabel}</summary><div className="mt-3"><table tabIndex={0} aria-label={flowTableLabel} className={tableClass}><caption className="sr-only">{flowTableLabel}</caption><thead><tr>{[periodLabel, timeLabel, cashFlowLabel, pvLabel, weightLabel, weightedTimeLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{model.rows.map(row => <tr key={row.period} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{row.period}</th><td className="p-2 font-mono">{number.format(row.time)}</td><td className="p-2 font-mono">{money.format(row.cashFlow)}</td><td className="p-2 font-mono">{riskMoney.format(row.presentValue)}</td><td className="p-2 font-mono">{percent.format(row.weight)}</td><td className="p-2 font-mono">{number.format(row.weightedTime)}</td></tr>)}</tbody></table></div></details>
    <details className="mt-4"><summary className="cursor-pointer font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{riskDetailsLabel}</summary><div className="mt-3"><table tabIndex={0} aria-label={riskTableLabel} className={tableClass}><caption className="sr-only">{riskTableLabel}</caption><thead><tr>{[`${shockLabel} (${bpUnit})`, exactLabel, tangentLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{curveRows.map(row => <tr key={row.bp} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{row.bp}</th><td className="p-2 font-mono">{money.format(row.result.exactShockPrice)}</td><td className="p-2 font-mono">{money.format(row.result.linearShockPrice)}</td></tr>)}</tbody></table></div></details>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default YieldDurationWorkbench;
