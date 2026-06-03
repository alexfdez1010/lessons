import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PegArbitrageProps {
  /** Heading above the gauge. */
  title?: string;
  /** Label for the price slider. */
  sliderLabel?: string;
  /** Label for the market-price readout. */
  marketPriceLabel?: string;
  /** Label for the distance-from-peg readout. */
  distanceLabel?: string;
  /** Label for the profit-per-coin readout. */
  profitLabel?: string;
  /** Status heading shown when the price sits above the $1 peg. */
  aboveStatus?: string;
  /** Arbitrage action description shown when price is above peg. */
  aboveAction?: string;
  /** Status heading shown when the price sits below the $1 peg. */
  belowStatus?: string;
  /** Arbitrage action description shown when price is below peg. */
  belowAction?: string;
  /** Status text shown when the price is at (or extremely near) the peg. */
  atPegStatus?: string;
  /** Action / rest text shown when the price is at the peg. */
  atPegAction?: string;
  /** Badge text when the price is at rest on the peg. */
  atPegBadge?: string;
  /** Badge text when the price is off the peg (mispriced). */
  offPegBadge?: string;
  /** Label for the "let arbitrage act" button. */
  arbitrageButtonLabel?: string;
  /** One-line takeaway shown under the gauge. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Peg target the coin is redeemable for. Defaults to `1`. */
  peg?: number;
  /** Lowest price the gauge / slider reaches. Defaults to `0.94`. */
  min?: number;
  /** Highest price the gauge / slider reaches. Defaults to `1.06`. */
  max?: number;
  /** Slider step. Defaults to `0.005`. */
  step?: number;
  /** Initial market price. Defaults to `1.02`. */
  price?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string =>
  `${value < 0 ? '-' : ''}${prefix}${Math.abs(value).toFixed(digits)}`;

/**
 * Interactive peg-arbitrage explainer. A fiat-backed stablecoin is redeemable
 * 1:1 with its issuer ($1 of coin ⇄ $1 cash), and arbitrage drags the
 * secondary-market price back to that peg. The learner drags a slider to set
 * the current market price along a number line centered on $1.00; a status
 * panel spells out the risk-free trade arbitrageurs run (mint-and-sell above
 * peg, buy-and-redeem below peg), which direction it pushes the price, and the
 * profit per coin. The "let arbitrage act" button drifts the marker back to the
 * peg over ~1s to make the restoring force visceral. `prefers-reduced-motion`
 * snaps to the target instead of tweening. Locale-agnostic via props.
 */
export function PegArbitrage({
  title = 'How arbitrage holds the peg',
  sliderLabel = 'Market price',
  marketPriceLabel = 'Market price',
  distanceLabel = 'Distance from peg',
  profitLabel = 'Profit per coin',
  aboveStatus = 'Above the peg — coin is too expensive',
  aboveAction =
    'Arbitrageurs hand the issuer $1 cash, mint 1 fresh coin, and sell it on the market for more than $1. The new supply they dump pushes the price down toward $1.',
  belowStatus = 'Below the peg — coin is too cheap',
  belowAction =
    'Arbitrageurs buy the cheap coin on the market, then redeem it with the issuer for a full $1 cash. Their buying pressure pushes the price up toward $1.',
  atPegStatus = 'At the peg — system at rest',
  atPegAction =
    'Price equals the redemption value, so there is no risk-free profit to chase. Arbitrageurs stand down and the coin sits at $1.',
  atPegBadge = 'At peg',
  offPegBadge = 'Mispriced',
  arbitrageButtonLabel = 'Let arbitrage act',
  caption =
    'Because every coin is redeemable for exactly $1 with the issuer, any gap between the market price and $1 is free money — and the traders who grab it drag the price right back to the peg.',
  currencyPrefix = '$',
  peg = 1,
  min = 0.94,
  max = 1.06,
  step = 0.005,
  price = 1.02,
  className,
}: PegArbitrageProps) {
  const id = useId();
  const clampInit = Math.min(max, Math.max(min, price));
  const [priceState, setPriceState] = useState(clampInit);
  // Animated price the marker renders against.
  const [shownPrice, setShownPrice] = useState(clampInit);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 86;
  const padX = 24;
  const lineY = 34;
  const trackW = W - padX * 2;

  // Anything inside this band counts as "at peg" (one slider step of slack).
  const atPegTol = step / 2;
  const distance = priceState - peg;
  const above = distance > atPegTol;
  const below = distance < -atPegTol;
  const atPeg = !above && !below;
  const profit = Math.abs(distance);

  const toX = (p: number): number => padX + ((p - min) / (max - min)) * trackW;
  const pegX = toX(peg);
  const markerX = toX(shownPrice);

  // Animate the marker toward the new price whenever the set price changes.
  useEffect(() => {
    const target = priceState;
    if (prefersReducedMotion()) {
      setShownPrice(target);
      return;
    }
    const start = shownPrice;
    const delta = target - start;
    if (Math.abs(delta) < 0.0005) {
      setShownPrice(target);
      return;
    }
    const duration = 420;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownPrice(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownPrice intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceState]);

  // Drift the price all the way back to the peg, the way real arbitrage would.
  const runArbitrage = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion()) {
      setPriceState(peg);
      setShownPrice(peg);
      return;
    }
    const start = priceState;
    const delta = peg - start;
    if (Math.abs(delta) < 0.0005) {
      setPriceState(peg);
      setShownPrice(peg);
      return;
    }
    const duration = 1000;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const next = start + delta * eased;
      setPriceState(next);
      setShownPrice(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      } else {
        setPriceState(peg);
        setShownPrice(peg);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
  };

  const statusHeading = atPeg ? atPegStatus : above ? aboveStatus : belowStatus;
  const statusAction = atPeg ? atPegAction : above ? aboveAction : belowAction;

  const markerColor = atPeg
    ? 'var(--color-success)'
    : above
      ? 'var(--color-accent-500)'
      : 'var(--color-warning)';

  const panelClass = atPeg
    ? 'border-success/40 bg-success/10'
    : above
      ? 'border-accent-300 bg-accent-50'
      : 'border-warning/40 bg-warning/10';

  const headingClass = atPeg
    ? 'text-success'
    : above
      ? 'text-accent-700'
      : 'text-warning';

  const distanceClass = atPeg
    ? 'text-success'
    : above
      ? 'text-accent-700'
      : 'text-warning';

  // Built only from localized props so screen readers get the active locale.
  const ariaLabel = atPeg
    ? `${title}. ${marketPriceLabel}: ${money(currencyPrefix, priceState)} (${money(
        currencyPrefix,
        peg,
      )}). ${atPegStatus}.`
    : `${title}. ${marketPriceLabel}: ${money(currencyPrefix, priceState)}. ${profitLabel}: ${money(
        currencyPrefix,
        profit,
      )}. ${statusHeading}.`;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            atPeg ? 'bg-brand-600' : above ? 'bg-accent-600' : 'bg-warning',
          )}
        >
          {atPeg ? atPegBadge : offPegBadge}
        </span>
      </figcaption>

      {/* Number line */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        {/* Track */}
        <rect
          x={padX}
          y={lineY - 3}
          width={trackW}
          height={6}
          rx={3}
          fill="var(--color-ink-100)"
        />

        {/* Peg tick at $1.00 */}
        <line
          x1={pegX}
          y1={lineY - 16}
          x2={pegX}
          y2={lineY + 16}
          stroke="var(--color-success)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <text
          x={pegX}
          y={lineY - 20}
          textAnchor="middle"
          fontSize="11"
          fontWeight={600}
          fill="var(--color-success)"
        >
          {money(currencyPrefix, peg)}
        </text>

        {/* End scale labels */}
        <text x={padX} y={H - 6} fontSize="10" fill="var(--color-ink-400)">
          {money(currencyPrefix, min)}
        </text>
        <text x={W - padX} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          {money(currencyPrefix, max)}
        </text>

        {/* Direction arrow showing where arbitrage pushes the price */}
        {!atPeg && (
          <line
            x1={markerX}
            y1={lineY}
            x2={pegX}
            y2={lineY}
            stroke={markerColor}
            strokeWidth={2}
            strokeDasharray="3 4"
            opacity={0.7}
          />
        )}

        {/* Current-price marker */}
        <g>
          <line
            x1={markerX}
            y1={lineY - 13}
            x2={markerX}
            y2={lineY + 13}
            stroke={markerColor}
            strokeWidth={2}
          />
          <circle cx={markerX} cy={lineY} r={7} fill={markerColor} />
          <text
            x={markerX}
            y={lineY + 30}
            textAnchor="middle"
            fontSize="11"
            fontWeight={600}
            className="font-mono"
            fill="var(--color-ink-900)"
          >
            {money(currencyPrefix, shownPrice)}
          </text>
        </g>
      </svg>

      {/* Slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-price`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sliderLabel}</span>
          <span className="font-mono text-ink-900">{money(currencyPrefix, priceState)}</span>
        </label>
        <input
          id={`${id}-price`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={priceState}
          onChange={(e) => setPriceState(Number(e.target.value))}
          aria-label={sliderLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{marketPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, priceState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{distanceLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', distanceClass)}>
            {atPeg ? money(currencyPrefix, 0) : `${distance > 0 ? '+' : '-'}${money(currencyPrefix, profit)}`}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{profitLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', atPeg ? 'text-ink-900' : 'text-brand-700')}>
            {money(currencyPrefix, profit)}
          </dd>
        </div>
      </dl>

      {/* Status panel */}
      <div className={cx('mt-4 rounded-card border px-4 py-3', panelClass)} aria-live="polite">
        <p className={cx('text-sm font-semibold', headingClass)}>{statusHeading}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{statusAction}</p>
      </div>

      {/* Restoring-force button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={runArbitrage}
          disabled={atPeg}
          className={cx(
            'rounded-pill px-4 py-2 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            atPeg
              ? 'cursor-not-allowed bg-ink-300'
              : 'bg-brand-600 hover:bg-brand-700',
          )}
        >
          ▶ {arbitrageButtonLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PegArbitrage;
