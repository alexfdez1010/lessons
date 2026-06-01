import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TotalReturnStackProps {
  /** Heading above the stack. */
  title?: string;
  /** One-line takeaway shown under the stack. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Price paid per share (the cost basis). Defaults to `100`. */
  buyPrice?: number;
  /** Price the share is worth now / was sold for. Defaults to `110`. */
  sellPrice?: number;
  /** Income received over the holding period (dividends/interest). Defaults to `5`. */
  income?: number;
  /** Label for the capital-gain segment (positive case). */
  capitalGainLabel?: string;
  /** Label for the capital-loss segment (negative case, price fell). */
  capitalLossLabel?: string;
  /** Label for the income segment. */
  incomeLabel?: string;
  /** Label for the combined total-return readout. */
  totalReturnLabel?: string;
  /** Word for "percent" / the `%` readout (e.g. `'return'`). */
  percentLabel?: string;
  /** Trailing phrase clarifying the percent is relative to cost (e.g. `'of cost'`). */
  ofCostLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}`;
};

const pct = (value: number): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}%`;
};

/**
 * Static figure showing that an investment's *total return* is two things added
 * together: the capital gain (the price went up) plus the income it paid you
 * (dividends or interest). A single stacked bar grows in on mount — an income
 * segment with a capital-gain segment stacked above it — and the two together
 * equal the total return, read out in money and as a percent of the original
 * cost. When the price *fell*, the capital part is a loss: it flips to the
 * accent (red) tokens and reads as negative, dragging the total down (and it
 * can go negative even though income is still positive). Numbers come from props
 * (a worked example), so the same figure teaches any scenario. Non-interactive
 * by design; respects `prefers-reduced-motion` (jumps to the final state).
 */
export function TotalReturnStack({
  title = 'Total return = price + income',
  caption = 'Total return is two things added together: the capital gain from the price moving, plus the income the investment paid you along the way. Stack them and you get the whole story — and a price that fell can still drag the total negative even after the income.',
  currencyPrefix = '$',
  buyPrice = 100,
  sellPrice = 110,
  income = 5,
  capitalGainLabel = 'Capital gain',
  capitalLossLabel = 'Capital loss',
  incomeLabel = 'Income',
  totalReturnLabel = 'Total return',
  percentLabel = 'return',
  ofCostLabel = 'of cost',
  className,
}: TotalReturnStackProps) {
  const id = useId();
  const [progress, setProgress] = useState(1); // 0 → 1 (segment grow-in)
  const rafRef = useRef<number | null>(null);

  const capital = sellPrice - buyPrice;
  const total = capital + income;
  const isGain = capital >= 0;
  const totalPct = buyPrice > 0 ? (total / buyPrice) * 100 : 0;

  // Scale segments by the largest magnitude in play so the stack is meaningful.
  const scale = Math.max(Math.abs(capital), Math.abs(income), Math.abs(total), 1);
  const incomeHeightPct = (Math.abs(income) / scale) * 100;
  const capitalHeightPct = (Math.abs(capital) / scale) * 100;

  // Animate the stacked segments growing in on mount.
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
  }, [buyPrice, sellPrice, income]);

  const capitalWord = isGain ? capitalGainLabel : capitalLossLabel;
  const capitalText = isGain ? 'text-brand-700' : 'text-accent-700';
  const capitalBg = isGain ? 'bg-brand-500' : 'bg-accent-500';
  const totalIsNegative = total < 0;
  const totalText = totalIsNegative ? 'text-accent-700' : 'text-brand-700';
  const totalBadgeBg = totalIsNegative ? 'bg-accent-600' : 'bg-brand-600';

  const summary = `${incomeLabel} ${money(currencyPrefix, income)} plus ${capitalWord.toLowerCase()} ${money(
    currencyPrefix,
    capital,
  )} make a ${totalReturnLabel.toLowerCase()} of ${money(currencyPrefix, total)}, or ${pct(
    totalPct,
  )} ${ofCostLabel}.`;

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
            totalBadgeBg,
          )}
        >
          {totalReturnLabel}: {money(currencyPrefix, total)}
        </span>
      </figcaption>

      <div
        className="mt-5 grid items-end gap-5 sm:grid-cols-[auto_1fr]"
        aria-live="polite"
        aria-label={summary}
      >
        {/* The stacked bar: income at the base, capital stacked above it. */}
        <div className="flex items-end justify-center" aria-hidden="true">
          <div className="flex h-48 w-16 flex-col-reverse overflow-hidden rounded-card bg-surface-sunken/60">
            {/* Income segment (base of the stack). */}
            <div
              id={`${id}-income`}
              className="w-full bg-accent-300/70 transition-[height] duration-700 ease-out"
              style={{ height: `${incomeHeightPct * progress}%` }}
            />
            {/* Capital segment stacked above — brand for a gain, accent for a loss. */}
            <div
              id={`${id}-capital`}
              className={cx('w-full transition-[height] duration-700 ease-out', capitalBg)}
              style={{ height: `${capitalHeightPct * progress}%` }}
            />
          </div>
        </div>

        {/* Legend / readouts for each part of the stack. */}
        <ul className="flex flex-col gap-3">
          <li className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <span className={cx('h-3 w-3 shrink-0 rounded-pill', capitalBg)} />
              {capitalWord}
            </span>
            <span className={cx('font-mono text-sm font-semibold', capitalText)}>
              {money(currencyPrefix, capital)}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <span className="h-3 w-3 shrink-0 rounded-pill bg-accent-300/70" />
              {incomeLabel}
            </span>
            <span className="font-mono text-sm font-semibold text-ink-700">
              {money(currencyPrefix, income)}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
            <span className="text-sm font-medium text-ink-900">{totalReturnLabel}</span>
            <span className={cx('font-mono text-base font-bold', totalText)}>
              {money(currencyPrefix, total)}
            </span>
          </li>
          <li>
            <span
              className={cx(
                'inline-block rounded-pill px-3 py-1 font-mono text-sm font-semibold text-white',
                totalBadgeBg,
              )}
            >
              {pct(totalPct)} {percentLabel}
            </span>
            <span className="ml-2 text-sm text-ink-500">{ofCostLabel}</span>
          </li>
        </ul>
      </div>

      {/* Screen-reader live region for the worked-example breakdown. */}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TotalReturnStack;
