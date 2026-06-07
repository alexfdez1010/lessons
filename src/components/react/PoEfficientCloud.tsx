import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoEfficientCloudProps {
  /** Heading above the chart. */
  title?: string;
  /** X-axis label (risk). */
  riskLabel?: string;
  /** Y-axis label (return). */
  returnLabel?: string;
  /** Label for the slider controlling estimation noise. */
  noiseLabel?: string;
  /** Resample button label. */
  resampleLabel?: string;
  /** Legend label for the true frontier. */
  trueFrontierLabel?: string;
  /** Legend label for the noisy resampled frontiers. */
  estimatedLabel?: string;
  /** Caption text. */
  caption?: string;
  className?: string;
}

/** Deterministic 32-bit LCG. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
function normal(rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const ER0 = 9;
const S_MIN = 12;
const A = 1.6;
const ER_LO = 5;
const ER_HI = 15;
const sigmaOf = (er: number): number => Math.sqrt(A * (er - ER0) * (er - ER0) + S_MIN * S_MIN);

/**
 * The "true" efficient frontier sits as one bold arc; on top of it a fan of
 * pale frontiers is each re-estimated from a noisy sample of the same inputs.
 * They wobble wildly — the frontier you fit is a random object, and the
 * confident single curve from a textbook is a fiction. Raising the noise slider
 * spreads the fan; reseeding redraws it. This is the visual companion to
 * "optimizers are error maximizers" and motivates shrinkage and resampling.
 * Locale-agnostic.
 */
export function PoEfficientCloud({
  title = 'The frontier you estimate is a moving target',
  riskLabel = 'Risk (volatility)',
  returnLabel = 'Expected return',
  noiseLabel = 'Estimation noise',
  resampleLabel = 'Resample',
  trueFrontierLabel = 'True frontier',
  estimatedLabel = 'Frontiers from noisy samples',
  caption = 'The bold arc is the frontier you’d draw with perfect inputs. Every faint arc is the same frontier re-estimated from one noisy sample of returns. They scatter far and wide — so the precise weights an optimizer reports are mostly sampling noise. Turn the dial up and the fan widens; this instability is the whole case for shrinkage and resampled optimization.',
  className,
}: PoEfficientCloudProps) {
  const id = useId();
  const [noise, setNoise] = useState(0.4);
  const [seed, setSeed] = useState(0xc10d);

  const W = 520;
  const H = 320;
  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const sigMax = Math.ceil(sigmaOf(ER_HI) / 5) * 5 + 5;
  const retMax = 16;
  const toX = (sig: number): number => padL + (sig / sigMax) * plotW;
  const toY = (er: number): number => padT + plotH - (er / retMax) * plotH;

  const truePath = useMemo(() => {
    const pts: string[] = [];
    const nn = 40;
    for (let i = 0; i <= nn; i++) {
      const er = ER0 + (i / nn) * (ER_HI - ER0);
      pts.push(`${i === 0 ? 'M' : 'L'}${toX(sigmaOf(er)).toFixed(1)} ${toY(er).toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Noisy frontiers: perturb ER0, S_MIN and curvature per sample.
  const noisyPaths = useMemo(() => {
    const rng = makeRng(seed);
    const out: string[] = [];
    for (let k = 0; k < 16; k++) {
      const dEr0 = ER0 + noise * 2.4 * normal(rng);
      const dS = S_MIN + noise * 4.0 * normal(rng);
      const dA = Math.max(0.6, A + noise * 0.9 * normal(rng));
      const sig = (er: number): number => Math.sqrt(dA * (er - dEr0) * (er - dEr0) + dS * dS);
      const pts: string[] = [];
      const nn = 32;
      for (let i = 0; i <= nn; i++) {
        const er = ER0 + (i / nn) * (ER_HI - ER0);
        pts.push(`${i === 0 ? 'M' : 'L'}${toX(sig(er)).toFixed(1)} ${toY(er).toFixed(1)}`);
      }
      out.push(pts.join(' '));
    }
    return out;
  }, [noise, seed]);

  const ariaLabel = `${title}. One true efficient frontier with sixteen frontiers re-estimated under estimation noise ${noise.toFixed(
    2,
  )}, fanning out around it.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white">
          noise {noise.toFixed(2)}
        </span>
      </figcaption>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {trueFrontierLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-accent-400)" strokeWidth="2" opacity="0.6" />
          </svg>
          {estimatedLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        <rect x={padL} y={padT} width={plotW} height={plotH} rx={6} fill="var(--color-surface-sunken)" opacity={0.4} />
        {[0, 4, 8, 12, 16].map((tk) => (
          <g key={`y-${tk}`}>
            <line x1={padL} y1={toY(tk)} x2={W - padR} y2={toY(tk)} stroke="var(--color-ink-100)" strokeWidth={1} />
            <text x={padL - 6} y={toY(tk) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">{`${tk}%`}</text>
          </g>
        ))}
        {noisyPaths.map((p, i) => (
          <path key={`np-${i}`} d={p} fill="none" stroke="var(--color-accent-400)" strokeWidth={1.5} opacity={0.4} strokeLinecap="round" />
        ))}
        <path d={truePath} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
          {riskLabel}
        </text>
        <text
          x={13}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 13 ${padT + plotH / 2})`}
        >
          {returnLabel}
        </text>
      </svg>

      <div className="mt-2">
        <label htmlFor={`${id}-n`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{noiseLabel}</span>
          <span className="font-mono text-ink-900">{noise.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-n`}
          type="range"
          min={0.05}
          max={0.8}
          step={0.01}
          value={noise}
          onChange={(e) => setNoise(Number(e.target.value))}
          aria-label={noiseLabel}
          className="mt-2 w-full accent-accent-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <button
        type="button"
        onClick={() => setSeed((s) => (s * 1103515245 + 12345) >>> 0)}
        className="mt-3 rounded-pill border border-ink-200 bg-surface px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {resampleLabel}
      </button>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoEfficientCloud;
