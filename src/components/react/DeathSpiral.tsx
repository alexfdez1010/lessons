import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DeathSpiralProps {
  /** Heading above the simulation. */
  title?: string;
  /** Display name of the stablecoin (target $1). */
  stableLabel?: string;
  /** Display name of the volatile sister token (minted to defend the peg). */
  volatileLabel?: string;
  /** Label for the stablecoin price readout. */
  stablePriceLabel?: string;
  /** Label for the volatile token price readout. */
  volatilePriceLabel?: string;
  /** Label for the volatile token supply readout. */
  volatileSupplyLabel?: string;
  /** Label for the volatile-supply axis / bars. */
  supplyAxisLabel?: string;
  /** Label for the volatile-price line. */
  priceAxisLabel?: string;
  /** Status text while the peg still holds. */
  stableStatus?: string;
  /** Status text once the spiral has taken hold. */
  spiralStatus?: string;
  /** Small badge text for the calm (pegged) state. */
  pegBadge?: string;
  /** Small badge text for the collapsing state. */
  spiralBadge?: string;
  /** Button that advances one step of the spiral. */
  stepLabel?: string;
  /** Button that auto-runs the whole spiral. */
  runLabel?: string;
  /** Button that returns to the calm initial state. */
  resetLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Number of spiral steps before total collapse. Defaults to `5`. */
  steps?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}`;

const compact = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

interface SpiralState {
  /** Stablecoin price in dollars (starts at 1). */
  stablePrice: number;
  /** Volatile token price in dollars. */
  volatilePrice: number;
  /** Volatile token circulating supply. */
  volatileSupply: number;
}

/**
 * Build the deterministic trajectory of the death spiral, step 0 (calm peg)
 * through `steps` (total collapse). Each step: the stablecoin slips further
 * below $1; arbitrageurs burn it to mint $1-worth of the volatile token, so the
 * volatile *supply* balloons; that fresh supply crushes the volatile *price*,
 * which destroys confidence and drags the stablecoin lower still — minting even
 * more next round. Reflexive and self-reinforcing: both tokens race toward zero.
 */
function buildTrajectory(steps: number): SpiralState[] {
  const out: SpiralState[] = [
    { stablePrice: 1, volatilePrice: 80, volatileSupply: 350_000_000 },
  ];
  for (let i = 1; i <= steps; i += 1) {
    const prev = out[i - 1];
    const t = i / steps; // 0 → 1 as we approach collapse
    // Stablecoin slides off the peg, accelerating toward ~0.
    const stablePrice = Math.max(0.02, 1 - 0.985 * Math.pow(t, 1.4));
    // Supply balloons multiplicatively — each defense mints more than the last.
    const volatileSupply = prev.volatileSupply * (2.6 + 4 * t);
    // Price collapses toward zero as supply explodes and confidence evaporates.
    const volatilePrice = Math.max(0.01, prev.volatilePrice * (0.42 - 0.32 * t));
    out.push({ stablePrice, volatilePrice, volatileSupply });
  }
  return out;
}

/**
 * Algorithmic ("seigniorage") stablecoin death-spiral simulator — the Terra/UST
 * ↔ LUNA collapse mechanic. Two stat panels track the stablecoin's price (target
 * $1) and the volatile sister token's price *and* exploding supply. Step (or
 * auto-run) the spiral: each round the stablecoin slips below peg, the protocol
 * mints fresh volatile tokens to defend it, that supply crushes the volatile
 * price, confidence drops, and the stablecoin falls further — minting even more
 * next round. An SVG line+area shows the volatile price plunging toward zero
 * while supply bars erupt behind it. The status flips from "peg holding" to
 * "death spiral", and Reset returns to the calm state. `prefers-reduced-motion`
 * disables the per-step animation: Run jumps straight to the collapsed end-state.
 */
export function DeathSpiral({
  title = 'Algorithmic stablecoin death spiral',
  stableLabel = 'STABLE',
  volatileLabel = 'VOLATILE',
  stablePriceLabel = 'STABLE price',
  volatilePriceLabel = 'VOLATILE price',
  volatileSupplyLabel = 'VOLATILE supply',
  supplyAxisLabel = 'Supply minted',
  priceAxisLabel = 'VOLATILE price',
  stableStatus = 'Peg holding — reserve is market confidence, not cash',
  spiralStatus = 'DEATH SPIRAL — both tokens collapsing toward zero',
  pegBadge = 'Pegged',
  spiralBadge = 'Collapsing',
  stepLabel = 'Step the spiral',
  runLabel = 'Run',
  resetLabel = 'Reset',
  currencyPrefix = '$',
  caption = 'There is no cash in the vault — only the promise that 1 STABLE always mints $1 of VOLATILE. Defending the peg prints VOLATILE; printing VOLATILE crashes its price; the crash breaks the peg harder. Reflexive collapse.',
  steps = 5,
  className,
}: DeathSpiralProps) {
  const totalSteps = Math.max(2, Math.min(8, Math.round(steps)));
  const trajectory = useRef<SpiralState[]>(buildTrajectory(totalSteps));
  // Rebuild if the caller changes the step count.
  useEffect(() => {
    trajectory.current = buildTrajectory(totalSteps);
  }, [totalSteps]);

  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  const traj = trajectory.current;
  const cur = traj[Math.min(step, traj.length - 1)];
  const peak = traj[0];
  const inSpiral = step >= 1;
  const atEnd = step >= totalSteps;

  // Auto-run: advance one step at a time. With reduced motion, jump to the end.
  const handleRun = () => {
    if (atEnd || running) return;
    if (prefersReducedMotion()) {
      setStep(totalSteps);
      return;
    }
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    if (atEnd) {
      setRunning(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setStep((s) => Math.min(totalSteps, s + 1));
    }, 850);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [running, step, atEnd, totalSteps]);

  const stepOnce = () => {
    setRunning(false);
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const reset = () => {
    setRunning(false);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setStep(0);
  };

  // ---- Chart geometry -------------------------------------------------------
  const W = 520;
  const H = 220;
  const padL = 14;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = traj.length;
  const xAt = (i: number) => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);

  // Price line scaled against the starting (peak) volatile price.
  const maxPrice = peak.volatilePrice;
  const priceY = (p: number) =>
    padT + plotH - (Math.max(0, p) / maxPrice) * plotH;

  // Supply bars scaled (log) against the final, exploded supply.
  const maxSupply = traj[traj.length - 1].volatileSupply;
  const logMin = Math.log10(peak.volatileSupply);
  const logMax = Math.log10(maxSupply);
  const supplyFrac = (s: number) =>
    logMax === logMin ? 0 : (Math.log10(s) - logMin) / (logMax - logMin);

  // Only render the trajectory up to the current step.
  const shown = traj.slice(0, step + 1);
  const barW = (plotW / n) * 0.5;

  const linePoints = shown.map((d, i) => `${xAt(i)},${priceY(d.volatilePrice)}`).join(' ');
  const areaPoints =
    shown.length > 0
      ? `${xAt(0)},${padT + plotH} ${linePoints} ${xAt(shown.length - 1)},${padT + plotH}`
      : '';

  const volatileColor = inSpiral ? 'var(--color-warning)' : 'var(--color-accent-500)';

  const stablePriceClass = inSpiral ? 'text-warning' : 'text-brand-700';
  const statusClass = inSpiral
    ? 'border-warning/40 bg-warning/10 text-warning'
    : 'border-success/40 bg-success/10 text-success';
  const stableBadgeOff = step === 0;

  const ariaLabel = `${title}. Step ${step} of ${totalSteps}. ${stableLabel} price ${money(
    currencyPrefix,
    cur.stablePrice,
  )} against a $1 peg; ${volatileLabel} price ${money(
    currencyPrefix,
    cur.volatilePrice,
  )} with supply ${compact(cur.volatileSupply)}. ${
    inSpiral ? spiralStatus : stableStatus
  }`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            stableBadgeOff ? 'bg-brand-600' : 'bg-warning',
          )}
        >
          {stableBadgeOff ? pegBadge : spiralBadge}
        </span>
      </figcaption>

      {/* Stat panels */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{stablePriceLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', stablePriceClass)}>
            {money(currencyPrefix, cur.stablePrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{volatilePriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, cur.volatilePrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{volatileSupplyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {compact(cur.volatileSupply)}
          </dd>
        </div>
      </dl>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill"
            style={{ backgroundColor: volatileColor }}
            aria-hidden="true"
          />
          {priceAxisLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-ink-300"
            aria-hidden="true"
          />
          {supplyAxisLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot frame baseline */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={W - padR}
          y2={padT + plotH}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />

        {/* Supply bars erupting behind the price line */}
        {shown.map((d, i) => {
          const h = supplyFrac(d.volatileSupply) * plotH;
          return (
            <rect
              key={`bar-${i}`}
              x={xAt(i) - barW / 2}
              y={padT + plotH - h}
              width={barW}
              height={Math.max(0, h)}
              rx={2}
              fill="var(--color-ink-200)"
              opacity={0.75}
              style={{ transition: 'all 500ms ease' }}
            />
          );
        })}

        {/* Volatile price area + line plunging toward zero */}
        {shown.length > 1 && (
          <polygon points={areaPoints} fill={volatileColor} opacity={0.12} />
        )}
        {shown.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke={volatileColor}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ transition: 'stroke 500ms ease' }}
          />
        )}
        {shown.map((d, i) => (
          <circle
            key={`pt-${i}`}
            cx={xAt(i)}
            cy={priceY(d.volatilePrice)}
            r={i === shown.length - 1 ? 4.5 : 3}
            fill={volatileColor}
            style={{ transition: 'all 500ms ease' }}
          />
        ))}

        {/* Axis end labels */}
        <text x={padL} y={H - 8} fontSize="10" fill="var(--color-ink-400)">
          {compact(peak.volatileSupply)}
        </text>
        <text
          x={W - padR}
          y={H - 8}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-400)"
        >
          {compact(maxSupply)}
        </text>
      </svg>

      {/* Status line */}
      <p
        className={cx(
          'mt-3 rounded-card border px-3 py-2 text-sm font-medium',
          statusClass,
        )}
        aria-live="polite"
      >
        {inSpiral ? spiralStatus : stableStatus}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={stepOnce}
          disabled={atEnd}
          aria-label={stepLabel}
          className={cx(
            'rounded-pill px-4 py-2 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            atEnd
              ? 'cursor-not-allowed bg-ink-300'
              : 'bg-accent-600 hover:bg-accent-700',
          )}
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={atEnd}
          aria-pressed={running}
          aria-label={runLabel}
          className={cx(
            'rounded-pill px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            atEnd
              ? 'cursor-not-allowed bg-ink-100 text-ink-400'
              : running
                ? 'bg-warning text-white hover:opacity-90'
                : 'border border-ink-200 bg-surface text-ink-800 hover:bg-surface-sunken/60',
          )}
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={step === 0 && !running}
          aria-label={resetLabel}
          className={cx(
            'rounded-pill px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            step === 0 && !running
              ? 'cursor-not-allowed border border-ink-100 bg-surface text-ink-400'
              : 'border border-ink-200 bg-surface text-ink-800 hover:bg-surface-sunken/60',
          )}
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DeathSpiral;
