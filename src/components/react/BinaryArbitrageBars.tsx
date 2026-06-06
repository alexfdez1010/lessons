import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BinaryArbitrageBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the YES-price slider. */
  yesPriceLabel?: string;
  /** Label for the NO-price slider. */
  noPriceLabel?: string;
  /** Label for the fee + gas slider. */
  feeLabel?: string;
  /** Readout label for the YES + NO sum. */
  sumLabel?: string;
  /** Readout label for the gap versus $1. */
  gapLabel?: string;
  /** Readout label for the arbitrage direction. */
  directionLabel?: string;
  /** Direction text when YES + NO < $1. */
  buyPairLabel?: string;
  /** Direction text when YES + NO > $1. */
  mintSellLabel?: string;
  /** Readout label for gross profit per set. */
  grossProfitLabel?: string;
  /** Readout label for net profit per set. */
  netProfitLabel?: string;
  /** Badge text shown when the mispricing is inside the fee band. */
  noArbLabel?: string;
  /** Caption for the $1.00 redemption reference line. */
  parLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial YES price in cents (1–99). Defaults to `60`. */
  yesPrice?: number;
  /** Initial NO price in cents (1–99). Defaults to `38`. */
  noPrice?: number;
  /** Initial fee + gas per set in cents. Defaults to `2`. */
  fee?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dollars = (value: number): string => usd.format(value);

/** Format a per-set amount, preferring a cents readout under a dollar. */
const cents = (value: number): string => {
  const c = Math.round(value * 100);
  if (Math.abs(c) < 100) return `${c}¢`;
  return usd.format(value);
};

const signedCents = (value: number): string => {
  const c = Math.round(value * 100);
  const sign = c > 0 ? '+' : c < 0 ? '−' : '';
  return `${sign}${Math.abs(c)}¢`;
};

/**
 * Interactive binary-market arbitrage visual. In a binary market a *complete
 * set* — one YES plus one NO — always redeems for exactly $1. So in a
 * frictionless market `YES_price + NO_price = $1`. When the two legs don't add
 * up there is arbitrage: if the sum is **below** $1 you buy both legs cheap and
 * redeem the pair for $1 (`gross = 1 − sum`); if it's **above** $1 you mint a
 * set for $1 and sell both legs (`gross = sum − 1`). A fee/gas slider then eats
 * the edge, so tiny mispricings collapse into a "no arbitrage" band. Drag the
 * sliders and the stacked bar, the $1 reference line, the gap, the direction and
 * the gross/net readouts update live. Respects `prefers-reduced-motion`.
 */
