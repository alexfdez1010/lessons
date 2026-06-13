import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One tranche the SPV issues against the loan pool. */
export interface SecuritizationTranche {
  /** Tranche name, e.g. "Senior (AAA)". */
  label: string;
  /** Share of the pool funded by this tranche, as a percentage (0–100). */
  share: number;
  /** Optional seniority note, e.g. "Paid first · safest". */
  note?: string;
}

export interface SecuritizationFlowProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label under the pool of loans on the left. */
  poolLabel?: string;
  /** Label inside the central SPV box. */
  spvLabel?: string;
  /** Convenience label for the senior tranche (used when `tranches` is omitted). */
  seniorLabel?: string;
  /** Convenience label for the mezzanine tranche. */
  mezzLabel?: string;
  /** Convenience label for the equity tranche. */
  equityLabel?: string;
  /** Convenience seniority note for the senior tranche. */
  seniorNoteLabel?: string;
  /** Convenience seniority note for the equity tranche. */
  equityNoteLabel?: string;
  /** Play button label. */
  playLabel?: string;
  /** Replay button label. */
  replayLabel?: string;
  /** One-line takeaway under the diagram. */
  caption?: string;
  /**
   * The tranches issued by the SPV, top (most senior) to bottom (first loss).
   * Defaults to an 80 / 15 / 5 Senior / Mezzanine / Equity capital stack built
   * from the convenience label props.
   */
  tranches?: SecuritizationTranche[];
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEP_MS = 850;
const POOL_COUNT = 12;

/** Stage names, in reveal order. */
const STAGES = ['pool', 'spv', 'tranches'] as const;

/** Tranche fill tokens, most senior first. */
const TRANCHE_FILLS = [
  'var(--color-brand-500)',
  'var(--color-brand-300)',
  'var(--color-accent-500)',
];

/**
 * Securitization pipeline, revealed left-to-right in three stages by a Play
 * button. Stage 1 lights up a grid of individual loans (mortgages, auto loans);
 * stage 2 floats them along arrows into a bankruptcy-remote **SPV / issuer**;
 * stage 3 has the SPV issue a proportionally-sized capital stack of tranches —
 * Senior (safest, paid first) at the top, Equity (first loss, paid last) at the
 * bottom — each labelled with its share of the pool. Each stage's meaning is
 * announced via an `aria-live` region. Respects `prefers-reduced-motion`:
 * renders the whole pipeline built and still.
 */
