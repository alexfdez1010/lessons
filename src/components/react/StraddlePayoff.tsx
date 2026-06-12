import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface StraddlePayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the straddle toggle button. */
  straddleLabel?: string;
  /** Label for the strangle toggle button. */
  strangleLabel?: string;
  /** Label for the x-axis (underlying price at expiry). */
  spotAxisLabel?: string;
  /** Label for the y-axis (profit / loss at expiry). */
  pnlLabel?: string;
  /** Word shown beside each break-even price marker. */
  breakevenLabel?: string;
  /** Label for the flat max-loss segment (premium paid). */
  premiumLabel?: string;
  /** Explanation shown for the straddle. */
  straddleNote?: string;
  /** Explanation shown for the strangle. */
  strangleNote?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

/** Strike both legs share (straddle) / the reference centre price. */
const K = 100;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)}`;

/**
 * Long straddle vs strangle payoff. Both are **direction-agnostic bets on
 * volatility**: you buy a call AND a put, so the position gains whether the
 * underlying rockets up or craters down — what you need is a *large* move, not
 * a particular direction. A **straddle** buys both legs at the same strike
 * (here 100) for a combined premium of 10, giving a V-shaped payoff that bottoms
 * out at −10 with break-evens at 90 and 110. A **strangle** buys
 * out-of-the-money legs at split strikes (call 110, put 90) for a cheaper
 * premium of 6, giving a flat-bottomed payoff (−6 across 90..110) that needs an
 * even bigger move to pay off (break-evens 84 and 116). Toggling re-keys the
 * payoff path so it animates between the two shapes; the profit region is shaded
 * in brand colour and the loss region in accent colour, both at low opacity.
 */
export function StraddlePayoff({
  title = 'Long straddle vs strangle: betting on a big move either way',
  straddleLabel = 'Straddle (same strike)',
  strangleLabel = 'Strangle (split strikes)',
  spotAxisLabel = 'Underlying price at expiry',
  pnlLabel = 'Profit / loss at expiry',
  breakevenLabel = 'Break-even',
  premiumLabel = 'Premium paid (max loss)',
  straddleNote = 'A long straddle buys a call AND a put at the SAME strike, so its value rises whether the stock rockets up or craters down — it is a pure bet that the move will be LARGE, not that it will go a particular way. You pay two premiums up front, so you only profit if the realized move exceeds the combined premium (here a move beyond ±10 from the strike). Sit still and you lose the whole premium — long straddles are long vega and short theta: they bleed time value every day nothing happens.',
  strangleNote = 'A strangle buys out-of-the-money options at SPLIT strikes (call above, put below), so it is cheaper than a straddle but needs an even BIGGER move to pay off (break-evens are further out). Same idea — a direction-agnostic long-volatility bet — but with lower cost and lower probability of finishing in profit.',
  currencyPrefix = '$',
  className,
}: StraddlePayoffProps) {
  const [mode, setMode] = useState<'straddle' | 'strangle'>('straddle');

  // --- Strategy definitions -------------------------------------------------
  // Straddle: long call @100 + long put @100, combined premium 10.
  // Strangle: long call @110 + long put @90, combined premium 6.
  const straddle = {
    callStrike: K,
    putStrike: K,
    premium: 10,
    breakevens: [K - 10, K + 10] as const, // 90, 110
  };
  const strangle = {
    callStrike: K + 10, // 110
    putStrike: K - 10, // 90
    premium: 6,
    breakevens: [K - 16, K + 16] as const, // 84, 116
  };
  const cfg = mode === 'straddle' ? straddle : strangle;

  const payoff = (s: number) =>
    Math.max(s - cfg.callStrike, 0) +
    Math.max(cfg.putStrike - s, 0) -
    cfg.premium;

  // --- Geometry -------------------------------------------------------------
  const W = 520;
  const H = 260;
  const padX = 40;
  const padY = 26;
  const minS = 60;
  const maxS = 140;
  const minP = -14;
  const maxP = 32;

  const x = (s: number) => padX + ((s - minS) / (maxS - minS)) * (W - padX * 2);
  const y = (p: number) =>
    padY + (1 - (p - minP) / (maxP - minP)) * (H - padY * 2);

  // Sample the payoff densely so the kinks land cleanly.
  const samples: number[] = [];
  for (let s = minS; s <= maxS + 0.001; s += 1) samples.push(s);

  const line = samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(payoff(s)).toFixed(1)}`)
    .join(' ');

  const zeroY = y(0);

  // Profit fill: payoff curve clipped above the zero line. Close it along zero.
  const profitArea =
    samples
      .map((s, i) => {
        const p = Math.max(payoff(s), 0);
        return `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(p).toFixed(1)}`;
      })
      .join(' ') + ` L ${x(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${x(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  // Loss fill: payoff curve clipped below zero (the trough), closed along zero.
  const lossArea =
    samples
      .map((s, i) => {
        const p = Math.min(payoff(s), 0);
        return `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(p).toFixed(1)}`;
      })
      .join(' ') + ` L ${x(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${x(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const stroke =
    mode === 'straddle' ? 'var(--color-accent-500)' : 'var(--color-brand-500)';

  const sTicks = [60, 80, 100, 120, 140];

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
            onClick={() => setMode('straddle')}
            aria-pressed={mode === 'straddle'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'straddle'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {straddleLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('strangle')}
            aria-pressed={mode === 'strangle'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'strangle'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {strangleLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: a long ${
          mode === 'straddle' ? straddleLabel : strangleLabel
        } costing ${money(currencyPrefix, cfg.premium)} in premium. The payoff is negative (a loss of the premium) for small moves around the strike of ${money(
          currencyPrefix,
          K,
        )}, and turns profitable once the underlying moves below ${money(
          currencyPrefix,
          cfg.breakevens[0],
        )} or above ${money(currencyPrefix, cfg.breakevens[1])} at expiry.`}
      >
        {/* Shaded loss region (below zero) */}
        <path
          key={`loss-${mode}`}
          d={lossArea}
          fill="var(--color-accent-500)"
          fillOpacity={0.12}
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        {/* Shaded profit region (above zero) */}
        <path
          key={`profit-${mode}`}
          d={profitArea}
          fill="var(--color-brand-500)"
          fillOpacity={0.12}
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Zero P&L axis line */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />
        <text
          x={padX}
          y={zeroY - 5}
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          0
        </text>

        {/* Strike reference line at K */}
        <line
          x1={x(K)}
          y1={padY}
          x2={x(K)}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={x(K)}
          y={padY - 4}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          {money(currencyPrefix, K)}
        </text>

        {/* Payoff curve. Re-keyed on mode so the transition restarts. */}
        <path
          key={`curve-${mode}`}
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Flat max-loss segment marker (premium paid) */}
        <line
          key={`maxloss-${mode}`}
          x1={x(cfg.putStrike)}
          y1={y(-cfg.premium)}
          x2={x(cfg.callStrike)}
          y2={y(-cfg.premium)}
          stroke="var(--color-accent-600)"
          strokeWidth={4}
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        <text
          key={`maxloss-label-${mode}`}
          x={(x(cfg.putStrike) + x(cfg.callStrike)) / 2}
          y={y(-cfg.premium) + 16}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
          className="transition-all duration-500 motion-reduce:transition-none"
        >
          {premiumLabel}: −{money(currencyPrefix, cfg.premium)}
        </text>

        {/* Break-even markers */}
        {cfg.breakevens.map((be, i) => (
          <g
            key={`be-${mode}-${i}`}
            className="transition-all duration-500 motion-reduce:transition-none"
          >
            <circle
              cx={x(be)}
              cy={zeroY}
              r={5}
              fill="var(--color-brand-600)"
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={x(be)}
              y={zeroY - 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--color-brand-700)"
            >
              {breakevenLabel} {money(currencyPrefix, be)}
            </text>
          </g>
        ))}

        {/* Underlying-price ticks */}
        {sTicks.map((s) => (
          <text
            key={s}
            x={x(s)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {money(currencyPrefix, s)}
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
          {spotAxisLabel}
        </text>
        <text x={padX - 8} y={padY - 12} fontSize={11} fill="var(--color-ink-500)">
          {pnlLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {breakevenLabel}:{' '}
          <span className="font-medium text-brand-600">
            {money(currencyPrefix, cfg.breakevens[0])}
          </span>{' '}
          /{' '}
          <span className="font-medium text-brand-600">
            {money(currencyPrefix, cfg.breakevens[1])}
          </span>
        </span>
        <span className="text-ink-600">
          {premiumLabel}:{' '}
          <span className="font-medium text-accent-600">
            −{money(currencyPrefix, cfg.premium)}
          </span>
        </span>
      </div>

      <p
        className="mt-2 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {mode === 'straddle' ? straddleNote : strangleNote}
      </p>
    </figure>
  );
}

export default StraddlePayoff;
