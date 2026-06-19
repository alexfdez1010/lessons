import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SequenceModelUnrollProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the "vanilla RNN" toggle button. */
  vanillaLabel?: string;
  /** Label for the "gated (LSTM/GRU)" toggle button. */
  gatedLabel?: string;
  /** Label for the sequence-length slider. */
  lengthLabel?: string;
  /** Label for the input row. */
  inputLabel?: string;
  /** Label for the hidden-state row. */
  hiddenLabel?: string;
  /** Label for the surviving-memory readout chip. */
  retentionLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Per-step retention of step-1 information.
//   Vanilla RNN: the hidden state is squashed and re-mixed every step, so the
//   influence of x₁ decays geometrically — r_t = ρ^(t-1) with ρ < 1. This is the
//   vanishing-gradient story: signal (and gradient) from far back fades fast.
//   Gated (LSTM/GRU): an additive cell-state "highway" with a forget gate near 1
//   lets information ride almost undamped — r_t ≈ g^(t-1) with g ≈ 1.
const RHO_VANILLA = 0.62;
const G_GATED = 0.96;

const retentionAt = (stepIdx: number, gated: boolean): number =>
  Math.pow(gated ? G_GATED : RHO_VANILLA, stepIdx);

/**
 * Unrolling a recurrent model through time. The top row is an input sequence
 * x₁…x_T (say, T days of returns); the middle row is the hidden state h_t that
 * the network carries forward — each h_t is built from the previous hidden state
 * h_{t-1} (the recurrence arrow) plus the new input x_t. Reading a sequence model
 * "unrolled" like this is the key mental move: it is one cell applied T times, not
 * T different cells.
 *
 * The cells are shaded by how much of the FIRST input's information still survives
 * in the hidden state at that step — the central pedagogical point. A vanilla RNN
 * re-squashes the state every step, so x₁'s influence (and the gradient flowing
 * back to it) decays geometrically: this is the vanishing-gradient problem, and it
 * is why plain RNNs forget the distant past. Toggle to a gated cell (LSTM/GRU) and
 * the additive cell-state highway keeps the early signal alive across the whole
 * window. A pulse sweeps left-to-right on mount and on every change, respecting
 * `prefers-reduced-motion`.
 */
