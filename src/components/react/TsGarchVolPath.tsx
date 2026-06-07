import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsGarchVolPathProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the returns series. */
  returnsLabel?: string;
  /** Label for the conditional-volatility line. */
  volLabel?: string;
  /** Label for the persistence (alpha + beta) slider. */
  persistenceLabel?: string;
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

const STEPS = 200;

const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// GARCH(1,1): var_t = omega + alpha·r_{t-1}² + beta·var_{t-1}.
// We split persistence (alpha+beta) and fix alpha as a fraction of it.
const simulate = (
  persistence: number,
  z: number[],
): { returns: number[]; vol: number[] } => {
  const longRunVar = 1; // target unconditional variance ≈ 1
  const alpha = Math.min(0.2, persistence * 0.3);
  const beta = persistence - alpha;
  const omega = longRunVar * (1 - persistence);
  const returns: number[] = [];
  const vol: number[] = [];
  let varT = longRunVar;
  for (let t = 0; t < STEPS; t++) {
    const r = Math.sqrt(varT) * z[t];
    returns.push(r);
    vol.push(Math.sqrt(varT));
    varT = omega + alpha * r * r + beta * varT;
  }
  return { returns, vol };
};

/**
 * A GARCH(1,1) volatility-clustering visual. Returns (the spiky bars) are drawn
 * with a time-varying conditional standard deviation; the smooth line overlay is
 * that conditional volatility. A persistence slider (α + β) controls how long a
 * volatility shock lingers: low persistence gives near-constant vol and no
 * clustering; high persistence (near 1) makes calm and turbulent stretches bunch
 * together — the hallmark of real markets. The same standardized shocks are
 * reused across slider moves so only persistence changes the texture. Animated
 * reveal respects prefers-reduced-motion.
 */
export function TsGarchVolPath({
  title = 'GARCH(1,1): volatility clustering',
  returnsLabel = 'Returns',
  volLabel = 'Conditional volatility (σₜ)',
  persistenceLabel = 'Persistence (α + β)',
  resimulateLabel = 'Resimulate',
  caption = 'Each return is a fresh standardized shock scaled by the current conditional volatility. Crank persistence (α + β) toward 1 and a big move inflates tomorrow’s volatility, which inflates the next — calm and storm cluster into runs. Drop persistence and the clustering melts into uniform noise.',
  className,
}: TsGarchVolPathProps) {
  const id = useId();
  const [persistence, setPersistence] = useState(0.9);
  const [z, setZ] = useState<number[]>([]);
  const [data, setData] = useState<{ returns: number[]; vol: number[] }>({
    returns: [],
    vol: [],
  });
  const [progress, setProgress] = useState(0);
  const [seed, setSeed] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 26;

  useEffect(() => {
    const arr: number[] = [];
    for (let t = 0; t < STEPS; t++) arr.push(boxMuller());
    setZ(arr);
  }, [seed]);

  useEffect(() => {
    if (z.length === 0) return;
    setData(simulate(persistence, z));
  }, [persistence, z]);

  useEffect(() => {
    if (data.returns.length === 0) return;
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
  }, [data]);

  const n = data.returns.length;
  const absMax = n > 0 ? Math.max(4, ...data.returns.map((r) => Math.abs(r))) : 4;
  const yMax = absMax;
  const yMin = -absMax;

  const xToPx = (i: number) =>
    padLeft + (i / Math.max(1, n - 1)) * (W - padLeft - padRight);
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);
  const zeroY = yToPx(0);

  const drawn = Math.max(1, Math.round(n * progress));

  const volUpD = (): string => {
    let d = '';
    const last = Math.min(drawn, n) - 1;
    for (let i = 0; i <= last; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(data.vol[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-1.5 rounded bg-brand-500" aria-hidden="true" />
          {returnsLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {volLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A GARCH(1,1) returns series with persistence ${persistence.toFixed(2)}, showing volatility clustering: stretches of large moves alternating with calm, with a conditional-volatility envelope overlaid.`}
      >
        <line
          x1={padLeft}
          y1={zeroY}
          x2={W - padRight}
          y2={zeroY}
          stroke="var(--color-ink-300)"
        />

        {/* Return bars */}
        {data.returns.slice(0, drawn).map((r, i) => (
          <line
            key={`r-${i}`}
            x1={xToPx(i)}
            y1={zeroY}
            x2={xToPx(i)}
            y2={yToPx(r)}
            stroke="var(--color-brand-500)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
        ))}

        {/* Conditional volatility (upper envelope) */}
        <path
          d={volUpD()}
          fill="none"
          stroke="var(--color-accent-500)"
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
          htmlFor={`${id}-pers`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{persistenceLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {persistence.toFixed(2)}
          </span>
        </label>
        <input
          id={`${id}-pers`}
          type="range"
          min={0.1}
          max={0.99}
          step={0.01}
          value={persistence}
          onChange={(e) => setPersistence(Number(e.target.value))}
          aria-valuetext={`persistence ${persistence.toFixed(2)}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

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

export default TsGarchVolPath;
