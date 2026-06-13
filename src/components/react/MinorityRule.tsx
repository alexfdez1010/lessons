import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MinorityRuleProps {
  /** Heading above the figure. */
  title?: string;
  /** Label for the stubborn-minority slider. */
  minorityLabel?: string;
  /** Label on the "spread one level" button. */
  spreadLabel?: string;
  /** Label on the reset button. */
  resetLabel?: string;
  /** Readout label for the stubborn-minority share. */
  minorityShareLabel?: string;
  /** Readout label for the share of products that conform. */
  conformShareLabel?: string;
  /**
   * Scale labels that advance as the rule renormalises up scales. The last is
   * the resting label once everything conforms. Defaults to
   * `['Household', 'Store', 'Region', 'Nation']`.
   */
  scaleLabels?: string[];
  /** Readout label for the current scale. */
  scaleLabel?: string;
  /** Legend label for the intransigent (one-directional) cells. */
  intransigentLabel?: string;
  /** Legend label for the flexible / indifferent cells. */
  flexibleLabel?: string;
  /** Legend label for cells that have flipped to conform. */
  conformedLabel?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cell states. The intransigent minority can ONLY accept the conforming choice;
// flexible cells are indifferent until a neighbour forces the cheap single
// choice on them, at which point they conform.
type CellState = 'intransigent' | 'flexible' | 'conformed';

const COLS = 20;
const ROWS = 8;
const TOTAL = COLS * ROWS;

/**
 * Deterministic pseudo-random hash → [0,1). Keeps the seeded minority layout
 * identical between SSR and client hydration (no `Math.random`, no flicker).
 */
const hash01 = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Build the starting population for a given minority fraction. The first
 * `count` cells of a deterministically shuffled order become intransigent, so
 * the stubborn minority is scattered through the grid rather than clumped.
 */
const seedGrid = (minorityPct: number): CellState[] => {
  const count = Math.round((minorityPct / 100) * TOTAL);
  const order = Array.from({ length: TOTAL }, (_, i) => i).sort(
    (a, b) => hash01(a) - hash01(b),
  );
  const intransigent = new Set(order.slice(0, count));
  return Array.from({ length: TOTAL }, (_, i) =>
    intransigent.has(i) ? 'intransigent' : 'flexible',
  );
};

const neighbours = (i: number): number[] => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
};

/**
 * One renormalisation step: any flexible cell touching an intransigent or
 * already-conformed cell flips to conform. Because the indifferent majority
 * has no opposing preference, the cheap choice for everyone nearby is to adopt
 * the strict option — so the conforming region only ever grows.
 */
const spreadOnce = (grid: CellState[]): CellState[] => {
  const next = grid.slice();
  let changed = false;
  for (let i = 0; i < TOTAL; i++) {
    if (grid[i] !== 'flexible') continue;
    const touched = neighbours(i).some(
      (n) => grid[n] === 'intransigent' || grid[n] === 'conformed',
    );
    if (touched) {
      next[i] = 'conformed';
      changed = true;
    }
  }
  return changed ? next : grid;
};

const isDone = (grid: CellState[]): boolean =>
  !grid.includes('flexible');

/**
 * Taleb's **Minority Rule** (renormalisation, from *Skin in the Game*) made
 * tangible. A grid is a population: a small, *intransigent* minority (the
 * minority-fraction slider, 1–15%) will only ever accept one choice, while the
 * flexible majority is indifferent and can take either. Stepping the simulation
 * spreads the strict choice outward one scale at a time — household → store →
 * region → nation — because the cheapest single decision for the indifferent
 * is to make *everything* conform. The conform readout rockets to ~100% even
 * when the stubborn share is a few percent: the outcome is an emergent property
 * of the strictest constraint, not of the population average.
 *
 * Locale-agnostic (every user-facing string is a prop) and SSR-safe (the
 * minority layout is seeded deterministically). Respects
 * `prefers-reduced-motion`: no autoplay — the learner drives it with the
 * "spread one level" button — and flips snap to their final state. The live
 * minority/conform shares and the current scale are announced via `aria-live`.
 */
