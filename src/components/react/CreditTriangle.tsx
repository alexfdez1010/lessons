import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CreditTriangleProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the CDS-spread slider (in basis points). */
  spreadLabel?: string;
  /** Label for the recovery-rate slider. */
  recoveryLabel?: string;
  /** Label for the implied hazard-rate readout. */
  hazardLabel?: string;
  /** Label for the y-axis (survival probability). */
  survivalAxisLabel?: string;
  /** Label for the x-axis (years). */
  yearsAxisLabel?: string;
  /** Label for the 1-year default-probability readout. */
  oneYearDefaultLabel?: string;
  /** Label for the 5-year survival-probability readout. */
  fiveYearSurvivalLabel?: string;
  /** Label for the 5-year cumulative default readout. */
  fiveYearDefaultLabel?: string;
  /** Label for the 10-year cumulative default readout. */
  tenYearDefaultLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  /** Suffix appended to basis-point values. Defaults to `' bp'`. */
  bpSuffix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct1 = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

/**
 * The credit triangle and the survival curve. A CDS spread is roughly the annual
 * cost of insuring against a credit loss; when default happens you lose only
 * `(1 − R)` of notional, so the spread must compensate for that fractional loss
 * at the rate defaults arrive. That gives the **credit-triangle** approximation
 * `spread ≈ λ · (1 − R)`, i.e. the implied annual hazard rate `λ = spread / (1 − R)`.
 *
 * Compounding the per-instant survival probability over time turns that constant
 * hazard into an **exponential survival curve** `P(survive to t) = exp(−λ·t)`, so
 * the cumulative probability of default by horizon `t` is `1 − exp(−λ·t)`. The
 * learner drives the CDS spread (bp) and recovery (R) sliders → those imply λ →
 * λ draws the curve. The chart plots survival from t = 0 (100%) decaying to
 * t = 10 years, shades the cumulative-default region, and marks the 5-year point.
 * The curve animates in on mount and on every change; respects
 * `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function CreditTriangle({
  title = 'The credit triangle & the survival curve',
  spreadLabel = 'CDS spread',
  recoveryLabel = 'Recovery rate R',
  hazardLabel = 'Implied hazard rate λ',
  survivalAxisLabel = 'Survival probability',
  yearsAxisLabel = 'Years',
  oneYearDefaultLabel = '1y default prob',
  fiveYearSurvivalLabel = '5y survival',
  fiveYearDefaultLabel = '5y default prob',
  tenYearDefaultLabel = '10y default prob',
  caption = 'A CDS spread is roughly the annual cost of insuring against a loss that, when it happens, is (1−R) of notional — so hazard λ ≈ spread / (1−R). Compound that survival every instant and you get the exponential survival curve exp(−λt); the gap below it is the cumulative chance of default by each horizon.',
  percentSuffix = '%',
  bpSuffix = ' bp',
  className,
}: CreditTriangleProps) {
  const id = useId();
  const [spreadBp, setSpreadBp] = useState(200); // 25..800 basis points
  const [recoveryPct, setRecoveryPct] = useState(40); // 0..80 percent
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  // Credit triangle: λ = (spread / 10000) / (1 − R).
  const recovery = recoveryPct / 100;
  const lambda = spreadBp / 10000 / Math.max(1e-6, 1 - recovery);

  // Survival / default helpers.
  const survival = (t: number) => Math.exp(-lambda * t);
  const defaultBy = (t: number) => 1 - survival(t);

  const oneYearDefault = defaultBy(1);
  const fiveYearSurvival = survival(5);
  const fiveYearDefault = defaultBy(5);
  const tenYearDefault = defaultBy(10);

  // --- Chart geometry -------------------------------------------------------
  const W = 520;
  const H = 240;
  const padL = 40;
  const padR = 14;
  const padTop = 14;
  const padBottom = 30;
  const span = 10; // years on the x-axis

  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;

  const x = (year: number) => padL + (year / span) * plotW;
  // y maps a probability (0..1) onto the plot, 100% at top.
  const y = (p: number) => padTop + (1 - p) * plotH;

  // Survival curve sampled finely, revealed up to `progress`.
  const SAMPLES = 100;
  const upto = progress * span;
  const survivalPath = () => {
    let d = `M ${x(0)} ${y(survival(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const year = (i / SAMPLES) * span;
      if (year > upto) {
        d += ` L ${x(upto)} ${y(survival(upto))}`;
        break;
      }
      d += ` L ${x(year)} ${y(survival(year))}`;
    }
    return d;
  };

  // Shaded cumulative-default region: between the survival curve and the top
  // (100%) line, revealed up to `progress`.
  const defaultRegionPath = () => {
    let d = `M ${x(0)} ${y(1)}`;
    const end = Math.max(0, Math.min(span, upto));
    for (let i = 1; i <= SAMPLES; i++) {
      const year = (i / SAMPLES) * span;
      if (year > end) {
        d += ` L ${x(end)} ${y(survival(end))}`;
        break;
      }
      d += ` L ${x(year)} ${y(survival(year))}`;
    }
    d += ` L ${x(end)} ${y(1)} Z`;
    return d;
  };

  // Animate the curve drawing in whenever the implied hazard changes.
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
  }, [lambda]);

  const lambdaPct = lambda * 100;
  const markerVisible = upto >= 5;

  // y-axis gridlines at 0/25/50/75/100%.
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  // x-axis ticks at 0,2,4,6,8,10 years.
  const xTicks = [0, 2, 4, 6, 8, 10];

  const ariaLabel =
    `${title}: a ${spreadBp}${bpSuffix} CDS spread with a ${recoveryPct}${percentSuffix} recovery rate ` +
    `implies an annual hazard rate of ${pct1(lambdaPct, percentSuffix)} per year. ` +
    `The survival probability decays exponentially from 100% at year 0 to ` +
    `${pct1(fiveYearSurvival * 100, percentSuffix)} at year 5 and ` +
    `${pct1(survival(10) * 100, percentSuffix)} at year 10, so the cumulative chance of default ` +
    `reaches ${pct1(fiveYearDefault * 100, percentSuffix)} by year 5 and ` +
    `${pct1(tenYearDefault * 100, percentSuffix)} by year 10.`;

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
          {hazardLabel}: {pct1(lambdaPct, percentSuffix)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {survivalAxisLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-accent-500/40"
            aria-hidden="true"
          />
          {fiveYearDefaultLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Horizontal gridlines + y-axis labels */}
        {yTicks.map((p) => (
          <g key={`y-${p}`}>
            <line
              x1={padL}
              y1={y(p)}
              x2={W - padR}
              y2={y(p)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(p) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-500)"
              fontFamily="var(--font-mono)"
            >
              {Math.round(p * 100)}
              {percentSuffix}
            </text>
          </g>
        ))}

        {/* Shaded cumulative-default region (1 − survival) */}
        <path
          d={defaultRegionPath()}
          fill="var(--color-accent-500)"
          fillOpacity={0.14}
          stroke="none"
        />

        {/* Survival curve, animated reveal */}
        <path
          d={survivalPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 5-year marker: dashed guide + dot + labels */}
        {markerVisible && (
          <g>
            <line
              x1={x(5)}
              y1={y(0)}
              x2={x(5)}
              y2={y(fiveYearSurvival)}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <circle
              cx={x(5)}
              cy={y(fiveYearSurvival)}
              r={5}
              fill="var(--color-brand-600)"
            />
            <text
              x={x(5) + 8}
              y={y(fiveYearSurvival) - 6}
              fontSize={10}
              fill="var(--color-brand-700)"
              fontFamily="var(--font-mono)"
            >
              {pct1(fiveYearSurvival * 100, percentSuffix)}
            </text>
            <text
              x={x(5) + 8}
              y={y(fiveYearSurvival) + 12}
              fontSize={10}
              fill="var(--color-accent-600)"
              fontFamily="var(--font-mono)"
            >
              {pct1(fiveYearDefault * 100, percentSuffix)} def
            </text>
          </g>
        )}

        {/* x-axis baseline */}
        <line
          x1={padL}
          y1={y(0)}
          x2={W - padR}
          y2={y(0)}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {/* x-axis ticks */}
        {xTicks.map((year) => (
          <text
            key={`x-${year}`}
            x={x(year)}
            y={y(0) + 16}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-500)"
            fontFamily="var(--font-mono)"
          >
            {year}
          </text>
        ))}

        {/* Axis titles */}
        <text
          x={padL + plotW / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {yearsAxisLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {survivalAxisLabel}
        </text>
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-spread`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{spreadLabel}</span>
            <span className="font-mono text-ink-900">
              {spreadBp}
              {bpSuffix}
            </span>
          </label>
          <input
            id={`${id}-spread`}
            type="range"
            min={25}
            max={800}
            step={5}
            value={spreadBp}
            onChange={(e) => setSpreadBp(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-recovery`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{recoveryLabel}</span>
            <span className="font-mono text-ink-900">
              {recoveryPct}
              {percentSuffix}
            </span>
          </label>
          <input
            id={`${id}-recovery`}
            type="range"
            min={0}
            max={80}
            step={1}
            value={recoveryPct}
            onChange={(e) => setRecoveryPct(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{hazardLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct1(lambdaPct, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{oneYearDefaultLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct1(oneYearDefault * 100, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fiveYearSurvivalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct1(fiveYearSurvival * 100, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fiveYearDefaultLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {pct1(fiveYearDefault * 100, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {spreadBp}
            {bpSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{recoveryLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {recoveryPct}
            {percentSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{tenYearDefaultLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {pct1(tenYearDefault * 100, percentSuffix)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CreditTriangle;
