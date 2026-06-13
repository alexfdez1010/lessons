import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BobRubinAsymmetryProps {
  /** Heading above the timeline. */
  title?: string;
  /** Label for the button that advances the timeline one year. */
  playLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Label for the skin-in-the-game (clawback) toggle. */
  skinToggleLabel?: string;
  /** Label for the agent's running-P&L bucket. */
  agentLabel?: string;
  /** Label for the firm / taxpayer running-P&L bucket. */
  systemLabel?: string;
  /** Word used for a good-year bonus bar. */
  bonusLabel?: string;
  /** Word used for the final blow-up bar. */
  blowupLabel?: string;
  /** Word prefixed to each year tick (e.g. "Year 1"). */
  yearLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** One-line takeaway shown under the timeline. */
  caption?: string;
  /** Number of years on the timeline (≥ 2). Defaults to `10`. */
  years?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`;
};

/**
 * Interactive "Bob Rubin trade" timeline (Taleb, *Skin in the Game*): the
 * transfer of fragility. An agent runs a risky strategy that pays a steady
 * bonus for several good years, then blows up catastrophically in the final
 * year. Each good year drops a green +bonus bar into the AGENT's pocket; the
 * final year drops one giant red −blow-up bar — but into a SEPARATE firm /
 * taxpayer bucket. Two running totals update side by side (aria-live): the
 * agent's P&L stays strongly positive precisely because the downside is
 * socialised, while the system's P&L goes deeply negative — "heads I win,
 * tails you lose."
 *
 * Toggle "skin in the game (clawback)" and the math realigns: past bonuses are
 * clawed back and the agent co-invests in the loss, so the blow-up lands on the
 * agent too and their P&L finally goes negative — symmetry fixes the incentive.
 *
 * Step the timeline with the play button (one year per click); reset returns to
 * year 0. Bars animate in on drop; respects `prefers-reduced-motion` (bars
 * appear at full size, no transition).
 */
export function BobRubinAsymmetry({
  title = 'Heads I win, tails you lose',
  playLabel = 'Play the years',
  resetLabel = 'Reset',
  skinToggleLabel = 'Add skin in the game (clawback)',
  agentLabel = "Agent's pocket",
  systemLabel = 'Firm / taxpayer',
  bonusLabel = 'Bonus',
  blowupLabel = 'Blow-up',
  yearLabel = 'Year',
  currencyPrefix = '$',
  caption = "The agent banks a bonus every good year, then the strategy blows up. Because the giant loss is socialised onto the firm or taxpayer, the agent's personal P&L stays positive — until clawback and co-investment force them to share the downside.",
  years = 10,
  className,
}: BobRubinAsymmetryProps) {
  const id = useId();
  const totalYears = Math.max(2, Math.round(years));
  const goodYears = totalYears - 1; // last year is the blow-up

  // Economics of the trade.
  const BONUS = 10; // banked per good year (in $M, say)
  const BLOWUP = BONUS * goodYears * 2.5; // the loss dwarfs the cumulative bonuses

  // `step` = number of years that have happened (0 → totalYears).
  const [step, setStep] = useState(0);
  const [skin, setSkin] = useState(false);
  // Index of the most recently dropped bar, for the drop-in animation.
  const [justDropped, setJustDropped] = useState<number | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = prefersReducedMotion();
  }, []);

  const blowupHappened = step >= totalYears;

  // Bonuses banked so far (one per elapsed good year).
  const bonusesBanked = Math.min(step, goodYears);

  // Without skin in the game: agent keeps every bonus, the firm/taxpayer eats
  // the blow-up alone. With skin in the game: bonuses are clawed back AND the
  // agent co-invests, so the agent shares the loss while the firm is partly
  // protected by what it recovers.
  const CLAWBACK_SHARE = 0.5; // fraction of the blow-up the agent absorbs under clawback

  const agentBonusPnl = bonusesBanked * BONUS;
  const agentBlowupHit = blowupHappened && skin ? -(BLOWUP * CLAWBACK_SHARE) : 0;
  // Under clawback the banked bonuses are returned, so they no longer count as
  // the agent's gain once the blow-up lands.
  const agentClawback = blowupHappened && skin ? -agentBonusPnl : 0;
  const agentPnl = agentBonusPnl + agentClawback + agentBlowupHit;

  // The system pays nothing during good years; on blow-up it eats the loss,
  // minus whatever clawback + the agent's co-investment recover under skin.
  const systemRecovered = blowupHappened && skin ? agentBonusPnl + BLOWUP * CLAWBACK_SHARE : 0;
  const systemPnl = blowupHappened ? -BLOWUP + systemRecovered : 0;

  const advance = () => {
    if (step >= totalYears) return;
    const next = step + 1;
    setStep(next);
    setJustDropped(next - 1);
    if (!reduceMotion.current) {
      window.setTimeout(() => {
        setJustDropped((cur) => (cur === next - 1 ? null : cur));
      }, 650);
    } else {
      setJustDropped(null);
    }
  };

  const reset = () => {
    setStep(0);
    setJustDropped(null);
  };

  // --- Chart geometry ------------------------------------------------------
  const W = 520;
  const H = 220;
  const padX = 16;
  const padTop = 14;
  const baselineY = H * 0.5; // money above this = gains, below = losses
  const axisBottom = H - 24;

  const slotW = (W - padX * 2) / totalYears;
  const barW = Math.min(28, slotW * 0.6);

  // Vertical scale: tallest thing is the blow-up bar.
  const maxBonusStack = goodYears * BONUS;
  const scaleMax = Math.max(maxBonusStack, BLOWUP);
  const upRoom = baselineY - padTop;
  const downRoom = axisBottom - baselineY;
  const hUp = (value: number) => (value / scaleMax) * upRoom;
  const hDown = (value: number) => (value / scaleMax) * downRoom;

  // Position of each year tick along the x-axis.
  const slotX = (year: number) => padX + slotW * year + (slotW - barW) / 2;

  const ariaSummary = blowupHappened
    ? skin
      ? `After ${totalYears} years the strategy has blown up. With skin in the game, the agent's banked bonuses are clawed back and they co-invest in the loss, so the agent's personal P&L is ${money(
          currencyPrefix,
          agentPnl,
        )} and the firm or taxpayer's P&L is ${money(currencyPrefix, systemPnl)}.`
      : `After ${totalYears} years the strategy has blown up. The agent keeps every bonus, so the agent's personal P&L is ${money(
          currencyPrefix,
          agentPnl,
        )} while the firm or taxpayer absorbs the loss and its P&L is ${money(
          currencyPrefix,
          systemPnl,
        )}.`
    : `${bonusesBanked} good year${bonusesBanked === 1 ? '' : 's'} elapsed. The agent has banked ${money(
        currencyPrefix,
        agentPnl,
      )} in bonuses; the firm or taxpayer's P&L is still ${money(currencyPrefix, systemPnl)}.`;

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
          {yearLabel} {Math.min(step, totalYears)}/{totalYears}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-success)' }}
            aria-hidden="true"
          />
          {bonusLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-danger)' }}
            aria-hidden="true"
          />
          {blowupLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: ${ariaSummary}`}
      >
        {/* Baseline (zero P&L) */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />

        {/* Year ticks + bars */}
        {Array.from({ length: totalYears }, (_, year) => {
          const isBlowupYear = year === totalYears - 1;
          const happened = year < step;
          const x = slotX(year);
          const cx0 = x + barW / 2;
          const dropping = justDropped === year && !reduceMotion.current;

          return (
            <g key={year}>
              {/* Year tick label */}
              <text
                x={cx0}
                y={axisBottom + 14}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-ink-400)"
              >
                {year + 1}
              </text>

              {happened && !isBlowupYear && (
                // Good-year bonus: a small green bar above the line.
                <rect
                  x={x}
                  y={baselineY - hUp(BONUS)}
                  width={barW}
                  height={hUp(BONUS)}
                  rx={3}
                  fill="var(--color-success)"
                  opacity={skin && blowupHappened ? 0.35 : 0.9}
                  style={
                    dropping
                      ? { transformBox: 'fill-box', transformOrigin: 'bottom', animation: 'fade-up 0.45s ease-out both' }
                      : undefined
                  }
                />
              )}

              {happened && isBlowupYear && (
                // Blow-up year: one giant red bar below the line.
                <rect
                  x={x}
                  y={baselineY}
                  width={barW}
                  height={hDown(BLOWUP)}
                  rx={3}
                  fill="var(--color-danger)"
                  opacity={0.9}
                  style={
                    dropping
                      ? { transformBox: 'fill-box', transformOrigin: 'top', animation: 'fade-up 0.45s ease-out both' }
                      : undefined
                  }
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Running totals: the heart of the demo. */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3">
          <div className="text-sm text-ink-500">{agentLabel}</div>
          <div
            className={cx(
              'mt-1 font-mono text-2xl font-semibold',
              agentPnl < 0 ? 'text-danger' : 'text-success',
            )}
          >
            {money(currencyPrefix, agentPnl)}
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3">
          <div className="text-sm text-ink-500">{systemLabel}</div>
          <div
            className={cx(
              'mt-1 font-mono text-2xl font-semibold',
              systemPnl < 0 ? 'text-danger' : 'text-ink-900',
            )}
          >
            {money(currencyPrefix, systemPnl)}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={advance}
          disabled={step >= totalYears}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={step === 0}
          className="rounded-pill border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {resetLabel}
        </button>

        <label
          htmlFor={`${id}-skin`}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700"
        >
          <input
            id={`${id}-skin`}
            type="checkbox"
            checked={skin}
            onChange={(e) => setSkin(e.target.checked)}
            className="h-4 w-4 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          {skinToggleLabel}
        </label>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BobRubinAsymmetry;
