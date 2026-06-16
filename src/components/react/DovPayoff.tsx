import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DovPayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the covered-call toggle button. */
  callLabel?: string;
  /** Label for the cash-secured-put toggle button. */
  putLabel?: string;
  /** Label for the strike-distance slider. */
  strikeLabel?: string;
  /** Label for the x-axis (underlying price at expiry). */
  spotAxisLabel?: string;
  /** Label for the y-axis (vault profit / loss). */
  pnlLabel?: string;
  /** Word shown beside the premium-collected stat. */
  premiumStatLabel?: string;
  /** Word shown beside the capped-upside stat. */
  capStatLabel?: string;
  /** Word shown beside the break-even stat. */
  breakevenLabel?: string;
  /** Explanation shown for the covered-call vault. */
  callNote?: string;
  /** Explanation shown for the cash-secured-put vault. */
  putNote?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

/** Reference spot price the vault opens against. */
const S0 = 100;

const money = (prefix: string, value: number): string =>
  `${value < 0 ? '−' : ''}${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`;

/**
 * DeFi option vault (DOV) payoff. A covered-call vault holds the underlying and
 * **sells** an out-of-the-money call each epoch; a cash-secured-put vault holds
 * stablecoins and **sells** an out-of-the-money put. Either way the vault is
 * **short an option for premium income** — so its payoff is the classic
 * short-vol shape: a little extra yield in calm markets, a hard cap on the
 * upside (covered call) or a forced buy on the way down (cash-secured put), and
 * the full downside of the asset underneath. The strike-distance slider trades
 * premium for room: pull the strike closer to spot and the premium grows but the
 * cap tightens; push it further out and you collect less but keep more upside.
 * Premium falls as the strike moves further out of the money (`10·e^(−d/15)`),
 * exactly as an options market prices it. The payoff path re-keys on every
 * change so it animates, with profit shaded in brand and loss in accent.
 */
