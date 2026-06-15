import { useState } from 'react';
import { cx } from '@/components/react/cx';

type Instrument = 'swap' | 'fxforward';

export interface ExposureProfileProps {
  /** Heading above the chart. */
  title?: string;
  /** Years to maturity modelled on the x-axis. Defaults to `5`. */
  maturityYears?: number;
  /** Label for the interest-rate-swap toggle. */
  swapLabel?: string;
  /** Label for the FX-forward toggle. */
  fxLabel?: string;
  /** Label for the "add collateral / CSA" checkbox. */
  collateralLabel?: string;
  /** Legend label for the expected-exposure curve. */
  eeLabel?: string;
  /** Legend label for the potential-future-exposure curve. */
  pfeLabel?: string;
  /** X-axis title. Defaults to `'Time (years)'`. */
  timeAxisLabel?: string;
  /** Y-axis title. Defaults to `'Exposure'`. */
  exposureAxisLabel?: string;
  /** Readout label for peak PFE. */
  peakPfeLabel?: string;
  /** Readout label for expected positive exposure (EPE). */
  epeLabel?: string;
  /** Explanation shown for the swap profile. */
  swapExplanation?: string;
  /** Explanation shown for the FX-forward profile. */
  fxExplanation?: string;
  /** Explanation shown when collateral is switched on. */
  collateralExplanation?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Credit-exposure profile of a derivative over its life.
 *
 * Counterparty exposure = the *replacement cost* if the counterparty defaults
 * now, i.e. max(value, 0). Because the future value is uncertain, we plot two
 * curves through time:
 *
 *   • Expected Exposure  EE(t)  — the average of the positive part.
 *   • Potential Future Exposure PFE(t) — a high quantile (here ~95%), the
 *     plausible *bad* case used for limits.
 *
 * The shape depends on the instrument. Two opposing forces drive it:
 *
 *   • the DIFFUSION effect — uncertainty about the mark grows like √t, pushing
 *     exposure UP over time, and
 *   • the AMORTISATION effect — as a swap pays down its cash flows, there is
 *     less left to replace, pulling exposure DOWN toward zero at maturity.
 *
 * An interest-rate SWAP feels both, so its profile is a HUMP that peaks around
 * a third of the way in and returns to zero. An FX FORWARD has a single
 * exchange at maturity (no amortisation), so diffusion wins and exposure climbs
 * monotonically to its maximum at the end.
 *
 * Switching on COLLATERAL (a CSA with daily variation margin) caps the profile
 * to a thin band: all that remains is the gap that can open up over the
 * ~10-day margin period of risk before you can close out a defaulter.
 *
 * Pure SVG, no simulation — the curves are closed-form parametric proxies.
 * Respects prefers-reduced-motion (transitions are dropped).
 */
export function ExposureProfile({
  title = 'Exposure profile: how much is at risk, and when',
  maturityYears = 5,
  swapLabel = 'Interest-rate swap',
  fxLabel = 'FX forward',
  collateralLabel = 'Add collateral (CSA)',
  eeLabel = 'Expected exposure (EE)',
  pfeLabel = 'Potential future exposure (PFE, 95%)',
  timeAxisLabel = 'Time (years)',
  exposureAxisLabel = 'Exposure',
  peakPfeLabel = 'Peak PFE',
  epeLabel = 'EPE (avg EE)',
  swapExplanation = 'A swap feels two opposing forces: diffusion (uncertainty about the mark grows like √t, pushing exposure up) and amortisation (each settled payment leaves less left to replace, pulling it down). The result is a hump — peaking about a third of the way in, then sliding back to zero at maturity when nothing is left to exchange.',
  fxExplanation = 'An FX forward settles in one shot at maturity, so there is no amortisation to drag exposure down. Only diffusion is left: uncertainty about the exchange rate grows steadily, so exposure climbs monotonically and is largest on the very last day.',
  collateralExplanation = 'With a CSA and daily variation margin, the counterparty posts cash as the mark moves in your favour, so the running exposure is collapsed to a thin band. All that survives is the gap that can open up over the ~10-day margin period of risk — the lag between their last missed margin call and your close-out.',
  caption = 'Exposure is the replacement cost if your counterparty defaults — max(value, 0) — and it is uncertain, so we track its average (EE) and a bad-case quantile (PFE) through time. Swaps hump and amortise to zero; FX forwards climb to a maturity peak. Collateral flattens the whole picture to the margin-period-of-risk gap. These profiles are the raw material every XVA is integrated against.',
  className,
}: ExposureProfileProps) {
  const [instrument, setInstrument] = useState<Instrument>('swap');
  const [collateral, setCollateral] = useState(false);

  const W = 540;
  const H = 280;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 52;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const T = Math.max(1, maturityYears);
  const SAMPLES = 120;

  // PFE-to-EE multiplier: a ~95% quantile sits well above the mean of a
  // (roughly half-normal) positive exposure. ~2.5× is the textbook ballpark.
  const PFE_MULT = 2.5;
  // Collateralised residual: a thin, roughly constant band representing the
  // exposure that builds over the margin period of risk (≈ a fixed fraction).
  const COLLATERAL_RESIDUAL = 0.13;

  // Uncollateralised EE shape, normalised so its maximum is ~1.0.
  const eeShape = (t: number): number => {
    const u = t / T; // 0..1
    if (instrument === 'swap') {
      // Diffusion √u up, amortisation (1−u) down → a hump. Normalise to peak 1.
      const raw = Math.sqrt(u) * (1 - u);
      const peak = Math.sqrt(1 / 3) * (2 / 3); // max of √u·(1−u) at u=1/3
      return raw / peak;
    }
    // FX forward: diffusion only, monotone √u, peaks at maturity.
    return Math.sqrt(u);
  };

  const eeAt = (t: number): number => {
    const base = eeShape(t);
    if (!collateral) return base;
    // Collateral caps the profile to a thin residual band that itself grows a
    // little with diffusion over the margin period (so it is not dead-flat).
    return Math.min(base, COLLATERAL_RESIDUAL * (0.6 + 0.4 * Math.sqrt(t / T)));
  };

  const samples: { t: number; ee: number; pfe: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * T;
    const ee = eeAt(t);
    samples.push({ t, ee, pfe: ee * PFE_MULT });
  }

  // Fixed y-scale so toggling instruments / collateral is visually comparable.
  const yMax = PFE_MULT * 1.05;

  const x = (t: number) => padLeft + (t / T) * plotW;
  const y = (v: number) => padTop + (1 - Math.min(v, yMax) / yMax) * plotH;

  const linePath = (key: 'ee' | 'pfe'): string => {
    let d = '';
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      d += `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`;
    }
    return d;
  };

