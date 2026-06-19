import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type PolicyKind = 'twap' | 'almgren' | 'rl';

export interface ExecutionPolicyHeatmapProps {
  /** Heading above the grid. */
  title?: string;
  /** Which policy preset to start on. Defaults to `'twap'`. */
  policy?: PolicyKind;
  /** Preset button label — schedule-only TWAP. */
  twapLabel?: string;
  /** Preset button label — risk-averse Almgren–Chriss front-loading. */
  almgrenLabel?: string;
  /** Preset button label — price-responsive RL policy. */
  rlLabel?: string;
  /** Axis label for the columns (time toward the deadline). */
  timeAxisLabel?: string;
  /** Short caption for the start of the time axis. */
  timeStartLabel?: string;
  /** Short caption for the end of the time axis. */
  timeEndLabel?: string;
  /** Axis label for the rows (price signal / favourability). */
  signalAxisLabel?: string;
  /** Caption for the favourable (cheap-to-buy) top rows. */
  favourableLabel?: string;
  /** Caption for the unfavourable (expensive) bottom rows. */
  unfavourableLabel?: string;
  /** Short label for the policy's action (trade rate). */
  actionLabel?: string;
  /** Readout label for the selected cell's time. */
  timeReadoutLabel?: string;
  /** Readout label for the selected cell's price signal. */
  signalReadoutLabel?: string;
  /** Legend label for the low end of the colour scale. */
  lowLabel?: string;
  /** Legend label for the high end of the colour scale. */
  highLabel?: string;
  /** One-line takeaway shown under the grid. */
  caption?: string;
  className?: string;
}

// Columns: time progressing from the start of the trading window (left) to the
// hard deadline (right).
const TIME_STEPS = [0, 1, 2, 3, 4, 5];
// Rows: price signal, from most favourable to buy (top) to most adverse
// (bottom). Stored as a z-score-like deviation: +1.5 = a bargain, −1.5 = pricey.
const SIGNALS = [1.5, 0.75, 0.0, -0.75, -1.5];

const RATE_MIN = 0;
const RATE_MAX = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const pct = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/**
 * The trade rate (fraction of the *remaining* position executed this step) that
 * each policy prescribes for a given (time, price-signal) cell. This is the
 * action a(state) of a deterministic execution policy — a lookup table from
 * market state to behaviour.
 *
 *   • TWAP    — a pure schedule: the rate ramps up only as the deadline nears
 *     (1/steps-left), identical across every price row. Blind to price.
 *   • Almgren — risk-averse front-loading: trade hardest early to shed exposure
 *     fast, tapering later. Still price-blind (it optimises cost vs variance,
 *     not signal).
 *   • RL      — price-responsive: buy aggressively when the signal is cheap (top
 *     rows), hold back when it is expensive (bottom rows), and still ramp into
 *     the deadline so the order always completes.
 */
const rate = (policy: PolicyKind, timeIdx: number, signal: number): number => {
  const stepsLeft = TIME_STEPS.length - timeIdx; // 6 → 1
  const twap = 1 / stepsLeft; // schedule baseline

  if (policy === 'twap') return clamp(twap, RATE_MIN, RATE_MAX);

  if (policy === 'almgren') {
    // Front-load: an exponential urgency decay across time, normalised so the
    // last step still clears whatever is left.
    const frontLoad = Math.exp(-0.45 * timeIdx);
    const blended = 0.55 * frontLoad + 0.45 * twap;
    return clamp(stepsLeft === 1 ? 1 : blended, RATE_MIN, RATE_MAX);
  }

  // RL: schedule pressure (must finish) + a price tilt that leans into bargains
  // and pulls back on expensive prints.
  const schedule = 0.35 + 0.5 * twap;
  const priceTilt = 0.33 * signal; // +0.5 when cheap, −0.5 when pricey
  const deadlineOverride = stepsLeft === 1 ? 1 : schedule + priceTilt;
  return clamp(deadlineOverride, 0.04, RATE_MAX);
};

const POLICY_BUTTONS: { kind: PolicyKind; key: 'twap' | 'almgren' | 'rl' }[] = [
  { kind: 'twap', key: 'twap' },
  { kind: 'almgren', key: 'almgren' },
  { kind: 'rl', key: 'rl' },
];

/**
 * A learned **execution policy** rendered as a heatmap. Optimal execution is a
 * control problem: at every moment you observe the market state and must decide
 * how fast to trade. A *policy* is the map from state to action — exactly the
 * object reinforcement learning learns. This island makes that map literal.
 *
 * Columns are time marching toward a hard deadline; rows are a price signal from
 * "cheap" (top) to "expensive" (bottom). Each cell is coloured by the trade
 * rate the policy prescribes there — the fraction of the remaining position it
 * fires this step — with the number printed inside. Three presets show how the
 * *reward you optimise* reshapes the whole policy: a price-blind TWAP schedule,
 * a risk-averse Almgren–Chriss front-loader, and a price-responsive RL agent
 * that only the last two condition on the signal at all. Cells are buttons, so
 * the grid is fully keyboard-operable; nothing animates, so there is no motion
 * to reduce.
 */
