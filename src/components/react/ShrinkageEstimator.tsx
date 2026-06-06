import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single asset with a noisy raw (MLE) estimate of its expected return. */
export interface ShrinkAsset {
  /** Display name (localized by the caller). */
  label: string;
  /** Raw / sample expected return as a decimal fraction (e.g. 0.18 = 18%). */
  raw: number;
}

export interface ShrinkageEstimatorProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the shrinkage-intensity slider w. */
  shrinkageLabel?: string;
  /** Label for the anchor toggle/marker. */
  anchorLabel?: string;
  /** Legend label for the raw (MLE) dots. */
  rawLabel?: string;
  /** Legend label for the shrunk dots. */
  shrunkLabel?: string;
  /** Readout label for the raw spread (max − min). */
  rawSpreadLabel?: string;
  /** Readout label for the shrunk spread (max − min). */
  shrunkSpreadLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Assets to plot. Defaults to a 5-asset set. */
  assets?: ShrinkAsset[];
  /** Initial shrinkage intensity w as a fraction (0–1). Defaults to `0.4`. */
  shrinkage?: number;
  /**
   * Anchor everything shrinks toward, as a decimal fraction. When omitted the
   * anchor is the grand mean (average raw across assets).
   */
  prior?: number;
  className?: string;
}

