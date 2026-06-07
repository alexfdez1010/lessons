import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsStationarityChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the non-stationary price series. */
  priceLabel?: string;
  /** Label for the stationary returns series. */
  returnsLabel?: string;
  /** Label for the toggle that switches between the two views. */
  toggleLabel?: string;
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

const STEPS = 180;
const DRIFT = 0.04; // per-step drift on log price
const VOL = 1; // per-step return shock scale

const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Build a random-walk-with-drift "price" and its first-difference "returns".
const simulate = (): { price: number[]; returns: number[] } => {
  const returns: number[] = [];
  const price: number[] = [100];
  let level = 100;
  for (let t = 0; t < STEPS; t++) {
    const r = DRIFT + VOL * boxMuller();
    returns.push(r);
    level += r;
    price.push(level);
  }
  return { price, returns };
};

/**
 * A side-by-side teaching island for stationarity: the SAME simulated series
 * shown as a wandering, trend-carrying "price" (a random walk with drift — non
 * stationary, its level and spread grow without bound) and as its first
 * difference, the "returns" (a stable cloud around a fixed mean — approximately
 * stationary). A toggle flips between the two views so the learner sees that
 * differencing a non-stationary price yields a stationary series. The series
 * sweeps in left-to-right on mount/resimulate, respecting prefers-reduced-motion.
 */
export function TsStationarityChart({
  title = 'Non-stationary price vs stationary returns',
  priceLabel = 'Price (random walk + drift)',
  returnsLabel = 'Returns (first difference)',
  toggleLabel = 'Show returns',
  resimulateLabel = 'Resimulate',
  caption = 'The same data, two faces. As a price level it wanders off and its spread keeps widening — non-stationary. Difference it once into returns and you get a flat cloud around a fixed mean with stable spread — approximately stationary. Models are built on the right-hand picture, not the left.',
  className,
}: TsStationarityChartProps) {
  const id = useId();
  const [showReturns, setShowReturns] = useState(false);
  const [seed, setSeed] = useState(0);
  const [data, setData] = useState<{ price: number[]; returns: number[] }>({
    price: [],
    returns: [],
  });
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 26;

  useEffect(() => {
    setData(simulate());
  }, [seed]);

  useEffect(() => {
    if (data.price.length === 0) return;
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
  }, [data, showReturns]);

  const series = showReturns ? data.returns : data.price;
  const n = series.length;

  let yMax = 1;
  let yMin = 0;
  if (n > 0) {
    yMax = Math.max(...series);
    yMin = Math.min(...series);
  }
  const ySpan = yMax - yMin || 1;
  yMax += ySpan * 0.1;
  yMin -= ySpan * 0.1;

  const xToPx = (i: number) =>
    padLeft + (i / Math.max(1, n - 1)) * (W - padLeft - padRight);
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const drawn = Math.max(1, Math.round((n - 1) * progress));

  const toD = (): string => {
    let d = '';
    const last = Math.min(drawn, n - 1);
    for (let i = 0; i <= last; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(series[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  // Mean reference line — flat for returns, telling for the wandering price.
  const mean = n > 0 ? series.reduce((a, b) => a + b, 0) / n : 0;
  const meanY = yToPx(mean);
  const gridValues = [yMin, mean, yMax];

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
          <span
            className={cx(
              'h-1 w-5 rounded-pill',
              showReturns ? 'bg-accent-500' : 'bg-brand-500',
            )}
            aria-hidden="true"
          />
          {showReturns ? returnsLabel : priceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t border-dashed border-ink-400"
            aria-hidden="true"
          />
          mean
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={
          showReturns
            ? 'A stationary returns series fluctuating around a fixed mean with stable spread.'
            : 'A non-stationary price series wandering away from its start with a growing level and spread.'
        }
      >
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

        {/* Mean line (dashed) */}
        <line
          x1={padLeft}
          y1={meanY}
          x2={W - padRight}
          y2={meanY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        <path
          d={toD()}
          fill="none"
          stroke={showReturns ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
          <input
            id={`${id}-toggle`}
            type="checkbox"
            checked={showReturns}
            onChange={(e) => setShowReturns(e.target.checked)}
            className="h-4 w-4 accent-accent-500"
          />
          {toggleLabel}
        </label>
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

export default TsStationarityChart;
