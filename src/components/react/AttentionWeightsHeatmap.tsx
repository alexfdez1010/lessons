import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type Pattern = 'recent' | 'event' | 'diffuse';

export interface AttentionWeightsHeatmapProps {
  /** Heading above the heatmap. */
  title?: string;
  /** Label for the "recent / momentum" pattern button. */
  recentLabel?: string;
  /** Label for the "event-driven" pattern button. */
  eventLabel?: string;
  /** Label for the "diffuse" pattern button. */
  diffuseLabel?: string;
  /** Label for the softmax-temperature slider. */
  temperatureLabel?: string;
  /** Label for the query (row) axis. */
  queryAxisLabel?: string;
  /** Label for the key (column) axis. */
  keyAxisLabel?: string;
  /** Label for the focus / effective-context readout chip. */
  focusLabel?: string;
  /** One-line takeaway under the heatmap. */
  caption?: string;
  className?: string;
}

const T = 9; // sequence length (time steps)

// Raw attention SCORE that query position i assigns to key position j, under a
// causal mask (a position can only attend to itself and the past, j ≤ i):
//   recent  — score falls with distance |i − j|: momentum-style, look just behind.
//   event   — almost all mass on one distant key (a regime-defining shock).
//   diffuse — flat scores: attention spreads evenly over all of the past.
const EVENT_KEY = 2;
const rawScore = (i: number, j: number, pattern: Pattern): number => {
  if (j > i) return -Infinity; // causal mask
  if (pattern === 'recent') return -(i - j);
  if (pattern === 'event') return -1.6 * Math.abs(j - EVENT_KEY);
  return 0; // diffuse
};

// Softmax over the allowed keys with temperature τ. Low τ → peaky (decisive),
// high τ → uniform (hedged). Returns a full row that sums to 1 (zeros above mask).
const softmaxRow = (i: number, pattern: Pattern, tau: number): number[] => {
  const scores = Array.from({ length: T }, (_, j) => rawScore(i, j, pattern));
  const valid = scores.map((s) => (s === -Infinity ? -Infinity : s / tau));
  const max = Math.max(...valid.filter((v) => v !== -Infinity));
  const exps = valid.map((v) => (v === -Infinity ? 0 : Math.exp(v - max)));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
};

// Shannon entropy of a row (nats) → "effective context length" = exp(entropy):
// how many keys the query is effectively averaging over. 1 = laser-focused.
const effectiveContext = (row: number[]): number => {
  let h = 0;
  for (const p of row) if (p > 1e-9) h -= p * Math.log(p);
  return Math.exp(h);
};

/**
 * A self-attention weight matrix, the heart of the transformer. Each row is one
 * query position (an output time step); each column is a key position (an input
 * time step). The cell (i, j) is how much output step i "looks at" input step j —
 * a softmax weight, so every row sums to 1. The grid is causal: a step can only
 * attend to itself and the past (the upper triangle is masked to zero), the right
 * setup for forecasting.
 *
 * The toggles show three archetypes a model can learn on market data: RECENT
 * (momentum — attend to the last few bars), EVENT (pin attention on one distant
 * shock that still matters), and DIFFUSE (spread evenly — "I have no idea, average
 * everything"). The crucial idea attention adds over an RNN: step i reaches step j
 * DIRECTLY in one hop, no matter how far apart — there is no hidden state to decay
 * through, so long-range links cost nothing. The temperature slider sharpens
 * (low τ) or flattens (high τ) the softmax, and the readout reports the effective
 * number of keys each query is averaging over.
 */
