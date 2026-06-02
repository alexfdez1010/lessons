import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PriceYieldSeesawProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the market-yield slider. */
  yieldLabel?: string;
  /** Label for the price readout. */
  priceLabel?: string;
  /** Label for the par reference line / par status. */
  parLabel?: string;
  /** Label for the premium region / status badge. */
  premiumLabel?: string;
  /** Label for the discount region / status badge. */
  discountLabel?: string;
  /** Label for the current-yield readout. */
  currentYieldLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Annual coupon rate as a fraction (e.g. 0.05 = 5%). Defaults to `0.05`. */
  couponRate?: number;
  /** Face (par) value of the bond. Defaults to `1000`. */
  faceValue?: number;
  /** Years to maturity. Defaults to `10`. */
  years?: number;
  /** Coupon payments per year. Defaults to `2`. */
  frequency?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const pct = (value: number, digits = 2): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;

/**
 * Price the bond as the present value of its coupons plus face value, all
 * discounted at the market yield. Returns the dirty/clean price per `faceValue`
 * of face. `y` and `couponRate` are annual fractions; payments occur `frequency`
 * times a year over `years` years.
 */
const bondPrice = (
  y: number,
  couponRate: number,
  faceValue: number,
  years: number,
  frequency: number,
): number => {
  const n = Math.round(years * frequency);
  const c = (couponRate * faceValue) / frequency; // coupon per period
  const r = y / frequency; // periodic yield
  if (r === 0) return c * n + faceValue;
  const annuity = (c * (1 - Math.pow(1 + r, -n))) / r;
  const principal = faceValue * Math.pow(1 + r, -n);
  return annuity + principal;
};

