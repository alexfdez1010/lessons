import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ValueFunctionCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Loss-aversion coefficient λ. Defaults to `2.25`. */
  lossAversion?: number;
  /** Curvature exponent (same for gains and losses). Defaults to `0.88`. */
  alpha?: number;
  /** Initial slider amount in objective units. Defaults to `100`. */
  amount?: number;
  /** Slider maximum. Defaults to `200`. */
  maxAmount?: number;
  /** Currency / unit symbol prefixed to amounts. Defaults to `'$'`. */
  unit?: string;
  /** x-axis label. Defaults to `'Objective gain or loss'`. */
  gainAxisLabel?: string;
  /** y-axis label. Defaults to `'Value you actually feel'`. */
  valueAxisLabel?: string;
  /** Origin label. Defaults to `'Reference point'`. */
  referenceLabel?: string;
  /** Slider label. Defaults to `'Amount at stake'`. */
  amountLabel?: string;
  /** Readout label for the gain side. Defaults to `'A gain this size feels like…'`. */
  gainFeelsLabel?: string;
  /** Readout label for the loss side. Defaults to `'An equal loss feels like…'`. */
  lossFeelsLabel?: string;
  /** Template for the felt-ratio sentence. `{x}` is the ratio to 1 decimal. */
  ratioTemplate?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (unit: string, value: number): string =>
  `${unit}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

/**
 * The prospect-theory value function. An S-shaped curve runs through a reference
 * point at the origin: concave for gains, convex AND steeper for losses — so the
 * same objective amount feels worse lost than it feels good won. A slider sets the
 * amount at stake; the chart marks v(+x) and v(−x) for that amount and reports, in
 * words, that the loss stings about λ× as much as the equal gain. Math:
 * gains v = amount^alpha; losses v = −lossAversion · amount^alpha. The curve draws
 * in on mount/changes, but jumps straight to its final state under
 * `prefers-reduced-motion`. Locale-agnostic (all strings are props) and SSR-safe.
 */
export function ValueFunctionCurve({
  title = 'Losses loom larger than gains',
  caption = 'The curve bends gently for gains but plunges for losses — and it plunges further than it ever climbs. That asymmetry is loss aversion: an equal loss hurts more than the matching gain pleases.',
  lossAversion = 2.25,
  alpha = 0.88,
  amount = 100,
  maxAmount = 200,
  unit = '$',
  gainAxisLabel = 'Objective gain or loss',
  valueAxisLabel = 'Value you actually feel',
  referenceLabel = 'Reference point',
  amountLabel = 'Amount at stake',
  gainFeelsLabel = 'A gain this size feels like…',
  lossFeelsLabel = 'An equal loss feels like…',
  ratioTemplate = 'The loss stings about {x}× as much as the gain.',
  className,
}: ValueFunctionCurveProps) {
  const id = useId();
  const [amountState, setAmountState] = useState(amount);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 300;
  const padX = 16;
  const padY = 16;

  // Objective value functions.
  const gainV = (x: number) => Math.pow(x, alpha); // x ≥ 0
  const lossV = (x: number) => -lossAversion * Math.pow(x, alpha); // x ≥ 0, returns negative

  // Vertical scale: the deepest the curve reaches is the loss at maxAmount.
  const vMax = gainV(maxAmount); // top of gain side
  const vMin = lossV(maxAmount); // bottom of loss side (negative)

  // Screen mapping. Origin sits where x = 0 and v = 0.
  const x = (objective: number) =>
    padX + ((objective + maxAmount) / (2 * maxAmount)) * (W - padX * 2);
  const y = (v: number) =>
    padY + ((vMax - v) / (vMax - vMin)) * (H - padY * 2);

  const x0 = x(0);
  const y0 = y(0);

  // Felt values for the current amount.
  const gainFelt = gainV(amountState);
  const lossFelt = lossV(amountState); // negative
  const ratio = lossAversion; // |lossV| / gainV = lossAversion for equal x
  const ratioText = ratioTemplate.replace('{x}', ratio.toFixed(1));

  // Build the full S-curve as a path over [−maxAmount, +maxAmount], revealed
  // outward from the origin up to `progress`.
  const SAMPLES = 90;
  const curvePath = () => {
    const reach = progress * maxAmount; // how far out (each side) is drawn
    // Loss branch: from −reach up to 0.
    let d = '';
    let started = false;
    for (let k = -SAMPLES; k <= SAMPLES; k++) {
      const obj = (k / SAMPLES) * maxAmount;
      if (Math.abs(obj) > reach && obj < 0) continue; // not yet drawn on loss side
      if (obj > reach) break; // stop on gain side once past the reveal
      const v = obj >= 0 ? gainV(obj) : lossV(-obj);
      const px = x(obj);
      const py = y(v);
      d += `${started ? ' L' : 'M'} ${px.toFixed(2)} ${py.toFixed(2)}`;
      started = true;
    }
    return d;
  };

  // Animate the curve drawing in whenever the shape inputs change.
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
  }, [lossAversion, alpha, maxAmount]);

  const markersVisible = progress * maxAmount >= amountState;

  // Marker screen coordinates.
  const gx = x(amountState);
  const gy = y(gainFelt);
  const lx = x(-amountState);
  const ly = y(lossFelt);

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
          λ ≈ {lossAversion.toFixed(2)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: a gain of ${money(unit, amountState)} feels like ${gainFelt.toFixed(
          0,
        )} units of value, but losing the same ${money(
          unit,
          amountState,
        )} feels like ${Math.abs(lossFelt).toFixed(
          0,
        )} units — about ${ratio.toFixed(1)} times as strong.`}
      >
        {/* Axes through the reference point (origin). */}
        <line
          x1={padX}
          y1={y0}
          x2={W - padX}
          y2={y0}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <line
          x1={x0}
          y1={padY}
          x2={x0}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          aria-hidden="true"
        />

        {/* Axis labels. */}
        <text
          x={W - padX}
          y={y0 - 8}
          textAnchor="end"
          className="fill-ink-500"
          style={{ fontSize: '12px' }}
        >
          {gainAxisLabel} →
        </text>
        <text
          x={x0 + 8}
          y={padY + 4}
          textAnchor="start"
          className="fill-ink-500"
          style={{ fontSize: '12px' }}
        >
          ↑ {valueAxisLabel}
        </text>
        <text
          x={x0 + 6}
          y={y0 + 16}
          textAnchor="start"
          className="fill-ink-500"
          style={{ fontSize: '12px' }}
        >
          {referenceLabel}
        </text>

        {/* The value-function curve. */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Reference-point dot at the origin. */}
        <circle cx={x0} cy={y0} r={4} fill="var(--color-ink-400)" aria-hidden="true" />

        {markersVisible && (
          <>
            {/* Gain marker: dashed guide to the curve. */}
            <line
              x1={gx}
              y1={y0}
              x2={gx}
              y2={gy}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <line
              x1={x0}
              y1={gy}
              x2={gx}
              y2={gy}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <circle cx={gx} cy={gy} r={5.5} fill="var(--color-success)" />

            {/* Loss marker: dashed guide to the (deeper) curve. */}
            <line
              x1={lx}
              y1={y0}
              x2={lx}
              y2={ly}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <line
              x1={x0}
              y1={ly}
              x2={lx}
              y2={ly}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <circle cx={lx} cy={ly} r={5.5} fill="var(--color-danger)" />
          </>
        )}
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-amount`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{amountLabel}</span>
          <span className="font-mono text-ink-900">{money(unit, amountState)}</span>
        </label>
        <input
          id={`${id}-amount`}
          type="range"
          min={0}
          max={maxAmount}
          step={1}
          value={amountState}
          onChange={(e) => setAmountState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gainFeelsLabel}</dt>
          <dd
            className="font-mono text-lg font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            +{gainFelt.toFixed(0)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lossFeelsLabel}</dt>
          <dd
            className="font-mono text-lg font-semibold"
            style={{ color: 'var(--color-danger)' }}
          >
            {lossFelt.toFixed(0)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm font-medium text-ink-800" aria-live="polite">
        {ratioText}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ValueFunctionCurve;
