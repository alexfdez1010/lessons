import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CarryTradeUnwindProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the calm-carry toggle button. */
  calmLabel?: string;
  /** Label for the unwind toggle button. */
  unwindLabel?: string;
  /** Label for the x-axis (months). */
  monthsLabel?: string;
  /** Label for the y-axis (cumulative return). */
  returnLabel?: string;
  /** Explanation shown for the calm-carry shape. */
  calmNote?: string;
  /** Explanation shown for the unwind shape. */
  unwindNote?: string;
  /** Label for the peak cumulative-carry stat. */
  peakLabel?: string;
  /** Label for the crash drawdown stat. */
  drawdownLabel?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const pct = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

/**
 * Carry-trade P&L toggle. Plots the cumulative return of a currency carry trade
 * over ~36 months. In **calm carry** the line drifts gently up — the steady
 * interest-rate differential, "picking up pennies". In **unwind** the same calm
 * climb is suddenly erased by a violent cliff near the end — "in front of a
 * steamroller". The deterministic series make the signature shape obvious: a
 * smooth uphill line until a sharp, fat-tailed drawdown wipes out months of
 * gains. The line draws in via a stroke-dashoffset reveal that honours
 * `motion-reduce` (the path appears instantly when motion is reduced).
 */
export function CarryTradeUnwind({
  title = 'Carry trade: pennies in front of a steamroller',
  calmLabel = 'Calm carry',
  unwindLabel = 'Unwind',
  monthsLabel = 'Months',
  returnLabel = 'Cumulative return',
  calmNote = 'Calm carry: borrow a low-yield currency, hold a high-yield one, and pocket the interest-rate differential month after month. The line drifts gently up with small wiggles — steady income, "picking up pennies". This is what most of the track record looks like.',
  unwindNote = 'Unwind: the same gentle climb for years, then a violent cliff. When risk appetite snaps, everyone exits the crowded carry trade at once and the funding currency rockets back. A few steps give back many months of gains — the "steamroller" that flattens the penny-picker.',
  peakLabel = 'Peak carry collected',
  drawdownLabel = 'Unwind drawdown',
  percentSuffix = '%',
  className,
}: CarryTradeUnwindProps) {
  const [mode, setMode] = useState<'calm' | 'unwind'>('unwind');

  // 37 monthly cumulative-return readings (month 0..36), deterministic.
  // Calm: gentle positive drift with minor wiggles, never crashing.
  const calm = [
    0.0, 0.5, 1.1, 1.6, 2.4, 2.9, 3.6, 4.2, 4.9, 5.5, 6.3, 6.8, 7.5, 8.2, 8.8,
    9.6, 10.1, 10.9, 11.5, 12.3, 12.9, 13.6, 14.2, 15.0, 15.6, 16.4, 17.0, 17.7,
    18.4, 19.1, 19.7, 20.4, 21.0, 21.7, 22.3, 23.0, 23.6,
  ];
  // Unwind: tracks calm until month 28, then a steep cliff through month 32.
  const unwind = [
    0.0, 0.5, 1.1, 1.6, 2.4, 2.9, 3.6, 4.2, 4.9, 5.5, 6.3, 6.8, 7.5, 8.2, 8.8,
    9.6, 10.1, 10.9, 11.5, 12.3, 12.9, 13.6, 14.2, 15.0, 15.6, 16.4, 17.0, 17.7,
    18.4, 13.5, 6.2, -2.4, -8.1, -7.0, -6.4, -5.9, -5.5,
  ];
  const series = mode === 'calm' ? calm : unwind;
  const months = series.map((_, i) => i);
  const lastMonth = months.length - 1;

  const peak = Math.max(...series);
  // Drawdown of the crash: how far the line fell from its peak (negative).
  const trough = Math.min(...series);
  const drawdown = trough - peak;

  const W = 520;
  const H = 240;
  const padX = 34;
  const padY = 24;
  const minV = -12;
  const maxV = 26;

  const x = (m: number) => padX + (m / lastMonth) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const path = series
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(months[i]).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');

  // Generous dash length so the reveal covers the whole polyline.
  const dash = 1600;

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
            onClick={() => setMode('calm')}
            aria-pressed={mode === 'calm'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'calm'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {calmLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('unwind')}
            aria-pressed={mode === 'unwind'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'unwind'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {unwindLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: cumulative carry-trade return over ${lastMonth} months, showing ${mode === 'calm' ? calmLabel : unwindLabel}. The line ${mode === 'calm' ? 'drifts steadily upward, collecting the interest-rate differential' : 'climbs steadily, then drops off a cliff near the end as the trade unwinds'}.`}
      >
        {/* Zero reference line */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={y(0) - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          0{percentSuffix}
        </text>

        {/* Cumulative-P&L line. Re-keyed on mode so the draw animation restarts. */}
        <path
          key={mode}
          d={path}
          fill="none"
          stroke={
            mode === 'calm'
              ? 'var(--color-brand-500)'
              : 'var(--color-accent-500)'
          }
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={dash}
          className="[animation:carry-draw_1100ms_ease-out_forwards] motion-reduce:[animation:none] motion-reduce:[stroke-dasharray:none]"
        />

        {/* End marker */}
        <circle
          cx={x(lastMonth)}
          cy={y(series[lastMonth])}
          r={5}
          fill={
            mode === 'calm'
              ? 'var(--color-brand-600)'
              : 'var(--color-accent-600)'
          }
          stroke="white"
          strokeWidth={2}
        />

        {/* Month ticks at the four corners of the window */}
        {[0, 12, 24, lastMonth].map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {m}
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
          {monthsLabel}
        </text>
        <text x={padX - 4} y={padY - 8} fontSize={11} fill="var(--color-ink-500)">
          {returnLabel}
        </text>

        {/* Stroke-reveal keyframes (global name; harmless if defined more than once). */}
        <style>{`@keyframes carry-draw { to { stroke-dashoffset: 0; } }`}</style>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {peakLabel}:{' '}
          <span className="font-medium text-ink-900">
            {pct(peak, percentSuffix)}
          </span>
        </span>
        {mode === 'unwind' && (
          <span className="text-ink-600">
            {drawdownLabel}:{' '}
            <span className="font-medium text-accent-600">
              {pct(drawdown, percentSuffix)}
            </span>
          </span>
        )}
      </div>

      <p
        className="mt-2 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {mode === 'calm' ? calmNote : unwindNote}
      </p>
    </figure>
  );
}

export default CarryTradeUnwind;