/**
 * Interactive price–yield seesaw. Plots the convex price-vs-yield curve for a
 * fixed-coupon bond: as the market yield rises the price of the existing bond
 * falls, and vice-versa. A draggable dot rides the curve at the chosen yield, a
 * dashed reference line marks par (100% of face), and the regions above/below
 * par are shaded as premium vs discount. Drag the yield slider and the dot,
 * readouts (price as % of par and in currency, status badge, current yield) and
 * intuition string update live; the curve animates in on mount. Respects
 * `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function PriceYieldSeesaw({
  title = 'The price–yield seesaw',
  yieldLabel = 'Market yield',
  priceLabel = 'Price',
  parLabel = 'Par',
  premiumLabel = 'Premium',
  discountLabel = 'Discount',
  currentYieldLabel = 'Current yield',
  caption = 'A bond pays fixed coupons. When market yields rise, buyers demand the same return from your bond — so its price must fall below par (a discount). When yields fall, your above-market coupons become valuable and the price climbs above par (a premium).',
  currencyPrefix = '$',
  couponRate = 0.05,
  faceValue = 1000,
  years = 10,
  frequency = 2,
  className,
}: PriceYieldSeesawProps) {
  const id = useId();
  // Yield expressed in basis-point-friendly integer percent * 10 (0.1% steps).
  const minYieldTenths = 0;
  const maxYieldTenths = 120; // 0% – 12%
  const [yieldTenths, setYieldTenths] = useState(
    Math.round(couponRate * 1000),
  );
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 14;
  const padY = 16;

  const yieldFrac = yieldTenths / 1000;
  const minYield = minYieldTenths / 1000;
  const maxYield = maxYieldTenths / 1000;

  // Price expressed as a percentage of par (e.g. 100 = par).
  const priceOfPar = (y: number) =>
    (bondPrice(y, couponRate, faceValue, years, frequency) / faceValue) * 100;

  const priceNow = priceOfPar(yieldFrac);
  const priceCurrency =
    (priceNow / 100) * faceValue;

  // Plot bounds from the curve's extremes across the swept yield range.
  const priceAtMin = priceOfPar(minYield);
  const priceAtMax = priceOfPar(maxYield);
  const maxP = Math.max(priceAtMin, 100) * 1.02;
  const minP = Math.min(priceAtMax, 100) * 0.98;

  const x = (y: number) =>
    padX + ((y - minYield) / (maxYield - minYield)) * (W - padX * 2);
  const yScale = (p: number) =>
    padY + (1 - (p - minP) / (maxP - minP)) * (H - padY * 2);

  const parY = yScale(100);
  const dotX = x(yieldFrac);
  const dotY = yScale(priceNow);

  // Smooth convex curve sampled finely, revealed left→right up to `progress`.
  const SAMPLES = 90;
  const curvePath = () => {
    const uptoYield = minYield + progress * (maxYield - minYield);
    let d = `M ${x(minYield)} ${yScale(priceOfPar(minYield))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const y = minYield + (i / SAMPLES) * (maxYield - minYield);
      if (y > uptoYield) {
        d += ` L ${x(uptoYield)} ${yScale(priceOfPar(uptoYield))}`;
        break;
      }
      d += ` L ${x(y)} ${yScale(priceOfPar(y))}`;
    }
    return d;
  };

  // Animate the curve drawing in whenever the bond terms change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [couponRate, faceValue, years, frequency]);

  const couponPct = couponRate * 100;
  // Status relative to par (small epsilon to call near-par "Par").
  const eps = 0.05;
  const status =
    priceNow > 100 + eps
      ? premiumLabel
      : priceNow < 100 - eps
        ? discountLabel
        : parLabel;
  const statusClass =
    status === premiumLabel
      ? 'bg-brand-600'
      : status === discountLabel
        ? 'bg-accent-500'
        : 'bg-ink-500';

  // Current yield = annual coupon / current price.
  const annualCoupon = couponRate * faceValue;
  const currentYield = (annualCoupon / priceCurrency) * 100;

  // "Your 5% bond vs new X% bonds" intuition string, built from labels.
  const yieldPctStr = pct(yieldFrac * 100, 1);
  const couponPctStr = pct(couponPct, couponPct % 1 === 0 ? 0 : 2);
  const intuition =
    status === premiumLabel
      ? `New bonds yield ${yieldPctStr} — below your ${couponPctStr} coupon — so your bond is worth more (${premiumLabel.toLowerCase()}).`
      : status === discountLabel
        ? `New bonds yield ${yieldPctStr} — above your ${couponPctStr} coupon — so your bond is worth less (${discountLabel.toLowerCase()}).`
        : `New bonds yield ${yieldPctStr}, matching your ${couponPctStr} coupon — so your bond trades at ${parLabel.toLowerCase()}.`;

  const adjust = (deltaTenths: number) =>
    setYieldTenths((v) =>
      Math.min(maxYieldTenths, Math.max(minYieldTenths, v + deltaTenths)),
    );

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
            statusClass,
          )}
        >
          {status}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {priceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill bg-ink-200"
            aria-hidden="true"
          />
          {parLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: at a market yield of ${yieldPctStr}, this ${couponPctStr}-coupon bond is priced at ${pct(
          priceNow,
        )} of par (${money(
          currencyPrefix,
          priceCurrency,
        )}), a ${status.toLowerCase()}.`}
      >
        {/* Premium region: above par line */}
        <rect
          x={padX}
          y={padY}
          width={W - padX * 2}
          height={Math.max(0, parY - padY)}
          fill="var(--color-brand-500)"
          opacity={0.06}
        />
        {/* Discount region: below par line */}
        <rect
          x={padX}
          y={parY}
          width={W - padX * 2}
          height={Math.max(0, H - padY - parY)}
          fill="var(--color-accent-500)"
          opacity={0.07}
        />
        {/* Par reference line (price = 100) */}
        <line
          x1={padX}
          y1={parY}
          x2={W - padX}
          y2={parY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={parY - 5}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {parLabel} · 100
        </text>
        {/* Region labels */}
        <text
          x={padX + 4}
          y={padY + 14}
          fontSize={11}
          fill="var(--color-brand-700)"
        >
          {premiumLabel}
        </text>
        <text
          x={padX + 4}
          y={H - padY - 6}
          fontSize={11}
          fill="var(--color-accent-500)"
        >
          {discountLabel}
        </text>
        {/* Price–yield curve, animated reveal */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Guide lines from the dot to the axes */}
        <line
          x1={dotX}
          y1={dotY}
          x2={dotX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />
        {/* Draggable dot on the curve */}
        <circle
          cx={dotX}
          cy={dotY}
          r={7}
          fill="var(--color-brand-600)"
          stroke="white"
          strokeWidth={2}
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-yield`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{yieldLabel}</span>
          <span className="font-mono text-ink-900">{yieldPctStr}</span>
        </label>
        <input
          id={`${id}-yield`}
          type="range"
          min={minYieldTenths}
          max={maxYieldTenths}
          step={1}
          value={yieldTenths}
          onChange={(e) => setYieldTenths(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              adjust(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              adjust(1);
            }
          }}
          aria-valuetext={yieldPctStr}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{priceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(priceNow)}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {money(currencyPrefix, priceCurrency)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{yieldLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {yieldPctStr}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{currentYieldLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(currentYield)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-700">{intuition}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PriceYieldSeesaw;
