import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A dated cash payment from one explicitly stated viewpoint. */
export interface TimelineCashFlow {
  /** Human-readable payment label retained in the table. */
  label: string;
  /** Integer period measured from the timeline origin. */
  time: number;
  /** Signed amount: receipt positive, payment negative. */
  amount: number;
}

/** Convert a dated amount to another date at one effective rate per period. */
export function valueDatedCashFlow(amount: number, time: number, date: number, rate: number): number {
  if (![amount, time, date, rate].every(Number.isFinite) || rate <= -1) {
    throw new Error('CashFlowValuationTimeline: finite cash-flow inputs and a rate above -100% are required.');
  }
  const result = amount * Math.pow(1 + rate, date - time);
  if (!Number.isFinite(result)) throw new Error('CashFlowValuationTimeline: converted value must be finite.');
  return result;
}

/** Value a stream after converting every payment to the same date. */
export function valueCashFlowStream(flows: TimelineCashFlow[], date: number, rate: number): number {
  return flows.reduce((sum, flow) => sum + valueDatedCashFlow(flow.amount, flow.time, date, rate), 0);
}

export interface CashFlowValuationTimelineProps {
  /** One to eight dated signed payments. */
  flows: TimelineCashFlow[];
  /** Last timeline period, 1–24; may be after the last payment. */
  maxDate: number;
  /** Initial effective rate per period, zero to 20%. */
  rate?: number;
  /** Initial integer common valuation date. */
  valuationDate?: number;
  /** Enable viewpoint reversal while preserving dates. */
  allowReverse?: boolean;
  /** Heading identifying the example. */
  title?: string;
  /** Label of the effective per-period rate control. */
  rateLabel?: string;
  /** Label of the common-date control. */
  valuationDateLabel?: string;
  /** Button label for the authored cash-flow signs. */
  originalViewLabel?: string;
  /** Button label for the opposite viewpoint. */
  reverseViewLabel?: string;
  /** Payment-name table column heading. */
  flowLabel?: string;
  /** Payment-date table column heading. */
  dateLabel?: string;
  /** Original signed-amount column heading. */
  amountLabel?: string;
  /** Per-flow conversion-factor column heading. */
  factorLabel?: string;
  /** Converted-amount column heading. */
  convertedLabel?: string;
  /** Label of the live common-date sum. */
  totalLabel?: string;
  /** Accessible description with {date}, {rate}, {total} placeholders. */
  chartLabel?: string;
  /** Table caption explaining the conversion step. */
  tableLabel?: string;
  /** ISO currency used to format amounts. */
  currency?: string;
  /** Locale used to format all amounts and periods. */
  locale?: string;
  /** Additional wrapper classes. */
  className?: string;
}

/** Interactive dated-flow diagram with a complete numeric fallback.
 * Controls change the common date or assumed rate; signed payments stay fixed.
 * Bars net same-date payments, while the table retains every payment.
 * Only the user-controlled common-date marker transitions; reduced motion disables it.
 * Essential results are available without movement or hydration.
 */
