import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BarrierPayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the knock-out toggle button. */
  knockOutLabel?: string;
  /** Label for the knock-in toggle button. */
  knockInLabel?: string;
  /** Label for the "price stays below the barrier" scenario button. */
  noBreachLabel?: string;
  /** Label for the "price touches the barrier" scenario button. */
  breachLabel?: string;
  /** Label for the time x-axis. */
  timeAxisLabel?: string;
  /** Label for the price y-axis. */
  priceAxisLabel?: string;
  /** Word marking the barrier reference line. */
  barrierLabel?: string;
  /** Word marking the strike reference line. */
  strikeLabel?: string;
  /** Word marking the final-settlement payoff readout. */
  payoffLabel?: string;
  /** Status text: option is live and will pay its intrinsic value. */
  aliveLabel?: string;
  /** Status text: option has been knocked out (worthless). */
  deadLabel?: string;
  /** Status text: option has not yet been activated (worthless). */
  dormantLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Explanatory note for the knock-out structure. */
  knockOutNote?: string;
  /** Explanatory note for the knock-in structure. */
  knockInNote?: string;
  className?: string;
}

/** Strike of the embedded vanilla call. */
const STRIKE = 100;
/** Up-barrier level that knocks the option in or out. */
const BARRIER = 120;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;

/**
 * Two deterministic price paths for an *up-and-out / up-and-in* call struck at
 * 100 with an up-barrier at 120. The "no breach" path drifts up to 115 at expiry
 * without ever touching 120; the "breach" path spikes through 120 early, then
 * settles back to 110 in the money. The arrays are hand-built (not random) so the
 * component renders identically on server and client.
 */
const PATH_NO_BREACH = [100, 101, 99, 103, 106, 104, 108, 111, 109, 113, 115];
const PATH_BREACH = [100, 104, 109, 114, 121, 124, 118, 113, 111, 109, 110];

/**
 * Barrier-option payoff explorer. A barrier option is a vanilla option with a
 * trigger: an **up-and-out call** dies the instant the underlying touches the
 * barrier, while an **up-and-in call** does not exist *until* the barrier is
 * touched. Both share the same strike (100) and the same barrier (120) as the
 * plain call — and that is the whole point of **in–out parity**: owning the
 * knock-in *plus* the knock-out reproduces the vanilla, because exactly one of
 * them is alive on any given path.
 *
 * The chart plots the underlying through time against the barrier and strike
 * lines, then reports the option's status (alive / knocked out / never
 * activated) and its settlement payoff. The two scenario buttons swap between a
 * path that touches the barrier and one that does not, so the learner can watch
 * the same terminal price produce wildly different payoffs depending on whether
 * the barrier was breached *along the way*.
 */
