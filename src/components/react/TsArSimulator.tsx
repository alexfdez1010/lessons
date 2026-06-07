import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsArSimulatorProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the AR coefficient (phi) slider. */
  phiLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Caption note shown for the explosive (phi ≥ 1) regime. */
  explosiveNote?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEPS = 160;

const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// AR(1): X_t = phi · X_{t-1} + shock. Same shocks across phi for a fair compare.
const simulate = (phi: number, shocks: number[]): number[] => {
  const out: number[] = [0];
  let x = 0;
  for (let t = 0; t < STEPS; t++) {
    x = phi * x + shocks[t];
    out.push(x);
  }
  return out;
};

/**
 * An interactive AR(1) simulator: slide the autoregressive coefficient phi from
 * negative (oscillating, mean-reverting) through 0 (white noise) up to and past
 * 1 (a unit root / explosive walk). The same fixed shock sequence is reused as
 * phi changes so the learner sees exactly how the coefficient reshapes
 * persistence — small phi snaps back fast, phi near 1 wanders like a random walk,
 * and phi ≥ 1 explodes off the chart. Sweeps in on mount/resimulate, respecting
 * prefers-reduced-motion.
 */
export function TsArSimulator({
  title = 'AR(1): how persistence depends on φ',
  phiLabel = 'AR coefficient (φ)',
  resimulateLabel = 'New shocks',
  explosiveNote = 'φ ≥ 1: unit root / explosive — the series no longer reverts',
  caption = 'X today is φ times X yesterday plus a fresh shock. Near 0 the series is almost white noise; raise φ toward 1 and shocks linger, the path wanders like a random walk; at φ = 1 you have a unit root (non-stationary) and beyond it the series explodes. The same shocks are reused so only φ changes the shape.',
  className,
}: TsArSimulatorProps) {
  const id = useId();
  const [phi, setPhi] = useState(0.6);
  const [shocks, setShocks] = useState<number[]>([]);
  const [series, setSeries] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 26;

  // Fix a shock sequence; regenerate only on "New shocks".
  useEffect(() => {
    const s: number[] = [];
    for (let t = 0; t < STEPS; t++) s.push(boxMuller());
    setShocks(s);
  }, []);

  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (seed === 0) return;
    const s: number[] = [];
    for (let t = 0; t < STEPS; t++) s.push(boxMuller());
    setShocks(s);
  }, [seed]);

  useEffect(() => {
    if (shocks.length === 0) return;
    setSeries(simulate(phi, shocks));
  }, [phi, shocks]);

  useEffect(() => {
    if (series.length === 0) return;
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
      setProgress(1 - (1 - t) * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [series]);

  const n = series.length;
  // Clamp the y-window so an explosive path still shows context.
  let yMax = 4;
  let yMin = -4;
  if (n > 0) {
    const realMax = Math.max(...series);
    const realMin = Math.min(...series);
    yMax = Math.max(4, Math.min(40, realMax * 1.1));
    yMin = Math.min(-4, Math.max(-40, realMin * 1.1));
  }

  const xToPx = (i: number) =>
    padLeft + (i / Math.max(1, n - 1)) * (W - padLeft - padRight);
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);
  const zeroY = yToPx(0);

  const drawn = Math.max(1, Math.round((n - 1) * progress));
  const toD = (): string => {
    let d = '';
    const last = Math.min(drawn, n - 1);
    for (let i = 0; i <= last; i++) {
      const yc = Math.max(yMin, Math.min(yMax, series[i]));
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(yc).toFixed(2)} `;
    }
    return d.trim();
  };

  const explosive = phi >= 1;
  const phiText = `${phi >= 0 ? '+' : ''}${phi.toFixed(2)}`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`An AR(1) sample path with coefficient phi ${phiText}, showing ${explosive ? 'an explosive, non-reverting' : 'a mean-reverting'} series over ${STEPS} steps.`}
      >
        {[yMax, 0, yMin].map((g, i) => {
          const gy = yToPx(g);
          return (
            <g key={`g-${i}`}>
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

        <line
          x1={padLeft}
          y1={zeroY}
          x2={W - padRight}
          y2={zeroY}
          stroke="var(--color-ink-400)"
          strokeDasharray="5 4"
        />

        <path
          d={toD()}
          fill="none"
          stroke={explosive ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

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

      <div className="mt-4">
        <label
          htmlFor={`${id}-phi`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{phiLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {phiText}
          </span>
        </label>
        <input
          id={`${id}-phi`}
          type="range"
          min={-0.95}
          max={1.05}
          step={0.05}
          value={phi}
          onChange={(e) => setPhi(Number(e.target.value))}
          aria-valuetext={`phi ${phiText}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {explosive && (
        <p className="mt-2 text-sm font-medium text-accent-600">{explosiveNote}</p>
      )}

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

export default TsArSimulator;
