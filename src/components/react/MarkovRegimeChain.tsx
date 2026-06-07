import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarkovRegimeChainProps {
  /** Heading above the diagram. */
  title?: string;
  /** The three regime labels, in order [state0, state1, state2]. */
  stateLabels?: [string, string, string];
  /** Label for the current-state readout. */
  currentLabel?: string;
  /** Label above the visit-frequency bars. */
  visitsLabel?: string;
  /** Label for the stationary-distribution target marker. */
  stationaryLabel?: string;
  /** Label for the single-step button. */
  stepLabel?: string;
  /** Label for the auto-run toggle. */
  autoLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fixed transition matrix. Rows = current state, columns = next state.
// State order: 0 = Bull, 1 = Bear, 2 = Flat.
// Bull → 0.80 stay (Bull), 0.05 Bear, 0.15 Flat
// Bear → 0.10 Bull, 0.70 stay (Bear), 0.20 Flat
// Flat → 0.25 Bull, 0.25 Bear, 0.50 stay (Flat)
const P: number[][] = [
  [0.8, 0.05, 0.15],
  [0.1, 0.7, 0.2],
  [0.25, 0.25, 0.5],
];

// Pick the next state index from the current row's probabilities.
const nextState = (current: number): number => {
  const row = P[current];
  const r = Math.random();
  let acc = 0;
  for (let j = 0; j < row.length; j++) {
    acc += row[j];
    if (r < acc) return j;
  }
  return row.length - 1;
};

// Stationary distribution: iterate the row-vector v ← vP to convergence.
const stationaryDistribution = (): number[] => {
  let v = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 1000; iter++) {
    const next = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        next[j] += v[i] * P[i][j];
      }
    }
    let diff = 0;
    for (let j = 0; j < 3; j++) diff += Math.abs(next[j] - v[j]);
    v = next;
    if (diff < 1e-12) break;
  }
  return v;
};

// Distinct shades built only from the brand/accent/ink tokens.
const STATE_FILL = [
  'var(--color-accent-500)', // Bull
  'var(--color-ink-600)', // Bear
  'var(--color-brand-500)', // Flat
];

const STATE_FILL_FAINT = [
  'color-mix(in srgb, var(--color-accent-500) 18%, var(--color-surface))',
  'color-mix(in srgb, var(--color-ink-600) 18%, var(--color-surface))',
  'color-mix(in srgb, var(--color-brand-500) 18%, var(--color-surface))',
];

/**
 * A 3-state regime-switching Markov chain (Bull / Bear / Flat). A token hops
 * between states once per step, choosing the next state purely from the current
 * state's transition-probability row — the Markov (memoryless) property. A
 * running tally of visits is drawn as three bars that, over many steps,
 * converge toward the chain's stationary distribution (computed by iterating
 * the transition matrix and shown as a faint target on each bar). Respects
 * `prefers-reduced-motion` by skipping the animated token glide and auto-run.
 */
