import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TermTradeoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the loan principal (read-only badge). */
  principalLabel?: string;
  /** Label for the annual-rate slider. */
  rateLabel?: string;
  /** Label for the term slider (in years). */
  termLabel?: string;
  /** Label for the monthly-payment readout. */
  monthlyPaymentLabel?: string;
  /** Label for the total-interest readout. */
  totalInterestLabel?: string;
  /** Label for the total-paid readout. */
  totalPaidLabel?: string;
  /** Label beside the monthly-payment bar. */
  monthlyBarLabel?: string;
  /** Label beside the total-interest bar. */
  interestBarLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Loan principal borrowed. Defaults to `200000`. */
  principal?: number;
  /** Initial annual interest rate as a fraction (0–0.15). Defaults to `0.06`. */
  rate?: number;
  /** Initial loan term in years (5–40). Defaults to `30`. */
  term?: number;
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

/** Fixed-rate amortizing monthly payment: M = P·r / (1 − (1+r)^−n). Handles r = 0. */
const monthlyPayment = (principal: number, annualRate: number, years: number): number => {
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
};

const TERM_MIN = 5;
const TERM_MAX = 40;
const RATE_MIN = 1;
const RATE_MAX = 15;

/**
 * Interactive loan-term trade-off chart. The learner drags the term (and rate)
 * and watches two horizontal bars move in *opposite* directions — the seesaw at
 * the heart of borrowing. A shorter term pushes the **monthly payment** bar up
 * while shrinking the **total interest** bar; a longer term does the reverse,
 * dropping the monthly bill but ballooning the lifetime interest. The monthly
 * bar is scaled against the payment at the shortest term (its worst case) and
 * the interest bar against the interest at the longest term (its worst case), so
 * each bar fills as it approaches its own extreme. Bar lengths ease smoothly via
 * `requestAnimationFrame`; readouts update live. Respects
 * `prefers-reduced-motion` (bars jump straight to their target lengths).
 */
