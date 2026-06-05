import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VolatilityDragCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the arithmetic-mean slider. */
  meanLabel?: string;
  /** Label for the volatility slider. */
  volLabel?: string;
  /** Legend label for the compound-growth curve g(σ). */
  compoundLabel?: string;
  /** Legend label for the naive arithmetic-mean line. */
  meanLineLabel?: string;
  /** Legend label for the shaded drag wedge. */
  dragLabel?: string;
  /** Readout label for the arithmetic mean. */
  meanReadoutLabel?: string;
  /** Readout label for the chosen volatility. */
  volReadoutLabel?: string;
  /** Readout label for the realised compound growth. */
  growthReadoutLabel?: string;
  /** Readout label for the volatility drag. */
  dragReadoutLabel?: string;
  /** Annotation for the break-even volatility point. */
  breakEvenLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial arithmetic mean as a fraction (0–0.20). Defaults to `0.08`. */
  mean?: number;
  /** Initial volatility as a fraction (0–0.50). Defaults to `0.20`. */
  vol?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

/**
 * Interactive volatility-drag chart. It plots the geometric (compound) growth
 * rate g(σ) ≈ μ − σ²/2 against volatility σ for a fixed arithmetic mean μ. The
 * curve is a downward parabola: a horizontal dashed line marks the naive
 * arithmetic mean people expect to compound, and the curve sinks below it as
 * volatility rises. A draggable σ marker drops a vertical line to the realised
 * growth and shades the wedge between μ and g — the volatility drag (σ²/2). The
 * break-even volatility (where g = 0, σ = √(2μ)) is annotated when on-chart.
 * The curve animates in on mount and on every μ change; respects
 * `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function VolatilityDragCurve({
  title = 'Volatility eats growth',
  meanLabel = 'Arithmetic mean μ',
  volLabel = 'Volatility σ',
  compoundLabel = 'Compound growth g(σ)',
  meanLineLabel = 'Arithmetic mean μ',
  dragLabel = 'Volatility drag',
  meanReadoutLabel = 'Arithmetic mean μ',
  volReadoutLabel = 'Volatility σ',
  growthReadoutLabel = 'Compound growth g',
  dragReadoutLabel = 'Volatility drag',
  breakEvenLabel = 'break-even',
  caption = 'Two portfolios can share the same average return yet compound very differently. Every bit of volatility subtracts roughly σ²/2 from what you actually keep — that wedge is the volatility drag.',
  mean = 0.08,
  vol = 0.2,
  className,
}: VolatilityDragCurveProps) {
  const id = useId();
  const [meanState, setMeanState] = useState(mean);
  const [volState, setVolState] = useState(vol);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 14;
  const padY = 16;

  // Axis ranges. σ runs 0 → 50%; y runs from a small negative floor up past μ.
  const SIGMA_MAX = 0.5;
  const yTop = 0.2; // top of the y-axis (20% growth)
  const yBottom = -0.1; // bottom of the y-axis (−10% growth)

  const g = (sigma: number) => meanState - (sigma * sigma) / 2;

  const x = (sigma: number) => padX + (sigma / SIGMA_MAX) * (W - padX * 2);
  const y = (value: number) =>
    padY + (1 - (value - yBottom) / (yTop - yBottom)) * (H - padY * 2);

  const realisedG = g(volState);
  const drag = (volState * volState) / 2;
  const breakEvenSigma = Math.sqrt(2 * meanState);
  const breakEvenOnChart = breakEvenSigma <= SIGMA_MAX;

  // Parabola sampled finely, revealed left-to-right up to `progress`.
  const SAMPLES = 80;
  const curvePath = () => {
    const upto = progress * SIGMA_MAX;
    let d = `M ${x(0)} ${y(g(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const sigma = (i / SAMPLES) * SIGMA_MAX;
      if (sigma > upto) {
        d += ` L ${x(upto)} ${y(g(upto))}`;
        break;
      }
      d += ` L ${x(sigma)} ${y(g(sigma))}`;
    }
    return d;
  };

  // Animate the curve drawing in whenever the mean changes.
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
  }, [meanState]);

  const meanPct = Math.round(meanState * 100);
  const volPct = Math.round(volState * 100);
  const zeroY = y(0);

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
          {growthReadoutLabel}: {pct(realisedG)}
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
          {meanLineLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-5 rounded-sm bg-accent-500/25"
            aria-hidden="true"
          />
          {dragLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: with an arithmetic mean of ${meanPct}% and volatility of ${volPct}%, compound growth falls to ${pct(
          realisedG,
        )} — a volatility drag of ${pct(drag)}.`}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Naive arithmetic-mean horizontal line */}
        <line
          x1={padX}
          y1={y(meanState)}
          x2={W - padX}
          y2={y(meanState)}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        {/* Drag wedge: shaded gap between μ and g at the chosen σ */}
        <rect
          x={x(volState) - 6}
          y={y(meanState)}
          width={12}
          height={Math.max(0, y(realisedG) - y(meanState))}
          fill="var(--color-accent-500)"
          opacity={0.22}
        />
        {/* Vertical drop line from μ to realised g */}
        <line
          x1={x(volState)}
          y1={y(meanState)}
          x2={x(volState)}
          y2={y(realisedG)}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        {/* Compound-growth parabola, animated reveal */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Break-even marker where g = 0 */}
        {breakEvenOnChart && (
          <g>
            <circle
              cx={x(breakEvenSigma)}
              cy={zeroY}
              r={4}
              fill="var(--color-ink-700)"
            />
            <text
              x={x(breakEvenSigma)}
              y={zeroY - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-700)"
            >
              {breakEvenLabel}
            </text>
          </g>
        )}
        {/* Realised-g marker on the curve */}
        <circle
          cx={x(volState)}
          cy={y(realisedG)}
          r={5}
          fill="var(--color-brand-500)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-mean`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{meanLabel}</span>
            <span className="font-mono text-ink-900">{meanPct}%</span>
          </label>
          <input
            id={`${id}-mean`}
            type="range"
            min={0}
            max={20}
            step={1}
            value={meanPct}
            onChange={(e) => setMeanState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-vol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{volLabel}</span>
            <span className="font-mono text-ink-900">{volPct}%</span>
          </label>
          <input
            id={`${id}-vol`}
            type="range"
            min={0}
            max={50}
            step={1}
            value={volPct}
            onChange={(e) => setVolState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{meanReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(meanState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{volReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(volState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{growthReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(realisedG)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{dragReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(drag)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default VolatilityDragCurve;
