import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SignalDecayProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the decay-speed (τ) slider. */
  decayLabel?: string;
  /** Label for the transaction-cost slider. */
  costLabel?: string;
  /** Label for the signal half-life readout chip. */
  halfLifeLabel?: string;
  /** Label for the optimal-horizon readout chip. */
  optimalLabel?: string;
  /** Legend label for the IC (signal strength) decay curve. */
  icLabel?: string;
  /** Legend label for the net-alpha-per-day curve. */
  netAlphaLabel?: string;
  /** Caption for the horizon (x) axis. */
  horizonAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const H_MAX = 40; // maximum holding horizon plotted, in days
const GRID = 240; // sampling resolution along the horizon axis
const IC0 = 0.12; // information coefficient at horizon → 0 (a strong-ish signal)
const A0 = 100; // total gross alpha (bps) capturable if you held forever
const LN2 = Math.log(2);

// Information coefficient as a function of holding horizon h:
//   IC(h) = IC0 · exp(−h / τ)
// — predictive correlation bleeds away geometrically as you hold longer.
const icAt = (h: number, tau: number): number => IC0 * Math.exp(-h / tau);

// Gross cumulative alpha captured by holding h days, in bps. You scoop up more
// of the signal the longer you wait, but it saturates toward A0:
//   gross(h) = A0 · (1 − exp(−h / τ))
const grossAt = (h: number, tau: number): number => A0 * (1 - Math.exp(-h / tau));

// Net alpha per day after paying one round-trip cost spread over h days:
//   net(h) = [gross(h) − cost] / h   (guard h > 0)
const netPerDayAt = (h: number, tau: number, cost: number): number =>
  h > 0 ? (grossAt(h, tau) - cost) / h : -Infinity;

/**
 * Alpha signal decay in statistical arbitrage. A signal's predictive power — its
 * information coefficient IC, the correlation between the signal today and the
 * forward return — fades as the holding horizon h lengthens: IC(h) = IC0·e^(−h/τ),
 * a clean exponential decay with half-life τ·ln2. The brand curve plots that decay.
 *
 * The accent curve is the punchline: net alpha *per day* after transaction costs.
 * Hold too short and you re-trade constantly, paying the round-trip cost again and
 * again before the signal has paid off; hold too long and the signal has decayed to
 * noise. So net = [A0·(1 − e^(−h/τ)) − cost] / h is hump-shaped, peaking at an
 * optimal horizon h* marked with a vertical line and a dot. Two sliders drive it:
 * faster decay (smaller τ) pulls h* shorter; larger costs push h* longer (you must
 * hold to amortize the spread). The curves sweep in left-to-right on mount,
 * respecting `prefers-reduced-motion`.
 */
