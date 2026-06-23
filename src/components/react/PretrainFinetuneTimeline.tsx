import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PretrainFinetuneTimelineProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "from scratch" (old) paradigm. */
  fromScratchLabel?: string;
  /** Label for the "foundation model" (new) paradigm. */
  foundationLabel?: string;
  /** Label for the number-of-tasks slider. */
  tasksLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

// --- Illustrative unit costs (labeled constants) ----------------------------
// OLD paradigm — one model per task, trained from scratch every time. No sharing,
// so the bill is purely linear in the number of downstream tasks N.
const SCRATCH_PER_TASK = 10; // training cost for ONE task, from zero
// NEW paradigm — pay one big fixed pretraining cost ONCE on a broad corpus, then
// adapt cheaply to each task (zero-shot ≈ free, few-shot/fine-tune = small).
const PRETRAIN_FIXED = 40; // one-time pretraining cost, paid regardless of N
const ADAPT_PER_TASK = 1; // marginal cost to adapt the shared model to one task

const MAX_TASKS = 20;

const scratchCost = (n: number): number => SCRATCH_PER_TASK * n;
const foundationCost = (n: number): number => PRETRAIN_FIXED + ADAPT_PER_TASK * n;

// Crossover N: the smallest task count where the foundation paradigm is cheaper.
//   PRETRAIN_FIXED + ADAPT*n < SCRATCH*n  ⇒  n > PRETRAIN_FIXED / (SCRATCH - ADAPT)
const CROSSOVER = Math.floor(PRETRAIN_FIXED / (SCRATCH_PER_TASK - ADAPT_PER_TASK)) + 1;

/**
 * The pretrain-and-adapt paradigm, drawn as an amortization race. The OLD way
 * trains one bespoke model per task from scratch, so covering N downstream tasks
 * costs N × (full training run) — a straight line through the origin, no sharing
 * of work between tasks. The NEW way (a foundation model) pays one big FIXED
 * pretraining cost once on a broad corpus, then ADAPTS cheaply to each task
 * (zero-shot is nearly free, few-shot / fine-tune is small). Its cost is a line
 * that starts high (the pretraining toll) but climbs slowly.
 *
 * Because the foundation line starts high and rises slowly while the from-scratch
 * line starts at zero and rises fast, they cross. Below the crossover N the old
 * way is cheaper (the fixed cost hasn't been spread over enough tasks); beyond it
 * the foundation model wins and keeps winning. The slider sweeps N from 1 to 20 so
 * the learner can watch the bars trade places and find the break-even point.
 *
 * The catch the caption insists on: this amortization only pays off if the
 * pretrained representation actually TRANSFERS to the new task. Financial markets
 * are adversarial and non-stationary, so transfer is precisely the assumption in
 * doubt — the geometry is clean, the economics depend on a bet about generalization.
 */
