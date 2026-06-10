import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FuturesCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the contango toggle button. */
  contangoLabel?: string;
  /** Label for the backwardation toggle button. */
  backwardationLabel?: string;
  /** Label for the spot-price reference marker. */
  spotLabel?: string;
  /** Label for the x-axis (months to delivery). */
  maturityLabel?: string;
  /** Label for the y-axis (futures price). */
  priceLabel?: string;
  /** Explanation shown for the contango shape. */
  contangoNote?: string;
  /** Explanation shown for the backwardation shape. */
  backwardationNote?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

/**
 * Futures term-structure toggle. Plots the futures price for a sequence of
 * delivery months against the current spot. In **contango** the curve slopes
 * up — distant delivery costs more than spot (carry, storage, convenience). In
 * **backwardation** it slopes down — distant delivery is cheaper than spot
 * (scarcity now, a positive convenience yield). Toggle between the two and the
 * curve and explanation swap. No animation loop; the curve transition is a CSS
 * tween that already honours `motion-reduce`.
 */
export function FuturesCurve({
  title = 'The futures curve: contango vs backwardation',
  contangoLabel = 'Contango',
  backwardationLabel = 'Backwardation',
  spotLabel = 'Spot',
  maturityLabel = 'Months to delivery',
  priceLabel = 'Futures price',
  contangoNote = 'Contango: each later delivery month costs more than spot. The upward slope is the cost of carry — storage, insurance and the interest tied up while you wait. A long who just holds and rolls pays that slope every roll.',
  backwardationNote = 'Backwardation: later delivery is cheaper than spot. The downward slope says the market will pay a premium for the commodity right now — a high convenience yield from tight supply. A long who rolls actually collects that slope as roll yield.',
  currencyPrefix = '$',
  className,
}: FuturesCurveProps) {
  const id = useId();
  const [mode, setMode] = useState<'contango' | 'backwardation'>('contango');

  const spot = 100;
  // Six delivery months at 0..5 (0 = spot/front).
  const months = [0, 1, 2, 3, 4, 5];
  const contango = [100, 103, 106, 109, 112, 115];
  const backwardation = [100, 97, 94.5, 92.5, 91, 90];
  const series = mode === 'contango' ? contango : backwardation;

  const W = 520;
  const H = 240;
  const padX = 30;
  const padY = 22;
  const minV = 86;
  const maxV = 118;

  const x = (m: number) => padX + (m / 5) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const path = series
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(months[i])} ${y(v)}`)
    .join(' ');

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
            onClick={() => setMode('contango')}
            aria-pressed={mode === 'contango'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'contango'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {contangoLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('backwardation')}
            aria-pressed={mode === 'backwardation'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'backwardation'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {backwardationLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: showing ${mode === 'contango' ? contangoLabel : backwardationLabel}, where the futures curve slopes ${mode === 'contango' ? 'up' : 'down'} away from the spot price of ${money(currencyPrefix, spot)}.`}
      >
        {/* Spot reference line */}
        <line
          x1={padX}
          y1={y(spot)}
          x2={W - padX}
          y2={y(spot)}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={y(spot) - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {spotLabel} · {money(currencyPrefix, spot)}
        </text>
        {/* Curve */}
        <path
          d={path}
          fill="none"
          stroke={
            mode === 'contango'
              ? 'var(--color-brand-500)'
              : 'var(--color-accent-500)'
          }
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        {/* Points + month ticks */}
        {series.map((v, i) => (
          <g key={i}>
            <circle
              cx={x(months[i])}
              cy={y(v)}
              r={5}
              fill={
                mode === 'contango'
                  ? 'var(--color-brand-600)'
                  : 'var(--color-accent-600)'
              }
              stroke="white"
              strokeWidth={2}
              className="transition-all duration-500 motion-reduce:transition-none"
            />
            <text
              x={x(months[i])}
              y={H - padY + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-500)"
            >
              {months[i]}
            </text>
          </g>
        ))}
        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {maturityLabel}
        </text>
        <text
          x={padX - 4}
          y={padY - 8}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {priceLabel}
        </text>
      </svg>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {mode === 'contango' ? contangoNote : backwardationNote}
      </p>
    </figure>
  );
}

export default FuturesCurve;
