import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EnsembleTimeFanProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the reseed button. */
  rerunLabel?: string;
  /** Legend + readout label for the ensemble-mean line. */
  meanLabel?: string;
  /** Legend + readout label for the median (typical player) line. */
  medianLabel?: string;
  /** Label for the ensemble growth-per-round readout. */
  ensembleRateLabel?: string;
  /** Label for the time-average growth-per-round readout. */
  timeRateLabel?: string;
  /** X-axis label, e.g. "Rounds". */
  roundsLabel?: string;
  /** Y-axis label, e.g. "Wealth". */
  wealthLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Number of rounds (x-axis length). Defaults to `100`. */
  rounds?: number;
  /** Number of parallel trajectories drawn. Defaults to `150`. */
  players?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The multiplicative gamble: heads ×1.5 (+50%), tails ×0.6 (−40%), fair coin.
const UP = 1.5;
const DOWN = 0.6;
const INITIAL = 100; // everyone starts with $100
// Ensemble (arithmetic) expected factor per round: 0.5·1.5 + 0.5·0.6 = 1.05.
const ENSEMBLE_FACTOR = 0.5 * UP + 0.5 * DOWN; // 1.05  → +5%/round
// Time-average (geometric) factor: √(1.5·0.6) = √0.9 ≈ 0.9487 → −5.13%/round.
const TIME_FACTOR = Math.sqrt(UP * DOWN);

// Mulberry32: tiny deterministic PRNG so paths are stable on the server and on
// hydration, and only change when the user reseeds. Never Math.random() at
// render time (that would desync SSR ↔ client and hydrate to a flicker).
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

interface Sim {
  // Per-player wealth at every round 0..rounds. paths[i][round].
  paths: number[][];
  // Cross-sectional ensemble mean at each round.
  mean: number[];
  // Cross-sectional median at each round.
  median: number[];
  // Indices of the 2–3 luckiest terminal trajectories (the mean-draggers).
  rockets: number[];
  finalMean: number;
  finalMedian: number;
  yMin: number;
  yMax: number;
}

