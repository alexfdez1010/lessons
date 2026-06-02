import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BondCashflowsProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the coupon bars. */
  couponLabel?: string;
  /** Legend label for the face-value (principal) repayment. */
  principalLabel?: string;
  /** Label for the coupon-rate slider. */
  couponRateLabel?: string;
  /** Label for the years (maturity) slider. */
  yearsLabel?: string;
  /** Label for the payment-frequency toggle. */
  frequencyLabel?: string;
  /** Label for the per-period coupon readout. */
  perCouponLabel?: string;
  /** Label for the total-interest-received readout. */
  totalInterestLabel?: string;
  /** Label for the final maturity-payment readout. */
  maturityPaymentLabel?: string;
  /** Text for the annual-frequency option. */
  annualLabel?: string;
  /** Text for the semiannual-frequency option. */
  semiannualLabel?: string;
  /** Label for the number-of-payments readout. */
  paymentsLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Bond face (par) value repaid at maturity. Defaults to `1000`. */
  faceValue?: number;
  /** Initial annual coupon rate as a fraction (0–0.10). Defaults to `0.05`. */
  couponRate?: number;
  /** Initial number of years to maturity (1–10). Defaults to `5`. */
  years?: number;
  /** Initial payments per year (1 = annual, 2 = semiannual). Defaults to `1`. */
  frequency?: 1 | 2;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;

/**
 * Interactive bond cash-flow chart. A bond pays small periodic *coupons* over
 * its life plus one big *face-value* repayment at maturity — this draws that on
 * a horizontal time axis so a beginner literally *sees* the income stream. Each
 * coupon date gets a short brand-coloured bar; the final period stacks that
 * coupon on top of a much taller accent-coloured principal bar. Drag the
 * coupon-rate and years sliders or flip annual/semiannual and the bars plus the
 * readouts recompute live; bars rise left-to-right on mount. Respects
 * `prefers-reduced-motion` (jumps straight to the final state).
 */
export function BondCashflows({
  title = "A bond's cash flows",
  couponLabel = 'Coupon',
  principalLabel = 'Face value',
  couponRateLabel = 'Coupon rate',
  yearsLabel = 'Years to maturity',
  frequencyLabel = 'Payments per year',
  perCouponLabel = 'Coupon per payment',
  totalInterestLabel = 'Total interest received',
  maturityPaymentLabel = 'Final payment at maturity',
  annualLabel = 'Annual',
  semiannualLabel = 'Semiannual',
  paymentsLabel = 'Number of payments',
  caption = 'A bond drips small coupons along the way, then hands back the whole face value at maturity — that last bar is a coupon stacked on top of your principal coming home.',
  currencyPrefix = '$',
  faceValue = 1000,
  couponRate = 0.05,
  years = 5,
  frequency = 1,
  className,
}: BondCashflowsProps) {
  const id = useId();
  const [rateState, setRateState] = useState(couponRate);
  const [yearsState, setYearsState] = useState(years);
  const [freqState, setFreqState] = useState<1 | 2>(frequency);
  const [progress, setProgress] = useState(1); // 0 → 1 (bars rise-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 14;
  const padTop = 14;
  const padBottom = 26; // room for the baseline + axis ticks

  const coupon = (faceValue * rateState) / freqState;
  const nPayments = yearsState * freqState;
  const totalInterest = coupon * nPayments;
  const maturityPayment = coupon + faceValue;
  const ratePct = Math.round(rateState * 100);

  // Tallest bar is the final coupon + face value; scale everything to it.
  const maxV = Math.max(maturityPayment, 1);
  const baselineY = H - padBottom;
  const chartH = baselineY - padTop;
  const barH = (v: number) => (v / maxV) * chartH;

  // One bar per payment, evenly spaced across the axis.
  const slots = nPayments;
  const slotW = (W - padX * 2) / Math.max(slots, 1);
  const barW = Math.max(4, Math.min(slotW * 0.5, 26));
  const slotX = (i: number) => padX + slotW * i + slotW / 2; // centre of slot i (0-based)

  // Animate bars rising whenever inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
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
  }, [rateState, yearsState, freqState]);

  // Reveal bars left-to-right: bar i is fully up once progress passes i/slots.
  const barReveal = (i: number) => {
    if (slots <= 1) return progress;
    const start = i / slots;
    const end = (i + 1) / slots;
    if (progress <= start) return 0;
    if (progress >= end) return 1;
    return (progress - start) / (end - start);
  };

  const ariaLabel =
    `${title}: a ${money(currencyPrefix, faceValue)} bond paying a ${ratePct}% coupon ` +
    `${freqState === 2 ? 'semiannually' : 'annually'} for ${yearsState} years makes ` +
    `${nPayments} payments of ${money(currencyPrefix, coupon)}, then repays the face value ` +
    `for a final payment of ${money(currencyPrefix, maturityPayment)}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {principalLabel}: {money(currencyPrefix, faceValue)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {couponLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {principalLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {Array.from({ length: slots }, (_, i) => {
          const cx0 = slotX(i);
          const x0 = cx0 - barW / 2;
          const isLast = i === slots - 1;
          const reveal = barReveal(i);

          // Coupon bar (every period).
          const cH = barH(coupon) * reveal;
          // Principal bar only on the final period, drawn beneath the coupon.
          const pH = isLast ? barH(faceValue) * reveal : 0;

          return (
            <g key={i}>
              {isLast && pH > 0 && (
                <rect
                  x={x0}
                  y={baselineY - pH}
                  width={barW}
                  height={pH}
                  rx={2}
                  fill="var(--color-accent-500)"
                />
              )}
              {cH > 0 && (
                <rect
                  x={x0}
                  y={baselineY - pH - cH}
                  width={barW}
                  height={cH}
                  rx={2}
                  fill="var(--color-brand-500)"
                />
              )}
            </g>
          );
        })}

        {/* Baseline at zero */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-200)"
        />
        {/* Year 0 and maturity-year ticks */}
        <text
          x={padX}
          y={H - 8}
          fill="var(--color-ink-500)"
          fontSize={11}
          fontFamily="var(--font-mono)"
        >
          0
        </text>
        <text
          x={W - padX}
          y={H - 8}
          textAnchor="end"
          fill="var(--color-ink-500)"
          fontSize={11}
          fontFamily="var(--font-mono)"
        >
          {yearsState}
        </text>
      </svg>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-rate`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{couponRateLabel}</span>
            <span className="font-mono text-ink-900">{ratePct}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0}
            max={10}
            step={1}
            value={ratePct}
            onChange={(e) => setRateState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-years`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{yearsLabel}</span>
            <span className="font-mono text-ink-900">{yearsState}</span>
          </label>
          <input
            id={`${id}-years`}
            type="range"
            min={1}
            max={10}
            step={1}
            value={yearsState}
            onChange={(e) => setYearsState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Frequency toggle */}
      <fieldset className="mt-4">
        <legend className="text-sm text-ink-700">{frequencyLabel}</legend>
        <div
          className="mt-2 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-1"
          role="radiogroup"
          aria-label={frequencyLabel}
        >
          {([1, 2] as const).map((f) => {
            const active = freqState === f;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFreqState(f)}
                className={cx(
                  'rounded-pill px-4 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-700 hover:text-ink-900',
                )}
              >
                {f === 1 ? annualLabel : semiannualLabel}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{perCouponLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, coupon)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{paymentsLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {nPayments}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalInterestLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, totalInterest)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maturityPaymentLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {money(currencyPrefix, maturityPayment)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BondCashflows;
