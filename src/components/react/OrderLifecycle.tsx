import { useEffect, useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface OrderLifecycleProps {
  /** Heading above the visualization. */
  title?: string;
  /** Group label for the order-type selector. */
  orderTypeGroupLabel?: string;
  /** Label for the market-buy order type. */
  marketLabel?: string;
  /** Label for the limit-buy order type. */
  limitLabel?: string;
  /** Label for the stop-buy order type. */
  stopLabel?: string;
  /** Button label to place the selected order. */
  placeLabel?: string;
  /** Button label to advance the lifecycle one step. */
  nextLabel?: string;
  /** Button label to reset the visualization. */
  resetLabel?: string;
  /** Route node label for the investor. */
  youLabel?: string;
  /** Route node label for the broker. */
  brokerLabel?: string;
  /** Route node label for the exchange. */
  exchangeLabel?: string;
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
  /** Tag shown on the row your limit order occupies in the book. */
  yourOrderLabel?: string;
  /** Status caption when an order (or part of it) has filled. */
  filledLabel?: string;
  /** Status caption while a resting limit order waits in the book. */
  waitingLabel?: string;
  /** Status caption while a stop order is dormant. */
  dormantLabel?: string;
  /** Status caption once a stop order's trigger fires. */
  triggeredLabel?: string;
  /** Label for the list of individual fills. */
  fillsLabel?: string;
  /** Label for the average fill price readout. */
  avgFillLabel?: string;
  /** Label for the best-ask reference price readout. */
  bestAskLabel?: string;
  /** Label for the limit-price readout. */
  limitPriceLabel?: string;
  /** Label for the stop trigger-price readout / book marker. */
  triggerPriceLabel?: string;
  /** Caption before any order is placed. */
  idleCaption?: string;
  /** Caption while the order travels from you to the broker. */
  placedCaption?: string;
  /** Caption while the broker routes the order to the exchange. */
  routedCaption?: string;
  /** Caption when a market order crosses the spread and fills. */
  marketFillCaption?: string;
  /** Caption when a limit order joins the bid side and rests. */
  limitRestCaption?: string;
  /** Caption while a stop order sits dormant at the exchange. */
  stopDormantCaption?: string;
  /** Caption when the price crosses the trigger and the stop wakes up. */
  stopTriggerCaption?: string;
  /** Caption when the converted stop order fills at the new best ask. */
  stopFillCaption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type OrderType = 'market' | 'limit' | 'stop';

interface BookLevel {
  price: number;
  size: number;
}

/** Sell side, best (lowest) ask first. */
const ASKS: BookLevel[] = [
  { price: 100.1, size: 300 },
  { price: 100.2, size: 500 },
  { price: 100.3, size: 400 },
  { price: 100.4, size: 600 },
];

/** Buy side, best (highest) bid first. */
const BIDS: BookLevel[] = [
  { price: 100.0, size: 400 },
  { price: 99.9, size: 500 },
  { price: 99.8, size: 350 },
  { price: 99.7, size: 600 },
];

/** Market buy is bigger than the best ask, so it walks the book. */
const MARKET_SIZE = 500;
const MARKET_FILLS: BookLevel[] = [
  { price: 100.1, size: 300 },
  { price: 100.2, size: 200 },
];
const MARKET_AVG =
  MARKET_FILLS.reduce((s, f) => s + f.price * f.size, 0) / MARKET_SIZE;

/** Limit buy between best bid and best ask: becomes the new best bid. */
const LIMIT_ORDER: BookLevel = { price: 100.05, size: 400 };

/** Stop buy: dormant until the market trades up through the trigger. */
const STOP_TRIGGER = 100.3;
const STOP_FILL: BookLevel = { price: 100.4, size: 300 };

const MAX_STEP: Record<OrderType, number> = { market: 3, limit: 3, stop: 5 };

const MAX_SIZE = Math.max(...ASKS.map((l) => l.size), ...BIDS.map((l) => l.size));

type LevelStatus = 'normal' | 'filled' | 'gone';

/**
 * Step-through animation of an order's lifecycle through a simplified limit
 * order book. Pick an order type — market buy, limit buy, or stop buy — and
 * place it: a chip travels You → Broker → Exchange, then the book reacts. The
 * market order crosses the spread and walks the ask side (visible slippage on
 * the average fill); the limit order joins the bid side as the new best bid
 * and waits; the stop order lies dormant until the price trades through its
 * trigger, converts to a market order, and fills at the (now higher) best ask.
 * Every advance is user-triggered. Respects `prefers-reduced-motion` (state
 * changes jump with no transitions).
 */
export function OrderLifecycle({
  title = 'Life of an order',
  orderTypeGroupLabel = 'Order type',
  marketLabel = 'Market buy',
  limitLabel = 'Limit buy',
  stopLabel = 'Stop buy',
  placeLabel = 'Place order',
  nextLabel = 'Next step',
  resetLabel = 'Reset',
  youLabel = 'You',
  brokerLabel = 'Broker',
  exchangeLabel = 'Exchange',
  asksLabel = 'Asks (sellers)',
  bidsLabel = 'Bids (buyers)',
  spreadLabel = 'Bid–ask spread',
  priceLabel = 'Price',
  sizeLabel = 'Size',
  yourOrderLabel = 'Your order',
  filledLabel = 'Filled',
  waitingLabel = 'Waiting',
  dormantLabel = 'Dormant',
  triggeredLabel = 'Triggered',
  fillsLabel = 'Fills',
  avgFillLabel = 'Average fill price',
  bestAskLabel = 'Best ask was',
  limitPriceLabel = 'Limit price',
  triggerPriceLabel = 'Trigger price',
  idleCaption = 'Choose an order type, then place the order and step through its journey.',
  placedCaption = 'The order leaves you and lands at your broker.',
  routedCaption = 'The broker routes the order on to the exchange, where the order book lives.',
  marketFillCaption = 'The market order crosses the spread and takes the best asks immediately. It is bigger than the first ask level, so it walks down the book — the average price ends up worse than the best ask. That gap is slippage.',
  limitRestCaption = 'The limit order will not pay more than its limit price, so it cannot cross the spread. Instead it joins the bid side as the new best bid and waits for a seller to come to it.',
  stopDormantCaption = 'The stop order sits dormant at the exchange. Nothing happens until the market trades at or above the trigger price.',
  stopTriggerCaption = 'Buyers lift the asks and the price trades up through the trigger — the stop wakes up and converts into a market order.',
  stopFillCaption = 'Now a plain market order, it fills at whatever the best ask happens to be — which has already moved above the trigger. Stops guarantee activation, never price.',
  currencyPrefix = '$',
  className,
}: OrderLifecycleProps) {
  const id = useId();
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  const maxStep = MAX_STEP[orderType];
  const price = (v: number) => `${currencyPrefix}${v.toFixed(2)}`;

  const orderTypes: { key: OrderType; label: string }[] = [
    { key: 'market', label: marketLabel },
    { key: 'limit', label: limitLabel },
    { key: 'stop', label: stopLabel },
  ];

  const captions: Record<OrderType, string[]> = {
    market: [idleCaption, placedCaption, routedCaption, marketFillCaption],
    limit: [idleCaption, placedCaption, routedCaption, limitRestCaption],
    stop: [
      idleCaption,
      placedCaption,
      routedCaption,
      stopDormantCaption,
      stopTriggerCaption,
      stopFillCaption,
    ],
  };
  const caption = captions[orderType][Math.min(step, maxStep)] ?? idleCaption;

  // ── Derived book state ────────────────────────────────────────────────────
  const askStatus = (i: number): LevelStatus => {
    if (orderType === 'market' && step >= 3 && i <= 1) return 'filled';
    if (orderType === 'stop') {
      if (step >= 4 && i <= 2) return 'gone'; // price traded up through these
      if (step >= 5 && i === 3) return 'filled';
    }
    return 'normal';
  };

  const limitResting = orderType === 'limit' && step >= 3;
  const stopDormant = orderType === 'stop' && step === 3;
  const stopTriggered = orderType === 'stop' && step >= 4;
  const stopFilled = orderType === 'stop' && step >= 5;
  const marketFilled = orderType === 'market' && step >= 3;

  const bestAsk =
    orderType === 'stop' && step >= 4 ? STOP_FILL.price : ASKS[0].price;
  const bestBid = limitResting ? LIMIT_ORDER.price : BIDS[0].price;

  // Chip travel position along You → Broker → Exchange (0 / 1 / 2).
  const chipNode = step <= 0 ? 0 : step === 1 ? 1 : 2;
  const chipVisible = step >= 1 && !(marketFilled || limitResting || stopFilled);

  const orderStatus = marketFilled
    ? filledLabel
    : limitResting
      ? waitingLabel
      : stopFilled
        ? filledLabel
        : stopTriggered
          ? triggeredLabel
          : stopDormant
            ? dormantLabel
            : null;

  const advance = () => setStep((s) => Math.min(maxStep, s + 1));
  const reset = () => setStep(0);
  const pickType = (t: OrderType) => {
    setOrderType(t);
    setStep(0);
  };

  const transition = reducedMotion
    ? 'transition-none'
    : 'transition-all duration-700 ease-out';

  // ── Row renderer ──────────────────────────────────────────────────────────
  const levelRow = (
    level: BookLevel,
    side: 'ask' | 'bid',
    status: LevelStatus,
    extra?: { tag?: string; highlight?: boolean },
  ) => (
    <div
      key={`${side}-${level.price}`}
      className={cx(
        'grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 rounded px-2 py-1',
        transition,
        status === 'gone' && 'opacity-30',
        status === 'filled' && 'bg-brand-100 ring-1 ring-brand-500',
        extra?.highlight && 'bg-accent-500/10 ring-1 ring-accent-500',
      )}
    >
      <span
        className={cx(
          'font-mono text-sm tabular-nums',
          side === 'ask' ? 'text-accent-700' : 'text-brand-700',
          status === 'gone' && 'line-through',
        )}
      >
        {price(level.price)}
      </span>
      <span className="relative h-3 overflow-hidden rounded-pill bg-surface-sunken">
        <span
          className={cx(
            'absolute inset-y-0 left-0 rounded-pill',
            transition,
            side === 'ask' ? 'bg-accent-400' : 'bg-brand-400',
            status === 'gone' && 'opacity-0',
          )}
          style={{ width: `${(level.size / MAX_SIZE) * 100}%` }}
          aria-hidden="true"
        />
      </span>
      <span className="text-right font-mono text-xs tabular-nums text-ink-600">
        {status === 'gone' ? '—' : level.size}
        {extra?.tag ? (
          <span className="ml-1 rounded-pill bg-accent-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {extra.tag}
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Order-type selector */}
      <div
        role="radiogroup"
        aria-label={orderTypeGroupLabel}
        className="mt-3 flex flex-wrap gap-2"
      >
        {orderTypes.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={orderType === t.key}
            onClick={() => pickType(t.key)}
            className={cx(
              'rounded-pill px-4 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              reducedMotion ? '' : 'transition',
              orderType === t.key
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-surface text-ink-700 hover:bg-surface-sunken',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Route: You → Broker → Exchange */}
      <div className="relative mt-5">
        <div className="grid grid-cols-3 gap-2">
          {[youLabel, brokerLabel, exchangeLabel].map((label, i) => (
            <div
              key={label}
              className={cx(
                'rounded-card border px-3 py-2 text-center text-sm',
                transition,
                chipNode === i && step >= 1
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                  : 'border-ink-200 bg-surface text-ink-600',
              )}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Travelling order chip */}
        <div
          className={cx(
            'pointer-events-none absolute -bottom-3 h-6 w-1/3',
            transition,
            chipVisible ? 'opacity-100' : 'opacity-0',
          )}
          style={{ left: `${chipNode * 33.333}%` }}
          aria-hidden="true"
        >
          <span
            className={cx(
              'mx-auto block w-fit rounded-pill bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white shadow-soft',
              stopDormant && !reducedMotion && 'animate-pulse',
              stopDormant && 'bg-ink-400',
              stopTriggered && !stopFilled && 'bg-accent-600',
            )}
          >
            {orderTypes.find((t) => t.key === orderType)?.label}
          </span>
        </div>
      </div>

      {/* Order book */}
      <div className="mt-7 rounded-card border border-ink-100 bg-surface-muted p-3">
        <div className="grid grid-cols-[5.5rem_1fr_3.5rem] gap-2 px-2 text-xs font-medium text-ink-500">
          <span>{priceLabel}</span>
          <span />
          <span className="text-right">{sizeLabel}</span>
        </div>

        {/* Asks: worst at the top, best ask just above the spread */}
        <p className="mt-2 px-2 text-xs font-medium text-accent-700">{asksLabel}</p>
        <div className="mt-1 space-y-0.5">
          {[...ASKS]
            .map((level, i) => ({ level, i }))
            .reverse()
            .map(({ level, i }) => (
              <div key={level.price} className="relative">
                {orderType === 'stop' && level.price === STOP_TRIGGER && step >= 1 ? (
                  <span
                    className={cx(
                      'pointer-events-none absolute inset-x-0 top-0 border-t-2 border-dashed',
                      stopTriggered ? 'border-accent-600' : 'border-ink-300',
                      transition,
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                {levelRow(level, 'ask', askStatus(i))}
              </div>
            ))}
        </div>

        {/* Spread band */}
        <div
          className={cx(
            'my-1.5 flex items-center justify-between rounded bg-accent-500/10 px-2 py-1.5 ring-1 ring-accent-500/40',
            transition,
          )}
        >
          <span className="text-xs font-medium text-accent-700">{spreadLabel}</span>
          <span className="font-mono text-xs tabular-nums text-ink-700">
            {price(bestBid)} – {price(bestAsk)}
          </span>
        </div>

        {/* Bids: best bid just below the spread */}
        <div className="space-y-0.5">
          {limitResting
            ? levelRow(LIMIT_ORDER, 'bid', 'normal', {
                tag: yourOrderLabel,
                highlight: true,
              })
            : null}
          {BIDS.map((level) => levelRow(level, 'bid', 'normal'))}
        </div>
        <p className="mt-1 px-2 text-xs font-medium text-brand-700">{bidsLabel}</p>
      </div>

      {/* Status + result readouts */}
      <div aria-live="polite" className="mt-4">
        {orderStatus ? (
          <span
            className={cx(
              'inline-block rounded-pill px-3 py-1 text-xs font-medium text-white',
              marketFilled || stopFilled
                ? 'bg-brand-600'
                : stopTriggered
                  ? 'bg-accent-600'
                  : 'bg-ink-500',
            )}
          >
            {orderStatus}
          </span>
        ) : null}

        {marketFilled ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{fillsLabel}</dt>
              <dd className="font-mono text-ink-900">
                {MARKET_FILLS.map((f) => (
                  <span key={f.price} className="block tabular-nums">
                    {f.size} × {price(f.price)}
                  </span>
                ))}
              </dd>
            </div>
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{bestAskLabel}</dt>
              <dd className="font-mono text-lg font-semibold text-brand-700">
                {price(ASKS[0].price)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{avgFillLabel}</dt>
              <dd className="font-mono text-lg font-semibold text-accent-700">
                {price(MARKET_AVG)}
              </dd>
            </div>
          </dl>
        ) : null}

        {limitResting ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{limitPriceLabel}</dt>
              <dd className="font-mono text-lg font-semibold text-brand-700">
                {price(LIMIT_ORDER.price)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{bestAskLabel}</dt>
              <dd className="font-mono text-lg font-semibold text-accent-700">
                {price(ASKS[0].price)}
              </dd>
            </div>
          </dl>
        ) : null}

        {orderType === 'stop' && step >= 3 ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
              <dt className="text-ink-500">{triggerPriceLabel}</dt>
              <dd className="font-mono text-lg font-semibold text-brand-700">
                {price(STOP_TRIGGER)}
              </dd>
            </div>
            {stopFilled ? (
              <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
                <dt className="text-ink-500">{avgFillLabel}</dt>
                <dd className="font-mono text-lg font-semibold text-accent-700">
                  {price(STOP_FILL.price)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <p id={`${id}-caption`} className="mt-3 text-sm leading-relaxed text-ink-600">
          {caption}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        {step < maxStep ? (
          <button
            type="button"
            onClick={advance}
            aria-describedby={`${id}-caption`}
            className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {step === 0 ? placeLabel : nextLabel}
          </button>
        ) : null}
        {step > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-pill border border-ink-200 bg-surface px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {resetLabel}
          </button>
        ) : null}
      </div>
    </figure>
  );
}

export default OrderLifecycle;