export function BinaryArbitrageBars({
  title = 'Binary arbitrage: when YES + NO ≠ $1',
  yesPriceLabel = 'YES price',
  noPriceLabel = 'NO price',
  feeLabel = 'Fee + gas per set',
  sumLabel = 'YES + NO',
  gapLabel = 'Gap vs $1',
  directionLabel = 'Arb direction',
  buyPairLabel = 'Buy the pair, redeem for $1',
  mintSellLabel = 'Mint a set, sell both',
  grossProfitLabel = 'Gross profit / set',
  netProfitLabel = 'Net profit / set (after fees)',
  noArbLabel = 'No arbitrage — inside the fee band',
  parLabel = '$1.00 redemption value',
  caption = 'A complete set always redeems for $1, so the two legs should add up to a dollar. They rarely do exactly — but once fees and gas are bigger than the gap, the mispricing is no longer worth touching.',
  yesPrice = 60,
  noPrice = 38,
  fee = 2,
  className,
}: BinaryArbitrageBarsProps) {
  const id = useId();
  const [yes, setYes] = useState(yesPrice);
  const [no, setNo] = useState(noPrice);
  const [feeCents, setFeeCents] = useState(fee);

  const reduced = prefersReducedMotion();
  const transition = reduced
    ? 'none'
    : 'height 0.35s ease, y 0.35s ease, opacity 0.35s ease';

  const sum = (yes + no) / 100; // dollars
  const gap = Math.abs(1 - sum);
  const isUnder = sum < 1;
  const isOver = sum > 1;
  const hasGap = !Number.isNaN(sum) && gap > 1e-9;

  const gross = hasGap ? gap : 0;
  const net = gross - feeCents / 100;
  const profitable = net > 1e-9;

  const directionText = isUnder
    ? buyPairLabel
    : isOver
      ? mintSellLabel
      : noArbLabel;

  // ── SVG geometry: a single vertical stacked bar against a $1 axis ──────────
  const W = 520;
  const H = 260;
  const padTop = 22;
  const padBottom = 30;
  const plotH = H - padTop - padBottom;
  const barX = 150;
  const barW = 96;
  // Vertical scale: top of the axis = $1.30 so an over-$1 bar still fits.
  const V_MAX = 1.3;
  const yOf = (value: number) =>
    padTop + (1 - Math.min(value, V_MAX) / V_MAX) * plotH;

  const yYes = (yes / 100) * 1; // dollars
  const yNo = (no / 100) * 1;

  const yesTopY = yOf(yYes);
  const yesBottomY = yOf(0);
  const yesH = Math.max(0, yesBottomY - yesTopY);

  const noTopY = yOf(sum);
  const noBottomY = yesTopY;
  const noH = Math.max(0, noBottomY - noTopY);

  const parY = yOf(1);
  const sumY = yOf(sum);

  const ariaLabel = !hasGap
    ? `${title}: YES at ${yes} cents plus NO at ${no} cents sum to exactly $1, so there is no arbitrage.`
    : `${title}: YES at ${yes} cents plus NO at ${no} cents sum to ${dollars(
        sum,
      )}, a ${Math.round(gap * 100)} cent gap versus the $1 redemption value. ${
        isUnder ? buyPairLabel : mintSellLabel
      } for a gross edge of ${Math.round(
        gross * 100,
      )} cents per set; after ${feeCents} cents of fees the net is ${signedCents(
        net,
      )} per set, which is ${profitable ? 'profitable' : 'not profitable'}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            profitable ? 'bg-brand-600' : 'bg-ink-500',
          )}
        >
          {profitable ? `${signedCents(net)} / set` : noArbLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-600" aria-hidden="true" />
          {yesPriceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-300" aria-hidden="true" />
          {noPriceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {parLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Axis ticks at $0.50 and $1.00 reference points */}
        {[0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1={barX - 18}
              y1={yOf(v)}
              x2={W - 16}
              y2={yOf(v)}
              stroke="var(--color-ink-200)"
              strokeDasharray={v === 1 ? undefined : '4 4'}
              strokeWidth={v === 1 ? 0 : 1}
            />
            <text
              x={barX - 24}
              y={yOf(v) + 4}
              textAnchor="end"
              fill="var(--color-ink-500)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {dollars(v)}
            </text>
          </g>
        ))}

        {/* Track outline for the bar */}
        <rect
          x={barX}
          y={padTop}
          width={barW}
          height={plotH}
          fill="var(--color-surface-sunken)"
          opacity={0.5}
          rx={6}
        />

        {/* NO segment (drawn first so YES sits visually on top of base) */}
        <rect
          x={barX}
          y={noTopY}
          width={barW}
          height={noH}
          fill="var(--color-brand-300)"
          style={{ transition }}
        />
        {/* YES segment */}
        <rect
          x={barX}
          y={yesTopY}
          width={barW}
          height={yesH}
          fill="var(--color-brand-600)"
          rx={0}
          style={{ transition }}
        />
        {/* Bar border */}
        <rect
          x={barX}
          y={Math.min(sumY, parY)}
          width={barW}
          height={Math.abs(yesBottomY - Math.min(sumY, parY))}
          fill="none"
          stroke="var(--color-ink-200)"
          rx={2}
        />

        {/* Segment labels */}
        {yesH > 16 && (
          <text
            x={barX + barW / 2}
            y={(yesTopY + yesBottomY) / 2 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="600"
            fontFamily="var(--font-mono)"
          >
            {yes}¢
          </text>
        )}
        {noH > 16 && (
          <text
            x={barX + barW / 2}
            y={(noTopY + noBottomY) / 2 + 4}
            textAnchor="middle"
            fill="var(--color-brand-800)"
            fontSize="12"
            fontWeight="600"
            fontFamily="var(--font-mono)"
          >
            {no}¢
          </text>
        )}

        {/* $1.00 redemption reference line */}
        <line
          x1={barX - 18}
          y1={parY}
          x2={W - 16}
          y2={parY}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
        />
        <text
          x={W - 16}
          y={parY - 6}
          textAnchor="end"
          fill="var(--color-accent-600)"
          fontSize="11"
          fontWeight="600"
          fontFamily="var(--font-sans)"
        >
          {parLabel}
        </text>

        {/* Top-of-stack (sum) marker line */}
        <line
          x1={barX}
          y1={sumY}
          x2={barX + barW}
          y2={sumY}
          stroke="var(--color-ink-700)"
          strokeWidth={1.5}
          style={{ transition: reduced ? 'none' : 'y1 0.35s ease, y2 0.35s ease' }}
        />
        <text
          x={barX + barW + 8}
          y={sumY + 4}
          fill="var(--color-ink-700)"
          fontSize="11"
          fontWeight="600"
          fontFamily="var(--font-mono)"
        >
          {sumLabel} = {dollars(sum)}
        </text>

        {/* Gap bracket between the sum line and the $1 line */}
        {hasGap && (
          <>
            <line
              x1={barX + barW + 56}
              y1={Math.min(sumY, parY)}
              x2={barX + barW + 56}
              y2={Math.max(sumY, parY)}
              stroke={
                profitable
                  ? 'var(--color-brand-500)'
                  : 'var(--color-ink-400)'
              }
              strokeWidth={1.5}
            />
            <text
              x={barX + barW + 62}
              y={(sumY + parY) / 2 + 4}
              fill={
                profitable ? 'var(--color-brand-700)' : 'var(--color-ink-500)'
              }
              fontSize="11"
              fontWeight="600"
              fontFamily="var(--font-mono)"
            >
              {isUnder ? '↓ ' : '↑ '}
              {Math.round(gap * 100)}¢
            </text>
          </>
        )}
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-yes`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yesPriceLabel}</span>
            <span className="font-mono text-ink-900">{yes}¢</span>
          </label>
          <input
            id={`${id}-yes`}
            type="range"
            min={1}
            max={99}
            step={1}
            value={yes}
            onChange={(e) => setYes(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-no`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{noPriceLabel}</span>
            <span className="font-mono text-ink-900">{no}¢</span>
          </label>
          <input
            id={`${id}-no`}
            type="range"
            min={1}
            max={99}
            step={1}
            value={no}
            onChange={(e) => setNo(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-fee`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{feeLabel}</span>
            <span className="font-mono text-ink-900">{feeCents}¢</span>
          </label>
          <input
            id={`${id}-fee`}
            type="range"
            min={0}
            max={20}
            step={1}
            value={feeCents}
            onChange={(e) => setFeeCents(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sumLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {dollars(sum)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {hasGap ? `${isUnder ? '−' : '+'}${Math.round(gap * 100)}¢` : '0¢'}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{grossProfitLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {cents(gross)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netProfitLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              profitable ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {signedCents(net)}
          </dd>
        </div>
      </dl>

      {/* Direction strip */}
      <div
        className={cx(
          'mt-4 flex items-center gap-3 rounded-card px-4 py-3 text-sm',
          profitable
            ? 'border border-brand-200 bg-brand-50 text-brand-800'
            : 'border border-ink-100 bg-surface-sunken/40 text-ink-600',
        )}
        aria-live="polite"
      >
        <span className="font-medium">{directionLabel}:</span>
        <span className="font-semibold">{directionText}</span>
        {profitable && hasGap && (
          <span className="font-mono text-brand-700">
            ({signedCents(net)} / set)
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BinaryArbitrageBars;
