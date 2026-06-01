import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RealRateBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Label for the nominal-rate slider and bar. */
  nominalLabel?: string;
  /** Label for the inflation slider and bar. */
  inflationLabel?: string;
  /** Label for the real-rate bar and readout. */
  realLabel?: string;
  /** Initial nominal rate as a percentage (0–20). Defaults to `5`. */
  nominal?: number;
  /** Initial inflation rate as a percentage (0–20). Defaults to `3`. */
  inflation?: number;
  /** Note shown when the real rate is positive. */
  positiveNote?: string;
  /** Note shown when the real rate is negative. */
  negativeNote?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}%`;

const signedPct = (value: number): string =>
  `${value > 0 ? '+' : ''}${pct(value)}`;

/**
 * Nominal vs real return via the exact Fisher relation. Two sliders set the
 * nominal rate and inflation; three bars show the nominal rate (up, brand),
 * the inflation bite (accent), and the resulting real rate — drawn upward in
 * brand when positive and downward below the zero line in accent when negative.
 * A big readout reports the real rate and swaps to the negative note (with an
 * accent bar) the moment purchasing power starts shrinking. Bars animate their
 * heights on change; respects `prefers-reduced-motion` (jumps to final state).
 */
export function RealRateBars({
  title = 'Real return = nominal minus the inflation bite',
  caption = 'Your money grows at the nominal rate, but prices grow too. The real rate is what is left after inflation — and when inflation outruns your rate, it turns negative: you can buy less than before.',
  nominalLabel = 'Nominal rate',
  inflationLabel = 'Inflation',
  realLabel = 'Real rate',
  nominal = 5,
  inflation = 3,
  positiveNote = 'Real rate is positive — your purchasing power is growing.',
  negativeNote = 'Real rate is negative — inflation outpaces your return, so your purchasing power is shrinking.',
  className,
}: RealRateBarsProps) {
  const id = useId();
  const [nominalState, setNominalState] = useState(nominal);
  const [inflationState, setInflationState] = useState(inflation);
  const [progress, setProgress] = useState(1); // 0 → 1 (bar grow-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padTop = 14;
  const padBottom = 14;
  // Vertical band the bars live in; zero line floats inside it so a negative
  // real bar has room to drop below it.
  const plotTop = padTop;
  const plotBottom = H - padBottom;
  const plotH = plotBottom - plotTop;
  // Zero baseline at ~70% down, leaving the lower 30% for negative bars.
  const zeroY = plotTop + plotH * 0.7;

  const real =
    ((1 + nominalState / 100) / (1 + inflationState / 100) - 1) * 100;
  const realNegative = real < 0;

  // Scale: largest magnitude among the three values maps to the taller band.
  const maxUp = Math.max(nominalState, inflationState, Math.max(real, 0), 1);
  const upH = zeroY - plotTop;
  const downH = plotBottom - zeroY;
  const maxDown = Math.max(Math.abs(Math.min(real, 0)), 1);

  // Height in px for a value drawn upward from the zero line.
  const upHeight = (value: number) => (value / maxUp) * upH * progress;
  // Height in px for a (negative) value drawn downward from the zero line.
  const downHeight = (value: number) =>
    (Math.abs(value) / maxDown) * downH * progress;

  const bars = [
    { x: padX + (W - padX * 2) * 0.07 },
    { x: padX + (W - padX * 2) * 0.4 },
    { x: padX + (W - padX * 2) * 0.73 },
  ];
  const barW = (W - padX * 2) * 0.2;

  // Animate the bars whenever either input changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
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
  }, [nominalState, inflationState]);

  const nominalBarH = upHeight(nominalState);
  const inflationBarH = upHeight(inflationState);
  const realUpH = realNegative ? 0 : upHeight(real);
  const realDownH = realNegative ? downHeight(real) : 0;

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
            realNegative ? 'bg-accent-500' : 'bg-brand-600',
          )}
        >
          {realLabel}: {signedPct(real)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {nominalLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {inflationLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className={cx(
              'h-3 w-3 rounded-pill',
              realNegative ? 'bg-accent-500' : 'bg-brand-500',
            )}
            aria-hidden="true"
          />
          {realLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${nominalLabel} ${pct(nominalState)} minus ${inflationLabel} ${pct(
          inflationState,
        )} gives a ${realLabel.toLowerCase()} of ${signedPct(real)} via the Fisher relation.`}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Nominal bar (up, brand) */}
        <rect
          x={bars[0].x}
          y={zeroY - nominalBarH}
          width={barW}
          height={nominalBarH}
          rx={4}
          fill="var(--color-brand-500)"
        />

        {/* Inflation bar (up, accent — the bite) */}
        <rect
          x={bars[1].x}
          y={zeroY - inflationBarH}
          width={barW}
          height={inflationBarH}
          rx={4}
          fill="var(--color-accent-500)"
        />

        {/* Real bar: up + brand when positive, down + accent when negative */}
        <rect
          x={bars[2].x}
          y={realNegative ? zeroY : zeroY - realUpH}
          width={barW}
          height={realNegative ? realDownH : realUpH}
          rx={4}
          fill={
            realNegative ? 'var(--color-accent-500)' : 'var(--color-brand-500)'
          }
        />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-nominal`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{nominalLabel}</span>
            <span className="font-mono text-ink-900">{pct(nominalState)}</span>
          </label>
          <input
            id={`${id}-nominal`}
            type="range"
            min={0}
            max={20}
            step={1}
            value={nominalState}
            onChange={(e) => setNominalState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-inflation`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{inflationLabel}</span>
            <span className="font-mono text-ink-900">{pct(inflationState)}</span>
          </label>
          <input
            id={`${id}-inflation`}
            type="range"
            min={0}
            max={20}
            step={1}
            value={inflationState}
            onChange={(e) => setInflationState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{nominalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(nominalState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{inflationLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(inflationState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{realLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              realNegative ? 'text-accent-500' : 'text-brand-700',
            )}
          >
            {signedPct(real)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {realNegative ? negativeNote : positiveNote}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RealRateBars;
