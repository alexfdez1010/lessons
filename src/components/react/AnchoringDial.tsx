import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AnchoringDialProps {
  /** Heading above the dial. */
  title?: string;
  /** One-line takeaway under the number line. */
  caption?: string;
  /** Framing line describing the guess being made. */
  scenario?: string;
  /** Anchor-free value the estimate would be without any anchor. Defaults to `100`. */
  fairValue?: number;
  /** Fraction (0..1) the estimate is dragged from fair value toward the anchor. Defaults to `0.4`. */
  pullStrength?: number;
  /** Slider minimum. Defaults to `0`. */
  minAnchor?: number;
  /** Slider maximum. Defaults to `300`. */
  maxAnchor?: number;
  /** Initial anchor value. Defaults to `250`. */
  anchor?: number;
  /** Currency / unit symbol prefixed to values. Defaults to `'$'`. */
  unit?: string;
  /** Slider label. */
  anchorLabel?: string;
  /** Label for the resulting anchored estimate. */
  estimateLabel?: string;
  /** Label for the anchor-free fair value. */
  fairValueLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (unit: string, value: number): string =>
  `${unit}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(value) < 100 && value % 1 !== 0 ? 1 : 0,
  }).format(value)}`;

/**
 * Anchoring made visible. A slider sets the first number you saw — the anchor —
 * and the estimate is dragged a fixed fraction of the way from an anchor-free
 * fair value toward that anchor: estimate = fairValue + pullStrength·(anchor −
 * fairValue). A horizontal number line plots all three (anchor, anchored
 * estimate, fair value) and a "pull" connector shows the estimate sliding off
 * the truth toward whatever arbitrary number the slider lands on. Locale-agnostic
 * (all labels are props); the estimate marker eases toward its new spot and
 * respects `prefers-reduced-motion`.
 */
export function AnchoringDial({
  title = 'Anchoring: an arbitrary number drags your guess',
  caption = 'The estimate never reaches the fair value — it gets pulled a fixed fraction of the way toward whatever number you saw first. That gap is the anchoring bias.',
  scenario = "You're guessing a fair price for a stock.",
  fairValue = 100,
  pullStrength = 0.4,
  minAnchor = 0,
  maxAnchor = 300,
  anchor = 250,
  unit = '$',
  anchorLabel = 'The number you saw first (the anchor)',
  estimateLabel = 'Your likely estimate',
  fairValueLabel = 'Anchor-free fair value',
  className,
}: AnchoringDialProps) {
  const id = useId();
  const [anchorState, setAnchor] = useState(anchor);
  const [estDisplay, setEstDisplay] = useState(
    fairValue + pullStrength * (anchor - fairValue),
  );
  const rafRef = useRef<number | null>(null);

  const estimate = fairValue + pullStrength * (anchorState - fairValue);

  // Geometry of the number line.
  const W = 520;
  const H = 150;
  const padX = 24;
  const axisY = 96;
  const span = Math.max(maxAnchor - minAnchor, 1);
  const xOf = (v: number) =>
    padX + ((v - minAnchor) / span) * (W - padX * 2);

  // Ease the displayed estimate toward its target when inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setEstDisplay(estimate);
      return;
    }
    const from = estDisplay;
    const to = estimate;
    if (Math.abs(to - from) < 0.01) {
      setEstDisplay(to);
      return;
    }
    const duration = 320;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setEstDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // estDisplay intentionally omitted: we snapshot it as the animation start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorState, fairValue, pullStrength]);

  const xAnchor = xOf(anchorState);
  const xFair = xOf(fairValue);
  const xEst = xOf(estDisplay);

  const pctPulled = Math.round(pullStrength * 100);

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
          {pctPulled}% pull
        </span>
      </figcaption>

      {scenario && <p className="mt-2 text-sm text-ink-600">{scenario}</p>}

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-pill bg-ink-400" aria-hidden="true" />
          {anchorLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-pill bg-brand-600" aria-hidden="true" />
          {estimateLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-pill bg-accent-500" aria-hidden="true" />
          {fairValueLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${scenario} The anchor-free fair value is ${fmt(unit, fairValue)}, but seeing ${fmt(unit, anchorState)} first pulls your estimate to about ${fmt(unit, estimate)}.`}
      >
        {/* axis */}
        <line
          x1={padX}
          y1={axisY}
          x2={W - padX}
          y2={axisY}
          stroke="var(--color-ink-200)"
          strokeWidth={2}
        />
        {/* pull connector: fair value -> estimate */}
        <line
          x1={xFair}
          y1={axisY}
          x2={xEst}
          y2={axisY}
          stroke="var(--color-brand-400)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* faint pull arrow toward the anchor */}
        <line
          x1={xEst}
          y1={axisY}
          x2={xAnchor}
          y2={axisY}
          stroke="var(--color-ink-300)"
          strokeWidth={2}
          strokeDasharray="4 5"
        />

        {/* fair value marker */}
        <g>
          <line
            x1={xFair}
            y1={axisY - 18}
            x2={xFair}
            y2={axisY + 18}
            stroke="var(--color-accent-500)"
            strokeWidth={2}
          />
          <text
            x={xFair}
            y={axisY + 34}
            textAnchor="middle"
            fill="var(--color-accent-600)"
            className="font-mono"
            fontSize={13}
          >
            {fmt(unit, fairValue)}
          </text>
        </g>

        {/* anchor marker */}
        <g>
          <line
            x1={xAnchor}
            y1={axisY - 22}
            x2={xAnchor}
            y2={axisY + 22}
            stroke="var(--color-ink-400)"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <text
            x={xAnchor}
            y={axisY - 28}
            textAnchor="middle"
            fill="var(--color-ink-600)"
            className="font-mono"
            fontSize={13}
          >
            {fmt(unit, anchorState)}
          </text>
        </g>

        {/* estimate marker (on top) */}
        <g>
          <circle cx={xEst} cy={axisY} r={8} fill="var(--color-brand-600)" />
          <text
            x={xEst}
            y={axisY - 16}
            textAnchor="middle"
            fill="var(--color-brand-700)"
            className="font-mono"
            fontSize={14}
            fontWeight={600}
          >
            {fmt(unit, estDisplay)}
          </text>
        </g>
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-anchor`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{anchorLabel}</span>
          <span className="font-mono text-ink-900">{fmt(unit, anchorState)}</span>
        </label>
        <input
          id={`${id}-anchor`}
          type="range"
          min={minAnchor}
          max={maxAnchor}
          step={1}
          value={anchorState}
          onChange={(e) => setAnchor(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{estimateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(unit, estimate)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{fairValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {fmt(unit, fairValue)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AnchoringDial;
