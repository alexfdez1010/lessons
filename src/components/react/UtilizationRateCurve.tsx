import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface UtilizationRateCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Readout + slider label for utilization U. */
  utilizationLabel?: string;
  /** Readout label for the borrow APR at the current U. */
  borrowApyLabel?: string;
  /** Readout label for the supply APR at the current U. */
  supplyApyLabel?: string;
  /** Label for the dashed kink line at the optimal utilization. */
  optimalLabel?: string;
  /** Legend label for the borrow-rate curve (brand). */
  borrowCurveLabel?: string;
  /** Legend label for the supply-rate curve (accent). */
  supplyCurveLabel?: string;
  /** Base borrow rate as a fraction at U = 0. Defaults to `0`. */
  baseRate?: number;
  /** First slope, applied up to the optimal utilization. Defaults to `0.04`. */
  slope1?: number;
  /** Second (steep) slope, applied above the optimal utilization. Defaults to `0.75`. */
  slope2?: number;
  /** Optimal/kink utilization as a fraction (0…1). Defaults to `0.8`. */
  optimalU?: number;
  /** Reserve factor as a fraction skimmed before paying suppliers. Defaults to `0.1`. */
  reserveFactor?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number, digits = 2): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;

/**
 * Interactive DeFi interest-rate model — the kinked two-slope curve used by
 * Aave/Compound-style lending pools. The borrow rate climbs gently with
 * utilization `U` until the optimal point (the *kink*), then jumps onto a much
 * steeper slope to punish over-borrowing and pull `U` back down. The supply
 * rate is just `borrowRate · U · (1 − reserveFactor)`: lenders only earn on the
 * borrowed slice, minus the protocol's reserve cut, so it sits below the borrow
 * curve and bends with it.
 *
 * Drag the utilization slider and a marker rides both curves while the readouts
 * report the utilization, borrow APR and supply APR. The dashed vertical guide
 * marks the optimal utilization where the slope changes. The whole shape is
 * driven by the `baseRate`, `slope1`, `slope2`, `optimalU` and `reserveFactor`
 * props, so the numbers stay honest. Respects `prefers-reduced-motion` (the
 * marker jumps straight to the chosen `U` instead of gliding).
 */
export function UtilizationRateCurve({
  title = 'The interest-rate model',
  caption = 'Below the kink the borrow rate creeps up on a gentle slope; cross the optimal utilization and it leaps onto a steep one, making the last borrowers pay through the nose so utilization gets pushed back down. Suppliers earn the borrow rate times utilization, minus the reserve cut — so the supply curve always sits below the borrow curve and only matters when the pool is actually being used.',
  utilizationLabel = 'Utilization',
  borrowApyLabel = 'Borrow APR',
  supplyApyLabel = 'Supply APR',
  optimalLabel = 'Optimal utilization (kink)',
  borrowCurveLabel = 'Borrow APR',
  supplyCurveLabel = 'Supply APR',
  baseRate = 0,
  slope1 = 0.04,
  slope2 = 0.75,
  optimalU = 0.8,
  reserveFactor = 0.1,
  className,
}: UtilizationRateCurveProps) {
  const id = useId();
  const [uState, setUState] = useState(optimalU);
  // Animated marker position 0 → 1 along the path from U = 0 to the chosen U.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padY = 16;

  // Borrow rate at utilization u (kinked two-slope model).
  const borrowRate = (u: number): number =>
    u <= optimalU
      ? baseRate + (u / optimalU) * slope1
      : baseRate + slope1 + ((u - optimalU) / (1 - optimalU)) * slope2;

  // Supply rate: lenders earn the borrow rate only on the borrowed slice (U),
  // minus the protocol's reserve cut.
  const supplyRate = (u: number): number =>
    borrowRate(u) * u * (1 - reserveFactor);

  // x maps utilization u ∈ [0, 1] to pixels.
  const x = (u: number) => padX + u * (W - padX * 2);

  // Vertical range: the borrow curve peaks at U = 1.
  const vMax = borrowRate(1);
  const y = (v: number) =>
    padY + (1 - (vMax > 0 ? v / vMax : 0)) * (H - padY * 2);

  const SAMPLES = 120;
  const sample = (rate: (u: number) => number): string => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      d += `${i === 0 ? 'M' : 'L'} ${x(u)} ${y(rate(u))}`;
    }
    return d;
  };

  const borrowPath = sample(borrowRate);
  const supplyPath = sample(supplyRate);

  // Animate the marker from U = 0 toward the chosen U on each change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
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
  }, [uState]);

  const uAnim = uState * progress;
  const borrowNow = borrowRate(uState);
  const supplyNow = supplyRate(uState);

  const markerX = x(uAnim);
  const markerBorrowY = y(borrowRate(uAnim));
  const markerSupplyY = y(supplyRate(uAnim));

  const kinkX = x(optimalU);
  const uPct = Math.round(uState * 1000) / 10;

  const fmtPctBadge = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

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
          U {fmtPctBadge.format(uState * 100)}%
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {borrowCurveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {supplyCurveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0 border-l-2 border-dashed border-ink-200"
            aria-hidden="true"
          />
          {optimalLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. At ${pct(
          uState,
          0,
        )} utilization the borrow APR is ${pct(borrowNow)} and the supply APR is ${pct(
          supplyNow,
        )}. The slope steepens at the optimal utilization of ${pct(optimalU, 0)}.`}
      >
        {/* Horizontal baseline at rate 0 */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Dashed vertical guide at the optimal utilization (the kink) */}
        <line
          x1={kinkX}
          y1={padY}
          x2={kinkX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Supply-rate curve (accent) */}
        <path
          d={supplyPath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Borrow-rate curve (brand) */}
        <path
          d={borrowPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Vertical link from supply to borrow at the marker */}
        <line
          x1={markerX}
          y1={markerBorrowY}
          x2={markerX}
          y2={markerSupplyY}
          stroke="var(--color-ink-500)"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.2}
        />
        {/* Supply marker (on the accent curve) */}
        <circle
          cx={markerX}
          cy={markerSupplyY}
          r={5}
          fill="var(--color-surface)"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
        />
        {/* Borrow marker (on the brand curve) */}
        <circle cx={markerX} cy={markerBorrowY} r={6} fill="var(--color-brand-600)" />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-u`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{utilizationLabel}</span>
          <span className="font-mono text-ink-900">{pct(uState, 1)}</span>
        </label>
        <input
          id={`${id}-u`}
          type="range"
          min={0}
          max={1000}
          step={1}
          value={uPct * 10}
          onChange={(e) => setUState(Number(e.target.value) / 1000)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{utilizationLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(uState, 1)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{borrowApyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(borrowNow)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{supplyApyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{pct(supplyNow)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default UtilizationRateCurve;
