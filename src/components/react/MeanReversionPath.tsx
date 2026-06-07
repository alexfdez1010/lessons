import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MeanReversionPathProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the reversion-speed (kappa) slider. */
  speedLabel?: string;
  /** Label for the long-run mean (theta) reference line. */
  meanLabel?: string;
  /** Label for the half-life readout chip. */
  halfLifeLabel?: string;
  /** Legend label for the faint comparison random walk (kappa = 0). */
  randomWalkLabel?: string;
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

const THETA = 100; // long-run mean (theta)
const X0 = 130; // starting value, deliberately above the mean
const STEPS = 252; // discrete steps
const DT = 1 / 252;
const SIGMA = 0.6; // volatility of the shocks
const PATHS = 3; // number of mean-reverting paths to draw

// Standard-normal sample via the Box–Muller transform.
const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Pre-draw all the shocks once so the OU path and the κ=0 random walk share
// the exact same random sequence — the only difference is the pull term.
const drawShocks = (): number[][] => {
  const out: number[][] = [];
  for (let p = 0; p < PATHS; p++) {
    const shocks: number[] = [];
    for (let t = 0; t < STEPS; t++) shocks.push(boxMuller());
    out.push(shocks);
  }
  return out;
};

// Integrate an Ornstein–Uhlenbeck path from fixed shocks:
// dX = kappa (theta − X) dt + sigma √dt Z. With kappa = 0 it is a pure
// random walk (no pull back toward the mean).
const integrate = (shocks: number[], kappa: number): number[] => {
  const diff = SIGMA * Math.sqrt(DT);
  const path: number[] = [X0];
  let x = X0;
  for (let t = 0; t < STEPS; t++) {
    x = x + kappa * (THETA - x) * DT + diff * shocks[t];
    path.push(x);
  }
  return path;
};

/**
 * An Ornstein–Uhlenbeck (mean-reverting) process. A handful of paths all start
 * above a horizontal long-run mean θ and get yanked back toward it by the pull
 * term: dX = κ(θ − X)dt + σ√dt·Z, integrated over discrete steps with shocks
 * Z ~ N(0,1) drawn via Box–Muller. The reversion-speed slider (κ) controls how
 * hard the pull is — crank it up and the paths hug the mean tightly; drop it to
 * zero and they behave like a free random walk. A faint dashed line shows that
 * driftless random walk (κ = 0) built from the *same* shocks, so the contrast is
 * visible. A live half-life readout, ln(2)/κ, reports how many steps a deviation
 * takes to decay halfway. "Resimulate" redraws with fresh shocks. Paths sweep in
 * left-to-right on mount, respecting `prefers-reduced-motion`.
 */
export function MeanReversionPath({
  title = 'Mean reversion: an Ornstein–Uhlenbeck process pulled back to its mean',
  speedLabel = 'Reversion speed (κ)',
  meanLabel = 'Long-run mean',
  halfLifeLabel = 'Half-life',
  randomWalkLabel = 'No reversion (κ=0)',
  resimulateLabel = 'Resimulate',
  caption = 'Whenever the path wanders away from the long-run mean, the pull term drags it back — the stronger the reversion speed, the tighter it hugs the line. Turn κ down to zero and the same shocks just drift off forever, like a free random walk. The half-life is how long a deviation takes to fade halfway: a bigger κ means a shorter memory.',
  className,
}: MeanReversionPathProps) {
  const id = useId();
  const [kappaX10, setKappaX10] = useState(50); // kappa × 10, so 50 → κ = 5
  const [seed, setSeed] = useState(0); // bump to resimulate
  const [shocks, setShocks] = useState<number[][]>([]);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const kappa = kappaX10 / 10;

  const W = 520;
  const H = 240;
  const padLeft = 36;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;

  // Redraw the shock sequence only when the user resimulates — changing κ keeps
  // the same shocks so the slider's effect is isolated.
  useEffect(() => {
    setShocks(drawShocks());
  }, [seed]);

  // Reveal animation: sweep the paths in left-to-right.
  useEffect(() => {
    if (shocks.length === 0) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shocks, seed]);

  // Build the OU paths (live κ) and the comparison κ=0 random walks.
  const ouPaths = shocks.map((s) => integrate(s, kappa));
  const rwPaths = shocks.map((s) => integrate(s, 0));

  // Value-axis bounds: cover the realized range with a little headroom.
  let valMax = Math.max(THETA, X0);
  let valMin = Math.min(THETA, X0);
  for (const path of [...ouPaths, ...rwPaths]) {
    for (const x of path) {
      if (x > valMax) valMax = x;
      if (x < valMin) valMin = x;
    }
  }
  // Pad and guard against a degenerate flat range.
  const span = valMax - valMin || 1;
  valMax += span * 0.08;
  valMin -= span * 0.08;

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (x: number) =>
    padTop + (1 - (x - valMin) / (valMax - valMin)) * (H - padTop - padBottom);

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

  const meanY = yToPx(THETA);
  const baseY = H - padBottom;
  const kappaText = kappa.toFixed(1);
  // Half-life in steps: ln(2) / κ, expressed in the same step units as the axis.
  // As κ → 0 the half-life diverges (a random walk never reverts).
  const halfLifeSteps = kappa > 0 ? Math.log(2) / (kappa * DT) : Infinity;
  const halfLifeText = Number.isFinite(halfLifeSteps) ? halfLifeSteps.toFixed(0) : '∞';

  // Three value gridlines.
  const gridValues = [valMin, (valMin + valMax) / 2, valMax];

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
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {randomWalkLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 border-l border-dashed border-ink-400"
            aria-hidden="true"
          />
          {`${meanLabel} ${THETA}`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${PATHS} simulated Ornstein–Uhlenbeck mean-reverting paths starting above a long-run mean of ${THETA} and being pulled back toward it with reversion speed κ = ${kappaText}, alongside faint dashed driftless random walks built from the same shocks. The half-life of a deviation is about ${halfLifeText} steps.`}
      >
        {/* Value gridlines and labels */}
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

        {/* Faint dashed random walks (κ=0) from the same shocks — the contrast */}
        {rwPaths.map((path, i) => (
          <path
            key={`rw-${i}`}
            d={pathToD(path)}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeOpacity={0.35}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Long-run mean reference line (dashed) */}
        <line
          x1={padLeft}
          y1={meanY}
          x2={W - padRight}
          y2={meanY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={padLeft + 2}
          y={meanY - 4}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          {`${meanLabel} ${THETA}`}
        </text>

        {/* The mean-reverting OU paths */}
        {ouPaths.map((path, i) => (
          <path
            key={`ou-${i}`}
            d={pathToD(path)}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeOpacity={0.85}
            strokeWidth={1.75}
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
          <span className="text-ink-600">{speedLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{kappaText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{halfLifeLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{`${halfLifeText} steps`}</span>
        </span>
      </div>

      {/* Reversion-speed slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-kappa`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{speedLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {kappaText}
          </span>
        </label>
        <input
          id={`${id}-kappa`}
          type="range"
          min={0}
          max={150}
          step={1}
          value={kappaX10}
          onChange={(e) => setKappaX10(Number(e.target.value))}
          aria-valuetext={`reversion speed κ = ${kappaText}, half-life about ${halfLifeText} steps`}
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

export default MeanReversionPath;
