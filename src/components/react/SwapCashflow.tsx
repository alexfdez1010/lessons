import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwapCashflowProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend / readout label for the fixed leg bars. */
  fixedLegLabel?: string;
  /** Legend label for the floating leg bars. */
  floatingLegLabel?: string;
  /** Legend label for the net-settled bar row. */
  netLabel?: string;
  /** Toggle label for taking the pay-fixed (payer) side. */
  payerLabel?: string;
  /** Toggle label for taking the receive-fixed (receiver) side. */
  receiverLabel?: string;
  /** Label for the floating-path shift slider. */
  rateEnvironmentLabel?: string;
  /** Label for the fixed (swap) rate readout. */
  fixedRateLabel?: string;
  /** Label for the per-period fixed-payment readout. */
  perPeriodLabel?: string;
  /** Label for the total-net-to-you readout. */
  netTotalLabel?: string;
  /** Label for the notional readout. */
  notionalLabel?: string;
  /** Label for the x-axis (settlement period). */
  periodAxisLabel?: string;
  /** Optional label for the fixed-rate slider (enables the slider when set). */
  fixedRateSliderLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  /** Fixed (swap) rate as a fraction. Defaults to `0.04`. */
  fixedRate?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.abs(Math.round(value)))}`;
};

const compactMoney = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`;

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

/**
 * Plain-vanilla interest-rate swap cash-flow chart. In a swap one party pays a
 * **fixed** rate and receives a **floating** rate; the counterparty is the exact
 * mirror. The huge *notional* ($10M here) is **never exchanged** — only the
 * **net difference** between the two legs changes hands each settlement period.
 *
 * This island draws three stacked bar rows on a shared period axis: a constant
 * fixed leg, a varying floating leg (driven by an internal drifting rate path),
 * and the signed **net** — the only cash that actually moves. A "rate
 * environment" slider shifts the whole floating path so the learner watches
 * floating cross above and below fixed, and a Pay-fixed / Receive-fixed toggle
 * flips whose pocket the net lands in (brand = cash to you, accent = cash from
 * you). Bars rise on mount and on every change; respects
 * `prefers-reduced-motion` (jumps straight to the final state).
 */
