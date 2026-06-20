import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link BatchAuctionCoW} component. */
export interface BatchAuctionCoWProps {
  /** Heading above the diagram. Defaults to `'Settling a batch with a coincidence of wants'`. */
  title?: string;
  /** Toggle label for AMM mode. Defaults to `'One by one on the AMM'`. */
  ammModeLabel?: string;
  /** Toggle label for batch mode. Defaults to `'Batch auction (CoW)'`. */
  batchModeLabel?: string;
  /** Label for Alice's order box. Defaults to `'Alice: sell 10 ETH → USDC'`. */
  aliceLabel?: string;
  /** Label for Bob's order box. Defaults to `'Bob: buy 8 ETH ← USDC'`. */
  bobLabel?: string;
  /** Label for the AMM pool box. Defaults to `'AMM pool'`. */
  poolLabel?: string;
  /** Chip label for the uniform clearing price. Defaults to `'Uniform clearing price'`. */
  clearingPriceLabel?: string;
  /** Label on the peer-to-peer CoW match arrow. Defaults to `'Coincidence of wants — matched peer-to-peer'`. */
  cowMatchLabel?: string;
  /** Label for the residual routed to the AMM. Defaults to `'Residual 2 ETH → AMM'`. */
  ammResidualLabel?: string;
  /** Readout label for fees + MEV leaked. Defaults to `'Fees + MEV leaked'`. */
  costLabel?: string;
  /** Readout label for the amount saved by batching. Defaults to `'Saved by batching'`. */
  savingsLabel?: string;
  /** Accessible name for the toggle group. Defaults to `'Settlement mode'`. */
  groupLabel?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Deterministic model ──────────────────────────────────────────────────────
// Alice sells 10 ETH; Bob buys 8 ETH worth of ETH (sells USDC). They settle at
// ONE uniform clearing price of 2,000 USDC/ETH. The per-order cost (pool fee +
// slippage + MEV leaked) is 0.6% of the routed notional.
const CLEARING_PRICE = 2000; // USDC per ETH
const COST_RATE = 0.006; // 0.6% of notional
const ALICE_ETH = 10;
const BOB_ETH = 8;
const RESIDUAL_ETH = ALICE_ETH - BOB_ETH; // 2 ETH

const cost = (eth: number): number => Math.round(eth * CLEARING_PRICE * COST_RATE);

// AMM mode: each order routes separately and pays its own cost.
const AMM_COST = cost(ALICE_ETH) + cost(BOB_ETH); // 120 + 96 = 216
// Batch mode: 8 ETH match peer-to-peer for free; only the 2 ETH residual hits the AMM.
const BATCH_COST = cost(RESIDUAL_ETH); // 24
const SAVINGS = AMM_COST - BATCH_COST; // 192

/** Format a dollar amount as `$` + integer with thousands separators. */
const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Teaching toggle: the SAME two opposite orders settled two different ways.
 *
 * Alice sells ETH for USDC and Bob buys ETH with USDC — a textbook
 * "coincidence of wants". In **AMM mode** each order is routed separately
 * through the pool, so each pays a fee, eats slippage, and is exposed to MEV;
 * the leaked value adds up. Flip to **batch mode** and the overlapping 8 ETH are
 * matched peer-to-peer at a single uniform clearing price for free — only the
 * 2 ETH residual ever touches the AMM. The readout makes the saved fees + MEV
 * explicit. Uses only color/opacity CSS transitions, so no reduced-motion guard
 * is needed.
 */
export function BatchAuctionCoW({
  title = 'Settling a batch with a coincidence of wants',
  ammModeLabel = 'One by one on the AMM',
  batchModeLabel = 'Batch auction (CoW)',
  aliceLabel = 'Alice: sell 10 ETH → USDC',
  bobLabel = 'Bob: buy 8 ETH ← USDC',
  poolLabel = 'AMM pool',
  clearingPriceLabel = 'Uniform clearing price',
  cowMatchLabel = 'Coincidence of wants — matched peer-to-peer',
  ammResidualLabel = 'Residual 2 ETH → AMM',
  costLabel = 'Fees + MEV leaked',
  savingsLabel = 'Saved by batching',
  groupLabel = 'Settlement mode',
  caption = 'Matching opposite orders peer-to-peer at one clearing price keeps the fees and MEV that routing each trade through the AMM would have leaked.',
  className,
}: BatchAuctionCoWProps) {
  const [batch, setBatch] = useState(false);
  const id = useId();

  const totalCost = batch ? BATCH_COST : AMM_COST;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        {/* Uniform clearing price chip */}
        <span className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-brand-50/50 px-3 py-1 text-xs font-semibold text-brand-700">
          <span className="text-ink-500">{clearingPriceLabel}</span>
          <span className="font-mono text-ink-900">2,000 USDC/ETH</span>
        </span>
      </figcaption>

      {/* Toggle */}
      <div
        role="tablist"
        aria-label={groupLabel}
        className="mt-4 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!batch}
          aria-controls={`${id}-panel`}
          onClick={() => setBatch(false)}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            !batch ? 'bg-ink-900 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {ammModeLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={batch}
          aria-controls={`${id}-panel`}
          onClick={() => setBatch(true)}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            batch ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {batchModeLabel}
        </button>
      </div>

      {/* Diagram panel */}
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-live="polite"
        className={cx(
          'mt-4 rounded-card border p-4 transition-colors duration-300',
          batch ? 'border-brand-200 bg-brand-50/50' : 'border-ink-200 bg-surface-sunken/40',
        )}
      >
        <svg
          viewBox="0 0 520 280"
          className="w-full"
          role="img"
          aria-label={
            batch
              ? `${batchModeLabel}: ${ALICE_ETH - RESIDUAL_ETH} ETH of Alice's and Bob's opposite orders are matched peer-to-peer at the uniform clearing price, and only the residual ${RESIDUAL_ETH} ETH routes to the ${poolLabel}.`
              : `${ammModeLabel}: Alice's and Bob's orders each route separately through the ${poolLabel}, each leaking fees and MEV.`
          }
        >
          <defs>
            <marker
              id={`${id}-arrow-brand`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand-500)" />
            </marker>
            <marker
              id={`${id}-arrow-ink`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-300)" />
            </marker>
            <marker
              id={`${id}-arrow-accent`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent-500)" />
            </marker>
          </defs>

          {/* ── AMM pool box (center, dimmed in batch mode) ── */}
          <g
            style={{
              opacity: batch ? 0.4 : 1,
              transition: 'opacity 300ms ease',
            }}
          >
            <rect
              x="200"
              y="118"
              width="120"
              height="44"
              rx="10"
              fill="var(--color-surface)"
              stroke="var(--color-ink-300)"
              strokeWidth={1.5}
            />
            <text
              x="260"
              y="144"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="var(--color-ink-700)"
            >
              {poolLabel}
            </text>
          </g>

          {/* ── Alice box (top-left) ── */}
          <rect
            x="16"
            y="20"
            width="200"
            height="40"
            rx="10"
            fill="var(--color-brand-50)"
            stroke="var(--color-brand-200)"
            strokeWidth={1.5}
          />
          <text x="116" y="44" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink-900)">
            {aliceLabel}
          </text>

