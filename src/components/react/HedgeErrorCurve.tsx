import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HedgeErrorCurveProps {
  /** Heading above the chart. */
  title?: string;
  /**
   * Hedging-error coefficient `a` in `error(N) = a / sqrt(N)`. The std-dev of
   * the discrete-hedging P&L error shrinks roughly like 1/√N. Defaults to `1`.
   */
  errorCoeff?: number;
  /**
   * Starting per-rebalance transaction-cost coefficient `b` in
   * `cost(N) = b * sqrt(N)`. (We use the √N form: total turnover cost of a
   * delta hedge over fixed calendar time scales ~√N, since each rehedge moves
   * delta by ~1/√N. Also seeds the slider.) Defaults to `0.06`.
   */
  costCoeff?: number;
  /** Slider label for the transaction-cost level. */
  costSliderLabel?: string;
  /** Legend label for the hedging-error curve. */
  errorLabel?: string;
  /** Legend label for the transaction-cost curve. */
  costLabel?: string;
  /** Legend label for the total-cost curve. */
  totalLabel?: string;
  /** X-axis / frequency readout label. */
  freqLabel?: string;
  /** Readout label for the optimum (best N + min total). */
  optimumLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

/**
 * The discrete-hedging tradeoff, drawn as a U-shaped cost curve.
 *
 * A delta hedge that is rebalanced `N` times before expiry has a hedging
 * error whose standard deviation shrinks roughly like `a / √N` — rehedge more
 * often and you track delta more tightly. But every rebalance pays a spread /
 * commission, and total turnover cost grows like `b · √N`. Their sum is
 * U-shaped, so there is an optimal rebalancing frequency that minimises total
 * cost. Drag the transaction-cost slider: pricier trading pushes the optimum
 * toward *fewer* rebalances.
 *
 *   error(N) = a / √N        (decreasing — hedging risk)
 *   cost(N)  = b · √N        (increasing — transaction cost; √N form, see prop)
 *   total(N) = error(N) + cost(N)   (U-shaped)
 *
 * The optimum is found by scanning the sampled N-grid (a closed-form proxy, no
 * simulation). Respects `prefers-reduced-motion` (no transition on the guide).
 */
export function HedgeErrorCurve({
  title = 'The discrete-hedging tradeoff',
  errorCoeff = 1,
  costCoeff = 0.06,
  costSliderLabel = 'Transaction-cost level',
  errorLabel = 'Hedging error',
  costLabel = 'Transaction cost',
  totalLabel = 'Total cost',
  freqLabel = 'Rebalances to expiry (N)',
  optimumLabel = 'Optimal frequency',
  caption = 'Rehedge more often and your tracking error (the gap between the hedge and the option it replicates) shrinks like 1 over the square root of N — but you pay the bid-ask spread every single time, and that cost grows. Their sum is U-shaped, so there is a sweet-spot frequency. Crank up the transaction-cost slider and watch the optimum slide toward fewer, lazier rebalances.',
  className,
}: HedgeErrorCurveProps) {
  const id = useId();

  const a = Math.max(0.05, errorCoeff);
  const [b, setB] = useState(Math.max(0.005, costCoeff));

  const W = 520;
  const H = 240;
  const padX = 14;
  const padY = 20;

  const nMin = 1;
  const nMax = 250;

  // Log-spaced N grid (1 .. 250) so the cheap-frequency region isn't crushed.
  const SAMPLES = 160;
  const logMin = Math.log(nMin);
  const logMax = Math.log(nMax);
  const nAt = (i: number): number => Math.exp(logMin + (i / SAMPLES) * (logMax - logMin));

  const error = (N: number): number => a / Math.sqrt(N);
  const cost = (N: number): number => b * Math.sqrt(N);
  const total = (N: number): number => error(N) + cost(N);

  const samples: { N: number; e: number; c: number; t: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const N = nAt(i);
    samples.push({ N, e: error(N), c: cost(N), t: total(N) });
  }

  // Argmin of total over the sampled grid.
  let best = samples[0];
  for (const p of samples) if (p.t < best.t) best = p;
  const optN = best.N;
  const optTotal = best.t;

  // Vertical extent across all three curves.
  let vHi = 0;
  for (const p of samples) {
    if (p.e > vHi) vHi = p.e;
    if (p.c > vHi) vHi = p.c;
    if (p.t > vHi) vHi = p.t;
  }
  vHi *= 1.05;
  const vLo = 0;

  const x = (N: number) =>
    padX + ((Math.log(N) - logMin) / (logMax - logMin)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - vLo) / (vHi - vLo)) * (H - padY * 2);

  const pathOf = (key: 'e' | 'c' | 't'): string => {
    let d = '';
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      d += `${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(p[key])}`;
    }
    return d;
  };

  const errorPath = pathOf('e');
  const costPath = pathOf('c');
  const totalPath = pathOf('t');

  const optX = x(optN);
  const optY = y(optTotal);

  // Tick marks at a few representative frequencies.
  const ticks = [1, 5, 25, 100, 250].filter((n) => n >= nMin && n <= nMax);

  const transitionStyle = prefersReducedMotion()
    ? undefined
    : { transition: 'cx 200ms ease, cy 200ms ease, x1 200ms ease, x2 200ms ease' };

  const legend: { label: string; color: string }[] = [
    { label: errorLabel, color: 'var(--color-ink-400)' },
    { label: costLabel, color: 'var(--color-accent-500)' },
    { label: totalLabel, color: 'var(--color-brand-500)' },
  ];

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
          {optimumLabel}: N ≈ {num(optN, 0)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4" aria-hidden="true">
        {legend.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-sm text-ink-700">
            <span
              className="inline-block h-3 w-3 rounded-pill"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. ${errorLabel} falls like one over the square root of N while ${costLabel.toLowerCase()} rises like the square root of N; their ${totalLabel.toLowerCase()} is U-shaped and is minimised at about ${num(
          optN,
          0,
        )} rebalances, where the total cost is ${num(optTotal, 3)}.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
        />
        {/* X ticks */}
        {ticks.map((n) => (
          <g key={n}>
            <line
              x1={x(n)}
              y1={y(0)}
              x2={x(n)}
              y2={y(0) + 4}
              stroke="var(--color-ink-300)"
            />
            <text
              x={x(n)}
              y={y(0) + 7}
              fontSize={10}
              fill="var(--color-ink-400)"
              textAnchor="middle"
              dominantBaseline="hanging"
            >
              {n}
            </text>
          </g>
        ))}
        {/* Vertical guide at the optimum */}
        <line
          x1={optX}
          y1={padY}
          x2={optX}
          y2={H - padY}
          stroke="var(--color-brand-300)"
          strokeDasharray="4 4"
          style={transitionStyle}
        />
        {/* Hedging-error curve (decreasing) */}
        <path
          d={errorPath}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Transaction-cost curve (increasing) */}
        <path
          d={costPath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Total curve (U-shaped) */}
        <path
          d={totalPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Minimum marker */}
        <circle cx={optX} cy={optY} r={6} fill="var(--color-brand-600)" style={transitionStyle} />
      </svg>

      {/* Transaction-cost slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-cost`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{costSliderLabel}</span>
          <span className="font-mono text-ink-900">{num(b, 3)}</span>
        </label>
        <input
          id={`${id}-cost`}
          type="range"
          min={0.01}
          max={0.3}
          step={0.005}
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {optimumLabel} ({freqLabel})
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(optN, 0)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {totalLabel} ({optimumLabel.toLowerCase()})
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(optTotal, 3)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HedgeErrorCurve;
