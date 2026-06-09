import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One piece of evidence weighed against a thesis. */
export interface ConfirmationItem {
  /** The evidence statement, in the lesson's locale. */
  text: string;
  /** `true` if it supports the thesis; `false` if it contradicts it. */
  supports: boolean;
}

export interface ConfirmationFunnelProps {
  /** Heading above the funnel. */
  title?: string;
  /** One-line takeaway shown under the funnel. */
  caption?: string;
  /** The belief being tested (e.g. "This stock is a sure winner."). */
  thesis?: string;
  /** Mixed list of supporting + contradicting evidence. */
  evidence?: ConfirmationItem[];
  /** Label over the (default) filtered column. */
  biasedViewLabel?: string;
  /** Label over the full-evidence view, shown after the toggle. */
  fullViewLabel?: string;
  /** Badge text on items that support the thesis. */
  supportTag?: string;
  /** Badge text on items that challenge the thesis. */
  contradictTag?: string;
  /** Accessible + visible label for the reveal toggle. */
  toggleLabel?: string;
  /** Label for the toggle once contradicting evidence is shown (re-hide). */
  hideLabel?: string;
  /** Prefix for the live count readout, e.g. "Evidence you let through". */
  countLabel?: string;
  /** Prose shown once the full picture is revealed. */
  revealNote?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_EVIDENCE: ConfirmationItem[] = [
  { text: 'The stock is up 40% since you bought it, so you were obviously right.', supports: true },
  { text: 'A popular finance influencer just called it "the buy of the decade".', supports: true },
  { text: 'Revenue grew 25% last quarter — proof the story is intact.', supports: true },
  { text: 'Three friends you trust also own it and keep talking it up.', supports: true },
  { text: 'But the company has missed its own profit guidance two quarters running.', supports: false },
  { text: 'Insiders — the executives who know most — have been quietly selling shares.', supports: false },
  { text: 'The whole sector is up just as much, so the gain may be the tide, not the boat.', supports: false },
  { text: 'It trades at 60× earnings while its rivals trade at 18×, a rich price to defend.', supports: false },
];

/**
 * Confirmation-bias funnel. A thesis sits at the top; a mixed pile of evidence
 * (some supporting, some contradicting) is poured through a "funnel". The
 * DEFAULT view shows only the confirming items — the picture confirmation bias
 * lets you see, the evidence that flatters a conclusion you already reached. A
 * single toggle reveals the contradicting evidence you were filtering out,
 * restoring the full, honest picture. The teaching point: a belief that only
 * ever meets agreeable facts has never actually been tested; seeking
 * disconfirmation (and writing a falsifiable thesis) is the antidote.
 *
 * Locale-agnostic — every user-facing string, including the thesis and the
 * evidence list, is a prop with a rich English default. SSR-safe and
 * deterministic (no randomness; the revealed/hidden state starts filtered).
 * Respects `prefers-reduced-motion`: hidden items appear instantly with no
 * height/opacity transition. The toggle is a keyboard-operable button with a
 * visible focus ring, and the count of what's currently visible is announced
 * via `aria-live`.
 */
export function ConfirmationFunnel({
  title = 'The confirmation funnel',
  caption =
    'Confirmation bias is a one-way filter: agreeable facts sail through, awkward ones get stopped at the door. The trouble is that a thesis which only ever meets evidence that flatters it has never really been tested. Open the funnel and look at what you were filtering out.',
  thesis = 'This stock is a sure winner.',
  evidence = DEFAULT_EVIDENCE,
  biasedViewLabel = 'What confirmation bias lets through',
  fullViewLabel = 'The evidence that actually exists',
  supportTag = 'Supports your view',
  contradictTag = 'Challenges your view',
  toggleLabel = "Reveal what you're filtering out",
  hideLabel = 'Hide it again',
  countLabel = 'Evidence in view',
  revealNote =
    'There it is — the evidence you were quietly ignoring. None of it proves you wrong on its own, but you can no longer pretend the case is one-sided. The fix is to go looking for the contradicting facts on purpose, and to write down in advance what would make you change your mind.',
  className,
}: ConfirmationFunnelProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const reducedRef = useRef(false);

  // Detect reduced-motion once on the client; SSR renders the safe default.
  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
  }, []);

  const supporting = evidence.filter((e) => e.supports);
  const contradicting = evidence.filter((e) => !e.supports);

  const visibleCount = revealed ? evidence.length : supporting.length;

  const toggle = () => {
    setRevealed((prev) => !prev);
  };

  const renderItem = (item: ConfirmationItem, key: string) => (
    <li
      key={key}
      className={cx(
        'flex items-start gap-3 rounded-card border p-3 text-sm',
        item.supports
          ? 'border-brand-200 bg-brand-50/60'
          : 'border-accent-200 bg-accent-50/60',
      )}
    >
      <span
        className={cx(
          'mt-0.5 inline-flex shrink-0 items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
          item.supports
            ? 'bg-brand-100 text-brand-700'
            : 'bg-accent-100 text-accent-700',
        )}
      >
        {item.supports ? supportTag : contradictTag}
      </span>
      <span className="text-ink-800">{item.text}</span>
    </li>
  );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* The thesis being tested */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/50 px-4 py-3">
        <p className="text-sm leading-relaxed text-ink-800">
          <span className="font-mono text-base font-semibold text-brand-700">
            “{thesis}”
          </span>
        </p>
      </div>

      {/* Funnel column heading + live count */}
      <div
        className="mt-5 flex flex-wrap items-baseline justify-between gap-2"
        aria-live="polite"
      >
        <h3 className="font-display text-sm font-semibold text-ink-900">
          {revealed ? fullViewLabel : biasedViewLabel}
        </h3>
        <span className="text-xs text-ink-500">
          {countLabel}: {visibleCount} / {evidence.length}
        </span>
      </div>

      {/* Evidence that passes the funnel — always the supporting items */}
      <ul className="mt-3 flex flex-col gap-2">
        {supporting.map((item, i) => renderItem(item, `support-${i}`))}
      </ul>

      {/* The filtered-out, contradicting evidence — revealed by the toggle */}
      <div
        className={cx(
          'grid overflow-hidden',
          reducedRef.current
            ? ''
            : 'transition-[grid-template-rows,opacity] duration-500 ease-out',
          revealed
            ? 'mt-2 grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!revealed}
      >
        <div className="min-h-0">
          <ul className="flex flex-col gap-2">
            {contradicting.map((item, i) => renderItem(item, `contradict-${i}`))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">{revealNote}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={revealed}
          aria-controls={`${id}-hidden`}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {revealed ? hideLabel : toggleLabel}
        </button>
        <span className="sr-only" id={`${id}-hidden`}>
          {revealed
            ? `${fullViewLabel}: ${evidence.length} of ${evidence.length} items shown, including ${contradicting.length} that challenge the thesis.`
            : `${biasedViewLabel}: ${supporting.length} of ${evidence.length} items shown; ${contradicting.length} contradicting items are filtered out.`}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ConfirmationFunnel;
