import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DriftDetectorTimelineProps {
  /** Heading above the timeline. */
  title?: string;
  /** Label for the "gradual drift" speed button. */
  slowLabel?: string;
  /** Label for the "fast drift" speed button. */
  fastLabel?: string;
  /** Label for the detector-threshold (sensitivity) slider. */
  thresholdLabel?: string;
  /** Label for the time / x-axis. */
  timeAxisLabel?: string;
  /** Legend label for the strategy-edge line. */
  edgeLegendLabel?: string;
  /** Legend label for the drift-statistic line. */
  driftLegendLabel?: string;
  /** Legend label for the threshold line. */
  thresholdLegendLabel?: string;
  /** Alarm chip text shown when the detector fires. */
  alarmLabel?: string;
  /** Readout chip: rolling edge at the moment the detector fires. */
  edgeAtDetectionLabel?: string;
  /** Readout chip: months elapsed until the detector fires. */
  monthsToDetectionLabel?: string;
  /** Text shown in the months readout when the detector never fires. */
  neverFiresLabel?: string;
  /** One-line takeaway under the timeline. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MONTHS = 24; // timeline length, in months

// The live strategy's rolling edge (think rolling Sharpe). It sits at a healthy
// level while the feature distribution matches training, then decays — and can
// turn negative — as covariate shift accumulates. `speed` scales how fast the
// distribution drifts; a logistic collapse centred a little past the midpoint.
const EDGE_START = 1.4;
const EDGE_FLOOR = -0.45;
const edgeAt = (month: number, speed: number): number => {
  const center = 13 - speed * 4; // faster drift → earlier collapse
  const steep = 0.35 + speed * 0.55;
  const decay = 1 / (1 + Math.exp(-steep * (month - center)));
  return EDGE_START - (EDGE_START - EDGE_FLOOR) * decay;
};

// The drift detector's statistic (a PSI-like divergence between the live and
// training feature distributions). It is ~0 while distributions match and grows
// as they pull apart — and it RISES BEFORE the edge has fully collapsed, which is
// the whole point of monitoring inputs instead of waiting for PnL to tank.
const DRIFT_MAX = 1.0;
const driftAt = (month: number, speed: number): number => {
  const center = 9 - speed * 3.5; // drift in the inputs leads the edge collapse
  const steep = 0.3 + speed * 0.5;
  return DRIFT_MAX / (1 + Math.exp(-steep * (month - center)));
};

/**
 * Distribution shift, alpha decay, and concept-drift detection on one timeline.
 * The blue line is a live strategy's rolling edge (e.g. rolling Sharpe): it holds
 * while the live feature distribution matches the one the model was trained on,
 * then decays toward — and through — zero as covariate shift accumulates. The
 * amber line is a drift-detector statistic (a PSI-like divergence between the live
 * and training distributions); it climbs as the inputs pull apart. A dashed
 * threshold sets the detector's sensitivity: the first month the drift statistic
 * crosses it, the detector FIRES (a vertical marker + a "DRIFT DETECTED" alarm).
 *
 * The teaching point is the gap between the alarm and the collapse: a good
 * detector watches the INPUTS and fires while there is still edge left to save,
 * rather than waiting for PnL to confirm the strategy is already broken. The
 * speed toggle shifts how fast the distribution drifts; the threshold slider
 * trades off early-but-jumpy (low) against late-but-calm (high) detection. The
 * lines draw left-to-right on mount and on every change, respecting
 * `prefers-reduced-motion`.
 */
export function DriftDetectorTimeline({
  title = 'Drift detection: catching alpha decay before the PnL does',
  slowLabel = 'Gradual drift',
  fastLabel = 'Fast drift',
  thresholdLabel = 'Detector threshold (sensitivity)',
  timeAxisLabel = 'Months live',
  edgeLegendLabel = 'Strategy edge (rolling Sharpe)',
  driftLegendLabel = 'Drift statistic (PSI-like)',
  thresholdLegendLabel = 'Detector threshold',
  alarmLabel = 'DRIFT DETECTED',
  edgeAtDetectionLabel = 'Edge at detection',
  monthsToDetectionLabel = 'Months to detection',
  neverFiresLabel = 'never fires',
  caption = 'Blue is the strategy’s rolling edge; it holds while live data looks like the training data, then decays through zero as the feature distribution drifts. Amber is a drift-detector statistic comparing the live distribution to the training one — it rises as the inputs pull apart, BEFORE the PnL fully rolls over. The first month it crosses the dashed threshold, the detector fires. Lower the threshold and it fires earlier (but jumps at noise — false alarms); raise it and it fires late, after the edge is mostly gone. Watch inputs, not just returns: a good detector buys you months to retrain or pull the strategy while there is still edge to protect.',
  className,
}: DriftDetectorTimelineProps) {
  const id = useId();
  const [speed, setSpeed] = useState(0); // 0 = gradual, 1 = fast
  const [threshold, setThreshold] = useState(0.4); // detector sensitivity (PSI)
  const [progress, setProgress] = useState(0); // 0 → 1 left-to-right draw
  const rafRef = useRef<number | null>(null);

  const W = 540;
  const H = 280;
  const padL = 40;
  const padR = 18;
  const padT = 24;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Sweep the draw across the timeline on mount and whenever inputs change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 950;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [speed, threshold]);

  // Sample both series at integer months.
  const edge: number[] = [];
  const drift: number[] = [];
  for (let m = 0; m <= MONTHS; m++) {
    edge.push(edgeAt(m, speed));
    drift.push(driftAt(m, speed));
  }

  // First month the drift statistic crosses the threshold → detector fires.
  let fireMonth = -1;
  for (let m = 0; m <= MONTHS; m++) {
    if (drift[m] >= threshold) {
      fireMonth = m;
      break;
    }
  }
  const fired = fireMonth >= 0;
  const edgeAtFire = fired ? edge[fireMonth] : edge[MONTHS];

  // Plot mapping. Edge axis spans EDGE_FLOOR..EDGE_START; drift axis spans 0..1;
  // both reuse the same plot box (drift scaled to the box, edge to its own range).
  const xAt = (m: number) => padL + (m / MONTHS) * plotW;
  const edgeY = (v: number) =>
    padT + plotH - ((v - EDGE_FLOOR) / (EDGE_START - EDGE_FLOOR)) * plotH;
  const driftY = (v: number) => padT + plotH - (v / DRIFT_MAX) * plotH;
  const zeroY = edgeY(0);

  // Reveal the lines up to the current sweep position.
  const revealM = progress * MONTHS;
  const path = (ys: (m: number) => number) => {
    const pts: string[] = [];
    for (let m = 0; m <= MONTHS; m++) {
      if (m > revealM + 0.001) break;
      pts.push(`${m === 0 ? 'M' : 'L'} ${xAt(m).toFixed(1)} ${ys(m).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const edgePath = path((m) => edgeY(edge[m]));
  const driftPath = path((m) => driftY(drift[m]));

  // The fire marker only appears once the sweep has reached that month.
  const markerVisible = fired && revealM >= fireMonth - 0.001;

  const edgeAtFireText = edgeAtFire.toFixed(2);
  const monthsText = fired ? String(fireMonth) : neverFiresLabel;
  const thresholdText = threshold.toFixed(2);
  const speedFast = speed > 0.5;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Drift-speed toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="drift speed"
      >
        <button
          type="button"
          onClick={() => setSpeed(0)}
          aria-pressed={!speedFast}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            !speedFast ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {slowLabel}
        </button>
        <button
          type="button"
          onClick={() => setSpeed(1)}
          aria-pressed={speedFast}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            speedFast ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {fastLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A ${MONTHS}-month timeline. The strategy edge starts near ${EDGE_START.toFixed(
          1,
        )} and decays as the feature distribution drifts (${
          speedFast ? 'fast' : 'gradual'
        } drift); the drift statistic rises from zero. With the detector threshold at ${thresholdText}, the detector ${
          fired
            ? `fires at month ${fireMonth}, when the edge is still about ${edgeAtFireText}`
            : 'never fires over the window'
        }.`}
      >
        {/* Edge zero baseline */}
        <line
          x1={padL}
          y1={zeroY}
          x2={W - padR}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text x={padL - 6} y={zeroY + 3} fontSize={8} fill="var(--color-ink-400)" textAnchor="end">
          0
        </text>

        {/* Detector threshold (on the drift axis) */}
        <line
          x1={padL}
          y1={driftY(threshold)}
          x2={W - padR}
          y2={driftY(threshold)}
          stroke="var(--color-ink-500)"
          strokeWidth={1.2}
          strokeDasharray="5 4"
        />
        <text
          x={W - padR}
          y={driftY(threshold) - 4}
          fontSize={8}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          {thresholdLegendLabel}
        </text>

        {/* Fire marker + alarm chip */}
        {markerVisible && (
          <g>
            <line
              x1={xAt(fireMonth)}
              y1={padT}
              x2={xAt(fireMonth)}
              y2={padT + plotH}
              stroke="var(--color-accent-500)"
              strokeWidth={1.4}
              strokeDasharray="3 3"
            />
            <circle
              cx={xAt(fireMonth)}
              cy={driftY(drift[fireMonth])}
              r={4.5}
              fill="var(--color-accent-500)"
            />
            <g transform={`translate(${Math.min(xAt(fireMonth) + 6, W - 112)} ${padT + 2})`}>
              <rect width={104} height={16} rx={8} fill="var(--color-accent-500)" />
              <text x={52} y={11} fontSize={8} fontWeight={700} fill="white" textAnchor="middle">
                {alarmLabel}
              </text>
            </g>
          </g>
        )}

        {/* Drift statistic line (amber / accent) */}
        <path d={driftPath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />

        {/* Strategy edge line (blue / brand) */}
        <path d={edgePath} fill="none" stroke="var(--color-brand-500)" strokeWidth={2.2} />

        {/* Sweep head dot on the edge line */}
        {progress < 1 && !prefersReducedMotion() && (
          <circle
            cx={xAt(Math.min(MONTHS, revealM))}
            cy={edgeY(edge[Math.round(Math.min(MONTHS, revealM))])}
            r={3.5}
            fill="var(--color-ink-900)"
          />
        )}

        {/* X axis */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={W - padR}
          y2={padT + plotH}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />
        {[0, 6, 12, 18, 24].map((m) => (
          <text
            key={`xt-${m}`}
            x={xAt(m)}
            y={padT + plotH + 14}
            fontSize={9}
            fill="var(--color-ink-500)"
            textAnchor="middle"
          >
            {m}
          </text>
        ))}
        <text
          x={padL + plotW / 2}
          y={H - 4}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {timeAxisLabel}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-brand-500" aria-hidden="true" />
          {edgeLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent-500" aria-hidden="true" />
          {driftLegendLabel}
        </span>
      </div>

      {/* Readout chips */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{edgeAtDetectionLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{edgeAtFireText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{monthsToDetectionLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{monthsText}</span>
        </span>
      </div>

      {/* Threshold slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-thr`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{thresholdLabel}</span>
          <span className="font-mono text-ink-600" aria-hidden="true">
            {thresholdText}
          </span>
        </label>
        <input
          id={`${id}-thr`}
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          aria-valuetext={`detector threshold ${thresholdText}; ${
            fired
              ? `fires at month ${fireMonth} with edge about ${edgeAtFireText}`
              : 'never fires over the window'
          }`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DriftDetectorTimeline;