export function DovPayoff({
  title = 'DeFi option vault payoff: selling volatility for yield',
  callLabel = 'Covered-call vault',
  putLabel = 'Cash-secured-put vault',
  strikeLabel = 'Strike distance from spot',
  spotAxisLabel = 'Underlying price at expiry',
  pnlLabel = 'Vault profit / loss',
  premiumStatLabel = 'Premium collected',
  capStatLabel = 'Max profit (capped)',
  breakevenLabel = 'Break-even',
  callNote = 'A covered-call vault is LONG the asset and SHORT a call above spot. Below the strike it just rides the asset (plus the premium cushion); above the strike the short call eats every extra dollar, so the upside is capped. You are paid the premium to surrender the rally. Move the strike closer to collect more premium but cap sooner; move it further out for more upside but less income.',
  putNote = 'A cash-secured-put vault holds stablecoins and is SHORT a put below spot. Above the strike you simply keep the premium (a flat yield). Below the strike you are assigned — forced to buy the asset at the strike — so you eat the full drawdown minus the premium, exactly like owning the asset from the strike down. It is selling crash insurance for income.',
  currencyPrefix = '$',
  className,
}: DovPayoffProps) {
  const [mode, setMode] = useState<'call' | 'put'>('call');
  const [dist, setDist] = useState(8);

  // Option premium shrinks as the strike moves further out of the money.
  const premium = Math.round(10 * Math.exp(-dist / 15) * 10) / 10;
  const Kc = S0 + dist; // covered-call strike (above spot)
  const Kp = S0 - dist; // cash-secured-put strike (below spot)

  const payoff = (s: number) => {
    if (mode === 'call') {
      // Long spot + premium − short call payoff.
      return s - S0 + premium - Math.max(s - Kc, 0);
    }
    // Cash-secured put: premium − short put payoff.
    return premium - Math.max(Kp - s, 0);
  };

  // Headline stats.
  const maxProfit = mode === 'call' ? Kc - S0 + premium : premium;
  const breakeven = mode === 'call' ? S0 - premium : Kp - premium;

  // --- Geometry -------------------------------------------------------------
  const W = 520;
  const H = 260;
  const padX = 42;
  const padY = 26;
  const minS = 60;
  const maxS = 140;
  const minP = -42;
  const maxP = 28;

  const x = (s: number) => padX + ((s - minS) / (maxS - minS)) * (W - padX * 2);
  const y = (p: number) =>
    padY + (1 - (p - minP) / (maxP - minP)) * (H - padY * 2);

  const samples: number[] = [];
  for (let s = minS; s <= maxS + 0.001; s += 1) samples.push(s);

  const line = samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(payoff(s)).toFixed(1)}`)
    .join(' ');

  const zeroY = y(0);

  const profitArea =
    samples
      .map((s, i) => {
        const p = Math.max(payoff(s), 0);
        return `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(p).toFixed(1)}`;
      })
      .join(' ') +
    ` L ${x(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${x(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const lossArea =
    samples
      .map((s, i) => {
        const p = Math.min(payoff(s), 0);
        return `${i === 0 ? 'M' : 'L'} ${x(s).toFixed(1)} ${y(p).toFixed(1)}`;
      })
      .join(' ') +
    ` L ${x(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${x(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const stroke =
    mode === 'call' ? 'var(--color-brand-500)' : 'var(--color-accent-500)';
  const strike = mode === 'call' ? Kc : Kp;

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
        <div className="inline-flex rounded-pill border border-ink-200 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setMode('call')}
            aria-pressed={mode === 'call'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'call'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {callLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('put')}
            aria-pressed={mode === 'put'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'put'
                ? 'bg-accent-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {putLabel}
          </button>
        </div>
      </figcaption>

      <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-600">
        <span className="min-w-[12rem]">
          {strikeLabel}:{' '}
          <span className="font-medium text-ink-900">±{dist}</span>{' '}
          (strike {money(currencyPrefix, strike)})
        </span>
        <input
          type="range"
          min={4}
          max={20}
          step={1}
          value={dist}
          onChange={(e) => setDist(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-brand-600"
          aria-label={strikeLabel}
        />
      </label>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a ${
          mode === 'call' ? callLabel : putLabel
        } that collects ${money(currencyPrefix, premium)} of premium with its strike at ${money(
          currencyPrefix,
          strike,
        )}. ${
          mode === 'call'
            ? `The upside is capped at ${money(currencyPrefix, maxProfit)} once the price rises past the strike, while the full asset downside remains below.`
            : `Above the strike the vault keeps the ${money(currencyPrefix, premium)} premium, but below the strike it is assigned the asset and takes the full drawdown.`
        }`}
      >
        <path
          key={`loss-${mode}-${dist}`}
          d={lossArea}
          fill="var(--color-accent-500)"
          fillOpacity={0.12}
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        <path
          key={`profit-${mode}-${dist}`}
          d={profitArea}
          fill="var(--color-brand-500)"
          fillOpacity={0.12}
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Zero P&L axis */}
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="var(--color-ink-300)" strokeWidth={1.5} />
        <text x={padX} y={zeroY - 5} fontSize={10} fill="var(--color-ink-500)">
          0
        </text>

        {/* Spot reference line */}
        <line
          x1={x(S0)}
          y1={padY}
          x2={x(S0)}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={x(S0)} y={padY - 4} textAnchor="middle" fontSize={10} fill="var(--color-ink-500)">
          spot {money(currencyPrefix, S0)}
        </text>

        {/* Strike reference line */}
        <line
          key={`strikeline-${mode}-${dist}`}
          x1={x(strike)}
          y1={padY}
          x2={x(strike)}
          y2={H - padY}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="2 3"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Payoff curve */}
        <path
          key={`curve-${mode}-${dist}`}
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Break-even marker */}
        <g key={`be-${mode}-${dist}`} className="transition-all duration-500 motion-reduce:transition-none">
          <circle cx={x(breakeven)} cy={zeroY} r={5} fill="var(--color-ink-700)" stroke="white" strokeWidth={1.5} />
          <text x={x(breakeven)} y={zeroY + 16} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-ink-700)">
            {breakevenLabel} {money(currencyPrefix, breakeven)}
          </text>
        </g>

        {/* Underlying-price ticks */}
        {sTicks.map((s) => (
          <text key={s} x={x(s)} y={H - padY + 14} textAnchor="middle" fontSize={10} fill="var(--color-ink-500)">
            {money(currencyPrefix, s)}
          </text>
        ))}

        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} fill="var(--color-ink-500)">
          {spotAxisLabel}
        </text>
        <text x={padX - 10} y={padY - 12} fontSize={11} fill="var(--color-ink-500)">
          {pnlLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {premiumStatLabel}:{' '}
          <span className="font-medium text-brand-600">{money(currencyPrefix, premium)}</span>
        </span>
        <span className="text-ink-600">
          {capStatLabel}:{' '}
          <span className="font-medium text-brand-700">
            {mode === 'call' ? money(currencyPrefix, maxProfit) : `${money(currencyPrefix, premium)} (flat)`}
          </span>
        </span>
        <span className="text-ink-600">
          {breakevenLabel}:{' '}
          <span className="font-medium text-ink-800">{money(currencyPrefix, breakeven)}</span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {mode === 'call' ? callNote : putNote}
      </p>
    </figure>
  );
}

export default DovPayoff;
