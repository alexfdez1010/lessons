import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorMonteCarloRuinProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the per-trade risk slider. */
  riskLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Label for the ruined-paths legend entry. */
  ruinedLabel?: string;
  /** Label for the surviving-paths legend entry. */
  survivedLabel?: string;
  /** Readout label preceding the estimated ruin probability. */
  ruinProbLabel?: string;
  /** Label for the ruin-threshold reference line. */
  thresholdLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial per-trade risk fraction. Defaults to 0.04. */
  risk?: number;
  /** Seed for the deterministic simulation. Defaults to 909. */
  seed?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const TRADES = 120;
const PATHS = 40; // drawn paths
const WIN_P = 0.55; // modest positive edge
const PAYOFF = 1; // even money
const RUIN_LEVEL = 0.5; // ruin = equity falls to 50% of start (a hard stop)

interface Sim {
  paths: number[][];
  ruined: boolean[];
  ruinProb: number;
}

const simulate = (seed: number, risk: number): Sim => {
  const rand = mulberry32(seed);
  const paths: number[][] = [];
  const ruined: boolean[] = [];
  for (let pth = 0; pth < PATHS; pth++) {
    const path = [1];
    let equity = 1;
    let dead = false;
    for (let i = 0; i < TRADES; i++) {
      if (!dead) {
        const win = rand() < WIN_P;
        equity *= win ? 1 + risk * PAYOFF : 1 - risk;
        if (equity <= RUIN_LEVEL) {
          equity = RUIN_LEVEL;
          dead = true;
        }
      }
      path.push(equity);
    }
    paths.push(path);
    ruined.push(dead);
  }
  // Estimate ruin prob from a larger hidden batch for stability.
  let ruinCount = 0;
  const big = 1500;
  for (let pth = 0; pth < big; pth++) {
    let equity = 1;
    let dead = false;
    for (let i = 0; i < TRADES && !dead; i++) {
      const win = rand() < WIN_P;
      equity *= win ? 1 + risk * PAYOFF : 1 - risk;
      if (equity <= RUIN_LEVEL) dead = true;
    }
    if (dead) ruinCount++;
  }
  return { paths, ruined, ruinProb: ruinCount / big };
};

/**
 * Monte Carlo ruin engine. Fans out many fixed-fraction equity curves of a
 * modestly positive-edge system, with a hard ruin threshold (equity falling to
 * half its start). Paths that hit the floor are drawn in danger red and frozen;
 * survivors stay in brand blue. The risk-per-trade slider rescales every stake:
 * crank it up and more of the cloud crashes into the floor, illustrating that
 * even a winning system ruins itself if bet too big. A separate large hidden
 * batch estimates the ruin probability shown in the readout. Paths sweep in
 * left-to-right; respects prefers-reduced-motion. Deterministic via seeded PRNG.
 */
export function RorMonteCarloRuin({
  title = 'Monte Carlo: how often does this system blow up?',
  riskLabel = 'Risk per trade',
  resimulateLabel = 'New batch',
  ruinedLabel = 'Ruined',
  survivedLabel = 'Survived',
  ruinProbLabel = 'Estimated risk of ruin',
  thresholdLabel = 'Ruin threshold',
  caption = 'Every path is the same winning system (55% win rate, even money) — only the bet size changes. At a small risk-per-trade almost all paths survive; crank the slider up and the same edge gets buried as curve after curve smashes into the ruin floor. A positive edge does not save you from over-betting.',
  risk = 0.04,
  seed = 909,
  className,
}: RorMonteCarloRuinProps) {
  const id = useId();
  const [riskPct, setRiskPct] = useState(Math.round(risk * 100));
  const [seedBump, setSeedBump] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const riskVal = riskPct / 100;
  const activeSeed = seed + seedBump * 777;

  const sim = useMemo(() => simulate(activeSeed, riskVal), [activeSeed, riskVal]);

  const W = 560;
  const H = 260;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 28;
  const n = TRADES + 1;
  const maxV = Math.max(1.6, ...sim.paths.map((p) => Math.max(...p)));
  const minV = RUIN_LEVEL * 0.92;

  const xToPx = (i: number) => padLeft + (i / (n - 1)) * (W - padLeft - padRight);
  const yToPx = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBottom);
  const baseY = H - padBottom;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
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
  }, [sim]);

  const drawn = Math.max(1, Math.round((n - 1) * progress));
  const pathD = (path: number[]) => {
    let d = '';
    const last = Math.min(drawn, path.length - 1);
    for (let i = 0; i <= last; i++) d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(path[i]).toFixed(2)} `;
    return d.trim();
  };

  const ruinY = yToPx(RUIN_LEVEL);
  const startY = yToPx(1);

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
          {ruinProbLabel}: {(sim.ruinProb * 100).toFixed(1)}%
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill" style={{ backgroundColor: 'var(--color-brand-500)' }} aria-hidden="true" />
          {survivedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill" style={{ backgroundColor: 'var(--color-danger)' }} aria-hidden="true" />
          {ruinedLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Monte Carlo of ${PATHS} equity paths at ${riskPct} percent risk per trade. The estimated risk of ruin is about ${(sim.ruinProb * 100).toFixed(1)} percent.`}
      >
        {/* Start line */}
        <line x1={padLeft} y1={startY} x2={W - padRight} y2={startY} stroke="var(--color-ink-200)" strokeDasharray="4 4" />
        {/* Ruin threshold */}
        <line x1={padLeft} y1={ruinY} x2={W - padRight} y2={ruinY} stroke="var(--color-danger)" strokeWidth={1.6} strokeDasharray="6 4" />
        <text x={padLeft + 4} y={ruinY - 4} fontSize={10} fontWeight={600} fill="var(--color-danger)" textAnchor="start">
          {thresholdLabel}
        </text>

        {sim.paths.map((path, i) => (
          <path
            key={i}
            d={pathD(path)}
            fill="none"
            stroke={sim.ruined[i] ? 'var(--color-danger)' : 'var(--color-brand-500)'}
            strokeWidth={1.3}
            strokeOpacity={sim.ruined[i] ? 0.75 : 0.55}
            strokeLinejoin="round"
          />
        ))}

        <line x1={padLeft} y1={baseY} x2={W - padRight} y2={baseY} stroke="var(--color-ink-200)" />
        <text x={padLeft} y={H - 6} fontSize={11} fill="var(--color-ink-900)" textAnchor="start">
          0
        </text>
        <text x={W - padRight} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="end">
          {TRADES}
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
          max={12}
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

export default RorMonteCarloRuin;
