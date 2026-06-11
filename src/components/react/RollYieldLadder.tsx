import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RollYieldLadderProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the contango toggle button. */
  contangoLabel?: string;
  /** Label for the backwardation toggle button. */
  backwardationLabel?: string;
  /** Label for the spot-price reference marker. */
  spotLabel?: string;
  /** Label for the front (expiring) contract marker. */
  frontLabel?: string;
  /** Label for the next (deferred) contract marker the roll buys into. */
  nextLabel?: string;
  /** Label for the x-axis (months to delivery). */
  maturityLabel?: string;
  /** Label for the y-axis (futures price). */
  priceLabel?: string;
  /** Label for the computed roll-yield stat. */
  rollYieldLabel?: string;
  /** Explanation shown for the contango roll. */
  contangoNote?: string;
  /** Explanation shown for the backwardation roll. */
  backwardationNote?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const pct = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

/**
 * Roll-yield ladder. A passive long in commodity futures never takes delivery —
 * it **rolls**: as the front contract nears expiry it sells that contract and
 * buys a later-dated one to keep the exposure alive. The profit or loss baked
 * into that swap is the **roll yield**, and its sign is set entirely by the
 * curve's shape. In **contango** the next contract costs more than the
 * expiring one, so the roll sells low and buys high — a negative roll yield
 * that bleeds the position every month. In **backwardation** the next contract
 * is cheaper, so the roll sells high and buys low — a positive roll yield the
 * holder collects. Toggling redraws the curve and recomputes the roll. The
 * front-month marker animates down the curve toward spot (price convergence at
 * expiry) via a CSS keyframe that honours `motion-reduce`.
 */
export function RollYieldLadder({
  title = 'Rolling futures: where roll yield comes from',
  contangoLabel = 'Contango',
  backwardationLabel = 'Backwardation',
  spotLabel = 'Spot',
  frontLabel = 'Front (sell)',
  nextLabel = 'Next (buy)',
  maturityLabel = 'Months to delivery',
  priceLabel = 'Futures price',
  rollYieldLabel = 'Roll yield per roll',
  contangoNote = 'Contango: the next contract ($106) costs more than the expiring front ($103). To stay long you sell the cheap front and buy the dearer next — sell low, buy high. You hold fewer barrels for the same cash, so the roll bleeds value every month even if spot never moves. That is negative roll yield.',
  backwardationNote = 'Backwardation: the next contract ($97) is cheaper than the expiring front ($100). The roll sells the dear front and buys the cheap next — sell high, buy low. You pick up extra barrels for the same cash, so the roll adds value every month even if spot never moves. That is positive roll yield.',
  currencyPrefix = '$',
  percentSuffix = '%',
  className,
}: RollYieldLadderProps) {
  const [mode, setMode] = useState<'contango' | 'backwardation'>('contango');

  const spot = 100;
  // Six delivery months (0 = front/near .. 5 = far). The roll happens between
  // the front (month 1) and the next (month 2) as the front nears expiry.
  const months = [0, 1, 2, 3, 4, 5];
  const contango = [100, 103, 106, 109, 112, 115];
  const backwardation = [100, 100, 97, 94.5, 92.5, 91];
  const series = mode === 'contango' ? contango : backwardation;

  // The front contract being sold and the next contract being bought.
  const frontIdx = 1;
  const nextIdx = 2;
  const frontPrice = series[frontIdx];
  const nextPrice = series[nextIdx];
  // Roll yield ≈ (front − next) / front. Positive when the front is dearer
  // than the next (backwardation); negative in contango.
  const rollYield = ((frontPrice - nextPrice) / frontPrice) * 100;

  const W = 520;
  const H = 240;
  const padX = 36;
  const padY = 26;
  const minV = 86;
  const maxV = 120;

  const x = (m: number) => padX + (m / 5) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const path = series
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(months[i]).toFixed(1)} ${y(v).toFixed(1)}`)
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
                ? 'bg-accent-500 text-white'
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
                ? 'bg-brand-600 text-white'
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
        aria-label={`${title}: the futures curve is in ${mode === 'contango' ? contangoLabel : backwardationLabel}. The roll sells the front contract at ${money(currencyPrefix, frontPrice)} and buys the next at ${money(currencyPrefix, nextPrice)}, a roll yield of ${pct(rollYield, percentSuffix)} per roll.`}
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
          {spotLabel} {money(currencyPrefix, spot)}
        </text>

        {/* Futures curve. Re-keyed on mode so the transition restarts. */}
        <path
          key={`curve-${mode}`}
          d={path}
          fill="none"
          stroke={
            mode === 'contango'
              ? 'var(--color-accent-500)'
              : 'var(--color-brand-500)'
          }
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Dots for each delivery month */}
        {series.map((v, i) => (
          <circle
            key={i}
            cx={x(months[i])}
            cy={y(v)}
            r={i === frontIdx || i === nextIdx ? 5 : 3}
            fill={
              i === frontIdx
                ? 'var(--color-accent-600)'
                : i === nextIdx
                  ? 'var(--color-brand-600)'
                  : 'var(--color-ink-300)'
            }
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-500 motion-reduce:transition-none"
          />
        ))}

        {/* Roll arrow from the front (sold) to the next (bought) contract */}
        <defs>
          <marker
            id="roll-arrow"
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
          markerEnd="url(#roll-arrow)"
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

        {/* Front-month convergence marker: animates from the front price down
            (or up) to spot, the price convergence every future undergoes at
            expiry. Re-keyed on mode so it restarts on toggle. */}
        <circle
          key={`converge-${mode}`}
          r={4}
          fill="none"
          stroke={
            mode === 'contango'
              ? 'var(--color-accent-600)'
              : 'var(--color-brand-600)'
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

        {/* Front / next labels */}
        <text
          x={x(frontIdx)}
          y={y(frontPrice) + 20}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
        >
          {frontLabel}
        </text>
        <text
          x={x(nextIdx)}
          y={y(nextPrice) + 20}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-brand-600)"
        >
          {nextLabel}
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
          {priceLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {rollYieldLabel}:{' '}
          <span
            className={cx(
              'font-medium',
              rollYield >= 0 ? 'text-brand-600' : 'text-accent-600',
            )}
          >
            {pct(rollYield, percentSuffix)}
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

export default RollYieldLadder;
