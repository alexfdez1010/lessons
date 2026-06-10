import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AdverseSelectionFlowProps {
  /** Heading above the visualization. */
  title?: string;
  /** Label for the informed-trader-share slider. */
  informedShareLabel?: string;
  /** Label for the spread slider. */
  spreadLabel?: string;
  /** Label for the uninformed-flow group. */
  uninformedLabel?: string;
  /** Label for the informed-flow group. */
  informedLabel?: string;
  /** Label for the per-uninformed-trade profit readout. */
  profitPerUninformedLabel?: string;
  /** Label for the per-informed-trade loss readout. */
  lossPerInformedLabel?: string;
  /** Label for the net-edge-per-trade readout. */
  netEdgeLabel?: string;
  /** Label for the break-even-spread readout. */
  breakEvenLabel?: string;
  /** Badge text when the maker is losing money on average. */
  bleedingLabel?: string;
  /** Badge text when the maker is profitable on average. */
  profitableLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to cent/dollar readouts. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

/**
 * Adverse-selection flow visualizer. A market maker earns half the spread from
 * every *uninformed* trader (noise flow that has no edge) but loses to every
 * *informed* trader, who only trades when they know the price is about to move
 * the maker's way. The learner drags two sliders — the share of flow that is
 * informed, and the quoted half-spread — and a row of incoming "orders" colours
 * in (uninformed = profitable green-ish, informed = toxic). Readouts compute the
 * expected profit per uninformed fill, the expected loss per informed fill, the
 * blended net edge per trade, and the break-even spread at which the maker stops
 * bleeding. This makes the core adverse-selection result tangible: the more
 * toxic the flow, the wider the maker must quote just to survive. Pure
 * arithmetic + a static order grid, so reduced motion needs no special path.
 * All strings are props; worked figures live in the MDX prose.
 */
export function AdverseSelectionFlow({
  title = 'Why informed traders force wider spreads',
  informedShareLabel = 'Share of flow that is informed',
  spreadLabel = 'Quoted half-spread (¢)',
  uninformedLabel = 'Uninformed (noise) flow',
  informedLabel = 'Informed (toxic) flow',
  profitPerUninformedLabel = 'Profit per uninformed fill',
  lossPerInformedLabel = 'Loss per informed fill',
  netEdgeLabel = 'Net edge per trade',
  breakEvenLabel = 'Break-even informed share',
  bleedingLabel = 'Maker bleeding',
  profitableLabel = 'Maker profitable',
  caption = 'The maker pockets the half-spread from uninformed flow but hands a bigger move to anyone who is informed. Raise the toxic share and the net edge collapses — the only defence is to widen the spread, which every other trader then pays for.',
  currencyPrefix = '$',
  className,
}: AdverseSelectionFlowProps) {
  const id = useId();
  // informed share as a percent 0–60
  const [informedPct, setInformedPct] = useState(20);
  // quoted half-spread in cents
  const [halfSpread, setHalfSpread] = useState(3);

  // The informed trader's edge (how far price moves against the maker) is a
  // fixed parameter of the world here: 8¢ per informed fill.
  const INFORMED_MOVE = 8;
  const GRID = 24;

  const p = informedPct / 100;
  // Maker gains halfSpread on uninformed, loses (INFORMED_MOVE - halfSpread) on informed.
  const gainUninformed = halfSpread;
  const lossInformed = INFORMED_MOVE - halfSpread;
  const netEdge = (1 - p) * gainUninformed - p * lossInformed; // cents per trade
  // Break-even informed share: where net edge = 0.
  const breakEvenP = gainUninformed / (gainUninformed + lossInformed);
  const profitable = netEdge >= 0;

  // Order grid: deterministically spread informed orders across the grid.
  const grid = useMemo(() => {
    const informedCount = Math.round(p * GRID);
    // Evenly distribute informed slots for a clean visual.
    const slots: boolean[] = Array.from({ length: GRID }, () => false);
    for (let i = 0; i < informedCount; i++) {
      const idx = Math.round((i + 0.5) * (GRID / Math.max(1, informedCount))) % GRID;
      slots[idx] = true;
    }
    // Fix any collisions by filling remaining informed flags greedily.
    let placed = slots.filter(Boolean).length;
    for (let i = 0; i < GRID && placed < informedCount; i++) {
      if (!slots[i]) {
        slots[i] = true;
        placed++;
      }
    }
    return slots;
  }, [p]);

  const cents = (v: number) => `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(1)}¢`;

  const ariaLabel = `${title}. ${informedShareLabel}: ${informedPct}%. ${spreadLabel}: ${halfSpread}. ${netEdgeLabel}: ${cents(
    netEdge,
  )}. ${profitable ? profitableLabel : bleedingLabel}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            profitable ? 'bg-brand-600' : 'bg-warning',
          )}
          aria-live="polite"
        >
          {profitable ? profitableLabel : bleedingLabel} · {cents(netEdge)}
        </span>
      </figcaption>

      {/* Order grid */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-muted p-3">
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {grid.map((informed, i) => (
            <span
              key={i}
              className={cx(
                'flex h-7 w-7 items-center justify-center rounded text-xs font-semibold transition-colors duration-300',
                informed ? 'bg-accent-500 text-white' : 'bg-brand-200 text-brand-800',
              )}
              title={informed ? informedLabel : uninformedLabel}
            >
              {informed ? '✦' : '○'}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-200" aria-hidden="true" /> {uninformedLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-accent-500" aria-hidden="true" /> {informedLabel}
          </span>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={`${id}-inf`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{informedShareLabel}</span>
            <span className="font-mono text-ink-900">{informedPct}%</span>
          </label>
          <input
            id={`${id}-inf`}
            type="range"
            min={0}
            max={60}
            step={2}
            value={informedPct}
            onChange={(e) => setInformedPct(Number(e.target.value))}
            aria-label={informedShareLabel}
            className="mt-2 w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-spr`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{spreadLabel}</span>
            <span className="font-mono text-ink-900">{halfSpread.toFixed(1)}¢</span>
          </label>
          <input
            id={`${id}-spr`}
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={halfSpread}
            onChange={(e) => setHalfSpread(Number(e.target.value))}
            aria-label={spreadLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{profitPerUninformedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">+{gainUninformed.toFixed(1)}¢</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lossPerInformedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">-{lossInformed.toFixed(1)}¢</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netEdgeLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', profitable ? 'text-brand-700' : 'text-warning')}>
            {cents(netEdge)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{breakEvenLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{(breakEvenP * 100).toFixed(0)}%</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AdverseSelectionFlow;