export function AttentionWeightsHeatmap({
  title = 'Self-attention: who looks at whom',
  recentLabel = 'Recent (momentum)',
  eventLabel = 'Event-driven',
  diffuseLabel = 'Diffuse',
  temperatureLabel = 'Softmax temperature (τ)',
  queryAxisLabel = 'Query — output step i',
  keyAxisLabel = 'Key — input step j',
  focusLabel = 'Effective keys attended (avg)',
  caption = 'Each row is an output step asking "which inputs matter to me?"; the softmax weights in that row sum to 1. The matrix is causal — a step can only attend to itself and the past, so the upper triangle is empty. Recent attention hugs the diagonal (momentum); event-driven attention pins onto one distant shock; diffuse attention shrugs and averages everything. The superpower over a recurrent net: step i reaches step j in a single hop regardless of distance, so nothing has to survive a long chain of hidden states. Drop the temperature and the model commits to a few keys; raise it and attention smears toward uniform.',
  className,
}: AttentionWeightsHeatmapProps) {
  const id = useId();
  const [pattern, setPattern] = useState<Pattern>('recent');
  const [tau, setTau] = useState(1);

  const rows = Array.from({ length: T }, (_, i) => softmaxRow(i, pattern, tau));
  const avgContext =
    rows.reduce((a, r) => a + effectiveContext(r), 0) / rows.length;
  const avgContextText = avgContext.toFixed(1);

  // Layout: a T×T grid of cells with axis gutters.
  const cellPx = 30;
  const gutter = 34;
  const W = gutter + T * cellPx + 8;
  const H = gutter + T * cellPx + 24;

  const tauText = tau.toFixed(2);

  const patternButtons: { key: Pattern; label: string }[] = [
    { key: 'recent', label: recentLabel },
    { key: 'event', label: eventLabel },
    { key: 'diffuse', label: diffuseLabel },
  ];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Pattern toggle */}
      <div
        className="mt-4 inline-flex flex-wrap rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="attention pattern"
      >
        {patternButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setPattern(b.key)}
            aria-pressed={pattern === b.key}
            className={cx(
              'rounded-pill px-3 py-1 font-medium transition',
              pattern === b.key ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full max-w-md"
        role="img"
        aria-label={`A ${T} by ${T} causal self-attention weight matrix. Rows are output query steps, columns are input key steps, and each row of softmax weights sums to one. Pattern: ${pattern}. With temperature ${tauText}, each query effectively averages over about ${avgContextText} keys.`}
      >
        {rows.map((row, i) =>
          row.map((w, j) => {
            const masked = j > i;
            return (
              <g key={`c-${i}-${j}`}>
                <rect
                  x={gutter + j * cellPx}
                  y={gutter + i * cellPx}
                  width={cellPx - 2}
                  height={cellPx - 2}
                  rx={3}
                  fill={masked ? 'var(--color-surface-50)' : 'var(--color-brand-500)'}
                  fillOpacity={masked ? 1 : 0.12 + 0.88 * Math.min(1, w * 1.6)}
                  stroke="var(--color-ink-100)"
                  strokeWidth={0.5}
                />
                {!masked && w >= 0.16 && (
                  <text
                    x={gutter + j * cellPx + (cellPx - 2) / 2}
                    y={gutter + i * cellPx + (cellPx - 2) / 2 + 3}
                    fontSize={8}
                    fill={w > 0.5 ? 'white' : 'var(--color-ink-700)'}
                    textAnchor="middle"
                  >
                    {Math.round(w * 100)}
                  </text>
                )}
              </g>
            );
          }),
        )}

        {/* Column (key) indices */}
        {Array.from({ length: T }, (_, j) => (
          <text
            key={`kx-${j}`}
            x={gutter + j * cellPx + (cellPx - 2) / 2}
            y={gutter - 6}
            fontSize={9}
            fill="var(--color-ink-500)"
            textAnchor="middle"
          >
            {j + 1}
          </text>
        ))}
        {/* Row (query) indices */}
        {Array.from({ length: T }, (_, i) => (
          <text
            key={`qy-${i}`}
            x={gutter - 8}
            y={gutter + i * cellPx + (cellPx - 2) / 2 + 3}
            fontSize={9}
            fill="var(--color-ink-500)"
            textAnchor="end"
          >
            {i + 1}
          </text>
        ))}

        {/* Axis captions */}
        <text x={gutter + (T * cellPx) / 2} y={H - 4} fontSize={10} fill="var(--color-ink-700)" textAnchor="middle">
          {keyAxisLabel}
        </text>
        <text
          x={10}
          y={gutter + (T * cellPx) / 2}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 10 ${gutter + (T * cellPx) / 2})`}
        >
          {queryAxisLabel}
        </text>
      </svg>

      {/* Readout chip */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{focusLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{avgContextText}</span>
        </span>
      </div>

      {/* Temperature slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-tau`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{temperatureLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {tauText}
          </span>
        </label>
        <input
          id={`${id}-tau`}
          type="range"
          min={0.3}
          max={3}
          step={0.1}
          value={tau}
          onChange={(e) => setTau(Number(e.target.value))}
          aria-valuetext={`softmax temperature ${tauText}; each query effectively averages over about ${avgContextText} keys`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AttentionWeightsHeatmap;
