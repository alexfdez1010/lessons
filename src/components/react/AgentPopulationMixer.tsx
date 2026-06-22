import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AgentPopulationMixerProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the market-maker weight slider. */
  marketMakerLabel?: string;
  /** Label for the momentum/trend weight slider. */
  momentumLabel?: string;
  /** Label for the fundamental/value weight slider. */
  valueLabel?: string;
  /** Label for the noise / zero-intelligence weight slider. */
  noiseLabel?: string;
  /** Label above the population-mix block. */
  mixLabel?: string;
  /** Label for the fundamental-value dashed line. */
  fundamentalLabel?: string;
  /** Label for the emergent price path. */
  priceLabel?: string;
  /** Label for the realized-volatility readout. */
  volLabel?: string;
  /** Label for the market-character verdict box. */
  characterLabel?: string;
  /** Verdict shown when value/market-maker forces dominate (stable). */
  stableVerdict?: string;
  /** Verdict shown when momentum dominates (trending / bubbly). */
  trendingVerdict?: string;
  /** Verdict shown when noise dominates (random-walk-like). */
  noiseVerdict?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Labels for the three preset buttons. */
  presetStableLabel?: string;
  presetTrendLabel?: string;
  presetNoiseLabel?: string;
  /** Small caption introducing the presets. */
  presetsLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEPS = 140;
const FUNDAMENTAL = 100;

/** Deterministic PRNG so slider changes re-run on the SAME shocks. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type Weights = { mm: number; mom: number; value: number; noise: number };

/**
 * Build the emergent price path from a population mix. The market is NOT priced
 * by an equation — it *emerges* from the net order flow of four agent types
 * pushing the price each step:
 *
 *   • Fundamental/value traders pull price toward the fundamental (stabilizing).
 *   • Momentum/trend followers push in the direction of the recent move
 *     (destabilizing positive feedback → bubbles, crashes, clustering).
 *   • Noise / zero-intelligence traders inject random demand.
 *   • Market makers absorb flow and damp the net move (lower volatility).
 *
 * The shock sequence is fixed per seed, so dragging a slider isolates the pure
 * effect of the mix rather than re-rolling the randomness.
 */
function simulate(weights: Weights, shocks: number[]): number[] {
  const total = weights.mm + weights.mom + weights.value + weights.noise || 1;
  const wMM = weights.mm / total;
  const wMom = weights.mom / total;
  const wValue = weights.value / total;
  const wNoise = weights.noise / total;

  const p: number[] = [FUNDAMENTAL];
  let trend = 0; // EWMA of recent returns → lets momentum bursts persist (clustering)

  for (let t = 0; t < STEPS; t++) {
    const cur = p[t];
    const valueForce = 0.045 * wValue * (FUNDAMENTAL - cur);
    const momForce = 1.9 * wMom * trend;
    const noiseForce = 1.4 * wNoise * shocks[t];
    const damp = 1 / (1 + 7 * wMM);
    let dp = (valueForce + momForce + noiseForce) * damp;
    dp = clamp(dp, -9, 9);
    const next = clamp(cur + dp, 20, 280);
    p.push(next);
    const ret = next - cur;
    trend = 0.74 * trend + 0.26 * ret;
  }
  return p;
}

const PRESETS: Record<'stable' | 'trend' | 'noise', Weights> = {
  stable: { mm: 55, mom: 8, value: 70, noise: 25 },
  trend: { mm: 12, mom: 80, value: 14, noise: 30 },
  noise: { mm: 18, mom: 6, value: 10, noise: 85 },
};

