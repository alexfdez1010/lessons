import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PurchasingPowerDecayProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the inflation-rate slider. */
  rateLabel?: string;
  /** Label for the years slider. */
  yearsLabel?: string;
  /** Legend label for the eroding (fiat) purchasing-power curve. */
  fiatLabel?: string;
  /** Legend label for the flat stable-money reference line. */
  stableLabel?: string;
  /** Label for the "buys today" readout (purchasing power left). */
  buysLabel?: string;
  /** Label for the "to buy the same basket" readout (price multiple). */
  priceLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Initial annual inflation rate, percent (0–100). Defaults to `8`. */
  ratePercent?: number;
  /** Initial horizon in years (1–50). Defaults to `30`. */
  years?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, dp = 0): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value)}`;

/**
 * Interactive inflation-erosion chart. Holding one unit of money, its purchasing
 * power decays as P = (1 / (1 + i))^t while a flat reference line shows stable
 * money that keeps its value. Crank the inflation slider toward hyperinflation
 * and the curve collapses to the floor within a few years; the readouts show how
 * many cents the unit still buys and how much more you'd need to spend for the
 * same basket. Locale-agnostic (all labels are props). Curve animates on change
 * and respects `prefers-reduced-motion`.
 */
export function PurchasingPowerDecay({
  title = 'Inflation: how money loses its value',
  rateLabel = 'Annual inflation',
  yearsLabel = 'Years',
  fiatLabel = 'Purchasing power left',
  stableLabel = 'Stable money',
  buysLabel = 'A unit still buys',
  priceLabel = 'Same basket now costs',
  caption = "Purchasing power falls as (1 ÷ (1 + inflation)) compounds every year. Gentle inflation nibbles; hyperinflation devours — push the rate up and watch the curve hit the floor.",
  currencyPrefix = '$',
  ratePercent = 8,
  years = 30,
  className,
}: PurchasingPowerDecayProps) {
  const id = useId();
  const [rate, setRate] = useState(ratePercent);
  const [yearsState, setYears] = useState(years);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 12;
  const padY = 14;

  const span = Math.max(yearsState, 10);
  const i = rate / 100;

  const x = (year: number) => padX + (year / span) * (W - padX * 2);
  const y = (v: number) => padY + (1 - v) * (H - padY * 2); // v is a fraction 0..1

  const powerAt = (year: number) => 1 / Math.pow(1 + i, year);
  const power = powerAt(yearsState);
  const cents = power; // fraction of original purchasing power
  const priceMultiple = Math.pow(1 + i, yearsState);

  const SAMPLES = 90;
  const fiatPath = () => {
    const upto = progress * span;
    let d = `M ${x(0)} ${y(powerAt(0))}`;
    for (let k = 1; k <= SAMPLES; k++) {
      const year = (k / SAMPLES) * span;
      if (year > upto) {
        d += ` L ${x(upto)} ${y(powerAt(upto))}`;
        break;
      }
      d += ` L ${x(year)} ${y(powerAt(year))}`;
    }
    return d;
  };
  const stablePath = `M ${x(0)} ${y(1)} L ${x(span)} ${y(1)}`;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 850;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [rate, yearsState]);

  const markerVisible = progress * span >= yearsState;
  const centsDisplay =
    cents >= 0.1 ? `${Math.round(cents * 100)}¢` : `${(cents * 100).toFixed(cents >= 0.01 ? 1 : 2)}¢`;
  const multipleDisplay =
    priceMultiple >= 100
      ? `${money(currencyPrefix, Math.round(priceMultiple))}`
      : `${money(currencyPrefix, priceMultiple, priceMultiple >= 10 ? 0 : 2)}`;

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
          {rate}% · {yearsState}y
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {fiatLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {stableLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: at ${rate}% inflation, after ${yearsState} years one unit buys about ${centsDisplay} of what it once did.`}
      >
        <path d={stablePath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />
        <path
          d={fiatPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {markerVisible && (
          <>
            <line
              x1={x(yearsState)}
              y1={y(1)}
              x2={x(yearsState)}
              y2={y(power)}
              stroke="var(--color-ink-300)"
              strokeDasharray="4 4"
            />
            <circle cx={x(yearsState)} cy={y(power)} r={5} fill="var(--color-brand-600)" />
          </>
        )}
      </svg>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-rate`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{rateLabel}</span>
            <span className="font-mono text-ink-900">{rate}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
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
            max={50}
            step={1}
            value={yearsState}
            onChange={(e) => setYears(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{buysLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{centsDisplay}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{priceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{multipleDisplay}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PurchasingPowerDecay;
