import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface KellyGrowthCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the win-probability slider. */
  probabilityLabel?: string;
  /** Label for the payoff-odds slider. */
  oddsLabel?: string;
  /** Legend / curve label for the growth-rate line. */
  growthLabel?: string;
  /** Label for the edge readout. */
  edgeLabel?: string;
  /** Label for the Kelly-fraction readout. */
  kellyLabel?: string;
  /** Label for the max-growth-per-bet readout. */
  maxGrowthLabel?: string;
  /** Marker label for the Kelly-fraction (peak) line. */
  optimalMarkerLabel?: string;
  /** Marker label for the over-bet zero-crossing line. */
  zeroMarkerLabel?: string;
  /** Zone label: betting below Kelly. */
  underZoneLabel?: string;
  /** Zone label: betting above Kelly but still growing. */
  overZoneLabel?: string;
  /** Zone label: betting past the zero-crossing (negative growth). */
  ruinZoneLabel?: string;
  /** Message shown when there is no edge (f* ≤ 0). */
  noEdgeLabel?: string;
  /** X-axis caption (fraction of bankroll bet). */
  axisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial win probability as a fraction (0.5–0.8). Defaults to `0.6`. */
  probability?: number;
  /** Initial net payoff odds b (0.5–3). Defaults to `1`. */
  odds?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value * 100)}%`;

const signedPct = (value: number): string =>
  `${value >= 0 ? '+' : ''}${pct(value)}`;

/**
 * Interactive Kelly-criterion growth curve. For a binary bet — win `b` times the
 * stake with probability `p`, lose the stake with probability `q = 1 − p` — the
 * long-run compound growth rate per bet as a function of the fraction `f` of
 * bankroll wagered is `G(f) = p·ln(1 + b·f) + q·ln(1 − f)`. The curve is an
 * inverted hump: it rises from zero, peaks at the Kelly fraction `f*`, returns
 * to zero near `2·f*`, then dives to −∞ as `f → 1`. Drag the probability and
 * odds sliders and the curve, zone shading, peak marker and readouts update
 * live; the curve animates in on every change. Respects `prefers-reduced-motion`
 * (jumps straight to the final curve). If there is no edge (`f* ≤ 0`) it shows a
 * graceful "don't bet" state.
 */
export function KellyGrowthCurve({
  title = 'The Kelly growth curve',
  probabilityLabel = 'Win probability p',
  oddsLabel = 'Payoff odds b',
  growthLabel = 'Growth per bet G(f)',
  edgeLabel = 'Edge',
  kellyLabel = 'Kelly fraction f*',
  maxGrowthLabel = 'Max growth per bet',
  optimalMarkerLabel = 'optimal',
  zeroMarkerLabel = 'breaks even',
  underZoneLabel = 'under-betting',
  overZoneLabel = 'over-betting',
  ruinZoneLabel = 'ruin',
  noEdgeLabel = 'No edge — don’t bet.',
  axisLabel = 'Fraction of bankroll bet (f)',
  caption = 'Bet too little and you leave growth on the table; bet too much and volatility devours it. The peak — the Kelly fraction — is the single bet size that compounds your bankroll fastest. Past twice Kelly, growth goes negative: you go broke with probability 1.',
  probability = 0.6,
  odds = 1,
  className,
}: KellyGrowthCurveProps) {
  const id = useId();
  const [p, setP] = useState(probability);
  const [b, setB] = useState(odds);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padTop = 18;
  const padBottom = 30;

  const q = 1 - p;
  const edge = p * b - q;
  // Kelly fraction f* = p − q/b, clamped to [0, 1).
  const fStarRaw = p - q / b;
  const fStar = Math.max(0, fStarRaw);
  const hasEdge = fStarRaw > 0;

  // Domain of f shown on the x-axis. Clamp short of 1 to avoid the ln(1−f) pole.
  const F_MAX = 0.99;
  const F_CLAMP = 0.995; // hard guard inside ln(1 − f)

  const G = (f: number): number => {
    const fc = Math.min(f, F_CLAMP);
    return p * Math.log(1 + b * fc) + q * Math.log(1 - fc);
  };

  const maxGrowth = hasEdge ? G(fStar) : 0;

  // Over-bet zero-crossing: where G returns to 0 above f* (bisection).
  const findZeroCrossing = (): number => {
    if (!hasEdge) return 0;
    let lo = fStar;
    let hi = F_MAX;
    if (G(hi) > 0) return F_MAX; // never crosses within domain
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (G(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const fZero = findZeroCrossing();

  // Vertical scale: from the curve's max down to a sensible negative floor so
  // the dive past the zero-crossing is visible without the −∞ tail dominating.
  const gTop = Math.max(maxGrowth, 0.01);
  const gFloor = Math.min(G(F_MAX), -gTop, -0.02);
  const span = gTop - gFloor;

  const xOf = (f: number) => padX + (f / F_MAX) * (W - padX * 2);
  const yOf = (g: number) =>
    padTop + (1 - (Math.max(g, gFloor) - gFloor) / span) * (H - padTop - padBottom);

  const yZero = yOf(0);

  // Sample the curve, revealed left-to-right up to `progress`.
  const SAMPLES = 160;
  const curvePath = () => {
    const upto = progress * F_MAX;
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const f = (i / SAMPLES) * F_MAX;
      if (f > upto) break;
      d += `${d === '' ? 'M' : ' L'} ${xOf(f)} ${yOf(G(f))}`;
    }
    return d;
  };

  // Animate the curve drawing in whenever a parameter changes.
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
      const prog = Math.min(1, (ts - startTs) / duration);
      setProgress(prog);
      if (prog < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [p, b]);

  const pPctRounded = Math.round(p * 100);
  const bRounded = Math.round(b * 100) / 100;

  const ariaLabel = hasEdge
    ? `${title}: with a ${pPctRounded}% win chance at ${bRounded}-to-1 odds, growth peaks at a Kelly fraction of ${pct(
        fStar,
      )} of bankroll, giving ${signedPct(maxGrowth)} growth per bet; betting past ${pct(
        fZero,
      )} of bankroll turns growth negative.`
    : `${title}: with a ${pPctRounded}% win chance at ${bRounded}-to-1 odds there is no edge, so every bet size loses money in the long run — don't bet.`;

  return (
    <figure
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
            hasEdge ? 'bg-brand-600' : 'bg-ink-500',
          )}
        >
          {hasEdge ? `${kellyLabel}: ${pct(fStar)}` : noEdgeLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {growthLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-100" aria-hidden="true" />
          {optimalMarkerLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-100" aria-hidden="true" />
          {ruinZoneLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Zone shading (only meaningful when there is an edge) */}
        {hasEdge && (
          <>
            {/* under-betting: 0 → f* */}
            <rect
              x={xOf(0)}
              y={padTop}
              width={Math.max(0, xOf(fStar) - xOf(0))}
              height={H - padTop - padBottom}
              fill="var(--color-ink-200)"
              opacity={0.18}
            />
            {/* optimal: a narrow band centred on f* */}
            <rect
              x={xOf(Math.max(0, fStar - F_MAX * 0.025))}
              y={padTop}
              width={Math.max(0, xOf(Math.min(F_MAX, fStar + F_MAX * 0.025)) - xOf(Math.max(0, fStar - F_MAX * 0.025)))}
              height={H - padTop - padBottom}
              fill="var(--color-brand-500)"
              opacity={0.16}
            />
            {/* over-betting: f* → zero-crossing */}
            <rect
              x={xOf(fStar)}
              y={padTop}
              width={Math.max(0, xOf(fZero) - xOf(fStar))}
              height={H - padTop - padBottom}
              fill="var(--color-brand-500)"
              opacity={0.07}
            />
            {/* ruin: beyond the zero-crossing */}
            <rect
              x={xOf(fZero)}
              y={padTop}
              width={Math.max(0, xOf(F_MAX) - xOf(fZero))}
              height={H - padTop - padBottom}
              fill="var(--color-accent-500)"
              opacity={0.14}
            />
          </>
        )}

        {/* Zero-growth baseline */}
        <line
          x1={padX}
          y1={yZero}
          x2={W - padX}
          y2={yZero}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Peak (Kelly) marker */}
        {hasEdge && (
          <>
            <line
              x1={xOf(fStar)}
              y1={padTop}
              x2={xOf(fStar)}
              y2={H - padBottom}
              stroke="var(--color-brand-500)"
              strokeWidth={1.5}
            />
            <text
              x={xOf(fStar) + 4}
              y={padTop + 10}
              fill="var(--color-brand-700)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {optimalMarkerLabel} · {pct(fStar)}
            </text>
          </>
        )}

        {/* Over-bet zero-crossing marker (faint) */}
        {hasEdge && fZero < F_MAX && (
          <>
            <line
              x1={xOf(fZero)}
              y1={padTop}
              x2={xOf(fZero)}
              y2={H - padBottom}
              stroke="var(--color-ink-500)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={xOf(fZero) + 4}
              y={H - padBottom - 4}
              fill="var(--color-ink-500)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {zeroMarkerLabel} · {pct(fZero)}
            </text>
          </>
        )}

        {/* Growth curve, animated reveal */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis caption */}
        <text
          x={W / 2}
          y={H - 8}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {axisLabel}
        </text>

        {/* Zone tick labels along the bottom */}
        {hasEdge && (
          <>
            <text
              x={xOf(fStar / 2)}
              y={padTop + 22}
              textAnchor="middle"
              fill="var(--color-ink-500)"
              fontSize="9.5"
              fontFamily="var(--font-sans)"
            >
              {underZoneLabel}
            </text>
            <text
              x={xOf((fStar + fZero) / 2)}
              y={padTop + 22}
              textAnchor="middle"
              fill="var(--color-ink-500)"
              fontSize="9.5"
              fontFamily="var(--font-sans)"
            >
              {overZoneLabel}
            </text>
          </>
        )}
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-p`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{probabilityLabel}</span>
            <span className="font-mono text-ink-900">{pPctRounded}%</span>
          </label>
          <input
            id={`${id}-p`}
            type="range"
            min={50}
            max={80}
            step={1}
            value={pPctRounded}
            onChange={(e) => setP(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-b`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{oddsLabel}</span>
            <span className="font-mono text-ink-900">{bRounded.toFixed(2)}×</span>
          </label>
          <input
            id={`${id}-b`}
            type="range"
            min={50}
            max={300}
            step={5}
            value={Math.round(b * 100)}
            onChange={(e) => setB(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{edgeLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              edge >= 0 ? 'text-ink-900' : 'text-accent-600',
            )}
          >
            {signedPct(edge)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{kellyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(fStar)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maxGrowthLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {signedPct(maxGrowth)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default KellyGrowthCurve;
