import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A positive annual payment stream, with growth starting after its first payment. */
export interface PerpetuitySeriesInput {
  /** First actual payment, in monetary units (0.01–1e12). */
  payment: number;
  /** Annual discount rate as a fraction (0–0.5). */
  discountRate: number;
  /** Annual growth between payments as a fraction (−0.5–0.5). */
  growthRate: number;
  /** Year of the first payment (1–20); valuation is always at year zero. */
  firstPaymentAt: number;
  /** Number of finite payments included (1–100). */
  payments: number;
}

export interface PerpetuitySeriesResult {
  /** Each displayed payment and its year-zero discounted value. */
  rows: Array<{ year: number; cashFlow: number; presentValue: number; runningValue: number }>;
  /** Sum of the finite displayed stream at year zero. */
  subtotal: number;
  /** Ratio of each discounted payment to the previous one. */
  ratio: number;
  /** Infinite-stream year-zero value, or null when positive terms do not converge. */
  limit: number | null;
  /** Present value of omitted payments, or null without a finite limit. */
  tail: number | null;
}

function validateInput(input: PerpetuitySeriesInput): void {
  if (!Number.isFinite(input.payment) || input.payment < 0.01 || input.payment > 1e12) {
    throw new Error('PerpetuityConvergence: payment must be finite and between 0.01 and 1e12.');
  }
  if (!Number.isFinite(input.discountRate) || input.discountRate < 0 || input.discountRate > 0.5) {
    throw new Error('PerpetuityConvergence: discountRate must be finite and between 0 and 0.5.');
  }
  if (!Number.isFinite(input.growthRate) || input.growthRate < -0.5 || input.growthRate > 0.5) {
    throw new Error('PerpetuityConvergence: growthRate must be finite and between -0.5 and 0.5.');
  }
  if (!Number.isInteger(input.firstPaymentAt) || input.firstPaymentAt < 1 || input.firstPaymentAt > 20) {
    throw new Error('PerpetuityConvergence: firstPaymentAt must be a whole year from 1 to 20.');
  }
  if (!Number.isInteger(input.payments) || input.payments < 1 || input.payments > 100) {
    throw new Error('PerpetuityConvergence: payments must be a whole number from 1 to 100.');
  }
}

/** Sum finite terms directly, including at zero discount and equal growth/discount rates.
 * The infinite-stream formula is used only when the positive discounted terms converge. */
export function calculatePerpetuitySeries(input: PerpetuitySeriesInput): PerpetuitySeriesResult {
  validateInput(input);
  const { payment, discountRate, growthRate, firstPaymentAt, payments } = input;
  const ratio = (1 + growthRate) / (1 + discountRate);
  let cashFlow = payment;
  let runningValue = 0;
  const rows: PerpetuitySeriesResult['rows'] = [];
  for (let i = 0; i < payments; i++) {
    const year = firstPaymentAt + i;
    const presentValue = cashFlow / Math.pow(1 + discountRate, year);
    runningValue += presentValue;
    rows.push({ year, cashFlow, presentValue, runningValue });
    cashFlow *= 1 + growthRate;
  }
  const limit = discountRate > growthRate
    ? payment / (discountRate - growthRate) / Math.pow(1 + discountRate, firstPaymentAt - 1)
    : null;
  if (limit !== null && (!Number.isFinite(limit) || limit > Number.MAX_VALUE / 4)) {
    throw new Error('PerpetuityConvergence: rate difference is outside the supported numerical range.');
  }
  return {
    rows,
    subtotal: runningValue,
    ratio,
    limit,
    tail: limit === null ? null : Math.max(0, limit - runningValue),
  };
}

