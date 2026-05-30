import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/react/cx';

/** A single stage in a {@link StepThrough}. */
export interface Step {
  /** Short heading for the step. */
  title: string;
  /** Body text (plain / lightweight markdown-ish string). */
  body: string;
}

/** Normalized step used internally, supporting both the array and children APIs. */
interface NormalizedStep {
  title?: ReactNode;
  content: ReactNode;
}

/** Props for the {@link StepThrough} component. */
export interface StepThroughProps {
  /**
   * Ordered list of steps to walk through. Optional when steps are supplied as
   * children instead — each child element becomes one step, and an optional
   * `data-step-title` attribute on the child supplies that step's heading.
   */
  steps?: Step[];
  /** Step content authored as child elements (alternative to {@link steps}). */
  children?: ReactNode;
  /** Label for the advance button. Defaults to `'Next'`. */
  nextLabel?: string;
  /** Label for the go-back button. Defaults to `'Back'`. */
  prevLabel?: string;
  /** Prefix for the progress counter, e.g. "Step 1 of 4". Defaults to `'Step'`. */
  stepLabel?: string;
  /** Connector for the progress counter, e.g. "Step 1 of 4". Defaults to `'of'`. */
  ofLabel?: string;
  /** Accessible name for the dots indicator. Defaults to `'Steps'`. */
  stepsLabel?: string;
  /** Accessible label prefix for each dot, e.g. "Go to step 2: …". Defaults to `'Go to step'`. */
  goToStepLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Interactive stepper for explaining a concept in stages (e.g. an algorithm).
 *
 * Renders one step at a time with Prev/Next controls and a clickable dots
 * indicator. Transitions between steps use a CSS-based crossfade/slide that is
 * disabled when the user prefers reduced motion (checked via `matchMedia`).
 */
export function StepThrough({
  steps,
  children,
  nextLabel = 'Next',
  prevLabel = 'Back',
  stepLabel = 'Step',
  ofLabel = 'of',
  stepsLabel = 'Steps',
  goToStepLabel = 'Go to step',
  className,
}: StepThroughProps) {
  const items: NormalizedStep[] = steps
    ? steps.map((s) => ({ title: s.title, content: s.body }))
    : Children.toArray(children)
        .filter(isValidElement)
        .map((child) => {
          const props = (child as { props?: Record<string, unknown> }).props ?? {};
          const title = props['data-step-title'] as ReactNode | undefined;
          return { title, content: props.children as ReactNode };
        });
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const liveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, total - 1));
    if (clamped === index) return;
    setIndex(clamped);
    setAnimKey((k) => k + 1);
  };

  if (total === 0) return null;

  const step = items[index];
  const atStart = index === 0;
  const atEnd = index === total - 1;

  return (
    <div
      className={cx(
        'rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
          {stepLabel} {index + 1} {ofLabel} {total}
        </span>
        {/* Dots indicator */}
        <div className="flex items-center gap-2" role="tablist" aria-label={stepsLabel}>
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${goToStepLabel} ${i + 1}${s.title ? `: ${s.title}` : ''}`}
              onClick={() => goTo(i)}
              className={cx(
                'h-2.5 rounded-pill transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 motion-reduce:transition-none',
                i === index ? 'w-6 bg-brand-600' : 'w-2.5 bg-ink-200 hover:bg-brand-300',
              )}
            />
          ))}
        </div>
      </div>

      {/* Step body — keyed wrapper re-mounts to trigger the entrance animation. */}
      <div className="min-h-[6rem] overflow-hidden">
        <div
          key={animKey}
          ref={liveRef}
          aria-live="polite"
          className={cx(
            'rounded-card bg-surface-sunken/60 p-4',
            !reduced && 'animate-fade-up',
          )}
        >
          {step.title && (
            <h4 className="mb-1.5 font-display text-base font-semibold text-ink-900">
              {step.title}
            </h4>
          )}
          <div className="text-sm leading-relaxed text-ink-700">
            {step.content}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={atStart}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-semibold text-ink-700 transition-colors duration-200',
            'hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-surface',
          )}
        >
          <span aria-hidden>←</span> {prevLabel}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={atEnd}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200',
            'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
          )}
        >
          {nextLabel} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

export default StepThrough;
