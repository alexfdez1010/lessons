import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MonteCarloConvergeProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the true-value reference line. */
  trueLabel?: string;
  /** Label/chip for the running estimate. */
  estimateLabel?: string;
  /** Label for the sample-count axis and readout. */
  samplesLabel?: string;
  /** Button that re-seeds and re-runs the simulation. */
  runLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TRUE_VALUE = Math.PI; // estimating pi via the quarter-circle dart method
const N_MAX = 2000; // total darts thrown
const POINTS = 200; // number of plotted samples along the run
const Y_MIN = 2.4;
const Y_MAX = 3.9;

interface Sample {
  n: number; // cumulative dart count
  est: number; // running estimate of pi
}

// Throw N_MAX darts at the unit square; record the running estimate at POINTS
// log-spaced checkpoints so early jitter and late convergence both show.
const simulate = (): Sample[] => {
  const checkpoints: number[] = [];
  for (let i = 1; i <= POINTS; i++) {
    const frac = i / POINTS;
    // log-ish spacing: denser early, sparser late, capped at N_MAX.
    const n = Math.max(1, Math.round(Math.pow(N_MAX, frac)));
    checkpoints.push(n);
  }

  const samples: Sample[] = [];
  let inside = 0;
  let thrown = 0;
  let next = 0;
  while (thrown < N_MAX && next < checkpoints.length) {
    const target = checkpoints[next];
    while (thrown < target) {
      const x = Math.random();
      const y = Math.random();
      if (x * x + y * y <= 1) inside++;
      thrown++;
    }
    samples.push({ n: thrown, est: (4 * inside) / thrown });
    next++;
  }
  // Ensure the final checkpoint reflects the full N_MAX run.
  if (samples.length === 0 || samples[samples.length - 1].n < N_MAX) {
    while (thrown < N_MAX) {
      const x = Math.random();
      const y = Math.random();
      if (x * x + y * y <= 1) inside++;
      thrown++;
    }
    samples.push({ n: thrown, est: (4 * inside) / thrown });
  }
  return samples;
};

/**
 * The Law of Large Numbers, made visual. We estimate pi by throwing random
 * darts at a unit square and counting the fraction landing inside the
 * quarter-circle (estimate = 4 x inside / total). As the sample count N grows
 * left-to-right, the running-estimate line homes in on the solid reference
 * line at the true value, and a faint 1/sqrt(N) error band narrows around it —
 * the same wobble that makes early estimates jumpy and late ones steady.
 * Press the button to re-seed with fresh draws. The line draws on over time,
 * respecting `prefers-reduced-motion` (renders the full converged curve at
 * once).
 */
