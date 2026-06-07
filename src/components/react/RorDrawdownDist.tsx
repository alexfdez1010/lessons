import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorDrawdownDistProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Label for the per-trade risk slider. */
  riskLabel?: string;
  /** x-axis label (maximum drawdown depth). */
  xAxisLabel?: string;
  /** y-axis label (share of simulated runs). */
  yAxisLabel?: string;
  /** Readout label preceding the median max-drawdown value. */
  medianLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial per-trade risk as a fraction. Defaults to 0.02. */
  risk?: number;
  /** Seed for the deterministic simulation. Defaults to 4242. */
  seed?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deterministic PRNG — mulberry32 (no Math.random).
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TRADES = 200;
const RUNS = 600;
const WIN_P = 0.5; // a fair, zero-edge system: drawdowns come purely from sequencing
const PAYOFF = 1; // even money — isolates the effect of risk-per-trade on drawdown

// Simulate one equity run, return its maximum fractional drawdown.
const simMaxDrawdown = (rand: () => number, risk: number): number => {
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (let i = 0; i < TRADES; i++) {
    const win = rand() < WIN_P;
    equity *= win ? 1 + risk * PAYOFF : 1 - risk;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
};

/**
 * Histogram of the MAXIMUM drawdown across many simulated equity curves of a
 * fixed-fraction, even-money (zero-edge) system. Because every run shares the
 * same statistics yet a different random order of wins and losses, max drawdown
 * is itself a random variable with a wide right-skewed distribution. The risk
 * slider scales every trade's stake, shifting the whole distribution deeper. A
 * median marker shows the typical worst drawdown; the long right tail shows the
 * rare-but-real catastrophic runs. Bars grow in on mount, respecting
 * prefers-reduced-motion. Deterministic via a seeded PRNG.
 */
export function RorDrawdownDist({
  title = 'The distribution of maximum drawdown',
  resimulateLabel = 'Resimulate',
  riskLabel = 'Risk per trade',
  xAxisLabel = 'Maximum drawdown reached',
  yAxisLabel = 'Share of runs',
  medianLabel = 'Median max drawdown',
  caption = 'Run the same system many times and its worst drawdown is never one number — it is a distribution. Most runs cluster near the median, but the long right tail is the rare run that nearly ends you. Raise risk-per-trade and the whole distribution slides deeper.',
  risk = 0.02,
  seed = 4242,
  className,
}: RorDrawdownDistProps) {
  const id = useId();
  const [riskPct, setRiskPct] = useState(Math.round(risk * 100));
  const [seedBump, setSeedBump] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const riskVal = riskPct / 100;
  const activeSeed = seed + seedBump * 1000;

  const { bins, median, binEdges } = useMemo(() => {
    const rand = mulberry32(activeSeed);
    const samples: number[] = [];
    for (let r = 0; r < RUNS; r++) samples.push(simMaxDrawdown(rand, riskVal));
    samples.sort((a, b) => a - b);
    const med = samples[Math.floor(samples.length / 2)];
    const NB = 24;
    const maxDd = Math.max(...samples, 0.05);
    const top = Math.min(1, maxDd * 1.05);
    const edges: number[] = [];
    for (let i = 0; i <= NB; i++) edges.push((top * i) / NB);
    const counts = new Array(NB).fill(0);
    for (const s of samples) {
      let bi = Math.floor((s / top) * NB);
      if (bi >= NB) bi = NB - 1;
      if (bi < 0) bi = 0;
      counts[bi]++;
    }
    return { bins: counts.map((c) => c / RUNS), median: med, binEdges: edges };
  }, [riskVal, activeSeed]);

  const W = 560;
  const H = 250;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 34;
  const maxBin = Math.max(...bins, 0.01);
  const top = binEdges[binEdges.length - 1];

  const xToPx = (v: number) => padLeft + (v / top) * (W - padLeft - padRight);
  const yToPx = (h: number) => padTop + (1 - h / maxBin) * (H - padTop - padBottom);
  const baseY = H - padBottom;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(1 - (1 - t) * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [bins]);

  const medX = xToPx(median);

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
          {medianLabel}: {Math.round(median * 100)}%
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Histogram of maximum drawdown across ${RUNS} simulated runs at ${riskPct} percent risk per trade. The median worst drawdown is about ${Math.round(median * 100)} percent, with a long right tail of deeper runs.`}
      >
        <line x1={padLeft} y1={baseY} x2={W - padRight} y2={baseY} stroke="var(--color-ink-200)" />

        {bins.map((h, i) => {
          const x0 = xToPx(binEdges[i]);
          const x1 = xToPx(binEdges[i + 1]);
          const fullH = baseY - yToPx(h);
          const drawH = fullH * progress;
          return (
            <rect
              key={i}
              x={x0 + 1}
              y={baseY - drawH}
              width={Math.max(1, x1 - x0 - 1.5)}
              height={drawH}
              fill="var(--color-brand-400)"
              opacity={0.9}
            />
          );
        })}

        {/* Median marker */}
        <line x1={medX} y1={padTop} x2={medX} y2={baseY} stroke="var(--color-accent-500)" strokeWidth={2} strokeDasharray="5 4" />

        {/* x ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) =>
          v <= top + 1e-9 ? (
            <text key={v} x={xToPx(v)} y={baseY + 14} fontSize={10} fill="var(--color-ink-500)" textAnchor="middle">
              {`${Math.round(v * 100)}%`}
            </text>
          ) : null,
        )}
        <text x={(padLeft + W - padRight) / 2} y={H - 4} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {xAxisLabel}
        </text>
        <text
          x={12}
          y={(padTop + baseY) / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${(padTop + baseY) / 2})`}
        >
          {yAxisLabel}
        </text>
      </svg>

      <div className="mt-4">
        <label htmlFor={`${id}-risk`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{riskLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {riskPct}%
          </span>
        </label>
        <input
          id={`${id}-risk`}
          type="range"
          min={1}
          max={8}
          step={1}
          value={riskPct}
          onChange={(e) => setRiskPct(Number(e.target.value))}
          aria-valuetext={`${riskPct} percent risk per trade`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeedBump((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RorDrawdownDist;
