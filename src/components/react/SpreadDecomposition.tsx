import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SpreadComponentLabels {
  /** Order-processing / fixed-cost component. */
  processing?: string;
  /** Inventory / risk-holding component. */
  inventory?: string;
  /** Adverse-selection / informed-trader component. */
  adverseSelection?: string;
}

export interface SpreadDecompositionProps {
  /** Heading above the chart. */
  title?: string;
  /** Labels for the three spread components (legend + bar segments). */
  componentLabels?: SpreadComponentLabels;
  /** Label for the volatility scenario control group. */
  scenarioLabel?: string;
  /** Label for the calm-market preset. */
  calmLabel?: string;
  /** Label for the normal-market preset. */
  normalLabel?: string;
  /** Label for the volatile-market preset. */
  volatileLabel?: string;
  /** Label for the total-spread readout. */
  totalSpreadLabel?: string;
  /** Short descriptions of each component, shown beneath the bar. */
  processingNote?: string;
  inventoryNote?: string;
  adverseSelectionNote?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to the spread total. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

type Scenario = 'calm' | 'normal' | 'volatile';

/**
 * The three components of a market maker's quoted spread, in cents per share,
 * stacked into a single bar — and how the mix shifts with market conditions.
 *   • order-processing cost (roughly fixed),
 *   • inventory-holding risk (grows with volatility),
 *   • adverse-selection cost (grows fastest when informed traders lurk).
 * The learner flips between calm / normal / volatile regimes and watches the
 * bar grow — almost entirely because the inventory and adverse-selection slices
 * swell, while the processing slice barely moves. This makes the abstract
 * "spread = compensation for three distinct risks" decomposition concrete and
 * visual. No animation loop, so reduced motion needs no special path; the only
 * transition is a width tween which CSS disables under reduced-motion globally.
 * Locale-agnostic via props; the actual cent figures live in the MDX prose.
 */
const SCENARIOS: Record<Scenario, { processing: number; inventory: number; adverse: number }> = {
  // cents per share
  calm: { processing: 1, inventory: 0.5, adverse: 0.5 },
  normal: { processing: 1, inventory: 2, adverse: 3 },
  volatile: { processing: 1, inventory: 5, adverse: 10 },
};

export function SpreadDecomposition({
  title = 'What you pay for in a spread',
  componentLabels,
  scenarioLabel = 'Market conditions',
  calmLabel = 'Calm',
  normalLabel = 'Normal',
  volatileLabel = 'Volatile',
  totalSpreadLabel = 'Quoted spread',
  processingNote = 'Roughly fixed: the cost of running the matching engine, clearing, and back-office. It barely changes with the weather.',
  inventoryNote = 'The risk of being stuck holding shares whose price moves against the maker before they can offload them. It grows with volatility.',
  adverseSelectionNote = 'The risk that whoever just traded with the maker knew something they did not. It grows fastest when informed traders are active.',
  caption = 'A spread is not a single fee — it is three risks bundled together. When markets get scary, the spread widens mostly because the inventory and adverse-selection slices balloon, not because processing got more expensive.',
  currencyPrefix = '$',
  className,
}: SpreadDecompositionProps) {
  const id = useId();
  const [scenario, setScenario] = useState<Scenario>('normal');

  const labels = {
    processing: componentLabels?.processing ?? 'Order processing',
    inventory: componentLabels?.inventory ?? 'Inventory risk',
    adverseSelection: componentLabels?.adverseSelection ?? 'Adverse selection',
  };

  const s = SCENARIOS[scenario];
  const total = s.processing + s.inventory + s.adverse;

  // Fix the axis to the worst scenario so growth reads as growth, not rescaling.
  const axisMax = useMemo(() => {
    const worst = SCENARIOS.volatile;
    return worst.processing + worst.inventory + worst.adverse;
  }, []);

  const cents = (v: number) => `${v.toFixed(1)}¢`;
  const dollars = (v: number) =>
    `${currencyPrefix}${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

  const segments = [
    { key: 'processing', value: s.processing, label: labels.processing, color: 'bg-ink-400', text: 'text-ink-600', note: processingNote },
    { key: 'inventory', value: s.inventory, label: labels.inventory, color: 'bg-brand-500', text: 'text-brand-700', note: inventoryNote },
    { key: 'adverse', value: s.adverse, label: labels.adverseSelection, color: 'bg-accent-500', text: 'text-accent-700', note: adverseSelectionNote },
  ];

  const scenarios: Array<{ value: Scenario; label: string }> = [
    { value: 'calm', label: calmLabel },
    { value: 'normal', label: normalLabel },
    { value: 'volatile', label: volatileLabel },
  ];

  const ariaLabel = `${title}. ${totalSpreadLabel}: ${cents(total)}. ${labels.processing} ${cents(
    s.processing,
  )}, ${labels.inventory} ${cents(s.inventory)}, ${labels.adverseSelection} ${cents(s.adverse)}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
          {totalSpreadLabel}: {cents(total)} · {dollars(total)}
        </span>
      </figcaption>

      {/* Scenario selector */}
      <div className="mt-4">
        <p className="text-sm text-ink-700" id={`${id}-scn`}>
          {scenarioLabel}
        </p>
        <div className="mt-2 inline-flex gap-2" role="group" aria-labelledby={`${id}-scn`}>
          {scenarios.map((sc) => {
            const active = scenario === sc.value;
            return (
              <button
                key={sc.value}
                type="button"
                onClick={() => setScenario(sc.value)}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="mt-5">
        <div className="flex h-12 w-full overflow-hidden rounded-pill bg-surface-sunken ring-1 ring-ink-100">
          {segments.map((seg) => (
            <div
              key={seg.key}
              className={cx('flex items-center justify-center transition-all duration-500 ease-out', seg.color)}
              style={{ width: `${(seg.value / axisMax) * 100}%` }}
              aria-hidden="true"
            >
              {seg.value / axisMax > 0.08 ? (
                <span className="px-1 font-mono text-xs font-semibold text-white">{cents(seg.value)}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + notes */}
      <dl className="mt-4 space-y-3">
        {segments.map((seg) => (
          <div key={seg.key} className="flex gap-3">
            <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-sm', seg.color)} aria-hidden="true" />
            <div>
              <dt className={cx('text-sm font-semibold', seg.text)}>
                {seg.label} · <span className="font-mono">{cents(seg.value)}</span>
              </dt>
              <dd className="text-sm leading-relaxed text-ink-600">{seg.note}</dd>
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SpreadDecomposition;
