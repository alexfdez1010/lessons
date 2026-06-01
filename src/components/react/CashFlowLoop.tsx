import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CashFlowLoopProps {
  /** Heading above the loop. */
  title?: string;
  /** Label for the monthly-income stepper. */
  incomeLabel?: string;
  /** Label for the monthly-expenses stepper. */
  expensesLabel?: string;
  /** Word for a positive gap (income > expenses). */
  surplusLabel?: string;
  /** Word for a negative gap (expenses > income). */
  deficitLabel?: string;
  /** Caption beside the savings jar (surplus case). */
  savingsLabel?: string;
  /** Caption beside the IOU (deficit case). */
  borrowLabel?: string;
  /** One-line takeaway shown under the loop. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Initial monthly income. Defaults to `3000`. */
  income?: number;
  /** Initial monthly expenses. Defaults to `2400`. */
  expenses?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

const STEP = 100;
const MIN = 0;
const MAX = 10000;

/**
 * Interactive income-vs-expense loop. Two steppers set monthly income and
 * monthly expenses; the component shows the gap between them. A positive gap
 * (surplus) flows into a savings jar that fills up; a negative gap (deficit)
 * grows an IOU note that you have to borrow to cover. Colour and labelling flip
 * with the sign of the gap, so the learner *sees* that the same arithmetic
 * (income − expenses) either builds savings or builds debt. The fill/flow
 * animates whenever the numbers change; respects `prefers-reduced-motion`
 * (jumps straight to the final state).
 */
export function CashFlowLoop({
  title = 'Where the money goes',
  incomeLabel = 'Monthly income',
  expensesLabel = 'Monthly expenses',
  surplusLabel = 'Surplus',
  deficitLabel = 'Deficit',
  savingsLabel = 'Into savings',
  borrowLabel = 'Borrowed (IOU)',
  caption = 'Income minus expenses is the whole game. A positive gap is a surplus you can save; a negative gap is a deficit you must borrow to cover. Same subtraction, opposite outcome.',
  currencyPrefix = '$',
  income = 3000,
  expenses = 2400,
  className,
}: CashFlowLoopProps) {
  const id = useId();
  const [incomeState, setIncomeState] = useState(income);
  const [expensesState, setExpensesState] = useState(expenses);
  const [progress, setProgress] = useState(1); // 0 → 1 (flow/fill animation)
  const rafRef = useRef<number | null>(null);

  const gap = incomeState - expensesState;
  const isSurplus = gap >= 0;
  const magnitude = Math.abs(gap);

  // Scale the fill by gap relative to income, so the visual is meaningful.
  const fillFraction =
    incomeState > 0 ? Math.min(1, magnitude / incomeState) : magnitude > 0 ? 1 : 0;
  const animatedFill = fillFraction * progress;

  // Animate the flow/fill in whenever the numbers change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [incomeState, expensesState]);

  const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));

  const gapWord = isSurplus ? surplusLabel : deficitLabel;
  const outcomeWord = isSurplus ? savingsLabel : borrowLabel;
  const accentText = isSurplus ? 'text-brand-700' : 'text-accent-700';
  const accentBg = isSurplus ? 'bg-brand-500' : 'bg-accent-500';
  const accentBorder = isSurplus ? 'border-brand-200' : 'border-accent-200';

  const summary = `${incomeLabel} ${money(currencyPrefix, incomeState)} minus ${expensesLabel.toLowerCase()} ${money(
    currencyPrefix,
    expensesState,
  )} leaves a ${gapWord.toLowerCase()} of ${money(currencyPrefix, magnitude)}, which goes ${outcomeWord.toLowerCase()}.`;

  // Stepper control: a labelled number with −/+ buttons, fully keyboard operable.
  const Stepper = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (next: number) => void;
  }) => {
    const fieldId = `${id}-${label}`;
    return (
      <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-3">
        <label htmlFor={fieldId} className="block text-sm text-ink-700">
          {label}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            aria-label={`${label} −${STEP}`}
            onClick={() => onChange(clamp(value - STEP))}
            disabled={value <= MIN}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface text-lg font-semibold text-ink-700 transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            −
          </button>
          <input
            id={fieldId}
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={STEP}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
            className="w-full min-w-0 rounded-card border border-ink-200 bg-surface px-2 py-1.5 text-center font-mono text-base font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <button
            type="button"
            aria-label={`${label} +${STEP}`}
            onClick={() => onChange(clamp(value + STEP))}
            disabled={value >= MAX}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface text-lg font-semibold text-ink-700 transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            +
          </button>
        </div>
      </div>
    );
  };

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            isSurplus ? 'bg-brand-600' : 'bg-accent-600',
          )}
        >
          {gapWord}: {money(currencyPrefix, magnitude)}
        </span>
      </figcaption>

      {/* Steppers */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stepper label={incomeLabel} value={incomeState} onChange={setIncomeState} />
        <Stepper label={expensesLabel} value={expensesState} onChange={setExpensesState} />
      </div>

      {/* The loop: income bar over expenses bar, with the gap highlighted. */}
      <div className="mt-5 flex flex-col gap-2" aria-hidden="true">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-ink-700">{incomeLabel}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className="h-full rounded-pill bg-ink-300"
              style={{ width: `${MAX > 0 ? (incomeState / MAX) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-ink-700">{expensesLabel}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className="h-full rounded-pill bg-ink-400"
              style={{ width: `${MAX > 0 ? (expensesState / MAX) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Outcome: savings jar (surplus) or growing IOU (deficit). */}
      <div
        className={cx(
          'mt-5 grid items-stretch gap-4 rounded-card border p-4 sm:grid-cols-[1fr_auto]',
          accentBorder,
          isSurplus ? 'bg-brand-500/5' : 'bg-accent-500/5',
        )}
      >
        <div className="flex flex-col justify-center">
          <p className={cx('text-sm font-medium', accentText)}>
            {gapWord} → {outcomeWord}
          </p>
          <p className={cx('mt-1 font-mono text-2xl font-bold', accentText)}>
            {money(currencyPrefix, magnitude)}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {incomeLabel} − {expensesLabel.toLowerCase()} ={' '}
            {isSurplus ? '+' : '−'}
            {money(currencyPrefix, magnitude)}
          </p>
        </div>

        {/* Jar (fills from the bottom) vs IOU (grows a stack). */}
        <div className="flex items-end justify-center">
          {isSurplus ? (
            <svg
              viewBox="0 0 80 96"
              className="h-24 w-20"
              role="img"
              aria-hidden="true"
            >
              {/* Jar outline */}
              <rect
                x={14}
                y={20}
                width={52}
                height={68}
                rx={10}
                fill="none"
                stroke="var(--color-brand-400)"
                strokeWidth={3}
              />
              {/* Jar lip */}
              <rect
                x={10}
                y={12}
                width={60}
                height={10}
                rx={4}
                fill="var(--color-brand-400)"
              />
              {/* Fill, rising from the bottom by animatedFill */}
              <clipPath id={`${id}-jar`}>
                <rect x={17} y={23} width={46} height={62} rx={7} />
              </clipPath>
              <g clipPath={`url(#${id}-jar)`}>
                <rect
                  x={17}
                  y={85 - 62 * animatedFill}
                  width={46}
                  height={62 * animatedFill}
                  fill="var(--color-brand-500)"
                />
              </g>
            </svg>
          ) : (
            <svg
              viewBox="0 0 80 96"
              className="h-24 w-20"
              role="img"
              aria-hidden="true"
            >
              {/* IOU note that grows taller with the deficit */}
              <rect
                x={16}
                y={88 - 60 * animatedFill}
                width={48}
                height={60 * animatedFill}
                rx={4}
                fill="var(--color-accent-500)"
                opacity={0.18}
                stroke="var(--color-accent-500)"
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              {animatedFill > 0.25 && (
                <text
                  x={40}
                  y={70}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill="var(--color-accent-700)"
                  fontFamily="var(--font-mono)"
                >
                  IOU
                </text>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Screen-reader live region for the changing outcome. */}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CashFlowLoop;
