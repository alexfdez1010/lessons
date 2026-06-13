import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CdsIndexBasisProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the intrinsic (constituent-average) spread readout + reference line. */
  intrinsicLabel?: string;
  /** Label for the traded index spread readout + reference line. */
  tradedLabel?: string;
  /** Label for the basis (traded − intrinsic) readout. */
  basisLabel?: string;
  /** Label for the number-of-names readout. */
  namesLabel?: string;
  /** Label for the demand / technicals slider. */
  demandLabel?: string;
  /** Toggle label for the tight, investment-grade-like constituent set. */
  igPresetLabel?: string;
  /** Toggle label for the wide, high-yield-like constituent set. */
  hyPresetLabel?: string;
  /** Label for the spread (x) axis. */
  spreadAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to basis-point values. Defaults to `' bp'`. */
  bpSuffix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bp = (value: number, suffix: string): string =>
  `${Math.round(value)}${suffix}`;

const signedBp = (value: number, suffix: string): string =>
  `${value >= 0 ? '+' : ''}${Math.round(value)}${suffix}`;

// Representative single-name CDS spreads (bp) for each preset. ~12 names,
// sorted ascending so the bars step up cleanly toward the wide end.
const IG_SPREADS = [22, 31, 38, 45, 52, 57, 63, 69, 76, 84, 95, 118];
const HY_SPREADS = [180, 230, 270, 305, 330, 345, 360, 380, 410, 450, 520, 640];

/**
 * CDS index intrinsic-vs-traded **basis (skew)**. A CDS index — like CDX.NA.IG
 * with 125 names — trades as a single spread on the whole basket, but its
 * **intrinsic** (theoretical) spread is just the average of the single-name CDS
 * spreads of the names inside it. The gap between the two is the **index basis
 * (skew) = traded − intrinsic**: small but non-zero, opened up by liquidity and
 * technical flows, and arbitraged by the index desk.
 *
 * This island draws ~12 representative constituent spreads as horizontal bars
 * (sorted), overlays a dashed reference line at the **intrinsic average** and a
 * solid line at the **traded index spread**, and annotates the distance between
 * them as the basis. A "demand / technicals" slider shifts the traded spread
 * away from intrinsic so the basis visibly opens up (positive = index trades
 * wider than intrinsic), and an IG-like / HY-like preset toggle swaps the
 * constituent set between tight and wide. Bars rise on mount and on every
 * change; respects `prefers-reduced-motion` (jumps straight to the final state).
 */
