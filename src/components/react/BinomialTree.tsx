import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BinomialTreeProps {
  /** Heading above the tree. */
  title?: string;
  /** Starting spot price S0. Defaults to `100`. */
  spot?: number;
  /** Up-factor u (per step). Defaults to `1.2`. */
  up?: number;
  /** Down-factor d (per step). Defaults to `0.85`. */
  down?: number;
  /** Risk-free rate r (annual, as a decimal). Defaults to `0.05`. */
  rate?: number;
  /** Strike price K. Defaults to `100`. */
  strike?: number;
  /** Number of steps in the tree (1 or 2). Defaults to `2`. */
  steps?: 1 | 2;
  /** Option kind. Defaults to `'call'`. */
  type?: 'call' | 'put';
  /** Slider label for the spot price. */
  spotLabel?: string;
  /** Slider label for the up-factor. */
  upLabel?: string;
  /** Slider label for the down-factor. */
  downLabel?: string;
  /** Slider label for the risk-free rate. */
  rateLabel?: string;
  /** Slider label for the strike. */
  strikeLabel?: string;
  /** Toggle label for a call option. */
  callLabel?: string;
  /** Toggle label for a put option. */
  putLabel?: string;
  /** Readout label for the risk-neutral up-probability q. */
  riskNeutralProbLabel?: string;
  /** Readout label for the option value today. */
  optionValueLabel?: string;
  /** One-line takeaway shown under the tree. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

interface TreeNode {
  /** Column (time step) 0…steps. */
  col: number;
  /** Number of up-moves to reach this node, 0…col. */
  ups: number;
  /** Asset price at this node. */
  price: number;
  /** Option value at this node (payoff at terminal nodes, discounted value inside). */
  value: number;
  /** Whether this node is a terminal (payoff) node. */
  terminal: boolean;
  /** Pixel position. */
  x: number;
  y: number;
}

/**
 * Interactive one- or two-step **risk-neutral binomial option-pricing** tree.
 *
 * From a spot price S0 the asset multiplies by `u` (up) or `d` (down) each
 * period. Under the risk-neutral measure the up-probability is
 * q = (e^{rT} − d) / (u − d), where T is one period here. Terminal nodes pay the
 * option's intrinsic value — max(S − K, 0) for a call, max(K − S, 0) for a put —
 * and every internal node is the **discounted, q-weighted** average of its two
 * children: e^{−rT}·[q·V_up + (1 − q)·V_down]. Rolling that back to the root
 * gives the option's fair value today.
 *
 * Move the sliders (spot, u, d, rate, strike) or flip call/put and the values
 * roll back from the terminal column to the root, fading/growing as they update.
 * `d` is clamped below `u` (and below 1) and divide-by-zero near u ≈ d is
 * guarded. Respects `prefers-reduced-motion` (values snap instead of animating).
 */
