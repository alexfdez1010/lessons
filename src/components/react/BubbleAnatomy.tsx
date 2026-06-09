import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BubblePhase {
  /** Short phase name, e.g. "Mania / FOMO". */
  name: string;
  /** The crowd-psychology note for this phase. */
  note: string;
}

export interface BubbleAnatomyProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** The bubble phases, in order. Defaults to the classic 5. */
  phases?: BubblePhase[];
  /** y-axis label. Defaults to "Price". */
  priceLabel?: string;
  /** x-axis label. Defaults to "Time". */
  timeLabel?: string;
  /** Label for the dashed fundamental-value reference line. */
  fairValueLabel?: string;
  /** Label for the "previous phase" button. */
  prevLabel?: string;
  /** Label for the "next phase" button. */
  nextLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_PHASES: BubblePhase[] = [
  {
    name: 'Stealth',
    note: 'Quietly, the price drifts up near fair value. Only a handful of insiders and early believers are paying attention — the smart money buys while the story is still boring and unproven.',
  },
  {
    name: 'Awareness',
    note: 'The first wave of public buyers arrives and the price climbs above fundamentals. Early sceptics get a "first sell-off", the media starts to notice, and a tidy story takes shape to explain the rise.',
  },
  {
    name: 'Mania / FOMO',
    note: 'The crowd stampedes in. Fear of missing out replaces analysis, valuations detach from any reality, and "this time is different" becomes the slogan. New, naive money pours in near the top.',
  },
  {
    name: 'Blow-off',
    note: 'Euphoria peaks and then cracks. Insiders quietly sell to latecomers, prices stall, and the first sharp drop arrives. Buyers tell themselves it is just a healthy dip and "a chance to buy more".',
  },
  {
    name: 'Capitulation',
    note: 'Denial gives way to fear, then panic. Everyone heads for the exit at once, the price overshoots below fair value, and the latecomers who bought the top take the deepest losses.',
  },
];

/**
 * SVG anatomy of a speculative bubble. The classic price path — a quiet rise,
 * an accelerating climb into euphoria, a blow-off top and a panicked crash that
 * overshoots below fundamentals — is drawn over a dashed "fundamental value"
 * reference line, so the learner sees price detach from reality and snap back.
 * A keyboard-accessible stepper walks the bubble's phases, highlighting the
 * matching segment of the curve and surfacing that phase's crowd-psychology
 * note in an aria-live region. The curve animates in on mount; respects
 * `prefers-reduced-motion` (renders the full curve statically, no looping).
 * SSR-safe and locale-agnostic — all strings and the phase data are props.
 */
