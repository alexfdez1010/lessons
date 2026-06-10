import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HedgeLockChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the unhedged exposure line. */
  unhedgedLabel?: string;
  /** Label for the futures-position line. */
  futuresLabel?: string;
  /** Label for the combined (hedged) line. */
  hedgedLabel?: string;
  /** Label for the spot-price slider / x-axis. */
  spotLabel?: string;
  /** Label for the locked outcome readout. */
  lockedLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}`;
};

/**
 * Hedger's lock-in chart. A producer who will sell at a future date is exposed
 * to spot: their revenue rises and falls with the price (the sloped line). Sell
 * a futures contract and you take the opposite slope (gains when spot falls).
 * Add the two and the swings cancel — the combined line is flat: a locked-in
 * price, immune to which way spot moves. Drag the spot slider and watch the
 * exposure and futures legs swing in opposite directions while their sum sits
 * perfectly still. Lines sweep in on mount; respects `prefers-reduced-motion`.
 */
export function HedgeLockChart({
  title = 'Hedging: trading upside away for certainty',
  unhedgedLabel = 'Unhedged exposure',
  futuresLabel = 'Short futures',
  hedgedLabel = 'Hedged (locked)',
  spotLabel = 'Spot price at delivery',
  lockedLabel = 'Locked outcome',
  caption = 'The producer’s revenue (sloped up) plus a short futures position (sloped down) sum to a flat line. The hedge cancels every swing — you give up the windfall if prices rise in exchange for protection if they fall. That trade, certainty for upside, is the whole point of hedging.',
  currencyPrefix = '$',
  className,
}: HedgeLockChartProps) {
  const id = useId();

  const lockPrice = 100;
  const minSpot = 60;
  const maxSpot = 140;
  const [spot, setSpot] = useState(120);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 250;
  const padX = 18;
  const padY = 20;

  // Outcomes are expressed as deviation from the locked price.
  const exposure = (s: number) => s - lockPrice; // long the asset
  const futures = (s: number) => lockPrice - s; // short futures
  const hedged = (_s: number) => 0; // their sum

  const maxDev = (maxSpot - lockPrice) * 1.1;
  const x = (s: number) =>
    padX + ((s - minSpot) / (maxSpot - minSpot)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v + maxDev) / (2 * maxDev)) * (H - padY * 2);

  const zeroY = y(0);
  const sweepTo = minSpot + progress * (maxSpot - minSpot);
  const line = (f: (s: number) => number) =>
    `M ${x(minSpot)} ${y(f(minSpot))} L ${x(sweepTo)} ${y(f(sweepTo))}`;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 850;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stepSize = (maxSpot - minSpot) / 160;
  const adjust = (dir: number) =>
    setSpot((v) => Math.min(maxSpot, Math.max(minSpot, v + dir * stepSize)));

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {unhedgedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {futuresLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill"
            style={{ background: 'var(--color-success)' }}
            aria-hidden="true"
          />
          {hedgedLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: as spot moves, unhedged exposure and the short futures leg swing in opposite directions, and their sum — the hedged outcome — stays flat at the locked price.`}
      >
        {/* Zero / locked line baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />
        {/* Futures leg */}
        <path
          d={line(futures)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Exposure leg */}
        <path
          d={line(exposure)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Hedged sum (flat) */}
        <path
          d={line(hedged)}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        {/* Spot guide */}
        <line
          x1={x(spot)}
          y1={padY}
          x2={x(spot)}
          y2={H - padY}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <circle cx={x(spot)} cy={y(exposure(spot))} r={5} fill="var(--color-brand-600)" stroke="white" strokeWidth={2} />
        <circle cx={x(spot)} cy={y(futures(spot))} r={5} fill="var(--color-accent-600)" stroke="white" strokeWidth={2} />
        <circle cx={x(spot)} cy={zeroY} r={6} fill="var(--color-success)" stroke="white" strokeWidth={2} />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-spot`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{spotLabel}</span>
          <span className="font-mono text-ink-900">{money(currencyPrefix, spot)}</span>
        </label>
        <input
          id={`${id}-spot`}
          type="range"
          min={minSpot}
          max={maxSpot}
          step={(maxSpot - minSpot) / 160}
          value={spot}
          onChange={(e) => setSpot(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              adjust(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              adjust(1);
            }
          }}
          aria-valuetext={money(currencyPrefix, spot)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{unhedgedLabel}</dt>
          <dd className="font-mono font-semibold text-brand-700">
            {money(currencyPrefix, exposure(spot))}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{futuresLabel}</dt>
          <dd className="font-mono font-semibold text-accent-600">
            {money(currencyPrefix, futures(spot))}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lockedLabel}</dt>
          <dd
            className="font-mono font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            {money(currencyPrefix, 0)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HedgeLockChart;
