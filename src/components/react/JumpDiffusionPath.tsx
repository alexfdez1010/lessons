import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface JumpDiffusionPathProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the jump-intensity (lambda) slider. */
  intensityLabel?: string;
  /** Toggle label when jumps are shown. */
  showJumpsLabel?: string;
  /** Toggle label when only the diffusion path is shown. */
  diffusionOnlyLabel?: string;
  /** Readout-chip label for the jump count this run. */
  jumpsCountLabel?: string;
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

const S0 = 100; // initial price
const STEPS = 252; // daily steps over one trading year
const DT = 1 / 252;
const MU = 0.07; // annual drift of the continuous part
const SIGMA = 0.2; // annual volatility of the continuous part
const JUMP_MEAN = -0.12; // mean log-jump: crashes more common/larger than melt-ups
const JUMP_SD = 0.1; // spread of the log-jump

// Standard-normal sample via the Box–Muller transform.
const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

interface JumpEvent {
  step: number; // step index where the jump landed
  price: number; // price right after the jump
}

interface SimResult {
  withJumps: number[]; // price path including Poisson jumps
  diffusionOnly: number[]; // same Brownian shocks, jumps removed
  jumps: JumpEvent[]; // marker positions
}

// Simulate a Merton jump-diffusion path and its pure-diffusion twin sharing the
// same Brownian shocks. At each step we add a smooth GBM increment and, with
// probability lambda*dt, multiply by exp(jumpSize), jumpSize ~ N(JUMP_MEAN, JUMP_SD).
const simulate = (lambda: number): SimResult => {
  const drift = (MU - 0.5 * SIGMA * SIGMA) * DT;
  const diff = SIGMA * Math.sqrt(DT);
  const withJumps: number[] = [S0];
  const diffusionOnly: number[] = [S0];
  const jumps: JumpEvent[] = [];
  let sJump = S0;
  let sDiff = S0;
  for (let t = 0; t < STEPS; t++) {
    const z = boxMuller();
    const growth = Math.exp(drift + diff * z);
    sJump *= growth;
    sDiff *= growth;
    if (Math.random() < lambda * DT) {
      const jumpSize = JUMP_MEAN + JUMP_SD * boxMuller();
      sJump *= Math.exp(jumpSize);
      jumps.push({ step: t + 1, price: sJump });
    }
    withJumps.push(sJump);
    diffusionOnly.push(sDiff);
  }
  return { withJumps, diffusionOnly, jumps };
};

/**
 * A single Merton jump-diffusion price path. The continuous part is a discrete
 * GBM step S_{t+dt} = S_t * exp((mu − 0.5 sigma^2) dt + sigma √dt Z), Z ~ N(0,1)
 * via Box–Muller; on top of it a Poisson process fires a jump at each step with
 * probability lambda*dt, multiplying the price by exp(jumpSize) where jumpSize is
 * drawn from a normal with a negative mean (crashes more common/larger than
 * melt-ups). A lambda slider controls how often jumps occur — raise it and the
 * path becomes pockmarked with cliffs. A toggle overlays the SAME Brownian path
 * with its jumps removed (faint dashed) so learners see exactly what the jump
 * component adds: the smooth Black–Scholes world vs the gappy real one. Accent
 * markers sit on each jump. The path sweeps in left-to-right on mount/resimulate,
 * respecting `prefers-reduced-motion`.
 */
