import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One factor's premium within a regime. */
export interface FactorPremiumBar {
  /** Factor name, e.g. 'Value (HML)'. Comes from the lesson, so it stays locale-aware. */
  label: string;
  /** Average annual premium in the same unit as `unitLabel` (e.g. percent per year). Sign matters. */
  value: number;
}

/** A named sample/regime: a label plus one bar per factor. */
export interface FactorPremiumRegime {
  /** Regime name shown on its toggle button, e.g. 'Full sample'. */
  label: string;
  /** The factor bars for this regime. */
  bars: FactorPremiumBar[];
}

export interface FactorPremiumBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** One or more regimes. With a single regime the toggle is hidden. */
  regimes: FactorPremiumRegime[];
  /** Unit appended to every value, e.g. '% per year'. */
  unitLabel?: string;
  /** Index of the regime shown first. Defaults to `0`. */
  initialRegime?: number;
  /** Accessible label for the regime toggle group. */
  regimeGroupLabel?: string;
  /** Legend label for positive (right-extending) bars. */
  positiveLabel?: string;
  /** Legend label for negative (left-extending) bars. */
  negativeLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Format a signed value with at most one decimal and an explicit sign. */
const formatValue = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(1)}`;
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Animated horizontal bar chart comparing the historical average annual risk
 * premium of several factors. Each factor is a labelled row; positive premia
 * grow to the right of a centre axis (brand colour), negative premia grow to the
 * left (accent colour), so learners can read both magnitude and sign at a glance.
 *
 * When the chart scrolls into view the bars animate growing from zero. If two or
 * more regimes are supplied (e.g. 'Full sample' vs 'Recent decade'), a real
 * `<button>` toggle group switches between them and re-animates to the new
 * values — driving home that premia are noisy and regime-dependent.
 *
 * Fully locale-agnostic: factor names arrive via the `data`/`regimes` prop and
 * every other user-facing string is a prop with an English default. Respects
 * `prefers-reduced-motion` by rendering the final bars immediately.
 */
export function FactorPremiumBars({
  title = 'How big are the factor premia?',
  regimes,
  unitLabel = '% per year',
  initialRegime = 0,
  regimeGroupLabel = 'Sample period',
  positiveLabel = 'Positive premium',
  negativeLabel = 'Negative premium',
  caption,
  className,
}: FactorPremiumBarsProps) {
  const id = useId();
  const figureRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const safeRegimes = regimes.length > 0 ? regimes : [{ label: '', bars: [] }];
  const clampedInitial = Math.min(Math.max(initialRegime, 0), safeRegimes.length - 1);

  const [regimeIndex, setRegimeIndex] = useState(clampedInitial);
  const [progress, setProgress] = useState(0); // 0 → 1 (bar grow-in)
  const [hasAnimated, setHasAnimated] = useState(false);

  const activeRegime = safeRegimes[regimeIndex] ?? safeRegimes[0];
  const bars = activeRegime.bars;
  const showToggle = safeRegimes.length > 1;

  // Symmetric scale around zero so signs are comparable across regimes.
  const maxAbs = Math.max(
    1e-6,
    ...safeRegimes.flatMap((r) => r.bars.map((b) => Math.abs(b.value))),
  );

  // Run the grow-in animation (used both on first scroll-in and on regime change).
  const runAnimation = (): void => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 850;
    let startTs: number | null = null;
    const step = (ts: number): void => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(easeOutCubic(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // Trigger the first animation when the chart scrolls into view.
  useEffect(() => {
    if (hasAnimated) return;
    const node = figureRef.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      setProgress(1);
      setHasAnimated(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      runAnimation();
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runAnimation();
            setHasAnimated(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnimated]);

  // Re-animate to the new values whenever the regime changes (after first reveal).
  useEffect(() => {
    if (!hasAnimated) return;
    runAnimation();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regimeIndex]);

  // Clean up any in-flight frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Geometry.
  const W = 520;
  const rowH = 30;
  const rowGap = 14;
  const padX = 12;
  const padTop = 8;
  const labelW = 150; // left gutter for factor names
  const valueW = 64; // right gutter for the numeric readout
  const axisX = padX + labelW + (W - padX * 2 - labelW - valueW) / 2;
  const halfTrack = (W - padX * 2 - labelW - valueW) / 2;
  const H = padTop * 2 + bars.length * rowH + Math.max(0, bars.length - 1) * rowGap;

  const barTransition = 'none'; // width is driven by the RAF `progress`, not CSS.

  const summary = bars
    .map((b) => `${b.label}: ${formatValue(b.value)} ${unitLabel}`)
    .join('; ');

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
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {unitLabel}
        </span>
      </figcaption>

      {/* Regime toggle */}
      {showToggle ? (
        <div
          className="mt-4 inline-flex flex-wrap gap-1 rounded-pill bg-surface-sunken/60 p-1"
          role="group"
          aria-label={regimeGroupLabel}
        >
          {safeRegimes.map((regime, i) => {
            const isActive = i === regimeIndex;
            return (
              <button
                key={regime.label || i}
                type="button"
                aria-pressed={isActive}
                onClick={() => setRegimeIndex(i)}
                className={cx(
                  'rounded-pill px-3 py-1 text-sm font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  isActive
                    ? 'bg-brand-600 text-white shadow-soft'
                    : 'text-ink-700 hover:bg-surface',
                )}
              >
                {regime.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {positiveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {negativeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}${
          showToggle ? ` (${activeRegime.label})` : ''
        }. Average annual premium in ${unitLabel}: ${summary}.`}
      >
        {/* Centre / zero axis */}
        <line
          x1={axisX}
          y1={padTop - 2}
          x2={axisX}
          y2={H - padTop + 2}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {bars.map((bar, i) => {
          const y = padTop + i * (rowH + rowGap);
          const cy = y + rowH / 2;
          const positive = bar.value >= 0;
          const frac = Math.abs(bar.value) / maxAbs; // 0 → 1
          const fullW = frac * halfTrack;
          const w = fullW * progress;
          const barX = positive ? axisX : axisX - w;
          const valueX = padX + W - padX * 2 - valueW + 6;

          return (
            <g key={bar.label}>
              {/* Factor label */}
              <text
                x={padX}
                y={cy}
                dominantBaseline="middle"
                fontSize={13}
                fill="var(--color-ink-700)"
              >
                {bar.label}
              </text>
              {/* Bar */}
              <rect
                x={barX}
                y={y}
                width={Math.max(0, w)}
                height={rowH}
                rx={6}
                fill={positive ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
                style={{ transition: barTransition }}
              />
              {/* Numeric readout */}
              <text
                x={valueX}
                y={cy}
                dominantBaseline="middle"
                fontSize={13}
                fontFamily="var(--font-mono, monospace)"
                fontWeight={600}
                fill={positive ? 'var(--color-brand-700)' : 'var(--color-accent-600)'}
              >
                {formatValue(bar.value)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Text mirror of the bars, for screen readers + live updates on toggle. */}
      <dl
        className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        {bars.map((bar) => {
          const positive = bar.value >= 0;
          return (
            <div
              key={bar.label}
              className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2"
            >
              <dt className="text-ink-500">{bar.label}</dt>
              <dd
                className={cx(
                  'font-mono text-lg font-semibold',
                  positive ? 'text-brand-700' : 'text-accent-600',
                )}
              >
                {formatValue(bar.value)}{' '}
                <span className="text-xs font-normal text-ink-500">{unitLabel}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Identify the live region's regime for assistive tech. */}
      {showToggle ? (
        <p id={`${id}-regime`} className="sr-only">
          {regimeGroupLabel}: {activeRegime.label}
        </p>
      ) : null}

      {caption ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
      ) : null}
    </figure>
  );
}

export default FactorPremiumBars;
