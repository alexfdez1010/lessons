import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ConvexityCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the yield-change (Δy) slider. */
  deltaLabel?: string;
  /** Readout label for the actual %price change read off the curve. */
  actualLabel?: string;
  /** Readout label for the duration-only estimate (−D·Δy). */
  durationEstLabel?: string;
  /** Readout label for the duration+convexity estimate. */
  convexityEstLabel?: string;
  /** Readout label for the error of the duration-only estimate. */
  errorLabel?: string;
  /** Legend label for the true convex price–yield curve. */
  curveLabel?: string;
  /** Legend label for the straight duration tangent line. */
  tangentLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Modified duration of the bond (years). Defaults to `7`. */
  modDuration?: number;
  /** Convexity of the bond. Defaults to `70`. */
  convexity?: number;
  /** Base yield as a fraction (e.g. 0.05 = 5%). Defaults to `0.05`. */
  baseYield?: number;
  /** Initial yield change Δy as a fraction (−0.03…0.03). Defaults to `0.02`. */
  delta?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number, digits = 2): string =>
  `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;

/**
 * Interactive duration-vs-convexity chart. The true bond price–yield
 * relationship is a convex curve; *duration* is just its straight tangent line
 * at the current yield. Drag the Δy slider and a marker rides the curve while a
 * second marker sits on the tangent — the shaded gap between them is the
 * convexity effect. Because the curve bows above its own tangent, duration
 * **overestimates losses** when yields rise and **underestimates gains** when
 * yields fall: convexity is good for the holder. Readouts give the actual
 * %price change (curve), the duration-only estimate (−D·Δy), the
 * duration+convexity estimate (−D·Δy + ½·C·Δy²) and the duration-only error.
 *
 * The curve is driven by `modDuration` and `convexity` via the standard
 * second-order price approximation, so the numbers stay honest and the curve is
 * genuinely convex. Respects `prefers-reduced-motion` (jumps to the final
 * marker position instead of animating).
 */
export function ConvexityCurve({
  title = 'Convexity corrects duration',
  deltaLabel = 'Yield change (Δy)',
  actualLabel = 'Actual Δprice (curve)',
  durationEstLabel = 'Duration only (−D·Δy)',
  convexityEstLabel = 'Duration + convexity',
  errorLabel = 'Duration-only error',
  curveLabel = 'True price (convex)',
  tangentLabel = 'Duration estimate (tangent)',
  caption = 'Duration is the straight tangent line. The real price–yield curve bows above it, so duration overstates losses when yields rise and understates gains when they fall. That gap is convexity — and it works in the holder’s favour.',
  modDuration = 7,
  convexity = 70,
  delta = 0.02,
  className,
}: ConvexityCurveProps) {
  const id = useId();
  const [dyState, setDyState] = useState(delta);
  // Animated marker position 0 → 1 along the path from base (0) to target Δy.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padY = 16;

  const DY_MAX = 0.03; // ±3% slider range / x-axis span

  // Fractional price change for a yield move dy (second-order approximation).
  const priceChange = (dy: number) => -modDuration * dy + 0.5 * convexity * dy * dy;
  const durationOnly = (dy: number) => -modDuration * dy;

  // x maps a yield change dy ∈ [−DY_MAX, DY_MAX] to pixels (left = yields down).
  const x = (dy: number) => padX + ((dy + DY_MAX) / (2 * DY_MAX)) * (W - padX * 2);

  // Vertical range covers both the curve and the tangent across the full span.
  const extremes = [
    priceChange(-DY_MAX),
    priceChange(DY_MAX),
    durationOnly(-DY_MAX),
    durationOnly(DY_MAX),
  ];
  const vMax = Math.max(...extremes);
  const vMin = Math.min(...extremes);
  const y = (v: number) =>
    padY + (1 - (v - vMin) / (vMax - vMin)) * (H - padY * 2);

  const SAMPLES = 90;
  const curvePath = (() => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const dy = -DY_MAX + (i / SAMPLES) * (2 * DY_MAX);
      d += `${i === 0 ? 'M' : 'L'} ${x(dy)} ${y(priceChange(dy))}`;
    }
    return d;
  })();

  const tangentPath = `M ${x(-DY_MAX)} ${y(durationOnly(-DY_MAX))} L ${x(DY_MAX)} ${y(
    durationOnly(DY_MAX),
  )}`;

  // Animate the marker from the base yield toward the chosen Δy on each change.
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
  }, [dyState]);

  const dyAnim = dyState * progress;
  const actual = priceChange(dyState);
  const durEst = durationOnly(dyState);
  const convEst = priceChange(dyState); // −D·Δy + ½·C·Δy² equals the curve value
  const error = durEst - actual; // signed: duration minus true price change

  const markerCurveX = x(dyAnim);
  const markerCurveY = y(priceChange(dyAnim));
  const markerTangentY = y(durationOnly(dyAnim));

  const baseX = x(0);
  const baseY = y(0);
  const dyPct = Math.round(dyState * 1000) / 10;

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
          D {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(modDuration)}
          {' · '}C {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(convexity)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {curveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {tangentLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. With modified duration ${modDuration} and convexity ${convexity}, a yield change of ${pct(
          dyState,
        )} moves the price ${pct(actual)} on the convex curve, while the duration-only tangent estimates ${pct(
          durEst,
        )} — an error of ${pct(error)}.`}
      >
        {/* Vertical guide at the base yield (Δy = 0) */}
        <line
          x1={baseX}
          y1={padY}
          x2={baseX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Horizontal zero-price-change baseline */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Straight duration tangent line */}
        <path d={tangentPath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />
        {/* True convex price–yield curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Convexity gap: vertical span between tangent and curve at the marker */}
        {Math.abs(dyAnim) > 1e-6 && (
          <line
            x1={markerCurveX}
            y1={markerCurveY}
            x2={markerCurveX}
            y2={markerTangentY}
            stroke="var(--color-ink-500)"
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.35}
          />
        )}
        {/* Tangent-point at the base yield */}
        <circle cx={baseX} cy={baseY} r={4} fill="var(--color-ink-500)" />
        {/* Duration estimate marker (on the tangent line) */}
        <circle
          cx={markerCurveX}
          cy={markerTangentY}
          r={5}
          fill="var(--color-surface)"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
        />
        {/* Actual-price marker (on the convex curve) */}
        <circle cx={markerCurveX} cy={markerCurveY} r={6} fill="var(--color-brand-600)" />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-dy`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{deltaLabel}</span>
          <span className="font-mono text-ink-900">{pct(dyState, 1)}</span>
        </label>
        <input
          id={`${id}-dy`}
          type="range"
          min={-30}
          max={30}
          step={1}
          value={dyPct * 10}
          onChange={(e) => setDyState(Number(e.target.value) / 1000)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{actualLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(actual)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{durationEstLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(durEst)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{convexityEstLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(convEst)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{errorLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{pct(error)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ConvexityCurve;
