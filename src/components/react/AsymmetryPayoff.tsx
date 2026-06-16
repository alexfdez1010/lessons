import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

type Shape = 'convex' | 'linear' | 'concave';

export interface AsymmetryPayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Segmented-control label for the convex (capped loss, open gain) shape. */
  convexLabel?: string;
  /** Segmented-control label for the linear (symmetric) shape. */
  linearLabel?: string;
  /** Segmented-control label for the concave (capped gain, open loss) shape. */
  concaveLabel?: string;
  /** Label for the outcome slider. */
  outcomeLabel?: string;
  /** Axis label for the payoff (vertical) dimension. */
  payoffLabel?: string;
  /** Readout label for the worst case (largest loss). */
  worstCaseLabel?: string;
  /** Readout label for the best case (largest gain). */
  bestCaseLabel?: string;
  /** Readout label for the payoff at the current outcome. */
  currentPayoffLabel?: string;
  /** Description shown under the chart when the convex shape is selected. */
  convexNote?: string;
  /** Description shown under the chart when the linear shape is selected. */
  linearNote?: string;
  /** Description shown under the chart when the concave shape is selected. */
  concaveNote?: string;
  /** Initial outcome as a fraction (-1..1). Defaults to `0.5`. */
  outcome?: number;
  /** Initial payoff shape. Defaults to `'convex'`. */
  shape?: Shape;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Max loss the convex bet (or max gain the concave bet) is clamped to. */
const FLOOR = 0.2;
/** Scales the accelerating leg so the open-ended side reaches ±1 at x = ±1. */
const ACCEL = 1;

/**
 * Payoff as a function of outcome `x` (in -1..1) for each shape.
 *
 * - convex  → downside clamped to a small floor (-FLOOR), upside accelerates (x²).
 *             A long-call / barbell: small known loss, large open-ended gain.
 * - linear  → payoff = x. Symmetric 45° line.
 * - concave → the mirror of convex: gains clamped to +FLOOR, losses accelerate.
 *             "Picking up pennies in front of a steamroller."
 */
const payoffOf = (shape: Shape, x: number): number => {
  if (shape === 'linear') return x;
  if (shape === 'convex') {
    return x >= 0 ? ACCEL * x * x : -FLOOR * (-x);
  }
  // concave
  return x <= 0 ? -ACCEL * x * x : FLOOR * x;
};

const pct = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

