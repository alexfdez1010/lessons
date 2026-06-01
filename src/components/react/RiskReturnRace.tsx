import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RiskReturnRaceProps {
  /** Heading above the chart. */
  title?: string;
  /** Labels for the two portfolios (smooth, jagged). */
  seriesLabels?: [string, string];
  /** Row labels for the three metrics. */
  metricLabels?: [string, string, string];
  /** Volatility descriptor for the calm portfolio. Defaults to `'low'`. */
  lowLabel?: string;
  /** Volatility descriptor for the wild portfolio. Defaults to `'high'`. */
  highLabel?: string;
  /** Button label to start the race. */
  playLabel?: string;
  /** Button label once the race has finished. */
  replayLabel?: string;
  /** One-line takeaway shown under the chart once finished. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Two portfolios that finish at the *same* place but get there very
 * differently. The smooth one drifts up steadily; the jagged one lurches,
 * crashes, and claws back — same final return, far more volatility. Press play
 * and both equity curves draw in together so the learner *sees* that identical
 * returns can hide wildly different risk. The metric panel then reveals why the
 * Sharpe ratio rewards the calm line: same numerator, bigger denominator for
 * the wild one. Respects `prefers-reduced-motion` (jumps straight to the end).
 */
export function RiskReturnRace({
  title = 'Same return, different risk',
  seriesLabels = ['Steady Eddie', 'Rollercoaster'],
  metricLabels = ['Total return', 'Volatility (risk)', 'Sharpe ratio'],
  lowLabel = 'low',
  highLabel = 'high',
  playLabel = 'Play the race',
  replayLabel = 'Replay',
  caption = 'Both portfolios end at +60%. The calm one earns a far higher Sharpe ratio because it took less risk to get there.',
  className,
}: RiskReturnRaceProps) {
  const id = useId();
  const [progress, setProgress] = useState(0); // 0 → 1
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Two deterministic monthly equity paths (index, base 100) that both end at
  // 160 — same +60% total — but with very different month-to-month swings.
  const smooth = [100, 104, 108, 113, 118, 122, 127, 133, 139, 146, 153, 160];
  const jagged = [100, 88, 112, 95, 130, 84, 140, 108, 150, 96, 138, 160];

  const W = 520;
  const H = 220;
  const padX = 8;
  const padY = 14;
  const minV = 80;
  const maxV = 160;
  const n = smooth.length;

  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const pathFor = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  // How many segments to reveal given progress (continuous along the polyline).
  const partialPath = (series: number[]) => {
    const t = progress * (n - 1);
    const last = Math.floor(t);
    const frac = t - last;
    let d = `M ${x(0)} ${y(series[0])}`;
    for (let i = 1; i <= last && i < n; i++) d += ` L ${x(i)} ${y(series[i])}`;
    if (last < n - 1 && frac > 0) {
      const xi = x(last) + (x(last + 1) - x(last)) * frac;
      const yi = y(series[last]) + (y(series[last + 1]) - y(series[last])) * frac;
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
    const duration = 2600;
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

  // Metrics revealed once the race finishes.
  const metrics = [
    { label: metricLabels[0], smooth: '+60%', jagged: '+60%', tie: true },
    { label: metricLabels[1], smooth: lowLabel, jagged: highLabel, tie: false },
    { label: metricLabels[2], smooth: '1.9', jagged: '0.4', tie: false },
  ];

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

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {seriesLabels[0]}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {seriesLabels[1]}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${seriesLabels[0]} rises smoothly while ${seriesLabels[1]} swings wildly, both ending at the same +60% return.`}
      >
        {/* Starting baseline (index 100) */}
        <line
          x1={padX}
          y1={y(100)}
          x2={W - padX}
          y2={y(100)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Faint full paths for reference */}
        <path d={pathFor(jagged)} fill="none" stroke="var(--color-ink-100)" strokeWidth={2} />
        <path d={pathFor(smooth)} fill="none" stroke="var(--color-ink-100)" strokeWidth={2} />
        {/* Animated reveals */}
        <path
          d={partialPath(jagged)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={partialPath(smooth)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Metrics panel */}
      <div
        className={cx(
          'mt-4 overflow-hidden transition-all',
          done ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
        aria-hidden={!done}
      >
        <table className="w-full text-sm" id={`${id}-metrics`}>
          <thead>
            <tr className="text-ink-500">
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-right font-medium text-brand-700">{seriesLabels[0]}</th>
              <th className="py-1 text-right font-medium text-accent-600">{seriesLabels[1]}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-t border-ink-100">
                <td className="py-1.5 text-ink-700">{m.label}</td>
                <td className="py-1.5 text-right font-mono text-ink-900">{m.smooth}</td>
                <td className="py-1.5 text-right font-mono text-ink-900">{m.jagged}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
      </div>
    </figure>
  );
}

export default RiskReturnRace;