export function SecuritizationFlow({
  title = 'How securitization works',
  poolLabel = 'Pool of loans',
  spvLabel = 'SPV / issuer',
  seniorLabel = 'Senior (AAA)',
  mezzLabel = 'Mezzanine',
  equityLabel = 'Equity',
  seniorNoteLabel = 'Paid first · safest',
  equityNoteLabel = 'First loss · paid last',
  playLabel = 'Run the pipeline',
  replayLabel = 'Replay',
  caption = 'A bank pools illiquid loans and sells them to an SPV that is legally isolated from the bank’s bankruptcy. The SPV funds the purchase by issuing tranches of different seniority: senior investors are paid first and bear losses last, equity investors are paid last and absorb the first loss.',
  tranches,
  className,
}: SecuritizationFlowProps) {
  const id = useId();
  const reduced =
    typeof window !== 'undefined' ? prefersReducedMotion() : false;

  const stack: SecuritizationTranche[] =
    tranches ?? [
      { label: seniorLabel, share: 80, note: seniorNoteLabel },
      { label: mezzLabel, share: 15 },
      { label: equityLabel, share: 5, note: equityNoteLabel },
    ];

  // `shown` counts revealed stages: 0 = nothing, STAGES.length = fully built.
  const [shown, setShown] = useState(reduced ? STAGES.length : 0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion()) setShown(0);
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const play = () => {
    clearTimer();
    if (prefersReducedMotion()) {
      setShown(STAGES.length);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setShown(0);
    const tick = (next: number) => {
      setShown(next);
      if (next >= STAGES.length) {
        setPlaying(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    timerRef.current = window.setTimeout(() => tick(1), 200);
  };

  const done = shown >= STAGES.length && !playing;
  const poolShown = shown >= 1;
  const spvShown = shown >= 2;
  const tranchesShown = shown >= 3;

  // --- Diagram geometry -----------------------------------------------------
  const W = 560;
  const H = 300;

  // Pool grid (left): 12 loans in a 3-wide × 4-tall column.
  const poolCols = 3;
  const poolRows = Math.ceil(POOL_COUNT / poolCols);
  const loanW = 26;
  const loanH = 16;
  const loanGapX = 8;
  const loanGapY = 8;
  const poolX = 20;
  const poolGridW = poolCols * loanW + (poolCols - 1) * loanGapX;
  const poolGridH = poolRows * loanH + (poolRows - 1) * loanGapY;
  const poolTop = (H - poolGridH) / 2 - 6;
  const loanXY = (i: number): { x: number; y: number } => {
    const col = i % poolCols;
    const row = Math.floor(i / poolCols);
    return {
      x: poolX + col * (loanW + loanGapX),
      y: poolTop + row * (loanH + loanGapY),
    };
  };

  // SPV box (centre).
  const spvW = 120;
  const spvH = 84;
  const spvX = W / 2 - spvW / 2;
  const spvY = H / 2 - spvH / 2 - 6;
  const spvCx = spvX + spvW / 2;
  const spvCy = spvY + spvH / 2;
  const poolRightX = poolX + poolGridW;

  // Tranche stack (right), proportionally sized to share.
  const stackX = W - 20 - 150;
  const stackW = 150;
  const stackTop = 28;
  const stackH = H - stackTop - 44;
  const totalShare = stack.reduce((sum, t) => sum + t.share, 0) || 1;

  // Travelling dots from pool → SPV (one per loan, staggered).
  const dotKeys = Array.from({ length: POOL_COUNT });

  let live = '';
  if (shown === 1) {
    live = `${poolLabel}: ${POOL_COUNT} individual loans the bank holds.`;
  } else if (shown === 2) {
    live = `${spvLabel}: the loans are pooled and sold to a bankruptcy-remote special purpose vehicle.`;
  } else if (shown >= 3) {
    live = `${spvLabel} issues ${stack
      .map((t) => `${t.label} ${t.share}%`)
      .join(', ')} — ${stack[0].label} is paid first, ${
      stack[stack.length - 1].label
    } absorbs the first loss.`;
  }

  const ariaLabel = `${title}: ${POOL_COUNT} individual loans are pooled and sold to a ${spvLabel}, which funds the purchase by issuing ${stack
    .map((t) => `${t.label} (${t.share}%)`)
    .join(', ')} from safest, paid-first to first-loss, paid-last.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
        >
          {done ? replayLabel : playLabel}
        </button>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-ink-300)" />
          </marker>
        </defs>

        {/* Stage 1 — Pool of loans */}
        <text
          x={poolX}
          y={poolTop - 12}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          {poolLabel}
        </text>
        {Array.from({ length: POOL_COUNT }).map((_, i) => {
          const { x, y } = loanXY(i);
          return (
            <rect
              key={`${id}-loan-${i}`}
              x={x}
              y={y}
              width={loanW}
              height={loanH}
              rx={3}
              fill="var(--color-brand-100)"
              stroke="var(--color-brand-400)"
              strokeWidth={1}
              className={cx(!reduced && 'transition-opacity duration-500')}
              style={{
                opacity: poolShown ? 1 : 0,
                transitionDelay: reduced ? undefined : `${i * 25}ms`,
              }}
            />
          );
        })}

        {/* Flow arrow: pool → SPV */}
        <line
          x1={poolRightX + 8}
          y1={spvCy}
          x2={spvX - 10}
          y2={spvCy}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
          markerEnd={`url(#${id}-arrow)`}
          className={cx(!reduced && 'transition-opacity duration-500')}
          style={{ opacity: spvShown ? 1 : 0 }}
        />
        {/* Stage 2 — travelling dots pool → SPV */}
        {!reduced &&
          spvShown &&
          dotKeys.map((_, i) => {
            const { x, y } = loanXY(i);
            const startX = x + loanW;
            const startY = y + loanH / 2;
            return (
              <circle
                key={`${id}-dot-${i}`}
                r={2.5}
                fill="var(--color-brand-500)"
              >
                <animate
                  attributeName="cx"
                  from={startX}
                  to={spvCx}
                  dur="0.7s"
                  begin={`${i * 0.05}s`}
                  fill="freeze"
                />
                <animate
                  attributeName="cy"
                  from={startY}
                  to={spvCy}
                  dur="0.7s"
                  begin={`${i * 0.05}s`}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  from={1}
                  to={0}
                  dur="0.7s"
                  begin={`${i * 0.05}s`}
                  fill="freeze"
                />
              </circle>
            );
          })}

        {/* SPV box */}
        <g
          className={cx(!reduced && 'transition-opacity duration-500')}
          style={{ opacity: spvShown ? 1 : 0 }}
        >
          <rect
            x={spvX}
            y={spvY}
            width={spvW}
            height={spvH}
            rx={10}
            fill="var(--color-surface-sunken)"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={spvCx}
            y={spvCy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink-900)"
          >
            {spvLabel}
          </text>
        </g>

        {/* Flow arrow: SPV → tranches */}
        <line
          x1={spvX + spvW + 10}
          y1={spvCy}
          x2={stackX - 8}
          y2={spvCy}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
          markerEnd={`url(#${id}-arrow)`}
          className={cx(!reduced && 'transition-opacity duration-500')}
          style={{ opacity: tranchesShown ? 1 : 0 }}
        />

        {/* Stage 3 — tranche stack */}
        <text
          x={stackX}
          y={stackTop - 8}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          {stack.length} tranches
        </text>
        {(() => {
          let y = stackTop;
          return stack.map((t, i) => {
            const h = (t.share / totalShare) * stackH;
            const segY = y;
            y += h;
            const fill = TRANCHE_FILLS[Math.min(i, TRANCHE_FILLS.length - 1)];
            const centerY = segY + h / 2;
            return (
              <g
                key={`${id}-tranche-${i}`}
                className={cx(!reduced && 'transition-all duration-500')}
                style={{
                  opacity: tranchesShown ? 1 : 0,
                  transform: tranchesShown
                    ? 'translateX(0)'
                    : 'translateX(-16px)',
                  transitionDelay: reduced ? undefined : `${i * 120}ms`,
                }}
              >
                <rect
                  x={stackX}
                  y={segY}
                  width={stackW}
                  height={Math.max(h - 2, 2)}
                  rx={4}
                  fill={fill}
                />
                <text
                  x={stackX + 10}
                  y={centerY - (t.note ? 5 : 0)}
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--color-surface)"
                  dominantBaseline="middle"
                >
                  {t.label}
                </text>
                <text
                  x={stackX + stackW - 10}
                  y={centerY - (t.note ? 5 : 0)}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="end"
                  fill="var(--color-surface)"
                  dominantBaseline="middle"
                  fontFamily="var(--font-mono)"
                >
                  {t.share}%
                </text>
                {t.note ? (
                  <text
                    x={stackX + 10}
                    y={centerY + 9}
                    fontSize={9}
                    fill="var(--color-surface)"
                    dominantBaseline="middle"
                  >
                    {t.note}
                  </text>
                ) : null}
              </g>
            );
          });
        })()}
      </svg>

      <p
        className="mt-3 text-sm text-ink-500"
        aria-live="polite"
        aria-atomic="true"
      >
        {live}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SecuritizationFlow;
