import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RollupBatchProps {
  /** Heading above the diagram. */
  title?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  /** Label for the batch-size slider. */
  countLabel?: string;
  /** Button label that compresses L2 txs into one L1 batch. */
  batchLabel?: string;
  /** Button label that resets the animation. */
  resetLabel?: string;
  /** Label for the Layer-2 lane. */
  l2Label?: string;
  /** Label for the Layer-1 lane. */
  l1Label?: string;
  /** Readout label for the fixed L1 cost of the whole batch. */
  l1CostLabel?: string;
  /** Readout label for the amortized cost per user. */
  perTxLabel?: string;
  /** Readout label for the savings multiplier. */
  savingsLabel?: string;
  /** Label for the proof-type toggle. */
  modeLabel?: string;
  /** Label for the optimistic-rollup option. */
  optimisticLabel?: string;
  /** Label for the ZK-rollup option. */
  zkLabel?: string;
  /** Label for the withdrawal-finality readout. */
  finalityLabel?: string;
  /** Finality value shown for optimistic rollups. */
  optimisticFinalityValue?: string;
  /** Finality value shown for ZK rollups. */
  zkFinalityValue?: string;
  /** Currency unit suffix. Defaults to `'ETH'`. */
  ethLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Model constants (ETH). */
const MIN_N = 1;
const MAX_N = 200;
const DEFAULT_N = 50;
/** Base L1 cost to post a batch, plus a tiny per-tx calldata term. */
const L1_BASE = 0.02;
const L1_PER_TX = 0.00005;
/** What a single plain transfer would cost going straight to L1. */
const SOLO_COST = 0.004;
/** Cap on rendered tx squares for performance (math uses the true N). */
const MAX_SQUARES = 60;

const l1CostFor = (n: number): number => L1_BASE + n * L1_PER_TX;
const perUserFor = (n: number): number => l1CostFor(n) / n;

const eth = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(value);

const mult = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value);

const count = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

type Mode = 'optimistic' | 'zk';

/**
 * Interactive Layer-2 rollup explainer. Many transactions execute cheaply on
 * L2; a slider sets how many (1..200). Pressing the batch button visually
 * compresses the grid of L2 transaction squares down into a single L1 block —
 * the fixed L1 cost is amortized across every batched transaction, so the
 * cost-per-user falls as the batch grows. A segmented toggle contrasts
 * Optimistic rollups (fraud proof, long challenge window) with ZK rollups
 * (validity proof, fast finality), swapping the finality readout and a short
 * note on how each proves correctness. Respects `prefers-reduced-motion`.
 */
