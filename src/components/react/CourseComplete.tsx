import { useEffect, useState } from 'react';
import { cx } from '@/components/react/cx';
import { isCourseFinished, onProgressChange, setCourseFinished } from '@/lib/progress';

/** Props for {@link CourseComplete}. */
export interface CourseCompleteProps {
  /** Bare topic slug — the stable id stored in localStorage. */
  slug: string;
  /** Button label while the course is *not* finished. */
  markLabel?: string;
  /** Heading shown once the course *is* finished. */
  finishedLabel?: string;
  /** Sub-text while not finished (the call to action). */
  markHint?: string;
  /** Sub-text once finished (confirmation). */
  finishedHint?: string;
  /** Accessible label for the "undo / mark unfinished" control. */
  undoLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Topic-page completion control. Lets a learner mark a whole course finished;
 * the state lives in localStorage (see `@/lib/progress`) and is reflected here
 * and on the catalog graph. Hydrates from storage on mount to avoid an SSR
 * flash, announces the change via `aria-live`, and respects reduced motion.
 */
export function CourseComplete({
  slug,
  markLabel = 'Mark course as finished',
  finishedLabel = 'Course finished',
  markHint = 'Done with every lesson? Lock it in — your progress is saved on this device.',
  finishedHint = 'Nice work. This course is saved as complete on this device.',
  undoLabel = 'Mark as not finished',
  className,
}: CourseCompleteProps) {
  // Start `null` = "unknown" so the first paint matches the server (no flash),
  // then resolve from storage on mount and stay in sync with other islands.
  const [finished, setFinished] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setFinished(isCourseFinished(slug));
    sync();
    return onProgressChange(sync);
  }, [slug]);

  const isFinished = finished === true;

  return (
    <section
      className={cx(
        'rounded-card border p-5 shadow-soft transition-colors sm:p-6',
        isFinished
          ? 'border-brand-200 bg-brand-50/60'
          : 'border-ink-200 bg-surface',
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cx(
              'grid h-10 w-10 shrink-0 place-items-center rounded-pill transition-all duration-300 motion-reduce:transition-none',
              isFinished
                ? 'bg-brand-600 text-white scale-100'
                : 'bg-ink-100 text-ink-400 scale-95',
            )}
          >
            {/* Check mark — same glyph throughout, just recolored when done. */}
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10.5l3.2 3.2L15 7" />
            </svg>
          </span>
          <div>
            <p className="font-display font-semibold text-ink-900">
              {isFinished ? finishedLabel : markLabel}
            </p>
            <p className="mt-0.5 text-sm text-ink-500">
              {isFinished ? finishedHint : markHint}
            </p>
          </div>
        </div>

        <div className="shrink-0" aria-live="polite">
          {finished === null ? (
            // Pre-hydration placeholder keeps layout stable; never SSR-mismatches.
            <span className="inline-block h-10 w-44 rounded-pill bg-ink-100/60" aria-hidden="true" />
          ) : isFinished ? (
            <button
              type="button"
              onClick={() => setCourseFinished(slug, false)}
              className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-surface px-4 py-2 font-display text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {undoLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCourseFinished(slug, true)}
              className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-5 py-2.5 font-display text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 10.5l3.2 3.2L15 7" />
              </svg>
              {markLabel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default CourseComplete;
