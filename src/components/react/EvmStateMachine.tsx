import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvmStateMachineProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  /** Label above the world-state cards. */
  worldStateLabel?: string;
  /** Suffix label for an account's ETH balance. */
  balanceLabel?: string;
  /** Label for the contract's stored integer. */
  storageLabel?: string;
  /** Label for the pending-transaction (input) panel. */
  inputLabel?: string;
  /** Label badge for the resulting (output) state. */
  outputLabel?: string;
  /** Display name for the counter contract account. */
  contractLabel?: string;
  /** Text for the apply/advance button. */
  nextLabel?: string;
  /** Text for the reset button. */
  resetLabel?: string;
  /** Localized one-line descriptions of the preset transactions. */
  steps?: string[];
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The three accounts in the toy world state. */
type Field = 'A' | 'B' | 'C' | 'count';

interface WorldState {
  /** Externally-owned account A balance, in ETH. */
  A: number;
  /** Account B balance, in ETH. */
  B: number;
  /** Counter contract balance, in ETH. */
  C: number;
  /** Integer stored inside the Counter contract. */
  count: number;
}

const START_STATE: WorldState = { A: 10, B: 2, C: 0, count: 0 };

/**
 * Each preset transaction is a pure function from the current world state to a
 * new one — deterministic, no randomness anywhere. `touched` lists the fields it
 * changes so the UI can highlight exactly those rows.
 */
interface Transaction {
  apply: (s: WorldState) => WorldState;
  touched: Field[];
}

const TRANSACTIONS: Transaction[] = [
  // 0: A sends 1 ETH to B
  {
    apply: (s) => ({ ...s, A: s.A - 1, B: s.B + 1 }),
    touched: ['A', 'B'],
  },
  // 1: B calls increment() on Counter
  {
    apply: (s) => ({ ...s, count: s.count + 1 }),
    touched: ['count'],
  },
  // 2: A sends 0.5 ETH to Counter and calls increment()
  {
    apply: (s) => ({ ...s, A: s.A - 0.5, C: s.C + 0.5, count: s.count + 1 }),
    touched: ['A', 'C', 'count'],
  },
];

const DEFAULT_STEPS = [
  'A sends 1 ETH to B',
  'B calls increment() on Counter',
  'A sends 0.5 ETH to Counter and calls increment()',
];

const eth = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

const HIGHLIGHT_MS = 700;

/**
 * Animated visual of the EVM as a deterministic state machine. The current world
 * state (three account balances plus a contract's stored integer) sits on the
 * left; a pending transaction sits on the right. Pressing the apply button feeds
 * that transaction into the EVM, which produces a brand-new world state — the
 * changed rows briefly highlight — then queues the next preset transaction. The
 * same input always yields the same output: there is no randomness, only a pure
 * state transition. Respects `prefers-reduced-motion` (skips the highlight).
 */
export function EvmStateMachine({
  title = 'The EVM: one transaction, one new world state',
  caption = 'The EVM is a deterministic state machine: feed it the same transaction from the same world state and you always get the exact same new world state — no randomness, no surprises.',
  worldStateLabel = 'World state',
  balanceLabel = 'balance',
  storageLabel = 'stored count',
  inputLabel = 'Transaction (input)',
  outputLabel = 'New state (output)',
  contractLabel = 'Counter contract',
  nextLabel = 'Next transaction',
  resetLabel = 'Reset',
  steps = DEFAULT_STEPS,
  className,
}: EvmStateMachineProps) {
  const id = useId();
  const [state, setState] = useState<WorldState>(START_STATE);
  const [txIndex, setTxIndex] = useState(0);
  const [applied, setApplied] = useState(0);
  const [highlighted, setHighlighted] = useState<Field[]>([]);

  const stepText = steps[txIndex] ?? DEFAULT_STEPS[txIndex] ?? '';

  const handleNext = () => {
    const tx = TRANSACTIONS[txIndex];
    setState((prev) => tx.apply(prev));
    setApplied((n) => n + 1);
    setTxIndex((i) => (i + 1) % TRANSACTIONS.length);

    if (prefersReducedMotion()) {
      setHighlighted([]);
      return;
    }
    setHighlighted(tx.touched);
    window.setTimeout(() => setHighlighted([]), HIGHLIGHT_MS);
  };

  const handleReset = () => {
    setState(START_STATE);
    setTxIndex(0);
    setApplied(0);
    setHighlighted([]);
  };

  const accounts = useMemo(
    () =>
      [
        { field: 'A' as Field, name: 'A', balance: state.A, count: null as number | null },
        { field: 'B' as Field, name: 'B', balance: state.B, count: null as number | null },
        { field: 'C' as Field, name: contractLabel, balance: state.C, count: state.count },
      ],
    [state, contractLabel],
  );

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
          {applied === 0 ? worldStateLabel : `${outputLabel} · #${applied}`}
        </span>
      </figcaption>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {/* World state cards */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink-500">
            {worldStateLabel}
          </p>
          <ul
            className="grid gap-2"
            aria-live="polite"
            aria-label={worldStateLabel}
          >
            {accounts.map((acct) => {
              const isHot = highlighted.includes(acct.field);
              const countHot = acct.field === 'C' && highlighted.includes('count');
              return (
                <li
                  key={`${id}-${acct.field}`}
                  className={cx(
                    'rounded-card border px-3 py-2 transition-colors duration-300',
                    isHot || countHot
                      ? 'border-accent-400 bg-accent-50'
                      : 'border-ink-100 bg-surface-sunken/40',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      {acct.name}
                    </span>
                    <span className="font-mono text-sm font-semibold text-brand-700">
                      {eth(acct.balance)} ETH
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="text-xs text-ink-500">{balanceLabel}</span>
                    {acct.count !== null ? (
                      <span className="font-mono text-xs text-accent-600">
                        {storageLabel}: {acct.count}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* EVM arrow / engine */}
        <div className="flex flex-col items-center justify-center gap-1 text-ink-400">
          <span className="rounded-pill border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            EVM
          </span>
          <svg
            viewBox="0 0 48 24"
            className="w-12 rotate-90 md:rotate-0"
            role="img"
            aria-label="The EVM applies the transaction and produces a new world state"
          >
            <line
              x1={2}
              y1={12}
              x2={40}
              y2={12}
              stroke="var(--color-brand-500)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d="M 34 6 L 44 12 L 34 18"
              fill="none"
              stroke="var(--color-brand-500)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Input transaction panel */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink-500">{inputLabel}</p>
          <div
            className="rounded-card border border-brand-200 bg-brand-50 px-3 py-3"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-ink-900">{stepText}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleNext}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {nextLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvmStateMachine;
