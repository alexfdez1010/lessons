import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ProofOfWorkProps {
  /** Heading above the miner card. */
  title?: string;
  /** Text on the start-mining button. */
  mineLabel?: string;
  /** Text on the stop button (shown while grinding). */
  stopLabel?: string;
  /** Text on the reset button. */
  resetLabel?: string;
  /** Label for the difficulty slider. */
  difficultyLabel?: string;
  /** Label for the hashes-tried counter. */
  attemptsLabel?: string;
  /** Label for the nonce readout. */
  nonceLabel?: string;
  /** Label explaining the target legend. */
  targetLabel?: string;
  /** Status text shown when a valid block is found. */
  foundLabel?: string;
  /** Status text shown while grinding nonces. */
  searchingLabel?: string;
  /** One-line takeaway shown under the card. */
  caption?: string;
  /** Initial difficulty (leading "zero" cells), 1–6. Defaults to `3`. */
  difficulty?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Number of colored cells in the abstract fingerprint stripe. */
const STRIPE_CELLS = 8;

/** Palette of design-token hues the fingerprint cells cycle through. */
const FINGERPRINT_HUES = [
  'var(--color-brand-500)',
  'var(--color-brand-600)',
  'var(--color-accent-500)',
  'var(--color-brand-400)',
  'var(--color-accent-600)',
  'var(--color-brand-700)',
];

/** The "low / zero" hue a leading cell must land on to count toward the target. */
const ZERO_HUE = 'var(--color-brand-200)';

/** Cells whose value lands below this band count as a "zero" (≈ 1/2 chance). */
const ZERO_THRESHOLD = 0.5;

const MAX_DIFFICULTY = 6;
const MIN_DIFFICULTY = 1;

/**
 * Derive an abstract fingerprint from a nonce: a list of values in [0, 1) and a
 * matching list of palette indices, seeded via xorshift. Purely visual — no hex
 * or hash digits are ever shown. The `values` drive the target test; the
 * `hues` drive the displayed colors.
 */
const fingerprint = (seed: number): { values: number[]; hues: number[] } => {
  const values: number[] = [];
  const hues: number[] = [];
  let state = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  for (let i = 0; i < STRIPE_CELLS; i++) {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    values.push(state / 0xffffffff);
    hues.push(state % FINGERPRINT_HUES.length);
  }
  return { values, hues };
};

/** A fingerprint is below target when its first `difficulty` cells are "zeros". */
const isBelowTarget = (seed: number, difficulty: number): boolean => {
  const { values } = fingerprint(seed);
  for (let i = 0; i < difficulty; i++) {
    if (values[i] >= ZERO_THRESHOLD) return false;
  }
  return true;
};

/** Hard cap on synchronous tries (reduced-motion / instant solve). */
const SYNC_CAP = 4_000_000;
/** Tries per animation frame while grinding. */
const TRIES_PER_FRAME = 800;

/**
 * Interactive proof-of-work mining island. A single block carries some abstract
 * data, a live nonce counter, and a fingerprint stripe (a row of colored cells
 * — never hex or hash digits). "Mining" rapidly increments the nonce and
 * re-derives the fingerprint each time; the block is *found* when the first
 * `difficulty` cells all land on the low/"zero" color, i.e. the fingerprint
 * falls below the target. Each cell is a ~1/2 shot, so expected work ≈
 * 2^difficulty — sliding difficulty up makes the search exponentially harder.
 * Respects `prefers-reduced-motion` (solves synchronously and jumps to the
 * result instead of animating the grind).
 */
export function ProofOfWork({
  title = 'Mining: grind the nonce until the fingerprint is low enough',
  mineLabel = 'Start mining',
  stopLabel = 'Stop',
  resetLabel = 'Reset',
  difficultyLabel = 'Difficulty (leading zeros)',
  attemptsLabel = 'Hashes tried',
  nonceLabel = 'Nonce',
  targetLabel = 'Target: fingerprint must start this low',
  foundLabel = 'Block found! Fingerprint is below target.',
  searchingLabel = 'Grinding nonces…',
  caption = 'A miner keeps changing the nonce and re-hashing until the fingerprint falls below the target — its first cells must all land on the low color. Each extra required cell roughly doubles the work, so difficulty climbs exponentially.',
  difficulty = 3,
  className,
}: ProofOfWorkProps) {
  const id = useId();
  const clamp = (n: number) =>
    Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, Math.round(n)));

  const [difficultyState, setDifficultyState] = useState(clamp(difficulty));
  const [nonce, setNonce] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [mining, setMining] = useState(false);
  const [found, setFound] = useState(false);

  const rafRef = useRef<number | null>(null);
  // Live grind state lives in refs so the rAF loop isn't recreated each frame.
  const nonceRef = useRef(0);
  const attemptsRef = useRef(0);

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const reset = () => {
    stopRaf();
    nonceRef.current = 0;
    attemptsRef.current = 0;
    setNonce(0);
    setAttempts(0);
    setFound(false);
    setMining(false);
  };

  // Solve synchronously up to a cap; used for reduced-motion instant mining.
  const solveSync = (difficultyValue: number) => {
    let n = 0;
    let tries = 0;
    while (tries < SYNC_CAP && !isBelowTarget(n, difficultyValue)) {
      n += 1;
      tries += 1;
    }
    nonceRef.current = n;
    attemptsRef.current = tries + 1;
    setNonce(n);
    setAttempts(tries + 1);
    setFound(true);
    setMining(false);
  };

  const startMining = () => {
    stopRaf();
    nonceRef.current = 0;
    attemptsRef.current = 0;
    setNonce(0);
    setAttempts(0);
    setFound(false);

    if (prefersReducedMotion()) {
      solveSync(difficultyState);
      return;
    }

    setMining(true);
    const step = () => {
      let n = nonceRef.current;
      let tries = attemptsRef.current;
      let win = false;
      for (let i = 0; i < TRIES_PER_FRAME; i++) {
        tries += 1;
        if (isBelowTarget(n, difficultyState)) {
          win = true;
          break;
        }
        n += 1;
      }
      nonceRef.current = n;
      attemptsRef.current = tries;
      setNonce(n);
      setAttempts(tries);
      if (win) {
        setFound(true);
        setMining(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const stopMining = () => {
    stopRaf();
    setMining(false);
  };

  const handleDifficultyChange = (value: number) => {
    reset();
    setDifficultyState(clamp(value));
  };

  // Clean up the animation frame on unmount.
  useEffect(() => () => stopRaf(), []);

  const { hues, values } = fingerprint(nonce);
  const statusText = found ? foundLabel : mining ? searchingLabel : '';
  const numberFmt = (v: number) =>
    new Intl.NumberFormat('en-US').format(Math.round(v));

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        {mining ? (
          <button
            type="button"
            onClick={stopMining}
            className="rounded-pill bg-accent-600 px-3 py-1 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {stopLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={startMining}
            className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {mineLabel}
          </button>
        )}
      </figcaption>

      {/* Target legend: the first `difficulty` cells must be the low/zero color. */}
      <div className="mt-4">
        <span className="text-xs text-ink-500">{targetLabel}</span>
        <div
          className="mt-1 flex gap-0.5 overflow-hidden rounded-pill"
          aria-hidden="true"
        >
          {Array.from({ length: STRIPE_CELLS }, (_, i) => {
            const required = i < difficultyState;
            return (
              <span
                key={`${id}-target-${i}`}
                className="h-2.5 flex-1"
                style={{
                  backgroundColor: required ? ZERO_HUE : 'var(--color-ink-100)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* The block being mined. */}
      <div
        className={cx(
          'mt-4 flex flex-col gap-3 rounded-card border p-4 transition-colors',
          found
            ? 'border-brand-500 bg-brand-500/5'
            : 'border-ink-100 bg-surface-sunken/40',
        )}
        role="img"
        aria-label={`${title}. ${
          found
            ? `${foundLabel} It took ${numberFmt(attempts)} ${attemptsLabel}.`
            : mining
              ? searchingLabel
              : 'Idle, ready to mine.'
        }`}
      >
        {/* Abstract block data — muted bars, never text. */}
        <div>
          <span className="text-xs text-ink-500">Data</span>
          <div className="mt-1 flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-full rounded-pill bg-ink-200" />
            <span className="h-1.5 w-3/4 rounded-pill bg-ink-200" />
            <span className="h-1.5 w-1/2 rounded-pill bg-ink-200" />
          </div>
        </div>

        {/* Live nonce readout — a UI counter, not baked lesson content. */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-500">{nonceLabel}</span>
          <span className="font-mono text-sm font-semibold text-ink-900">
            {numberFmt(nonce)}
          </span>
        </div>

        {/* The block's fingerprint stripe. */}
        <div>
          <span className="text-xs text-ink-500">Fingerprint</span>
          <div
            className="mt-1 flex gap-0.5 overflow-hidden rounded-pill"
            aria-hidden="true"
          >
            {hues.map((hue, i) => {
              const required = i < difficultyState;
              const isZero = values[i] < ZERO_THRESHOLD;
              // A required cell that's a "zero" shows the low color (a hit);
              // every other cell shows its normal fingerprint hue.
              const color =
                required && isZero ? ZERO_HUE : FINGERPRINT_HUES[hue];
              return (
                <span
                  key={`${id}-fp-${i}`}
                  className="h-3 flex-1 transition-colors"
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Status line. */}
      <p
        className={cx(
          'mt-3 min-h-5 text-sm font-medium',
          found ? 'text-brand-700' : 'text-ink-600',
        )}
        aria-live="polite"
      >
        {statusText}
      </p>

      {/* Difficulty slider. */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-difficulty`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{difficultyLabel}</span>
          <span className="font-mono text-ink-900">{difficultyState}</span>
        </label>
        <input
          id={`${id}-difficulty`}
          type="range"
          min={MIN_DIFFICULTY}
          max={MAX_DIFFICULTY}
          step={1}
          value={difficultyState}
          onChange={(e) => handleDifficultyChange(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <dl className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
          <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
            <dt className="text-ink-500">{attemptsLabel}</dt>
            <dd className="font-mono text-lg font-semibold text-brand-700">
              {numberFmt(attempts)}
            </dd>
          </div>
          <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
            <dt className="text-ink-500">{nonceLabel}</dt>
            <dd className="font-mono text-lg font-semibold text-ink-900">
              {numberFmt(nonce)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-100 px-3 py-1 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ProofOfWork;
