import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ProbabilityWeightingProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Tversky–Kahneman curvature parameter γ. Defaults to `0.61`. */
  gamma?: number;
  /** Initial probability p (0–1). Defaults to `0.02`. */
  prob?: number;
  /** x-axis label. Defaults to `'Actual probability'`. */
  probLabel?: string;
  /** y-axis label. Defaults to `'Weight you actually give it'`. */
  weightLabel?: string;
  /** Legend label for the 45° identity line. */
  identityLabel?: string;
  /** Legend label for the weighting curve. */
  curveLabel?: string;
  /** Annotation for the low-p overweighting region. */
  overweightLabel?: string;
  /** Annotation for the high-p underweighting region. */
  underweightLabel?: string;
  /** Slider label. Defaults to `'Probability'`. */
  sliderLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tversky–Kahneman (1992) one-parameter decision-weight function. */
const weight = (p: number, gamma: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const pg = Math.pow(p, gamma);
  const qg = Math.pow(1 - p, gamma);
  return pg / Math.pow(pg + qg, 1 / gamma);
};

const pct = (v: number): string => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

/**
 * The prospect-theory probability-weighting curve. Plots the decision weight
 * w(p) = p^γ / (p^γ + (1−p)^γ)^(1/γ) against the 45° "rational" identity line
 * (w = p) over p ∈ [0, 1]. The curve is an inverse-S: it sits ABOVE the line for
 * small p (rare events feel bigger than they are) and BELOW it for moderate-to-
 * large p (likely events feel smaller). A slider sets p; the current point is
 * marked on both the curve and the identity line, the gap is drawn, and a live
 * readout reports w(p) and whether p is over- or under-weighted. Tokens only,
 * keyboard-operable, SSR-safe, respects `prefers-reduced-motion`.
 */
export function ProbabilityWeighting({
  title = 'How we really weight probabilities',
  caption = 'We do not act on raw odds — we act on a distorted weight. Tiny chances get inflated (lottery tickets, tail insurance); near-certainties get shaved down. The curve only meets the straight line of clear thinking at the extremes.',
  gamma = 0.61,
  prob = 0.02,
  probLabel = 'Actual probability',
  weightLabel = 'Weight you actually give it',
  identityLabel = 'Rational weighting (w = p)',
  curveLabel = 'How people really weight it',
  overweightLabel = 'Rare events feel bigger than they are',
  underweightLabel = 'Likely events feel smaller than they are',
  sliderLabel = 'Probability',
  className,
}: ProbabilityWeightingProps) {
  const id = useId();
  const [p, setP] = useState(prob);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 300;
  const padL = 16;
  const padR = 16;
  const padT = 16;
  const padB = 16;

  // Plot area maps p∈[0,1] → x, w∈[0,1] → y (flipped).
  const px = (prob01: number) => padL + prob01 * (W - padL - padR);
  const py = (w01: number) => padT + (1 - w01) * (H - padT - padB);

  const SAMPLES = 96;
  // Full weighting curve, revealed left-to-right up to `progress`.
  const curvePath = (() => {
    const upto = progress;
    let d = `M ${px(0)} ${py(weight(0, gamma))}`;
    for (let k = 1; k <= SAMPLES; k++) {
      const prob01 = k / SAMPLES;
      if (prob01 > upto) {
        d += ` L ${px(upto)} ${py(weight(upto, gamma))}`;
        break;
      }
      d += ` L ${px(prob01)} ${py(weight(prob01, gamma))}`;
    }
    return d;
  })();

  const identityPath = `M ${px(0)} ${py(0)} L ${px(1)} ${py(1)}`;

  // Animate the curve drawing in on mount and whenever γ changes.
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
      const prog = Math.min(1, (ts - startTs) / duration);
      setProgress(prog);
      if (prog < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [gamma]);

  const w = weight(p, gamma);
  const gap = w - p; // > 0 overweighted, < 0 underweighted
  const overweighted = gap > 0.005;
  const underweighted = gap < -0.005;
  const verdict = overweighted
    ? overweightLabel
    : underweighted
      ? underweightLabel
      : 'About right — weight roughly matches the odds here.';

  // Slider works in 0.1% steps so the rare-event tail is reachable.
  const sliderVal = Math.round(p * 1000);

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
          γ = {gamma.toFixed(2)}
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
          {identityLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: with the inverse-S weighting curve, a real probability of ${pct(
          p,
        )} is treated as if it were about ${pct(w)} — ${
          overweighted
            ? 'overweighted'
            : underweighted
              ? 'underweighted'
              : 'about right'
        }.`}
      >
        {/* Plot frame */}
        <rect
          x={px(0)}
          y={py(1)}
          width={px(1) - px(0)}
          height={py(0) - py(1)}
          fill="none"
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />
        {/* Identity line w = p */}
        <path
          d={identityPath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {/* Region annotations */}
        <text
          x={px(0.04)}
          y={py(0.42)}
          fontSize={11}
          fill="var(--color-success)"
          aria-hidden="true"
        >
          ↑ {overweightLabel}
        </text>
        <text
          x={px(0.52)}
          y={py(0.78)}
          fontSize={11}
          fill="var(--color-danger)"
          aria-hidden="true"
        >
          ↓ {underweightLabel}
        </text>
        {/* Weighting curve, animated reveal */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Current-point marks: gap, identity point, curve point */}
        {progress >= p && (
          <>
            <line
              x1={px(p)}
              y1={py(p)}
              x2={px(p)}
              y2={py(w)}
              stroke="var(--color-ink-300)"
              strokeDasharray="3 3"
            />
            <circle
              cx={px(p)}
              cy={py(p)}
              r={4}
              fill="var(--color-surface)"
              stroke="var(--color-accent-500)"
              strokeWidth={2}
            />
            <circle cx={px(p)} cy={py(w)} r={5} fill="var(--color-brand-600)" />
          </>
        )}
        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
          aria-hidden="true"
        >
          {probLabel} →
        </text>
        <text
          x={-H / 2}
          y={11}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
          aria-hidden="true"
        >
          {weightLabel} →
        </text>
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-prob`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sliderLabel}</span>
          <span className="font-mono text-ink-900">{pct(p)}</span>
        </label>
        <input
          id={`${id}-prob`}
          type="range"
          min={0}
          max={1000}
          step={1}
          value={sliderVal}
          onChange={(e) => setP(Number(e.target.value) / 1000)}
          aria-valuetext={pct(p)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{probLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(p)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{weightLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(w)}</dd>
        </div>
      </dl>

      <p
        className={cx(
          'mt-3 rounded-card border px-3 py-2 text-sm font-medium',
          overweighted && 'border-success/40 bg-success/10 text-success',
          underweighted && 'border-danger/40 bg-danger/10 text-danger',
          !overweighted &&
            !underweighted &&
            'border-ink-100 bg-surface-sunken/60 text-ink-700',
        )}
        aria-live="polite"
      >
        {verdict}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ProbabilityWeighting;
