import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DiversifyBasketProps {
  /** Heading above the chart. */
  title?: string;
  /** Labels for the two lines (single stock, diversified basket). */
  seriesLabels?: [string, string];
  /** Button label to start the animation. */
  playLabel?: string;
  /** Button label once the animation has finished. */
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
 * Why a fund beats a single stock — drawn, not asserted. Press play and two
 * equity curves draw in together: one lone stock that lurches, crashes, and
 * panics its way upward, and a diversified basket of many holdings whose ups
 * and downs partly cancel out into a far gentler glide. Both start at 100 and
 * land near the same place, so the lesson is unmistakable — same destination,
 * calmer journey. That smoothness is the whole visual argument for funds.
 * Respects `prefers-reduced-motion` (jumps straight to the finished chart).
 */
export function DiversifyBasket({
  title = 'One stock vs. a diversified basket',
  seriesLabels = ['A single stock', 'A diversified basket'],
  playLabel = 'Play',
  replayLabel = 'Replay',
  caption = 'Both finish in nearly the same place — but the single stock takes a terrifying route, while the basket of many holdings smooths the ride because their swings partly cancel out. That calmer journey is why funds exist.',
  className,
}: DiversifyBasketProps) {
  const id = useId();
  const [progress, setProgress] = useState(0); // 0 → 1
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Two deterministic monthly equity paths (index, base 100) that both end
  // near 150 — same destination — but with very different month-to-month
  // swings. `singleStock` is jagged with deep drawdowns; `basket` glides.
  const singleStock = [
    100, 118, 92, 134, 108, 76, 122, 156, 96, 138, 110, 162, 124, 146,
  ];
  const basket = [
    100, 106, 109, 113, 116, 120, 123, 127, 131, 134, 138, 141, 145, 148,
  ];

  const W = 520;
  const H = 220;
  const padX = 8;
  const padY = 14;
  const minV = 70;
  const maxV = 165;
  const n = singleStock.length;

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
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {seriesLabels[0]}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {seriesLabels[1]}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${seriesLabels[0]} swings wildly with deep drops, while ${seriesLabels[1]} rises smoothly — both ending in nearly the same place.`}
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
        <path d={pathFor(singleStock)} fill="none" stroke="var(--color-ink-100)" strokeWidth={2} />
        <path d={pathFor(basket)} fill="none" stroke="var(--color-ink-100)" strokeWidth={2} />
        {/* Animated reveals */}
        <path
          d={partialPath(singleStock)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={partialPath(basket)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Caption / status, revealed once finished */}
      <div
        className={cx(
          'mt-4 overflow-hidden transition-all',
          done ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
        aria-hidden={!done}
      >
        <p
          className="text-sm leading-relaxed text-ink-600"
          id={`${id}-caption`}
          aria-live="polite"
        >
          {caption}
        </p>
      </div>
    </figure>
  );
}

export default DiversifyBasket;