export function AgentPopulationMixer({
  title = 'Grow a market from a mix of agents',
  marketMakerLabel = 'Market makers',
  momentumLabel = 'Momentum / trend',
  valueLabel = 'Fundamental / value',
  noiseLabel = 'Noise (zero-intelligence)',
  mixLabel = 'Population mix',
  fundamentalLabel = 'Fundamental value',
  priceLabel = 'Emergent price',
  volLabel = 'Realized volatility',
  characterLabel = 'Market character',
  stableVerdict = 'Value and market-maker flow dominate: price is pinned near fundamental and mean-reverts. A calm, efficient market.',
  trendingVerdict = 'Momentum dominates: positive feedback amplifies every move into trends, bubbles and crashes — and volatility arrives in clusters. Nobody coded "bubble"; it emerged.',
  noiseVerdict = 'Zero-intelligence demand dominates: with no one anchoring or trending, price wanders as a near-random walk around fundamental.',
  resimulateLabel = 'Resimulate',
  presetStableLabel = 'Stabilizing mix',
  presetTrendLabel = 'Trend-driven',
  presetNoiseLabel = 'Pure noise',
  presetsLabel = 'Presets',
  caption = 'Drag the population sliders. The price is never priced by a formula — it emerges from four agent types fighting over order flow. Crank up momentum and watch bubbles, crashes and volatility clustering appear on their own; crank up value and market makers and the market goes quiet.',
  className,
}: AgentPopulationMixerProps) {
  const [weights, setWeights] = useState<Weights>({ mm: 30, mom: 35, value: 35, noise: 35 });
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 250;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 22;

  // Fixed shock sequence per seed: dragging a slider isolates the mix's effect.
  const shocks = useMemo(() => {
    const rng = mulberry32(seed * 1009 + 7);
    return Array.from({ length: STEPS }, () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    });
  }, [seed]);

  const path = useMemo(() => simulate(weights, shocks), [weights, shocks]);

  const realizedVol = useMemo(() => {
    const rets: number[] = [];
    for (let t = 1; t < path.length; t++) rets.push(path[t] - path[t - 1]);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varc = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length;
    return Math.sqrt(varc);
  }, [path]);

  const character = useMemo<'stable' | 'trend' | 'noise'>(() => {
    const total = weights.mm + weights.mom + weights.value + weights.noise || 1;
    const wMom = weights.mom / total;
    const wStab = (weights.value + weights.mm) / total;
    const wNoise = weights.noise / total;
    if (wMom >= 0.4 && wMom >= wNoise) return 'trend';
    if (wNoise >= wStab && wNoise >= wMom) return 'noise';
    return 'stable';
  }, [weights]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 760;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(1 - (1 - t) * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [seed]);

  let yMax = -Infinity;
  let yMin = Infinity;
  path.forEach((v) => {
    if (v > yMax) yMax = v;
    if (v < yMin) yMin = v;
  });
  const fund = FUNDAMENTAL;
  yMax = Math.max(yMax, fund);
  yMin = Math.min(yMin, fund);
  const ySpan = yMax - yMin || 1;
  yMax += ySpan * 0.08;
  yMin -= ySpan * 0.08;

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const drawn = Math.max(1, Math.round(STEPS * progress));
  let d = '';
  for (let i = 0; i <= Math.min(drawn, STEPS); i++) {
    d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(path[i]).toFixed(2)} `;
  }

  const verdict =
    character === 'trend' ? trendingVerdict : character === 'noise' ? noiseVerdict : stableVerdict;

  const sliders: Array<{ key: keyof Weights; label: string }> = [
    { key: 'mm', label: marketMakerLabel },
    { key: 'mom', label: momentumLabel },
    { key: 'value', label: valueLabel },
    { key: 'noise', label: noiseLabel },
  ];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {priceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-0 w-5 border-t border-dashed border-ink-400" aria-hidden="true" />
          {fundamentalLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="An emergent price path produced by a mix of market makers, momentum traders, value traders and noise traders, drawn against a constant fundamental value."
      >
        <line
          x1={padLeft}
          y1={yToPx(fund)}
          x2={W - padRight}
          y2={yToPx(fund)}
          stroke="var(--color-ink-400)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <path
          d={d.trim()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">{mixLabel}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {sliders.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            <span className="flex items-center justify-between">
              <span>{label}</span>
              <span className="font-mono text-ink-900">{weights[key]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key]}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
              }
              className="w-full accent-accent-500"
              aria-valuetext={`${label}: ${weights[key]}`}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{volLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-900">
            {realizedVol.toFixed(2)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
            <div
              className="h-full rounded-pill bg-accent-500 transition-all"
              style={{ width: `${clamp(realizedVol * 18, 2, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{characterLabel}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-800">{verdict}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {presetsLabel}:
        </span>
        <button
          type="button"
          onClick={() => setWeights(PRESETS.stable)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-3 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {presetStableLabel}
        </button>
        <button
          type="button"
          onClick={() => setWeights(PRESETS.trend)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-3 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {presetTrendLabel}
        </button>
        <button
          type="button"
          onClick={() => setWeights(PRESETS.noise)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-3 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {presetNoiseLabel}
        </button>
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-3 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AgentPopulationMixer;
