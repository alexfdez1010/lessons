import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single calibration reading: how sure people felt vs how often they were right (both 0–100). */
export interface CalibrationPoint {
  /** Stated confidence, 0–100. */
  confidence: number;
  /** Observed accuracy at that confidence, 0–100. */
  accuracy: number;
}

export interface OverconfidenceCalibrationProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Calibration readings. Defaults to a dataset showing overconfidence (curve below the diagonal). */
  points?: CalibrationPoint[];
  /** x-axis label. */
  confidenceAxisLabel?: string;
  /** y-axis label. */
  accuracyAxisLabel?: string;
  /** Legend + diagonal label. */
  perfectLabel?: string;
  /** Legend + data-curve label. */
  actualLabel?: string;
  /** Label for the shaded gap between curve and diagonal. */
  gapLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Default dataset: a classic overconfidence (calibration) curve. At every stated
 * confidence level above ~50%, people are right *less* often than they claim, so
 * the curve sits below the 45° diagonal. The gap widens at high confidence —
 * "90% sure" is right only ~65% of the time here, and overprecision research finds
 * 90% intervals contain the truth only ~45% of the time.
 */
const DEFAULT_POINTS: CalibrationPoint[] = [
  { confidence: 50, accuracy: 49 },
  { confidence: 60, accuracy: 53 },
  { confidence: 70, accuracy: 58 },
  { confidence: 80, accuracy: 63 },
  { confidence: 90, accuracy: 66 },
  { confidence: 100, accuracy: 72 },
];

const pct = (value: number): string => `${Math.round(value)}%`;

/**
 * Calibration (reliability) chart for overconfidence. The x-axis is stated
 * confidence (%); the y-axis is actual accuracy (%). A 45° diagonal marks perfect
 * calibration — if you say "80% sure", you're right 80% of the time. The data
 * curve sits *below* the diagonal: people are consistently less accurate than they
 * feel, and the shaded wedge between the two is the overconfidence gap. The curve
 * draws in on mount and respects `prefers-reduced-motion` (jumps to final state).
 */
