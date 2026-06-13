import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One tranche in the capital stack, defined by its loss-axis attachment band. */
export interface TrancheBand {
  /** Tranche name, e.g. "Equity". */
  label: string;
  /** Attachment point (%): cumulative portfolio loss at which this tranche starts taking losses. */
  attach: number;
  /** Detachment point (%): cumulative portfolio loss at which this tranche is fully wiped. */
  detach: number;
  /** Optional short note shown under the tranche label. */
  note?: string;
}

export interface TrancheWaterfallProps {
  /** Heading above the chart. */
  title?: string;
  /**
   * Tranches from first-loss (equity) to most-senior, defined by attachment
   * bands of the 0–100% loss axis. Defaults: Equity 0–5%, Mezzanine 5–15%,
   * Senior 15–100%.
   */
  tranches?: TrancheBand[];
  /** Label for the portfolio-loss slider. */
  lossLabel?: string;
  /** Word for "currently absorbing" in the headline readout. */
  absorbingLabel?: string;
  /** Word for "wiped out" in the per-tranche readout. */
  wipedLabel?: string;
  /** Label for each tranche's thickness (width) readout. */
  thicknessLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_TRANCHES: TrancheBand[] = [
  { label: 'Equity', attach: 0, detach: 5, note: 'First loss' },
  { label: 'Mezzanine', attach: 5, detach: 15, note: 'Cushioned by equity' },
  { label: 'Senior', attach: 15, detach: 100, note: 'AAA — last to be touched' },
];

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(value < 10 && value !== Math.round(value) ? 1 : 0)}${suffix}`;

/**
 * Tranche-waterfall capital stack. A securitization slices a portfolio's losses
 * into tranches by **attachment/detachment** bands of the 0–100% loss axis. As
 * portfolio losses rise, they are absorbed **bottom-up**: the Equity (first-loss)
 * tranche is eaten first, then Mezzanine, then Senior. A tranche starts taking
 * losses once cumulative loss passes its attachment point and is fully wiped once
 * loss passes its detachment point.
 *
 * This island draws one tall vertical stacked bar (Senior on top, Equity at the
 * bottom). A "Portfolio loss" slider fills a darkened, hatched "losses absorbed"
 * overlay from the bottom up so the learner sees exactly which tranche the current
 * loss is hitting. Per-tranche readouts show each band's thickness and the % of
 * that tranche wiped out, and an aria-live headline names the tranche currently
 * absorbing. The overlay animates smoothly on slider change; respects
 * `prefers-reduced-motion` (jumps straight to the final fill).
 */
export function TrancheWaterfall({
  title = 'How losses flow through a tranche structure',
  tranches = DEFAULT_TRANCHES,
  lossLabel = 'Portfolio loss',
  absorbingLabel = 'Currently absorbing',
  wipedLabel = 'wiped',
  thicknessLabel = 'Thickness',
  caption = 'Losses hit the equity tranche first and only reach the senior tranche after everything below it is wiped — that subordination is exactly what lets the senior tranche be rated AAA.',
  percentSuffix = '%',
  className,
}: TrancheWaterfallProps) {
  const id = useId();
  const reduced =
    typeof window !== 'undefined' ? prefersReducedMotion() : false;

  // Slider value (target cumulative portfolio loss, 0–100%).
  const [loss, setLoss] = useState(0);
  // Animated value that eases toward `loss`.
  const [shown, setShown] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Ease the absorbed overlay toward the slider target.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(loss);
      return;
    }
    let startTs: number | null = null;
    const from = shown;
    const to = loss;
    const duration = 450;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      // ease-out
      const eased = 1 - (1 - p) * (1 - p);
      setShown(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Only retarget when the slider moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loss]);

  // --- Chart geometry -------------------------------------------------------
  const W = 320;
  const H = 360;
  const stackX = 96;
  const stackW = 120;
  const padTop = 16;
  const padBottom = 28;
  const stackTop = padTop;
  const stackH = H - padTop - padBottom;

  // Map a loss-axis percentage (0 at bottom = 0% loss, 100 at top) to a y.
  // 0% loss sits at the bottom of the stack, 100% at the top.
  const yForLoss = (p: number) => stackTop + stackH * (1 - p / 100);

  // Per-tranche colors: Senior on top, Mezz middle, Equity bottom.
  const trancheFill = (i: number): string => {
    const n = tranches.length;
    if (i === 0) return 'var(--color-accent-500)'; // equity (first-loss)
    if (i === n - 1) return 'var(--color-brand-500)'; // senior
    return 'var(--color-accent-400)'; // mezzanine (amber-ish)
  };

  // % of a tranche wiped out at the current absorbed loss level.
  const wipedFor = (t: TrancheBand, absorbed: number): number => {
    if (absorbed <= t.attach) return 0;
    if (absorbed >= t.detach) return 100;
    const span = t.detach - t.attach;
    if (span <= 0) return 100;
    return ((absorbed - t.attach) / span) * 100;
  };

  // Index of the tranche currently absorbing losses (the one whose band the
  // absorbed level falls inside). −1 if no losses yet or fully wiped through.
  const absorbingIndex = (absorbed: number): number => {
    if (absorbed <= 0) return -1;
    for (let i = 0; i < tranches.length; i++) {
      const t = tranches[i];
      if (absorbed > t.attach && absorbed < t.detach) return i;
      if (absorbed >= t.detach && i === tranches.length - 1) return i;
    }
    return -1;
  };

  const absorbing = absorbingIndex(shown);
  const absorbingTarget = absorbingIndex(loss);

  // y of the top of the absorbed overlay (fills from the bottom up).
  const absorbedTopY = yForLoss(Math.min(100, Math.max(0, shown)));
  const absorbedBottomY = yForLoss(0);
  const absorbedHeight = Math.max(0, absorbedBottomY - absorbedTopY);

  const hatchId = `${id}-hatch`;

  // --- Live readout ---------------------------------------------------------
  const lossText = pct(loss, percentSuffix);
  const perTrancheLoss = tranches
    .map((t) => {
      const w = wipedFor(t, loss);
      return `${t.label} ${pct(w, percentSuffix)} ${wipedLabel}`;
    })
    .join(', ');
  const absorbingText =
    absorbingTarget >= 0
      ? `${absorbingLabel}: ${tranches[absorbingTarget].label}.`
      : `No tranche is taking losses yet.`;
  const live = `${lossLabel} ${lossText}. ${absorbingText} ${perTrancheLoss}.`;

  const ariaLabel =
    `${title}: a capital stack of ${tranches.length} tranches. ` +
    tranches
      .map((t) => `${t.label} attaches at ${pct(t.attach, percentSuffix)} and detaches at ${pct(t.detach, percentSuffix)}`)
      .join('; ') +
    `. At a ${lossText} portfolio loss, ${absorbingText.toLowerCase()}`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="font-mono text-sm font-semibold text-ink-900">
          {lossLabel}: {lossText}
        </span>
      </figcaption>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* Capital stack */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full sm:w-[220px]"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <pattern
              id={hatchId}
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={8} height={8} fill="var(--color-ink-900)" opacity={0.34} />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={8}
                stroke="var(--color-surface)"
                strokeWidth={3}
                opacity={0.45}
              />
            </pattern>
          </defs>

          {/* Loss-axis ticks (0% bottom → 100% top) */}
          {[0, 25, 50, 75, 100].map((p) => (
            <g key={p}>
              <line
                x1={stackX - 6}
                y1={yForLoss(p)}
                x2={stackX}
                y2={yForLoss(p)}
                stroke="var(--color-ink-300)"
              />
              <text
                x={stackX - 9}
                y={yForLoss(p) + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-ink-500)"
                fontFamily="var(--font-mono)"
              >
                {p}
                {percentSuffix}
              </text>
            </g>
          ))}

          {/* Tranche bands */}
          {tranches.map((t, i) => {
            const top = yForLoss(Math.min(100, t.detach));
            const bottom = yForLoss(t.attach);
            const h = Math.max(0, bottom - top);
            const isAbsorbing = i === absorbing;
            return (
              <g key={`${id}-band-${i}`}>
                <rect
                  x={stackX}
                  y={top}
                  width={stackW}
                  height={h}
                  fill={trancheFill(i)}
                  stroke={
                    isAbsorbing
                      ? 'var(--color-ink-900)'
                      : 'var(--color-surface)'
                  }
                  strokeWidth={isAbsorbing ? 2 : 1}
                />
                {/* Tranche label inside the band */}
                <text
                  x={stackX + stackW / 2}
                  y={top + h / 2 + 1}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--color-surface)"
                >
                  {t.label}
                </text>
                <text
                  x={stackX + stackW / 2}
                  y={top + h / 2 + 15}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-surface)"
                  opacity={0.85}
                >
                  {pct(t.attach, percentSuffix)}–{pct(t.detach, percentSuffix)}
                </text>
              </g>
            );
          })}

          {/* Losses-absorbed overlay (hatched, fills from the bottom up) */}
          {absorbedHeight > 0 && (
            <g>
              <rect
                x={stackX}
                y={absorbedTopY}
                width={stackW}
                height={absorbedHeight}
                fill={`url(#${hatchId})`}
                pointerEvents="none"
              />
              {/* Loss frontier line */}
              <line
                x1={stackX}
                y1={absorbedTopY}
                x2={stackX + stackW}
                y2={absorbedTopY}
                stroke="var(--color-ink-900)"
                strokeWidth={2}
                pointerEvents="none"
              />
            </g>
          )}

          {/* Stack outline */}
          <rect
            x={stackX}
            y={stackTop}
            width={stackW}
            height={stackH}
            fill="none"
            stroke="var(--color-ink-300)"
          />

          <text
            x={stackX + stackW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {lossLabel}
          </text>
        </svg>

        {/* Controls + per-tranche readouts */}
        <div>
          <label
            htmlFor={`${id}-loss`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{lossLabel}</span>
            <span className="font-mono text-ink-900">{lossText}</span>
          </label>
          <input
            id={`${id}-loss`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={loss}
            onChange={(e) => setLoss(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />

          <ul className="mt-4 space-y-2">
            {/* Render senior → equity so it reads top-down like the stack. */}
            {tranches
              .map((t, i) => ({ t, i }))
              .slice()
              .reverse()
              .map(({ t, i }) => {
                const thickness = t.detach - t.attach;
                const wiped = wipedFor(t, loss);
                const isAbsorbing = i === absorbingTarget;
                return (
                  <li
                    key={`${id}-row-${i}`}
                    className={cx(
                      'rounded-card border px-3 py-2 transition-colors',
                      isAbsorbing
                        ? 'border-ink-900/30 bg-brand-50'
                        : 'border-ink-100 bg-surface-sunken/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-900">
                        <span
                          className="h-3 w-3 rounded-pill"
                          style={{ background: trancheFill(i) }}
                          aria-hidden="true"
                        />
                        {t.label}
                        {isAbsorbing && (
                          <span className="rounded-pill bg-ink-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            {absorbingLabel}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-sm text-ink-600">
                        {pct(t.attach, percentSuffix)}–{pct(t.detach, percentSuffix)}
                      </span>
                    </div>
                    {t.note && (
                      <p className="mt-0.5 text-xs text-ink-500">{t.note}</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <span className="text-ink-500">
                        {thicknessLabel}:{' '}
                        <span className="font-mono text-ink-900">
                          {pct(thickness, percentSuffix)}
                        </span>
                      </span>
                      <span className="text-ink-500">
                        {pct(wiped, percentSuffix)}{' '}
                        <span
                          className={cx(
                            wiped >= 100
                              ? 'font-semibold text-accent-600'
                              : wiped > 0
                                ? 'font-semibold text-ink-900'
                                : 'text-ink-400',
                          )}
                        >
                          {wipedLabel}
                        </span>
                      </span>
                    </div>
                    {/* Per-tranche wiped meter */}
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-pill bg-ink-100">
                      <span
                        className={cx(
                          'block h-full rounded-pill',
                          !reduced && 'transition-all duration-300 ease-out',
                          wiped >= 100 ? 'bg-accent-600' : 'bg-ink-900',
                        )}
                        style={{ width: `${wiped}%` }}
                      />
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>

      <p
        className="mt-4 text-sm text-ink-500"
        aria-live="polite"
        aria-atomic="true"
      >
        {live}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TrancheWaterfall;
