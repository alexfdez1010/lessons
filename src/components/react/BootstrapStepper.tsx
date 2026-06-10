import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

interface BootstrapStep {
  /** Maturity label for this step, e.g. "1y", "2y". */
  maturity: string;
  /** Short title of what this step solves. */
  title: string;
  /** Plain-language explanation of the step. */
  body: string;
  /** Resulting spot/zero rate at this maturity, as a percent value (e.g. 5.2). */
  spotPercent: number;
}

export interface BootstrapStepperProps {
  /** Heading above the widget. */
  title?: string;
  /** Legend label for the resolved spot-rate curve. */
  spotCurveLabel?: string;
  /** Label for the step readout, e.g. "Step". */
  stepLabel?: string;
  /** Label for the resolved spot-rate readout. */
  spotRateLabel?: string;
  /** Label for the "next step" button. */
  nextLabel?: string;
  /** Label for the "previous step" button. */
  backLabel?: string;
  /** Label for the reset-to-start button. */
  resetLabel?: string;
  /** Word joining current/total, e.g. "of". */
  ofLabel?: string;
  /** Axis label under the maturity axis. */
  maturityAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /**
   * The bootstrap sequence: each step resolves the spot rate at one further
   * maturity using the spots already locked in by earlier steps. NO numbers are
   * hardcoded inside the component — they come entirely from this prop, authored
   * in the MDX so the math lives in the prose.
   */
  steps?: BootstrapStep[];
  className?: string;
}

const DEFAULT_STEPS: BootstrapStep[] = [
  {
    maturity: '1y',
    title: 'Start at the short end',
    body: 'The 1-year bond has a single cash flow, so its yield already is the 1-year spot rate. Nothing to strip — read it straight off.',
    spotPercent: 4.0,
  },
  {
    maturity: '2y',
    title: 'Strip the known coupon',
    body: 'The 2-year bond pays a coupon at year 1 and coupon + face at year 2. Discount the year-1 coupon with the year-1 spot you just locked, subtract it from the price, then solve for the year-2 spot.',
    spotPercent: 4.6,
  },
  {
    maturity: '3y',
    title: 'Roll the recursion forward',
    body: 'The 3-year bond uses the year-1 and year-2 spots to discount its first two coupons, leaving one equation in the year-3 spot. Solve it.',
    spotPercent: 5.1,
  },
  {
    maturity: '4y',
    title: 'Keep climbing the ladder',
    body: 'Every earlier spot is now known, so the 4-year bond again collapses to a single unknown — the year-4 spot. Each maturity falls in turn.',
    spotPercent: 5.4,
  },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmtPct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;

/**
 * Bootstrapping the spot (zero) curve, one maturity at a time. Coupon-bond
 * yields can't be discounted with a single rate; bootstrapping peels them apart
 * recursively: the shortest bond gives its spot directly, then each longer bond
 * reuses the spots already solved to discount its earlier coupons, leaving a
 * single unknown — the spot at its own maturity. Step through and watch the spot
 * curve build up dot by dot, left to right. All rates come from the `steps`
 * prop (authored in MDX); the island holds no numbers of its own. Respects
 * `prefers-reduced-motion`.
 */
export function BootstrapStepper({
  title = 'Bootstrapping the spot curve',
  spotCurveLabel = 'Spot (zero) rate',
  stepLabel = 'Step',
  spotRateLabel = 'Resolved spot rate',
  nextLabel = 'Next maturity',
  backLabel = 'Back',
  resetLabel = 'Restart',
  ofLabel = 'of',
  maturityAxisLabel = 'Maturity',
  caption = 'Each step reuses every spot rate already locked in to strip the next bond down to one unknown. The curve is built from the short end out — you can never solve a long maturity before the shorter ones beneath it.',
  steps = DEFAULT_STEPS,
  className,
}: BootstrapStepperProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(0); // index of last resolved step

  const W = 520;
  const H = 220;
  const padX = 40;
  const padTop = 18;
  const axisY = H - 38;

  const spots = steps.map((s) => s.spotPercent);
  const maxSpot = Math.max(...spots) * 1.08;
  const minSpot = Math.min(...spots) * 0.92;
  const innerW = W - padX * 2;

  const x = (i: number) =>
    padX + (steps.length === 1 ? 0 : (i / (steps.length - 1)) * innerW);
  const y = (p: number) =>
    padTop + (1 - (p - minSpot) / (maxSpot - minSpot)) * (axisY - padTop);

  const current = steps[revealed];

  const linePath = () => {
    let d = '';
    for (let i = 0; i <= revealed; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(steps[i].spotPercent)}`;
    }
    return d;
  };

  const next = () =>
    setRevealed((v) => Math.min(steps.length - 1, v + 1));
  const back = () => setRevealed((v) => Math.max(0, v - 1));
  const reset = () => setRevealed(0);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {stepLabel} {revealed + 1} {ofLabel} {steps.length}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {spotCurveLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${revealed + 1} of ${steps.length} maturities resolved; the spot rate at ${current.maturity} is ${fmtPct(
          current.spotPercent,
        )}.`}
      >
        {/* Axis */}
        <line
          x1={padX}
          y1={axisY}
          x2={W - padX}
          y2={axisY}
          stroke="var(--color-ink-200)"
        />
        {/* Maturity ticks */}
        {steps.map((s, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={x(i)}
              y1={axisY}
              x2={x(i)}
              y2={axisY + 5}
              stroke="var(--color-ink-200)"
            />
            <text
              x={x(i)}
              y={axisY + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-500)"
              fontFamily="var(--font-mono, monospace)"
            >
              {s.maturity}
            </text>
          </g>
        ))}
        <text
          x={W - padX}
          y={axisY + 32}
          textAnchor="end"
          fontSize={10}
          fill="var(--color-ink-400)"
        >
          {maturityAxisLabel}
        </text>

        {/* Resolved curve so far */}
        {revealed > 0 && (
          <path
            d={linePath()}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots: resolved (filled) vs pending (faint hollow) */}
        {steps.map((s, i) => {
          const resolved = i <= revealed;
          const justResolved = i === revealed;
          return (
            <g key={`dot-${i}`}>
              <circle
                cx={x(i)}
                cy={y(s.spotPercent)}
                r={resolved ? (justResolved ? 7 : 5) : 4}
                fill={resolved ? 'var(--color-brand-600)' : 'var(--color-surface)'}
                stroke={resolved ? 'white' : 'var(--color-ink-200)'}
                strokeWidth={resolved ? 2 : 1.5}
                opacity={resolved ? 1 : 0.6}
                style={
                  prefersReducedMotion() || !justResolved
                    ? undefined
                    : { transition: 'r 250ms ease-out' }
                }
              />
              {resolved && (
                <text
                  x={x(i)}
                  y={y(s.spotPercent) - 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-brand-700)"
                >
                  {fmtPct(s.spotPercent)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Step explanation */}
      <div
        className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-ink-900">
          {current.maturity} — {current.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{current.body}</p>
        <p className="mt-2 text-sm text-ink-600">
          {spotRateLabel}:{' '}
          <span className="font-mono font-semibold text-brand-700">
            {fmtPct(current.spotPercent)}
          </span>
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={back}
          disabled={revealed === 0}
          className="rounded-pill border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={next}
          disabled={revealed === steps.length - 1}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {nextLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={revealed === 0}
          className="rounded-pill px-4 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BootstrapStepper;
