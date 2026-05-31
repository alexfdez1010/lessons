import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MempoolFeeMarketProps {
  /** Heading above the simulation. */
  title?: string;
  /** Label for the learner's highlighted transaction card. */
  yourTxLabel?: string;
  /** Label for the fee slider. */
  feeLabel?: string;
  /** Low end of the fee slider track. */
  lowLabel?: string;
  /** High end of the fee slider track. */
  highLabel?: string;
  /** Label for the "produce next block" button. */
  produceBlockLabel?: string;
  /** Label for the "reset mempool" button. */
  resetLabel?: string;
  /** Status shown when your transaction makes it into the block. */
  includedLabel?: string;
  /** Status shown when your transaction is left waiting. */
  waitingLabel?: string;
  /** Label for the mempool (waiting area). */
  mempoolLabel?: string;
  /** Label for the produced block. */
  blockLabel?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A pending transaction: an id, a relative fee (0–1), and whether it's yours. */
interface Tx {
  key: string;
  fee: number;
  mine: boolean;
}

/** Number of competing (non-you) transactions seeded into the mempool. */
const RIVAL_COUNT = 7;
/** Number of slots in a block — rendered as shapes, never printed as a number. */
const BLOCK_SLOTS = 4;

const seedRivals = (): Tx[] =>
  Array.from({ length: RIVAL_COUNT }, (_, i) => ({
    key: `rival-${i}`,
    // Spread fees across the range so the auction has a clear pecking order.
    fee: Math.round((0.12 + Math.random() * 0.82) * 100) / 100,
    mine: false,
  }));

/** Map a relative fee (0–1) to a warm-to-cool token colour. */
const feeColor = (fee: number): string => {
  if (fee >= 0.66) return 'var(--color-brand-600)';
  if (fee >= 0.33) return 'var(--color-brand-400)';
  return 'var(--color-ink-300)';
};

/**
 * Interactive mempool fee-auction. Pending transactions sit in the mempool, each
 * drawn with a fee bar of varying *relative* height (no numbers — taller / warmer
 * = higher fee). One card is highlighted as "your transaction"; a Low↔High slider
 * sets its fee and re-sorts it among the rivals. "Produce next block" animates the
 * block pulling in the top-fee transactions until its slots fill, then says in words
 * whether yours made it in or is still waiting. Higher fee = faster confirmation.
 * Respects `prefers-reduced-motion` (jumps straight to the result).
 */
export function MempoolFeeMarket({
  title = 'The mempool is a fee auction',
  yourTxLabel = 'Your transaction',
  feeLabel = 'Your fee',
  lowLabel = 'Low',
  highLabel = 'High',
  produceBlockLabel = 'Produce next block',
  resetLabel = 'Reset mempool',
  includedLabel = 'Your transaction made it into the block.',
  waitingLabel = 'Your fee was too low — still waiting in the mempool.',
  mempoolLabel = 'Mempool (waiting to confirm)',
  blockLabel = 'Next block (limited space)',
  caption = 'A block has limited space, so producers grab the highest-fee transactions first. Bid a higher fee and you confirm sooner; bid too low and higher bidders fill the block ahead of you.',
  className,
}: MempoolFeeMarketProps) {
  const id = useId();
  const [yourFee, setYourFee] = useState(0.5);
  const [rivals, setRivals] = useState<Tx[]>(seedRivals);
  // Keys of transactions that have been pulled into the produced block.
  const [included, setIncluded] = useState<string[]>([]);
  const [produced, setProduced] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const yourTx: Tx = { key: 'you', fee: yourFee, mine: true };
  // Highest fee first; this is the order a block producer fills slots in.
  const ranked = [...rivals, yourTx].sort((a, b) => b.fee - a.fee);
  const winners = ranked.slice(0, BLOCK_SLOTS).map((t) => t.key);
  const youWin = winners.includes('you');

  const produceBlock = () => {
    clearTimers();
    setProduced(true);
    if (prefersReducedMotion()) {
      setIncluded(winners);
      return;
    }
    setIncluded([]);
    // Reveal slots filling one at a time, top fee first.
    winners.forEach((key, i) => {
      const t = window.setTimeout(() => {
        setIncluded((prev) => [...prev, key]);
      }, 320 * (i + 1));
      timersRef.current.push(t);
    });
  };

  const reset = () => {
    clearTimers();
    setProduced(false);
    setIncluded([]);
    setRivals(seedRivals());
  };

  // Mempool view: pending (not-yet-included) transactions, highest fee first.
  const pending = ranked.filter((t) => !included.includes(t.key));

  const statusText = !produced ? '' : youWin ? includedLabel : waitingLabel;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {yourTxLabel}
        </span>
      </figcaption>

      {/* Block: a fixed set of slots that fill with the top-fee transactions. */}
      <div className="mt-4">
        <p className="text-sm font-medium text-ink-700">{blockLabel}</p>
        <div
          role="img"
          aria-label={`${blockLabel}: ${included.length === BLOCK_SLOTS ? 'all slots filled with the highest-fee transactions' : 'block slots, filled top fee first'}.`}
          className="mt-2 flex flex-wrap gap-2 rounded-card border border-dashed border-ink-200 bg-surface-sunken/40 p-3"
        >
          {ranked.slice(0, BLOCK_SLOTS).map((t, i) => {
            const filled = included.includes(t.key);
            return (
              <div
                key={`slot-${i}`}
                className={cx(
                  'flex h-12 flex-1 items-end justify-center rounded-card border transition-all duration-300',
                  filled ? 'border-transparent' : 'border-ink-200 bg-surface',
                  filled && t.mine && 'ring-2 ring-brand-600 ring-offset-1',
                )}
                style={
                  filled
                    ? { background: feeColor(t.fee) }
                    : undefined
                }
                aria-hidden="true"
              >
                {filled && (
                  <span className="mb-1 text-xs font-medium text-white">
                    {t.mine ? yourTxLabel : '•'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mempool: pending transactions as relative fee bars (no numbers). */}
      <div className="mt-4">
        <p className="text-sm font-medium text-ink-700">{mempoolLabel}</p>
        <div className="mt-2 flex items-end gap-2 rounded-card border border-ink-100 bg-surface-sunken/40 p-3">
          {pending.length === 0 ? (
            <span className="py-6 text-sm text-ink-500">—</span>
          ) : (
            pending.map((t) => (
              <div
                key={t.key}
                className="flex flex-1 flex-col items-center gap-1"
                title={t.mine ? yourTxLabel : undefined}
              >
                <div
                  className="flex w-full items-end justify-center rounded-card"
                  style={{ height: 90 }}
                  aria-hidden="true"
                >
                  <div
                    className={cx(
                      'w-full rounded-card transition-all duration-300',
                      t.mine && 'ring-2 ring-brand-700 ring-offset-1',
                    )}
                    style={{
                      height: `${Math.max(12, t.fee * 100)}%`,
                      background: feeColor(t.fee),
                    }}
                  />
                </div>
                {t.mine && (
                  <span className="text-center text-[0.65rem] font-medium leading-tight text-brand-700">
                    {yourTxLabel}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fee slider — Low ↔ High, no numeric readout. */}
      <div className="mt-4">
        <label htmlFor={`${id}-fee`} className="text-sm text-ink-700">
          {feeLabel}
        </label>
        <div className="mt-2 flex items-center gap-3 text-sm text-ink-500">
          <span>{lowLabel}</span>
          <input
            id={`${id}-fee`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(yourFee * 100)}
            onChange={(e) => {
              setYourFee(Number(e.target.value) / 100);
              setProduced(false);
              setIncluded([]);
            }}
            aria-valuetext={
              yourFee >= 0.66 ? highLabel : yourFee >= 0.33 ? feeLabel : lowLabel
            }
            className="w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <span>{highLabel}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={produceBlock}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {produceBlockLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      {/* Did your transaction get in? */}
      <p
        aria-live="polite"
        className={cx(
          'mt-3 min-h-[1.5rem] text-sm font-medium',
          produced && youWin && 'text-brand-700',
          produced && !youWin && 'text-accent-600',
        )}
      >
        {statusText}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MempoolFeeMarket;
