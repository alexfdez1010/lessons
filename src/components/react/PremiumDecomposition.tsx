import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PremiumDecompositionProps {
  /** Heading above the chart. */
  title?: string;
  /** Which option is shown first; the user can toggle. Defaults to `'call'`. */
  optionType?: 'call' | 'put';
  /** Strike price. Defaults to `100`. */
  strike?: number;
  /** Lowest spot on the slider / x-axis. Defaults to `60`. */
  spotMin?: number;
  /** Highest spot on the slider / x-axis. Defaults to `140`. */
  spotMax?: number;
  /** Initial spot price. Defaults to `strike`. */
  spot?: number;
  /** Peak (at-the-money) time value. Defaults to `8`. */
  maxTimeValue?: number;
  /** Gaussian width controlling how fast time value decays away from ATM. Defaults to `18`. */
  timeValueWidth?: number;
  /** Label for the spot-price slider. */
  spotLabel?: string;
  /** Label for the "call" toggle button. */
  callLabel?: string;
  /** Label for the "put" toggle button. */
  putLabel?: string;
  /** Readout + segment label for intrinsic value. */
  intrinsicLabel?: string;
  /** Readout + segment label for time (extrinsic) value. */
  timeValueLabel?: string;
  /** Readout label for the total premium. */
  premiumLabel?: string;
  /** Readout label for the moneyness word. */
  moneynessLabel?: string;
  /** Moneyness word for in-the-money. */
  itmLabel?: string;
  /** Moneyness word for at-the-money. */
  atmLabel?: string;
  /** Moneyness word for out-of-the-money. */
  otmLabel?: string;
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
 * Interactive option-premium decomposition. An option's premium is exactly
 * two parts: **intrinsic value** (what you'd pocket exercising right now) plus
 * **time (extrinsic) value** (everything you pay for the chance the option gets
 * even more valuable before expiry). Drag the spot-price slider and a stacked
 * bar splits the premium into intrinsic (bottom, `brand`) and time value (top,
 * `accent`) while a moneyness label updates.
 *
 * Math is honest: intrinsic = max(spot − strike, 0) for a call (mirrored for a
 * put); time value follows a Gaussian peaked at-the-money and decaying as the
 * option goes deep ITM or OTM. The bar animates its height/position via a CSS
 * transition, but jumps instantly under `prefers-reduced-motion`.
 */
export function PremiumDecomposition({
  title = 'A premium is intrinsic + time value',
  optionType = 'call',
  strike = 100,
  spotMin = 60,
  spotMax = 140,
  spot,
  maxTimeValue = 8,
  timeValueWidth = 18,
  spotLabel = 'Underlying price',
  callLabel = 'Call',
  putLabel = 'Put',
  intrinsicLabel = 'Intrinsic value',
  timeValueLabel = 'Time value',
  premiumLabel = 'Premium',
  moneynessLabel = 'Moneyness',
  itmLabel = 'In the money',
  atmLabel = 'At the money',
  otmLabel = 'Out of the money',
  caption = 'Intrinsic value is what you’d gain exercising right now; time value is everything else you pay for the chance it gets better before expiry. Time value peaks at the money and fades as the option goes deep in or out of the money.',
  className,
}: PremiumDecompositionProps) {
  const id = useId();
  const [type, setType] = useState<'call' | 'put'>(optionType);
  const [spotState, setSpotState] = useState(spot ?? strike);

  const W = 360;
  const H = 260;
  const padTop = 16;
  const padBottom = 28;
  const barW = 96;
  const barX = (W - barW) / 2;

  const intrinsicOf = (s: number, t: 'call' | 'put') =>
    t === 'call' ? Math.max(s - strike, 0) : Math.max(strike - s, 0);
  const timeValueOf = (s: number) => {
    const z = (s - strike) / timeValueWidth;
    return maxTimeValue * Math.exp(-(z * z));
  };

  const intrinsic = intrinsicOf(spotState, type);
  const timeValue = timeValueOf(spotState);
  const premium = intrinsic + timeValue;

  // y-axis scaled to roughly the max possible premium across the range.
  const maxPremium = Math.max(
    intrinsicOf(spotMin, type) + timeValueOf(spotMin),
    intrinsicOf(spotMax, type) + timeValueOf(spotMax),
    maxTimeValue,
    1,
  );
  const plotH = H - padTop - padBottom;
  const valueToH = (v: number) => (v / maxPremium) * plotH;
  const baseY = H - padBottom;

  const intrinsicH = valueToH(intrinsic);
  const timeH = valueToH(timeValue);
  const intrinsicY = baseY - intrinsicH;
  const timeY = intrinsicY - timeH;

  const band = Math.max(strike * 0.01, 1e-6);
  const moneyness: string = (() => {
    if (Math.abs(spotState - strike) <= band) return atmLabel;
    if (type === 'call') return spotState > strike ? itmLabel : otmLabel;
    return spotState < strike ? itmLabel : otmLabel;
  })();

  const transition = prefersReducedMotion()
    ? undefined
    : 'height 350ms ease, y 350ms ease';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div
          className="inline-flex rounded-pill bg-surface-sunken/60 p-0.5 text-sm"
          role="group"
        >
          {(['call', 'put'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={type === opt}
              onClick={() => setType(opt)}
              className={cx(
                'rounded-pill px-3 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                type === opt
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {opt === 'call' ? callLabel : putLabel}
            </button>
          ))}
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: 'var(--color-brand-500)' }}
            aria-hidden="true"
          />
          {intrinsicLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: 'var(--color-accent-400)' }}
            aria-hidden="true"
          />
          {timeValueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. A ${
          type === 'call' ? callLabel : putLabel
        } struck at ${num(strike)} with the underlying at ${num(
          spotState,
        )} has intrinsic value ${num(intrinsic)} and time value ${num(
          timeValue,
        )}, a premium of ${num(premium)} — ${moneyness}.`}
      >
        {/* Baseline */}
        <line
          x1={barX - 16}
          y1={baseY}
          x2={barX + barW + 16}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />
        {/* Strike reference line at the top of intrinsic where ATM premium sits */}
        <line
          x1={barX - 8}
          y1={padTop}
          x2={barX + barW + 8}
          y2={padTop}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Intrinsic value segment (bottom) */}
        <rect
          x={barX}
          y={intrinsicY}
          width={barW}
          height={intrinsicH}
          fill="var(--color-brand-500)"
          style={{ transition }}
        />
        {/* Time value segment (top) */}
        <rect
          x={barX}
          y={timeY}
          width={barW}
          height={timeH}
          fill="var(--color-accent-400)"
          style={{ transition }}
        />

        {/* Segment labels */}
        {intrinsicH > 18 && (
          <text
            x={barX + barW / 2}
            y={intrinsicY + intrinsicH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
            fill="var(--color-surface)"
          >
            {num(intrinsic)}
          </text>
        )}
        {timeH > 18 && (
          <text
            x={barX + barW / 2}
            y={timeY + timeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink-900)"
          >
            {num(timeValue)}
          </text>
        )}

        {/* Premium total above the bar */}
        <text
          x={barX + barW / 2}
          y={Math.max(timeY - 8, padTop - 2)}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="var(--color-ink-900)"
          style={{ transition: transition ? 'all 350ms ease' : undefined }}
        >
          {num(premium)}
        </text>

        {/* x-axis spot caption */}
        <text
          x={barX + barW / 2}
          y={H - 8}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-ink-600)"
        >
          {`${spotLabel}: ${num(spotState)}`}
        </text>
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-spot`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{spotLabel}</span>
          <span className="font-mono text-ink-900">{num(spotState)}</span>
        </label>
        <input
          id={`${id}-spot`}
          type="range"
          min={spotMin}
          max={spotMax}
          step={1}
          value={spotState}
          onChange={(e) => setSpotState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{intrinsicLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {num(intrinsic)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{timeValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {num(timeValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{premiumLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {num(premium)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{moneynessLabel}</dt>
          <dd className="text-lg font-semibold text-ink-900">{moneyness}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PremiumDecomposition;
