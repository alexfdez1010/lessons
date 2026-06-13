import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ExtremistanShiftProps {
  /** Heading above the figure. */
  title?: string;
  /** Label for the left (non-scalable) panel. */
  mediocristanLabel?: string;
  /** Label for the right (scalable) panel. */
  extremistanLabel?: string;
  /** Label on the per-panel "add the outlier" button. */
  addOutlierLabel?: string;
  /** Label on the reset button. */
  resetLabel?: string;
  /** Label preceding the running-average readout. */
  averageLabel?: string;
  /** Small caption shown under the left panel. */
  mediocristanNote?: string;
  /** Small caption shown under the right panel. */
  extremistanNote?: string;
  /** One-line takeaway shown under both panels. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- The two worlds, in numbers --------------------------------------------
// Mediocristan: 1000 people of ordinary height (m). One observation — even the
// tallest human ever (~2.72 m) — barely moves the average (~1 mm).
const CROWD = 1000;
const HEIGHT_MEAN = 1.7; // m, an ordinary adult
const HEIGHT_OUTLIER = 2.72; // m, the tallest recorded human
// Extremistan: 1000 people of ordinary wealth ($50k). Add ONE ~$100B fortune
// and the average explodes ~1000× — the outlier owns ~99.9% of the total.
const WEALTH_MEAN = 50_000; // $, an ordinary net worth
const WEALTH_OUTLIER = 100_000_000_000; // $100B

const crowdTotal = (mean: number) => CROWD * mean;

const avgWith = (mean: number, outlier: number, added: boolean): number => {
  const total = crowdTotal(mean) + (added ? outlier : 0);
  const n = CROWD + (added ? 1 : 0);
  return total / n;
};

const heightFmt = (m: number): string =>
  `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(m)} m`;

// Compact, locale-agnostic money: $50,000 → "$50K"; $99.95M → "$100.0M".
const moneyFmt = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

interface PanelProps {
  panelLabel: string;
  averageLabel: string;
  addOutlierLabel: string;
  note?: string;
  added: boolean;
  onToggle: () => void;
  /** 0 → 1 animation driver for the average marker / rescale. */
  t: number;
  reduced: boolean;
  /** Average before / after the outlier joins. */
  avgBefore: number;
  avgAfter: number;
  /** Per-bar value before / after, for the crowd field. */
  unitBefore: number;
  unitOutlier: number;
  fmt: (v: number) => string;
  /** Accent: 'brand' (calm) or 'danger' (catastrophic). */
  tone: 'brand' | 'danger';
}

const COLS = 40;
const ROWS = 8;
const DOTS = COLS * ROWS; // 320 dots stand in for the 1000-strong crowd

