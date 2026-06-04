import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EfficientFrontierProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the X axis (volatility). Defaults to `'Risk (volatility)'`. */
  riskLabel?: string;
  /** Label for the Y axis (expected return). Defaults to `'Expected return'`. */
  returnLabel?: string;
  /** Legend + curve label for the efficient (upper) arc. Defaults to `'Efficient frontier'`. */
  frontierLabel?: string;
  /** Legend + dot label for the minimum-variance portfolio. Defaults to `'Minimum-variance portfolio'`. */
  minVarLabel?: string;
  /** Legend label for the interior scatter cloud. Defaults to `'Feasible portfolios'`. */
  feasibleLabel?: string;
  /** Legend label for the dominated / lower-boundary region. Defaults to `'Inefficient (dominated)'`. */
  inefficientLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Deterministic 32-bit LCG (numerical-recipes constants). Seeded so the
 * scatter cloud is identical on the server and the client — no `Math.random`
 * at render time, so SSR and hydration never disagree.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// ── Modern Portfolio Theory bullet, modelled as a hyperbola in (σ, Er) space ──
// σ(Er) = sqrt( a·(Er − Er0)² + sMin² ).  The left branch is the bullet's nose;
// the upper arc (Er ≥ Er0) is the efficient frontier.
const ER0 = 9; // expected return of the minimum-variance portfolio (%)
const S_MIN = 12; // volatility of the minimum-variance portfolio (%)
const A = 1.6; // how fast risk grows away from the min-var return
const ER_LO = 4; // bottom of the return band (%)
const ER_HI = 16; // top of the return band (%)

/** Frontier volatility for a given expected return. */
const sigmaOf = (er: number): number => Math.sqrt(A * (er - ER0) * (er - ER0) + S_MIN * S_MIN);

/**
 * The efficient frontier of Modern Portfolio Theory, drawn as an interactive
 * MPT "bullet". Every achievable mix of assets is a point in risk–return
 * space; together they fill a solid feasible region (the muted scatter cloud).
 * The region's upper-left edge is the **efficient frontier** (strong brand
 * arc): for any level of risk, nothing beats it on return, and for any target
 * return, nothing beats it on (lower) risk. Its leftmost tip is the
 * **minimum-variance portfolio**. Everything strictly inside the cloud is
 * **dominated** — you could earn more for the same risk, or take less risk for
 * the same return — and the lower arc (returns below the min-var point) is the
 * inefficient boundary, shown dashed and muted.
 *
 * The learner drags a slider that walks a marker up the efficient arc, from
 * the minimum-variance tip to the top of the band, with live readouts of the
 * marker's expected return and risk. The marker tweens with an ease-out cubic
 * (~380ms), snapping instead if `prefers-reduced-motion` is set. The scatter
 * cloud is precomputed from a seeded LCG so server and client render the same
 * points. Locale-agnostic: every user-facing string is a prop.
 */
