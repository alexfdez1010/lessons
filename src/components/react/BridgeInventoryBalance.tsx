import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BridgeInventoryBalanceProps {
  /** Heading above the visualization. */
  title?: string;
  /** Label for the Chain A inventory bar. */
  chainALabel?: string;
  /** Label for the Chain B inventory bar. */
  chainBLabel?: string;
  /** Label for the net-flow slider. */
  netFlowLabel?: string;
  /** Readout label for total capital locked across both chains. */
  totalLockedLabel?: string;
  /** Readout label for the rebalance cost to recenter. */
  rebalanceCostLabel?: string;
  /** Warning shown when one side dips below the rebalance threshold. */
  rebalanceWarning?: string;
  /** Warning shown when one side hits exactly zero (cannot trade that direction). */
  capacityWarning?: string;
  /** Status-chip text shown when both sides are healthy. */
  balancedLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  /** Unit suffix appended to every quantity (e.g. ' USDC'). */
  unitSuffix?: string;
  /** Starting inventory on each chain (units). Defaults to `1000`. */
  startingInventory?: number;
  /** Below this fraction of starting inventory, a rebalance is flagged. Defaults to `0.1` (10%). */
  rebalanceThresholdPct?: number;
  /** Bridge fee paid to rebridge inventory back across, as a fraction. Defaults to `0.0005` (0.05%). */
  bridgeFeePct?: number;
  className?: string;
}

const fmt = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Cross-chain "inventory" (liquidity-network) bridge arbitrage made visceral.
 *
 * A cross-chain arbitrageur using an inventory bridge does NOT move the asset
 * atomically — they pre-position a stock of the asset on BOTH chains and settle
 * each trade out of local inventory. Every same-direction arb delivers to the
 * destination chain (draining its inventory) and accumulates on the source chain.
 * Repeat the same direction and inventory drifts: one side fills toward 2× the
 * start while the other depletes toward zero.
 *
 * The learner drags a single `netFlow` slider (the cumulative net inventory that
 * has shifted from one chain to the other this period) and watches the two
 * inventory bars move in opposite directions. Two hard truths surface:
 *
 *  1. CAPACITY LIMIT — once the depleting side hits zero you simply cannot trade
 *     that direction anymore. Throughput is capped by your inventory, not by the
 *     size of the opportunity.
 *  2. REBALANCING COST + CAPITAL DRAG — to keep trading you must rebridge
 *     inventory back across, which costs a bridge fee (|netFlow| × bridgeFeePct)
 *     and takes time; meanwhile the *total* capital you must lock = inventory on
 *     A + inventory on B stays constant at 2× the start and earns nothing. That
 *     idle, rebalancing-hungry capital is exactly what makes inventory-bridge
 *     cross-chain arb the non-atomic, CEX-DEX-like cousin of capital-light atomic
 *     single-chain arb, where a flash loan supplies the capital for free inside
 *     one transaction.
 *
 * Fully locale-agnostic: every user-facing string is a prop with an English
 * default. No animation loops; the single transition respects reduced motion via
 * global CSS. No external libraries.
 */
