import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DietzCashFlow { label: string; time: number; amount: number }
export interface ModifiedDietzInputs {
  beginningValue: number;
  endingValue: number;
  /** Integer elapsed-time endpoint. A flow at zero has weight 1; at this endpoint weight 0. */
  duration: number;
  /** Portfolio viewpoint: contribution positive, withdrawal negative. */
  flows: DietzCashFlow[];
}

/** Day-weighted capital approximation; not an exact TWR or an IRR solver. */
export function calculateModifiedDietz({ beginningValue, endingValue, duration, flows }: ModifiedDietzInputs) {
  if (!Number.isFinite(beginningValue) || beginningValue <= 0 || beginningValue > 1e12 ||
      !Number.isFinite(endingValue) || endingValue < 0 || endingValue > 1e12 ||
      !Number.isInteger(duration) || duration < 1 || duration > 3660 ||
      !Array.isArray(flows) || flows.length > 6 || flows.some((flow) => !flow ||
        typeof flow.label !== 'string' || !flow.label.trim() || !Number.isInteger(flow.time) ||
        flow.time < 0 || flow.time > duration || !Number.isFinite(flow.amount) || Math.abs(flow.amount) > 1e12)) {
    throw new Error('ModifiedDietzTimeline: finite nonnegative values (positive beginning), up to six labeled finite flows and integer dates within a 1–3660 period duration are required.');
  }
  const rows = flows.map((flow) => ({ ...flow, weight: (duration - flow.time) / duration, weightedAmount: flow.amount * (duration - flow.time) / duration }));
  const netFlow = flows.reduce((sum, flow) => sum + flow.amount, 0);
  const gain = endingValue - beginningValue - netFlow;
  const capital = beginningValue + rows.reduce((sum, flow) => sum + flow.weightedAmount, 0);
  const rate = capital > 0 ? gain / capital : null;
  if (![gain, capital, netFlow].every(Number.isFinite) || (rate !== null && !Number.isFinite(rate))) {
    throw new Error('ModifiedDietzTimeline: derived values must be finite; inspect the numerical scale and weighted capital.');
  }
  return { rows, netFlow, gain, capital, rate, status: capital > 0 ? 'positive' : capital === 0 ? 'zero' : 'negative' } as const;
}

