import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CdsCashflowProps {
  /** Heading above the chart. */
  title?: string;
  /** Toggle label for the survives-to-maturity outcome. */
  survivesLabel?: string;
  /** Toggle label for the defaults outcome. */
  defaultsLabel?: string;
  /** Label for the default-year segmented control. */
  defaultYearLabel?: string;
  /** Legend / row label for the premium (buyer → seller) leg. */
  premiumLegLabel?: string;
  /** Legend / row label for the protection (seller → buyer) leg. */
  protectionLegLabel?: string;
  /** Label for the spread slider (in basis points). */
  spreadLabel?: string;
  /** Label for the recovery-rate slider. */
  recoveryLabel?: string;
  /** Readout label for the premium paid per period. */
  premiumPerPeriodLabel?: string;
  /** Readout label for the total premium paid by the buyer. */
  totalPremiumLabel?: string;
  /** Readout label for the protection payout. */
  protectionPayoutLabel?: string;
  /** Readout label for the buyer's net P&L. */
  netLabel?: string;
  /** Readout label for the notional. */
  notionalLabel?: string;
  /** Label for the x-axis (settlement period). */
  periodAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  /** Suffix appended to basis-point values. Defaults to `' bp'`. */
  bpSuffix?: string;
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
  `${value.toFixed(0)}${suffix}`;

/**
 * Single-name **Credit Default Swap (CDS)** cash-flow chart. A CDS has two legs.
 * The protection **buyer** pays a steady **premium** = spread × notional every
 * period (the *premium leg*). The protection **seller** pays nothing — unless a
 * **credit event (default)** strikes, at which point it pays the *protection /
 * contingent leg* = (1 − Recovery) × notional and the premium payments stop.
 *
 * This island draws two bar rows on a shared 5-year period axis: small premium
 * bars (buyer → seller, brand) up to the default year (or all 5 if the name
 * survives), and a single large protection bar at the default year (seller →
 * buyer, accent). A Survives / Defaults toggle plus a default-year control set
 * the scenario; spread and recovery sliders drive the economics. Readouts show
 * total premium paid, the protection payout, and the buyer's signed net P&L
 * (brand if positive, accent if negative). Bars rise on mount and on every
 * change; respects `prefers-reduced-motion` (jumps to the final state).
 */
export function CdsCashflow({
  title = 'A single-name credit default swap',
  survivesLabel = 'Survives to maturity',
  defaultsLabel = 'Defaults',
  defaultYearLabel = 'Default year',
  premiumLegLabel = 'Premium leg (buyer → seller)',
  protectionLegLabel = 'Protection leg (seller → buyer)',
  spreadLabel = 'Spread',
  recoveryLabel = 'Recovery rate',
  premiumPerPeriodLabel = 'Premium / period',
  totalPremiumLabel = 'Total premium paid',
  protectionPayoutLabel = 'Protection payout',
  netLabel = "Buyer's net P&L",
  notionalLabel = 'Notional',
  periodAxisLabel = 'Year',
  caption = 'The buyer pays a steady premium for protection. If default hits, the seller pays (1 − Recovery) × notional and the premiums stop — so the buyer profits only when the contingent payout beats the premiums spent buying it.',
  currencyPrefix = '$',
  percentSuffix = '%',
  bpSuffix = ' bp',
  className,
}: CdsCashflowProps) {
  const id = useId();
  const notional = 10_000_000;
  const periods = [1, 2, 3, 4, 5];

  const [defaults, setDefaults] = useState(true);
  const [defaultYear, setDefaultYear] = useState(3); // 1..5
  const [spreadBp, setSpreadBp] = useState(200); // basis points
  const [recoveryPct, setRecoveryPct] = useState(40); // percent
  const [progress, setProgress] = useState(1); // 0 → 1 (bars rise-in)
  const rafRef = useRef<number | null>(null);

  const spread = spreadBp / 10_000; // fraction
  const recovery = recoveryPct / 100; // fraction
  const premiumPerPeriod = spread * notional;

  // Number of premium periods actually paid: all 5 if the name survives,
  // otherwise up to and including the default year.
  const premiumPeriods = defaults ? defaultYear : periods.length;
  const totalPremium = premiumPerPeriod * premiumPeriods;

  const protectionPayout = defaults ? (1 - recovery) * notional : 0;
  const buyerNet = protectionPayout - totalPremium;

  // --- Chart geometry -------------------------------------------------------
  const W = 520;
  const H = 280;
  const padX = 18;
  const padTop = 18;
  const rowGap = 16;

  const slots = periods.length;
  const slotW = (W - padX * 2) / slots;
  const barW = Math.max(6, Math.min(slotW * 0.46, 34));
  const slotX = (i: number) => padX + slotW * i + slotW / 2;

  // Two rows: premium (top) drawn downward from its baseline, protection
  // (bottom) drawn upward from its baseline.
  const premRowH = 64;
  const protRowH = 96;
  const premBaseline = padTop;
  const premBottom = premBaseline + premRowH;
  const protBaseline = premBottom + rowGap + protRowH;
  const axisY = protBaseline + 4;

  const premBarH = (v: number) => (premiumPerPeriod > 0 ? (v / premiumPerPeriod) * premRowH : 0);
  // Scale the protection bar against the tallest possible payout (recovery = 0),
  // so the bar visibly shrinks as the recovery slider rises.
  const protMax = notional;
  const protBarH = (v: number) => (v / protMax) * protRowH;

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
  }, [defaults, defaultYear, spreadBp, recoveryPct]);

  // Reveal bars left-to-right.
  const barReveal = (i: number) => {
    if (slots <= 1) return progress;
    const start = i / slots;
    const end = (i + 1) / slots;
    if (progress <= start) return 0;
    if (progress >= end) return 1;
    return (progress - start) / (end - start);
  };

  const outcomeText = defaults
    ? `defaults in year ${defaultYear}, so the seller pays the ${money(currencyPrefix, protectionPayout)} protection leg and premiums stop`
    : 'survives to maturity, so the seller never pays and the buyer is out every premium';

  const ariaLabel =
    `${title}: on a ${compactMoney(currencyPrefix, notional)} notional at a ${pct(spreadBp, bpSuffix)} spread, ` +
    `the buyer pays ${money(currencyPrefix, premiumPerPeriod)} per period. The reference name ${outcomeText}. ` +
    `Total premium paid is ${money(currencyPrefix, totalPremium)} and the buyer's net is ${buyerNet >= 0 ? '+' : ''}${money(currencyPrefix, buyerNet)}.`;

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
          aria-label={`${survivesLabel} / ${defaultsLabel}`}
        >
          <button
            type="button"
            onClick={() => setDefaults(false)}
            aria-pressed={!defaults}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              !defaults
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {survivesLabel}
          </button>
          <button
            type="button"
            onClick={() => setDefaults(true)}
            aria-pressed={defaults}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              defaults
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {defaultsLabel}
          </button>
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {premiumLegLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {protectionLegLabel}
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
          y={premBaseline - 4}
          fill="var(--color-ink-500)"
          fontSize={10}
        >
          {premiumLegLabel}
        </text>
        <text
          x={padX}
          y={protBaseline - protRowH - 4}
          fill="var(--color-ink-500)"
          fontSize={10}
        >
          {protectionLegLabel}
        </text>

        {periods.map((p, i) => {
          const cx0 = slotX(i);
          const x0 = cx0 - barW / 2;
          const reveal = barReveal(i);

          // Premium bar drawn for every paid period.
          const paysPremium = p <= premiumPeriods;
          const premH = paysPremium ? premBarH(premiumPerPeriod) * reveal : 0;

          // Protection bar only at the default year.
          const isDefaultYear = defaults && p === defaultYear;
          const protH = isDefaultYear ? protBarH(protectionPayout) * reveal : 0;

          return (
            <g key={p}>
              {/* Premium leg bar (grows down from its top baseline) */}
              {premH > 0 && (
                <rect
                  x={x0}
                  y={premBaseline}
                  width={barW}
                  height={premH}
                  rx={2}
                  fill="var(--color-brand-500)"
                />
              )}
              {/* Protection leg bar (grows up from its baseline) */}
              {protH > 0 && (
                <rect
                  x={x0}
                  y={protBaseline - protH}
                  width={barW}
                  height={protH}
                  rx={2}
                  fill="var(--color-accent-500)"
                />
              )}
            </g>
          );
        })}

        {/* Premium row top baseline */}
        <line
          x1={padX}
          y1={premBaseline}
          x2={W - padX}
          y2={premBaseline}
          stroke="var(--color-ink-200)"
        />
        {/* Protection row baseline (shared axis) */}
        <line
          x1={padX}
          y1={protBaseline}
          x2={W - padX}
          y2={protBaseline}
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
            htmlFor={`${id}-spread`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{spreadLabel}</span>
            <span className="font-mono text-ink-900">
              {pct(spreadBp, bpSuffix)}
            </span>
          </label>
          <input
            id={`${id}-spread`}
            type="range"
            min={50}
            max={600}
            step={10}
            value={spreadBp}
            onChange={(e) => setSpreadBp(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-recovery`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{recoveryLabel}</span>
            <span className="font-mono text-ink-900">
              {pct(recoveryPct, percentSuffix)}
            </span>
          </label>
          <input
            id={`${id}-recovery`}
            type="range"
            min={0}
            max={80}
            step={5}
            value={recoveryPct}
            onChange={(e) => setRecoveryPct(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Default-year segmented control (only when defaulting) */}
      {defaults ? (
        <div className="mt-4">
          <span className="text-sm text-ink-700">{defaultYearLabel}</span>
          <div
            className="mt-2 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-0.5"
            role="group"
            aria-label={defaultYearLabel}
          >
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDefaultYear(p)}
                aria-pressed={defaultYear === p}
                className={cx(
                  'rounded-pill px-3 py-1 font-mono text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  defaultYear === p
                    ? 'bg-accent-500 text-white'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{premiumPerPeriodLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, premiumPerPeriod)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalPremiumLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, totalPremium)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{protectionPayoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, protectionPayout)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              buyerNet >= 0 ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {buyerNet >= 0 ? '+' : ''}
            {money(currencyPrefix, buyerNet)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(spreadBp, bpSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{recoveryLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(recoveryPct, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 lg:col-span-2">
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

export default CdsCashflow;