export function SwapCashflow({
  title = 'A plain-vanilla interest-rate swap',
  fixedLegLabel = 'Fixed leg (you pay/receive)',
  floatingLegLabel = 'Floating leg',
  netLabel = 'Net settled',
  payerLabel = 'Pay fixed',
  receiverLabel = 'Receive fixed',
  rateEnvironmentLabel = 'Rate environment shift',
  fixedRateLabel = 'Fixed (swap) rate',
  perPeriodLabel = 'Fixed payment / period',
  netTotalLabel = 'Your net over 6 periods',
  notionalLabel = 'Notional (never exchanged)',
  periodAxisLabel = 'Settlement period',
  fixedRateSliderLabel,
  caption = 'The notional never moves — each period only the net difference between the fixed and floating legs is settled, and that single payment is all the cash that actually changes hands.',
  currencyPrefix = '$',
  percentSuffix = '%',
  fixedRate = 0.04,
  className,
}: SwapCashflowProps) {
  const id = useId();
  const notional = 10_000_000;
  const periods = [1, 2, 3, 4, 5, 6];
  // Floating rate path (percent) that drifts above and below the fixed rate.
  const baseFloating = [3.0, 3.4, 4.1, 4.6, 4.2, 3.8];

  const [side, setSide] = useState<'payer' | 'receiver'>('receiver');
  const [shift, setShift] = useState(0); // percentage-point shift, −1.5..+1.5
  const [fixedRateState, setFixedRateState] = useState(fixedRate);
  const [progress, setProgress] = useState(1); // 0 → 1 (bars rise-in)
  const rafRef = useRef<number | null>(null);

  const fixedRatePct = fixedRateState * 100;
  // Fixed payment per period (annual periods → fixedRate × notional).
  const fixedPayment = fixedRateState * notional;
  // Floating rate per period after the environment shift, as a fraction.
  const floatingRates = baseFloating.map((r) => (r + shift) / 100);
  const floatingPayments = floatingRates.map((r) => r * notional);

  // Net to YOU each period. A receiver of fixed nets (fixed − floating);
  // a payer of fixed nets (floating − fixed). Positive = cash flows to you.
  const nets = floatingPayments.map((fl) =>
    side === 'receiver' ? fixedPayment - fl : fl - fixedPayment,
  );
  const netTotal = nets.reduce((sum, n) => sum + n, 0);

  // --- Chart geometry -------------------------------------------------------
  const W = 520;
  const H = 280;
  const padX = 18;
  const padTop = 14;
  const rowGap = 16;

  const slots = periods.length;
  const slotW = (W - padX * 2) / slots;
  const barW = Math.max(6, Math.min(slotW * 0.46, 30));
  const slotX = (i: number) => padX + slotW * i + slotW / 2;

  // Three rows: fixed (top), floating (middle) drawn downward, net (bottom)
  // drawn signed about its own zero line.
  const legRowH = 56;
  const netRowH = 72;
  const fixedTop = padTop;
  const fixedBaseline = fixedTop + legRowH;
  const floatBaseline = fixedBaseline + rowGap;
  const floatBottom = floatBaseline + legRowH;
  const netZero = floatBottom + rowGap + netRowH / 2;
  const axisY = netZero + netRowH / 2 + 4;

  const legMax = Math.max(fixedPayment, ...floatingPayments, 1);
  const legBarH = (v: number) => (v / legMax) * legRowH;
  const netMax = Math.max(...nets.map((n) => Math.abs(n)), 1);
  const netBarH = (v: number) => (Math.abs(v) / netMax) * (netRowH / 2 - 2);

  // Animate bars rising whenever inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [side, shift, fixedRateState]);

  // Reveal bars left-to-right.
  const barReveal = (i: number) => {
    if (slots <= 1) return progress;
    const start = i / slots;
    const end = (i + 1) / slots;
    if (progress <= start) return 0;
    if (progress >= end) return 1;
    return (progress - start) / (end - start);
  };

  const ariaLabel =
    `${title}: on a ${compactMoney(currencyPrefix, notional)} notional that is never exchanged, ` +
    `the fixed leg pays ${money(currencyPrefix, fixedPayment)} every period at a ${pct(fixedRatePct, percentSuffix)} swap rate, ` +
    `while the floating leg varies with rates. As the ${side === 'receiver' ? receiverLabel : payerLabel} side, ` +
    `only the net is settled each period, totalling ${money(currencyPrefix, netTotal)} to you over ${slots} periods.`;

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
          className="inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-0.5"
          role="group"
          aria-label={`${payerLabel} / ${receiverLabel}`}
        >
          <button
            type="button"
            onClick={() => setSide('payer')}
            aria-pressed={side === 'payer'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              side === 'payer'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {payerLabel}
          </button>
          <button
            type="button"
            onClick={() => setSide('receiver')}
            aria-pressed={side === 'receiver'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              side === 'receiver'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {receiverLabel}
          </button>
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-ink-300"
            aria-hidden="true"
          />
          {fixedLegLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {floatingLegLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {netLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Row labels */}
        <text
          x={padX}
          y={fixedTop - 2}
          fill="var(--color-ink-500)"
          fontSize={10}
        >
          {fixedLegLabel}
        </text>
        <text
          x={padX}
          y={floatBaseline - legRowH - 2}
          fill="var(--color-ink-500)"
          fontSize={10}
        >
          {floatingLegLabel}
        </text>
        <text
          x={padX}
          y={netZero - netRowH / 2 - 2}
          fill="var(--color-ink-500)"
          fontSize={10}
        >
          {netLabel}
        </text>

        {periods.map((_, i) => {
          const cx0 = slotX(i);
          const x0 = cx0 - barW / 2;
          const reveal = barReveal(i);

          const fH = legBarH(fixedPayment) * reveal;
          const flH = legBarH(floatingPayments[i]) * reveal;
          const net = nets[i];
          const nH = netBarH(net) * reveal;
          const netToYou = net >= 0;

          return (
            <g key={i}>
              {/* Fixed leg bar (grows up from its baseline) */}
              {fH > 0 && (
                <rect
                  x={x0}
                  y={fixedBaseline - fH}
                  width={barW}
                  height={fH}
                  rx={2}
                  fill="var(--color-ink-300)"
                />
              )}
              {/* Floating leg bar (grows down from its top baseline) */}
              {flH > 0 && (
                <rect
                  x={x0}
                  y={floatBaseline}
                  width={barW}
                  height={flH}
                  rx={2}
                  fill="var(--color-brand-500)"
                />
              )}
              {/* Net bar (signed about the net zero line) */}
              {nH > 0 && (
                <rect
                  x={x0}
                  y={netToYou ? netZero - nH : netZero}
                  width={barW}
                  height={nH}
                  rx={2}
                  fill={
                    netToYou
                      ? 'var(--color-brand-600)'
                      : 'var(--color-accent-600)'
                  }
                />
              )}
            </g>
          );
        })}

        {/* Fixed-rate reference line across the fixed row */}
        <line
          x1={padX}
          y1={fixedBaseline}
          x2={W - padX}
          y2={fixedBaseline}
          stroke="var(--color-ink-200)"
        />
        {/* Floating row top baseline */}
        <line
          x1={padX}
          y1={floatBaseline}
          x2={W - padX}
          y2={floatBaseline}
          stroke="var(--color-ink-200)"
        />
        {/* Net zero line */}
        <line
          x1={padX}
          y1={netZero}
          x2={W - padX}
          y2={netZero}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {/* Period ticks */}
        {periods.map((p, i) => (
          <text
            key={p}
            x={slotX(i)}
            y={axisY + 12}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-500)"
            fontFamily="var(--font-mono)"
          >
            {p}
          </text>
        ))}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {periodAxisLabel}
        </text>
      </svg>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-shift`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{rateEnvironmentLabel}</span>
            <span className="font-mono text-ink-900">
              {shift > 0 ? '+' : ''}
              {shift.toFixed(1)}
              {percentSuffix}
            </span>
          </label>
          <input
            id={`${id}-shift`}
            type="range"
            min={-1.5}
            max={1.5}
            step={0.1}
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        {fixedRateSliderLabel ? (
          <div>
            <label
              htmlFor={`${id}-fixed`}
              className="flex items-center justify-between text-sm text-ink-700"
            >
              <span>{fixedRateSliderLabel}</span>
              <span className="font-mono text-ink-900">
                {pct(fixedRatePct, percentSuffix)}
              </span>
            </label>
            <input
              id={`${id}-fixed`}
              type="range"
              min={0}
              max={8}
              step={0.1}
              value={fixedRatePct}
              onChange={(e) =>
                setFixedRateState(Number(e.target.value) / 100)
              }
              className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            />
          </div>
        ) : null}
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fixedRateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(fixedRatePct, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{perPeriodLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, fixedPayment)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netTotalLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              netTotal >= 0 ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {netTotal >= 0 ? '+' : ''}
            {money(currencyPrefix, netTotal)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{notionalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {compactMoney(currencyPrefix, notional)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SwapCashflow;