export function BubbleAnatomy({
  title = 'Anatomy of a bubble',
  caption = 'Price (the solid line) leaves fundamental value (the dashed line) far behind on the way up, then overshoots below it on the way down. Step through the phases to see the crowd psychology driving each leg.',
  phases = DEFAULT_PHASES,
  priceLabel = 'Price',
  timeLabel = 'Time',
  fairValueLabel = 'Fundamental value',
  prevLabel = 'Previous phase',
  nextLabel = 'Next phase',
  className,
}: BubbleAnatomyProps) {
  const id = useId();
  const reduced = prefersReducedMotion();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(reduced ? 1 : 0); // 0 → 1 curve draw-in
  const rafRef = useRef<number | null>(null);

  const n = Math.max(1, phases.length);

  const W = 560;
  const H = 280;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 34;

  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const xToPx = (t: number): number => padLeft + t * plotW; // t: 0..1 left..right
  const yToPx = (v: number): number => padTop + (1 - v) * plotH; // v: 0 bottom .. 1 top

  // Fundamental value: a gently rising baseline (price *should* drift up slowly).
  const FAIR_LO = 0.22;
  const FAIR_HI = 0.34;
  const fairAt = (t: number): number => FAIR_LO + (FAIR_HI - FAIR_LO) * t;

  // The bubble price path as a function of t (0..1), value in 0..1.
  // Built from the classic shape: slow stealth rise, accelerating mania to a
  // blow-off peak just past the middle, then a steep capitulation that
  // overshoots below fundamentals before a partial settle.
  const priceAt = (t: number): number => {
    const peakT = 0.62; // where the blow-off top sits
    if (t <= peakT) {
      // Convex, accelerating climb from near fair value to the peak.
      const u = t / peakT; // 0..1
      const climb = Math.pow(u, 2.4); // slow then steep (mania)
      return FAIR_LO + (0.96 - FAIR_LO) * climb;
    }
    // Crash: steep drop that overshoots below fair value, then eases up a touch.
    const u = (t - peakT) / (1 - peakT); // 0..1
    const trough = 0.12; // overshoot low (below fair value ~0.3)
    const settle = 0.2; // partial recovery toward the end
    const fall = 1 - Math.pow(1 - u, 1.7); // fast early, slowing
    const low = 0.96 + (trough - 0.96) * fall;
    // Gentle settle back up over the final stretch.
    const settleMix = Math.max(0, (u - 0.55) / 0.45);
    return low + (settle - trough) * Math.pow(settleMix, 1.4);
  };

  // Phase boundaries in t-space (n phases evenly spread across the timeline).
  const phaseBounds = (i: number): { from: number; to: number } => ({
    from: i / n,
    to: (i + 1) / n,
  });

  const SAMPLES = 200;

  // Build a path for a t-range, clipped to the current draw-in progress.
  const buildPath = (from: number, to: number): string => {
    const upto = progress; // global reveal fraction, in t-space
    let d = '';
    let started = false;
    for (let k = 0; k <= SAMPLES; k++) {
      const t = from + (to - from) * (k / SAMPLES);
      if (t > upto) break;
      const px = xToPx(t);
      const py = yToPx(priceAt(t));
      d += `${started ? 'L' : 'M'} ${px.toFixed(2)} ${py.toFixed(2)} `;
      started = true;
    }
    return d.trim();
  };

  const fullPath = buildPath(0, 1);
  const ab = phaseBounds(active);
  const activePath = buildPath(ab.from, ab.to);

  const fairD = `M ${xToPx(0).toFixed(2)} ${yToPx(fairAt(0)).toFixed(2)} L ${xToPx(1).toFixed(2)} ${yToPx(fairAt(1)).toFixed(2)}`;

  // Animate the curve drawing in on mount.
  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
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
      rafRef.current = null;
    };
  }, [reduced]);

  const go = (delta: number) =>
    setActive((i) => Math.min(n - 1, Math.max(0, i + delta)));

  const current = phases[active] ?? phases[0];

  // Midpoint of the active segment, for the highlight marker + label.
  const midT = (ab.from + ab.to) / 2;
  const markerVisible = progress >= ab.from; // only once revealed

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {priceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t border-dashed border-accent-500"
            aria-hidden="true"
          />
          {fairValueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${priceLabel} rises far above ${fairValueLabel} into a peak, then crashes and overshoots below it. The bubble passes through ${phases
          .map((p) => p.name)
          .join(', ')}. Currently highlighting the ${current.name} phase.`}
      >
        {/* y-axis label (Price), rotated up the left edge */}
        <text
          x={14}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padTop + plotH / 2})`}
        >
          {priceLabel}
        </text>

        {/* Plot axes */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={H - padBottom}
          stroke="var(--color-ink-200)"
        />
        <line
          x1={padLeft}
          y1={H - padBottom}
          x2={W - padRight}
          y2={H - padBottom}
          stroke="var(--color-ink-200)"
        />

        {/* Active phase band highlight */}
        <rect
          x={xToPx(ab.from)}
          y={padTop}
          width={xToPx(ab.to) - xToPx(ab.from)}
          height={plotH}
          fill="var(--color-brand-500)"
          fillOpacity={0.08}
        />

        {/* Dashed fundamental-value reference line */}
        <path
          d={fairD}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />

        {/* Full price curve (faint), then the active segment on top (bold) */}
        <path
          d={fullPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeOpacity={0.35}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={activePath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Phase boundary ticks + names along the bottom */}
        {phases.map((p, i) => {
          const b = phaseBounds(i);
          const cx = xToPx((b.from + b.to) / 2);
          const isActive = i === active;
          return (
            <text
              key={`label-${i}`}
              x={cx}
              y={H - padBottom + 16}
              fontSize={10}
              fontWeight={isActive ? 700 : 500}
              fill={isActive ? 'var(--color-brand-700)' : 'var(--color-ink-500)'}
              textAnchor="middle"
            >
              {p.name}
            </text>
          );
        })}

        {/* Highlight marker on the active segment */}
        {markerVisible && (
          <circle
            cx={xToPx(midT)}
            cy={yToPx(priceAt(midT))}
            r={6}
            fill="var(--color-brand-600)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        )}

        {/* x-axis label */}
        <text
          x={padLeft}
          y={H - 6}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          {timeLabel} →
        </text>
      </svg>

      {/* Stepper controls */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={active === 0}
          aria-label={prevLabel}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          ← {prevLabel}
        </button>
        <span className="font-mono text-sm text-ink-500" aria-hidden="true">
          {active + 1} / {n}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={active === n - 1}
          aria-label={nextLabel}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {nextLabel} →
        </button>
      </div>

      {/* Live phase note */}
      <div
        className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3"
        aria-live="polite"
      >
        <p className="font-display text-base font-semibold text-brand-700">
          {current.name}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{current.note}</p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" id={`${id}-caption`}>
        {caption}
      </p>
    </figure>
  );
}

export default BubbleAnatomy;
