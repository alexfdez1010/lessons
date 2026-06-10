import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One step in the income-statement waterfall. */
export interface WaterfallStep {
  /** Row label, e.g. "Cost of goods sold". */
  label: string;
  /**
   * Signed value as a share of revenue. The first step is the starting total
   * (positive, usually 100). Subsequent steps are deductions (negative) or, if
   * a subtotal, the running total is shown as a fresh bar when `subtotal` is set.
   */
  value: number;
  /** Mark this row as a resting subtotal (e.g. gross profit, operating income). */
  subtotal?: boolean;
}

export interface MarginWaterfallProps {
  /** Heading above the chart. */
  title?: string;
  /**
   * Steps from revenue down to net income, expressed as percentages of revenue.
   * The first step should be the revenue total (value 100). Deductions are
   * negative; subtotals set `subtotal: true`.
   */
  steps?: WaterfallStep[];
  /** Suffix appended to each value (the unit). Defaults to `'%'`. */
  unitSuffix?: string;
  /** Play button label. */
  playLabel?: string;
  /** Replay button label. */
  replayLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_STEPS: WaterfallStep[] = [
  { label: 'Revenue', value: 100 },
  { label: 'Cost of goods sold', value: -60 },
  { label: 'Gross profit', value: 40, subtotal: true },
  { label: 'Operating expenses', value: -25 },
  { label: 'Operating income', value: 15, subtotal: true },
  { label: 'Interest + tax', value: -7 },
  { label: 'Net income', value: 8, subtotal: true },
];

const STEP_MS = 850;

/**
 * Income-statement waterfall. Starting from 100% revenue, each cost takes a
 * bite and the bar steps down; subtotals (gross profit, operating income, net
 * income) rest at a fresh full-height bar so the learner sees the surviving
 * margin at each level. Press play and the bars build top-to-bottom, the
 * just-revealed row highlighted and its arithmetic announced. Respects
 * `prefers-reduced-motion`: renders fully built and still.
 */
export function MarginWaterfall({
  title = 'From revenue to net income',
  steps = DEFAULT_STEPS,
  unitSuffix = '%',
  playLabel = 'Run the waterfall',
  replayLabel = 'Replay',
  caption = 'Every line of the income statement is a bite out of revenue. What survives at the bottom — net income — is a thin slice of the top, which is why margins matter more than headline sales.',
  className,
}: MarginWaterfallProps) {
  const id = useId();
  const reduced = typeof window !== 'undefined' ? prefersReducedMotion() : false;
  const [shown, setShown] = useState(reduced ? steps.length : 0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion()) setShown(0);
  }, [steps.length]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const play = () => {
    clearTimer();
    if (prefersReducedMotion()) {
      setShown(steps.length);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setShown(0);
    const tick = (next: number) => {
      setShown(next);
      if (next >= steps.length) {
        setPlaying(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    timerRef.current = window.setTimeout(() => tick(1), 200);
  };

  const done = shown >= steps.length && !playing;
  const maxVal = Math.max(...steps.map((s) => Math.abs(s.value)));

  // Compute the running top for each step so floating bars start at the right level.
  const running: number[] = [];
  let acc = 0;
  for (const s of steps) {
    if (s.subtotal || running.length === 0) {
      acc = s.value;
      running.push(acc);
    } else {
      // deduction floats from previous running level down by |value|
      running.push(acc);
      acc += s.value; // value is negative
    }
  }

  const lastIdx = shown - 1;
  let live = '';
  if ((playing || done) && lastIdx >= 0) {
    const s = steps[lastIdx];
    live = `${s.label}: ${s.value > 0 ? '+' : ''}${s.value}${unitSuffix}.`;
  }

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
        >
          {done ? replayLabel : playLabel}
        </button>
      </figcaption>

      <div className="mt-4 space-y-2" aria-hidden="false">
        {steps.map((s, i) => {
          const visible = i < shown;
          const isJust = i === lastIdx && playing;
          const widthPct = (Math.abs(s.value) / maxVal) * 100;
          const isDeduction = s.value < 0;
          // floating offset for deductions: start where the running level was
          const floatPct = isDeduction
            ? ((running[i] - Math.abs(s.value)) / maxVal) * 100
            : 0;
          return (
            <div
              key={`${id}-row-${i}`}
              className={cx(
                'grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 rounded-card px-2 py-1.5 transition-colors',
                isJust && 'bg-brand-50',
              )}
            >
              <span
                className={cx(
                  'truncate text-sm',
                  s.subtotal ? 'font-semibold text-ink-900' : 'text-ink-600',
                )}
              >
                {s.label}
              </span>
              <span className="relative block h-6 rounded-pill bg-surface-sunken/60">
                <span
                  className={cx(
                    'absolute top-0 h-6 rounded-pill',
                    !reduced && 'transition-all duration-500 ease-out',
                    s.subtotal
                      ? 'bg-brand-500'
                      : isDeduction
                        ? 'bg-accent-500'
                        : 'bg-brand-400',
                  )}
                  style={{
                    left: `${floatPct}%`,
                    width: visible ? `${widthPct}%` : '0%',
                    opacity: visible ? 1 : 0,
                  }}
                />
              </span>
              <span
                className={cx(
                  'text-right font-mono text-sm tabular-nums',
                  visible ? 'text-ink-900' : 'text-ink-300',
                  s.subtotal && 'font-semibold',
                )}
              >
                {visible ? `${s.value > 0 ? '' : ''}${s.value}${unitSuffix}` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-ink-500" aria-live="polite" aria-atomic="true">
        {live}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MarginWaterfall;
