import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VixTermStructureProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the contango (calm) toggle button. */
  contangoLabel?: string;
  /** Label for the backwardation (stressed) toggle button. */
  backwardationLabel?: string;
  /** Label for the x-axis (months to expiry). */
  maturityLabel?: string;
  /** Label for the y-axis (implied volatility in VIX points). */
  volLabel?: string;
  /** Label for the spot-VIX reference line. */
  spotLabel?: string;
  /** Label for the computed monthly roll P&L stat. */
  rollLabel?: string;
  /** Explanation shown in the calm (contango) regime. */
  contangoNote?: string;
  /** Explanation shown in the stressed (backwardation) regime. */
  backwardationNote?: string;
  /** Suffix appended after vol numbers, e.g. `' pts'`. Defaults to `''`. */
  pointSuffix?: string;
  className?: string;
}

const vol = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

const signed = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

/**
 * VIX term structure & roll cost. VIX futures trade at a curve of implied
 * volatilities across expiries, and the curve's **shape** sets the carry of a
 * long-vol position (a VXX-style long of the front future). In calm markets the
 * curve is in **contango** — spot VIX sits low and futures slope upward, because
 * the market prices vol mean-reverting back up. A long future must roll *up* the
 * curve each month (sell the cheap expiring contract, buy the dearer next one)
 * and bleeds value as it converges down toward spot — negative carry, the engine
 * of VXX decay. In a panic the curve **inverts** into backwardation: spot VIX
 * spikes far above futures, so a long future rolls *down* the curve into cheaper
 * contracts and earns positive carry — but only once fear is already high.
 * Toggling redraws the curve and recomputes the monthly roll P&L. The front-month
 * marker animates from the front price toward spot (convergence at expiry) via an
 * SVG `<animate>` that honours `motion-reduce`.
 */
