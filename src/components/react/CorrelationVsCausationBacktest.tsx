import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CorrelationVsCausationBacktestProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "raw / naive backtest" toggle. */
  rawLabel?: string;
  /** Label for the "controlled for the confounder" toggle. */
  controlledLabel?: string;
  /** Axis label for the signal (horizontal). */
  signalAxisLabel?: string;
  /** Axis label for the next-period return (vertical). */
  returnAxisLabel?: string;
  /** Readout chip label for the apparent slope / edge. */
  edgeLabel?: string;
  /** Word appended to indicate the edge is gone after controlling. */
  vanishedLabel?: string;
  /** Word indicating a surviving, real edge. */
  survivesLabel?: string;
  /** Caption for the regime / confounder legend (high state). */
  highStateLabel?: string;
  /** Caption for the regime / confounder legend (low state). */
  lowStateLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A tiny deterministic PRNG so the scatter is identical on server and client
// (no hydration mismatch) and stable per build.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point {
  s: number; // signal value
  r: number; // realised next-period return
  high: boolean; // which regime (the confounder) the point came from
}

/**
 * The picture behind "correlation is not alpha." Each dot is one period: the
 * horizontal axis is the value of a trading SIGNAL, the vertical axis the realised
 * next-period RETURN. A confounder — here a market regime Z that is either "high"
 * or "low" — drives BOTH the signal level and the return level. Within either
 * regime the signal has no causal effect on returns (flat cloud); but because the
 * high regime has both a higher average signal AND a higher average return, the
 * POOLED scatter shows a confident upward slope. That slope is the seductive
 * backtest edge.
 *
 * Toggle to "controlled" and the two regimes are de-meaned (each cloud is centred),
 * which is exactly what conditioning on the confounder does: the pooled slope
 * collapses toward zero and the "edge" evaporates. This is Simpson's-paradox-flavoured
 * confounding made visual. Two regression lines are drawn and morph between the raw
 * (steep) and controlled (flat) fits, respecting prefers-reduced-motion.
 *
 * No numbers or formulas are rendered as content; the slope readout is a plain
 * number formatted from the data, and every label is a string prop.
 */
