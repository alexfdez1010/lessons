import { useEffect, useRef, useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface OutcomeSharePayoffProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the YES outcome / share. Defaults to `YES`. */
  yesLabel?: string;
  /** Label for the NO outcome / share. Defaults to `NO`. */
  noLabel?: string;
  /** Label for the market-price slider (the YES price in cents). */
  priceLabel?: string;
  /** Label for the optional "your true probability" slider. */
  trueProbLabel?: string;
  /** Readout label: the market-implied probability. */
  impliedProbLabel?: string;
  /** Readout label: the cost of a share. */
  costLabel?: string;
  /** SVG bar label: the payout if the event happens. */
  payoffIfYesLabel?: string;
  /** SVG bar label: the payout if the event doesn't happen. */
  payoffIfNoLabel?: string;
  /** Readout label: expected value of buying a YES share. */
  evYesLabel?: string;
  /** Readout label: expected value of buying a NO share. */
  evNoLabel?: string;
  /** Badge label: which side is the best buy. */
  bestBuyLabel?: string;
  /** The word/symbol for the $1 payout. Defaults to `$1`. */
  payoutWord?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial YES price in cents (1–99). Defaults to `60`. */
  price?: number;
  /** Initial "your true probability" in percent (1–99). Defaults to `60`. */
  trueProb?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const usd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const signedUsd = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${usd(Math.abs(value))}`;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value * 100)}%`;

/**
 * Interactive Polymarket-style binary outcome market. A YES share costs the
 * market price `p` (1–99¢) and pays `$1` if the event happens, `$0` if not; a
 * NO share costs `$(1 − p)` and pays `$1` if it doesn't. The price *is* the
 * market-implied probability. Drag the market-price slider and an optional
 * "your true probability" slider to see the two payoff bars, the implied
 * probability, the cost of each side, and the expected value (edge) of buying
 * YES vs NO — making "price = probability" and "buy the side the market
 * underprices" viscerally concrete. The payoff bars grow in on each change;
 * respects `prefers-reduced-motion` (jumps straight to the final bars).
 */
export function OutcomeSharePayoff({
  title = 'A share is a bet on an outcome',
  yesLabel = 'YES',
  noLabel = 'NO',
  priceLabel = 'Market price (YES)',
  trueProbLabel = 'Your true probability',
  impliedProbLabel = 'Implied probability',
  costLabel = 'Cost',
  payoffIfYesLabel = 'Pays if event happens',
  payoffIfNoLabel = "Pays if it doesn't",
  evYesLabel = 'EV buying YES',
  evNoLabel = 'EV buying NO',
  bestBuyLabel = 'Best buy',
  payoutWord = '$1',
  caption = 'The price you pay for a YES share is the market’s probability that the event happens — a 60¢ share is the crowd saying “60% likely.” You make money only by buying the side the market underprices: when your honest probability beats the price, the expected value turns positive.',
  price = 60,
  trueProb = 60,
  className,
}: OutcomeSharePayoffProps) {
  const id = useId();
  const [cents, setCents] = useState(Math.min(99, Math.max(1, Math.round(price))));
  const [truePct, setTruePct] = useState(
    Math.min(99, Math.max(1, Math.round(trueProb))),
  );
  const [progress, setProgress] = useState(1); // 0 → 1 (bar grow-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 16;
  const padTop = 16;
  const trackW = W - padX * 2;

  const p = cents / 100; // YES price / implied probability
  const trueP = truePct / 100; // learner's honest probability
  const costYes = p;
  const costNo = 1 - p;

  // Per-share expected value (payout is $1 on the winning side).
  const evYes = trueP * 1 - costYes; // = trueP − p
  const evNo = (1 - trueP) * 1 - costNo; // = (1 − trueP) − (1 − p) = p − trueP
  const evDiff = evYes - evNo;
  const noEdge = Math.abs(evDiff) < 0.01; // within a cent
  const yesIsBest = evYes >= evNo;

  // Animate the payoff bars in whenever a parameter changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const prog = Math.min(1, (ts - startTs) / duration);
      setProgress(prog);
      if (prog < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [cents, truePct]);

  // SVG geometry: two horizontal payoff bars over a 0 → $1 value axis, plus a
  // price marker sitting between the $0 and $1 payouts.
  const xOf = (dollars: number) => padX + dollars * trackW;
  const barH = 30;
  const yYesBar = padTop + 30;
  const yNoBar = yYesBar + barH + 18;
  const axisY = yNoBar + barH + 34;

  // Each bar fills to $1 on its winning outcome ($0 fill otherwise).
  const yesFill = trackW * progress; // YES pays $1 if event happens
  const noFill = trackW * progress; // NO pays $1 if event doesn't

  const markerX = xOf(p);

  const ariaLabel = `${title}: a ${yesLabel} share costs ${usd(
    costYes,
  )} and pays ${payoutWord} if the event happens, so the market-implied probability is ${pct(
    p,
  )}. A ${noLabel} share costs ${usd(
    costNo,
  )}. At your true probability of ${pct(trueP)}, buying ${yesLabel} has an expected value of ${signedUsd(
    evYes,
  )} per share and buying ${noLabel} ${signedUsd(evNo)} per share; ${
    noEdge
      ? 'neither side has an edge.'
      : `the better buy is ${yesIsBest ? yesLabel : noLabel}.`
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
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {impliedProbLabel}: {pct(p)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {yesLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden="true" />
          {noLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-ink-700" aria-hidden="true" />
          {priceLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* ---- YES payoff bar ---- */}
        <text
          x={padX}
          y={yYesBar - 6}
          fill="var(--color-ink-700)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {yesLabel} · {payoffIfYesLabel}
        </text>
        <rect
          x={padX}
          y={yYesBar}
          width={trackW}
          height={barH}
          rx={6}
          fill="var(--color-ink-100)"
        />
        <rect
          x={padX}
          y={yYesBar}
          width={Math.max(0, yesFill)}
          height={barH}
          rx={6}
          fill="var(--color-brand-500)"
        />
        <text
          x={padX + trackW - 8}
          y={yYesBar + barH / 2 + 4}
          textAnchor="end"
          fill="white"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--font-mono)"
        >
          {payoutWord}
        </text>

        {/* ---- NO payoff bar ---- */}
        <text
          x={padX}
          y={yNoBar - 6}
          fill="var(--color-ink-700)"
          fontSize="11"
          fontFamily="var(--font-sans)"
        >
          {noLabel} · {payoffIfNoLabel}
        </text>
        <rect
          x={padX}
          y={yNoBar}
          width={trackW}
          height={barH}
          rx={6}
          fill="var(--color-ink-100)"
        />
        <rect
          x={padX}
          y={yNoBar}
          width={Math.max(0, noFill)}
          height={barH}
          rx={6}
          fill="var(--color-accent-500)"
        />
        <text
          x={padX + trackW - 8}
          y={yNoBar + barH / 2 + 4}
          textAnchor="end"
          fill="white"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--font-mono)"
        >
          {payoutWord}
        </text>

        {/* ---- 0 → $1 value axis with the price marker ---- */}
        <line
          x1={xOf(0)}
          y1={axisY}
          x2={xOf(1)}
          y2={axisY}
          stroke="var(--color-ink-200)"
          strokeWidth={2}
        />
        <text
          x={xOf(0)}
          y={axisY + 16}
          textAnchor="start"
          fill="var(--color-ink-500)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          $0
        </text>
        <text
          x={xOf(1)}
          y={axisY + 16}
          textAnchor="end"
          fill="var(--color-ink-500)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          $1
        </text>

        {/* Price marker line spanning the two bars down to the axis */}
        <line
          x1={markerX}
          y1={yYesBar - 2}
          x2={markerX}
          y2={axisY}
          stroke="var(--color-ink-700)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <circle cx={markerX} cy={axisY} r={4.5} fill="var(--color-ink-700)" />
        <text
          x={Math.min(W - padX, Math.max(padX + 24, markerX))}
          y={axisY + 16}
          textAnchor="middle"
          fill="var(--color-ink-700)"
          fontSize="10"
          fontWeight="600"
          fontFamily="var(--font-mono)"
        >
          {usd(p)}
        </text>
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-price`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{priceLabel}</span>
            <span className="font-mono text-ink-900">{cents}¢</span>
          </label>
          <input
            id={`${id}-price`}
            type="range"
            min={1}
            max={99}
            step={1}
            value={cents}
            onChange={(e) => setCents(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-true`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{trueProbLabel}</span>
            <span className="font-mono text-ink-900">{truePct}%</span>
          </label>
          <input
            id={`${id}-true`}
            type="range"
            min={1}
            max={99}
            step={1}
            value={truePct}
            onChange={(e) => setTruePct(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {yesLabel} {costLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {usd(costYes)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {noLabel} {costLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {usd(costNo)}
          </dd>
        </div>
        <div
          className={cx(
            'rounded-card border px-3 py-2',
            !noEdge && yesIsBest
              ? 'border-brand-500 bg-brand-50'
              : 'border-ink-100 bg-surface-sunken/40',
          )}
        >
          <dt className="flex items-center justify-between text-ink-500">
            <span>{evYesLabel}</span>
            {!noEdge && yesIsBest && (
              <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
                {bestBuyLabel}
              </span>
            )}
          </dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              evYes >= 0 ? 'text-ink-900' : 'text-accent-600',
            )}
          >
            {signedUsd(evYes)}
          </dd>
        </div>
        <div
          className={cx(
            'rounded-card border px-3 py-2',
            !noEdge && !yesIsBest
              ? 'border-accent-500 bg-accent-50'
              : 'border-ink-100 bg-surface-sunken/40',
          )}
        >
          <dt className="flex items-center justify-between text-ink-500">
            <span>{evNoLabel}</span>
            {!noEdge && !yesIsBest && (
              <span className="rounded-pill bg-accent-500 px-2 py-0.5 text-[10px] font-medium text-white">
                {bestBuyLabel}
              </span>
            )}
          </dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              evNo >= 0 ? 'text-ink-900' : 'text-accent-600',
            )}
          >
            {signedUsd(evNo)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default OutcomeSharePayoff;
