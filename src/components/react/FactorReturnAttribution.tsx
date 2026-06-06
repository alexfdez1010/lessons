import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single factor's contribution to total excess return (loading × premium). */
export interface FactorContribution {
  /** Locale-agnostic factor name (e.g. "Market", "Size", "Value"). */
  label: string;
  /** Contribution to excess return, in the same unit as `unitLabel`. */
  value: number;
}

export interface FactorReturnAttributionProps {
  /** Heading above the visual. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Factor contributions (each = factor loading × factor premium). */
  contributions: FactorContribution[];
  /** Leftover return not explained by factors — the true alpha. */
  alpha: number;
  /** Label for the alpha segment. Defaults to `'Alpha (unexplained)'`. */
  alphaLabel?: string;
  /** Label for the total-return readout. Defaults to `'Total excess return'`. */
  totalLabel?: string;
  /** Unit suffix shown after every value. Defaults to `'% / yr'`. */
  unitLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value))}`;
};

/** Fixed brand-tinted palette for factor segments (design tokens, cycles). */
const FACTOR_FILLS = [
  'var(--color-brand-600)',
  'var(--color-brand-500)',
  'var(--color-brand-400)',
  'var(--color-brand-300)',
  'var(--color-accent-400)',
  'var(--color-accent-300)',
] as const;

interface ResolvedSegment {
  key: string;
  label: string;
  value: number;
  fill: string;
  /** True for the trailing alpha segment. */
  isAlpha: boolean;
}

/**
 * Return-attribution visual. A portfolio's total excess return is decomposed
 * into stacked contributions from each risk factor (each contribution =
 * factor loading × factor premium) plus a final residual **alpha** segment —
 * the part no factor explains. Rendered as one horizontal stacked bar whose
 * widths are proportional to the absolute size of each contribution; the alpha
 * segment is visually distinct (highlighted when positive, warning/red when
 * negative). When the figure scrolls into view, the segments reveal
 * left-to-right like a waterfall.
 *
 * The teaching point: a big-looking return is mostly factor exposure you could
 * have bought cheaply, and the true alpha is the small leftover. All numbers
 * come from props (a worked example), so the same figure teaches any scenario.
 * Respects `prefers-reduced-motion` (jumps straight to the final state).
 */
export function FactorReturnAttribution({
  title = 'Where the return really came from',
  caption =
    'Most of a strategy’s excess return is just factor exposure — beta you could rent cheaply. Subtract every factor’s contribution (loading × premium) and what’s left is alpha: the part no factor explains. Usually it’s the smallest slice on the bar.',
  contributions,
  alpha,
  alphaLabel = 'Alpha (unexplained)',
  totalLabel = 'Total excess return',
  unitLabel = '% / yr',
  className,
}: FactorReturnAttributionProps) {
  const id = useId();
  const figureRef = useRef<HTMLElement | null>(null);
  /** How many segments (left-to-right) have revealed so far. */
  const [revealed, setRevealed] = useState(0);

  const segments: ResolvedSegment[] = [
    ...contributions.map((c, i) => ({
      key: `${id}-f${i}`,
      label: c.label,
      value: c.value,
      fill: FACTOR_FILLS[i % FACTOR_FILLS.length],
      isAlpha: false,
    })),
    {
      key: `${id}-alpha`,
      label: alphaLabel,
      value: alpha,
      fill:
        alpha >= 0 ? 'var(--color-accent-500)' : 'var(--color-accent-600)',
      isAlpha: true,
    },
  ];

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Width scale uses absolute magnitudes so positive and negative parts both
  // get visible room on the single bar.
  const scale =
    segments.reduce((sum, s) => sum + Math.abs(s.value), 0) || 1;

  // Waterfall reveal: when the figure scrolls into view, count segments in
  // left-to-right. Reduced motion → show everything immediately.
  useEffect(() => {
    const node = figureRef.current;
    const totalSegments = segments.length;

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setRevealed(totalSegments);
      return;
    }

    let timers: number[] = [];
    let started = false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            for (let i = 1; i <= totalSegments; i += 1) {
              const t = window.setTimeout(() => setRevealed(i), i * 260);
              timers.push(t);
            }
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );

    if (node) observer.observe(node);

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
    // Re-run if the segment count changes (new data set).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

  const totalIsNegative = total < 0;
  const totalText = totalIsNegative ? 'text-accent-700' : 'text-brand-700';
  const totalBadgeBg = totalIsNegative ? 'bg-accent-600' : 'bg-brand-600';
  const alphaIsNegative = alpha < 0;

  const summary = `${segments
    .filter((s) => !s.isAlpha)
    .map((s) => `${s.label} ${num(s.value)} ${unitLabel}`)
    .join(', ')}, and ${alphaLabel} ${num(alpha)} ${unitLabel}, for a ${totalLabel.toLowerCase()} of ${num(
    total,
  )} ${unitLabel}.`;

  return (
    <figure
      ref={figureRef}
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            totalBadgeBg,
          )}
        >
          {totalLabel}: {num(total)} {unitLabel}
        </span>
      </figcaption>

      {/* Stacked attribution bar — widths proportional to |contribution|. */}
      <div
        role="img"
        aria-label={summary}
        className="mt-5 flex h-12 w-full overflow-hidden rounded-card border border-ink-100 bg-surface-sunken/40"
      >
        {segments.map((seg, i) => {
          const widthPct = (Math.abs(seg.value) / scale) * 100;
          const isRevealed = i < revealed;
          return (
            <div
              key={seg.key}
              className={cx(
                'flex items-center justify-center transition-[opacity,transform] duration-500 ease-out',
                seg.isAlpha && 'border-l border-surface/60',
              )}
              style={{
                width: `${widthPct}%`,
                background: seg.fill,
                opacity: isRevealed ? 1 : 0,
                transform: isRevealed ? 'translateX(0)' : 'translateX(-8px)',
              }}
              aria-hidden="true"
            >
              {widthPct >= 9 && (
                <span className="truncate px-2 font-mono text-xs font-semibold text-white">
                  {num(seg.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-segment legend / readouts. */}
      <ul className="mt-5 flex flex-col gap-2.5">
        {segments.map((seg) => (
          <li
            key={`${seg.key}-row`}
            className={cx(
              'flex items-baseline justify-between gap-3',
              seg.isAlpha && 'mt-1 border-t border-ink-100 pt-3',
            )}
          >
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <span
                className="h-3 w-3 shrink-0 rounded-pill"
                style={{ background: seg.fill }}
                aria-hidden="true"
              />
              <span className={cx(seg.isAlpha && 'font-medium text-ink-900')}>
                {seg.label}
              </span>
            </span>
            <span
              className={cx(
                'font-mono text-sm font-semibold',
                seg.isAlpha
                  ? alphaIsNegative
                    ? 'text-accent-700'
                    : 'text-accent-600'
                  : 'text-ink-700',
              )}
            >
              {num(seg.value)} {unitLabel}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
          <span className="text-sm font-medium text-ink-900">{totalLabel}</span>
          <span className={cx('font-mono text-base font-bold', totalText)}>
            {num(total)} {unitLabel}
          </span>
        </li>
      </ul>

      {/* Screen-reader live region for the worked-example breakdown. */}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FactorReturnAttribution;