export function EfficientFrontier({
  title = 'The efficient frontier',
  riskLabel = 'Risk (volatility)',
  returnLabel = 'Expected return',
  frontierLabel = 'Efficient frontier',
  minVarLabel = 'Minimum-variance portfolio',
  feasibleLabel = 'Feasible portfolios',
  inefficientLabel = 'Inefficient (dominated)',
  caption = 'Every portfolio lives somewhere in the cloud, but only the upper-left edge is efficient: for a given risk you can’t do better on return. Anything strictly inside is dominated — same risk, less return.',
  className,
}: EfficientFrontierProps) {
  const id = useId();
  // Slider parameter t ∈ [0,1]: 0 = minimum-variance tip, 1 = top of the band.
  const [t, setT] = useState(0.55);
  // Animated parameter the marker renders against.
  const [shownT, setShownT] = useState(0.55);
  const rafRef = useRef<number | null>(null);

  // ── Chart geometry ──
  const W = 520;
  const H = 320;
  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Axis domains, with a little headroom so nothing clips.
  const sigMax = Math.ceil(sigmaOf(ER_HI) / 5) * 5 + 5; // ~30 → 35
  const sigMin = 0;
  const retMin = 0;
  const retMax = Math.ceil(ER_HI / 4) * 4; // 16

  const toPlotX = (sig: number): number => padL + ((sig - sigMin) / (sigMax - sigMin)) * plotW;
  const toPlotY = (er: number): number => padT + plotH - ((er - retMin) / (retMax - retMin)) * plotH;

  // ── Feasible scatter cloud (deterministic) ──
  // Each point sits at a random return in the band, with σ to the RIGHT of the
  // frontier (i.e. ≥ σ(Er)), up to a per-return cap so the cloud has a soft
  // outer edge resembling the union of many sub-portfolios.
  const cloud = useMemo(() => {
    const rng = makeRng(0x9e3779b1);
    const pts: Array<{ sig: number; er: number; dominated: boolean }> = [];
    for (let i = 0; i < 120; i++) {
      const er = ER_LO + rng() * (ER_HI - ER_LO);
      const sFront = sigmaOf(er);
      const sCap = sFront + 9 + 4 * rng(); // soft right edge
      // Bias toward the interior with a sqrt so the cloud isn't uniformly hollow.
      const sig = sFront + Math.sqrt(rng()) * (sCap - sFront);
      // "Dominated" = strictly inside (meaningfully right of the frontier).
      const dominated = sig > sFront + 0.8;
      pts.push({ sig, er, dominated });
    }
    return pts;
  }, []);

  // ── Frontier paths (upper = efficient, lower = inefficient) ──
  const { efficientPath, inefficientPath } = useMemo(() => {
    const upper: string[] = [];
    const lower: string[] = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const er = ER0 + (i / n) * (ER_HI - ER0);
      const px = toPlotX(sigmaOf(er)).toFixed(1);
      const py = toPlotY(er).toFixed(1);
      upper.push(`${i === 0 ? 'M' : 'L'}${px} ${py}`);
    }
    for (let i = 0; i <= n; i++) {
      const er = ER0 - (i / n) * (ER0 - ER_LO);
      const px = toPlotX(sigmaOf(er)).toFixed(1);
      const py = toPlotY(er).toFixed(1);
      lower.push(`${i === 0 ? 'M' : 'L'}${px} ${py}`);
    }
    return { efficientPath: upper.join(' '), inefficientPath: lower.join(' ') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Marker on the efficient arc ──
  const erAt = (param: number): number => ER0 + param * (ER_HI - ER0);
  const markerEr = erAt(t);
  const markerSig = sigmaOf(markerEr);
  const shownEr = erAt(shownT);
  const shownSig = sigmaOf(shownEr);
  const markerX = toPlotX(shownSig);
  const markerY = toPlotY(shownEr);

  // Animate the marker toward the new parameter whenever it changes.
  useEffect(() => {
    const target = t;
    if (prefersReducedMotion()) {
      setShownT(target);
      return;
    }
    const start = shownT;
    const delta = target - start;
    if (Math.abs(delta) < 0.001) {
      setShownT(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownT(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownT intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const pct = (v: number, digits = 1): string =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

  // Axis ticks.
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = retMax / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [retMax]);
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = sigMax / 5;
    for (let i = 0; i <= 5; i++) ticks.push(i * stepT);
    return ticks;
  }, [sigMax]);

  const minVarX = toPlotX(S_MIN);
  const minVarY = toPlotY(ER0);

  const ariaLabel = `${title}. ${feasibleLabel} fill a region in risk–return space; its upper-left edge is the ${frontierLabel}. The ${minVarLabel} sits at ${pct(
    S_MIN,
  )} ${riskLabel.toLowerCase()} and ${pct(ER0)} ${returnLabel.toLowerCase()}. Marker on the efficient frontier: ${returnLabel} ${pct(
    markerEr,
  )}, ${riskLabel} ${pct(markerSig)}.`;

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
          {pct(markerEr)} · {pct(markerSig)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {frontierLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              stroke="var(--color-ink-400)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          {inefficientLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="3" fill="var(--color-ink-300)" />
          </svg>
          {feasibleLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4" fill="var(--color-accent-500)" />
          </svg>
          {minVarLabel}
        </span>
      </div>

      {/* Risk–return scatter + frontier */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Y gridlines + ticks */}
        {yTicks.map((tk) => {
          const gy = toPlotY(tk);
          return (
            <g key={`y-${tk}`}>
              <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--color-ink-100)" strokeWidth={1} />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
                {`${tk.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* X gridlines + ticks */}
        {xTicks.map((tk) => {
          const gx = toPlotX(tk);
          return (
            <g key={`x-${tk}`}>
              <line
                x1={gx}
                y1={padT}
                x2={gx}
                y2={padT + plotH}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
                opacity={0.6}
              />
              <text x={gx} y={padT + plotH + 14} textAnchor="middle" fontSize="10" fill="var(--color-ink-400)">
                {`${tk.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* Feasible scatter cloud */}
        {cloud.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={toPlotX(p.sig)}
            cy={toPlotY(p.er)}
            r={2.6}
            fill={p.dominated ? 'var(--color-ink-300)' : 'var(--color-ink-400)'}
            opacity={p.dominated ? 0.55 : 0.75}
          />
        ))}

        {/* Inefficient (lower) boundary — dashed, muted */}
        <path
          d={inefficientPath}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Efficient frontier (upper arc) — strong brand */}
        <path
          d={efficientPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Minimum-variance portfolio */}
        <circle cx={minVarX} cy={minVarY} r={5.5} fill="var(--color-accent-500)" />
        <circle cx={minVarX} cy={minVarY} r={9} fill="none" stroke="var(--color-accent-500)" strokeWidth={1.5} opacity={0.5} />

        {/* Guide lines from marker to both axes */}
        <line
          x1={markerX}
          y1={markerY}
          x2={markerX}
          y2={padT + plotH}
          stroke="var(--color-brand-700)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.6}
        />
        <line
          x1={markerX}
          y1={markerY}
          x2={padL}
          y2={markerY}
          stroke="var(--color-brand-700)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.6}
        />

        {/* Marker on the efficient frontier */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-brand-700)" />
        <circle cx={markerX} cy={markerY} r={10} fill="none" stroke="var(--color-brand-700)" strokeWidth={1.5} opacity={0.5} />

        {/* X axis title */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {riskLabel}
        </text>

        {/* Y axis title */}
        <text
          x={13}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 13 ${padT + plotH / 2})`}
        >
          {returnLabel}
        </text>
      </svg>

      {/* Slider: walk the marker up the efficient frontier */}
      <div className="mt-3">
        <label htmlFor={`${id}-pos`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{frontierLabel}</span>
          <span className="font-mono text-ink-900">
            {pct(markerEr)} · {pct(markerSig)}
          </span>
        </label>
        <input
          id={`${id}-pos`}
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label={frontierLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{returnLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(markerEr)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(markerSig)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EfficientFrontier;