export function PretrainFinetuneTimeline({
  title = 'One model per task vs. pretrain once, adapt cheaply',
  fromScratchLabel = 'From scratch (one model per task)',
  foundationLabel = 'Foundation model (pretrain + adapt)',
  tasksLabel = 'Downstream tasks (N)',
  caption =
    'The old way trains a fresh model for every task, so the bill grows in a straight line — N tasks cost N full training runs, with nothing shared. A foundation model instead pays one big fixed pretraining cost up front, then adapts to each task for almost nothing, so its line starts high but climbs slowly. The two cross near N≈' +
    CROSSOVER +
    ': below it the from-scratch route is cheaper (the fixed cost has not been spread over enough tasks), beyond it the foundation model wins and keeps winning. The fine print: this amortization only pays off if the pretrained representation actually TRANSFERS to the new task — and financial markets are adversarial and non-stationary, so transfer is exactly what is in doubt.',
  className,
}: PretrainFinetuneTimelineProps) {
  const id = useId();
  const [n, setN] = useState(3);

  const scratch = scratchCost(n);
  const foundation = foundationCost(n);
  const cheaper = foundation < scratch ? 'foundation' : foundation > scratch ? 'scratch' : 'tie';

  // --- SVG layout: a small two-line cost-vs-N chart -------------------------
  const W = 360;
  const H = 220;
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Y axis spans 0 .. the larger of the two end-of-range totals, rounded up a bit.
  const yMaxRaw = Math.max(scratchCost(MAX_TASKS), foundationCost(MAX_TASKS));
  const yMax = Math.ceil(yMaxRaw / 50) * 50;

  const xOf = (tasks: number): number => padL + (plotW * (tasks - 1)) / (MAX_TASKS - 1);
  const yOf = (cost: number): number => padT + plotH - (plotH * cost) / yMax;

  // Pure polyline strings for both paradigms across the full N range.
  const line = (fn: (tasks: number) => number): string =>
    Array.from({ length: MAX_TASKS }, (_, i) => `${xOf(i + 1)},${yOf(fn(i + 1))}`).join(' ');
  const scratchLine = line(scratchCost);
  const foundationLine = line(foundationCost);

  // Y gridline ticks.
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  const cx0 = xOf(CROSSOVER);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-5 rounded-pill"
            style={{ backgroundColor: 'var(--color-ink-400)' }}
            aria-hidden="true"
          />
          <span className="text-ink-700">{fromScratchLabel}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-5 rounded-pill"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
            aria-hidden="true"
          />
          <span className="text-ink-700">{foundationLabel}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full max-w-md"
        role="img"
        aria-label={`A cost-versus-number-of-tasks chart. The from-scratch paradigm costs ${SCRATCH_PER_TASK} units per task, a straight line from the origin. The foundation paradigm costs a fixed ${PRETRAIN_FIXED} units to pretrain plus ${ADAPT_PER_TASK} unit to adapt per task, a line that starts high but rises slowly. The two cross near N equals ${CROSSOVER}. At the current N of ${n}, from-scratch totals ${scratch} units and the foundation model totals ${foundation} units, so the ${cheaper === 'tie' ? 'two paradigms tie' : cheaper === 'foundation' ? 'foundation model is cheaper' : 'from-scratch route is cheaper'}.`}
      >
        {/* Y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={yOf(t) + 3}
              fontSize={8}
              fill="var(--color-ink-500)"
              textAnchor="end"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X axis labels (N = 1, 5, 10, 15, 20) */}
        {[1, 5, 10, 15, 20].map((tick) => (
          <text
            key={`x-${tick}`}
            x={xOf(tick)}
            y={H - padB + 14}
            fontSize={8}
            fill="var(--color-ink-500)"
            textAnchor="middle"
          >
            {tick}
          </text>
        ))}
        <text
          x={padL + plotW / 2}
          y={H - 4}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {tasksLabel}
        </text>

        {/* Crossover marker */}
        <line
          x1={cx0}
          x2={cx0}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={cx0 + 4}
          y={padT + 10}
          fontSize={8}
          fill="var(--color-accent-600)"
          textAnchor="start"
        >
          {`foundation wins beyond N≈${CROSSOVER}`}
        </text>

        {/* The two cost lines */}
        <polyline
          points={scratchLine}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={foundationLine}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-N indicator + dots on each line */}
        <line
          x1={xOf(n)}
          x2={xOf(n)}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />
        <circle cx={xOf(n)} cy={yOf(scratch)} r={4} fill="var(--color-ink-500)" />
        <circle cx={xOf(n)} cy={yOf(foundation)} r={4} fill="var(--color-brand-600)" />
      </svg>

      {/* Readout chips */}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1">
          <span className="text-ink-600">{tasksLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{n}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1">
          <span className="text-ink-600">{fromScratchLabel}</span>
          <span className="font-mono font-semibold text-ink-700">{scratch}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1">
          <span className="text-ink-600">{foundationLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{foundation}</span>
        </span>
        <span
          className={cx(
            'inline-flex items-center gap-2 rounded-pill px-3 py-1 font-medium',
            cheaper === 'foundation'
              ? 'bg-brand-500 text-white'
              : cheaper === 'scratch'
                ? 'bg-ink-100 text-ink-700'
                : 'bg-surface-50 text-ink-600 border border-ink-100',
          )}
          aria-live="polite"
        >
          {cheaper === 'tie'
            ? 'Tie at this N'
            : cheaper === 'foundation'
              ? 'Foundation model wins'
              : 'From scratch wins'}
        </span>
      </div>

      {/* Tasks slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-n`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{tasksLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {n}
          </span>
        </label>
        <input
          id={`${id}-n`}
          type="range"
          min={1}
          max={MAX_TASKS}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-valuetext={`${n} downstream tasks; from-scratch costs ${scratch} units, foundation model costs ${foundation} units, ${cheaper === 'tie' ? 'the two tie' : cheaper === 'foundation' ? 'the foundation model is cheaper' : 'from-scratch is cheaper'}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PretrainFinetuneTimeline;
