import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BarbellAllocationProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the safe-fraction slider. */
  safeFractionLabel?: string;
  /** Label for the "all-in the middle" strategy. */
  middleStrategyLabel?: string;
  /** Label for the barbell strategy. */
  barbellStrategyLabel?: string;
  /** Label for the safe leg (cash / T-bills). */
  safeLegLabel?: string;
  /** Label for the aggressive, capped-downside leg. */
  riskyLegLabel?: string;
  /** Label for the moderate "middle" fund. */
  middleLegLabel?: string;
  /** Button label: trigger a crash scenario. */
  crashLabel?: string;
  /** Button label: trigger a boom scenario. */
  boomLabel?: string;
  /** Button label: reset to the calm baseline. */
  resetLabel?: string;
  /** Label prefixing the portfolio-value readouts. */
  outcomeLabel?: string;
  /** Label for the gain/loss change line under each outcome. */
  changeLabel?: string;
  /** Caption shown for the calm/baseline scenario. */
  calmScenarioLabel?: string;
  /** Caption shown for the crash scenario. */
  crashScenarioLabel?: string;
  /** Caption shown for the boom scenario. */
  boomScenarioLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** One-line takeaway shown under the widget. */
  caption?: string;
  /** Starting amount each strategy invests. Defaults to `100000`. */
  principal?: number;
  /** Initial safe fraction for the barbell (0.5–0.95). Defaults to `0.9`. */
  safeFraction?: number;
  className?: string;
}

type Scenario = 'calm' | 'crash' | 'boom';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

