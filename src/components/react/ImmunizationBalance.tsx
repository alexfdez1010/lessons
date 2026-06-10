import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ImmunizationBalanceProps {
  /** Heading above the widget. */
  title?: string;
  /** Label for the liability-duration readout (the target). */
  liabilityLabel?: string;
  /** Label for the asset-duration readout (what you build). */
  assetLabel?: string;
  /** Label for the short-bond weight slider. */
  shortLabel?: string;
  /** Label for the long-bond weight slider. */
  longLabel?: string;
  /** Status text when assets are duration-matched to the liability. */
  matchedStatus?: string;
  /** Status text when the asset duration is too short. */
  tooShortStatus?: string;
  /** Status text when the asset duration is too long. */
  tooLongStatus?: string;
  /** Caption shown when matched (immunized). */
  matchedCaption?: string;
  /** Caption shown when not matched. */
  mismatchCaption?: string;
  /** Suffix for a duration value in years (e.g. "yr"). */
  yearsUnit?: string;
  /** Duration of the short bullet bond, in years. Defaults to `2`. */
  shortDuration?: number;
  /** Duration of the long bullet bond, in years. Defaults to `12`. */
  longDuration?: number;
  /** Target liability duration to immunize, in years. Defaults to `7`. */
  liabilityDuration?: number;
  /** Initial weight on the long bond (0–100). Defaults to `40`. */
  longWeight?: number;
  className?: string;
}

const fmtYears = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/**
 * Immunization as a barbell BALANCE SCALE. To immunize a liability you build an
 * asset portfolio whose duration equals the liability's — here, a short bullet
 * and a long bullet blended into a barbell. The beam tilts by the gap between
 * asset and liability duration: too much long weight and it tips one way, too
 * much short the other. A green level beam means the portfolio is duration-
 * matched (immunized to first order). Drag the long-bond weight; the asset
 * duration (a weighted average) and the tilt update live. The duration values
 * come from props and the weighted average is computed internally — no numbers
 * are hardcoded. Respects `prefers-reduced-motion` via CSS transition only.
 */
export function ImmunizationBalance({
  title = 'Immunization is a duration balance',
  liabilityLabel = 'Liability duration (target)',
  assetLabel = 'Asset duration (built)',
  shortLabel = 'Short bond weight',
  longLabel = 'Long bond weight',
  matchedStatus = 'Immunized — durations matched',
  tooShortStatus = 'Asset duration too short',
  tooLongStatus = 'Asset duration too long',
  matchedCaption = 'Asset duration equals liability duration: a small parallel rate move changes both sides by the same amount, so the surplus is protected. That is first-order immunization.',
  mismatchCaption = 'The beam is tilted: asset and liability durations differ, so a rate move hits the two sides unequally and the funding gap drifts. Rebalance the barbell until the beam is level.',
  yearsUnit = 'yr',
  shortDuration = 2,
  longDuration = 12,
  liabilityDuration = 7,
  longWeight = 40,
  className,
}: ImmunizationBalanceProps) {
  const id = useId();
  const [wLong, setWLong] = useState(longWeight);
  const wShort = 100 - wLong;

  const assetDuration =
    (wShort / 100) * shortDuration + (wLong / 100) * longDuration;
  const gap = assetDuration - liabilityDuration;
  const eps = 0.05;
  const matched = Math.abs(gap) <= eps;

  const status = matched
    ? matchedStatus
    : gap < 0
      ? tooShortStatus
      : tooLongStatus;
  const statusClass = matched
    ? 'bg-brand-600'
    : 'bg-accent-500';

  // Beam geometry: tilt angle proportional to the duration gap, clamped.
  const W = 520;
  const H = 200;
  const cx0 = W / 2;
  const pivotY = 96;
  const beamHalf = 170;
  const maxGap = Math.max(
    longDuration - liabilityDuration,
    liabilityDuration - shortDuration,
  );
  const tiltDeg = Math.max(-14, Math.min(14, (gap / (maxGap || 1)) * 14));
  const rad = (tiltDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * beamHalf;
  const dy = Math.sin(rad) * beamHalf;

  // Pan heights scale with each side's weight (visual heft).
  const leftPanY = pivotY - dy + 16;
  const rightPanY = pivotY + dy + 16;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            statusClass,
          )}
        >
          {status}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: asset duration ${fmtYears(
          assetDuration,
        )} years versus liability duration ${fmtYears(liabilityDuration)} years — ${status}.`}
      >
        {/* Stand */}
        <line x1={cx0} y1={pivotY} x2={cx0} y2={H - 18} stroke="var(--color-ink-300)" strokeWidth={3} />
        <polygon
          points={`${cx0 - 26},${H - 18} ${cx0 + 26},${H - 18} ${cx0 + 14},${H - 30} ${cx0 - 14},${H - 30}`}
          fill="var(--color-ink-200)"
        />
        {/* Pivot */}
        <circle cx={cx0} cy={pivotY} r={5} fill="var(--color-ink-500)" />

        {/* Beam */}
        <g
          style={
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
              ? undefined
              : { transition: 'transform 300ms ease-out' }
          }
        >
          <line
            x1={cx0 - dx}
            y1={pivotY + dy}
            x2={cx0 + dx}
            y2={pivotY - dy}
            stroke={matched ? 'var(--color-brand-600)' : 'var(--color-accent-500)'}
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* Left pan = short bond, right pan = long bond */}
          <g>
            <line x1={cx0 - dx} y1={pivotY + dy} x2={cx0 - dx} y2={leftPanY + 18} stroke="var(--color-ink-300)" strokeWidth={1.5} />
            <rect
              x={cx0 - dx - 34}
              y={leftPanY + 18}
              width={68}
              height={Math.max(10, (wShort / 100) * 44)}
              rx={4}
              fill="var(--color-brand-500)"
              opacity={0.85}
            />
            <text x={cx0 - dx} y={leftPanY + 14} textAnchor="middle" fontSize={11} fill="var(--color-ink-600)">
              {wShort}%
            </text>
          </g>
          <g>
            <line x1={cx0 + dx} y1={pivotY - dy} x2={cx0 + dx} y2={rightPanY + 18} stroke="var(--color-ink-300)" strokeWidth={1.5} />
            <rect
              x={cx0 + dx - 34}
              y={rightPanY + 18}
              width={68}
              height={Math.max(10, (wLong / 100) * 44)}
              rx={4}
              fill="var(--color-accent-500)"
              opacity={0.85}
            />
            <text x={cx0 + dx} y={rightPanY + 14} textAnchor="middle" fontSize={11} fill="var(--color-ink-600)">
              {wLong}%
            </text>
          </g>
        </g>
      </svg>

      {/* Readouts */}
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{assetLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmtYears(assetDuration)} {yearsUnit}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{liabilityLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmtYears(liabilityDuration)} {yearsUnit}
          </dd>
        </div>
      </dl>

      {/* Slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-long`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{longLabel}</span>
          <span className="font-mono text-ink-900">{wLong}%</span>
        </label>
        <input
          id={`${id}-long`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={wLong}
          onChange={(e) => setWLong(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <p className="mt-1 text-xs text-ink-500">
          {shortLabel}: {wShort}%
        </p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {matched ? matchedCaption : mismatchCaption}
      </p>
    </figure>
  );
}

export default ImmunizationBalance;
