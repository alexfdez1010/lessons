import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export type AttackType = 'none' | 'front' | 'back' | 'sandwich';

export interface BlockOrderTimelineProps {
  /** Heading above the block diagram. */
  title?: string;
  /** Label for the victim transaction slot. Defaults to `'Victim tx'`. */
  victimLabel?: string;
  /** Label for an attacker transaction slot. Defaults to `'Attacker tx'`. */
  attackerLabel?: string;
  /**
   * The unrelated transactions that fill out the rest of the block, top to
   * bottom. The victim is inserted in the middle. Defaults to four neutral
   * placeholders.
   */
  otherTxLabels?: string[];
  /** Label for the "None" button (no attack — baseline ordering). Defaults to `'None'`. */
  noneLabel?: string;
  /** Label for the front-run button. Defaults to `'Front-run'`. */
  frontLabel?: string;
  /** Label for the back-run button. Defaults to `'Back-run'`. */
  backLabel?: string;
  /** Label for the sandwich button. Defaults to `'Sandwich'`. */
  sandwichLabel?: string;
  /** Explanation shown when "None" is selected. */
  noneExplanation?: string;
  /** Explanation shown when "Front-run" is selected. */
  frontExplanation?: string;
  /** Explanation shown when "Back-run" is selected. */
  backExplanation?: string;
  /** Explanation shown when "Sandwich" is selected. */
  sandwichExplanation?: string;
  /** Small label naming the attacker's *first* (before-victim) tx. Defaults to `'Buy before'`. */
  attackerBeforeLabel?: string;
  /** Small label naming the attacker's *second* (after-victim) tx. Defaults to `'Sell after'`. */
  attackerAfterLabel?: string;
  /** Label for the group of attack buttons. Defaults to `'Choose the attacker\'s position'`. */
  controlsLabel?: string;
  /** Caption that reads the block top-to-bottom for the aria-live region. Defaults to `'Block order, earliest first'`. */
  orderingLabel?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A rendered slot in the block. */
interface Slot {
  key: string;
  /** What kind of transaction sits in this slot. */
  kind: 'other' | 'victim' | 'attacker-before' | 'attacker-after';
  /** Display label for the slot. */
  label: string;
  /** Sublabel (attacker txs only). */
  sub?: string;
}

/**
 * Interactive explainer for the three positions an MEV attacker can take
 * relative to a victim transaction inside a block. The block is drawn as an
 * ordered, top-to-bottom list of transaction slots (top = executes first).
 * One slot is the highlighted victim. The learner picks an attack type and
 * the attacker transaction(s) slide into the correct slot(s):
 *
 *   - Front-run  → one attacker tx inserted directly ABOVE the victim.
 *   - Back-run   → one attacker tx inserted directly BELOW the victim.
 *   - Sandwich   → attacker txs both ABOVE and BELOW the victim.
 *   - None       → the baseline block with no attacker txs.
 *
 * A per-attack explanation line (a prop) says what that ordering buys the
 * attacker. New slots fade/slide in; `prefers-reduced-motion` snaps them.
 * Locale-agnostic — every user-facing string is a prop with an English
 * default. No numbers or LaTeX inside; the math lives in the surrounding MDX.
 */
export function BlockOrderTimeline({
  title = 'Where the attacker sits in the block',
  victimLabel = 'Victim tx',
  attackerLabel = 'Attacker tx',
  otherTxLabels,
  noneLabel = 'None',
  frontLabel = 'Front-run',
  backLabel = 'Back-run',
  sandwichLabel = 'Sandwich',
  noneExplanation = 'No attacker transactions — this is the honest block. The victim trade simply executes in its place.',
  frontExplanation = 'The attacker places a transaction just before the victim, buying ahead of the victim’s buy to push the price up — so the victim fills at a worse price.',
  backExplanation = 'The attacker places a transaction just after the victim, capturing the price move (or arbitrage) the victim’s trade just created.',
  sandwichExplanation = 'Both at once: buy before the victim to lift the price, then sell right after at the inflated price. The victim is squeezed in the middle.',
  attackerBeforeLabel = 'Buy before',
  attackerAfterLabel = 'Sell after',
  controlsLabel = 'Choose the attacker’s position',
  orderingLabel = 'Block order, earliest first',
  caption = 'A block is just an ordered list, and ordering is power: standing in front of, behind, or on both sides of a known trade lets an attacker profit at the victim’s expense. That is MEV — value extracted purely from choosing where a transaction lands.',
  className,
}: BlockOrderTimelineProps) {
  const id = useId();
  const [attack, setAttack] = useState<AttackType>('none');

  const others =
    otherTxLabels && otherTxLabels.length > 0
      ? otherTxLabels
      : ['Other tx', 'Other tx', 'Other tx', 'Other tx'];

  // Split the neutral transactions so the victim sits roughly in the middle.
  const splitAt = Math.ceil(others.length / 2);
  const above = others.slice(0, splitAt);
  const below = others.slice(splitAt);

  // Build the ordered block, top (earliest) to bottom (latest).
  const slots: Slot[] = [];
  above.forEach((label, i) => slots.push({ key: `above-${i}`, kind: 'other', label }));
  if (attack === 'front' || attack === 'sandwich') {
    slots.push({
      key: 'attacker-before',
      kind: 'attacker-before',
      label: attackerLabel,
      sub: attackerBeforeLabel,
    });
  }
  slots.push({ key: 'victim', kind: 'victim', label: victimLabel });
  if (attack === 'back' || attack === 'sandwich') {
    slots.push({
      key: 'attacker-after',
      kind: 'attacker-after',
      label: attackerLabel,
      sub: attackerAfterLabel,
    });
  }
  below.forEach((label, i) => slots.push({ key: `below-${i}`, kind: 'other', label }));

  const reduced = prefersReducedMotion();

  const explanation =
    attack === 'front'
      ? frontExplanation
      : attack === 'back'
        ? backExplanation
        : attack === 'sandwich'
          ? sandwichExplanation
          : noneExplanation;

  const buttons: Array<{ value: AttackType; label: string }> = [
    { value: 'none', label: noneLabel },
    { value: 'front', label: frontLabel },
    { value: 'back', label: backLabel },
    { value: 'sandwich', label: sandwichLabel },
  ];

  // Human-readable, top-to-bottom ordering for screen readers.
  const orderingDescription = slots
    .map((s) => (s.kind === 'victim' ? s.label : s.sub ? `${s.label} (${s.sub})` : s.label))
    .join(', ');

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
          {victimLabel}
        </span>
      </figcaption>

      {/* The ordered block of transaction slots, earliest at the top. */}
      <ol
        className="mt-4 flex flex-col gap-2 rounded-card border border-dashed border-ink-200 bg-surface-sunken/40 p-3"
        aria-label={`${orderingLabel}: ${orderingDescription}.`}
      >
        {slots.map((s) => {
          const isVictim = s.kind === 'victim';
          const isAttacker = s.kind === 'attacker-before' || s.kind === 'attacker-after';
          return (
            <li
              key={s.key}
              className={cx(
                'flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-sm',
                !reduced && 'motion-safe:animate-fade-up',
                isVictim && 'border-brand-600 bg-brand-50 ring-2 ring-brand-600 ring-offset-1',
                isAttacker && 'border-warning/60 bg-warning/10',
                !isVictim && !isAttacker && 'border-ink-200 bg-surface',
              )}
            >
              <span
                className={cx(
                  'flex items-center gap-2 font-medium',
                  isVictim && 'text-brand-700',
                  isAttacker && 'text-warning',
                  !isVictim && !isAttacker && 'text-ink-500',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'inline-block h-2.5 w-2.5 rounded-pill',
                    isVictim && 'bg-brand-600',
                    isAttacker && 'bg-warning',
                    !isVictim && !isAttacker && 'bg-ink-300',
                  )}
                />
                {s.label}
              </span>
              {s.sub && (
                <span className="rounded-pill bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                  {s.sub}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Attack-type selector */}
      <div className="mt-4">
        <p className="text-sm text-ink-700" id={`${id}-controls`}>
          {controlsLabel}
        </p>
        <div
          className="mt-2 inline-flex flex-wrap gap-2"
          role="group"
          aria-labelledby={`${id}-controls`}
        >
          {buttons.map((b) => {
            const active = attack === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setAttack(b.value)}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-attack explanation */}
      <p
        aria-live="polite"
        className="mt-4 min-h-[3rem] rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3 text-sm leading-relaxed text-ink-700"
      >
        {explanation}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BlockOrderTimeline;
