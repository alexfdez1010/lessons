import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwapSpreadChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + line label for the par swap-rate series. */
  swapRateLabel?: string;
  /** Legend + line label for the government-bond yield series. */
  govYieldLabel?: string;
  /** Label for the per-tenor swap-spread row. */
  spreadLabel?: string;
  /** Label for the "normal" (positive spreads) regime toggle. */
  normalLabel?: string;
  /** Label for the "stressed" (negative long-end spread) regime toggle. */
  stressedLabel?: string;
  /** Label for the x-axis (tenors). */
  tenorAxisLabel?: string;
  /** Label for the y-axis (rate). */
  rateAxisLabel?: string;
  /** Explanation shown for the normal regime. */
  normalNote?: string;
  /** Explanation shown for the stressed regime. */
  stressedNote?: string;
  /** Suffix appended to basis-point values. Defaults to `' bp'`. */
  bpSuffix?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

type Regime = 'normal' | 'stressed';

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(2)}${suffix}`;

const bp = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}${suffix}`;

/**
 * Swap-spread chart. The **swap spread** at a tenor is the par interest-rate
 * swap rate minus the government-bond yield of the same maturity, quoted in
 * basis points. This draws both yield curves across the 2y / 5y / 10y / 30y
 * tenors so a learner can *see* the gap between them, then prints the spread at
 * each tenor below. In the **normal** regime swaps sit a touch above govvies
 * everywhere — the spread is positive because swaps reference bank/credit
 * funding rates above the risk-free government yield. In the **stressed**
 * regime the long-end spread goes **negative**: the 30y swap rate dips *below*
 * the 30y Treasury yield. That famous post-2008 quirk comes from the
 * balance-sheet and regulatory cost of dealers warehousing Treasuries plus
 * structural pension/LDI receiving — **not** from the sovereign being riskier
 * than banks. Toggling redraws both curves and recolours each spread; paths are
 * re-keyed on regime so they transition (honouring `motion-reduce`).
 */
