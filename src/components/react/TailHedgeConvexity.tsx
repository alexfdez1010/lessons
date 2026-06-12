import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TailHedgeConvexityProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the combined hedged-portfolio curve. */
  hedgedLabel?: string;
  /** Legend label for the bare, unhedged-portfolio curve. */
  unhedgedLabel?: string;
  /** Legend label for the standalone tail-hedge payoff curve. */
  hedgeLabel?: string;
  /** X-axis label (the market move). */
  moveAxisLabel?: string;
  /** Y-axis label (portfolio P&L). */
  pnlLabel?: string;
  /** Toggle label: combined view vs. unhedged-only emphasis. */
  showHedgeLabel?: string;
  /** Toggle "on" state text. */
  onLabel?: string;
  /** Toggle "off" state text. */
  offLabel?: string;
  /** Explanation read out below the chart. */
  note?: string;
  /** Label for the premium-drag callout. */
  premiumDragLabel?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

// Model parameters for the tail hedge.
const PREMIUM = 2; // % drag paid every period to carry the puts
const STRIKE = -15; // deep-OTM put strike, expressed as a market move
const LEVERAGE = 3; // convex payoff slope below the strike

/** Standalone payoff of the OTM-put strip as a function of the market move. */
const hedgePayoff = (m: number): number =>
  m >= STRIKE ? -PREMIUM : -PREMIUM + LEVERAGE * (STRIKE - m);

/** Unhedged portfolio: beta 1, linear through the origin. */
const unhedgedPnl = (m: number): number => m;

/** Combined hedged P&L = unhedged + hedge. */
const hedgedPnl = (m: number): number => unhedgedPnl(m) + hedgePayoff(m);

