import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One factor in the DuPont decomposition of ROE. */
export interface DupontFactor {
  /** Factor name, e.g. "Net margin". */
  label: string;
  /** The ratio it represents, e.g. "Net income / Revenue". */
  formula: string;
  /** Display value as a string (already formatted, locale-agnostic). */
  value: string;
  /** One-line meaning of this factor. */
  meaning: string;
}

export interface DupontBreakdownProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the final ROE result. */
  resultLabel?: string;
  /** Display value of ROE (already formatted). */
  resultValue?: string;
  /**
   * The three multiplicative factors, in order: net margin, asset turnover,
   * equity multiplier. Their product is ROE.
   */
  factors?: [DupontFactor, DupontFactor, DupontFactor];
  /** Play button label. */
  playLabel?: string;
  /** Replay button label. */
  replayLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_FACTORS: [DupontFactor, DupontFactor, DupontFactor] = [
  {
    label: 'Net margin',
    formula: 'Net income / Revenue',
    value: '10%',
    meaning: 'How much profit each dollar of sales keeps — pricing power and cost control.',
  },
  {
    label: 'Asset turnover',
    formula: 'Revenue / Assets',
    value: '1.2×',
    meaning: 'How hard the assets work — sales squeezed from each dollar of assets.',
  },
  {
    label: 'Equity multiplier',
    formula: 'Assets / Equity',
    value: '2.0×',
    meaning: 'How much leverage amplifies it — assets funded per dollar of equity.',
  },
];

const STEP_MS = 1100;

/**
 * Animated DuPont decomposition. Return on equity isn't one number — it's three
 * levers multiplied: net margin × asset turnover × equity multiplier. Press
 * play and each factor card lights up in turn, with multiplication signs
 * appearing between them, until the final ROE resolves. This shows the learner
 * that two firms can share an ROE for completely different reasons (fat margins
 * vs. heavy leverage). Respects `prefers-reduced-motion`: renders fully
 * resolved and still.
 */
export function DupontBreakdown({
  title = 'ROE is three levers, not one',
  resultLabel = 'Return on equity',
  resultValue = '24%',
  factors = DEFAULT_FACTORS,
  playLabel = 'Decompose ROE',
  replayLabel = 'Replay',
  caption = 'Two companies can post the same ROE for opposite reasons — one on fat margins, another on heavy leverage. DuPont splits the single headline into the three levers that actually drive it.',
  className,
}: DupontBreakdownProps) {
  const id = useId();
  const reduced = typeof window !== 'undefined' ? prefersReducedMotion() : false;
  // steps: 0 none, 1..3 factors, 4 result
  const [step, setStep] = useState(reduced ? 4 : 0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion()) setStep(0);
  }, []);

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
      setStep(4);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setStep(0);
    const tick = (next: number) => {
      setStep(next);
      if (next >= 4) {
        setPlaying(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    timerRef.current = window.setTimeout(() => tick(1), 300);
  };

  const done = step >= 4 && !playing;

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

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-1">
        {factors.map((f, i) => {
          const lit = step >= i + 1;
          return (
            <div key={`${id}-f-${i}`} className="flex items-center gap-1 sm:flex-1">
              <div
                className={cx(
                  'flex-1 rounded-card border p-3 transition-all duration-500',
                  lit
                    ? 'border-brand-300 bg-brand-50/70 opacity-100'
                    : 'border-ink-100 bg-surface-sunken/40 opacity-50',
                  !reduced && lit && 'animate-fade-up',
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {f.label}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-ink-900">{f.value}</p>
                <p className="mt-0.5 font-mono text-[0.7rem] text-ink-500">{f.formula}</p>
              </div>
              {i < factors.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'px-1 text-2xl font-bold transition-colors duration-500',
                    step >= i + 2 ? 'text-brand-500' : 'text-ink-200',
                  )}
                >
                  ×
                </span>
              )}
            </div>
          );
        })}

        {/* equals + result */}
        <span
          aria-hidden="true"
          className={cx(
            'self-center px-1 text-2xl font-bold transition-colors duration-500 sm:px-2',
            done ? 'text-brand-500' : 'text-ink-200',
          )}
        >
          =
        </span>
        <div
          className={cx(
            'rounded-card border p-3 text-center transition-all duration-500 sm:min-w-[8rem]',
            done
              ? 'border-accent-400 bg-accent-50/70 opacity-100'
              : 'border-ink-100 bg-surface-sunken/40 opacity-50',
            !reduced && done && 'animate-fade-up',
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            {resultLabel}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-ink-900" aria-live="polite">
            {done ? resultValue : '—'}
          </p>
        </div>
      </div>

      {/* Meanings revealed as factors light up */}
      <ul className="mt-4 space-y-1.5">
        {factors.map((f, i) => (
          <li
            key={`${id}-mean-${i}`}
            className={cx(
              'text-sm transition-opacity duration-500',
              step >= i + 1 ? 'opacity-100' : 'opacity-40',
            )}
          >
            <span className="font-semibold text-ink-900">{f.label}:</span>{' '}
            <span className="text-ink-600">{f.meaning}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DupontBreakdown;
