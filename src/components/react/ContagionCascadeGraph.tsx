import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ContagionCascadeGraphProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the "trigger default" button (a node id is appended). */
  triggerLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Prompt shown before a node is picked. */
  pickPromptLabel?: string;
  /** Label for the loss-given-default / shock-fraction slider. */
  shockLabel?: string;
  /** Label for the "rounds elapsed" readout chip. */
  roundsLabel?: string;
  /** Label for the "banks failed" readout chip. */
  failedLabel?: string;
  /** Legend label for a healthy node. */
  healthyLabel?: string;
  /** Legend label for a stressed node. */
  stressedLabel?: string;
  /** Legend label for a defaulted node. */
  defaultedLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type NodeState = 'healthy' | 'stressed' | 'defaulted';

interface BankNode {
  id: number;
  name: string;
  x: number;
  y: number;
  capital: number; // loss-absorbing buffer (illustrative units)
}

// A small interbank lending network. Each directed edge means the SOURCE bank
// lent to the TARGET bank, so if the target defaults the source eats a loss
// proportional to the exposure. Numbers are illustrative animation props — the
// finance math (DebtRank, loss-given-default) lives in the MDX prose, not here.
const NODES: BankNode[] = [
  { id: 0, name: 'A', x: 80, y: 70, capital: 30 },
  { id: 1, name: 'B', x: 220, y: 50, capital: 22 },
  { id: 2, name: 'C', x: 350, y: 90, capital: 18 },
  { id: 3, name: 'D', x: 130, y: 190, capital: 16 },
  { id: 4, name: 'E', x: 270, y: 175, capital: 20 },
  { id: 5, name: 'F', x: 390, y: 220, capital: 14 },
  { id: 6, name: 'G', x: 200, y: 290, capital: 12 },
];

// Directed exposures: { from -> to, exposure }. "from" lent to "to".
const EDGES: { from: number; to: number; exposure: number }[] = [
  { from: 0, to: 1, exposure: 14 },
  { from: 1, to: 2, exposure: 12 },
  { from: 1, to: 4, exposure: 16 },
  { from: 3, to: 4, exposure: 10 },
  { from: 4, to: 5, exposure: 11 },
  { from: 4, to: 6, exposure: 13 },
  { from: 2, to: 5, exposure: 9 },
  { from: 6, to: 3, exposure: 8 },
  { from: 0, to: 3, exposure: 7 },
];

/**
 * An interbank-contagion simulator. Nodes are banks; a directed edge from X to Y
 * means X lent to Y, so Y's default inflicts a loss on X equal to its exposure
 * times the loss-given-default fraction. Pick a bank to fail, set the shock
 * severity, and watch the cascade: each round, every still-solvent bank tallies
 * the losses from its defaulted borrowers; if accumulated losses exceed its
 * capital buffer it defaults too, seeding the next round. The picture makes the
 * systemic-risk point a flat table cannot: a single failure can topple banks
 * several hops away through the lending graph, and the final damage depends on
 * the network's topology, not just any one bank's balance sheet. Honors
 * prefers-reduced-motion by jumping to the settled state.
 */
