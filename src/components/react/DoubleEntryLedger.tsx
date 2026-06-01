import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DoubleEntryLedgerProps {
  /** Heading above the ledger. */
  title?: string;
  /** Column header for the date column. */
  dateLabel?: string;
  /** Column header for the description column. */
  descriptionLabel?: string;
  /** Column header for the deposits (credits) column. */
  moneyInLabel?: string;
  /** Column header for the withdrawals (debits) column. */
  moneyOutLabel?: string;
  /** Column header for the running-balance column. */
  balanceLabel?: string;
  /** Label on the play button before/while posting. */
  playLabel?: string;
  /** Label on the play button once every row has posted. */
  replayLabel?: string;
  /** One-line takeaway shown under the ledger. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** The ledger rows. Defaults to a small worked example. */
  entries?: LedgerEntry[];
  className?: string;
}

export interface LedgerEntry {
  /** Locale-agnostic date string (already formatted by the caller). */
  date: string;
  /** What the transaction was. */
  description: string;
  /** Amount deposited (money in). Omit for a withdrawal row. */
  in?: number;
  /** Amount withdrawn (money out). Omit for a deposit row. */
  out?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const DEFAULT_ENTRIES: LedgerEntry[] = [
  { date: 'Mar 1', description: 'Opening deposit', in: 500 },
  { date: 'Mar 3', description: 'Paycheck', in: 1800 },
  { date: 'Mar 5', description: 'Rent', out: 1200 },
  { date: 'Mar 9', description: 'Groceries', out: 140 },
  { date: 'Mar 14', description: 'Refund', in: 60 },
  { date: 'Mar 20', description: 'Electric bill', out: 95 },
];

/** Per-row delay when auto-posting (ms). */
const STEP_MS = 850;

/**
 * Animated double-entry ledger that teaches "a bank account is just a running
 * list". Press Play and rows post one at a time: each deposit slides in on the
 * "money in" side and *adds* to the balance, each withdrawal posts on the
 * "money out" side and *subtracts*. The balance column is always the running
 * total of everything above it — the freshly-posted row is highlighted and its
 * arithmetic (old balance ± amount) is announced, so the learner watches the
 * total being rebuilt transaction by transaction rather than just reading a
 * final number. Respects `prefers-reduced-motion`: the whole ledger renders
 * posted and still, and Play reveals it instantly with no movement.
 */
export function DoubleEntryLedger({
  title = 'A bank account is a ledger',
  dateLabel = 'Date',
  descriptionLabel = 'Description',
  moneyInLabel = 'Money in',
  moneyOutLabel = 'Money out',
  balanceLabel = 'Balance',
  playLabel = 'Post the entries',
  replayLabel = 'Replay',
  caption = 'Every deposit adds, every withdrawal subtracts, and the balance is simply the running total of the lines above it. Nothing magical — just bookkeeping, one row at a time.',
  currencyPrefix = '$',
  entries = DEFAULT_ENTRIES,
  className,
}: DoubleEntryLedgerProps) {
  const id = useId();
  const reduced = typeof window !== 'undefined' ? prefersReducedMotion() : false;

  // How many rows are currently "posted". Start fully posted for the reduced /
  // SSR case; the mount effect resets it to 0 when motion is allowed.
  const [posted, setPosted] = useState(entries.length);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Running balance up to (and including) row index `i`.
  const balanceAfter = useCallback(
    (i: number): number => {
      let bal = 0;
      for (let k = 0; k <= i; k++) {
        bal += entries[k]?.in ?? 0;
        bal -= entries[k]?.out ?? 0;
      }
      return bal;
    },
    [entries],
  );

  const finalBalance = balanceAfter(entries.length - 1);
  const done = posted >= entries.length;

  // On mount (motion allowed): collapse to nothing so Play can build it up.
  useEffect(() => {
    if (!prefersReducedMotion()) {
      setPosted(0);
    }
  }, [entries.length]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const play = useCallback(() => {
    clearTimer();
    if (prefersReducedMotion()) {
      setPosted(entries.length);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setPosted(0);
    const tick = (next: number) => {
      setPosted(next);
      if (next >= entries.length) {
        setPlaying(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    // First row posts almost immediately, then one per STEP_MS.
    timerRef.current = window.setTimeout(() => tick(1), 200);
  }, [entries.length]);

  const lastPosted = posted - 1; // index of the row that just landed

  // Human-readable arithmetic for the row that just posted (for aria-live).
  let liveMessage = '';
  if (playing || done) {
    if (posted === 0) {
      liveMessage = '';
    } else {
      const row = entries[lastPosted];
      const prev = lastPosted > 0 ? balanceAfter(lastPosted - 1) : 0;
      const now = balanceAfter(lastPosted);
      if (row?.in != null) {
        liveMessage = `${row.description}: ${money(currencyPrefix, prev)} plus ${money(
          currencyPrefix,
          row.in,
        )} in makes ${money(currencyPrefix, now)}.`;
      } else if (row?.out != null) {
        liveMessage = `${row.description}: ${money(currencyPrefix, prev)} minus ${money(
          currencyPrefix,
          row.out,
        )} out makes ${money(currencyPrefix, now)}.`;
      }
    }
  }

  const buttonLabel = playing ? playLabel : done ? replayLabel : playLabel;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {balanceLabel}: {money(currencyPrefix, done ? finalBalance : balanceAfter(lastPosted))}
        </span>
      </figcaption>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {title}. {caption}
          </caption>
          <thead>
            <tr className="text-left text-ink-500">
              <th scope="col" className="px-2 py-2 font-medium">
                {dateLabel}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {descriptionLabel}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {moneyInLabel}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {moneyOutLabel}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {balanceLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row, i) => {
              const isPosted = i < posted;
              const isJustPosted = i === lastPosted && playing;
              const bal = balanceAfter(i);
              return (
                <tr
                  key={`${id}-${i}`}
                  aria-hidden={!isPosted}
                  className={cx(
                    'border-t border-ink-100 align-baseline',
                    reduced
                      ? ''
                      : 'transition-[opacity,transform] duration-500 ease-out motion-safe:will-change-transform',
                    isPosted
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-1 opacity-0',
                    isJustPosted && 'bg-brand-50',
                  )}
                >
                  <td className="px-2 py-2 font-mono text-ink-500">{row.date}</td>
                  <td className="px-2 py-2 text-ink-900">{row.description}</td>
                  <td className="px-2 py-2 text-right font-mono text-brand-700">
                    {row.in != null ? money(currencyPrefix, row.in) : ''}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-accent-600">
                    {row.out != null ? money(currencyPrefix, row.out) : ''}
                  </td>
                  <td
                    className={cx(
                      'px-2 py-2 text-right font-mono font-semibold',
                      isPosted ? 'text-ink-900' : 'text-ink-300',
                    )}
                  >
                    {isPosted ? money(currencyPrefix, bal) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-200">
              <td className="px-2 py-2 font-medium text-ink-700" colSpan={4}>
                {balanceLabel}
              </td>
              <td className="px-2 py-2 text-right font-mono text-lg font-semibold text-brand-700">
                {money(currencyPrefix, done ? finalBalance : balanceAfter(lastPosted))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={play}
          aria-disabled={playing}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          disabled={playing}
        >
          {buttonLabel}
        </button>
        <span
          className="text-sm text-ink-500"
          aria-live="polite"
          aria-atomic="true"
        >
          {liveMessage}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DoubleEntryLedger;
