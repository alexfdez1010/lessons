import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LindyCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "current age" slider. */
  ageLabel?: string;
  /** Legend label for the non-perishable / Lindy curve. */
  lindyLabel?: string;
  /** Legend label for the perishable (human / machine) curve. */
  perishableLabel?: string;
  /** Y-axis caption: "Expected remaining life". */
  remainingLabel?: string;
  /** Readout label for the Lindy expected-remaining figure. */
  lindyReadoutLabel?: string;
  /** Readout label for the perishable expected-remaining figure. */
  perishableReadoutLabel?: string;
  /** Unit appended to the readouts, e.g. "years". */
  unitLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial current age (years on the x-axis). Defaults to `10`. */
  age?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** x-axis range: current age from 0 to 100 (years). */
const AGE_MAX = 100;
/** y-axis range: expected remaining life, 0 to 100 (years). */
const REMAIN_MAX = 100;

/**
 * Clean Lindy rule: for a non-perishable / informational thing, the expected
 * remaining life equals its current age — survive to 40 and you expect ~40 more.
 * (We cap the line at the chart's top so it stays on canvas past age 100.)
 */
const lindyRemaining = (age: number): number => Math.min(age, REMAIN_MAX);

/**
 * Perishable analogue (a human-mortality-ish shape): newborns expect a long
 * life, and every extra year of age lowers the expected remaining years. A
 * smooth decay from ~80 at birth toward a small floor in old age — the mirror
 * image of the Lindy line, so the two cross around middle age.
 */
const perishableRemaining = (age: number): number => {
  const birthExpectancy = 80;
  const floor = 4;
  // Quadratic-ish decline that bottoms out near the floor at very old age.
  const fraction = Math.min(1, age / AGE_MAX);
  const remaining = birthExpectancy * (1 - fraction) ** 1.7 + floor * fraction;
  return Math.max(0, remaining);
};

/**
 * Interactive Lindy-effect chart. It contrasts two notions of expected
 * remaining life as a function of *current age*. For a perishable thing (a human,
 * a machine) the expected remaining life *falls* as it ages — a downward curve.
 * For a non-perishable / informational thing (a book, an idea, a technology) the
 * opposite holds: the longer it has already survived, the longer it is expected
 * to keep going, so the clean Lindy rule E[remaining] ≈ age traces a *rising*
 * line. A draggable "current age" marker sweeps both curves at once; the live
 * readouts (aria-live) show the Lindy figure climbing while the perishable one
 * sinks, and the two cross around middle age. Lindy is a filter for robustness:
 * what has survived long is likely to survive longer. The curves animate in on
 * mount; respects `prefers-reduced-motion` (jumps straight to the final state).
 */
export function LindyCurve({
  title = 'The Lindy effect: age cuts both ways',
  ageLabel = 'Current age',
  lindyLabel = 'Idea / book (non-perishable)',
  perishableLabel = 'Human / machine (perishable)',
  remainingLabel = 'Expected remaining life',
  lindyReadoutLabel = 'Expected remaining (Lindy)',
  perishableReadoutLabel = 'Expected remaining (perishable)',
  unitLabel = 'years',
  caption = 'A 90-year-old expects a few more years; a person aged 9 expects far more. Flip it for ideas: a book in print 40 years is a fair bet for ~40 more, while last year’s fad is fragile. For non-perishable things, survival itself is evidence of robustness — the longer something has lasted, the longer it is likely to last.',
  age = 10,
  className,
}: LindyCurveProps) {
  const id = useId();
  const [ageState, setAgeState] = useState(age);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 36;
  const padY = 18;

  const x = (a: number) => padX + (a / AGE_MAX) * (W - padX * 2);
  const y = (remaining: number) =>
    padY + (1 - remaining / REMAIN_MAX) * (H - padY * 2);

  const lindyNow = lindyRemaining(ageState);
  const perishableNow = perishableRemaining(ageState);

  // Sample each curve, revealed left-to-right up to `progress`.
  const SAMPLES = 100;
  const buildPath = (fn: (a: number) => number): string => {
    const upto = progress * AGE_MAX;
    let d = `M ${x(0)} ${y(fn(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const a = (i / SAMPLES) * AGE_MAX;
      if (a > upto) {
        d += ` L ${x(upto)} ${y(fn(upto))}`;
        break;
      }
      d += ` L ${x(a)} ${y(fn(a))}`;
    }
    return d;
  };

  // Animate the curves drawing in on mount.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
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
  }, []);

  const ageInt = Math.round(ageState);
  const lindyInt = Math.round(lindyNow);
  const perishableInt = Math.round(perishableNow);

  // y-axis gridline values (every 25 years).
  const gridValues = [0, 25, 50, 75, 100];

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
          {ageLabel}: {ageInt} {unitLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {lindyLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {perishableLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: at a current age of ${ageInt} ${unitLabel}, a non-perishable thing expects about ${lindyInt} more ${unitLabel} (rising with age), while a perishable thing expects about ${perishableInt} more ${unitLabel} (falling with age).`}
      >
        {/* y-axis gridlines + labels */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={padX}
              y1={y(v)}
              x2={W - padX}
              y2={y(v)}
              stroke="var(--color-ink-200)"
              strokeDasharray="3 4"
            />
            <text
              x={padX - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-400)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* y-axis title */}
        <text
          x={12}
          y={padY + (H - padY * 2) / 2}
          fontSize={10}
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padY + (H - padY * 2) / 2})`}
        >
          {remainingLabel}
        </text>

        {/* Perishable (falling) curve */}
        <path
          d={buildPath(perishableRemaining)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Lindy (rising) curve */}
        <path
          d={buildPath(lindyRemaining)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Vertical "current age" sweep line */}
        <line
          x1={x(ageState)}
          y1={padY}
          x2={x(ageState)}
          y2={H - padY}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />

        {/* Markers where the sweep line meets each curve */}
        <circle
          cx={x(ageState)}
          cy={y(perishableNow)}
          r={5}
          fill="var(--color-accent-500)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
        <circle
          cx={x(ageState)}
          cy={y(lindyNow)}
          r={5}
          fill="var(--color-brand-500)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-age`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{ageLabel}</span>
          <span className="font-mono text-ink-900">
            {ageInt} {unitLabel}
          </span>
        </label>
        <input
          id={`${id}-age`}
          type="range"
          min={0}
          max={AGE_MAX}
          step={1}
          value={ageInt}
          onChange={(e) => setAgeState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lindyReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {lindyInt} {unitLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{perishableReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {perishableInt} {unitLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LindyCurve;
