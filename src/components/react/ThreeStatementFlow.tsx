import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A labelled link between two statements, revealed step by step. */
export interface StatementLink {
  /** Short label for the flowing quantity, e.g. "Net income". */
  label: string;
  /** One-line description of what this link does. */
  detail: string;
}

export interface ThreeStatementFlowProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the income-statement node. */
  incomeLabel?: string;
  /** Label for the cash-flow-statement node. */
  cashLabel?: string;
  /** Label for the balance-sheet node. */
  balanceLabel?: string;
  /** Sub-label under the income node. */
  incomeSub?: string;
  /** Sub-label under the cash node. */
  cashSub?: string;
  /** Sub-label under the balance node. */
  balanceSub?: string;
  /**
   * The links revealed in sequence. Exactly three are expected, in order:
   * income → balance (retained earnings), income → cash (starting point),
   * cash → balance (cash balance).
   */
  links?: [StatementLink, StatementLink, StatementLink];
  /** Play button label. */
  playLabel?: string;
  /** Replay button label. */
  replayLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_LINKS: [StatementLink, StatementLink, StatementLink] = [
  {
    label: 'Net income → Retained earnings',
    detail: 'The bottom line of the income statement is added to equity on the balance sheet.',
  },
  {
    label: 'Net income → Top of cash flow',
    detail: 'The cash-flow statement starts from net income, then adjusts it back to real cash.',
  },
  {
    label: 'Ending cash → Cash on balance sheet',
    detail: 'The final cash figure becomes the cash line in the balance sheet — and it must tie out.',
  },
];

const STEP_MS = 1500;

/**
 * Animated three-statement linkage. Three boxes — income statement, cash-flow
 * statement, balance sheet — light up in turn while glowing arrows trace how a
 * single number travels between them: net income lands in retained earnings,
 * net income also seeds the top of the cash-flow statement, and ending cash
 * flows back onto the balance sheet. The learner watches the loop close, which
 * is the whole intuition behind "the three statements are one model". Respects
 * `prefers-reduced-motion`: renders fully lit and still, with no arrow motion.
 */
