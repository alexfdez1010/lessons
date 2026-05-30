import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One selectable beta preset. */
interface BetaPreset {
  /** Display label for the toggle button. */
  label: string;
  /** Slope of the fitted line = market sensitivity. */
  beta: number;
}

export interface BetaScatterProps {
  /** Heading above the chart. */
  title?: string;
  /** X-axis label (market return per period). */
  marketAxisLabel?: string;
  /** Y-axis label (portfolio return per period). */
  portfolioAxisLabel?: string;
  /** Readout label for the slope. */
  betaLabel?: string;
  /** Readout label for the intercept. */
  alphaLabel?: string;
  /** Button label for the β≈0.5 preset. */
  defensiveLabel?: string;
  /** Button label for the β≈1.0 preset. */
  marketNeutralLabel?: string;
  /** Button label for the β≈1.5 preset. */
  aggressiveLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Plot geometry. Data domain is ±20% on both axes, origin centered.
const W = 520;
const H = 360;
const PAD = 36;
const DOMAIN = 22; // percent at each edge
const INNER_W = W - PAD * 2;
const INNER_H = H - PAD * 2;

// Map a data value (percent) to an SVG coordinate.
const sx = (v: number) => PAD + ((v + DOMAIN) / (DOMAIN * 2)) * INNER_W;
const sy = (v: number) => PAD + (1 - (v + DOMAIN) / (DOMAIN * 2)) * INNER_H;

// Fixed market-return x values spread across −20%…+20% (deterministic).
const MARKET_X = [-18, -14, -11, -8, -5, -2, 1, 4, 7, 10, 13, 16, 19];

// Deterministic, hydration-stable jitter per point (no Math.random).
const jitter = (i: number): number =>
  Math.sin(i * 1.7 + 0.6) * 2.4 + ((i % 3) - 1) * 1.1;

/**
 * Scatter + regression plot that makes alpha and beta visible.
 *
 * Each point is one period: market return on X, portfolio return on Y. A fitted
 * straight line runs through the cloud — its *slope is beta* (how hard the
 * portfolio swings with the market) and its *y-intercept is alpha* (the return
 * earned independent of the market). Toggle between Defensive (β≈0.5), Tracks
 * market (β≈1.0) and Aggressive (β≈1.5) to watch the line rotate, and flip the
 * alpha control to lift the whole line by +3%. Quadrant gridlines through the
 * origin show what the portfolio does when the market is up vs. down. The line
 * animates toward its new slope/intercept; `prefers-reduced-motion` snaps it.
 */
export function BetaScatter({
  title = 'Reading alpha and beta off the line',
  marketAxisLabel = 'Market return',
  portfolioAxisLabel = 'Portfolio return',
  betaLabel = 'Beta (slope)',
  alphaLabel = 'Alpha (intercept)',
  defensiveLabel = 'Defensive',
  marketNeutralLabel = 'Tracks market',
  aggressiveLabel = 'Aggressive',
  caption = 'Slope = beta (market sensitivity). Intercept = alpha (return above the market). A steeper line swings harder; lifting it adds skill.',
  className,
}: BetaScatterProps) {
  const presets: BetaPreset[] = [
    { label: defensiveLabel, beta: 0.5 },
    { label: marketNeutralLabel, beta: 1.0 },
    { label: aggressiveLabel, beta: 1.5 },
  ];

  const [presetIdx, setPresetIdx] = useState(1);
  const [alpha, setAlpha] = useState(0); // percent: 0 or +3
  // Animated line params interpolating toward the target preset/alpha.
  const [line, setLine] = useState({ beta: 1.0, alpha: 0 });
  const rafRef = useRef<number | null>(null);

  const targetBeta = presets[presetIdx].beta;
  const targetAlpha = alpha;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setLine({ beta: targetBeta, alpha: targetAlpha });
      return;
    }
    const duration = 480;
    let startTs: number | null = null;
    let from = { beta: 0, alpha: 0 };
    setLine((cur) => {
      from = cur;
      return cur;
    });
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setLine({
        beta: from.beta + (targetBeta - from.beta) * ease,
        alpha: from.alpha + (targetAlpha - from.alpha) * ease,
      });
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetBeta, targetAlpha]);

  // Points follow the *target* line so the cloud matches the chosen preset.
  const points = MARKET_X.map((mx, i) => ({
    mx,
    py: targetAlpha + targetBeta * mx + jitter(i),
  }));

  // Regression line endpoints (clamped to domain) using the animated params.
  const x1 = -DOMAIN;
  const x2 = DOMAIN;
  const y1 = line.alpha + line.beta * x1;
  const y2 = line.alpha + line.beta * x2;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p, i) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={i === presetIdx}
              onClick={() => setPresetIdx(i)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                i === presetIdx
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 text-ink-700 hover:border-ink-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </figcaption>

      {/* Alpha segmented control */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-ink-500">α:</span>
        <div className="inline-flex rounded-pill border border-ink-200 p-0.5">
          {[0, 3].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={alpha === a}
              onClick={() => setAlpha(a)}
              className={cx(
                'rounded-pill px-3 py-0.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                alpha === a ? 'bg-brand-600 text-white' : 'text-ink-700 hover:text-ink-900',
              )}
            >
              {a === 0 ? '0%' : '+3%'}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Scatter of portfolio return against market return. A fitted line runs through the points: its slope is beta (currently ${targetBeta.toFixed(1)}) and its y-intercept is alpha (currently ${targetAlpha >= 0 ? '+' : ''}${targetAlpha}%).`}
      >
        {/* Outer frame */}
        <rect
          x={PAD}
          y={PAD}
          width={INNER_W}
          height={INNER_H}
          fill="none"
          stroke="var(--color-ink-200)"
        />
        {/* Quadrant gridlines through the origin */}
        <line x1={sx(0)} y1={PAD} x2={sx(0)} y2={H - PAD} stroke="var(--color-ink-300)" />
        <line x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} stroke="var(--color-ink-300)" />
        {/* Faint helper grid at ±10% */}
        {[-10, 10].map((g) => (
          <g key={g}>
            <line x1={sx(g)} y1={PAD} x2={sx(g)} y2={H - PAD} stroke="var(--color-ink-200)" strokeDasharray="3 4" />
            <line x1={PAD} y1={sy(g)} x2={W - PAD} y2={sy(g)} stroke="var(--color-ink-200)" strokeDasharray="3 4" />
          </g>
        ))}

        {/* Regression line — slope is beta, intercept is alpha */}
        <line
          x1={sx(x1)}
          y1={sy(y1)}
          x2={sx(x2)}
          y2={sy(y2)}
          stroke="var(--color-accent-600)"
          strokeWidth={3.5}
          strokeLinecap="round"
        />

        {/* Scatter points */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={sx(pt.mx)}
            cy={sy(pt.py)}
            r={4}
            fill="var(--color-brand-500)"
          />
        ))}

        {/* Axis labels */}
        <text x={W - PAD} y={sy(0) - 8} textAnchor="end" fontSize={12} fill="var(--color-ink-500)">
          {marketAxisLabel} →
        </text>
        <text
          x={sx(0) + 8}
          y={PAD + 4}
          textAnchor="start"
          fontSize={12}
          fill="var(--color-ink-500)"
        >
          ↑ {portfolioAxisLabel}
        </text>
      </svg>

      {/* Readout */}
      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-ink-500">{betaLabel}</dt>
          <dd className="font-mono font-semibold text-accent-600">β = {targetBeta.toFixed(1)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-ink-500">{alphaLabel}</dt>
          <dd className="font-mono font-semibold text-brand-700">
            α = {targetAlpha >= 0 ? '+' : ''}
            {targetAlpha}%
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BetaScatter;
