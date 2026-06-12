import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwapValueBridgeProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + bar label for the fixed-rate bond. */
  fixedBondLabel?: string;
  /** Legend + bar label for the floating-rate bond (always ≈ par). */
  floatingBondLabel?: string;
  /** Label for the signed swap-value bar. */
  swapValueLabel?: string;
  /** Label for the current-market-rate slider. */
  marketRateLabel?: string;
  /** Label for the contract (fixed) swap-rate readout. */
  contractRateLabel?: string;
  /** Label for the maturity slider. */
  yearsLabel?: string;
  /** Text for the receive-fixed side toggle. */
  receiverLabel?: string;
  /** Text for the pay-fixed side toggle. */
  payerLabel?: string;
  /** Readout label for the present value of the fixed-rate bond. */
  pvFixedLabel?: string;
  /** Readout label for the floating bond (≈ par / notional). */
  parLabel?: string;
  /** Status word when the chosen swap has positive value. */
  inTheMoneyLabel?: string;
  /** Status word when the chosen swap has negative value. */
  outOfTheMoneyLabel?: string;
  /** Status word when the swap is worth ~zero. */
  atParLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  /** Contract (fixed) swap rate as a fraction (0–1). Defaults to `0.04`. */
  contractRate?: number;
  /** Initial years to maturity (1–10). Defaults to `5`. */
  years?: number;
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

const signedMoney = (prefix: string, value: number): string =>
  `${value < 0 ? '−' : value > 0 ? '+' : ''}${money(prefix, Math.abs(value))}`;

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

const NOTIONAL = 10_000_000;

/**
 * Swap-value bridge. An interest-rate swap is not some exotic instrument — it is
 * just **two bonds wearing a trench coat**. A *receive-fixed* swap behaves like
 * being **long a fixed-rate bond** and **short a floating-rate bond**. The
 * floating bond resets to market each period, so right after a reset it is worth
 * ~par (the notional); the fixed bond's price swings with current rates. That
 * makes the whole swap value collapse to a single subtraction:
 * `Value(receive-fixed) = PV(fixed bond) − notional`. When the current market
 * swap rate drops below the contract's fixed rate, the fixed bond trades above
 * par and the receiver swap is in the money; when rates rise it goes negative. A
 * pay-fixed swap is the exact mirror. Drag the market-rate and maturity sliders
 * or flip the side and the three bars — fixed bond, floating bond, and their
 * signed difference — recompute and re-grow live. Respects
 * `prefers-reduced-motion` (jumps straight to the final state).
 */
