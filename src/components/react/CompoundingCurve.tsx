import { useEffect, useId, useRef, useState } from 'react';
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
  /** Label for the CAGR readout. */
  cagrLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting amount. Defaults to `1000`. */
  principal?: number;
  /** Initial annual rate as a fraction (0–0.15). Defaults to `0.08`. */
  rate?: number;
  /** Initial number of years (1–40). Defaults to `20`. */
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
 * Interactive CAGR / compound-growth chart. An initial amount grows at the
 * chosen annual rate over N years, drawn as a smooth exponential curve. A faint
 * straight "simple growth" line sits behind it so the learner *sees* compounding
 * pull away — the gap between the two is the interest-on-interest. Drag the rate
 * (and years) sliders and the curve plus the final-value/CAGR readouts update
 * live; the curve animates in on mount and on every rate change. Respects
 * `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function CompoundingCurve({
  title = 'Compounding pulls away',
  rateLabel = 'Annual rate',
  yearsLabel = 'Years',
  startLabel = 'Start',
  compoundLabel = 'Compound growth',
  simpleLabel = 'Simple growth',
  finalValueLabel = 'Final value',
  cagrLabel = 'CAGR',
  caption = 'Simple growth adds the same amount each year. Compound growth earns interest on past interest — so it curves upward and leaves the straight line behind.',
  currencyPrefix = '$',
  principal = 1000,
  rate = 0.08,
  years = 20,
  className,
}: CompoundingCurveProps) {
  const id = useId();
  const [rateState, setRateState] = useState(rate);
  const [yearsState, setYearsState] = useState(years);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  const finalCompound = principal * Math.pow(1 + rateState, yearsState);
  const finalSimple = principal * (1 + rateState * yearsState);
  const maxV = Math.max(finalCompound, finalSimple, principal * 1.01);

  const x = (year: number) => padX + (year / yearsState) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - principal) / (maxV - principal)) * (H - padY * 2);

  const compoundAt = (year: number) => principal * Math.pow(1 + rateState, year);
  const simpleAt = (year: number) => principal * (1 + rateState * year);

  // Smooth exponential curve sampled finely, revealed up to `progress`.
  const SAMPLES = 80;
  const compoundPath = () => {
    const upto = progress * yearsState;
    let d = `M ${x(0)} ${y(compoundAt(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const year = (i / SAMPLES) * yearsState;
      if (year > upto) {
        d += ` L ${x(upto)} ${y(compoundAt(upto))}`;
        break;
      }
      d += ` L ${x(year)} ${y(compoundAt(year))}`;
    }
    return d;
  };

  const simplePath = `M ${x(0)} ${y(simpleAt(0))} L ${x(yearsState)} ${y(
    simpleAt(yearsState),
  )}`;

  // Animate the curve drawing in whenever the rate or year span changes.
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
          {startLabel}: {money(currencyPrefix, principal)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {compoundLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {simpleLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${money(currencyPrefix, principal)} growing at ${ratePct}% a year for ${yearsState} years reaches ${money(
          currencyPrefix,
          finalCompound,
        )} with compounding versus ${money(currencyPrefix, finalSimple)} with simple growth.`}
      >
        {/* Starting baseline */}
        <line
          x1={padX}
          y1={y(principal)}
          x2={W - padX}
          y2={y(principal)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Simple-growth straight line (faint, for contrast) */}
        <path d={simplePath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />
        {/* Compound curve, animated reveal */}
        <path
          d={compoundPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
          <dt className="text-ink-500">{finalValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, finalCompound)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{cagrLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{ratePct}%</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CompoundingCurve;