export function VixTermStructure({
  title = 'The VIX term structure and its roll cost',
  contangoLabel = 'Calm market (contango)',
  backwardationLabel = 'Stressed market (backwardation)',
  maturityLabel = 'Months to expiry',
  volLabel = 'Implied volatility (VIX points)',
  spotLabel = 'Spot VIX',
  rollLabel = 'Monthly roll P&L (long front future)',
  contangoNote = 'In calm, normal markets near-dated VIX futures trade below longer-dated ones, so the curve slopes upward (contango). The market prices low spot volatility mean-reverting back up, so each later contract is dearer. To stay long, a VIX-futures position must roll up the curve every month — sell the cheap expiring future and buy the dearer next one — so it bleeds value as the front converges down toward spot, even if spot VIX never moves. This negative carry is exactly why long-vol products like VXX decay over time.',
  backwardationNote = 'During a panic, spot VIX spikes far above the futures, so the curve slopes downward and inverts (backwardation). The market expects the storm to pass, so later contracts are cheaper than the front. Now a long future rolls down the curve into cheaper contracts and the front converges up toward the elevated spot — earning positive carry. The catch: you only collect this when fear is already high, which is usually too late to climb aboard cheaply.',
  pointSuffix = '',
  className,
}: VixTermStructureProps) {
  const [mode, setMode] = useState<'contango' | 'backwardation'>('contango');

  // Seven monthly expiries (0 = spot, 1 = front future .. 6 = far).
  const months = [0, 1, 2, 3, 4, 5, 6];
  const contango = [15, 16.5, 18, 19, 19.8, 20.3, 20.6];
  const backwardation = [45, 40, 35, 31, 28, 26, 24.5];
  const series = mode === 'contango' ? contango : backwardation;

  const spot = series[0];
  // The front future being held and the next contract the roll buys into.
  const frontIdx = 1;
  const nextIdx = 2;
  const frontPrice = series[frontIdx];
  const nextPrice = series[nextIdx];

  // Monthly roll P&L for a LONG holder of the front future as it converges
  // toward spot at expiry: ≈ (spot − frontPrice). In contango spot < front so
  // the long bleeds (negative); in backwardation spot > front so it gains.
  const rollPnL = spot - frontPrice;

  const W = 520;
  const H = 240;
  const padX = 36;
  const padY = 26;
  const minV = 10;
  const maxV = 50;

  const x = (m: number) => padX + (m / 6) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const path = series
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${x(months[i]).toFixed(1)} ${y(v).toFixed(1)}`,
    )
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
        aria-label={`${title}: the curve is in ${mode === 'contango' ? contangoLabel : backwardationLabel}. Spot VIX is ${vol(spot, pointSuffix)}, the front future is ${vol(frontPrice, pointSuffix)}, and the monthly roll P&L for a long front future is ${signed(rollPnL, pointSuffix)} as it converges toward spot.`}
      >
        {/* Spot VIX reference line */}
        <line
          x1={padX}
          y1={y(spot)}
          x2={W - padX}
          y2={y(spot)}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        <text
          x={W - padX}
          y={y(spot) - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
          className="transition-all duration-500 motion-reduce:transition-none"
        >
          {spotLabel} {vol(spot, pointSuffix)}
        </text>

        {/* Implied-vol curve. Re-keyed on mode so the transition restarts. */}
        <path
          key={`curve-${mode}`}
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

        {/* Dots for each expiry; front + next highlighted */}
        {series.map((v, i) => (
          <circle
            key={i}
            cx={x(months[i])}
            cy={y(v)}
            r={i === frontIdx || i === nextIdx ? 5 : 3}
            fill={
              i === frontIdx
                ? 'var(--color-brand-600)'
                : i === nextIdx
                  ? 'var(--color-accent-600)'
                  : 'var(--color-ink-300)'
            }
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-500 motion-reduce:transition-none"
          />
        ))}

        {/* Roll arrow from the front (held/expiring) to the next contract */}
        <defs>
          <marker
            id="vix-roll-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-500)" />
          </marker>
        </defs>
        <path
          key={`roll-${mode}`}
          d={`M ${x(frontIdx).toFixed(1)} ${(y(frontPrice) - 14).toFixed(1)} Q ${((x(frontIdx) + x(nextIdx)) / 2).toFixed(1)} ${(Math.min(y(frontPrice), y(nextPrice)) - 30).toFixed(1)} ${x(nextIdx).toFixed(1)} ${(y(nextPrice) - 14).toFixed(1)}`}
          fill="none"
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          markerEnd="url(#vix-roll-arrow)"
        />
        <text
          x={(x(frontIdx) + x(nextIdx)) / 2}
          y={Math.min(y(frontPrice), y(nextPrice)) - 34}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-600)"
        >
          roll
        </text>

        {/* Front-month convergence marker: animates from the front price toward
            spot (the price convergence at expiry). Re-keyed on mode so it
            restarts on toggle. */}
        <circle
          key={`converge-${mode}`}
          r={4}
          fill="none"
          stroke={
            mode === 'contango'
              ? 'var(--color-brand-600)'
              : 'var(--color-accent-600)'
          }
          strokeWidth={2}
          cx={x(frontIdx)}
          cy={y(frontPrice)}
          className="motion-reduce:hidden"
        >
          <animate
            attributeName="cy"
            from={y(frontPrice)}
            to={y(spot)}
            dur="1.6s"
            begin="0.2s"
            fill="freeze"
            repeatCount="1"
          />
          <animate
            attributeName="cx"
            from={x(frontIdx)}
            to={x(0)}
            dur="1.6s"
            begin="0.2s"
            fill="freeze"
            repeatCount="1"
          />
        </circle>

        {/* Front-future label */}
        <text
          x={x(frontIdx)}
          y={y(frontPrice) + 20}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-brand-600)"
        >
          front
        </text>

        {/* Month ticks */}
        {months.map((m) => (
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
          {maturityLabel}
        </text>
        <text x={padX - 6} y={padY - 10} fontSize={11} fill="var(--color-ink-500)">
          {volLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {rollLabel}:{' '}
          <span
            className={cx(
              'font-medium',
              rollPnL >= 0 ? 'text-brand-600' : 'text-accent-600',
            )}
          >
            {signed(rollPnL, pointSuffix)}
          </span>
        </span>
      </div>

      <p
        className="mt-2 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {mode === 'contango' ? contangoNote : backwardationNote}
      </p>
    </figure>
  );
}

export default VixTermStructure;
