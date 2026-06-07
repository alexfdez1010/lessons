import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BusinessCycleWaveProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + axis label for the rising long-run trend line. */
  trendLabel?: string;
  /** Legend label + y-axis label for the wavy real-GDP line. */
  gdpLabel?: string;
  /** Marker label for the expansion (growth) phase. */
  expansionLabel?: string;
  /** Marker label for the peak (top of the boom) phase. */
  peakLabel?: string;
  /** Marker label for the recession / contraction phase. */
  recessionLabel?: string;
  /** Marker label for the trough (bottom of the bust) phase. */
  troughLabel?: string;
  /** Prefix shown before the current-phase name in the live readout. */
  phaseLabel?: string;
  /** Accessible + visible label for the play button. */
  playLabel?: string;
  /** Accessible + visible label for the pause button. */
  pauseLabel?: string;
  /** Label for the time (x) axis. */
  timeAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type PhaseKey = 'expansion' | 'peak' | 'recession' | 'trough';

const SAMPLES = 240; // resolution of the drawn GDP curve
const CYCLES = 2.5; // number of boom/bust cycles across the chart
const WAVE_AMP = 0.16; // wave amplitude as a fraction of the plot height
const TREND_LO = 0.62; // trend value (0..1, bottom..top) at the left edge
const TREND_HI = 0.18; // trend value at the right edge (smaller = higher on screen)

// Long-run trend: real GDP grows steadily over time (line rises to the right).
const trendAt = (u: number): number => TREND_LO + (TREND_HI - TREND_LO) * u;

// Wave component around the trend: a sine that booms and busts.
const waveAt = (u: number): number => -Math.sin(u * CYCLES * 2 * Math.PI) * WAVE_AMP;

// Real GDP = trend + wave, clamped into the plot.
const gdpAt = (u: number): number => {
  const v = trendAt(u) + waveAt(u);
  return Math.min(0.96, Math.max(0.04, v));
};

// Which phase are we in, from the slope and curvature of the wave?
// Rising = expansion, falling = recession; the turning points are peak/trough.
const phaseAt = (u: number): PhaseKey => {
  const s = Math.sin(u * CYCLES * 2 * Math.PI); // wave (before negation)
  const c = Math.cos(u * CYCLES * 2 * Math.PI); // proportional to slope of -sin
  // Near the extremes of the wave we are at a peak or trough.
  if (s > 0.92) return 'peak';
  if (s < -0.92) return 'trough';
  // c > 0 ⇒ wave still rising (cos positive) ⇒ expansion; otherwise contracting.
  return c > 0 ? 'expansion' : 'recession';
};

/**
 * Animated business-cycle chart for a beginner economics lesson. Real GDP is
 * drawn as a wavy line oscillating around a steadily rising long-run trend line:
 * the single teaching point is that economies grow over decades yet cycle
 * through booms and busts around that trend. The four phases — expansion, peak,
 * recession (contraction) and trough — are labelled with markers, and recession
 * stretches (where GDP is falling) are shaded so the busts stand out. A
 * play/pause control sends a dot travelling along the curve while a live readout
 * names the phase it is currently passing through. Locale-agnostic (every
 * user-facing string is a prop). Respects `prefers-reduced-motion`: the full
 * curve, markers and shaded recessions render statically with the dot resting at
 * the start and no auto-animation.
 */
