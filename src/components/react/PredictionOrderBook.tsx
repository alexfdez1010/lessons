import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single price level in the order book. Price is in cents (0–100), size in shares. */
export interface PredictionOrderLevel {
  /** Price per share, in cents (0–100). */
  price: number;
  /** Resting size at this level, in shares. */
  size: number;
}

export interface PredictionOrderBookProps {
  /** Heading above the book. */
  title?: string;
  /** Section label for the bid (buyer) side. */
  bidsLabel?: string;
  /** Section label for the ask (seller) side. */
  asksLabel?: string;
  /** Column header for price. */
  pricecol?: string;
  /** Column header for size. */
  sizeCol?: string;
  /** Readout label for the best (highest) bid. */
  bestBidLabel?: string;
  /** Readout label for the best (lowest) ask. */
  bestAskLabel?: string;
  /** Readout label for the bid-ask spread. */
  spreadLabel?: string;
  /** Readout label for the mid price (≈ implied probability). */
  midLabel?: string;
  /** Label for the market-buy size slider. */
  orderSizeLabel?: string;
  /** Readout label for the volume-weighted average fill price. */
  avgFillLabel?: string;
  /** Readout label for slippage versus the best ask. */
  slippageLabel?: string;
  /** Readout label for the total cost of the order. */
  totalCostLabel?: string;
  /** Status pill text when the order fills completely. */
  filledLabel?: string;
  /** Status pill text when the book is too thin to fully fill. */
  partialLabel?: string;
  /** One-line takeaway shown under the book. */
  caption?: string;
  /** Ask ladder (sellers). Prices in cents, ascending or unsorted — sorted internally. */
  asks?: PredictionOrderLevel[];
  /** Bid ladder (buyers). Prices in cents, descending or unsorted — sorted internally. */
  bids?: PredictionOrderLevel[];
  /** Initial market-buy size, in shares. Defaults to `300`. */
  orderSize?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a price given in cents as e.g. "62¢". */
const cents = (value: number): string =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}¢`;

/** Format a share count with thousands separators. */
const shares = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const DEFAULT_ASKS: PredictionOrderLevel[] = [
  { price: 63, size: 1800 },
  { price: 62, size: 900 },
  { price: 61, size: 450 },
  { price: 60, size: 250 },
];

const DEFAULT_BIDS: PredictionOrderLevel[] = [
  { price: 58, size: 300 },
  { price: 57, size: 600 },
  { price: 56, size: 1100 },
  { price: 55, size: 2000 },
];

interface FillResult {
  /** Shares actually filled (≤ requested, capped at ask depth). */
  filled: number;
  /** Volume-weighted average fill price, in cents. */
  avgPrice: number;
  /** Total dollar cost of the filled shares. */
  cost: number;
  /** Shares consumed at each ask level, indexed to the sorted-ascending ask ladder. */
  consumed: number[];
  /** True when the requested size exceeded total ask depth. */
  partial: boolean;
}

/** Walk a market buy up the (ascending) ask ladder, level by level. */
const walkAsks = (asksAsc: PredictionOrderLevel[], requested: number): FillResult => {
  const consumed = asksAsc.map(() => 0);
  let remaining = requested;
  let filled = 0;
  let costCents = 0;
  for (let i = 0; i < asksAsc.length && remaining > 0; i++) {
    const take = Math.min(remaining, asksAsc[i].size);
    consumed[i] = take;
    filled += take;
    costCents += take * asksAsc[i].price;
    remaining -= take;
  }
  const avgPrice = filled > 0 ? costCents / filled : 0;
  return {
    filled,
    avgPrice,
    cost: costCents / 100,
    consumed,
    partial: remaining > 0,
  };
};

/**
 * Interactive prediction-market order book (CLOB). Polymarket matches each
 * outcome token on a central limit order book: resting **bids** (buyers, below)
 * and **asks** (sellers, above), every level a price in cents (0–100) and a size
 * in shares. The gap between the best bid and best ask is the **spread**, and
 * their midpoint is the **mid** — roughly the market's implied probability.
 *
 * Drag the "market buy" slider and the island walks your order up the ask ladder:
 * it eats the cheapest level first, then climbs to worse prices, highlighting each
 * consumed level and reporting the **average fill price**, the **slippage** versus
 * the best ask, and the **total cost**. Push the slider past the total resting ask
 * depth and it shows a graceful "partial — book too thin" state. This makes spread,
 * depth and slippage concrete. Respects `prefers-reduced-motion` (no transitions).
 */
export function PredictionOrderBook({
  title = 'YES order book (Polymarket-style CLOB)',
  bidsLabel = 'Bids — buyers',
  asksLabel = 'Asks — sellers',
  pricecol = 'Price',
  sizeCol = 'Size',
  bestBidLabel = 'Best bid',
  bestAskLabel = 'Best ask',
  spreadLabel = 'Spread',
  midLabel = 'Mid ≈ implied prob',
  orderSizeLabel = 'Your market buy (shares)',
  avgFillLabel = 'Avg fill price',
  slippageLabel = 'Slippage vs best ask',
  totalCostLabel = 'Total cost',
  filledLabel = 'Filled',
  partialLabel = 'Partial — book too thin',
  caption = 'A market buy doesn’t fill at one price — it climbs the ask ladder, eating the cheapest sellers first, then paying up for the rest. The deeper the order relative to the book, the worse the average price: that gap is slippage, and a thin book makes it bite.',
  asks = DEFAULT_ASKS,
  bids = DEFAULT_BIDS,
  orderSize = 300,
  className,
}: PredictionOrderBookProps) {
  const id = useId();
  const reduceMotion = prefersReducedMotion();

  // Ascending asks (best/lowest first) — the order in which a buy consumes them.
  const asksAsc = [...asks].sort((a, b) => a.price - b.price);
  // Descending asks for display (worst at top, best just above the spread).
  const asksDesc = [...asksAsc].reverse();
  // Descending bids (best/highest first) for display below the spread.
  const bidsDesc = [...bids].sort((a, b) => b.price - a.price);

  const totalAskDepth = asksAsc.reduce((sum, level) => sum + level.size, 0);
  const sliderMax = Math.max(50, Math.ceil((totalAskDepth * 1.2) / 50) * 50);

  const [size, setSize] = useState(() => Math.min(orderSize, sliderMax));

  const bestAsk = asksAsc.length > 0 ? asksAsc[0].price : 0;
  const bestBid = bidsDesc.length > 0 ? bidsDesc[0].price : 0;
  const spread = bestAsk - bestBid;
  const mid = (bestAsk + bestBid) / 2;

  const fill = walkAsks(asksAsc, size);
  const slippage = fill.filled > 0 ? fill.avgPrice - bestAsk : 0;

  // Map each ascending-index consumption back onto descending display rows.
  const consumedDesc = [...fill.consumed].reverse();

  // Largest resting size across both sides — used to scale the depth bars.
  const maxLevelSize = Math.max(
    1,
    ...asksAsc.map((l) => l.size),
    ...bidsDesc.map((l) => l.size),
  );

  const transition = reduceMotion ? undefined : 'width 240ms ease, background-color 200ms ease';

  const ariaLabel = fill.partial
    ? `${title}. Best ask ${cents(bestAsk)}, best bid ${cents(bestBid)}, spread ${cents(
        spread,
      )}, mid ${cents(mid)}. A market buy of ${shares(
        size,
      )} shares exceeds the ${shares(
        totalAskDepth,
      )} shares of resting ask depth: only ${shares(
        fill.filled,
      )} fill, at an average of ${cents(fill.avgPrice)}.`
    : `${title}. Best ask ${cents(bestAsk)}, best bid ${cents(bestBid)}, spread ${cents(
        spread,
      )}, mid ${cents(mid)}. A market buy of ${shares(
        size,
      )} shares fills at an average of ${cents(fill.avgPrice)}, ${cents(
        slippage,
      )} above the best ask, costing ${usd.format(fill.cost)}.`;

  const renderRow = (
    level: PredictionOrderLevel,
    side: 'ask' | 'bid',
    consumedShares: number,
  ) => {
    const isAsk = side === 'ask';
    const widthPct = Math.min(100, (level.size / maxLevelSize) * 100);
    const eaten = consumedShares > 0;
    const fullyEaten = consumedShares >= level.size - 1e-6;
    return (
      <div
        key={`${side}-${level.price}`}
        className={cx(
          'relative grid grid-cols-2 items-center gap-2 overflow-hidden rounded-pill px-3 py-1.5 text-sm',
          eaten && 'ring-1 ring-inset ring-brand-400',
        )}
      >
        {/* Depth bar (right-anchored for asks, left for bids would mirror; kept left for legibility). */}
        <span
          aria-hidden="true"
          className={cx(
            'absolute inset-y-0 left-0 rounded-pill',
            isAsk ? 'bg-accent-100' : 'bg-brand-100',
          )}
          style={{ width: `${widthPct}%`, transition }}
        />
        {/* Consumed overlay — how much of this level the order ate. */}
        {eaten && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-pill bg-brand-300/60"
            style={{
              width: `${Math.min(100, (consumedShares / maxLevelSize) * 100)}%`,
              transition,
            }}
          />
        )}
        <span
          className={cx(
            'relative font-mono font-semibold',
            isAsk ? 'text-accent-600' : 'text-brand-700',
          )}
        >
          {cents(level.price)}
        </span>
        <span className="relative text-right font-mono text-ink-700">
          {shares(level.size)}
          {eaten && (
            <span className="ml-1 text-xs font-medium text-brand-600">
              {fullyEaten ? '✓' : `−${shares(consumedShares)}`}
            </span>
          )}
        </span>
      </div>
    );
  };

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
            fill.partial ? 'bg-accent-500' : 'bg-brand-600',
          )}
        >
          {fill.partial
            ? partialLabel
            : `${filledLabel}: ${shares(fill.filled)}`}
        </span>
      </figcaption>

      {/* The book itself */}
      <div className="mt-4" role="img" aria-label={ariaLabel}>
        {/* Column headers */}
        <div className="mb-1 grid grid-cols-2 gap-2 px-3 text-xs font-medium uppercase tracking-wide text-ink-500">
          <span>{pricecol}</span>
          <span className="text-right">{sizeCol}</span>
        </div>

        {/* Asks (sellers) — worst price on top, best just above the spread */}
        <div className="mb-1 px-3 text-xs font-medium text-accent-600">{asksLabel}</div>
        <div className="space-y-1">
          {asksDesc.map((level, i) => renderRow(level, 'ask', consumedDesc[i] ?? 0))}
        </div>

        {/* Spread band */}
        <div className="my-2 flex flex-wrap items-center justify-between gap-2 rounded-pill border border-dashed border-ink-200 bg-surface-sunken/40 px-3 py-1.5 text-xs">
          <span className="font-mono text-ink-700">
            {spreadLabel}: <span className="font-semibold text-ink-900">{cents(spread)}</span>
          </span>
          <span className="font-mono text-ink-700">
            {midLabel}: <span className="font-semibold text-ink-900">{cents(mid)}</span>
          </span>
        </div>

        {/* Bids (buyers) — best price on top */}
        <div className="mb-1 px-3 text-xs font-medium text-brand-700">{bidsLabel}</div>
        <div className="space-y-1">
          {bidsDesc.map((level) => renderRow(level, 'bid', 0))}
        </div>
      </div>

      {/* Top-of-book readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestBidLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{cents(bestBid)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestAskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{cents(bestAsk)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{midLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{cents(mid)}</dd>
        </div>
      </dl>

      {/* Market-buy slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-size`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{orderSizeLabel}</span>
          <span className="font-mono text-ink-900">{shares(size)}</span>
        </label>
        <input
          id={`${id}-size`}
          type="range"
          min={0}
          max={sliderMax}
          step={10}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Fill readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{avgFillLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fill.filled > 0 ? cents(fill.avgPrice) : '—'}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{slippageLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              slippage > 0 ? 'text-accent-600' : 'text-ink-900',
            )}
          >
            {fill.filled > 0 ? `+${cents(slippage)}` : '—'}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalCostLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {usd.format(fill.cost)}
          </dd>
        </div>
      </dl>

      {fill.partial && (
        <p className="mt-3 rounded-card border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-700">
          {partialLabel}: only {shares(fill.filled)} of {shares(size)} shares could
          fill against {shares(totalAskDepth)} shares of resting asks.
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PredictionOrderBook;
