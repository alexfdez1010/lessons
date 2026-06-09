import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RandomnessStreaksProps {
  /** Heading above the streak row. */
  title?: string;
  /** One-line takeaway shown under the row. */
  caption?: string;
  /** How many up/down cells to render. Defaults to `24`. */
  count?: number;
  /** Label/tooltip word for an "up" cell. Defaults to `'Up day'`. */
  upLabel?: string;
  /** Label/tooltip word for a "down" cell. Defaults to `'Down day'`. */
  downLabel?: string;
  /** Regenerate button text. Defaults to `'Run it again'`. */
  regenerateLabel?: string;
  /** Legend for the longest run readout. Defaults to `'Longest streak'`. */
  longestStreakLabel?: string;
  /** Legend for the fixed next-flip odds. Defaults to `'Chance the next day is up'`. */
  nextOddsLabel?: string;
  /** The fixed odds value — never changes with the streak. Defaults to `'50%'`. */
  nextOddsValue?: string;
  /** Plain-language note explaining independence. */
  fallacyNote?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Deterministic, fixed seed sequence used for the first (SSR + first client)
 * render. No `Math.random` is touched during render, so the server and client
 * markup match exactly — fresh randomness only arrives on a button click. The
 * pattern is hand-picked to already contain a satisfying long run, so the
 * teaching point ("independent coin flips naturally clump into streaks") lands
 * before the learner touches anything.
 */
const SEED_PATTERN: readonly boolean[] = [
  true,
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  false,
  false,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  false,
  true,
  false,
  true,
  true,
];

/** Build the deterministic starting sequence of the requested length. */
function seedSequence(count: number): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(SEED_PATTERN[i % SEED_PATTERN.length]);
  }
  return out;
}

/** Length of the longest run of identical values in the sequence. */
function longestRun(seq: readonly boolean[]): number {
  let best = 0;
  let current = 0;
  let prev: boolean | null = null;
  for (const value of seq) {
    if (value === prev) {
      current += 1;
    } else {
      current = 1;
      prev = value;
    }
    if (current > best) best = current;
  }
  return best;
}

/**
 * Visual proof that **independent** sequences clump into streaks all by
 * themselves. A row of up/down cells (think: a stock's daily direction, a coin)
 * is generated from a fixed seed, so the row is identical on the server and the
 * first client paint — no hydration mismatch. "Run it again" reshuffles it with
 * `Math.random` (event handler only) and the longest run is recomputed each
 * time, but the headline number — *the chance the next day is up* — is pinned at
 * 50% and **never** moves, no matter how long the current streak is. That fixed
 * readout is the whole lesson: past flips carry zero information about the next
 * one, so "it's due for a reversal" (gambler's fallacy) and "it's on a hot
 * streak" are both reading meaning into noise.
 */
export function RandomnessStreaks({
  title = 'Streaks are normal — and they predict nothing',
  caption =
    "Every run came from independent 50/50 flips, yet long streaks show up on their own. Hit “Run it again” as many times as you like: the longest streak jumps around, but the chance the next day is up stays glued to 50%. Streaks have no memory.",
  count = 24,
  upLabel = 'Up day',
  downLabel = 'Down day',
  regenerateLabel = 'Run it again',
  longestStreakLabel = 'Longest streak',
  nextOddsLabel = 'Chance the next day is up',
  nextOddsValue = '50%',
  fallacyNote =
    "Because each flip is independent, a five-day run tells you nothing about day six. “It's due for a down day” (gambler's fallacy) and “it's on a hot streak” both invent a pattern that isn't there.",
  className,
}: RandomnessStreaksProps) {
  const id = useId();
  const cellCount = Math.max(1, Math.floor(count));

  // Deterministic seed — identical on server and first client render.
  const seeded = useMemo(() => seedSequence(cellCount), [cellCount]);
  const [sequence, setSequence] = useState<boolean[]>(seeded);

  const longest = longestRun(sequence);

  const regenerate = (): void => {
    // Math.random ONLY here, in a client event handler — never during render.
    const next: boolean[] = [];
    for (let i = 0; i < cellCount; i += 1) {
      next.push(Math.random() < 0.5);
    }
    setSequence(next);
  };

  const reduceMotion = prefersReducedMotion();

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="flex flex-wrap items-center gap-3 text-sm text-ink-700">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-pill"
              style={{ backgroundColor: 'var(--color-success)' }}
              aria-hidden="true"
            />
            {upLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-pill"
              style={{ backgroundColor: 'var(--color-danger)' }}
              aria-hidden="true"
            />
            {downLabel}
          </span>
        </span>
      </figcaption>

      <ol
        className="mt-4 flex flex-wrap gap-1.5"
        aria-label={`Sequence of ${cellCount} independent up or down outcomes. Longest current run: ${longest}.`}
      >
        {sequence.map((isUp, i) => (
          <li
            key={`${id}-${i}`}
            title={isUp ? upLabel : downLabel}
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-pill text-xs font-semibold text-surface',
              !reduceMotion && 'transition-colors duration-300',
            )}
            style={{
              backgroundColor: isUp
                ? 'var(--color-success)'
                : 'var(--color-danger)',
            }}
          >
            <span aria-hidden="true">{isUp ? '↑' : '↓'}</span>
            <span className="sr-only">{isUp ? upLabel : downLabel}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-stretch gap-3">
        <div className="flex min-w-[8rem] flex-1 flex-col rounded-card bg-surface-sunken px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {longestStreakLabel}
          </span>
          <span
            className="mt-1 font-display text-2xl text-ink-900"
            aria-live="polite"
          >
            {longest}
          </span>
        </div>
        <div className="flex min-w-[8rem] flex-1 flex-col rounded-card bg-brand-50 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {nextOddsLabel}
          </span>
          {/* Intentionally static: independence means this never changes. */}
          <span className="mt-1 font-display text-2xl text-brand-700">
            {nextOddsValue}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={regenerate}
          className="inline-flex items-center justify-center rounded-pill bg-brand-500 px-4 py-2 text-sm font-semibold text-surface shadow-soft transition-colors duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {regenerateLabel}
        </button>
        <p className="flex-1 text-sm leading-relaxed text-ink-600">
          {fallacyNote}
        </p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RandomnessStreaks;