/** Localized controls and an accessible finite-sum chart for a positive perpetuity model. */
export interface PerpetuityConvergenceProps extends Partial<PerpetuitySeriesInput> {
  /** Figure heading. */
  title?: string;
  /** First actual payment amount label. */
  paymentLabel?: string;
  /** Discount-rate control label. */
  discountRateLabel?: string;
  /** Payment-growth control label. */
  growthRateLabel?: string;
  /** Finite-payment-count control label. */
  paymentsLabel?: string;
  /** First-payment-year control label. */
  firstPaymentAtLabel?: string;
  /** Finite sum readout label. */
  subtotalLabel?: string;
  /** Infinite-stream limit readout and legend label. */
  limitLabel?: string;
  /** Omitted-payment value readout label. */
  tailLabel?: string;
  /** Value shown when the infinite positive stream has no finite limit. */
  noLimitLabel?: string;
  /** Convergence explanation; accepts {ratio}. */
  convergentMessage?: string;
  /** Explanation for equal discount and growth rates. */
  equalRatesMessage?: string;
  /** Explanation for growth above the discount rate. */
  growingTermsMessage?: string;
  /** Chart description accepting {payments}, {firstYear}, {subtotal}, {limit}. */
  chartLabel?: string;
  /** Horizontal axis label. */
  xAxisLabel?: string;
  /** Vertical axis label. */
  yAxisLabel?: string;
  /** Expandable payment-calculation table label. */
  detailsLabel?: string;
  /** Table column labels. */
  yearLabel?: string;
  cashFlowLabel?: string;
  discountedLabel?: string;
  runningLabel?: string;
  /** Assumptions displayed below the controls. */
  caption?: string;
  /** Locale used for amounts, counts and percentages. */
  locale?: string;
  /** Currency prefix; an empty string leaves amounts in generic units. */
  currencyPrefix?: string;
  /** Hide the growth control when a lesson fixes it at its supplied value. */
  showGrowthControl?: boolean;
  /** Hide the delay control when a lesson fixes the first payment year. */
  showDelayControl?: boolean;
  className?: string;
}

