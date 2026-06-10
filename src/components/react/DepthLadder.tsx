import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DepthLadderProps {
  /** Heading above the visualization. */
  title?: string;
  /** Label for the order-size slider. */
  orderSizeLabel?: string;
  /** Column heading for the ask ladder. */
  asksLabel?: string;
  /** Header label for the price column. */
  priceLabel?: string;
  /** Header label for the resting-size column. */
  restingLabel?: string;
  /** Header label for the cumulative-depth column. */
  cumulativeLabel?: string;
  /** Tag shown on a fully-consumed level. */
  filledLabel?: string;
  /** Tag shown on a partially-consumed level. */
  partialLabel?: string;
  /** Label for the best-ask readout. */
  bestAskLabel?: string;
  /** Label for the average-fill readout. */
  avgFillLabel?: string;
  /** Label for the slippage (vs best ask) readout. */
  slippageLabel?: string;
  /** Label for the total-cost readout. */
  totalCostLabel?: string;
  /** Label for the levels-touched readout. */
  levelsTouchedLabel?: string;
  /** Label for the book-depth control group. */
  depthLabel?: string;
  /** Label for the thin-book preset. */
  thinLabel?: string;
  /** Label for the normal-book preset. */
  normalLabel?: string;
  /** Label for the deep-book preset. */
  deepLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

type Depth = 'thin' | 'normal' | 'deep';

interface AskLevel {
  price: number;
  size: number;
}

const BEST_ASK = 100.0;
const TICK = 0.1;

/** Build a 6-level ask ladder for a given depth, best ask first. */
function ladder(depth: Depth): AskLevel[] {
  const base = depth === 'thin' ? 100 : depth === 'normal' ? 300 : 800;
  return Array.from({ length: 6 }, (_, i) => ({
    price: +(BEST_ASK + i * TICK).toFixed(2),
    size: base + i * (depth === 'thin' ? 20 : depth === 'normal' ? 50 : 150),
  }));
}

/**
 * "Walk the book" depth/slippage simulator on a discrete limit order book —
 * the order-book counterpart to the AMM-curve SlippageCurve. A market buy of
 * the chosen size eats the ask ladder level by level: the visualization fills
 * each consumed level (and the partially-eaten one), then reports the volume-
 * weighted average fill, the slippage versus the best ask, the total cash cost,
 * and how many price levels the order had to chew through. Three book-depth
 * presets (thin / normal / deep) let the learner feel the same order cost wildly
 * different amounts depending on how much size is resting near the top. Pure
 * arithmetic, no animation loop — reduced motion needs no special handling. All
 * user-facing strings are props; the worked numbers belong in the MDX prose.
 */
export function DepthLadder({
  title = 'Walking the book',
  orderSizeLabel = 'Market buy size (shares)',
  asksLabel = 'Ask ladder (sellers)',
  priceLabel = 'Price',
  restingLabel = 'Resting',
  cumulativeLabel = 'Cumulative',
  filledLabel = 'Filled',
  partialLabel = 'Partial',
  bestAskLabel = 'Best ask',
  avgFillLabel = 'Average fill',
  slippageLabel = 'Slippage vs best ask',
  totalCostLabel = 'Total cost',
  levelsTouchedLabel = 'Levels touched',
  depthLabel = 'Book depth',
  thinLabel = 'Thin',
  normalLabel = 'Normal',
  deepLabel = 'Deep',
  caption = 'A market order eats the cheapest sellers first, then climbs to pricier levels. The deeper the book near the top, the more size you can buy before the average price drifts away from the best ask. Slippage is that drift.',
  currencyPrefix = '$',
  className,
}: DepthLadderProps) {
  const id = useId();
  const [depth, setDepth] = useState<Depth>('normal');
  const [size, setSize] = useState(500);

  const levels = useMemo(() => ladder(depth), [depth]);
  const totalDepth = useMemo(() => levels.reduce((s, l) => s + l.size, 0), [levels]);
  const maxSize = totalDepth;

  // Walk the ladder.
  const walk = useMemo(() => {
    let remaining = Math.min(size, totalDepth);
    let cost = 0;
    let filledShares = 0;
    const status: Array<'full' | 'partial' | 'untouched'> = [];
    let cum = 0;
    const cumByLevel: number[] = [];
    for (const lv of levels) {
      cum += lv.size;
      cumByLevel.push(cum);
      if (remaining <= 0) {
        status.push('untouched');
        continue;
      }
      const take = Math.min(remaining, lv.size);
      cost += take * lv.price;
      filledShares += take;
      remaining -= take;
      status.push(take >= lv.size ? 'full' : 'partial');
    }
    const avg = filledShares > 0 ? cost / filledShares : BEST_ASK;
    const touched = status.filter((s) => s !== 'untouched').length;
    return { cost, filledShares, avg, touched, status, cumByLevel };
  }, [levels, size, totalDepth]);

  const price = (v: number) => `${currencyPrefix}${v.toFixed(2)}`;
  const slippage = walk.avg - BEST_ASK;
  const maxBar = Math.max(...levels.map((l) => l.size), 1);

  const depthButtons: Array<{ value: Depth; label: string }> = [
    { value: 'thin', label: thinLabel },
    { value: 'normal', label: normalLabel },
    { value: 'deep', label: deepLabel },
  ];

  const ariaLabel = `${title}. ${orderSizeLabel}: ${size}. ${avgFillLabel}: ${price(
    walk.avg,
  )}. ${slippageLabel}: ${price(slippage)}. ${levelsTouchedLabel}: ${walk.touched}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-600 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
          {avgFillLabel}: {price(walk.avg)}
        </span>
      </figcaption>

      {/* Ladder */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-muted p-3">
        <p className="px-1 text-xs font-medium text-accent-700">{asksLabel}</p>
        <div className="mt-2 grid grid-cols-[5rem_1fr_4rem_4.5rem] gap-2 px-1 text-xs font-medium text-ink-500">
          <span>{priceLabel}</span>
          <span />
          <span className="text-right">{restingLabel}</span>
          <span className="text-right">{cumulativeLabel}</span>
        </div>
        <div className="mt-1 space-y-0.5">
          {levels.map((lv, i) => {
            const st = walk.status[i];
            return (
              <div
                key={lv.price}
                className={cx(
                  'grid grid-cols-[5rem_1fr_4rem_4.5rem] items-center gap-2 rounded px-1 py-1 transition-colors duration-300',
                  st === 'full' && 'bg-accent-100 ring-1 ring-accent-500',
                  st === 'partial' && 'bg-brand-100 ring-1 ring-brand-500',
                )}
              >
                <span className="font-mono text-sm tabular-nums text-accent-700">{price(lv.price)}</span>
                <span className="relative h-3 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden="true">
                  <span
                    className={cx(
                      'absolute inset-y-0 left-0 rounded-pill transition-all duration-500',
                      st === 'full' ? 'bg-accent-500' : st === 'partial' ? 'bg-brand-500' : 'bg-accent-300',
                    )}
                    style={{ width: `${(lv.size / maxBar) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-ink-600">{lv.size}</span>
                <span className="text-right font-mono text-xs tabular-nums text-ink-500">
                  {st === 'untouched' ? walk.cumByLevel[i] : null}
                  {st === 'full' ? (
                    <span className="rounded-pill bg-accent-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {filledLabel}
                    </span>
                  ) : null}
                  {st === 'partial' ? (
                    <span className="rounded-pill bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {partialLabel}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order-size slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-size`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{orderSizeLabel}</span>
          <span className="font-mono text-ink-900">{size.toLocaleString('en-US')}</span>
        </label>
        <input
          id={`${id}-size`}
          type="range"
          min={50}
          max={maxSize}
          step={50}
          value={Math.min(size, maxSize)}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-label={orderSizeLabel}
          className="mt-2 w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        />
      </div>

      {/* Depth presets */}
      <div className="mt-4">
        <p className="text-sm text-ink-700" id={`${id}-depth`}>
          {depthLabel}
        </p>
        <div className="mt-2 inline-flex gap-2" role="group" aria-labelledby={`${id}-depth`}>
          {depthButtons.map((b) => {
            const active = depth === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setDepth(b.value)}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestAskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{price(BEST_ASK)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{avgFillLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">{price(walk.avg)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{slippageLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{price(slippage)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalCostLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {currencyPrefix}
            {walk.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{levelsTouchedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{walk.touched}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DepthLadder;
