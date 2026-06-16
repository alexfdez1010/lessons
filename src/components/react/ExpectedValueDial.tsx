import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ExpectedValueDialProps {
  /** Heading above the tool. */
  title?: string;
  /** Label for the win-probability slider. */
  probabilityLabel?: string;
  /** Label for the win-payoff slider. */
  winLabel?: string;
  /** Label for the loss-size slider. */
  lossLabel?: string;
  /** Label for the expected-value readout. */
  expectedValueLabel?: string;
  /** Label for the verdict readout. */
  verdictLabel?: string;
  /** Verdict text when EV is positive. */
  goodBetLabel?: string;
  /** Verdict text when EV is negative. */
  badBetLabel?: string;
  /** Verdict text when EV is roughly zero. */
  breakEvenLabel?: string;
  /** Label for the probability-weighted gain bar/readout. */
  weightedWinLabel?: string;
  /** Label for the probability-weighted loss bar/readout. */
  weightedLossLabel?: string;
  /** One-line takeaway shown under the tool. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Initial win probability as a fraction (0–1). Defaults to `0.5`. */
  probability?: number;
  /** Initial win payoff. Defaults to `100`. */
  win?: number;
  /** Initial loss size. Defaults to `80`. */
  loss?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(value)))}`;
};

/**
 * Interactive "expected value vs gut feeling" tool. A simple bet: with
 * probability p you win an amount, otherwise you lose an amount. Sliders set the
 * win probability, the win payoff and the loss size; the tool live-computes
 * Expected Value = p·win − (1−p)·loss and renders the two probability-weighted
 * outcomes as horizontal bars scaled to a common max — so the learner *sees*
 * which side dominates the long run. A verdict (worth it / skip it / coin toss)
 * switches on the sign of EV, teaching: decide by the weighted average, not by
 * whichever outcome feels more vivid. The bars grow in on change; respects
 * `prefers-reduced-motion` (jumps straight to final lengths).
 */
export function ExpectedValueDial({
  title = 'Expected value vs gut feeling',
  probabilityLabel = 'Win probability',
  winLabel = 'If you win',
  lossLabel = 'If you lose',
  expectedValueLabel = 'Expected value',
  verdictLabel = 'Verdict',
  goodBetLabel = 'Worth it (+EV)',
  badBetLabel = 'Skip it (−EV)',
  breakEvenLabel = 'Coin toss (≈0 EV)',
  weightedWinLabel = 'Weighted gain (p · win)',
  weightedLossLabel = 'Weighted loss ((1−p) · loss)',
  caption = 'A bet that feels scary can still be worth it, and a comfy one can quietly bleed you. Compare the probability-weighted gain against the weighted loss — the longer bar wins over the long run, whatever your gut says.',
  currencyPrefix = '$',
  probability = 0.5,
  win = 100,
  loss = 80,
  className,
}: ExpectedValueDialProps) {
  const id = useId();
  const [probState, setProbState] = useState(probability);
  const [winState, setWinState] = useState(win);
  const [lossState, setLossState] = useState(loss);
  const [progress, setProgress] = useState(1); // 0 → 1 (bar grow-in)
  const rafRef = useRef<number | null>(null);

  const weightedWin = probState * winState;
  const weightedLoss = (1 - probState) * lossState;
  const expectedValue = weightedWin - weightedLoss;

  // Break-even epsilon band: relative to the size of the swing, with a floor so
  // tiny bets don't read as wildly +/-EV.
  const swing = Math.max(weightedWin, weightedLoss, 1);
  const epsilon = Math.max(0.5, swing * 0.01);

  type Verdict = 'good' | 'bad' | 'even';
  const verdict: Verdict =
    expectedValue > epsilon ? 'good' : expectedValue < -epsilon ? 'bad' : 'even';
  const verdictText =
    verdict === 'good' ? goodBetLabel : verdict === 'bad' ? badBetLabel : breakEvenLabel;

  // Bars share a common max so their lengths are directly comparable.
  const barMax = Math.max(weightedWin, weightedLoss, 1);
  const winPct = (weightedWin / barMax) * 100 * progress;
  const lossPct = (weightedLoss / barMax) * 100 * progress;

  const probPct = Math.round(probState * 100);

  // Grow the bars in whenever any input changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [probState, winState, lossState]);

  const evColor =
    verdict === 'good'
      ? 'text-brand-700'
      : verdict === 'bad'
        ? 'text-accent-600'
        : 'text-ink-900';

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            verdict === 'bad' ? 'bg-accent-600' : 'bg-brand-600',
          )}
        >
          {verdictText}
        </span>
      </figcaption>

      {/* Weighted-outcome bars */}
      <div
        className="mt-4 space-y-3"
        role="img"
        aria-label={`${title}: with a ${probPct}% chance to win ${money(
          currencyPrefix,
          winState,
        )} and a ${100 - probPct}% chance to lose ${money(
          currencyPrefix,
          lossState,
        )}, the weighted gain is ${money(
          currencyPrefix,
          weightedWin,
        )} and the weighted loss is ${money(
          currencyPrefix,
          weightedLoss,
        )}, for an expected value of ${money(currencyPrefix, expectedValue)} (${verdictText}).`}
      >
        <div>
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>{weightedWinLabel}</span>
            <span className="font-mono text-ink-900">
              {money(currencyPrefix, weightedWin)}
            </span>
          </div>
          <div
            className="mt-1 h-4 w-full overflow-hidden rounded-pill"
            style={{ backgroundColor: 'var(--color-ink-200)' }}
            aria-hidden="true"
          >
            <div
              className={cx(
                'h-full rounded-pill',
                !prefersReducedMotion() && 'transition-[width] duration-200 ease-out',
              )}
              style={{ width: `${winPct}%`, backgroundColor: 'var(--color-brand-500)' }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>{weightedLossLabel}</span>
            <span className="font-mono text-ink-900">
              {money(currencyPrefix, weightedLoss)}
            </span>
          </div>
          <div
            className="mt-1 h-4 w-full overflow-hidden rounded-pill"
            style={{ backgroundColor: 'var(--color-ink-200)' }}
            aria-hidden="true"
          >
            <div
              className={cx(
                'h-full rounded-pill',
                !prefersReducedMotion() && 'transition-[width] duration-200 ease-out',
              )}
              style={{ width: `${lossPct}%`, backgroundColor: 'var(--color-accent-500)' }}
            />
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-prob`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{probabilityLabel}</span>
            <span className="font-mono text-ink-900">{probPct}%</span>
          </label>
          <input
            id={`${id}-prob`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={probPct}
            onChange={(e) => setProbState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-win`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{winLabel}</span>
            <span className="font-mono text-ink-900">{money(currencyPrefix, winState)}</span>
          </label>
          <input
            id={`${id}-win`}
            type="range"
            min={0}
            max={500}
            step={5}
            value={winState}
            onChange={(e) => setWinState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-loss`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{lossLabel}</span>
            <span className="font-mono text-ink-900">{money(currencyPrefix, lossState)}</span>
          </label>
          <input
            id={`${id}-loss`}
            type="range"
            min={0}
            max={500}
            step={5}
            value={lossState}
            onChange={(e) => setLossState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{expectedValueLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', evColor)}>
            {money(currencyPrefix, expectedValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{verdictLabel}</dt>
          <dd className={cx('text-lg font-semibold', evColor)}>{verdictText}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ExpectedValueDial;