const median = (sorted: number[]): number => {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// Roll `players` multiplicative trajectories over `rounds` and summarize.
const simulate = (rounds: number, players: number, seed: number): Sim => {
  const rng = mulberry32(seed * 2654435761 + 1);

  const paths: number[][] = [];
  for (let i = 0; i < players; i++) {
    const series = new Array<number>(rounds + 1);
    series[0] = INITIAL;
    let w = INITIAL;
    for (let r = 1; r <= rounds; r++) {
      w *= rng() < 0.5 ? UP : DOWN;
      series[r] = w;
    }
    paths.push(series);
  }

  const mean: number[] = [];
  const med: number[] = [];
  for (let r = 0; r <= rounds; r++) {
    let sum = 0;
    const col = new Array<number>(players);
    for (let i = 0; i < players; i++) {
      const v = paths[i][r];
      sum += v;
      col[i] = v;
    }
    mean.push(sum / players);
    col.sort((a, b) => a - b);
    med.push(median(col));
  }

  // The 3 luckiest terminal paths — these are the rare rockets that drag the
  // arithmetic mean up while everyone else sinks.
  const terminalOrder = paths
    .map((p, i) => ({ i, v: p[rounds] }))
    .sort((a, b) => b.v - a.v);
  const rockets = terminalOrder.slice(0, 3).map((o) => o.i);

  // Log-axis bounds. Floor at a small positive value so a wiped-out path still
  // plots (log10(0) is −∞). Ceiling tracks the luckiest path + the mean line.
  let maxV = INITIAL;
  let minV = INITIAL;
  for (let i = 0; i < players; i++) {
    for (let r = 0; r <= rounds; r++) {
      const v = paths[i][r];
      if (v > maxV) maxV = v;
      if (v > 0 && v < minV) minV = v;
    }
  }
  for (let r = 0; r <= rounds; r++) if (mean[r] > maxV) maxV = mean[r];
  const floor = Math.max(1e-6, minV * 0.5);

  return {
    paths,
    mean,
    median: med,
    rockets,
    finalMean: mean[rounds],
    finalMedian: med[rounds],
    yMin: floor,
    yMax: maxV * 1.15,
  };
};

const money = (prefix: string, value: number): string => {
  if (value >= 1000) {
    return `${prefix}${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      notation: value >= 1_000_000 ? 'compact' : 'standard',
    }).format(value)}`;
  }
  if (value >= 1) {
    return `${prefix}${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(value)}`;
  }
  // Sub-dollar: show enough precision to see the crash toward zero.
  return `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}`;
};

const ratePct = (factor: number): string => {
  const r = (factor - 1) * 100;
  return `${r >= 0 ? '+' : '−'}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(Math.abs(r))}%`;
};

/**
 * Ergodicity, made visible: the gap between the ensemble average and a single
 * lived trajectory. We roll ~150 parallel players through a multiplicative
 * gamble — each round wealth ×1.5 on heads (+50%) or ×0.6 on tails (−40%) on a
 * fair coin. The *ensemble* expected value grows +5%/round (0.5·1.5+0.5·0.6 =
 * 1.05), so the cross-sectional MEAN line climbs. But the *time-average* growth
 * for any one path is the geometric mean √(1.5·0.6) ≈ 0.9487 → about −5.1%/round,
 * so the MEDIAN line crashes toward zero and almost every individual goes broke.
 * On a log-scaled y-axis the thin trajectory fan sinks while a handful of
 * highlighted "rocket" paths shoot up and single-handedly haul the mean upward —
 * the lucky few nobody actually is. "Re-run" reseeds a deterministic PRNG (no
 * Math.random at render → SSR-safe). The fan sweeps in left-to-right on mount,
 * respecting `prefers-reduced-motion` (jumps straight to the final state).
 */
export function EnsembleTimeFan({
  title = 'The average is a place nobody lives',
  rerunLabel = 'Re-run',
  meanLabel = 'Average across players (ensemble)',
  medianLabel = 'Typical player (median)',
  ensembleRateLabel = 'Ensemble growth / round',
  timeRateLabel = 'Time-average growth / round',
  roundsLabel = 'Rounds',
  wealthLabel = 'Wealth',
  currencyPrefix = '$',
  caption = 'Each round your money is multiplied by 1.5 on heads or 0.6 on tails — a fair coin. The crowd-average climbs +5% a round, but that average is propped up by a few absurdly lucky paths. The player in the middle loses about 5% a round and drifts toward broke. Positive expected value is not the same as positive growth: you live one trajectory, not the average across parallel universes.',
  rounds = 100,
  players = 150,
  className,
}: EnsembleTimeFanProps) {
  const id = useId();
  // Seed lives in state, initialized deterministically. Reseed only on click.
  const [seed, setSeed] = useState(1);
  const [reveal, setReveal] = useState(1); // 0 → 1 left-to-right sweep
  const rafRef = useRef<number | null>(null);

  const sim = useMemo(
    () => simulate(rounds, players, seed),
    [rounds, players, seed],
  );

  const W = 520;
  const H = 260;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 16;
  const padBottom = 28;

  // Log10 scale on the y-axis — wealth spans many orders of magnitude.
  const logMin = Math.log10(sim.yMin);
  const logMax = Math.log10(sim.yMax);
  const xToPx = (round: number) =>
    padLeft + (round / rounds) * (W - padLeft - padRight);
  const yToPx = (v: number) => {
    const clamped = Math.max(sim.yMin, v);
    const t = (Math.log10(clamped) - logMin) / (logMax - logMin || 1);
    return padTop + (1 - t) * (H - padTop - padBottom);
  };

  // Number of round-columns to draw given the mount reveal (0 → 1).
  const shownRounds = Math.max(1, Math.round(reveal * rounds));

  const linePath = (series: number[]): string => {
    let d = '';
    for (let r = 0; r <= shownRounds; r++) {
      d += `${r === 0 ? 'M' : 'L'} ${xToPx(r).toFixed(2)} ${yToPx(series[r]).toFixed(2)} `;
    }
    return d.trim();
  };

  const rocketSet = useMemo(() => new Set(sim.rockets), [sim]);

  // Mount / reseed animation: sweep the fan in from left to right.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setReveal(1);
      return;
    }
    setReveal(0);
    const duration = 1000;
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

  // The baseline ($100 start) as a reference gridline.
  const startY = yToPx(INITIAL);
  const meanText = money(currencyPrefix, sim.finalMean);
  const medianText = money(currencyPrefix, sim.finalMedian);
  const ensembleText = ratePct(ENSEMBLE_FACTOR); // +5.0%
  const timeText = ratePct(TIME_FACTOR); // −5.1%

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
          {money(currencyPrefix, INITIAL)} → {rounds} {roundsLabel.toLowerCase()}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {meanLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-600" aria-hidden="true" />
          {medianLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-warning" aria-hidden="true" />
          {`Rockets (luckiest few)`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${players} parallel wealth trajectories over ${rounds} rounds of a fair coin that multiplies wealth by 1.5 on heads or 0.6 on tails, drawn on a log-scaled axis. The ensemble average grows ${ensembleText} per round and ends near ${meanText}, dragged up by a few lucky paths, while the median player loses ${timeText} per round and ends near ${medianText}, drifting toward zero.`}
      >
        <title>{title}</title>

        {/* Starting-wealth reference line */}
        <line
          x1={padLeft}
          y1={startY}
          x2={W - padRight}
          y2={startY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Faint trajectory fan: every losing/ordinary player */}
        <g stroke="var(--color-ink-400)" strokeWidth={0.75} fill="none" opacity={0.5}>
          {sim.paths.map((p, i) =>
            rocketSet.has(i) ? null : (
              <path key={i} d={linePath(p)} strokeLinejoin="round" />
            ),
          )}
        </g>

        {/* The rockets: the rare lucky paths that haul the mean upward */}
        <g stroke="var(--color-warning)" strokeWidth={1.75} fill="none">
          {sim.rockets.map((i) => (
            <path
              key={i}
              d={linePath(sim.paths[i])}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Ensemble mean (climbing) */}
        <path
          d={linePath(sim.mean)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Median (crashing toward zero) */}
        <path
          d={linePath(sim.median)}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Axis ticks: start, middle, end rounds */}
        <text x={xToPx(0)} y={H - 9} fontSize={11} fill="var(--color-ink-700)" textAnchor="start">
          0
        </text>
        <text
          x={xToPx(rounds / 2)}
          y={H - 9}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {`${Math.round(rounds / 2)}`}
        </text>
        <text x={xToPx(rounds)} y={H - 9} fontSize={11} fill="var(--color-ink-900)" textAnchor="end">
          {`${rounds} ${roundsLabel}`}
        </text>

        {/* Y-axis hint (log wealth) */}
        <text
          x={padLeft}
          y={padTop - 4}
          fontSize={11}
          fill="var(--color-ink-500)"
          textAnchor="start"
        >
          {`${wealthLabel} (log)`}
        </text>
      </svg>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{meanLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{meanText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{medianLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{medianText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ensembleRateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{ensembleText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{timeRateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{timeText}</dd>
        </div>
      </dl>

      {/* Re-run */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-200 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {rerunLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EnsembleTimeFan;
