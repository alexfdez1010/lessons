import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DurationBalanceProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the coupon-rate slider. */
  couponRateLabel?: string;
  /** Label for the maturity (years) slider. */
  yearsLabel?: string;
  /** Label for the market-yield slider. */
  yieldLabel?: string;
  /** Readout label for Macaulay duration. */
  macaulayLabel?: string;
  /** Readout label for modified duration. */
  modifiedLabel?: string;
  /** Legend label for the present-value bars. */
  cashFlowLabel?: string;
  /** Readout label for the price-sensitivity (%/+1% yield) figure. */
  sensitivityLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to a duration value in years (e.g. `'yr'`). */
  yearsUnit?: string;
  /** Initial coupon rate as a fraction (0–0.10; 0 = zero-coupon). Defaults to `0.05`. */
  couponRate?: number;
  /** Initial maturity in years (1–30). Defaults to `10`. */
  years?: number;
  /** Initial market yield as a fraction (0.01–0.10). Defaults to `0.05`. */
  yield?: number;
  /** Coupon payments per year. Defaults to `1`. */
  frequency?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmtYears = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const fmtPct = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

interface DurationResult {
  /** Time (in years) and present value of each cash flow. */
  flows: Array<{ t: number; pv: number }>;
  macaulay: number;
  modified: number;
  price: number;
}

/**
 * Compute the present-valued cash flows and Macaulay/modified duration of a
 * plain vanilla coupon bond with face value 100.
 */
function computeDuration(
  couponRate: number,
  years: number,
  marketYield: number,
  frequency: number,
): DurationResult {
  const face = 100;
  const n = Math.max(1, Math.round(years * frequency));
  const periodRate = marketYield / frequency;
  const couponPerPeriod = (couponRate * face) / frequency;

  const flows: Array<{ t: number; pv: number }> = [];
  let price = 0;
  let weightedTime = 0;

  for (let k = 1; k <= n; k++) {
    const cash = couponPerPeriod + (k === n ? face : 0);
    const pv = cash / Math.pow(1 + periodRate, k);
    const tYears = k / frequency;
    flows.push({ t: tYears, pv });
    price += pv;
    weightedTime += tYears * pv;
  }

  const macaulay = price > 0 ? weightedTime / price : years;
  const modified = macaulay / (1 + periodRate);
  return { flows, macaulay, modified, price };
}

/**
 * Duration as the BALANCE POINT of a bond's present-valued cash flows. A
 * horizontal time axis runs 0→maturity; at each payment date a bar rises to the
 * present value of that cash flow (small coupons, a tall final coupon+face). A
 * fulcrum/triangle sits on the axis exactly at the Macaulay duration — the point
 * where the cash-flow see-saw balances. Drag coupon, maturity and yield: raise
 * the coupon and weight shifts earlier so the fulcrum slides left (shorter
 * duration); a zero-coupon bond balances at its maturity. The fulcrum animates
 * to its new spot and the duration/sensitivity readouts update live. Respects
 * `prefers-reduced-motion` (jumps straight to the final position).
 */
