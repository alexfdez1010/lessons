import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface GbmPathsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the drift (mu) slider. */
  driftLabel?: string;
  /** Label for the volatility (sigma) slider. */
  volLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Label for the starting-price reference line. */
  startLabel?: string;
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
const PATHS = 16; // number of simulated paths in the fan

// Standard-normal sample via the Box–Muller transform.
const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Generate `PATHS` GBM price paths, each an array of STEPS+1 prices from S0.
const simulate = (mu: number, sigma: number): number[][] => {
  const drift = (mu - 0.5 * sigma * sigma) * DT;
  const diff = sigma * Math.sqrt(DT);
  const out: number[][] = [];
  for (let p = 0; p < PATHS; p++) {
    const path: number[] = [S0];
    let s = S0;
    for (let t = 0; t < STEPS; t++) {
      s = s * Math.exp(drift + diff * boxMuller());
      path.push(s);
    }
    out.push(path);
  }
  return out;
};

/**
 * A fan of Geometric Brownian Motion price paths — the standard model for
 * simulated asset prices. Every path starts at S0 = 100 and evolves by the
 * discrete GBM step S_{t+dt} = S_t * exp((mu − 0.5 sigma^2) dt + sigma √dt Z),
 * with Z ~ N(0,1) drawn via Box–Muller, over 252 daily steps. The paths spread
 * into the characteristic widening fan; because of the exponential they stay
 * positive and the cross-section is right-skewed (lognormal) — a few paths shoot
 * high while most cluster lower. Drift and volatility sliders regenerate the fan
 * live, and "Resimulate" redraws with fresh random shocks. Paths draw
 * left-to-right on mount/resimulate, respecting `prefers-reduced-motion`.
 */
export function GbmPaths({
  title = 'Geometric Brownian Motion: a fan of simulated price paths',
  driftLabel = 'Drift (annual)',
  volLabel = 'Volatility (annual)',
  resimulateLabel = 'Resimulate',
  startLabel = 'Start',
  caption = 'Every path starts at the same price and is pushed around by random daily shocks. Crank up volatility and the fan widens; nudge the drift and the whole cloud tilts up or down. Because returns compound through an exponential, prices stay positive and a few lucky paths run far above the crowd.',
  className,
}: GbmPathsProps) {
  const id = useId();
  const [muPct, setMuPct] = useState(8); // annual drift, percent
  const [sigmaPct, setSigmaPct] = useState(25); // annual volatility, percent
  const [seed, setSeed] = useState(0); // bump to resimulate
  const [paths, setPaths] = useState<number[][]>([]);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const mu = muPct / 100;
  const sigma = sigmaPct / 100;

  const W = 520;
  const H = 240;
  const padLeft = 36;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;

  // Regenerate paths whenever inputs change or the user resimulates.
  useEffect(() => {
    setPaths(simulate(mu, sigma));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muPct, sigmaPct, seed]);

  // Reveal animation: sweep the paths in left-to-right.
  useEffect(() => {
    if (paths.length === 0) return;
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
  }, [paths]);

  // Price-axis bounds: cover the realized range with a little headroom.
  let priceMax = S0;
  let priceMin = S0;
  for (const path of paths) {
    for (const s of path) {
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
  const muText = `${muPct > 0 ? '+' : ''}${muPct.toFixed(0)}%`;
  const sigmaText = `${sigmaPct.toFixed(0)}%`;

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
          {`${PATHS} paths`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 border-l border-dashed border-ink-400"
            aria-hidden="true"
          />
          {`${startLabel} 100`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A fan of ${PATHS} simulated Geometric Brownian Motion price paths, all starting at 100, evolving over one year with annual drift ${muText} and annual volatility ${sigmaText}. The paths spread out into a widening, right-skewed fan.`}
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
          {`${startLabel} 100`}
        </text>

        {/* The fan of GBM paths, all one color at low opacity */}
        {paths.map((path, i) => (
          <path
            key={`path-${i}`}
            d={pathToD(path)}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
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
          <span className="text-ink-600">{driftLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{muText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{volLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{sigmaText}</span>
        </span>
      </div>

      {/* Drift slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-mu`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{driftLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {muText}
          </span>
        </label>
        <input
          id={`${id}-mu`}
          type="range"
          min={-10}
          max={20}
          step={1}
          value={muPct}
          onChange={(e) => setMuPct(Number(e.target.value))}
          aria-valuetext={`${muText} annual drift`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Volatility slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{volLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {sigmaText}
          </span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={5}
          max={60}
          step={1}
          value={sigmaPct}
          onChange={(e) => setSigmaPct(Number(e.target.value))}
          aria-valuetext={`${sigmaText} annual volatility`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Resimulate button */}
      <div className="mt-4">
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

export default GbmPaths;