export function PerpetuityConvergence({
  payment = 100,
  discountRate = 0.1,
  growthRate = 0,
  firstPaymentAt = 1,
  payments = 30,
  title = 'Build the present value payment by payment',
  paymentLabel = 'First payment amount',
  discountRateLabel = 'Annual discount rate',
  growthRateLabel = 'Annual payment growth',
  paymentsLabel = 'Payments included',
  firstPaymentAtLabel = 'First payment year',
  subtotalLabel = 'PV of included payments',
  limitLabel = 'Perpetuity PV limit',
  tailLabel = 'PV of omitted later payments',
  noLimitLabel = 'No finite limit',
  convergentMessage = 'Discounting exceeds growth, so successive discounted payments shrink. Their ratio is about {ratio}, and the sum approaches a finite limit.',
  equalRatesMessage = 'Growth and discounting cancel. Every discounted payment has the same size; adding more positive payments keeps raising the total without a finite limit.',
  growingTermsMessage = 'Successive discounted payments grow. The displayed finite subtotal is defined, but infinitely many positive payments have no finite present value at these rates.',
  chartLabel = 'Present value of the first {payments} payments, starting in year {firstYear}: {subtotal}. Infinite-stream limit: {limit}.',
  xAxisLabel = 'Number of payments included',
  yAxisLabel = 'Present value at year zero',
  detailsLabel = 'Inspect the payment calculations',
  yearLabel = 'Payment year',
  cashFlowLabel = 'Cash flow',
  discountedLabel = 'PV at year zero',
  runningLabel = 'Running PV',
  caption = 'The amount is the first actual payment. Growth starts between subsequent payments; delaying the first payment does not grow its amount. Rates stay constant and the model does not guarantee actual receipts.',
  locale = 'en-US',
  currencyPrefix = '',
  showGrowthControl = true,
  showDelayControl = true,
  className,
}: PerpetuityConvergenceProps) {
  // Author mistakes fail during SSR; r <= g is a supported learner-controlled state.
  calculatePerpetuitySeries({ payment, discountRate, growthRate, firstPaymentAt, payments });
  const labels = { title, paymentLabel, discountRateLabel, growthRateLabel, paymentsLabel,
    firstPaymentAtLabel, subtotalLabel, limitLabel, tailLabel, noLimitLabel, chartLabel,
    convergentMessage, equalRatesMessage, growingTermsMessage, xAxisLabel, yAxisLabel,
    detailsLabel, yearLabel, cashFlowLabel, discountedLabel, runningLabel };
  for (const [name, value] of Object.entries(labels)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`PerpetuityConvergence: ${name} must be nonempty.`);
    }
  }
  const id = useId();
  const [rate, setRate] = useState(discountRate);
  const [growth, setGrowth] = useState(growthRate);
  const [count, setCount] = useState(payments);
  const [firstYear, setFirstYear] = useState(firstPaymentAt);
  const model = calculatePerpetuitySeries({ payment, discountRate: rate, growthRate: growth,
    firstPaymentAt: firstYear, payments: count });
  const moneyFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const smallMoneyFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  const axisFormat = new Intl.NumberFormat(locale, { notation: 'scientific', maximumFractionDigits: 1 });
  const countFormat = new Intl.NumberFormat(locale);
  const percentFormat = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const smallPercentFormat = new Intl.NumberFormat(locale, { style: 'percent', notation: 'scientific', maximumSignificantDigits: 4 });
  const amount = (value: number): string => `${currencyPrefix}${
    (value !== 0 && Math.abs(value) < 0.01 ? smallMoneyFormat : moneyFormat).format(value)}`;
  const axisAmount = (value: number): string => Math.abs(value) >= 1e6
    ? `${currencyPrefix}${axisFormat.format(value)}` : amount(value);
  const integer = (value: number): string => countFormat.format(value);
  const percent = (value: number): string =>
    (value !== 0 && Math.abs(value) < 0.0001 ? smallPercentFormat : percentFormat).format(value);
  const limitText = model.limit === null ? noLimitLabel : amount(model.limit);
  const descriptionValues = {
    payments: integer(count), firstYear: integer(firstYear),
    subtotal: amount(model.subtotal), limit: limitText,
  };
  const description = chartLabel.replace(/\{(payments|firstYear|subtotal|limit)\}/g,
    (_, key: keyof typeof descriptionValues) => descriptionValues[key]);
  const status = model.limit !== null
    ? convergentMessage.replace(/\{ratio\}/g, new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(model.ratio))
    : rate === growth ? equalRatesMessage : growingTermsMessage;

  const W = 520;
  const H = 220;
  const pad = 12;
  const maxValue = Math.max(model.limit ?? 0, model.subtotal) * 1.05;
  const x = (n: number) => pad + n / count * (W - 2 * pad);
  const y = (value: number) => H - pad - value / maxValue * (H - 2 * pad);
  const path = `M ${x(0)} ${y(0)} ` + model.rows.map((row, index) =>
    `L ${x(index + 1)} ${y(row.runningValue)}`).join(' ');
  const inputClass = 'mt-2 h-6 w-full cursor-pointer accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

  return (
    <figure className={cx('not-prose my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="font-semibold text-ink-900">{title}</figcaption>
      <p className="mt-2 text-sm text-ink-700">{paymentLabel}: <span className="font-mono tabular-nums">{amount(payment)}</span></p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-rate`} className="block text-sm text-ink-700">
          <span className="flex flex-wrap justify-between gap-2"><span>{discountRateLabel}</span><span className="font-mono tabular-nums">{percent(rate)}</span></span>
          <input id={`${id}-rate`} type="range" min={0} max={50} step={0.1}
            value={rate * 100} aria-valuetext={percent(rate)} onChange={event => setRate(Number(event.target.value) / 100)} className={inputClass} />
        </label>
        {showGrowthControl && <label htmlFor={`${id}-growth`} className="block text-sm text-ink-700">
          <span className="flex flex-wrap justify-between gap-2"><span>{growthRateLabel}</span><span className="font-mono tabular-nums">{percent(growth)}</span></span>
          <input id={`${id}-growth`} type="range" min={-50} max={50} step={0.1}
            value={growth * 100} aria-valuetext={percent(growth)} onChange={event => setGrowth(Number(event.target.value) / 100)} className={inputClass} />
        </label>}
        <label htmlFor={`${id}-count`} className="block text-sm text-ink-700">
          <span className="flex flex-wrap justify-between gap-2"><span>{paymentsLabel}</span><span className="font-mono tabular-nums">{integer(count)}</span></span>
          <input id={`${id}-count`} type="range" min={1} max={100} step={1}
            value={count} aria-valuetext={integer(count)} onChange={event => setCount(Number(event.target.value))} className={inputClass} />
        </label>
        {showDelayControl && <label htmlFor={`${id}-first`} className="block text-sm text-ink-700">
          <span className="flex flex-wrap justify-between gap-2"><span>{firstPaymentAtLabel}</span><span className="font-mono tabular-nums">{integer(firstYear)}</span></span>
          <input id={`${id}-first`} type="range" min={1} max={20} step={1}
            value={firstYear} aria-valuetext={integer(firstYear)} onChange={event => setFirstYear(Number(event.target.value))} className={inputClass} />
        </label>}
      </div>
      <div className="mt-5 text-xs text-ink-600">{yAxisLabel}</div>
      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex flex-col justify-between text-right font-mono text-xs tabular-nums text-ink-600" aria-hidden="true">
          <span>{axisAmount(maxValue)}</span><span>{axisAmount(maxValue / 2)}</span><span>{amount(0)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={description}>
          {model.limit !== null && <line x1={pad} x2={W-pad} y1={y(model.limit)} y2={y(model.limit)}
            stroke="var(--color-accent-600)" strokeWidth={2} strokeDasharray="6 4" />}
          <path d={path} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} strokeLinejoin="round" />
          <circle cx={x(count)} cy={y(model.subtotal)} r={5} fill="var(--color-brand-600)" />
        </svg>
        <span aria-hidden="true" />
        <div className="flex justify-between font-mono text-xs tabular-nums text-ink-600" style={{ paddingInline: `${pad / W * 100}%` }} aria-hidden="true">
          <span>{integer(0)}</span>{count > 1 && <span>{integer(count / 2)}</span>}<span>{integer(count)}</span>
        </div>
        <span aria-hidden="true" />
        <p className="text-center text-xs text-ink-600">{xAxisLabel}</p>
      </div>
      {model.limit !== null && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-1 w-5 rounded-pill bg-brand-600" />{subtotalLabel}</span>
        {model.limit !== null && <span className="inline-flex items-center gap-2"><svg width="20" height="4" aria-hidden="true"><line x1="0" x2="20" y1="2" y2="2" stroke="var(--color-accent-600)" strokeWidth="2" strokeDasharray="4 3" /></svg>{limitLabel}</span>}
      </div>}
      <div aria-live="polite" aria-atomic="true" className="mt-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-600">{subtotalLabel}</dt><dd className="mt-1 break-all font-mono text-lg font-semibold tabular-nums text-brand-700">{amount(model.subtotal)}</dd></div>
          <div><dt className="text-ink-600">{limitLabel}</dt><dd className="mt-1 break-all font-mono text-lg font-semibold tabular-nums text-ink-900">{limitText}</dd></div>
          {model.tail !== null && <div className="sm:col-span-2"><dt className="text-ink-600">{tailLabel}</dt><dd className="mt-1 break-all font-mono tabular-nums text-ink-900">{amount(model.tail)}</dd></div>}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-700">{status}</p>
      </div>
      {caption && <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>}
      <details className="mt-5">
        <summary className="w-fit cursor-pointer rounded-sm text-sm font-semibold text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{detailsLabel}</summary>
        <div className="mt-3">
          <table tabIndex={0} aria-label={detailsLabel} className="block w-full max-w-full overflow-x-auto text-right text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <thead className="text-ink-600"><tr><th scope="col" className="p-2 text-left">{yearLabel}</th><th scope="col" className="p-2">{cashFlowLabel}</th><th scope="col" className="p-2">{discountedLabel}</th><th scope="col" className="p-2">{runningLabel}</th></tr></thead>
            <tbody className="font-mono text-ink-800">{model.rows.map(row => <tr key={row.year} className="odd:bg-surface-sunken/40"><th scope="row" className="p-2 text-left font-normal">{integer(row.year)}</th><td className="p-2">{amount(row.cashFlow)}</td><td className="p-2">{amount(row.presentValue)}</td><td className="p-2">{amount(row.runningValue)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export default PerpetuityConvergence;