export function BusinessCycleWave({
  title = 'The business cycle: growth that booms and busts',
  trendLabel = 'Long-run trend',
  gdpLabel = 'Real GDP',
  expansionLabel = 'Expansion',
  peakLabel = 'Peak',
  recessionLabel = 'Recession',
  troughLabel = 'Trough',
  phaseLabel = 'Current phase',
  playLabel = 'Play',
  pauseLabel = 'Pause',
  timeAxisLabel = 'Time',
  caption = 'Over the long run the economy grows — that is the rising trend line. But output never glides up smoothly: it expands to a peak, slips into recession down to a trough, then expands again. The shaded dips are the busts; the trend is what survives them.',
  className,
}: BusinessCycleWaveProps) {
  const id = useId();
  const reduced = prefersReducedMotion();
  const [u, setU] = useState(0); // position along the curve, 0..1
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const W = 560;
  const H = 260;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 30;

  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const xToPx = (t: number): number => padLeft + t * plotW;
  const yToPx = (v: number): number => padTop + v * plotH; // v: 0 top .. 1 bottom

  // Drive the travelling dot. Cancelled on cleanup / pause / unmount.
  useEffect(() => {
    if (!playing || reduced) return;
    const period = 9000; // ms for a full left-to-right sweep
    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setU((prev) => {
        const next = prev + dt / period;
        return next >= 1 ? 0 : next; // loop back to the start
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [playing, reduced]);

  // Build the GDP path and the trend path.
  let gdpD = '';
  for (let k = 0; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    gdpD += `${k === 0 ? 'M' : 'L'} ${xToPx(t).toFixed(2)} ${yToPx(gdpAt(t)).toFixed(2)} `;
  }
  gdpD = gdpD.trim();

  const trendD = `M ${xToPx(0).toFixed(2)} ${yToPx(trendAt(0)).toFixed(2)} L ${xToPx(1).toFixed(2)} ${yToPx(trendAt(1)).toFixed(2)}`;

  // Recession bands: contiguous ranges of u where the phase is 'recession'.
  const bands: Array<{ from: number; to: number }> = [];
  {
    let start: number | null = null;
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES;
      const isRec = phaseAt(t) === 'recession';
      if (isRec && start === null) start = t;
      if ((!isRec || k === SAMPLES) && start !== null) {
        bands.push({ from: start, to: t });
        start = null;
      }
    }
  }

  // Find the turning points (peaks and troughs) for static markers.
  type Marker = { u: number; key: PhaseKey };
  const markers: Marker[] = [];
  for (let k = 1; k < SAMPLES; k++) {
    const t = k / SAMPLES;
    const prev = gdpAt((k - 1) / SAMPLES);
    const cur = gdpAt(t);
    const nxt = gdpAt((k + 1) / SAMPLES);
    // Remember: smaller v = higher on screen. A peak is a local minimum of v.
    if (cur < prev && cur < nxt) markers.push({ u: t, key: 'peak' });
    if (cur > prev && cur > nxt) markers.push({ u: t, key: 'trough' });
  }

  const phaseNames: Record<PhaseKey, string> = {
    expansion: expansionLabel,
    peak: peakLabel,
    recession: recessionLabel,
    trough: troughLabel,
  };

  const currentPhase = phaseAt(u);
  const dotX = xToPx(u);
  const dotY = yToPx(gdpAt(u));
  const baseY = H - padBottom;

  const toggle = () => {
    if (reduced) return;
    setPlaying((p) => !p);
  };

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
          {gdpLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t border-dashed border-accent-500"
            aria-hidden="true"
          />
          {trendLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-4 rounded-sm bg-brand-500/15" aria-hidden="true" />
          {recessionLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${gdpLabel} drawn as a wavy line oscillating around a rising ${trendLabel}. The economy grows over the long run while cycling through ${expansionLabel.toLowerCase()}, ${peakLabel.toLowerCase()}, ${recessionLabel.toLowerCase()} and ${troughLabel.toLowerCase()}; recessions are shaded.`}
      >
        {/* y-axis label (Real GDP), rotated up the left edge */}
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {gdpLabel}
        </text>

        {/* Shaded recession bands */}
        {bands.map((b, i) => (
          <rect
            key={`band-${i}`}
            x={xToPx(b.from)}
            y={padTop}
            width={xToPx(b.to) - xToPx(b.from)}
            height={plotH}
            fill="var(--color-brand-500)"
            fillOpacity={0.08}
          />
        ))}

        {/* Time (x) axis baseline */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Rising long-run trend line (dashed accent) */}
        <path
          d={trendD}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />

        {/* Wavy real-GDP curve */}
        <path
          d={gdpD}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Phase turning-point markers */}
        {markers.map((m, i) => (
          <g key={`marker-${i}`}>
            <circle
              cx={xToPx(m.u)}
              cy={yToPx(gdpAt(m.u))}
              r={4}
              fill="var(--color-surface)"
              stroke="var(--color-brand-600)"
              strokeWidth={2}
            />
            <text
              x={xToPx(m.u)}
              y={m.key === 'peak' ? yToPx(gdpAt(m.u)) - 9 : yToPx(gdpAt(m.u)) + 16}
              fontSize={10}
              fontWeight={600}
              fill="var(--color-ink-700)"
              textAnchor="middle"
            >
              {phaseNames[m.key]}
            </text>
          </g>
        ))}

        {/* Travelling dot following the curve */}
        <circle
          cx={dotX}
          cy={dotY}
          r={6}
          fill="var(--color-brand-600)"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />

        {/* Time-axis label + endpoints */}
        <text
          x={padLeft}
          y={H - 8}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          {timeAxisLabel} →
        </text>
      </svg>

      {/* Live phase readout */}
      <div
        className="mt-4 flex items-center gap-3 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-2 text-sm"
        aria-live="polite"
      >
        <span className="text-ink-500">{phaseLabel}</span>
        <span className="font-mono text-base font-semibold text-brand-700">
          {phaseNames[currentPhase]}
        </span>
      </div>

      {/* Play / pause control */}
      <div className="mt-4">
        <button
          type="button"
          onClick={toggle}
          disabled={reduced}
          aria-pressed={playing}
          aria-label={playing ? pauseLabel : playLabel}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {playing ? pauseLabel : playLabel}
        </button>
        <span className="sr-only" id={`${id}-hint`}>
          {phaseLabel}: {phaseNames[currentPhase]}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BusinessCycleWave;
