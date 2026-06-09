import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One investing scenario where the gut (System 1) and the deliberate check (System 2) diverge. */
export interface DualSystemScenario {
  /** A concrete market situation the reader might face. */
  prompt: string;
  /** The snap, intuitive reaction — what System 1 blurts out. */
  system1: string;
  /** The slow, deliberate check — what System 2 concludes. */
  system2: string;
  /** `true` when System 1 misleads here (a trap); `false` when the gut is fine. */
  trap: boolean;
}

export interface DualSystemPanelProps {
  /** Heading above the panel. */
  title?: string;
  /** One-line takeaway shown under the panel. */
  caption?: string;
  /** Column header for the System 1 traits. */
  system1Label?: string;
  /** Column header for the System 2 traits. */
  system2Label?: string;
  /** Trait bullets describing System 1. */
  system1Traits?: string[];
  /** Trait bullets describing System 2. */
  system2Traits?: string[];
  /** The investing scenarios stepped through below the columns (3–4 by default). */
  scenarios?: DualSystemScenario[];
  /** Label for the "previous scenario" button. */
  prevLabel?: string;
  /** Label for the "next scenario" button. */
  nextLabel?: string;
  /** Badge text when System 1 misleads. */
  trapLabel?: string;
  /** Badge text when System 1 is fine. */
  safeLabel?: string;
  /** Prefix shown before the System 1 reaction in the stepper card. */
  gutHeading?: string;
  /** Prefix shown before the System 2 check in the stepper card. */
  checkHeading?: string;
  /** Accessible prefix for the scenario counter, e.g. "Scenario {n} of {total}". */
  counterLabel?: string;
  className?: string;
}

const DEFAULT_SYSTEM1_TRAITS: string[] = [
  'Fast and automatic — fires before you decide to think',
  'Effortless and always on; never needs to be switched on',
  'Emotional: fear, greed and excitement steer it',
  'Pattern-hungry — sees trends and stories in pure noise',
  'Great in familiar, fast-feedback worlds (driving, faces)',
  'Confident even when it is dead wrong',
];

const DEFAULT_SYSTEM2_TRAITS: string[] = [
  'Slow and deliberate — the voice that says "wait, let me check"',
  'Effortful; thinking hard is tiring, so it stays lazy by default',
  'Logical: weighs probabilities, base rates and arithmetic',
  'Skeptical of tidy stories; asks for the actual evidence',
  'The only gear that can catch System 1 in the act',
  'Has to be deliberately engaged — it defers unless you call it',
];

const DEFAULT_SCENARIOS: DualSystemScenario[] = [
  {
    prompt: 'A fund has gone up five years in a row. The brochure shows a smooth, rising line.',
    system1: '"Five straight years — this manager has the magic touch. Buy it before I miss out."',
    system2:
      'Five up years can easily be luck across thousands of funds, and past returns barely predict future ones. Check the costs, the base rate of funds that keep winning, and whether the streak is just a hot market.',
    trap: true,
  },
  {
    prompt: 'A stock you own drops 30% on bad news. Your screen is a sea of red.',
    system1: '"I can\'t sell at a loss — I\'ll just wait until it gets back to what I paid."',
    system2:
      'The price you paid is irrelevant to what the stock is worth now. Re-decide from scratch: knowing only today\'s facts, would you buy it at this price? If not, the original purchase price is a trap, not a reason to hold.',
    trap: true,
  },
  {
    prompt: 'Markets just crashed and the news is wall-to-wall doom. Everyone is selling.',
    system1: '"Get out now before it falls further — protect what\'s left."',
    system2:
      'Selling after a crash locks in the loss and means buying back higher. Your long-term plan and time horizon did not change in a week. Panic is a feeling, not new information about the businesses you own.',
    trap: true,
  },
  {
    prompt: 'You set up an automatic monthly investment into a low-cost, diversified index fund.',
    system1: '"Boring. Set it and forget it — nothing exciting to watch here."',
    system2:
      'Boring is exactly right. Automating the decision removes the moments where fear and greed could hijack it. Here the gut\'s shrug and the deliberate check happen to agree — low cost, diversified, hands-off.',
    trap: false,
  },
];

export function DualSystemPanel({
  title = 'Two minds at the wheel: System 1 vs System 2',
  caption =
    'System 1 is the always-on gut that reacts in a heartbeat; System 2 is the slow, effortful checker that has to be switched on. Markets are noisy and adversarial, so the gut\'s confident snap answer is often a trap — step through the scenarios and watch the deliberate check rescue it.',
  system1Label = 'System 1 — fast, automatic, emotional',
  system2Label = 'System 2 — slow, effortful, logical',
  system1Traits = DEFAULT_SYSTEM1_TRAITS,
  system2Traits = DEFAULT_SYSTEM2_TRAITS,
  scenarios = DEFAULT_SCENARIOS,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  trapLabel = 'Gut misleads here',
  safeLabel = 'Gut is fine here',
  gutHeading = 'System 1 says',
  checkHeading = 'System 2 checks',
  counterLabel = 'Scenario {n} of {total}',
  className,
}: DualSystemPanelProps) {
  const id = useId();
  const [index, setIndex] = useState(0);

  const total = scenarios.length;
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;
  const current = scenarios[safeIndex];

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const counterText = counterLabel
    .replace('{n}', String(safeIndex + 1))
    .replace('{total}', String(total));

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Two trait columns: System 1 vs System 2 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section
          aria-label={system1Label}
          className="rounded-card border border-accent-200 bg-accent-50/50 p-4"
        >
          <h3 className="font-display text-sm font-semibold text-accent-700">
            {system1Label}
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-700">
            {system1Traits.map((trait, i) => (
              <li key={`${id}-s1-${i}`} className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-accent-500"
                  aria-hidden="true"
                />
                <span>{trait}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label={system2Label}
          className="rounded-card border border-brand-200 bg-brand-50/50 p-4"
        >
          <h3 className="font-display text-sm font-semibold text-brand-700">
            {system2Label}
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-700">
            {system2Traits.map((trait, i) => (
              <li key={`${id}-s2-${i}`} className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-brand-500"
                  aria-hidden="true"
                />
                <span>{trait}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Scenario stepper */}
      {current && (
        <div className="mt-5 rounded-card border border-ink-100 bg-surface-sunken/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
              {counterText}
            </span>
            <span
              className={cx(
                'rounded-pill px-3 py-0.5 text-xs font-semibold',
                current.trap
                  ? 'border border-[var(--color-danger)]/30 text-[var(--color-danger)]'
                  : 'border border-[var(--color-success)]/30 text-[var(--color-success)]',
              )}
              style={{
                backgroundColor: current.trap
                  ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
                  : 'color-mix(in srgb, var(--color-success) 10%, transparent)',
              }}
            >
              {current.trap ? trapLabel : safeLabel}
            </span>
          </div>

          <div aria-live="polite">
            <p className="mt-3 font-medium text-ink-900">{current.prompt}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-card border border-accent-200 bg-accent-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
                  {gutHeading}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                  {current.system1}
                </p>
              </div>
              <div className="rounded-card border border-brand-200 bg-brand-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {checkHeading}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                  {current.system2}
                </p>
              </div>
            </div>
          </div>

          {/* Stepper controls */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={safeIndex === 0}
              className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {prevLabel}
            </button>

            {/* Position dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {scenarios.map((_, i) => (
                <span
                  key={`${id}-dot-${i}`}
                  className={cx(
                    'h-2 w-2 rounded-pill transition-colors',
                    i === safeIndex ? 'bg-brand-500' : 'bg-ink-200',
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={safeIndex >= total - 1}
              className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DualSystemPanel;
