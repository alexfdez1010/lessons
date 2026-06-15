import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SpreadZScoreProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the entry-threshold (Z_entry) slider and its readout chip. */
  thresholdLabel?: string;
  /** Label for the round-trip-trades readout chip. */
  tradesLabel?: string;
  /** Label for the zero / mean (exit) reference line. */
  meanLabel?: string;
  /** Legend label for the shaded entry zones beyond the bands. */
  entryZoneLabel?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Legend/marker label for a long-the-spread entry (z below −Z_entry). */
  longLabel?: string;
  /** Legend/marker label for a short-the-spread entry (z above +Z_entry). */
  shortLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KAPPA = 6; // mean-reversion speed of the spread (controls the half-life)
const STEPS = 252; // discrete steps along the time axis
const DT = 1 / 252;
const SIGMA = 0.7; // volatility of the shocks
const Z_CLAMP = 3.6; // value-axis half-range in standard deviations

// Standard-normal sample via the Box–Muller transform.
const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Draw the full shock sequence once per resimulation.
const drawShocks = (): number[] => {
  const shocks: number[] = [];
  for (let t = 0; t < STEPS; t++) shocks.push(boxMuller());
  return shocks;
};

// Integrate a zero-mean Ornstein–Uhlenbeck spread from fixed shocks:
// dS = −κ·S·dt + σ√dt·Z. The spread is already centred on zero, so we then
// standardize it to a z-score (subtract the realized mean, divide by the
// realized standard deviation) — exactly what a pairs trader watches.
const integrate = (shocks: number[]): number[] => {
  const diff = SIGMA * Math.sqrt(DT);
  const raw: number[] = [0];
  let s = 0;
  for (let t = 0; t < STEPS; t++) {
    s = s - KAPPA * s * DT + diff * shocks[t];
    raw.push(s);
  }
  // Standardize to a z-score series.
  const n = raw.length;
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  const variance = raw.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const sd = Math.sqrt(variance) || 1;
  return raw.map((x) => (x - mean) / sd);
};

interface Trade {
  /** Index where the spread crossed past the band and the position opened. */
  entryIdx: number;
  /** Index where the spread returned toward 0 and the position closed. */
  exitIdx: number;
  /** A long-the-spread trade opens below −Z_entry; a short opens above +Z_entry. */
  side: 'long' | 'short';
}

// Walk the z-score series and pair each band crossing (entry) with the next
// return toward the mean (exit). Flat while inside the bands; one open trade
// at a time. This is exactly the round-trip count a band strategy generates.
const deriveTrades = (z: number[], zEntry: number): Trade[] => {
  const trades: Trade[] = [];
  let open: { entryIdx: number; side: 'long' | 'short' } | null = null;
  for (let i = 1; i < z.length; i++) {
    if (open === null) {
      // Look for a fresh crossing beyond a band.
      if (z[i - 1] < zEntry && z[i] >= zEntry) {
        open = { entryIdx: i, side: 'short' };
      } else if (z[i - 1] > -zEntry && z[i] <= -zEntry) {
        open = { entryIdx: i, side: 'long' };
      }
    } else {
      // Exit when the spread reverts back through 0.
      const reverted =
        open.side === 'short' ? z[i] <= 0 : z[i] >= 0;
      if (reverted) {
        trades.push({ entryIdx: open.entryIdx, exitIdx: i, side: open.side });
        open = null;
      }
    }
  }
  return trades;
};

/**
 * A statistical-arbitrage pairs-trade visualizer. The standardized spread (the
 * z-score of a mean-reverting Ornstein–Uhlenbeck path between two cointegrated
 * assets) wanders around 0. Horizontal bands sit at ±Z_entry; the zones beyond
 * them are shaded. When the z-score crosses above +Z_entry the spread is "rich"
 * and the strategy shorts it (mark, accent); when it crosses below −Z_entry it
 * is "cheap" and the strategy goes long (mark, accent); each position is closed
 * when the spread reverts back through 0 (exit mark, brand). Dragging the
 * Z_entry slider moves the bands and re-derives which crossings become real
 * trades — tighter bands fire more often (more false signals), wider bands fire
 * rarely (higher conviction). "Resimulate" redraws with fresh shocks. The path
 * sweeps in left-to-right on mount, respecting `prefers-reduced-motion`.
 */