export function ThreeStatementFlow({
  title = 'The three statements are one model',
  incomeLabel = 'Income statement',
  cashLabel = 'Cash-flow statement',
  balanceLabel = 'Balance sheet',
  incomeSub = 'Revenue → Net income',
  cashSub = 'Net income → Ending cash',
  balanceSub = 'Assets = Liabilities + Equity',
  links = DEFAULT_LINKS,
  playLabel = 'Trace the links',
  replayLabel = 'Replay',
  caption = 'One number, three homes: net income feeds equity and seeds the cash statement, and ending cash flows back onto the balance sheet. Change any input and all three move together.',
  className,
}: ThreeStatementFlowProps) {
  const id = useId();
  const reduced = typeof window !== 'undefined' ? prefersReducedMotion() : false;
  const [step, setStep] = useState(reduced ? 3 : 0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion()) setStep(0);
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const play = () => {
    clearTimer();
    if (prefersReducedMotion()) {
      setStep(3);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setStep(0);
    const tick = (next: number) => {
      setStep(next);
      if (next >= 3) {
        setPlaying(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    timerRef.current = window.setTimeout(() => tick(1), 300);
  };

  const done = step >= 3 && !playing;

  // Node positions in the viewBox.
  const W = 560;
  const H = 320;

  // income top-left, cash top-right, balance bottom-center
  const nodes = {
    income: { x: 40, y: 30, w: 200, h: 80 },
    cash: { x: 320, y: 30, w: 200, h: 80 },
    balance: { x: 180, y: 210, w: 200, h: 80 },
  };

  const arrowActive = (linkIdx: number) => step > linkIdx;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
        >
          {done ? replayLabel : playLabel}
        </button>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. ${caption}`}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand-600)" />
          </marker>
          <marker
            id={`${id}-arrow-faint`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-200)" />
          </marker>
        </defs>

        {/* Arrows (drawn first so boxes sit on top) */}
        {/* Link 0: income → balance (retained earnings) */}
        <path
          d={`M ${nodes.income.x + 60} ${nodes.income.y + nodes.income.h}
              C ${nodes.income.x + 40} 170, ${nodes.balance.x + 30} 170, ${nodes.balance.x + 50} ${nodes.balance.y}`}
          fill="none"
          stroke={arrowActive(0) ? 'var(--color-brand-500)' : 'var(--color-ink-100)'}
          strokeWidth={arrowActive(0) ? 3 : 2}
          markerEnd={`url(#${id}-arrow${arrowActive(0) ? '' : '-faint'})`}
          className={cx(!reduced && 'transition-all duration-500')}
        />
        {/* Link 1: income → cash (top) */}
        <path
          d={`M ${nodes.income.x + nodes.income.w} ${nodes.income.y + nodes.income.h / 2}
              L ${nodes.cash.x} ${nodes.cash.y + nodes.cash.h / 2}`}
          fill="none"
          stroke={arrowActive(1) ? 'var(--color-brand-500)' : 'var(--color-ink-100)'}
          strokeWidth={arrowActive(1) ? 3 : 2}
          markerEnd={`url(#${id}-arrow${arrowActive(1) ? '' : '-faint'})`}
          className={cx(!reduced && 'transition-all duration-500')}
        />
        {/* Link 2: cash → balance (ending cash) */}
        <path
          d={`M ${nodes.cash.x + 140} ${nodes.cash.y + nodes.cash.h}
              C ${nodes.cash.x + 120} 170, ${nodes.balance.x + 170} 170, ${nodes.balance.x + 150} ${nodes.balance.y}`}
          fill="none"
          stroke={arrowActive(2) ? 'var(--color-accent-500)' : 'var(--color-ink-100)'}
          strokeWidth={arrowActive(2) ? 3 : 2}
          markerEnd={`url(#${id}-arrow${arrowActive(2) ? '' : '-faint'})`}
          className={cx(!reduced && 'transition-all duration-500')}
        />

        {/* Nodes */}
        {(
          [
            { key: 'income', n: nodes.income, label: incomeLabel, sub: incomeSub, lit: step >= 1 },
            { key: 'cash', n: nodes.cash, label: cashLabel, sub: cashSub, lit: step >= 2 },
            { key: 'balance', n: nodes.balance, label: balanceLabel, sub: balanceSub, lit: step >= 3 },
          ] as const
        ).map(({ key, n, label, sub, lit }) => (
          <g key={key} className={cx(!reduced && 'transition-all duration-500')}>
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              rx={12}
              fill={lit ? 'var(--color-brand-50)' : 'var(--color-surface-sunken)'}
              stroke={lit ? 'var(--color-brand-500)' : 'var(--color-ink-200)'}
              strokeWidth={lit ? 2.5 : 1.5}
            />
            <text
              x={n.x + n.w / 2}
              y={n.y + 32}
              textAnchor="middle"
              className="fill-ink-900"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {label}
            </text>
            <text
              x={n.x + n.w / 2}
              y={n.y + 54}
              textAnchor="middle"
              className="fill-ink-500"
              style={{ fontSize: 12 }}
            >
              {sub}
            </text>
          </g>
        ))}
      </svg>

      {/* Step legend */}
      <ol className="mt-4 space-y-2">
        {links.map((link, i) => (
          <li
            key={`${id}-link-${i}`}
            className={cx(
              'flex gap-3 rounded-card border px-3 py-2 text-sm transition-colors',
              step > i
                ? 'border-brand-200 bg-brand-50/60'
                : 'border-ink-100 bg-surface-sunken/40 opacity-60',
            )}
            aria-current={step === i + 1 ? 'step' : undefined}
          >
            <span
              className={cx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                step > i ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-500',
              )}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span>
              <span className="font-semibold text-ink-900">{link.label}.</span>{' '}
              <span className="text-ink-600">{link.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ThreeStatementFlow;
