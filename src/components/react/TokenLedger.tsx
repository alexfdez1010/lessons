import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TokenLedgerProps {
  /** Heading above the ledger. */
  title?: string;
  /** One-line takeaway: the mapping is the token; supply is conserved. */
  caption?: string;
  /** Display-only ticker for the demo token. */
  tokenSymbol?: string;
  /** Header label for the contract-storage card. */
  contractLabel?: string;
  /** Subheader showing the storage shape, e.g. mapping(address → balance). */
  mappingLabel?: string;
  /** Column header for the holder/address column. */
  holderLabel?: string;
  /** Column header for the balance column. */
  balanceLabel?: string;
  /** Label for the conserved total-supply readout. */
  totalSupplyLabel?: string;
  /** Label for the From <select>. */
  fromLabel?: string;
  /** Label for the To <select>. */
  toLabel?: string;
  /** Label for the Amount input. */
  amountLabel?: string;
  /** Label for the Transfer button. */
  sendLabel?: string;
  /** Label for the Reset button. */
  resetLabel?: string;
  /** Note reinforcing that the total never changes after a transfer. */
  conservedLabel?: string;
  /** Error shown when the sender lacks enough balance. */
  insufficientLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Display-only holder names — plain strings, no translation needed. */
const HOLDERS = ['Alice', 'Bob', 'Carol'] as const;
type Holder = (typeof HOLDERS)[number];

/** Starting balances; sum is the fixed total supply (1000). */
const START_BALANCES: Record<Holder, number> = {
  Alice: 600,
  Bob: 300,
  Carol: 100,
};

const fmt = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

/**
 * Interactive ERC-20 ledger. It dramatizes that a token is not a coin that
 * "moves" — it is a row in a `mapping(address → balance)` living inside ONE
 * contract's storage. A transfer just decrements one row and increments
 * another; the total supply printed below never changes (always 1000). The two
 * rows touched by the last transfer briefly highlight (gated on
 * `prefers-reduced-motion`). Reset restores the starting balances.
 */
export function TokenLedger({
  title = 'A token is just a balance sheet inside a contract',
  caption = 'An ERC-20 token has no coins that travel. The contract stores a mapping from each address to a number. A "transfer" subtracts from one row and adds the same amount to another — so the total supply is conserved, always.',
  tokenSymbol = 'DEMO',
  contractLabel = 'Token contract storage',
  mappingLabel = 'mapping(address → balance)',
  holderLabel = 'Holder',
  balanceLabel = 'Balance',
  totalSupplyLabel = 'Total supply',
  fromLabel = 'From',
  toLabel = 'To',
  amountLabel = 'Amount',
  sendLabel = 'Transfer',
  resetLabel = 'Reset',
  conservedLabel = 'Total supply unchanged — only two rows moved',
  insufficientLabel = 'Not enough balance',
  className,
}: TokenLedgerProps) {
  const id = useId();
  const [balances, setBalances] =
    useState<Record<Holder, number>>(START_BALANCES);
  const [from, setFrom] = useState<Holder>('Alice');
  const [to, setTo] = useState<Holder>('Bob');
  const [amount, setAmount] = useState(50);
  const [error, setError] = useState<string | null>(null);
  /** Holders whose row should briefly highlight after the last transfer. */
  const [highlighted, setHighlighted] = useState<Holder[]>([]);
  const timerRef = useRef<number | null>(null);

  const totalSupply = HOLDERS.reduce((sum, h) => sum + balances[h], 0);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const flash = (rows: Holder[]) => {
    if (prefersReducedMotion()) return;
    setHighlighted(rows);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHighlighted([]), 700);
  };

  const transfer = () => {
    setError(null);
    const value = Math.floor(amount);
    if (from === to) {
      setError(insufficientLabel);
      return;
    }
    if (!Number.isFinite(value) || value < 1) {
      setError(insufficientLabel);
      return;
    }
    if (balances[from] < value) {
      setError(insufficientLabel);
      return;
    }
    setBalances((prev) => ({
      ...prev,
      [from]: prev[from] - value,
      [to]: prev[to] + value,
    }));
    flash([from, to]);
  };

  const reset = () => {
    setBalances(START_BALANCES);
    setError(null);
    setHighlighted([]);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  };

  const selectClass =
    'mt-1 w-full rounded-card border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

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
          {tokenSymbol}
        </span>
      </figcaption>

      {/* Contract storage card */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-ink-900">
            {contractLabel}
          </span>
          <span className="font-mono text-xs text-accent-600">
            {mappingLabel}
          </span>
        </div>

        <table className="mt-3 w-full text-sm" aria-live="polite">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="pb-2 font-medium">
                {holderLabel}
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                {balanceLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {HOLDERS.map((holder) => {
              const lit = highlighted.includes(holder);
              return (
                <tr
                  key={`${id}-row-${holder}`}
                  className={cx(
                    'border-t border-ink-100 transition-colors duration-500',
                    lit ? 'bg-brand-50' : 'bg-transparent',
                  )}
                >
                  <td className="py-2 font-mono text-ink-700">{holder}</td>
                  <td
                    className={cx(
                      'py-2 text-right font-mono font-semibold transition-colors duration-500',
                      lit ? 'text-brand-700' : 'text-ink-900',
                    )}
                  >
                    {fmt(balances[holder])} {tokenSymbol}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total supply readout — always the same number */}
      <div className="mt-3 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink-500">{totalSupplyLabel}</span>
          <span className="font-mono text-lg font-semibold text-brand-700">
            {fmt(totalSupply)} {tokenSymbol}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-500">{conservedLabel}</p>
      </div>

      {/* Transfer controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-from`}
            className="text-sm font-medium text-ink-700"
          >
            {fromLabel}
          </label>
          <select
            id={`${id}-from`}
            value={from}
            onChange={(e) => setFrom(e.target.value as Holder)}
            className={selectClass}
          >
            {HOLDERS.map((holder) => (
              <option key={`${id}-from-${holder}`} value={holder}>
                {holder}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${id}-to`}
            className="text-sm font-medium text-ink-700"
          >
            {toLabel}
          </label>
          <select
            id={`${id}-to`}
            value={to}
            onChange={(e) => setTo(e.target.value as Holder)}
            className={selectClass}
          >
            {HOLDERS.map((holder) => (
              <option key={`${id}-to-${holder}`} value={holder}>
                {holder}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${id}-amount`}
            className="text-sm font-medium text-ink-700"
          >
            {amountLabel}
          </label>
          <input
            id={`${id}-amount`}
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={selectClass}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={transfer}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {sendLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-100 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-2 min-h-5 text-sm font-medium text-accent-600" aria-live="polite">
        {error}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TokenLedger;
