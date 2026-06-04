import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One row in the comparison table at the bottom. */
export interface OrderbookVsAmmRow {
  /** The aspect being compared (e.g. "Counterparty"). */
  aspect: string;
  /** How the order book handles it. */
  orderbook: string;
  /** How the AMM handles it. */
  amm: string;
}

/** A single resting order in the book (one price level). */
export interface OrderbookLevel {
  /** Limit price of the level. */
  price: number;
  /** Size (quantity) resting at that price. */
  size: number;
}

export interface OrderbookVsAmmProps {
  /** Heading above the whole figure. */
  title?: string;
  /** Title of the left (order-book) panel. */
  orderbookTitle?: string;
  /** Title of the right (AMM) panel. */
  ammTitle?: string;
  /** Label for the ask (seller) side of the book. */
  askLabel?: string;
  /** Label for the bid (buyer) side of the book. */
  bidLabel?: string;
  /** Label for the "fill a market buy" action button. */
  buyButtonLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Label for the mid-price row in the book. */
  midLabel?: string;
  /** Label for the spot-price readout under the AMM curve. */
  spotPriceLabel?: string;
  /** Label for the AMM reserves readout. */
  reservesLabel?: string;
  /** Label for the running "you paid" readout on the order-book side. */
  avgPriceLabel?: string;
  /** Header for the order-book column of the comparison table. */
  orderbookColLabel?: string;
  /** Header for the AMM column of the comparison table. */
  ammColLabel?: string;
  /** Header for the aspect column of the comparison table. */
  aspectColLabel?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Ask levels (sellers), supplied low→high price; sorted internally. */
  asks?: OrderbookLevel[];
  /** Bid levels (buyers), supplied high→low price; sorted internally. */
  bids?: OrderbookLevel[];
  /** Size of each step of the market buy (in base units). Defaults to `1`. */
  buyStep?: number;
  /** AMM reserve of the base asset X (the thing you buy). Defaults to `100`. */
  reserveX?: number;
  /** AMM reserve of the quote asset Y (the thing you pay). Defaults to `10000`. */
  reserveY?: number;
  /** Amount of quote (Y) spent per AMM buy click. Defaults to `1200`. */
  ammSpendStep?: number;
  /** Rows of the bottom comparison table. */
  rows?: OrderbookVsAmmRow[];
  /** One-line takeaway under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string =>
  `${value < 0 ? '-' : ''}${prefix}${Math.abs(value).toFixed(digits)}`;

const DEFAULT_ASKS: OrderbookLevel[] = [
  { price: 103, size: 3 },
  { price: 102, size: 2 },
  { price: 101, size: 4 },
  { price: 100, size: 2 },
];

const DEFAULT_BIDS: OrderbookLevel[] = [
  { price: 99, size: 3 },
  { price: 98, size: 5 },
  { price: 97, size: 2 },
  { price: 96, size: 4 },
];

const DEFAULT_ROWS: OrderbookVsAmmRow[] = [
  {
    aspect: 'Counterparty',
    orderbook: 'A matched order on the other side',
    amm: 'A shared pool — no other trader needed',
  },
  {
    aspect: 'Liquidity provider',
    orderbook: 'Market makers posting limit quotes',
    amm: 'Anyone depositing both assets into the pool',
  },
  {
    aspect: 'Price discovery',
    orderbook: 'Best resting order sets the price',
    amm: 'A deterministic formula (x·y = k)',
  },
  {
    aspect: 'Always available?',
    orderbook: 'No — needs someone to have posted orders',
    amm: 'Yes — the curve always quotes a price',
  },
  {
    aspect: 'Capital efficiency',
    orderbook: 'Quotes can sit idle, cancelled any moment',
    amm: 'Reserves pooled and always working',
  },
  {
    aspect: 'Good for',
    orderbook: 'Deep, liquid markets with active makers',
    amm: 'Long-tail / 24-7 on-chain trading',
  },
];

/**
 * Side-by-side explainer contrasting the two ways an exchange prices a trade.
 *
 * LEFT — a central limit order book (CLOB): discrete ASK levels above the mid
 * and BID levels below, each a price + size bar. Trading needs a *counterparty*:
 * the price comes from whoever posted resting orders, thin books leave gaps, and
 * with no orders you simply cannot trade. "Fill a market buy" walks up the asks,
 * consuming one level at a time (each consumed level briefly highlights), so the
 * buyer visibly pays progressively higher prices.
 *
 * RIGHT — an automated market maker (AMM): a constant-product curve y = k / x
 * with the pool sitting on it. No counterparty is needed — you trade against the
 * pooled reserves via x·y = k, so a price is *always* available and set purely by
 * the reserves. The same buy walks the pool point down-and-right along the curve
 * (more X out, more Y in), with the spot price rising as X gets scarce.
 *
 * Below, a compact comparison table (built from `rows`) summarizes the
 * differences. Animations honour `prefers-reduced-motion` (snap instead of
 * tween). All user-facing strings are locale-agnostic props.
 */
export function OrderbookVsAmm({
  title = 'Two ways to price a trade',
  orderbookTitle = 'Order book (CEX)',
  ammTitle = 'AMM (DEX)',
  askLabel = 'Asks (sellers)',
  bidLabel = 'Bids (buyers)',
  buyButtonLabel = 'Fill a market buy',
  resetLabel = 'Reset',
  midLabel = 'Mid',
  spotPriceLabel = 'Spot price',
  reservesLabel = 'Reserves',
  avgPriceLabel = 'Avg price paid',
  orderbookColLabel = 'Order book',
  ammColLabel = 'AMM',
  aspectColLabel = 'Aspect',
  currencyPrefix = '$',
  asks = DEFAULT_ASKS,
  bids = DEFAULT_BIDS,
  buyStep = 1,
  reserveX = 100,
  reserveY = 10000,
  ammSpendStep = 1200,
  rows = DEFAULT_ROWS,
  caption = 'Same goal — turn your cash into the asset — but the price comes from two completely different machines: a queue of other people’s orders, or a formula sitting on a pool of reserves.',
  className,
}: OrderbookVsAmmProps) {
  const id = useId();

  // --- Order book ----------------------------------------------------------
  // Asks sorted cheapest-first (the order a market buy consumes them).
  const sortedAsks = useMemo(
    () => [...asks].sort((a, b) => a.price - b.price),
    [asks],
  );
  // Bids sorted highest-first (top of book at the top).
  const sortedBids = useMemo(
    () => [...bids].sort((a, b) => b.price - a.price),
    [bids],
  );

  const maxSize = useMemo(
    () => Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size)),
    [asks, bids],
  );

  const mid =
    sortedAsks.length && sortedBids.length
      ? (sortedAsks[0].price + sortedBids[0].price) / 2
      : (sortedAsks[0]?.price ?? sortedBids[0]?.price ?? 0);

  // How much base quantity the market buy has consumed so far.
  const [filled, setFilled] = useState(0);
  const totalAskSize = useMemo(
    () => sortedAsks.reduce((s, l) => s + l.size, 0),
    [sortedAsks],
  );

  // Walk the asks to compute, per level: consumed qty + whether it's the level
  // currently being eaten (for the highlight).
  const askFill = useMemo(() => {
    let remaining = filled;
    return sortedAsks.map((level) => {
      const taken = Math.max(0, Math.min(level.size, remaining));
      const partial = remaining > 0 && remaining < level.size;
      remaining -= taken;
      return {
        ...level,
        taken,
        consumed: taken >= level.size,
        active: partial,
      };
    });
  }, [sortedAsks, filled]);

  // Average price actually paid across everything filled so far.
  const avgPaid = useMemo(() => {
    if (filled <= 0) return 0;
    let remaining = filled;
    let cost = 0;
    for (const level of sortedAsks) {
      const take = Math.min(level.size, remaining);
      cost += take * level.price;
      remaining -= take;
      if (remaining <= 0) break;
    }
    return cost / filled;
  }, [sortedAsks, filled]);

  const bookExhausted = filled >= totalAskSize;

  const fillMarketBuy = () => {
    setFilled((f) => Math.min(totalAskSize, f + buyStep));
  };
  const resetBook = () => setFilled(0);

  // --- AMM -----------------------------------------------------------------
  const k = reserveX * reserveY;
  // Quote (Y) spent so far against the pool.
  const [spent, setSpent] = useState(0);
  // Animated quote-spent the curve point renders against.
  const [shownSpent, setShownSpent] = useState(0);
  const rafRef = useRef<number | null>(null);
  // Cap spend so X never drains to zero (keep some base in the pool).
  const maxSpend = reserveY * 4;

  useEffect(() => {
    const target = spent;
    if (prefersReducedMotion()) {
      setShownSpent(target);
      return;
    }
    const start = shownSpent;
    const delta = target - start;
    if (Math.abs(delta) < 0.5) {
      setShownSpent(target);
      return;
    }
    const duration = 480;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShownSpent(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownSpent omitted on purpose: re-running each frame would restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spent]);

  // Constant-product state given total quote added to Y reserve.
  const poolFor = (addedY: number) => {
    const y = reserveY + addedY;
    const x = k / y;
    return { x, y, spot: y / x }; // spot price of X in terms of Y
  };

  const livePool = poolFor(spent);
  const shownPool = poolFor(shownSpent);

  const buyAmm = () => setSpent((s) => Math.min(maxSpend, s + ammSpendStep));
  const resetAmm = () => setSpent(0);

  // --- Curve geometry ------------------------------------------------------
  const CW = 240;
  const CH = 200;
  const cPad = 28;
  // Domain of X we plot the hyperbola over (centered on the resting reserve).
  const xMin = k / (reserveY + maxSpend);
  const xMax = reserveX * 1.35;
  const yMin = k / xMax;
  const yMax = reserveY + maxSpend;

  const sx = (x: number) =>
    cPad + ((x - xMin) / (xMax - xMin)) * (CW - cPad * 2);
  const sy = (y: number) =>
    CH - cPad - ((y - yMin) / (yMax - yMin)) * (CH - cPad * 2);

  const curvePath = useMemo(() => {
    const pts: string[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + ((xMax - xMin) * i) / steps;
      const y = k / x;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, xMin, xMax, yMin, yMax]);

  const startPt = poolFor(0);
  const startCx = sx(startPt.x);
  const startCy = sy(startPt.y);
  const pointCx = sx(shownPool.x);
  const pointCy = sy(shownPool.y);

  // --- a11y labels ---------------------------------------------------------
  const bookAria = `${orderbookTitle}. ${avgPriceLabel}: ${
    filled > 0 ? money(currencyPrefix, avgPaid) : '—'
  }. ${midLabel}: ${money(currencyPrefix, mid)}. A market buy walks up the asks, paying higher prices as cheap levels are consumed.`;

  const ammAria = `${ammTitle}. Constant-product curve x times y equals k. ${spotPriceLabel}: ${money(
    currencyPrefix,
    livePool.spot,
  )}. ${reservesLabel}: ${livePool.x.toFixed(1)} base / ${livePool.y.toFixed(0)} quote. The pool point slides down the curve as you buy.`;

  const buttonBase =
    'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
      </figcaption>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* ---------- LEFT: ORDER BOOK ---------- */}
        <section
          className="rounded-card border border-ink-100 bg-surface-sunken/40 p-4"
          aria-label={orderbookTitle}
        >
          <h3 className="text-sm font-semibold text-ink-900">{orderbookTitle}</h3>

          <p
            className="mt-2 text-xs uppercase tracking-wide text-warning"
            id={`${id}-asklbl`}
          >
            {askLabel}
          </p>
          <ul className="mt-1 space-y-1" aria-live="polite">
            {askFill.map((level, i) => (
              <li
                key={`ask-${i}`}
                className={cx(
                  'flex items-center gap-2 rounded-pill px-2 py-1 text-xs transition-colors',
                  level.consumed && 'opacity-40',
                  level.active && 'bg-warning/15 ring-1 ring-warning/50',
                )}
              >
                <span
                  className={cx(
                    'w-14 font-mono tabular-nums',
                    level.consumed ? 'text-ink-400 line-through' : 'text-warning',
                  )}
                >
                  {money(currencyPrefix, level.price)}
                </span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-pill bg-ink-100">
                  <span
                    className="absolute inset-y-0 left-0 rounded-pill bg-warning/70"
                    style={{ width: `${(level.size / maxSize) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono text-ink-500 tabular-nums">
                  {level.size}
                </span>
              </li>
            ))}
          </ul>

          {/* Mid */}
          <div className="my-2 flex items-center justify-between border-y border-dashed border-ink-200 py-1.5 text-xs">
            <span className="font-medium text-ink-500">{midLabel}</span>
            <span className="font-mono font-semibold text-ink-900 tabular-nums">
              {money(currencyPrefix, mid)}
            </span>
          </div>

          <p className="text-xs uppercase tracking-wide text-success">{bidLabel}</p>
          <ul className="mt-1 space-y-1">
            {sortedBids.map((level, i) => (
              <li
                key={`bid-${i}`}
                className="flex items-center gap-2 rounded-pill px-2 py-1 text-xs"
              >
                <span className="w-14 font-mono text-success tabular-nums">
                  {money(currencyPrefix, level.price)}
                </span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-pill bg-ink-100">
                  <span
                    className="absolute inset-y-0 left-0 rounded-pill bg-success/60"
                    style={{ width: `${(level.size / maxSize) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono text-ink-500 tabular-nums">
                  {level.size}
                </span>
              </li>
            ))}
          </ul>

          {/* SR-only summary of the live state */}
          <span className="sr-only" role="img" aria-label={bookAria} />

          <dl className="mt-3 text-xs" aria-live="polite">
            <div className="flex items-center justify-between rounded-card border border-ink-100 bg-surface px-3 py-2">
              <dt className="text-ink-500">{avgPriceLabel}</dt>
              <dd className="font-mono text-base font-semibold text-brand-700 tabular-nums">
                {filled > 0 ? money(currencyPrefix, avgPaid) : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fillMarketBuy}
              disabled={bookExhausted}
              className={cx(
                buttonBase,
                bookExhausted
                  ? 'cursor-not-allowed bg-ink-200 text-ink-400'
                  : 'bg-brand-600 text-white hover:bg-brand-700',
              )}
            >
              ▲ {buyButtonLabel}
            </button>
            <button
              type="button"
              onClick={resetBook}
              disabled={filled === 0}
              className={cx(
                buttonBase,
                'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
                filled === 0 && 'cursor-not-allowed opacity-50',
              )}
            >
              {resetLabel}
            </button>
          </div>
        </section>

        {/* ---------- RIGHT: AMM ---------- */}
        <section
          className="rounded-card border border-ink-100 bg-surface-sunken/40 p-4"
          aria-label={ammTitle}
        >
          <h3 className="text-sm font-semibold text-ink-900">{ammTitle}</h3>

          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="mt-2 w-full"
            role="img"
            aria-label={ammAria}
          >
            {/* Axes */}
            <line
              x1={cPad}
              y1={CH - cPad}
              x2={CW - cPad}
              y2={CH - cPad}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
            />
            <line
              x1={cPad}
              y1={cPad}
              x2={cPad}
              y2={CH - cPad}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
            />
            <text
              x={CW - cPad}
              y={CH - cPad + 14}
              textAnchor="end"
              fontSize="9"
              fill="var(--color-ink-400)"
            >
              base reserve (x)
            </text>
            <text
              x={cPad - 4}
              y={cPad - 8}
              fontSize="9"
              fill="var(--color-ink-400)"
            >
              quote reserve (y)
            </text>

            {/* Constant-product curve x·y = k */}
            <path
              d={curvePath}
              fill="none"
              stroke="var(--color-accent-400)"
              strokeWidth={2.5}
            />

            {/* Path travelled from start → current along the curve */}
            <line
              x1={startCx}
              y1={startCy}
              x2={pointCx}
              y2={pointCy}
              stroke="var(--color-brand-400)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.7}
            />

            {/* Resting (start) pool point */}
            <circle
              cx={startCx}
              cy={startCy}
              r={4}
              fill="var(--color-surface)"
              stroke="var(--color-ink-300)"
              strokeWidth={1.5}
            />

            {/* Drop lines from the live pool point to the axes */}
            <line
              x1={pointCx}
              y1={pointCy}
              x2={pointCx}
              y2={CH - cPad}
              stroke="var(--color-brand-300)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <line
              x1={cPad}
              y1={pointCy}
              x2={pointCx}
              y2={pointCy}
              stroke="var(--color-brand-300)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />

            {/* Live pool point */}
            <circle
              cx={pointCx}
              cy={pointCy}
              r={6}
              fill="var(--color-brand-600)"
            />
          </svg>

          <dl
            className="mt-1 grid grid-cols-2 gap-2 text-xs"
            aria-live="polite"
          >
            <div className="rounded-card border border-ink-100 bg-surface px-3 py-2">
              <dt className="text-ink-500">{spotPriceLabel}</dt>
              <dd className="font-mono text-base font-semibold text-brand-700 tabular-nums">
                {money(currencyPrefix, livePool.spot)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-100 bg-surface px-3 py-2">
              <dt className="text-ink-500">{reservesLabel}</dt>
              <dd className="font-mono text-sm font-semibold text-ink-900 tabular-nums">
                {livePool.x.toFixed(1)} / {livePool.y.toFixed(0)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={buyAmm}
              disabled={spent >= maxSpend}
              className={cx(
                buttonBase,
                spent >= maxSpend
                  ? 'cursor-not-allowed bg-ink-200 text-ink-400'
                  : 'bg-brand-600 text-white hover:bg-brand-700',
              )}
            >
              ▶ {buyButtonLabel}
            </button>
            <button
              type="button"
              onClick={resetAmm}
              disabled={spent === 0}
              className={cx(
                buttonBase,
                'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
                spent === 0 && 'cursor-not-allowed opacity-50',
              )}
            >
              {resetLabel}
            </button>
          </div>
        </section>
      </div>

      {/* ---------- COMPARISON TABLE ---------- */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200">
              <th className="px-3 py-2 font-semibold text-ink-500">
                {aspectColLabel}
              </th>
              <th className="px-3 py-2 font-semibold text-brand-700">
                {orderbookColLabel}
              </th>
              <th className="px-3 py-2 font-semibold text-accent-700">
                {ammColLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`row-${i}`}
                className={cx(
                  'border-b border-ink-100 align-top',
                  i % 2 === 1 && 'bg-surface-sunken/40',
                )}
              >
                <td className="px-3 py-2 font-medium text-ink-900">
                  {row.aspect}
                </td>
                <td className="px-3 py-2 text-ink-700">{row.orderbook}</td>
                <td className="px-3 py-2 text-ink-700">{row.amm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default OrderbookVsAmm;
