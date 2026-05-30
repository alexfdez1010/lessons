import { useMemo, useState } from 'react';
import { MCQ, type MCQProps } from '@/components/react/MCQ';
import { cx } from '@/components/react/cx';

/** Props for the {@link Quiz} component. */
export interface QuizProps {
  /** Optional heading shown above the quiz. */
  title?: string;
  /**
   * The questions to render, sequentially. Each entry is a full set of
   * {@link MCQProps} (minus `onResult`, which the Quiz supplies internally).
   */
  questions: MCQProps[];
  /** Label prefix for the progress indicator, e.g. "Question 1 of 5". Defaults to `'Question'`. */
  questionLabel?: string;
  /** Connector word in the progress indicator, e.g. "Question 1 of 5". Defaults to `'of'`. */
  ofLabel?: string;
  /** Label for the advance button. Defaults to `'Next'`. */
  nextLabel?: string;
  /** Label for the go-back button. Defaults to `'Back'`. */
  backLabel?: string;
  /** Label shown before the final score, e.g. "You scored 4 / 5". Defaults to `'You scored'`. */
  scoreLabel?: string;
  /** Label for the restart button on the results screen. Defaults to `'Restart'`. */
  restartLabel?: string;
  /** Forwarded to each {@link MCQ} as its check-answer label. Defaults to `'Check'`. */
  checkLabel?: string;
  /** Forwarded to each {@link MCQ} as its try-again label. Defaults to `'Try again'`. */
  retryLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Multi-question quiz wrapping several {@link MCQ}s.
 *
 * Shows one question at a time with a "Question N of M" indicator plus a brand
 * progress bar, and Back/Next controls. Advancing is gated until the current
 * question has been answered (checked). After the last question a score screen
 * ("You scored 4 / 5") is shown with a Restart button.
 *
 * Correctness is captured through each MCQ's `onResult` callback.
 */
export function Quiz({
  title,
  questions,
  questionLabel = 'Question',
  ofLabel = 'of',
  nextLabel = 'Next',
  backLabel = 'Back',
  scoreLabel = 'You scored',
  restartLabel = 'Restart',
  checkLabel = 'Check',
  retryLabel = 'Try again',
  className,
}: QuizProps) {
  const total = questions.length;
  const [current, setCurrent] = useState(0);
  // results[i] === undefined => unanswered; otherwise the correctness boolean.
  const [results, setResults] = useState<Array<boolean | undefined>>(() =>
    Array.from({ length: total }, () => undefined),
  );
  const [finished, setFinished] = useState(false);

  const score = useMemo(() => results.filter((r) => r === true).length, [results]);
  const answeredCurrent = results[current] !== undefined;
  const isLast = current === total - 1;

  const recordResult = (index: number, correct: boolean) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = correct;
      return next;
    });
  };

  const goNext = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setCurrent((c) => Math.min(c + 1, total - 1));
    }
  };
  const goBack = () => setCurrent((c) => Math.max(c - 1, 0));

  const restart = () => {
    setResults(Array.from({ length: total }, () => undefined));
    setCurrent(0);
    setFinished(false);
  };

  if (total === 0) {
    return null;
  }

  const progressPct = finished ? 100 : Math.round(((current + (answeredCurrent ? 1 : 0)) / total) * 100);

  return (
    <section
      aria-label={title ?? 'Quiz'}
      className={cx(
        'rounded-card border border-ink-200 bg-surface-muted p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      {title && (
        <h3 className="mb-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
      )}

      {/* Progress header */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-500">
          <span aria-live="polite">
            {finished
              ? 'Complete'
              : `${questionLabel} ${current + 1} ${ofLabel} ${total}`}
          </span>
          <span>{score} correct</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-pill bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div
            className="h-full rounded-pill bg-brand-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {finished ? (
        <div className="rounded-card border border-brand-200 bg-surface p-6 text-center shadow-soft animate-fade-up">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-brand-600">
            Quiz complete
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-900">
            {scoreLabel} {score} / {total}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {score === total
              ? 'Perfect score — nicely done!'
              : score >= total / 2
                ? 'Good work — review the ones you missed.'
                : 'Keep practicing — you’ve got this.'}
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-5 inline-flex items-center rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {restartLabel}
          </button>
        </div>
      ) : (
        <>
          {/* Render only the active question; key forces fresh MCQ state per slot. */}
          <MCQ
            key={current}
            checkLabel={checkLabel}
            retryLabel={retryLabel}
            {...questions[current]}
            onResult={(correct) => recordResult(current, correct)}
          />

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={current === 0}
              className={cx(
                'inline-flex items-center rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-semibold text-ink-700 transition-colors duration-200',
                'hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-surface',
              )}
            >
              {backLabel}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!answeredCurrent}
              className={cx(
                'inline-flex items-center rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200',
                'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
              )}
            >
              {isLast ? 'See results' : nextLabel}
            </button>
          </div>
          {!answeredCurrent && (
            <p className="mt-2 text-right text-xs text-ink-400">
              Check your answer to continue.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default Quiz;
