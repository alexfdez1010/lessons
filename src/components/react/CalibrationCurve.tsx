import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CalibrationCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the favorite–longshot bias slider. */
  biasLabel?: string;
  /** Label for the price-bucket inspection slider. */
  bucketLabel?: string;
  /** Caption under the x-axis (market price). */
  xAxisLabel?: string;
  /** Caption beside the y-axis (actual win frequency). */
  yAxisLabel?: string;
  /** Legend label for the 45° perfect-calibration diagonal. */
  diagonalLabel?: string;
  /** Legend label for the realized-frequency curve. */
  curveLabel?: string;
  /** Readout label: the price the market charges. */
  pricedLabel?: string;
  /** Readout label: the long-run frequency the event actually occurs. */
  actualLabel?: string;
  /** Readout label: the over/under mispricing gap. */
  edgeLabel?: string;
  /** Classification: a longshot priced above its true frequency. */
  overpricedLabel?: string;
  /** Classification: a favorite priced below its true frequency. */
  underpricedLabel?: string;
  /** Classification: price ≈ frequency. */
  calibratedLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial bias on a 0–100 scale (0 = perfectly calibrated). Defaults to `55`. */
  bias?: number;
  /** Initial inspected price bucket as a percent (0–100). Defaults to `20`. */
  bucket?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value * 100)}%`;

const signedPts = (value: number): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(Math.abs(value * 100));
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatted} pts`;
};

/**
 * Interactive calibration plot (reliability diagram) for a prediction market.
 * The x-axis is the market-implied probability (the price); the y-axis is the
 * observed long-run frequency the event actually happened. A perfectly
 * calibrated market lies on the 45° diagonal — events priced at 30¢ occur ~30%
 * of the time. The bias slider bends the realized-frequency curve to show the
 * classic favorite–longshot bias: longshots (low prices) are *overpriced*
 * (they happen less often than priced, so the curve sags below the diagonal on
 * the left) while favorites (high prices) are mildly *underpriced* (the curve
 * lifts above the diagonal on the right). At bias = 0 the curve sits exactly on
 * the diagonal. The bucket slider picks a price and the readouts report
 * "priced at X% → actually happens Y%" plus the mispricing edge. The curve
 * animates in on every change and respects `prefers-reduced-motion`.
 */
