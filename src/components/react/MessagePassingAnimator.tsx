import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MessagePassingAnimatorProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the play / replay button. */
  playLabel?: string;
  /** Label for the step-forward button. */
  stepLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Label for the central (target) node. */
  centerLabel?: string;
  /** Word for a neighbour node (e.g. "neighbour"). */
  neighbourLabel?: string;
  /** Caption for stage 0 — the starting state. */
  stage0Label?: string;
  /** Caption for stage 1 — neighbours send messages. */
  stage1Label?: string;
  /** Caption for stage 2 — the target aggregates them. */
  stage2Label?: string;
  /** Caption for stage 3 — the target updates its own state. */
  stage3Label?: string;
  /** Label for the "new embedding" readout chip. */
  resultLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A tiny fixed graph: one central node (the target whose embedding we update)
// surrounded by four neighbours. Each neighbour carries a one-number "feature"
// (think: a risk score, an exposure, an embedding coordinate). One round of
// message passing aggregates the neighbours' features (here a mean) and folds
// the result into the target's own state. No formulas live here — the numbers
// are illustrative props of the animation, never finance "facts".
const CENTER = { x: 190, y: 150 };
const NEIGHBOURS = [
  { x: 190, y: 44, value: 0.8 },
  { x: 312, y: 150, value: 0.2 },
  { x: 190, y: 256, value: 0.6 },
  { x: 68, y: 150, value: 0.4 },
];
const CENTER_START = 0.3;
// Mean-aggregated neighbour message, then a simple update toward it.
const NEIGHBOUR_MEAN =
  NEIGHBOURS.reduce((a, n) => a + n.value, 0) / NEIGHBOURS.length; // 0.5
const CENTER_UPDATED = (CENTER_START + NEIGHBOUR_MEAN) / 2; // 0.4

const STAGE_COUNT = 4; // 0: idle, 1: send, 2: aggregate, 3: update

/**
 * One round of graph message passing, animated. A central target node sits among
 * its neighbours; the four phases of a message-passing layer play out in order:
 *   (0) the graph at rest — every node holds its own feature;
 *   (1) each neighbour SENDS a message along its edge toward the target;
 *   (2) the target AGGREGATES the incoming messages (a permutation-invariant pool
 *       — here a mean) into one summary;
 *   (3) the target UPDATES its own embedding by combining its old state with that
 *       summary.
 * Stacking K such layers lets information reach K hops away. The point the picture
 * makes: a node's new representation is a function of its NEIGHBOURHOOD, which is
 * exactly the relational structure a flat feature table throws away. Honors
 * prefers-reduced-motion (jumps straight to the final state).
 */
