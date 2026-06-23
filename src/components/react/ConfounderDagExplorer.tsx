import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type NodeRole = 'confounder' | 'collider';

export interface ConfounderDagExplorerProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the treatment / signal node (the X you trade on). */
  treatmentLabel?: string;
  /** Label for the outcome node (the return Y). */
  outcomeLabel?: string;
  /** Label for the third node when it acts as a confounder. */
  confounderLabel?: string;
  /** Label for the third node when it acts as a collider. */
  colliderLabel?: string;
  /** Label for the "confounder" structure toggle button. */
  confounderModeLabel?: string;
  /** Label for the "collider" structure toggle button. */
  colliderModeLabel?: string;
  /** Label for the "control for the third variable" checkbox. */
  controlLabel?: string;
  /** Readout chip label describing the open back-door / spurious path. */
  spuriousLabel?: string;
  /** Readout chip label describing the genuine causal path. */
  causalLabel?: string;
  /** Text shown when a path is open. */
  openLabel?: string;
  /** Text shown when a path is blocked. */
  blockedLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

/**
 * An interactive causal DAG with three nodes: a treatment / signal X (left), an
 * outcome / return Y (right), and a third variable Z (top). The third node can be
 * wired two ways, which look superficially similar but behave as opposites:
 *
 *   CONFOUNDER:  Z → X  and  Z → Y      (a common cause: a back-door path X ← Z → Y)
 *   COLLIDER:    X → Z  and  Y → Z      (a common effect: the path X → Z ← Y)
 *
 * The lesson is the conditioning rule, dramatised by the "control for Z" checkbox:
 *   • A confounder opens a spurious back-door path by default; CONTROLLING for it
 *     CLOSES that path, leaving only the genuine X → Y effect — controlling helps.
 *   • A collider is closed by default (no association flows through it); CONTROLLING
 *     for it OPENS a spurious path that was not there before — controlling HURTS.
 *
 * No numbers or formulas live in the component; all user-facing text is a string
 * prop (English defaults), and animation is limited to CSS transitions that respect
 * prefers-reduced-motion via the global stylesheet.
 */