export function MonteCarloConverge({
  title = 'Monte Carlo convergence: estimating a true value as samples grow',
  trueLabel = 'True value',
  estimateLabel = 'Estimate',
  samplesLabel = 'Samples',
  runLabel = 'Run again',
  caption = 'Each dart is a coin flip about geometry; one alone tells you little. Average enough of them and the running estimate is squeezed toward the true value, its wobble shrinking like one over the square root of the sample count.',
  className,
}: MonteCarloConvergeProps) {
  const id = useId();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [progress, setProgress] = useState(0); // 0 → 1 draw-on animation
  const [seed, setSeed] = useState(0); // bump to re-run
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 38;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 28;

  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // x maps the sample count on a log scale so early darts get room to wobble.
  const logMin = Math.log(1);
  const logMax = Math.log(N_MAX);
  const xToPx = (n: number) =>
    padLeft + ((Math.log(Math.max(1, n)) - logMin) / (logMax - logMin)) * plotW;
  const yToPx = (v: number) =>
    padTop + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

  // Re-seed and re-simulate whenever the seed bumps.
  useEffect(() => {
    setSamples(simulate());
  }, [seed]);

  // Draw-on animation: advance `progress` from 0 → 1 across the run.
  useEffect(() => {
    if (samples.length === 0) return;
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1600;
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
  }, [samples]);

  const baseY = H - padBottom;
  const trueY = yToPx(TRUE_VALUE);

  // How many sample points to reveal at the current progress.
  const shown = Math.max(1, Math.round(progress * samples.length));
  const visible = samples.slice(0, shown);

  const linePath = (): string => {
    let d = '';
    visible.forEach((s, i) => {
      const px = xToPx(s.n);
      const py = yToPx(s.est);
      d += `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    });
    return d.trim();
  };

  // Faint ±band that narrows like a constant over sqrt(N) around the true value.
  // (1.5 is a cosmetic width factor, not a confidence multiplier.)
  const bandHalf = (n: number) => 1.5 / Math.sqrt(Math.max(1, n));
  const bandPath = (): string => {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i <= POINTS; i++) {
      const frac = i / POINTS;
      const n = Math.max(1, Math.round(Math.pow(N_MAX, frac)));
      const px = xToPx(n);
      const half = bandHalf(n);
      top.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${yToPx(TRUE_VALUE + half).toFixed(2)}`);
      bottom.push(`L ${px.toFixed(2)} ${yToPx(TRUE_VALUE - half).toFixed(2)}`);
    }
    bottom.reverse();
    return `${top.join(' ')} ${bottom.join(' ')} Z`;
  };

  const current = visible[visible.length - 1] ?? { n: 0, est: 0 };
  const yTicks = [2.6, 3.14159, 3.6];

  const run = () => setSeed((s) => s + 1);

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
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {estimateLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-0.5 w-5 bg-accent-600" aria-hidden="true" />
          {trueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A running Monte Carlo estimate plotted against a growing sample count. The estimate starts jumpy and converges toward the ${trueLabel} reference line as the number of ${samplesLabel} grows to ${N_MAX}, with a shrinking error band.`}
      >
        {/* Y-axis grid + ticks */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padLeft}
              y1={yToPx(v)}
              x2={W - padRight}
              y2={yToPx(v)}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={yToPx(v) + 4}
              fontSize={11}
              fill="var(--color-ink-400)"
              textAnchor="end"
            >
              {v === 3.14159 ? '3.14' : v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Baseline (sample-count axis) */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Shrinking error band around the true value */}
        <path d={bandPath()} fill="var(--color-brand-500)" fillOpacity={0.1} stroke="none" />

        {/* True-value reference line (solid) */}
        <line
          x1={padLeft}
          y1={trueY}
          x2={W - padRight}
          y2={trueY}
          stroke="var(--color-accent-600)"
          strokeWidth={2}
        />

        {/* Running-estimate polyline */}
        <path
          d={linePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Leading dot at the current estimate */}
        <circle
          cx={xToPx(current.n)}
          cy={yToPx(current.est || TRUE_VALUE)}
          r={3.5}
          fill="var(--color-brand-500)"
        />

        {/* X-axis ticks: a few sample counts on the log scale */}
        {[1, 10, 100, 1000, N_MAX].map((n) => (
          <text
            key={n}
            x={xToPx(n)}
            y={H - 8}
            fontSize={11}
            fill="var(--color-ink-700)"
            textAnchor={n === 1 ? 'start' : n === N_MAX ? 'end' : 'middle'}
          >
            {n}
          </text>
        ))}
        <text
          x={padLeft + plotW / 2}
          y={H - 8}
          fontSize={11}
          fill="var(--color-ink-400)"
          textAnchor="middle"
        >
          {samplesLabel}
        </text>
      </svg>

      {/* Live readout chips */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{samplesLabel}</span>
          <span className="font-mono font-semibold text-brand-500">{current.n}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{estimateLabel}</span>
          <span className="font-mono font-semibold text-brand-500">
            {current.est ? current.est.toFixed(4) : '—'}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{trueLabel}</span>
          <span className="font-mono font-semibold text-accent-600">3.1416</span>
        </span>
        <button
          type="button"
          onClick={run}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-surface"
        >
          {runLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>

      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {`${samplesLabel}: ${current.n}. ${estimateLabel}: ${
          current.est ? current.est.toFixed(4) : ''
        }.`}
      </span>
    </figure>
  );
}

export default MonteCarloConverge;