export function DurationBalance({
  title = 'Duration is the balance point',
  couponRateLabel = 'Coupon rate',
  yearsLabel = 'Maturity (years)',
  yieldLabel = 'Market yield',
  macaulayLabel = 'Macaulay duration',
  modifiedLabel = 'Modified duration',
  cashFlowLabel = 'Present value of each cash flow',
  sensitivityLabel = 'Price change per +1% yield',
  caption = 'Each bar is the present value of a cash flow; the triangle sits where they balance. A bigger coupon front-loads the weight, so the fulcrum slides left and duration shortens. A zero-coupon bond balances right at maturity.',
  yearsUnit = 'yr',
  couponRate = 0.05,
  years = 10,
  yield: initialYield = 0.05,
  frequency = 1,
  className,
}: DurationBalanceProps) {
  const id = useId();
  const [couponState, setCouponState] = useState(couponRate);
  const [yearsState, setYearsState] = useState(years);
  const [yieldState, setYieldState] = useState(initialYield);
  const [fulcrumProgress, setFulcrumProgress] = useState(1); // 0 → 1 (slide animation)
  const rafRef = useRef<number | null>(null);
  const prevDurationRef = useRef<number>(0);

  const W = 520;
  const H = 220;
  const padX = 16;
  const padTop = 14;
  const axisY = H - 46; // baseline / time axis
  const barAreaH = axisY - padTop;

  const { flows, macaulay, modified } = computeDuration(
    couponState,
    yearsState,
    yieldState,
    frequency,
  );

  const maxPv = Math.max(...flows.map((f) => f.pv), 1);
  const innerW = W - padX * 2;

  const x = (tYears: number) => padX + (tYears / yearsState) * innerW;
  const barHeight = (pv: number) => (pv / maxPv) * barAreaH;

  // Animate the fulcrum sliding from its previous position to the new one.
  const [animDuration, setAnimDuration] = useState(macaulay);
  useEffect(() => {
    const from = prevDurationRef.current;
    const to = macaulay;
    prevDurationRef.current = to;

    if (prefersReducedMotion()) {
      setAnimDuration(to);
      setFulcrumProgress(1);
      return;
    }
    setFulcrumProgress(0);
    const totalMs = 550;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / totalMs);
      // ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimDuration(from + (to - from) * eased);
      setFulcrumProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [macaulay]);

  const fulcrumX = x(animDuration);
  const sensitivity = -modified * 0.01 * 100; // percent for +1% yield move

  const couponPct = Math.round(couponState * 1000) / 10;
  const yieldPct = Math.round(yieldState * 1000) / 10;

  // A handful of axis ticks across the time span.
  const tickCount = Math.min(6, Math.max(2, yearsState));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((i / tickCount) * yearsState),
  );

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
          {macaulayLabel}: {fmtYears(macaulay)} {yearsUnit}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {cashFlowLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent"
            style={{ borderTopColor: 'var(--color-accent-500)' }}
            aria-hidden="true"
          />
          {macaulayLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a bond with a ${fmtPct(
          couponPct,
        )}% coupon, ${yearsState}-year maturity and ${fmtPct(
          yieldPct,
        )}% yield has its present-valued cash flows balancing at a Macaulay duration of ${fmtYears(
          macaulay,
        )} years.`}
      >
        {/* Faint balance beam line */}
        <line
          x1={padX}
          y1={axisY}
          x2={W - padX}
          y2={axisY}
          stroke="var(--color-ink-200)"
        />

        {/* Cash-flow bars (present values) */}
        {flows.map((f, i) => {
          const h = barHeight(f.pv);
          const isFinal = i === flows.length - 1;
          const bx = x(f.t);
          // Bar width scales down as the count grows; stays visible.
          const bw = Math.max(2, Math.min(14, innerW / (flows.length * 1.6)));
          return (
            <rect
              key={`${i}-${f.t}`}
              x={bx - bw / 2}
              y={axisY - h}
              width={bw}
              height={Math.max(0.5, h)}
              rx={1.5}
              fill={isFinal ? 'var(--color-brand-600)' : 'var(--color-brand-500)'}
              opacity={isFinal ? 1 : 0.85}
            />
          );
        })}

        {/* Axis ticks + labels */}
        {ticks.map((tk, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={x(tk)}
              y1={axisY}
              x2={x(tk)}
              y2={axisY + 5}
              stroke="var(--color-ink-200)"
            />
            <text
              x={x(tk)}
              y={axisY + 18}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-ink-500)"
              fontFamily="var(--font-mono, monospace)"
            >
              {tk}
            </text>
          </g>
        ))}

        {/* Fulcrum / balance triangle at the duration */}
        <g
          style={{
            transition: fulcrumProgress >= 1 ? undefined : 'none',
          }}
        >
          {/* vertical guide */}
          <line
            x1={fulcrumX}
            y1={padTop}
            x2={fulcrumX}
            y2={axisY}
            stroke="var(--color-accent-500)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          {/* triangle pointing up to the beam */}
          <path
            d={`M ${fulcrumX} ${axisY} L ${fulcrumX - 9} ${axisY + 16} L ${
              fulcrumX + 9
            } ${axisY + 16} Z`}
            fill="var(--color-accent-500)"
          />
        </g>
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-coupon`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{couponRateLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(couponPct)}%</span>
          </label>
          <input
            id={`${id}-coupon`}
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={couponPct}
            onChange={(e) => setCouponState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-years`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yearsLabel}</span>
            <span className="font-mono text-ink-900">{yearsState}</span>
          </label>
          <input
            id={`${id}-years`}
            type="range"
            min={1}
            max={30}
            step={1}
            value={yearsState}
            onChange={(e) => setYearsState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-yield`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yieldLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(yieldPct)}%</span>
          </label>
          <input
            id={`${id}-yield`}
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={yieldPct}
            onChange={(e) => setYieldState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{macaulayLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmtYears(macaulay)} {yearsUnit}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{modifiedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmtYears(modified)} {yearsUnit}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sensitivityLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {fmtPct(sensitivity)}%
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DurationBalance;