export function ExecutionPolicyHeatmap({
  title = 'An execution policy is a state → action map',
  policy = 'twap',
  twapLabel = 'TWAP (schedule)',
  almgrenLabel = 'Almgren–Chriss (risk-averse)',
  rlLabel = 'RL (price-responsive)',
  timeAxisLabel = 'Time toward deadline',
  timeStartLabel = 'Start',
  timeEndLabel = 'Deadline',
  signalAxisLabel = 'Price signal',
  favourableLabel = 'Cheap',
  unfavourableLabel = 'Pricey',
  actionLabel = 'Trade rate',
  timeReadoutLabel = 'Time step',
  signalReadoutLabel = 'Price signal',
  lowLabel = 'Trade slowly',
  highLabel = 'Trade fast',
  caption = 'Same order, three policies. TWAP ignores price entirely — every row is identical. Almgren–Chriss front-loads to cut risk but is still price-blind. Only the RL policy conditions on the signal: it leans into cheap prints (top) and waits out expensive ones (bottom), while still ramping into the deadline so the order always fills. Change the reward and you change the map.',
  className,
}: ExecutionPolicyHeatmapProps) {
  const id = useId();

  const [policyKind, setPolicyKind] = useState<PolicyKind>(policy);
  // Selected cell as [signalRowIndex, timeColIndex]; default mid-signal, early.
  const [selected, setSelected] = useState<[number, number]>([2, 1]);

  const labelFor: Record<PolicyKind, string> = {
    twap: twapLabel,
    almgren: almgrenLabel,
    rl: rlLabel,
  };

  // Build the grid of trade rates: rows = signal, cols = time.
  const grid = SIGNALS.map((signal) => TIME_STEPS.map((_, t) => rate(policyKind, t, signal)));

  // Colour scale: map rate in [0, 1] onto a brand→accent ramp.
  const cellColor = (value: number): string => {
    const t = clamp((value - RATE_MIN) / (RATE_MAX - RATE_MIN), 0, 1);
    const lowPct = Math.round((1 - t) * 100);
    return `color-mix(in oklab, var(--color-brand-500) ${lowPct}%, var(--color-accent-500))`;
  };

  const cellTextColor = (value: number): string => {
    const t = clamp((value - RATE_MIN) / (RATE_MAX - RATE_MIN), 0, 1);
    return t > 0.5 ? 'var(--color-white)' : 'var(--color-ink-900)';
  };

  const [selRow, selCol] = selected;
  const selRate = grid[selRow][selCol];
  const selSignal = SIGNALS[selRow];
  const signalWord =
    selSignal > 0.3 ? favourableLabel : selSignal < -0.3 ? unfavourableLabel : '≈ fair';

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
          {actionLabel}: {pct(selRate)}
        </span>
      </figcaption>

      {/* Policy presets */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={title}>
        {POLICY_BUTTONS.map((b) => {
          const active = b.kind === policyKind;
          return (
            <button
              key={b.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setPolicyKind(b.kind)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-surface text-ink-700 hover:border-brand-400',
              )}
            >
              {labelFor[b.kind]}
            </button>
          );
        })}
      </div>

      {/* Heatmap grid */}
      <div className="mt-4 overflow-x-auto">
        <table
          className="w-full border-separate border-spacing-1 text-center"
          aria-label={`${title}. ${timeAxisLabel} across columns, ${signalAxisLabel} down rows.`}
        >
          <caption className="sr-only">
            {actionLabel} by {timeAxisLabel} and {signalAxisLabel}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-xs font-medium text-ink-500">
                <span className="block">{signalAxisLabel}</span>
                <span className="block text-ink-400">{timeAxisLabel} →</span>
              </th>
              {TIME_STEPS.map((t) => (
                <th key={`col-${t}`} scope="col" className="p-1 text-xs font-medium text-ink-600">
                  t{t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIGNALS.map((signal, r) => (
              <tr key={`row-${signal}`}>
                <th
                  scope="row"
                  className="whitespace-nowrap p-1 text-xs font-medium text-ink-600"
                >
                  {signal > 0 ? '+' : ''}
                  {signal.toFixed(2)}
                </th>
                {TIME_STEPS.map((t, c) => {
                  const value = grid[r][c];
                  const isSel = r === selRow && c === selCol;
                  return (
                    <td key={`cell-${signal}-${t}`} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSelected([r, c])}
                        aria-pressed={isSel}
                        aria-label={`${signalReadoutLabel} ${signal.toFixed(
                          2,
                        )}, ${timeReadoutLabel} ${t}, ${actionLabel} ${pct(value)}`}
                        className={cx(
                          'flex h-10 w-full min-w-12 items-center justify-center rounded-card font-mono text-xs font-semibold tabular-nums transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
                          isSel
                            ? 'ring-2 ring-ink-900 ring-offset-1 ring-offset-surface'
                            : 'hover:ring-2 hover:ring-ink-300',
                        )}
                        style={{
                          backgroundColor: cellColor(value),
                          color: cellTextColor(value),
                        }}
                      >
                        {pct(value)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Axis captions */}
      <div className="mt-1 flex justify-between text-xs text-ink-400">
        <span>← {timeStartLabel}</span>
        <span>{timeEndLabel} →</span>
      </div>

      {/* Colour-scale legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
        <span>{lowLabel}</span>
        <span
          className="h-3 flex-1 rounded-pill"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(to right, var(--color-brand-500), var(--color-accent-500))',
          }}
        />
        <span>{highLabel}</span>
      </div>

      {/* Readout */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{timeReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">t{selCol}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{signalReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-700">
            {selSignal > 0 ? '+' : ''}
            {selSignal.toFixed(2)} <span className="text-sm font-normal">({signalWord})</span>
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{actionLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{pct(selRate)}</dd>
        </div>
      </dl>

      <p id={`${id}-cap`} className="mt-3 text-sm leading-relaxed text-ink-600">
        {caption}
      </p>
    </figure>
  );
}

export default ExecutionPolicyHeatmap;
