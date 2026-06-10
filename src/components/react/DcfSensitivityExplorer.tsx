import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DcfSensitivityExplorerProps {
  /** Heading above the explorer. */
  title?: string;
  /** Label for the discount-rate slider/axis. */
  discountLabel?: string;
  /** Label for the terminal-growth slider/axis. */
  growthLabel?: string;
  /** Label for the value readout. */
  valueLabel?: string;
  /** Currency / unit prefix for the value. Defaults to `'$'`. */
  valuePrefix?: string;
  /** Suffix for the value (e.g. a unit). Defaults to empty. */
  valueSuffix?: string;
  /**
   * Next-year free cash flow used as the basis of the perpetuity. The value is
   * computed as FCF / (discount − growth) on a Gordon-growth basis. Defaults
   * to 100 (so the readout reads naturally in the chosen unit).
   */
  baseCashFlow?: number;
  /** Discount-rate grid values (as decimals, e.g. 0.08). */
  discountRates?: number[];
  /** Terminal-growth grid values (as decimals, e.g. 0.02). */
  growthRates?: number[];
  /** Note shown when growth ≥ discount (formula breaks down). */
  invalidLabel?: string;
  /** One-line takeaway under the grid. */
  caption?: string;
  className?: string;
}

const DEFAULT_DISCOUNTS = [0.07, 0.08, 0.09, 0.1, 0.11];
const DEFAULT_GROWTHS = [0.01, 0.02, 0.03, 0.04];

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

/**
 * Interactive DCF sensitivity grid. The core teaching point: a discounted-cash-
 * flow value looks like a precise number but swings wildly with two assumptions
 * — the discount rate and the terminal growth rate. The learner hovers/selects
 * a cell in a discount-rate × growth-rate grid; each cell is a Gordon-growth
 * perpetuity value FCF / (r − g), colour-graded from cheap to rich. The
 * selected cell drives a large readout. Cells where g ≥ r are flagged invalid
 * (the perpetuity diverges). Purely interactive — no animation — so
 * prefers-reduced-motion needs no special handling.
 */
export function DcfSensitivityExplorer({
  title = 'How fragile is a DCF? Move the dials',
  discountLabel = 'Discount rate (r)',
  growthLabel = 'Terminal growth (g)',
  valueLabel = 'Implied value',
  valuePrefix = '$',
  valueSuffix = '',
  baseCashFlow = 100,
  discountRates = DEFAULT_DISCOUNTS,
  growthRates = DEFAULT_GROWTHS,
  invalidLabel = 'undefined (g ≥ r)',
  caption = 'Nudge either dial a single percentage point and the answer can move by half. That is why a DCF is a range, never a point — and why the discount rate and terminal growth deserve the most scrutiny.',
  className,
}: DcfSensitivityExplorerProps) {
  const id = useId();
  // Default selection: a middle cell.
  const [sel, setSel] = useState<[number, number]>([
    Math.floor(discountRates.length / 2),
    Math.floor(growthRates.length / 2),
  ]);

  const valueAt = (ri: number, gi: number): number | null => {
    const r = discountRates[ri];
    const g = growthRates[gi];
    if (g >= r) return null;
    return baseCashFlow / (r - g);
  };

  const { minV, maxV } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let ri = 0; ri < discountRates.length; ri++) {
      for (let gi = 0; gi < growthRates.length; gi++) {
        const v = valueAt(ri, gi);
        if (v == null) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return { minV: lo, maxV: hi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountRates, growthRates, baseCashFlow]);

  const selVal = valueAt(sel[0], sel[1]);

  const fmt = (v: number) =>
    `${valuePrefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      Math.round(v),
    )}${valueSuffix}`;

  // Map a value to a 0..1 heat for background shading.
  const heat = (v: number) =>
    maxV === minV ? 0.5 : (v - minV) / (maxV - minV);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {valueLabel} for each combination of {discountLabel} and {growthLabel}.
            </caption>
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-ink-500">
                  {discountLabel} \ {growthLabel}
                </th>
                {growthRates.map((g, gi) => (
                  <th
                    key={`${id}-g-${gi}`}
                    scope="col"
                    className="px-2 py-1 text-center font-mono text-xs font-medium text-ink-600"
                  >
                    {pct(g)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discountRates.map((r, ri) => (
                <tr key={`${id}-r-${ri}`}>
                  <th
                    scope="row"
                    className="px-2 py-1 text-left font-mono text-xs font-medium text-ink-600"
                  >
                    {pct(r)}
                  </th>
                  {growthRates.map((g, gi) => {
                    const v = valueAt(ri, gi);
                    const selected = sel[0] === ri && sel[1] === gi;
                    const h = v != null ? heat(v) : 0;
                    return (
                      <td key={`${id}-cell-${ri}-${gi}`} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => setSel([ri, gi])}
                          aria-pressed={selected}
                          aria-label={`${discountLabel} ${pct(r)}, ${growthLabel} ${pct(
                            g,
                          )}: ${v != null ? fmt(v) : invalidLabel}`}
                          className={cx(
                            'flex h-9 w-full min-w-[3.25rem] items-center justify-center rounded-md font-mono text-xs tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                            v == null && 'bg-ink-100 text-ink-300',
                            selected && 'ring-2 ring-brand-600 ring-offset-1',
                          )}
                          style={
                            v != null
                              ? {
                                  // brand at high value (rich), surface-sunken at low
                                  backgroundColor: `color-mix(in oklab, var(--color-brand-500) ${Math.round(
                                    h * 70,
                                  )}%, var(--color-surface-sunken))`,
                                  color:
                                    h > 0.6
                                      ? 'var(--color-surface)'
                                      : 'var(--color-ink-900)',
                                }
                              : undefined
                          }
                        >
                          {v != null ? fmt(v) : '—'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-card border border-brand-100 bg-brand-50/60 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {valueLabel}
          </p>
          <p
            className="mt-1 font-mono text-3xl font-bold text-ink-900 tabular-nums"
            aria-live="polite"
          >
            {selVal != null ? fmt(selVal) : invalidLabel}
          </p>
          <p className="mt-2 text-xs text-ink-600">
            {discountLabel}: <span className="font-mono">{pct(discountRates[sel[0]])}</span>
            <br />
            {growthLabel}: <span className="font-mono">{pct(growthRates[sel[1]])}</span>
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DcfSensitivityExplorer;