export function ContagionCascadeGraph({
  title = 'Default cascade through a lending network',
  triggerLabel = 'Fail bank',
  resetLabel = 'Reset',
  pickPromptLabel = 'Pick a bank to default, then watch the cascade.',
  shockLabel = 'Loss given default',
  roundsLabel = 'Rounds elapsed',
  failedLabel = 'Banks failed',
  healthyLabel = 'Healthy',
  stressedLabel = 'Stressed',
  defaultedLabel = 'Defaulted',
  caption = 'Each arrow is a loan: source lent to target, so a target’s default hits the source’s capital. Trigger one failure and the loss propagates round by round — banks whose accumulated losses exceed their buffer fail next, seeding more rounds. The total damage is a property of the network’s topology, not of any single balance sheet, which is exactly the contagion a per-firm tabular model misses. Raise loss-given-default to see a contained shock turn into a system-wide cascade.',
  className,
}: ContagionCascadeGraphProps) {
  const [seed, setSeed] = useState<number | null>(null);
  const [lgd, setLgd] = useState(0.6);
  const [round, setRound] = useState(0);
  const timerRef = useRef<number | null>(null);

  const W = 460;
  const H = 340;

  // Simulate the full cascade for a given seed + lgd, recording the round in
  // which each node defaults. Returns an array: defaultRound[id] = round number,
  // or Infinity if the node survives.
  const defaultRound = useMemo(() => {
    const rounds: number[] = NODES.map(() => Infinity);
    if (seed === null) return rounds;
    rounds[seed] = 0;
    const losses: number[] = NODES.map(() => 0);
    let current = [seed];
    let r = 0;
    // Bound iterations by node count to guarantee termination.
    while (current.length > 0 && r < NODES.length + 1) {
      const nextDefaults: number[] = [];
      for (const failed of current) {
        // Lenders to the failed bank take a loss.
        for (const e of EDGES) {
          if (e.to === failed && rounds[e.from] === Infinity) {
            losses[e.from] += e.exposure * lgd;
            if (losses[e.from] > NODES[e.from].capital) {
              nextDefaults.push(e.from);
            }
          }
        }
      }
      const uniqueNew = Array.from(new Set(nextDefaults)).filter(
        (id) => rounds[id] === Infinity,
      );
      r += 1;
      for (const id of uniqueNew) rounds[id] = r;
      current = uniqueNew;
    }
    return rounds;
  }, [seed, lgd]);

  const maxRound = useMemo(
    () => Math.max(0, ...defaultRound.filter((d) => d !== Infinity)),
    [defaultRound],
  );

  // Step the visible round forward over time once a seed is set.
  useEffect(() => {
    if (seed === null) return;
    if (prefersReducedMotion()) {
      setRound(maxRound);
      return;
    }
    setRound(0);
    let r = 0;
    const tick = () => {
      r += 1;
      setRound(r);
      if (r < maxRound) timerRef.current = window.setTimeout(tick, 900);
    };
    if (maxRound > 0) timerRef.current = window.setTimeout(tick, 900);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [seed, maxRound]);

  const stateOf = (id: number): NodeState => {
    const dr = defaultRound[id];
    if (dr !== Infinity && dr <= round) return 'defaulted';
    // "Stressed": a lender to an already-defaulted bank that has not yet failed.
    const exposedToFailed = EDGES.some(
      (e) =>
        e.from === id &&
        defaultRound[e.to] !== Infinity &&
        defaultRound[e.to] <= round,
    );
    if (exposedToFailed && dr === Infinity) return 'stressed';
    if (exposedToFailed) return 'stressed';
    return 'healthy';
  };

  const failedCount = NODES.filter((_, id) => {
    const dr = defaultRound[id];
    return dr !== Infinity && dr <= round;
  }).length;

  const fillFor = (s: NodeState): string =>
    s === 'defaulted'
      ? 'var(--color-brand-600)'
      : s === 'stressed'
        ? 'var(--color-accent-500)'
        : 'var(--color-surface-50)';

  const reset = () => {
    setSeed(null);
    setRound(0);
  };

  const lgdText = `${Math.round(lgd * 100)}%`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Trigger buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-600">{triggerLabel}:</span>
        {NODES.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSeed(n.id)}
            aria-pressed={seed === n.id}
            className={cx(
              'rounded-pill border px-2.5 py-1 font-mono font-medium transition',
              seed === n.id
                ? 'border-brand-600 bg-brand-500 text-white shadow-soft'
                : 'border-ink-100 text-ink-700 hover:bg-surface-50',
            )}
          >
            {n.name}
          </button>
        ))}
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-100 px-2.5 py-1 font-medium text-ink-700 transition hover:bg-surface-50"
        >
          {resetLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={
          seed === null
            ? pickPromptLabel
            : `Lending network of ${NODES.length} banks. Bank ${NODES[seed].name} defaulted, triggering a cascade. After round ${round} of ${maxRound}, ${failedCount} of ${NODES.length} banks have failed.`
        }
      >
        <defs>
          <marker
            id="ccg-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-ink-400)" />
          </marker>
        </defs>

        {/* Edges */}
        {EDGES.map((e, i) => {
          const a = NODES[e.from];
          const b = NODES[e.to];
          const active =
            defaultRound[e.to] !== Infinity && defaultRound[e.to] <= round;
          // Shorten the line so the arrowhead lands at the node border.
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const r = 22;
          const x2 = b.x - (dx / len) * r;
          const y2 = b.y - (dy / len) * r;
          const x1 = a.x + (dx / len) * r;
          const y1 = a.y + (dy / len) * r;
          return (
            <line
              key={`e-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? 'var(--color-brand-500)' : 'var(--color-ink-200)'}
              strokeWidth={active ? 2.2 : 1.4}
              markerEnd="url(#ccg-arrow)"
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n) => {
          const s = stateOf(n.id);
          return (
            <g key={`n-${n.id}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={22}
                fill={fillFor(s)}
                stroke={
                  s === 'defaulted'
                    ? 'var(--color-brand-700)'
                    : s === 'stressed'
                      ? 'var(--color-accent-600)'
                      : 'var(--color-ink-300)'
                }
                strokeWidth={2}
              />
              <text
                x={n.x}
                y={n.y + 5}
                fontSize={14}
                fontWeight={700}
                fill={s === 'healthy' ? 'var(--color-ink-800)' : 'white'}
                textAnchor="middle"
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-ink-300 bg-surface-50" />
          {healthyLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-accent-500" />
          {stressedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-brand-600" />
          {defaultedLabel}
        </span>
      </div>

      {/* Readout chips */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{roundsLabel}</span>
          <span className="font-mono font-semibold text-ink-800">{round}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{failedLabel}</span>
          <span className="font-mono font-semibold text-brand-600">
            {failedCount} / {NODES.length}
          </span>
        </span>
      </div>

      {/* Shock slider */}
      <div className="mt-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{shockLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {lgdText}
          </span>
        </label>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={lgd}
          onChange={(e) => setLgd(Number(e.target.value))}
          aria-valuetext={`loss given default ${lgdText}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ContagionCascadeGraph;
