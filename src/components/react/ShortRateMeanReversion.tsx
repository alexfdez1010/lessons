import { useEffect, useRef, useState } from 'react';
import { useId } from 'react';
import { cx } from '@/components/react/cx';

export interface ShortRateMeanReversionProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the mean-reversion-speed slider. */
  speedLabel?: string;
  /** Label for the long-run-mean slider. */
  meanLabel?: string;
  /** Label for the volatility slider. */
  volLabel?: string;
  /** Legend label for the simulated short-rate path. */
  pathLabel?: string;
  /** Legend label for the long-run mean line. */
  meanLineLabel?: string;
  /** Label for the redraw button. */
  redrawLabel?: string;
  /** Axis label for the time axis. */
  timeAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial mean-reversion speed (0.05–1). Defaults to `0.3`. */
  speed?: number;
  /** Initial long-run mean rate as a percent value. Defaults to `5`. */
  longRunMean?: number;
  /** Initial volatility as a percent value. Defaults to `1`. */
  vol?: number;
  /** Starting short rate as a percent value. Defaults to `2`. */
  startRate?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmtPct = (value: number, digits = 1): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;

// Tiny deterministic PRNG so a given seed reproduces the same path.
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

// Box–Muller standard normal from a uniform generator.
function gauss(rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * A mean-reverting short-rate path — the engine behind term-structure models
 * like Vasicek and CIR. Unlike a stock (a pure random walk that wanders off),
 * the short rate is tethered: whenever it strays from a long-run mean it gets
 * pulled back, with a strength set by the mean-reversion speed. The chart
 * simulates a discrete Ornstein–Uhlenbeck path, draws the long-run mean as a
 * dashed line, and animates the rate snaking toward it. Drag the speed, the
 * mean and the volatility; a faster speed yanks the path to the mean sooner,
 * higher vol makes it rattle more. Numbers come from props/sliders; the path is
 * generated internally with a seeded RNG (deterministic per redraw). Respects
 * `prefers-reduced-motion` (draws the full path at once).
 */
export function ShortRateMeanReversion({
  title = 'Mean reversion: the short rate on a leash',
  speedLabel = 'Reversion speed',
  meanLabel = 'Long-run mean',
  volLabel = 'Volatility',
  pathLabel = 'Short rate path',
  meanLineLabel = 'Long-run mean',
  redrawLabel = 'Redraw path',
  timeAxisLabel = 'Time',
  caption = 'A stock price wanders off forever; a short rate is leashed to a long-run mean. The reversion speed sets how hard it is pulled back — crank it up and the path snaps to the mean; turn volatility up and it rattles around the leash.',
  speed = 0.3,
  longRunMean = 5,
  vol = 1,
  startRate = 2,
  className,
}: ShortRateMeanReversionProps) {
  const id = useId();
  const [kappa, setKappa] = useState(speed);
  const [theta, setTheta] = useState(longRunMean);
  const [sigma, setSigma] = useState(vol);
  const [seed, setSeed] = useState(12345);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 230;
  const padX = 16;
  const padTop = 16;
  const axisY = H - 30;

  const STEPS = 120;
  const dt = 1 / 12; // monthly steps

  // Simulate the OU path deterministically from the seed.
  const path: number[] = (() => {
    const rng = mulberry32(seed);
    const out: number[] = [startRate];
    let r = startRate;
    for (let i = 1; i <= STEPS; i++) {
      const dr = kappa * (theta - r) * dt + sigma * Math.sqrt(dt) * gauss(rng);
      r += dr;
      out.push(r);
    }
    return out;
  })();

  const allVals = [...path, theta];
  const maxV = Math.max(...allVals) + 0.5;
  const minV = Math.min(...allVals, 0) - 0.5;

  const x = (i: number) => padX + (i / STEPS) * (W - padX * 2);
  const y = (v: number) =>
    padTop + (1 - (v - minV) / (maxV - minV)) * (axisY - padTop);

  const shownSteps = Math.max(1, Math.round(progress * STEPS));
  const linePath = () => {
    let d = `M ${x(0)} ${y(path[0])}`;
    for (let i = 1; i <= shownSteps; i++) d += ` L ${x(i)} ${y(path[i])}`;
    return d;
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [kappa, theta, sigma, seed]);

  const meanY = y(theta);

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
          {meanLabel}: {fmtPct(theta)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {pathLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {meanLineLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a short-rate path with reversion speed ${new Intl.NumberFormat(
          'en-US',
          { maximumFractionDigits: 2 },
        ).format(kappa)} is pulled toward a long-run mean of ${fmtPct(theta)}.`}
      >
        {/* Long-run mean line */}
        <line
          x1={padX}
          y1={meanY}
          x2={W - padX}
          y2={meanY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={W - padX} y={meanY - 5} textAnchor="end" fontSize={11} fill="var(--color-accent-600)" fontFamily="var(--font-mono, monospace)">
          {fmtPct(theta)}
        </text>
        {/* Axis */}
        <line x1={padX} y1={axisY} x2={W - padX} y2={axisY} stroke="var(--color-ink-200)" />
        <text x={W - padX} y={axisY + 20} textAnchor="end" fontSize={10} fill="var(--color-ink-400)">
          {timeAxisLabel}
        </text>
        {/* Path */}
        <path
          d={linePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Head dot */}
        <circle cx={x(shownSteps)} cy={y(path[shownSteps])} r={4} fill="var(--color-brand-600)" stroke="white" strokeWidth={1.5} />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-kappa`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{speedLabel}</span>
            <span className="font-mono text-ink-900">
              {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kappa)}
            </span>
          </label>
          <input
            id={`${id}-kappa`}
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={kappa}
            onChange={(e) => setKappa(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-theta`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{meanLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(theta)}</span>
          </label>
          <input
            id={`${id}-theta`}
            type="range"
            min={1}
            max={9}
            step={0.5}
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-sigma`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{volLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(sigma)}</span>
          </label>
          <input
            id={`${id}-sigma`}
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeed((s) => (s * 1664525 + 1013904223) >>> 0)}
          className="rounded-pill border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {redrawLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ShortRateMeanReversion;
