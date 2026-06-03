import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BorrowPowerBarProps {
  /** Heading above the visual. */
  title?: string;
  /** One-line takeaway shown under the bar. */
  caption?: string;
  /** Label for the collateral-value slider. */
  collateralLabel?: string;
  /** Label for the borrowed-amount slider and readout. */
  borrowedLabel?: string;
  /** Readout label for the maximum you can borrow (collateral × max LTV). */
  maxBorrowLabel?: string;
  /** Readout label for the headroom still available to borrow. */
  availableLabel?: string;
  /** Readout label for the current loan-to-value ratio. */
  ltvLabel?: string;
  /** Legend/marker label for the max-LTV line. */
  maxLtvLabel?: string;
  /** Legend/marker label for the liquidation-threshold line. */
  liqThresholdLabel?: string;
  /** Readout label for the buffer (in borrow terms) before liquidation. */
  bufferLabel?: string;
  /** Currency unit prefix for amounts. Defaults to `'$'`. */
  unit?: string;
  /** Maximum loan-to-value as a fraction (e.g. 0.75 = 75%). Defaults to `0.75`. */
  maxLtv?: number;
  /** Liquidation threshold as a fraction (e.g. 0.80 = 80%). Defaults to `0.80`. */
  liqThreshold?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const moneyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Interactive collateral / LTV / borrowing-power bar for over-collateralized
 * DeFi lending. The learner drags (1) how much collateral they've deposited and
 * (2) how much they've borrowed against it. The component derives the
 * max borrow (`collateral × maxLtv`), the liquidation point in borrow terms
 * (`collateral × liqThreshold`), the current LTV (`borrowed / collateral`) and
 * the headroom still available to borrow.
 *
 * The horizontal bar spans 0 → collateral value (the full collateral capacity).
 * The borrowed portion is filled and color-coded: accent (safe) while the LTV
 * sits at or below max LTV, brand (warning) between max LTV and the liquidation
 * threshold, and red (danger) once it reaches the threshold. Two vertical
 * markers pin the max-LTV line and the higher liquidation-threshold line.
 * The fill width transitions smoothly, but the transition is skipped under
 * `prefers-reduced-motion`.
 */
export function BorrowPowerBar({
  title = 'Collateral, LTV and borrowing power',
  caption = 'You deposit collateral, then borrow against a fraction of it. Max LTV caps how much you can pull out; cross the higher liquidation threshold and your collateral gets sold off to repay the debt. Borrowing power rises with collateral — and shrinks every time the collateral price drops.',
  collateralLabel = 'Collateral value',
  borrowedLabel = 'Borrowed',
  maxBorrowLabel = 'Max you can borrow',
  availableLabel = 'Still available',
  ltvLabel = 'Current LTV',
  maxLtvLabel = 'Max LTV',
  liqThresholdLabel = 'Liquidation threshold',
  bufferLabel = 'Buffer to liquidation',
  unit = '$',
  maxLtv = 0.75,
  liqThreshold = 0.8,
  className,
}: BorrowPowerBarProps) {
  const id = useId();
  const [collateral, setCollateral] = useState(10_000);
  const [borrowed, setBorrowed] = useState(5_000);

  const money = (value: number): string => `${unit}${moneyFmt.format(value)}`;

  const maxBorrow = collateral * maxLtv;
  const liqPoint = collateral * liqThreshold;
  const ltv = collateral > 0 ? borrowed / collateral : 0;
  const available = Math.max(0, maxBorrow - borrowed);
  const buffer = liqPoint - borrowed; // borrow headroom before liquidation (can go negative)

  // Bar geometry: 0 → collateral value, all as percentages of capacity.
  const borrowedPct = collateral > 0 ? Math.min(100, (borrowed / collateral) * 100) : 0;
  const maxLtvPct = Math.min(100, maxLtv * 100);
  const liqPct = Math.min(100, liqThreshold * 100);

  // Risk state drives the fill color.
  const state: 'safe' | 'warning' | 'danger' =
    ltv >= liqThreshold ? 'danger' : ltv > maxLtv ? 'warning' : 'safe';

  const fillClass =
    state === 'danger'
      ? 'bg-red-500'
      : state === 'warning'
        ? 'bg-brand-500'
        : 'bg-accent-500';

  const badgeClass =
    state === 'danger'
      ? 'bg-red-500'
      : state === 'warning'
        ? 'bg-brand-600'
        : 'bg-accent-500';

  const transitionClass = prefersReducedMotion()
    ? ''
    : 'transition-[width] duration-300 ease-out';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            badgeClass,
          )}
        >
          {ltvLabel}: {pctFmt.format(ltv * 100)}%
        </span>
      </figcaption>

      {/* Controls */}
      <div className="mt-4 space-y-5">
        {/* Collateral value */}
        <div>
          <label
            htmlFor={`${id}-collateral`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{collateralLabel}</span>
            <span className="font-mono text-ink-900">{money(collateral)}</span>
          </label>
          <input
            id={`${id}-collateral`}
            type="range"
            min={1_000}
            max={50_000}
            step={500}
            value={collateral}
            onChange={(e) => setCollateral(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        {/* Borrowed amount */}
        <div>
          <label
            htmlFor={`${id}-borrowed`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{borrowedLabel}</span>
            <span className="font-mono text-ink-900">{money(borrowed)}</span>
          </label>
          <input
            id={`${id}-borrowed`}
            type="range"
            min={0}
            max={50_000}
            step={500}
            value={borrowed}
            onChange={(e) => setBorrowed(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden="true" />
          {borrowedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 border-l-2 border-dashed border-brand-600" aria-hidden="true" />
          {maxLtvLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 border-l-2 border-dashed border-red-500" aria-hidden="true" />
          {liqThresholdLabel}
        </span>
      </div>

      {/* Borrowing-capacity bar */}
      <div
        role="img"
        aria-label={`${collateralLabel}: ${money(collateral)}. ${borrowedLabel}: ${money(
          borrowed,
        )} (${pctFmt.format(ltv * 100)}% LTV). ${maxBorrowLabel}: ${money(
          maxBorrow,
        )} at ${pctFmt.format(maxLtv * 100)}% ${maxLtvLabel}. ${liqThresholdLabel} at ${pctFmt.format(
          liqThreshold * 100,
        )}% (${money(liqPoint)}).`}
        className="relative mt-3 h-12 w-full overflow-hidden rounded-card border border-ink-100 bg-surface-sunken/40"
      >
        {/* Borrowed fill */}
        <div
          className={cx('h-full', fillClass, transitionClass)}
          style={{ width: `${borrowedPct}%` }}
        />
        {/* Max-LTV marker */}
        <span
          aria-hidden="true"
          className="absolute top-0 h-full border-l-2 border-dashed border-brand-600"
          style={{ left: `${maxLtvPct}%` }}
        />
        {/* Liquidation-threshold marker */}
        <span
          aria-hidden="true"
          className="absolute top-0 h-full border-l-2 border-dashed border-red-500"
          style={{ left: `${liqPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-ink-500">
        <span>{unit}0</span>
        <span>{money(collateral)}</span>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{borrowedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(borrowed)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maxBorrowLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(maxBorrow)}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {pctFmt.format(maxLtv * 100)}% {maxLtvLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{availableLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {money(available)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ltvLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              state === 'danger'
                ? 'text-red-600'
                : state === 'warning'
                  ? 'text-brand-700'
                  : 'text-ink-900',
            )}
          >
            {pctFmt.format(ltv * 100)}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bufferLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              buffer <= 0 ? 'text-red-600' : 'text-ink-900',
            )}
          >
            {money(Math.max(0, buffer))}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {pctFmt.format(liqThreshold * 100)}% {liqThresholdLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BorrowPowerBar;
