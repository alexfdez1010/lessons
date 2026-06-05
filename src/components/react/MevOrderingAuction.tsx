import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One pending transaction in the mempool. */
export interface MevTransaction {
  /** Stable key used for React + reorder tracking. */
  key: string;
  /** Human-readable label, e.g. "Alice swap". Locale-agnostic — passed in. */
  label: string;
  /**
   * Priority fee / tip the transaction offers the block producer (in the
   * `feeUnit` of your choice). This is captured under EVERY ordering.
   */
  tip: number;
  /**
   * Extra value a block producer / searcher can extract *if this transaction
   * sits in the profitable slot* of the builder-optimal ordering (e.g. a
   * sandwich or back-run bundle paid as a bribe). Captured only when the
   * builder-optimal ordering places it correctly. Defaults to `0` — a plain
   * user transaction whose position carries no extractable value.
   */
  extractable?: number;
  /**
   * Short hint shown on rows whose *position* matters (the value-extracting
   * ones). Locale-agnostic — passed in. Optional.
   */
  positionHint?: string;
}

export interface MevOrderingAuctionProps {
  /** Heading above the figure. */
  title?: string;
  /**
   * The pending transactions. Order here is irrelevant — each preset ordering
   * re-sorts them. Defaults to a 5-transaction illustrative mempool.
   */
  transactions?: MevTransaction[];
  /** Label for the priority-fee preset (descending tips). */
  byFeeLabel?: string;
  /** Label for the builder-optimal preset (max extractable value). */
  builderOptimalLabel?: string;
  /** Label for the FIFO / fair-ordering preset (arrival order). */
  fifoLabel?: string;
  /** Label for the orderings control group. */
  orderingGroupLabel?: string;
  /** `dt` label for the captured-tips readout. */
  tipsCapturedLabel?: string;
  /** `dt` label for the extra-MEV-captured readout. */
  mevCapturedLabel?: string;
  /** `dt` label for the total-value-captured readout (the headline number). */
  totalCapturedLabel?: string;
  /** Column header / caption for the per-transaction tip. */
  tipColumnLabel?: string;
  /** Badge text marking the slot where extractable value is captured. */
  extractedHereLabel?: string;
  /** Unit suffix appended to fee/value numbers, e.g. `'gwei'`. */
  feeUnit?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Ordering = 'fee' | 'builder' | 'fifo';

const DEFAULT_TRANSACTIONS: MevTransaction[] = [
  { key: 'alice', label: 'Alice swap', tip: 2, positionHint: 'Front-running target' },
  { key: 'arb', label: 'Arb bot bundle', tip: 5, extractable: 28, positionHint: 'Must run right after Alice' },
  { key: 'liq', label: 'Liquidation bot', tip: 9, extractable: 14, positionHint: 'Wins the collateral if it goes first' },
  { key: 'nft', label: 'NFT mint', tip: 3 },
  { key: 'bob', label: 'Bob swap', tip: 4 },
];

/** Height of one transaction row, in px, used to compute reorder offsets. */
const ROW_H = 56;
/** Vertical gap between rows, in px (matches the `space-y` below). */
const ROW_GAP = 8;

/**
 * Interactive MEV (Maximal Extractable Value) ordering explainer. The same set
 * of pending transactions sits in the mempool; the learner flips between three
 * preset orderings and watches the rows physically reorder while a readout
 * recomputes how much value the block producer captures.
 *
 * The core idea it teaches: whoever orders transactions in a block can extract
 * value, so the *right to order* is what the priority-fee / bribe auction is
 * really selling.
 *
 * - FIFO / fair: arrival order. Producer captures the sum of tips only.
 * - By priority fee: highest tip first (the naive market). Still just the tips
 *   — reordering alone doesn't conjure value out of thin air here.
 * - Builder-optimal: the searcher/arb bundle is slotted into the profitable
 *   position (right after the transaction it preys on), so the producer
 *   captures the tips *plus* the extractable value — strictly more.
 *
 * Rows animate to their new positions with a transform transition;
 * `prefers-reduced-motion` snaps them instead. Fully locale-agnostic: every
 * user-facing string (including transaction labels) is a prop.
 */
export function MevOrderingAuction({
  title = 'Reordering the same block changes who gets paid',
  transactions = DEFAULT_TRANSACTIONS,
  byFeeLabel = 'By priority fee',
  builderOptimalLabel = 'Builder-optimal (max extractable)',
  fifoLabel = 'FIFO / fair',
  orderingGroupLabel = 'Transaction ordering',
  tipsCapturedLabel = 'Tips captured',
  mevCapturedLabel = 'Extra MEV captured',
  totalCapturedLabel = 'Total value captured',
  tipColumnLabel = 'Tip',
  extractedHereLabel = 'value extracted here',
  feeUnit = 'gwei',
  caption = 'Same transactions, three orderings — but the producer pockets the most under the builder-optimal one, which slots the searcher bundle right where it can extract value. That ordering power is exactly what priority fees and bribes are bidding for.',
  className,
}: MevOrderingAuctionProps) {
  const id = useId();
  const [ordering, setOrdering] = useState<Ordering>('fee');

  // FIFO is just the input order.
  const fifoOrder = useMemo(() => transactions.map((t) => t.key), [transactions]);

  // By priority fee: descending tip (stable on ties via original index).
  const feeOrder = useMemo(() => {
    const indexed = transactions.map((t, i) => ({ t, i }));
    indexed.sort((a, b) => b.t.tip - a.t.tip || a.i - b.i);
    return indexed.map((x) => x.t.key);
  }, [transactions]);

  // Builder-optimal: pull the extractable transactions to the front (highest
  // extractable first), then the rest by tip. This is the "insert the bundle in
  // the profitable slot" move — illustrative, not a real builder algorithm.
  const builderOrder = useMemo(() => {
    const indexed = transactions.map((t, i) => ({ t, i }));
    const extractors = indexed
      .filter((x) => (x.t.extractable ?? 0) > 0)
      .sort((a, b) => (b.t.extractable ?? 0) - (a.t.extractable ?? 0) || a.i - b.i);
    const rest = indexed
      .filter((x) => (x.t.extractable ?? 0) <= 0)
      .sort((a, b) => b.t.tip - a.t.tip || a.i - b.i);
    return [...extractors, ...rest].map((x) => x.t.key);
  }, [transactions]);

  const orderKeys =
    ordering === 'fifo' ? fifoOrder : ordering === 'builder' ? builderOrder : feeOrder;

  // Map key -> visual rank (row index) under the active ordering.
  const rank = useMemo(() => {
    const m = new Map<string, number>();
    orderKeys.forEach((k, i) => m.set(k, i));
    return m;
  }, [orderKeys]);

  const byKey = useMemo(() => {
    const m = new Map<string, MevTransaction>();
    transactions.forEach((t) => m.set(t.key, t));
    return m;
  }, [transactions]);

  const totalTips = useMemo(
    () => transactions.reduce((s, t) => s + t.tip, 0),
    [transactions],
  );

  // Extractable value is only captured under the builder-optimal ordering, where
  // the extracting transactions are placed in their profitable slots.
  const mevCaptured =
    ordering === 'builder'
      ? transactions.reduce((s, t) => s + (t.extractable ?? 0), 0)
      : 0;

  const totalCaptured = totalTips + mevCaptured;

  const fmt = (v: number): string =>
    `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}${feeUnit ? ` ${feeUnit}` : ''}`;

  const reduced = prefersReducedMotion();
  const transition = reduced ? undefined : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';

  // Container height so absolutely-positioned rows don't collapse the layout.
  const containerHeight = transactions.length * ROW_H + (transactions.length - 1) * ROW_GAP;

  const orderingButtons: Array<{ value: Ordering; label: string }> = [
    { value: 'fee', label: byFeeLabel },
    { value: 'builder', label: builderOptimalLabel },
    { value: 'fifo', label: fifoLabel },
  ];

  const orderedLabels = orderKeys
    .map((k) => byKey.get(k)?.label)
    .filter((l): l is string => Boolean(l));

  const ariaLabel = `${title}. ${orderingGroupLabel}: ${
    ordering === 'fifo' ? fifoLabel : ordering === 'builder' ? builderOptimalLabel : byFeeLabel
  }. Order: ${orderedLabels.join(', ')}. ${totalCapturedLabel}: ${fmt(totalCaptured)}.`;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            ordering === 'builder' ? 'bg-accent-600' : 'bg-brand-600',
          )}
        >
          {fmt(totalCaptured)}
        </span>
      </figcaption>

      {/* Ordering presets */}
      <div className="mt-4">
        <p className="text-sm text-ink-700" id={`${id}-ordering`}>
          {orderingGroupLabel}
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-labelledby={`${id}-ordering`}
        >
          {orderingButtons.map((b) => {
            const active = ordering === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setOrdering(b.value)}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? b.value === 'builder'
                      ? 'bg-accent-600 text-white'
                      : 'bg-brand-600 text-white'
                    : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated transaction list (top = first in the block). */}
      <div
        className="relative mt-4"
        style={{ height: containerHeight }}
        role="img"
        aria-label={ariaLabel}
      >
        {transactions.map((t) => {
          const r = rank.get(t.key) ?? 0;
          const top = r * (ROW_H + ROW_GAP);
          const extracts = (t.extractable ?? 0) > 0;
          // The extractable value is "live" only under the builder ordering.
          const extractingNow = extracts && ordering === 'builder';
          return (
            <div
              key={t.key}
              className={cx(
                'absolute left-0 right-0 flex items-center gap-3 rounded-card border px-3',
                extractingNow
                  ? 'border-accent-400 bg-accent-50/60'
                  : extracts
                    ? 'border-ink-200 bg-surface'
                    : 'border-ink-100 bg-surface-sunken/40',
              )}
              style={{
                height: ROW_H,
                transform: `translateY(${top}px)`,
                transition,
              }}
            >
              {/* Block-position chip */}
              <span
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-pill font-mono text-sm font-semibold',
                  r === 0 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600',
                )}
                aria-hidden="true"
              >
                {r + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink-900">{t.label}</span>
                  {extractingNow && (
                    <span className="shrink-0 rounded-pill bg-accent-600 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                      {extractedHereLabel}
                    </span>
                  )}
                </div>
                {extracts && t.positionHint && (
                  <p
                    className={cx(
                      'truncate text-xs',
                      extractingNow ? 'text-accent-600' : 'text-ink-500',
                    )}
                  >
                    {t.positionHint}
                  </p>
                )}
              </div>

              <span className="shrink-0 text-right">
                <span className="block text-[0.65rem] uppercase tracking-wide text-ink-400">
                  {tipColumnLabel}
                </span>
                <span className="block font-mono text-sm font-semibold text-ink-800">
                  {fmt(t.tip)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Value-captured readout */}
      <dl
        className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{tipsCapturedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{fmt(totalTips)}</dd>
        </div>
        <div
          className={cx(
            'rounded-card border px-3 py-2',
            mevCaptured > 0
              ? 'border-accent-200 bg-accent-50/60'
              : 'border-ink-100 bg-surface-sunken/40',
          )}
        >
          <dt className="text-ink-500">{mevCapturedLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              mevCaptured > 0 ? 'text-accent-600' : 'text-ink-400',
            )}
          >
            {fmt(mevCaptured)}
          </dd>
        </div>
        <div
          className={cx(
            'rounded-card border px-3 py-2',
            ordering === 'builder'
              ? 'border-accent-300 bg-accent-50'
              : 'border-brand-200 bg-brand-50',
          )}
        >
          <dt className="text-ink-500">{totalCapturedLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              ordering === 'builder' ? 'text-accent-600' : 'text-brand-700',
            )}
          >
            {fmt(totalCaptured)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MevOrderingAuction;