export function AsymmetryPayoff({
  title = 'Payoff asymmetry',
  caption = 'Prefer convex payoffs: a small, known downside and a large, open-ended upside. Avoid the mirror image — capped gains with an open trapdoor below.',
  convexLabel = 'Convex (capped loss, open gain)',
  linearLabel = 'Linear (symmetric)',
  concaveLabel = 'Concave (capped gain, open loss)',
  outcomeLabel = 'Outcome',
  payoffLabel = 'Payoff',
  worstCaseLabel = 'Worst case',
  bestCaseLabel = 'Best case',
  currentPayoffLabel = 'Payoff here',
  convexNote = 'The downside is bolted to a small floor while the upside curves away — you lose a little if wrong, win big if right.',
  linearNote = 'Symmetric: every unit of good outcome pays exactly what a bad outcome costs. No edge from the shape itself.',
  concaveNote = 'Gains are capped but losses accelerate without limit — picking up pennies in front of a steamroller.',
  outcome = 0.5,
  shape = 'convex',
  className,
}: AsymmetryPayoffProps) {
  const id = useId();
  const [shapeState, setShapeState] = useState<Shape>(shape);
  const [outcomeState, setOutcomeState] = useState(
    Math.min(1, Math.max(-1, outcome)),
  );
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 14;
  const padY = 16;

  // Payoff axis spans -1..1; map to SVG coords with zero in the middle.
  const x = (out: number) => padX + ((out + 1) / 2) * (W - padX * 2);
  const y = (p: number) => padY + (1 - (p + 1) / 2) * (H - padY * 2);

  const yZero = y(0);
  const xZero = x(0);

  // Sample the curve, revealing up to `progress` along the x-axis.
  const SAMPLES = 80;
  const curvePath = () => {
    const uptoX = -1 + progress * 2; // reveal from left edge rightward
    let d = `M ${x(-1)} ${y(payoffOf(shapeState, -1))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const out = -1 + (i / SAMPLES) * 2;
      if (out > uptoX) {
        d += ` L ${x(uptoX)} ${y(payoffOf(shapeState, uptoX))}`;
        break;
      }
      d += ` L ${x(out)} ${y(payoffOf(shapeState, out))}`;
    }
    return d;
  };

  // Animate the curve drawing in whenever the shape changes.
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
  }, [shapeState]);

  const currentPayoff = payoffOf(shapeState, outcomeState);
  const worstCase = payoffOf(shapeState, -1);
  const bestCase = payoffOf(shapeState, 1);
  const markX = x(outcomeState);
  const markY = y(currentPayoff);
  const outcomePct = Math.round(outcomeState * 100);

  const shapes: { key: Shape; label: string }[] = [
    { key: 'convex', label: convexLabel },
    { key: 'linear', label: linearLabel },
    { key: 'concave', label: concaveLabel },
  ];

  const noteFor = (s: Shape): string =>
    s === 'convex' ? convexNote : s === 'linear' ? linearNote : concaveNote;
  const labelFor = (s: Shape): string =>
    s === 'convex' ? convexLabel : s === 'linear' ? linearLabel : concaveLabel;

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
          {labelFor(shapeState)}
        </span>
      </figcaption>

      {/* Segmented control */}
      <div
        className="mt-4 inline-flex flex-wrap gap-1 rounded-pill border border-ink-100 bg-surface-sunken/40 p-1"
        role="group"
      >
        {shapes.map(({ key, label }) => {
          const active = shapeState === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setShapeState(key)}
              className={cx(
                'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${labelFor(shapeState)}. At an outcome of ${pct(
          outcomeState,
        )} the payoff is ${pct(currentPayoff)}. Worst case ${pct(
          worstCase,
        )}, best case ${pct(bestCase)}.`}
      >
        {/* Gain region (above zero) shaded subtly with brand */}
        <rect
          x={padX}
          y={padY}
          width={W - padX * 2}
          height={yZero - padY}
          fill="var(--color-brand-500)"
          opacity={0.06}
        />
        {/* Loss region (below zero) shaded subtly with accent */}
        <rect
          x={padX}
          y={yZero}
          width={W - padX * 2}
          height={H - padY - yZero}
          fill="var(--color-accent-500)"
          opacity={0.06}
        />
        {/* Zero payoff baseline (dashed) */}
        <line
          x1={padX}
          y1={yZero}
          x2={W - padX}
          y2={yZero}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Zero outcome vertical axis */}
        <line
          x1={xZero}
          y1={padY}
          x2={xZero}
          y2={H - padY}
          stroke="var(--color-ink-100)"
        />
        {/* Payoff curve, animated reveal */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Vertical guide line at current outcome */}
        <line
          x1={markX}
          y1={yZero}
          x2={markX}
          y2={markY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
        />
        {/* Marker dot at current outcome's payoff */}
        <circle
          cx={markX}
          cy={markY}
          r={6}
          fill="var(--color-brand-500)"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      </svg>

      {/* Outcome slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-outcome`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{outcomeLabel}</span>
          <span className="font-mono text-ink-900">{pct(outcomeState)}</span>
        </label>
        <input
          id={`${id}-outcome`}
          type="range"
          min={-100}
          max={100}
          step={1}
          value={outcomePct}
          onChange={(e) => setOutcomeState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{worstCaseLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(worstCase)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestCaseLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(bestCase)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {currentPayoffLabel} <span className="sr-only">{payoffLabel}</span>
          </dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(currentPayoff)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {noteFor(shapeState)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AsymmetryPayoff;