function Panel({
  panelLabel,
  averageLabel,
  addOutlierLabel,
  note,
  added,
  onToggle,
  t,
  reduced,
  avgBefore,
  avgAfter,
  unitBefore,
  unitOutlier,
  fmt,
  tone,
}: PanelProps) {
  const accentVar = tone === 'danger' ? 'var(--color-danger)' : 'var(--color-brand-500)';
  const accentStrong = tone === 'danger' ? 'var(--color-danger)' : 'var(--color-brand-700)';

  // Live (interpolated) average that the readout + marker track.
  const liveAvg = avgBefore + (avgAfter - avgBefore) * t;

  // Marker position is the average expressed as a share of the current axis
  // max. The axis rescales to fit the outlier-dominated total, so in
  // Extremistan the marker barely moves in *fraction* terms even though the
  // number rockets — we instead drive the marker by how far the average has
  // climbed toward the post-outlier value, which reads as motion across the
  // panel. Clamp to [4, 96]% so it never sits on the edge.
  const axisMax = Math.max(avgAfter, avgBefore) * 1.08;
  const markerPct = Math.min(96, Math.max(4, (liveAvg / axisMax) * 100));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink-900">{panelLabel}</span>
        <span
          className="rounded-pill px-2.5 py-0.5 text-xs font-medium"
          style={{
            color: accentStrong,
            background: `color-mix(in oklab, ${accentVar} 14%, transparent)`,
          }}
        >
          n = {added ? CROWD + 1 : CROWD}
        </span>
      </div>

      {/* Crowd field + the outlier, with the running-average marker on top */}
      <div className="relative mt-3 rounded-card border border-ink-100 bg-surface-sunken/40 p-2">
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          role="img"
          aria-hidden="true"
        >
          {Array.from({ length: DOTS }, (_, i) => (
            <span
              key={i}
              className="aspect-square rounded-[1.5px]"
              style={{ background: `color-mix(in oklab, ${accentVar} 35%, transparent)` }}
            />
          ))}
        </div>

        {/* The single outlier — a lone giant bar that fades/scales in */}
        <div
          className="pointer-events-none absolute inset-y-2 right-2 flex items-end"
          style={{
            opacity: added ? (reduced ? 1 : t) : 0,
            visibility: added ? 'visible' : 'hidden',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span
              className="rounded-[2px]"
              style={{
                width: tone === 'danger' ? '0.85rem' : '0.6rem',
                // The wealth outlier towers; the height outlier is barely taller.
                height: tone === 'danger' ? '4.5rem' : '1.1rem',
                background: accentStrong,
                transform: reduced ? 'none' : `scaleY(${0.2 + 0.8 * t})`,
                transformOrigin: 'bottom',
              }}
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] font-semibold" style={{ color: accentStrong }}>
              {fmt(unitOutlier)}
            </span>
          </div>
        </div>

        {/* Running-average marker: a vertical line that slides across */}
        <div
          className="pointer-events-none absolute inset-y-1"
          style={{
            left: `${markerPct}%`,
            transition: reduced ? 'none' : 'left 700ms cubic-bezier(0.22,1,0.36,1)',
          }}
          aria-hidden="true"
        >
          <div className="h-full w-0.5" style={{ background: accentStrong }} />
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-500">
        <span aria-hidden="true">— </span>
        one typical unit ≈ {fmt(unitBefore)}
      </p>

      {/* Average readout */}
      <div className="mt-3 flex items-baseline justify-between gap-2" aria-live="polite">
        <span className="text-sm text-ink-500">{averageLabel}</span>
        <span className="font-display text-2xl font-semibold tabular-nums" style={{ color: accentStrong }}>
          {fmt(liveAvg)}
        </span>
      </div>

      {/* Before → after chip */}
      <p className="mt-1 text-xs text-ink-500">
        <span className="font-mono">{fmt(avgBefore)}</span>
        <span aria-hidden="true"> → </span>
        <span className="font-mono font-semibold" style={{ color: accentStrong }}>
          {fmt(avgAfter)}
        </span>
      </p>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={added}
        className="mt-3 rounded-pill border border-ink-100 bg-surface px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {addOutlierLabel}
      </button>

      {note ? <p className="mt-3 text-xs leading-relaxed text-ink-600">{note}</p> : null}
    </div>
  );
}

/**
 * Taleb's Mediocristan vs Extremistan, side by side. Two panels each hold a
 * crowd of {@link CROWD} ordinary observations with a running-average marker.
 * Pressing "add the outlier" drops a single extreme observation into each
 * world and animates the average:
 *
 * - **Mediocristan** (non-scalable, e.g. human height): adding the tallest
 *   human ever to 1000 people moves the average by ~1 mm. The marker barely
 *   twitches.
 * - **Extremistan** (scalable, e.g. wealth): adding one ~$100B fortune to 1000
 *   ordinary people multiplies the average ~1000×; that one observation owns
 *   ~99.9% of the total. The marker rockets and the axis rescales.
 *
 * Same action, trivial vs catastrophic effect on the mean — the contrast *is*
 * the lesson. Locale-agnostic (every user-facing string is a prop) and SSR-safe
 * (numbers are computed deterministically). Respects `prefers-reduced-motion`
 * (averages and markers jump straight to their final state). Each panel's
 * button is keyboard-operable with `aria-pressed`, and both average readouts
 * plus an `sr-only` summary are announced via `aria-live`.
 */