export function BinomialTree({
  title = 'Pricing an option by rolling back a tree',
  spot = 100,
  up = 1.2,
  down = 0.85,
  rate = 0.05,
  strike = 100,
  steps = 2,
  type = 'call',
  spotLabel = 'Spot price (S₀)',
  upLabel = 'Up-factor (u)',
  downLabel = 'Down-factor (d)',
  rateLabel = 'Risk-free rate (r)',
  strikeLabel = 'Strike (K)',
  callLabel = 'Call',
  putLabel = 'Put',
  riskNeutralProbLabel = 'Risk-neutral prob. (q)',
  optionValueLabel = 'Option value today',
  caption = 'Each terminal node pays the option’s intrinsic value, and every node before it is the discounted, q-weighted average of its two children. Roll that back to the root and you have the fair price — no real-world probability or drift required.',
  className,
}: BinomialTreeProps) {
  const id = useId();
  const nSteps = steps === 1 ? 1 : 2;

  const [spotState, setSpotState] = useState(spot);
  const [upState, setUpState] = useState(up);
  const [downState, setDownState] = useState(down);
  const [rateState, setRateState] = useState(rate);
  const [strikeState, setStrikeState] = useState(strike);
  const [typeState, setTypeState] = useState<'call' | 'put'>(type);

  // Animation progress 0 → 1 for the roll-back; columns reveal in sequence.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  // Sanitize factors: keep d < 1 < u and avoid u ≈ d.
  const u = Math.max(1.01, upState);
  const d = Math.min(0.99, Math.max(0.4, downState));
  const dSafe = Math.min(d, u - 0.02); // guarantee a gap so (u − d) > 0
  const r = Math.max(0, rateState);

  // One period per step (T = 1). Risk-neutral up-probability.
  const growth = Math.exp(r); // e^{rT}, T = 1
  const discount = Math.exp(-r); // e^{−rT}
  const denom = u - dSafe;
  const qRaw = denom > 1e-9 ? (growth - dSafe) / denom : 0.5;
  const q = Math.min(1, Math.max(0, qRaw)); // clamp into [0,1] for display sanity

  const payoff = (price: number): number =>
    typeState === 'call'
      ? Math.max(price - strikeState, 0)
      : Math.max(strikeState - price, 0);

  // Build the lattice. Node (col, ups): price = S0 · u^ups · d^(col − ups).
  const W = 560;
  const H = 300;
  const padX = 64;
  const padY = 28;

  const colX = (col: number) => padX + (col / nSteps) * (W - padX * 2);
  // Within a column, ups = 0 is lowest (down moves), ups = col is highest.
  const nodeY = (col: number, ups: number) => {
    if (col === 0) return H / 2;
    const frac = ups / col; // 0 (bottom) … 1 (top)
    return padY + (1 - frac) * (H - padY * 2);
  };

  const nodes: TreeNode[][] = [];
  for (let col = 0; col <= nSteps; col++) {
    const column: TreeNode[] = [];
    for (let ups = 0; ups <= col; ups++) {
      const price = spotState * Math.pow(u, ups) * Math.pow(dSafe, col - ups);
      column.push({
        col,
        ups,
        price,
        value: 0,
        terminal: col === nSteps,
        x: colX(col),
        y: nodeY(col, ups),
      });
    }
    nodes.push(column);
  }

  // Terminal payoffs, then roll back: V = e^{−rT}·[q·V_up + (1−q)·V_down].
  for (let ups = 0; ups <= nSteps; ups++) {
    nodes[nSteps][ups].value = payoff(nodes[nSteps][ups].price);
  }
  for (let col = nSteps - 1; col >= 0; col--) {
    for (let ups = 0; ups <= col; ups++) {
      const vUp = nodes[col + 1][ups + 1].value;
      const vDown = nodes[col + 1][ups].value;
      nodes[col][ups].value = discount * (q * vUp + (1 - q) * vDown);
    }
  }

  const rootValue = nodes[0][0].value;

  // Re-run the roll-back animation whenever inputs change. Columns fade in from
  // the terminal side (right) to the root (left).
  const animKey = `${spotState}|${u}|${dSafe}|${r}|${strikeState}|${typeState}|${nSteps}`;
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 650;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  // Per-column reveal: terminal column (rightmost) first, root last.
  const columnReveal = (col: number): number => {
    // Map col → reveal order: terminal (nSteps) reveals at p≈0, root at p≈1.
    const order = (nSteps - col) / nSteps; // terminal=0 … root=1
    const window = 1 / (nSteps + 1);
    const start = order * (1 - window);
    const local = (progress - start) / window;
    return Math.min(1, Math.max(0, local));
  };

  // Build edges between consecutive columns.
  const edges: { x1: number; y1: number; x2: number; y2: number; upMove: boolean }[] = [];
  for (let col = 0; col < nSteps; col++) {
    for (let ups = 0; ups <= col; ups++) {
      const parent = nodes[col][ups];
      const childUp = nodes[col + 1][ups + 1];
      const childDown = nodes[col + 1][ups];
      edges.push({ x1: parent.x, y1: parent.y, x2: childUp.x, y2: childUp.y, upMove: true });
      edges.push({ x1: parent.x, y1: parent.y, x2: childDown.x, y2: childDown.y, upMove: false });
    }
  }

  const ariaLabel =
    `${title}. A ${nSteps}-step risk-neutral binomial tree for a ${
      typeState === 'call' ? callLabel : putLabel
    } with spot ${num(spotState)}, strike ${num(strikeState)}, up-factor ${num(u)}, ` +
    `down-factor ${num(dSafe)} and rate ${num(r * 100)} percent. The risk-neutral ` +
    `up-probability is ${num(q, 3)} and the option is worth ${num(rootValue)} today.`;

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
          {nSteps}-step
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Edges */}
        {edges.map((e, i) => (
          <line
            key={`edge-${i}`}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.upMove ? 'var(--color-brand-300)' : 'var(--color-ink-200)'}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}

        {/* Nodes */}
        {nodes.flat().map((n) => {
          const reveal = columnReveal(n.col);
          const r0 = 22;
          const radius = r0 * (0.7 + 0.3 * reveal);
          const isUp = n.ups === n.col && n.col > 0; // top edge of column
          const fill = n.terminal
            ? 'var(--color-surface)'
            : 'var(--color-surface-sunken)';
          const stroke = n.terminal
            ? n.value > 1e-6
              ? 'var(--color-brand-500)'
              : 'var(--color-ink-300)'
            : 'var(--color-accent-500)';
          return (
            <g key={`node-${n.col}-${n.ups}`} opacity={0.25 + 0.75 * reveal}>
              <circle
                cx={n.x}
                cy={n.y}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={n.col === 0 ? 3 : 2}
              />
              {/* Asset price (top line) */}
              <text
                x={n.x}
                y={n.y - 3}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--color-ink-700)"
              >
                {num(n.price)}
              </text>
              {/* Option value / payoff (bottom line) */}
              <text
                x={n.x}
                y={n.y + 11}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={n.terminal ? 'var(--color-ink-500)' : 'var(--color-accent-600)'}
              >
                {num(n.value * reveal)}
              </text>
              {/* small up/down tag for clarity on the top/bottom branches */}
              {isUp && (
                <text
                  x={n.x}
                  y={n.y - radius - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-brand-500)"
                  aria-hidden="true"
                >
                  ▲
                </text>
              )}
            </g>
          );
        })}

        {/* Root highlight ring */}
        <circle
          cx={nodes[0][0].x}
          cy={nodes[0][0].y}
          r={28}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.6}
        />
      </svg>

      {/* Type toggle */}
      <div
        className="mt-2 inline-flex rounded-pill border border-ink-100 bg-surface-sunken/40 p-1 text-sm"
        role="group"
      >
        {(['call', 'put'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={typeState === opt}
            onClick={() => setTypeState(opt)}
            className={cx(
              'rounded-pill px-4 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              typeState === opt
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {opt === 'call' ? callLabel : putLabel}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-spot`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{spotLabel}</span>
            <span className="font-mono text-ink-900">{num(spotState)}</span>
          </label>
          <input
            id={`${id}-spot`}
            type="range"
            min={20}
            max={200}
            step={1}
            value={spotState}
            onChange={(e) => setSpotState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-strike`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{strikeLabel}</span>
            <span className="font-mono text-ink-900">{num(strikeState)}</span>
          </label>
          <input
            id={`${id}-strike`}
            type="range"
            min={20}
            max={200}
            step={1}
            value={strikeState}
            onChange={(e) => setStrikeState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-up`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{upLabel}</span>
            <span className="font-mono text-ink-900">{num(u)}</span>
          </label>
          <input
            id={`${id}-up`}
            type="range"
            min={1.05}
            max={1.6}
            step={0.01}
            value={upState}
            onChange={(e) => setUpState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-down`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{downLabel}</span>
            <span className="font-mono text-ink-900">{num(dSafe)}</span>
          </label>
          <input
            id={`${id}-down`}
            type="range"
            min={0.5}
            max={0.95}
            step={0.01}
            value={downState}
            onChange={(e) => setDownState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-rate`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{rateLabel}</span>
            <span className="font-mono text-ink-900">{num(rateState * 100)}%</span>
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0}
            max={0.1}
            step={0.005}
            value={rateState}
            onChange={(e) => setRateState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskNeutralProbLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(q, 3)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{optionValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(rootValue)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BinomialTree;