export function ConfounderDagExplorer({
  title = 'Confounder vs collider: when controlling helps and when it backfires',
  treatmentLabel = 'Signal X',
  outcomeLabel = 'Return Y',
  confounderLabel = 'Z (common cause)',
  colliderLabel = 'Z (common effect)',
  confounderModeLabel = 'Confounder (X ← Z → Y)',
  colliderModeLabel = 'Collider (X → Z ← Y)',
  controlLabel = 'Control for Z',
  spuriousLabel = 'Spurious path',
  causalLabel = 'Causal path X → Y',
  openLabel = 'open',
  blockedLabel = 'blocked',
  caption = 'Two structures, opposite rules. A confounder Z (common cause) opens a back-door path X ← Z → Y by default — controlling for it CLOSES the spurious path and isolates the real effect. A collider Z (common effect) is blocked by default — controlling for it OPENS a brand-new spurious path. "Control for everything" is a trap: it cleans up confounders and contaminates colliders.',
  className,
}: ConfounderDagExplorerProps) {
  const id = useId();
  const [role, setRole] = useState<NodeRole>('confounder');
  const [controlled, setControlled] = useState(false);

  const isConfounder = role === 'confounder';

  // Whether the spurious (non-causal) path between X and Y is open.
  //   Confounder back-door: open unless we condition on Z.
  //   Collider path: closed unless we condition on Z (conditioning opens it).
  const spuriousOpen = isConfounder ? !controlled : controlled;
  // The genuine X → Y edge is always present and unaffected by conditioning here.
  const causalOpen = true;

  const W = 360;
  const H = 240;
  const xNode = { x: 70, y: 175 };
  const yNode = { x: 290, y: 175 };
  const zNode = { x: 180, y: 55 };

  const nodeRadius = 30;

  // Colours pulled from design tokens.
  const causalColor = 'var(--color-accent-500)';
  const spuriousColor = 'var(--color-brand-500)';
  const mutedColor = 'var(--color-ink-200)';

  const zLabel = isConfounder ? confounderLabel : colliderLabel;

  // Arrow direction depends on the structure.
  //   Confounder: Z → X and Z → Y (arrows point down/out from Z).
  //   Collider:   X → Z and Y → Z (arrows point up/in toward Z).
  const edgeZX = isConfounder
    ? { from: zNode, to: xNode }
    : { from: xNode, to: zNode };
  const edgeZY = isConfounder
    ? { from: zNode, to: yNode }
    : { from: yNode, to: zNode };

  // Shrink an edge so the arrowhead lands on the node rim, not its centre.
  const trim = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: from.x + ux * nodeRadius,
      y1: from.y + uy * nodeRadius,
      x2: to.x - ux * nodeRadius,
      y2: to.y - uy * nodeRadius,
    };
  };

  const zxEdge = trim(edgeZX.from, edgeZX.to);
  const zyEdge = trim(edgeZY.from, edgeZY.to);
  const causalEdge = trim(xNode, yNode);

  const Node = ({
    cx: ncx,
    cy,
    label,
    fill,
    boxed,
  }: {
    cx: number;
    cy: number;
    label: string;
    fill: string;
    boxed?: boolean;
  }) => (
    <g>
      {boxed && (
        <rect
          x={ncx - nodeRadius - 6}
          y={cy - nodeRadius - 6}
          width={(nodeRadius + 6) * 2}
          height={(nodeRadius + 6) * 2}
          rx={10}
          fill="none"
          stroke="var(--color-ink-900)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}
      <circle cx={ncx} cy={cy} r={nodeRadius} fill={fill} fillOpacity={0.16} stroke={fill} strokeWidth={2} />
      <text
        x={ncx}
        y={cy + 4}
        fontSize={11}
        fontWeight={600}
        fill="var(--color-ink-800)"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Structure toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="causal structure"
      >
        <button
          type="button"
          onClick={() => setRole('confounder')}
          aria-pressed={isConfounder}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            isConfounder ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {confounderModeLabel}
        </button>
        <button
          type="button"
          onClick={() => setRole('collider')}
          aria-pressed={!isConfounder}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            !isConfounder ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {colliderModeLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Causal DAG. Signal X on the lower left, Return Y on the lower right, third variable Z on top, wired as a ${isConfounder ? 'confounder, a common cause of X and Y' : 'collider, a common effect of X and Y'}. With Z ${controlled ? 'controlled for' : 'not controlled for'}, the spurious path is ${spuriousOpen ? 'open' : 'blocked'} and the causal path X to Y is open.`}
      >
        <defs>
          <marker
            id={`${id}-arrow-causal`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={causalColor} />
          </marker>
          <marker
            id={`${id}-arrow-spurious`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={spuriousOpen ? spuriousColor : mutedColor} />
          </marker>
        </defs>

        {/* Z↔X edge (part of the spurious path) */}
        <line
          x1={zxEdge.x1}
          y1={zxEdge.y1}
          x2={zxEdge.x2}
          y2={zxEdge.y2}
          stroke={spuriousOpen ? spuriousColor : mutedColor}
          strokeWidth={spuriousOpen ? 2.4 : 1.6}
          strokeDasharray={spuriousOpen ? undefined : '5 4'}
          markerEnd={`url(#${id}-arrow-spurious)`}
        />
        {/* Z↔Y edge (part of the spurious path) */}
        <line
          x1={zyEdge.x1}
          y1={zyEdge.y1}
          x2={zyEdge.x2}
          y2={zyEdge.y2}
          stroke={spuriousOpen ? spuriousColor : mutedColor}
          strokeWidth={spuriousOpen ? 2.4 : 1.6}
          strokeDasharray={spuriousOpen ? undefined : '5 4'}
          markerEnd={`url(#${id}-arrow-spurious)`}
        />
        {/* Genuine X → Y causal edge */}
        <line
          x1={causalEdge.x1}
          y1={causalEdge.y1}
          x2={causalEdge.x2}
          y2={causalEdge.y2}
          stroke={causalColor}
          strokeWidth={2.6}
          markerEnd={`url(#${id}-arrow-causal)`}
        />

        <Node cx={xNode.x} cy={xNode.y} label="X" fill={causalColor} />
        <Node cx={yNode.x} cy={yNode.y} label="Y" fill={causalColor} />
        <Node cx={zNode.x} cy={zNode.y} label="Z" fill={spuriousColor} boxed={controlled} />

        {/* Node captions */}
        <text x={xNode.x} y={xNode.y + nodeRadius + 16} fontSize={10} fill="var(--color-ink-500)" textAnchor="middle">
          {treatmentLabel}
        </text>
        <text x={yNode.x} y={yNode.y + nodeRadius + 16} fontSize={10} fill="var(--color-ink-500)" textAnchor="middle">
          {outcomeLabel}
        </text>
        <text x={zNode.x} y={zNode.y - nodeRadius - 12} fontSize={10} fill="var(--color-ink-500)" textAnchor="middle">
          {zLabel}
        </text>
      </svg>

      {/* Control toggle */}
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
        <input
          type="checkbox"
          checked={controlled}
          onChange={(e) => setControlled(e.target.checked)}
          className="size-4 accent-brand-500"
        />
        {controlLabel}
      </label>

      {/* Readout chips */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{spuriousLabel}</span>
          <span
            className={cx(
              'font-mono font-semibold',
              spuriousOpen ? 'text-brand-600' : 'text-ink-400',
            )}
          >
            {spuriousOpen ? openLabel : blockedLabel}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{causalLabel}</span>
          <span className={cx('font-mono font-semibold', causalOpen ? 'text-accent-600' : 'text-ink-400')}>
            {causalOpen ? openLabel : blockedLabel}
          </span>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ConfounderDagExplorer;