export function CalibrationCurve({
  title = 'Calibration of a prediction market',
  biasLabel = 'Favorite–longshot bias',
  bucketLabel = 'Inspect price bucket',
  xAxisLabel = 'Market price = implied probability',
  yAxisLabel = 'Actual win frequency',
  diagonalLabel = 'Perfect calibration',
  curveLabel = "Market's realized frequency",
  pricedLabel = 'Priced at',
  actualLabel = 'Actually happens',
  edgeLabel = 'Edge',
  overpricedLabel = 'Overpriced longshot',
  underpricedLabel = 'Underpriced favorite',
  calibratedLabel = 'Well calibrated',
  caption = 'A market is calibrated when its prices tell the truth: things priced at 30¢ happen about 30% of the time, so the dots hug the diagonal. The favorite–longshot bias warps that line — bettors overpay for unlikely longshots (the curve sags low) and underpay for near-locks (it rises high). The gap between the curve and the diagonal is the edge waiting to be harvested.',
  bias = 55,
  bucket = 20,
  className,
}: CalibrationCurveProps) {
  const id = useId();
  const [biasState, setBiasState] = useState(bias);
  const [bucketState, setBucketState] = useState(bucket);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 360;
  const H = 360;
  const padL = 40;
  const padR = 16;
  const padTop = 16;
  const padBottom = 40;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;

  // Bias as a signed strength. 0 → perfectly calibrated diagonal.
  const strength = (biasState / 100) * 0.18;

  /**
   * Realized frequency f(x) for a market price x ∈ [0, 1]. The distortion
   * sin(2πx) is negative on (0, 0.5) — pulling low prices *below* the diagonal
   * (longshots overpriced) — and positive on (0.5, 1) — lifting high prices
   * *above* it (favorites underpriced) — with a slight asymmetry so favorites
   * deviate a touch less, as observed empirically. Pinned to (0,0) and (1,1).
   */
  const freq = (x: number): number => {
    const asym = 0.82; // favorites bend a little less than longshots
    const lift = x > 0.5 ? asym : 1;
    const distortion = strength * lift * Math.sin(2 * Math.PI * x);
    const v = x + distortion;
    return Math.min(1, Math.max(0, v));
  };

  // Coordinate transforms (y inverted: 0% at the bottom, 100% at the top).
  const xOf = (x: number) => padL + x * plotW;
  const yOf = (y: number) => padTop + (1 - y) * plotH;

  // Sampled binned dots sitting on the curve.
  const BINS = 8;
  const dots = Array.from({ length: BINS }, (_, i) => {
    const x = (i + 0.5) / BINS;
    return { x, y: freq(x) };
  });

  // Smooth polyline for the realized-frequency curve, revealed left→right.
  const SAMPLES = 120;
  const curvePath = (): string => {
    const upto = progress;
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const x = i / SAMPLES;
      if (x > upto) break;
      d += `${d === '' ? 'M' : ' L'} ${xOf(x).toFixed(2)} ${yOf(freq(x)).toFixed(2)}`;
    }
    return d;
  };

  // Animate the curve drawing in whenever a parameter changes.
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
      const prog = Math.min(1, (ts - startTs) / duration);
      setProgress(prog);
      if (prog < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [biasState]);

  // Inspected bucket.
  const priceX = bucketState / 100;
  const actualY = freq(priceX);
  const edge = actualY - priceX; // negative → overpriced; positive → underpriced
  const CALIBRATED_TOL = 0.012;

  type Verdict = 'over' | 'under' | 'ok';
  const verdict: Verdict =
    Math.abs(edge) <= CALIBRATED_TOL ? 'ok' : edge < 0 ? 'over' : 'under';

  const verdictLabel =
    verdict === 'over'
      ? overpricedLabel
      : verdict === 'under'
        ? underpricedLabel
        : calibratedLabel;

  const verdictAccent = verdict === 'ok';

  const ariaLabel = `${title}: with the favorite–longshot bias set to ${Math.round(
    biasState,
  )} out of 100, an event priced at ${pct(priceX)} actually happens about ${pct(
    actualY,
  )} of the time — ${
    verdict === 'over'
      ? 'an overpriced longshot'
      : verdict === 'under'
        ? 'an underpriced favorite'
        : 'a well-calibrated price'
  }.`;

  // Gridlines at every 25%.
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            verdictAccent ? 'bg-brand-600' : 'bg-accent-500',
          )}
        >
          {verdictLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-ink-300"
            aria-hidden="true"
          />
          {diagonalLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {curveLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto mt-3 w-full max-w-md"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot frame */}
        <rect
          x={padL}
          y={padTop}
          width={plotW}
          height={plotH}
          fill="var(--color-surface-sunken)"
          opacity={0.35}
          rx={6}
        />

        {/* Gridlines + axis ticks */}
        {grid.map((g) => (
          <g key={`grid-${g}`}>
            {/* vertical */}
            <line
              x1={xOf(g)}
              y1={padTop}
              x2={xOf(g)}
              y2={padTop + plotH}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            {/* horizontal */}
            <line
              x1={padL}
              y1={yOf(g)}
              x2={padL + plotW}
              y2={yOf(g)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            {/* x tick label */}
            <text
              x={xOf(g)}
              y={padTop + plotH + 14}
              textAnchor="middle"
              fill="var(--color-ink-500)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {Math.round(g * 100)}
            </text>
            {/* y tick label */}
            <text
              x={padL - 6}
              y={yOf(g) + 3}
              textAnchor="end"
              fill="var(--color-ink-500)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {Math.round(g * 100)}
            </text>
          </g>
        ))}

        {/* 45° perfect-calibration diagonal */}
        <line
          x1={xOf(0)}
          y1={yOf(0)}
          x2={xOf(1)}
          y2={yOf(1)}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Realized-frequency curve (animated reveal) */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Binned data dots on the curve */}
        {progress >= 1 &&
          dots.map((dot, i) => (
            <circle
              key={`dot-${i}`}
              cx={xOf(dot.x)}
              cy={yOf(dot.y)}
              r={4}
              fill="var(--color-brand-600)"
              stroke="var(--color-surface)"
              strokeWidth={1.5}
            />
          ))}

        {/* Inspected bucket guides */}
        <line
          x1={xOf(priceX)}
          y1={padTop}
          x2={xOf(priceX)}
          y2={padTop + plotH}
          stroke="var(--color-ink-400)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {/* Drop from curve point to the diagonal: the mispricing gap */}
        <line
          x1={xOf(priceX)}
          y1={yOf(actualY)}
          x2={xOf(priceX)}
          y2={yOf(priceX)}
          stroke={
            verdictAccent ? 'var(--color-brand-500)' : 'var(--color-accent-500)'
          }
          strokeWidth={2.5}
        />
        {/* Inspected point on the curve */}
        <circle
          cx={xOf(priceX)}
          cy={yOf(actualY)}
          r={6}
          fill={verdictAccent ? 'var(--color-brand-600)' : 'var(--color-accent-500)'}
          stroke="var(--color-surface)"
          strokeWidth={2}
        />

        {/* x-axis caption */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {xAxisLabel}
        </text>

        {/* y-axis caption (rotated) */}
        <text
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
          x={12}
          y={padTop + plotH / 2}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {yAxisLabel}
        </text>
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-bias`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{biasLabel}</span>
            <span className="font-mono text-ink-900">{Math.round(biasState)}</span>
          </label>
          <input
            id={`${id}-bias`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(biasState)}
            onChange={(e) => setBiasState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-bucket`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{bucketLabel}</span>
            <span className="font-mono text-ink-900">{Math.round(bucketState)}%</span>
          </label>
          <input
            id={`${id}-bucket`}
            type="range"
            min={2}
            max={98}
            step={1}
            value={Math.round(bucketState)}
            onChange={(e) => setBucketState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{pricedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(priceX)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{actualLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(actualY)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{edgeLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              verdictAccent ? 'text-ink-900' : 'text-accent-600',
            )}
          >
            {signedPts(edge)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CalibrationCurve;