export function SequenceModelUnroll({
  title = 'Unrolling a recurrent model — and watching the past fade',
  vanillaLabel = 'Vanilla RNN',
  gatedLabel = 'Gated (LSTM / GRU)',
  lengthLabel = 'Sequence length (T)',
  inputLabel = 'Input xₜ',
  hiddenLabel = 'Hidden state hₜ',
  retentionLabel = 'Step-1 info surviving at h_T',
  caption = 'One recurrent cell, applied T times: each hidden state hₜ mixes the previous state hₜ₋₁ with the new input xₜ. Cells are shaded by how much of the FIRST input still survives. A vanilla RNN squashes and re-mixes every step, so the early signal — and the gradient flowing back to it — decays geometrically: that is the vanishing-gradient problem, and why plain RNNs forget the distant past. Switch to a gated cell and the additive cell-state highway carries the old signal almost undamped. Stretch the sequence and watch the vanilla curve collapse while the gated one holds.',
  className,
}: SequenceModelUnrollProps) {
  const id = useId();
  const [gated, setGated] = useState(false);
  const [T, setT] = useState(8);
  const [progress, setProgress] = useState(0); // 0 → 1 sweep reveal
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 28;
  const inputY = 44;
  const hiddenY = 120;
  const cell = 26; // half-size of a cell box

  // Sweep the pulse across the chain on mount and whenever inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [gated, T]);

  const xAt = (i: number) =>
    padX + cell + (i / Math.max(1, T - 1)) * (W - 2 * (padX + cell));

  // Retention per step and the headline number (surviving at the last step).
  const retention: number[] = [];
  for (let i = 0; i < T; i++) retention.push(retentionAt(i, gated));
  const finalRetention = retention[T - 1];
  const finalPct = (finalRetention * 100).toFixed(finalRetention < 0.1 ? 1 : 0);

  // Pulse position along the chain (which step the travelling dot has reached).
  const pulse = progress * (T - 1);
  const litUpTo = Math.floor(pulse + 0.001);

  const cells = Array.from({ length: T }, (_, i) => i);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Mode toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="recurrent cell type"
      >
        <button
          type="button"
          onClick={() => setGated(false)}
          aria-pressed={!gated}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            !gated ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {vanillaLabel}
        </button>
        <button
          type="button"
          onClick={() => setGated(true)}
          aria-pressed={gated}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            gated ? 'bg-accent-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {gatedLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A recurrent network unrolled over ${T} time steps. Input cells x1 through x${T} feed hidden-state cells h1 through h${T}, connected left to right by recurrence arrows. Cells are shaded by how much of the first input survives. In ${gated ? 'gated (LSTM/GRU)' : 'vanilla RNN'} mode, about ${finalPct}% of step-1 information still reaches the final hidden state h${T}.`}
      >
        {/* Recurrence arrows between hidden cells */}
        {cells.slice(1).map((i) => {
          const litArrow = i <= litUpTo + 1;
          return (
            <line
              key={`rec-${i}`}
              x1={xAt(i - 1) + cell * 0.6}
              y1={hiddenY}
              x2={xAt(i) - cell * 0.6}
              y2={hiddenY}
              stroke={litArrow ? 'var(--color-ink-500)' : 'var(--color-ink-200)'}
              strokeWidth={1.6}
              markerEnd="url(#smu-arrow)"
            />
          );
        })}
        <defs>
          <marker
            id="smu-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-ink-500)" />
          </marker>
        </defs>

        {cells.map((i) => {
          const cx0 = xAt(i);
          const r = retention[i];
          const lit = i <= litUpTo;
          return (
            <g key={`col-${i}`}>
              {/* input → hidden feed */}
              <line
                x1={cx0}
                y1={inputY + cell * 0.5}
                x2={cx0}
                y2={hiddenY - cell * 0.55}
                stroke="var(--color-ink-200)"
                strokeWidth={1.4}
                markerEnd="url(#smu-arrow)"
              />
              {/* input cell */}
              <rect
                x={cx0 - cell * 0.5}
                y={inputY - cell * 0.5}
                width={cell}
                height={cell}
                rx={5}
                fill="var(--color-surface-50)"
                stroke="var(--color-ink-200)"
              />
              <text
                x={cx0}
                y={inputY + 4}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor="middle"
              >
                x{i + 1}
              </text>
              {/* hidden cell, shaded by surviving step-1 information */}
              <circle
                cx={cx0}
                cy={hiddenY}
                r={cell * 0.6}
                fill={gated ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
                fillOpacity={lit ? 0.18 + 0.82 * r : 0.08}
                stroke={gated ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
                strokeOpacity={0.5}
              />
              <text
                x={cx0}
                y={hiddenY + 4}
                fontSize={10}
                fontWeight={600}
                fill={r > 0.5 && lit ? 'white' : 'var(--color-ink-700)'}
                textAnchor="middle"
              >
                h{i + 1}
              </text>
            </g>
          );
        })}

        {/* Travelling pulse along the hidden chain */}
        {progress < 1 && !prefersReducedMotion() && (
          <circle
            cx={xAt(Math.min(T - 1, pulse))}
            cy={hiddenY}
            r={4}
            fill="var(--color-ink-900)"
          />
        )}

        {/* Row labels */}
        <text x={padX - 6} y={inputY + 4} fontSize={9} fill="var(--color-ink-500)" textAnchor="start">
          {inputLabel}
        </text>
        <text x={padX - 6} y={hiddenY - cell * 0.7 - 4} fontSize={9} fill="var(--color-ink-500)" textAnchor="start">
          {hiddenLabel}
        </text>

        {/* Output marker on the last hidden state */}
        <line
          x1={xAt(T - 1)}
          y1={hiddenY + cell * 0.6}
          x2={xAt(T - 1)}
          y2={H - 30}
          stroke="var(--color-ink-400)"
          strokeWidth={1.4}
          markerEnd="url(#smu-arrow)"
        />
        <text x={xAt(T - 1)} y={H - 16} fontSize={10} fontWeight={600} fill="var(--color-ink-700)" textAnchor="middle">
          ŷ
        </text>
      </svg>

      {/* Readout chip */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{retentionLabel}</span>
          <span
            className={cx(
              'font-mono font-semibold',
              gated ? 'text-accent-600' : 'text-brand-600',
            )}
          >
            {finalPct}%
          </span>
        </span>
      </div>

      {/* Sequence-length slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-len`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{lengthLabel}</span>
          <span className="font-mono text-ink-600" aria-hidden="true">
            {T}
          </span>
        </label>
        <input
          id={`${id}-len`}
          type="range"
          min={4}
          max={16}
          step={1}
          value={T}
          onChange={(e) => setT(Number(e.target.value))}
          aria-valuetext={`sequence length ${T} steps, step-1 information surviving at the end about ${finalPct} percent`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SequenceModelUnroll;
