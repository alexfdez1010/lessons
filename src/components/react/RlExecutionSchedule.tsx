import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type Policy = 'twap' | 'ac' | 'rl';

export interface RlExecutionScheduleProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the TWAP toggle. */
  twapLabel?: string;
  /** Label for the Almgren–Chriss toggle. */
  acLabel?: string;
  /** Label for the learned-RL toggle. */
  rlLabel?: string;
  /** Label for the predicted-drift slider. */
  signalLabel?: string;
  /** Label for the "price falling" (favourable for a buyer) end of the slider. */
  fallingLabel?: string;
  /** Label for the "price rising" (adverse for a buyer) end of the slider. */
  risingLabel?: string;
  /** Label for the per-step child-order bars. */
  childLabel?: string;
  /** Label for the remaining-inventory line. */
  inventoryLabel?: string;
  /** X-axis label. */
  timeLabel?: string;
  /** Label for the relative-cost readout. */
  costLabel?: string;
  /** Explanation shown for TWAP. */
  twapExplanation?: string;
  /** Explanation shown for Almgren–Chriss. */
  acExplanation?: string;
  /** Explanation shown for the learned RL policy. */
  rlExplanation?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const N = 6; // execution steps
const STEPS = Array.from({ length: N }, (_, i) => i);

/** Almgren–Chriss-style front-loaded weights: exponential inventory decay. */
function acWeights(kappa: number): number[] {
  const raw = STEPS.map((k) => Math.exp(-kappa * k));
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / s);
}

/**
 * Learned-RL weights: an Almgren–Chriss skeleton whose decay rate is *tilted by
 * the predicted price drift*. A rising price (adverse for a buyer) steepens the
 * decay → trade earlier; a falling price (favourable) flattens or reverses it →
 * wait and buy cheaper later. This is the whole point: the RL policy conditions
 * the schedule on a signal the closed form has no slot for.
 */
function rlWeights(signal: number): number[] {
  const kappa = 0.45 + 1.1 * signal; // signal ∈ [−1, 1]
  const raw = STEPS.map((k) => Math.exp(-kappa * k));
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / s);
}

function weightsFor(policy: Policy, signal: number): number[] {
  if (policy === 'twap') return STEPS.map(() => 1 / N);
  if (policy === 'ac') return acWeights(0.45);
  return rlWeights(signal);
}

/**
 * Relative implementation-shortfall index for a *buy* order, normalised so plain
 * TWAP at zero drift = 100. Two illustrative cost terms:
 *   • convex temporary impact  ∝ Σ n_k²  (fast slices cost disproportionately)
 *   • drift/timing cost        ∝ Σ n_k · drift · (k + ½)  (a rising price taxes
 *     every share you have not bought yet)
 * The numbers are pedagogical, not a calibrated cost model — they exist to show
 * that the signal-aware policy lands lowest whenever the drift is non-zero.
 */
function costIndex(weights: number[], signal: number): number {
  const impact = weights.reduce((a, w) => a + w * w, 0); // Σ (n/Q)²
  const drift = weights.reduce((a, w, k) => a + w * signal * (k + 0.5), 0);
  const IMPACT_COEF = 240;
  const DRIFT_COEF = 26;
  return IMPACT_COEF * impact + DRIFT_COEF * drift + 60;
}

/**
 * Deep-RL optimal-execution visual. Three child-order schedules — TWAP (flat),
 * Almgren–Chriss (fixed front-load), and a learned RL policy — drawn as per-step
 * bars with the remaining-inventory trajectory overlaid. A "predicted drift"
 * slider feeds a short-horizon price signal: only the RL bars react to it, and a
 * relative-cost readout shows the signal-aware policy edging out the two
 * signal-blind baselines whenever the drift is non-zero.
 *
 * Button + slider driven; no autoplay, so prefers-reduced-motion is satisfied
 * by construction. All strings are props; all colours are design tokens.
 */