export function SignalDecay({
  title = 'Signal decay: why every alpha has an optimal holding horizon',
  decayLabel = 'Signal decay speed (τ, days)',
  costLabel = 'Round-trip cost (bps)',
  halfLifeLabel = 'Signal half-life',
  optimalLabel = 'Optimal horizon',
  icLabel = 'Signal strength (IC)',
  netAlphaLabel = 'Net alpha / day (after costs)',
  horizonAxisLabel = 'Holding horizon h (days)',
  caption = 'A signal predicts the next few days, then goes stale — its information coefficient decays exponentially with how long you hold. But re-trading is not free: hold too briefly and you bleed the round-trip cost over and over; hold too long and you are trading on noise. Net alpha per day is therefore hump-shaped, peaking at an optimal horizon. Speed the decay up and that sweet spot moves earlier; raise the cost and it moves later, because you have to hold longer to earn back the spread.',
  className,
}: SignalDecayProps) {
  const id = useId();
  // τ stored ×1 in days; slider range 2..20 days of decay constant.
  const [tau, setTau] = useState(8);
  // Round-trip cost in bps; slider range 5..120.
  const [cost, setCost] = useState(40);
  const [progress, setProgress] = useState(0); // 0 → 1 reveal animation
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 30;

  // Reveal animation: sweep the curves in left-to-right on mount and whenever
  // the inputs change so the effect of a slider tug is easy to see.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 700;
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
  }, [tau, cost]);

  // Sample both curves across the horizon grid.
  const icSeries: number[] = [];
  const netSeries: number[] = [];
  for (let i = 0; i <= GRID; i++) {
    const h = (i / GRID) * H_MAX;
    icSeries.push(icAt(h, tau));
    netSeries.push(netPerDayAt(h, tau, cost));
  }

  // Find the optimal horizon h* = argmax of net alpha per day over the grid.
  let bestIdx = 1;
  let bestNet = -Infinity;
  for (let i = 1; i <= GRID; i++) {
    if (netSeries[i] > bestNet) {
      bestNet = netSeries[i];
      bestIdx = i;
    }
  }
  const hStar = (bestIdx / GRID) * H_MAX;

  // Axis bounds. IC is scaled on its own [0, IC0] band; net alpha gets its own
  // [min, max] band so both fit the same box. Finite net values only.
  const finiteNet = netSeries.filter((v) => Number.isFinite(v));
  let netMax = Math.max(0, ...finiteNet);
  let netMin = Math.min(0, ...finiteNet);
  const netSpan = netMax - netMin || 1;
  netMax += netSpan * 0.08;
  netMin -= netSpan * 0.08;

  const icMax = IC0 * 1.06;

  const xToPx = (h: number) => padLeft + (h / H_MAX) * (W - padLeft - padRight);
  const icToPx = (ic: number) =>
    padTop + (1 - ic / icMax) * (H - padTop - padBottom);
  const netToPx = (n: number) =>
    padTop + (1 - (n - netMin) / (netMax - netMin)) * (H - padTop - padBottom);

  // How many grid samples to draw given the reveal progress.
  const drawn = Math.max(1, Math.round(GRID * progress));

  const seriesToD = (
    series: number[],
    toPx: (v: number) => number,
  ): string => {
    let d = '';
    const last = Math.min(drawn, series.length - 1);
    for (let i = 0; i <= last; i++) {
      const h = (i / GRID) * H_MAX;
      if (!Number.isFinite(series[i])) continue;
      d += `${d === '' ? 'M' : 'L'} ${xToPx(h).toFixed(2)} ${toPx(series[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  const baseY = H - padBottom;
  const tauText = tau.toFixed(0);
  const costText = cost.toFixed(0);
  const halfLife = tau * LN2; // signal half-life in days
  const halfLifeText = halfLife.toFixed(1);
  const hStarText = hStar.toFixed(1);
  const bestNetText = Number.isFinite(bestNet) ? bestNet.toFixed(1) : '—';

  // Only mark the optimum once the reveal has reached it.
  const optimumRevealed = bestIdx <= drawn;
  const hStarX = xToPx(hStar);
  const hStarY = netToPx(bestNet);

  // Three horizon gridlines along the x axis.
  const hGrid = [0, H_MAX / 2, H_MAX];

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
          {icLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {netAlphaLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 border-l border-dashed border-ink-400"
            aria-hidden="true"
          />
          {`${optimalLabel} h*`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Two curves against holding horizon in days. The signal strength (information coefficient) decays exponentially from ${IC0.toFixed(2)} with a half-life of about ${halfLifeText} days as the decay constant τ = ${tauText}. Net alpha per day after a ${costText} bps round-trip cost is hump-shaped and peaks at an optimal holding horizon of about ${hStarText} days, where net alpha is about ${bestNetText} bps per day.`}
      >
        {/* Horizon gridlines + x labels */}
        {hGrid.map((h, i) => {
          const gx = xToPx(h);
          return (
            <g key={`xgrid-${i}`}>
              <line
                x1={gx}
                y1={padTop}
                x2={gx}
                y2={baseY}
                stroke="var(--color-ink-100)"
              />
              <text
                x={gx}
                y={H - 14}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor={i === 0 ? 'start' : i === hGrid.length - 1 ? 'end' : 'middle'}
              >
                {h.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Baseline (horizon axis) */}
        <line
          x1={padLeft}
          y1={baseY}
          x2={W - padRight}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Zero line for net alpha (where holding stops being worth the cost) */}
        {netMin < 0 && netMax > 0 && (
          <line
            x1={padLeft}
            y1={netToPx(0)}
            x2={W - padRight}
            y2={netToPx(0)}
            stroke="var(--color-ink-200)"
            strokeDasharray="3 4"
          />
        )}

        {/* IC decay curve (brand) */}
        <path
          d={seriesToD(icSeries, icToPx)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeOpacity={0.9}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Net-alpha-per-day curve (accent) */}
        <path
          d={seriesToD(netSeries, netToPx)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeOpacity={0.9}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Optimal-horizon marker: vertical line + dot at the hump peak */}
        {optimumRevealed && Number.isFinite(bestNet) && (
          <g>
            <line
              x1={hStarX}
              y1={padTop}
              x2={hStarX}
              y2={baseY}
              stroke="var(--color-ink-400)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <circle
              cx={hStarX}
              cy={hStarY}
              r={4.5}
              fill="var(--color-accent-500)"
              stroke="var(--color-surface)"
              strokeWidth={1.5}
            />
            <text
              x={hStarX + (hStar < H_MAX * 0.75 ? 6 : -6)}
              y={padTop + 10}
              fontSize={10}
              fontWeight={600}
              fill="var(--color-ink-700)"
              textAnchor={hStar < H_MAX * 0.75 ? 'start' : 'end'}
            >
              {`h* ≈ ${hStarText}d`}
            </text>
          </g>
        )}

        {/* Y-axis hint (left = IC scale top) */}
        <text
          x={padLeft - 6}
          y={icToPx(icMax) + 3}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {IC0.toFixed(2)}
        </text>
        <text
          x={padLeft - 6}
          y={baseY + 3}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          0
        </text>

        {/* X-axis caption */}
        <text
          x={(padLeft + W - padRight) / 2}
          y={H - 2}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="middle"
        >
          {horizonAxisLabel}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{halfLifeLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{`${halfLifeText} d`}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{optimalLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{`${hStarText} d`}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{netAlphaLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{`${bestNetText} bps/d`}</span>
        </span>
      </div>

      {/* Decay-speed (τ) slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-tau`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{decayLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {tauText}
          </span>
        </label>
        <input
          id={`${id}-tau`}
          type="range"
          min={2}
          max={20}
          step={1}
          value={tau}
          onChange={(e) => setTau(Number(e.target.value))}
          aria-valuetext={`decay constant τ = ${tauText} days, signal half-life about ${halfLifeText} days`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Transaction-cost slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-cost`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{costLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {costText}
          </span>
        </label>
        <input
          id={`${id}-cost`}
          type="range"
          min={5}
          max={120}
          step={5}
          value={cost}
          onChange={(e) => setCost(Number(e.target.value))}
          aria-valuetext={`round-trip cost ${costText} basis points, optimal holding horizon about ${hStarText} days`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SignalDecay;
