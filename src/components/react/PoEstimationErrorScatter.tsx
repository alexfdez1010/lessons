import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';
/* This chart is static (no transitions), so it is intrinsically reduced-motion safe. */

export interface PoEstimationErrorScatterProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the X axis (estimation noise on returns). */
  noiseLabel?: string;
  /** Label for the Y axis (weight of one asset). */
  weightLabel?: string;
  /** Label for the resample button. */
  resampleLabel?: string;
  /** Legend label for the unstable (naive optimizer) cloud. */
  naiveLabel?: string;
  /** Legend label for the stable / true weight reference line. */
  trueLabel?: string;
  /** Caption text. */
  caption?: string;
  className?: string;
}

/** Deterministic 32-bit LCG so SSR and hydration agree. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// Box–Muller using two LCG draws → approx-standard-normal.
function normal(rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Shows why a mean-variance optimizer is an "error maximizer". The true
 * optimal weight of an asset sits on a flat reference line. Each dot is one
 * optimizer run on a fresh noisy estimate of the inputs: tiny errors in the
 * estimated mean get hugely amplified into wild swings in the chosen weight.
 * A slider sets the estimation-noise level; the cloud of recomputed weights
 * fans out dramatically as noise rises, even drifting negative (forced shorts).
 * A reseed button redraws the sample. Locale-agnostic.
 */
export function PoEstimationErrorScatter({
  title = 'The optimizer amplifies tiny input errors',
  noiseLabel = 'Estimation noise on the inputs',
  weightLabel = 'Chosen weight of one asset',
  resampleLabel = 'New estimates',
  naiveLabel = 'Optimizer runs (noisy inputs)',
  trueLabel = 'True optimal weight',
  caption = 'The flat line is the weight you’d pick with perfect inputs. Each dot is the weight a naive optimizer chooses from one noisy estimate. Nudge the noise up and the cloud explodes — small errors in expected returns get levered into giant, even negative, weight swings. That instability, not the math, is why raw optimizers fail out of sample.',
  className,
}: PoEstimationErrorScatterProps) {
  const id = useId();
  const [noise, setNoise] = useState(0.4);
  const [seed, setSeed] = useState(0x51ed);

  const W = 520;
  const H = 300;
  const padL = 46;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const wTrue = 0.45; // true optimal weight (45%)
  const wMin = -0.6;
  const wMax = 1.4;
  const toY = (w: number): number => padT + plotH - ((w - wMin) / (wMax - wMin)) * plotH;
  const toX = (frac: number): number => padL + frac * plotW; // frac in [0,1] spread along x

  // Each dot: optimizer output weight = wTrue + amplification * noise * normal.
  // Amplification grows with noise to convey the nonlinear blow-up.
  const dots = useMemo(() => {
    const rng = makeRng(seed);
    const pts: Array<{ x: number; w: number }> = [];
    const amp = 0.9 + 2.6 * noise; // leverage of error → weight
    for (let i = 0; i < 80; i++) {
      const x = (i + 0.5) / 80;
      const w = wTrue + amp * noise * normal(rng) * 0.55;
      pts.push({ x, w });
    }
    return pts;
  }, [noise, seed]);

  // Spread of the weight cloud (std), shown as a readout.
  const spread = useMemo(() => {
    const mean = dots.reduce((a, d) => a + d.w, 0) / dots.length;
    const v = dots.reduce((a, d) => a + (d.w - mean) * (d.w - mean), 0) / dots.length;
    return Math.sqrt(v);
  }, [dots]);

  const yTicks = [-0.5, 0, 0.5, 1.0];

  const ariaLabel = `${title}. ${trueLabel} is ${(wTrue * 100).toFixed(
    0,
  )} percent. With estimation noise ${noise.toFixed(
    2,
  )}, the optimizer's chosen weights scatter with a standard deviation of about ${(spread * 100).toFixed(
    0,
  )} percentage points.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white">
          ±{(spread * 100).toFixed(0)} pts
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="3" fill="var(--color-accent-500)" />
          </svg>
          {naiveLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {trueLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        <rect x={padL} y={padT} width={plotW} height={plotH} rx={6} fill="var(--color-surface-sunken)" opacity={0.4} />
        {yTicks.map((tk) => {
          const gy = toY(tk);
          return (
            <g key={`y-${tk}`}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                stroke={tk === 0 ? 'var(--color-ink-300)' : 'var(--color-ink-100)'}
                strokeWidth={tk === 0 ? 1.5 : 1}
              />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
                {`${(tk * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* Dots */}
        {dots.map((d, i) => (
          <circle
            key={`d-${i}`}
            cx={toX(d.x)}
            cy={toY(Math.max(wMin, Math.min(wMax, d.w)))}
            r={2.8}
            fill="var(--color-accent-500)"
            opacity={0.6}
          />
        ))}

        {/* True optimal weight line */}
        <line
          x1={padL}
          y1={toY(wTrue)}
          x2={W - padR}
          y2={toY(wTrue)}
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
          {noiseLabel}
        </text>
        <text
          x={13}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 13 ${padT + plotH / 2})`}
        >
          {weightLabel}
        </text>
      </svg>

      <div className="mt-2">
        <label htmlFor={`${id}-noise`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{noiseLabel}</span>
          <span className="font-mono text-ink-900">{noise.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-noise`}
          type="range"
          min={0.05}
          max={0.9}
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

export default PoEstimationErrorScatter;
