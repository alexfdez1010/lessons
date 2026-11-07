import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PresentValueDecayProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the discount-rate slider. */
  rateLabel?: string;
  /** Label for the years-to-payment slider. */
  yearsLabel?: string;
  /** Label for the fixed future-amount readout. */
  futureLabel?: string;
  /** Legend label for the present-value decay curve. */
  pvLabel?: string;
  /** Legend label for the un-discounted face value line. */
  faceLabel?: string;
  /** Label for the present-value readout. */
  presentValueLabel?: string;
  /** Label for the "cents on the dollar" readout. */
  centsLabel?: string;
  /** Label for the horizontal axis. */
  xAxisLabel?: string;
  /** Label for the monetary vertical axis. */
  yAxisLabel?: string;
  /** Label for face value minus present value. */
  discountLabel?: string;
  /** Locale for monetary values, percentages and year ticks. */
  locale?: string;
  /** Accessible description with {title}, {future}, {years}, {rate}, {present}, {discount} placeholders. */
  chartLabel?: string;
  /** Assumptions or interpretation shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** The fixed future payment whose present value we discount. Defaults to `1000`. */
  futureValue?: number;
  /** Initial discount rate as a fraction (0–0.15). Defaults to `0.08`. */
  rate?: number;
  /** Initial number of years until the payment arrives (1–40). Defaults to `20`. */
  years?: number;
  className?: string;
}

const money = (prefix: string, value: number, locale: string): string =>
  `${prefix}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

/** Compare a fixed future payment with its present value. A marker stays on
 * the selected horizon while the complete 40-year curve supplies context. No
 * automatic draw-in hides the marker when a slider changes. */
export function PresentValueDecay({
  title = 'Discounting: what a future dollar is worth today',
  rateLabel = 'Discount rate',
  yearsLabel = 'Years until paid',
  futureLabel = 'Future payment',
  pvLabel = 'Present value',
  faceLabel = 'Face value',
  presentValueLabel = 'Worth today',
  centsLabel = 'Cents on the dollar',
  xAxisLabel = 'Years until payment',
  yAxisLabel = 'Value today',
  discountLabel = 'Difference from face value',
  locale = 'en-US',
  chartLabel = '{title}: a {future} payment due in {years} years, discounted at {rate}% a year, is worth {present} today; the difference from face value is {discount}.',
  caption = 'The future payment stays fixed. The discount rate is an assumed annual opportunity cost; each extra year divides present value by another (1 + r).',
  currencyPrefix = '$',
  futureValue = 1000,
  rate = 0.08,
  years = 20,
  className,
}: PresentValueDecayProps) {
  const id = useId();
  const [rateState, setRateState] = useState(rate);
  const [yearsState, setYearsState] = useState(years);

  const W = 440;
  const H = 200;
  const padX = 6;
  const padY = 8;

  // Horizon for the x-axis: always show at least 40 years of decay so the shape
  // is legible, but never less than the selected horizon.
  const span = Math.max(yearsState, 40);
  const maxV = futureValue;
  const minV = 0;

  // Quantise render coordinates only so server and browser math-library rounding
  // cannot produce different SVG attributes. Financial values retain precision.
  const coordinate = (value: number) => Number(value.toFixed(3));
  const x = (year: number) => coordinate(padX + (year / span) * (W - padX * 2));
  const y = (v: number) => coordinate(padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2));

  const pvAt = (year: number) => futureValue / Math.pow(1 + rateState, year);
  const presentValue = pvAt(yearsState);
  const cents = Math.round((presentValue / futureValue) * 100);

  const pvPath = Array.from({ length: 81 }, (_, i) => {
    const year = (i / 80) * span;
    return `${i === 0 ? 'M' : 'L'} ${x(year)} ${y(pvAt(year))}`;
  }).join(' ');
  const facePath = `M ${x(0)} ${y(futureValue)} L ${x(span)} ${y(futureValue)}`;
  const ratePct = Math.round(rateState * 100);
  const chartValues = {
    title,
    future: money(currencyPrefix, futureValue, locale),
    years: new Intl.NumberFormat(locale).format(yearsState),
    rate: new Intl.NumberFormat(locale).format(ratePct),
    present: money(currencyPrefix, presentValue, locale),
    discount: money(currencyPrefix, futureValue - presentValue, locale),
  };
  const chartDescription = chartLabel.replace(
    /\{(title|future|years|rate|present|discount)\}/g,
    (_, key: keyof typeof chartValues) => chartValues[key],
  );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="shrink-0 rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {futureLabel}: {chartValues.future}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-600" aria-hidden="true" />
          {pvLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-600" aria-hidden="true" />
          {faceLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs text-ink-600">{yAxisLabel}</div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <div className="flex flex-col justify-between text-right font-mono text-xs tabular-nums text-ink-600" aria-hidden="true">
            {[futureValue, futureValue / 2, 0].map((value, i) => (
              <span key={i}>{money(currencyPrefix, value, locale)}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chartDescription}>
            {[0, futureValue / 2].map((value, i) => (
              <line key={i} x1={padX} y1={y(value)} x2={W - padX} y2={y(value)} stroke="var(--color-ink-200)" strokeDasharray="3 5" />
            ))}
            <path d={facePath} fill="none" stroke="var(--color-accent-600)" strokeWidth={2} strokeDasharray="6 4" />
            <path d={pvPath} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <line x1={x(yearsState)} y1={y(futureValue)} x2={x(yearsState)} y2={y(presentValue)} stroke="var(--color-ink-500)" strokeDasharray="4 4" />
            <circle cx={x(yearsState)} cy={y(presentValue)} r={4} fill="var(--color-brand-600)" />
          </svg>
          <span />
          <div className="mt-1 flex justify-between font-mono text-xs text-ink-600" aria-hidden="true">
            {[0, span / 2, span].map((value, i) => (
              <span key={i}>{new Intl.NumberFormat(locale).format(value)}</span>
            ))}
          </div>
        </div>
        <div className="mt-1 text-center text-xs text-ink-600">{xAxisLabel}</div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-rate`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{rateLabel}</span>
            <span className="font-mono text-ink-900">{ratePct}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0}
            max={15}
            step={1}
            value={ratePct}
            onChange={(e) => setRateState(Number(e.target.value) / 100)}
            className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-years`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yearsLabel}</span>
            <span className="font-mono text-ink-900">{yearsState}</span>
          </label>
          <input
            id={`${id}-years`}
            type="range"
            min={1}
            max={40}
            step={1}
            value={yearsState}
            onChange={(e) => setYearsState(Number(e.target.value))}
            className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid gap-3 text-sm min-[380px]:grid-cols-2" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{presentValueLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-brand-700">
            {chartValues.present}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{centsLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-ink-900">{cents}¢</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 min-[380px]:col-span-2">
          <dt className="text-ink-500">{discountLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-ink-900">{chartValues.discount}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PresentValueDecay;
