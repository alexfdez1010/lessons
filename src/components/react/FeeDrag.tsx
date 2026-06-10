import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FeeDragProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the time-horizon slider. */
  yearsLabel?: string;
  /** Label for the expensive fund's expense-ratio slider. */
  expenseRatioLabel?: string;
  /** Legend label for the cheap (low expense ratio) fund. */
  cheapLabel?: string;
  /** Legend label for the expensive (high expense ratio) fund. */
  expensiveLabel?: string;
  /** Legend label for the optional no-fee baseline. */
  baselineLabel?: string;
  /** Label for the cheap fund's end-value readout. */
  cheapEndLabel?: string;
  /** Label for the expensive fund's end-value readout. */
  expensiveEndLabel?: string;
  /** Label for the highlighted "money lost to fees" gap readout. */
  lostToFeesLabel?: string;
  /** Label for the starting-amount chip. */
  startLabel?: string;
  /** Suffix for the gap-as-percent readout, e.g. "of the cheap fund's outcome". */
  ofCheapOutcomeLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting investment. Defaults to `10000`. */
  principal?: number;
  /** Gross annual return as a fraction, before fees. Defaults to `0.07`. */
  grossReturn?: number;
  /** Cheap fund's annual expense ratio as a fraction. Defaults to `0.0005` (0.05%). */
  cheapExpenseRatio?: number;
  /** Expensive fund's initial expense ratio as a fraction (0.001–0.025). Defaults to `0.015` (1.50%). */
  expensiveExpenseRatio?: number;
  /** Initial time horizon in years (5–40). Defaults to `30`. */
  years?: number;
  /** Draw the no-fee baseline curve. Defaults to `true`. */
  showBaseline?: boolean;
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

const pct = (fraction: number, decimals = 2): string =>
  `${(fraction * 100).toFixed(decimals)}%`;

/**
 * Fee-drag visualizer. Two funds start with the same money and earn the same
 * gross annual return; the only difference is the annual expense ratio. Both
 * growth curves are drawn in the same SVG, with the widening wedge between them
 * shaded — that wedge *is* the money lost to fees. Drag the years slider and the
 * gap balloons with the horizon; drag the expense-ratio slider and the drag
 * scales live. End values plus the absolute and percentage gap are announced in
 * an `aria-live` readout. Curves redraw with an animated reveal on every change;
 * respects `prefers-reduced-motion` (jumps straight to the final state).
 */
