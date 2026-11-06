import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ThinkReveal} component. */
export interface ThinkRevealProps {
  /** The think-first question posed to the learner before revealing. */
  prompt: string;
  /** The answer/explanation shown after the learner clicks reveal. */
  text: string;
  /** Optional nudge the learner can request before revealing. */
  hint?: string;
  /** Label for the reveal button. Defaults to `'Reveal the answer'`. */
  buttonLabel?: string;
  /** Small label prefixed to the hint. Defaults to `'Hint'`. */
  hintLabel?: string;
  /** Eyebrow label above the prompt. Defaults to `'Think first'`. */
  eyebrow?: string;
  /** Extra classes merged onto the wrapper. */
  className?: string;
}

/**
 * Guess-then-reveal exercise: poses a question, lets the learner commit to an
 * answer in their head, then reveals the explanation on demand. The answer
 * lives in a string prop (never children) so nothing leaks into the static
 * HTML before the learner asks for it.
 */
export function ThinkReveal({
  prompt,
  text,
  hint,
  buttonLabel = 'Reveal the answer',
  hintLabel = 'Hint',
  eyebrow = 'Think first',
  className,
}: ThinkRevealProps) {
  if (!prompt || !text) {
    throw new Error('ThinkReveal requires both `prompt` and `text` props.');
  }
  const [revealed, setRevealed] = useState(false);
  const panelId = useId();
  const answerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (revealed) answerRef.current?.focus({ preventScroll: true });
  }, [revealed]);

  return (
    <section
      className={cx(
        'my-6 rounded-card border border-brand-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      <p className="mt-2 font-medium text-ink-900">{prompt}</p>
      {hint && !revealed && (
        <details className="mt-3 text-sm text-ink-600">
          <summary className="w-fit cursor-pointer rounded-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            {hintLabel}
          </summary>
          <p className="mt-2">{hint}</p>
        </details>
      )}
      <div aria-live="polite">
        <p
          id={panelId}
          ref={answerRef}
          hidden={!revealed}
          tabIndex={-1}
          className="mt-3 rounded-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
        >
          {revealed ? text : null}
        </p>
        {!revealed && (
          <button
            type="button"
            aria-expanded={false}
            aria-controls={panelId}
            onClick={() => setRevealed(true)}
            className="mt-4 rounded-pill bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </section>
  );
}

export default ThinkReveal;