const pct = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(0)}${suffix}`;

/**
 * Tail-hedge convexity. A strip of deep out-of-the-money puts (or any long-vol
 * position) costs a small, steady **premium** that quietly drags on returns in
 * calm markets — the flat `−2%` line that, most years, looks like wasted money.
 * But the payoff is **convex**: below the strike it explodes upward, exactly
 * when the unhedged portfolio is collapsing. The combined hedged curve
 * therefore tracks the market (minus the drag) on the upside, then **floors**
 * and even bends back up in a true tail, because the leveraged hedge can out-earn
 * the loss. The chart plots all three curves against the market move; the toggle
 * collapses to the bare unhedged line so learners can see what the hedge buys.
 * Region below the strike is shaded to mark where the hedge starts paying.
 */
export function TailHedgeConvexity({
  title = 'Tail hedging: paying a little to floor the crash',
  hedgedLabel = 'Hedged portfolio',
  unhedgedLabel = 'Unhedged portfolio',
  hedgeLabel = 'Tail hedge payoff (OTM puts)',
  moveAxisLabel = 'Market move',
  pnlLabel = 'Portfolio P&L',
  showHedgeLabel = 'Show hedge',
  onLabel = 'On',
  offLabel = 'Off',
  note = 'A tail hedge is insurance: deep out-of-the-money puts cost a steady premium that quietly drags on returns in calm markets (the flat −2% line), and most years that feels like wasted money. But the payoff is CONVEX — in a crash it explodes upward exactly when the portfolio is collapsing, flooring the loss and, in a true tail, even turning a profit. The cost of carrying the hedge is the price of that convexity; the hard part of tail hedging is financing the drag without bleeding out before the crash arrives.',
  premiumDragLabel = 'Premium drag in normal times',
  percentSuffix = '%',
  className,
}: TailHedgeConvexityProps) {
  const [showHedge, setShowHedge] = useState(true);

  const W = 540;
  const H = 300;
  const padX = 44;
  const padY = 24;

  // Axis domains.
  const minM = -40;
  const maxM = 20;
  const minV = -42;
  const maxV = 78;

  const x = (m: number) => padX + ((m - minM) / (maxM - minM)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  // Sample each curve across the move domain. The hedge curves are piecewise,
  // so we make sure the strike kink (m = −15) is one of the sampled points.
  const sampleMoves: number[] = [];
  for (let m = minM; m <= maxM + 0.0001; m += 1) sampleMoves.push(m);
  if (!sampleMoves.includes(STRIKE)) sampleMoves.push(STRIKE);
  sampleMoves.sort((a, b) => a - b);

  const buildPath = (fn: (m: number) => number): string =>
    sampleMoves
      .map(
        (m, i) =>
          `${i === 0 ? 'M' : 'L'} ${x(m).toFixed(1)} ${y(fn(m)).toFixed(1)}`,
      )
      .join(' ');

  const unhedgedPath = buildPath(unhedgedPnl);
  const hedgePath = buildPath(hedgePayoff);
  const hedgedPath = buildPath(hedgedPnl);

  // Reference levels for the callouts.
  const crashFloor = hedgedPnl(STRIKE); // worst case near the strike
  const extremeTail = hedgedPnl(minM); // a −40% crash with the convex hedge

  // X-axis ticks every 10%, Y-axis ticks every 20%.
  const xTicks = [-40, -30, -20, -10, 0, 10, 20];
  const yTicks = [-40, -20, 0, 20, 40, 60];

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
          className="inline-flex items-center gap-2 rounded-pill border border-ink-200 px-1 py-0.5"
          role="group"
        >
          <span className="pl-2 text-sm text-ink-600">{showHedgeLabel}</span>
          <button
            type="button"
            onClick={() => setShowHedge((s) => !s)}
            aria-pressed={showHedge}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              showHedge
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {showHedge ? onLabel : offLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: the unhedged portfolio falls linearly with the market, losing ${pct(unhedgedPnl(minM), percentSuffix)} in a ${minM}${percentSuffix} crash. The tail hedge pays a flat ${pct(-PREMIUM, percentSuffix)} premium drag above the ${STRIKE}${percentSuffix} strike but pays off convexly below it, so the combined hedged portfolio floors near ${pct(crashFloor, percentSuffix)} and bends back up to ${pct(extremeTail, percentSuffix)} in a ${minM}${percentSuffix} tail.`}
      >
        {/* Shaded region where the hedge is paying off (m < strike). */}
        <rect
          x={x(minM)}
          y={padY}
          width={x(STRIKE) - x(minM)}
          height={H - padY * 2}
          fill="var(--color-accent-500)"
          opacity={0.08}
        />
        <text
          x={(x(minM) + x(STRIKE)) / 2}
          y={padY + 12}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="var(--color-accent-600)"
        >
          hedge pays off
        </text>

        {/* Y grid + ticks. */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padX}
              y1={y(v)}
              x2={W - padX}
              y2={y(v)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padX - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--color-ink-400)"
            >
              {v > 0 ? '+' : ''}
              {v}
            </text>
          </g>
        ))}

        {/* Zero P&L line (x-axis). */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />
        {/* Zero move line (y-axis). */}
        <line
          x1={x(0)}
          y1={padY}
          x2={x(0)}
          y2={H - padY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {/* X ticks. */}
        {xTicks.map((m) => (
          <text
            key={`x-${m}`}
            x={x(m)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-ink-400)"
          >
            {m > 0 ? '+' : ''}
            {m}
          </text>
        ))}

        {/* Strike marker. */}
        <line
          x1={x(STRIKE)}
          y1={padY}
          x2={x(STRIKE)}
          y2={H - padY}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="3 3"
          className="transition-opacity duration-500 motion-reduce:transition-none"
          opacity={showHedge ? 0.7 : 0.2}
        />
        <text
          x={x(STRIKE)}
          y={H - padY + 14}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="var(--color-accent-600)"
          className="transition-opacity duration-500 motion-reduce:transition-none"
          opacity={showHedge ? 1 : 0.3}
        >
          strike {STRIKE}
          {percentSuffix}
        </text>

        {/* Unhedged portfolio — always visible; emphasised when hedge is off. */}
        <path
          d={unhedgedPath}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={showHedge ? 1.5 : 3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Standalone tail-hedge payoff. */}
        <path
          d={hedgePath}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-opacity duration-500 motion-reduce:transition-none"
          opacity={showHedge ? 0.9 : 0.12}
        />

        {/* Combined hedged portfolio — the headline curve. */}
        <path
          d={hedgedPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-opacity duration-500 motion-reduce:transition-none"
          opacity={showHedge ? 1 : 0.12}
        />

        {/* Premium-drag annotation on the flat part of the hedge line. */}
        <text
          x={x(8)}
          y={y(-PREMIUM) - 6}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="var(--color-accent-600)"
          className="transition-opacity duration-500 motion-reduce:transition-none"
          opacity={showHedge ? 1 : 0.2}
        >
          {pct(-PREMIUM, percentSuffix)} drag
        </text>

        {/* Axis labels. */}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {moveAxisLabel}
        </text>
        <text x={padX - 8} y={padY - 10} fontSize={11} fill="var(--color-ink-500)">
          {pnlLabel}
        </text>
      </svg>

      {/* Legend. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-brand-600)' }}
            aria-hidden="true"
          />
          {hedgedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-accent-600)' }}
            aria-hidden="true"
          />
          {hedgeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-ink-400)' }}
            aria-hidden="true"
          />
          {unhedgedLabel}
        </span>
      </div>

      {/* Drag + floor callout. */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {premiumDragLabel}:{' '}
          <span className="font-medium text-accent-600">
            {pct(-PREMIUM, percentSuffix)}
          </span>
        </span>
        <span className="text-ink-600">
          Crash floor near {STRIKE}
          {percentSuffix}:{' '}
          <span className="font-medium text-brand-600">
            {pct(crashFloor, percentSuffix)}
          </span>
        </span>
        <span className="text-ink-600">
          {minM}
          {percentSuffix} tail:{' '}
          <span className="font-medium text-brand-600">
            {pct(extremeTail, percentSuffix)}
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {note}
      </p>
    </figure>
  );
}

export default TailHedgeConvexity;
