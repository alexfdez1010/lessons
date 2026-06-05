import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface OutcomeFanProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the average-return slider. */
  returnLabel?: string;
  /** Label for the volatility slider. */
  volLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Chip label for the median terminal balance. */
  medianLabel?: string;
  /** Chip label for the pessimistic (10th percentile) terminal balance. */
  pessimisticLabel?: string;
  /** Chip label for the optimistic (90th percentile) terminal balance. */
  optimisticLabel?: string;
  /** X-axis label, e.g. "Years". */
  yearsLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const YEARS = 30;
const PATHS = 2000;
const INITIAL = 50_000; // starting balance
const CONTRIB = 6_000; // fixed annual contribution
const GOAL = 1_000_000; // success threshold

// Box–Muller: one standard-normal draw per call.
const randNormal = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

interface Summary {
  // For each year 0..YEARS, the cross-sectional percentiles across all paths.
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  terminalMedian: number;
  terminalP10: number;
  terminalP90: number;
  successProb: number;
}

const percentile = (sorted: number[], q: number): number => {
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
};

// Run PATHS trajectories and summarize them into a percentile fan.
const simulate = (meanReturn: number, vol: number): Summary => {
  // Wealth of every path at the current year; start everyone at INITIAL.
  let wealth = new Array<number>(PATHS).fill(INITIAL);

  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  const recordYear = () => {
    const sorted = wealth.slice().sort((a, b) => a - b);
    p10.push(percentile(sorted, 0.1));
    p25.push(percentile(sorted, 0.25));
    p50.push(percentile(sorted, 0.5));
    p75.push(percentile(sorted, 0.75));
    p90.push(percentile(sorted, 0.9));
  };

  recordYear(); // year 0
  for (let year = 1; year <= YEARS; year++) {
    for (let i = 0; i < PATHS; i++) {
      const r = meanReturn + vol * randNormal();
      wealth[i] = wealth[i] * (1 + r) + CONTRIB;
      if (wealth[i] < 0) wealth[i] = 0;
    }
    recordYear();
  }

  const terminal = wealth.slice().sort((a, b) => a - b);
  const successCount = wealth.reduce((acc, w) => acc + (w >= GOAL ? 1 : 0), 0);

  return {
    p10,
    p25,
    p50,
    p75,
    p90,
    terminalMedian: percentile(terminal, 0.5),
    terminalP10: percentile(terminal, 0.1),
    terminalP90: percentile(terminal, 0.9),
    successProb: successCount / PATHS,
  };
};

// Round to nearest thousand and group with thousands separators.
const fmt = (n: number): string =>
  (Math.round(n / 1000) * 1000).toLocaleString('en-US');

/**
 * Monte Carlo "cone of outcomes" for a long-horizon portfolio. We roll ~2000
 * wealth trajectories over 30 years, each year drawing an annual return from
 * N(meanReturn, vol) via Box–Muller and compounding an initial balance plus a
 * fixed contribution. At every year we take the cross-sectional p10/p25/p50/
 * p75/p90 across all paths and draw the classic widening fan: a light p10–p90
 * band, a darker p25–p75 band, and a solid median line. Sliders for average
 * return and volatility re-summarize live; "Resimulate" pulls fresh draws. The
 * fan sweeps in left-to-right on mount, respecting `prefers-reduced-motion`.
 */