export function JumpDiffusionPath({
  title = 'Jump-diffusion: smooth Brownian motion plus sudden Poisson jumps',
  intensityLabel = 'Jump intensity (per year)',
  showJumpsLabel = 'With jumps',
  diffusionOnlyLabel = 'Diffusion only',
  jumpsCountLabel = 'Jumps this run',
  resimulateLabel = 'Resimulate',
  caption = 'The continuous Brownian part drifts and wiggles smoothly — that is the tidy Black–Scholes world. A Poisson process sprinkles in sudden gaps on top: mostly cliffs down on bad news, occasionally pops up. Crank the intensity and the path turns pockmarked with discontinuities the smooth model can never produce.',
  className,
}: JumpDiffusionPathProps) {
  const id = useId();
  const [lambda, setLambda] = useState(8); // expected jumps per year
  const [showJumps, setShowJumps] = useState(true);
  const [seed, setSeed] = useState(0); // bump to resimulate
  const [sim, setSim] = useState<SimResult | null>(null);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 36;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;

  // Regenerate the path whenever the intensity changes or the user resimulates.
  useEffect(() => {
    setSim(simulate(lambda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lambda, seed]);

  // Reveal animation: sweep the path in left-to-right.
  useEffect(() => {
    if (!sim) return;
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setProgress(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sim]);

  // Price-axis bounds: cover both paths' realized range with a little headroom.
  let priceMax = S0;
  let priceMin = S0;
  if (sim) {
    for (const s of sim.withJumps) {
      if (s > priceMax) priceMax = s;
      if (s < priceMin) priceMin = s;
    }
    for (const s of sim.diffusionOnly) {
      if (s > priceMax) priceMax = s;
      if (s < priceMin) priceMin = s;
    }
  }
  // Pad and guard against a degenerate flat range.
  priceMax *= 1.05;
  priceMin *= 0.95;
  if (priceMax - priceMin < 1) {
    priceMax = S0 * 1.2;
    priceMin = S0 * 0.8;
  }

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (s: number) =>
    padTop + (1 - (s - priceMin) / (priceMax - priceMin)) * (H - padTop - padBottom);

  // How many steps to draw given the reveal progress.
  const drawnSteps = Math.max(1, Math.round(STEPS * progress));

  const pathToD = (path: number[]): string => {
    let d = '';
    const last = Math.min(drawnSteps, path.length - 1);
    for (let i = 0; i <= last; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(path[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  const startY = yToPx(S0);
  const baseY = H - padBottom;
  const jumpCount = sim ? sim.jumps.length : 0;
  // Only mark jumps that have already been revealed by the sweep.
  const revealedJumps = sim ? sim.jumps.filter((j) => j.step <= drawnSteps) : [];

  // Three price gridline values.
  const gridValues = [priceMin, (priceMin + priceMax) / 2, priceMax];

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
          {showJumpsLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill border-t border-dashed border-ink-400"
            aria-hidden="true"
          />
          {diffusionOnlyLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-2 w-2 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {jumpsCountLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A simulated Merton jump-diffusion price path starting at 100 over one year, with a jump intensity of ${lambda} per year and ${jumpCount} jumps this run. ${showJumps ? 'The smooth diffusion-only path is overlaid as a faint dashed line so the sudden gaps the jumps add stand out.' : 'Only the smooth diffusion path is shown, without any jumps.'}`}
      >
        {/* Price gridlines and labels */}
        {gridValues.map((g, i) => {
          const gy = yToPx(g);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padLeft}
                y1={gy}
                x2={W - padRight}
                y2={gy}
                stroke="var(--color-ink-100)"
              />
              <text
                x={padLeft - 6}
                y={gy + 3}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor="end"
              >
                {g.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Baseline (time axis) */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Starting-price reference line (dashed) */}
        <line
          x1={padLeft}
          y1={startY}
          x2={W - padRight}
          y2={startY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={padLeft + 2}
          y={startY - 4}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          100
        </text>

        {/* Diffusion-only twin (faint dashed) — drawn under the jump path */}
        {sim && showJumps && (
          <path
            d={pathToD(sim.diffusionOnly)}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* The path: with jumps (brand) or, when toggled off, diffusion-only */}
        {sim && (
          <path
            d={pathToD(showJumps ? sim.withJumps : sim.diffusionOnly)}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Jump markers in the accent color so they pop against the path */}
        {showJumps &&
          revealedJumps.map((j, i) => (
            <circle
              key={`jump-${i}`}
              cx={xToPx(j.step)}
              cy={yToPx(j.price)}
              r={3}
              fill="var(--color-accent-500)"
              stroke="var(--color-surface)"
              strokeWidth={1}
            />
          ))}

        {/* Time-axis ticks */}
        <text
          x={padLeft}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="start"
        >
          0
        </text>
        <text
          x={W - padRight}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          252
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{intensityLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{lambda}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{jumpsCountLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{jumpCount}</span>
        </span>
      </div>

      {/* Jump-intensity slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-lambda`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{intensityLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {lambda}
          </span>
        </label>
        <input
          id={`${id}-lambda`}
          type="range"
          min={0}
          max={40}
          step={1}
          value={lambda}
          onChange={(e) => setLambda(Number(e.target.value))}
          aria-valuetext={`${lambda} expected jumps per year`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Jumps on/off toggle + Resimulate button */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowJumps((v) => !v)}
          aria-pressed={showJumps}
          className={cx(
            'rounded-pill border px-4 py-1.5 text-sm font-medium shadow-soft transition',
            showJumps
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-ink-100 bg-surface-50 text-ink-800 hover:bg-surface-100',
          )}
        >
          {showJumps ? showJumpsLabel : diffusionOnlyLabel}
        </button>
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

export default JumpDiffusionPath;