const signedPct = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(Math.abs(value * 100))}%`;

/**
 * Interactive Taleb "barbell" demonstration. It contrasts two ways to deploy the
 * same starting capital:
 *
 *   (A) "All-in the middle" — 100% in a single moderate fund. One bar in the
 *       center; medium risk whose tail exposure is mismeasured.
 *   (B) "Barbell" — bimodal by construction: a slider-controlled safe fraction
 *       (cash / T-bills that cannot blow up) plus a tiny aggressive leg with
 *       capped downside and open upside (far-OTM options, venture). A tall bar
 *       at the safe end, a small bar at the risky end, and a deliberately EMPTY
 *       middle.
 *
 * Scenario buttons fire a Crash (risky leg → worthless, moderate fund −50%) or a
 * Boom (speculative leg multiplies ~15×, moderate fund up modestly). The
 * aria-live readouts show each strategy's resulting portfolio value. The punch:
 * under Crash the barbell's loss is FLOORED at its small speculative fraction
 * while the middle halves; under Boom the convex leg pays off big. Barbell loses
 * small / wins big; the middle wins small / loses big. The bars animate to their
 * heights on mount and on every change; respects `prefers-reduced-motion`.
 */
export function BarbellAllocation({
  title = 'The barbell: floor the loss, keep the upside',
  safeFractionLabel = 'Safe allocation',
  middleStrategyLabel = 'All-in the middle',
  barbellStrategyLabel = 'Barbell',
  safeLegLabel = 'Safe (cash / T-bills)',
  riskyLegLabel = 'Aggressive (capped-downside bets)',
  middleLegLabel = 'Moderate fund',
  crashLabel = 'Crash',
  boomLabel = 'Boom',
  resetLabel = 'Reset',
  outcomeLabel = 'Portfolio value',
  changeLabel = 'Change',
  calmScenarioLabel = 'Calm — no shock has hit yet.',
  crashScenarioLabel = 'Crash — risky assets fall ~50% and the options expire worthless.',
  boomScenarioLabel = 'Boom — the speculative leg multiplies; the moderate fund edges up.',
  currencyPrefix = '$',
  caption = 'A barbell is the opposite of "balanced": it evacuates the fragile middle, parking ~85–90% where it cannot blow up and ~10–15% on capped-downside / open-upside bets. The net payoff is convex — the loss is floored, the upside stays open.',
  principal = 100000,
  safeFraction = 0.9,
  className,
}: BarbellAllocationProps) {
  const id = useId();
  const [safeState, setSafeState] = useState(safeFraction);
  const [scenario, setScenario] = useState<Scenario>('calm');
  const [progress, setProgress] = useState(1); // 0 → 1 bar grow-in
  const rafRef = useRef<number | null>(null);

  const safe = Math.min(0.95, Math.max(0.5, safeState));
  const risky = 1 - safe;

  // --- Scenario return multipliers ---------------------------------------
  // Calm: nothing moves. Crash: safe holds, risky leg → 0, middle halves.
  // Boom: safe earns a touch, risky leg ~15×, middle edges up.
  const safeReturn = scenario === 'calm' ? 0 : scenario === 'crash' ? 0 : 0.04;
  const riskyReturn = scenario === 'calm' ? 0 : scenario === 'crash' ? -1 : 14;
  const middleReturn = scenario === 'calm' ? 0 : scenario === 'crash' ? -0.5 : 0.18;

  // --- Outcomes ----------------------------------------------------------
  const barbellSafe = principal * safe * (1 + safeReturn);
  const barbellRisky = principal * risky * (1 + riskyReturn);
  const barbellValue = barbellSafe + barbellRisky;
  const middleValue = principal * (1 + middleReturn);

  const barbellChange = barbellValue / principal - 1;
  const middleChange = middleValue / principal - 1;

  const safePct = Math.round(safe * 100);
  const riskyPct = 100 - safePct;

  // --- Bar chart geometry ------------------------------------------------
  // 10 risk buckets along the x-axis. The barbell fills the two ends and
  // leaves the middle empty; the middle strategy fills one central bucket.
  const W = 520;
  const H = 200;
  const padX = 16;
  const padBottom = 30;
  const padTop = 12;
  const buckets = 10;
  const gap = 6;
  const bandW = (W - padX * 2) / buckets;
  const barW = bandW - gap;
  const baseY = H - padBottom;
  const maxBarH = baseY - padTop;

  // Bar heights as a fraction of the tallest bar (the safe leg sets the top).
  const safeFrac = safe; // 0.5–0.95 → tall
  const riskyFrac = risky; // small
  const middleFrac = 0.62; // a single moderate bar, mid-tall

  const bar = (frac: number) => maxBarH * frac * progress;

  // Animate bars growing in on mount and on every relevant change.
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
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [safeState]);

  const scenarioCaption =
    scenario === 'crash'
      ? crashScenarioLabel
      : scenario === 'boom'
        ? boomScenarioLabel
        : calmScenarioLabel;

  const safeX = padX + gap / 2;
  const riskyX = padX + (buckets - 1) * bandW + gap / 2;
  const middleX = padX + Math.floor(buckets / 2) * bandW + gap / 2;

  const fireBtn = (active: boolean) =>
    cx(
      'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      active
        ? 'bg-brand-600 text-white'
        : 'border border-ink-200 bg-surface text-ink-700 hover:bg-surface-sunken',
    );

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
          {money(currencyPrefix, principal)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {safeLegLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden="true" />
          {riskyLegLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-ink-400" aria-hidden="true" />
          {middleLegLabel}
        </span>
      </div>

      {/* Bimodal barbell vs single central bar */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${barbellStrategyLabel}: ${safePct}% safe at one end and ${riskyPct}% aggressive at the other, with an empty middle. ${middleStrategyLabel}: a single moderate bar in the center.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* The middle strategy: one moderate bar at the center (drawn faint,
            behind, to read as the alternative being avoided). */}
        <rect
          x={middleX}
          y={baseY - bar(middleFrac)}
          width={barW}
          height={bar(middleFrac)}
          rx={3}
          fill="var(--color-ink-400)"
          opacity={0.35}
        />
        <text
          x={middleX + barW / 2}
          y={baseY + 18}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {middleStrategyLabel}
        </text>

        {/* The barbell: tall safe bar at the left end … */}
        <rect
          x={safeX}
          y={baseY - bar(safeFrac)}
          width={barW}
          height={bar(safeFrac)}
          rx={3}
          fill="var(--color-brand-500)"
        />
        <text
          x={safeX + barW / 2}
          y={baseY + 18}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-brand-700)"
          fontWeight={600}
        >
          {safePct}%
        </text>

        {/* … small aggressive bar at the right end. */}
        <rect
          x={riskyX}
          y={baseY - bar(riskyFrac)}
          width={barW}
          height={bar(riskyFrac)}
          rx={3}
          fill="var(--color-accent-500)"
        />
        <text
          x={riskyX + barW / 2}
          y={baseY + 18}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-accent-600)"
          fontWeight={600}
        >
          {riskyPct}%
        </text>

        {/* The deliberately empty middle, annotated. */}
        <text
          x={W / 2}
          y={padTop + 8}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-400)"
          fontStyle="italic"
        >
          {barbellStrategyLabel}
        </text>
      </svg>

      {/* Safe-fraction slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-safe`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{safeFractionLabel}</span>
          <span className="font-mono text-ink-900">
            {safePct}% / {riskyPct}%
          </span>
        </label>
        <input
          id={`${id}-safe`}
          type="range"
          min={50}
          max={95}
          step={1}
          value={safePct}
          onChange={(e) => setSafeState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Scenario buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScenario('crash')}
          aria-pressed={scenario === 'crash'}
          className={fireBtn(scenario === 'crash')}
        >
          {crashLabel}
        </button>
        <button
          type="button"
          onClick={() => setScenario('boom')}
          aria-pressed={scenario === 'boom'}
          className={fireBtn(scenario === 'boom')}
        >
          {boomLabel}
        </button>
        <button
          type="button"
          onClick={() => setScenario('calm')}
          aria-pressed={scenario === 'calm'}
          className={fireBtn(false)}
        >
          {resetLabel}
        </button>
      </div>

      {/* Outcome readouts */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3">
          <dt className="text-ink-500">
            {barbellStrategyLabel} · {outcomeLabel}
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-brand-700">
            {money(currencyPrefix, barbellValue)}
          </dd>
          <dd
            className={cx(
              'mt-0.5 font-mono text-sm font-medium',
              barbellChange >= 0 ? 'text-success' : 'text-danger',
            )}
          >
            {changeLabel}: {signedPct(barbellChange)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3">
          <dt className="text-ink-500">
            {middleStrategyLabel} · {outcomeLabel}
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-ink-900">
            {money(currencyPrefix, middleValue)}
          </dd>
          <dd
            className={cx(
              'mt-0.5 font-mono text-sm font-medium',
              middleChange >= 0 ? 'text-success' : 'text-danger',
            )}
          >
            {changeLabel}: {signedPct(middleChange)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm font-medium text-ink-700" aria-live="polite">
        {scenarioCaption}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BarbellAllocation;