          {/* ── Bob box (bottom-left) ── */}
          <rect
            x="16"
            y="220"
            width="200"
            height="40"
            rx="10"
            fill="var(--color-brand-50)"
            stroke="var(--color-brand-200)"
            strokeWidth={1.5}
          />
          <text x="116" y="244" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink-900)">
            {bobLabel}
          </text>

          {/* ── AMM-mode arrows: Alice → pool, Bob → pool (highlighted in AMM mode) ── */}
          <g
            style={{
              opacity: batch ? 0.25 : 1,
              transition: 'opacity 300ms ease',
            }}
          >
            {/* Alice → pool */}
            <path
              d="M 150 60 C 200 90, 230 100, 248 116"
              fill="none"
              stroke={batch ? 'var(--color-ink-300)' : 'var(--color-brand-500)'}
              strokeWidth={2.5}
              markerEnd={`url(#${id}-arrow-${batch ? 'ink' : 'brand'})`}
            />
            {/* Bob → pool */}
            <path
              d="M 150 220 C 200 190, 230 180, 248 164"
              fill="none"
              stroke={batch ? 'var(--color-ink-300)' : 'var(--color-brand-500)'}
              strokeWidth={2.5}
              markerEnd={`url(#${id}-arrow-${batch ? 'ink' : 'brand'})`}
            />
            {/* Cost tags on each leg (AMM mode only) */}
            {!batch && (
              <>
                <g>
                  <rect x="300" y="78" width="138" height="26" rx="13" fill="var(--color-accent-500)" opacity={0.12} />
                  <text x="369" y="95" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-accent-600)">
                    {`${aliceLabel.split(':')[0]}: −${money(cost(ALICE_ETH))}`}
                  </text>
                </g>
                <g>
                  <rect x="300" y="176" width="138" height="26" rx="13" fill="var(--color-accent-500)" opacity={0.12} />
                  <text x="369" y="193" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-accent-600)">
                    {`${bobLabel.split(':')[0]}: −${money(cost(BOB_ETH))}`}
                  </text>
                </g>
              </>
            )}
          </g>

          {/* ── Batch-mode P2P match arrow: Alice ↔ Bob (highlighted in batch mode) ── */}
          <g
            style={{
              opacity: batch ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
            aria-hidden={!batch}
          >
            {/* Direct double-headed CoW match */}
            <line
              x1="116"
              y1="60"
              x2="116"
              y2="220"
              stroke="var(--color-brand-500)"
              strokeWidth={3}
              markerStart={`url(#${id}-arrow-brand)`}
              markerEnd={`url(#${id}-arrow-brand)`}
            />
            {/* CoW match label */}
            <rect x="126" y="118" width="180" height="44" rx="10" fill="var(--color-brand-100)" />
            <text x="216" y="135" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--color-brand-700)">
              8 ETH · uniform price
            </text>
            <text x="216" y="152" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--color-brand-600)">
              0 fee · 0 MEV
            </text>

            {/* Residual 2 ETH → AMM (still drawn, faint, from Alice to pool) */}
            <path
              d="M 200 50 C 320 60, 360 90, 320 116"
              fill="none"
              stroke="var(--color-ink-300)"
              strokeWidth={2}
              strokeDasharray="5 4"
              markerEnd={`url(#${id}-arrow-ink)`}
            />
            <text x="408" y="72" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-500)">
              {ammResidualLabel}
            </text>
          </g>
        </svg>

        {/* CoW match caption (batch mode only) */}
        {batch && (
          <p className="mt-1 text-center text-xs font-semibold text-brand-700">{cowMatchLabel}</p>
        )}
      </div>

      {/* Readout */}
      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-card border border-ink-200 bg-surface-sunken/40 px-4 py-2.5">
          <dt className="text-sm text-ink-700">{costLabel}</dt>
          <dd className="font-mono text-sm font-semibold text-ink-900">{money(totalCost)}</dd>
        </div>
        <div
          className={cx(
            'flex items-center justify-between gap-3 rounded-card border px-4 py-2.5 transition-colors duration-300',
            batch
              ? 'border-brand-200 bg-brand-50/50'
              : 'border-ink-200 bg-surface-sunken/40 opacity-50',
          )}
          aria-hidden={!batch}
        >
          <dt className="text-sm text-ink-700">{savingsLabel}</dt>
          <dd className="font-mono text-sm font-semibold text-brand-700">
            {batch ? `+${money(SAVINGS)}` : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BatchAuctionCoW;
