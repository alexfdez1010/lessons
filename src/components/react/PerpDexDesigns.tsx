import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One design column in the comparison. */
export interface PerpDexDesign {
  /** Short name of the design (e.g. "Order book"). */
  name: string;
  /** One-line description of how it sources a price. */
  blurb: string;
  /** Bullet rows: each [aspect-value] for this design. Aligned to `aspects`. */
  cells: string[];
}

export interface PerpDexDesignsProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway under the figure. */
  caption?: string;
  /** Names of the aspects compared (rows). */
  aspects?: string[];
  /** The design columns. */
  designs?: PerpDexDesign[];
  /** Header for the aspect column. */
  aspectColLabel?: string;
  /** Accessible hint for the tab strip. */
  tabHint?: string;
  className?: string;
}

const DEFAULT_ASPECTS = [
  'Where the price comes from',
  'Who is the counterparty',
  'Liquidity source',
  'Oracle dependence',
  'Main weakness',
  'Real examples',
];

const DEFAULT_DESIGNS: PerpDexDesign[] = [
  {
    name: 'Order book',
    blurb: 'Makers post bids and asks; a matching engine pairs them, just like a centralized exchange.',
    cells: [
      'Best resting limit order sets the price',
      'Another trader on the other side of the book',
      'Professional market makers posting quotes',
      'Low — price is discovered in the book itself',
      'Needs active makers and fast infra; thin books on long-tail markets',
      'dYdX, Hyperliquid',
    ],
  },
  {
    name: 'vAMM',
    blurb: 'A virtual constant-product curve quotes a price with no real reserves behind it — only bookkeeping.',
    cells: [
      'A formula (x·y=k) on virtual, not real, reserves',
      'The protocol / virtual pool itself',
      'No deposited liquidity — the curve is synthetic',
      'Medium — needs a mark/index oracle for funding',
      'Price can drift; no real depth, so manipulation and bad-debt risk',
      'Perpetual Protocol v1, early Drift',
    ],
  },
  {
    name: 'Oracle / pool-based',
    blurb: 'Trades fill at an external oracle price against a shared liquidity-provider pool that is the universal counterparty.',
    cells: [
      'An external price oracle (e.g. spot index)',
      'A pooled LP vault — the house against every trader',
      'LPs deposit into a single counterparty pool',
      'High — the oracle is the price; bad oracle = bad fills',
      'LPs are short trader PnL; oracle latency/manipulation risk',
      'GMX, Gains Network (gTrade)',
    ],
  },
];

/**
 * Tabbed comparison of the three dominant perp-DEX architectures: an on-chain
 * central limit order book, a virtual AMM (vAMM), and an oracle/pool-based
 * design. Pick a tab to foreground one design's column; a matrix underneath
 * lines all three up across the same aspects (price source, counterparty,
 * liquidity, oracle dependence, weakness, examples). Purely presentational and
 * locale-agnostic — every string arrives as a prop, no numbers baked in.
 */
export function PerpDexDesigns({
  title = 'Three ways to build a perp DEX',
  caption = 'A perp DEX has to answer one question — where does the price come from? Order books discover it from resting orders, vAMMs synthesize it from a formula, and oracle/pool designs import it from an external feed and make a shared LP vault the counterparty. Each choice trades off decentralization, capital efficiency, and oracle risk.',
  aspects = DEFAULT_ASPECTS,
  designs = DEFAULT_DESIGNS,
  aspectColLabel = 'Aspect',
  tabHint = 'Select a design to highlight',
  className,
}: PerpDexDesignsProps) {
  const id = useId();
  const [active, setActive] = useState(0);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Tab strip */}
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={tabHint}>
        {designs.map((d, i) => (
          <button
            key={d.name}
            type="button"
            role="tab"
            aria-selected={active === i}
            id={`${id}-tab-${i}`}
            aria-controls={`${id}-panel-${i}`}
            onClick={() => setActive(i)}
            className={cx(
              'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              active === i
                ? 'bg-brand-600 text-white shadow-soft'
                : 'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Active blurb */}
      <div
        id={`${id}-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="mt-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-ink-700"
        aria-live="polite"
      >
        <span className="font-semibold text-brand-700">{designs[active].name}:</span>{' '}
        {designs[active].blurb}
      </div>

      {/* Matrix */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200">
              <th className="px-3 py-2 font-semibold text-ink-500">{aspectColLabel}</th>
              {designs.map((d, i) => (
                <th
                  key={d.name}
                  className={cx(
                    'px-3 py-2 font-semibold transition-colors',
                    active === i ? 'text-brand-700' : 'text-ink-600',
                  )}
                >
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aspects.map((aspect, r) => (
              <tr
                key={aspect}
                className={cx('border-b border-ink-100 align-top', r % 2 === 1 && 'bg-surface-sunken/40')}
              >
                <td className="px-3 py-2 font-medium text-ink-900">{aspect}</td>
                {designs.map((d, i) => (
                  <td
                    key={d.name}
                    className={cx(
                      'px-3 py-2 transition-colors',
                      active === i ? 'bg-brand-50/60 text-ink-900' : 'text-ink-600',
                    )}
                  >
                    {d.cells[r]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PerpDexDesigns;
