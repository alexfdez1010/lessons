import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RandomWalkPathsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the drift (mu) slider. */
  driftLabel?: string;
  /** Legend label for the ±√t standard-deviation envelope. */
  envelopeLabel?: string;
  /** Legend label for the sample paths. */
  pathsLabel?: string;
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

const STEPS = 200; // discrete steps over the unit time interval
const DT = 1 / STEPS; // so total time T = 1
const PATHS = 14; // number of simulated sample paths in the cloud

// Standard-normal sample via the Box–Muller transform.
const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Generate `PATHS` random-walk paths, each an array of STEPS+1 positions from 0.
// Each step adds a small Gaussian shock scaled by √dt (a discrete approximation
// of Brownian motion) plus a deterministic drift term mu·dt.
const simulate = (mu: number): number[][] => {
  const diff = Math.sqrt(DT);
  const driftStep = mu * DT;
  const out: number[][] = [];
  for (let p = 0; p < PATHS; p++) {
    const path: number[] = [0];
    let x = 0;
    for (let t = 0; t < STEPS; t++) {
      x += driftStep + diff * boxMuller();
      path.push(x);
    }
    out.push(path);
  }
  return out;
};

/**
 * A cloud of simple symmetric random-walk sample paths converging to Brownian
 * motion. Every path starts at 0 and accumulates small Gaussian shocks scaled by
 * √dt (drawn via Box–Muller) over STEPS steps of the unit time interval, plus a
 * deterministic drift mu·t. The paths fan out into the characteristic spreading
 * cloud whose width grows like √t — overlaid as two dashed ±√t envelope curves
 * (shifted by mu·t). With zero drift the cloud is a symmetric martingale; a
 * positive drift tilts the whole thing upward. The drift slider regenerates the
 * cloud live and "Resimulate" redraws with fresh shocks. Paths sweep in
 * left-to-right on mount/resimulate, respecting `prefers-reduced-motion`.
 */
export function RandomWalkPaths({
  title = 'Random walk → Brownian motion: a spreading cloud of paths',
  driftLabel = 'Drift (μ)',
  envelopeLabel = '±√t spread',
  pathsLabel = 'sample paths',
  resimulateLabel = 'Resimulate',
  caption = 'Every path starts at zero and is shoved around by tiny random shocks. With no drift the cloud is symmetric — a fair martingale that goes nowhere on average — yet it keeps spreading: the dashed ±√t funnel shows the standard deviation widening like the square root of time. Tilt the drift and the whole cloud leans up.',
  className,
}: RandomWalkPathsProps) {
  const id = useId();
  const [mu, setMu] = useState(0); // drift coefficient
  const [seed, setSeed] = useState(0); // bump to resimulate
  const [paths, setPaths] = useState<number[][]>([]);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 36;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;

  // Regenerate paths whenever inputs change or the user resimulates.
  useEffect(() => {
    setPaths(simulate(mu));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mu, seed]);

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

  // Position-axis bounds: cover the realized range and the ±√t envelope.
  let posMax = 0;
  let posMin = 0;
  for (const path of paths) {
    for (const x of path) {
      if (x > posMax) posMax = x;
      if (x < posMin) posMin = x;
    }
  }
  // The envelope reaches mu·T ± √T at the right edge; make sure it fits too.
  const envHi = mu + 1; // mu·T + √T with T = 1
  const envLo = mu - 1; // mu·T − √T with T = 1
  if (envHi > posMax) posMax = envHi;
  if (envLo < posMin) posMin = envLo;
  // Pad and guard against a degenerate flat range.
  const span = posMax - posMin;
  posMax += span * 0.1 || 0.5;
  posMin -= span * 0.1 || 0.5;
  if (posMax - posMin < 0.5) {
    posMax = 1.5;
    posMin = -1.5;
  }

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (x: number) =>
    padTop + (1 - (x - posMin) / (posMax - posMin)) * (H - padTop - padBottom);

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

  // Build a ±√t envelope curve (drift mu·t ± √t) up to the revealed step.
  const envelopeToD = (sign: 1 | -1): string => {
    let d = '';
    const last = Math.min(drawnSteps, STEPS);
    for (let i = 0; i <= last; i++) {
      const t = i * DT;
      const y = mu * t + sign * Math.sqrt(t);
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(y).toFixed(2)} `;
    }
    return d.trim();
  };

  const zeroY = yToPx(0);
  const baseY = H - padBottom;
  const muText = `${mu > 0 ? '+' : ''}${mu.toFixed(1)}`;

  // Three position gridline values, including 0.
  const gridValues = [posMin, 0, posMax];

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
          {`${PATHS} ${pathsLabel}`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t border-dashed border-accent-500"
            aria-hidden="true"
          />
          {envelopeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A cloud of ${PATHS} simple symmetric random-walk sample paths, all starting at 0, accumulating small Gaussian shocks over ${STEPS} steps with drift ${muText}. The paths spread into a widening cloud bounded by two dashed curves that grow like the square root of time.`}
      >
        {/* Position gridlines and labels */}
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
                {g.toFixed(1)}
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

        {/* Zero reference line (dashed) — the starting level */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={W - padRight}
          y2={zeroY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* ±√t spread envelope (dashed accent curves) */}
        <path
          d={envelopeToD(1)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={1.75}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={envelopeToD(-1)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={1.75}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* The cloud of random-walk paths, all one color at low opacity */}
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
          {STEPS}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{driftLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{muText}</span>
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
          min={-2}
          max={2}
          step={0.1}
          value={mu}
          onChange={(e) => setMu(Number(e.target.value))}
          aria-valuetext={`${muText} drift`}
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

export default RandomWalkPaths;