export function SpreadZScore({
  title = 'Pairs trade: trading the spread’s z-score around its mean',
  thresholdLabel = 'Entry threshold (Z)',
  tradesLabel = 'Round-trip trades',
  meanLabel = 'Mean (exit)',
  entryZoneLabel = 'Entry zone',
  resimulateLabel = 'Resimulate',
  longLabel = 'Long spread',
  shortLabel = 'Short spread',
  caption = 'The spread is standardized to a z-score: 0 is its average, ±1 is one standard deviation away. Open a trade only when it strays past ±Z — short the spread up top (it is rich), go long down bottom (it is cheap) — then close when it reverts back to 0. Tighten the band and you trade more often but chase more noise; widen it and you wait for rarer, higher-conviction dislocations.',
  className,
}: SpreadZScoreProps) {
  const id = useId();
  const [zEntryX10, setZEntryX10] = useState(20); // Z_entry × 10, so 20 → 2.0
  const [seed, setSeed] = useState(0); // bump to resimulate
  const [shocks, setShocks] = useState<number[]>([]);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const zEntry = zEntryX10 / 10;

  const W = 520;
  const H = 240;
  const padLeft = 30;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;

  // Redraw the shock sequence only when the user resimulates — moving the
  // threshold keeps the same path so the slider's effect is isolated.
  useEffect(() => {
    setShocks(drawShocks());
  }, [seed]);

  // Reveal animation: sweep the path in left-to-right.
  useEffect(() => {
    if (shocks.length === 0) return;
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setProgress(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shocks, seed]);

  // Build the standardized z-score path and the trades the current band derives.
  const z = shocks.length > 0 ? integrate(shocks) : [];
  const trades = z.length > 0 ? deriveTrades(z, zEntry) : [];

  // Half-life of the spread in steps: ln(2)/κ, in the same step units as the axis.
  const halfLifeSteps = Math.log(2) / (KAPPA * DT);

  const zMax = Z_CLAMP;
  const zMin = -Z_CLAMP;

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (val: number) =>
    padTop + (1 - (val - zMin) / (zMax - zMin)) * (H - padTop - padBottom);

  // How many steps to draw given the reveal progress.
  const drawnSteps = Math.max(1, Math.round(STEPS * progress));

  const pathToD = (path: number[]): string => {
    let d = '';
    const last = Math.min(drawnSteps, path.length - 1);
    for (let i = 0; i <= last; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(path[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  const meanY = yToPx(0);
  const upperY = yToPx(zEntry);
  const lowerY = yToPx(-zEntry);
  const baseY = H - padBottom;
  const topY = padTop;
  const zEntryText = zEntry.toFixed(1);
  const halfLifeText = halfLifeSteps.toFixed(0);

  // Only show markers for trades whose entry has been revealed already.
  const visibleTrades = trades.filter((tr) => tr.entryIdx <= drawnSteps);

  // Z-axis gridlines at the entry bands and the mean.
  const gridZ = [zEntry, 0, -zEntry];

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
          {`Spread z-score`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-2.5 w-2.5 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {`${longLabel} / ${shortLabel} entry`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-2.5 w-2.5 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {`Exit`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-3 w-4 rounded-sm bg-accent-500/15"
            aria-hidden="true"
          />
          {entryZoneLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A simulated mean-reverting spread shown as a z-score oscillating around 0, with entry bands at plus and minus ${zEntryText} standard deviations. Crossings above the upper band open short-the-spread trades and crossings below the lower band open long-the-spread trades, each closing when the z-score reverts toward 0. At this threshold the strategy produces ${trades.length} round-trip trades, and the spread's half-life is about ${halfLifeText} steps.`}
      >
        {/* Shaded entry zones beyond the bands */}
        <rect
          x={padLeft}
          y={topY}
          width={W - padLeft - padRight}
          height={Math.max(0, upperY - topY)}
          fill="var(--color-accent-500)"
          fillOpacity={0.1}
        />
        <rect
          x={padLeft}
          y={lowerY}
          width={W - padLeft - padRight}
          height={Math.max(0, baseY - lowerY)}
          fill="var(--color-accent-500)"
          fillOpacity={0.1}
        />

        {/* Z gridlines + labels at the bands and the mean */}
        {gridZ.map((g, i) => {
          const gy = yToPx(g);
          return (
            <text
              key={`gz-${i}`}
              x={padLeft - 6}
              y={gy + 3}
              fontSize={10}
              fill="var(--color-ink-700)"
              textAnchor="end"
            >
              {g === 0 ? '0' : `${g > 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}`}
            </text>
          );
        })}

        {/* Baseline (time axis) */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Entry band lines (±Z_entry) */}
        <line
          x1={padLeft}
          y1={upperY}
          x2={W - padRight}
          y2={upperY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <line
          x1={padLeft}
          y1={lowerY}
          x2={W - padRight}
          y2={lowerY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={W - padRight - 2}
          y={upperY - 4}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
          textAnchor="end"
        >
          {`+${zEntryText}`}
        </text>
        <text
          x={W - padRight - 2}
          y={lowerY + 11}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
          textAnchor="end"
        >
          {`−${zEntryText}`}
        </text>

        {/* Mean (exit) reference line at 0 */}
        <line
          x1={padLeft}
          y1={meanY}
          x2={W - padRight}
          y2={meanY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />
        <text
          x={padLeft + 2}
          y={meanY - 4}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          {meanLabel}
        </text>

        {/* The standardized spread path */}
        <path
          d={pathToD(z)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeOpacity={0.9}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Trade markers: entries (accent), exits (brand) */}
        {visibleTrades.map((tr, i) => {
          const ex = xToPx(tr.entryIdx);
          const ey = yToPx(z[tr.entryIdx]);
          const showExit = tr.exitIdx <= drawnSteps;
          const xx = xToPx(tr.exitIdx);
          const xy = yToPx(z[tr.exitIdx]);
          return (
            <g key={`trade-${i}`}>
              <circle
                cx={ex}
                cy={ey}
                r={4}
                fill="var(--color-accent-500)"
                stroke="var(--color-surface)"
                strokeWidth={1.25}
              >
                <title>
                  {`${tr.side === 'short' ? shortLabel : longLabel} entry at z = ${z[tr.entryIdx].toFixed(2)}`}
                </title>
              </circle>
              {showExit && (
                <circle
                  cx={xx}
                  cy={xy}
                  r={3.5}
                  fill="var(--color-brand-500)"
                  stroke="var(--color-surface)"
                  strokeWidth={1.25}
                >
                  <title>{`Exit at z = ${z[tr.exitIdx].toFixed(2)}`}</title>
                </circle>
              )}
            </g>
          );
        })}

        {/* Time-axis ticks */}
        <text
          x={padLeft}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="start"
        >
          0
        </text>
        <text
          x={W - padRight}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {STEPS}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{thresholdLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{`±${zEntryText}`}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{tradesLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{trades.length}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">Half-life</span>
          <span className="font-mono font-semibold text-brand-600">{`${halfLifeText} steps`}</span>
        </span>
      </div>

      {/* Entry-threshold slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-zentry`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{thresholdLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {`±${zEntryText}`}
          </span>
        </label>
        <input
          id={`${id}-zentry`}
          type="range"
          min={10}
          max={30}
          step={1}
          value={zEntryX10}
          onChange={(e) => setZEntryX10(Number(e.target.value))}
          aria-valuetext={`entry threshold ±${zEntryText} standard deviations, ${trades.length} round-trip trades`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      {/* Resimulate button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SpreadZScore;