export function MinorityRule({
  title = 'The Minority Rule: how a stubborn few set the menu',
  minorityLabel = 'Stubborn minority',
  spreadLabel = 'Spread one level',
  resetLabel = 'Reset',
  minorityShareLabel = 'Stubborn minority',
  conformShareLabel = 'Share that conforms',
  scaleLabels = ['Household', 'Store', 'Region', 'Nation'],
  scaleLabel = 'Scale',
  intransigentLabel = 'Intransigent (one choice only)',
  flexibleLabel = 'Flexible (either is fine)',
  conformedLabel = 'Now conforms',
  caption = 'A tiny, one-directional minority can flip the whole population. The indifferent majority has no opposing preference, so the cheapest single choice is to make everything conform — and it cascades up every scale until ~100% complies. You cannot read this off the average.',
  className,
}: MinorityRuleProps) {
  const id = useId();
  const reduced = prefersReducedMotion();

  const [minorityPct, setMinorityPct] = useState(4);
  const [grid, setGrid] = useState<CellState[]>(() => seedGrid(4));
  // How many spread steps have run — also indexes the scale label.
  const [level, setLevel] = useState(0);

  // Re-seed whenever the minority fraction changes (and reset the cascade).
  useEffect(() => {
    setGrid(seedGrid(minorityPct));
    setLevel(0);
  }, [minorityPct]);

  const done = isDone(grid);

  const intransigentCount = useMemo(
    () => grid.filter((c) => c === 'intransigent').length,
    [grid],
  );
  const conformingCount = useMemo(
    () => grid.filter((c) => c !== 'flexible').length,
    [grid],
  );

  const minorityShare = (intransigentCount / TOTAL) * 100;
  const conformShare = (conformingCount / TOTAL) * 100;

  const spread = () => {
    if (done) return;
    setGrid((g) => spreadOnce(g));
    setLevel((l) => Math.min(l + 1, scaleLabels.length - 1));
  };

  const reset = () => {
    setGrid(seedGrid(minorityPct));
    setLevel(0);
  };

  const currentScale =
    scaleLabels[Math.min(level, scaleLabels.length - 1)] ?? '';

  const fmt = (v: number): string =>
    `${v < 1 && v > 0 ? v.toFixed(1) : Math.round(v)}%`;

  // Bar color shifts toward the brand as conformance climbs — a visual cue that
  // the strict choice has taken over.
  const conformBarColor =
    conformShare >= 99
      ? 'var(--color-brand-600)'
      : conformShare >= 50
        ? 'var(--color-brand-500)'
        : 'var(--color-accent-500)';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {scaleLabel}: {currentScale}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-600"
            aria-hidden="true"
          />
          {intransigentLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-ink-200"
            aria-hidden="true"
          />
          {flexibleLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-accent-400"
            aria-hidden="true"
          />
          {conformedLabel}
        </span>
      </div>

      {/* Population grid */}
      <div
        className="mt-4 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Population of ${TOTAL}: ${intransigentCount} intransigent, ${
          conformingCount - intransigentCount
        } have conformed, ${
          TOTAL - conformingCount
        } still flexible. ${fmt(conformShare)} now conform.`}
      >
        {grid.map((state, i) => {
          const base =
            'aspect-square rounded-[3px] ' +
            (reduced ? '' : 'transition-colors duration-300 ');
          const color =
            state === 'intransigent'
              ? 'bg-brand-600'
              : state === 'conformed'
                ? 'bg-accent-400'
                : 'bg-ink-200';
          return (
            <span
              key={`cell-${i}`}
              className={cx(base, color)}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Share bars */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Stubborn-minority share (stays tiny) */}
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-900">
              {minorityShareLabel}
            </span>
            <span className="font-mono font-semibold text-brand-700">
              {fmt(minorityShare)}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className={cx(
                'h-full rounded-pill bg-brand-600',
                reduced ? '' : 'transition-[width] duration-300',
              )}
              style={{ width: `${minorityShare}%` }}
            />
          </div>
        </div>

        {/* Conforming share (rockets to ~100%) */}
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-900">
              {conformShareLabel}
            </span>
            <span className="font-mono font-semibold text-brand-700">
              {fmt(conformShare)}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className={cx(
                'h-full rounded-pill',
                reduced ? '' : 'transition-[width] duration-300',
              )}
              style={{ width: `${conformShare}%`, background: conformBarColor }}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:max-w-xs sm:flex-1">
          <label
            htmlFor={`${id}-minority`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{minorityLabel}</span>
            <span className="font-mono text-ink-900">{minorityPct}%</span>
          </label>
          <input
            id={`${id}-minority`}
            type="range"
            min={1}
            max={15}
            step={1}
            value={minorityPct}
            onChange={(e) => setMinorityPct(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={spread}
            disabled={done}
            className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {spreadLabel}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {resetLabel}
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>

      <span className="sr-only" id={`${id}-status`} aria-live="polite">
        {`${scaleLabel}: ${currentScale}. ${minorityShareLabel}: ${fmt(
          minorityShare,
        )}. ${conformShareLabel}: ${fmt(conformShare)}.${
          done ? ' Everything now conforms.' : ''
        }`}
      </span>
    </figure>
  );
}

export default MinorityRule;