export function CdsIndexBasis({
  title = 'CDS index basis: traded vs intrinsic',
  intrinsicLabel = 'Intrinsic (average of names)',
  tradedLabel = 'Traded index spread',
  basisLabel = 'Index basis (traded − intrinsic)',
  namesLabel = 'Names in basket',
  demandLabel = 'Index demand / technicals',
  igPresetLabel = 'IG-like',
  hyPresetLabel = 'HY-like',
  spreadAxisLabel = 'Single-name CDS spread (bp)',
  caption = 'The index is one tradable spread on a whole basket of names. Compare it to the average of the single-name spreads inside — the difference is the basis (skew) the index desk arbitrages. A positive basis means the index trades wider than its intrinsic value.',
  bpSuffix = ' bp',
  className,
}: CdsIndexBasisProps) {
  const id = useId();

  const [preset, setPreset] = useState<'ig' | 'hy'>('ig');
  const [demand, setDemand] = useState(0); // signed bp shift, −15..+15
  const [progress, setProgress] = useState(1); // 0 → 1 (bars rise-in)
  const rafRef = useRef<number | null>(null);

  const spreads = preset === 'ig' ? IG_SPREADS : HY_SPREADS;
  const names = spreads.length;
  // Intrinsic = (duration-weighted) average of the constituent spreads. We use
  // a plain average here, which is the right intuition for equal-duration names.
  const intrinsic = spreads.reduce((sum, s) => sum + s, 0) / names;
  const traded = intrinsic + demand;
  const basis = traded - intrinsic; // === demand, but computed for clarity

  // --- Chart geometry -------------------------------------------------------
  const W = 520;
  const padL = 120; // room for name labels
  const padR = 22;
  const padTop = 16;
  const rowGap = 6;
  const barH = 14;
  const plotW = W - padL - padR;
  const rowH = barH + rowGap;
  const plotTop = padTop;
  const plotBottom = plotTop + names * rowH;
  const axisY = plotBottom + 4;
  const H = axisY + 34;

  // X scale: 0 → axisMax bp across the plot width. Headroom above the widest of
  // {widest name, traded, intrinsic} so reference lines never clip.
  const axisMax =
    Math.max(spreads[names - 1], traded, intrinsic) * 1.12 + 1;
  const xOf = (value: number) => padL + (value / axisMax) * plotW;

  // Animate bars rising whenever inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [preset]);

  // Reveal bars top-to-bottom.
  const barReveal = (i: number) => {
    if (names <= 1) return progress;
    const start = i / names;
    const end = (i + 1) / names;
    if (progress <= start) return 0;
    if (progress >= end) return 1;
    return (progress - start) / (end - start);
  };

  const intrinsicX = xOf(intrinsic);
  const tradedX = xOf(traded);

  const ariaLabel =
    `${title}: a basket of ${names} single-name CDS spreads averages an intrinsic spread of ` +
    `${bp(intrinsic, bpSuffix)}, while the index itself trades at ${bp(traded, bpSuffix)}, ` +
    `for an index basis of ${signedBp(basis, bpSuffix)} ` +
    `(${basis >= 0 ? 'index wider than' : 'index tighter than'} intrinsic).`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div
          className="inline-flex rounded-pill border border-ink-200 bg-surface-sunken/40 p-0.5"
          role="group"
          aria-label={`${igPresetLabel} / ${hyPresetLabel}`}
        >
          <button
            type="button"
            onClick={() => setPreset('ig')}
            aria-pressed={preset === 'ig'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              preset === 'ig'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {igPresetLabel}
          </button>
          <button
            type="button"
            onClick={() => setPreset('hy')}
            aria-pressed={preset === 'hy'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              preset === 'hy'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {hyPresetLabel}
          </button>
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-400"
            aria-hidden="true"
          />
          {spreadAxisLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="inline-block h-0 w-5 border-t-2 border-dashed border-ink-500" aria-hidden="true" />
          {intrinsicLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="inline-block h-0 w-5 border-t-2 border-accent-500" aria-hidden="true" />
          {tradedLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Constituent bars */}
        {spreads.map((s, i) => {
          const y = plotTop + i * rowH;
          const reveal = barReveal(i);
          const w = (xOf(s) - padL) * reveal;
          return (
            <g key={i}>
              <text
                x={padL - 8}
                y={y + barH - 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-ink-500)"
              >
                {`#${i + 1}`}
              </text>
              {w > 0 && (
                <rect
                  x={padL}
                  y={y}
                  width={w}
                  height={barH}
                  rx={2}
                  fill="var(--color-brand-400)"
                />
              )}
              <text
                x={padL + w + 4}
                y={y + barH - 3}
                fontSize={9}
                fill="var(--color-ink-500)"
                fontFamily="var(--font-mono)"
              >
                {bp(s, bpSuffix)}
              </text>
            </g>
          );
        })}

        {/* Intrinsic average reference line (dashed, ink) */}
        <line
          x1={intrinsicX}
          y1={plotTop - 6}
          x2={intrinsicX}
          y2={plotBottom + 2}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        {/* Traded index spread reference line (solid, accent) */}
        <line
          x1={tradedX}
          y1={plotTop - 6}
          x2={tradedX}
          y2={plotBottom + 2}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
        />

        {/* Basis annotation: bracket between the two lines */}
        <line
          x1={intrinsicX}
          y1={plotTop - 4}
          x2={tradedX}
          y2={plotTop - 4}
          stroke="var(--color-accent-600)"
          strokeWidth={1.5}
        />
        <text
          x={(intrinsicX + tradedX) / 2}
          y={plotTop - 8}
          textAnchor="middle"
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--color-accent-600)"
        >
          {signedBp(basis, bpSuffix)}
        </text>

        {/* Axis baseline */}
        <line
          x1={padL}
          y1={axisY}
          x2={W - padR}
          y2={axisY}
          stroke="var(--color-ink-200)"
        />
        {/* Axis ticks at 0 and axisMax */}
        <text
          x={padL}
          y={axisY + 14}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
          fontFamily="var(--font-mono)"
        >
          0
        </text>
        <text
          x={W - padR}
          y={axisY + 14}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
          fontFamily="var(--font-mono)"
        >
          {bp(axisMax, bpSuffix)}
        </text>
        <text
          x={padL + plotW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {spreadAxisLabel}
        </text>
      </svg>

      {/* Control */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-demand`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{demandLabel}</span>
          <span className="font-mono text-ink-900">
            {signedBp(demand, bpSuffix)}
          </span>
        </label>
        <input
          id={`${id}-demand`}
          type="range"
          min={-15}
          max={15}
          step={1}
          value={demand}
          onChange={(e) => setDemand(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{intrinsicLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {bp(intrinsic, bpSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{tradedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {bp(traded, bpSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{basisLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              basis > 0
                ? 'text-accent-600'
                : basis < 0
                  ? 'text-brand-700'
                  : 'text-ink-900',
            )}
          >
            {signedBp(basis, bpSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{namesLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {names}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CdsIndexBasis;
