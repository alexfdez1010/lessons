import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LendingPoolFlowProps {
  /** Heading above the diagram. */
  title?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  /** Label for the suppliers node (depositors). */
  suppliersLabel?: string;
  /** Label for the shared liquidity-pool reservoir. */
  poolLabel?: string;
  /** Label for the borrowers node. */
  borrowersLabel?: string;
  /** Label for the supplier → pool flow. */
  depositLabel?: string;
  /** Label for the pool → borrower flow. */
  borrowLabel?: string;
  /** Label for the borrower → supplier interest flow. */
  interestLabel?: string;
  /** Label for the utilization slider. */
  utilizationLabel?: string;
  /** Readout label for the still-withdrawable share of the pool. */
  availableLabel?: string;
  /** Readout label for the borrowed share of the pool. */
  borrowedLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pctFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Number of dots flowing along each leg of the loop. */
const DOTS_PER_LEG = 4;

/**
 * Interactive DeFi lending-pool diagram. Suppliers deposit assets into a shared
 * liquidity pool, borrowers draw from it against collateral, and interest flows
 * back from borrowers to suppliers — a continuous loop. A *utilization* slider
 * (0–100%) sets how much of the pool is currently borrowed; the pool renders as
 * a reservoir whose fill is the borrowed portion, so the empty headroom is the
 * liquidity still available to withdraw (= 100% − utilization). High utilization
 * leaves little free liquidity, which the readouts and the near-empty headroom
 * make visible. Small tokens animate supplier→pool→borrower→supplier via
 * requestAnimationFrame; under `prefers-reduced-motion` the dots render static.
 */
export function LendingPoolFlow({
  title = 'How a DeFi lending pool works',
  caption =
    'Suppliers pour assets into one shared pool; borrowers draw from it against collateral and pay interest, which loops back to the suppliers. The slider is utilization — the borrowed share of the pool. Whatever is left is what suppliers can still withdraw, so the busier the pool, the less free liquidity remains.',
  suppliersLabel = 'Suppliers',
  poolLabel = 'Liquidity pool',
  borrowersLabel = 'Borrowers',
  depositLabel = 'Deposit',
  borrowLabel = 'Borrow',
  interestLabel = 'Interest',
  utilizationLabel = 'Utilization',
  availableLabel = 'Available to withdraw',
  borrowedLabel = 'Borrowed',
  className,
}: LendingPoolFlowProps) {
  const id = useId();
  const [utilization, setUtilization] = useState(60);
  // Animation phase 0 → 1, advanced by rAF; mapped onto each flow leg.
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 260;

  const borrowedPct = utilization;
  const availablePct = 100 - utilization;

  // Node anchor points (centres) within the viewBox.
  const supplier = { x: 78, y: 70 };
  const borrower = { x: W - 78, y: 70 };
  const pool = { x: W / 2, y: 196 };

  // Reservoir geometry (the pool tank).
  const tank = { x: pool.x - 70, y: pool.y - 48, w: 140, h: 96 };
  const fillH = (tank.h * borrowedPct) / 100;
  const fillY = tank.y + (tank.h - fillH);

  // Flow legs: each is a quadratic curve sampled by a t ∈ [0,1] helper.
  type Pt = { x: number; y: number };
  const onQuad = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
    const mt = 1 - t;
    return {
      x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
    };
  };

  const depositCtrl = { x: (supplier.x + pool.x) / 2 - 30, y: 150 };
  const borrowCtrl = { x: (pool.x + borrower.x) / 2 + 30, y: 150 };
  const interestCtrl = { x: W / 2, y: 18 };

  const depositPath = `M ${supplier.x} ${supplier.y} Q ${depositCtrl.x} ${depositCtrl.y} ${pool.x} ${pool.y}`;
  const borrowPath = `M ${pool.x} ${pool.y} Q ${borrowCtrl.x} ${borrowCtrl.y} ${borrower.x} ${borrower.y}`;
  const interestPath = `M ${borrower.x} ${borrower.y} Q ${interestCtrl.x} ${interestCtrl.y} ${supplier.x} ${supplier.y}`;

  // Continuous flowing-dots loop. Skipped (static) under reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase(0);
      return;
    }
    const period = 2600; // ms for one full leg
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      setPhase(((ts - startTs) % period) / period);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Evenly-spaced dots along a leg, each offset so the stream looks continuous.
  const dotsOn = (a: Pt, c: Pt, b: Pt): Pt[] =>
    Array.from({ length: DOTS_PER_LEG }, (_, i) => {
      const t = (phase + i / DOTS_PER_LEG) % 1;
      return onQuad(a, c, b, t);
    });

  const depositDots = dotsOn(supplier, depositCtrl, pool);
  const borrowDots = dotsOn(pool, borrowCtrl, borrower);
  const interestDots = dotsOn(borrower, interestCtrl, supplier);

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
          {utilizationLabel}: {pctFmt.format(utilization)}%
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-full bg-brand-500" aria-hidden="true" />
          {depositLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-full bg-ink-500" aria-hidden="true" />
          {borrowLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-full bg-accent-500" aria-hidden="true" />
          {interestLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. ${suppliersLabel} deposit into the ${poolLabel}; ${borrowersLabel} borrow from it and pay ${interestLabel} back to suppliers. At ${pctFmt.format(
          utilization,
        )}% ${utilizationLabel.toLowerCase()}, ${pctFmt.format(
          borrowedPct,
        )}% of the pool is ${borrowedLabel.toLowerCase()} and ${pctFmt.format(
          availablePct,
        )}% is ${availableLabel.toLowerCase()}.`}
      >
        {/* Flow paths (under the nodes) */}
        <path d={interestPath} fill="none" stroke="var(--color-ink-200)" strokeWidth={2} strokeDasharray="5 5" />
        <path d={depositPath} fill="none" stroke="var(--color-ink-200)" strokeWidth={2} strokeDasharray="5 5" />
        <path d={borrowPath} fill="none" stroke="var(--color-ink-200)" strokeWidth={2} strokeDasharray="5 5" />

        {/* Flowing dots: deposit (supplier → pool) */}
        {depositDots.map((p, i) => (
          <circle key={`d${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-brand-500)" />
        ))}
        {/* Flowing dots: borrow (pool → borrower) */}
        {borrowDots.map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-ink-500)" />
        ))}
        {/* Flowing dots: interest (borrower → supplier) */}
        {interestDots.map((p, i) => (
          <circle key={`i${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-accent-500)" />
        ))}

        {/* Suppliers node */}
        <g>
          <circle cx={supplier.x} cy={supplier.y} r={34} fill="var(--color-surface)" stroke="var(--color-brand-500)" strokeWidth={2.5} />
          <text x={supplier.x} y={supplier.y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink-900)">
            {suppliersLabel}
          </text>
        </g>

        {/* Borrowers node */}
        <g>
          <circle cx={borrower.x} cy={borrower.y} r={34} fill="var(--color-surface)" stroke="var(--color-ink-500)" strokeWidth={2.5} />
          <text x={borrower.x} y={borrower.y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink-900)">
            {borrowersLabel}
          </text>
        </g>

        {/* Liquidity-pool reservoir: fill = borrowed, headroom = available */}
        <g>
          {/* Headroom band (available to withdraw) */}
          <rect
            x={tank.x}
            y={tank.y}
            width={tank.w}
            height={tank.h}
            rx={10}
            fill="var(--color-surface)"
            stroke="var(--color-ink-200)"
            strokeWidth={2}
          />
          {/* Borrowed fill rising from the bottom */}
          <rect
            x={tank.x}
            y={fillY}
            width={tank.w}
            height={fillH}
            rx={fillH > 12 ? 8 : 0}
            fill="var(--color-brand-500)"
            opacity={0.85}
          />
          {/* Surface line where borrowed meets available */}
          {borrowedPct > 0 && borrowedPct < 100 && (
            <line
              x1={tank.x}
              y1={fillY}
              x2={tank.x + tank.w}
              y2={fillY}
              stroke="var(--color-surface)"
              strokeWidth={1.5}
            />
          )}
          <text x={pool.x} y={tank.y - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink-900)">
            {poolLabel}
          </text>
        </g>
      </svg>

      {/* Utilization slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-util`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{utilizationLabel}</span>
          <span className="font-mono text-ink-900">{pctFmt.format(utilization)}%</span>
        </label>
        <input
          id={`${id}-util`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={utilization}
          onChange={(e) => setUtilization(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{availableLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {pctFmt.format(availablePct)}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{borrowedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pctFmt.format(borrowedPct)}%
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LendingPoolFlow;