export function CorrelationVsCausationBacktest({
  title = 'A signal that "predicts" returns — until you control the confounder',
  rawLabel = 'Raw backtest',
  controlledLabel = 'Control for the regime',
  signalAxisLabel = 'Signal value',
  returnAxisLabel = 'Next-period return',
  edgeLabel = 'Apparent edge (slope)',
  vanishedLabel = 'vanished',
  survivesLabel = 'survives',
  highStateLabel = 'High regime',
  lowStateLabel = 'Low regime',
  caption = 'Each dot is one period. A hidden regime drives both the signal and the return: the high-regime cloud sits up and to the right, the low-regime cloud down and to the left. Pooled, that paints a confident upward slope — the backtest "edge." But within each regime the cloud is flat: the signal causes nothing. Control for the regime (de-mean each cloud) and the slope collapses to roughly zero. The edge was the confounder all along.',
  className,
}: CorrelationVsCausationBacktestProps) {
  const id = useId();
  const [controlled, setControlled] = useState(false);
  const [progress, setProgress] = useState(1); // 0 → 1 morph between raw and controlled
  const rafRef = useRef<number | null>(null);

  const W = 480;
  const H = 300;
  const padL = 44;
  const padR = 20;
  const padT = 18;
  const padB = 40;

  // Build the two regime clouds once (deterministic).
  const points = useMemo<Point[]>(() => {
    const rnd = mulberry32(20260623);
    const pts: Point[] = [];
    const n = 28;
    // Low regime: signal centred low, return centred low; no within-regime slope.
    for (let i = 0; i < n; i++) {
      const s = 0.28 + (rnd() - 0.5) * 0.28;
      const r = 0.30 + (rnd() - 0.5) * 0.30;
      pts.push({ s, r, high: false });
    }
    // High regime: signal centred high, return centred high; no within-regime slope.
    for (let i = 0; i < n; i++) {
      const s = 0.72 + (rnd() - 0.5) * 0.28;
      const r = 0.70 + (rnd() - 0.5) * 0.30;
      pts.push({ s, r, high: true });
    }
    return pts;
  }, []);

  // Controlling de-means each regime: subtract the regime's centre so the two
  // clouds overlap. We morph each point from its raw position toward its
  // de-meaned position using `progress` (1 = fully in the selected state).
  const lowCenter = { s: 0.28, r: 0.30 };
  const highCenter = { s: 0.72, r: 0.70 };
  const pooledCenter = { s: 0.5, r: 0.5 };

  // Animate the morph whenever the toggle flips.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 650;
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
  }, [controlled]);

  // Each point's displayed position: in controlled mode, shift toward the pooled
  // centre by the regime offset (i.e. remove the between-regime difference).
  const displayPoint = (p: Point): { s: number; r: number } => {
    const center = p.high ? highCenter : lowCenter;
    const offS = pooledCenter.s - center.s;
    const offR = pooledCenter.r - center.r;
    const amt = controlled ? progress : 1 - progress; // toward controlled or back to raw
    return { s: p.s + offS * amt, r: p.r + offR * amt };
  };

  const sx = (s: number) => padL + s * (W - padL - padR);
  const sy = (r: number) => H - padB - r * (H - padT - padB);

  // OLS slope of the currently displayed cloud — this is the headline "edge."
  const displayed = points.map(displayPoint);
  const meanS = displayed.reduce((a, p) => a + p.s, 0) / displayed.length;
  const meanR = displayed.reduce((a, p) => a + p.r, 0) / displayed.length;
  let cov = 0;
  let varr = 0;
  for (const p of displayed) {
    cov += (p.s - meanS) * (p.r - meanR);
    varr += (p.s - meanS) * (p.s - meanS);
  }
  const slope = varr > 1e-9 ? cov / varr : 0;
  const intercept = meanR - slope * meanS;

  const lineY = (s: number) => slope * s + intercept;
  const x0 = 0.05;
  const x1 = 0.95;

  const edgeGone = Math.abs(slope) < 0.15;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Mode toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="backtest mode"
      >
        <button
          type="button"
          onClick={() => setControlled(false)}
          aria-pressed={!controlled}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            !controlled ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {rawLabel}
        </button>
        <button
          type="button"
          onClick={() => setControlled(true)}
          aria-pressed={controlled}
          className={cx(
            'rounded-pill px-3 py-1 font-medium transition',
            controlled ? 'bg-accent-500 text-white shadow-soft' : 'text-ink-600',
          )}
        >
          {controlledLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Scatter of signal value against next-period return, with two regime clouds. In ${controlled ? 'controlled' : 'raw'} mode the fitted slope is about ${slope.toFixed(2)}, so the apparent edge ${edgeGone ? 'has vanished' : 'survives'}.`}
      >
        {/* Axes */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-ink-300)" strokeWidth={1.2} />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-ink-300)" strokeWidth={1.2} />

        {/* Regression line */}
        <line
          x1={sx(x0)}
          y1={sy(Math.max(0, Math.min(1, lineY(x0))))}
          x2={sx(x1)}
          y2={sy(Math.max(0, Math.min(1, lineY(x1))))}
          stroke={edgeGone ? 'var(--color-ink-400)' : 'var(--color-brand-500)'}
          strokeWidth={2.6}
          strokeDasharray={edgeGone ? '6 4' : undefined}
        />

        {/* Points */}
        {displayed.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.s)}
            cy={sy(p.r)}
            r={4}
            fill={points[i].high ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
            fillOpacity={0.65}
          />
        ))}

        {/* Axis labels */}
        <text x={(padL + W - padR) / 2} y={H - 8} fontSize={10} fill="var(--color-ink-500)" textAnchor="middle">
          {signalAxisLabel}
        </text>
        <text
          x={14}
          y={(padT + H - padB) / 2}
          fontSize={10}
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(padT + H - padB) / 2})`}
        >
          {returnAxisLabel}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: 'var(--color-accent-500)' }} />
          {highStateLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: 'var(--color-brand-500)' }} />
          {lowStateLabel}
        </span>
      </div>

      {/* Readout chip */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{edgeLabel}</span>
          <span className={cx('font-mono font-semibold', edgeGone ? 'text-ink-400' : 'text-brand-600')}>
            {slope.toFixed(2)}
          </span>
          <span className={cx('text-xs font-medium', edgeGone ? 'text-ink-400' : 'text-accent-600')}>
            {edgeGone ? vanishedLabel : survivesLabel}
          </span>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CorrelationVsCausationBacktest;
