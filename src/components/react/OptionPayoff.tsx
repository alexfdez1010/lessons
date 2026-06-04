import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PayoffLeg {
  type: 'call' | 'put';
  position: 'long' | 'short';
  strike: number;
  premium: number; // per-share premium paid (long) or received (short)
  quantity?: number; // default 1
  label?: string; // optional leg label for legend
}

export interface OptionPayoffProps {
  title?: string;
  legs: PayoffLeg[];
  spotMax?: number; // x-axis max underlying price; default = pick from strikes*2
  spotLabel?: string; // default 'Underlying price at expiration'
  resultLabel?: string; // default 'Profit / loss per share'
  payoffToggleLabel?: string; // default 'Payoff'
  profitToggleLabel?: string; // default 'Profit'
  breakevenLabel?: string; // default 'Breakeven'
  maxGainLabel?: string; // default 'Max gain'
  maxLossLabel?: string; // default 'Max loss'
  unlimitedLabel?: string; // default 'Unlimited'
  showProfit?: boolean; // initial mode; default true (profit)
  caption?: string;
  className?: string;
}

const fmt = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

/** Per-share payoff of a single leg at expiration price S (excludes premium). */
const legPayoff = (leg: PayoffLeg, s: number): number => {
  const qty = leg.quantity ?? 1;
  const intrinsic =
    leg.type === 'call' ? Math.max(s - leg.strike, 0) : Math.max(leg.strike - s, 0);
  const signed = leg.position === 'long' ? intrinsic : -intrinsic;
  return signed * qty;
};

/**
 * Interactive option payoff / profit diagram at expiration. Supports any number
 * of legs, so it draws a single long call as easily as a covered call, vertical
 * spread or straddle. The plotted line is the total per-share payoff (or profit,
 * once net premium is subtracted) as a piecewise-linear "hockey stick". The area
 * above the zero line is shaded as profit, below it as loss. A segmented toggle
 * flips between Payoff (ignores premium) and Profit (nets premium out).
 *
 * Math is exact: long call = max(S−K,0), short call = −max(S−K,0), long put =
 * max(K−S,0), short put = −max(K−S,0), each scaled by quantity and summed. Net
 * premium is the up-front debit (Σ ±premium·qty, + for long), and profit =
 * payoff − net premium. Breakevens are sign-changes of the profit curve;
 * max gain / loss are taken over the plotted range, reporting "Unlimited" when
 * the curve is still rising (or falling) at the right edge.
 */
