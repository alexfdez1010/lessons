import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ForwardRateBridgeProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the near-maturity slider (e.g. the 1-year spot). */
  nearLabel?: string;
  /** Label for the far-maturity slider (e.g. the 2-year spot). */
  farLabel?: string;
  /** Readout label for the implied forward rate. */
  forwardLabel?: string;
  /** Legend label for the two spot-rate anchors. */
  spotAnchorLabel?: string;
  /** Legend label for the forward-rate bridge segment. */
  bridgeLabel?: string;
  /** Tick label for the near maturity (e.g. "Year 1"). */
  nearTick?: string;
  /** Tick label for the far maturity (e.g. "Year 2"). */
  farTick?: string;
  /** Tick label for time zero (e.g. "Today"). */
  todayTick?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial near (short) spot rate as a percent value. Defaults to `4`. */
  nearSpot?: number;
  /** Initial far (long) spot rate as a percent value. Defaults to `5`. */
  farSpot?: number;
  /** Maturity of the near spot in years. Defaults to `1`. */
  nearYears?: number;
  /** Maturity of the far spot in years. Defaults to `2`. */
  farYears?: number;
  className?: string;
}

const fmtPct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;

/**
 * Forward rate as the BRIDGE between two spot rates. A 1-year and a 2-year spot
 * rate together imply the rate you can lock in today for the *future* year
 * spanning year 1 to year 2 — the forward rate. The chart anchors the two spot
 * points on a maturity axis and draws the forward as a coloured segment
 * spanning the gap; drag the two spots and the forward updates live (via the
 * no-arbitrage compounding relation, computed internally — no rates are
 * hardcoded). When the curve slopes up the forward sits *above* both spots;
 * when it inverts the forward dives *below* them. Locale-agnostic; no LaTeX or
 * fixed numbers baked in.
 */
export function ForwardRateBridge({
  title = 'The forward rate is the bridge between two spots',
  nearLabel = 'Near spot rate',
  farLabel = 'Far spot rate',
  forwardLabel = 'Implied forward rate',
  spotAnchorLabel = 'Spot rates',
  bridgeLabel = 'Forward rate (the bridge)',
  nearTick = 'Year 1',
  farTick = 'Year 2',
  todayTick = 'Today',
  caption = 'Two spot rates pin down the forward rate between them by no-arbitrage: rolling the near spot then the forward must equal the far spot compounded. An upward curve forces the forward above both spots; an inverted curve drags it below.',
  nearSpot = 4,
  farSpot = 5,
  nearYears = 1,
  farYears = 2,
  className,
}: ForwardRateBridgeProps) {
  const id = useId();
  const [near, setNear] = useState(nearSpot);
  const [far, setFar] = useState(farSpot);

  // No-arbitrage forward between nearYears and farYears:
  // (1+far)^farYears = (1+near)^nearYears · (1+f)^(farYears-nearYears)
  const gap = Math.max(0.0001, farYears - nearYears);
  const grossFar = Math.pow(1 + far / 100, farYears);
  const grossNear = Math.pow(1 + near / 100, nearYears);
  const forward = (Math.pow(grossFar / grossNear, 1 / gap) - 1) * 100;

  const W = 520;
  const H = 220;
  const padX = 48;
  const padTop = 22;
  const axisY = H - 40;

  const rates = [near, far, forward];
  const maxR = Math.max(...rates) * 1.12;
  const minR = Math.min(...rates) * 0.85;

  const tMax = farYears * 1.1;
  const x = (t: number) => padX + (t / tMax) * (W - padX * 2);
  const y = (r: number) =>
    padTop + (1 - (r - minR) / (maxR - minR)) * (axisY - padTop);

  const nearX = x(nearYears);
  const farX = x(farYears);
  const nearY = y(near);
  const farY = y(far);
  const fwdY = y(forward);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white">
          {forwardLabel}: {fmtPct(forward)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-pill bg-brand-600" aria-hidden="true" />
          {spotAnchorLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {bridgeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a ${fmtPct(near)} near spot and a ${fmtPct(
          far,
        )} far spot imply a forward rate of ${fmtPct(forward)}.`}
      >
        {/* Axis */}
        <line x1={padX} y1={axisY} x2={W - padX} y2={axisY} stroke="var(--color-ink-200)" />
        {[
          { t: 0, label: todayTick },
          { t: nearYears, label: nearTick },
          { t: farYears, label: farTick },
        ].map((tk, i) => (
          <g key={`t-${i}`}>
            <line x1={x(tk.t)} y1={axisY} x2={x(tk.t)} y2={axisY + 5} stroke="var(--color-ink-200)" />
            <text
              x={x(tk.t)}
              y={axisY + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-500)"
            >
              {tk.label}
            </text>
          </g>
        ))}

        {/* Spot rays from today to each maturity */}
        <line x1={x(0)} y1={y(0 < minR ? minR : Math.min(near, far))} x2={nearX} y2={nearY} stroke="var(--color-brand-200)" strokeWidth={1.5} strokeDasharray="3 3" />
        <line x1={nearX} y1={nearY} x2={farX} y2={farY} stroke="var(--color-brand-300)" strokeWidth={1.5} strokeDasharray="3 3" />

        {/* The forward bridge: horizontal segment at the forward rate over [near, far] */}
        <line x1={nearX} y1={fwdY} x2={farX} y2={fwdY} stroke="var(--color-accent-500)" strokeWidth={3} strokeLinecap="round" />
        {/* Drop guides marking the span */}
        <line x1={nearX} y1={fwdY} x2={nearX} y2={axisY} stroke="var(--color-accent-500)" strokeWidth={1} opacity={0.4} />
        <line x1={farX} y1={fwdY} x2={farX} y2={axisY} stroke="var(--color-accent-500)" strokeWidth={1} opacity={0.4} />
        <text x={(nearX + farX) / 2} y={fwdY - 8} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--color-accent-600)">
          {fmtPct(forward)}
        </text>

        {/* Spot anchor dots */}
        <circle cx={nearX} cy={nearY} r={6} fill="var(--color-brand-600)" stroke="white" strokeWidth={2} />
        <text x={nearX} y={nearY - 11} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--color-brand-700)">{fmtPct(near)}</text>
        <circle cx={farX} cy={farY} r={6} fill="var(--color-brand-600)" stroke="white" strokeWidth={2} />
        <text x={farX} y={farY - 11} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono, monospace)" fill="var(--color-brand-700)">{fmtPct(far)}</text>
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-near`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{nearLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(near)}</span>
          </label>
          <input
            id={`${id}-near`}
            type="range"
            min={1}
            max={9}
            step={0.1}
            value={near}
            onChange={(e) => setNear(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-far`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{farLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(far)}</span>
          </label>
          <input
            id={`${id}-far`}
            type="range"
            min={1}
            max={9}
            step={0.1}
            value={far}
            onChange={(e) => setFar(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ForwardRateBridge;