export function CashFlowValuationTimeline({
  flows, maxDate, rate = 0.1, valuationDate = 0, allowReverse = false,
  title = 'Bring dated payments to a common date',
  rateLabel = 'Assumed effective rate per period',
  valuationDateLabel = 'Common valuation date',
  originalViewLabel = 'Original viewpoint',
  reverseViewLabel = 'Opposite viewpoint',
  flowLabel = 'Payment', dateLabel = 'Date', amountLabel = 'Signed amount',
  factorLabel = 'Conversion factor', convertedLabel = 'Value at the common date',
  totalLabel = 'Sum at the common date',
  chartLabel = 'Dated signed flows valued at date {date}, using {rate}% per period. The sum is {total}. Bars show net signed payments by date.',
  tableLabel = 'Convert each dated payment before adding the values.',
  currency = 'USD', locale = 'en-US', className,
}: CashFlowValuationTimelineProps) {
  if (!Array.isArray(flows) || flows.length < 1 || flows.length > 8) {
    throw new Error('CashFlowValuationTimeline: flows must contain one to eight payments.');
  }
  if (!Number.isInteger(maxDate) || maxDate < 1 || maxDate > 24 ||
      !Number.isInteger(valuationDate) || valuationDate < 0 || valuationDate > maxDate) {
    throw new Error('CashFlowValuationTimeline: dates must be integers within a timeline of 1–24 periods.');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.2) {
    throw new Error('CashFlowValuationTimeline: initial rate must be between zero and 20%.');
  }
  if (flows.some((flow) => !flow || typeof flow.label !== 'string' || !flow.label.trim() ||
      !Number.isFinite(flow.amount) || Math.abs(flow.amount) > 1e12 ||
      !Number.isInteger(flow.time) || flow.time < 0 || flow.time > maxDate)) {
    throw new Error('CashFlowValuationTimeline: every flow needs a label, finite signed amount and date within the timeline.');
  }

  const id = useId();
  const [currentRate, setCurrentRate] = useState(rate);
  const [currentDate, setCurrentDate] = useState(valuationDate);
  const [reverse, setReverse] = useState(false);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const compactMoney = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  const signedFlows = flows.map((flow) => ({ ...flow, amount: flow.amount * (reverse ? -1 : 1) }));
  const rows = signedFlows.map((flow) => ({
    ...flow,
    factor: Math.pow(1 + currentRate, currentDate - flow.time),
    value: valueDatedCashFlow(flow.amount, flow.time, currentDate, currentRate),
  }));
  const calculatedTotal = valueCashFlowStream(signedFlows, currentDate, currentRate);
  const total = Math.abs(calculatedTotal) < 1e-9 ? 0 : calculatedTotal;
  const byDate = new Map<number, number>();
  for (const flow of signedFlows) byDate.set(flow.time, (byDate.get(flow.time) ?? 0) + flow.amount);
  const payments = [...byDate.entries()].sort((a, b) => a[0] - b[0]);
  const largest = Math.max(1, ...payments.map(([, amount]) => Math.abs(amount)));
  const ticks = [...new Set([0, maxDate, currentDate, ...payments.map(([time]) => time)])].sort((a, b) => a - b);
  const x = (time: number) => 45 + time / maxDate * 550;
  const description = chartLabel.replaceAll('{date}', number.format(currentDate))
    .replaceAll('{rate}', number.format(currentRate * 100)).replaceAll('{total}', money.format(total));

  return (
    <section className={cx('my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label htmlFor={id + '-rate'} className="text-sm font-medium text-ink-700">
          {rateLabel}: {number.format(currentRate * 100)}%
          <input id={id + '-rate'} type="range" min="0" max="20" step="1"
            value={currentRate * 100} onChange={(event) => setCurrentRate(Number(event.target.value) / 100)}
            className="mt-2 block w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        </label>
        <label htmlFor={id + '-date'} className="text-sm font-medium text-ink-700">
          {valuationDateLabel}: {number.format(currentDate)}
          <input id={id + '-date'} type="range" min="0" max={maxDate} step="1"
            value={currentDate} onChange={(event) => setCurrentDate(Number(event.target.value))}
            className="mt-2 block w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        </label>
      </div>
      {allowReverse && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[false, true].map((opposite) => (
            <button type="button" key={String(opposite)} aria-pressed={reverse === opposite}
              onClick={() => setReverse(opposite)}
              className={cx('rounded-pill px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                reverse === opposite ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-800')}>
              {opposite ? reverseViewLabel : originalViewLabel}
            </button>
          ))}
        </div>
      )}
      <svg viewBox="0 0 640 270" role="img" aria-label={description} className="mt-4 w-full">
        <line x1="35" y1="126" x2="605" y2="126" stroke="var(--color-ink-300)" />
        <g style={{ transform: 'translateX(' + x(currentDate) + 'px)' }}
          className="transition-transform duration-300 motion-reduce:transition-none">
          <line x1="0" y1="20" x2="0" y2="230"
            stroke="var(--color-accent-600)" strokeDasharray="5 4" />
        </g>
        {payments.map(([time, amount]) => {
          const height = Math.abs(amount) / largest * 70;
          return (
            <g key={time}>
              <rect x={x(time) - 12} y={amount >= 0 ? 126 - height : 126} width="24" height={Math.max(1, height)}
                rx="3" fill={amount >= 0 ? 'var(--color-brand-600)' : 'var(--color-ink-600)'} />
              <text x={x(time)} y={amount >= 0 ? 126 - height - 8 : 126 + height + 17}
                textAnchor="middle" fontSize="12" fill="var(--color-ink-800)">{compactMoney.format(amount)}</text>
            </g>
          );
        })}
        {ticks.map((time) => <text key={time} x={x(time)} y="254" textAnchor="middle"
          fontSize="12" fill="var(--color-ink-700)">{number.format(time)}</text>)}
      </svg>
      <div className="overflow-x-auto">
        <table tabIndex={0} className="w-full text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <caption className="mb-3 text-left text-ink-600">{tableLabel}</caption>
          <thead className="text-ink-700"><tr>
            {[flowLabel, dateLabel, amountLabel, factorLabel, convertedLabel].map((label) => <th key={label} scope="col" className="px-2 py-2 font-semibold">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="even:bg-brand-50">
            <th scope="row" className="px-2 py-2 font-medium text-ink-800">{row.label}</th>
            <td className="px-2 py-2">{number.format(row.time)}</td>
            <td className="px-2 py-2 font-mono">{money.format(row.amount)}</td>
            <td className="px-2 py-2 font-mono">{number.format(row.factor)}</td>
            <td className="px-2 py-2 font-mono">{money.format(row.value)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-4 text-ink-900" aria-live="polite" aria-atomic="true">
        <span className="font-medium">{totalLabel}: </span><strong className="font-mono">{money.format(total)}</strong>
      </p>
    </section>
  );
}

export default CashFlowValuationTimeline;
