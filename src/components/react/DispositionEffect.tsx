import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One holding in the portfolio. Positive `gainPct` = winner, negative = loser. */
export interface DispositionHolding {
  /** User-facing holding name (e.g. "Aurora Foods"). */
  name: string;
  /** Percentage move since purchase; positive = up (winner), negative = down (loser). */
  gainPct: number;
}

export interface DispositionEffectProps {
  /** Heading above the portfolio. */
  title?: string;
  /** One-line takeaway shown under the reveal. */
  caption?: string;
  /** The portfolio. Defaults to ~5 holdings mixing winners and losers. */
  holdings?: DispositionHolding[];
  /** Group label for up holdings. Defaults to `'Winners'`. */
  winnersLabel?: string;
  /** Group label for down holdings. Defaults to `'Losers'`. */
  losersLabel?: string;
  /** Action label for selling a holding. Defaults to `'Sell'`. */
  sellLabel?: string;
  /** Action label for holding a holding. Defaults to `'Hold'`. */
  holdLabel?: string;
  /** Bar label for the proportion of gains realised. Defaults to `'Share of winners cashed in'`. */
  pgrLabel?: string;
  /** Bar label for the proportion of losses realised. Defaults to `'Share of losers cashed in'`. */
  plrLabel?: string;
  /** Reveal button label. Defaults to `'Reveal the pattern'`. */
  revealLabel?: string;
  /** The rational caveat shown after the reveal. */
  rationalNote?: string;
  /** Prefix for the per-holding instruction line. Defaults to `'Will you sell or hold?'`. */
  instructionLabel?: string;
  /** Label that introduces the human-pattern data block. Defaults to `'What investors actually do'`. */
  dataHeading?: string;
  /** Label that introduces the learner's own choices. Defaults to `'Your calls'`. */
  yourCallsHeading?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Decision = 'sell' | 'hold' | null;

/**
 * Interactive demonstration of the **disposition effect** — investors realise
 * winners at a much higher rate than losers. The learner is shown a small
 * portfolio (a mix of holdings that are up and down since purchase) and taps
 * **Sell** or **Hold** on each (fully keyboard-accessible). Hitting *Reveal*
 * compares the typical human pattern against the field data: the **Proportion of
 * Gains Realised (PGR)** runs about **1.5×** the **Proportion of Losses Realised
 * (PLR)** (Odean, 1998) — people cash in winners and cling to losers. A caveat
 * note flags why that is usually a double mistake (the tax cost of realising
 * gains early, and that the winners sold historically went on to beat the losers
 * kept). The PGR/PLR bars animate their width in on reveal and respect
 * `prefers-reduced-motion` (jumping straight to the final state). SSR-safe: no
 * randomness during render.
 */
export function DispositionEffect({
  title = 'Sell the winners, marry the losers?',
  caption = 'Across hundreds of thousands of real accounts, investors cashed in their winners about 1.5× as often as they sold their losers — and the winners they dumped went on to beat the losers they kept. Selling winners and clinging to losers feels right and is usually wrong.',
  holdings,
  winnersLabel = 'Winners',
  losersLabel = 'Losers',
  sellLabel = 'Sell',
  holdLabel = 'Hold',
  pgrLabel = 'Share of winners cashed in',
  plrLabel = 'Share of losers cashed in',
  revealLabel = 'Reveal the pattern',
  rationalNote = 'The rational move: ignore your purchase price and ask only "would I buy this today?". Selling winners early triggers a tax bill you could have deferred, and the disposition effect data shows the winners investors sold went on to outperform the losers they held — so the instinct costs you twice.',
  instructionLabel = 'Will you sell or hold each one?',
  dataHeading = 'What investors actually do',
  yourCallsHeading = 'Your calls',
  className,
}: DispositionEffectProps) {
  const id = useId();
  const reduced = prefersReducedMotion();

  const defaultHoldings: DispositionHolding[] = [
    { name: 'Aurora Foods', gainPct: 34 },
    { name: 'Helios Energy', gainPct: -28 },
    { name: 'Northwind Rail', gainPct: 19 },
    { name: 'Vela Biotech', gainPct: -41 },
    { name: 'Cobalt Software', gainPct: 12 },
  ];

  const rows = holdings ?? defaultHoldings;

  const [decisions, setDecisions] = useState<Decision[]>(() =>
    rows.map(() => null),
  );
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState(0); // 0 → 1 (bar grow-in on reveal)
  const rafRef = useRef<number | null>(null);

  // Reset state if the dataset changes.
  useEffect(() => {
    setDecisions(rows.map(() => null));
    setRevealed(false);
    setProgress(0);
  }, [rows.length]);

  // Animate the PGR/PLR bars when the reveal happens.
  useEffect(() => {
    if (!revealed) return;
    if (reduced) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [revealed, reduced]);

  const setDecision = (index: number, value: Decision) => {
    setDecisions((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  };

  const allDecided = decisions.every((d) => d !== null);

  // The learner's own PGR / PLR, computed from their taps.
  const stats = useMemo(() => {
    let winners = 0;
    let winnersSold = 0;
    let losers = 0;
    let losersSold = 0;
    rows.forEach((row, i) => {
      const isWinner = row.gainPct >= 0;
      const sold = decisions[i] === 'sell';
      if (isWinner) {
        winners += 1;
        if (sold) winnersSold += 1;
      } else {
        losers += 1;
        if (sold) losersSold += 1;
      }
    });
    return {
      yourPgr: winners ? winnersSold / winners : 0,
      yourPlr: losers ? losersSold / losers : 0,
      winners,
      losers,
    };
  }, [rows, decisions]);

  // The field pattern (Odean 1998): PGR ≈ 1.5× PLR. Illustrative magnitudes.
  const fieldPgr = 0.6;
  const fieldPlr = 0.4;

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const bar = (
    key: string,
    label: string,
    value: number,
    accent: boolean,
  ) => {
    const width = value * 100 * (revealed ? progress : 0);
    return (
      <div key={key}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-700">{label}</span>
          <span className="font-mono text-sm font-semibold text-ink-900">
            {pct(value)}
          </span>
        </div>
        <div
          className="mt-1.5 h-3 w-full overflow-hidden rounded-pill bg-surface-sunken/60"
          role="presentation"
        >
          <div
            id={`${id}-${key}`}
            className={cx(
              'h-full rounded-pill transition-[width] duration-700 ease-out',
              accent ? 'bg-accent-500' : 'bg-brand-500',
            )}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <p className="mt-2 text-sm text-ink-600">{instructionLabel}</p>

      {/* The portfolio: one row per holding with Sell / Hold controls. */}
      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((row, i) => {
          const isWinner = row.gainPct >= 0;
          const decision = decisions[i];
          const groupLabel = isWinner ? winnersLabel : losersLabel;
          return (
            <li
              key={`${row.name}-${i}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-100 bg-surface-sunken/30 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-ink-900">{row.name}</span>
                <span
                  className="rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    color: isWinner
                      ? 'var(--color-success)'
                      : 'var(--color-danger)',
                    backgroundColor: isWinner
                      ? 'color-mix(in oklab, var(--color-success) 14%, transparent)'
                      : 'color-mix(in oklab, var(--color-danger) 14%, transparent)',
                  }}
                >
                  {isWinner ? '+' : ''}
                  {row.gainPct}% · {groupLabel}
                </span>
              </div>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label={`${row.name}, ${isWinner ? '+' : ''}${row.gainPct}% (${groupLabel}). ${instructionLabel}`}
              >
                <button
                  type="button"
                  onClick={() => setDecision(i, 'sell')}
                  aria-pressed={decision === 'sell'}
                  className={cx(
                    'rounded-pill border px-3.5 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    decision === 'sell'
                      ? 'border-brand-600 bg-brand-500 text-white shadow-soft'
                      : 'border-ink-100 bg-surface text-ink-800 hover:bg-surface-sunken/50',
                  )}
                >
                  {sellLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision(i, 'hold')}
                  aria-pressed={decision === 'hold'}
                  className={cx(
                    'rounded-pill border px-3.5 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    decision === 'hold'
                      ? 'border-accent-600 bg-accent-500 text-white shadow-soft'
                      : 'border-ink-100 bg-surface text-ink-800 hover:bg-surface-sunken/50',
                  )}
                >
                  {holdLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Reveal control */}
      {!revealed && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={!allDecided}
            className="rounded-pill border border-brand-600 bg-brand-500 px-5 py-1.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {revealLabel}
          </button>
        </div>
      )}

      {/* The reveal: the field pattern bars + the learner's own calls + caveat. */}
      {revealed && (
        <div className="mt-5 flex flex-col gap-5" aria-live="polite">
          <div className="rounded-card border border-ink-100 bg-surface-sunken/30 p-4">
            <p className="text-sm font-semibold text-ink-900">{dataHeading}</p>
            <div className="mt-3 flex flex-col gap-3">
              {bar('pgr', pgrLabel, fieldPgr, false)}
              {bar('plr', plrLabel, fieldPlr, true)}
            </div>
          </div>

          {(stats.winners > 0 || stats.losers > 0) && (
            <div className="rounded-card border border-ink-100 bg-surface-sunken/30 p-4">
              <p className="text-sm font-semibold text-ink-900">
                {yourCallsHeading}
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {stats.winners > 0 && bar('your-pgr', pgrLabel, stats.yourPgr, false)}
                {stats.losers > 0 && bar('your-plr', plrLabel, stats.yourPlr, true)}
              </div>
            </div>
          )}

          <p className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3 text-sm leading-relaxed text-ink-700">
            {rationalNote}
          </p>
        </div>
      )}

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DispositionEffect;
