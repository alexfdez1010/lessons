import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FundingRateConvergeProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway under the figure. */
  caption?: string;
  /** Label for the perpetual (mark) price line. */
  perpLabel?: string;
  /** Label for the index (spot) price line. */
  indexLabel?: string;
  /** Label for the premium / funding readout. */
  premiumLabel?: string;
  /** Label for the "play" button. */
  playLabel?: string;
  /** Label for the "pause" button. */
  pauseLabel?: string;
  /** Label for the "reset" button. */
  resetLabel?: string;
  /** Label for the premium slider (initial perp premium over index). */
  premiumSliderLabel?: string;
  /** Banner text when perp trades above index (longs pay shorts). */
  longsPayLabel?: string;
  /** Banner text when perp trades below index (shorts pay longs). */
  shortsPayLabel?: string;
  /** Banner text when perp is at parity. */
  parityLabel?: string;
  /** Currency prefix. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Index (spot) price the perp converges toward. Defaults to `30000`. */
  indexPrice?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const W = 560;
const H = 260;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 36;
const STEPS = 120;

/**
 * Animated funding-rate convergence. A perpetual-future "mark" price starts at a
 * premium (or discount) to the underlying index/spot price. Each tick, the
 * funding-rate mechanism nudges the perp back toward the index: when the perp is
 * above index the funding rate is positive (longs pay shorts), which discourages
 * longs and pulls the price down; below index it flips. The two lines visibly
 * close the gap over time, while a live banner names who is paying whom. The
 * learner sets the starting premium and can play / pause / reset. The decay is a
 * simple geometric pull toward the index — locale-agnostic, no numbers baked in.
 */
export function FundingRateConverge({
  title = 'How funding drags the perp back to the index',
  caption = 'A perpetual has no expiry to force convergence, so a periodic funding payment does the job. When the perp trades above the index, funding is positive and longs pay shorts — that cost bleeds longs out and pulls the price back down. Below the index it reverses. Watch the gap close.',
  perpLabel = 'Perp (mark) price',
  indexLabel = 'Index (spot) price',
  premiumLabel = 'Premium',
  playLabel = 'Play',
  pauseLabel = 'Pause',
  resetLabel = 'Reset',
  premiumSliderLabel = 'Starting premium',
  longsPayLabel = 'Perp above index → funding positive → longs pay shorts',
  shortsPayLabel = 'Perp below index → funding negative → shorts pay longs',
  parityLabel = 'Perp ≈ index → funding ≈ 0',
  currencyPrefix = '$',
  indexPrice = 30000,
  className,
}: FundingRateConvergeProps) {
  const id = useId();
  // Starting premium as a percentage of the index price (-3% … +3%).
  const [premiumPct, setPremiumPct] = useState(2);
  // Number of elapsed ticks (0 … STEPS).
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);

  // The perp price path: index * (1 + premium * decay^t). Decay pulls to index.
  const decay = 0.965;
  const startPremium = premiumPct / 100;

  const perpAt = (t: number) => indexPrice * (1 + startPremium * Math.pow(decay, t));

  const livePremiumFrac = startPremium * Math.pow(decay, tick);
  const livePerp = perpAt(tick);

  // Animation loop.
  useEffect(() => {
    if (!playing) return;
    if (prefersReducedMotion()) {
      setTick(STEPS);
      setPlaying(false);
      return;
    }
    const stepFn = (ts: number) => {
      if (lastTs.current === null) lastTs.current = ts;
      const dt = ts - lastTs.current;
      if (dt > 28) {
        lastTs.current = ts;
        setTick((t) => {
          const next = t + 1;
          if (next >= STEPS) {
            setPlaying(false);
            return STEPS;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTs.current = null;
    };
  }, [playing]);

  // Y-axis domain: a little beyond the largest possible premium.
  const span = Math.max(0.035, Math.abs(startPremium) * 1.25);
  const yMax = indexPrice * (1 + span);
  const yMin = indexPrice * (1 - span);

  const sx = (t: number) => PAD_L + (t / STEPS) * (W - PAD_L - PAD_R);
  const sy = (price: number) =>
    PAD_T + ((yMax - price) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  // Perp path up to the current tick.
  const perpPath = useMemo(() => {
    const pts: string[] = [];
    for (let t = 0; t <= tick; t++) {
      pts.push(`${t === 0 ? 'M' : 'L'}${sx(t).toFixed(1)} ${sy(perpAt(t)).toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, premiumPct, indexPrice]);

  const indexY = sy(indexPrice);

  const zone =
    Math.abs(livePremiumFrac) < 0.0008 ? 'parity' : livePremiumFrac > 0 ? 'longs' : 'shorts';
  const banner =
    zone === 'longs' ? longsPayLabel : zone === 'shorts' ? shortsPayLabel : parityLabel;
  const bannerClass =
    zone === 'longs'
      ? 'border-red-200 bg-red-50 text-red-700'
      : zone === 'shorts'
        ? 'border-accent-200 bg-accent-50 text-accent-700'
        : 'border-ink-200 bg-surface-sunken/60 text-ink-700';

  const money = (v: number) =>
    `${currencyPrefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;
  const pct = (f: number) =>
    `${f >= 0 ? '+' : ''}${(f * 100).toFixed(2)}%`;

  const reset = () => {
    setPlaying(false);
    setTick(0);
    lastTs.current = null;
  };

  const aria = `${perpLabel} ${money(livePerp)}, ${indexLabel} ${money(indexPrice)}, ${premiumLabel} ${pct(livePremiumFrac)}. ${banner}`;

  const buttonBase =
    'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white tabular-nums">
          {premiumLabel}: {pct(livePremiumFrac)}
        </span>
      </figcaption>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-brand-500" aria-hidden="true" />
          {perpLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-0 w-5 border-t-2 border-dashed border-ink-400" aria-hidden="true" />
          {indexLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={aria}>
        {/* Index baseline */}
        <line
          x1={PAD_L}
          y1={indexY}
          x2={W - PAD_R}
          y2={indexY}
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <text x={W - PAD_R} y={indexY - 6} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
          {money(indexPrice)}
        </text>

        {/* Axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--color-ink-200)" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--color-ink-200)" />
        <text x={PAD_L} y={H - 10} fontSize="9" fill="var(--color-ink-400)">
          time →
        </text>

        {/* Perp path */}
        <path d={perpPath} fill="none" stroke="var(--color-brand-600)" strokeWidth={2.5} />
        {/* Live perp point */}
        <circle cx={sx(tick)} cy={sy(livePerp)} r={6} fill="var(--color-brand-600)" />
      </svg>

      <div aria-live="polite">
        <p className={cx('mt-2 rounded-card border px-3 py-2 text-sm font-medium', bannerClass)}>
          {banner}
        </p>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${id}-prem`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{premiumSliderLabel}</span>
          <span className="font-mono text-ink-900 tabular-nums">{pct(startPremium)}</span>
        </label>
        <input
          id={`${id}-prem`}
          type="range"
          min={-3}
          max={3}
          step={0.25}
          value={premiumPct}
          onChange={(e) => {
            setPremiumPct(Number(e.target.value));
            reset();
          }}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={tick >= STEPS}
          className={cx(
            buttonBase,
            tick >= STEPS
              ? 'cursor-not-allowed bg-ink-200 text-ink-400'
              : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {playing ? pauseLabel : playLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={tick === 0 && !playing}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
            tick === 0 && !playing && 'cursor-not-allowed opacity-50',
          )}
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FundingRateConverge;