export function MessagePassingAnimator({
  title = 'One round of message passing',
  playLabel = 'Play round',
  stepLabel = 'Step',
  resetLabel = 'Reset',
  centerLabel = 'Target node',
  neighbourLabel = 'neighbour',
  stage0Label = 'Rest: every node holds its own feature.',
  stage1Label = '1 · Send: each neighbour pushes a message along its edge.',
  stage2Label = '2 · Aggregate: the target pools the incoming messages (mean).',
  stage3Label = '3 · Update: the target folds the summary into its own embedding.',
  resultLabel = 'Target embedding',
  caption = 'A message-passing layer in four beats: neighbours send, the target aggregates with a permutation-invariant pool (here a mean), and the target updates its own embedding from old-state-plus-summary. Stack K layers and information travels K hops. The headline idea: a node’s new representation depends on its neighbourhood — precisely the relational structure a flat table discards.',
  className,
}: MessagePassingAnimatorProps) {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0); // 0 -> 1 within the active stage
  const rafRef = useRef<number | null>(null);

  const W = 380;
  const H = 300;

  const reduced = prefersReducedMotion();

  // Animate the in-stage progress whenever the stage advances (unless reduced).
  useEffect(() => {
    if (reduced || stage === 0) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [stage, reduced]);

  const advance = () => setStage((s) => Math.min(STAGE_COUNT - 1, s + 1));
  const reset = () => {
    setStage(0);
    setProgress(reduced ? 1 : 0);
  };
  const play = () => {
    // Reset, then auto-advance through the stages.
    reset();
    if (reduced) {
      setStage(STAGE_COUNT - 1);
      return;
    }
    let s = 0;
    const advanceWithDelay = () => {
      s += 1;
      setStage(s);
      if (s < STAGE_COUNT - 1) setTimeout(advanceWithDelay, 900);
    };
    setTimeout(advanceWithDelay, 350);
  };

  // Center value shown depends on stage.
  const centerShown = stage >= 3 ? CENTER_UPDATED : CENTER_START;

  const stageCaptions = [stage0Label, stage1Label, stage2Label, stage3Label];

  // Message-dot position along each edge during the "send" stage (stage 1).
  const sendT = stage === 1 ? progress : stage > 1 ? 1 : 0;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={play}
          className="rounded-pill bg-brand-500 px-3 py-1 font-medium text-white shadow-soft transition hover:bg-brand-600"
        >
          {playLabel}
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={stage >= STAGE_COUNT - 1}
          className={cx(
            'rounded-pill border border-ink-100 px-3 py-1 font-medium transition',
            stage >= STAGE_COUNT - 1 ? 'text-ink-300' : 'text-ink-700 hover:bg-surface-50',
          )}
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-100 px-3 py-1 font-medium text-ink-700 transition hover:bg-surface-50"
        >
          {resetLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full max-w-sm"
        role="img"
        aria-label={`A target node surrounded by four neighbour nodes. Stage ${stage} of ${STAGE_COUNT - 1}: ${stageCaptions[stage]} After the round, the target embedding moves from ${CENTER_START} to ${CENTER_UPDATED}.`}
      >
        {/* Edges */}
        {NEIGHBOURS.map((n, i) => (
          <line
            key={`edge-${i}`}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={n.x}
            y2={n.y}
            stroke={stage >= 1 ? 'var(--color-ink-400)' : 'var(--color-ink-200)'}
            strokeWidth={1.6}
          />
        ))}

        {/* Travelling message dots (stage 1+) */}
        {stage >= 1 &&
          NEIGHBOURS.map((n, i) => {
            const mx = n.x + (CENTER.x - n.x) * sendT;
            const my = n.y + (CENTER.y - n.y) * sendT;
            return (
              <circle
                key={`msg-${i}`}
                cx={mx}
                cy={my}
                r={6}
                fill="var(--color-accent-500)"
                fillOpacity={stage === 1 ? 0.9 : 0.0}
              />
            );
          })}

        {/* Aggregation halo on the target (stage 2+) */}
        {stage >= 2 && (
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={38 + (stage === 2 ? progress * 6 : 6)}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        )}

        {/* Neighbour nodes */}
        {NEIGHBOURS.map((n, i) => (
          <g key={`node-${i}`}>
            <circle
              cx={n.x}
              cy={n.y}
              r={22}
              fill="var(--color-brand-500)"
              fillOpacity={0.12 + 0.7 * n.value}
              stroke="var(--color-brand-500)"
              strokeOpacity={0.6}
            />
            <text
              x={n.x}
              y={n.y + 4}
              fontSize={12}
              fontWeight={600}
              fill={n.value > 0.5 ? 'white' : 'var(--color-ink-700)'}
              textAnchor="middle"
            >
              {n.value.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Target node */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={28}
          fill="var(--color-accent-500)"
          fillOpacity={0.18 + 0.7 * centerShown}
          stroke="var(--color-accent-600)"
          strokeWidth={2}
        />
        <text
          x={CENTER.x}
          y={CENTER.y + 5}
          fontSize={14}
          fontWeight={700}
          fill={centerShown > 0.45 ? 'white' : 'var(--color-ink-900)'}
          textAnchor="middle"
        >
          {centerShown.toFixed(1)}
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + 46}
          fontSize={9}
          fill="var(--color-ink-500)"
          textAnchor="middle"
        >
          {centerLabel}
        </text>
        <text
          x={NEIGHBOURS[0].x}
          y={NEIGHBOURS[0].y - 28}
          fontSize={9}
          fill="var(--color-ink-500)"
          textAnchor="middle"
        >
          {neighbourLabel}
        </text>
      </svg>

      {/* Stage caption */}
      <p aria-live="polite" className="mt-2 min-h-[1.5rem] text-sm font-medium text-ink-700">
        {stageCaptions[stage]}
      </p>

      {/* Readout chip */}
      <div className="mt-2 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{resultLabel}</span>
          <span className="font-mono font-semibold text-accent-600">
            {centerShown.toFixed(1)}
          </span>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MessagePassingAnimator;