export function RollupBatch({
  title = 'One L1 batch, split across many users',
  caption = 'A rollup runs many transactions cheaply on L2, then posts one compressed batch to L1. The fixed L1 cost is shared by everyone in the batch, so cost-per-user drops as the batch grows. Optimistic rollups assume the batch is valid and let anyone challenge it within a window; ZK rollups attach a cryptographic validity proof verified on L1 right away.',
  countLabel = 'Transactions in the batch',
  batchLabel = 'Post batch to L1',
  resetLabel = 'Reset',
  l2Label = 'Layer 2 (rollup)',
  l1Label = 'Layer 1 (Ethereum)',
  l1CostLabel = 'L1 cost for the whole batch',
  perTxLabel = 'Cost per user',
  savingsLabel = 'vs going straight to L1',
  modeLabel = 'Proof type',
  optimisticLabel = 'Optimistic (fraud proof)',
  zkLabel = 'ZK (validity proof)',
  finalityLabel = 'Withdrawal finality',
  optimisticFinalityValue = '~7-day challenge window',
  zkFinalityValue = 'Minutes — proof verified on L1',
  ethLabel = 'ETH',
  className,
}: RollupBatchProps) {
  const id = useId();
  const [n, setN] = useState(DEFAULT_N);
  const [mode, setMode] = useState<Mode>('optimistic');
  const [batched, setBatched] = useState(false);
  const [progress, setProgress] = useState(0); // 0 → 1 (collapse animation)
  const rafRef = useRef<number | null>(null);

  const l1Cost = l1CostFor(n);
  const perUser = perUserFor(n);
  const savings = SOLO_COST / perUser;

  const rendered = Math.min(n, MAX_SQUARES);
  const extra = n - rendered;

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const runBatch = () => {
    setBatched(true);
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    stopRaf();
    setProgress(0);
    const duration = 700;
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
  };

  const reset = () => {
    stopRaf();
    setBatched(false);
    setProgress(0);
  };

  // Re-expand if the batch size changes after posting.
  useEffect(() => {
    stopRaf();
    setBatched(false);
    setProgress(0);
  }, [n]);

  useEffect(() => () => stopRaf(), []);

  // SVG layout.
  const W = 520;
  const H = 240;
  const cols = 10;
  const cell = 18;
  const gap = 4;
  const gridX = 16;
  const gridY = 40;
  const blockW = 84;
  const blockH = 56;
  const blockX = W / 2 - blockW / 2;
  const blockY = 168;

  const squarePos = (i: number) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      x: gridX + c * (cell + gap),
      y: gridY + r * (cell + gap),
    };
  };
  // Target point: everything funnels into the L1 block.
  const targetX = blockX + blockW / 2 - cell / 2;
  const targetY = blockY + blockH / 2 - cell / 2;

  const modeNote =
    mode === 'optimistic'
      ? 'Fraud proof: the batch is assumed valid and anyone can challenge it within the window.'
      : 'Validity proof: a cryptographic proof is verified on L1 immediately, so it is final right away.';

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
          {count(n)}×
        </span>
      </figcaption>

      {/* Lane labels */}
      <div className="mt-4 flex justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-500"
            aria-hidden="true"
          />
          {l2Label}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-accent-500"
            aria-hidden="true"
          />
          {l1Label}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${count(n)} Layer-2 transactions are compressed into one Layer-1 batch. The whole batch costs about ${eth(
          l1Cost,
        )} ${ethLabel} on L1, which split across ${count(
          n,
        )} users is about ${eth(
          perUser,
        )} ${ethLabel} each — roughly ${mult(
          savings,
        )} times cheaper than each user paying for their own L1 transaction.`}
      >
        {/* L2 → L1 divider */}
        <line
          x1={16}
          y1={148}
          x2={W - 16}
          y2={148}
          stroke="var(--color-ink-100)"
          strokeDasharray="4 4"
        />

        {/* L2 transaction squares (collapse toward the L1 block) */}
        {Array.from({ length: rendered }, (_, i) => {
          const start = squarePos(i);
          const cxPos = start.x + (targetX - start.x) * progress;
          const cyPos = start.y + (targetY - start.y) * progress;
          const opacity = 1 - progress * 0.85;
          const scale = 1 - progress * 0.4;
          return (
            <rect
              key={`${id}-sq-${i}`}
              x={cxPos}
              y={cyPos}
              width={cell * scale}
              height={cell * scale}
              rx={3}
              fill="var(--color-brand-500)"
              opacity={Math.max(0, opacity)}
            />
          );
        })}

        {/* "+ more" marker when N exceeds the rendered cap */}
        {extra > 0 && progress < 0.5 && (
          <text
            x={gridX + (cols - 0.2) * (cell + gap)}
            y={gridY + Math.ceil(rendered / cols) * (cell + gap) + 10}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-ink-500)"
            opacity={1 - progress * 2}
          >
            + {count(extra)} more
          </text>
        )}

        {/* L1 batch block */}
        <rect
          x={blockX}
          y={blockY}
          width={blockW}
          height={blockH}
          rx={8}
          fill="var(--color-accent-500)"
          opacity={0.18 + progress * 0.82}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
        />
        <text
          x={blockX + blockW / 2}
          y={blockY + blockH / 2 + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill={
            progress > 0.5 ? 'var(--color-surface)' : 'var(--color-accent-500)'
          }
        >
          1 batch
        </text>

        {/* Funnel hint arrow */}
        <path
          d={`M ${W / 2} 150 L ${W / 2} ${blockY - 6}`}
          stroke="var(--color-ink-200)"
          strokeWidth={2}
          strokeDasharray="3 4"
          markerEnd=""
        />
        <path
          d={`M ${W / 2 - 5} ${blockY - 12} L ${W / 2} ${blockY - 5} L ${
            W / 2 + 5
          } ${blockY - 12}`}
          fill="none"
          stroke="var(--color-ink-200)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Controls: batch size slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-count`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{countLabel}</span>
          <span className="font-mono text-ink-900">{count(n)}</span>
        </label>
        <input
          id={`${id}-count`}
          type="range"
          min={MIN_N}
          max={MAX_N}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Batch / reset buttons */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={runBatch}
          disabled={batched}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {batchLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!batched}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetLabel}
        </button>
      </div>

      {/* Cost readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{l1CostLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {eth(l1Cost)} {ethLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{perTxLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {eth(perUser)} {ethLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{savingsLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            ≈ {mult(savings)}× cheaper
          </dd>
        </div>
      </dl>

      {/* Proof-type toggle */}
      <div className="mt-4">
        <span className="text-sm text-ink-700">{modeLabel}</span>
        <div
          role="group"
          aria-label={modeLabel}
          className="mt-2 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-1"
        >
          <button
            type="button"
            aria-pressed={mode === 'optimistic'}
            onClick={() => setMode('optimistic')}
            className={cx(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              mode === 'optimistic'
                ? 'bg-brand-600 text-white'
                : 'text-ink-700 hover:text-ink-900',
            )}
          >
            {optimisticLabel}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'zk'}
            onClick={() => setMode('zk')}
            className={cx(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              mode === 'zk'
                ? 'bg-brand-600 text-white'
                : 'text-ink-700 hover:text-ink-900',
            )}
          >
            {zkLabel}
          </button>
        </div>
      </div>

      {/* Finality panel */}
      <div
        className="mt-3 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 text-sm"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500">{finalityLabel}</dt>
          <dd className="font-medium text-accent-600">
            {mode === 'optimistic'
              ? optimisticFinalityValue
              : zkFinalityValue}
          </dd>
        </div>
        <p className="mt-1 leading-relaxed text-ink-600">{modeNote}</p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RollupBatch;