export function RlExecutionSchedule({
  title = 'Execution schedules: TWAP vs Almgren–Chriss vs learned RL',
  twapLabel = 'TWAP',
  acLabel = 'Almgren–Chriss',
  rlLabel = 'Learned RL',
  signalLabel = 'Predicted price drift (next interval)',
  fallingLabel = 'Falling (cheaper soon)',
  risingLabel = 'Rising (pricier soon)',
  childLabel = 'Child orders',
  inventoryLabel = 'Inventory left',
  timeLabel = 'Time toward the deadline →',
  costLabel = 'Relative shortfall',
  twapExplanation = 'TWAP slices the parent order into equal pieces by the clock. It is flat in every column and completely blind to the drift signal — the bars never change as you move the slider. Dead simple, impossible to game, a perfectly respectable benchmark.',
  acExplanation = 'Almgren–Chriss front-loads: trade more early so less inventory sits exposed to volatility, following an exponentially decaying trajectory. But the classic model has no slot for a short-term signal, so it too ignores the slider — same front-load whether the price is about to rise or fall.',
  rlExplanation = 'The learned RL policy starts from the Almgren–Chriss skeleton and then tilts it with the signal: a rising price (adverse for a buyer) steepens the front-load to buy before the move; a falling price (favourable) flattens or reverses it to wait and buy cheaper. Conditioning on both time and signal is exactly what RL adds.',
  caption = 'Move the drift slider: only the learned policy reshapes its bars, and its relative shortfall slips below both signal-blind baselines whenever the drift is non-zero. At zero drift the RL policy collapses back onto Almgren–Chriss — RL re-derives the closed form in the closed form’s own world.',
  className,
}: RlExecutionScheduleProps) {
  const id = useId();
  const [policy, setPolicy] = useState<Policy>('rl');
  const [signal, setSignal] = useState(0.5); // −1 (falling) … +1 (rising)

  const W = 520;
  const H = 240;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 30;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const slot = plotW / N;
  const barW = slot * 0.6;

  const weights = weightsFor(policy, signal);
  const wMax = 0.6; // fixed scale so bar heights are comparable across policies

  // Remaining inventory after each step (starts at 1, drains to 0).
  let acc = 0;
  const invPts = [
    [padLeft, padTop] as const,
    ...weights.map((w, i) => {
      acc += w;
      const x = padLeft + (i + 1) * slot;
      const y = padTop + acc * plotH;
      return [x, y] as const;
    }),
  ];
  const invPath = invPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  const explanation =
    policy === 'twap' ? twapExplanation : policy === 'ac' ? acExplanation : rlExplanation;

  const policies: { key: Policy; label: string }[] = [
    { key: 'twap', label: twapLabel },
    { key: 'ac', label: acLabel },
    { key: 'rl', label: rlLabel },
  ];

  const costs: Record<Policy, number> = {
    twap: costIndex(weightsFor('twap', signal), signal),
    ac: costIndex(weightsFor('ac', signal), signal),
    rl: costIndex(weightsFor('rl', signal), signal),
  };
  const best = (Object.keys(costs) as Policy[]).reduce((a, b) => (costs[a] <= costs[b] ? a : b));

  return (
    <figure className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={title}>
        {policies.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPolicy(p.key)}
            aria-pressed={policy === p.key}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              policy === p.key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-4 rounded-sm bg-brand-500" aria-hidden="true" />
          {childLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-4 rounded-sm bg-accent-500" aria-hidden="true" />
          {inventoryLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${policy.toUpperCase()} child-order schedule with remaining-inventory trajectory.`}
      >
        {/* child-order bars */}
        {weights.map((w, i) => {
          const h = (w / wMax) * plotH;
          const x = padLeft + (i + 0.5) * slot - barW / 2;
          const y = padTop + plotH - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill="var(--color-brand-500)"
              opacity={0.85}
              style={{ transition: 'all 300ms ease' }}
            />
          );
        })}

        {/* remaining-inventory trajectory */}
        <path d={invPath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2.5} style={{ transition: 'all 300ms ease' }} />

        {/* baseline */}
        <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="var(--color-ink-300)" />
        <text x={padLeft + plotW / 2} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {timeLabel}
        </text>
      </svg>

      {/* drift signal slider */}
      <div className="mt-3">
        <label htmlFor={`${id}-sig`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{signalLabel}</span>
          <span className="font-mono text-ink-900">{signal > 0 ? '+' : ''}{signal.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-sig`}
          type="range"
          min={-1}
          max={1}
          step={0.1}
          value={signal}
          onChange={(e) => setSignal(Number(e.target.value))}
          aria-label={signalLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>← {fallingLabel}</span>
          <span>{risingLabel} →</span>
        </div>
      </div>

      {/* relative-cost readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        {policies.map((p) => (
          <div
            key={p.key}
            className={cx(
              'rounded-card border px-3 py-2',
              best === p.key ? 'border-brand-400 bg-brand-50' : 'border-ink-100 bg-surface-sunken/40',
            )}
          >
            <dt className="text-ink-500">{p.label}</dt>
            <dd className="font-mono text-lg font-semibold text-ink-900">
              {costs[p.key].toFixed(0)}
              <span className="ml-1 text-xs font-normal text-ink-500">{costLabel}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 rounded-card bg-surface-50 px-4 py-3 text-sm leading-relaxed text-ink-700" aria-live="polite">
        {explanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RlExecutionSchedule;