export function SwapSpreadChart({
  title = 'Swap spreads across the curve',
  swapRateLabel = 'Swap rate',
  govYieldLabel = 'Government yield',
  spreadLabel = 'Swap spread',
  normalLabel = 'Normal',
  stressedLabel = 'Stressed',
  tenorAxisLabel = 'Tenor (years)',
  rateAxisLabel = 'Rate',
  normalNote = 'Normal regime: the swap rate sits a little above the government yield at every tenor, so every swap spread is positive. A swap references a bank/credit funding rate (the floating leg is tied to interbank or repo-plus rates), which is structurally above the risk-free government yield — so the fixed swap rate prices in that extra credit and term premium.',
  stressedNote = 'Stressed regime: at the long end the swap spread goes negative — the 30y swap rate falls below the 30y Treasury yield. This is not the market saying banks are safer than the government. It comes from the balance-sheet and regulatory cost of dealers holding Treasuries (capital and leverage-ratio charges make owning the bond expensive), plus heavy structural receiving from pensions and LDI funds that pushes long-dated swap rates down. The cash bond cheapens relative to the swap, so the spread inverts.',
  bpSuffix = ' bp',
  percentSuffix = '%',
  className,
}: SwapSpreadChartProps) {
  const [regime, setRegime] = useState<Regime>('normal');

  // Four standard tenors along the curve.
  const tenors = [2, 5, 10, 30];

  // Government-bond yields (%) at each tenor — same in both regimes; the regime
  // only shifts where the swap rate sits relative to them.
  const govYields = [4.6, 4.4, 4.3, 4.4];

  // Swap spreads (basis points) per tenor for each regime. The stressed regime
  // turns the long-end spreads negative.
  const spreadsByRegime: Record<Regime, number[]> = {
    normal: [30, 25, 15, 8],
    stressed: [20, 5, -10, -35],
  };

  const spreads = spreadsByRegime[regime];
  // Swap rate (%) = government yield + spread / 10000.
  const swapRates = govYields.map((g, i) => g + spreads[i] / 10000);

  const W = 520;
  const H = 240;
  const padX = 40;
  const padY = 26;
  const minV = 4.2;
  const maxV = 4.7;

  // Tenors are unevenly spaced (2,5,10,30) — lay them on equal slots so the
  // long end stays readable rather than crushing 2y/5y/10y together.
  const x = (i: number) => padX + (i / (tenors.length - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const linePath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');

  const swapPath = linePath(swapRates);
  const govPath = linePath(govYields);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div
          className="inline-flex rounded-pill border border-ink-200 p-0.5"
          role="group"
        >
          <button
            type="button"
            onClick={() => setRegime('normal')}
            aria-pressed={regime === 'normal'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              regime === 'normal'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {normalLabel}
          </button>
          <button
            type="button"
            onClick={() => setRegime('stressed')}
            aria-pressed={regime === 'stressed'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              regime === 'stressed'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {stressedLabel}
          </button>
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {swapRateLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-ink-500"
            aria-hidden="true"
          />
          {govYieldLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: in the ${regime === 'normal' ? normalLabel : stressedLabel} regime the ${spreadLabel.toLowerCase()} runs ${spreads.map((s, i) => `${bp(s, bpSuffix)} at ${tenors[i]}y`).join(', ')}.`}
      >
        {/* Government-yield line. Re-keyed on regime so the transition restarts. */}
        <path
          key={`gov-${regime}`}
          d={govPath}
          fill="none"
          stroke="var(--color-ink-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="5 4"
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        {/* Swap-rate line. */}
        <path
          key={`swap-${regime}`}
          d={swapPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Dots at each tenor for both series. */}
        {govYields.map((v, i) => (
          <circle
            key={`gov-dot-${i}`}
            cx={x(i)}
            cy={y(v)}
            r={3.5}
            fill="var(--color-ink-500)"
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-500 motion-reduce:transition-none"
          >
            <title>{`${govYieldLabel} ${tenors[i]}y: ${pct(v, percentSuffix)}`}</title>
          </circle>
        ))}
        {swapRates.map((v, i) => (
          <circle
            key={`swap-dot-${i}`}
            cx={x(i)}
            cy={y(v)}
            r={4}
            fill="var(--color-brand-600)"
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-500 motion-reduce:transition-none"
          >
            <title>{`${swapRateLabel} ${tenors[i]}y: ${pct(v, percentSuffix)}`}</title>
          </circle>
        ))}

        {/* Tenor ticks */}
        {tenors.map((tenor, i) => (
          <text
            key={tenor}
            x={x(i)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {tenor}y
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {tenorAxisLabel}
        </text>
        <text x={padX - 6} y={padY - 10} fontSize={11} fill="var(--color-ink-500)">
          {rateAxisLabel}
        </text>
      </svg>

      {/* Per-tenor swap-spread row, with a zero reference line. */}
      <div className="mt-4">
        <div className="mb-2 text-sm text-ink-600">{spreadLabel}</div>
        <div className="grid grid-cols-4 gap-2">
          {spreads.map((s, i) => {
            const positive = s >= 0;
            return (
              <div
                key={tenors[i]}
                className="rounded-card border border-ink-100 bg-surface-sunken/40 px-2 py-2 text-center"
              >
                <div className="text-xs text-ink-500">{tenors[i]}y</div>
                <div
                  className={cx(
                    'font-mono text-lg font-semibold transition-colors duration-500 motion-reduce:transition-none',
                    positive ? 'text-brand-600' : 'text-accent-600',
                  )}
                >
                  {bp(s, bpSuffix)}
                </div>
                {/* Mini bar: grows up from a zero baseline for positive
                    spreads, down for negative ones. */}
                <svg
                  viewBox="0 0 60 40"
                  className="mt-1 w-full"
                  role="img"
                  aria-label={`${tenors[i]}y ${spreadLabel.toLowerCase()}: ${bp(s, bpSuffix)}`}
                >
                  <line
                    x1={0}
                    y1={20}
                    x2={60}
                    y2={20}
                    stroke="var(--color-ink-200)"
                    strokeWidth={1}
                  />
                  <rect
                    key={`bar-${regime}-${i}`}
                    x={22}
                    y={positive ? 20 - Math.min(18, Math.abs(s) * 0.4) : 20}
                    width={16}
                    height={Math.min(18, Math.abs(s) * 0.4)}
                    rx={2}
                    fill={
                      positive
                        ? 'var(--color-brand-500)'
                        : 'var(--color-accent-500)'
                    }
                    className="transition-all duration-500 motion-reduce:transition-none"
                  />
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      <p
        className="mt-3 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {regime === 'normal' ? normalNote : stressedNote}
      </p>
    </figure>
  );
}

export default SwapSpreadChart;