export interface ModifiedDietzTimelineProps extends Partial<ModifiedDietzInputs> {
  title?: string;
  dateControlLabel?: string;
  dayLabel?: string;
  beginningLabel?: string;
  endingLabel?: string;
  netFlowLabel?: string;
  gainLabel?: string;
  capitalLabel?: string;
  returnLabel?: string;
  zeroCapitalLabel?: string;
  negativeCapitalLabel?: string;
  flowLabel?: string;
  dateLabel?: string;
  amountLabel?: string;
  weightLabel?: string;
  weightedAmountLabel?: string;
  tableLabel?: string;
  /** Diagram name with {duration}, {gain}, {capital} tokens. */
  chartLabel?: string;
  scopeLabel?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

/** Move external-flow dates while keeping bookend values and net gain fixed.
 * The highlighted remaining-time segment shows the weight in the denominator.
 * Each signed amount, date, weight and capital contribution has a numeric fallback.
 * No price path, default probability, exact TWR or IRR is inferred.
 */
export function ModifiedDietzTimeline({
  beginningValue = 100, endingValue = 130, duration = 30,
  flows = [{ label: 'Contribution', time: 6, amount: 40 }, { label: 'Withdrawal', time: 24, amount: -20 }],
  title = 'Weight each external flow by its remaining time', dateControlLabel = 'Elapsed time of', dayLabel = 'day',
  beginningLabel = 'Beginning value', endingLabel = 'Ending value', netFlowLabel = 'Net external flow',
  gainLabel = 'Gain excluding external flows', capitalLabel = 'Beginning value plus weighted flows',
  returnLabel = 'Modified Dietz return for this period',
  zeroCapitalLabel = 'No finite conventional Dietz rate: weighted capital is zero.',
  negativeCapitalLabel = 'Conventional Dietz rate withheld: weighted capital is negative; inspect timing and valuation boundaries.',
  flowLabel = 'External flow', dateLabel = 'Elapsed date', amountLabel = 'Signed amount',
  weightLabel = 'Remaining-time weight', weightedAmountLabel = 'Signed weighted amount',
  tableLabel = 'Dated external flows and their weighted capital contributions',
  chartLabel = 'Flows within {duration} days. Remaining-time segments determine weights, not investment growth. Gain {gain}; weighted capital {capital}.',
  scopeLabel = 'Move dates only: bookend values and flow amounts remain fixed. End-of-day elapsed-time weights are used. This is a weighted-capital approximation, not an inferred market path or an exact cash-flow-neutral return.',
  currency = 'USD', locale = 'en-US', className,
}: ModifiedDietzTimelineProps) {
  calculateModifiedDietz({ beginningValue, endingValue, duration, flows });
  const id = useId();
  const [dates, setDates] = useState(flows.map((flow) => flow.time));
  const result = calculateModifiedDietz({ beginningValue, endingValue, duration, flows: flows.map((flow, index) => ({ ...flow, time: dates[index] })) });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const label = chartLabel.replaceAll('{duration}', number.format(duration)).replaceAll('{gain}', money.format(result.gain)).replaceAll('{capital}', money.format(result.capital));
  return (
    <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-600">{scopeLabel}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{result.rows.map((flow, index) =>
        <label key={index} htmlFor={id + '-date-' + index} className="text-sm font-medium text-ink-800">
          {dateControlLabel} {flow.label}: {dayLabel} {number.format(flow.time)} · {money.format(flow.amount)}
          <input id={id + '-date-' + index} type="range" min="0" max={duration} step="1" value={flow.time}
            onChange={(event) => setDates(dates.map((date, row) => row === index ? Number(event.target.value) : date))}
            className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        </label>)}</div>
      <div role="img" aria-label={label} className="mt-5 space-y-4">
        {result.rows.map((flow, index) => <div key={index}>
          <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm text-ink-800"><span>{flow.label} · {money.format(flow.amount)}</span><span>{weightLabel}: {number.format(flow.weight)}</span></div>
          <div className="relative h-5 rounded-pill bg-surface-sunken" aria-hidden="true">
            <div style={{ marginLeft: (1 - flow.weight) * 100 + '%', width: flow.weight * 100 + '%' }}
              className={cx('h-full rounded-pill', flow.amount >= 0 ? 'bg-brand-600' : 'bg-accent-600')} />
            <span style={{ left: (1 - flow.weight) * 100 + '%' }} className="absolute top-0 h-full w-0.5 bg-ink-900" />
          </div>
        </div>)}
        <div className="flex justify-between text-xs text-ink-600"><span>0</span><span>{dayLabel} {number.format(duration)}</span></div>
      </div>
      <dl aria-live="polite" aria-atomic="true" className="mt-5 grid gap-3 rounded-card bg-surface-sunken p-4 text-sm text-ink-800 sm:grid-cols-2">
        {[[beginningLabel, beginningValue], [endingLabel, endingValue], [netFlowLabel, result.netFlow], [gainLabel, result.gain], [capitalLabel, result.capital]].map(([name, value], index) => <div key={index}><dt>{String(name)}</dt><dd className="font-mono font-semibold">{money.format(Number(value))}</dd></div>)}
        <div><dt>{returnLabel}</dt><dd className="font-mono font-semibold">{result.rate !== null ? percent.format(result.rate) : result.status === 'zero' ? zeroCapitalLabel : negativeCapitalLabel}</dd></div>
      </dl>
      {result.rows.length > 0 && <div className="mt-4">
        <table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <thead><tr>{[flowLabel, dateLabel, amountLabel, weightLabel, weightedAmountLabel].map((heading, column) => <th key={column} scope="col" className="px-3 py-2">{heading}</th>)}</tr></thead>
          <tbody>{result.rows.map((flow, index) => <tr key={index}><th scope="row" className="px-3 py-2 font-medium">{flow.label}</th><td className="px-3 py-2">{number.format(flow.time)}</td><td className="px-3 py-2 font-mono">{money.format(flow.amount)}</td><td className="px-3 py-2 font-mono">{number.format(flow.weight)}</td><td className="px-3 py-2 font-mono">{money.format(flow.weightedAmount)}</td></tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}