export function OptionPayoff({
  title = 'Option payoff at expiration',
  legs,
  spotMax,
  spotLabel = 'Underlying price at expiration',
  resultLabel = 'Profit / loss per share',
  payoffToggleLabel = 'Payoff',
  profitToggleLabel = 'Profit',
  breakevenLabel = 'Breakeven',
  maxGainLabel = 'Max gain',
  maxLossLabel = 'Max loss',
  unlimitedLabel = 'Unlimited',
  showProfit = true,
  caption,
  className,
}: OptionPayoffProps) {
  const id = useId();
  const [profitMode, setProfitMode] = useState(showProfit);

  const W = 520;
  const H = 260;
  const padX = 12;
  const padY = 18;

  const strikes = legs.map((l) => l.strike);
  const maxStrike = strikes.length > 0 ? Math.max(...strikes) : 50;
  const sMax = spotMax ?? Math.max(maxStrike * 2, 100);

  // Net premium = up-front debit (positive = you pay). Long pays, short receives.
  const netPremium = legs.reduce((sum, l) => {
    const qty = l.quantity ?? 1;
    return sum + (l.position === 'long' ? l.premium : -l.premium) * qty;
  }, 0);

  const totalPayoff = (s: number): number => legs.reduce((sum, l) => sum + legPayoff(l, s), 0);
  const valueAt = (s: number): number =>
    profitMode ? totalPayoff(s) - netPremium : totalPayoff(s);

  const SAMPLES = 120;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = (i / SAMPLES) * sMax;
    xs.push(s);
    ys.push(valueAt(s));
  }

  const vMax = Math.max(...ys, 0);
  const vMin = Math.min(...ys, 0);
  const span = vMax - vMin || 1;

  const px = (s: number) => padX + (s / sMax) * (W - padX * 2);
  const py = (v: number) => padY + (1 - (v - vMin) / span) * (H - padY * 2);

  const zeroY = py(0);

  // Curve polyline points.
  const points = xs.map((s, i) => `${px(s)},${py(ys[i])}`).join(' ');

  // Build closed fill paths split at the zero baseline (profit vs loss areas).
  // For each segment, clamp to the baseline so green sits above 0 and red below.
  const profitArea: string[] = [];
  const lossArea: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = px(xs[i]);
    const yVal = ys[i];
    profitArea.push(`${x},${py(Math.max(yVal, 0))}`);
    lossArea.push(`${x},${py(Math.min(yVal, 0))}`);
  }
  const profitFill = `M ${px(0)},${zeroY} L ${profitArea.join(' L ')} L ${px(sMax)},${zeroY} Z`;
  const lossFill = `M ${px(0)},${zeroY} L ${lossArea.join(' L ')} L ${px(sMax)},${zeroY} Z`;

  // Breakevens: sign changes of the plotted curve, interpolated linearly.
  const breakevens: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const y0 = ys[i - 1];
    const y1 = ys[i];
    if (y0 === 0) {
      breakevens.push(xs[i - 1]);
    } else if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) {
      const t = y0 / (y0 - y1);
      breakevens.push(xs[i - 1] + t * (xs[i] - xs[i - 1]));
    }
  }
  const breakevenList = breakevens.slice(0, 2);

  // Max gain / loss over the range, with unbounded detection at the right edge.
  const rawMax = Math.max(...ys);
  const rawMin = Math.min(...ys);
  const risingAtEnd = ys[ys.length - 1] > ys[ys.length - 2] + 1e-9;
  const fallingAtEnd = ys[ys.length - 1] < ys[ys.length - 2] - 1e-9;
  const maxGainText = risingAtEnd ? unlimitedLabel : fmt(rawMax);
  const maxLossText = fallingAtEnd ? unlimitedLabel : fmt(rawMin);

  const modeLabel = profitMode ? profitToggleLabel : payoffToggleLabel;
  const ariaLabel = `${title}. ${modeLabel} diagram across underlying prices from 0 to ${fmt(
    sMax,
  )}. ${maxGainLabel}: ${maxGainText}. ${maxLossLabel}: ${maxLossText}.${
    breakevenList.length > 0
      ? ` ${breakevenLabel}: ${breakevenList.map((b) => fmt(b)).join(', ')}.`
      : ''
  }`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        {/* Segmented toggle: Payoff vs Profit */}
        <div
          className="inline-flex rounded-pill border border-ink-100 bg-surface-sunken/40 p-1 text-sm"
          role="group"
          aria-label={`${payoffToggleLabel} / ${profitToggleLabel}`}
        >
          <button
            type="button"
            onClick={() => setProfitMode(false)}
            aria-pressed={!profitMode}
            className={cx(
              'rounded-pill px-3 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              !profitMode ? 'bg-brand-600 text-white' : 'text-ink-700',
            )}
          >
            {payoffToggleLabel}
          </button>
          <button
            type="button"
            onClick={() => setProfitMode(true)}
            aria-pressed={profitMode}
            className={cx(
              'rounded-pill px-3 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              profitMode ? 'bg-brand-600 text-white' : 'text-ink-700',
            )}
          >
            {profitToggleLabel}
          </button>
        </div>
      </figcaption>

      {/* Leg legend */}
      {legs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-700">
          {legs.map((l, i) => (
            <span
              key={`${id}-leg-${i}`}
              className="inline-flex items-center gap-2 rounded-pill border border-ink-100 px-2.5 py-1"
            >
              <span
                className={cx(
                  'h-2 w-2 rounded-pill',
                  l.position === 'long' ? 'bg-brand-500' : 'bg-accent-500',
                )}
                aria-hidden="true"
              />
              {l.label ?? `${l.position} ${l.type} ${fmt(l.strike)}`}
            </span>
          ))}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        {/* Loss area (below zero) */}
        <path d={lossFill} fill="var(--color-accent-500)" opacity={0.1} />
        {/* Profit area (above zero) */}
        <path d={profitFill} fill="var(--color-brand-500)" opacity={0.12} />

        {/* Strike guides */}
        {strikes.map((k, i) => (
          <line
            key={`${id}-strike-${i}`}
            x1={px(k)}
            y1={padY}
            x2={px(k)}
            y2={H - padY}
            stroke="var(--color-ink-200)"
            strokeDasharray="3 4"
          />
        ))}

        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Breakeven markers */}
        {breakevenList.map((b, i) => (
          <circle
            key={`${id}-be-${i}`}
            cx={px(b)}
            cy={zeroY}
            r={4}
            fill="var(--color-surface)"
            stroke="var(--color-ink-500)"
            strokeWidth={2}
          />
        ))}

        {/* Payoff / profit curve */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Axis labels */}
      <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
        <span>{resultLabel}</span>
        <span>{spotLabel}</span>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maxGainLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{maxGainText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maxLossLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{maxLossText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{breakevenLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {breakevenList.length > 0 ? breakevenList.map((b) => fmt(b)).join(' · ') : '—'}
          </dd>
        </div>
      </dl>

      {caption && <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>}
    </figure>
  );
}

export default OptionPayoff;
