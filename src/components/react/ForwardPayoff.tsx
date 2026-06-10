import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ForwardPayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the spot-price slider / x-axis. */
  spotLabel?: string;
  /** Label for the agreed delivery (forward) price reference line. */
  forwardPriceLabel?: string;
  /** Label for the long line and its readout. */
  longLabel?: string;
  /** Label for the short line and its readout. */
  shortLabel?: string;
  /** Label for the per-unit profit/loss readout. */
  payoffLabel?: string;
  /** Word shown when the long side profits. Defaults to `'profit'`. */
  profitLabel?: string;
  /** Word shown when the long side loses. Defaults to `'loss'`. */
  lossLabel?: string;
  /** Word shown when payoff is exactly zero (spot = forward). */
  breakevenLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Agreed forward (delivery) price. Defaults to `100`. */
  forwardPrice?: number;
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
 * Long/short forward payoff diagram. A forward locks a delivery price K; at
 * expiry the long side's per-unit payoff is (spot − K) and the short side's is
 * (K − spot) — two straight lines that cross at K, mirror images across the
 * x-axis. That mirror IS the symmetry of a linear derivative: every dollar the
 * long gains, the short loses. Drag the spot slider and a marker rides both
 * lines while the readouts flip between profit and loss. The lines sweep in on
 * mount; respects `prefers-reduced-motion` (jumps to the final diagram).
 */
export function ForwardPayoff({
  title = 'Forward payoff: a perfect mirror',
  spotLabel = 'Spot price at expiry',
  forwardPriceLabel = 'Agreed forward price',
  longLabel = 'Long (buyer)',
  shortLabel = 'Short (seller)',
  payoffLabel = 'Payoff per unit',
  profitLabel = 'profit',
  lossLabel = 'loss',
  breakevenLabel = 'break-even',
  caption = 'The long profits when spot ends above the agreed price; the short profits when it ends below. The two lines are exact mirrors across zero — one side’s gain is the other’s loss, dollar for dollar.',
  currencyPrefix = '$',
  forwardPrice = 100,
  className,
}: ForwardPayoffProps) {
  const id = useId();

  // Spot sweeps from 50% to 150% of the forward price.
  const minSpot = forwardPrice * 0.5;
  const maxSpot = forwardPrice * 1.5;
  const [spot, setSpot] = useState(forwardPrice * 1.2);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 260;
  const padX = 18;
  const padY = 20;

  // Payoff range is symmetric around zero: max |payoff| at the spot extremes.
  const maxPayoff = (maxSpot - forwardPrice) * 1.05;

  const x = (s: number) =>
    padX + ((s - minSpot) / (maxSpot - minSpot)) * (W - padX * 2);
  const y = (p: number) =>
    padY + (1 - (p + maxPayoff) / (2 * maxPayoff)) * (H - padY * 2);

  const zeroY = y(0);
  const kX = x(forwardPrice);

  const longPayoff = spot - forwardPrice;
  const shortPayoff = forwardPrice - spot;

  // Reveal lines left→right up to `progress`.
  const sweepTo = minSpot + progress * (maxSpot - minSpot);
  const longPath = `M ${x(minSpot)} ${y(minSpot - forwardPrice)} L ${x(sweepTo)} ${y(sweepTo - forwardPrice)}`;
  const shortPath = `M ${x(minSpot)} ${y(forwardPrice - minSpot)} L ${x(sweepTo)} ${y(forwardPrice - sweepTo)}`;

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
  }, [forwardPrice]);

  const eps = forwardPrice * 0.002;
  const verdict = (payoff: number): string =>
    Math.abs(payoff) <= eps
      ? breakevenLabel
      : payoff > 0
        ? profitLabel
        : lossLabel;

  const steps = Math.round((maxSpot - minSpot) / 100) || 1;
  const stepSize = (maxSpot - minSpot) / 200;
  const adjust = (dir: number) =>
    setSpot((v) => Math.min(maxSpot, Math.max(minSpot, v + dir * stepSize)));

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {longLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {shortLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: with an agreed forward price of ${money(currencyPrefix, forwardPrice)} and a spot of ${money(currencyPrefix, spot)} at expiry, the long earns ${money(currencyPrefix, longPayoff)} and the short earns ${money(currencyPrefix, shortPayoff)} per unit.`}
      >
        {/* Profit region tint (above zero) */}
        <rect
          x={padX}
          y={padY}
          width={W - padX * 2}
          height={Math.max(0, zeroY - padY)}
          fill="var(--color-brand-500)"
          opacity={0.05}
        />
        {/* Loss region tint (below zero) */}
        <rect
          x={padX}
          y={zeroY}
          width={W - padX * 2}
          height={Math.max(0, H - padY - zeroY)}
          fill="var(--color-accent-500)"
          opacity={0.05}
        />
        {/* Zero payoff axis */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />
        {/* Forward price reference (vertical) */}
        <line
          x1={kX}
          y1={padY}
          x2={kX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={kX + 4}
          y={padY + 12}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {forwardPriceLabel}
        </text>
        {/* Payoff lines */}
        <path
          d={shortPath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <path
          d={longPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Spot guide line */}
        <line
          x1={x(spot)}
          y1={padY}
          x2={x(spot)}
          y2={H - padY}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        {/* Markers on each line at the current spot */}
        <circle
          cx={x(spot)}
          cy={y(shortPayoff)}
          r={6}
          fill="var(--color-accent-600)"
          stroke="white"
          strokeWidth={2}
        />
        <circle
          cx={x(spot)}
          cy={y(longPayoff)}
          r={6}
          fill="var(--color-brand-600)"
          stroke="white"
          strokeWidth={2}
        />
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
          step={(maxSpot - minSpot) / 200}
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
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{longLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, longPayoff)}
          </dd>
          <dd className="text-xs text-ink-500">{verdict(longPayoff)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{shortLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {money(currencyPrefix, shortPayoff)}
          </dd>
          <dd className="text-xs text-ink-500">{verdict(shortPayoff)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ForwardPayoff;
