import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FrequencyLadderProps {
  /** Heading above the ladder. */
  title?: string;
  /** One-line takeaway shown under the ladder. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting amount. Defaults to `1000`. */
  principal?: number;
  /** Nominal annual rate as a percent (e.g. `12`). Defaults to `12`. */
  ratePct?: number;
  /** Number of years compounded. Defaults to `1`. */
  years?: number;
  /** Row label for once-a-year compounding. */
  annualLabel?: string;
  /** Row label for four-times-a-year compounding. */
  quarterlyLabel?: string;
  /** Row label for twelve-times-a-year compounding. */
  monthlyLabel?: string;
  /** Row label for 365-times-a-year compounding. */
  dailyLabel?: string;
  /** Row label for continuous compounding. */
  continuousLabel?: string;
  /** Prefix for the ending-balance readout. */
  balanceLabel?: string;
  /** Word shown beside the effective-annual-rate percentage. */
  effectiveLabel?: string;
  /** Word for "year" used in the balance readout. */
  yearLabel?: string;
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

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)}%`;

interface Rung {
  key: string;
  label: string;
  /** Compounding periods per year; `Infinity` flags continuous. */
  n: number;
}

/**
 * Static comparison ladder showing that the *same* nominal rate is worth more
 * the more often it compounds. Five horizontal bars — annual, quarterly,
 * monthly, daily and continuous — are scaled by the *gain* (balance − principal)
 * so the tiny differences between frequencies are actually visible. Each row
 * reads out its ending balance and effective annual rate. Bars animate their
 * width in on mount; respects `prefers-reduced-motion` (jumps to final state).
 * Non-interactive by design — it's a comparison ladder, not a calculator.
 */
export function FrequencyLadder({
  title = 'More often, more money',
  caption = 'Same nominal rate, same money, same year — the only thing that changes is how often interest is added. Each extra compounding step earns a sliver of interest-on-interest, so the ladder climbs toward the continuous limit.',
  currencyPrefix = '$',
  principal = 1000,
  ratePct = 12,
  years = 1,
  annualLabel = 'Annual',
  quarterlyLabel = 'Quarterly',
  monthlyLabel = 'Monthly',
  dailyLabel = 'Daily',
  continuousLabel = 'Continuous',
  balanceLabel = 'Balance after',
  effectiveLabel = 'effective',
  yearLabel = 'year',
  className,
}: FrequencyLadderProps) {
  const id = useId();
  const [progress, setProgress] = useState(1); // 0 → 1 (bar grow-in)
  const rafRef = useRef<number | null>(null);

  const r = ratePct / 100;

  const rungs: Rung[] = [
    { key: 'annual', label: annualLabel, n: 1 },
    { key: 'quarterly', label: quarterlyLabel, n: 4 },
    { key: 'monthly', label: monthlyLabel, n: 12 },
    { key: 'daily', label: dailyLabel, n: 365 },
    { key: 'continuous', label: continuousLabel, n: Infinity },
  ];

  const balanceFor = (n: number): number =>
    n === Infinity
      ? principal * Math.exp(r * years)
      : principal * Math.pow(1 + r / n, n * years);

  const effectiveFor = (n: number): number =>
    n === Infinity ? Math.exp(r) - 1 : Math.pow(1 + r / n, n) - 1;

  const rows = rungs.map((rung) => {
    const balance = balanceFor(rung.n);
    return {
      ...rung,
      balance,
      gain: balance - principal,
      effective: effectiveFor(rung.n),
    };
  });

  const maxGain = Math.max(...rows.map((row) => row.gain), 1);

  // Animate the bars growing in on mount.
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
  }, [principal, ratePct, years]);

  const yearsLabelText = `${new Intl.NumberFormat('en-US').format(years)} ${yearLabel}${
    years === 1 ? '' : 's'
  }`;

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
          {money(currencyPrefix, principal)} @ {pct(ratePct).replace('.000', '')}
        </span>
      </figcaption>

      <ul
        className="mt-4 flex flex-col gap-3"
        aria-live="polite"
        aria-label={`${title}: ${money(currencyPrefix, principal)} at ${ratePct}% nominal for ${yearsLabelText}, compared across annual, quarterly, monthly, daily and continuous compounding.`}
      >
        {rows.map((row) => {
          const widthPct = (row.gain / maxGain) * 100 * progress;
          return (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink-900">{row.label}</span>
                <span className="text-ink-500">
                  {pct(row.effective * 100)} {effectiveLabel}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <div
                  className="h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken/60"
                  role="presentation"
                >
                  <div
                    id={`${id}-${row.key}`}
                    className="h-full rounded-pill bg-brand-500 transition-[width] duration-700 ease-out"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-sm font-semibold text-brand-700">
                  {money(currencyPrefix, row.balance)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm text-ink-600">
        {balanceLabel} {yearsLabelText}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FrequencyLadder;