export function FeeDrag({
  title = 'The fee that ate your retirement',
  yearsLabel = 'Years',
  expenseRatioLabel = 'Expense ratio (expensive fund)',
  cheapLabel = 'Cheap fund (0.05%)',
  expensiveLabel = 'Expensive fund',
  baselineLabel = 'No-fee baseline',
  cheapEndLabel = 'Cheap fund ends at',
  expensiveEndLabel = 'Expensive fund ends at',
  lostToFeesLabel = 'Lost to fees',
  startLabel = 'Start',
  ofCheapOutcomeLabel = 'of the cheap fund’s outcome',
  caption = 'Both funds earn the same 7% gross return. The only difference is the yearly fee — and over decades that sliver compounds into the shaded wedge.',
  currencyPrefix = '$',
  principal = 10000,
  grossReturn = 0.07,
  cheapExpenseRatio = 0.0005,
  expensiveExpenseRatio = 0.015,
  years = 30,
  showBaseline = true,
  className,
}: FeeDragProps) {
  const id = useId();
  const [yearsState, setYearsState] = useState(years);
  // Expense ratio tracked in basis points so the range input gets clean integer steps.
  const [erBps, setErBps] = useState(Math.round(expensiveExpenseRatio * 10000));
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const expensiveEr = erBps / 10000;

  const W = 520;
  const H = 240;
  const padX = 10;
  const padY = 14;

  const netRate = (er: number) => 1 + grossReturn - er;
  const baselineAt = (year: number) => principal * Math.pow(1 + grossReturn, year);
  const cheapAt = (year: number) => principal * Math.pow(netRate(cheapExpenseRatio), year);
  const expensiveAt = (year: number) => principal * Math.pow(netRate(expensiveEr), year);

  const maxV = Math.max(
    showBaseline ? baselineAt(yearsState) : 0,
    cheapAt(yearsState),
    principal * 1.01,
  );

  const x = (year: number) => padX + (year / yearsState) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - principal) / (maxV - principal)) * (H - padY * 2);

  const SAMPLES = 80;
  const revealedYears = progress * yearsState;

  /** Polyline for one curve, revealed up to `revealedYears`. */
  const curvePath = (valueAt: (year: number) => number) => {
    let d = `M ${x(0)} ${y(valueAt(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const year = (i / SAMPLES) * yearsState;
      if (year > revealedYears) {
        d += ` L ${x(revealedYears)} ${y(valueAt(revealedYears))}`;
        break;
      }
      d += ` L ${x(year)} ${y(valueAt(year))}`;
    }
    return d;
  };

  /** Closed region between the cheap curve (top) and the expensive curve (bottom). */
  const gapAreaPath = () => {
    let d = `M ${x(0)} ${y(cheapAt(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const year = Math.min((i / SAMPLES) * yearsState, revealedYears);
      d += ` L ${x(year)} ${y(cheapAt(year))}`;
      if (year >= revealedYears) break;
    }
    for (let i = SAMPLES; i >= 0; i--) {
      const year = Math.min((i / SAMPLES) * yearsState, revealedYears);
      d += ` L ${x(year)} ${y(expensiveAt(year))}`;
    }
    return `${d} Z`;
  };

  // Animate the curves (and the counting gap readout) on every input change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
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
  }, [yearsState, erBps]);

  const cheapEnd = cheapAt(yearsState);
  const expensiveEnd = expensiveAt(yearsState);
  const gap = cheapEnd - expensiveEnd;
  const gapShare = cheapEnd > 0 ? gap / cheapEnd : 0;

  // The displayed gap counts up alongside the curve reveal.
  const shownGap = cheapAt(revealedYears) - expensiveAt(revealedYears);

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
        {showBaseline && (
          <span className="inline-flex items-center gap-2 text-ink-700">
            <span
              className="h-1 w-5 rounded-pill border-t-2 border-dashed border-ink-300"
              aria-hidden="true"
            />
            {baselineLabel}
          </span>
        )}
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {cheapLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {expensiveLabel} ({pct(expensiveEr)})
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-5 rounded-sm bg-danger/15" aria-hidden="true" />
          {lostToFeesLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${money(currencyPrefix, principal)} growing at ${pct(grossReturn, 0)} gross for ${yearsState} years ends at ${money(
          currencyPrefix,
          cheapEnd,
        )} in the cheap fund (${pct(cheapExpenseRatio)}) versus ${money(
          currencyPrefix,
          expensiveEnd,
        )} in the expensive fund (${pct(expensiveEr)}) — a gap of ${money(currencyPrefix, gap)}.`}
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
        {/* Shaded fee-drag wedge between the two curves */}
        <path d={gapAreaPath()} fill="var(--color-danger)" fillOpacity={0.12} stroke="none" />
        {/* No-fee baseline (faint, dashed) */}
        {showBaseline && (
          <path
            d={curvePath(baselineAt)}
            fill="none"
            stroke="var(--color-ink-300)"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {/* Expensive fund */}
        <path
          d={curvePath(expensiveAt)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Cheap fund */}
        <path
          d={curvePath(cheapAt)}
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
            htmlFor={`${id}-years`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yearsLabel}</span>
            <span className="font-mono text-ink-900">{yearsState}</span>
          </label>
          <input
            id={`${id}-years`}
            type="range"
            min={5}
            max={40}
            step={1}
            value={yearsState}
            onChange={(e) => setYearsState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-er`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{expenseRatioLabel}</span>
            <span className="font-mono text-ink-900">{pct(expensiveEr)}</span>
          </label>
          <input
            id={`${id}-er`}
            type="range"
            min={10}
            max={250}
            step={5}
            value={erBps}
            onChange={(e) => setErBps(Number(e.target.value))}
            aria-valuetext={pct(expensiveEr)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{cheapEndLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, cheapEnd)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{expensiveEndLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {money(currencyPrefix, expensiveEnd)}
          </dd>
        </div>
        <div className="rounded-card border border-danger/30 bg-danger/5 px-3 py-2">
          <dt className="font-medium text-danger">{lostToFeesLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-danger">
            −{money(currencyPrefix, shownGap)}
          </dd>
          <dd className="mt-0.5 text-xs text-ink-600">
            {pct(gapShare, 1)} {ofCheapOutcomeLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FeeDrag;
