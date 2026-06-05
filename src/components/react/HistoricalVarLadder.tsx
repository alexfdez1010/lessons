import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HistoricalVarLadderProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the confidence-level segmented control. */
  confidenceLabel?: string;
  /** Label for the VaR readout chip. */
  varLabel?: string;
  /** Legend label for the shaded worst-loss tail. */
  worstLabel?: string;
  /** Legend label for the gains (right-hand) bars. */
  gainsLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Twenty realised daily P&L outcomes (in %), an intentionally lumpy mix: a few
 * brutal losses, a cluster of small moves, and a handful of decent gains. These
 * are NOT sorted — the component sorts them ascending for display so the worst
 * losses sit on the left.
 */
const DAILY_PNL: readonly number[] = [
  1.2, -0.4, 2.1, -2.2, 0.6, -4.8, 1.5, -1.1, 0.3, 3.5, -0.9, 0.8, -3.1, 1.9,
  -0.2, 2.7, -1.6, 0.4, -0.7, 1.1,
];

const CONFIDENCE_LEVELS = [90, 95, 99] as const;
type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/**
 * Teaches **historical-simulation VaR**: don't assume a distribution — just
 * sort the realised P&L and read off the percentile. The 20 daily outcomes are
 * drawn as vertical bars sorted worst→best (losses fall downward in danger red
 * on the left, gains rise in brand blue on the right). A confidence slider
 * (90/95/99%) picks how far into the loss tail to cut.
 *
 * Convention (documented and kept consistent):
 *   cutoffIndex = floor((1 - c) * N)      // c = confidence as a fraction
 * With N = 20: 90% → index 2, 95% → index 1, 99% → index 0. The bar at
 * `cutoffIndex` (counting from the worst, index 0) is the VaR boundary — the
 * worst loss you do NOT expect to exceed at that confidence. Everything from
 * index 0 up to and INCLUDING cutoffIndex is shaded as "the worst losses" (the
 * (1 - c) tail), and the reported VaR magnitude is `-sorted[cutoffIndex]` (a
 * positive number when the boundary observation is a loss).
 */
export function HistoricalVarLadder({
  title = 'Historical VaR: sort the past, read off the line',
  confidenceLabel = 'Confidence level',
  varLabel = 'VaR (worst loss not exceeded)',
  worstLabel = 'Worst losses',
  gainsLabel = 'Gains',
  caption = 'Historical VaR makes no distribution assumption: line up the realised P&L from worst to best, walk in (1 − confidence) of the way from the worst end, and read off the loss at that line.',
  className,
}: HistoricalVarLadderProps) {
  const id = useId();
  const [confidence, setConfidence] = useState<Confidence>(95);
  const [intro, setIntro] = useState(0); // 0 → 1 mount animation
  const rafRef = useRef<number | null>(null);

  const sorted = [...DAILY_PNL].sort((a, b) => a - b);
  const n = sorted.length;

  // cutoffIndex from the worst end (index 0). See the convention note above.
  const cutoffIndex = Math.floor((1 - confidence / 100) * n);
  const cutoffValue = sorted[cutoffIndex];
  // VaR magnitude: how big the boundary loss is (positive when it's a loss).
  const varMagnitude = Math.max(0, -cutoffValue);

  const W = 540;
  const H = 240;
  const padX = 14;
  const padTop = 16;
  const padBottom = 22;
  const zeroY = padTop + (H - padTop - padBottom) / 2;

  const maxAbs = Math.max(...sorted.map((v) => Math.abs(v))) || 1;
  const half = zeroY - padTop; // pixels available above (gains) / below (losses)

  const slot = (W - padX * 2) / n;
  const barW = slot * 0.62;
  const barX = (i: number) => padX + i * slot + (slot - barW) / 2;

  // Bar height grows from the baseline as `intro` eases 0 → 1.
  const barLen = (v: number) => (Math.abs(v) / maxAbs) * half * intro;

  // Mount animation: ease the bars up/down from the zero baseline.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setIntro(1);
      return;
    }
    const duration = 750;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setIntro(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // The cutoff marker sits on the right edge of the boundary bar's slot, so it
  // visually separates the shaded tail from the rest.
  const cutoffX = padX + (cutoffIndex + 1) * slot;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-danger" aria-hidden="true" />
          {worstLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {gainsLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: twenty realised daily profit-and-loss outcomes sorted from worst to best. At ${confidence}% confidence the value-at-risk is a loss of ${varMagnitude.toFixed(
          1,
        )} percent — the worst loss not expected to be exceeded.`}
      >
        {/* Shaded tail: the worst (1 − confidence) of observations. */}
        <rect
          x={padX}
          y={padTop}
          width={Math.max(0, cutoffX - padX)}
          height={H - padTop - padBottom}
          fill="var(--color-accent-300)"
          fillOpacity={0.28}
          className="transition-all duration-300"
        />

        {/* Bars */}
        {sorted.map((v, i) => {
          const isLoss = v < 0;
          const inTail = i <= cutoffIndex;
          const len = barLen(v);
          const y = isLoss ? zeroY : zeroY - len;
          return (
            <rect
              key={i}
              x={barX(i)}
              y={y}
              width={barW}
              height={Math.max(0.5, len)}
              rx={1.5}
              fill={isLoss ? 'var(--color-danger)' : 'var(--color-brand-500)'}
              fillOpacity={inTail ? 1 : isLoss ? 0.85 : 0.9}
            />
          );
        })}

        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {/* Vertical cutoff marker between the tail and the rest. */}
        <line
          x1={cutoffX}
          y1={padTop}
          x2={cutoffX}
          y2={H - padBottom}
          stroke="var(--color-accent-600)"
          strokeWidth={2}
          strokeDasharray="5 4"
          className="transition-all duration-300"
        />
        <text
          x={cutoffX}
          y={padTop + 2}
          textAnchor={cutoffIndex < n / 2 ? 'start' : 'end'}
          dx={cutoffIndex < n / 2 ? 5 : -5}
          dy={10}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-accent-600)"
        >
          {`${confidence}%`}
        </text>

        {/* Worst / best axis hints */}
        <text
          x={padX}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-500)"
          textAnchor="start"
        >
          ← {worstLabel.toLowerCase()}
        </text>
        <text
          x={W - padX}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          {gainsLabel.toLowerCase()} →
        </text>
      </svg>

      {/* Confidence segmented control + VaR readout */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span
            id={`${id}-conf-label`}
            className="block text-sm font-medium text-ink-700"
          >
            {confidenceLabel}
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-conf-label`}
            className="mt-2 inline-flex overflow-hidden rounded-pill border border-ink-200"
          >
            {CONFIDENCE_LEVELS.map((c) => {
              const active = c === confidence;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setConfidence(c)}
                  className={cx(
                    'px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    active
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface text-ink-600 hover:bg-ink-50',
                  )}
                >
                  {`${c}%`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-right">
          <span className="block text-sm font-medium text-ink-700">
            {varLabel}
          </span>
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-pill bg-accent-300/25 px-3 py-1 font-mono text-lg font-semibold text-accent-600"
            aria-live="polite"
          >
            {`−${varMagnitude.toFixed(1)}%`}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HistoricalVarLadder;