export function SwapValueBridge({
  title = 'Valuing a swap as two bonds',
  fixedBondLabel = 'Fixed-rate bond',
  floatingBondLabel = 'Floating bond ≈ par',
  swapValueLabel = 'Swap value',
  marketRateLabel = 'Current market swap rate',
  contractRateLabel = 'Contract fixed rate',
  yearsLabel = 'Maturity (years)',
  receiverLabel = 'Receive fixed',
  payerLabel = 'Pay fixed',
  pvFixedLabel = 'PV of fixed-rate bond',
  parLabel = 'Floating bond ≈ par',
  inTheMoneyLabel = 'In the money',
  outOfTheMoneyLabel = 'Out of the money',
  atParLabel = 'At par',
  caption = 'A swap is just two bonds: a receive-fixed swap = long a fixed-rate bond minus a floating bond worth ~par, so its value is simply PV(fixed bond) − notional.',
  currencyPrefix = '$',
  percentSuffix = '%',
  contractRate = 0.04,
  years = 5,
  className,
}: SwapValueBridgeProps) {
  const id = useId();
  const [marketRate, setMarketRate] = useState(contractRate);
  const [yearsState, setYearsState] = useState(years);
  const [side, setSide] = useState<'receiver' | 'payer'>('receiver');
  const [progress, setProgress] = useState(1); // 0 → 1 (bars grow-in)
  const rafRef = useRef<number | null>(null);

  // PV of the fixed-rate bond: level coupons of contractRate × notional for
  // `yearsState` years, plus the notional repaid at maturity, all discounted at
  // a flat current market rate.
  const annualCoupon = contractRate * NOTIONAL;
  let pvFixed = 0;
  for (let t = 1; t <= yearsState; t++) {
    pvFixed += annualCoupon / Math.pow(1 + marketRate, t);
  }
  pvFixed += NOTIONAL / Math.pow(1 + marketRate, yearsState);

  // Floating-rate bond resets to market each period → ~par right after a reset.
  const floatingPV = NOTIONAL;

  // Receiver = long fixed bond, short floating bond. Payer is the mirror image.
  const receiverValue = pvFixed - floatingPV;
  const swapValue = side === 'receiver' ? receiverValue : -receiverValue;

  // "At par" tolerance: a hair either side of zero counts as flat.
  const tol = NOTIONAL * 1e-4;
  const status =
    swapValue > tol
      ? inTheMoneyLabel
      : swapValue < -tol
        ? outOfTheMoneyLabel
        : atParLabel;
  const positive = swapValue > tol;
  const negative = swapValue < -tol;

  // Geometry. Three bars share one value→pixel scale anchored at a baseline so
  // the signed swap bar can sit above or below zero.
  const W = 520;
  const H = 260;
  const padX = 20;
  const padTop = 18;
  const padBottom = 34; // room for bar labels under the baseline
  const chartH = H - padTop - padBottom;

  // Scale covers the largest magnitude any bar reaches (the two bonds are the
  // big ones; the swap difference is small by comparison).
  const maxMag = Math.max(pvFixed, floatingPV, Math.abs(swapValue), 1);
  const px = (v: number) => (Math.abs(v) / maxMag) * chartH;
  const baselineY = H - padBottom;

  const colW = (W - padX * 2) / 3;
  const barW = Math.min(colW * 0.5, 92);
  const colX = (i: number) => padX + colW * i + colW / 2;

  const swapColor = positive
    ? 'var(--color-brand-600)'
    : negative
      ? 'var(--color-accent-600)'
      : 'var(--color-ink-300)';

  // Animate bar heights whenever the inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
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
  }, [marketRate, yearsState, side]);

  const marketPct = marketRate * 100;
  const contractPct = contractRate * 100;

  const ariaLabel =
    `${title}: with the current market swap rate at ${pct(marketPct, percentSuffix)} ` +
    `versus a ${pct(contractPct, percentSuffix)} contract rate over ${yearsState} years, ` +
    `the fixed-rate bond is worth ${money(currencyPrefix, pvFixed)} and the floating bond ` +
    `is worth ${money(currencyPrefix, floatingPV)} (par). The ${side === 'receiver' ? receiverLabel : payerLabel} ` +
    `swap is therefore worth ${signedMoney(currencyPrefix, swapValue)} — ${status}.`;

  // Heights (animated by progress).
  const fixedH = px(pvFixed) * progress;
  const floatH = px(floatingPV) * progress;
  const swapH = px(swapValue) * progress;

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
          className="inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-1"
          role="radiogroup"
          aria-label={title}
        >
          {(['receiver', 'payer'] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(s)}
                className={cx(
                  'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-700 hover:text-ink-900',
                )}
              >
                {s === 'receiver' ? receiverLabel : payerLabel}
              </button>
            );
          })}
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {fixedBondLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-ink-300"
            aria-hidden="true"
          />
          {floatingBondLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {swapValueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Baseline (zero) */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-200)"
        />

        {/* Fixed-rate bond bar */}
        <g>
          <rect
            x={colX(0) - barW / 2}
            y={baselineY - fixedH}
            width={barW}
            height={fixedH}
            rx={3}
            fill="var(--color-brand-500)"
          />
          <text
            x={colX(0)}
            y={baselineY - fixedH - 6}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--color-brand-700)"
          >
            {money(currencyPrefix, pvFixed)}
          </text>
          <text
            x={colX(0)}
            y={baselineY + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {fixedBondLabel}
          </text>
        </g>

        {/* Floating-rate bond bar (≈ par) */}
        <g>
          <rect
            x={colX(1) - barW / 2}
            y={baselineY - floatH}
            width={barW}
            height={floatH}
            rx={3}
            fill="var(--color-ink-300)"
          />
          {/* Par reference line across the floating bar's top */}
          <line
            x1={colX(1) - barW / 2 - 4}
            y1={baselineY - px(floatingPV)}
            x2={colX(1) + barW / 2 + 4}
            y2={baselineY - px(floatingPV)}
            stroke="var(--color-ink-500)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={colX(1)}
            y={baselineY - floatH - 6}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill="var(--color-ink-600)"
          >
            {money(currencyPrefix, floatingPV)}
          </text>
          <text
            x={colX(1)}
            y={baselineY + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {floatingBondLabel}
          </text>
        </g>

        {/* Signed swap-value bar (the difference) */}
        <g>
          <rect
            x={colX(2) - barW / 2}
            y={swapValue >= 0 ? baselineY - swapH : baselineY}
            width={barW}
            height={Math.abs(swapH)}
            rx={3}
            fill={swapColor}
          />
          <text
            x={colX(2)}
            y={
              swapValue >= 0
                ? baselineY - Math.abs(swapH) - 6
                : baselineY + Math.abs(swapH) + 14
            }
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-mono)"
            fontWeight={600}
            fill={swapColor}
          >
            {signedMoney(currencyPrefix, swapValue)}
          </text>
          <text
            x={colX(2)}
            y={baselineY + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {swapValueLabel}
          </text>
        </g>
      </svg>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-market`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{marketRateLabel}</span>
            <span className="font-mono text-ink-900">
              {pct(marketPct, percentSuffix)}
            </span>
          </label>
          <input
            id={`${id}-market`}
            type="range"
            min={1}
            max={8}
            step={0.1}
            value={marketPct}
            onChange={(e) => setMarketRate(Number(e.target.value) / 100)}
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

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{marketRateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(marketPct, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{contractRateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(contractPct, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{pvFixedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, pvFixed)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{parLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, floatingPV)}
          </dd>
        </div>
        <div className="col-span-2 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 lg:col-span-1">
          <dt className="text-ink-500">{swapValueLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              positive
                ? 'text-brand-600'
                : negative
                  ? 'text-accent-600'
                  : 'text-ink-700',
            )}
          >
            {signedMoney(currencyPrefix, swapValue)}{' '}
            <span className="text-sm font-medium">({status})</span>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SwapValueBridge;
