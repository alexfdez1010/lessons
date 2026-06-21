import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarketMakingQuoteLadderProps {
  /** Heading above the ladder. */
  title?: string;
  /** Label for the inventory slider. */
  inventoryLabel?: string;
  /** Label for the half-spread slider. */
  spreadLabel?: string;
  /** Label for the "short" end of the inventory axis. */
  shortLabel?: string;
  /** Label for the "long" end of the inventory axis. */
  longLabel?: string;
  /** Caption above the bid column. */
  bidLabel?: string;
  /** Caption above the ask column. */
  askLabel?: string;
  /** Tag shown on the maker's own bid quote. */
  myBidLabel?: string;
  /** Tag shown on the maker's own ask quote. */
  myAskLabel?: string;
  /** Label for the mid / reservation-price marker. */
  midLabel?: string;
  /** Label for the reservation-price marker. */
  reservationLabel?: string;
  /** Label for the reservation-price chip readout in the header. */
  reservationLabelReadout?: string;
  /** One-line takeaway shown under the ladder. */
  caption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const MID = 100; // true mid price
const TICK = 0.05; // price grid
const LEVELS = 9; // price levels each side of the reservation band

// A fixed, plausible resting-depth profile (thinner near the touch, thicker
// deeper in the book) used for both sides of the ladder, indexed by distance.
const DEPTH = [4, 9, 14, 18, 22, 25, 27, 28, 29];

/**
 * Market-making quote ladder. A vertical price grid (the order book) with resting
 * depth bars on each side, the maker's OWN bid and ask highlighted in the ladder,
 * and a reservation-price marker. Two sliders drive it:
 *   • inventory — long inventory slides the reservation price *down*, skewing the
 *     whole two-sided quote lower (eager to sell, reluctant to buy); short slides
 *     it up. This is the inventory-skew steering the maker applies on top of the
 *     mid.
 *   • half-spread — how far the maker posts its quotes from the reservation price
 *     (the spread it charges for providing liquidity).
 *
 * Slider-driven, so prefers-reduced-motion is satisfied by construction. All
 * user-facing strings are props; all colours are design tokens.
 */
export function MarketMakingQuoteLadder({
  title = 'A market maker’s quote ladder',
  inventoryLabel = 'Inventory q',
  spreadLabel = 'Half-spread (ticks)',
  shortLabel = 'Short',
  longLabel = 'Long',
  bidLabel = 'Resting bids',
  askLabel = 'Resting asks',
  myBidLabel = 'My bid',
  myAskLabel = 'My ask',
  midLabel = 'Mid',
  reservationLabel = 'Reservation',
  caption = 'Inventory steers the whole two-sided quote, not the spread. Get long and the reservation price drops: your ask moves toward the touch (sell eagerly to shed risk) while your bid retreats (buy reluctantly). Get short and both quotes rise. The half-spread slider only widens or narrows the gap around wherever the reservation price has been steered.',
  reservationLabelReadout = 'Reservation price',
  currencyPrefix = '$',
  className,
}: MarketMakingQuoteLadderProps) {
  const id = useId();
  const [q, setQ] = useState(0); // inventory in lots, −5 … +5
  const [halfTicks, setHalfTicks] = useState(2); // half-spread in ticks

  const Q_MAX = 5;
  const SKEW_TICKS_PER_LOT = 0.8; // how hard inventory steers the reservation price

  // Reservation price = mid skewed down by long inventory (up by short).
  const skewTicks = -q * SKEW_TICKS_PER_LOT;
  const reservation = MID + skewTicks * TICK;
  const myAsk = reservation + halfTicks * TICK;
  const myBid = reservation - halfTicks * TICK;

  // Build the price ladder centred on the (un-skewed) mid so the skew is visible
  // as the quotes sliding through a fixed grid.
  const prices = useMemo(
    () => Array.from({ length: LEVELS * 2 + 1 }, (_, i) => MID + (LEVELS - i) * TICK),
    [],
  );

  const money = (v: number) => `${currencyPrefix}${v.toFixed(2)}`;
  const nearestTick = (v: number) => Math.round((v - MID) / TICK) * TICK + MID;
  const myBidRow = nearestTick(myBid);
  const myAskRow = nearestTick(myAsk);
  const depthFor = (price: number) => DEPTH[Math.min(DEPTH.length - 1, Math.abs(Math.round((price - MID) / TICK)) - 1)] ?? 0;
  const maxDepth = Math.max(...DEPTH);

  const ariaLabel = `${title}. At inventory ${q}, reservation price ${money(reservation)}, my bid ${money(
    myBid,
  )}, my ask ${money(myAsk)}.`;

  return (
    <figure className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            q > 0 ? 'bg-brand-600' : q < 0 ? 'bg-accent-600' : 'bg-ink-400',
          )}
          aria-live="polite"
        >
          {reservationLabelReadout}: {money(reservation)}
        </span>
      </figcaption>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-xs" role="img" aria-label={ariaLabel}>
        <div className="text-right font-medium text-brand-700">{bidLabel}</div>
        <div />
        <div className="font-medium text-accent-700">{askLabel}</div>

        {prices.map((price) => {
          const isAskSide = price > MID + 1e-9;
          const isBidSide = price < MID - 1e-9;
          const depth = depthFor(price);
          const widthPct = (depth / maxDepth) * 100;
          const isMyBid = Math.abs(price - myBidRow) < 1e-9;
          const isMyAsk = Math.abs(price - myAskRow) < 1e-9;
          const isMidRow = Math.abs(price - MID) < 1e-9;

          return (
            <div key={price.toFixed(2)} className="contents">
              {/* bid side bar (grows leftward) */}
              <div className="flex h-6 items-center justify-end">
                {isBidSide && (
                  <div
                    className={cx('h-4 rounded-l-sm', isMyBid ? 'bg-brand-600' : 'bg-brand-200')}
                    style={{ width: `${widthPct}%`, transition: 'width 200ms ease' }}
                  />
                )}
                {isMyBid && (
                  <span className="ml-1 shrink-0 rounded-pill bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {myBidLabel}
                  </span>
                )}
              </div>

              {/* centre price label */}
              <div
                className={cx(
                  'px-2 text-center font-mono tabular-nums',
                  isMidRow ? 'font-semibold text-ink-900' : 'text-ink-500',
                )}
              >
                {price.toFixed(2)}
                {isMidRow && <span className="ml-1 text-[10px] font-normal text-ink-400">{midLabel}</span>}
              </div>

              {/* ask side bar (grows rightward) */}
              <div className="flex h-6 items-center justify-start">
                {isMyAsk && (
                  <span className="mr-1 shrink-0 rounded-pill bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {myAskLabel}
                  </span>
                )}
                {isAskSide && (
                  <div
                    className={cx('h-4 rounded-r-sm', isMyAsk ? 'bg-accent-600' : 'bg-accent-200')}
                    style={{ width: `${widthPct}%`, transition: 'width 200ms ease' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* reservation marker readout */}
      <p className="mt-3 text-center text-xs text-ink-600" aria-live="polite">
        {reservationLabel}: <span className="font-mono font-semibold text-ink-900">{money(reservation)}</span>
        {'  ·  '}
        {myBidLabel} <span className="font-mono text-brand-700">{money(myBid)}</span>
        {'  /  '}
        {myAskLabel} <span className="font-mono text-accent-700">{money(myAsk)}</span>
      </p>

      {/* inventory slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-q`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{inventoryLabel}</span>
          <span className="font-mono text-ink-900">{q > 0 ? '+' : ''}{q}</span>
        </label>
        <input
          id={`${id}-q`}
          type="range"
          min={-Q_MAX}
          max={Q_MAX}
          step={1}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          aria-label={inventoryLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>← {shortLabel}</span>
          <span>{longLabel} →</span>
        </div>
      </div>

      {/* half-spread slider */}
      <div className="mt-3">
        <label htmlFor={`${id}-s`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{spreadLabel}</span>
          <span className="font-mono text-ink-900">{halfTicks}</span>
        </label>
        <input
          id={`${id}-s`}
          type="range"
          min={1}
          max={5}
          step={1}
          value={halfTicks}
          onChange={(e) => setHalfTicks(Number(e.target.value))}
          aria-label={spreadLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MarketMakingQuoteLadder;