export function ExtremistanShift({
  title = 'Mediocristan vs Extremistan: when one observation changes everything',
  mediocristanLabel = 'Mediocristan (height)',
  extremistanLabel = 'Extremistan (wealth)',
  addOutlierLabel = 'Add the outlier',
  resetLabel = 'Reset',
  averageLabel = 'Average',
  mediocristanNote = 'Height is non-scalable: nobody is 50× taller than average. Add the tallest human who ever lived and the average of 1,000 people moves about a millimetre.',
  extremistanNote = 'Wealth is scalable: one fortune can be a million times the median. Add a single ~$100B fortune and the average of 1,000 people explodes — that one person owns ~99.9% of the pile.',
  caption = 'Same move, two worlds. In Mediocristan no single sample can dominate the total; in Extremistan one sample can be the total. Models built for the first world quietly blow up in the second.',
  className,
}: ExtremistanShiftProps) {
  const id = useId();
  const reduced = prefersReducedMotion();
  const [added, setAdded] = useState(false);
  const [t, setT] = useState(0); // 0 → 1 animation driver, shared by both panels
  const rafRef = useRef<number | null>(null);

  // Animate `t` toward 1 when the outlier is added, back to 0 on reset.
  useEffect(() => {
    const target = added ? 1 : 0;
    if (reduced) {
      setT(target);
      return;
    }
    const duration = 800;
    const from = t;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setT(from + (target - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [added, reduced]);

  const hBefore = avgWith(HEIGHT_MEAN, HEIGHT_OUTLIER, false);
  const hAfter = avgWith(HEIGHT_MEAN, HEIGHT_OUTLIER, true);
  const wBefore = avgWith(WEALTH_MEAN, WEALTH_OUTLIER, false);
  const wAfter = avgWith(WEALTH_MEAN, WEALTH_OUTLIER, true);

  // How much each world's average changed, for the screen-reader summary.
  const heightDeltaMm = Math.round((hAfter - hBefore) * 1000);
  const wealthMultiple = Math.round(wAfter / wBefore);
  const outlierShare = (WEALTH_OUTLIER / (crowdTotal(WEALTH_MEAN) + WEALTH_OUTLIER)) * 100;

  const toggle = () => setAdded((a) => !a);
  const reset = () => setAdded(false);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-100 bg-surface px-3 py-1 text-sm font-medium text-ink-700 shadow-soft transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </figcaption>

      <div className="mt-5 flex flex-col gap-8 sm:flex-row sm:gap-6">
        <Panel
          panelLabel={mediocristanLabel}
          averageLabel={averageLabel}
          addOutlierLabel={addOutlierLabel}
          note={mediocristanNote}
          added={added}
          onToggle={toggle}
          t={t}
          reduced={reduced}
          avgBefore={hBefore}
          avgAfter={hAfter}
          unitBefore={HEIGHT_MEAN}
          unitOutlier={HEIGHT_OUTLIER}
          fmt={heightFmt}
          tone="brand"
        />

        {/* Divider */}
        <div className="hidden w-px self-stretch bg-ink-100 sm:block" aria-hidden="true" />

        <Panel
          panelLabel={extremistanLabel}
          averageLabel={averageLabel}
          addOutlierLabel={addOutlierLabel}
          note={extremistanNote}
          added={added}
          onToggle={toggle}
          t={t}
          reduced={reduced}
          avgBefore={wBefore}
          avgAfter={wAfter}
          unitBefore={WEALTH_MEAN}
          unitOutlier={WEALTH_OUTLIER}
          fmt={moneyFmt}
          tone="danger"
        />
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-600">{caption}</p>

      <span className="sr-only" id={`${id}-status`} aria-live="polite">
        {added
          ? `Outlier added to both worlds. In ${mediocristanLabel}, the average rose by about ${heightDeltaMm} millimetre${
              heightDeltaMm === 1 ? '' : 's'
            }, from ${heightFmt(hBefore)} to ${heightFmt(hAfter)}. In ${extremistanLabel}, the average jumped about ${wealthMultiple}×, from ${moneyFmt(
              wBefore,
            )} to ${moneyFmt(wAfter)} — the single outlier owns about ${outlierShare.toFixed(
              1,
            )}% of the total.`
          : `No outlier added. Both worlds sit at their crowd averages: ${heightFmt(
              hBefore,
            )} and ${moneyFmt(wBefore)}.`}
      </span>
    </figure>
  );
}

export default ExtremistanShift;
