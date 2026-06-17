import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PurgedCvSplitProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Legend + count label for training cells. */
  trainLabel?: string;
  /** Legend + count label for the test fold. */
  testLabel?: string;
  /** Legend + count label for purged cells. */
  purgeLabel?: string;
  /** Legend + count label for embargoed cells. */
  embargoLabel?: string;
  /** Label for the test-fold position slider. */
  positionLabel?: string;
  /** Label for the embargo-size slider. */
  embargoSliderLabel?: string;
  /** Label for the label-horizon slider. */
  labelSpanLabel?: string;
  className?: string;
}

/** Total number of contiguous sample-cells on the timeline. */
const N = 40;
/** Fixed width of the test fold, in cells. */
const TEST_WIDTH = 8;

type Kind = 'train' | 'test' | 'purge' | 'embargo';

/**
 * Purged & Embargoed K-Fold cross-validation, visualized on a timeline of
 * contiguous sample-cells (left → right = time).
 *
 * In time-series ML a sample's *label* is realized over a forward window
 * (e.g. the label at time t depends on returns over [t, t+h]). Naive k-fold CV
 * therefore leaks: if a training sample's label window overlaps the test fold's
 * span, the model effectively trains on the future it is being tested on.
 *
 * The fix (López de Prado, "Advances in Financial Machine Learning"):
 *  - PURGE training samples whose label windows overlap the test fold — the
 *    `labelSpan` cells immediately before and after the test block.
 *  - EMBARGO an extra band right after the test fold to kill serial-correlation
 *    leakage from features that bleed forward.
 *
 * Pure SVG with CSS-eased transitions; respects prefers-reduced-motion globally.
 */