export function BarrierPayoff({
  title = 'Up-barrier call: knock-out vs knock-in',
  knockOutLabel = 'Knock-out (up-and-out)',
  knockInLabel = 'Knock-in (up-and-in)',
  noBreachLabel = 'Path stays below barrier',
  breachLabel = 'Path touches barrier',
  timeAxisLabel = 'Time to expiry →',
  priceAxisLabel = 'Underlying price',
  barrierLabel = 'Barrier',
  strikeLabel = 'Strike',
  payoffLabel = 'Settlement payoff',
  aliveLabel = 'Alive — pays intrinsic value',
  deadLabel = 'Knocked OUT — worthless',
  dormantLabel = 'Never activated — worthless',
  currencyPrefix = '$',
  knockOutNote = 'An up-and-out call behaves like a normal call UNLESS the underlying ever touches the barrier — at which point it is extinguished for good, even if it later finishes deep in the money. Touch the barrier and the most painful thing happens: you can be right about direction and still collect nothing. Because it can die, a knock-out is always CHEAPER than the equivalent vanilla.',
  knockInNote = 'An up-and-in call does not exist until the underlying touches the barrier. If the barrier is never breached, the option simply never comes alive — it expires worthless even if it ends in the money. Only a path that crosses the barrier brings it to life, after which it pays like a vanilla call. Knock-in + knock-out = vanilla: on every path exactly one of the pair is live.',
  className,
}: BarrierPayoffProps) {
  const [type, setType] = useState<'out' | 'in'>('out');
  const [scenario, setScenario] = useState<'breach' | 'no-breach'>('no-breach');

  const path = scenario === 'breach' ? PATH_BREACH : PATH_NO_BREACH;
  const touched = path.some((p) => p >= BARRIER);
  const terminal = path[path.length - 1];
  const intrinsic = Math.max(terminal - STRIKE, 0);

  // Is the option live at settlement?
  const alive = type === 'out' ? !touched : touched;
  const payoff = alive ? intrinsic : 0;

  const status = alive ? aliveLabel : type === 'out' ? deadLabel : dormantLabel;

  // --- Geometry -------------------------------------------------------------
  const W = 520;
  const H = 280;
  const padX = 44;
  const padY = 26;
  const minP = 90;
  const maxP = 130;

  const x = (i: number) => padX + (i / (path.length - 1)) * (W - padX * 2);
  const y = (p: number) => padY + (1 - (p - minP) / (maxP - minP)) * (H - padY * 2);

  const line = path
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p).toFixed(1)}`)
    .join(' ');

  // Index of the first barrier touch (for the marker), if any.
  const touchIndex = path.findIndex((p) => p >= BARRIER);

  const stroke = alive ? 'var(--color-brand-500)' : 'var(--color-accent-500)';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div className="inline-flex rounded-pill border border-ink-200 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setType('out')}
            aria-pressed={type === 'out'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              type === 'out' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {knockOutLabel}
          </button>
          <button
            type="button"
            onClick={() => setType('in')}
            aria-pressed={type === 'in'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              type === 'in' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {knockInLabel}
          </button>
        </div>
      </figcaption>

      <div className="mt-3 inline-flex rounded-pill border border-ink-200 p-0.5" role="group">
        <button
          type="button"
          onClick={() => setScenario('no-breach')}
          aria-pressed={scenario === 'no-breach'}
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
            scenario === 'no-breach' ? 'bg-accent-500 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {noBreachLabel}
        </button>
        <button
          type="button"
          onClick={() => setScenario('breach')}
          aria-pressed={scenario === 'breach'}
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
            scenario === 'breach' ? 'bg-accent-500 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {breachLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: a ${
          type === 'out' ? knockOutLabel : knockInLabel
        } struck at ${money(currencyPrefix, STRIKE)} with a barrier at ${money(
          currencyPrefix,
          BARRIER,
        )}. On the selected path the underlying ${
          touched ? 'touches' : 'never touches'
        } the barrier and finishes at ${money(currencyPrefix, terminal)}, so the option is ${
          alive ? 'alive' : 'worthless'
        } and settles for ${money(currencyPrefix, payoff)}.`}
      >
        {/* Barrier line */}
        <line
          x1={padX}
          y1={y(BARRIER)}
          x2={W - padX}
          y2={y(BARRIER)}
          stroke="var(--color-accent-600)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text x={padX} y={y(BARRIER) - 5} fontSize={10} fontWeight={600} fill="var(--color-accent-700)">
          {barrierLabel} {money(currencyPrefix, BARRIER)}
        </text>

        {/* Strike line */}
        <line
          x1={padX}
          y1={y(STRIKE)}
          x2={W - padX}
          y2={y(STRIKE)}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <text x={padX} y={y(STRIKE) + 13} fontSize={10} fill="var(--color-ink-500)">
          {strikeLabel} {money(currencyPrefix, STRIKE)}
        </text>

        {/* Price path */}
        <path
          key={`${type}-${scenario}`}
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Terminal point */}
        <circle cx={x(path.length - 1)} cy={y(terminal)} r={5} fill={stroke} stroke="white" strokeWidth={1.5} />

        {/* Barrier-touch marker */}
        {touched && touchIndex >= 0 && (
          <g>
            <circle
              cx={x(touchIndex)}
              cy={y(path[touchIndex])}
              r={6}
              fill="none"
              stroke="var(--color-accent-600)"
              strokeWidth={2}
            />
            <text
              x={x(touchIndex)}
              y={y(path[touchIndex]) - 12}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--color-accent-700)"
            >
              touch!
            </text>
          </g>
        )}

        {/* Axis labels */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--color-ink-500)">
          {timeAxisLabel}
        </text>
        <text x={padX - 8} y={padY - 12} fontSize={11} fill="var(--color-ink-500)">
          {priceAxisLabel}
        </text>
      </svg>

      <div
        className={cx(
          'mt-3 rounded-card border px-4 py-3 text-sm font-medium transition-colors motion-reduce:transition-none',
          alive
            ? 'border-brand-200 bg-brand-50 text-brand-800'
            : 'border-accent-200 bg-accent-50 text-accent-800',
        )}
        aria-live="polite"
      >
        {status} · {payoffLabel}:{' '}
        <span className="font-mono font-semibold">{money(currencyPrefix, payoff)}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        {type === 'out' ? knockOutNote : knockInNote}
      </p>
    </figure>
  );
}

export default BarrierPayoff;