export function OutcomeFan({
  title = 'The cone of retirement outcomes',
  returnLabel = 'Average return',
  volLabel = 'Volatility',
  resimulateLabel = 'Resimulate',
  medianLabel = 'Median outcome',
  pessimisticLabel = 'Unlucky (10th pct)',
  optimisticLabel = 'Lucky (90th pct)',
  yearsLabel = 'Years',
  caption = 'Identical assumptions still fan out into wildly different fortunes. The median is one story; the unlucky and lucky tails are the range you actually have to plan around. Crank up volatility and the cone flares wider.',
  className,
}: OutcomeFanProps) {
  const id = useId();
  const [meanReturn, setMeanReturn] = useState(0.06);
  const [vol, setVol] = useState(0.15);
  const [seed, setSeed] = useState(0); // bump to force fresh draws
  const [reveal, setReveal] = useState(1); // 0 → 1 left-to-right sweep
  const rafRef = useRef<number | null>(null);

  const summary = useMemo(
    () => simulate(meanReturn, vol),
    // seed forces a fresh Monte Carlo run with the same inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meanReturn, vol, seed],
  );

  const W = 520;
  const H = 240;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 14;
  const padBottom = 26;

  // Vertical scale fixed across resimulations for stable framing.
  const yMax = useMemo(() => {
    const top = summary.p90[summary.p90.length - 1];
    // Round up to a clean ceiling so the fan never clips.
    return Math.max(GOAL * 1.2, top * 1.05);
  }, [summary]);

  const xToPx = (year: number) =>
    padLeft + (year / YEARS) * (W - padLeft - padRight);
  const yToPx = (v: number) =>
    padTop + (1 - Math.min(1, v / yMax)) * (H - padTop - padBottom);

  // Number of year-columns to draw given the mount reveal (0 → 1).
  const shownYears = Math.max(1, Math.round(reveal * YEARS));

  // Build a filled band path between a lower and an upper percentile series.
  const bandPath = (lower: number[], upper: number[]): string => {
    let up = '';
    for (let y = 0; y <= shownYears; y++) {
      up += `${y === 0 ? 'M' : 'L'} ${xToPx(y).toFixed(2)} ${yToPx(upper[y]).toFixed(2)} `;
    }
    let down = '';
    for (let y = shownYears; y >= 0; y--) {
      down += `L ${xToPx(y).toFixed(2)} ${yToPx(lower[y]).toFixed(2)} `;
    }
    return `${up}${down}Z`;
  };

  const linePath = (series: number[]): string => {
    let d = '';
    for (let y = 0; y <= shownYears; y++) {
      d += `${y === 0 ? 'M' : 'L'} ${xToPx(y).toFixed(2)} ${yToPx(series[y]).toFixed(2)} `;
    }
    return d.trim();
  };

  // Mount animation: sweep the fan in from left to right.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setReveal(1);
      return;
    }
    setReveal(0);
    const duration = 800;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setReveal(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [seed]);

  const baseY = H - padBottom;
  const goalY = yToPx(GOAL);
  const meanText = `${(meanReturn * 100).toFixed(0)}%`;
  const volText = `${(vol * 100).toFixed(0)}%`;
  const successText = `${Math.round(summary.successProb * 100)}%`;

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
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {`${pessimisticLabel} – ${optimisticLabel}`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-0.5 bg-accent-600" aria-hidden="true" />
          {medianLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 border-l border-dashed border-ink-400"
            aria-hidden="true"
          />
          {`Goal`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A widening fan of simulated portfolio balances over ${YEARS} years at ${meanText} average return and ${volText} volatility. The median terminal balance is about ${fmt(summary.terminalMedian)}, the unlucky 10th percentile about ${fmt(summary.terminalP10)}, and the lucky 90th percentile about ${fmt(summary.terminalP90)}.`}
      >
        {/* Baseline (year axis) */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Outer band: p10 → p90 */}
        <path
          d={bandPath(summary.p10, summary.p90)}
          fill="var(--color-brand-500)"
          fillOpacity={0.14}
          stroke="none"
        />

        {/* Inner band: p25 → p75 */}
        <path
          d={bandPath(summary.p25, summary.p75)}
          fill="var(--color-brand-500)"
          fillOpacity={0.28}
          stroke="none"
        />

        {/* Goal threshold line (dashed) */}
        <line
          x1={padLeft}
          y1={goalY}
          x2={W - padRight}
          y2={goalY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Median (p50) line */}
        <path
          d={linePath(summary.p50)}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Axis ticks: start, middle, end years */}
        <text x={xToPx(0)} y={H - 8} fontSize={11} fill="var(--color-ink-700)" textAnchor="start">
          0
        </text>
        <text x={xToPx(YEARS / 2)} y={H - 8} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {`${Math.round(YEARS / 2)}`}
        </text>
        <text x={xToPx(YEARS)} y={H - 8} fontSize={11} fill="var(--color-ink-900)" textAnchor="end">
          {`${YEARS} ${yearsLabel}`}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{medianLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{fmt(summary.terminalMedian)}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{pessimisticLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{fmt(summary.terminalP10)}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{optimisticLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{fmt(summary.terminalP90)}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{`Reach goal`}</span>
          <span className="font-mono font-semibold text-accent-600">{successText}</span>
        </span>
      </div>

      {/* Average-return slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-ret`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{returnLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {meanText}
          </span>
        </label>
        <input
          id={`${id}-ret`}
          type="range"
          min={2}
          max={10}
          step={1}
          value={Math.round(meanReturn * 100)}
          onChange={(e) => setMeanReturn(Number(e.target.value) / 100)}
          aria-valuetext={`${meanText} ${returnLabel}`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      {/* Volatility slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-vol`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{volLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {volText}
          </span>
        </label>
        <input
          id={`${id}-vol`}
          type="range"
          min={5}
          max={25}
          step={1}
          value={Math.round(vol * 100)}
          onChange={(e) => setVol(Number(e.target.value) / 100)}
          aria-valuetext={`${volText} ${volLabel}`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      {/* Resimulate */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-200 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default OutcomeFan;