export function OverconfidenceCalibration({
  title = 'How sure people felt vs how often they were right',
  caption = 'Perfect calibration would put every dot on the diagonal: 80% sure means right 80% of the time. Real people sit below it — the more confident they feel, the wider the gap. That wedge is overconfidence, and overprecision research finds the "90% sure" range holds the truth only about 45% of the time.',
  points = DEFAULT_POINTS,
  confidenceAxisLabel = 'How sure people felt',
  accuracyAxisLabel = 'How often they were right',
  perfectLabel = 'Perfect calibration',
  actualLabel = 'Typical investor',
  gapLabel = 'the overconfidence gap',
  className,
}: OverconfidenceCalibrationProps) {
  const [progress, setProgress] = useState(1); // 0 → 1 (curve + shading reveal)
  const rafRef = useRef<number | null>(null);

  const W = 360;
  const H = 360;
  const padL = 44;
  const padR = 16;
  const padTop = 16;
  const padBottom = 44;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;

  // Coordinate transforms: confidence/accuracy are 0–100; y inverted.
  const xOf = (conf: number) => padL + (conf / 100) * plotW;
  const yOf = (acc: number) => padTop + (1 - acc / 100) * plotH;

  // Sorted, clamped copy of the data so the path + shading are well-formed.
  const sorted = [...points]
    .map((p) => ({
      confidence: Math.min(100, Math.max(0, p.confidence)),
      accuracy: Math.min(100, Math.max(0, p.accuracy)),
    }))
    .sort((a, b) => a.confidence - b.confidence);

  // Average shortfall (diagonal − curve), in percentage points, for the readout.
  const avgGap =
    sorted.length > 0
      ? sorted.reduce((sum, p) => sum + (p.confidence - p.accuracy), 0) /
        sorted.length
      : 0;

  // How many points the reveal has reached (so dots pop in left→right with the line).
  const revealedCount = Math.max(1, Math.round(progress * sorted.length));
  const revealed = sorted.slice(0, revealedCount);

  // Data-curve polyline through the revealed points.
  const curvePath =
    revealed.length > 0
      ? revealed
          .map(
            (p, i) =>
              `${i === 0 ? 'M' : 'L'} ${xOf(p.confidence).toFixed(2)} ${yOf(
                p.accuracy,
              ).toFixed(2)}`,
          )
          .join(' ')
      : '';

  // Shaded wedge: the diagonal across the top, the data curve back along the bottom.
  // Only spans the confidence range the data covers, so it hugs the actual gap.
  const gapPath = (() => {
    if (revealed.length < 2) return '';
    const top = revealed
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${xOf(p.confidence).toFixed(2)} ${yOf(
            p.confidence,
          ).toFixed(2)}`,
      )
      .join(' ');
    const bottom = [...revealed]
      .reverse()
      .map((p) => `L ${xOf(p.confidence).toFixed(2)} ${yOf(p.accuracy).toFixed(2)}`)
      .join(' ');
    return `${top} ${bottom} Z`;
  })();

  // Animate the reveal on mount.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const prog = Math.min(1, (ts - startTs) / duration);
      setProgress(prog);
      if (prog < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const grid = [0, 25, 50, 75, 100];

  const ariaLabel = `${title}. The diagonal is perfect calibration. The data curve sits below it: ${sorted
    .map((p) => `at ${pct(p.confidence)} stated confidence, actual accuracy is ${pct(p.accuracy)}`)
    .join('; ')}. On average people are about ${Math.round(
    avgGap,
  )} percentage points less accurate than they feel — the overconfidence gap.`;

  // Mid-wedge anchor for the gap label, at the highest-confidence revealed point.
  const labelAnchor = revealed.length > 0 ? revealed[revealed.length - 1] : null;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white">
          −{Math.round(avgGap)} pts
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-ink-300"
            aria-hidden="true"
          />
          {perfectLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {actualLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-5 rounded-sm bg-accent-500/25"
            aria-hidden="true"
          />
          {gapLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto mt-3 w-full max-w-md"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot frame */}
        <rect
          x={padL}
          y={padTop}
          width={plotW}
          height={plotH}
          fill="var(--color-surface-sunken)"
          opacity={0.35}
          rx={6}
        />

        {/* Gridlines + axis ticks */}
        {grid.map((g) => (
          <g key={`grid-${g}`}>
            <line
              x1={xOf(g)}
              y1={padTop}
              x2={xOf(g)}
              y2={padTop + plotH}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <line
              x1={padL}
              y1={yOf(g)}
              x2={padL + plotW}
              y2={yOf(g)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={xOf(g)}
              y={padTop + plotH + 14}
              textAnchor="middle"
              fill="var(--color-ink-500)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {g}
            </text>
            <text
              x={padL - 6}
              y={yOf(g) + 3}
              textAnchor="end"
              fill="var(--color-ink-500)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {g}
            </text>
          </g>
        ))}

        {/* Shaded overconfidence gap (between diagonal and data curve) */}
        {gapPath && (
          <path
            d={gapPath}
            fill="var(--color-accent-500)"
            opacity={0.22}
            stroke="none"
          />
        )}

        {/* 45° perfect-calibration diagonal */}
        <line
          x1={xOf(0)}
          y1={yOf(0)}
          x2={xOf(100)}
          y2={yOf(100)}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Data curve (animated reveal) */}
        {curvePath && (
          <path
            d={curvePath}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data dots */}
        {revealed.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={xOf(p.confidence)}
            cy={yOf(p.accuracy)}
            r={4}
            fill="var(--color-brand-600)"
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          />
        ))}

        {/* Gap label, anchored to the right edge of the revealed wedge */}
        {progress >= 1 && labelAnchor && (
          <text
            x={xOf(labelAnchor.confidence) + 6}
            y={(yOf(labelAnchor.confidence) + yOf(labelAnchor.accuracy)) / 2 + 3}
            textAnchor="end"
            fill="var(--color-accent-600)"
            fontSize="10"
            fontFamily="var(--font-sans)"
          >
            {gapLabel}
          </text>
        )}

        {/* x-axis caption */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {confidenceAxisLabel}
        </text>

        {/* y-axis caption (rotated) */}
        <text
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
          x={12}
          y={padTop + plotH / 2}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {accuracyAxisLabel}
        </text>
      </svg>

      {/* Text equivalent of the chart (screen-reader + reduced-motion friendly) */}
      <dl
        className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        {sorted.map((p, i) => (
          <div
            key={`row-${i}`}
            className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2"
          >
            <dt className="text-ink-500">{pct(p.confidence)} sure</dt>
            <dd className="font-mono text-base font-semibold text-brand-700">
              {pct(p.accuracy)} right
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default OverconfidenceCalibration;
