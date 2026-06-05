import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VarianceReductionChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + chip label for the plain Monte Carlo estimate. */
  naiveLabel?: string;
  /** Legend + chip label for the antithetic-variates estimate. */
  reducedLabel?: string;
  /** Label for the horizontal true-value reference line. */
  trueLabel?: string;
  /** X-axis label (sample count). */
  samplesLabel?: string;
  /** Prefix for the final absolute-error chips. */
  errorLabel?: string;
  /** Label for the reseed button. */
  runLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Estimand: E[exp(U)], U ~ Uniform(0,1). True value = e - 1.
const TRUE_VALUE = Math.E - 1; // ~= 1.71828
const N = 200; // number of sample steps drawn along the x-axis
// The estimand sits roughly in [1, 2.7]; frame the y-axis tightly around the
// true line so the convergence story is visible without clipping early noise.
const Y_MIN = 1.0;
const Y_MAX = 2.5;

// A running estimate is a sequence of partial means as the sample count grows.
interface Series {
  naive: number[]; // running mean of f(u_i)
  reduced: number[]; // running mean of (f(u_i) + f(1 - u_i)) / 2
}

const buildSeries = (): Series => {
  const naive: number[] = [];
  const reduced: number[] = [];
  let naiveSum = 0;
  let reducedSum = 0;
  for (let i = 0; i < N; i++) {
    const u = Math.random();
    naiveSum += Math.exp(u);
    // Antithetic pair: average the draw with its mirror 1 - u. For a monotonic
    // integrand the two are strongly negatively correlated, so the average has
    // far smaller variance than either draw alone.
    reducedSum += (Math.exp(u) + Math.exp(1 - u)) / 2;
    naive.push(naiveSum / (i + 1));
    reduced.push(reducedSum / (i + 1));
  }
  return { naive, reduced };
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/**
 * Monte Carlo convergence, with and without variance reduction. Two running
 * estimates of the same true quantity — E[exp(U)] for U ~ Uniform(0,1), whose
 * exact value is e − 1 ≈ 1.71828 — are drawn left-to-right as the sample count
 * N grows. The NAIVE curve plain-averages independent draws and wanders around
 * the true line (error shrinks only like 1/sqrt(N)). The ANTITHETIC curve pairs
 * every draw u with its mirror 1 − u; because exp is monotonic the pair is
 * strongly anti-correlated, so its running estimate hugs the true line far more
 * tightly. The chips report each method's final absolute error so the gap is
 * quantified. "Run again" reseeds with fresh randomness; the draw-on animation
 * respects prefers-reduced-motion (renders the final curves immediately).
 */
export function VarianceReductionChart({
  title = 'Variance reduction: same estimate, far less noise',
  naiveLabel = 'Naive Monte Carlo',
  reducedLabel = 'With antithetic variates',
  trueLabel = 'True value',
  samplesLabel = 'Samples',
  errorLabel = 'Error',
  runLabel = 'Run again',
  caption = 'Both curves estimate the same number, but antithetic pairing cancels most of the noise — its running estimate locks onto the true line while the naive average is still wandering.',
  className,
}: VarianceReductionChartProps) {
  const id = useId();
  const [series, setSeries] = useState<Series>(() => buildSeries());
  const [progress, setProgress] = useState(0); // 0 -> 1 draw-on fraction
  const [seed, setSeed] = useState(0); // bump to reseed
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 24;

  // Skip the first few samples on the x-axis: with N = 1 the running mean is a
  // single wild point that would dominate the y-range. Start at index 1.
  const xToPx = (i: number) =>
    padLeft + (i / (N - 1)) * (W - padLeft - padRight);
  const yToPx = (v: number) =>
    padTop +
    (1 - (clamp(v, Y_MIN, Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) *
      (H - padTop - padBottom);

  // Draw a polyline up to the current animation progress.
  const linePath = (values: number[]): string => {
    const last = Math.max(1, Math.floor(progress * (N - 1)));
    let d = '';
    for (let i = 1; i <= last; i++) {
      const px = xToPx(i);
      const py = yToPx(values[i]);
      d += `${i === 1 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
  };

  // (Re)seed and replay the draw-on animation whenever the seed changes.
  useEffect(() => {
    setSeries(buildSeries());
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [seed]);

  const trueY = yToPx(TRUE_VALUE);
  const naiveError = Math.abs(series.naive[N - 1] - TRUE_VALUE);
  const reducedError = Math.abs(series.reduced[N - 1] - TRUE_VALUE);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill"
            style={{ backgroundColor: 'var(--color-ink-400)' }}
            aria-hidden="true"
          />
          {naiveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
            aria-hidden="true"
          />
          {reducedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0.5 w-5"
            style={{ backgroundColor: 'var(--color-accent-600)' }}
            aria-hidden="true"
          />
          {trueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Two running Monte Carlo estimates of the same quantity, drawn as the sample count grows. The ${trueLabel} is ${TRUE_VALUE.toFixed(
          5,
        )}. The ${naiveLabel} curve ends with an absolute error of ${naiveError.toFixed(
          4,
        )}, while the ${reducedLabel} curve ends far tighter at ${reducedError.toFixed(
          4,
        )}.`}
      >
        {/* True-value reference line (solid) */}
        <line
          x1={padLeft}
          y1={trueY}
          x2={W - padRight}
          y2={trueY}
          stroke="var(--color-accent-600)"
          strokeWidth={2}
        />
        <text
          x={W - padRight}
          y={trueY - 5}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-accent-600)"
          textAnchor="end"
        >
          {trueLabel}
        </text>

        {/* Naive Monte Carlo running estimate (jittery) */}
        <path
          d={linePath(series.naive)}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Antithetic-variates running estimate (tight) */}
        <path
          d={linePath(series.reduced)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis baseline */}
        <line
          x1={padLeft}
          y1={H - padBottom}
          x2={W - padRight}
          y2={H - padBottom}
          stroke="var(--color-ink-200)"
        />

        {/* X-axis ticks: a few sample counts */}
        <text
          x={padLeft}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          0
        </text>
        <text
          x={xToPx((N - 1) / 2)}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {Math.round(N / 2)}
        </text>
        <text
          x={W - padRight}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="end"
        >
          {`${N} · ${samplesLabel}`}
        </text>
      </svg>

      {/* Final-error readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{`${errorLabel} · ${naiveLabel}`}</span>
          <span className="font-mono font-semibold text-ink-700">
            {naiveError.toFixed(4)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{`${errorLabel} · ${reducedLabel}`}</span>
          <span className="font-mono font-semibold text-brand-600">
            {reducedError.toFixed(4)}
          </span>
        </span>
      </div>

      {/* Reseed control */}
      <div className="mt-4">
        <button
          type="button"
          id={`${id}-run`}
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-200 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface hover:shadow-lift"
        >
          {runLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default VarianceReductionChart;