export function BridgeInventoryBalance({
  title = 'Pre-positioned inventory drains as you arb',
  chainALabel = 'Chain A inventory',
  chainBLabel = 'Chain B inventory',
  netFlowLabel = 'Cumulative net arb flow (A ← B)',
  totalLockedLabel = 'Total capital locked',
  rebalanceCostLabel = 'Rebalance cost to recenter',
  rebalanceWarning = 'Rebalance needed — one side nearly empty',
  capacityWarning = 'Capacity reached — cannot trade this direction',
  balancedLabel = 'Both sides stocked',
  caption =
    'Each cross-chain arb delivers to one chain and piles up on the other, so same-direction trades drain one inventory toward zero. Hit zero and your throughput is capped — not by the opportunity, but by your stock. To keep going you must rebridge inventory back (a fee, plus settlement time), and the whole time your total capital sits locked on both chains earning nothing. That capital drag is the opposite of capital-light atomic arb, where a flash loan funds the trade for free inside one transaction.',
  unitSuffix = '',
  startingInventory = 1000,
  rebalanceThresholdPct = 0.1,
  bridgeFeePct = 0.0005,
  className,
}: BridgeInventoryBalanceProps) {
  const id = useId();
  const [netFlow, setNetFlow] = useState(0);

  const clamp = (v: number): number => Math.min(2 * startingInventory, Math.max(0, v));
  // Chain B drains as net flow moves to A; Chain A fills by the same amount.
  const invB = clamp(startingInventory - netFlow);
  const invA = clamp(startingInventory + netFlow);

  const threshold = startingInventory * rebalanceThresholdPct;
  const totalLocked = invA + invB; // constant 2× start — the idle capital drag
  const rebalanceCost = Math.abs(netFlow) * bridgeFeePct;

  const lowSide = invA < invB ? invA : invB;
  const capacityReached = lowSide <= 0;
  const rebalanceNeeded = lowSide < threshold;
  const warning = capacityReached ? capacityWarning : rebalanceNeeded ? rebalanceWarning : null;
  const healthy = !rebalanceNeeded;

  // Bars as a proportion of 2× start (so a full side = 100%, start = 50%).
  const span = 2 * startingInventory;
  const pctA = useMemo(() => (invA / span) * 100, [invA, span]);
  const pctB = useMemo(() => (invB / span) * 100, [invB, span]);
  const thresholdPct = (threshold / span) * 100;

  const ariaLabel =
    `${title}. ${chainALabel}: ${fmt(invA)}${unitSuffix}. ${chainBLabel}: ${fmt(invB)}${unitSuffix}. ` +
    (warning ? warning : balancedLabel);

  const bars: Array<{ key: string; label: string; value: number; pct: number }> = [
    { key: 'a', label: chainALabel, value: invA, pct: pctA },
    { key: 'b', label: chainBLabel, value: invB, pct: pctB },
  ];

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
            'rounded-pill px-3 py-1 font-mono text-sm font-medium',
            healthy ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
        >
          {healthy ? balancedLabel : capacityReached ? capacityWarning : rebalanceWarning}
        </span>
      </figcaption>

      {/* Inventory bars */}
      <div className="mt-4 space-y-3" role="img" aria-label={ariaLabel}>
        {bars.map((bar) => {
          const empty = bar.value <= 0;
          const low = bar.value < threshold;
          return (
            <div key={bar.key}>
              <div className="flex items-center justify-between text-sm text-ink-700">
                <span>{bar.label}</span>
                <span className="font-mono text-ink-900">
                  {fmt(bar.value)}
                  {unitSuffix}
                </span>
              </div>
              <div className="relative mt-1.5 h-6 w-full overflow-hidden rounded-pill bg-surface-sunken/40 border border-ink-100">
                <div
                  className={cx(
                    'h-full rounded-pill transition-all duration-300',
                    empty || low ? 'bg-warning' : 'bg-brand-500',
                  )}
                  style={{ width: `${bar.pct}%` }}
                />
                {/* Rebalance threshold marker */}
                <div
                  className="absolute inset-y-0 w-px bg-warning"
                  style={{ left: `${thresholdPct}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Net-flow slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-flow`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{netFlowLabel}</span>
          <span className="font-mono text-ink-900">
            {netFlow >= 0 ? '+' : ''}
            {fmt(netFlow)}
            {unitSuffix}
          </span>
        </label>
        <input
          id={`${id}-flow`}
          type="range"
          min={-startingInventory}
          max={startingInventory}
          step={startingInventory / 100}
          value={netFlow}
          onChange={(e) => setNetFlow(Number(e.target.value))}
          aria-label={netFlowLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Warning banner */}
      {warning ? (
        <div
          className="mt-4 rounded-card border border-warning/40 bg-warning/10 px-4 py-3"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-warning">⚠ {warning}</p>
        </div>
      ) : null}

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{chainALabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(invA)}
            {unitSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{chainBLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(invB)}
            {unitSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalLockedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmt(totalLocked)}
            {unitSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{rebalanceCostLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              rebalanceCost > 0 ? 'text-warning' : 'text-ink-900',
            )}
          >
            {fmt(rebalanceCost)}
            {unitSuffix}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BridgeInventoryBalance;
