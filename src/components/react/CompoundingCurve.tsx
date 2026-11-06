import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CompoundingCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the annual-rate slider. */
  rateLabel?: string;
  /** Label for the years slider. */
  yearsLabel?: string;
  /** Label for the starting-amount readout. */
  startLabel?: string;
  /** Legend label for the compound (exponential) curve. */
  compoundLabel?: string;
  /** Legend label for the simple-growth straight line. */
  simpleLabel?: string;
  /** Label for the final compound-value readout. */
  finalValueLabel?: string;
  /** @deprecated Retained for authored lessons; the annual rate is shown by its control. */
  cagrLabel?: string;
  /** Label for the horizontal axis. */
  xAxisLabel?: string;
  /** Label for the monetary vertical axis. */
  yAxisLabel?: string;
  /** Label for the simple-interest comparison readout. */
  simpleValueLabel?: string;
  /** Label for compound value minus simple-interest value. */
  interestOnInterestLabel?: string;
  /** Assumptions or interpretation shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Locale used to format the monetary readouts. Defaults to `'en-US'`. */
  locale?: string;
  /** Accessible chart description with {title}, {start}, {rate}, {years}, {compound}, and {simple} placeholders. */
  chartLabel?: string;
  /** Starting amount. Defaults to `1000`. */
  principal?: number;
  /** Initial annual rate as a fraction. The control includes this rate and at least 0–0.15. */
  rate?: number;
  /** Initial number of years (1–40). Defaults to `20`. */
  years?: number;
  className?: string;
}

const money = (prefix: string, value: number, locale: string): string =>
  `${prefix}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

/** Compare compound and simple growth at a common rate and horizon. The whole
 * curve stays visible while inputs change, so its comparison never disappears
 * behind a draw-in animation. All amounts use one fixed annual rate, one initial
 * deposit and retained interest. */
export function CompoundingCurve({
  title = 'Compounding pulls away',
  rateLabel = 'Annual rate',
  yearsLabel = 'Years',
  startLabel = 'Start',
  compoundLabel = 'Compound growth',
  simpleLabel = 'Simple growth',
  finalValueLabel = 'Final value',
  xAxisLabel = 'Years',
  yAxisLabel = 'Value',
  simpleValueLabel = 'With simple interest',
  interestOnInterestLabel = 'Interest on interest',
  caption = 'One initial deposit, a fixed annual rate and all interest retained; no fees, taxes or withdrawals.',
  currencyPrefix = '$',
  locale = 'en-US',
  chartLabel = '{title}: {start} growing at {rate}% a year for {years} years reaches {compound} with compounding versus {simple} with simple growth.',
  principal = 1000,
  rate = 0.08,
  years = 20,
  className,
}: CompoundingCurveProps) {
  const id = useId();
  const [rateState, setRateState] = useState(rate);
  const [yearsState, setYearsState] = useState(years);

  const W = 440;
  const H = 200;
  const padX = 6;
  const padY = 8;

  const finalCompound = principal * Math.pow(1 + rateState, yearsState);
  const finalSimple = principal * (1 + rateState * yearsState);
  const maxV = Math.max(finalCompound, finalSimple, principal * 1.01);

  const x = (year: number) => padX + (year / yearsState) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - v / maxV) * (H - padY * 2);

  const compoundAt = (year: number) => principal * Math.pow(1 + rateState, year);
  const simpleAt = (year: number) => principal * (1 + rateState * year);

  const compoundPath = Array.from({ length: 81 }, (_, i) => {
    const year = (i / 80) * yearsState;
    return `${i === 0 ? 'M' : 'L'} ${x(year)} ${y(compoundAt(year))}`;
  }).join(' ');
  const simplePath = `M ${x(0)} ${y(simpleAt(0))} L ${x(yearsState)} ${y(simpleAt(yearsState))}`;

  const ratePct = rateState * 100;
  const rateText = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ratePct);
  const chartValues = {
    title,
    start: money(currencyPrefix, principal, locale),
    rate: rateText,
    years: String(yearsState),
    compound: money(currencyPrefix, finalCompound, locale),
    simple: money(currencyPrefix, finalSimple, locale),
  };
  const chartDescription = chartLabel.replace(
    /\{(title|start|rate|years|compound|simple)\}/g,
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
          {startLabel}: {chartValues.start}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-600" aria-hidden="true" />
          {compoundLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-600" aria-hidden="true" />
          {simpleLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs text-ink-600">{yAxisLabel}</div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <div className="flex flex-col justify-between text-right font-mono text-xs tabular-nums text-ink-600" aria-hidden="true">
            {[maxV, maxV / 2, 0].map((value, i) => (
              <span key={i}>{money(currencyPrefix, value, locale)}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chartDescription}>
            {[0, maxV / 2, maxV].map((value, i) => (
              <line key={i} x1={padX} y1={y(value)} x2={W - padX} y2={y(value)} stroke="var(--color-ink-200)" strokeDasharray="3 5" />
            ))}
            <path d={simplePath} fill="none" stroke="var(--color-accent-600)" strokeWidth={2} strokeDasharray="6 4" />
            <path d={compoundPath} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(yearsState)} cy={y(finalCompound)} r={4} fill="var(--color-brand-600)" />
            <circle cx={x(yearsState)} cy={y(finalSimple)} r={4} fill="var(--color-accent-600)" />
          </svg>
          <span />
          <div className="mt-1 flex justify-between font-mono text-xs text-ink-600" aria-hidden="true">
            {[0, yearsState / 2, yearsState].map((value, i) => (
              <span key={i}>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}</span>
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
            <span className="font-mono text-ink-900">{rateText}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0}
            max={Math.max(15, rate * 100)}
            step={0.5}
            value={ratePct}
            onChange={(e) => setRateState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid gap-3 text-sm min-[380px]:grid-cols-2" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{finalValueLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-brand-700">
            {chartValues.compound}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{simpleValueLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-accent-600">{chartValues.simple}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{interestOnInterestLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-brand-700">{money(currencyPrefix, finalCompound - finalSimple, locale)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CompoundingCurve;
