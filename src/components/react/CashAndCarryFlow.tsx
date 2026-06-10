import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CashAndCarryFlowProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway under the figure. */
  caption?: string;
  /** Label for the "advance" / next-leg button. */
  nextLabel?: string;
  /** Label for the "reset" button. */
  resetLabel?: string;
  /** Label for the spot-leg node. */
  spotLegLabel?: string;
  /** Label for the futures/perp-leg node. */
  futuresLegLabel?: string;
  /** Label for the net-position node. */
  netLabel?: string;
  /** Label for the captured-basis readout. */
  basisLabel?: string;
  /** Label for the funding/basis slider. */
  basisSliderLabel?: string;
  /** Ordered step descriptions of the trade (each shown as it activates). */
  steps?: string[];
  /** Currency prefix. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Notional traded on each leg. Defaults to `10000`. */
  notional?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_STEPS = [
  'Buy the asset on the spot market (the long leg).',
  'Short the same notional in the perp/future at its premium (the short leg).',
  'The two legs cancel — net price exposure is ≈ 0, so you are market-neutral.',
  'Collect the basis: the futures premium (or positive funding) accrues to your short while the hedge keeps you flat.',
];

/**
 * Animated cash-and-carry / basis-trade flow. The trade is built leg by leg:
 * buy spot (long), short the perp or future at its premium (short), observe that
 * the two price exposures cancel to a market-neutral book, then harvest the
 * basis (the futures premium or positive funding) as carry. A small flow diagram
 * lights up node by node as the learner advances, and a basis slider shows how
 * the captured carry scales with the premium. Locale-agnostic: all copy is
 * passed as props; the only numbers shown derive from `notional` and the slider.
 */
export function CashAndCarryFlow({
  title = 'Cash-and-carry: turn a futures premium into market-neutral yield',
  caption = 'When a perp or future trades above spot, you can lock the gap risk-free-ish: buy the asset, short the same size in the derivative, and the price moves cancel. What is left is the basis — the premium or funding the short collects — earned with no directional bet. This is the dominant institutional crypto carry trade.',
  nextLabel = 'Add the next leg',
  resetLabel = 'Reset',
  spotLegLabel = 'Long spot',
  futuresLegLabel = 'Short perp / future',
  netLabel = 'Net exposure ≈ 0',
  basisLabel = 'Basis captured',
  basisSliderLabel = 'Annualized basis / funding',
  steps = DEFAULT_STEPS,
  currencyPrefix = '$',
  notional = 10000,
  className,
}: CashAndCarryFlowProps) {
  const id = useId();
  // Annualized basis as a percentage.
  const [basisPct, setBasisPct] = useState(12);
  // How many legs revealed so far (0 … steps.length).
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const basisCaptured = (notional * basisPct) / 100;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 350;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [stage]);

  const money = (v: number) =>
    `${currencyPrefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;

  // Node activation: spot at stage>=1, futures at stage>=2, net at stage>=3.
  const spotOn = stage >= 1;
  const futOn = stage >= 2;
  const netOn = stage >= 3;
  const basisOn = stage >= 4;

  const nodeBase =
    'flex flex-col items-center justify-center rounded-card border px-3 py-3 text-center text-xs font-medium transition-all duration-300';

  const aria = `Cash-and-carry, ${stage} of ${steps.length} legs built. ${basisLabel} ${money(basisCaptured)} at ${basisPct}%.`;

  const buttonBase =
    'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
      aria-label={aria}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-600 px-3 py-1 text-sm font-medium text-white tabular-nums">
          {basisLabel}: {money(basisCaptured)}
        </span>
      </figcaption>

      {/* Flow diagram */}
      <div className="mt-4 grid grid-cols-3 items-stretch gap-2" aria-hidden="true">
        <div
          className={cx(
            nodeBase,
            spotOn ? 'border-accent-300 bg-accent-50 text-accent-700' : 'border-ink-100 bg-surface-sunken/40 text-ink-400',
          )}
          style={{ opacity: spotOn ? 0.4 + progress * 0.6 : 0.5 }}
        >
          <span className="text-lg" aria-hidden="true">↑</span>
          {spotLegLabel}
          <span className="mt-1 font-mono text-ink-500">+{money(notional)}</span>
        </div>
        <div
          className={cx(
            nodeBase,
            futOn ? 'border-red-300 bg-red-50 text-red-700' : 'border-ink-100 bg-surface-sunken/40 text-ink-400',
          )}
          style={{ opacity: futOn ? 0.4 + progress * 0.6 : 0.5 }}
        >
          <span className="text-lg" aria-hidden="true">↓</span>
          {futuresLegLabel}
          <span className="mt-1 font-mono text-ink-500">−{money(notional)}</span>
        </div>
        <div
          className={cx(
            nodeBase,
            netOn ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-100 bg-surface-sunken/40 text-ink-400',
          )}
          style={{ opacity: netOn ? 0.4 + progress * 0.6 : 0.5 }}
        >
          <span className="text-lg" aria-hidden="true">⇄</span>
          {netLabel}
        </div>
      </div>

      {/* Basis payoff bar */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 p-3">
        <div className="flex items-center justify-between text-xs text-ink-600">
          <span>{basisLabel}</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {basisOn ? money(basisCaptured) : money(0)}
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full rounded-pill bg-accent-500 transition-all duration-500"
            style={{ width: basisOn ? `${Math.min(100, basisPct * 4)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Current step description */}
      <div aria-live="polite">
        {stage > 0 && (
          <p className="mt-3 rounded-card border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-ink-700">
            <span className="font-semibold text-brand-700">{stage}.</span>{' '}
            {steps[Math.min(stage, steps.length) - 1]}
          </p>
        )}
      </div>

      {/* Basis slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-basis`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{basisSliderLabel}</span>
          <span className="font-mono text-ink-900 tabular-nums">{basisPct}%</span>
        </label>
        <input
          id={`${id}-basis`}
          type="range"
          min={0}
          max={25}
          step={1}
          value={basisPct}
          onChange={(e) => setBasisPct(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStage((s) => Math.min(steps.length, s + 1))}
          disabled={stage >= steps.length}
          className={cx(
            buttonBase,
            stage >= steps.length
              ? 'cursor-not-allowed bg-ink-200 text-ink-400'
              : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {nextLabel}
        </button>
        <button
          type="button"
          onClick={() => setStage(0)}
          disabled={stage === 0}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
            stage === 0 && 'cursor-not-allowed opacity-50',
          )}
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CashAndCarryFlow;
