import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MatchPair {
  /** The concept/term shown on the left. */
  term: string;
  /** Its correct definition shown (shuffled) on the right. */
  definition: string;
}

export interface MatchConceptsProps {
  /** Concept → definition pairs to match. */
  pairs: MatchPair[];
  /** Optional prompt shown above the exercise. */
  question?: string;
  /** Explanation revealed after checking. */
  explanation?: string;
  /** Label for the check button. */
  checkLabel?: string;
  /** Label for the retry button. */
  retryLabel?: string;
  /** Hint shown while pairing, e.g. "Pick a term, then its definition". */
  instructions?: string;
  /** Called with the overall result so a parent (e.g. Quiz) can aggregate. */
  onResult?: (correct: boolean) => void;
  className?: string;
}

/** Deterministic-ish shuffle seeded by length so SSR/CSR agree without Math.random churn. */
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function MatchConcepts({
  pairs,
  question,
  explanation,
  checkLabel = 'Check',
  retryLabel = 'Try again',
  instructions = 'Pick a term, then click its definition.',
  onResult,
  className,
}: MatchConceptsProps) {
  const reactId = useId();
  // Shuffled definition order (indices into `pairs`).
  const defOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), [pairs]);
  // assignment[termIndex] = pairs-index of the chosen definition (or null).
  const [assignment, setAssignment] = useState<(number | null)[]>(
    () => pairs.map(() => null),
  );
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const assignDefinition = (defIndex: number) => {
    if (checked || activeTerm === null) return;
    setAssignment((prev) => {
      const next = prev.slice();
      // A definition can only be used once — clear any other term holding it.
      for (let t = 0; t < next.length; t++) {
        if (next[t] === defIndex) next[t] = null;
      }
      next[activeTerm] = defIndex;
      return next;
    });
    setActiveTerm(null);
  };

  const allAssigned = assignment.every((a) => a !== null);
  const correctCount = assignment.filter((a, t) => a === t).length;
  const allCorrect = correctCount === pairs.length;

  const check = () => {
    setChecked(true);
    onResult?.(allCorrect);
  };

  const reset = () => {
    setChecked(false);
    setActiveTerm(null);
    setAssignment(pairs.map(() => null));
  };

  return (
    <div
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      {question ? <p className="font-medium text-ink-900">{question}</p> : null}
      {!checked ? (
        <p className="mt-1 text-sm text-ink-500">{instructions}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Terms */}
        <ul className="space-y-2" role="group" aria-label="Terms">
          {pairs.map((pair, t) => {
            const assigned = assignment[t];
            const isActive = activeTerm === t;
            const showCorrect = checked && assigned === t;
            const showWrong = checked && assigned !== t;
            return (
              <li key={`${reactId}-term-${t}`}>
                <button
                  type="button"
                  onClick={() => !checked && setActiveTerm(isActive ? null : t)}
                  disabled={checked}
                  aria-pressed={isActive}
                  className={cx(
                    'flex w-full flex-col gap-1 rounded-card border px-4 py-2.5 text-left text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    !checked && 'hover:border-brand-300 hover:bg-brand-50',
                    isActive && !checked && 'border-brand-400 bg-brand-50 ring-2 ring-brand-300',
                    showCorrect && 'border-success-400 bg-success-50',
                    showWrong && 'border-danger-400 bg-danger-50',
                    !isActive && !showCorrect && !showWrong && 'border-ink-100',
                  )}
                >
                  <span className="font-semibold text-ink-900">{pair.term}</span>
                  <span className="text-xs text-ink-500">
                    {assigned !== null
                      ? pairs[assigned].definition
                      : isActive
                        ? '→ now pick a definition'
                        : 'not linked yet'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Definitions (shuffled) */}
        <ul className="space-y-2" role="group" aria-label="Definitions">
          {defOrder.map((defIndex) => {
            const usedBy = assignment.indexOf(defIndex);
            const isUsed = usedBy !== -1;
            return (
              <li key={`${reactId}-def-${defIndex}`}>
                <button
                  type="button"
                  onClick={() => assignDefinition(defIndex)}
                  disabled={checked || activeTerm === null}
                  className={cx(
                    'w-full rounded-card border px-4 py-2.5 text-left text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    'disabled:cursor-not-allowed',
                    activeTerm !== null && !checked && 'hover:border-brand-300 hover:bg-brand-50',
                    isUsed ? 'border-brand-200 bg-brand-50/50 text-ink-500' : 'border-ink-100 text-ink-700',
                  )}
                >
                  {pairs[defIndex].definition}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {!checked ? (
        <button
          type="button"
          onClick={check}
          disabled={!allAssigned}
          className={cx(
            'mt-4 rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition',
            'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {checkLabel}
        </button>
      ) : (
        <div className="mt-4" aria-live="polite">
          <p
            className={cx(
              'font-semibold',
              allCorrect ? 'text-success-700' : 'text-danger-700',
            )}
          >
            {allCorrect
              ? '✓ All matched'
              : `✗ ${correctCount} / ${pairs.length} correct`}
          </p>
          {explanation ? <p className="mt-1 text-sm text-ink-600">{explanation}</p> : null}
          <button
            type="button"
            onClick={reset}
            className={cx(
              'mt-3 rounded-pill border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-700 transition',
              'hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            )}
          >
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default MatchConcepts;
