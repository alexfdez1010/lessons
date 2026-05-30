import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DrawdownChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Equity-curve values (index, base 100). Defaults to an obvious ~40% fall. */
  series?: number[];
  /** Button label to draw the curve. */
  playLabel?: string;
  /** Button label once the curve has finished drawing. */
  replayLabel?: string;
  /** Label for the peak marker. */
  peakLabel?: string;
  /** Label for the trough marker. */
  troughLabel?: string;
  /** Label prefixed to the drawdown percentage badge. */
  drawdownLabel?: string;
  /** One-line takeaway shown under the chart once finished. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Drawdown {
  /** Index of the peak that precedes the deepest later trough. */
  peak: number;
  /** Index of the deepest trough after that peak. */
  trough: number;
  /** Fractional drop, e.g. 0.4 for a 40% fall. */
  depth: number;
}

/** Walk the curve tracking the running peak; remember the worst peak→trough fall. */
const maxDrawdown = (series: number[]): Drawdown => {
  let runningPeak = series[0];
  let runningPeakIdx = 0;
  let best: Drawdown = { peak: 0, trough: 0, depth: 0 };
  for (let i = 1; i < series.length; i++) {
    if (series[i] > runningPeak) {
      runningPeak = series[i];
      runningPeakIdx = i;
    }
    const depth = (runningPeak - series[i]) / runningPeak;
    if (depth > best.depth) {
      best = { peak: runningPeakIdx, trough: i, depth };
    }
  }
  return best;
};

/**
 * Teaches **maximum drawdown**: the worst peak-to-trough fall an investment
 * suffers along the way. An equity curve (index, base 100) runs up, crashes,
 * then partially recovers. The component scans the curve, finds the deepest
 * peak→trough decline, and — once the line finishes drawing — drops in a peak
 * dot, a trough dot, a danger-tinted shaded band across the fall, and a
 * "−XX% max drawdown" badge so learners *see* exactly which slice of pain the
 * number measures. Respects `prefers-reduced-motion` (jumps to the final state
 * with every marker already shown).
 */
export function DrawdownChart({
  title = 'How deep was the fall?',
  series = [100, 108, 116, 125, 134, 128, 118, 104, 92, 81, 76, 84, 93, 101],
  playLabel = 'Draw the curve',
  replayLabel = 'Replay',
  peakLabel = 'Peak',
  troughLabel = 'Trough',
  drawdownLabel = 'Max drawdown',
  caption = 'Maximum drawdown measures the worst peak-to-trough drop — here about 40% — no matter how the curve recovers afterwards.',
  className,
}: DrawdownChartProps) {
  const id = useId();
  const [progress, setProgress] = useState(0); // 0 → 1
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  const dd = maxDrawdown(series);
  const ddPct = Math.round(dd.depth * 100);

  const W = 520;
  const H = 220;
  const padX = 12;
  const padY = 18;
  const n = series.length;
  const minV = Math.min(...series);
  const maxV = Math.max(...series);
  const span = maxV - minV || 1;

  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / span) * (H - padY * 2);

  const pathFor = (s: number[]) =>
    s.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  // Reveal the polyline continuously along its length given `progress`.
  const partialPath = (s: number[]) => {
    const t = progress * (n - 1);
    const last = Math.floor(t);
    const frac = t - last;
    let d = `M ${x(0)} ${y(s[0])}`;
    for (let i = 1; i <= last && i < n; i++) d += ` L ${x(i)} ${y(s[i])}`;
    if (last < n - 1 && frac > 0) {
      const xi = x(last) + (x(last + 1) - x(last)) * frac;
      const yi = y(s[last]) + (y(s[last + 1]) - y(s[last])) * frac;
      d += ` L ${xi} ${yi}`;
    }
    return d;
  };

  const start = () => {
    if (prefersReducedMotion()) {
      setProgress(1);
      setDone(true);
      return;
    }
    setDone(false);
    setProgress(0);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const duration = 2400;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPlaying(false);
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const peakX = x(dd.peak);
  const peakY = y(series[dd.peak]);
  const troughX = x(dd.trough);
  const troughY = y(series[dd.trough]);
  const bandX = Math.min(peakX, troughX);
  const bandW = Math.abs(troughX - peakX) || 1;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={start}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {done ? replayLabel : playLabel}
        </button>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: an equity curve rises to a peak, then falls ${ddPct}% to a trough before partly recovering. The worst peak-to-trough fall is highlighted as the maximum drawdown.`}
      >
        {/* Baseline at the starting index value */}
        <line
          x1={padX}
          y1={y(series[0])}
          x2={W - padX}
          y2={y(series[0])}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Faint full path for reference */}
        <path d={pathFor(series)} fill="none" stroke="var(--color-ink-100)" strokeWidth={2} />

        {/* Shaded drawdown band — peak → trough, fades in once done */}
        <rect
          x={bandX}
          y={padY}
          width={bandW}
          height={H - padY * 2}
          fill="var(--color-danger)"
          fillOpacity={0.12}
          className="transition-opacity duration-500"
          style={{ opacity: done ? 1 : 0 }}
        />

        {/* Animated equity line */}
        <path
          d={partialPath(series)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Peak + trough markers and the drop annotation — fade in once done */}
        <g
          className="transition-opacity duration-500"
          style={{ opacity: done ? 1 : 0 }}
          aria-hidden="true"
        >
          {/* Vertical drop line from peak level down to the trough */}
          <line
            x1={troughX}
            y1={peakY}
            x2={troughX}
            y2={troughY}
            stroke="var(--color-danger)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />

          {/* Peak */}
          <circle cx={peakX} cy={peakY} r={5} fill="var(--color-ink-500)" />
          <text
            x={peakX}
            y={peakY - 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-ink-500)"
          >
            {peakLabel}
          </text>

          {/* Trough */}
          <circle cx={troughX} cy={troughY} r={5} fill="var(--color-danger)" />
          <text
            x={troughX}
            y={troughY + 20}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-danger)"
          >
            {troughLabel}
          </text>
        </g>
      </svg>

      {/* Drawdown badge + caption, revealed once the curve finishes drawing */}
      <div
        className={cx(
          'mt-4 overflow-hidden transition-all',
          done ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
        aria-hidden={!done}
        id={`${id}-summary`}
      >
        <span className="inline-flex items-center gap-2 rounded-pill bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">
          <span aria-hidden="true">▼</span>
          {`−${ddPct}% ${drawdownLabel}`}
        </span>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
      </div>
    </figure>
  );
}

export default DrawdownChart;
