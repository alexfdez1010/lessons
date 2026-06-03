import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AmortizationSplitProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the starting-principal readout / slider. */
  principalLabel?: string;
  /** Label for the annual interest-rate slider. */
  rateLabel?: string;
  /** Label for the loan-term (years) slider. */
  yearsLabel?: string;
  /** Legend label for the interest portion of each payment. */
  interestLabel?: string;
  /** Legend label for the principal portion of each payment. */
  principalPortionLabel?: string;
  /** Legend label for the declining outstanding-balance line. */
  balanceLabel?: string;
  /** Label for the monthly-payment readout. */
  monthlyPaymentLabel?: string;
  /** Label for the total-interest-paid readout. */
  totalInterestLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting loan amount (principal). Defaults to `200000`. */
  principal?: number;
  /** Initial annual interest rate as a fraction (0.01–0.10). Defaults to `0.06`. */
  rate?: number;
  /** Initial loan term in years (5–40). Defaults to `30`. */
  years?: number;
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

interface MonthRow {
  /** Interest portion of this month's payment. */
  interest: number;
  /** Principal portion of this month's payment. */
  principal: number;
  /** Outstanding balance after this month's payment. */
  balance: number;
}

/** Fixed monthly payment for an amortizing loan; handles a 0% rate gracefully. */
const monthlyPayment = (P: number, monthlyRate: number, n: number): number => {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return P / n;
  return (P * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
};

/** Build the month-by-month amortization schedule. */
const buildSchedule = (P: number, monthlyRate: number, n: number): MonthRow[] => {
  const M = monthlyPayment(P, monthlyRate, n);
  const rows: MonthRow[] = [];
  let balance = P;
  for (let i = 0; i < n; i++) {
    const interest = balance * monthlyRate;
    const principalPaid = M - interest;
    balance = Math.max(0, balance - principalPaid);
    rows.push({ interest, principal: principalPaid, balance });
  }
  return rows;
};

/**
 * Interactive amortization chart. A fixed monthly payment is split into interest
 * (top band) and principal (bottom band) across the life of the loan: early
 * payments are mostly interest, later payments mostly principal, and the bands
 * cross over partway through. A declining outstanding-balance line is overlaid so
 * the learner sees the debt shrink — slowly at first, then faster. Drag the rate
 * and term sliders and the chart plus the monthly-payment / total-interest
 * readouts update live; the chart animates in on mount and on every change.
 * Respects `prefers-reduced-motion` (jumps straight to the final chart).
 */
export function AmortizationSplit({
  title = 'Where each payment goes',
  principalLabel = 'Loan amount',
  rateLabel = 'Annual rate',
  yearsLabel = 'Term (years)',
  interestLabel = 'Interest portion',
  principalPortionLabel = 'Principal portion',
  balanceLabel = 'Balance owed',
  monthlyPaymentLabel = 'Monthly payment',
  totalInterestLabel = 'Total interest paid',
  caption = 'A fixed payment, but a shifting split: early on most of it is interest, so the balance barely moves. As the balance shrinks, less goes to interest and more to principal — and the payoff accelerates.',
  currencyPrefix = '$',
  principal = 200000,
  rate = 0.06,
  years = 30,
  className,
}: AmortizationSplitProps) {
  const id = useId();
  const [principalState, setPrincipalState] = useState(principal);
  const [rateState, setRateState] = useState(rate);
  const [yearsState, setYearsState] = useState(years);
  const [progress, setProgress] = useState(1); // 0 → 1 (chart draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  const monthlyRate = rateState / 12;
  const n = Math.max(1, Math.round(yearsState * 12));
  const M = monthlyPayment(principalState, monthlyRate, n);
  const schedule = buildSchedule(principalState, monthlyRate, n);
  const totalInterest = Math.max(0, M * n - principalState);

  // The stacked bands are scaled to the monthly payment; the balance line is
  // scaled to the starting principal — each on its own vertical sense.
  const maxPayment = Math.max(M, 1);

  const x = (month: number) => padX + (month / n) * (W - padX * 2);
  // Payment-scaled y (for the interest/principal bands).
  const yPay = (v: number) => padY + (1 - v / maxPayment) * (H - padY * 2);
  // Principal-scaled y (for the declining balance line).
  const yBal = (v: number) =>
    padY + (1 - v / Math.max(principalState, 1)) * (H - padY * 2);

  const baseline = H - padY;
  const visibleMonths = Math.max(1, Math.round(progress * n));

  // Lower band = principal portion (from baseline up to principal height).
  // Upper band = interest portion (stacked on top of principal).
  const principalArea = () => {
    let top = '';
    for (let i = 0; i < visibleMonths; i++) {
      top += ` L ${x(i + 0.5)} ${yPay(schedule[i].principal)}`;
    }
    return `M ${x(0)} ${baseline}${top} L ${x(visibleMonths)} ${baseline} Z`;
  };

  const interestArea = () => {
    let lower = '';
    let upper = '';
    for (let i = 0; i < visibleMonths; i++) {
      const p = schedule[i].principal;
      lower += ` L ${x(i + 0.5)} ${yPay(p)}`;
      upper = ` L ${x(i + 0.5)} ${yPay(p + schedule[i].interest)}` + upper;
    }
    return `M ${x(0)} ${baseline}${lower}${upper} L ${x(0)} ${baseline} Z`;
  };

  // Declining outstanding-balance line, revealed up to `progress`.
  const balancePath = () => {
    let d = `M ${x(0)} ${yBal(principalState)}`;
    for (let i = 0; i < visibleMonths; i++) {
      d += ` L ${x(i + 1)} ${yBal(schedule[i].balance)}`;
    }
    return d;
  };

  // Animate the chart drawing in whenever an input changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [principalState, rateState, yearsState]);

  const ratePct = (rateState * 100).toFixed(2).replace(/\.?0+$/, '');

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
          {monthlyPaymentLabel}: {money(currencyPrefix, M)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded bg-accent-500" aria-hidden="true" />
          {interestLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded bg-brand-500" aria-hidden="true" />
          {principalPortionLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-700" aria-hidden="true" />
          {balanceLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a ${money(currencyPrefix, principalState)} loan at ${ratePct}% over ${yearsState} years costs ${money(
          currencyPrefix,
          M,
        )} a month and ${money(currencyPrefix, totalInterest)} in total interest. Early payments are mostly interest; later payments are mostly principal as the balance declines.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={baseline}
          x2={W - padX}
          y2={baseline}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Principal portion band (lower) */}
        <path d={principalArea()} fill="var(--color-brand-500)" fillOpacity={0.55} stroke="none" />
        {/* Interest portion band (upper, stacked) */}
        <path d={interestArea()} fill="var(--color-accent-500)" fillOpacity={0.55} stroke="none" />
        {/* Declining outstanding-balance line */}
        <path
          d={balancePath()}
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-principal`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{principalLabel}</span>
            <span className="font-mono text-ink-900">{money(currencyPrefix, principalState)}</span>
          </label>
          <input
            id={`${id}-principal`}
            type="range"
            min={25000}
            max={1000000}
            step={5000}
            value={principalState}
            onChange={(e) => setPrincipalState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-rate`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{rateLabel}</span>
            <span className="font-mono text-ink-900">{ratePct}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={1}
            max={10}
            step={0.25}
            value={rateState * 100}
            onChange={(e) => setRateState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-years`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yearsLabel}</span>
            <span className="font-mono text-ink-900">{yearsState}</span>
          </label>
          <input
            id={`${id}-years`}
            type="range"
            min={5}
            max={40}
            step={1}
            value={yearsState}
            onChange={(e) => setYearsState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{monthlyPaymentLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, M)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalInterestLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">
            {money(currencyPrefix, totalInterest)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AmortizationSplit;
