import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface IntentSolverAuctionProps {
  /** Heading above the chart. */
  title?: string;
  /** Button label to start the auction. */
  playLabel?: string;
  /** Button label once the auction has filled. */
  replayLabel?: string;
  /** Legend for the decaying guaranteed-output curve. */
  curveLabel?: string;
  /** Legend for the dashed market-value line. */
  marketLabel?: string;
  /** Badge text at the fill point. */
  fillLabel?: string;
  /** Names of the competing solvers, cheapest first. */
  solverLabels?: string[];
  /** Readout label for what the user receives. */
  userGetsLabel?: string;
  /** Readout label for the winning solver's net edge. */
  solverKeepsLabel?: string;
  /** Money suffix appended to every formatted number, e.g. `' USDC'`. */
  unitSuffix?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Market value of the user's 1 ETH, in USDC. */
const MARKET = 2000;
/** Number of auction steps (blocks). */
const N = 10;
/** Guaranteed output at step 0 — deliberately *above* market so no solver fills at a loss. */
const START_OUT = 2030;
/** Guaranteed output at the final step — the auction floor. */
const FLOOR_OUT = 1970;
/** Fixed per-fill costs of the three solvers, cheapest first. */
const SOLVER_COSTS = [6, 14, 24];

/** Linearly decaying guaranteed output to the user at step `t` (0..N-1). */
const outAt = (t: number): number =>
  START_OUT - (START_OUT - FLOOR_OUT) * (t / (N - 1));

/**
 * A UniswapX-style Dutch auction run over a user's signed intent ("sell 1 ETH
 * for as much USDC as possible"). The output *guaranteed* to the user starts
 * **above** the market price — so no solver can fill at a loss — and decays
 * linearly across the auction window. Three competing solvers each carry a fixed
 * cost; a solver can fill at step `t` only when `market - out(t) >= cost`, i.e.
 * it can source the ETH at market and still profit after delivering `out(t)` to
 * the user and paying its cost. The auction fills at the **first** step where the
 * cheapest solver clears that bar (the cheapest one always wins — it needs the
 * least margin), so competition routes the price improvement straight back to
 * the user: the earlier the curve is caught, the more the user keeps.
 *
 * On play, a marker descends the decay curve step by step via
 * `requestAnimationFrame`; when it reaches the fill step it stops and a fill
 * marker, a vertical drop line, and a badge appear, while a readout reveals what
 * the user received and the winning solver's (small) net edge. Respects
 * `prefers-reduced-motion` by jumping straight to the filled state.
 */
export function IntentSolverAuction({
  title = 'A Dutch auction over your intent',
  playLabel = 'Run the auction',
  replayLabel = 'Replay',
  curveLabel = 'Output guaranteed to you',
  marketLabel = 'Market value',
  fillLabel = 'Filled here',
  solverLabels = ['Solver A (cheapest)', 'Solver B', 'Solver C'],
  userGetsLabel = 'You receive',
  solverKeepsLabel = 'Winning solver keeps',
  unitSuffix = ' USDC',
  caption = 'The guaranteed output starts above market and decays — and the cheapest solver pounces the instant filling turns profitable. Their thin margin is everything competition couldn’t shave off; the rest of the price improvement lands in your wallet.',
  className,
}: IntentSolverAuctionProps) {
  const id = useId();
  const [step, setStep] = useState(0); // current marker step along the curve
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  // ── Deterministic auction resolution ────────────────────────────────────
  // The cheapest solver needs the least margin, so it always wins. Scan steps
  // and fill at the FIRST one where market - out(t) >= cheapest cost.
  const cheapestCost = Math.min(...SOLVER_COSTS);
  const winningIndex = SOLVER_COSTS.indexOf(cheapestCost);
  let fillStep = N - 1;
  for (let t = 0; t < N; t += 1) {
    if (MARKET - outAt(t) >= cheapestCost) {
      fillStep = t;
      break;
    }
  }
  const userGets = outAt(fillStep);
  const solverKeeps = MARKET - userGets - cheapestCost;
  const winningSolver = solverLabels[winningIndex] ?? solverLabels[0] ?? '';

  // ── Money formatting: integer with thousands separators + suffix ─────────
  const fmt = (v: number): string =>
    `${Math.round(v).toLocaleString('en-US')}${unitSuffix}`;

  // ── Chart geometry ───────────────────────────────────────────────────────
  const W = 520;
  const H = 240;
  const padX = 40;
  const padY = 18;
  const minV = 1960;
  const maxV = 2040;

  const x = (i: number) => padX + (i / (N - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const curvePath = Array.from({ length: N }, (_, i) => i)
    .map((i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(outAt(i))}`)
    .join(' ');

  // ── Play / replay ─────────────────────────────────────────────────────────
  const start = () => {
    if (prefersReducedMotion()) {
      setStep(fillStep);
      setDone(true);
      setPlaying(false);
      return;
    }
    setDone(false);
    setStep(0);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const perStep = 260; // ms the marker spends descending one step
    let startTs: number | null = null;
    const animate = (ts: number) => {
      if (startTs === null) startTs = ts;
      const elapsed = ts - startTs;
      const s = Math.min(fillStep, Math.floor(elapsed / perStep));
      setStep(s);
      if (s < fillStep) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setPlaying(false);
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, fillStep]);

  const markerStep = done ? fillStep : step;
  const markerX = x(markerStep);
  const markerY = y(outAt(markerStep));

  const ariaLabel =
    `${title}. ${curveLabel} starts at ${fmt(START_OUT)} above the ${marketLabel.toLowerCase()} of ` +
    `${fmt(MARKET)} and decays over ${N} steps. The cheapest solver fills at step ${fillStep + 1}, ` +
    `where you receive ${fmt(userGets)} and the winning solver keeps ${fmt(solverKeeps)}.`;

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
          {curveLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-0 w-5 border-t-2 border-dashed border-accent-500"
            aria-hidden="true"
          />
          {marketLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Market value line (dashed) */}
        <line
          x1={padX}
          y1={y(MARKET)}
          x2={W - padX}
          y2={y(MARKET)}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={W - padX}
          y={y(MARKET) - 6}
          textAnchor="end"
          className="font-mono"
          fontSize="11"
          fill="var(--color-accent-600)"
        >
          {fmt(MARKET)}
        </text>

        {/* Faint full decay curve for reference */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-ink-200)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />

        {/* Drawn portion of the curve up to the current marker */}
        <path
          d={Array.from({ length: markerStep + 1 }, (_, i) => i)
            .map((i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(outAt(i))}`)
            .join(' ')}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Step ticks along the curve */}
        {Array.from({ length: N }, (_, i) => i).map((i) => (
          <circle
            key={`tick-${i}`}
            cx={x(i)}
            cy={y(outAt(i))}
            r={2.5}
            fill="var(--color-ink-100)"
          />
        ))}

        {/* Fill: vertical drop line + marker + badge, once resolved */}
        {done && (
          <g>
            <line
              x1={markerX}
              y1={markerY}
              x2={markerX}
              y2={H - padY}
              stroke="var(--color-brand-400)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle
              cx={markerX}
              cy={markerY}
              r={7}
              fill="var(--color-brand-600)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
            <rect
              x={Math.min(markerX + 8, W - 86)}
              y={Math.max(markerY - 24, padY)}
              width={78}
              height={18}
              rx={9}
              fill="var(--color-brand-600)"
            />
            <text
              x={Math.min(markerX + 8, W - 86) + 39}
              y={Math.max(markerY - 24, padY) + 13}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--color-surface)"
            >
              {fillLabel}
            </text>
          </g>
        )}

        {/* Descending marker while playing */}
        {!done && playing && (
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="var(--color-brand-500)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Readout */}
      <dl
        className={cx(
          'mt-4 grid grid-cols-1 gap-3 text-sm transition-all sm:grid-cols-2',
          done ? 'opacity-100' : 'opacity-60',
        )}
        aria-live="polite"
      >
        <div className="rounded-card border border-brand-200 bg-brand-50 px-3 py-2">
          <dt className="text-ink-500">{userGetsLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(userGets)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {solverKeepsLabel}
            <span className="ml-1 text-ink-400">· {winningSolver}</span>
          </dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmt(solverKeeps)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600" id={`${id}-caption`}>
        {caption}
      </p>
    </figure>
  );
}

export default IntentSolverAuction;