export function MarkovRegimeChain({
  title = 'A 3-state Markov regime chain converging to its stationary distribution',
  stateLabels = ['Bull', 'Bear', 'Flat'],
  currentLabel = 'Current state',
  visitsLabel = 'Visit frequency',
  stationaryLabel = 'Stationary (long-run)',
  stepLabel = 'Step',
  autoLabel = 'Auto',
  resetLabel = 'Reset',
  caption = 'The token only ever looks at where it is now — never where it has been — to decide its next hop. That is the Markov property. Yet keep stepping and the share of time spent in each regime settles toward a fixed long-run mix: the stationary distribution.',
  className,
}: MarkovRegimeChainProps) {
  const id = useId();
  const [current, setCurrent] = useState(0);
  const [visits, setVisits] = useState<[number, number, number]>([1, 0, 0]);
  const [total, setTotal] = useState(1);
  const [glide, setGlide] = useState(1); // 0 → 1 token move animation
  const [glideFrom, setGlideFrom] = useState(0);
  const [auto, setAuto] = useState(false);
  const rafRef = useRef<number | null>(null);
  const autoRef = useRef<number | null>(null);

  const stationary = useRef<number[]>(stationaryDistribution());

  const W = 360;
  const H = 280;
  const r = 34; // node radius
  // Triangle layout of the three node centers.
  const centers: [number, number][] = [
    [W / 2, 56], // top — state 0
    [78, 214], // bottom-left — state 1
    [W - 78, 214], // bottom-right — state 2
  ];

  // Advance one transition.
  const doStep = () => {
    setCurrent((cur) => {
      const nxt = nextState(cur);
      setGlideFrom(cur);
      setVisits((v) => {
        const copy: [number, number, number] = [v[0], v[1], v[2]];
        copy[nxt] += 1;
        return copy;
      });
      setTotal((t) => t + 1);
      if (prefersReducedMotion()) {
        setGlide(1);
      } else {
        setGlide(0);
      }
      return nxt;
    });
  };

  const doReset = () => {
    setAuto(false);
    setCurrent(0);
    setVisits([1, 0, 0]);
    setTotal(1);
    setGlide(1);
    setGlideFrom(0);
  };

  // Token glide animation between the previous and current node.
  useEffect(() => {
    if (glide >= 1) return;
    if (prefersReducedMotion()) {
      setGlide(1);
      return;
    }
    const duration = 360;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setGlide(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [glide, current]);

  // Auto-run: step on a timer while toggled on.
  useEffect(() => {
    if (!auto) return;
    const period = prefersReducedMotion() ? 700 : 520;
    autoRef.current = window.setInterval(() => {
      doStep();
    }, period);
    return () => {
      if (autoRef.current !== null) {
        window.clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  // Token position: interpolate from previous node toward current node.
  const [fx, fy] = centers[glideFrom];
  const [cxr, cyr] = centers[current];
  const tokenX = fx + (cxr - fx) * glide;
  const tokenY = fy + (cyr - fy) * glide;

  const freqs: number[] = [visits[0] / total, visits[1] / total, visits[2] / total];

  // Curved transition arrow between two node centers, trimmed to the rims.
  const edgePath = (a: number, b: number, bend: number): string => {
    const [ax, ay] = centers[a];
    const [bx, by] = centers[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular offset for the control point (curvature).
    const nx = -uy;
    const ny = ux;
    const sx = ax + ux * r;
    const sy = ay + uy * r;
    const ex = bx - ux * r;
    const ey = by - uy * r;
    const mx = (sx + ex) / 2 + nx * bend;
    const my = (sy + ey) / 2 + ny * bend;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  };

  // Self-loop arc above/beside a node ("stay" transition).
  const selfLoop = (i: number): string => {
    const [x, y] = centers[i];
    // Loop direction: outward from the triangle centroid.
    const cxc = W / 2;
    const cyc = 160;
    const dx = x - cxc;
    const dy = y - cyc;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const sx = x + ux * r * 0.6 + px * r * 0.5;
    const sy = y + uy * r * 0.6 + py * r * 0.5;
    const ex = x + ux * r * 0.6 - px * r * 0.5;
    const ey = y + uy * r * 0.6 - py * r * 0.5;
    const c1x = x + ux * (r + 34) + px * r;
    const c1y = y + uy * (r + 34) + py * r;
    const c2x = x + ux * (r + 34) - px * r;
    const c2y = y + uy * (r + 34) - py * r;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  };

  // Edges between distinct states (off-diagonal) plus probability labels.
  const edges: { from: number; to: number; bend: number }[] = [
    { from: 0, to: 1, bend: -18 },
    { from: 1, to: 0, bend: -18 },
    { from: 1, to: 2, bend: -18 },
    { from: 2, to: 1, bend: -18 },
    { from: 2, to: 0, bend: -18 },
    { from: 0, to: 2, bend: -18 },
  ];

  // Midpoint label position for a transition probability.
  const edgeLabelPos = (a: number, b: number, bend: number): [number, number] => {
    const [ax, ay] = centers[a];
    const [bx, by] = centers[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return [(ax + bx) / 2 + nx * (bend * 1.5), (ay + by) / 2 + ny * (bend * 1.5)];
  };

  const ariaState = stateLabels[current];

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
        {stateLabels.map((label, i) => (
          <span key={`leg-${i}`} className="inline-flex items-center gap-2 text-ink-700">
            <span
              className="h-3 w-3 rounded-pill"
              style={{ background: STATE_FILL[i] }}
              aria-hidden="true"
            />
            {label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A three-state Markov chain with states ${stateLabels[0]}, ${stateLabels[1]} and ${stateLabels[2]}, drawn as nodes in a triangle with curved transition arrows. A token currently sits on ${ariaState} and hops between states by transition probabilities.`}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-400)" />
          </marker>
        </defs>

        {/* Transition arrows between distinct states */}
        {edges.map((e, i) => (
          <path
            key={`edge-${i}`}
            d={edgePath(e.from, e.to, e.bend)}
            fill="none"
            stroke="var(--color-ink-200)"
            strokeWidth={1.5}
            markerEnd={`url(#${id}-arrow)`}
          />
        ))}

        {/* Transition probability labels (off-diagonal) */}
        {edges.map((e, i) => {
          const [lx, ly] = edgeLabelPos(e.from, e.to, e.bend);
          return (
            <text
              key={`elbl-${i}`}
              x={lx}
              y={ly}
              fontSize={9}
              fill="var(--color-ink-600)"
              textAnchor="middle"
            >
              {P[e.from][e.to].toFixed(2)}
            </text>
          );
        })}

        {/* Self-loop arrows ("stay") and their probabilities */}
        {[0, 1, 2].map((i) => {
          const [x, y] = centers[i];
          const cxc = W / 2;
          const cyc = 160;
          const dx = x - cxc;
          const dy = y - cyc;
          const len = Math.hypot(dx, dy) || 1;
          const lx = x + (dx / len) * (r + 50);
          const ly = y + (dy / len) * (r + 50);
          return (
            <g key={`self-${i}`}>
              <path
                d={selfLoop(i)}
                fill="none"
                stroke="var(--color-ink-200)"
                strokeWidth={1.5}
                markerEnd={`url(#${id}-arrow)`}
              />
              <text
                x={lx}
                y={ly}
                fontSize={9}
                fill="var(--color-ink-600)"
                textAnchor="middle"
              >
                {P[i][i].toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* State nodes */}
        {centers.map(([x, y], i) => {
          const isCurrent = i === current;
          return (
            <g key={`node-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={isCurrent ? STATE_FILL[i] : STATE_FILL_FAINT[i]}
                stroke={STATE_FILL[i]}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              <text
                x={x}
                y={y + 4}
                fontSize={13}
                fontWeight={600}
                fill={isCurrent ? 'var(--color-surface)' : 'var(--color-ink-900)'}
                textAnchor="middle"
              >
                {stateLabels[i]}
              </text>
            </g>
          );
        })}

        {/* The hopping token */}
        <circle
          cx={tokenX}
          cy={tokenY}
          r={9}
          fill="var(--color-surface)"
          stroke="var(--color-ink-900)"
          strokeWidth={2.5}
        />
        <circle cx={tokenX} cy={tokenY} r={3.5} fill="var(--color-ink-900)" />
      </svg>

      {/* Current-state readout */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{currentLabel}</span>
          <span className="font-mono font-semibold text-brand-600" aria-live="polite">
            {ariaState}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{stepLabel}</span>
          <span className="font-mono font-semibold text-ink-800">{total - 1}</span>
        </span>
      </div>

      {/* Visit-frequency bars with stationary target markers */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm font-medium text-ink-700">
          <span>{visitsLabel}</span>
          <span className="inline-flex items-center gap-2 text-xs text-ink-600">
            <span
              className="h-3 w-0.5 border-l-2 border-dashed border-ink-400"
              aria-hidden="true"
            />
            {stationaryLabel}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {stateLabels.map((label, i) => {
            const pct = freqs[i] * 100;
            const targetPct = stationary.current[i] * 100;
            return (
              <div key={`bar-${i}`} className="flex items-center gap-3 text-sm">
                <span className="w-12 shrink-0 text-ink-700">{label}</span>
                <div
                  className="relative h-4 flex-1 overflow-hidden rounded-pill border border-ink-100 bg-surface-50"
                  role="img"
                  aria-label={`${label}: visited ${pct.toFixed(0)} percent of steps; stationary ${targetPct.toFixed(0)} percent`}
                >
                  <div
                    className="h-full rounded-pill transition-[width] duration-300"
                    style={{ width: `${pct.toFixed(1)}%`, background: STATE_FILL[i] }}
                  />
                  {/* Stationary-distribution target marker */}
                  <span
                    className="absolute top-0 h-full border-l-2 border-dashed border-ink-400"
                    style={{ left: `${targetPct.toFixed(1)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-ink-700">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={doStep}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className={cx(
            'rounded-pill border border-ink-100 px-4 py-1.5 text-sm font-medium shadow-soft transition',
            auto
              ? 'bg-brand-500 text-surface hover:bg-brand-600'
              : 'bg-surface-50 text-ink-800 hover:bg-surface-100',
          )}
        >
          {autoLabel}
        </button>
        <button
          type="button"
          onClick={doReset}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MarkovRegimeChain;
