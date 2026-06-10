import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One metric (multiple) the learner can switch between. */
export interface MultipleMetric {
  /** Short key shown on the toggle, e.g. "P/E". */
  key: string;
  /** Longer description shown under the chart for the active metric. */
  blurb: string;
}

/** One company being compared, with a value per metric (keyed by metric key). */
export interface MultiplesCompany {
  /** Company name / label. */
  name: string;
  /** Map of metric key → multiple value. */
  values: Record<string, number>;
  /** Optional one-line note shown when this company is the highest on a metric. */
  note?: string;
}

export interface MultiplesCompareProps {
  /** Heading above the chart. */
  title?: string;
  /** The metrics the learner can toggle between. */
  metrics?: MultipleMetric[];
  /** The companies compared. */
  companies?: MultiplesCompany[];
  /** Suffix appended to each bar value. Defaults to `'×'`. */
  valueSuffix?: string;
  /** Accessible label for the metric toggle group. Defaults to `'Choose a multiple'`. */
  groupLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

const DEFAULT_METRICS: MultipleMetric[] = [
  {
    key: 'P/E',
    blurb: 'Price ÷ earnings per share — what you pay for each unit of profit. Ignores debt.',
  },
  {
    key: 'EV/EBITDA',
    blurb:
      'Enterprise value ÷ operating cash earnings — capital-structure-neutral, so it compares debt-heavy and debt-free firms fairly.',
  },
  {
    key: 'P/B',
    blurb: 'Price ÷ book value of equity — what you pay per unit of accounting net worth.',
  },
];

const DEFAULT_COMPANIES: MultiplesCompany[] = [
  { name: 'SteadyUtility', values: { 'P/E': 14, 'EV/EBITDA': 8, 'P/B': 1.5 } },
  { name: 'AverageCo', values: { 'P/E': 20, 'EV/EBITDA': 11, 'P/B': 3 } },
  { name: 'HyperGrowth', values: { 'P/E': 45, 'EV/EBITDA': 28, 'P/B': 9 } },
];

/**
 * Side-by-side valuation-multiple comparer. Pick a multiple (P/E, EV/EBITDA,
 * P/B) and the bars re-scale to compare each company on that yardstick, so the
 * learner sees how the *ranking and spread* change depending on which multiple
 * you trust. A short blurb explains what the active multiple actually measures.
 * No timed animation (bar widths transition on toggle), so prefers-reduced-
 * motion needs no special handling beyond respecting the global transition
 * reset.
 */
export function MultiplesCompare({
  title = 'Same companies, different yardsticks',
  metrics = DEFAULT_METRICS,
  companies = DEFAULT_COMPANIES,
  valueSuffix = '×',
  groupLabel = 'Choose a multiple',
  caption = 'A company can look cheap on one multiple and expensive on another. Always ask which yardstick a "cheap" claim is using — and whether it accounts for debt and growth.',
  className,
}: MultiplesCompareProps) {
  const id = useId();
  const [active, setActive] = useState(0);
  const metric = metrics[active];

  const values = companies.map((c) => c.values[metric.key] ?? 0);
  const maxV = Math.max(...values, 0.0001);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Metric toggle */}
      <div
        role="tablist"
        aria-label={groupLabel}
        className="mt-4 inline-flex flex-wrap gap-1 rounded-pill border border-ink-200 bg-surface-sunken/60 p-1"
      >
        {metrics.map((m, i) => (
          <button
            key={`${id}-m-${i}`}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={cx(
              'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
              active === i
                ? 'bg-brand-600 text-white shadow-soft'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {m.key}
          </button>
        ))}
      </div>

      {/* Bars */}
      <div className="mt-5 space-y-3" aria-live="polite">
        {companies.map((c, i) => {
          const v = c.values[metric.key] ?? 0;
          const widthPct = (v / maxV) * 100;
          const isMax = v === maxV;
          return (
            <div
              key={`${id}-c-${i}`}
              className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3"
            >
              <span className="truncate text-sm text-ink-700">{c.name}</span>
              <span className="relative block h-7 rounded-pill bg-surface-sunken/60">
                <span
                  className={cx(
                    'absolute left-0 top-0 h-7 rounded-pill transition-all duration-500 ease-out',
                    isMax ? 'bg-accent-500' : 'bg-brand-500',
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="text-right font-mono text-sm font-semibold tabular-nums text-ink-900">
                {v}
                {valueSuffix}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 text-sm text-ink-700">
        <span className="font-semibold text-ink-900">{metric.key}:</span> {metric.blurb}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MultiplesCompare;
