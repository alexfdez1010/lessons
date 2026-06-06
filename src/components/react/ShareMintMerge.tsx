import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ShareMintMergeProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the "mint / split" mode button. */
  mintLabel?: string;
  /** Label for the "merge / redeem" mode button. */
  mergeLabel?: string;
  /** Caption under the collateral coin. */
  collateralLabel?: string;
  /** Caption under the YES token box. */
  yesLabel?: string;
  /** Caption under the NO token box. */
  noLabel?: string;
  /** Readout label for the YES price. */
  yesPriceLabel?: string;
  /** Readout label for the NO price. */
  noPriceLabel?: string;
  /** Readout label for the conservation identity (left side). */
  identityLabel?: string;
  /** Readout value for the conservation identity (right side). */
  identityValueLabel?: string;
  /** Explanatory line shown in MINT mode. */
  mintExplain?: string;
  /** Explanatory line shown in MERGE mode. */
  mergeExplain?: string;
  /** Label for the YES-price slider. */
  sliderLabel?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  /** Initial YES price in cents (1–99). Defaults to `60`. */
  yesPrice?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const usd = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);

// Cubic ease-in-out.
const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Interactive mint/merge diagram for binary prediction markets. One dollar of
 * USDC collateral can be **minted** (split) into one complete set — 1 YES share
 * + 1 NO share — and a complete set can be **merged** (redeemed) back into one
 * dollar. Because the pair is always redeemable for exactly $1, the prices
 * obey the conservation law `YES + NO = $1`. Toggle MINT/MERGE to animate the
 * dollar splitting into / fusing from the two outcome tokens, and drag the
 * YES-price slider to see NO = $1 − YES while the identity holds. Respects
 * `prefers-reduced-motion` (jumps straight to the final state, no tween).
 */
