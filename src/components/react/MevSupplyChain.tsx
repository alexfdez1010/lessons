import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One stage in the MEV supply chain (PBS / MEV-Boost pipeline). */
export interface MevStage {
  /** Display name of the stage (e.g. "Searcher"). */
  name: string;
  /** Short description of what this stage does. */
  role: string;
}

export interface MevSupplyChainProps {
  /** Heading above the diagram. */
  title?: string;
  /**
   * The pipeline stages, in order. Defaults to the five-stage MEV-Boost
   * pipeline: User/Wallet → Searcher → Builder → Relay → Proposer/Validator.
   * Each stage is `{ name, role }`.
   */
  stages?: MevStage[];
  /**
   * Labels for the item flowing along each arrow, one per stage boundary
   * (so `flowLabels.length` should be `stages.length - 1`). Describes what
   * travels from stage *i* to stage *i+1* (a transaction, a bundle, a block,
   * a signed header).
   */
  flowLabels?: string[];
  /** Label for the value/bid flowing back from the builder to the proposer. */
  bidLabel?: string;
  /** Label for the MEV payment that the proposer ultimately captures. */
  paymentLabel?: string;
  /** Label for the "previous step" control. */
  prevLabel?: string;
  /** Label for the "next step" control. */
  nextLabel?: string;
  /** Label for the play control (starts auto-advance). */
  playLabel?: string;
  /** Label for the pause control (stops auto-advance). */
  pauseLabel?: string;
  /** Label for the restart/reset control. */
  resetLabel?: string;
  /** Prefix announcing the active stage to screen readers (e.g. "Step"). */
  stepAnnouncePrefix?: string;
  /** Word joining the step number and total (e.g. "of" → "Step 2 of 5"). */
  stepAnnounceOf?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_STAGES: MevStage[] = [
  {
    name: 'User / Wallet',
    role: 'Signs a transaction and broadcasts it — wanting it included, but with no say over where it lands in the block.',
  },
  {
    name: 'Searcher',
    role: 'Scans pending transactions for MEV (arbitrage, liquidations), then packages a profitable, precisely ordered bundle.',
  },
  {
    name: 'Builder',
    role: 'Assembles many bundles and transactions into a full, ordered block and computes how much it can pay to have it proposed.',
  },
  {
    name: 'Relay',
    role: 'Runs a sealed-bid auction: it holds builders’ blocks, escrows them, and exposes only the header + bid so no one can steal the order.',
  },
  {
    name: 'Proposer / Validator',
    role: 'Picks the highest-paying header and signs it — committing to a block it never saw the contents of, and pocketing the bid.',
  },
];

const DEFAULT_FLOWS = ['transaction', 'bundle', 'block', 'signed header'];

/**
 * Animated walkthrough of Proposer-Builder Separation (PBS) and the MEV supply
 * chain on Ethereum — the MEV-Boost pipeline. A user's transaction flows left
 * to right through Searcher → Builder → Relay → Proposer/Validator: each stage
 * lights up in turn, an item (a transaction, a bundle, a block, a signed
 * header) animates along the arrow into it, and a description spells out what
 * that stage does. A separate value arrow runs *backward* from builder to
 * proposer to make the core economic point visible — the proposer captures the
 * MEV *payment* (the winning bid) without ever ordering the block itself, so
 * the right to ORDER is separated from the right to PROPOSE.
 *
 * The learner steps through with Prev/Next, or auto-plays with Play/Pause.
 * `prefers-reduced-motion` snaps the highlight (no token travel, no auto-play).
 * Fully locale-agnostic: every user-facing string is a prop.
 */
export function MevSupplyChain({
  title = 'The MEV supply chain (PBS / MEV-Boost)',
  stages = DEFAULT_STAGES,
  flowLabels = DEFAULT_FLOWS,
  bidLabel = 'bid (ETH)',
  paymentLabel = 'MEV payment',
  prevLabel = 'Previous step',
  nextLabel = 'Next step',
  playLabel = 'Play',
  pauseLabel = 'Pause',
  resetLabel = 'Restart',
  stepAnnouncePrefix = 'Step',
  stepAnnounceOf = 'of',
  caption = 'Proposer-Builder Separation splits the right to ORDER a block (searchers and builders compete to assemble the most valuable ordering) from the right to PROPOSE it (the validator just signs the highest-paying header). The relay’s sealed-bid auction lets the proposer collect the MEV without ever seeing — or choosing — the transactions inside.',
  className,
}: MevSupplyChainProps) {
  const id = useId();
  const n = stages.length;

  // -1 = nothing active yet (item parked at the start); 0..n-1 = active stage.
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Animated travel of the item INTO the active stage (0 → 1).
  const [travel, setTravel] = useState(1);
  const [reduced, setReduced] = useState(false);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect reduced-motion once on mount (and snap travel when set).
  useEffect(() => {
    const r = prefersReducedMotion();
    setReduced(r);
    if (r) setTravel(1);
  }, []);

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Animate the item travelling into the active stage whenever it changes.
  useEffect(() => {
    if (reduced) {
      setTravel(1);
      return;
    }
    stopRaf();
    setTravel(0);
    const duration = 520;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setTravel(eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return stopRaf;
  }, [active, reduced]);

  // Auto-advance when playing. Disabled under reduced motion.
  useEffect(() => {
    if (!playing || reduced) return;
    stopTimer();
    timerRef.current = setTimeout(() => {
      setActive((a) => (a >= n - 1 ? 0 : a + 1));
    }, 1700);
    return stopTimer;
  }, [playing, active, reduced, n]);

  useEffect(
    () => () => {
      stopRaf();
      stopTimer();
    },
    [],
  );

  const goPrev = () => {
    setPlaying(false);
    setActive((a) => Math.max(0, a - 1));
  };
  const goNext = () => {
    setPlaying(false);
    setActive((a) => Math.min(n - 1, a + 1));
  };
  const reset = () => {
    setPlaying(false);
    setActive(0);
  };
  const togglePlay = () => {
    if (reduced) return;
    setPlaying((p) => !p);
  };

  // Geometry. A single row of stage cards joined by arrows; on narrow screens
  // the SVG simply scales down and the stage list below stacks (handled in DOM,
  // not SVG). The proposer is the last stage; the bid arrow loops back to it.
  const W = 720;
  const H = 220;
  const padX = 12;
  const laneY = 96;
  const cardW = (W - padX * 2 - (n - 1) * 26) / n;
  const cardH = 74;
  const cardY = laneY - cardH / 2;
  const cardX = (i: number) => padX + i * (cardW + 26);
  const cardCx = (i: number) => cardX(i) + cardW / 2;

  // The active stage's incoming arrow (from stage active-1). For the first
  // stage there is no incoming arrow, so the item simply parks inside it.
  const fromI = Math.max(0, active - 1);
  const arrowFromX = cardX(fromI) + cardW;
  const arrowToX = cardX(active);
  const tokenX =
    active === 0
      ? cardCx(0)
      : arrowFromX + (arrowToX - arrowFromX) * travel;
  const tokenY = laneY;
  const showToken = active === 0 ? false : true;

  // Builder & proposer indices for the value/bid back-arrow (builder → proposer).
  // Use the configured count: builder is the antepenultimate, proposer is last.
  const proposerI = n - 1;
  const builderI = Math.max(0, n - 3);
  const bidFromX = cardCx(builderI);
  const bidToX = cardCx(proposerI);
  const bidY = laneY + cardH / 2 + 30;

  const activeStage = stages[active];
  const incomingFlow =
    active > 0 ? flowLabels[Math.min(active - 1, flowLabels.length - 1)] : undefined;

  const announce = `${stepAnnouncePrefix} ${active + 1} ${stepAnnounceOf} ${n}: ${
    activeStage?.name ?? ''
  }. ${activeStage?.role ?? ''}${
    incomingFlow ? ` (${incomingFlow})` : ''
  }`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {stepAnnouncePrefix} {active + 1}/{n}
        </span>
      </figcaption>

      {/* Pipeline diagram */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. ${announce}`}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-ink-300)" />
          </marker>
          <marker
            id={`${id}-bidarrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-accent-600)" />
          </marker>
        </defs>

        {/* Forward arrows between consecutive stages */}
        {stages.slice(0, -1).map((_, i) => {
          const x1 = cardX(i) + cardW + 3;
          const x2 = cardX(i + 1) - 3;
          const isActiveEdge = i + 1 === active;
          const flow = flowLabels[Math.min(i, flowLabels.length - 1)];
          return (
            <g key={`${id}-edge-${i}`}>
              <line
                x1={x1}
                y1={laneY}
                x2={x2}
                y2={laneY}
                stroke={
                  isActiveEdge ? 'var(--color-brand-500)' : 'var(--color-ink-200)'
                }
                strokeWidth={isActiveEdge ? 2.5 : 2}
                markerEnd={`url(#${id}-arrow)`}
              />
              {flow && (
                <text
                  x={(x1 + x2) / 2}
                  y={laneY - 9}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={isActiveEdge ? 700 : 500}
                  fill={
                    isActiveEdge
                      ? 'var(--color-brand-700)'
                      : 'var(--color-ink-400)'
                  }
                >
                  {flow}
                </text>
              )}
            </g>
          );
        })}

        {/* Value / bid arrow flowing BACK from builder → proposer */}
        {proposerI > builderI && (
          <g>
            <path
              d={`M ${bidFromX} ${bidY} L ${bidToX} ${bidY}`}
              fill="none"
              stroke="var(--color-accent-600)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              markerEnd={`url(#${id}-bidarrow)`}
            />
            <text
              x={(bidFromX + bidToX) / 2}
              y={bidY + 16}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="var(--color-accent-600)"
            >
              {bidLabel} → {paymentLabel}
            </text>
            {/* connector ticks from each card down to the bid lane */}
            <line
              x1={bidFromX}
              y1={cardY + cardH}
              x2={bidFromX}
              y2={bidY}
              stroke="var(--color-accent-300)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <line
              x1={bidToX}
              y1={cardY + cardH}
              x2={bidToX}
              y2={bidY}
              stroke="var(--color-accent-300)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
          </g>
        )}

        {/* Stage cards */}
        {stages.map((stage, i) => {
          const isActive = i === active;
          const isDone = i < active;
          return (
            <g key={`${id}-stage-${i}`}>
              <rect
                x={cardX(i)}
                y={cardY}
                width={cardW}
                height={cardH}
                rx={10}
                fill={
                  isActive
                    ? 'var(--color-brand-600)'
                    : isDone
                      ? 'var(--color-brand-50)'
                      : 'var(--color-surface-sunken)'
                }
                stroke={
                  isActive
                    ? 'var(--color-brand-700)'
                    : 'var(--color-ink-200)'
                }
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <text
                x={cardCx(i)}
                y={cardY + 22}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={isActive ? 'var(--color-surface)' : 'var(--color-ink-400)'}
              >
                {i + 1}
              </text>
              {/* stage name, wrapped to two short lines via two tspans */}
              <text
                x={cardCx(i)}
                y={cardY + 44}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={isActive ? 'var(--color-surface)' : 'var(--color-ink-700)'}
              >
                {stage.name}
              </text>
            </g>
          );
        })}

        {/* The item travelling into the active stage */}
        {showToken && (
          <g transform={`translate(${tokenX}, ${tokenY})`}>
            <circle
              r={11}
              fill="var(--color-surface)"
              stroke="var(--color-brand-600)"
              strokeWidth={2.5}
            />
            <circle r={4} fill="var(--color-brand-600)" />
          </g>
        )}
      </svg>

      {/* Active-stage description (also a stacked, ordered representation of
          the whole pipeline so the diagram is usable on narrow screens). */}
      <ol
        className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={title}
      >
        {stages.map((stage, i) => {
          const isActive = i === active;
          return (
            <li key={`${id}-li-${i}`}>
              <div
                className={cx(
                  'h-full rounded-card border px-3 py-2 transition-colors',
                  isActive
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-ink-100 bg-surface-sunken/40',
                )}
              >
                <p
                  className={cx(
                    'text-sm font-semibold',
                    isActive ? 'text-brand-700' : 'text-ink-700',
                  )}
                >
                  {i + 1}. {stage.name}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-600">
                  {stage.role}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Live region announcing the current stage */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={active === 0}
          aria-label={prevLabel}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prevLabel}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={active === n - 1}
          aria-label={nextLabel}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLabel}
        </button>
        {!reduced && (
          <button
            type="button"
            onClick={togglePlay}
            aria-pressed={playing}
            className={cx(
              'rounded-pill px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              playing
                ? 'bg-accent-600 text-white hover:bg-accent-600/90'
                : 'border border-ink-200 bg-surface text-ink-700 hover:bg-surface-sunken/60',
            )}
          >
            {playing ? pauseLabel : playLabel}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={active === 0 && !playing}
          aria-label={resetLabel}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MevSupplyChain;
