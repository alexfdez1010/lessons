import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

type Scenario = 'rising' | 'falling' | 'flat';

export interface RatePathChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the fixed-rate (flat) payment line. */
  fixedLabel?: string;
  /** Legend label for the variable-rate (moving) payment line. */
  variableLabel?: string;
  /** Label above the scenario segmented control. */
  scenarioLabel?: string;
  /** Button label for the "rates rise" scenario. */
  risingLabel?: string;
  /** Button label for the "rates fall" scenario. */
  fallingLabel?: string;
  /** Button label for the "rates stay flat" scenario. */
  flatLabel?: string;
  /** Readout label for the fixed monthly payment. */
  fixedPaymentReadoutLabel?: string;
  /** Readout label for the variable monthly payment at the end of the term. */
  variablePaymentReadoutLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Loan principal. Defaults to `200000`. */
  principal?: number;
  /** Fixed annual rate as a fraction (0–0.15). Defaults to `0.06`. */
  fixedRate?: number;
  /** Starting variable/benchmark annual rate as a fraction. Defaults to `0.05`. */
  startVariableRate?: number;
  /** Loan term in years. Defaults to `30`. */
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

/**
 * Standard amortized monthly payment for a loan of `p` at annual rate `r`
 * (fraction) over `n` years. Falls back to straight-line when `r` is ~0.
 */
const monthlyPayment = (p: number, r: number, n: number): number => {
  const months = n * 12;
  const i = r / 12;
  if (i <= 1e-9) return p / months;
  return (p * i) / (1 - Math.pow(1 + i, -months));
};

/**
 * Teaching model of the benchmark rate at a given `year` under a scenario.
 * Not a precise APR engine — just a smooth drift so the line clearly rises,
 * falls, or stays flat over the loan term.
 */
const benchmarkRate = (
  scenario: Scenario,
  startRate: number,
  year: number,
  years: number,
): number => {
  const t = years > 0 ? year / years : 0; // 0 → 1 across the term
  if (scenario === 'rising') return startRate + 0.03 * t; // drifts up ~+3%
  if (scenario === 'falling') return Math.max(0.005, startRate - 0.03 * t); // drifts down
  return startRate + 0.002 * Math.sin(t * Math.PI * 2); // ~flat with tiny wobble
};

/**
 * Interactive fixed-vs-variable loan payment chart. The fixed-rate payment is a
 * flat horizontal line (locked in for the life of the loan); the variable-rate
 * payment is recomputed each year as if the loan were re-amortized at the
 * then-current benchmark rate, so it rises or falls with the chosen scenario.
 * Pick "rates rise / fall / flat" and watch the variable line diverge from the
 * fixed one — the gap is who wins or loses, and the uncertainty of going
 * variable. The variable line animates in on mount and on every scenario change;
 * respects `prefers-reduced-motion` (jumps straight to the final line).
 *
 * This is a deliberately simplified teaching model, not an exact APR calculator.
 */
export function RatePathChart({
  title = 'Fixed vs. variable: who pays more?',
  fixedLabel = 'Fixed payment',
  variableLabel = 'Variable payment',
  scenarioLabel = 'Rate scenario',
  risingLabel = 'Rates rise',
  fallingLabel = 'Rates fall',
  flatLabel = 'Rates flat',
  fixedPaymentReadoutLabel = 'Fixed monthly payment',
  variablePaymentReadoutLabel = 'Variable payment (end of term)',
  caption = 'A fixed rate locks your payment for the whole loan — a flat line. A variable rate re-prices with the market: it costs less when rates fall and bites hard when they rise. The gap is the bet you make by going variable.',
  currencyPrefix = '$',
  principal = 200000,
  fixedRate = 0.06,
  startVariableRate = 0.05,
  years = 30,
  className,
}: RatePathChartProps) {
  const id = useId();
  const [fixedRateState, setFixedRateState] = useState(fixedRate);
  const [scenario, setScenario] = useState<Scenario>('rising');
  const [progress, setProgress] = useState(1); // 0 → 1 (variable line draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  const fixedPay = monthlyPayment(principal, fixedRateState, years);

  // Variable payment per whole year, re-amortized at that year's benchmark rate
  // over the remaining term (a teaching simplification).
  const variableAt = (year: number): number => {
    const remaining = Math.max(1, years - year);
    const rate = benchmarkRate(scenario, startVariableRate, year, years);
    return monthlyPayment(principal, rate, remaining);
  };

  const finalVariable = variableAt(years);

  // Bounds: include both lines plus a little headroom so nothing clips.
  const samples: number[] = [];
  for (let yr = 0; yr <= years; yr++) samples.push(variableAt(yr));
  const maxV = Math.max(fixedPay, ...samples) * 1.06;
  const minV = Math.min(fixedPay, ...samples) * 0.94;

  const x = (year: number) => padX + (year / years) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const fixedPath = `M ${x(0)} ${y(fixedPay)} L ${x(years)} ${y(fixedPay)}`;

  // Variable line, revealed up to `progress` along the term.
  const variablePath = () => {
    const upto = progress * years;
    let d = `M ${x(0)} ${y(variableAt(0))}`;
    for (let yr = 1; yr <= years; yr++) {
      if (yr > upto) {
        d += ` L ${x(upto)} ${y(variableAt(upto))}`;
        break;
      }
      d += ` L ${x(yr)} ${y(variableAt(yr))}`;
    }
    return d;
  };

  // Animate the variable line whenever the scenario or fixed rate changes.
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
  }, [scenario, fixedRateState]);

  const fixedRatePct = Math.round(fixedRateState * 100);

  const scenarioButtons: ReadonlyArray<{ value: Scenario; label: string }> = [
    { value: 'rising', label: risingLabel },
    { value: 'falling', label: fallingLabel },
    { value: 'flat', label: flatLabel },
  ];

  const activeScenarioLabel =
    scenarioButtons.find((s) => s.value === scenario)?.label ?? risingLabel;

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
          {activeScenarioLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {fixedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {variableLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: under the "${activeScenarioLabel}" scenario, the fixed monthly payment stays flat at ${money(
          currencyPrefix,
          fixedPay,
        )} while the variable monthly payment ends the term at ${money(
          currencyPrefix,
          finalVariable,
        )}.`}
      >
        {/* Axis baseline */}
        <line
          x1={padX}
          y1={H - padY}
          x2={W - padX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
        />
        {/* Fixed payment — flat line */}
        <path d={fixedPath} fill="none" stroke="var(--color-brand-500)" strokeWidth={3} />
        {/* Variable payment — animated moving line */}
        <path
          d={variablePath()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Scenario segmented control */}
      <div className="mt-4">
        <span className="text-sm text-ink-700">{scenarioLabel}</span>
        <div
          className="mt-2 inline-flex flex-wrap gap-2"
          role="group"
          aria-label={scenarioLabel}
        >
          {scenarioButtons.map((btn) => {
            const selected = scenario === btn.value;
            return (
              <button
                key={btn.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setScenario(btn.value)}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
                )}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed-rate slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-fixed-rate`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{fixedLabel}</span>
          <span className="font-mono text-ink-900">{fixedRatePct}%</span>
        </label>
        <input
          id={`${id}-fixed-rate`}
          type="range"
          min={0}
          max={15}
          step={1}
          value={fixedRatePct}
          onChange={(e) => setFixedRateState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fixedPaymentReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, fixedPay)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{variablePaymentReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, finalVariable)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RatePathChart;
