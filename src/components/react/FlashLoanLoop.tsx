import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FlashLoanLoopProps {
  /** Heading above the visual. */
  title?: string;
  /** One-line takeaway shown under the steps. */
  caption?: string;
  /** Step 1 label. */
  borrowStepLabel?: string;
  /** Step 1 description. */
  borrowStepDesc?: string;
  /** Step 2 label. */
  useStepLabel?: string;
  /** Step 2 description. */
  useStepDesc?: string;
  /** Step 3 label. */
  repayStepLabel?: string;
  /** Step 3 description. */
  repayStepDesc?: string;
  /** Label for the repay toggle. */
  repayToggleLabel?: string;
  /** Status badge/banner text when the transaction succeeds. */
  successLabel?: string;
  /** Status badge/banner text when the transaction reverts. */
  revertLabel?: string;
  /** Play button label (first run). */
  playLabel?: string;
  /** Play button label once it has run (replay). */
  replayLabel?: string;
  /** Caption above the atomic-transaction container. */
  txLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface StepDef {
  key: 'borrow' | 'use' | 'repay';
  label: string;
  desc: string;
}

/** Per-step animation cadence (ms) when motion is allowed. */
const STEP_DELAY = 650;

/**
 * Animated stepper teaching FLASH LOANS — an uncollateralized loan that must be
 * borrowed AND repaid (plus a fee) inside a SINGLE atomic transaction, or the
 * whole thing reverts. Three steps (Borrow → Use → Repay) run inside one
 * "transaction" container. A toggle controls whether the loan is repaid within
 * the same transaction:
 *
 * - Repay ON  → every step lights up green and the transaction SUCCEEDS.
 * - Repay OFF → the transaction REVERTS: the missing repayment fails the whole
 *   batch, so atomicity rolls every step back — as if the borrow never happened.
 *
 * The Play button animates the steps in sequence; under `prefers-reduced-motion`
 * the timed run is skipped and the final state is shown immediately.
 */
export function FlashLoanLoop({
  title = 'A flash loan, borrow and repay in one transaction',
  caption = 'A flash loan has no collateral — the only guarantee is atomicity. Borrow, use, and repay all run inside one transaction. If the repayment (principal plus fee) is not made before the transaction ends, the entire transaction reverts and every earlier step is undone, as if the loan never existed.',
  borrowStepLabel = 'Borrow',
  borrowStepDesc = 'Pull a large amount from the pool — no collateral',
  useStepLabel = 'Use',
  useStepDesc = 'Arbitrage, swap collateral, or refinance a position',
  repayStepLabel = 'Repay',
  repayStepDesc = 'Return the principal plus a small fee',
  repayToggleLabel = 'Repay within the same transaction?',
  successLabel = 'Transaction succeeds',
  revertLabel = 'Transaction reverts — as if it never happened',
  playLabel = 'Play',
  replayLabel = 'Replay',
  txLabel = 'One atomic transaction',
  className,
}: FlashLoanLoopProps) {
  const id = useId();
  const [willRepay, setWillRepay] = useState(true);
  // -1 = not started; 0..n = highlighting step n; n+1 = run finished.
  const [phase, setPhase] = useState(-1);
  const [hasRun, setHasRun] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const steps: StepDef[] = [
    { key: 'borrow', label: borrowStepLabel, desc: borrowStepDesc },
    { key: 'use', label: useStepLabel, desc: useStepDesc },
    { key: 'repay', label: repayStepLabel, desc: repayStepDesc },
  ];

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Reset the animation whenever the toggle changes; the new outcome must be
  // replayed (or shown statically) rather than left mid-run.
  useEffect(() => {
    clearTimers();
    setPhase(-1);
    setHasRun(false);
  }, [willRepay]);

  useEffect(() => clearTimers, []);

  const finished = phase >= steps.length;
  // On a revert, the borrow/use steps "happened" then rolled back; the repay
  // step is the one that was missing. We mark every step rolled-back on finish.
  const reverted = finished && !willRepay;
  const succeeded = finished && willRepay;

  const handlePlay = () => {
    clearTimers();
    setHasRun(true);

    if (prefersReducedMotion()) {
      // Skip the timed run: jump straight to the final state.
      setPhase(steps.length);
      return;
    }

    setPhase(0);
    for (let i = 1; i <= steps.length; i++) {
      const t = setTimeout(() => setPhase(i), STEP_DELAY * i);
      timersRef.current.push(t);
    }
  };

  // Per-step visual state for the current phase + outcome.
  const stepState = (index: number): 'idle' | 'active' | 'done' | 'rolledback' => {
    if (phase < 0) return 'idle';
    if (reverted) return 'rolledback';
    if (succeeded) return 'done';
    // Mid-animation.
    if (index < phase) return 'done';
    if (index === phase) return 'active';
    return 'idle';
  };

  const statusText = succeeded ? successLabel : reverted ? revertLabel : '';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium',
            succeeded
              ? 'bg-accent-500 text-white'
              : reverted
                ? 'bg-red-50 text-red-600'
                : 'bg-brand-600 text-white',
          )}
        >
          {succeeded ? successLabel : reverted ? revertLabel : txLabel}
        </span>
      </figcaption>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={repayToggleLabel}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-ink-700">{repayToggleLabel}</span>
          <div className="inline-flex overflow-hidden rounded-card border border-ink-100">
            <button
              type="button"
              aria-pressed={willRepay}
              onClick={() => setWillRepay(true)}
              className={cx(
                'px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                willRepay
                  ? 'bg-accent-500 text-white'
                  : 'bg-surface-sunken/40 text-ink-700 hover:bg-surface-sunken',
              )}
            >
              On
            </button>
            <button
              type="button"
              aria-pressed={!willRepay}
              onClick={() => setWillRepay(false)}
              className={cx(
                'px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                !willRepay
                  ? 'bg-red-500 text-white'
                  : 'bg-surface-sunken/40 text-ink-700 hover:bg-surface-sunken',
              )}
            >
              Off
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className="ml-auto rounded-card border border-brand-600 bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {hasRun ? replayLabel : playLabel}
        </button>
      </div>

      {/* Atomic-transaction container */}
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
          <span
            className="inline-block h-2 w-2 rounded-full bg-brand-400"
            aria-hidden="true"
          />
          {txLabel}
        </p>
        <ol
          className={cx(
            'space-y-2 rounded-card border-2 border-dashed p-3 transition-colors duration-300',
            succeeded
              ? 'border-accent-500 bg-accent-50/60'
              : reverted
                ? 'border-red-300 bg-red-50/60'
                : 'border-ink-100 bg-surface-sunken/40',
          )}
        >
          {steps.map((step, index) => {
            const state = stepState(index);
            return (
              <li
                key={step.key}
                className={cx(
                  'flex items-start gap-3 rounded-card border px-3 py-2.5 transition-all duration-300',
                  state === 'active' &&
                    'border-brand-300 bg-brand-50 shadow-soft',
                  state === 'done' &&
                    'border-accent-500 bg-accent-50',
                  state === 'rolledback' &&
                    'border-red-300 bg-red-50/70 opacity-60',
                  state === 'idle' && 'border-ink-100 bg-surface',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    state === 'active' && 'bg-brand-600 text-white',
                    state === 'done' && 'bg-accent-500 text-white',
                    state === 'rolledback' && 'bg-red-500 text-white',
                    state === 'idle' && 'bg-ink-100 text-ink-500',
                  )}
                  aria-hidden="true"
                >
                  {state === 'done' ? '✓' : state === 'rolledback' ? '↺' : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      'block text-sm font-semibold',
                      state === 'rolledback'
                        ? 'text-red-600 line-through'
                        : state === 'done'
                          ? 'text-accent-600'
                          : state === 'active'
                            ? 'text-brand-700'
                            : 'text-ink-900',
                    )}
                  >
                    {step.label}
                  </span>
                  <span
                    className={cx(
                      'block text-xs',
                      state === 'rolledback'
                        ? 'text-red-600/70 line-through'
                        : 'text-ink-500',
                    )}
                  >
                    {step.desc}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Status banner */}
      <div aria-live="polite" className="mt-3 min-h-[1.5rem]">
        {statusText && (
          <p
            className={cx(
              'rounded-card px-3 py-2 text-sm font-medium',
              succeeded
                ? 'bg-accent-50 text-accent-600'
                : 'bg-red-50 text-red-600',
            )}
          >
            {statusText}
          </p>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FlashLoanLoop;