export function PurgedCvSplit({
  title = 'Purged & embargoed k-fold: stop the backtest from seeing the future',
  caption = 'A sample’s label is decided over a forward window, so a training sample whose label window overlaps the test fold leaks the answer — naive k-fold trains on the future it then scores. Purging drops the training cells whose label horizon (set by the slider) overlaps the test block on either side. The embargo drops a few extra cells right after the test fold, where serial correlation lets features bleed forward. What survives is leakage-free training data and an honest out-of-sample estimate.',
  trainLabel = 'Train',
  testLabel = 'Test',
  purgeLabel = 'Purged',
  embargoLabel = 'Embargo',
  positionLabel = 'Test fold position',
  embargoSliderLabel = 'Embargo (cells)',
  labelSpanLabel = 'Label horizon (cells)',
  className,
}: PurgedCvSplitProps) {
  const id = useId();

  // Test window can sit anywhere keeping all TEST_WIDTH cells in-bounds.
  const maxStart = N - TEST_WIDTH;
  const [testStart, setTestStart] = useState(16);
  const [embargo, setEmbargo] = useState(2);
  const [labelSpan, setLabelSpan] = useState(2);

  const testEnd = testStart + TEST_WIDTH - 1; // inclusive

  // Classify every cell. Precedence: Test > Purge > Embargo > Train.
  const classify = (i: number): Kind => {
    if (i >= testStart && i <= testEnd) return 'test';
    // Purge band: `labelSpan` cells on each side of the test block.
    const inPurgeBefore = i < testStart && i >= testStart - labelSpan;
    const inPurgeAfter = i > testEnd && i <= testEnd + labelSpan;
    if (inPurgeBefore || inPurgeAfter) return 'purge';
    // Embargo band: `embargo` cells immediately after the after-purge band.
    const embargoStart = testEnd + labelSpan + 1;
    if (i >= embargoStart && i < embargoStart + embargo) return 'embargo';
    return 'train';
  };

  const cells: Kind[] = Array.from({ length: N }, (_, i) => classify(i));
  const counts = cells.reduce(
    (acc, k) => {
      acc[k] += 1;
      return acc;
    },
    { train: 0, test: 0, purge: 0, embargo: 0 } as Record<Kind, number>,
  );

  const fillFor: Record<Kind, string> = {
    train: 'var(--color-brand-500)',
    test: 'var(--color-accent-500)',
    purge: 'var(--color-ink-200)',
    embargo: 'var(--color-ink-300)',
  };
  const strokeFor: Record<Kind, string> = {
    train: 'var(--color-brand-600)',
    test: 'var(--color-accent-600)',
    purge: 'var(--color-warning)',
    embargo: 'var(--color-ink-500)',
  };

  // SVG geometry.
  const W = 520;
  const H = 96;
  const padX = 8;
  const cellGap = 2;
  const stripY = 30;
  const stripH = 38;
  const trackW = W - padX * 2;
  const cellW = (trackW - cellGap * (N - 1)) / N;
  const xFor = (i: number) => padX + i * (cellW + cellGap);

  const ariaLabel =
    `Timeline of ${N} sample cells in time order. A test fold of ${TEST_WIDTH} cells sits at positions ` +
    `${testStart + 1} to ${testEnd + 1}. ${counts.purge} cells are purged around it, ` +
    `${counts.embargo} cells are embargoed after it, and ${counts.train} cells remain for training.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-[3px] border"
            style={{ backgroundColor: fillFor.train, borderColor: strokeFor.train }}
            aria-hidden="true"
          />
          {trainLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-[3px] border"
            style={{ backgroundColor: fillFor.test, borderColor: strokeFor.test }}
            aria-hidden="true"
          />
          {testLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-[3px] border border-dashed"
            style={{ backgroundColor: fillFor.purge, borderColor: strokeFor.purge }}
            aria-hidden="true"
          />
          {purgeLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-[3px] border border-dashed"
            style={{ backgroundColor: fillFor.embargo, borderColor: strokeFor.embargo }}
            aria-hidden="true"
          />
          {embargoLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* time arrow */}
        <line
          x1={padX}
          y1={stripY - 10}
          x2={W - padX}
          y2={stripY - 10}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />
        <text x={padX} y={stripY - 15} fontSize={10} fill="var(--color-ink-500)">
          earlier
        </text>
        <text
          x={W - padX}
          y={stripY - 15}
          fontSize={10}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          later (time →)
        </text>

        {cells.map((kind, i) => (
          <rect
            key={i}
            x={xFor(i)}
            y={stripY}
            width={cellW}
            height={stripH}
            rx={2}
            fill={fillFor[kind]}
            stroke={strokeFor[kind]}
            strokeWidth={1}
            strokeDasharray={kind === 'purge' || kind === 'embargo' ? '3 2' : undefined}
            style={{ transition: 'all 250ms ease' }}
          />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{trainLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{counts.train}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{testLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{counts.test}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{purgeLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{counts.purge}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{embargoLabel}</span>
          <span className="font-mono font-semibold text-ink-700">{counts.embargo}</span>
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-pos`}
            className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
          >
            <span>{positionLabel}</span>
            <span className="font-mono text-brand-600" aria-hidden="true">
              {testStart + 1}
            </span>
          </label>
          <input
            id={`${id}-pos`}
            type="range"
            min={0}
            max={maxStart}
            step={1}
            value={testStart}
            onChange={(e) => setTestStart(Number(e.target.value))}
            aria-valuetext={`test fold starts at cell ${testStart + 1}`}
            className="mt-2 w-full accent-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-emb`}
            className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
          >
            <span>{embargoSliderLabel}</span>
            <span className="font-mono text-brand-600" aria-hidden="true">
              {embargo}
            </span>
          </label>
          <input
            id={`${id}-emb`}
            type="range"
            min={0}
            max={4}
            step={1}
            value={embargo}
            onChange={(e) => setEmbargo(Number(e.target.value))}
            aria-valuetext={`${embargo} embargo cells`}
            className="mt-2 w-full accent-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-span`}
            className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
          >
            <span>{labelSpanLabel}</span>
            <span className="font-mono text-brand-600" aria-hidden="true">
              {labelSpan}
            </span>
          </label>
          <input
            id={`${id}-span`}
            type="range"
            min={1}
            max={4}
            step={1}
            value={labelSpan}
            onChange={(e) => setLabelSpan(Number(e.target.value))}
            aria-valuetext={`label horizon of ${labelSpan} cells`}
            className="mt-2 w-full accent-brand-500"
          />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PurgedCvSplit;