  // Shaded PFE area (down to the baseline).
  const pfeArea =
    linePath('pfe') +
    ` L ${x(T).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const peakPfe = samples.reduce((m, p) => Math.max(m, p.pfe), 0);
  const epe = samples.reduce((s, p) => s + p.ee, 0) / samples.length;

  const xTicks = Array.from({ length: T + 1 }, (_, i) => i);

  const explanation = collateral
    ? collateralExplanation
    : instrument === 'swap'
      ? swapExplanation
      : fxExplanation;

  const transition = prefersReducedMotion() ? undefined : { transition: 'd 300ms ease' };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Instrument">
        {(
          [
            ['swap', swapLabel],
            ['fxforward', fxLabel],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setInstrument(key)}
            aria-pressed={instrument === key}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              instrument === key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300',
            )}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-pill border border-ink-200 px-3 py-1 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={collateral}
            onChange={(e) => setCollateral(e.target.checked)}
            className="accent-accent-600"
          />
          {collateralLabel}
        </label>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4" aria-hidden="true">
        <span className="flex items-center gap-2 text-sm text-ink-700">
          <span className="inline-block h-3 w-3 rounded-pill bg-brand-500" />
          {eeLabel}
        </span>
        <span className="flex items-center gap-2 text-sm text-ink-700">
          <span className="inline-block h-3 w-3 rounded-pill bg-accent-400/40" />
          {pfeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Exposure profile for the ${
          instrument === 'swap' ? 'interest-rate swap' : 'FX forward'
        }${collateral ? ', collateralised' : ''}. ${
          instrument === 'swap' && !collateral
            ? 'A hump that peaks early and returns to zero at maturity.'
            : instrument === 'fxforward' && !collateral
              ? 'A monotonically rising curve peaking at maturity.'
              : 'A thin, near-flat band capped by collateral.'
        }`}
      >
        {/* Baseline + y gridlines */}
        <line x1={padLeft} y1={y(0)} x2={W - padRight} y2={y(0)} stroke="var(--color-ink-300)" />
        {[0.5, 1, 1.5, 2, 2.5].map((v) => (
          <line
            key={v}
            x1={padLeft}
            y1={y(v)}
            x2={W - padRight}
            y2={y(v)}
            stroke="var(--color-ink-100)"
            strokeDasharray="2 3"
          />
        ))}

        {/* X ticks */}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={y(0)} x2={x(t)} y2={y(0) + 4} stroke="var(--color-ink-300)" />
            <text
              x={x(t)}
              y={y(0) + 16}
              fontSize={10}
              fill="var(--color-ink-500)"
              textAnchor="middle"
            >
              {t}
            </text>
          </g>
        ))}

        {/* PFE shaded area */}
        <path d={pfeArea} fill="var(--color-accent-400)" opacity={0.18} style={transition} />
        {/* PFE line */}
        <path
          d={linePath('pfe')}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={transition}
        />
        {/* EE line */}
        <path
          d={linePath('ee')}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={transition}
        />

        {/* Axis titles */}
        <text
          x={padLeft + plotW / 2}
          y={H - 8}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {timeAxisLabel}
        </text>
        <text
          x={14}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padTop + plotH / 2})`}
        >
          {exposureAxisLabel}
        </text>
      </svg>

      {/* Readouts */}
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{peakPfeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">
            {peakPfe.toFixed(2)}×
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{epeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{epe.toFixed(2)}×</dd>
        </div>
      </dl>

      <p
        className="mt-3 rounded-card bg-surface-50 px-4 py-3 text-sm leading-relaxed text-ink-700"
        aria-live="polite"
      >
        {explanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ExposureProfile;
