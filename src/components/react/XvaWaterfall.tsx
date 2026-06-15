import { useState } from 'react';
import { cx } from '@/components/react/cx';

type Scenario = 'bilateral' | 'cleared';

interface Adjustment {
  key: string;
  label: string;
  /**
   * Signed price adjustment vs the risk-free value, in price points (per 100
   * notional). NEGATIVE = a charge that lowers the value to the bank (CVA, FVA,
   * MVA, KVA); POSITIVE = a benefit (DVA).
   */
  value: number;
}

export interface XvaWaterfallProps {
  /** Heading above the chart. */
  title?: string;
  /** Risk-free (textbook) price the adjustments start from. Defaults to `100`. */
  riskFreePrice?: number;
  /** Label for the bilateral (uncleared) scenario toggle. */
  bilateralLabel?: string;
  /** Label for the centrally-cleared scenario toggle. */
  clearedLabel?: string;
  /** Label for the starting risk-free baseline. */
  riskFreeLabel?: string;
  /** Label under the final summed bar. */
  netLabel?: string;
  /** Readout label for the all-in price. */
  allInLabel?: string;
  /** Readout label for the total (net) XVA. */
  totalXvaLabel?: string;
  /** Unit shown after numbers. Defaults to `'pts'`. */
  unitLabel?: string;
  /** Y-axis title. Defaults to `'Adjustment vs risk-free'`. */
  axisLabel?: string;
  /** The XVA legs for the bilateral scenario, in waterfall order. */
  bilateralAdjustments?: Adjustment[];
  /** The XVA legs for the cleared scenario, in waterfall order. */
  clearedAdjustments?: Adjustment[];
  /** Explanation shown for the bilateral scenario. */
  bilateralExplanation?: string;
  /** Explanation shown for the cleared scenario. */
  clearedExplanation?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const DEFAULT_BILATERAL: Adjustment[] = [
  { key: 'cva', label: 'CVA', value: -0.8 },
  { key: 'dva', label: 'DVA', value: +0.5 },
  { key: 'fva', label: 'FVA', value: -0.4 },
  { key: 'mva', label: 'MVA', value: -0.3 },
  { key: 'kva', label: 'KVA', value: -0.5 },
];

const DEFAULT_CLEARED: Adjustment[] = [
  { key: 'mva', label: 'MVA', value: -0.45 },
  { key: 'kva', label: 'KVA', value: -0.15 },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The XVA waterfall — how a desk gets from the textbook price to the price it
 * actually charges.
 *
 * Start from the RISK-FREE value (the clean derivatives-pricing number, taken
 * as the 0 baseline here). Then stack the valuation adjustments, each a signed
 * step in price points:
 *
 *   − CVA  charge for the counterparty's default risk
 *   + DVA  benefit from your OWN default risk (controversial, but it nets)
 *   − FVA  cost of funding the uncollateralised position
 *   − MVA  cost of funding posted initial margin
 *   − KVA  cost of the regulatory capital the trade ties up
 *
 * The running total walks down (mostly) to the NET XVA, and risk-free + net XVA
 * is the all-in price. Toggle to the CLEARED scenario to see why central
 * clearing reshapes the bill: a default-remote CCP with daily variation margin
 * wipes out CVA, DVA and FVA, leaving mainly the MVA on posted initial margin
 * and a smaller capital charge.
 *
 * Pure SVG; the y-axis is centred on 0 (the risk-free price) so the small
 * adjustments are visible. Respects prefers-reduced-motion.
 */
export function XvaWaterfall({
  title = 'From risk-free price to all-in price: the XVA waterfall',
  riskFreePrice = 100,
  bilateralLabel = 'Bilateral (uncleared)',
  clearedLabel = 'Centrally cleared',
  riskFreeLabel = 'Risk-free',
  netLabel = 'Net XVA',
  allInLabel = 'All-in price',
  totalXvaLabel = 'Total XVA',
  unitLabel = 'pts',
  axisLabel = 'Adjustment vs risk-free',
  bilateralAdjustments = DEFAULT_BILATERAL,
  clearedAdjustments = DEFAULT_CLEARED,
  bilateralExplanation = 'Trading bilaterally, the desk wears the full stack. CVA charges for the chance the counterparty defaults; DVA hands a little back for your own default risk; FVA covers funding the uncollateralised mark; MVA funds the initial margin you post; KVA pays for the regulatory capital the position ties up. Net them and the price you quote is meaningfully worse than the textbook value.',
  clearedExplanation = 'Push the trade through a central counterparty and the bill changes shape. The CCP is default-remote and takes daily variation margin, so CVA, DVA and the funding (FVA) on the mark largely vanish. What is left is MVA — funding the initial margin the CCP demands — plus a smaller capital charge. Clearing does not make XVA disappear; it swaps default/funding risk for a margin-funding cost.',
  caption = 'Every desk quote starts from a clean risk-free value and then subtracts a stack of valuation adjustments — the XVA family — for default, funding, margin and capital. The waterfall shows each leg as a signed step; the net is the gap between the model price and the price you actually pay. Clearing reshapes the stack rather than removing it.',
  className,
}: XvaWaterfallProps) {
  const [scenario, setScenario] = useState<Scenario>('bilateral');

  const adjustments = scenario === 'bilateral' ? bilateralAdjustments : clearedAdjustments;

  const W = 540;
  const H = 280;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 56;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // Running totals so the floating bars stack.
  let running = 0;
  const steps = adjustments.map((a) => {
    const start = running;
    running += a.value;
    return { ...a, start, end: running };
  });
  const netXva = running;
  const allIn = riskFreePrice + netXva;

  // Symmetric-ish y-range around 0, with headroom. Keep a fixed scale across
  // scenarios so the two are comparable.
  const lo = Math.min(0, netXva, ...steps.map((s) => Math.min(s.start, s.end))) - 0.4;
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.start, s.end))) + 0.4;

  const nBars = steps.length + 1; // + net bar
  const slot = plotW / nBars;
  const barW = slot * 0.58;

  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * plotH;
  const zeroY = y(0);

  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

  const transition = prefersReducedMotion()
    ? undefined
    : { transition: 'all 300ms ease' };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Scenario">
        {(
          [
            ['bilateral', bilateralLabel],
            ['cleared', clearedLabel],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScenario(key)}
            aria-pressed={scenario === key}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              scenario === key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300',
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{allInLabel}</span>
          <span className="font-mono font-semibold text-brand-700">{allIn.toFixed(2)}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`XVA waterfall for the ${scenario} scenario. Starting from the risk-free price, the adjustments net to ${fmt(
          netXva,
        )} ${unitLabel}, giving an all-in price of ${allIn.toFixed(2)}.`}
      >
        {/* Risk-free baseline at 0 */}
        <line x1={padLeft} y1={zeroY} x2={W - padRight} y2={zeroY} stroke="var(--color-ink-400)" />
        <text x={padLeft - 6} y={zeroY - 4} fontSize={9.5} fill="var(--color-ink-500)" textAnchor="end">
          {riskFreeLabel}
        </text>

        {steps.map((s, i) => {
          const x = padLeft + i * slot + (slot - barW) / 2;
          const yTop = y(Math.max(s.start, s.end));
          const h = Math.max(1.5, Math.abs(y(s.start) - y(s.end)));
          const positive = s.value > 0;
          return (
            <g key={s.key}>
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                rx={2}
                fill={positive ? 'var(--color-brand-400)' : 'var(--color-accent-500)'}
                opacity={0.9}
                style={transition}
              />
              {/* value label */}
              <text
                x={x + barW / 2}
                y={(positive ? yTop : yTop + h) + (positive ? -4 : 12)}
                fontSize={10}
                fill={positive ? 'var(--color-brand-700)' : 'var(--color-accent-700)'}
                textAnchor="middle"
                fontWeight={600}
              >
                {fmt(s.value)}
              </text>
              {/* connector to next bar */}
              {i < steps.length - 1 && (
                <line
                  x1={x + barW}
                  y1={y(s.end)}
                  x2={padLeft + (i + 1) * slot + (slot - barW) / 2}
                  y2={y(s.end)}
                  stroke="var(--color-ink-300)"
                  strokeDasharray="3 2"
                  style={transition}
                />
              )}
              {/* leg label */}
              <text
                x={x + barW / 2}
                y={padTop + plotH + 16}
                fontSize={10}
                fill="var(--color-ink-600)"
                textAnchor="middle"
                fontWeight={500}
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Net XVA bar */}
        {(() => {
          const i = steps.length;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const yTop = y(Math.max(0, netXva));
          const h = Math.max(1.5, Math.abs(zeroY - y(netXva)));
          // connector from last step to the net bar's start
          const lastEnd = steps.length ? steps[steps.length - 1].end : 0;
          return (
            <g>
              {steps.length > 0 && (
                <line
                  x1={padLeft + (i - 1) * slot + (slot + barW) / 2}
                  y1={y(lastEnd)}
                  x2={x}
                  y2={y(lastEnd)}
                  stroke="var(--color-ink-300)"
                  strokeDasharray="3 2"
                />
              )}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                rx={2}
                fill="var(--color-ink-700)"
                style={transition}
              />
              <text
                x={x + barW / 2}
                y={yTop + h + 12}
                fontSize={10}
                fill="var(--color-ink-800)"
                textAnchor="middle"
                fontWeight={700}
              >
                {fmt(netXva)}
              </text>
              <text
                x={x + barW / 2}
                y={padTop + plotH + 16}
                fontSize={10}
                fill="var(--color-ink-800)"
                textAnchor="middle"
                fontWeight={700}
              >
                {netLabel}
              </text>
            </g>
          );
        })()}

        {/* Y-axis title */}
        <text
          x={14}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padTop + plotH / 2})`}
        >
          {axisLabel}
        </text>
      </svg>

      {/* Readouts */}
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{totalXvaLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">
            {fmt(netXva)} {unitLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{allInLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{allIn.toFixed(2)}</dd>
        </div>
      </dl>

      <p
        className="mt-3 rounded-card bg-surface-50 px-4 py-3 text-sm leading-relaxed text-ink-700"
        aria-live="polite"
      >
        {scenario === 'bilateral' ? bilateralExplanation : clearedExplanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default XvaWaterfall;