const DEFAULT_ASSETS: ShrinkAsset[] = [
  { label: 'Tech', raw: 0.18 },
  { label: 'Value', raw: 0.06 },
  { label: 'Bonds', raw: 0.02 },
  { label: 'Gold', raw: 0.09 },
  { label: 'EM', raw: -0.03 },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/**
 * Interactive shrinkage estimator (James–Stein / Black–Litterman intuition).
 * Each asset has a noisy raw sample estimate of its expected return plotted as a
 * dot on a number line. Shrinkage pulls every estimate toward a common anchor —
 * the grand mean across assets, or a fixed prior — by a factor w ∈ [0,1]:
 * shrunk_i = (1 − w)·raw_i + w·anchor. Raw dots (accent) connect to shrunk dots
 * (brand) by arrows that shorten as w rises; a dashed ink marker shows the
 * anchor. At w = 1 every shrunk dot collapses onto the anchor. Readouts compare
 * the raw vs shrunk spread (max − min) to show shrinkage compresses dispersion.
 * Dot positions animate smoothly when w changes; respects
 * `prefers-reduced-motion` (jumps straight to the target positions).
 */
export function ShrinkageEstimator({
  title = 'Shrinkage pulls noisy estimates toward the center',
  shrinkageLabel = 'Shrinkage intensity w',
  anchorLabel = 'Anchor (grand mean)',
  rawLabel = 'Raw estimate',
  shrunkLabel = 'Shrunk estimate',
  rawSpreadLabel = 'Raw spread',
  shrunkSpreadLabel = 'Shrunk spread',
  caption = 'Raw sample estimates are noisy: the wildly high and wildly low ones are mostly luck. Pulling every estimate toward a common anchor shrinks that noise and usually wins out-of-sample — watch the spread collapse as you turn up w.',
  assets = DEFAULT_ASSETS,
  shrinkage = 0.4,
  prior,
  className,
}: ShrinkageEstimatorProps) {
  const id = useId();
  const [wState, setWState] = useState(shrinkage);
  // Animated value of w used for dot positions (eases toward wState).
  const [wAnim, setWAnim] = useState(shrinkage);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 60 + assets.length * 34;
  const padX = 64;
  const padY = 26;

  // Axis range: −5% … +20%.
  const xMin = -0.05;
  const xMax = 0.2;
  const x = (value: number) =>
    padX + ((value - xMin) / (xMax - xMin)) * (W - padX * 2);

  const grandMean =
    assets.reduce((sum, a) => sum + a.raw, 0) / Math.max(1, assets.length);
  const anchor = prior ?? grandMean;

  const shrink = (raw: number, w: number) => (1 - w) * raw + w * anchor;

  // Spreads (max − min) of raw vs shrunk estimates at the live w.
  const rawValues = assets.map((a) => a.raw);
  const shrunkValues = assets.map((a) => shrink(a.raw, wState));
  const spread = (vals: number[]) =>
    vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  const rawSpread = spread(rawValues);
  const shrunkSpread = spread(shrunkValues);

  // Ease the animated w toward the target whenever the slider moves.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setWAnim(wState);
      return;
    }
    const from = wAnim;
    const to = wState;
    if (from === to) return;
    const duration = 450;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - p) * (1 - p); // ease-out quad
      setWAnim(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wState]);

  const wPct = Math.round(wState * 100);
  const arrowId = `${id}-arrow`;

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
          w = {wPct}%
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-full bg-accent-500"
            aria-hidden="true"
          />
          {rawLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-full bg-brand-500"
            aria-hidden="true"
          />
          {shrunkLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 bg-ink-500"
            aria-hidden="true"
            style={{ width: '2px', height: '0.9rem' }}
          />
          {anchorLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: at a shrinkage intensity of ${wPct}%, the spread of estimates falls from ${pct(
          rawSpread,
        )} (raw) to ${pct(shrunkSpread)} (shrunk), as every estimate is pulled toward an anchor of ${pct(
          anchor,
        )}.`}
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-brand-400)" />
          </marker>
        </defs>

        {/* Anchor vertical marker */}
        <line
          x1={x(anchor)}
          y1={padY - 10}
          x2={x(anchor)}
          y2={H - padY + 4}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={x(anchor)}
          y={padY - 14}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {pct(anchor)}
        </text>

        {/* Axis baseline */}
        <line
          x1={padX}
          y1={H - padY + 4}
          x2={W - padX}
          y2={H - padY + 4}
          stroke="var(--color-ink-200)"
        />
        {/* Axis ticks at xMin, anchor-region, xMax */}
        {[xMin, 0, xMax].map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              y1={H - padY + 2}
              x2={x(tick)}
              y2={H - padY + 8}
              stroke="var(--color-ink-300)"
            />
            <text
              x={x(tick)}
              y={H - padY + 20}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-400)"
            >
              {pct(tick)}
            </text>
          </g>
        ))}

        {/* One row per asset */}
        {assets.map((asset, i) => {
          const rowY = padY + 6 + i * 34;
          const rawX = x(asset.raw);
          const shrunkX = x(shrink(asset.raw, wAnim));
          const moved = Math.abs(shrunkX - rawX) > 6;
          return (
            <g key={`${asset.label}-${i}`}>
              {/* Asset label */}
              <text
                x={padX - 10}
                y={rowY + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--color-ink-600)"
              >
                {asset.label}
              </text>
              {/* Arrow raw → shrunk */}
              {moved && (
                <line
                  x1={rawX}
                  y1={rowY}
                  x2={shrunkX}
                  y2={rowY}
                  stroke="var(--color-brand-400)"
                  strokeWidth={1.5}
                  markerEnd={`url(#${arrowId})`}
                />
              )}
              {/* Raw dot */}
              <circle
                cx={rawX}
                cy={rowY}
                r={5}
                fill="var(--color-accent-500)"
                opacity={0.85}
              />
              {/* Shrunk dot */}
              <circle
                cx={shrunkX}
                cy={rowY}
                r={5}
                fill="var(--color-brand-500)"
                stroke="var(--color-surface, #fff)"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-w`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{shrinkageLabel}</span>
          <span className="font-mono text-ink-900">{wPct}%</span>
        </label>
        <input
          id={`${id}-w`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={wPct}
          onChange={(e) => setWState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-3 gap-3 text-sm"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{shrinkageLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {wPct}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{rawSpreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(rawSpread)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{shrunkSpreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(shrunkSpread)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ShrinkageEstimator;
