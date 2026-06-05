import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SamplingHistogramProps {
  /** Heading above the chart. */
  title?: string;
  /** Toggle label for the thin-tailed Normal distribution. */
  normalLabel?: string;
  /** Toggle label for the fat-tailed (Student-t-like) distribution. */
  fatTailLabel?: string;
  /** Label for the draw-samples button. */
  drawLabel?: string;
  /** Label for the samples-drawn readout. */
  samplesLabel?: string;
  /** Legend label for the smooth target-density curve. */
  densityLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type DistKind = 'normal' | 'fat';

const X_MIN = -5;
const X_MAX = 5;
const BINS = 40;
const BIN_WIDTH = (X_MAX - X_MIN) / BINS;
const BATCH_TARGET = 4000; // total samples per full draw
const BATCH_SIZE = 120; // samples added per animation frame

// Box–Muller: two uniforms → one standard normal draw.
const normalSample = (): number => {
  let u1 = Math.random();
  const u2 = Math.random();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// Exact Student-t with df = 3: t = z0 / sqrt((z1^2 + z2^2 + z3^2) / 3).
const studentT3Sample = (): number => {
  const z0 = normalSample();
  const z1 = normalSample();
  const z2 = normalSample();
  const z3 = normalSample();
  const denom = Math.sqrt((z1 * z1 + z2 * z2 + z3 * z3) / 3);
  return z0 / (denom < 1e-9 ? 1e-9 : denom);
};

const sampleFor = (kind: DistKind): number =>
  kind === 'normal' ? normalSample() : studentT3Sample();

// Standard normal pdf.
const normalPdf = (x: number): number =>
  Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);

// Student-t pdf with df = 3 (analytic constant for df=3).
// f(x) = 2 / (pi * sqrt(3) * (1 + x^2/3)^2).
const studentT3Pdf = (x: number): number =>
  2 / (Math.PI * Math.sqrt(3) * Math.pow(1 + (x * x) / 3, 2));

const pdfFor = (kind: DistKind, x: number): number =>
  kind === 'normal' ? normalPdf(x) : studentT3Pdf(x);

// Index of the histogram bin a sample lands in (extremes clamp to edge bins).
const binIndex = (x: number): number => {
  const i = Math.floor((x - X_MIN) / BIN_WIDTH);
  if (i < 0) return 0;
  if (i >= BINS) return BINS - 1;
  return i;
};

/**
 * A Monte-Carlo sampling picture. Press "draw samples" and random draws stream
 * in batches into a fixed histogram over [-5, 5], the bars growing each frame
 * while a smooth target-density curve sits over them as a reference. Toggle
 * between a thin-tailed Normal and a fat-tailed Student-t (df = 3): the same
 * sampling machinery reproduces whichever density you feed it, but the
 * fat-tailed one scatters far more draws out into the clamped edge bins. The
 * fill animates via requestAnimationFrame, and respects
 * `prefers-reduced-motion` (renders the final histogram immediately).
 */
export function SamplingHistogram({
  title = 'Sampling a distribution, one draw at a time',
  normalLabel = 'Normal (thin tails)',
  fatTailLabel = 'Fat tails',
  drawLabel = 'Draw samples',
  samplesLabel = 'Samples drawn',
  densityLabel = 'Target density',
  caption = 'Each press draws thousands of random numbers and drops them into bins. The bars climb toward the smooth target density — and the fat-tailed version keeps flinging draws into the far edges where the thin-tailed one almost never reaches.',
  className,
}: SamplingHistogramProps) {
  const id = useId();
  const [kind, setKind] = useState<DistKind>('normal');
  const [counts, setCounts] = useState<number[]>(() => new Array(BINS).fill(0));
  const [drawn, setDrawn] = useState(0);

  // Mutable working state for the animation loop.
  const countsRef = useRef<number[]>(new Array(BINS).fill(0));
  const drawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const kindRef = useRef<DistKind>(kind);

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const reset = (next: DistKind) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    countsRef.current = new Array(BINS).fill(0);
    drawnRef.current = 0;
    setCounts(countsRef.current.slice());
    setDrawn(0);
    setKind(next);
  };

  const draw = () => {
    const activeKind = kindRef.current;

    if (prefersReducedMotion()) {
      for (let n = 0; n < BATCH_TARGET; n++) {
        countsRef.current[binIndex(sampleFor(activeKind))] += 1;
      }
      drawnRef.current += BATCH_TARGET;
      setCounts(countsRef.current.slice());
      setDrawn(drawnRef.current);
      return;
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    let added = 0;
    const step = () => {
      const take = Math.min(BATCH_SIZE, BATCH_TARGET - added);
      for (let n = 0; n < take; n++) {
        countsRef.current[binIndex(sampleFor(activeKind))] += 1;
      }
      added += take;
      drawnRef.current += take;
      setCounts(countsRef.current.slice());
      setDrawn(drawnRef.current);
      if (added < BATCH_TARGET) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const W = 520;
  const H = 220;
  const padX = 8;
  const padTop = 14;
  const padBottom = 24;
  const baseY = H - padBottom;

  const xToPx = (x: number) =>
    padX + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - padX * 2);

  // Scale so a full histogram and the pdf curve share a height.
  // Convert bin counts to a density: count / (total * binWidth).
  const total = drawn > 0 ? drawn : 1;
  const peakPdf = pdfFor(kind, 0);
  // Headroom so the tallest realistic bar/curve does not hit the ceiling.
  const yScale = (H - padTop - padBottom) / (peakPdf * 1.25);

  const densityToPx = (d: number) => baseY - d * yScale;

  const barWidth = (W - padX * 2) / BINS;

  const curvePath = (): string => {
    const STEPS = 160;
    let d = '';
    for (let i = 0; i <= STEPS; i++) {
      const x = X_MIN + (i / STEPS) * (X_MAX - X_MIN);
      const px = xToPx(x);
      const py = densityToPx(pdfFor(kind, x));
      d += `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
  };

  const drawnText = drawn.toLocaleString('en-US');

  const tabClass = (active: boolean) =>
    cx(
      'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
      active
        ? 'border-brand-200 bg-brand-50 text-brand-700'
        : 'border-ink-100 bg-surface-50 text-ink-600 hover:text-ink-900',
    );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Distribution toggle */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={title}
      >
        <button
          type="button"
          className={tabClass(kind === 'normal')}
          aria-pressed={kind === 'normal'}
          onClick={() => reset('normal')}
        >
          {normalLabel}
        </button>
        <button
          type="button"
          className={tabClass(kind === 'fat')}
          aria-pressed={kind === 'fat'}
          onClick={() => reset('fat')}
        >
          {fatTailLabel}
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {samplesLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-600" aria-hidden="true" />
          {densityLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Histogram of ${drawnText} random samples drawn from the ${
          kind === 'normal' ? normalLabel : fatTailLabel
        } distribution over the range -5 to 5, with the smooth target density curve overlaid for comparison.`}
      >
        {/* Baseline (sample-value axis) */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Histogram bars */}
        {counts.map((c, i) => {
          const density = c / (total * BIN_WIDTH);
          const topY = densityToPx(density);
          const h = Math.max(0, baseY - topY);
          const x = padX + i * barWidth;
          return (
            <rect
              key={`${id}-bar-${i}`}
              x={x + 0.5}
              y={baseY - h}
              width={Math.max(0, barWidth - 1)}
              height={h}
              fill="var(--color-brand-500)"
              fillOpacity={0.45}
            />
          );
        })}

        {/* Theoretical target-density curve */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Axis ticks at the extremes and zero */}
        <text
          x={xToPx(X_MIN)}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          {X_MIN}
        </text>
        <text
          x={xToPx(0)}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="middle"
        >
          0
        </text>
        <text
          x={xToPx(X_MAX)}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {`+${X_MAX}`}
        </text>
      </svg>

      {/* Controls + readout */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-pill border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
          onClick={draw}
        >
          {drawLabel}
        </button>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{samplesLabel}</span>
          <span className="font-mono font-semibold text-accent-600" aria-live="polite">
            {drawnText}
          </span>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SamplingHistogram;