export function TermTradeoff({
  title = 'The term seesaw',
  principalLabel = 'Loan',
  rateLabel = 'Annual rate',
  termLabel = 'Term (years)',
  monthlyPaymentLabel = 'Monthly payment',
  totalInterestLabel = 'Total interest',
  totalPaidLabel = 'Total paid',
  monthlyBarLabel = 'Monthly payment',
  interestBarLabel = 'Total interest',
  caption = 'Shorten the term and the monthly payment jumps — but you hand the lender far less interest over the life of the loan. Stretch the term and the monthly bill eases while the total interest balloons. The two bars move in opposite directions: that is the trade-off.',
  currencyPrefix = '$',
  principal = 200000,
  rate = 0.06,
  term = 30,
  className,
}: TermTradeoffProps) {
  const id = useId();
  const [rateState, setRateState] = useState(rate);
  const [termState, setTermState] = useState(term);

  // Live (target) figures for the current term + rate.
  const monthly = monthlyPayment(principal, rateState, termState);
  const totalPaid = monthly * Math.round(termState * 12);
  const totalInterest = Math.max(0, totalPaid - principal);

  // Worst-case anchors used to scale each bar (recomputed when rate changes).
  // Monthly payment is highest at the shortest term; interest is highest at the longest.
  const maxMonthly = monthlyPayment(principal, rateState, TERM_MIN);
  const maxInterest = Math.max(
    1,
    monthlyPayment(principal, rateState, TERM_MAX) * Math.round(TERM_MAX * 12) - principal,
  );

  const targetMonthlyFrac = Math.min(1, monthly / Math.max(1, maxMonthly));
  const targetInterestFrac = Math.min(1, totalInterest / maxInterest);

  // Animated bar fractions (0 → target), eased toward their targets via rAF.
  const [monthlyFrac, setMonthlyFrac] = useState(targetMonthlyFrac);
  const [interestFrac, setInterestFrac] = useState(targetInterestFrac);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef({ monthly: targetMonthlyFrac, interest: targetInterestFrac });

  useEffect(() => {
    if (prefersReducedMotion()) {
      setMonthlyFrac(targetMonthlyFrac);
      setInterestFrac(targetInterestFrac);
      fromRef.current = { monthly: targetMonthlyFrac, interest: targetInterestFrac };
      return;
    }
    const from = { ...fromRef.current };
    const duration = 450;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const m = from.monthly + (targetMonthlyFrac - from.monthly) * ease;
      const i = from.interest + (targetInterestFrac - from.interest) * ease;
      setMonthlyFrac(m);
      setInterestFrac(i);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = { monthly: targetMonthlyFrac, interest: targetInterestFrac };
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMonthlyFrac, targetInterestFrac]);

  const ratePct = Math.round(rateState * 100);

  // Small total-interest-vs-term curve (illustrative, rises with term).
  const W = 520;
  const H = 96;
  const padX = 10;
  const padY = 12;
  const SAMPLES = 60;
  const interestAt = (years: number) =>
    Math.max(
      0,
      monthlyPayment(principal, rateState, years) * Math.round(years * 12) - principal,
    );
  const curveMax = Math.max(1, interestAt(TERM_MAX));
  const cx2 = (years: number) =>
    padX + ((years - TERM_MIN) / (TERM_MAX - TERM_MIN)) * (W - padX * 2);
  const cy2 = (v: number) => padY + (1 - v / curveMax) * (H - padY * 2);
  const curvePath = (() => {
    let d = `M ${cx2(TERM_MIN)} ${cy2(interestAt(TERM_MIN))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const years = TERM_MIN + (i / SAMPLES) * (TERM_MAX - TERM_MIN);
      d += ` L ${cx2(years)} ${cy2(interestAt(years))}`;
    }
    return d;
  })();
  const markerX = cx2(termState);
  const markerY = cy2(interestAt(termState));

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
          {principalLabel}: {money(currencyPrefix, principal)}
        </span>
      </figcaption>

      {/* Two animated comparison bars — the seesaw */}
      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-ink-700">
              <span
                className="h-3 w-3 rounded-pill bg-brand-500"
                aria-hidden="true"
              />
              {monthlyBarLabel}
            </span>
            <span className="font-mono font-semibold text-brand-700">
              {money(currencyPrefix, monthly)}
            </span>
          </div>
          <div
            className="mt-1.5 h-4 w-full overflow-hidden rounded-pill bg-surface-sunken/60"
            role="img"
            aria-label={`${monthlyBarLabel}: ${money(currencyPrefix, monthly)} per month`}
          >
            <div
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(2, monthlyFrac * 100)}%`,
                backgroundColor: 'var(--color-brand-500)',
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-ink-700">
              <span
                className="h-3 w-3 rounded-pill bg-accent-500"
                aria-hidden="true"
              />
              {interestBarLabel}
            </span>
            <span className="font-mono font-semibold text-accent-700">
              {money(currencyPrefix, totalInterest)}
            </span>
          </div>
          <div
            className="mt-1.5 h-4 w-full overflow-hidden rounded-pill bg-surface-sunken/60"
            role="img"
            aria-label={`${interestBarLabel}: ${money(currencyPrefix, totalInterest)} over the life of the loan`}
          >
            <div
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(2, interestFrac * 100)}%`,
                backgroundColor: 'var(--color-accent-500)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Total-interest-vs-term curve with a live marker for the chosen term */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 w-full"
        role="img"
        aria-label={`Total interest rises with the loan term: at ${termState} years it reaches ${money(
          currencyPrefix,
          totalInterest,
        )}.`}
      >
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line
          x1={markerX}
          y1={padY}
          x2={markerX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        <circle cx={markerX} cy={markerY} r={4} fill="var(--color-accent-600)" />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-term`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{termLabel}</span>
            <span className="font-mono text-ink-900">{termState}</span>
          </label>
          <input
            id={`${id}-term`}
            type="range"
            min={TERM_MIN}
            max={TERM_MAX}
            step={1}
            value={termState}
            onChange={(e) => setTermState(Number(e.target.value))}
            aria-label={termLabel}
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
            min={RATE_MIN}
            max={RATE_MAX}
            step={1}
            value={ratePct}
            onChange={(e) => setRateState(Number(e.target.value) / 100)}
            aria-label={rateLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{monthlyPaymentLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, monthly)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalInterestLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">
            {money(currencyPrefix, totalInterest)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalPaidLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, totalPaid)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TermTradeoff;
