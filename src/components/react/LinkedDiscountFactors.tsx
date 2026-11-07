import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

const compensatedSum = (values: number[]) => {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
};

export function calculateLinkedFactors(rates: number[]) {
  if (!Array.isArray(rates) || rates.length < 1 || rates.length > 12 || rates.some(r => !Number.isFinite(r) || r < -.95 || r > 1)) {
    throw new Error('LinkedDiscountFactors: supply one to twelve finite effective period rates from -95% to 100%; all growth factors must be positive.');
  }
  const accumulation = [1];
  for (const rate of rates) accumulation.push(accumulation.at(-1)! * (1 + rate));
  const logTotal = compensatedSum(rates.map(r => Math.log1p(r)));
  return { accumulation, discount: accumulation.map(a => 1 / a), totalReturn: Math.expm1(logTotal), equivalentRate: Math.expm1(logTotal / rates.length), arithmeticRate: compensatedSum(rates) / rates.length };
}
export function valueLinkedSchedule(rates: number[], amounts: number[], date: number) {
  const chain = calculateLinkedFactors(rates);
  if (!Array.isArray(amounts) || amounts.length !== rates.length + 1 || amounts.some(c => !Number.isFinite(c) || Math.abs(c) > 1e6) || !Number.isInteger(date) || date < 0 || date > rates.length) {
    throw new Error('LinkedDiscountFactors: provide one finite signed amount per date including zero, each at most one million in absolute value, and a common date within the chain.');
  }
  const rows = amounts.map((amount, time) => {
    const factor = chain.accumulation[date] / chain.accumulation[time], value = amount * factor;
    if (amount !== 0 && value === 0) throw new Error('LinkedDiscountFactors: this nonzero payment underflows the supported numerical conversion scale.');
    return { time, amount, factor, value };
  });
  return { ...chain, rows, total: compensatedSum(rows.map(row => row.value)) };
}
/** One external transfer occurs immediately after first-period growth. */
export function calculateLinkedFlowPath(rates: number[], initial: number, firstDateFlow: number) {
  const chain = calculateLinkedFactors(rates);
  if (!Number.isFinite(initial) || initial <= 0 || initial > 1e6 || !Number.isFinite(firstDateFlow) || Math.abs(firstDateFlow) > 1e6) throw new Error('LinkedDiscountFactors: initial balance must be positive and at most one million; the first-date transfer must be finite and at most one million in absolute value.');
  let balance = initial;
  const balances = [initial], beforeTransfers = [initial];
  for (let i = 0; i < rates.length; i++) {
    const before = balance * (1 + rates[i]);
    if (balance !== 0 && before === 0) throw new Error('LinkedDiscountFactors: this balance underflows the supported numerical growth scale.');
    balance = before + (i === 0 ? firstDateFlow : 0);
    beforeTransfers.push(before); balances.push(balance);
  }
  const principalTerminal = initial * chain.accumulation.at(-1)!, flowTerminal = firstDateFlow * (chain.accumulation.at(-1)! / chain.accumulation[1]);
  if (principalTerminal === 0 || firstDateFlow !== 0 && flowTerminal === 0) throw new Error('LinkedDiscountFactors: a nonzero cash component underflows the supported numerical growth scale.');
  return { balances, beforeTransfers, funded: balances.every(b => b >= 0), principalTerminal, flowTerminal, terminal: balances.at(-1)! };
}
const defaultLabels = {
  model: 'Invented three-year scenario: one complete year per interval, effective rates, one currency and no fees or taxes. Rates are assumptions, not locked offers or forecasts. All transfer dates refer to the same account viewpoint.',
  periodRate: 'Assumed effective rate for interval', interval: 'from date {start} to date {end}', commonDate: 'Common valuation date in years', transfer: 'Transfer immediately after first-year growth, as a fraction of initial 100',
  year: 'Date in years', rate: 'Effective rate for the preceding interval', factor: 'Cumulative growth factor from zero', discount: 'Date-zero discount factor', amount: 'Original signed payment', conversion: 'Factor to the selected common date', converted: 'Value at the common date', balance: 'Balance from initial 100', originalBalance: 'Balance, original order', reverseBalance: 'Balance, reversed order', equivalentBalance: 'Balance, equivalent constant rate', original: 'Rates in the stated order', reversed: 'Same rates in reverse order', constant: 'Equivalent constant annual rate',
  total: 'Signed sum at the selected common date', final: 'Final balance with stated order', reverseFinal: 'Final balance with reverse order', difference: 'Stated-order minus reversed-order final balance', equivalent: 'Equivalent constant annual rate for this three-year endpoint', arithmetic: 'Arithmetic average of the three annual rates', totalReturn: 'Three-year no-flow total return', principal: 'Initial 100 carried to year three', flowTerminal: 'Dated transfer carried to year three', notPeriod: 'No preceding interval',
  chainAxis: 'Vertical axis: money units from an initial 100 with no transfers. Horizontal axis: dates zero through three, one year apart. Lines connect model values at those dates, not a forecast price path.',
  discountAxis: 'Vertical axis: date-zero discount factor for one unit paid at that date. Horizontal axis: years from zero through three.',
  valueAxis: 'Vertical axis: signed money value of each payment at the selected common date. Horizontal labels retain the original payment dates. The table gives every conversion.',
  flowAxis: 'Vertical axis: account balance at each date, after any transfer due on that date. Horizontal axis: years zero through three. The two paths use the same initial 100 and the same dated transfer.',
  graph: 'Calculated dated factors or cash values. Complete figures and conventions are in the focusable table.', table: 'Complete dated variable-rate calculation; focus and use arrow keys to scroll horizontally', undefined: 'Outside this account model: the withdrawal requires funding',
  caption: 'Move one interval rate at a time and follow which later factors change. Every converted amount uses the interval between its own date and the chosen common date.', cashUnits: 'All money figures use the same invented currency units. A negative transfer is a withdrawal; a positive transfer is a contribution. No intermediate transfer is part of the investment return.',
};
export type LinkedDiscountLabels = typeof defaultLabels;
export interface LinkedDiscountFactorsProps {
  view?: 'chain' | 'discount' | 'valuation' | 'equivalent' | 'flows';
  rates?: [number, number, number];
  amounts?: [number, number, number, number];
  valuationDate?: number;
  flowFraction?: number;
  title?: string;
  caption?: string;
  locale?: string;
  labels?: LinkedDiscountLabels;
  className?: string;
}
const onGrid = (n: number, min: number, max: number, step: number, name: string) => {
  if (!Number.isFinite(n) || n < min || n > max || Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-8) throw new Error(`LinkedDiscountFactors: ${name} must match the native control range and step.`);
};
export function LinkedDiscountFactors({ view = 'chain', rates = [.05, -.1, .2], amounts = [-200, 21, 94.5, 113.4], valuationDate = 0, flowFraction = .5, title = 'Link the dated factors before adding cash', caption, locale = 'en-US', labels = defaultLabels, className }: LinkedDiscountFactorsProps) {
  if (!['chain', 'discount', 'valuation', 'equivalent', 'flows'].includes(view) || !Array.isArray(rates) || rates.length !== 3) throw new Error('LinkedDiscountFactors: choose a supported view and exactly three initial annual interval rates.');
  rates.forEach(r => onGrid(r, -.5, .5, .01, 'annual interval rate'));
  onGrid(valuationDate, 0, 3, 1, 'common date'); onGrid(flowFraction, -.5, 1, .05, 'first-date transfer fraction');
  if (!Array.isArray(amounts) || amounts.length !== 4 || amounts.some(c => !Number.isFinite(c) || Math.abs(c) > 1000)) throw new Error('LinkedDiscountFactors: the viewer requires four signed dated amounts, each at most 1000 in absolute value.');
  for (const key of Object.keys(defaultLabels) as (keyof LinkedDiscountLabels)[]) if (typeof labels[key] !== 'string' || !labels[key].trim()) throw new Error(`LinkedDiscountFactors: provide a nonempty localized ${key} label.`);
  const id = useId(), l = labels;
  const [chosen, setChosen] = useState<number[]>(rates), [date, setDate] = useState(valuationDate), [transfer, setTransfer] = useState(flowFraction);
  const chain = calculateLinkedFactors(chosen), valuation = valueLinkedSchedule(chosen, amounts, date), forward = calculateLinkedFlowPath(chosen, 100, transfer * 100), reverse = calculateLinkedFlowPath([...chosen].reverse(), 100, transfer * 100);
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Math.abs(n) < .0000005 ? 0 : n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Math.abs(n) < .000000005 ? 0 : n);
  const tick = (n: number) => new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 4 }).format(n);
  const curves = view === 'flows' ? [{ label: l.original, values: forward.balances }, { label: l.reversed, values: reverse.balances }] : view === 'discount' ? [{ label: l.discount, values: chain.discount }] : [{ label: l.original, values: chain.accumulation.map(a => 100 * a) }, ...(view === 'equivalent' ? [{ label: l.constant, values: [0, 1, 2, 3].map(t => 100 * Math.exp(Math.log1p(chain.equivalentRate) * t)) }] : [])];
  const plotted = view === 'valuation' ? valuation.rows.map(row => row.value) : curves.flatMap(c => c.values), extent = Math.max(...plotted.map(Math.abs), 1), low = view === 'valuation' ? -extent : 0;
  const W = 640, H = 320, left = 168, right = 586, top = 44, bottom = 258;
  const coord = (n: number) => Number(n.toFixed(3)), x = (t: number) => coord(left + t / 3 * (right - left)), y = (v: number) => coord(bottom - (v - low) / (extent - low) * (bottom - top));
  const colors = ['var(--color-brand-600)', 'var(--color-accent-600)'];
  const headings = view === 'valuation' ? [l.year, l.amount, l.conversion, l.converted] : view === 'flows' ? [l.year, l.originalBalance, l.reverseBalance] : view === 'equivalent' ? [l.year, l.originalBalance, l.equivalentBalance, l.factor, l.discount] : [l.year, l.rate, l.factor, l.discount, l.balance];
  const rows = view === 'valuation' ? valuation.rows.map(row => [number(row.time), number(row.amount), number(row.factor), number(row.value)]) : view === 'flows' ? forward.balances.map((b, t) => [number(t), number(b), number(reverse.balances[t])]) : view === 'equivalent' ? chain.accumulation.map((a, t) => [number(t), number(100 * a), number(curves[1].values[t]), number(a), number(chain.discount[t])]) : chain.accumulation.map((a, t) => [number(t), t ? percent(chosen[t - 1]) : l.notPeriod, number(a), number(chain.discount[t]), number(100 * a)]);
  return <figure data-linked-view={view} className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.model}</p>
    <div className="mt-4 grid gap-4">{chosen.map((r, i) => <label key={i} htmlFor={`${id}-${i}`} className="block min-w-0 text-sm text-ink-800"><span className="flex flex-wrap justify-between gap-2"><span>{l.periodRate} {l.interval.replace('{start}', number(i)).replace('{end}', number(i + 1))}</span><output htmlFor={`${id}-${i}`} className="font-mono">{percent(r)}</output></span><input id={`${id}-${i}`} aria-label={`${l.periodRate} ${l.interval.replace('{start}', number(i)).replace('{end}', number(i + 1))}`} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" type="range" min={-.5} max={.5} step={.01} value={r} onChange={e => { const value = Number(e.currentTarget.value); setChosen(previous => previous.map((old, j) => i === j ? value : old)); }} /></label>)}</div>
    {view === 'valuation' && <label className="mt-4 block text-sm text-ink-800" htmlFor={`${id}-date`}><span className="flex flex-wrap justify-between gap-2">{l.commonDate}<output htmlFor={`${id}-date`} className="font-mono">{number(date)}</output></span><input id={`${id}-date`} aria-label={l.commonDate} type="range" min={0} max={3} step={1} value={date} onChange={e => setDate(Number(e.currentTarget.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>}
    {view === 'flows' && <label className="mt-4 block text-sm text-ink-800" htmlFor={`${id}-flow`}><span className="flex flex-wrap justify-between gap-2">{l.transfer}<output htmlFor={`${id}-flow`} className="font-mono">{percent(transfer)}</output></span><input id={`${id}-flow`} aria-label={l.transfer} type="range" min={-.5} max={1} step={.05} value={transfer} onChange={e => setTransfer(Number(e.currentTarget.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>}
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-3 text-sm text-ink-900">{(view === 'valuation' ? [[l.total, number(valuation.total)]] : view === 'flows' ? [[l.final, forward.funded ? number(forward.terminal) : l.undefined], [l.reverseFinal, reverse.funded ? number(reverse.terminal) : l.undefined], [l.difference, number(forward.terminal - reverse.terminal)], [l.principal, number(forward.principalTerminal)], [l.flowTerminal, number(forward.flowTerminal)]] : [[l.totalReturn, percent(chain.totalReturn)], [l.equivalent, percent(chain.equivalentRate)], [l.arithmetic, percent(chain.arithmeticRate)]]).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="m-0 font-mono">{value}</dd></div>)}</dl>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{view === 'discount' ? l.discountAxis : view === 'valuation' ? l.valueAxis : view === 'flows' ? l.flowAxis : l.chainAxis}</p>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" role="img" aria-label={`${title}. ${l.graph}`}>
      {(view === 'valuation' ? [-extent, 0, extent] : [0, extent / 2, extent]).map(v => <g key={v}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--color-ink-200)" /><text x={left - 12} y={y(v) + 9} textAnchor="end" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{tick(v)}</text></g>)}
      {[0, 1, 2, 3].map(t => <text key={t} x={x(t)} y={306} textAnchor="middle" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{number(t)}</text>)}
      {view === 'valuation' ? valuation.rows.map(row => <rect key={row.time} x={x(row.time) - 19} y={Math.min(y(row.value), y(0))} width={38} height={coord(Math.abs(y(row.value) - y(0)))} fill={row.value < 0 ? colors[1] : colors[0]} />) : curves.map((curve, i) => <g key={curve.label}><path d={curve.values.map((value, t) => `${t ? 'L' : 'M'} ${x(t)} ${y(value)}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth={5} strokeDasharray={i ? '12 8' : undefined} />{curve.values.map((v, t) => <circle key={t} cx={x(t)} cy={y(v)} r={6} fill={colors[i]} />)}</g>)}
    </svg>
    {view !== 'valuation' && <div className="mt-2 grid gap-2 text-sm text-ink-700">{curves.map((curve, i) => <p key={curve.label} className="flex items-start gap-2"><span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: colors[i] }} />{curve.label}</p>)}</div>}
    {view === 'flows' && <p className="mt-4 text-sm leading-relaxed text-ink-700">{l.cashUnits}</p>}
    <div className="mt-3"><table tabIndex={0} aria-label={l.table} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{headings.map(h => <th key={h} scope="col" className="border-b border-ink-300 p-3 text-left font-semibold text-ink-900">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, j) => j === 0 ? <th key={j} scope="row" className="border-b border-ink-100 p-3 text-left font-mono">{v}</th> : <td key={j} className={cx('border-b border-ink-100 p-3', v === l.notPeriod ? '' : 'whitespace-nowrap font-mono')}>{v}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{caption ?? l.caption}</p>
  </figure>;
}
