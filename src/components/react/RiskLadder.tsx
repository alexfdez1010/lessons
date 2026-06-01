import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One step on the risk/return ladder. */
export interface RiskLadderRung {
  /** Stable key for React. */
  key: string;
  /** User-facing asset-class name (e.g. "Stocks"). */
  label: string;
  /** Relative risk, `0..1`, scales the risk bar's width. */
  risk: number;
  /** Relative potential return, `0..1`, scales the return bar's width. */
  return: number;
  /** Qualitative level word shown as a badge (e.g. "low", "high"). */
  level: string;
}

export interface RiskLadderProps {
  /** Heading above the ladder. */
  title?: string;
  /** One-line takeaway shown under the ladder. */
  caption?: string;
  /** Legend word for the risk bar. Defaults to `'Risk'`. */
  riskLabel?: string;
  /** Legend word for the return bar. Defaults to `'Return'`. */
  returnLabel?: string;
  /** Qualitative word for the lowest tier. Defaults to `'low'`. */
  lowLabel?: string;
  /** Qualitative word for the middle tier. Defaults to `'medium'`. */
  mediumLabel?: string;
  /** Qualitative word for the high tier. Defaults to `'high'`. */
  highLabel?: string;
  /** Qualitative word for the top tier. Defaults to `'very high'`. */
  veryHighLabel?: string;
  /**
   * The rungs, bottom (calm) to top (wild). Defaults to a six-row dataset:
   * Cash → Savings account → Government bonds → Corporate bonds → Stocks →
   * Crypto. Pass your own (with translated labels/levels) to override every
   * string.
   */
  rungs?: RiskLadderRung[];
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Static comparison ladder showing the single most important trade-off in
 * investing: *higher potential return comes with higher risk*. Each asset class
 * is one rung, ordered from the calm bottom (cash) to the wild top (crypto).
 * Every rung carries two thin horizontal bars — one for **risk**, one for
 * **return** — whose widths grow together as you climb, so a beginner *sees*
 * that the two rise in lockstep. A qualitative badge ("low" → "very high")
 * labels each tier; there are no percentages, because the point is the
 * relationship, not the numbers. Bars animate their width in on mount and
 * respect `prefers-reduced-motion` (jumping straight to the final state).
 * Non-interactive by design — it's a comparison ladder, not a calculator.
 */
export function RiskLadder({
  title = 'The risk–return ladder',
  caption =
    'Climb the ladder and both bars grow together: the assets that can pay the most are also the ones that can swing — or sink — the hardest. There is no free lunch where high return meets low risk.',
  riskLabel = 'Risk',
  returnLabel = 'Return',
  lowLabel = 'low',
  mediumLabel = 'medium',
  highLabel = 'high',
  veryHighLabel = 'very high',
  rungs,
  className,
}: RiskLadderProps) {
  const id = useId();
  const [progress, setProgress] = useState(1); // 0 → 1 (bar grow-in)
  const rafRef = useRef<number | null>(null);

  const defaultRungs: RiskLadderRung[] = [
    { key: 'cash', label: 'Cash', risk: 0.05, return: 0.05, level: lowLabel },
    {
      key: 'savings',
      label: 'Savings account',
      risk: 0.12,
      return: 0.14,
      level: lowLabel,
    },
    {
      key: 'gov-bonds',
      label: 'Government bonds',
      risk: 0.3,
      return: 0.32,
      level: mediumLabel,
    },
    {
      key: 'corp-bonds',
      label: 'Corporate bonds',
      risk: 0.48,
      return: 0.5,
      level: mediumLabel,
    },
    {
      key: 'stocks',
      label: 'Stocks',
      risk: 0.74,
      return: 0.78,
      level: highLabel,
    },
    {
      key: 'crypto',
      label: 'Crypto',
      risk: 1,
      return: 1,
      level: veryHighLabel,
    },
  ];

  // Top (wild) first so the rendered ladder climbs upward visually.
  const rows = [...(rungs ?? defaultRungs)].reverse();

  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

  // Animate the bars growing in on mount.
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
  }, [rungs]);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="flex flex-wrap items-center gap-3 text-sm text-ink-700">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-1.5 w-5 rounded-pill bg-accent-500"
              aria-hidden="true"
            />
            {riskLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-1.5 w-5 rounded-pill bg-brand-500"
              aria-hidden="true"
            />
            {returnLabel}
          </span>
        </span>
      </figcaption>

      <ul
        className="mt-4 flex flex-col gap-4"
        aria-live="polite"
        aria-label={`${title}: asset classes climbing from low to very high in both ${riskLabel.toLowerCase()} and ${returnLabel.toLowerCase()}, shown as paired bars per row.`}
      >
        {rows.map((row) => {
          const riskWidth = clamp01(row.risk) * 100 * progress;
          const returnWidth = clamp01(row.return) * 100 * progress;
          return (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink-900">{row.label}</span>
                <span className="rounded-pill bg-surface-sunken px-3 py-0.5 text-xs font-medium text-ink-700">
                  {row.level}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-right text-xs text-ink-500">
                    {riskLabel}
                  </span>
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken/60"
                    role="presentation"
                  >
                    <div
                      id={`${id}-${row.key}-risk`}
                      className="h-full rounded-pill bg-accent-500 transition-[width] duration-700 ease-out"
                      style={{ width: `${riskWidth}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-right text-xs text-ink-500">
                    {returnLabel}
                  </span>
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken/60"
                    role="presentation"
                  >
                    <div
                      id={`${id}-${row.key}-return`}
                      className="h-full rounded-pill bg-brand-500 transition-[width] duration-700 ease-out"
                      style={{ width: `${returnWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RiskLadder;
