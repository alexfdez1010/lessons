import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LtvMeterProps {
  /** Heading above the meter. */
  title?: string;
  /** Label for the property-price readout. */
  priceLabel?: string;
  /** Label for the down-payment slider. */
  downPaymentLabel?: string;
  /** Label for the loan-amount readout. */
  loanLabel?: string;
  /** Label for the loan-to-value (LTV) readout. */
  ltvLabel?: string;
  /** Label for the equity (down-payment share) readout. */
  equityLabel?: string;
  /** Status text shown when LTV is above the PMI threshold. */
  pmiZoneLabel?: string;
  /** Status text shown when LTV is at or below the PMI threshold. */
  noPmiZoneLabel?: string;
  /** One-line takeaway shown under the meter. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Property / asset price. Defaults to `300000`. */
  price?: number;
  /** Initial down payment as a fraction of price (0–0.5). Defaults to `0.10`. */
  downPaymentPct?: number;
  /** LTV (as a fraction) above which mortgage insurance / PMI applies. Defaults to `0.80`. */
  pmiThreshold?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

/**
 * Interactive Loan-to-Value (LTV) meter. A property has a fixed price; the
 * learner drags the down-payment percentage and watches the loan amount and
 * LTV change live. A horizontal gauge spans the full property value (100%):
 * the equity / down-payment slice fills in brand blue and the loan slice fills
 * in the accent (risky) tone. The classic 80% PMI threshold is drawn as a
 * vertical tick, a marker tracks where the current LTV sits relative to it, and
 * the LTV readout flips between a success (green) and warning (amber) color
 * depending on whether mortgage insurance would be required. The fill and
 * marker animate smoothly between values; `prefers-reduced-motion` snaps
 * straight to the target with no tween.
 */
export function LtvMeter({
  title = 'Loan-to-Value (LTV)',
  priceLabel = 'Price',
  downPaymentLabel = 'Down payment',
  loanLabel = 'Loan amount',
  ltvLabel = 'LTV',
  equityLabel = 'Down payment',
  pmiZoneLabel = 'PMI usually required',
  noPmiZoneLabel = 'No PMI — 80% or less',
  caption = 'A bigger down payment shrinks the loan, lowers your LTV, and means less risk. Cross under 80% LTV and lenders typically drop the mortgage-insurance (PMI) requirement.',
  currencyPrefix = '$',
  price = 300000,
  downPaymentPct = 0.1,
  pmiThreshold = 0.8,
  className,
}: LtvMeterProps) {
  const id = useId();
  const [dpPctState, setDpPctState] = useState(downPaymentPct);
  // Animated LTV the bar/marker render against (0 → 1).
  const [shownLtv, setShownLtv] = useState(1 - downPaymentPct);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 90;
  const padX = 10;
  const barY = 26;
  const barH = 30;
  const barW = W - padX * 2;

  const downPayment = price * dpPctState;
  const loan = price - downPayment;
  const ltv = loan / price; // = 1 - dpPctState
  const inPmiZone = ltv > pmiThreshold;

  const dpPct = Math.round(dpPctState * 100);
  const ltvPct = Math.round(ltv * 100);
  const thresholdPct = Math.round(pmiThreshold * 100);

  // Animate the bar fill + marker toward the new LTV whenever it changes.
  useEffect(() => {
    const target = ltv;
    if (prefersReducedMotion()) {
      setShownLtv(target);
      return;
    }
    const start = shownLtv;
    const delta = target - start;
    if (Math.abs(delta) < 0.0005) {
      setShownLtv(target);
      return;
    }
    const duration = 450;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setShownLtv(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownLtv intentionally omitted: re-running on each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ltv]);

  // Geometry: the loan slice grows from the LEFT (it's the bulk of the bar),
  // equity fills the remainder on the right so a bigger down payment visibly
  // pushes the loan back.
  const loanW = barW * shownLtv;
  const equityX = padX + loanW;
  const equityW = barW - loanW;
  const thresholdX = padX + barW * pmiThreshold;
  const markerX = padX + barW * shownLtv;

  const loanColor = inPmiZone ? 'var(--color-warning)' : 'var(--color-accent-500)';
  const ltvTextClass = inPmiZone ? 'text-warning' : 'text-success';
  const statusClass = inPmiZone
    ? 'border-warning/40 bg-warning/10 text-warning'
    : 'border-success/40 bg-success/10 text-success';

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
          {priceLabel}: {money(currencyPrefix, price)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-brand-500" aria-hidden="true" />
          {equityLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill"
            style={{ backgroundColor: loanColor }}
            aria-hidden="true"
          />
          {loanLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: on a ${money(currencyPrefix, price)} property a ${dpPct}% down payment of ${money(
          currencyPrefix,
          downPayment,
        )} leaves a ${money(currencyPrefix, loan)} loan, an LTV of ${ltvPct}% — ${
          inPmiZone ? pmiZoneLabel : noPmiZoneLabel
        }. The PMI threshold sits at ${thresholdPct}% LTV.`}
      >
        {/* Track */}
        <rect
          x={padX}
          y={barY}
          width={barW}
          height={barH}
          rx={6}
          fill="var(--color-ink-100)"
        />
        {/* Loan slice (LTV) — grows from the left */}
        <rect
          x={padX}
          y={barY}
          width={Math.max(0, loanW)}
          height={barH}
          rx={6}
          fill={loanColor}
        />
        {/* Equity / down-payment slice — fills the right remainder */}
        <rect
          x={equityX}
          y={barY}
          width={Math.max(0, equityW)}
          height={barH}
          rx={6}
          fill="var(--color-brand-500)"
        />

        {/* PMI threshold tick */}
        <line
          x1={thresholdX}
          y1={barY - 8}
          x2={thresholdX}
          y2={barY + barH + 8}
          stroke="var(--color-ink-500)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <text
          x={thresholdX}
          y={barY - 12}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-ink-600)"
        >
          {thresholdPct}%
        </text>

        {/* Current-LTV marker */}
        <g>
          <line
            x1={markerX}
            y1={barY - 4}
            x2={markerX}
            y2={barY + barH + 4}
            stroke="var(--color-ink-900)"
            strokeWidth={2}
          />
          <circle
            cx={markerX}
            cy={barY + barH + 4}
            r={4}
            fill="var(--color-ink-900)"
          />
        </g>

        {/* Baseline scale labels */}
        <text x={padX} y={H - 4} fontSize="10" fill="var(--color-ink-400)">
          0%
        </text>
        <text
          x={W - padX}
          y={H - 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-400)"
        >
          100% LTV
        </text>
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-dp`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{downPaymentLabel}</span>
          <span className="font-mono text-ink-900">{dpPct}%</span>
        </label>
        <input
          id={`${id}-dp`}
          type="range"
          min={0}
          max={50}
          step={1}
          value={dpPct}
          onChange={(e) => setDpPctState(Number(e.target.value) / 100)}
          aria-label={downPaymentLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{downPaymentLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, downPayment)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{loanLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, loan)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ltvLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', ltvTextClass)}>
            {ltvPct}%
          </dd>
        </div>
      </dl>

      {/* Status line */}
      <p
        className={cx(
          'mt-3 rounded-card border px-3 py-2 text-sm font-medium',
          statusClass,
        )}
      >
        {inPmiZone ? pmiZoneLabel : noPmiZoneLabel}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LtvMeter;
