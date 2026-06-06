import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BayesGridProps {
  /** Heading above the grid. */
  title?: string;
  /** Label for the base-rate (prior) slider. */
  baseRateLabel?: string;
  /** Label for the sensitivity / true-positive-rate slider. */
  sensitivityLabel?: string;
  /** Label for the false-positive-rate slider. */
  falsePositiveLabel?: string;
  /** Legend + readout label for true positives (real & flagged). */
  truePositiveLabel?: string;
  /** Legend + readout label for false positives (not real & flagged). */
  falsePositiveBucketLabel?: string;
  /** Legend label for false negatives (real & missed). */
  falseNegativeLabel?: string;
  /** Legend label for true negatives (not real & not flagged). */
  trueNegativeLabel?: string;
  /** Readout label for the headline posterior P(real | flagged). */
  posteriorLabel?: string;
  /** Label for the whole population of events (used in the summary line). */
  populationLabel?: string;
  /** One-line takeaway shown under the grid. */
  caption?: string;
  /** Number of events in the population. Defaults to `1000` (40×25 grid). */
  population?: number;
  /** Initial base rate as a fraction (0.01–0.50). Defaults to `0.05`. */
  baseRate?: number;
  /** Initial sensitivity / TPR as a fraction (0.50–0.99). Defaults to `0.9`. */
  sensitivity?: number;
  /** Initial false-positive rate as a fraction (0.01–0.30). Defaults to `0.1`. */
  falsePositiveRate?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

type Bucket = 'tp' | 'fn' | 'fp' | 'tn';

const BUCKET_FILL: Record<Bucket, string> = {
  tp: 'var(--color-brand-500)',
  fn: 'var(--color-brand-200)',
  fp: 'var(--color-accent-500)',
  tn: 'var(--color-ink-200)',
};

/**
 * Natural-frequency Bayes grid for teaching base rates and the prosecutor's
 * fallacy. A population of events (default 1000) is drawn as an SVG grid of
 * small squares. A base-rate slider sets how many are truly "real edges"; a
 * sensitivity slider sets how many real ones the detector flags; a
 * false-positive slider sets how many fake ones it wrongly flags. Each cell is
 * coloured into one of four buckets — true positive (brand-500), false positive
 * (accent-500, the villain), false negative (brand-200) and true negative
 * (ink-200). The headline readout is the posterior P(real | flagged) =
 * TP / (TP + FP): with a low base rate even a strong test produces mostly false
 * alarms. Cells transition colour on slider changes; respects
 * `prefers-reduced-motion` (no transition).
 */
export function BayesGrid({
  title = 'Most alarms are false alarms',
  baseRateLabel = 'Base rate (prior P(real))',
  sensitivityLabel = 'Sensitivity (true-positive rate)',
  falsePositiveLabel = 'False-positive rate',
  truePositiveLabel = 'True positive (real & flagged)',
  falsePositiveBucketLabel = 'False positive (not real & flagged)',
  falseNegativeLabel = 'False negative (real & missed)',
  trueNegativeLabel = 'True negative (not real & not flagged)',
  posteriorLabel = 'P(real | flagged)',
  populationLabel = 'events',
  caption = 'When real edges are rare, even a sharp detector floods you with false alarms. Of everything it flags, only a sliver is genuinely real — that fraction is the posterior, and it can be shockingly small.',
  population = 1000,
  baseRate = 0.05,
  sensitivity = 0.9,
  falsePositiveRate = 0.1,
  className,
}: BayesGridProps) {
  const id = useId();
  const [baseRateState, setBaseRateState] = useState(baseRate);
  const [sensitivityState, setSensitivityState] = useState(sensitivity);
  const [fprState, setFprState] = useState(falsePositiveRate);

  const cols = 40;
  const rows = Math.max(1, Math.round(population / cols));
  const total = cols * rows;

  // Whole-event counts so the grid and the readout always agree.
  const real = Math.round(total * baseRateState);
  const notReal = total - real;
  const tp = Math.round(real * sensitivityState);
  const fn = real - tp;
  const fp = Math.round(notReal * fprState);
  const tn = notReal - fp;
  const flagged = tp + fp;
  const posterior = flagged > 0 ? tp / flagged : 0;

  // Assign each cell index to a bucket, in order: TP, FN, FP, TN. The layout is
  // memoised on the counts so identical states reuse the same array.
  const cells = useMemo<Bucket[]>(() => {
    const out: Bucket[] = new Array(total);
    let i = 0;
    for (let k = 0; k < tp && i < total; k++, i++) out[i] = 'tp';
    for (let k = 0; k < fn && i < total; k++, i++) out[i] = 'fn';
    for (let k = 0; k < fp && i < total; k++, i++) out[i] = 'fp';
    for (; i < total; i++) out[i] = 'tn';
    return out;
  }, [total, tp, fn, fp]);

  const reduceMotion = prefersReducedMotion();

  // SVG geometry. Cells are unit squares with a small gap; viewBox scales them.
  const cell = 10;
  const gap = 1.5;
  const step = cell + gap;
  const W = cols * step - gap;
  const H = rows * step - gap;

  const basePct = Math.round(baseRateState * 100);
  const sensPct = Math.round(sensitivityState * 100);
  const fprPct = Math.round(fprState * 100);

  const summary = `${populationLabel}: ${total.toLocaleString('en-US')}; flagged: ${flagged.toLocaleString(
    'en-US',
  )}; truly real: ${real.toLocaleString('en-US')}.`;

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
          {posteriorLabel}: {pct(posterior)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-500"
            aria-hidden="true"
          />
          {truePositiveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-accent-500"
            aria-hidden="true"
          />
          {falsePositiveBucketLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-200"
            aria-hidden="true"
          />
          {falseNegativeLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-ink-200" aria-hidden="true" />
          {trueNegativeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: of ${total.toLocaleString(
          'en-US',
        )} ${populationLabel}, ${real.toLocaleString(
          'en-US',
        )} are truly real and ${flagged.toLocaleString(
          'en-US',
        )} get flagged. Of the flagged ones, ${tp.toLocaleString(
          'en-US',
        )} are real and ${fp.toLocaleString(
          'en-US',
        )} are false alarms, so the probability a flagged event is real is ${pct(
          posterior,
        )}.`}
      >
        {cells.map((bucket, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          return (
            <rect
              key={index}
              x={col * step}
              y={row * step}
              width={cell}
              height={cell}
              rx={1.5}
              fill={BUCKET_FILL[bucket]}
              style={
                reduceMotion ? undefined : { transition: 'fill 350ms ease' }
              }
            />
          );
        })}
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-base`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{baseRateLabel}</span>
            <span className="font-mono text-ink-900">{basePct}%</span>
          </label>
          <input
            id={`${id}-base`}
            type="range"
            min={1}
            max={50}
            step={1}
            value={basePct}
            onChange={(e) => setBaseRateState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-sens`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{sensitivityLabel}</span>
            <span className="font-mono text-ink-900">{sensPct}%</span>
          </label>
          <input
            id={`${id}-sens`}
            type="range"
            min={50}
            max={99}
            step={1}
            value={sensPct}
            onChange={(e) => setSensitivityState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-fpr`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{falsePositiveLabel}</span>
            <span className="font-mono text-ink-900">{fprPct}%</span>
          </label>
          <input
            id={`${id}-fpr`}
            type="range"
            min={1}
            max={30}
            step={1}
            value={fprPct}
            onChange={(e) => setFprState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{truePositiveLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {tp.toLocaleString('en-US')}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{falsePositiveBucketLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {fp.toLocaleString('en-US')}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{posteriorLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(posterior)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm font-medium text-ink-700" aria-live="polite">
        {summary}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BayesGrid;
