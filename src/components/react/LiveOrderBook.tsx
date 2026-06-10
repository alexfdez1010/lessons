import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LiveOrderBookProps {
  /** Heading above the visualization. */
  title?: string;
  /** Column heading for the sell side of the book. */
  asksLabel?: string;
  /** Column heading for the buy side of the book. */
  bidsLabel?: string;
  /** Label for the highlighted bid–ask spread band. */
  spreadLabel?: string;
  /** Header label for the price column. */
  priceLabel?: string;
  /** Header label for the size column. */
  sizeLabel?: string;
  /** Label for the best-bid readout. */
  bestBidLabel?: string;
  /** Label for the best-ask readout. */
  bestAskLabel?: string;
  /** Label for the midpoint readout. */
  midLabel?: string;
  /** Label for the spread-width readout. */
  spreadWidthLabel?: string;
  /** Label for the last-trade readout. */
  lastTradeLabel?: string;
  /** Button label to start the live feed. */
  playLabel?: string;
  /** Button label to pause the live feed. */
  pauseLabel?: string;
  /** Button label to inject a market buy that crosses the spread. */
  marketBuyLabel?: string;
  /** Button label to inject a market sell that crosses the spread. */
  marketSellLabel?: string;
  /** Static caption shown when reduced motion is preferred (no live feed). */
  reducedMotionCaption?: string;
  /** One-line takeaway shown under the book. */
  caption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Level {
  price: number;
  size: number;
}

const TICK = 0.05;
const LEVELS = 5;
const MID = 50;

/** Build a fresh, plausible book centred on `MID`. */
function freshBook(): { asks: Level[]; bids: Level[] } {
  const asks: Level[] = [];
  const bids: Level[] = [];
  for (let i = 0; i < LEVELS; i++) {
    asks.push({
      price: +(MID + TICK + i * TICK).toFixed(2),
      size: 200 + Math.round(Math.random() * 6) * 100,
    });
    bids.push({
      price: +(MID - TICK - i * TICK).toFixed(2),
      size: 200 + Math.round(Math.random() * 6) * 100,
    });
  }
  return { asks, bids };
}

/**
 * A live, animated limit order book. Resting buy (bid) and sell (ask) orders
 * stream in and out tick by tick — sizes pulse as liquidity is posted and
 * cancelled, and the best bid / best ask flicker around a moving midpoint. The
 * spread band in the middle shows the standing gap between the best buyer and
 * the best seller. The learner can fire a market buy (which lifts the asks and
 * walks UP the book) or a market sell (which hits the bids and walks DOWN),
 * watching levels light up as "filled" and the last-trade print update. This
 * teaches the order book as the live, two-sided ledger that prices form on —
 * distinct from any AMM curve. Respects `prefers-reduced-motion` by rendering a
 * single static snapshot with no feed. All strings are props (locale-agnostic);
 * no numbers or math are hardcoded into prose-facing copy.
 */
export function LiveOrderBook({
  title = 'A live limit order book',
  asksLabel = 'Asks · sellers',
  bidsLabel = 'Bids · buyers',
  spreadLabel = 'Bid–ask spread',
  priceLabel = 'Price',
  sizeLabel = 'Size',
  bestBidLabel = 'Best bid',
  bestAskLabel = 'Best ask',
  midLabel = 'Midpoint',
  spreadWidthLabel = 'Spread',
  lastTradeLabel = 'Last trade',
  playLabel = 'Start feed',
  pauseLabel = 'Pause',
  marketBuyLabel = 'Market buy',
  marketSellLabel = 'Market sell',
  reducedMotionCaption = 'Live updates are paused because your system prefers reduced motion. This is one snapshot of the book; in reality the sizes and best prices flicker many times a second.',
  caption = 'The book is a living ledger: buyers stack on the bid side, sellers on the ask side, and the gap between the best of each is the spread. A market order does not rest — it reaches across the spread and eats resting orders until it is filled.',
  currencyPrefix = '$',
  className,
}: LiveOrderBookProps) {
  const id = useId();
  const [reduced, setReduced] = useState(false);
  const [running, setRunning] = useState(false);
  const [book, setBook] = useState<{ asks: Level[]; bids: Level[] }>(() => freshBook());
  const [flash, setFlash] = useState<{ side: 'ask' | 'bid'; n: number } | null>(null);
  const [lastTrade, setLastTrade] = useState<{ price: number; side: 'buy' | 'sell' } | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Live feed: jitter resting sizes and occasionally shift the best prices.
  useEffect(() => {
    if (!running || reduced) return;
    const handle = window.setInterval(() => {
      setBook((b) => {
        const jitter = (lv: Level): Level => {
          const delta = Math.round((Math.random() - 0.5) * 4) * 50;
          const size = Math.max(100, Math.min(900, lv.size + delta));
          return { ...lv, size };
        };
        return { asks: b.asks.map(jitter), bids: b.bids.map(jitter) };
      });
    }, 900);
    return () => window.clearInterval(handle);
  }, [running, reduced]);

  const flashLevels = (side: 'ask' | 'bid', n: number) => {
    setFlash({ side, n });
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 650);
  };

  // Market order: consume `qty` from the touched side, then book re-forms.
  const marketOrder = (side: 'buy' | 'sell') => {
    const qty = 350;
    setBook((b) => {
      const touched = side === 'buy' ? [...b.asks] : [...b.bids];
      let remaining = qty;
      let eaten = 0;
      let lastPx = touched[0].price;
      for (let i = 0; i < touched.length && remaining > 0; i++) {
        lastPx = touched[i].price;
        const take = Math.min(remaining, touched[i].size);
        touched[i] = { ...touched[i], size: touched[i].size - take };
        remaining -= take;
        eaten = i + 1;
      }
      flashLevels(side === 'buy' ? 'ask' : 'bid', eaten);
      setLastTrade({ price: lastPx, side });
      // Re-form the book: drop emptied levels and append fresh deep levels.
      const cleaned = touched.filter((l) => l.size > 0);
      while (cleaned.length < LEVELS) {
        const ref = cleaned[cleaned.length - 1] ?? touched[0];
        const nextPrice =
          side === 'buy' ? +(ref.price + TICK).toFixed(2) : +(ref.price - TICK).toFixed(2);
        cleaned.push({ price: nextPrice, size: 200 + Math.round(Math.random() * 6) * 100 });
      }
      return side === 'buy' ? { ...b, asks: cleaned } : { ...b, bids: cleaned };
    });
  };

  const bestAsk = book.asks[0].price;
  const bestBid = book.bids[0].price;
  const mid = +((bestAsk + bestBid) / 2).toFixed(3);
  const spread = +(bestAsk - bestBid).toFixed(2);
  const maxSize = Math.max(...book.asks.map((l) => l.size), ...book.bids.map((l) => l.size), 1);
  const price = (v: number) => `${currencyPrefix}${v.toFixed(2)}`;

  const ariaLabel = `${title}. ${bestBidLabel} ${price(bestBid)}, ${bestAskLabel} ${price(
    bestAsk,
  )}, ${spreadWidthLabel} ${price(spread)}.`;

  const row = (level: Level, side: 'ask' | 'bid', idx: number) => {
    const isFlash = flash?.side === side && idx < flash.n;
    return (
      <div
        key={`${side}-${idx}`}
        className={cx(
          'grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2 rounded px-2 py-1',
          reduced ? '' : 'transition-colors duration-300',
          isFlash && (side === 'ask' ? 'bg-accent-100 ring-1 ring-accent-500' : 'bg-brand-100 ring-1 ring-brand-500'),
        )}
      >
        <span
          className={cx(
            'font-mono text-sm tabular-nums',
            side === 'ask' ? 'text-accent-700' : 'text-brand-700',
          )}
        >
          {price(level.price)}
        </span>
        <span className="relative h-3 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden="true">
          <span
            className={cx(
              'absolute inset-y-0 rounded-pill',
              side === 'ask' ? 'right-0 bg-accent-400' : 'left-0 bg-brand-400',
              reduced ? '' : 'transition-all duration-700 ease-out',
            )}
            style={{ width: `${(level.size / maxSize) * 100}%` }}
          />
        </span>
        <span className="text-right font-mono text-xs tabular-nums text-ink-600">{level.size}</span>
      </div>
    );
  };

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        {lastTrade ? (
          <span
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium text-white',
              lastTrade.side === 'buy' ? 'bg-accent-600' : 'bg-brand-600',
            )}
            aria-live="polite"
          >
            {lastTradeLabel}: {price(lastTrade.price)}
          </span>
        ) : null}
      </figcaption>

      {/* Book */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-muted p-3">
        <div className="grid grid-cols-[5rem_1fr_3.5rem] gap-2 px-2 text-xs font-medium text-ink-500">
          <span>{priceLabel}</span>
          <span />
          <span className="text-right">{sizeLabel}</span>
        </div>

        <p className="mt-2 px-2 text-xs font-medium text-accent-700">{asksLabel}</p>
        <div className="mt-1 space-y-0.5">
          {[...book.asks]
            .map((level, i) => ({ level, i }))
            .reverse()
            .map(({ level, i }) => row(level, 'ask', i))}
        </div>

        <div className="my-1.5 flex items-center justify-between rounded bg-ink-100/60 px-2 py-1.5 ring-1 ring-ink-200">
          <span className="text-xs font-medium text-ink-600">{spreadLabel}</span>
          <span className="font-mono text-xs tabular-nums text-ink-700">
            {price(bestBid)} – {price(bestAsk)} · {price(spread)}
          </span>
        </div>

        <div className="space-y-0.5">{book.bids.map((level, i) => row(level, 'bid', i))}</div>
        <p className="mt-1 px-2 text-xs font-medium text-brand-700">{bidsLabel}</p>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestBidLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{price(bestBid)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestAskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">{price(bestAsk)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{midLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{price(mid)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadWidthLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{price(spread)}</dd>
        </div>
      </dl>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        {!reduced ? (
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {running ? pauseLabel : playLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => marketOrder('buy')}
          className="rounded-pill border border-accent-500 bg-accent-50 px-4 py-1.5 text-sm font-medium text-accent-700 transition hover:bg-accent-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {marketBuyLabel}
        </button>
        <button
          type="button"
          onClick={() => marketOrder('sell')}
          className="rounded-pill border border-brand-500 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {marketSellLabel}
        </button>
      </div>

      <p id={`${id}-caption`} className="mt-4 text-sm leading-relaxed text-ink-600">
        {reduced ? reducedMotionCaption : caption}
      </p>
    </figure>
  );
}

export default LiveOrderBook;