export function ShareMintMerge({
  title = 'Mint & merge: the $1 identity',
  mintLabel = 'Mint (split)',
  mergeLabel = 'Merge (redeem)',
  collateralLabel = 'USDC collateral',
  yesLabel = 'YES share',
  noLabel = 'NO share',
  yesPriceLabel = 'YES price',
  noPriceLabel = 'NO price',
  identityLabel = 'YES + NO',
  identityValueLabel = '= $1 always',
  mintExplain = 'Mint: deposit $1 of USDC and receive one complete set — 1 YES + 1 NO.',
  mergeExplain = 'Merge: hand back 1 YES + 1 NO and redeem exactly $1 of USDC.',
  sliderLabel = 'YES price',
  caption = 'A complete set is always worth exactly $1, so YES + NO can never drift from $1. That conservation law is why a prediction-market price reads as a probability.',
  yesPrice = 60,
  className,
}: ShareMintMergeProps) {
  const id = useId();
  const [mode, setMode] = useState<'mint' | 'merge'>('mint');
  const [yes, setYes] = useState(() =>
    Math.min(99, Math.max(1, Math.round(yesPrice))),
  );
  // progress: 0 = collateral whole on the left, 1 = fully split into two tokens.
  const [progress, setProgress] = useState(mode === 'mint' ? 1 : 0);
  const rafRef = useRef<number | null>(null);

  const no = 100 - yes;
  const isMint = mode === 'mint';

  // Animate progress toward the target for the current mode.
  useEffect(() => {
    const target = isMint ? 1 : 0;
    if (prefersReducedMotion()) {
      setProgress(target);
      return;
    }
    let startTs: number | null = null;
    let start = 0;
    setProgress((current) => {
      start = current;
      return current;
    });
    const duration = 750;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const raw = Math.min(1, (ts - startTs) / duration);
      const eased = easeInOut(raw);
      setProgress(lerp(start, target, eased));
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isMint]);

  // SVG geometry.
  const W = 520;
  const H = 230;
  const cy = 100; // vertical centre of the flow band
  const coinX = 70; // collateral coin centre
  const coinR = 34;
  const boxW = 116;
  const boxH = 64;
  const yesY = 44;
  const noY = 122;
  const boxX = 320; // left edge of the destination boxes

  // The two tokens travel from the coin (progress 0) to their boxes (progress 1).
  const boxCenterX = boxX + boxW / 2;
  const tokenX = lerp(coinX, boxCenterX, progress);
  const yesTokenY = lerp(cy, yesY + boxH / 2, progress);
  const noTokenY = lerp(cy, noY + boxH / 2, progress);
  // Tokens grow as they separate; the coin shrinks/fades as it splits.
  const tokenScale = lerp(0.35, 1, progress);
  const coinOpacity = lerp(1, 0.18, progress);

  // Flow arrow direction: mint flows right (coin → tokens), merge flows left.
  const arrowDx = isMint ? 1 : -1;

  const ariaLabel = isMint
    ? `${title}: minting splits $1 of USDC collateral into one YES share priced at ${usd(
        yes,
      )} and one NO share priced at ${usd(no)}; together they sum to $1.00.`
    : `${title}: merging fuses one YES share at ${usd(
        yes,
      )} and one NO share at ${usd(
        no,
      )} back into $1.00 of USDC collateral; the pair always redeems for $1.00.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {identityLabel} {identityValueLabel}
        </span>
      </figcaption>

      {/* Mode toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-sunken/40 p-1"
        role="group"
        aria-label={`${mintLabel} / ${mergeLabel}`}
      >
        <button
          type="button"
          aria-pressed={isMint}
          onClick={() => setMode('mint')}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            isMint ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-700 hover:text-ink-900',
          )}
        >
          {mintLabel}
        </button>
        <button
          type="button"
          aria-pressed={!isMint}
          onClick={() => setMode('merge')}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            !isMint ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-700 hover:text-ink-900',
          )}
        >
          {mergeLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand-500)" />
          </marker>
        </defs>

        {/* Flow arrow between coin and boxes (direction depends on mode) */}
        <line
          x1={arrowDx === 1 ? coinX + coinR + 10 : boxX - 10}
          y1={cy}
          x2={arrowDx === 1 ? boxX - 14 : coinX + coinR + 14}
          y2={cy}
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          strokeDasharray="6 5"
          markerEnd={`url(#${id}-arrow)`}
          opacity={0.7}
        />

        {/* Destination box outlines (where the tokens land in MINT mode) */}
        <g opacity={lerp(0.25, 1, progress)}>
          <rect
            x={boxX}
            y={yesY}
            width={boxW}
            height={boxH}
            rx="10"
            fill="var(--color-brand-500)"
            opacity={0.1}
            stroke="var(--color-brand-500)"
            strokeWidth={1.5}
          />
          <rect
            x={boxX}
            y={noY}
            width={boxW}
            height={boxH}
            rx="10"
            fill="var(--color-accent-500)"
            opacity={0.1}
            stroke="var(--color-accent-500)"
            strokeWidth={1.5}
          />
        </g>

        {/* USDC collateral coin (whole at progress 0, faint as it splits) */}
        <g opacity={coinOpacity}>
          <circle
            cx={coinX}
            cy={cy}
            r={coinR}
            fill="var(--color-surface)"
            stroke="var(--color-ink-300)"
            strokeWidth={2}
          />
          <text
            x={coinX}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-ink-900)"
            fontSize="20"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            $1
          </text>
        </g>
        <text
          x={coinX}
          y={cy + coinR + 18}
          textAnchor="middle"
          fill="var(--color-ink-500)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {collateralLabel}
        </text>

        {/* Moving YES token */}
        <g
          transform={`translate(${tokenX} ${yesTokenY}) scale(${tokenScale})`}
        >
          <rect
            x={-boxW / 2 + 8}
            y={-boxH / 2 + 8}
            width={boxW - 16}
            height={boxH - 16}
            rx="9"
            fill="var(--color-brand-600)"
          />
          <text
            x={0}
            y={-4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="15"
            fontWeight="700"
            fontFamily="var(--font-sans)"
          >
            YES
          </text>
          <text
            x={0}
            y={15}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="13"
            fontFamily="var(--font-mono)"
          >
            {usd(yes)}
          </text>
        </g>

        {/* Moving NO token */}
        <g transform={`translate(${tokenX} ${noTokenY}) scale(${tokenScale})`}>
          <rect
            x={-boxW / 2 + 8}
            y={-boxH / 2 + 8}
            width={boxW - 16}
            height={boxH - 16}
            rx="9"
            fill="var(--color-accent-500)"
          />
          <text
            x={0}
            y={-4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="15"
            fontWeight="700"
            fontFamily="var(--font-sans)"
          >
            NO
          </text>
          <text
            x={0}
            y={15}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="13"
            fontFamily="var(--font-mono)"
          >
            {usd(no)}
          </text>
        </g>

        {/* Box captions (visible once tokens have landed) */}
        <g opacity={lerp(0, 1, progress)}>
          <text
            x={boxCenterX}
            y={yesY - 8}
            textAnchor="middle"
            fill="var(--color-brand-700)"
            fontSize="11"
            fontFamily="var(--font-sans)"
          >
            {yesLabel}
          </text>
          <text
            x={boxCenterX}
            y={noY + boxH + 16}
            textAnchor="middle"
            fill="var(--color-accent-600)"
            fontSize="11"
            fontFamily="var(--font-sans)"
          >
            {noLabel}
          </text>
        </g>
      </svg>

      {/* Mode explanation */}
      <p
        className="mt-1 text-sm leading-relaxed text-ink-700"
        aria-live="polite"
      >
        {isMint ? mintExplain : mergeExplain}
      </p>

      {/* YES-price slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-yes`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sliderLabel}</span>
          <span className="font-mono text-ink-900">{usd(yes)}</span>
        </label>
        <input
          id={`${id}-yes`}
          type="range"
          min={1}
          max={99}
          step={1}
          value={yes}
          onChange={(e) => setYes(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{yesPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {usd(yes)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{noPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {usd(no)}
          </dd>
        </div>
        <div className="rounded-card border border-brand-200 bg-brand-50/60 px-3 py-2">
          <dt className="text-ink-500">{identityLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {usd(yes + no)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ShareMintMerge;
