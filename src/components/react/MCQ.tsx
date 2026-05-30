import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single answer option for an {@link MCQ}. */
export interface MCQOption {
  /** Stable id. Auto-generated from the index when omitted. */
  id?: string;
  /** Option label shown to the user. */
  text: string;
  /** Whether this option is (part of) the correct answer. */
  correct?: boolean;
}

/** Props for the {@link MCQ} component. */
export interface MCQProps {
  /** The question prompt. */
  question: string;
  /** The selectable answer options. */
  options: MCQOption[];
  /** Optional explanation revealed after the user checks their answer. */
  explanation?: string;
  /** Allow selecting multiple options (checkboxes instead of radios). */
  allowMultiple?: boolean;
  /**
   * Called when the user checks their answer, reporting overall correctness.
   * Used by {@link Quiz} to track score. Fires once per check (re-fires after
   * a "Try again" + re-check).
   */
  onResult?: (correct: boolean) => void;
  /** Label for the button that checks the answer. Defaults to `'Check'`. */
  checkLabel?: string;
  /** Label for the button that resets the question. Defaults to `'Try again'`. */
  retryLabel?: string;
  /** Verdict shown when the answer is fully correct. Defaults to `'Correct!'`. */
  correctLabel?: string;
  /** Verdict shown when the answer is wrong. Defaults to `'Not quite.'`. */
  incorrectLabel?: string;
  /** Badge on a missed-correct option. Defaults to `'Correct answer'`. */
  correctAnswerLabel?: string;
  /** Heading above the revealed explanation. Defaults to `'Explanation'`. */
  explanationLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

interface NormalizedOption extends MCQOption {
  id: string;
  index: number;
}

/**
 * Multiple Choice Question island.
 *
 * Renders the prompt and a list of selectable option cards (radios by default,
 * checkboxes when {@link MCQProps.allowMultiple}). The user selects, then clicks
 * **Check**. After checking: correct picks turn success-green, wrong picks turn
 * danger-red, and any missed-correct options are outlined. The explanation (if
 * any) is revealed and the result is announced via `aria-live`. **Try again**
 * resets the question.
 *
 * Fully keyboard accessible: the option group is a `radiogroup`/`group`, and
 * each option is a real `<input>` so Space/Enter/Tab and arrow keys work
 * natively. All user-facing strings are props so the island stays
 * locale-agnostic.
 */
export function MCQ({
  question,
  options,
  explanation,
  allowMultiple = false,
  onResult,
  checkLabel = 'Check',
  retryLabel = 'Try again',
  correctLabel = 'Correct!',
  incorrectLabel = 'Not quite.',
  correctAnswerLabel = 'Correct answer',
  explanationLabel = 'Explanation',
  className,
}: MCQProps) {
  const groupId = useId();
  const normalized = useMemo<NormalizedOption[]>(
    () =>
      options.map((o, index) => ({
        ...o,
        index,
        id: o.id ?? `${groupId}-opt-${index}`,
      })),
    [options, groupId],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);

  const correctIds = useMemo(
    () => new Set(normalized.filter((o) => o.correct).map((o) => o.id)),
    [normalized],
  );

  const isAllCorrect = useMemo(() => {
    if (selected.size !== correctIds.size) return false;
    for (const id of selected) if (!correctIds.has(id)) return false;
    return true;
  }, [selected, correctIds]);

  const toggle = (id: string) => {
    if (checked) return;
    setSelected((prev) => {
      if (allowMultiple) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  };

  const handleCheck = () => {
    if (selected.size === 0) return;
    setChecked(true);
    onResult?.(isAllCorrect);
  };

  const handleReset = () => {
    setChecked(false);
    setSelected(new Set());
  };

  const optionState = (o: NormalizedOption): 'correct' | 'wrong' | 'missed' | 'neutral' => {
    if (!checked) return 'neutral';
    const isSelected = selected.has(o.id);
    if (isSelected && o.correct) return 'correct';
    if (isSelected && !o.correct) return 'wrong';
    if (!isSelected && o.correct) return 'missed';
    return 'neutral';
  };

  return (
    <div
      className={cx(
        'rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      <p
        id={`${groupId}-question`}
        className="mb-4 font-display text-base font-semibold text-balance text-ink-900 sm:text-lg"
      >
        {question}
      </p>

      <div
        role={allowMultiple ? 'group' : 'radiogroup'}
        aria-labelledby={`${groupId}-question`}
        className="flex flex-col gap-2.5"
      >
        {normalized.map((o) => {
          const isSelected = selected.has(o.id);
          const st = optionState(o);
          return (
            <label
              key={o.id}
              className={cx(
                'group flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-sm transition-all duration-200 motion-reduce:transition-none',
                'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1',
                !checked && 'hover:-translate-y-px',
                checked && 'cursor-default',
                st === 'neutral' &&
                  isSelected &&
                  'border-brand-400 bg-brand-50 text-ink-900 shadow-soft',
                st === 'neutral' &&
                  !isSelected &&
                  'border-ink-200 bg-surface text-ink-700 hover:border-brand-300 hover:bg-brand-50/60',
                st === 'correct' &&
                  'border-[color:var(--color-success)] bg-[color:var(--color-success)]/10 text-ink-900',
                st === 'wrong' &&
                  'border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-ink-900',
                st === 'missed' &&
                  'border-2 border-dashed border-[color:var(--color-success)] bg-surface text-ink-700',
              )}
            >
              <input
                type={allowMultiple ? 'checkbox' : 'radio'}
                name={groupId}
                value={o.id}
                checked={isSelected}
                disabled={checked}
                onChange={() => toggle(o.id)}
                className="h-4 w-4 shrink-0 accent-brand-600"
              />
              <span className="flex-1">{o.text}</span>
              {st === 'correct' && (
                <span aria-hidden className="text-[color:var(--color-success)]">✓</span>
              )}
              {st === 'wrong' && (
                <span aria-hidden className="text-[color:var(--color-danger)]">✕</span>
              )}
              {st === 'missed' && (
                <span className="text-xs font-medium text-[color:var(--color-success)]">
                  {correctAnswerLabel}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={handleCheck}
            disabled={selected.size === 0}
            className={cx(
              'inline-flex items-center rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200',
              'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
            )}
          >
            {checkLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center rounded-pill border border-ink-200 bg-surface px-5 py-2 text-sm font-semibold text-ink-700 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {retryLabel}
          </button>
        )}

        {checked && (
          <span
            className={cx(
              'text-sm font-semibold',
              isAllCorrect
                ? 'text-[color:var(--color-success)]'
                : 'text-[color:var(--color-danger)]',
            )}
          >
            {isAllCorrect ? correctLabel : incorrectLabel}
          </span>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {checked ? (isAllCorrect ? correctLabel : incorrectLabel) : ''}
      </div>

      {checked && explanation && (
        <div className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700 animate-fade-up">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-brand-700">
            {explanationLabel}
          </p>
          {explanation}
        </div>
      )}
    </div>
  );
}

export default MCQ;
