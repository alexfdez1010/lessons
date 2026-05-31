import { useEffect, useId, useRef, useState } from 'react';
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
  /** One-line takeaway shown under the chart. */
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

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

/**
 * Interactive discounting chart — compounding run in reverse. A fixed future
 * payment (e.g. $1,000 arriving in N years) is worth less today; this draws its
 * present value PV = FV / (1 + r)^t as a curve that *decays* away from the flat
 * face-value line as the payment moves further into the future. The gap between
 * the two lines is the discount — the price of waiting. Drag the discount-rate
 * and years sliders and the curve plus the present-value / cents-on-the-dollar
 * readouts update live; the curve animates in on mount and on every change.
 * Respects `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function PresentValueDecay({
  title = 'Discounting: what a future dollar is worth today',
  rateLabel = 'Discount rate',
  yearsLabel = 'Years until paid',
  futureLabel = 'Future payment',
  pvLabel = 'Present value',
  faceLabel = 'Face value',
  presentValueLabel = 'Worth today',
  centsLabel = 'Cents on the dollar',
  caption = 'A promised payment loses value the longer you wait and the higher the discount rate. The curve is compounding played backwards — each year divides by another (1 + r).',
  currencyPrefix = '$',
  futureValue = 1000,
  rate = 0.08,
  years = 20,
  className,
}: PresentValueDecayProps) {
  const id = useId();
  const [rateState, setRateState] = useState(rate);
  const [yearsState, setYearsState] = useState(years);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  // Horizon for the x-axis: always show at least 40 years of decay so the shape
  // is legible, but never less than the selected horizon.
  const span = Math.max(yearsState, 40);
  const maxV = futureValue;
  const minV = 0;

  const x = (year: number) => padX + (year / span) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const pvAt = (year: number) => futureValue / Math.pow(1 + rateState, year);
  const presentValue = pvAt(yearsState);
  const cents = Math.round((presentValue / futureValue) * 100);

  // Decay curve sampled finely, revealed up to `progress`.
  const SAMPLES = 80;
  const pvPath = () => {
    const upto = progress * span;
    let d = `M ${x(0)} ${y(pvAt(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const year = (i / SAMPLES) * span;
      if (year > upto) {
        d += ` L ${x(upto)} ${y(pvAt(upto))}`;
        break;
      }
      d += ` L ${x(year)} ${y(pvAt(year))}`;
    }
    return d;
  };

  const facePath = `M ${x(0)} ${y(futureValue)} L ${x(span)} ${y(futureValue)}`;

  // Animate the curve drawing in whenever the rate or horizon changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [rateState, yearsState]);

  const ratePct = Math.round(rateState * 100);
  const markerVisible = progress * span >= yearsState;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {futureLabel}: {money(currencyPrefix, futureValue)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {pvLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {faceLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a ${money(currencyPrefix, futureValue)} payment due in ${yearsState} years, discounted at ${ratePct}% a year, is worth ${money(
          currencyPrefix,
          presentValue,
        )} today.`}
      >
        {/* Face-value reference line */}
        <path d={facePath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />
        {/* Present-value decay curve, animated reveal */}
        <path
          d={pvPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Marker at the selected horizon */}
        {markerVisible && (
          <>
            <line
              x1={x(yearsState)}
              y1={y(futureValue)}
              x2={x(yearsState)}
              y2={y(presentValue)}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <circle cx={x(yearsState)} cy={y(presentValue)} r={5} fill="var(--color-brand-600)" />
          </>
        )}
      </svg>

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
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{presentValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, presentValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{centsLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{cents}¢</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PresentValueDecay;
