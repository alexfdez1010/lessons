import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EmergentStylizedFactsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the interaction-strength slider. */
  interactionLabel?: string;
  /** Caption at the "no interaction" end. */
  independentLabel?: string;
  /** Caption at the "strong interaction" end. */
  interactingLabel?: string;
  /** Label for the excess-kurtosis readout. */
  kurtosisLabel?: string;
  /** Label for the biggest-shock (tail) readout. */
  tailLabel?: string;
  /** Label for the clustering verdict box. */
  clusteringLabel?: string;
  /** Verdict shown when interaction is low (i.i.d. noise). */
  flatVerdict?: string;
  /** Verdict shown when interaction is high (emergent clustering + fat tails). */
  clusteredVerdict?: string;
  /** Label for the |return| bar strip. */
  stripLabel?: string;
  /** Legend label for a tail move (> 2.2σ). */
  tailMoveLabel?: string;
  /** Legend label for an ordinary move. */
  ordinaryMoveLabel?: string;
  /** Word shown when clustering is present. */
  presentLabel?: string;
  /** Word shown when clustering is absent. */
  absentLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const N = 96;

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

/**
 * Show that volatility clustering and fat tails are *emergent*: feed identical
 * i.i.d. Gaussian shocks into a market with no agent interaction and you get
 * featureless noise (excess kurtosis ≈ 0, no clustering). Turn up the feedback
 * — agents reacting to each other's moves, modelled as an ARCH/GARCH-style
 * volatility that responds to recent returns — and the SAME shocks organise
 * themselves into bursts of turbulence and a heavy tail. Nobody wrote down
 * "fat tails"; they fall out of the interaction.
 */
function buildReturns(shocks: number[], strength: number): number[] {
  // strength ∈ [0,1] dials ARCH(α) + GARCH(β) feedback while holding the
  // unconditional variance near 1 (ω = 1 − α − β).
  const alpha = 0.32 * strength;
  const beta = 0.62 * strength;
  const omega = Math.max(0.04, 1 - alpha - beta);
  const rets: number[] = [];
  let varPrev = 1;
  let retPrev = 0;
  for (let t = 0; t < shocks.length; t++) {
    const varc = omega + alpha * retPrev * retPrev + beta * varPrev;
    const r = Math.sqrt(varc) * shocks[t];
    rets.push(r);
    varPrev = varc;
    retPrev = r;
  }
  return rets;
}

const excessKurtosis = (xs: number[]): number => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  let m2 = 0;
  let m4 = 0;
  for (const x of xs) {
    const d = x - mean;
    m2 += d * d;
    m4 += d * d * d * d;
  }
  m2 /= xs.length;
  m4 /= xs.length;
  return m2 === 0 ? 0 : m4 / (m2 * m2) - 3;
};

export function EmergentStylizedFacts({
  title = 'Stylized facts that emerge from interaction',
  interactionLabel = 'Agent interaction (feedback)',
  independentLabel = 'Independent (i.i.d.)',
  interactingLabel = 'Interacting (feedback)',
  kurtosisLabel = 'Excess kurtosis',
  tailLabel = 'Biggest shock (σ)',
  clusteringLabel = 'Volatility clustering',
  flatVerdict = 'No interaction: identical shocks, constant volatility. Returns are featureless Gaussian noise — excess kurtosis near 0, big and small moves sprinkled evenly. No stylized facts.',
  clusteredVerdict = 'With feedback, today’s move feeds tomorrow’s volatility. The SAME shocks now arrive in turbulent bursts and the tail grows heavy — volatility clustering and fat tails, emergent and unprogrammed.',
  stripLabel = 'Absolute returns over time',
  tailMoveLabel = 'tail move (> 2.2σ)',
  ordinaryMoveLabel = 'ordinary move',
  presentLabel = 'present',
  absentLabel = 'absent',
  resimulateLabel = 'Resimulate',
  caption = 'Slide the interaction up. The underlying random shocks never change — only whether agents react to each other. Out of that single switch come the two signatures real markets show and a Gaussian walk cannot: clustered turbulence and a fat tail.',
  className,
}: EmergentStylizedFactsProps) {
  const [strength, setStrength] = useState(0.85);
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 120;

  const shocks = useMemo(() => {
    const rng = mulberry32(seed * 2087 + 13);
    return Array.from({ length: N }, () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    });
  }, [seed]);

  const rets = useMemo(() => buildReturns(shocks, strength), [shocks, strength]);
  const kurt = useMemo(() => excessKurtosis(rets), [rets]);
  const sd = useMemo(() => {
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    return Math.sqrt(rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length) || 1;
  }, [rets]);
  const maxSigma = useMemo(
    () => Math.max(...rets.map((r) => Math.abs(r))) / sd,
    [rets, sd],
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
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

  const absMax = Math.max(...rets.map((r) => Math.abs(r))) || 1;
  const bw = W / N;
  const pct = Math.round(strength * 100);
  const clustered = strength > 0.45;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{stripLabel}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label="A strip of absolute returns over time. With agent interaction turned up, large bars bunch together into turbulent clusters; with it off, the bars are evenly sprinkled."
      >
        <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="var(--color-ink-100)" />
        {rets.map((r, i) => {
          const h = (Math.abs(r) / absMax) * (H - 6) * progress;
          const big = Math.abs(r) / sd > 2.2;
          return (
            <rect
              key={i}
              x={i * bw + 0.4}
              y={H - 1 - h}
              width={Math.max(0.8, bw - 0.8)}
              height={h}
              fill={big ? 'var(--color-accent-500)' : 'var(--color-brand-400)'}
              opacity={big ? 0.95 : 0.6}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-pill bg-accent-500" aria-hidden="true" />
          {tailMoveLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-pill bg-brand-400" aria-hidden="true" />
          {ordinaryMoveLabel}
        </span>
      </div>

      <div className="mt-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
          <span className="flex items-center justify-between">
            <span>{interactionLabel}</span>
            <span className="font-mono text-ink-900">{pct}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setStrength(Number(e.target.value) / 100)}
            className="w-full accent-accent-500"
            aria-valuetext={`${pct}% interaction`}
          />
          <span className="flex justify-between text-xs font-normal text-ink-500">
            <span>{independentLabel}</span>
            <span>{interactingLabel}</span>
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{kurtosisLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-900">{kurt.toFixed(2)}</p>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{tailLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-900">
            {maxSigma.toFixed(1)}σ
          </p>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3 sm:col-span-1">
          <p className="text-xs text-ink-600">{clusteringLabel}</p>
          <p
            className={cx(
              'mt-1 text-sm font-semibold',
              clustered ? 'text-accent-700' : 'text-ink-500',
            )}
          >
            {clustered ? '●●● ' : '· · · '}
            {clustered ? presentLabel : absentLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-card border border-ink-100 bg-surface-50 p-3">
        <p className="text-sm leading-relaxed text-ink-800">
          {clustered ? clusteredVerdict : flatVerdict}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EmergentStylizedFacts;
