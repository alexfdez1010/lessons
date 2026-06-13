import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface JensenConvexityBandProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the volatility (spread σ) slider. */
  spreadLabel?: string;
  /** Toggle option label for the convex (antifragile) payoff. */
  convexLabel?: string;
  /** Toggle option label for the concave (fragile) payoff. */
  concaveLabel?: string;
  /** Readout label for f(E[X]) — the payoff at the average input. */
  fOfMeanLabel?: string;
  /** Readout label for E[f(X)] — the expected payoff under volatility. */
  meanOfFLabel?: string;
  /** Readout label for the convexity bias (the gap). */
  gapLabel?: string;
  /** Legend label for the payoff curve f(x). */
  curveLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}`;

/**
 * Interactive picture of Jensen's inequality — the quantitative heart of
 * antifragility. It plots a payoff curve f(x) over a symmetric input axis and
 * lets you toggle between a **convex** payoff (f(x)=x², bending up) and a
 * **concave** one (f(x)=−x², bending down). The mean input E[X] sits at the
 * centre (0); a "volatility (spread σ)" slider opens a symmetric band to inputs
 * −σ and +σ, projects them up to the curve, and draws two horizontal reference
 * lines: f(E[X]) (the payoff at the average input) and E[f(X)] (the average of
 * the two outputs). The shaded gap between them is the convexity bias.
 *
 * For a convex f, E[f(X)] ≥ f(E[X]) and the gap opens **upward**; for a concave
 * f the inequality reverses and the gap opens **downward**. Widening σ (a
 * mean-preserving spread — more volatility, same average input) widens the gap:
 * volatility carries the sign of the second derivative, good for convex and bad
 * for concave. The band animates open on each σ change / toggle and respects
 * `prefers-reduced-motion` (jumps straight to the final band).
 */
export function JensenConvexityBand({
  title = 'Jensen’s inequality: volatility carries the sign of curvature',
  spreadLabel = 'Volatility (spread σ)',
  convexLabel = 'Convex (antifragile)',
  concaveLabel = 'Concave (fragile)',
  fOfMeanLabel = 'f(average) — payoff at the average input',
  meanOfFLabel = 'average of f — expected payoff with volatility',
  gapLabel = 'Convexity bias (gap)',
  curveLabel = 'Payoff curve f(x)',
  caption = 'Spread the input without changing its average and the curve does the rest: a convex payoff gains (the gap opens up), a concave payoff loses (the gap opens down). More volatility helps the convex and hurts the concave — that gap is the convexity bias.',
  className,
}: JensenConvexityBandProps) {
  const id = useId();
  const [convex, setConvex] = useState(true);
  const [sigmaState, setSigmaState] = useState(1.2);
  // Band open progress 0 → 1 (the two input points slide out from the centre).
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 260;
  const padX = 16;
  const padY = 18;

  const RANGE = 2; // x ∈ [−RANGE, RANGE]
  const SIGMA_MAX = 1.8; // band half-width cannot exceed the axis range

  // Payoff curve. Convex bends up (x²), concave bends down (−x²); both pass
  // through the origin so f(E[X]) = f(0) = 0 and the gap is purely curvature.
  const sign = convex ? 1 : -1;
  const f = (xv: number) => sign * xv * xv;

  // Vertical range spans the full curve plus a little headroom on the open side.
  const lowest = Math.min(f(0), f(RANGE)); // 0 (convex) or −4 (concave)
  const highest = Math.max(f(0), f(RANGE)); // +4 (convex) or 0 (concave)
  const vMin = lowest - 0.4;
  const vMax = highest + 0.4;

  const x = (xv: number) => padX + ((xv + RANGE) / (2 * RANGE)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - vMin) / (vMax - vMin)) * (H - padY * 2);

  const sigma = sigmaState;
  const sigmaAnim = sigma * progress;

  // f(E[X]) — average input is 0, so this is f(0) = 0 (the curve passes there).
  const fOfMean = f(0);
  // E[f(X)] — average of the two symmetric outputs f(−σ) and f(+σ); since the
  // curve is even, both equal f(σ), so the mean is just f(σ).
  const meanOfF = (f(-sigma) + f(sigma)) / 2;
  const gap = meanOfF - fOfMean; // = f(σ); positive for convex, negative for concave.

  const meanOfFAnim = (f(-sigmaAnim) + f(sigmaAnim)) / 2;

  // The payoff curve, sampled smoothly across the full input axis.
  const SAMPLES = 90;
  const curvePath = (() => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const xv = -RANGE + (i / SAMPLES) * (2 * RANGE);
      d += `${i === 0 ? 'M' : 'L'} ${x(xv)} ${y(f(xv))}`;
    }
    return d;
  })();

  // Animate the band opening on each σ change / curve toggle.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
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
  }, [sigmaState, convex]);

  const centreX = x(0);
  const leftX = x(-sigmaAnim);
  const rightX = x(sigmaAnim);
  const baseY = y(fOfMean); // f(E[X]) reference line height
  const meanFY = y(meanOfFAnim); // E[f(X)] reference line height
  const curveLeftY = y(f(-sigmaAnim));
  const curveRightY = y(f(sigmaAnim));

  const bandOpen = sigmaAnim > 1e-3;
  // Vertical span of the convexity-bias gap (between the two reference lines).
  const gapTop = Math.min(baseY, meanFY);
  const gapHeight = Math.abs(meanFY - baseY);

  const gapTone = convex ? 'text-brand-700' : 'text-accent-600';

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
          σ {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(sigma)}
        </span>
      </figcaption>

      {/* Convex / concave toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-1"
        role="group"
        aria-label={`${convexLabel} / ${concaveLabel}`}
      >
        <button
          type="button"
          aria-pressed={convex}
          onClick={() => setConvex(true)}
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            convex ? 'bg-brand-600 text-white' : 'text-ink-700 hover:text-ink-900',
          )}
        >
          {convexLabel}
        </button>
        <button
          type="button"
          aria-pressed={!convex}
          onClick={() => setConvex(false)}
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            !convex ? 'bg-accent-600 text-white' : 'text-ink-700 hover:text-ink-900',
          )}
        >
          {concaveLabel}
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className={cx('h-1 w-5 rounded-pill', convex ? 'bg-brand-500' : 'bg-accent-500')}
            aria-hidden="true"
          />
          {curveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
          {fOfMeanLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className={cx('h-1 w-5 rounded-pill', convex ? 'bg-brand-300' : 'bg-accent-300')}
            aria-hidden="true"
          />
          {meanOfFLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. The payoff is ${
          convex ? convexLabel : concaveLabel
        }. With a spread of σ ${new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 2,
        }).format(sigma)} around the average input, f(average) is ${num(
          fOfMean,
        )} while the average of f is ${num(meanOfF)} — a convexity bias of ${num(
          gap,
        )} (${gap >= 0 ? 'positive, the gap opens up' : 'negative, the gap opens down'}).`}
      >
        {/* Vertical guide at the average input E[X] = 0 */}
        <line
          x1={centreX}
          y1={padY}
          x2={centreX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Volatility band: shaded interval [−σ, +σ] around the mean input */}
        {bandOpen && (
          <rect
            x={leftX}
            y={padY}
            width={Math.max(0, rightX - leftX)}
            height={H - padY * 2}
            fill="var(--color-ink-400)"
            opacity={0.1}
          />
        )}

        {/* Convexity-bias gap: shaded span between the two reference lines */}
        {bandOpen && gapHeight > 0.5 && (
          <rect
            x={centreX - 7}
            y={gapTop}
            width={14}
            height={gapHeight}
            fill={convex ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
            opacity={0.28}
          />
        )}

        {/* f(E[X]) reference line — payoff at the average input */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        {/* E[f(X)] reference line — average of the two outputs */}
        <line
          x1={padX}
          y1={meanFY}
          x2={W - padX}
          y2={meanFY}
          stroke={convex ? 'var(--color-brand-400)' : 'var(--color-accent-400)'}
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Projection lines: inputs ±σ up to the curve, then in to the mean line */}
        {bandOpen && (
          <g stroke="var(--color-ink-500)" strokeWidth={1.5} strokeDasharray="3 3" fill="none">
            <line x1={leftX} y1={H - padY} x2={leftX} y2={curveLeftY} />
            <line x1={rightX} y1={H - padY} x2={rightX} y2={curveRightY} />
            <line x1={leftX} y1={curveLeftY} x2={centreX} y2={meanFY} />
            <line x1={rightX} y1={curveRightY} x2={centreX} y2={meanFY} />
          </g>
        )}

        {/* The payoff curve f(x) */}
        <path
          d={curvePath}
          fill="none"
          stroke={convex ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* f(E[X]) marker — on the curve at the average input */}
        <circle cx={centreX} cy={baseY} r={4} fill="var(--color-ink-500)" />

        {/* Output markers on the curve at the two band edges */}
        {bandOpen && (
          <>
            <circle
              cx={leftX}
              cy={curveLeftY}
              r={5}
              fill="var(--color-surface)"
              stroke={convex ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
              strokeWidth={2.5}
            />
            <circle
              cx={rightX}
              cy={curveRightY}
              r={5}
              fill="var(--color-surface)"
              stroke={convex ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
              strokeWidth={2.5}
            />
            {/* E[f(X)] marker on the mean-of-f line, centred over the mean input */}
            <circle
              cx={centreX}
              cy={meanFY}
              r={6}
              fill={convex ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
            />
          </>
        )}
      </svg>

      {/* Spread slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{spreadLabel}</span>
          <span className="font-mono text-ink-900">
            σ {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(sigma)}
          </span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={0}
          max={Math.round(SIGMA_MAX * 100)}
          step={1}
          value={Math.round(sigma * 100)}
          onChange={(e) => setSigmaState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fOfMeanLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{num(fOfMean)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{meanOfFLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              convex ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {num(meanOfF)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', gapTone)}>{num(gap)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default JensenConvexityBand;
